/**
 * Avatar utility supporting deterministic DiceBear avatars with fallback and custom avatar storage in Supabase.
 *
 * Rules:
 * - User avatars: DiceBear `notionists` style using user NAME as deterministic seed (NEVER user ID / UUID).
 * - Organization avatars: DiceBear `glass` style using organization NAME / SLUG as deterministic seed.
 * - Stored in Supabase: Stored in Supabase user metadata and profile state so it remains consistent across all subdomains.
 * - Google OAuth filter: Never display Google profile pictures (googleusercontent.com) over the Optic DiceBear avatar.
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
    optic_avatar_url?: string;
  };
}

/**
 * Identifies if a URL originates from third-party OAuth providers like Google OAuth
 * (e.g., lh3.googleusercontent.com) which should not override the Optic DiceBear system.
 */
export function isThirdPartyOAuthAvatar(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  return (
    lower.includes('googleusercontent.com') ||
    lower.includes('google.com/a/') ||
    lower.includes('ggpht.com')
  );
}

/**
 * Extracts the user's display name or name seed for deterministic DiceBear generation.
 * NEVER uses the user UUID / ID.
 */
export function getUserNameSeed(user?: AvatarEntity | null): string {
  if (!user) return 'Optic Developer';

  const meta = (user as any)?.user_metadata;
  const candidate =
    user.fullName?.trim() ||
    user.name?.trim() ||
    meta?.full_name?.trim() ||
    meta?.name?.trim() ||
    (user.email ? user.email.split('@')[0].trim() : '') ||
    'Optic Developer';

  return candidate || 'Optic Developer';
}

/**
 * Generates the canonical DiceBear `notionists` avatar URL for a given name seed.
 */
export function getDiceBearAvatarUrl(name: string): string {
  const clean = name.trim() || 'Optic Developer';
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(clean)}`;
}

/**
 * Returns deterministic DiceBear `notionists` avatar for a user based on their NAME.
 * Excludes third-party OAuth images (such as Google profile photos from lh3.googleusercontent.com).
 * The seed is explicitly based on the user's name, NEVER their UUID/ID.
 */
export function getUserAvatarUrl(user?: AvatarEntity | null): string {
  if (!user) {
    return getDiceBearAvatarUrl('Optic Developer');
  }

  // 1. Direct explicit avatarUrl (ensure it's not a Google OAuth photo)
  if (
    user.avatarUrl &&
    typeof user.avatarUrl === 'string' &&
    user.avatarUrl.trim().length > 0 &&
    !isThirdPartyOAuthAvatar(user.avatarUrl)
  ) {
    return user.avatarUrl.trim();
  }

  // 2. User metadata avatar_url (ensure it's not a Google OAuth photo)
  const meta = (user as any)?.user_metadata;
  if (
    meta?.optic_avatar_url &&
    typeof meta.optic_avatar_url === 'string' &&
    meta.optic_avatar_url.trim().length > 0
  ) {
    return meta.optic_avatar_url.trim();
  }

  if (
    meta?.avatar_url &&
    typeof meta.avatar_url === 'string' &&
    meta.avatar_url.trim().length > 0 &&
    !isThirdPartyOAuthAvatar(meta.avatar_url)
  ) {
    return meta.avatar_url.trim();
  }

  // 3. Name-based seed (NOT the user ID / UUID)
  const nameSeed = getUserNameSeed(user);
  return getDiceBearAvatarUrl(nameSeed);
}

/**
 * Extracts the organization name seed for deterministic DiceBear generation.
 * NEVER uses the organization UUID / ID.
 */
export function getOrgNameSeed(org?: (AvatarEntity & { name?: string }) | null): string {
  if (!org) return 'Optic Organization';
  return org.name?.trim() || 'Optic Organization';
}

/**
 * Generates the canonical DiceBear `glass` avatar URL for an organization based on its NAME.
 * NEVER uses the organization UUID / ID as the seed.
 */
export function getDiceBearOrgAvatarUrl(orgName: string): string {
  const clean = orgName.trim() || 'Optic Organization';
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(clean)}`;
}

/**
 * Returns deterministic DiceBear `glass` avatar for an organization using its NAME as the seed.
 * Excludes third-party OAuth URLs and never uses the organization UUID / ID.
 */
export function getOrgAvatarUrl(org?: (AvatarEntity & { name?: string }) | null): string {
  if (
    org?.avatarUrl &&
    typeof org.avatarUrl === 'string' &&
    org.avatarUrl.trim().length > 0 &&
    !isThirdPartyOAuthAvatar(org.avatarUrl)
  ) {
    return org.avatarUrl.trim();
  }

  // Strictly use organization NAME as deterministic seed (NEVER the org ID or UUID)
  const nameSeed = getOrgNameSeed(org);
  return getDiceBearOrgAvatarUrl(nameSeed);
}
