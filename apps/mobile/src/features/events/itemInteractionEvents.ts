import type {
  EventId,
  EventType,
} from '../../domain/contracts';
import type {
  ItemInteraction,
  ItemInteractionAction,
} from '../discovery/itemInteraction';

export function getInteractionEventType(
  action: ItemInteractionAction,
  nextInteraction: ItemInteraction,
): EventType {
  switch (action.type) {
    case 'SET_INTEREST':
      if (action.interest === 'LIKED') return 'ITEM_LIKED';
      if (action.interest === 'DISLIKED') return 'ITEM_DISLIKED';
      return 'ITEM_INTEREST_CLEARED';
    case 'TOGGLE_SAVED':
      return nextInteraction.saved ? 'ITEM_SAVED' : 'ITEM_UNSAVED';
    case 'SET_CONSUMED':
      return action.consumed
        ? 'ITEM_CONSUMED'
        : 'ITEM_CONSUMPTION_REVERSED';
  }
}

export function getUndoEventProperties(
  reversedEventId: EventId,
  restoredInteraction: ItemInteraction,
): Readonly<Record<string, unknown>> {
  return {
    reversedEventId,
    restoredInterest: restoredInteraction.interest,
    restoredSaved: restoredInteraction.saved,
    restoredConsumed: restoredInteraction.consumed,
  };
}
