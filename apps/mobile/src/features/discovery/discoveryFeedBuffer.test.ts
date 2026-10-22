import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiscoveryFeed, receiveDiscoveryFeedAction, type FeedDelivery } from './discoveryFeed';
import { createFeedPredictionPageRequest, type PredictionPage, type PredictionPageRequest, type PredictionPageResult } from './predictionPageOperations';
import { CONTEXTUAL_SKIP_POLICY, CONTEXTUAL_SKIP_VERSION, type DiscoverySkipSource, type DiscoverySkipSourceRequest, type KajoSkipCommand } from '../events/contextualSkipOperations';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const scope = { actorUserId: id(1), profileId: id(2), sessionId: id(3), mode: 'FOR_YOU' as const };
const item = (value: number) => ({ id: id(value), itemType: 'MOVIE' as const, title: `Item ${value}` });
const initial: FeedDelivery = { item: item(4), origin: { predictionId: id(5), deliveryRequestId: id(6),
  properties: { predictionSource: 'hosted', deliveryTier: 'RANKED' } } };
const flush = async () => { for (let count = 0; count < 20; count++) await Promise.resolve(); };
const cleanups: (() => void)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) cleanup(); await flush(); });

function fixture() {
  let nextClientId = 1_000; let nextServerId = 100_000;
  const createId = () => id(nextClientId++);
  const serverId = () => id(nextServerId++);
  const reads: { request: PredictionPageRequest; signal: AbortSignal; resolve: (result: PredictionPageResult) => void }[] = [];
  const receipts = new Map<string, PredictionPage>();
  const cursors = new Map<string, PredictionPage>();
  const load = vi.fn((request: PredictionPageRequest, signal: AbortSignal) => new Promise<PredictionPageResult>(resolve => {
    reads.push({ request, signal, resolve });
  }));
  const loadSource = vi.fn(async (request: DiscoverySkipSourceRequest): Promise<DiscoverySkipSource> => ({
    ...request, version: CONTEXTUAL_SKIP_VERSION, policyVersion: CONTEXTUAL_SKIP_POLICY,
    contextChangePolicy: 'NO_TRUSTED_CONTEXT_CHANGE_V1', contextRef: null, acceptsNewSkip: true,
  }));
  const recordImpression = vi.fn((_delivery: FeedDelivery) => createId());
  const submit = vi.fn((_command: KajoSkipCommand) => true);
  const flow = createDiscoveryFeed({ initial, scope, createId, nowMicros: () => '1000000',
    createRequest: replacesChainId => createFeedPredictionPageRequest({ ...scope, requestId: createId(),
      itemType: 'MOVIE', limit: 1, replacesChainId, context: { attributes: { surface: 'DISCOVERY_FEED' } } }),
    createRestoreRequest: replacesChainId => createFeedPredictionPageRequest({ ...scope, requestId: createId(),
      itemType: 'MOVIE', limit: 50, replacesChainId, context: { attributes: { surface: 'DISCOVERY_FEED_RETURN' } } }),
    load, loadSource, recordImpression, submit, undoPositive: vi.fn(() => true), onChange: vi.fn() });
  // Commit independently of resolving transport, so a lost reply still has an
  // immutable server receipt and an allocated reader to discover on exact retry.
  function commit(index: number, items: number[], more = true): PredictionPage {
    const request = reads[index]!.request;
    const previousReceipt = receipts.get(request.requestId);
    if (previousReceipt) { expect(previousReceipt.request).toBe(request); return previousReceipt; }
    const parent = request.cursor ? cursors.get(request.cursor) : undefined;
    if (request.cursor) expect(parent).toBeDefined();
    expect(items.length).toBeLessThanOrEqual(request.limit);
    const predictionId = serverId();
    const nextCursor = more && items.length > 0 ? serverId() : null;
    const result: PredictionPage = { status: 'success', request,
      ranking: { predictionId, items: items.map(item), predictions: [] },
      availability: items.length ? 'ITEMS' : 'CATALOG_EXHAUSTED', continuationSupported: true,
      nextCursor, candidateCount: items.length, sourcePredictionId: predictionId,
      pageIndex: (parent?.pageIndex ?? 0) + 1, featureAt: '2026-10-22T20:00:00.000Z',
      chainId: parent?.chainId ?? serverId(), rootPredictionId: parent?.rootPredictionId ?? predictionId,
      parentPredictionId: parent?.ranking.predictionId ?? null,
      seenCount: (parent?.seenCount ?? 0) + items.length, chainLimit: 1000,
      continuationState: nextCursor ? 'MORE' : 'CATALOG_EXHAUSTED' };
    receipts.set(request.requestId, result);
    if (nextCursor) cursors.set(nextCursor, result);
    return result;
  }
  async function reply(index: number, items: number[], more = true, readerLimit = false) {
    const result = commit(index, items, more);
    if (readerLimit) { expect(result.seenCount).toBe(result.chainLimit); result.continuationState = 'READER_LIMIT'; }
    reads[index]!.resolve(result); await flush(); return result;
  }
  async function fail(index: number, message = 'Reply lost') {
    reads[index]!.resolve({ status: 'error', message, recovery: 'retry' }); await flush();
  }
  async function mount() { flow.displayed(initial.item.id, initial.origin.deliveryRequestId!); await flush(); }
  async function warm() { flow.warm(); for (let index = 0; index < 4; index++) await reply(index, [10 + index]); }
  cleanups.push(() => { flow.stop(); for (const read of reads) read.resolve({ status: 'error', message: 'Stopped', recovery: 'retry' }); });
  flow.start();
  return { flow, reads, load, loadSource, recordImpression, submit, commit, reply, fail, mount, warm };
}

