/**
 * Avatar utility supporting deterministic DiceBear avatars with fallback and future custom avatars.
 *
 * Rules:
 * - User avatars: DiceBear `notionists` style using user UUID / ID as deterministic seed
 * - Organization avatars: DiceBear `glass` style using organization UUID / ID as deterministic seed
 * - Decoupled: If a custom `avatarUrl` is stored on user profiles or organizations in the future,
 *   it is returned directly without tightly coupling the UI to DiceBear.
 * - Dynamic generation without image storage.
 */

export interface AvatarEntity {
  id?: string;
  avatarUrl?: string | null;
  email?: string;
  name?: string;
  slug?: string;
}

/**
 * Returns deterministic DiceBear `notionists` avatar for a user (or custom avatarUrl if present).
 */
export function getUserAvatarUrl(user?: AvatarEntity | null): string {
  if (user?.avatarUrl && user.avatarUrl.trim().length > 0) {
    return user.avatarUrl.trim();
  }
  const seed = user?.id || user?.email || 'optic-developer';
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Returns deterministic DiceBear `glass` avatar for an organization (or custom avatarUrl if present).
 */
export function getOrgAvatarUrl(org?: AvatarEntity | null): string {
  if (org?.avatarUrl && org.avatarUrl.trim().length > 0) {
    return org.avatarUrl.trim();
  }
  const seed = org?.id || org?.slug || org?.name || 'optic-org';
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}`;
}
