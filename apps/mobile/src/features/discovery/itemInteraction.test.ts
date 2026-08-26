import { describe, expect, it } from 'vitest';

import type { Item } from '../../domain/contracts';
import {
  buildSwipeSequence,
  commitItemInteractionAction,
  EMPTY_ITEM_INTERACTION_STORE,
  getConsumedItems,
  getDiscoverableItems,
  getItemInteraction,
  ITEM_INTERACTION_UNDO_LIMIT,
  setItemConsumed,
  setItemInterest,
  toggleItemSaved,
  undoLastItemInteractionAction,
  type ItemInteractionMap,
  type ItemInteractionStore,
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

  it('keeps an already-built swipe sequence independent of later consumed-state changes', () => {
    const initialInteractions: ItemInteractionMap = {};
    const swipeSequence = buildSwipeSequence(BOOK_A, ITEMS, initialInteractions);
    const updatedInteractions = setItemConsumed(initialInteractions, 'book-b', true);

    expect(swipeSequence.map((item) => item.id)).toEqual(['book-a', 'book-b', 'book-c']);
    expect(getDiscoverableItems(ITEMS, updatedInteractions).map((item) => item.id)).toEqual([
      'book-a',
      'book-c',
    ]);
  });

  it('undoes committed interaction actions in reverse order', () => {
    let store: ItemInteractionStore = EMPTY_ITEM_INTERACTION_STORE;

    store = commitItemInteractionAction(store, {
      type: 'SET_INTEREST',
      itemId: 'book-a',
      interest: 'LIKED',
    });
    store = commitItemInteractionAction(store, { type: 'TOGGLE_SAVED', itemId: 'book-a' });
    store = commitItemInteractionAction(store, {
      type: 'SET_CONSUMED',
      itemId: 'book-a',
      consumed: true,
    });

    expect(store.undoStack).toHaveLength(3);

    store = undoLastItemInteractionAction(store);
    expect(getItemInteraction(store.interactions, 'book-a')).toEqual({
      interest: 'LIKED',
      saved: true,
      consumed: false,
    });

    store = undoLastItemInteractionAction(store);
    expect(getItemInteraction(store.interactions, 'book-a')).toEqual({
      interest: 'LIKED',
      saved: false,
      consumed: false,
    });

    store = undoLastItemInteractionAction(store);
    expect(store.interactions).toEqual({});
    expect(store.undoStack).toEqual([]);
  });

  it('retains exactly the latest ten committed actions for sequential undo', () => {
    let store: ItemInteractionStore = EMPTY_ITEM_INTERACTION_STORE;

    for (let index = 0; index < ITEM_INTERACTION_UNDO_LIMIT + 2; index += 1) {
      store = commitItemInteractionAction(store, {
        type: 'TOGGLE_SAVED',
        itemId: `book-${index}`,
      });
    }

    expect(store.undoStack).toHaveLength(ITEM_INTERACTION_UNDO_LIMIT);

    for (let index = 0; index < ITEM_INTERACTION_UNDO_LIMIT; index += 1) {
      store = undoLastItemInteractionAction(store);
    }

    expect(getItemInteraction(store.interactions, 'book-0').saved).toBe(true);
    expect(getItemInteraction(store.interactions, 'book-1').saved).toBe(true);
    expect(getItemInteraction(store.interactions, 'book-2').saved).toBe(false);
    expect(store.undoStack).toEqual([]);
  });

  it('does not add no-op state changes to undo history', () => {
    const store = commitItemInteractionAction(EMPTY_ITEM_INTERACTION_STORE, {
      type: 'SET_CONSUMED',
      itemId: 'book-a',
      consumed: false,
    });

    expect(store).toBe(EMPTY_ITEM_INTERACTION_STORE);
  });
});
