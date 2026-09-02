import type { ItemListId, ProfileId } from '../../domain/contracts';

const STORAGE_PREFIX = 'kajo:item-list-recent-use:';
const MAXIMUM_REMEMBERED_LISTS = 50;

export function loadRecentListIds(profileId: ProfileId): readonly ItemListId[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const value = localStorage.getItem(`${STORAGE_PREFIX}${profileId}`);
    if (!value) return [];

    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(isNonEmptyString)
      ? parsed.slice(0, MAXIMUM_REMEMBERED_LISTS)
      : [];
  } catch {
    return [];
  }
}

export function rememberRecentList(
  profileId: ProfileId,
  listId: ItemListId,
): readonly ItemListId[] {
  const next = [
    listId,
    ...loadRecentListIds(profileId).filter((recentId) => recentId !== listId),
  ].slice(0, MAXIMUM_REMEMBERED_LISTS);

  if (typeof localStorage === 'undefined') return next;

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${profileId}`, JSON.stringify(next));
  } catch {
    // A successful List action must not fail because optional local ordering storage is full.
  }

  return next;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
