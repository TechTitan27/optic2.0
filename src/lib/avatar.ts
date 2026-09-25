/**
 * Avatar utility supporting dynamic deterministic DiceBear avatars:
 *
 * Rules:
 * - User avatar: DiceBear `notionists`, seeded with user UUID.
 * - Organization avatar: DiceBear `glass`, seeded with organization UUID.
 * - Generated dynamically. Do not upload avatar files.
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
 * Generates the canonical DiceBear `notionists` avatar URL for a given seed (user UUID).
 */
export function getDiceBearAvatarUrl(seed: string): string {
  const clean = seed.trim() || 'optic-user';
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(clean)}`;
}

/**
 * Returns dynamic DiceBear `notionists` avatar for a user seeded with user UUID.
 */
export function getUserAvatarUrl(user?: AvatarEntity | null): string {
  if (!user) {
    return getDiceBearAvatarUrl('optic-user');
  }

  // 1. Direct explicit non-third-party avatarUrl if explicitly configured
  if (
    user.avatarUrl &&
    typeof user.avatarUrl === 'string' &&
    user.avatarUrl.trim().length > 0 &&
    !isThirdPartyOAuthAvatar(user.avatarUrl)
  ) {
    return user.avatarUrl.trim();
  }

  // 2. User UUID seed (DiceBear notionists)
  if (user.id && user.id.trim().length > 0) {
    return getDiceBearAvatarUrl(user.id.trim());
  }

  // 3. Fallback to name or email seed if id not yet loaded
  const fallbackSeed =
    user.fullName?.trim() ||
    user.name?.trim() ||
    user.user_metadata?.full_name?.trim() ||
    user.user_metadata?.name?.trim() ||
    (user.email ? user.email.split('@')[0].trim() : '') ||
    'optic-user';

  return getDiceBearAvatarUrl(fallbackSeed);
}

/**
 * Generates the canonical DiceBear `glass` avatar URL for an organization based on its UUID seed.
 */
export function getDiceBearOrgAvatarUrl(orgUuidOrSeed: string): string {
  const clean = orgUuidOrSeed.trim() || 'optic-org';
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(clean)}`;
}

/**
 * Returns dynamic DiceBear `glass` avatar for an organization seeded with organization UUID.
 */
export function getOrgAvatarUrl(org?: (AvatarEntity & { name?: string; slug?: string }) | null): string {
  if (!org) {
    return getDiceBearOrgAvatarUrl('optic-org');
  }

  // 1. Organization UUID seed (DiceBear glass)
  if (org.id && org.id.trim().length > 0) {
    return getDiceBearOrgAvatarUrl(org.id.trim());
  }

  // 2. Fallback to slug or name if UUID not yet assigned
  const fallbackSeed = org.slug?.trim() || org.name?.trim() || 'optic-org';
  return getDiceBearOrgAvatarUrl(fallbackSeed);
}

