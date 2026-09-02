import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import type {
  ItemId,
  ItemList,
  ItemListId,
  ItemType,
  ProfileId,
} from '@/domain/contracts';
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';

import {
  createCustomItemList,
  deleteCustomItemList,
  loadConsumedItems,
  loadItemListEntries,
  loadProfileItemLists,
  renameCustomItemList,
  setItemListEntry,
  type ConsumedItemsResult,
  type ItemListDeleteResult,
  type ItemListEntriesResult,
  type ItemListMutationResult,
  type ItemListRpc,
  type ItemListsResult,
} from './itemListOperations';

export type ItemListsStatus =
  | 'disabled'
  | 'inactive'
  | 'loading'
  | 'ready'
  | 'error';

interface ItemListsContextValue {
  status: ItemListsStatus;
  lists: readonly ItemList[];
  error: string | null;
  refresh: () => void;
  loadForItem: (itemId: ItemId) => Promise<ItemListsResult>;
  createList: (name: string) => Promise<ItemListMutationResult>;
  renameList: (
    listId: ItemListId,
    name: string,
  ) => Promise<ItemListMutationResult>;
  deleteList: (listId: ItemListId) => Promise<ItemListDeleteResult>;
  setEntry: (
    listId: ItemListId,
    itemId: ItemId,
    present: boolean,
  ) => Promise<ItemListDeleteResult>;
  loadEntries: (listId: ItemListId) => Promise<ItemListEntriesResult>;
  loadConsumed: (itemType: ItemType | null) => Promise<ConsumedItemsResult>;
}

interface ListSnapshot {
  profileId: ProfileId;
  status: 'ready' | 'error';
  lists: readonly ItemList[];
  error: string | null;
}

const EMPTY_LISTS: readonly ItemList[] = [];
const UNAVAILABLE_MESSAGE = 'Listat eivät ole käytettävissä tällä hetkellä.';
const ItemListsContext = createContext<ItemListsContextValue | null>(null);

export function ItemListsProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const profiles = useActiveProfile();
  const [snapshot, setSnapshot] = useState<ListSnapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const profileId = profiles.status === 'ready'
    ? profiles.activeProfile?.id ?? null
    : null;

  const rpc = useMemo<ItemListRpc | null>(
    () => connection.status === 'configured'
      ? async (functionName, arguments_) => {
          const { data, error } = await connection.client.rpc(
            functionName,
            arguments_,
          );
          return {
            data,
            error: error ? { code: error.code, message: error.message } : null,
          };
        }
      : null,
    [connection],
  );

  useEffect(() => {
    if (!rpc || !profileId) return;
    let active = true;

    void loadProfileItemLists(rpc, profileId).then((result) => {
      if (!active) return;
      setSnapshot(result.status === 'success'
        ? { profileId, status: 'ready', lists: result.lists, error: null }
        : { profileId, status: 'error', lists: EMPTY_LISTS, error: result.message });
    });

    return () => { active = false; };
  }, [attempt, profileId, rpc]);

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);
  const runForProfile = useCallback(
    async <T,>(operation: (currentRpc: ItemListRpc, currentProfileId: ProfileId) => Promise<T>, fallback: T) => {
      return rpc && profileId ? operation(rpc, profileId) : fallback;
    },
    [profileId, rpc],
  );

  const loadForItem = useCallback(
    (itemId: ItemId) => runForProfile(
      (currentRpc, currentProfileId) => loadProfileItemLists(currentRpc, currentProfileId, itemId),
      { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListsResult,
    ),
    [runForProfile],
  );

  const createList = useCallback(
    async (name: string) => {
      const result = await runForProfile(
        (currentRpc, currentProfileId) => createCustomItemList(currentRpc, currentProfileId, name),
        { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListMutationResult,
      );
      if (result.status === 'success') refresh();
      return result;
    },
    [refresh, runForProfile],
  );

  const renameList = useCallback(
    async (listId: ItemListId, name: string) => {
      if (!rpc) return { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListMutationResult;
      const result = await renameCustomItemList(rpc, listId, name);
      if (result.status === 'success') refresh();
      return result;
    },
    [refresh, rpc],
  );

  const deleteList = useCallback(
    async (listId: ItemListId) => {
      if (!rpc) return { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListDeleteResult;
      const result = await deleteCustomItemList(rpc, listId);
      if (result.status === 'success') refresh();
      return result;
    },
    [refresh, rpc],
  );

  const setEntry = useCallback(
    async (listId: ItemListId, itemId: ItemId, present: boolean) => {
      if (!rpc) return { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListDeleteResult;
      const result = await setItemListEntry(rpc, listId, itemId, present);
      if (result.status === 'success') refresh();
      return result.status === 'success'
        ? { status: 'success' } as const
        : result;
    },
    [refresh, rpc],
  );

  const loadEntries = useCallback(
    (listId: ItemListId) => rpc
      ? loadItemListEntries(rpc, listId)
      : Promise.resolve({ status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListEntriesResult),
    [rpc],
  );

  const loadConsumed = useCallback(
    (itemType: ItemType | null) => runForProfile(
      (currentRpc, currentProfileId) => loadConsumedItems(currentRpc, currentProfileId, itemType),
      { status: 'error', message: UNAVAILABLE_MESSAGE } as ConsumedItemsResult,
    ),
    [runForProfile],
  );

  const status: ItemListsStatus = connection.status === 'unconfigured'
    ? 'disabled'
    : !profileId
      ? 'inactive'
      : snapshot?.profileId !== profileId
        ? 'loading'
        : snapshot.status;
  const lists = snapshot?.profileId === profileId ? snapshot.lists : EMPTY_LISTS;
  const error = snapshot?.profileId === profileId ? snapshot.error : null;
  const value = useMemo<ItemListsContextValue>(() => ({
    status,
    lists,
    error,
    refresh,
    loadForItem,
    createList,
    renameList,
    deleteList,
    setEntry,
    loadEntries,
    loadConsumed,
  }), [
    createList,
    deleteList,
    error,
    lists,
    loadConsumed,
    loadEntries,
    loadForItem,
    refresh,
    renameList,
    setEntry,
    status,
  ]);

  return <ItemListsContext.Provider value={value}>{children}</ItemListsContext.Provider>;
}

export function useItemLists(): ItemListsContextValue {
  const value = useContext(ItemListsContext);
  if (!value) throw new Error('useItemLists must be used within ItemListsProvider');
  return value;
}
