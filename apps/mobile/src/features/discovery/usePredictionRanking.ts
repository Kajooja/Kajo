import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';
import type { DiscoveryMode, Item, ItemType, PredictionId } from '../../domain/contracts';
import { createCorrelationId, createUuidV7 } from '../events/eventTracking';
import { useEventTracking } from '../events/EventTrackingContext';
import { enrichItemsFromCatalog, loadCatalogItems } from './catalogItemOperations';
import { useItemInteractions } from './ItemInteractionContext';
import type { ItemInteractionMap } from './itemInteraction';
import { getStaticMockItems } from './mockDiscovery';
import { createPredictionPageRequest, loadPredictionPage, type PredictionAvailability, type PredictionPageRpc } from './predictionPageOperations';
import { createPredictionPageReader, predictionReaderScopeKey, type PredictionReaderScope, type PredictionReaderSnapshot } from './predictionPageReader';
import { getBootstrapEvidenceRevision, subscribeToBootstrapEvidence, getInteractionEvidenceKey, getPredictionRefreshDelay } from './predictionRefresh';

const INTERACTION_REFRESH_DELAY_MS = 600;
const EMPTY: PredictionReaderSnapshot = Object.freeze({ viewId: 'inactive', status: 'idle',
  pages: Object.freeze([]), items: Object.freeze([]), predictionIds: Object.freeze({}), message: null });
const subscribeInactive = () => () => {};
const inactiveSnapshot = () => EMPTY;

export interface VisiblePredictionRanking {
  items: readonly Item[];
  predictionId: PredictionId | null;
  predictionIds: Readonly<Record<string, PredictionId>>;
  viewId: string;
  source: 'hosted' | 'fallback';
  status: 'loading' | 'ready' | 'error';
  message: string | null;
  availability: PredictionAvailability | null;
  hasNextPage: boolean;
  loadingNextPage: boolean;
  nextPageError: string | null;
  retry: () => void;
  refresh: () => void;
  loadMore: () => void;
}

export function usePredictionRanking(itemType: ItemType, mode: DiscoveryMode,
  interactions: ItemInteractionMap): VisiblePredictionRanking {
  const connection = useSupabaseConnection();
  const activeProfile = useActiveProfile();
  const eventTracking = useEventTracking();
  const { collectionRevision } = useItemInteractions();
  const [fallbackSeed] = useState(() => createUuidV7());
  const bootstrapRevision = useSyncExternalStore(subscribeToBootstrapEvidence,
    getBootstrapEvidenceRevision, getBootstrapEvidenceRevision);
  const evidenceKey = getInteractionEvidenceKey(interactions);
  const profileId = activeProfile.status === 'ready' ? activeProfile.activeProfile?.id ?? null : null;
  const actorUserId = activeProfile.status === 'ready' ? activeProfile.actorUserId : null;
  const sessionId = eventTracking.status === 'ready' && eventTracking.session?.profileId === profileId &&
    eventTracking.session.actorUserId === actorUserId ? eventTracking.sessionId : null;
  const client = connection.status === 'configured' ? connection.client : null;
  const environment = connection.status === 'configured' ? connection.config.url : null;
  const limit = activeProfile.activeProfile?.type === 'SHARED' ? 50 : 20;
  const revision = JSON.stringify([collectionRevision, bootstrapRevision, evidenceKey]);
  const scope = useMemo<PredictionReaderScope | null>(() => environment && actorUserId && profileId && sessionId
    ? { environment, actorUserId, profileId, sessionId, itemType, mode, limit, revision } : null,
  [environment, actorUserId, profileId, sessionId, itemType, mode, limit, revision]);
  const rpc = useMemo<PredictionPageRpc | null>(() => client ? async (name, arguments_) => {
    const { data, error } = await client.rpc(name, arguments_);
    return { data, error: error ? { message: error.message } : null };
  } : null, [client]);
  const reader = useMemo(() => scope && rpc && client ? createPredictionPageReader({
    scope,
    createRequest: () => createPredictionPageRequest({ requestId: createUuidV7(),
      profileId: scope.profileId, sessionId: scope.sessionId, mode: scope.mode,
      itemType: scope.itemType, limit: scope.limit, context: getRuntimeContext() }),
    createRequestId: createUuidV7,
    load: async request => {
      const result = await loadPredictionPage(rpc, request);
      if (result.status !== 'success' || result.ranking.items.length === 0) return result;
      const catalog = await loadCatalogItems(client, result.ranking.items.map(item => item.id));
      return catalog.status === 'success' ? { ...result, ranking: { ...result.ranking,
        items: enrichItemsFromCatalog(result.ranking.items, catalog.items) } } : result;
    },
  }) : null, [scope, rpc, client]);
  const snapshot = useSyncExternalStore(reader?.subscribe ?? subscribeInactive,
    reader?.getSnapshot ?? inactiveSnapshot, reader?.getSnapshot ?? inactiveSnapshot);
  const lastActivation = useRef<{ identity: string; loaded: boolean } | null>(null);
  // Scope invalidation happens during commit, before an old focus callback or
  // delayed enrichment can publish into another actor/Profile/session's view.
  useLayoutEffect(() => () => { reader?.deactivate(); }, [reader]);
  useFocusEffect(useCallback(() => {
    if (!reader) return;
    const identity = predictionReaderScopeKey({ ...reader.scope, revision: '' });
    reader.activate(getPredictionRefreshDelay(
      lastActivation.current?.identity === identity && lastActivation.current.loaded, INTERACTION_REFRESH_DELAY_MS));
    return () => {
      lastActivation.current = { identity, loaded: reader.getSnapshot().pages.length > 0 };
      reader.deactivate();
    };
  }, [reader]));

  const retry = useCallback(() => { reader?.retry(); }, [reader]);
  const refresh = useCallback(() => { reader?.refresh(); }, [reader]);
  const loadMore = useCallback(() => { reader?.loadMore(); }, [reader]);
  const fallback = useMemo(() => {
    const predictionId = createCorrelationId(fallbackSeed, `${itemType}:${mode}`);
    const items = getStaticMockItems(itemType, mode);
    return { predictionId, items, predictionIds: Object.fromEntries(items.map(item => [item.id, predictionId])) };
  }, [fallbackSeed, itemType, mode]);

  if (!client) return { ...fallback, viewId: fallback.predictionId, source: 'fallback', status: 'ready',
    message: null, availability: 'ITEMS', hasNextPage: false, loadingNextPage: false, nextPageError: null,
    retry, refresh, loadMore };

  const first = snapshot.pages[0];
  const last = snapshot.pages.at(-1);
  return { items: snapshot.items, predictionIds: snapshot.predictionIds,
    predictionId: first?.ranking.predictionId ?? null, viewId: snapshot.viewId, source: 'hosted',
    status: first ? 'ready' : snapshot.status === 'error' ? 'error' : 'loading',
    message: first ? null : snapshot.message, availability: last?.availability ?? null,
    hasNextPage: Boolean(last?.nextCursor), loadingNextPage: Boolean(first && snapshot.status === 'loading'),
    nextPageError: first && snapshot.status === 'error' ? snapshot.message : null, retry, refresh, loadMore };
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
