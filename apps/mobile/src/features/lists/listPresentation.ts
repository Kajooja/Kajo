import type { ItemListId, ItemType } from '../../domain/contracts';
import type { ItemListEntry } from './itemListOperations';

export type ItemListTypeFilter = 'ALL' | ItemType;
export type ItemListSort = 'NEWEST' | 'OLDEST';
export type ItemListView = 'LIST' | 'GRID';

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

export function haveSelectableDestinationsChanged(
  initialIds: readonly ItemListId[],
  committedIds: readonly ItemListId[],
  selectableIds: readonly ItemListId[],
): boolean {
  const initial = new Set(initialIds);
  const selectable = new Set(selectableIds);
  const committed = new Set(committedIds.filter((id) => selectable.has(id)));

  return initial.size !== committed.size
    || [...initial].some((id) => !committed.has(id));
}
