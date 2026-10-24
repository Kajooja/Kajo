import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiscoveryFeed, type DiscoveryFeed, type FeedDelivery } from './discoveryFeed';
import { createFeedPredictionPageRequest, type PredictionPageRequest } from './predictionPageOperations';
import { createItemActionOutbox, type ItemActionOutbox, type PendingQueuedAction } from '../events/itemActionOutbox';
import { CONTEXTUAL_SKIP_POLICY, CONTEXTUAL_SKIP_VERSION, type DiscoverySkipSource, type DiscoverySkipSourceRequest } from '../events/contextualSkipOperations';
import type { ItemActionResult } from '../events/itemActionPersistence';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const scope = { actorUserId: id(1), profileId: id(2), sessionId: id(3), mode: 'FOR_YOU' as const };
const item = (value: number) => ({ id: id(value), itemType: 'MOVIE' as const, title: `Item ${value}` });
const flush = async () => { for (let count = 0; count < 30; count++) await Promise.resolve(); };
const cleanups: (() => void)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) cleanup(); await flush(); vi.useRealTimers(); });

function fixture() {
  let sequence = 1000; let candidate = 10;
  const createId = () => id(sequence++);
  const rows = new Map<string, string>();
  let failWrite = false;
  const storage = { getItemSync: (key: string) => rows.get(key) ?? null,
    setItemSync: (key: string, value: string) => { if (failWrite) throw new Error('Disk unavailable'); rows.set(key, value); } };
  const sent: { kind: 'skip' | 'positive'; actionId: string; resolve: (value: ItemActionResult<string>) => void }[] = [];
  let flow: DiscoveryFeed;
  const queues = {} as Record<'skip' | 'positive', ItemActionOutbox<PendingQueuedAction>>;
  for (const kind of ['skip', 'positive'] as const) {
    queues[kind] = createItemActionOutbox<PendingQueuedAction, string>({ namespace: kind, scope, storage,
      isPendingAction: (value: unknown): value is PendingQueuedAction => Boolean(value && typeof value === 'object' && 'command' in value),
      send: command => new Promise(resolve => sent.push({ kind, actionId: command.actionId, resolve })),
      onChange: () => {}, onCommitted: actionId => flow.acknowledged(actionId) });
    queues[kind].start();
  }
  const initial: FeedDelivery = { item: item(4), returnExpiresAt: Date.now() + 14 * 60_000,
    origin: { predictionId: id(5), deliveryRequestId: id(6), properties: { predictionSource: 'hosted', deliveryTier: 'RANKED' } } };
  const load = vi.fn(async (request: PredictionPageRequest) => {
    const predictionId = createId();
    return { status: 'success' as const, request, ranking: { predictionId, items: Array.from({ length: 5 }, () => item(candidate++)), predictions: [] },
      availability: 'ITEMS' as const, continuationSupported: true, nextCursor: null, candidateCount: 5,
      sourcePredictionId: predictionId, pageIndex: 1, featureAt: new Date().toISOString(), chainId: createId(),
      rootPredictionId: predictionId, parentPredictionId: null, seenCount: 5, chainLimit: 5, continuationState: 'READER_LIMIT' as const };
  });
  const loadSource = vi.fn(async (request: DiscoverySkipSourceRequest): Promise<DiscoverySkipSource | null> => ({
    ...request, version: CONTEXTUAL_SKIP_VERSION, policyVersion: CONTEXTUAL_SKIP_POLICY,
    contextChangePolicy: 'NO_TRUSTED_CONTEXT_CHANGE_V1', contextRef: null, acceptsNewSkip: true }));
  flow = createDiscoveryFeed({ initial, scope, createId, nowMicros: () => (BigInt(Date.now()) * 1000n).toString(),
    createRequest: (replacesChainId, limit = 5) => createFeedPredictionPageRequest({ ...scope, requestId: createId(), itemType: 'MOVIE', limit,
      replacesChainId, context: { occurredAt: new Date().toISOString(), attributes: { surface: 'DISCOVERY_FEED' } } }),
    createRestoreRequest: (replacesChainId, limit) => createFeedPredictionPageRequest({ ...scope, requestId: createId(), itemType: 'MOVIE', limit,
      replacesChainId, context: { occurredAt: new Date().toISOString(), attributes: { surface: 'DISCOVERY_FEED_RETURN' } } }),
    load, loadSource, recordImpression: () => createId(), submit: command => queues.skip.enqueue({ command }),
    reserveAction: (actionId, kind) => queues[kind].reserve(actionId),
    releaseAction: (actionId, kind) => queues[kind].release(actionId),
    canCancelAction: (actionId, kind) => queues[kind].canCancelReserved(actionId),
    cancelAction: (actionId, kind) => queues[kind].cancelReserved(actionId), onChange: () => {} });
  function display() { const delivery = flow.snapshot().delivery!; flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!); }
  async function start() { flow.start(); display(); flow.warm(); await flush(); }
  function rate() {
    const actionId = createId(); flow.expectPositive(actionId);
    expect(queues.positive.enqueue({ command: { ...scope, actionId, kind: 'SET_RATING' } })).toBe(true);
    expect(flow.positiveQueued(actionId)).toBe(true); return actionId;
  }
  cleanups.push(() => { flow.stop(); queues.skip.stop(); queues.positive.stop();
    for (const request of sent) request.resolve({ status: 'success', receipt: request.actionId }); });
  return { flow, queues, sent, rows, load, loadSource, initial, display, start, rate,
    failWrites: () => { failWrite = true; } };
}

