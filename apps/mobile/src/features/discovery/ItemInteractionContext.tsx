import { createExposureOrderedSender } from '../events/eventOutbox';
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
import { canUseEventOrigin, createUuidV7, type EventRecordInput } from '@/features/events/eventTracking';
import { createItemActionOutbox, type ItemActionOutbox, type ItemActionOutboxSnapshot } from '@/features/events/itemActionOutbox';
import { type ItemActionCommand, type ItemActionIntent, type PendingItemAction } from '@/features/events/itemActionCommands';
import {
  createProfileActionSender, isCollectionCommand, isPendingProfileAction, projectPendingProfileActions,
  type CollectionActionCommand, type CollectionActionIntent, type CollectionActionSource,
  type CollectionSubmissionResult, type PendingProfileAction, type ProfileActionReceipt,
} from '@/features/events/collectionActions';

import type { EventId, ItemId, ProfileId, UserId } from '../../domain/contracts';
import {
  commitItemInteractionAction,
  applyCollectionUndoReceipt,
  canUndoItemInteraction,
  EMPTY_ITEM_INTERACTION_STORE,
  getItemInteraction,
  getLatestUndoEntry,
  getLatestUndoItemId,
  undoLastItemInteractionAction,
  type ItemInteractionAction,
  type ItemInteractionMap,
  type ItemInteractionStore,
} from './itemInteraction';
import {
  createAcknowledgedInteractionRefresh,
  createSupabaseItemInteractionPersistenceApi,
  loadPersistedItemInteractions,
  type ItemInteractionPersistenceApi,
} from './itemInteractionPersistence';
import { subscribeToBootstrapEvidence } from './predictionRefresh';

export type ItemInteractionPersistenceStatus =
  | 'inactive'
  | 'disabled'
  | 'loading'
  | 'ready'
  | 'error';

