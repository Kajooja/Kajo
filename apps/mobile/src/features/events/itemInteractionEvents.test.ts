import { describe, expect, it } from 'vitest';

import {
  getInteractionEventType,
  getUndoEventProperties,
} from './itemInteractionEvents';

describe('Item interaction Event semantics', () => {
  it('maps every direct current-state change to a canonical Event', () => {
    expect(
      getInteractionEventType(
        { type: 'SET_INTEREST', itemId: 'item-1', interest: 'LIKED' },
        { interest: 'LIKED', saved: false, consumed: false },
      ),
    ).toBe('ITEM_LIKED');
    expect(
      getInteractionEventType(
        { type: 'SET_INTEREST', itemId: 'item-1', interest: null },
        { interest: null, saved: false, consumed: false },
      ),
    ).toBe('ITEM_INTEREST_CLEARED');
    expect(
      getInteractionEventType(
        { type: 'TOGGLE_SAVED', itemId: 'item-1' },
        { interest: null, saved: true, consumed: false },
      ),
    ).toBe('ITEM_SAVED');
    expect(
      getInteractionEventType(
        { type: 'TOGGLE_SAVED', itemId: 'item-1' },
        { interest: null, saved: false, consumed: false },
      ),
    ).toBe('ITEM_UNSAVED');
    expect(
      getInteractionEventType(
        { type: 'SET_CONSUMED', itemId: 'item-1', consumed: true },
        { interest: null, saved: false, consumed: true },
      ),
    ).toBe('ITEM_CONSUMED');
    expect(
      getInteractionEventType(
        { type: 'SET_CONSUMED', itemId: 'item-1', consumed: false },
        { interest: null, saved: false, consumed: false },
      ),
    ).toBe('ITEM_CONSUMPTION_REVERSED');
  });

  it('retains the compensated Event and exact restored snapshot for undo', () => {
    expect(
      getUndoEventProperties('event-1', {
        interest: 'DISLIKED',
        saved: true,
        consumed: false,
      }),
    ).toEqual({
      reversedEventId: 'event-1',
      restoredInterest: 'DISLIKED',
      restoredSaved: true,
      restoredConsumed: false,
    });
  });
});
