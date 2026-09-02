import { describe, expect, it } from 'vitest';

import type { ItemListEntry } from './itemListOperations';
import {
  haveSelectableDestinationsChanged,
  selectPresentedListEntries,
} from './listPresentation';

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

  it('ignores a non-selectable Shared system List when comparing custom destinations', () => {
    expect(haveSelectableDestinationsChanged(
      ['custom-a'],
      ['custom-a', 'system-saved'],
      ['custom-a', 'custom-b'],
    )).toBe(false);
    expect(haveSelectableDestinationsChanged(
      ['custom-a'],
      ['custom-b', 'system-saved'],
      ['custom-a', 'custom-b'],
    )).toBe(true);
  });
});
