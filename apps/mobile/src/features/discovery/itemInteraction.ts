import type { Item, ItemId } from '../../domain/contracts';

export type ItemInterest = 'LIKED' | 'DISLIKED';

export interface ItemInteraction {
  interest: ItemInterest | null;
  saved: boolean;
  consumed: boolean;
}

export type ItemInteractionMap = Readonly<Record<ItemId, ItemInteraction>>;

export const EMPTY_ITEM_INTERACTION: Readonly<ItemInteraction> = {
  interest: null,
  saved: false,
  consumed: false,
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
