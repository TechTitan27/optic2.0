/**
 * Avatar utility supporting deterministic DiceBear avatars with fallback and custom avatar storage in Supabase.
 *
 * Rules:
 * - User avatars: DiceBear `notionists` style using user NAME as deterministic seed (NEVER user ID / UUID).
 * - Organization avatars: DiceBear `glass` style using organization NAME / SLUG as deterministic seed.
 * - Stored in Supabase: Stored in Supabase user metadata and profile state so it remains consistent across all subdomains.
 * - Decoupled: If a custom avatarUrl is stored on user profiles or organizations, it is returned directly.
 */

export interface AvatarEntity {
  id?: string;
  avatarUrl?: string | null;
  email?: string;
  name?: string;
  fullName?: string;
  slug?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
}

/**
 * Returns deterministic DiceBear `notionists` avatar for a user based on their NAME (or custom avatarUrl if present).
 * The seed is explicitly based on the user's name, NEVER their UUID/ID.
 */
export function getUserAvatarUrl(user?: AvatarEntity | null): string {
  if (!user) {
    return 'https://api.dicebear.com/9.x/notionists/svg?seed=Optic%20Developer';
  }

  // 1. Direct explicit avatarUrl
  if (user.avatarUrl && typeof user.avatarUrl === 'string' && user.avatarUrl.trim().length > 0) {
    return user.avatarUrl.trim();
  }

  // 2. User metadata avatar_url or picture (e.g. from Google Auth or Supabase storage)
  const meta = (user as any).user_metadata;
  if (meta?.avatar_url && typeof meta.avatar_url === 'string' && meta.avatar_url.trim().length > 0) {
    return meta.avatar_url.trim();
  }
  if (meta?.picture && typeof meta.picture === 'string' && meta.picture.trim().length > 0) {
    return meta.picture.trim();
  }

  // 3. Name-based seed (NOT the user ID / UUID)
  const nameSeed =
    user.fullName?.trim() ||
    user.name?.trim() ||
    meta?.full_name?.trim() ||
    meta?.name?.trim() ||
    (user.email ? user.email.split('@')[0].trim() : '') ||
    'Optic Developer';

  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(nameSeed)}`;
}

/**
 * Returns deterministic DiceBear `glass` avatar for an organization (or custom avatarUrl if present).
 */
export function getOrgAvatarUrl(org?: AvatarEntity | null): string {
  if (org?.avatarUrl && typeof org.avatarUrl === 'string' && org.avatarUrl.trim().length > 0) {
    return org.avatarUrl.trim();
  }
  const seed = org?.name?.trim() || org?.slug?.trim() || org?.id || 'optic-org';
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`;
}
