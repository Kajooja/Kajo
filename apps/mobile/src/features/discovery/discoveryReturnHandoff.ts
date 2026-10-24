import type { DiscoveryMode, ItemType } from '../../domain/contracts';
import type { FeedDelivery } from './discoveryFeed';

export interface DiscoveryReturnScope {
  readonly environment: string;
  readonly actorUserId: string;
  readonly profileId: string;
  readonly sessionId: string;
  readonly itemType: ItemType;
  readonly mode: DiscoveryMode;
  readonly bootstrapRevision: number;
}

export interface DiscoveryReturnHandoff {
  readonly id: string;
  readonly scopeKey: string;
  readonly expiresAt: number;
  readonly deliveries: readonly FeedDelivery[];
}

// A navigation handoff, not another recommendation cache. Only one mounted
// feed owns it, with the same five already-prepared deliveries/origins. Repeated
// publication cannot extend an old delivery's lifetime or revive a consumed slot.
const MAX_AGE_MS = 60_000;
let sequence = 0;
let current: { owner: object; value: DiscoveryReturnHandoff | null } | null = null;

export function discoveryReturnScopeKey(scope: DiscoveryReturnScope): string {
  return JSON.stringify([scope.environment, scope.actorUserId, scope.profileId,
    scope.sessionId, scope.itemType, scope.mode, scope.bootstrapRevision]);
}

export function createDiscoveryReturnHandoff(scope: DiscoveryReturnScope) {
  const owner = {};
  const scopeKey = discoveryReturnScopeKey(scope);
  const firstSeen = new Map<string, number>();
  let released = false;
  current = { owner, value: null };
  return {
    publish(deliveries: readonly FeedDelivery[]) {
      if (released || current?.owner !== owner) return;
      const now = Date.now();
      const seen = new Set<string>();
      const retainedKeys = new Set<string>();
      const valid = deliveries.slice(0, 5).flatMap(delivery => {
        const { item, origin } = delivery;
        if (item.itemType !== scope.itemType || seen.has(item.id) || !origin.predictionId ||
          !origin.deliveryRequestId || origin.properties.predictionSource !== 'hosted' ||
          origin.properties.deliveryTier !== 'RANKED' || !Number.isFinite(delivery.returnExpiresAt) ||
          delivery.returnExpiresAt! <= now) return [];
        seen.add(item.id);
        const key = `${item.id}:${origin.predictionId}:${origin.deliveryRequestId}`;
        retainedKeys.add(key);
        const createdAt = firstSeen.get(key) ?? now;
        firstSeen.set(key, createdAt);
        if (now - createdAt >= MAX_AGE_MS) return [];
        return [{ expiresAt: Math.min(createdAt + MAX_AGE_MS, delivery.returnExpiresAt!), delivery: Object.freeze({
          returnExpiresAt: delivery.returnExpiresAt!,
          item: Object.freeze({ ...item,
            ...(item.tags ? { tags: Object.freeze([...item.tags]) } : {}),
            ...(item.creators ? { creators: Object.freeze([...item.creators]) } : {}),
          }),
          origin: Object.freeze({ ...origin, properties: Object.freeze({ ...origin.properties }) }),
        }) }];
      });
      for (const key of firstSeen.keys()) if (!retainedKeys.has(key)) firstSeen.delete(key);
      current.value = valid.length ? Object.freeze({ id: `feed-return:${++sequence}`, scopeKey,
        expiresAt: Math.min(...valid.map(entry => entry.expiresAt)),
        deliveries: Object.freeze(valid.map(entry => entry.delivery)) }) : null;
    },
    clear() {
      if (current?.owner === owner) current.value = null;
      firstSeen.clear();
    },
    release() { released = true; },
  };
}

// Called only by the actually focused grid after commit. A scope mismatch also
// consumes the slot, so A -> B -> A cannot resurrect A's earlier prepared data.
export function takeDiscoveryReturnHandoff(scope: DiscoveryReturnScope): DiscoveryReturnHandoff | null {
  const value = current?.value ?? null;
  current = null;
  return value?.scopeKey === discoveryReturnScopeKey(scope) && value.expiresAt > Date.now() ? value : null;
}

// One consumer per mounted grid. Keeping this small navigation store outside
// React effects lets a committed focus transition atomically adopt/invalidate
// the handoff and reader generation before native callbacks become actionable.
export function createDiscoveryReturnConsumer() {
  let snapshot: { readonly epoch: number; readonly handoff: DiscoveryReturnHandoff | null } = Object.freeze({ epoch: 0, handoff: null });
  let focused = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  function publish(epoch: number, handoff: DiscoveryReturnHandoff | null) {
    if (snapshot.epoch === epoch && snapshot.handoff === handoff) return;
    clearTimeout(timer);
    snapshot = Object.freeze({ epoch, handoff });
    if (handoff) timer = setTimeout(() => publish(snapshot.epoch, null), Math.max(0, handoff.expiresAt - Date.now()));
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    synchronize(scope: DiscoveryReturnScope | null, active: boolean, pending: boolean, hasReadyPages: boolean, failed: boolean) {
      if (!active || !scope) { focused = false; publish(snapshot.epoch, null); return; }
      if (!focused) {
        // StrictMode replays effect cleanup/setup without a real route blur.
        // Its already-owned snapshot remains one-shot, while an actual blur
        // clears it above and can never use this continuation.
        const retained = snapshot.handoff?.scopeKey === discoveryReturnScopeKey(scope) &&
          snapshot.handoff.expiresAt > Date.now() ? snapshot.handoff : null;
        const handoff = takeDiscoveryReturnHandoff(scope) ?? retained;
        const needsFresh = pending || !hasReadyPages;
        publish(snapshot.epoch + (needsFresh && (pending || handoff) ? 1 : 0), needsFresh ? handoff : null);
      }
      focused = true;
      if (failed || snapshot.handoff && (snapshot.handoff.scopeKey !== discoveryReturnScopeKey(scope) ||
        snapshot.handoff.expiresAt <= Date.now())) publish(snapshot.epoch, null);
    },
    settle(readerEpoch: number, hasReadyPages: boolean, deferReplacement: boolean) {
      if (readerEpoch === snapshot.epoch && hasReadyPages && !deferReplacement) publish(snapshot.epoch, null);
    },
    stop() { focused = false; clearTimeout(timer); },
  };
}
