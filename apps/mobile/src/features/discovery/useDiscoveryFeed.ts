import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { AppState, Image } from 'react-native';
import { useSupabaseConnection } from '../../data/SupabaseProvider';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { useEventTracking } from '../events/EventTrackingContext';
import { useDiscoverySkip } from '../events/DiscoverySkipContext';
import { createContextualSkipRpc, loadDiscoverySkipSourceResult } from '../events/contextualSkipOperations';
import { createUuidV7 } from '../events/eventTracking';
import { useItemInteractions } from './ItemInteractionContext';
import { createDiscoveryFeed, receiveDiscoveryFeedAction, type DiscoveryFeed, type DiscoveryFeedSnapshot, type FeedDelivery } from './discoveryFeed';
import { createFeedPredictionPageRequest, loadCatalogPredictionPage } from './predictionPageOperations';
import { createDiscoveryReturnHandoff } from './discoveryReturnHandoff';
import { getBootstrapEvidenceRevision, subscribeToBootstrapEvidence } from './predictionRefresh';
import type { DiscoveryMode } from '../../domain/contracts';

export function useDiscoveryFeed(initial: FeedDelivery | null, mode: DiscoveryMode) {
  const focused = useIsFocused();
  const connection = useSupabaseConnection();
  const profiles = useActiveProfile();
  const tracking = useEventTracking();
  const actions = useItemInteractions();
  const skips = useDiscoverySkip();
  const services = useRef({ tracking, actions, skips });
  const returnHandoff = useRef<ReturnType<typeof createDiscoveryReturnHandoff> | null>(null);
  useLayoutEffect(() => { services.current = { tracking, actions, skips }; }, [tracking, actions, skips]);
  const [changed, setChanged] = useState<{ scope: object; flow: DiscoveryFeed; snapshot: DiscoveryFeedSnapshot } | null>(null);
  const client = connection.status === 'configured' ? connection.client : null;
  const environment = connection.status === 'configured' ? connection.config.url : '';
  const profileId = profiles.activeProfile?.id; const actorUserId = profiles.actorUserId; const sessionId = tracking.sessionId;
  const scope = useMemo(() => ({ initial, client, environment, profileId, actorUserId, sessionId, mode }),
    [initial, client, environment, profileId, actorUserId, sessionId, mode]);
  useLayoutEffect(() => {
    const { initial, client, environment, profileId, actorUserId, sessionId, mode } = scope;
    if (!initial || !client || !profileId || !actorUserId || !sessionId) return;
    const handoff = createDiscoveryReturnHandoff({ environment, actorUserId, profileId, sessionId, itemType: initial.item.itemType, mode,
      bootstrapRevision: getBootstrapEvidenceRevision() });
    returnHandoff.current = handoff;
    const unsubscribeBootstrap = subscribeToBootstrapEvidence(() => handoff.clear());
    const rpc = createContextualSkipRpc(client);
    const controller: DiscoveryFeed = createDiscoveryFeed({ initial, scope: { actorUserId, profileId, sessionId, mode },
      createId: createUuidV7, nowMicros: () => (BigInt(Date.now()) * 1000n).toString(),
      createRequest: (replacesChainId, limit = 5) => createFeedPredictionPageRequest({ replacesChainId, requestId: createUuidV7(), profileId, sessionId,
        mode, itemType: initial.item.itemType, limit, context: { occurredAt: new Date().toISOString(), attributes: { surface: 'DISCOVERY_FEED' } } }),
      createRestoreRequest: (replacesChainId, limit) => createFeedPredictionPageRequest({ replacesChainId, requestId: createUuidV7(), profileId, sessionId,
        mode, itemType: initial.item.itemType, limit, context: { occurredAt: new Date().toISOString(), attributes: { surface: 'DISCOVERY_FEED_RETURN' } } }),
      load: (request, signal) => loadCatalogPredictionPage(client, request, signal),
      loadSource: (request, signal) => loadDiscoverySkipSourceResult(rpc, request, signal),
      recordImpression: delivery => services.current.tracking.recordImpression({ eventType: 'ITEM_IMPRESSION', itemId: delivery.item.id,
        itemType: delivery.item.itemType, ...delivery.origin, originSessionId: sessionId, discoveryMode: mode,
        properties: { source: 'DISCOVERY_FEED', ...delivery.origin.properties } }),
      submit: command => services.current.skips.submit(command),
      reserveAction: (actionId, kind) => (kind === 'skip' ? services.current.skips.reserve?.(actionId) : services.current.actions.reserveFeedAction?.(actionId)) === true,
      releaseAction: (actionId, kind) => { if (kind === 'skip') services.current.skips.release?.(actionId); else services.current.actions.releaseFeedAction?.(actionId); },
      canCancelAction: (actionId, kind) => (kind === 'skip' ? services.current.skips.canCancelReserved?.(actionId) : services.current.actions.canCancelFeedAction?.(actionId)) === true,
      cancelAction: (actionId, kind) => (kind === 'skip' ? services.current.skips.cancelReserved?.(actionId) : services.current.actions.cancelFeedAction?.(actionId)) === true,
      undoPositive: (receipt, actionId) => services.current.actions.undo(
        { itemId: receipt.itemId, actionId: receipt.actionId }, actionId,
      )?.actionId === actionId,
      onChange: snapshot => {
        const service = services.current;
        if (snapshot.navigationPending || snapshot.restoringPresentation || snapshot.message || snapshot.refillError
          || service.actions.persistenceFailure || service.skips.message) handoff.clear();
        else handoff.publish(snapshot.upcoming);
        setChanged({ scope, flow: controller, snapshot });
      },
    });
    const flow = controller;
    const skip = services.current.skips.subscribe(receipt => {
      if (flow.hasPendingAction(receipt.actionId) || flow.snapshot().waitingActionId === receipt.actionId) flow.acknowledged(receipt.actionId);
      else flow.recoveredAction(receipt.itemId);
    });
    const action = services.current.actions.subscribeToCommittedActions(receipt => receiveDiscoveryFeedAction(flow, receipt));
    const exposure = services.current.tracking.subscribeToAcknowledgements(() => flow.exposureAcknowledged());
    const appState = AppState.addEventListener('change', state => { if (state !== 'active') flow.flushDeferred(); });
    flow.start();
    return () => { flow.stop(); handoff.release(); if (returnHandoff.current === handoff) returnHandoff.current = null; unsubscribeBootstrap(); skip(); action(); exposure(); appState.remove(); };
  }, [scope]);
  useLayoutEffect(() => {
    if (actions.persistenceFailure || skips.message) returnHandoff.current?.clear();
  }, [actions.persistenceFailure, skips.message]);
  const flow = changed?.scope === scope ? changed.flow : null;
  const state = changed?.scope === scope ? changed.snapshot : null;
  useLayoutEffect(() => { if (!focused) flow?.flushDeferred(); }, [focused, flow]);
  // Do not create impressions for a fetched card until it has actually entered
  // this mounted presentation. Earlier cards may still be saving in their own
  // durable queues; they must not suppress this card's actual exposure.
  useLayoutEffect(() => {
    if (focused && state?.delivery && !state.restoringPresentation && skips.ready) {
      flow?.displayed(state.delivery.item.id, state.delivery.origin.deliveryRequestId!);
      if (actions.persistenceStatus === 'ready') flow?.warm();
    }
  }, [focused, flow, state?.delivery, state?.restoringPresentation, skips.ready, actions.persistenceStatus]);
  const prefetchedImages = useRef(new Set<string>());
  useEffect(() => {
    const urls = new Set(state?.upcoming.flatMap(entry => entry.item.imageUrl ? [entry.item.imageUrl] : []) ?? []);
    for (const url of urls) {
      if (!prefetchedImages.current.has(url)) void Image.prefetch(url).catch(() => undefined);
    }
    // Keep only the five upcoming assets; cache warming never creates exposure.
    prefetchedImages.current = urls;
  }, [scope, state?.upcoming]);
  return { flow, state, skips };
}
