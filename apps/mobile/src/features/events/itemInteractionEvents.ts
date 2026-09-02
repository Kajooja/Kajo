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
    case 'SET_SAVED':
      return nextInteraction.saved ? 'ITEM_SAVED' : 'ITEM_UNSAVED';
    case 'SET_CONSUMED':
      return action.consumed
        ? 'ITEM_CONSUMED'
        : 'ITEM_CONSUMPTION_REVERSED';
    case 'SET_RATING':
      return action.rating === null
        ? 'ITEM_CONSUMPTION_REVERSED'
        : 'ITEM_RATED';
    case 'SET_NOT_INTERESTED':
      return action.notInterested
        ? 'ITEM_NOT_INTERESTED'
        : 'ITEM_INTEREST_CLEARED';
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
    restoredRating: restoredInteraction.rating,
    restoredNotInterested: restoredInteraction.notInterested,
  };
}
