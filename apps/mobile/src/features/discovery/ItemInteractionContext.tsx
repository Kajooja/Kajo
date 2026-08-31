import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';

import type { EventId, ItemId, ProfileId, UserId } from '../../domain/contracts';
import {
  commitItemInteractionAction,
  EMPTY_ITEM_INTERACTION_STORE,
  getItemInteraction,
  getLatestUndoEntry,
  getLatestUndoItemId,
  undoLastItemInteractionAction,
  type ItemInteractionAction,
  type ItemInteractionMap,
  type ItemInteractionStore,
  type ItemInterest,
} from './itemInteraction';
import {
  createSerializedItemInteractionWriter,
  createItemInteractionWriteFailureTracker,
  createSupabaseItemInteractionPersistenceApi,
  loadPersistedItemInteractions,
  persistItemInteraction,
  type ItemInteractionPersistenceApi,
  type ItemInteractionWriteRequest,
  type SerializedItemInteractionWriter,
} from './itemInteractionPersistence';

export type ItemInteractionPersistenceStatus =
  | 'inactive'
  | 'disabled'
  | 'loading'
  | 'ready'
  | 'error';

interface ItemInteractionState {
  interactions: ItemInteractionMap;
  setInterest: (
    itemId: ItemId,
    interest: ItemInterest | null,
    eventId?: EventId,
  ) => boolean;
  toggleSaved: (itemId: ItemId, eventId?: EventId) => boolean;
  setConsumed: (
    itemId: ItemId,
    consumed: boolean,
    eventId?: EventId,
  ) => boolean;
  setRating: (itemId: ItemId, rating: number, eventId?: EventId) => boolean;
  setNotInterested: (
    itemId: ItemId,
    notInterested: boolean,
    eventId?: EventId,
  ) => boolean;
  canUndo: boolean;
  undoTargetItemId: ItemId | null;
  undo: () => ItemInteractionUndoResult | null;
  persistenceStatus: ItemInteractionPersistenceStatus;
  hydrationError: string | null;
  persistenceError: string | null;
  retryHydration: () => void;
  retryPersistence: () => void;
}

export interface ItemInteractionUndoResult {
  itemId: ItemId;
  reversedEventId: EventId | null;
  restoredInteraction: ReturnType<typeof getItemInteraction>;
}

interface PersistedStoreScope {
  profileId: ProfileId;
  actorUserId: UserId;
  store: ItemInteractionStore;
}

interface HydrationFailure {
  profileId: ProfileId;
  actorUserId: UserId;
  message: string;
}

interface PersistenceFailure {
  profileId: ProfileId;
  message: string;
}

interface ScopedWriter {
  scopeKey: string;
  writer: SerializedItemInteractionWriter;
}

const ItemInteractionContext = createContext<ItemInteractionState | null>(null);

