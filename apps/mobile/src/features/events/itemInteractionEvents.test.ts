import { describe, expect, it } from 'vitest';

import {
  getInteractionEventType,
  getUndoEventProperties,
} from './itemInteractionEvents';

const emptyInteraction = {
  interest: null,
  saved: false,
  consumed: false,
  rating: null,
  notInterested: false,
} as const;

describe('Item interaction Event semantics', () => {
  it('maps every direct current-state change to a canonical Event', () => {
    expect(
      getInteractionEventType(
        { type: 'SET_INTEREST', itemId: 'item-1', interest: 'LIKED' },
        { ...emptyInteraction, interest: 'LIKED' },
      ),
    ).toBe('ITEM_LIKED');
    expect(
      getInteractionEventType(
        { type: 'SET_INTEREST', itemId: 'item-1', interest: null },
        emptyInteraction,
      ),
    ).toBe('ITEM_INTEREST_CLEARED');
    expect(
      getInteractionEventType(
        { type: 'TOGGLE_SAVED', itemId: 'item-1' },
        { ...emptyInteraction, saved: true },
      ),
    ).toBe('ITEM_SAVED');
    expect(
      getInteractionEventType(
        { type: 'TOGGLE_SAVED', itemId: 'item-1' },
        emptyInteraction,
      ),
    ).toBe('ITEM_UNSAVED');
    expect(
      getInteractionEventType(
        { type: 'SET_CONSUMED', itemId: 'item-1', consumed: true },
        { ...emptyInteraction, consumed: true },
      ),
    ).toBe('ITEM_CONSUMED');
    expect(
      getInteractionEventType(
        { type: 'SET_CONSUMED', itemId: 'item-1', consumed: false },
        emptyInteraction,
      ),
    ).toBe('ITEM_CONSUMPTION_REVERSED');
    expect(
      getInteractionEventType(
        { type: 'SET_RATING', itemId: 'item-1', rating: 9 },
        { ...emptyInteraction, consumed: true, rating: 9 },
      ),
    ).toBe('ITEM_RATED');
    expect(
      getInteractionEventType(
        { type: 'SET_NOT_INTERESTED', itemId: 'item-1', notInterested: true },
        { ...emptyInteraction, notInterested: true },
      ),
    ).toBe('ITEM_NOT_INTERESTED');
  });

  it('retains the compensated Event and exact restored snapshot for undo', () => {
    expect(
      getUndoEventProperties('event-1', {
        interest: 'DISLIKED',
        saved: true,
        consumed: false,
        rating: null,
        notInterested: false,
      }),
    ).toEqual({
      reversedEventId: 'event-1',
      restoredInterest: 'DISLIKED',
      restoredSaved: true,
      restoredConsumed: false,
      restoredRating: null,
      restoredNotInterested: false,
    });
  });
});
