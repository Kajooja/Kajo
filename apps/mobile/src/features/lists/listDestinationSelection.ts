import type { ItemList } from '../../domain/contracts';

export interface ListDestinationCommit {
  lists: readonly ItemList[];
  added: boolean;
  message: string | null;
  stayOpen?: boolean;
}

export type ListDestinationCommitResult =
  | { status: 'success'; notice?: string }
  | { status: 'error'; message: string };

// Keep per-List durable commands ordered, but complete the user's whole choice
// once. Partial success reports only acknowledged additions and keeps the draft.
export async function commitPersonalListDestinations(options: {
  lists: readonly ItemList[];
  message: string | null;
  isCurrent: () => boolean;
  save: (list: ItemList) => Promise<ListDestinationCommitResult>;
  onSaved: (list: ItemList, completed: number) => void;
  onCommitted: (commit: ListDestinationCommit) => Promise<ListDestinationCommitResult>;
}): Promise<ListDestinationCommitResult> {
  const saved: ItemList[] = [];
  let error: string | null = null;
  const stale = { status: 'error', message: 'Näkymä vaihtui. Tarkista tallentuneet lisäykset.' } as const;
  for (const list of options.lists) {
    if (!options.isCurrent()) return stale;
    let result: ListDestinationCommitResult;
    try { result = await options.save(list); }
    catch { result = { status: 'error', message: 'Kaikkien lisäysten tilaa ei voitu varmistaa. Tarkista tallennuksen tila ennen jatkamista.' }; }
    if (!options.isCurrent()) return stale;
    if (result.status === 'error') { error = result.message; break; }
    saved.push(list);
    options.onSaved(list, saved.length);
  }
  if (saved.length === 0) return { status: 'error', message: error ?? 'Valitse ensin lista.' };
  const completion = await options.onCommitted({ lists: saved, added: saved.some(list => !list.containsItem),
    message: options.message, stayOpen: error !== null });
  if (completion.status === 'error') return completion;
  return error ? { status: 'error', message: [error, completion.notice].filter(Boolean).join(' ') } : completion;
}

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