export function ItemInteractionProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const activeProfile = useActiveProfile();
  const [localStore, setLocalStore] = useState<ItemInteractionStore>(
    EMPTY_ITEM_INTERACTION_STORE,
  );
  const [persistedStore, setPersistedStore] =
    useState<PersistedStoreScope | null>(null);
  const [hydrationFailure, setHydrationFailure] =
    useState<HydrationFailure | null>(null);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const [persistenceFailure, setPersistenceFailure] =
    useState<PersistenceFailure | null>(null);
  const failureTracker = useRef(createItemInteractionWriteFailureTracker());
  const scopedWriter = useRef<ScopedWriter | null>(null);

  const persistenceApi = useMemo<ItemInteractionPersistenceApi | null>(
    () =>
      connection.status === 'configured'
        ? createSupabaseItemInteractionPersistenceApi(connection.client)
        : null,
    [connection],
  );

  const configuredScope = getConfiguredScope(activeProfile, persistenceApi);
  const profileId = configuredScope?.profileId ?? null;
  const actorUserId = configuredScope?.actorUserId ?? null;

  useEffect(() => {
    if (!persistenceApi || !profileId || !actorUserId) {
      return;
    }

    let active = true;

    void loadPersistedItemInteractions(persistenceApi, profileId).then(
      (result) => {
        if (!active) {
          return;
        }

        if (result.status === 'error') {
          setHydrationFailure({ profileId, actorUserId, message: result.message });
          return;
        }

        setHydrationFailure(null);
        setPersistedStore({
          profileId,
          actorUserId,
          store: {
            interactions: result.interactions,
            undoStack: [],
          },
        });
      },
    );

    return () => {
      active = false;
    };
  }, [actorUserId, hydrationAttempt, persistenceApi, profileId]);

  const isLocalMode =
    connection.status === 'unconfigured' || activeProfile.status === 'disabled';
  const hasHydratedConfiguredStore = Boolean(
    configuredScope &&
      persistedStore &&
      persistedStore.profileId === configuredScope.profileId &&
      persistedStore.actorUserId === configuredScope.actorUserId,
  );
  const store = isLocalMode
    ? localStore
    : hasHydratedConfiguredStore && persistedStore
      ? persistedStore.store
      : EMPTY_ITEM_INTERACTION_STORE;
  const persistenceStatus = getPersistenceStatus(
    isLocalMode,
    configuredScope,
    persistedStore,
    hydrationFailure,
  );

  const enqueuePersistence = useCallback(
    (request: ItemInteractionWriteRequest) => {
      if (!persistenceApi) {
        return;
      }

      const scopeKey = `${request.profileId}:${request.actorUserId}`;

      if (scopedWriter.current?.scopeKey !== scopeKey) {
        scopedWriter.current = {
          scopeKey,
          writer: createSerializedItemInteractionWriter((queuedRequest) =>
            persistItemInteraction(persistenceApi, queuedRequest),
          ),
        };
      }

      failureTracker.current.queued(request);

      void scopedWriter.current.writer.enqueue(request).then((result) => {
        const outcome = failureTracker.current.settled(request, result);

        if (outcome === 'failed' && result.status === 'error') {
          setPersistenceFailure({
            profileId: request.profileId,
            message: result.message,
          });
          return;
        }

        if (
          outcome === 'succeeded' &&
          !failureTracker.current.hasFailed(request.profileId)
        ) {
          setPersistenceFailure((current) =>
            current?.profileId === request.profileId ? null : current,
          );
        }
      });
    },
    [persistenceApi],
  );

  const replaceStore = useCallback(
    (nextStore: ItemInteractionStore) => {
      if (isLocalMode) {
        setLocalStore(nextStore);
        return;
      }

      if (configuredScope && hasHydratedConfiguredStore) {
        setPersistedStore({ ...configuredScope, store: nextStore });
      }
    },
    [configuredScope, hasHydratedConfiguredStore, isLocalMode],
  );

  const commitAction = useCallback(
    (action: ItemInteractionAction) => {
      if (persistenceStatus !== 'disabled' && persistenceStatus !== 'ready') {
        return false;
      }

      const nextStore = commitItemInteractionAction(store, action);

      if (nextStore === store) {
        return false;
      }

      replaceStore(nextStore);

      if (configuredScope) {
        enqueuePersistence({
          ...configuredScope,
          itemId: action.itemId,
          interaction: getItemInteraction(nextStore.interactions, action.itemId),
        });
      }

      return true;
    },
    [
      configuredScope,
      enqueuePersistence,
      persistenceStatus,
      replaceStore,
      store,
    ],
  );

  const setInterest = useCallback(
    (itemId: ItemId, interest: ItemInterest | null, eventId?: EventId) => {
      return commitAction({
        type: 'SET_INTEREST',
        itemId,
        interest,
        ...(eventId ? { eventId } : {}),
      });
    },
    [commitAction],
  );

  const toggleSaved = useCallback(
    (itemId: ItemId, eventId?: EventId) => {
      return commitAction({
        type: 'TOGGLE_SAVED',
        itemId,
        ...(eventId ? { eventId } : {}),
      });
    },
    [commitAction],
  );

  const setConsumed = useCallback(
    (itemId: ItemId, consumed: boolean, eventId?: EventId) => {
      return commitAction({
        type: 'SET_CONSUMED',
        itemId,
        consumed,
        ...(eventId ? { eventId } : {}),
      });
    },
    [commitAction],
  );

  const setRating = useCallback(
    (itemId: ItemId, rating: number, eventId?: EventId) => {
      return commitAction({
        type: 'SET_RATING',
        itemId,
        rating,
        ...(eventId ? { eventId } : {}),
      });
    },
    [commitAction],
  );

  const setNotInterested = useCallback(
    (itemId: ItemId, notInterested: boolean, eventId?: EventId) => {
      return commitAction({
        type: 'SET_NOT_INTERESTED',
        itemId,
        notInterested,
        ...(eventId ? { eventId } : {}),
      });
    },
    [commitAction],
  );

  const undo = useCallback(() => {
    if (persistenceStatus !== 'disabled' && persistenceStatus !== 'ready') {
      return null;
    }

    const undoEntry = getLatestUndoEntry(store);

    if (!undoEntry) {
      return null;
    }

    const nextStore = undoLastItemInteractionAction(store);
    replaceStore(nextStore);

    if (configuredScope) {
      enqueuePersistence({
        ...configuredScope,
        itemId: undoEntry.itemId,
        interaction: getItemInteraction(
          nextStore.interactions,
          undoEntry.itemId,
        ),
      });
    }

    return {
      itemId: undoEntry.itemId,
      reversedEventId: undoEntry.eventId,
      restoredInteraction: getItemInteraction(
        nextStore.interactions,
        undoEntry.itemId,
      ),
    };
  }, [
    configuredScope,
    enqueuePersistence,
    persistenceStatus,
    replaceStore,
    store,
  ]);

  const retryHydration = useCallback(() => {
    if (!configuredScope) {
      return;
    }

    setPersistedStore(null);
    setHydrationFailure(null);
    setHydrationAttempt((current) => current + 1);
  }, [configuredScope]);

  const retryPersistence = useCallback(() => {
    if (!configuredScope) {
      return;
    }

    const currentFailures = failureTracker.current.getFailed(
      configuredScope.profileId,
    );

    if (currentFailures.length === 0) {
      setPersistenceFailure(null);
      return;
    }

    for (const request of currentFailures) {
      enqueuePersistence(request);
    }
  }, [configuredScope, enqueuePersistence]);

  const undoTargetItemId = getLatestUndoItemId(store);
  const hydrationError =
    configuredScope && hydrationFailure?.profileId === configuredScope.profileId
      ? hydrationFailure.message
      : null;
  const persistenceError =
    configuredScope && persistenceFailure?.profileId === configuredScope.profileId
      ? persistenceFailure.message
      : null;

  const value = useMemo<ItemInteractionState>(
    () => ({
      interactions: store.interactions,
      setInterest,
      toggleSaved,
      setConsumed,
      setRating,
      setNotInterested,
      canUndo: store.undoStack.length > 0,
      undoTargetItemId,
      undo,
      persistenceStatus,
      hydrationError,
      persistenceError,
      retryHydration,
      retryPersistence,
    }),
    [
      hydrationError,
      persistenceError,
      persistenceStatus,
      retryHydration,
      retryPersistence,
      setConsumed,
      setInterest,
      setNotInterested,
      setRating,
      store.interactions,
      store.undoStack.length,
      toggleSaved,
      undo,
      undoTargetItemId,
    ],
  );

  return (
    <ItemInteractionContext.Provider value={value}>
      {children}
    </ItemInteractionContext.Provider>
  );
}

