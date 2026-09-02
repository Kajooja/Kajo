import { describe, expect, it } from 'vitest';

import type { Item } from '../../domain/contracts';
import {
  buildSwipeSequence,
  commitItemInteractionAction,
  EMPTY_ITEM_INTERACTION_STORE,
  getConsumedItems,
  getDiscoverableItems,
  getItemInteraction,
  getLatestUndoEntry,
  getLatestUndoItemId,
  getNextSwipeIndex,
  ITEM_INTERACTION_UNDO_LIMIT,
  setItemConsumed,
  setItemInterest,
  setItemNotInterested,
  setItemRating,
  setItemSaved,
  toggleItemSaved,
  undoLastItemInteractionAction,
  type ItemInteractionMap,
  type ItemInteractionStore,
} from './itemInteraction';

const BOOK_A: Item = { id: 'book-a', itemType: 'BOOK', title: 'Book A' };
const BOOK_B: Item = { id: 'book-b', itemType: 'BOOK', title: 'Book B' };
const BOOK_C: Item = { id: 'book-c', itemType: 'BOOK', title: 'Book C' };
const MOVIE_A: Item = { id: 'movie-a', itemType: 'MOVIE', title: 'Movie A' };
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
      rating: null,
      notInterested: false,
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
      rating: null,
      notInterested: false,
    });
  });

  it('sets saved state exactly for list destination synchronization', () => {
    const saved = setItemSaved({}, 'book-a', true);
    expect(getItemInteraction(saved, 'book-a').saved).toBe(true);
    expect(setItemSaved(saved, 'book-a', true)).toEqual(saved);
    expect(getItemInteraction(setItemSaved(saved, 'book-a', false), 'book-a').saved).toBe(false);
  });

  it('makes rating consumed and not-interested explicitly unconsumed', () => {
    let interactions = setItemNotInterested({}, 'book-a', true);

    expect(getItemInteraction(interactions, 'book-a')).toMatchObject({
      consumed: false,
      rating: null,
      notInterested: true,
    });

    interactions = setItemRating(interactions, 'book-a', 9);

    expect(getItemInteraction(interactions, 'book-a')).toMatchObject({
      interest: null,
      consumed: true,
      rating: 9,
      notInterested: false,
    });
    interactions = setItemRating(interactions, 'book-a', 0);
    expect(getItemInteraction(interactions, 'book-a').rating).toBe(0);
    expect(setItemRating(interactions, 'book-a', 11)).toBe(interactions);
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
      rating: null,
      notInterested: false,
    });

    store = undoLastItemInteractionAction(store);
    expect(getItemInteraction(store.interactions, 'book-a')).toEqual({
      interest: 'LIKED',
      saved: false,
      consumed: false,
      rating: null,
      notInterested: false,
    });

    store = undoLastItemInteractionAction(store);
    expect(store.interactions).toEqual({});
    expect(store.undoStack).toEqual([]);
  });

  it('retains the exact Item target for mixed BOOK and MOVIE undo order', () => {
    let store: ItemInteractionStore = EMPTY_ITEM_INTERACTION_STORE;

    store = commitItemInteractionAction(store, {
      type: 'SET_INTEREST',
      itemId: BOOK_A.id,
      interest: 'LIKED',
    });
    store = commitItemInteractionAction(store, {
      type: 'TOGGLE_SAVED',
      itemId: MOVIE_A.id,
    });
    store = commitItemInteractionAction(store, {
      type: 'SET_CONSUMED',
      itemId: BOOK_B.id,
      consumed: true,
    });

    expect(getLatestUndoItemId(store)).toBe(BOOK_B.id);
    store = undoLastItemInteractionAction(store);
    expect(getLatestUndoItemId(store)).toBe(MOVIE_A.id);
    store = undoLastItemInteractionAction(store);
    expect(getLatestUndoItemId(store)).toBe(BOOK_A.id);
    store = undoLastItemInteractionAction(store);
    expect(getLatestUndoItemId(store)).toBeNull();
  });

  it('retains the original Event ID for a traceable undo', () => {
    const store = commitItemInteractionAction(EMPTY_ITEM_INTERACTION_STORE, {
      type: 'SET_INTEREST',
      itemId: BOOK_A.id,
      interest: 'LIKED',
      eventId: '01992d6a-20c0-7000-8000-000000000001',
    });

    expect(getLatestUndoEntry(store)?.eventId).toBe(
      '01992d6a-20c0-7000-8000-000000000001',
    );
  });

  it('advances every supported committed action and lets undo target its previous card', () => {
    const actions = [
      { type: 'SET_INTEREST', itemId: BOOK_A.id, interest: 'LIKED' },
      { type: 'SET_INTEREST', itemId: BOOK_A.id, interest: 'DISLIKED' },
      { type: 'TOGGLE_SAVED', itemId: BOOK_A.id },
      { type: 'SET_CONSUMED', itemId: BOOK_A.id, consumed: true },
    ] as const;

    for (const action of actions) {
      const store = commitItemInteractionAction(EMPTY_ITEM_INTERACTION_STORE, action);
      const nextIndex = getNextSwipeIndex(0, ITEMS.length);

      expect(nextIndex).toBe(1);
      expect(getLatestUndoItemId(store)).toBe(BOOK_A.id);
      expect(ITEMS.findIndex((item) => item.id === getLatestUndoItemId(store))).toBe(0);
      expect(undoLastItemInteractionAction(store)).toEqual(EMPTY_ITEM_INTERACTION_STORE);
    }
  });

  it('commits safely without advancing when the current Item is the last card', () => {
    expect(getNextSwipeIndex(ITEMS.length - 1, ITEMS.length)).toBeNull();
    expect(getNextSwipeIndex(-1, ITEMS.length)).toBeNull();
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
