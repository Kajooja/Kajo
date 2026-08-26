import { describe, expect, it } from 'vitest';

import type { Item } from '../../domain/contracts';
import {
  buildSwipeSequence,
  getConsumedItems,
  getDiscoverableItems,
  getItemInteraction,
  setItemConsumed,
  setItemInterest,
  toggleItemSaved,
  type ItemInteractionMap,
} from './itemInteraction';

const BOOK_A: Item = { id: 'book-a', itemType: 'BOOK', title: 'Book A' };
const BOOK_B: Item = { id: 'book-b', itemType: 'BOOK', title: 'Book B' };
const BOOK_C: Item = { id: 'book-c', itemType: 'BOOK', title: 'Book C' };
const ITEMS: readonly Item[] = [BOOK_A, BOOK_B, BOOK_C];

describe('item interaction state', () => {
  it('keeps interest, saved and consumed state independent', () => {
    let interactions: ItemInteractionMap = {};

    interactions = setItemInterest(interactions, 'book-a', 'LIKED');
    interactions = toggleItemSaved(interactions, 'book-a');
    interactions = setItemConsumed(interactions, 'book-a', true);

    expect(getItemInteraction(interactions, 'book-a')).toEqual({
      interest: 'LIKED',
      saved: true,
      consumed: true,
    });
  });

  it('supports changing and clearing interest without changing other state', () => {
    let interactions: ItemInteractionMap = toggleItemSaved({}, 'book-a');

    interactions = setItemInterest(interactions, 'book-a', 'DISLIKED');
    interactions = setItemInterest(interactions, 'book-a', null);

    expect(getItemInteraction(interactions, 'book-a')).toEqual({
      interest: null,
      saved: true,
      consumed: false,
    });
  });

  it('suppresses consumed Items from ordinary discovery and exposes them in history', () => {
    const interactions = setItemConsumed({}, 'book-b', true);

    expect(getDiscoverableItems(ITEMS, interactions).map((item) => item.id)).toEqual([
      'book-a',
      'book-c',
    ]);
    expect(getConsumedItems(ITEMS, interactions).map((item) => item.id)).toEqual(['book-b']);
  });

  it('starts swipe at the selected Item and suppresses other consumed Items', () => {
    const interactions = setItemConsumed({}, 'book-b', true);

    expect(buildSwipeSequence(BOOK_C, ITEMS, interactions).map((item) => item.id)).toEqual([
      'book-c',
      'book-a',
    ]);

    expect(buildSwipeSequence(BOOK_B, ITEMS, interactions).map((item) => item.id)).toEqual([
      'book-b',
      'book-a',
      'book-c',
    ]);
  });
});
