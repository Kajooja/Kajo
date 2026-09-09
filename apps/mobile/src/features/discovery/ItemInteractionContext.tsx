import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';
import { useEventTracking } from '@/features/events/EventTrackingContext';
import { createUuidV7, type EventRecordInput } from '@/features/events/eventTracking';
import { createItemActionSender } from '@/features/events/itemActionPersistence';
import { createItemActionOutbox, type ItemActionOutbox, type ItemActionOutboxSnapshot } from '@/features/events/itemActionOutbox';
import { projectPendingItemActions, type ItemActionCommand, type ItemActionIntent, type PendingItemAction } from '@/features/events/itemActionCommands';

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
  setSaved: (itemId: ItemId, saved: boolean, eventId?: EventId) => boolean;
  setListLike: (
    itemId: ItemId,
    systemSaved: boolean,
    eventId?: EventId,
  ) => boolean;
  setConsumed: (
    itemId: ItemId,
    consumed: boolean,
    eventId?: EventId,
  ) => boolean;
  setRating: (itemId: ItemId, rating: number, eventId?: EventId, origin?: EventRecordInput) => boolean;
  setNotInterested: (
    itemId: ItemId,
    notInterested: boolean,
    eventId?: EventId,
    origin?: EventRecordInput,
  ) => boolean;
  canUndo: boolean;
  undoTargetItemId: ItemId | null;
  undo: () => ItemInteractionUndoResult | null;
  persistenceStatus: ItemInteractionPersistenceStatus;
  hasHydratedCurrentActor: boolean;
  hydrationError: string | null;
  persistenceError: string | null;
  atomicPendingCount: number;
  canDiscardUndo: boolean;
  discardRejectedUndo: () => void;
  retryHydration: () => void;
  retryPersistence: () => void;
}

export interface ItemInteractionUndoResult {
  itemId: ItemId;
  reversedEventId: EventId | null;
  restoredInteraction: ReturnType<typeof getItemInteraction>;
  atomic: boolean;
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
  const eventTracking = useEventTracking();
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
  const [hydratedActorUserId, setHydratedActorUserId] = useState<UserId | null>(
    null,
  );
  const failureTracker = useRef(createItemInteractionWriteFailureTracker());
  const scopedWriter = useRef<ScopedWriter | null>(null);
  const outbox = useRef<{ key: string; sessionId: string; coordinator: ItemActionOutbox } | null>(null);
  const [outboxState, setOutboxState] = useState<(ItemActionOutboxSnapshot & { key: string }) | null>(null);
  const legacyInFlight = useRef(new Map<string, number>());
  const activeScopeKey = useRef<string | null>(null);
  const storeRef = useRef<ItemInteractionStore>(EMPTY_ITEM_INTERACTION_STORE);

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
  const currentScopeKey = profileId && actorUserId ? `${actorUserId}:${profileId}` : null;
  useLayoutEffect(() => { activeScopeKey.current = currentScopeKey; }, [currentScopeKey]);
  const atomicSender = useMemo(() => connection.status === 'configured'
    ? createItemActionSender(connection.client) : null, [connection]);
  const outboxNamespace = connection.status === 'configured' ? connection.config.url : '';

