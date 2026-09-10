import type { ItemList } from '../../domain/contracts';

// Selection is a draft. Creating or choosing a destination never saves an Item.
export function resolveListDestination(
  lists: readonly ItemList[],
  selectedId: string | null,
  isSharedProfile: boolean,
): ItemList | null {
  const available = lists.filter(list => isSharedProfile || !list.containsItem);
  return available.find(list => list.id === selectedId)
    ?? (available.length === 1 ? available[0]! : null);
}

export function includeCreatedDestination(lists: readonly ItemList[], created: ItemList): readonly ItemList[] {
  return [created, ...lists.filter(list => list.id !== created.id)];
}