export function useItemInteractions(): ItemInteractionState {
  const state = useContext(ItemInteractionContext);

  if (!state) {
    throw new Error(
      'useItemInteractions must be used within ItemInteractionProvider',
    );
  }

  return state;
}

function getConfiguredScope(
  activeProfile: ReturnType<typeof useActiveProfile>,
  persistenceApi: ItemInteractionPersistenceApi | null,
): Omit<PersistedStoreScope, 'store'> | null {
  if (
    activeProfile.status !== 'ready' ||
    !activeProfile.activeProfile ||
    !activeProfile.actorUserId ||
    !persistenceApi
  ) {
    return null;
  }

  return {
    profileId: activeProfile.activeProfile.id,
    actorUserId: activeProfile.actorUserId,
  };
}

function getPersistenceStatus(
  isLocalMode: boolean,
  configuredScope: Omit<PersistedStoreScope, 'store'> | null,
  persistedStore: PersistedStoreScope | null,
  hydrationFailure: HydrationFailure | null,
): ItemInteractionPersistenceStatus {
  if (isLocalMode) {
    return 'disabled';
  }

  if (!configuredScope) {
    return 'inactive';
  }

  if (
    hydrationFailure?.profileId === configuredScope.profileId &&
    hydrationFailure.actorUserId === configuredScope.actorUserId
  ) {
    return 'error';
  }

  if (
    persistedStore?.profileId === configuredScope.profileId &&
    persistedStore.actorUserId === configuredScope.actorUserId
  ) {
    return 'ready';
  }

  return 'loading';
}
