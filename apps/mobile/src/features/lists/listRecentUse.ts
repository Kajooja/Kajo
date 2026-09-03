import type { ItemListId, ProfileId } from '../../domain/contracts';

const STORAGE_PREFIX = 'kajo:item-list-recent-use:';
const USAGE_STORAGE_PREFIX = 'kajo:item-list-usage:';
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

  try {
    const currentUsage = loadListUsage(profileId);
    const nextUsage = Object.fromEntries(
      next.map((recentId) => [
        recentId,
        recentId === listId
          ? (currentUsage[recentId] ?? 0) + 1
          : currentUsage[recentId] ?? 0,
      ]),
    );
    localStorage.setItem(
      `${USAGE_STORAGE_PREFIX}${profileId}`,
      JSON.stringify(nextUsage),
    );
  } catch {
    // Usage ranking is optional presentation state and must never block the List action.
  }

  return next;
}

export function loadMostUsedListIds(
  profileId: ProfileId,
): readonly ItemListId[] {
  const recentIds = loadRecentListIds(profileId);
  const recentOrder = new Map(
    recentIds.map((listId, index) => [listId, index]),
  );
  const usage = loadListUsage(profileId);

  return recentIds.slice().sort((first, second) => {
    const usageDifference = (usage[second] ?? 0) - (usage[first] ?? 0);
    if (usageDifference !== 0) return usageDifference;
    return (recentOrder.get(first) ?? 0) - (recentOrder.get(second) ?? 0);
  });
}

function loadListUsage(profileId: ProfileId): Readonly<Record<ItemListId, number>> {
  if (typeof localStorage === 'undefined') return {};

  try {
    const value = localStorage.getItem(`${USAGE_STORAGE_PREFIX}${profileId}`);
    if (!value) return {};

    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return {};

    const usage: Record<ItemListId, number> = {};
    for (const [listId, count] of Object.entries(parsed)) {
      if (isNonEmptyString(listId) && isUsageCount(count)) {
        usage[listId] = count;
      }
    }
    return usage;
  } catch {
    return {};
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUsageCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}
