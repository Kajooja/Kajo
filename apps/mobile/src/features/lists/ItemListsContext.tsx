import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
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
import { useItemInteractions } from '@/features/discovery/ItemInteractionContext';
import { createCollectionMutationRpc, type CollectionActionSource } from '@/features/events/collectionActions';
import type { EventRecordInput } from '@/features/events/eventTracking';

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
  scopeKey: string | null;
  revision: number;
  lists: readonly ItemList[];
  error: string | null;
  refresh: () => void;
  loadForItem: (itemId: ItemId) => Promise<ItemListsResult>;
  createList: (name: string, source?: CollectionActionSource) => Promise<ItemListMutationResult>;
  renameList: (
    listId: ItemListId,
    name: string,
  ) => Promise<ItemListMutationResult>;
  deleteList: (listId: ItemListId) => Promise<ItemListDeleteResult>;
  setEntry: (
    listId: ItemListId,
    itemId: ItemId,
    present: boolean,
    options?: { positive?: boolean; origin?: EventRecordInput },
  ) => Promise<ItemListDeleteResult>;
  loadEntries: (listId: ItemListId) => Promise<ItemListEntriesResult>;
  loadConsumed: (itemType: ItemType | null) => Promise<ConsumedItemsResult>;
}

interface ListSnapshot {
  scopeKey: string;
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
  const { submitCollectionAction, collectionRevision } = useItemInteractions();
  const [snapshot, setSnapshot] = useState<ListSnapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const profileId = profiles.status === 'ready'
    ? profiles.activeProfile?.id ?? null
    : null;

  const namespace = connection.status === 'configured' ? connection.config.url : '';
  const scopeKey = profileId && profiles.actorUserId ? `${namespace}:${profiles.actorUserId}:${profileId}` : null;
  const scopeToken = useMemo(() => ({ scopeKey }), [scopeKey]);
  const currentScope = useRef(scopeToken);
  useLayoutEffect(() => { currentScope.current = scopeToken; }, [scopeToken]);

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
    if (!rpc || !profileId || !scopeKey) return;
    let active = true;

    void loadProfileItemLists(rpc, profileId).then((result) => {
      if (!active || currentScope.current !== scopeToken) return;
      setSnapshot(result.status === 'success'
        ? { scopeKey, status: 'ready', lists: result.lists, error: null }
        : { scopeKey, status: 'error', lists: EMPTY_LISTS, error: result.message });
    });

    return () => { active = false; };
  }, [attempt, collectionRevision, profileId, rpc, scopeKey, scopeToken]);

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);
  const runForProfile = useCallback(
    async <T,>(operation: (currentRpc: ItemListRpc, currentProfileId: ProfileId) => Promise<T>, fallback: T,
      mutation?: { source: CollectionActionSource; positive?: boolean; origin?: EventRecordInput }) => {
      if (!rpc || !profileId || !scopeKey || currentScope.current !== scopeToken) return fallback;
      const api = mutation ? createCollectionMutationRpc(submitCollectionAction, profileId,
        mutation.source, mutation.origin, mutation.positive) : rpc;
      const result = await operation(api, profileId);
      return currentScope.current === scopeToken ? result : fallback;
    },
    [profileId, rpc, scopeKey, scopeToken, submitCollectionAction],
  );
  const loadForItem = useCallback(
    (itemId: ItemId) => runForProfile(
      (api, id) => loadProfileItemLists(api, id, itemId),
      { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListsResult), [runForProfile]);
  const createList = useCallback(
    (name: string, source: CollectionActionSource = 'LISTS') => runForProfile(
      (api, id) => createCustomItemList(api, id, name),
      { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListMutationResult, { source }), [runForProfile]);
  const renameList = useCallback(
    (listId: ItemListId, name: string) => runForProfile(
      api => renameCustomItemList(api, listId, name),
      { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListMutationResult, { source: 'LIST_DETAIL' }), [runForProfile]);
  const deleteList = useCallback(
    (listId: ItemListId) => runForProfile(api => deleteCustomItemList(api, listId),
      { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListDeleteResult, { source: 'LIST_DETAIL' }), [runForProfile]);
  const setEntry = useCallback(
    (listId: ItemListId, itemId: ItemId, present: boolean,
      options?: { positive?: boolean; origin?: EventRecordInput }) => runForProfile(
      api => setItemListEntry(api, listId, itemId, present),
      { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListDeleteResult,
      { source: options?.positive ? 'ITEM_DESTINATION_PICKER' : 'LIST_DETAIL', ...options }), [runForProfile]);
  const loadEntries = useCallback(
    (listId: ItemListId) => runForProfile(async (api, id) => {
      const result = await loadItemListEntries(api, listId);
      return result.status === 'success' && result.entries.some(entry => entry.profileId !== id)
        ? { status: 'error', message: UNAVAILABLE_MESSAGE } as const : result;
    }, { status: 'error', message: UNAVAILABLE_MESSAGE } as ItemListEntriesResult), [runForProfile]);
  const loadConsumed = useCallback(
    (itemType: ItemType | null) => runForProfile((api, id) => loadConsumedItems(api, id, itemType),
      { status: 'error', message: UNAVAILABLE_MESSAGE } as ConsumedItemsResult), [runForProfile]);

  const status: ItemListsStatus = connection.status === 'unconfigured'
    ? 'disabled'
    : !profileId
      ? 'inactive'
      : snapshot?.scopeKey !== scopeKey
        ? 'loading'
        : snapshot.status;
  const lists = snapshot?.scopeKey === scopeKey ? snapshot.lists : EMPTY_LISTS;
  const error = snapshot?.scopeKey === scopeKey ? snapshot.error : null;
  const value = useMemo<ItemListsContextValue>(() => ({
    status,
    scopeKey,
    revision: collectionRevision,
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
    collectionRevision,
    scopeKey,
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