interface ItemInteractionState {
  interactions: ItemInteractionMap;
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
  canDiscardAction: boolean;
  discardRejectedAction: () => void;
  collectionRevision: number;
  submitCollectionAction: (intent: CollectionActionIntent, source: CollectionActionSource,
    origin?: EventRecordInput) => Promise<CollectionSubmissionResult>;
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

const ItemInteractionContext = createContext<ItemInteractionState | null>(null);

export function ItemInteractionProvider({ children }: PropsWithChildren) {
  const connection = useSupabaseConnection();
  const activeProfile = useActiveProfile();
  const eventTracking = useEventTracking();
  const { subscribeToAcknowledgements } = eventTracking;
  const [localStore, setLocalStore] = useState<ItemInteractionStore>(
    EMPTY_ITEM_INTERACTION_STORE,
  );
  const [persistedStore, setPersistedStore] =
    useState<PersistedStoreScope | null>(null);
  const [hydrationFailure, setHydrationFailure] =
    useState<HydrationFailure | null>(null);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const [hydratedActorUserId, setHydratedActorUserId] = useState<UserId | null>(
    null,
  );
  const outbox = useRef<{ key: string; sessionId: string; coordinator: ItemActionOutbox<PendingProfileAction> } | null>(null);
  const collectionWaiters = useRef(new Map<string, { key: string; resolve: (result: CollectionSubmissionResult) => void }>());
  const [collectionRevision, setCollectionRevision] = useState(0);
  const [outboxState, setOutboxState] = useState<(ItemActionOutboxSnapshot & { key: string; sessionId: string }) | null>(null);
  const activeScopeKey = useRef<string | null>(null);
  const activeSessionId = useRef<string | null>(null);
  const storeRef = useRef<ItemInteractionStore>(EMPTY_ITEM_INTERACTION_STORE);

  const persistenceApi = useMemo<ItemInteractionPersistenceApi | null>(
    () =>
      connection.status === 'configured'
        ? createSupabaseItemInteractionPersistenceApi(connection.client)
        : null,
    [connection],
  );

  const configuredScope = useMemo(() => getConfiguredScope(activeProfile, persistenceApi), [activeProfile, persistenceApi]);
  const profileId = configuredScope?.profileId ?? null;
  const actorUserId = configuredScope?.actorUserId ?? null;
  const outboxNamespace = connection.status === 'configured' ? connection.config.url : '';
  const currentScopeKey = profileId && actorUserId ? `${outboxNamespace}:${actorUserId}:${profileId}` : null;
  useLayoutEffect(() => {
    activeScopeKey.current = currentScopeKey;
    activeSessionId.current = eventTracking.sessionId;
    return () => { activeScopeKey.current = null; activeSessionId.current = null; };
  }, [currentScopeKey, eventTracking.sessionId]);
  const atomicSender = useMemo(() => connection.status === 'configured'
    ? createProfileActionSender(connection.client) : null, [connection]);

  useEffect(() => {
    const activeSession = eventTracking.session;
    if (!persistenceApi || !profileId || !actorUserId || !atomicSender
      || !activeSession || activeSession.actorUserId !== actorUserId || activeSession.profileId !== profileId) {
      return;
    }

    let active = true;
    const key = `${outboxNamespace}:${actorUserId}:${profileId}`;
    const settleWaiting = (message: string) => {
      for (const [id, waiter] of collectionWaiters.current) {
        if (waiter.key !== key) continue;
        waiter.resolve({ status: 'error', message });
        collectionWaiters.current.delete(id);
      }
    };
    const coordinator: ItemActionOutbox<PendingProfileAction> = createItemActionOutbox<PendingProfileAction, ProfileActionReceipt>({
      namespace: outboxNamespace, scope: { actorUserId, profileId }, storage: Storage,
      send: createExposureOrderedSender(eventTracking.canSendAction, atomicSender,
        () => active && activeScopeKey.current === key && activeSessionId.current === activeSession.sessionId && outbox.current?.coordinator === coordinator),
      isPendingAction: isPendingProfileAction,
      isCurrent: () => active && activeScopeKey.current === key && activeSessionId.current === activeSession.sessionId && outbox.current?.coordinator === coordinator,
      onChange: (snapshot) => {
        if (active && activeScopeKey.current === key && activeSessionId.current === activeSession.sessionId) setOutboxState({ key, sessionId: activeSession.sessionId, ...snapshot });
        if (snapshot.message) settleWaiting(snapshot.message);
      },
      onCommitted: (receipt) => {
        if (!active || activeScopeKey.current !== key || activeSessionId.current !== activeSession.sessionId) return;
        const currentStore = storeRef.current;
        let nextStore: ItemInteractionStore = { ...currentStore, interactions: projectPendingProfileActions(
          receipt.itemId && receipt.interaction
            ? { ...currentStore.interactions, [receipt.itemId]: receipt.interaction } : currentStore.interactions,
          coordinator.pending(),
        ) };
        if ('kind' in receipt) {
          nextStore = applyCollectionUndoReceipt(nextStore, receipt);
          setCollectionRevision(revision => revision + 1);
          collectionWaiters.current.get(receipt.actionId)?.resolve({ status: 'success', receipt });
          collectionWaiters.current.delete(receipt.actionId);
        }
        storeRef.current = nextStore;
        setPersistedStore({ actorUserId, profileId, store: nextStore });
        if (coordinator.pending().length === 0) void refreshAcknowledgedState();
      },
    });
    const refreshAcknowledgedState = createAcknowledgedInteractionRefresh({
      load: () => loadPersistedItemInteractions(persistenceApi, profileId),
      canApply: () => active && activeScopeKey.current === key && activeSessionId.current === activeSession.sessionId
        && outbox.current?.coordinator === coordinator && coordinator.pending().length === 0,
      onLoaded: (interactions) => {
        const nextStore = { ...storeRef.current, interactions };
        storeRef.current = nextStore;
        setPersistedStore({ actorUserId, profileId, store: nextStore });
      },
    });
    outbox.current = { key, sessionId: activeSession.sessionId, coordinator };
    const unsubscribeExposure = subscribeToAcknowledgements(() => coordinator.resumeAfterExposure());

    void loadPersistedItemInteractions(persistenceApi, profileId).then(
      (result) => {
        if (!active || activeScopeKey.current !== key || activeSessionId.current !== activeSession.sessionId) {
          return;
        }

        if (result.status === 'error') {
          setHydrationFailure({ profileId, actorUserId, message: result.message });
          return;
        }

        setHydrationFailure(null);
        const loadedStore: ItemInteractionStore = {
          interactions: projectPendingProfileActions(result.interactions, coordinator.pending()), undoStack: [],
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

    const unsubscribeBootstrap = subscribeToBootstrapEvidence(() => {
      void refreshAcknowledgedState();
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        coordinator.retry();
        void refreshAcknowledgedState();
      }
    });
    return () => {
      active = false;
      coordinator.stop();
      settleWaiting('Profiili tai istunto vaihtui. Odottava valinta säilyy alkuperäisen profiilin jonossa.');
      subscription.remove();
      unsubscribeBootstrap();
      unsubscribeExposure();
      if (outbox.current?.coordinator === coordinator) outbox.current = null;
    };
  }, [actorUserId, atomicSender, eventTracking.canSendAction, eventTracking.session, subscribeToAcknowledgements, hydrationAttempt, outboxNamespace, persistenceApi, profileId]);

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

  const commitAction = useCallback((action: ItemInteractionAction) => {
    if (!isLocalMode) return false;
    const currentStore = storeRef.current;
    const nextStore = commitItemInteractionAction(currentStore, action);
    if (nextStore === currentStore) return false;
    replaceStore(nextStore);
    return true;
  }, [isLocalMode, replaceStore]);

  const queueAtomic = useCallback((itemId: ItemId, intent: ItemActionIntent, eventId: EventId,
    origin?: EventRecordInput, restoredInteraction?: ReturnType<typeof getItemInteraction>) => {
    const current = outbox.current;
    const session = eventTracking.session;
    if (!configuredScope || !currentScopeKey || activeScopeKey.current !== currentScopeKey
      || current?.key !== currentScopeKey || !session || session.actorUserId !== actorUserId
      || current.sessionId !== session.sessionId || activeSessionId.current !== session.sessionId
      || !canUseEventOrigin(origin, session.sessionId, itemId)
      || session.profileId !== profileId
      || current.coordinator.pending().some(entry => isCollectionCommand(entry.command))) return false;
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

  const queueCollection = useCallback((intent: CollectionActionIntent, source: CollectionActionSource,
    origin?: EventRecordInput, restoredInteraction?: ReturnType<typeof getItemInteraction>) => {
    const current = outbox.current;
    const session = eventTracking.session;
    if (persistenceStatus !== 'ready' || !configuredScope || !currentScopeKey
      || activeScopeKey.current !== currentScopeKey || current?.key !== currentScopeKey
      || !session || session.actorUserId !== actorUserId || session.profileId !== profileId
      || current.sessionId !== session.sessionId || activeSessionId.current !== session.sessionId
      || !canUseEventOrigin(origin, session.sessionId, 'itemId' in intent ? intent.itemId : null)
      || current.coordinator.pending().length > 0) return null;
    const command: CollectionActionCommand = {
      version: 1, ...configuredScope, actionId: createUuidV7(), occurredAt: new Date().toISOString(),
      ...intent, source, session: { sessionId: session.sessionId, startedAt: session.startedAt, context: session.context },
      predictionId: origin?.predictionId ?? null, discoveryMode: origin?.discoveryMode ?? null,
    };
    return current.coordinator.enqueue({ command, ...(restoredInteraction ? { restoredInteraction } : {}) })
      ? command.actionId : null;
  }, [actorUserId, configuredScope, currentScopeKey, eventTracking.session, persistenceStatus, profileId]);

  const submitCollectionAction = useCallback((intent: CollectionActionIntent, source: CollectionActionSource,
    origin?: EventRecordInput): Promise<CollectionSubmissionResult> => {
    const actionId = queueCollection(intent, source, origin);
    if (!actionId || !currentScopeKey) return Promise.resolve({ status: 'error',
      message: 'Valintaa ei voitu aloittaa. Odota edellisen tallennuksen valmistumista tai yritä uudelleen.' });
    return new Promise(resolve => collectionWaiters.current.set(actionId, { key: currentScopeKey, resolve }));
  }, [currentScopeKey, queueCollection]);

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
    if (configuredScope && (outbox.current?.sessionId !== eventTracking.session?.sessionId
      || activeSessionId.current !== eventTracking.session?.sessionId)) return null;
    const currentStore = storeRef.current;
    const undoEntry = getLatestUndoEntry(currentStore);

    if (configuredScope && (outbox.current?.key !== currentScopeKey
      || !outbox.current || outbox.current.coordinator.pending().length > 0)) return null;

    if (!undoEntry) {
      return null;
    }

    const nextStore = undoLastItemInteractionAction(currentStore);
    const restoredInteraction = getItemInteraction(nextStore.interactions, undoEntry.itemId);
    if (undoEntry.collectionActionId) {
      if (!queueCollection({ kind: 'UNDO_LIST_ENTRY', itemId: undoEntry.itemId, reversesActionId: undoEntry.collectionActionId },
        'ITEM_DESTINATION_PICKER', undefined, restoredInteraction)) return null;
    } else if (undoEntry.atomicActionId) {
      if (!queueAtomic(undoEntry.itemId, { kind: 'UNDO', reversesActionId: undoEntry.atomicActionId },
        createUuidV7(), undefined, restoredInteraction)) return null;
    } else if (configuredScope) return null;

    replaceStore(nextStore);

    return {
      itemId: undoEntry.itemId,
      reversedEventId: undoEntry.eventId,
      atomic: Boolean(undoEntry.atomicActionId || undoEntry.collectionActionId),
      restoredInteraction: getItemInteraction(
        nextStore.interactions,
        undoEntry.itemId,
      ),
    };
  }, [
    configuredScope,
    currentScopeKey,
    eventTracking.session?.sessionId,
    persistenceStatus,
    replaceStore,
    queueAtomic,
    queueCollection,
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
    if (outbox.current?.key === currentScopeKey) outbox.current.coordinator.retry();
  }, [currentScopeKey]);

  const discardRejectedUndo = useCallback(() => {
    if (outbox.current?.key === currentScopeKey && outbox.current.coordinator.discardRejectedUndo()) {
      retryHydration();
    }
  }, [currentScopeKey, retryHydration]);

  const discardRejectedAction = useCallback(() => {
    if (outbox.current?.key === currentScopeKey && outbox.current.coordinator.discardRejectedAction()) {
      setCollectionRevision(revision => revision + 1);
      retryHydration();
    }
  }, [currentScopeKey, retryHydration]);

  const undoTargetItemId = getLatestUndoItemId(store);
  const hydrationError =
    configuredScope && hydrationFailure?.profileId === configuredScope.profileId
      ? hydrationFailure.message
      : null;
  const atomicState = outboxState?.key === currentScopeKey && outboxState?.sessionId === eventTracking.sessionId ? outboxState : null;
  const canUndo = canUndoItemInteraction(store,
    isLocalMode || (persistenceStatus === 'ready' && atomicState?.ready === true),
    atomicState?.pendingCount ?? 0);
  const persistenceError = atomicState?.message ?? (atomicState?.pendingCount
    ? `${atomicState.pendingCount} valintaa odottaa tallennusta. Valinnat säilyvät tällä laitteella.` : null);

  const value = useMemo<ItemInteractionState>(
    () => ({
      interactions: store.interactions,
      setRating,
      setNotInterested,
      canUndo,
      undoTargetItemId,
      undo,
      persistenceStatus,
      hasHydratedCurrentActor,
      hydrationError,
      persistenceError,
      atomicPendingCount: atomicState?.pendingCount ?? 0,
      canDiscardUndo: atomicState?.canDiscardUndo ?? false,
      discardRejectedUndo,
      canDiscardAction: atomicState?.canDiscardAction ?? false,
      discardRejectedAction,
      collectionRevision,
      submitCollectionAction,
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
      atomicState?.canDiscardAction,
      discardRejectedAction,
      collectionRevision,
      submitCollectionAction,
      persistenceStatus,
      retryHydration,
      retryPersistence,
      setNotInterested,
      setRating,
      store.interactions,
      canUndo,
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
