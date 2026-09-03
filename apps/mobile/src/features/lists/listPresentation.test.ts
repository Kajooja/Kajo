import { describe, expect, it } from 'vitest';

import type { ItemListEntry } from './itemListOperations';
import {
  COMPACT_LIST_DESTINATION_LIMIT,
  DRAWER_MOST_USED_LIST_LIMIT,
  orderListDestinationsByRecentUse,
  selectDrawerQuickLists,
  selectVisibleListDestinations,
  selectPresentedListEntries,
} from './listPresentation';
import type { ItemList } from '../../domain/contracts';

const entries: readonly ItemListEntry[] = [
  {
    listId: 'list-a',
    profileId: 'profile-a',
    listKind: 'CUSTOM',
    listName: 'Meidän',
    item: { id: 'book-a', itemType: 'BOOK', title: 'Book A' },
    addedByUserId: 'user-a',
    addedByNickname: 'A',
    addedAt: '2026-09-01T08:00:00.000Z',
    saved: false,
    consumed: true,
    rating: 9,
  },
  {
    listId: 'list-a',
    profileId: 'profile-a',
    listKind: 'CUSTOM',
    listName: 'Meidän',
    item: { id: 'movie-a', itemType: 'MOVIE', title: 'Movie A' },
    addedByUserId: 'user-b',
    addedByNickname: 'B',
    addedAt: '2026-09-01T09:00:00.000Z',
    saved: false,
    consumed: false,
    rating: null,
  },
];

describe('list presentation', () => {
  it('filters by generic ItemType and sorts deterministically by added time', () => {
    expect(selectPresentedListEntries(entries, 'ALL', 'NEWEST').map((entry) => entry.item.id))
      .toEqual(['movie-a', 'book-a']);
    expect(selectPresentedListEntries(entries, 'BOOK', 'OLDEST').map((entry) => entry.item.id))
      .toEqual(['book-a']);
  });

  it('orders destinations by per-Profile recent use before deterministic fallback order', () => {
    const lists: readonly ItemList[] = [
      createList('system', 'Tallennetut', '2026-09-02T08:00:00.000Z'),
      createList('older', 'Aiempi', '2026-09-01T08:00:00.000Z'),
      createList('newer', 'Uudempi', '2026-09-02T09:00:00.000Z'),
    ];

    expect(orderListDestinationsByRecentUse(lists, ['older', 'system']).map((list) => list.id))
      .toEqual(['older', 'system', 'newer']);
    expect(orderListDestinationsByRecentUse(lists, []).map((list) => list.id))
      .toEqual(['newer', 'system', 'older']);
  });

  it('shows at most five destinations until the compact selector is expanded', () => {
    const lists = Array.from(
      { length: COMPACT_LIST_DESTINATION_LIMIT + 2 },
      (_, index) => createList(`list-${index}`, `Lista ${index}`, '2026-09-02T08:00:00.000Z'),
    );

    expect(selectVisibleListDestinations(lists, false)).toHaveLength(5);
    expect(selectVisibleListDestinations(lists, true)).toHaveLength(7);
  });

  it('keeps the drawer compact with three most-used custom Lists', () => {
    const lists: readonly ItemList[] = [
      createList('system', 'Tallennetut', '2026-09-02T10:00:00.000Z'),
      createList('a', 'A', '2026-09-02T08:00:00.000Z'),
      createList('b', 'B', '2026-09-02T09:00:00.000Z'),
      createList('c', 'C', '2026-09-02T07:00:00.000Z'),
      createList('d', 'D', '2026-09-02T11:00:00.000Z'),
    ];

    const quickLists = selectDrawerQuickLists(lists, ['c', 'a', 'b', 'd']);

    expect(quickLists).toHaveLength(DRAWER_MOST_USED_LIST_LIMIT);
    expect(quickLists.map((list) => list.id)).toEqual(['c', 'a', 'b']);
  });
});

function createList(id: string, name: string, updatedAt: string): ItemList {
  return {
    id,
    profileId: 'profile-a',
    kind: id === 'system' ? 'SYSTEM_SAVED' : 'CUSTOM',
    name,
    itemCount: 0,
    containsItem: false,
    createdAt: updatedAt,
    updatedAt,
  };
}