  useEffect(() => {
    const activeSession = eventTracking.session;
    if (!persistenceApi || !profileId || !actorUserId || !atomicSender
      || !activeSession || activeSession.actorUserId !== actorUserId || activeSession.profileId !== profileId) {
      return;
    }

    let active = true;
    const key = `${actorUserId}:${profileId}`;
    const coordinator: ItemActionOutbox = createItemActionOutbox({
      namespace: outboxNamespace, scope: { actorUserId, profileId }, storage: Storage, send: atomicSender,
      isCurrent: () => active && activeScopeKey.current === key && outbox.current?.coordinator === coordinator,
      onChange: (snapshot) => {
        if (active && activeScopeKey.current === key) setOutboxState({ key, ...snapshot });
      },
      onCommitted: (receipt) => {
        if (!active || activeScopeKey.current !== key) return;
        const currentStore = storeRef.current;
        const nextStore = { ...currentStore, interactions: projectPendingItemActions(
          { ...currentStore.interactions, [receipt.itemId]: receipt.interaction }, coordinator.pending(),
        ) };
        storeRef.current = nextStore;
        setPersistedStore({ actorUserId, profileId, store: nextStore });
      },
    });
    outbox.current = { key, sessionId: activeSession.sessionId, coordinator };

    void loadPersistedItemInteractions(persistenceApi, profileId).then(
      (result) => {
        if (!active || activeScopeKey.current !== key) {
          return;
        }

        if (result.status === 'error') {
          setHydrationFailure({ profileId, actorUserId, message: result.message });
          return;
        }

        setHydrationFailure(null);
        const loadedStore: ItemInteractionStore = {
          interactions: projectPendingItemActions(result.interactions, coordinator.pending()), undoStack: [],
        };
        storeRef.current = loadedStore;
        setPersistedStore({
          profileId,
          actorUserId,
          store: loadedStore,
        });
        setHydratedActorUserId(actorUserId);
        coordinator.start();
      },
    );

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') coordinator.retry();
    });
    return () => {
      active = false;
      coordinator.stop();
      subscription.remove();
      if (outbox.current?.coordinator === coordinator) outbox.current = null;
    };
  }, [actorUserId, atomicSender, eventTracking.session, hydrationAttempt, outboxNamespace, persistenceApi, profileId]);

  const isLocalMode =
    connection.status === 'unconfigured' || activeProfile.status === 'disabled';
  const hasHydratedConfiguredStore = Boolean(
    configuredScope &&
      persistedStore &&
      persistedStore.profileId === configuredScope.profileId &&
      persistedStore.actorUserId === configuredScope.actorUserId,
  );
  const hasHydratedCurrentActor = Boolean(
    configuredScope && hydratedActorUserId === configuredScope.actorUserId,
  );
  const store = isLocalMode
    ? localStore
    : hasHydratedConfiguredStore && persistedStore
      ? persistedStore.store
      : EMPTY_ITEM_INTERACTION_STORE;
  useLayoutEffect(() => { storeRef.current = store; }, [store]);
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
      legacyInFlight.current.set(scopeKey, (legacyInFlight.current.get(scopeKey) ?? 0) + 1);

      void scopedWriter.current.writer.enqueue(request).then((result) => {
        legacyInFlight.current.set(scopeKey, Math.max(0, (legacyInFlight.current.get(scopeKey) ?? 1) - 1));
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
      storeRef.current = nextStore;
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
      if (activeScopeKey.current !== currentScopeKey) return false;
      if (configuredScope && outbox.current?.sessionId !== eventTracking.session?.sessionId) return false;
      // The remaining legacy List projection must not overtake an unacknowledged
      // atomic action with a copied whole-state write.
      if (configuredScope && outbox.current?.coordinator.pending().length) return false;

      const currentStore = storeRef.current;
      const nextStore = commitItemInteractionAction(currentStore, action);

      if (nextStore === currentStore) {
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
      currentScopeKey,
      eventTracking.session?.sessionId,
      enqueuePersistence,
      persistenceStatus,
      replaceStore,
    ],
  );

  const queueAtomic = useCallback((itemId: ItemId, intent: ItemActionIntent, eventId: EventId,
    origin?: EventRecordInput, restoredInteraction?: ReturnType<typeof getItemInteraction>) => {
    const current = outbox.current;
    const session = eventTracking.session;
    if (!configuredScope || !currentScopeKey || activeScopeKey.current !== currentScopeKey
      || current?.key !== currentScopeKey || !session || session.actorUserId !== actorUserId
      || current.sessionId !== session.sessionId
      || session.profileId !== profileId
      || (legacyInFlight.current.get(`${profileId}:${actorUserId}`) ?? 0) > 0
      || failureTracker.current.getFailed(profileId ?? '').some(request => request.actorUserId === actorUserId)) return false;
    const command: ItemActionCommand = {
      version: 1, ...configuredScope, actionId: eventId, itemId,
      occurredAt: new Date().toISOString(), ...intent,
      session: { sessionId: session.sessionId, startedAt: session.startedAt, context: session.context },
      predictionId: origin?.predictionId ?? null,
      discoveryMode: origin?.discoveryMode ?? null,
    };
    const entry: PendingItemAction = { command, ...(restoredInteraction ? { restoredInteraction } : {}) };
    return current.coordinator.enqueue(entry);
  }, [actorUserId, configuredScope, currentScopeKey, eventTracking.session, profileId]);

  const commitAtomicAction = useCallback((action: ItemInteractionAction,
    intent: ItemActionIntent, origin?: EventRecordInput) => {
    if (isLocalMode) return commitAction(action);
    if (persistenceStatus !== 'ready') return false;
    const eventId = action.eventId ?? createUuidV7();
    const currentStore = storeRef.current;
    const nextStore = commitItemInteractionAction(currentStore, { ...action, eventId, atomicActionId: eventId });
    if (nextStore === currentStore || !queueAtomic(action.itemId, intent, eventId, origin)) return false;
    // enqueue synchronously commits to SQLite before acknowledging the action.
    replaceStore(nextStore);
    return true;
  }, [commitAction, isLocalMode, persistenceStatus, queueAtomic, replaceStore]);

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

  const setSaved = useCallback(
    (itemId: ItemId, saved: boolean, eventId?: EventId) =>
      commitAction({
        type: 'SET_SAVED',
        itemId,
        saved,
        ...(eventId ? { eventId } : {}),
      }),
    [commitAction],
  );

  const setListLike = useCallback(
    (itemId: ItemId, systemSaved: boolean, eventId?: EventId) =>
      commitAction({
        type: 'SET_LIST_LIKE',
        itemId,
        systemSaved,
        ...(eventId ? { eventId } : {}),
      }),
    [commitAction],
  );

  const setRating = useCallback(
    (itemId: ItemId, rating: number, eventId?: EventId, origin?: EventRecordInput) => {
      return commitAtomicAction({
        type: 'SET_RATING',
        itemId,
        rating,
        ...(eventId ? { eventId } : {}),
      }, { kind: 'SET_RATING', rating }, origin);
    },
    [commitAtomicAction],
  );

  const setNotInterested = useCallback(
    (itemId: ItemId, notInterested: boolean, eventId?: EventId, origin?: EventRecordInput) => {
      return commitAtomicAction({
        type: 'SET_NOT_INTERESTED',
        itemId,
        notInterested,
        ...(eventId ? { eventId } : {}),
      }, { kind: 'SET_NOT_INTERESTED', notInterested }, origin);
    },
    [commitAtomicAction],
  );

  const undo = useCallback(() => {
    if (persistenceStatus !== 'disabled' && persistenceStatus !== 'ready') {
      return null;
    }

    if (activeScopeKey.current !== currentScopeKey) return null;
    if (configuredScope && outbox.current?.sessionId !== eventTracking.session?.sessionId) return null;
    const currentStore = storeRef.current;
    const undoEntry = getLatestUndoEntry(currentStore);

    if (!undoEntry) {
      return null;
    }

    const nextStore = undoLastItemInteractionAction(currentStore);
    const restoredInteraction = getItemInteraction(nextStore.interactions, undoEntry.itemId);
    if (undoEntry.atomicActionId) {
      if (!queueAtomic(undoEntry.itemId, { kind: 'UNDO', reversesActionId: undoEntry.atomicActionId },
        createUuidV7(), undefined, restoredInteraction)) return null;
    } else if (configuredScope && outbox.current?.coordinator.pending().length) return null;

    replaceStore(nextStore);
    if (configuredScope && !undoEntry.atomicActionId) {
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
      atomic: Boolean(undoEntry.atomicActionId),
      restoredInteraction: getItemInteraction(
        nextStore.interactions,
        undoEntry.itemId,
      ),
    };
  }, [
    configuredScope,
    currentScopeKey,
    eventTracking.session?.sessionId,
    enqueuePersistence,
    persistenceStatus,
    replaceStore,
    queueAtomic,
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
    outbox.current?.coordinator.retry();

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

  const discardRejectedUndo = useCallback(() => {
    if (outbox.current?.key === currentScopeKey && outbox.current.coordinator.discardRejectedUndo()) {
      retryHydration();
    }
  }, [currentScopeKey, retryHydration]);

  const undoTargetItemId = getLatestUndoItemId(store);
  const hydrationError =
    configuredScope && hydrationFailure?.profileId === configuredScope.profileId
      ? hydrationFailure.message
      : null;
  const atomicState = outboxState?.key === currentScopeKey ? outboxState : null;
  const persistenceError = atomicState?.message ?? (atomicState?.pendingCount
    ? `${atomicState.pendingCount} valintaa odottaa tallennusta. Valinnat säilyvät tällä laitteella.` : null) ?? (
    configuredScope && persistenceFailure?.profileId === configuredScope.profileId
      ? persistenceFailure.message
      : null);

  const value = useMemo<ItemInteractionState>(
    () => ({
      interactions: store.interactions,
      setInterest,
      toggleSaved,
      setSaved,
      setListLike,
      setConsumed,
      setRating,
      setNotInterested,
      canUndo: store.undoStack.length > 0,
      undoTargetItemId,
      undo,
      persistenceStatus,
      hasHydratedCurrentActor,
      hydrationError,
      persistenceError,
      atomicPendingCount: atomicState?.pendingCount ?? 0,
      canDiscardUndo: atomicState?.canDiscardUndo ?? false,
      discardRejectedUndo,
      retryHydration,
      retryPersistence,
    }),
    [
      hasHydratedCurrentActor,
      hydrationError,
      persistenceError,
      atomicState?.pendingCount,
      atomicState?.canDiscardUndo,
      discardRejectedUndo,
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
      setSaved,
      setListLike,
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
