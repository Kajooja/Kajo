import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSupabaseConnection } from '@/data/SupabaseProvider';
import { usePersonalProfile } from '@/features/profiles/PersonalProfileProvider';

import type {
  DiscoveryMode,
  Item,
  ItemType,
  PredictionId,
} from '../../domain/contracts';
import { createCorrelationId, createUuidV7 } from '../events/eventTracking';
import type { ItemInteractionMap } from './itemInteraction';
import { getRankedMockItems } from './mockDiscovery';
import {
  loadPredictionRanking,
  type PredictionRanking,
  type PredictionRpc,
} from './predictionOperations';
import {
  createLatestRequestGate,
  getInteractionEvidenceKey,
} from './predictionRefresh';

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
  const personalProfile = usePersonalProfile();
  const [fallbackSeed] = useState(() => createUuidV7());
  const [attempt, setAttempt] = useState(0);
  const [hostedState, setHostedState] = useState<HostedRankingState>({
    status: 'idle',
  });
  const requestGate = useRef(createLatestRequestGate());
  const evidenceKey = getInteractionEvidenceKey(interactions);
  const profileId =
    personalProfile.status === 'ready'
      ? personalProfile.identity.profile.id
      : null;
  const requestKey = profileId ? `${profileId}:${itemType}:${mode}` : null;
  const fallback = useMemo<PredictionRanking>(
    () => ({
      predictionId: createCorrelationId(fallbackSeed, `${itemType}:${mode}`),
      items: getRankedMockItems(itemType, mode),
      predictions: [],
    }),
    [fallbackSeed, itemType, mode],
  );
  const rpc = useMemo<PredictionRpc | null>(
    () =>
      connection.status === 'configured'
        ? async (functionName, arguments_) => {
            const { data, error } = await connection.client.rpc(
              functionName,
              arguments_,
            );
            return {
              data,
              error: error ? { message: error.message } : null,
            };
          }
        : null,
    [connection],
  );

  useEffect(() => {
    if (!rpc || !profileId || !requestKey) {
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
        limit: 20,
        context: getRuntimeContext(),
      }).then((result) => {
        if (!active || !requestGate.current.isLatest(token)) return;

        if (result.status === 'success') {
          setHostedState({ status: 'ready', key: requestKey, ranking: result.ranking });
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
  }, [attempt, evidenceKey, itemType, mode, profileId, requestKey, rpc]);

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

function getRuntimeContext() {
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  return {
    ...(resolved.locale ? { locale: resolved.locale } : {}),
    ...(resolved.timeZone ? { timezone: resolved.timeZone } : {}),
  };
}
