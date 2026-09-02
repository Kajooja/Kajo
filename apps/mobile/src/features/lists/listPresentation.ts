import type { ItemList, ItemListId, ItemType } from '../../domain/contracts';
import type { ItemListEntry } from './itemListOperations';

export type ItemListTypeFilter = 'ALL' | ItemType;
export type ItemListSort = 'NEWEST' | 'OLDEST';
export type ItemListView = 'LIST' | 'GRID';

export const COMPACT_LIST_DESTINATION_LIMIT = 5;

export function orderListDestinationsByRecentUse(
  lists: readonly ItemList[],
  recentListIds: readonly ItemListId[],
): readonly ItemList[] {
  const recentOrder = new Map(
    recentListIds.map((listId, index) => [listId, index]),
  );

  return lists.slice().sort((first, second) => {
    const firstRecentIndex = recentOrder.get(first.id);
    const secondRecentIndex = recentOrder.get(second.id);

    if (firstRecentIndex !== undefined || secondRecentIndex !== undefined) {
      if (firstRecentIndex === undefined) return 1;
      if (secondRecentIndex === undefined) return -1;
      if (firstRecentIndex !== secondRecentIndex) {
        return firstRecentIndex - secondRecentIndex;
      }
    }

    const updatedDifference = Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
    if (updatedDifference !== 0) return updatedDifference;

    const nameDifference = first.name.localeCompare(second.name, 'fi');
    return nameDifference !== 0 ? nameDifference : first.id.localeCompare(second.id);
  });
}

export function selectVisibleListDestinations(
  lists: readonly ItemList[],
  expanded: boolean,
): readonly ItemList[] {
  return expanded ? lists : lists.slice(0, COMPACT_LIST_DESTINATION_LIMIT);
}

export function selectPresentedListEntries(
  entries: readonly ItemListEntry[],
  filter: ItemListTypeFilter,
  sort: ItemListSort,
): readonly ItemListEntry[] {
  return entries
    .filter((entry) => filter === 'ALL' || entry.item.itemType === filter)
    .slice()
    .sort((first, second) => {
      const difference = Date.parse(first.addedAt) - Date.parse(second.addedAt);
      if (difference !== 0) return sort === 'OLDEST' ? difference : -difference;
      return first.item.id.localeCompare(second.item.id);
    });
}

export function formatListEntryDate(value: string, locale = 'fi-FI'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
