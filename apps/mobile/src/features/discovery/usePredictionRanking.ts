import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useIsFocused } from 'expo-router';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';
import type { DiscoveryMode, Item, ItemType, PredictionId } from '../../domain/contracts';
import { createCorrelationId, createUuidV7 } from '../events/eventTracking';
import { useEventTracking } from '../events/EventTrackingContext';
import { useItemInteractions } from './ItemInteractionContext';
import type { ItemInteractionMap } from './itemInteraction';
import { getStaticMockItems } from './mockDiscovery';
import { createPredictionPageRequest, loadCatalogPredictionPage, type PredictionAvailability, type PredictionContinuationState, type PredictionPageRecovery } from './predictionPageOperations';
import { createPredictionPageReader, predictionReaderScopeKey, type PredictionReaderScope, type PredictionReaderSnapshot } from './predictionPageReader';
import { watchFocusedPredictionReader } from './predictionConnectivity';
import { getBootstrapEvidenceRevision, subscribeToBootstrapEvidence, getInteractionEvidenceKey, getPredictionRefreshDelay,
  getContextualSkipRevision, subscribeToContextualSkip } from './predictionRefresh';

const INTERACTION_REFRESH_DELAY_MS = 600;
const GRID_PAGE_LIMIT = 6;
const EMPTY: PredictionReaderSnapshot = Object.freeze({ viewId: 'inactive', status: 'idle',
  pages: Object.freeze([]), items: Object.freeze([]), predictionIds: Object.freeze({}), message: null, recovery: null });
const subscribeInactive = () => () => {};
const inactiveSnapshot = () => EMPTY;

export interface VisiblePredictionRanking {
  items: readonly Item[];
  predictionId: PredictionId | null;
  predictionIds: Readonly<Record<string, PredictionId>>;
  deliveryRequestIds?: Readonly<Record<string, string>>;
  viewId: string;
  source: 'hosted' | 'fallback';
  status: 'loading' | 'ready' | 'error';
  message: string | null;
  availability: PredictionAvailability | null;
  continuationState: PredictionContinuationState | null;
  hasNextPage: boolean;
  loadingNextPage: boolean;
  nextPageError: string | null;
  recovery: PredictionPageRecovery | null;
  retrying: boolean;
  retry: () => void;
  refresh: () => void;
  loadMore: () => void;
}

