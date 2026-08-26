import type { Item, ItemId } from '../../domain/contracts';

export type ItemInterest = 'LIKED' | 'DISLIKED';

export interface ItemInteraction {
  interest: ItemInterest | null;
  saved: boolean;
  consumed: boolean;
}

export type ItemInteractionMap = Readonly<Record<ItemId, ItemInteraction>>;

export type ItemInteractionAction =
  | { type: 'SET_INTEREST'; itemId: ItemId; interest: ItemInterest | null }
  | { type: 'TOGGLE_SAVED'; itemId: ItemId }
  | { type: 'SET_CONSUMED'; itemId: ItemId; consumed: boolean };

interface ItemInteractionUndoEntry {
  itemId: ItemId;
  previousInteraction: ItemInteraction | null;
}

export interface ItemInteractionStore {
  interactions: ItemInteractionMap;
  undoStack: readonly ItemInteractionUndoEntry[];
}

export const ITEM_INTERACTION_UNDO_LIMIT = 10;

export const EMPTY_ITEM_INTERACTION: Readonly<ItemInteraction> = {
  interest: null,
  saved: false,
  consumed: false,
};

export const EMPTY_ITEM_INTERACTION_STORE: Readonly<ItemInteractionStore> = {
  interactions: {},
  undoStack: [],
};

export function getItemInteraction(
  interactions: ItemInteractionMap,
  itemId: ItemId,
): ItemInteraction {
  return interactions[itemId] ?? EMPTY_ITEM_INTERACTION;
}

export function setItemInterest(
  interactions: ItemInteractionMap,
  itemId: ItemId,
  interest: ItemInterest | null,
): ItemInteractionMap {
  return updateItemInteraction(interactions, itemId, { interest });
}

export function toggleItemSaved(
  interactions: ItemInteractionMap,
  itemId: ItemId,
): ItemInteractionMap {
  const current = getItemInteraction(interactions, itemId);
  return updateItemInteraction(interactions, itemId, { saved: !current.saved });
}

export function setItemConsumed(
  interactions: ItemInteractionMap,
  itemId: ItemId,
  consumed: boolean,
): ItemInteractionMap {
  return updateItemInteraction(interactions, itemId, { consumed });
}

export function commitItemInteractionAction(
  store: ItemInteractionStore,
  action: ItemInteractionAction,
): ItemInteractionStore {
  const hadPreviousInteraction = Object.prototype.hasOwnProperty.call(
    store.interactions,
    action.itemId,
  );
  const previousInteraction = hadPreviousInteraction
    ? getItemInteraction(store.interactions, action.itemId)
    : null;
  const interactions = applyItemInteractionAction(store.interactions, action);
  const nextInteraction = getItemInteraction(interactions, action.itemId);

  if (areItemInteractionsEqual(previousInteraction ?? EMPTY_ITEM_INTERACTION, nextInteraction)) {
    return store;
  }

  return {
    interactions,
    undoStack: [
      ...store.undoStack.slice(-(ITEM_INTERACTION_UNDO_LIMIT - 1)),
      { itemId: action.itemId, previousInteraction },
    ],
  };
}

export function undoLastItemInteractionAction(store: ItemInteractionStore): ItemInteractionStore {
  const lastEntry = store.undoStack[store.undoStack.length - 1];

  if (!lastEntry) {
    return store;
  }

  const interactions = lastEntry.previousInteraction
    ? updateItemInteraction(store.interactions, lastEntry.itemId, lastEntry.previousInteraction)
    : removeItemInteraction(store.interactions, lastEntry.itemId);

  return {
    interactions,
    undoStack: store.undoStack.slice(0, -1),
  };
}

export function getDiscoverableItems(
  items: readonly Item[],
  interactions: ItemInteractionMap,
): readonly Item[] {
  return items.filter((item) => !getItemInteraction(interactions, item.id).consumed);
}

export function getConsumedItems(
  items: readonly Item[],
  interactions: ItemInteractionMap,
): readonly Item[] {
  return items.filter((item) => getItemInteraction(interactions, item.id).consumed);
}

export function buildSwipeSequence(
  selectedItem: Item,
  rankedItems: readonly Item[],
  interactions: ItemInteractionMap,
): readonly Item[] {
  const remaining = getDiscoverableItems(rankedItems, interactions).filter(
    (item) => item.id !== selectedItem.id,
  );

  return [selectedItem, ...remaining];
}

function updateItemInteraction(
  interactions: ItemInteractionMap,
  itemId: ItemId,
  patch: Partial<ItemInteraction>,
): ItemInteractionMap {
  return {
    ...interactions,
    [itemId]: {
      ...getItemInteraction(interactions, itemId),
      ...patch,
    },
  };
}

function applyItemInteractionAction(
  interactions: ItemInteractionMap,
  action: ItemInteractionAction,
): ItemInteractionMap {
  switch (action.type) {
    case 'SET_INTEREST':
      return setItemInterest(interactions, action.itemId, action.interest);
    case 'TOGGLE_SAVED':
      return toggleItemSaved(interactions, action.itemId);
    case 'SET_CONSUMED':
      return setItemConsumed(interactions, action.itemId, action.consumed);
  }
}

function areItemInteractionsEqual(
  first: ItemInteraction,
  second: ItemInteraction,
): boolean {
  return (
    first.interest === second.interest &&
    first.saved === second.saved &&
    first.consumed === second.consumed
  );
}

function removeItemInteraction(
  interactions: ItemInteractionMap,
  itemId: ItemId,
): ItemInteractionMap {
  const nextInteractions = { ...interactions };
  delete nextInteractions[itemId];
  return nextInteractions;
}