describe('one-choice durable feed dispatch buffer', () => {
  it('holds A until B is chosen, then cancels B immediately while A is still in flight and preserves C plus prepared successors', async () => {
    const f = fixture(); await f.start();
    expect(f.flow.skip()).toBe(true); f.display(); await flush();
    const b = f.flow.snapshot().delivery!;
    expect(f.sent).toHaveLength(0); expect(f.queues.skip.pending()).toHaveLength(1);
    expect(f.flow.skip()).toBe(true); f.display(); await flush();
    const c = f.flow.snapshot().delivery!; const before = f.flow.snapshot().upcoming;
    expect(f.sent).toHaveLength(1); expect(f.queues.skip.pending()).toHaveLength(2);
    const readCount = f.load.mock.calls.length;
    expect(f.flow.snapshot().canPrevious).toBe(true);
    expect(f.flow.previous()).toBe(true);
    expect(f.flow.snapshot()).toMatchObject({ delivery: b, restoringPresentation: null, navigationPending: false, canPrevious: false });
    expect(f.flow.snapshot().upcoming).toEqual([c, ...before].slice(0, 5));
    expect(f.load).toHaveBeenCalledTimes(readCount); expect(f.sent).toHaveLength(1);
    expect(f.queues.skip.pending()).toHaveLength(1);
    expect(f.flow.previous()).toBe(false);
    expect(f.flow.skip()).toBe(true);
    expect(f.flow.snapshot().delivery).toBe(c);
    expect(f.loadSource).not.toHaveBeenCalled();
  });

  it.each(['skip', 'positive'] as const)('releases the older %s across the two queues and locally cancels the newest other kind', async older => {
    const f = fixture(); await f.start();
    if (older === 'skip') expect(f.flow.skip()).toBe(true); else f.rate();
    f.display(); await flush(); const b = f.flow.snapshot().delivery!;
    if (older === 'skip') f.rate(); else expect(f.flow.skip()).toBe(true);
    f.display(); await flush();
    expect(f.sent).toHaveLength(1); expect(f.sent[0]!.kind).toBe(older);
    expect(f.flow.previous()).toBe(true); expect(f.flow.snapshot().delivery).toBe(b);
    expect(f.queues[older === 'skip' ? 'positive' : 'skip'].pending()).toHaveLength(0);
    expect(f.sent).toHaveLength(1);
  });

  it('does not navigate or lose a choice if durable local cancellation fails', async () => {
    const f = fixture(); await f.start(); f.flow.skip(); f.display(); await flush();
    const current = f.flow.snapshot().delivery; const durable = [...f.rows.values()];
    f.failWrites();
    expect(f.flow.previous()).toBe(false); expect(f.flow.snapshot().delivery).toBe(current);
    expect([...f.rows.values()]).toEqual(durable); expect(f.sent).toHaveLength(0);
  });

  it('flushes the final durable choice on exit and forbids a local retraction after dispatch', async () => {
    const f = fixture(); await f.start(); f.flow.skip(); f.display(); await flush();
    expect(f.flow.hasDeferredAction()).toBe(true);
    f.flow.flushDeferred(); await flush();
    expect(f.sent).toHaveLength(1); expect(f.flow.hasDeferredAction()).toBe(false);
    expect(f.flow.previous()).toBe(false); expect(f.queues.skip.pending()).toHaveLength(1);
  });

  it('releases an idle final choice after 30 seconds without dropping the persisted command', async () => {
    vi.useFakeTimers(); const f = fixture(); await f.start(); f.flow.skip(); f.display(); await flush();
    expect(f.sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.sent).toHaveLength(1); expect(f.flow.hasDeferredAction()).toBe(false);
    expect(f.queues.skip.pending()).toHaveLength(1);
  });

  it('does not reactivate an expired retained source even if its choice is still held locally', async () => {
    vi.useFakeTimers(); const f = fixture(); f.initial.returnExpiresAt = Date.now() + 100;
    await f.start(); f.flow.skip(); f.display(); await flush();
    await vi.advanceTimersByTimeAsync(101);
    expect(f.flow.previous()).toBe(false);
    expect(f.flow.snapshot().delivery?.item.id).not.toBe(f.initial.item.id);
    expect(f.queues.skip.pending()).toHaveLength(1);
  });
});


it('does not invent a reusable lifetime for an unknown-age source after a successful capability read', async () => {
  const f = fixture(); delete f.initial.returnExpiresAt;
  await f.start();
  expect(f.loadSource).toHaveBeenCalledOnce();
  expect(f.flow.snapshot().source?.acceptsNewSkip).toBe(true);
  expect(f.flow.skip()).toBe(true); f.display(); await flush();
  expect(f.sent).toHaveLength(1);
  expect(f.flow.hasDeferredAction()).toBe(false);
  expect(f.flow.previous()).toBe(false);
});
