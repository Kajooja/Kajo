import type { ItemList } from '../../domain/contracts';

// Selection is a draft. Creating or choosing a destination never saves an Item.
export function resolveListDestinations(
  lists: readonly ItemList[],
  selectedIds: readonly string[] | null,
  isSharedProfile: boolean,
): readonly ItemList[] {
  const available = lists.filter(list => isSharedProfile || !list.containsItem);
  if (selectedIds === null) return available.length === 1 ? available : [];
  // Preserve the chosen order through recent-List refreshes. An explicit empty
  // selection stays empty, including when the only List is unchecked.
  return [...new Set(selectedIds)].flatMap(id => {
    const list = available.find(candidate => candidate.id === id);
    return list ? [list] : [];
  });
}

export function toggleListDestination(selectedIds: readonly string[], id: string): readonly string[] {
  return selectedIds.includes(id) ? selectedIds.filter(selected => selected !== id) : [...selectedIds, id];
}

export function includeCreatedDestination(lists: readonly ItemList[], created: ItemList): readonly ItemList[] {
  return [created, ...lists.filter(list => list.id !== created.id)];
}
