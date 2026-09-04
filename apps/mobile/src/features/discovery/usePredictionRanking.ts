import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { useActiveProfile } from '@/features/profiles/ActiveProfileContext';

import type {
  DiscoveryMode,
  Item,
  ItemType,
  PredictionId,
} from '../../domain/contracts';
import { createCorrelationId, createUuidV7 } from '../events/eventTracking';
import { useEventTracking } from '../events/EventTrackingContext';
import {
  enrichItemsFromCatalog,
  loadCatalogItems,
} from './catalogItemOperations';
import type { ItemInteractionMap } from './itemInteraction';
import { getStaticMockItems } from './mockDiscovery';
import {
  loadPredictionRanking,
  type PredictionRanking,
  type PredictionRpc,
} from './predictionOperations';
import {
  createLatestRequestGate,
  getInteractionEvidenceKey,
} from './predictionRefresh';
import { rememberPredictionItems } from './predictionRankingCache';

const INTERACTION_REFRESH_DELAY_MS = 600;

type HostedRankingState =
  | { status: 'idle' }
  | { status: 'loading'; key: string; previous: PredictionRanking | null }
  | { status: 'ready'; key: string; ranking: PredictionRanking }
  | {
      status: 'error';
      key: string;
      previous: PredictionRanking | null;
      message: string;
    };

export interface VisiblePredictionRanking {
  items: readonly Item[];
  predictionId: PredictionId;
  source: 'hosted' | 'fallback';
  status: 'loading' | 'ready' | 'error';
  message: string | null;
  retry: () => void;
}

export function usePredictionRanking(
  itemType: ItemType,
  mode: DiscoveryMode,
  interactions: ItemInteractionMap,
): VisiblePredictionRanking {
  const connection = useSupabaseConnection();
  const activeProfile = useActiveProfile();
  const eventTracking = useEventTracking();
  const [fallbackSeed] = useState(() => createUuidV7());
  const [attempt, setAttempt] = useState(0);
  const [hostedState, setHostedState] = useState<HostedRankingState>({
    status: 'idle',
  });
  const requestGate = useRef(createLatestRequestGate());
  const evidenceKey = getInteractionEvidenceKey(interactions);
  const profileId =
    activeProfile.status === 'ready'
      ? activeProfile.activeProfile?.id ?? null
      : null;
  const requestKey = profileId ? `${profileId}:${itemType}:${mode}` : null;
  const fallback = useMemo<PredictionRanking>(
    () => ({
      predictionId: createCorrelationId(fallbackSeed, `${itemType}:${mode}`),
      items: getStaticMockItems(itemType, mode),
      predictions: [],
    }),
    [fallbackSeed, itemType, mode],
  );
  const client = connection.status === 'configured' ? connection.client : null;
  const rpc = useMemo<PredictionRpc | null>(
    () =>
      client
        ? async (functionName, arguments_) => {
            const { data, error } = await client.rpc(functionName, arguments_);
            return {
              data,
              error: error ? { message: error.message } : null,
            };
          }
        : null,
    [client],
  );

  useEffect(() => {
    if (!rpc || !client || !profileId || !requestKey) {
      return;
    }

    const token = requestGate.current.start();
    let active = true;

    const timeout = setTimeout(() => {
      setHostedState((current) => ({
        status: 'loading',
        key: requestKey,
        previous: getMatchingRanking(current, requestKey),
      }));

      void loadPredictionRanking(rpc, {
        profileId,
        mode,
        itemType,
        limit: activeProfile.activeProfile?.type === 'SHARED' ? 50 : 20,
        context: getRuntimeContext(eventTracking.sessionId),
      }).then(async (result) => {
        if (!active || !requestGate.current.isLatest(token)) return;

        if (result.status === 'success') {
          const catalog = await loadCatalogItems(
            client,
            result.ranking.items.map((item) => item.id),
          );
          if (!active || !requestGate.current.isLatest(token)) return;

          const ranking =
            catalog.status === 'success'
              ? {
                  ...result.ranking,
                  items: enrichItemsFromCatalog(
                    result.ranking.items,
                    catalog.items,
                  ),
                }
              : result.ranking;

          rememberPredictionItems(ranking.predictionId, ranking.items);
          setHostedState({ status: 'ready', key: requestKey, ranking });
          return;
        }

        setHostedState((current) => ({
          status: 'error',
          key: requestKey,
          previous: getMatchingRanking(current, requestKey),
          message: result.message,
        }));
      });
    }, INTERACTION_REFRESH_DELAY_MS);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [
    activeProfile.activeProfile?.type,
    attempt,
    client,
    evidenceKey,
    eventTracking.sessionId,
    itemType,
    mode,
    profileId,
    requestKey,
    rpc,
  ]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const matchingRanking = requestKey
    ? getMatchingRanking(hostedState, requestKey)
    : null;

  if (matchingRanking) {
    return {
      items: matchingRanking.items,
      predictionId: matchingRanking.predictionId,
      source: 'hosted',
      status:
        hostedState.status === 'error'
          ? 'error'
          : hostedState.status === 'ready'
            ? 'ready'
            : 'loading',
      message: hostedState.status === 'error' ? hostedState.message : null,
      retry,
    };
  }

  return {
    items: fallback.items,
    predictionId: fallback.predictionId,
    source: 'fallback',
    status:
      rpc && profileId
        ? hostedState.status === 'error'
          ? 'error'
          : 'loading'
        : 'ready',
    message: hostedState.status === 'error' ? hostedState.message : null,
    retry,
  };
}

function getMatchingRanking(
  state: HostedRankingState,
  key: string,
): PredictionRanking | null {
  if (state.status === 'idle' || state.key !== key) return null;
  return state.status === 'ready' ? state.ranking : state.previous;
}

function getRuntimeContext(sessionId: string | null) {
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  const now = new Date();

  return {
    ...(sessionId ? { sessionId } : {}),
    ...(resolved.locale ? { locale: resolved.locale } : {}),
    ...(resolved.timeZone ? { timezone: resolved.timeZone } : {}),
    occurredAt: now.toISOString(),
    attributes: {
      localHour: now.getHours(),
      dayOfWeek: now.getDay(),
      surface: 'DISCOVERY_GRID',
    },
  };
}