describe('Discovery five-card buffer', () => {
  it('prepares exactly four sequential v3 successors without exposing their origins as impressions or sources', async () => {
    const f = fixture(); await f.mount(); f.flow.warm();
    const pages: PredictionPage[] = [];
    for (let index = 0; index < 4; index++) {
      expect(f.reads).toHaveLength(index + 1);
      const request = f.reads[index]!.request;
      expect(request).toMatchObject({ version: 3, profileId: scope.profileId, sessionId: scope.sessionId, limit: 1 });
      if (index === 0) expect(request).toMatchObject({ cursor: null, replacesChainId: null });
      else {
        expect(request.cursor).toBe(pages[index - 1]!.nextCursor);
        expect(request).not.toHaveProperty('replacesChainId');
      }
      pages.push(await f.reply(index, [10 + index]));
    }
    expect(new Set(pages.map(page => page.chainId)).size).toBe(1);
    expect(pages.map(page => page.pageIndex)).toEqual([1, 2, 3, 4]);
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, refilling: false, loading: false });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([10, 11, 12, 13].map(id));
    for (const [index, delivery] of f.flow.snapshot().upcoming.entries()) {
      expect(delivery.origin).toMatchObject({ predictionId: pages[index]!.ranking.predictionId,
        deliveryRequestId: pages[index]!.request.requestId });
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!);
    }
    f.flow.warm(); await flush();
    expect(f.load).toHaveBeenCalledTimes(4);
    expect(f.recordImpression).toHaveBeenCalledOnce();
    expect(f.loadSource).toHaveBeenCalledOnce();
    expect(f.loadSource.mock.calls[0]![0].itemId).toBe(initial.item.id);
  });

  it('promotes the prepared card synchronously only on skip acknowledgement and retains siblings during refill', async () => {
    const f = fixture(); await f.mount(); await f.warm();
    const prepared = f.flow.snapshot().upcoming;
    expect(f.flow.advance()).toBe(true);
    const skip = f.submit.mock.calls[0]![0];
    expect(skip.origin).toMatchObject({ predictionId: initial.origin.predictionId,
      deliveryRequestId: initial.origin.deliveryRequestId });
    expect(f.flow.snapshot().delivery).toBe(initial);
    expect(f.flow.snapshot().upcoming).toEqual(prepared);
    f.flow.acknowledged(skip.actionId);
    expect(f.flow.snapshot()).toMatchObject({ delivery: prepared[0], navigationPending: false, loading: false, refilling: true });
    expect(f.flow.snapshot().upcoming).toEqual(prepared.slice(1));
    expect(f.reads).toHaveLength(5);
    expect(f.recordImpression).toHaveBeenCalledOnce();
    expect(f.flow.skip()).toBe(false);
    const active = f.flow.snapshot().delivery!;
    f.flow.displayed(active.item.id, active.origin.deliveryRequestId!); await flush();
    const source = f.flow.snapshot().source;
    expect(source?.origin).toMatchObject({ predictionId: active.origin.predictionId,
      deliveryRequestId: active.origin.deliveryRequestId });
    await f.reply(4, [14]);
    expect(f.flow.snapshot().source).toBe(source);
    expect(f.flow.snapshot().delivery).toBe(prepared[0]);
    expect(f.flow.snapshot().upcoming.slice(0, 3)).toEqual(prepared.slice(1));
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([11, 12, 13, 14].map(id));
    expect(f.recordImpression).toHaveBeenCalledTimes(2);
    expect(f.submit).toHaveBeenCalledOnce();
  });

  it('resolves an ambiguous pre-rating root by exact retry before replacing its reader and auto-advancing fresh', async () => {
    const f = fixture(); await f.mount(); f.flow.warm();
    const stale = f.commit(0, [20]);
    f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80));
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, upcoming: [], navigationPending: true });
    expect(f.reads).toHaveLength(1);
    expect(f.reads[0]!.signal.aborted).toBe(false);
    await f.fail(0);
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, navigationPending: true, refillError: 'Reply lost' });
    f.flow.retry();
    expect(f.reads[1]!.request).toBe(f.reads[0]!.request);
    await f.reply(1, [20]);
    expect(f.flow.snapshot().delivery).toBe(initial);
    expect(f.flow.snapshot().upcoming).toEqual([]);
    expect(f.reads[2]!.request).toMatchObject({ cursor: null, limit: 1, replacesChainId: stale.chainId });
    expect(f.reads[2]!.request.requestId).not.toBe(stale.request.requestId);
    const fresh = await f.reply(2, [30]);
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(30), origin: {
      predictionId: fresh.ranking.predictionId, deliveryRequestId: fresh.request.requestId } }, navigationPending: false });
    for (let index = 3; index < 7; index++) await f.reply(index, [28 + index]);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([31, 32, 33, 34].map(id));
    expect(f.submit).not.toHaveBeenCalled();
    expect(f.recordImpression).toHaveBeenCalledOnce();
    expect(f.flow.snapshot().refillError).toBeNull();
  });

  it('keeps the active source usable after background failure and retries the exact continuation', async () => {
    const f = fixture(); await f.mount(); f.flow.warm();
    await f.reply(0, [10]); await f.reply(1, [11]);
    const failedRequest = f.reads[2]!.request;
    const source = f.flow.snapshot().source;
    await f.fail(2);
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, source, loading: false, navigationPending: false,
      message: null, refillError: 'Reply lost' });
    expect(f.flow.advance()).toBe(true);
    f.flow.acknowledged(f.submit.mock.calls[0]![0].actionId);
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(10));
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([id(11)]);
    expect(f.reads).toHaveLength(3);
    f.flow.retryRefill();
    expect(f.reads[3]!.request).toBe(failedRequest);
    expect(f.reads[3]!.request).not.toHaveProperty('replacesChainId');
    await f.reply(3, [12]); await f.reply(4, [13]); await f.reply(5, [14]);
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(10) }, refilling: false, refillError: null });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([11, 12, 13, 14].map(id));
    expect(f.submit).toHaveBeenCalledOnce();
    expect(f.recordImpression).toHaveBeenCalledOnce();
  });

  it('undoes the exact old origin, discards late refill, restores a fresh origin and replaces the restoration reader', async () => {
    const f = fixture(); await f.mount(); await f.warm();
    f.flow.advance(); const skip = f.submit.mock.calls[0]![0]; f.flow.acknowledged(skip.actionId);
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(10));
    expect(f.flow.previous()).toBe(true);
    const withdrawal = f.submit.mock.calls[1]![0];
    expect(withdrawal).toMatchObject({ kind: 'WITHDRAW_CONTEXTUAL_SKIP', itemId: initial.item.id,
      reversesActionId: skip.actionId, origin: skip.origin });
    expect(withdrawal.actionId).not.toBe(skip.actionId);
    expect(f.flow.snapshot().upcoming).toEqual([]);
    f.flow.acknowledged(withdrawal.actionId);
    expect(f.reads).toHaveLength(5);
    const stale = await f.reply(4, [14]);
    expect(f.reads[5]!.request).toMatchObject({ limit: 50, cursor: null, replacesChainId: stale.chainId });
    expect(f.flow.snapshot().upcoming).toEqual([]);
    const restoration = await f.reply(5, [4, 50, 51]);
    const restored = f.flow.snapshot().delivery!;
    expect(restored).toMatchObject({ item: initial.item, origin: { predictionId: restoration.ranking.predictionId,
      deliveryRequestId: restoration.request.requestId } });
    expect(restored.origin.deliveryRequestId).not.toBe(initial.origin.deliveryRequestId);
    expect(f.flow.snapshot()).toMatchObject({ source: null, canPrevious: false, navigationPending: false, upcoming: [] });
    expect(f.reads[6]!.request).toMatchObject({ limit: 1, cursor: null, replacesChainId: restoration.chainId });
    // A newly ranked root can include the already active Item. It is skipped,
    // while restoration siblings never become feed cards or impressions.
    await f.reply(6, [4]);
    for (let index = 7; index < 11; index++) await f.reply(index, [13 + index]);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([20, 21, 22, 23].map(id));
    expect(f.recordImpression).toHaveBeenCalledOnce();
    f.flow.displayed(restored.item.id, restored.origin.deliveryRequestId!); await flush();
    expect(f.flow.advance()).toBe(true);
    expect(f.submit.mock.calls[2]![0].origin).toMatchObject({ predictionId: restoration.ranking.predictionId,
      deliveryRequestId: restoration.request.requestId });
  });

  it('replaces a full 1000-item reader while retaining its final queued cards and reports only true catalog exhaustion', async () => {
    const f = fixture(); await f.mount(); await f.warm();
    async function advance() {
      const delivery = f.flow.snapshot().delivery!;
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!); await flush();
      expect(f.flow.advance()).toBe(true);
      f.flow.acknowledged(f.submit.mock.calls.at(-1)![0].actionId);
    }
    // Exercise the real fixed server budget, not a smaller invented wire limit.
    let terminal: PredictionPage | undefined;
    for (let index = 4; index < 1000; index++) {
      await advance(); terminal = await f.reply(index, [10 + index], index !== 999, index === 999);
    }
    expect(terminal).toMatchObject({ pageIndex: 1000, seenCount: 1000, nextCursor: null, continuationState: 'READER_LIMIT' });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([1006, 1007, 1008, 1009].map(id));
    expect(f.flow.snapshot().exhausted).toBe(false);
    await advance();
    expect(f.reads[1000]!.request).toMatchObject({ cursor: null, replacesChainId: terminal!.chainId });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([1007, 1008, 1009].map(id));
    await f.reply(1000, [2000], false);
    for (const next of [1007, 1008, 1009, 2000]) {
      await advance(); expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(next) }, exhausted: false });
    }
    await advance();
    expect(f.flow.snapshot()).toMatchObject({ delivery: null, upcoming: [], exhausted: true });
    expect(f.reads).toHaveLength(1001);
  });

  it.each([10, null])('invalidates unseen cards for a recovered other-Item atomic receipt (rating %s) without changing active origin or history', async rating => {
    const f = fixture(); await f.mount(); await f.warm();
    f.flow.advance(); const skip = f.submit.mock.calls[0]![0]; f.flow.acknowledged(skip.actionId);
    const previousPage = await f.reply(4, [14]);
    const active = f.flow.snapshot().delivery!;
    f.flow.displayed(active.item.id, active.origin.deliveryRequestId!); await flush();
    const source = f.flow.snapshot().source;
    receiveDiscoveryFeedAction(f.flow, { version: 1, actionId: id(80), profileId: scope.profileId,
      itemId: id(99), interaction: { interest: null, saved: false, consumed: rating !== null, rating, notInterested: false } });
    expect(f.flow.snapshot()).toMatchObject({ delivery: active, source, upcoming: [], positiveCommitted: false,
      navigationPending: false, canPrevious: true });
    expect(f.reads[5]!.request).toMatchObject({ cursor: null, replacesChainId: previousPage.chainId });
    for (let index = 5; index < 9; index++) await f.reply(index, [15 + index]);
    expect(f.flow.snapshot().delivery).toBe(active);
    expect(f.flow.snapshot().source).toBe(source);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([20, 21, 22, 23].map(id));
    expect(f.recordImpression).toHaveBeenCalledTimes(2);
    expect(f.flow.previous()).toBe(true);
    expect(f.submit.mock.calls[1]![0]).toMatchObject({ kind: 'WITHDRAW_CONTEXTUAL_SKIP',
      reversesActionId: skip.actionId, origin: skip.origin });
  });
});