export function usePredictionRanking(itemType: ItemType, mode: DiscoveryMode,
  interactions: ItemInteractionMap, enabled = true): VisiblePredictionRanking {
  const focused = useIsFocused();
  const connection = useSupabaseConnection();
  const activeProfile = useActiveProfile();
  const eventTracking = useEventTracking();
  const { collectionRevision } = useItemInteractions();
  const [fallbackSeed] = useState(() => createUuidV7());
  const bootstrapRevision = useSyncExternalStore(subscribeToBootstrapEvidence,
    getBootstrapEvidenceRevision, getBootstrapEvidenceRevision);
  const contextualSkipRevision = useSyncExternalStore(subscribeToContextualSkip,
    getContextualSkipRevision, getContextualSkipRevision);
  const evidenceKey = getInteractionEvidenceKey(interactions);
  const profileId = activeProfile.status === 'ready' ? activeProfile.activeProfile?.id ?? null : null;
  const actorUserId = activeProfile.status === 'ready' ? activeProfile.actorUserId : null;
  const sessionId = eventTracking.status === 'ready' && eventTracking.session?.profileId === profileId &&
    eventTracking.session.actorUserId === actorUserId ? eventTracking.sessionId : null;
  const client = connection.status === 'configured' ? connection.client : null;
  const environment = connection.status === 'configured' ? connection.config.url : null;
  const limit = GRID_PAGE_LIMIT;
  const revision = JSON.stringify([collectionRevision, bootstrapRevision, contextualSkipRevision, evidenceKey]);
  const scope = useMemo<PredictionReaderScope | null>(() => environment && actorUserId && profileId && sessionId
    ? { environment, actorUserId, profileId, sessionId, itemType, mode, limit, revision } : null,
  [environment, actorUserId, profileId, sessionId, itemType, mode, limit, revision]);
  const reader = useMemo(() => scope && client ? createPredictionPageReader({
    scope,
    createRequest: () => createPredictionPageRequest({ version: 3, requestId: createUuidV7(),
      profileId: scope.profileId, sessionId: scope.sessionId, mode: scope.mode,
      itemType: scope.itemType, limit: scope.limit, context: getRuntimeContext() }),
    createRequestId: createUuidV7,
    load: (request, signal) => loadCatalogPredictionPage(client, request, signal),
  }) : null, [scope, client]);
  const snapshot = useSyncExternalStore(reader?.subscribe ?? subscribeInactive,
    reader?.getSnapshot ?? inactiveSnapshot, reader?.getSnapshot ?? inactiveSnapshot);
  const lastActivation = useRef<{ identity: string; loaded: boolean } | null>(null);
  const activatedDuringCurrentFocus = useRef(false);
  const activation = useMemo(() => ({ reader, enabled: focused && enabled }), [reader, focused, enabled]);
  const currentActivation = useRef<typeof activation | null>(null);
  // Scope invalidation happens during commit, before an old native callback or
  // delayed enrichment can publish into another actor/Profile/session's view.
  useLayoutEffect(() => {
    currentActivation.current = activation;
    if (!activation.enabled) {
      activatedDuringCurrentFocus.current = false;
      reader?.deactivate();
    }
    return () => {
      if (currentActivation.current === activation) currentActivation.current = null;
      reader?.deactivate();
    };
  }, [activation, reader]);
  // Activate only after the focused/settled render commits. A synchronous
  // navigation focus listener could otherwise start work before layout has
  // invalidated the preceding hidden activation, then be cancelled by it.
  useEffect(() => {
    if (!reader || !activation.enabled || currentActivation.current !== activation) return;
    const identity = predictionReaderScopeKey({ ...reader.scope, revision: '' });
    const delay = getPredictionRefreshDelay(activatedDuringCurrentFocus.current &&
      lastActivation.current?.identity === identity && lastActivation.current.loaded, INTERACTION_REFRESH_DELAY_MS);
    activatedDuringCurrentFocus.current = true;
    const stopFocusedReader = watchFocusedPredictionReader(reader, {
      getState: Network.getNetworkStateAsync,
      subscribe: Network.addNetworkStateListener,
    }, AppState, delay);
    return () => {
      stopFocusedReader();
      lastActivation.current = { identity, loaded: reader.getSnapshot().pages.length > 0 ||
        (lastActivation.current?.identity === identity && lastActivation.current.loaded) };
      reader.deactivate();
    };
  }, [reader, activation]);

  // Native list callbacks may arrive after a page transition or scope change.
  // Only callbacks captured by this settled activation may drive its reader.
  const retry = useCallback(() => {
    if (activation.enabled && currentActivation.current === activation) reader?.retry();
  }, [activation, reader]);
  const refresh = useCallback(() => {
    if (activation.enabled && currentActivation.current === activation) reader?.refresh();
  }, [activation, reader]);
  const loadMore = useCallback(() => {
    if (activation.enabled && currentActivation.current === activation) reader?.loadMore();
  }, [activation, reader]);
  const fallback = useMemo(() => {
    const predictionId = createCorrelationId(fallbackSeed, `${itemType}:${mode}`);
    const items = getStaticMockItems(itemType, mode);
    return { predictionId, items, predictionIds: Object.fromEntries(items.map(item => [item.id, predictionId])) };
  }, [fallbackSeed, itemType, mode]);

  const deliveryRequestIds = useMemo(() => Object.fromEntries(snapshot.pages.flatMap(page =>
    page.ranking.items.map(item => [item.id, page.request.requestId]))), [snapshot.pages]);

  if (!client) return { ...fallback, viewId: fallback.predictionId, source: 'fallback', status: 'ready',
    message: null, availability: 'ITEMS', continuationState: null, hasNextPage: false, loadingNextPage: false, nextPageError: null,
    recovery: null, retrying: false, retry, refresh, loadMore };

  const first = snapshot.pages[0];
  const last = snapshot.pages.at(-1);
  return { items: snapshot.items, predictionIds: snapshot.predictionIds,
    deliveryRequestIds,
    predictionId: first?.ranking.predictionId ?? null, viewId: snapshot.viewId, source: 'hosted',
    status: first ? 'ready' : snapshot.message ? 'error' : 'loading',
    message: first ? null : snapshot.message, availability: last?.availability ?? null,
    continuationState: last?.continuationState ?? null,
    hasNextPage: Boolean(last?.nextCursor), loadingNextPage: Boolean(first && snapshot.status === 'loading'),
    nextPageError: first ? snapshot.message : null,
    recovery: snapshot.recovery, retrying: snapshot.status === 'loading' && snapshot.message !== null,
    retry, refresh, loadMore };
}

function getRuntimeContext() {
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  const now = new Date();
  return {
    ...(resolved.locale ? { locale: resolved.locale } : {}),
    ...(resolved.timeZone ? { timezone: resolved.timeZone } : {}),
    occurredAt: now.toISOString(),
    attributes: { localHour: now.getHours(), dayOfWeek: now.getDay(), surface: 'DISCOVERY_GRID' },
  };
}
