import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'react-native';
import { useSupabaseConnection } from '../../data/SupabaseProvider';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { useEventTracking } from '../events/EventTrackingContext';
import { useDiscoverySkip } from '../events/DiscoverySkipContext';
import { createContextualSkipRpc, loadDiscoverySkipSourceResult } from '../events/contextualSkipOperations';
import { createUuidV7 } from '../events/eventTracking';
import { useItemInteractions } from './ItemInteractionContext';
import { createDiscoveryFeed, receiveDiscoveryFeedAction, type DiscoveryFeed, type DiscoveryFeedSnapshot, type FeedDelivery } from './discoveryFeed';
import { createFeedPredictionPageRequest, loadCatalogPredictionPage } from './predictionPageOperations';
import type { DiscoveryMode } from '../../domain/contracts';

export function useDiscoveryFeed(initial: FeedDelivery | null, mode: DiscoveryMode) {
  const connection = useSupabaseConnection();
  const profiles = useActiveProfile();
  const tracking = useEventTracking();
  const actions = useItemInteractions();
  const skips = useDiscoverySkip();
  const services = useRef({ tracking, actions, skips });
  useLayoutEffect(() => { services.current = { tracking, actions, skips }; }, [tracking, actions, skips]);
  const [changed, setChanged] = useState<{ scope: object; flow: DiscoveryFeed; snapshot: DiscoveryFeedSnapshot } | null>(null);
  const client = connection.status === 'configured' ? connection.client : null;
  const profileId = profiles.activeProfile?.id; const actorUserId = profiles.actorUserId; const sessionId = tracking.sessionId;
  const scope = useMemo(() => ({ initial, client, profileId, actorUserId, sessionId, mode }),
    [initial, client, profileId, actorUserId, sessionId, mode]);
  useLayoutEffect(() => {
    const { initial, client, profileId, actorUserId, sessionId, mode } = scope;
    if (!initial || !client || !profileId || !actorUserId || !sessionId) return;
    const rpc = createContextualSkipRpc(client);
    const controller: DiscoveryFeed = createDiscoveryFeed({ initial, scope: { actorUserId, profileId, sessionId, mode },
      createId: createUuidV7, nowMicros: () => (BigInt(Date.now()) * 1000n).toString(),
      createRequest: (replacesChainId, limit = 5) => createFeedPredictionPageRequest({ replacesChainId, requestId: createUuidV7(), profileId, sessionId,
        mode, itemType: initial.item.itemType, limit, context: { occurredAt: new Date().toISOString(), attributes: { surface: 'DISCOVERY_FEED' } } }),
      createRestoreRequest: replacesChainId => createFeedPredictionPageRequest({ replacesChainId, requestId: createUuidV7(), profileId, sessionId,
        mode, itemType: initial.item.itemType, limit: 50, context: { occurredAt: new Date().toISOString(), attributes: { surface: 'DISCOVERY_FEED_RETURN' } } }),
      load: (request, signal) => loadCatalogPredictionPage(client, request, signal),
      loadSource: (request, signal) => loadDiscoverySkipSourceResult(rpc, request, signal),
      recordImpression: delivery => services.current.tracking.recordImpression({ eventType: 'ITEM_IMPRESSION', itemId: delivery.item.id,
        itemType: delivery.item.itemType, ...delivery.origin, originSessionId: sessionId, discoveryMode: mode,
        properties: { source: 'DISCOVERY_FEED', ...delivery.origin.properties } }),
      submit: command => services.current.skips.submit(command),
      undoPositive: (receipt, actionId) => services.current.actions.undo(
        { itemId: receipt.itemId, actionId: receipt.actionId }, actionId,
      )?.actionId === actionId,
      onChange: snapshot => setChanged({ scope, flow: controller, snapshot }),
    });
    const flow = controller;
    const skip = services.current.skips.subscribe(receipt => {
      if (flow.hasPendingAction(receipt.actionId) || flow.snapshot().waitingActionId === receipt.actionId) flow.acknowledged(receipt.actionId);
      else flow.recoveredAction(receipt.itemId);
    });
    const action = services.current.actions.subscribeToCommittedActions(receipt => receiveDiscoveryFeedAction(flow, receipt));
    const exposure = services.current.tracking.subscribeToAcknowledgements(() => flow.exposureAcknowledged());
    flow.start();
    return () => { flow.stop(); skip(); action(); exposure(); };
  }, [scope]);
  const flow = changed?.scope === scope ? changed.flow : null;
  const state = changed?.scope === scope ? changed.snapshot : null;
  // Do not create impressions for a fetched card until it has actually entered
  // this mounted presentation. Earlier cards may still be saving in their own
  // durable queues; they must not suppress this card's actual exposure.
  useLayoutEffect(() => {
    if (state?.delivery && skips.ready) {
      flow?.displayed(state.delivery.item.id, state.delivery.origin.deliveryRequestId!);
      if (actions.persistenceStatus === 'ready') flow?.warm();
    }
  }, [flow, state?.delivery, skips.ready, actions.persistenceStatus]);
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
