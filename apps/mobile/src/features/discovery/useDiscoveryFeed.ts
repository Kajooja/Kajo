import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseConnection } from '../../data/SupabaseProvider';
import { useActiveProfile } from '../profiles/ActiveProfileContext';
import { useEventTracking } from '../events/EventTrackingContext';
import { useDiscoverySkip } from '../events/DiscoverySkipContext';
import { createContextualSkipRpc, loadDiscoverySkipSource } from '../events/contextualSkipOperations';
import { createUuidV7 } from '../events/eventTracking';
import { useItemInteractions } from './ItemInteractionContext';
import { createDiscoveryFeed, type DiscoveryFeed, type DiscoveryFeedSnapshot, type FeedDelivery } from './discoveryFeed';
import { createPredictionPageRequest, loadCatalogPredictionPage } from './predictionPageOperations';
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
      createRequest: () => createPredictionPageRequest({ version: 3, requestId: createUuidV7(), profileId, sessionId,
        mode, itemType: initial.item.itemType, limit: 1, context: { occurredAt: new Date().toISOString(), attributes: { surface: 'DISCOVERY_FEED' } } }),
      load: (request, signal) => loadCatalogPredictionPage(client, request, signal),
      loadSource: (request, signal) => loadDiscoverySkipSource(rpc, request, signal),
      recordImpression: delivery => services.current.tracking.recordImpression({ eventType: 'ITEM_IMPRESSION', itemId: delivery.item.id,
        itemType: delivery.item.itemType, ...delivery.origin, originSessionId: sessionId, discoveryMode: mode,
        properties: { source: 'DISCOVERY_FEED', ...delivery.origin.properties } }),
      submit: command => services.current.skips.submit(command),
      onChange: snapshot => setChanged({ scope, flow: controller, snapshot }),
    });
    const flow = controller;
    const skip = services.current.skips.subscribe(receipt => {
      if (flow.snapshot().waitingActionId) flow.acknowledged(receipt.actionId);
      else flow.positiveCommitted();
    });
    const action = services.current.actions.subscribeToCommittedActions(receipt => {
      if (flow.snapshot().waitingActionId) flow.acknowledged(receipt.actionId);
      else flow.positiveCommitted();
    });
    const exposure = services.current.tracking.subscribeToAcknowledgements(() => flow.exposureAcknowledged());
    flow.start();
    return () => { flow.stop(); skip(); action(); exposure(); };
  }, [scope]);
  const flow = changed?.scope === scope ? changed.flow : null;
  const state = changed?.scope === scope ? changed.snapshot : null;
  // Do not create impressions for a fetched card until it has actually entered
  // this mounted presentation. Pending recovery must finish before interaction.
  useLayoutEffect(() => {
    if (state?.delivery && skips.ready && skips.pendingCount === 0) {
      flow?.displayed(state.delivery.item.id, state.delivery.origin.deliveryRequestId!);
    }
  }, [flow, state?.delivery, skips.ready, skips.pendingCount]);
  const rejected = useRef(false);
  useLayoutEffect(() => {
    if (actions.canDiscardAction) rejected.current = true;
    else if (rejected.current && actions.atomicPendingCount === 0 && actions.persistenceStatus === 'ready') {
      rejected.current = false; flow?.recoverRejected();
    }
  }, [flow, actions.canDiscardAction, actions.atomicPendingCount, actions.persistenceStatus]);
  return { flow, state, skips };
}
