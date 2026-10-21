import type { Item, DiscoveryMode } from '../../domain/contracts';
import type { DeliveredItemOrigin } from './deliveredSlate';
import { createNextPredictionPageRequest, type PredictionPageRequest, type PredictionPageResult } from './predictionPageOperations';
import { CONTEXTUAL_SKIP_VERSION, type DiscoverySkipSource, type DiscoverySkipSourceRequest, type KajoSkipCommand } from '../events/contextualSkipOperations';

export interface FeedDelivery { item: Item; origin: DeliveredItemOrigin }
export interface DiscoveryFeedSnapshot {
  delivery: FeedDelivery | null; source: DiscoverySkipSource | null;
  loading: boolean; message: string | null; exhausted: boolean;
  waitingActionId: string | null; recovery: 'retry' | 'refresh';
}

// A shown delivery is immutable. Only a confirmed action retires its unshown
// siblings. Retry retains the exact page request; refresh starts a new committed
// prefix. No local shuffle, guessed impression or inherited root-page origin.
export function createDiscoveryFeed(options: {
  initial: FeedDelivery; scope: { actorUserId: string; profileId: string; sessionId: string; mode: DiscoveryMode };
  createId: () => string; nowMicros: () => string;
  createRequest: () => PredictionPageRequest;
  load: (request: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>;
  recordImpression: (delivery: FeedDelivery) => string | null;
  loadSource: (request: DiscoverySkipSourceRequest, signal: AbortSignal) => Promise<DiscoverySkipSource | null>;
  submit: (command: KajoSkipCommand) => boolean;
  onChange: (snapshot: DiscoveryFeedSnapshot) => void;
}) {
  let active = false; let generation = 0; let abort: AbortController | null = null;
  let state: DiscoveryFeedSnapshot = { delivery: options.initial, source: null, loading: false,
    message: null, exhausted: false, waitingActionId: null, recovery: 'retry' };
  let held = false;
  let pending: PredictionPageRequest | null = null;
  let sourceRequest: DiscoverySkipSourceRequest | null = null;
  let readingSource = false; let sourceAgain = false;
  const snapshot = () => ({ ...state });
  const publish = () => { if (active) options.onChange(snapshot()); };
  const current = (token: number) => active && token === generation;
  async function bounded<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController(); abort = controller;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work(controller.signal), new Promise<never>((_, reject) => {
      deadline = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, 15_000);
    })]); } finally { if (deadline) clearTimeout(deadline); if (abort === controller) abort = null; }
  }
  async function readSource() {
    if (!active || !sourceRequest || state.source || state.waitingActionId) return;
    if (readingSource) { sourceAgain = true; return; }
    readingSource = true;
    const token = generation; const request = sourceRequest;
    try {
      const source = await bounded(signal => options.loadSource(request, signal));
      if (!current(token) || sourceRequest !== request) return;
      state = { ...state, source, message: source?.acceptsNewSkip ? null
        : 'Ohitus ei ole juuri nyt käytettävissä. Tarkista yhteys ja yritä uudelleen.' }; publish();
    } catch { if (current(token)) { state = { ...state, message: 'Kortin vahvistus viipyy. Yritä uudelleen.' }; publish(); } }
    finally {
      if (current(token)) {
        readingSource = false;
        if (sourceAgain) { sourceAgain = false; void readSource(); }
      }
    }
  }
  function present(delivery: FeedDelivery) {
    const { predictionId, deliveryRequestId } = delivery.origin;
    const impressionEventId = options.recordImpression(delivery);
    sourceRequest = predictionId && deliveryRequestId && impressionEventId ? {
      actorUserId: options.scope.actorUserId, profileId: options.scope.profileId, itemId: delivery.item.id,
      origin: { surface: 'DISCOVERY', sessionId: options.scope.sessionId, predictionId, deliveryRequestId, impressionEventId },
    } : null;
    if (!sourceRequest) {
      state = { ...state, message: 'Kortin näyttöä ei voitu vahvistaa. Yritä uudelleen.' }; publish();
    } else void readSource();
  }
  async function loadNext() {
    if (!active || state.loading || state.waitingActionId) return;
    const token = generation;
    pending ??= options.createRequest();
    state = { ...state, loading: true, message: null }; publish();
    try {
      const request = pending;
      const result = await bounded(signal => options.load(request, signal));
      if (!current(token)) return;
      if (result.status === 'error') { state = { ...state, loading: false, message: result.message, recovery: result.recovery }; publish(); return; }
      if (result.request !== request || result.request.profileId !== options.scope.profileId ||
        result.request.sessionId !== options.scope.sessionId) throw new Error('Wrong page origin');
      const item = result.ranking.items[0];
      if (!item && result.nextCursor) {
        pending = createNextPredictionPageRequest(result, options.createId());
        state = { ...state, loading: false }; await loadNext(); return;
      }
      pending = null;
      const delivery = item ? { item, origin: { predictionId: result.ranking.predictionId,
        deliveryRequestId: request.requestId, properties: { predictionSource: 'hosted' as const, deliveryTier: 'RANKED' as const } } } : null;
      state = { ...state, delivery, source: null, loading: false, exhausted: !delivery, message: null }; publish();

    } catch { if (current(token)) { state = { ...state, loading: false, message: 'Seuraavaa korttia ei saatu. Yritä uudelleen.', recovery: 'retry' }; publish(); } }
  }
  function refresh() {
    if (!active || state.waitingActionId) return;
    held = false; generation++; abort?.abort(); sourceRequest = null; readingSource = false; sourceAgain = false; pending = null;
    state = { delivery: null, source: null, loading: false, exhausted: false, message: null, waitingActionId: null, recovery: 'retry' };
    publish(); void loadNext();
  }
  return {
    snapshot,
    start() { active = true; publish(); },
    displayed(itemId: string, requestId: string) {
      if (active && !sourceRequest && state.delivery?.item.id === itemId && state.delivery.origin.deliveryRequestId === requestId)
        present(state.delivery);
    },
    stop() { active = false; generation++; abort?.abort(); },
    exposureAcknowledged() { if (!state.source) void readSource(); },
    retry() {
      if (state.waitingActionId) return;
      if (state.delivery) { if (sourceRequest) void readSource(); else present(state.delivery); }
      else if (state.recovery === 'refresh') refresh(); else void loadNext();
    },
    hold(value: boolean) { held = value; },
    skip() {
      const source = state.source;
      if (!active || held || state.loading || state.waitingActionId || !source?.acceptsNewSkip) return false;
      const actionId = options.createId();
      state = { ...state, waitingActionId: actionId }; publish();
      const accepted = options.submit({ version: CONTEXTUAL_SKIP_VERSION, kind: 'CONTEXTUAL_SKIP', actionId,
        actorUserId: source.actorUserId, profileId: source.profileId, itemId: source.itemId,
        origin: { ...source.origin }, contextRef: null, reversesActionId: null, occurredAt: options.nowMicros() });
      if (!accepted) { state = { ...state, waitingActionId: null }; publish(); }
      return accepted;
    },
    expectPositive(actionId: string) { if (active) { state = { ...state, waitingActionId: actionId }; publish(); } },
    cancelPositive(actionId: string) { if (state.waitingActionId === actionId) { state = { ...state, waitingActionId: null }; publish(); } },
    acknowledged(actionId: string) {
      if (!active || state.waitingActionId !== actionId) return;
      state = { ...state, waitingActionId: null }; refresh();
    },
    // List/Shared actions already return only an acknowledged receipt.
    positiveCommitted() { if (active && !state.waitingActionId) refresh(); },
    recoverRejected() { state = { ...state, waitingActionId: null }; refresh(); },
  };
}
export type DiscoveryFeed = ReturnType<typeof createDiscoveryFeed>;
