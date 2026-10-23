import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiscoveryFeed, receiveDiscoveryFeedAction, type FeedDelivery, type FeedPositiveReceipt } from './discoveryFeed';
import { createFeedPredictionPageRequest, type PredictionPage, type PredictionPageRequest, type PredictionPageResult } from './predictionPageOperations';
import { CONTEXTUAL_SKIP_POLICY, CONTEXTUAL_SKIP_VERSION, type DiscoverySkipSource, type DiscoverySkipSourceRequest, type KajoSkipCommand } from '../events/contextualSkipOperations';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const scope = { actorUserId: id(1), profileId: id(2), sessionId: id(3), mode: 'FOR_YOU' as const };
const item = (value: number) => ({ id: id(value), itemType: 'MOVIE' as const, title: `Item ${value}` });
const initial: FeedDelivery = { item: item(4), origin: { predictionId: id(5), deliveryRequestId: id(6),
  properties: { predictionSource: 'hosted', deliveryTier: 'RANKED' } } };
const flush = async () => { for (let count = 0; count < 30; count++) await Promise.resolve(); };
const cleanups: (() => void)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) cleanup(); await flush(); });

function fixture(bulk = false) {
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
  const undoPositive = vi.fn((_receipt: FeedPositiveReceipt, _actionId: string) => true);
  const flow = createDiscoveryFeed({ initial, scope, createId, nowMicros: () => '1000000',
    createRequest: (replacesChainId, limit = 5) => createFeedPredictionPageRequest({ ...scope, requestId: createId(),
      itemType: 'MOVIE', limit: bulk ? limit : 1, replacesChainId, context: { attributes: { surface: 'DISCOVERY_FEED' } } }),
    createRestoreRequest: replacesChainId => createFeedPredictionPageRequest({ ...scope, requestId: createId(),
      itemType: 'MOVIE', limit: 50, replacesChainId, context: { attributes: { surface: 'DISCOVERY_FEED_RETURN' } } }),
    load, loadSource, recordImpression, submit, undoPositive, onChange: vi.fn() });
  // Commit independently of transport, preserving an allocated reader and an
  // immutable exact retry even when the reply was lost.
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
      pageIndex: (parent?.pageIndex ?? 0) + 1, featureAt: '2026-10-23T08:00:00.000Z',
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
  async function display() {
    const delivery = flow.snapshot().delivery!;
    flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!); await flush();
  }
  async function warm() { flow.warm(); for (let index = 0; index < 5; index++) await reply(index, [10 + index]); }
  cleanups.push(() => { flow.stop(); for (const read of reads) read.resolve({ status: 'error', message: 'Stopped', recovery: 'retry' }); });
  flow.start();
  return { flow, reads, load, loadSource, recordImpression, submit, undoPositive, commit, reply, fail, display, warm };
}

describe('Discovery active card plus five prepared successors', () => {
  it('warms five cards in one bulk read without recording their impressions or source capabilities', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    expect(f.reads).toHaveLength(1);
    expect(f.reads[0]!.request).toMatchObject({ version: 3, cursor: null, limit: 5, replacesChainId: null });
    const page = await f.reply(0, [10, 11, 12, 13, 14]);
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, refilling: false, loading: false });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([10, 11, 12, 13, 14].map(id));
    for (const delivery of f.flow.snapshot().upcoming) {
      expect(delivery.origin).toMatchObject({ predictionId: page.ranking.predictionId, deliveryRequestId: page.request.requestId });
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!);
    }
    f.flow.warm(); await flush();
    expect(f.load).toHaveBeenCalledOnce();
    expect(f.recordImpression).toHaveBeenCalledOnce();
    expect(f.loadSource).toHaveBeenCalledOnce();
    expect(f.loadSource.mock.calls[0]![0].itemId).toBe(initial.item.id);
  });

  it('also fills all five slots across one-item continuation pages with their particular frozen origins', async () => {
    const f = fixture(); await f.display(); f.flow.warm();
    const pages: PredictionPage[] = [];
    for (let index = 0; index < 5; index++) {
      expect(f.reads).toHaveLength(index + 1);
      const request = f.reads[index]!.request;
      if (index === 0) expect(request).toMatchObject({ cursor: null, replacesChainId: null });
      else expect(request.cursor).toBe(pages[index - 1]!.nextCursor);
      pages.push(await f.reply(index, [10 + index]));
    }
    expect(new Set(pages.map(page => page.chainId)).size).toBe(1);
    expect(pages.map(page => page.pageIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(f.flow.snapshot().upcoming).toHaveLength(5);
    f.flow.snapshot().upcoming.forEach((delivery, index) => expect(delivery.origin).toMatchObject({
      predictionId: pages[index]!.ranking.predictionId, deliveryRequestId: pages[index]!.request.requestId,
    }));
    expect(f.recordImpression).toHaveBeenCalledOnce();
  });

  it('promotes synchronously after durable skip admission and exposes the new card while the previous skip is pending', async () => {
    const f = fixture(); await f.display(); await f.warm();
    const prepared = f.flow.snapshot().upcoming;
    expect(f.flow.advance()).toBe(true);
    const skip = f.submit.mock.calls[0]![0];
    expect(skip.origin).toMatchObject({ predictionId: initial.origin.predictionId, deliveryRequestId: initial.origin.deliveryRequestId });
    expect(f.flow.hasPendingAction(skip.actionId)).toBe(true);
    expect(f.flow.snapshot()).toMatchObject({ delivery: prepared[0], navigationPending: false, loading: false, refilling: true, canPrevious: false });
    expect(f.flow.snapshot().upcoming).toEqual(prepared.slice(1));
    expect(f.reads).toHaveLength(6);
    expect(f.recordImpression).toHaveBeenCalledOnce();
    expect(f.flow.skip()).toBe(false); // Not yet mounted, so no real impression origin.
    await f.display();
    expect(f.recordImpression).toHaveBeenCalledTimes(2);
    expect(f.flow.snapshot().canSkip).toBe(true);
    const active = f.flow.snapshot().delivery;
    const source = f.flow.snapshot().source;
    await f.reply(5, [15]);
    f.flow.acknowledged(skip.actionId);
    expect(f.flow.snapshot()).toMatchObject({ delivery: active, source, canPrevious: true });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([11, 12, 13, 14, 15].map(id));
    expect(f.submit).toHaveBeenCalledOnce();
  });

  it('binds rapid ratings and late receipts to their original cards without replacing the current or prepared cards', async () => {
    const f = fixture(); await f.display(); await f.warm();
    const rated = [initial, ...f.flow.snapshot().upcoming.slice(0, 2)];
    for (const [index, delivery] of rated.entries()) {
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!);
      f.flow.expectPositive(id(80 + index));
      expect(f.flow.positiveQueued(id(80 + index))).toBe(true);
    }
    const current = f.flow.snapshot().delivery;
    const prepared = f.flow.snapshot().upcoming;
    expect(current?.item.id).toBe(id(12));
    expect(f.flow.snapshot().canPrevious).toBe(false);
    expect(f.submit).not.toHaveBeenCalled();
    for (const index of [1, 0, 2]) {
      receiveDiscoveryFeedAction(f.flow, { version: 1, actionId: id(80 + index), profileId: scope.profileId,
        itemId: rated[index]!.item.id, interaction: { interest: null, saved: false, consumed: true, rating: index * 5, notInterested: false } });
      expect(f.flow.hasPendingAction(id(80 + index))).toBe(false);
      expect(f.flow.snapshot()).toMatchObject({ delivery: current, upcoming: prepared, positiveCommitted: false });
    }
    expect(f.flow.snapshot().canPrevious).toBe(true);
    expect(f.flow.previous()).toBe(true);
    expect(f.undoPositive.mock.calls[0]![0]).toMatchObject({ actionId: id(82), itemId: rated[2]!.item.id });
  });

  it('accepts rapid skips from each newly displayed origin before any preceding skip or optional source reply', async () => {
    const f = fixture(true);
    const replies: { request: DiscoverySkipSourceRequest; resolve: (source: DiscoverySkipSource) => void }[] = [];
    f.loadSource.mockImplementation(request => new Promise(resolve => replies.push({ request, resolve })));
    await f.display(); f.flow.warm(); await f.reply(0, [10, 11, 12, 13, 14]);
    const displayed: FeedDelivery[] = [];
    for (let count = 0; count < 3; count++) {
      const delivery = f.flow.snapshot().delivery!; displayed.push(delivery);
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!);
      expect(f.flow.snapshot().canSkip).toBe(true);
      expect(f.flow.advance()).toBe(true);
    }
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(12) }, canPrevious: false });
    expect(f.recordImpression).toHaveBeenCalledTimes(3);
    expect(f.submit).toHaveBeenCalledTimes(3);
    for (const [index, [command]] of f.submit.mock.calls.entries()) {
      expect(command).toMatchObject({ itemId: displayed[index]!.item.id, origin: {
        predictionId: displayed[index]!.origin.predictionId, deliveryRequestId: displayed[index]!.origin.deliveryRequestId,
        impressionEventId: f.recordImpression.mock.results[index]!.value,
      } });
      expect(f.flow.hasPendingAction(command.actionId)).toBe(true);
      f.flow.acknowledged(command.actionId);
    }
    const active = f.flow.snapshot().delivery;
    for (const { request, resolve } of replies) resolve({ ...request, version: CONTEXTUAL_SKIP_VERSION,
      policyVersion: CONTEXTUAL_SKIP_POLICY, contextChangePolicy: 'NO_TRUSTED_CONTEXT_CHANGE_V1', contextRef: null, acceptsNewSkip: true });
    await flush();
    expect(f.flow.snapshot()).toMatchObject({ delivery: active, source: null, message: null, canPrevious: true });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([13, 14].map(id));
  });

  it('does not advance or remember a command when the durable queue rejects admission', async () => {
    const f = fixture(); await f.display(); await f.warm();
    const before = f.flow.snapshot();
    f.submit.mockReturnValueOnce(false);
    expect(f.flow.advance()).toBe(false);
    expect(f.flow.snapshot()).toMatchObject({ delivery: before.delivery, upcoming: before.upcoming, canPrevious: false });
    expect(f.flow.hasPendingAction(f.submit.mock.calls[0]![0].actionId)).toBe(false);
    f.flow.expectPositive(id(80)); f.flow.cancelPositive(id(80));
    expect(f.flow.positiveQueued(id(80))).toBe(false);
    expect(f.flow.snapshot().delivery).toBe(initial);
    expect(f.flow.advance()).toBe(true);
  });

  it('keeps only five eligible successors when a refill page contains duplicates and excess unseen rows', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    await f.reply(0, [10, 11, 12, 13, 14]);
    f.flow.advance();
    await f.reply(1, [4, 10, 11, 15, 16]);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([11, 12, 13, 14, 15].map(id));
    expect(f.flow.snapshot().upcoming).toHaveLength(5);
    expect(f.recordImpression).toHaveBeenCalledOnce();
    expect(f.flow.snapshot().upcoming.some(delivery => delivery.item.id === id(16))).toBe(false);
  });

  it('uses an exact ambiguous refill retry before the next new root consumes the acknowledged prefix', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    const prepared = f.commit(0, [20, 21, 22, 23, 24]);
    f.flow.expectPositive(id(80)); expect(f.flow.positiveQueued(id(80))).toBe(true); f.flow.acknowledged(id(80));
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, upcoming: [], navigationPending: true });
    expect(f.reads).toHaveLength(1);
    expect(f.reads[0]!.signal.aborted).toBe(false);
    await f.fail(0);
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, navigationPending: true, refillError: 'Reply lost' });
    f.flow.retry();
    expect(f.reads[1]!.request).toBe(f.reads[0]!.request);
    await f.reply(1, [20, 21, 22, 23, 24]);
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(20), origin: {
      predictionId: prepared.ranking.predictionId, deliveryRequestId: prepared.request.requestId } }, navigationPending: false });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([21, 22, 23, 24].map(id));
    expect(f.reads[2]!.request).toMatchObject({ cursor: null, limit: 5, replacesChainId: prepared.chainId });
    expect(f.reads[2]!.request.requestId).not.toBe(prepared.request.requestId);
    await f.reply(2, [30, 31, 32, 33, 34]);
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(20));
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([21, 22, 23, 24, 30].map(id));
    expect(f.submit).not.toHaveBeenCalled();
    expect(f.recordImpression).toHaveBeenCalledOnce();
  });

  it('quietly renews a dirty expired cursor without clearing the retained prepared window', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    await f.reply(0, [10, 11, 12, 13, 14]);
    f.flow.expectPositive(id(80)); expect(f.flow.positiveQueued(id(80))).toBe(true);
    const active = f.flow.snapshot().delivery;
    const prepared = f.flow.snapshot().upcoming;
    f.flow.acknowledged(id(80));
    f.reads[1]!.resolve({ status: 'error', recovery: 'refresh', message: 'Expired previous cursor' });
    await flush();
    expect(f.flow.snapshot()).toMatchObject({ delivery: active, upcoming: prepared, message: null, refillError: null });
    expect(f.reads[2]!.request).toMatchObject({ cursor: null, replacesChainId: f.commit(0, [10, 11, 12, 13, 14]).chainId });
    await f.reply(2, [30, 31, 32, 33, 34]);
    expect(f.flow.snapshot().delivery).toBe(active);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([11, 12, 13, 14, 30].map(id));
  });

  it('admits only the one free slot from a bulk-five refill that finishes before the rating receipt', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    const initialPage = await f.reply(0, [10, 11, 12, 13, 14]);
    f.flow.expectPositive(id(80)); expect(f.flow.positiveQueued(id(80))).toBe(true);
    expect(f.reads[1]!.request).toMatchObject({ version: 3, limit: 5, cursor: initialPage.nextCursor });
    await f.reply(1, [15, 16, 17, 18, 19]);
    expect(f.flow.hasPendingAction(id(80))).toBe(true);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([11, 12, 13, 14, 15].map(id));
    expect(f.flow.snapshot().upcoming).toHaveLength(5);
    expect(f.reads).toHaveLength(2);
    expect(f.recordImpression).toHaveBeenCalledOnce();
    f.flow.acknowledged(id(80));
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(10));
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([11, 12, 13, 14, 15].map(id));
  });

  it('coalesces a burst of rating receipts without starving an in-flight refill and renews only the next new read', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    await f.reply(0, [10, 11, 12, 13, 14]);
    for (const actionId of [id(80), id(81), id(82)]) {
      await f.display(); f.flow.expectPositive(actionId); expect(f.flow.positiveQueued(actionId)).toBe(true);
    }
    const current = f.flow.snapshot().delivery;
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([13, 14].map(id));
    for (const actionId of [id(80), id(81), id(82)]) f.flow.acknowledged(actionId);
    expect(f.reads).toHaveLength(2);
    expect(f.reads[1]!.signal.aborted).toBe(false);
    const refill = await f.reply(1, [15, 16, 17, 18, 19]);
    expect(f.flow.snapshot().delivery).toBe(current);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([13, 14, 15, 16, 17].map(id));
    expect(f.reads).toHaveLength(2);
    await f.display(); expect(f.flow.skip()).toBe(true);
    expect(f.reads).toHaveLength(3);
    expect(f.reads[2]!.request).toMatchObject({ version: 3, limit: 5, cursor: null, replacesChainId: refill.chainId });
    await f.reply(2, [14, 15, 18, 19, 20]);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([14, 15, 16, 17, 18].map(id));
    expect(f.reads).toHaveLength(3);
  });

  it('retains an in-flight prepared page after a List receipt and renews the first new reader', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    f.flow.positiveReceipt({ actionId: id(80), itemId: initial.item.id, undoable: true });
    expect(f.reads).toHaveLength(1);
    const prepared = await f.reply(0, [10, 11, 12, 13, 14]);
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, positiveCommitted: true });
    expect(f.flow.snapshot().upcoming).toHaveLength(5);
    expect(f.flow.advance()).toBe(true);
    expect(f.submit).not.toHaveBeenCalled();
    expect(f.flow.snapshot().delivery?.origin).toMatchObject({ predictionId: prepared.ranking.predictionId,
      deliveryRequestId: prepared.request.requestId });
    expect(f.reads[1]!.request).toMatchObject({ limit: 5, cursor: null, replacesChainId: prepared.chainId });
  });

  it('discards only the rejected lane head while retaining exact pending suffix receipts through fresh recovery', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    await f.reply(0, [10, 11, 12, 13, 14]);
    for (const actionId of [id(80), id(81)]) {
      await f.display(); f.flow.expectPositive(actionId); expect(f.flow.positiveQueued(actionId)).toBe(true);
    }
    await f.display(); expect(f.flow.skip()).toBe(true);
    const pendingSkip = f.submit.mock.calls[0]![0];
    f.flow.recoverRejected('positive', id(80));
    expect(f.flow.hasPendingAction(id(80))).toBe(false);
    expect(f.flow.hasPendingAction(id(81))).toBe(true);
    expect(f.flow.hasPendingAction(pendingSkip.actionId)).toBe(true);
    expect(f.flow.snapshot().upcoming).toEqual([]);
    const outgoing = f.flow.snapshot().delivery;
    f.flow.acknowledged(id(81)); f.flow.acknowledged(pendingSkip.actionId);
    expect(f.flow.snapshot().delivery).toBe(outgoing);
    await f.reply(1, [20, 21, 22, 23, 24]); // Resolve the superseded reader first.
    await f.reply(2, [30, 31, 32, 33, 34]);
    await f.reply(3, [35, 36, 37, 38, 39]);
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(30) }, canPrevious: false });
    await f.display(); expect(f.flow.skip()).toBe(true);
    const freshSkip = f.submit.mock.calls.at(-1)![0];
    f.flow.acknowledged(freshSkip.actionId);
    expect(f.flow.snapshot().canPrevious).toBe(true);
    expect(f.flow.previous()).toBe(true);
    expect(f.submit.mock.calls.at(-1)![0]).toMatchObject({ kind: 'WITHDRAW_CONTEXTUAL_SKIP',
      itemId: id(30), reversesActionId: freshSkip.actionId, origin: freshSkip.origin });
  });

  it('does not remove fresh pending actions when an older outbox command is discarded by its exact ID', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    await f.reply(0, [10, 11, 12, 13, 14]);
    for (const actionId of [id(80), id(81)]) {
      await f.display(); f.flow.expectPositive(actionId); expect(f.flow.positiveQueued(actionId)).toBe(true);
    }
    f.flow.recoverRejected('positive', id(99)); // Recovered head from before this feed mounted.
    expect(f.flow.hasPendingAction(id(80))).toBe(true);
    expect(f.flow.hasPendingAction(id(81))).toBe(true);
    f.flow.recoverRejected('positive', id(81));
    expect(f.flow.hasPendingAction(id(80))).toBe(true);
    expect(f.flow.hasPendingAction(id(81))).toBe(false);
    f.flow.recoverRejected('skip', id(80)); // Another lane cannot discard this rating.
    expect(f.flow.hasPendingAction(id(80))).toBe(true);
  });

  it('activates a newly eligible card when a late rating receipt renews an exhausted feed', async () => {
    const f = fixture(true); await f.display();
    f.flow.expectPositive(id(80)); expect(f.flow.positiveQueued(id(80))).toBe(true);
    await f.reply(0, [], false);
    expect(f.flow.snapshot()).toMatchObject({ delivery: null, exhausted: true, navigationPending: false, canPrevious: false });
    expect(f.flow.hasPendingAction(id(80))).toBe(true);
    f.flow.acknowledged(id(80));
    expect(f.reads).toHaveLength(2);
    const fresh = await f.reply(1, [10, 11, 12, 13, 14], false);
    expect(f.flow.snapshot()).toMatchObject({ exhausted: false, navigationPending: false, canPrevious: true,
      delivery: { item: item(10), origin: { predictionId: fresh.ranking.predictionId, deliveryRequestId: fresh.request.requestId } } });
    expect(f.flow.hasPendingAction(id(80))).toBe(false);
    expect(f.recordImpression).toHaveBeenCalledOnce();
    await f.display(); expect(f.flow.skip()).toBe(true);
    expect(f.submit.mock.calls[0]![0].origin).toMatchObject({ predictionId: fresh.ranking.predictionId,
      deliveryRequestId: fresh.request.requestId });
  });

  it('keeps advancing when a dirty in-flight reader ends before its fresh replacement is requested', async () => {
    const f = fixture(true); await f.display(); f.flow.warm();
    f.flow.expectPositive(id(80)); expect(f.flow.positiveQueued(id(80))).toBe(true);
    f.flow.acknowledged(id(80));
    await f.reply(0, [], false);
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, exhausted: false, navigationPending: true });
    expect(f.reads).toHaveLength(2);
    expect(f.reads[1]!.request).toMatchObject({ cursor: null, limit: 5 });
    const fresh = await f.reply(1, [10, 11, 12, 13, 14], false);
    expect(f.flow.snapshot()).toMatchObject({ exhausted: false, navigationPending: false,
      delivery: { item: item(10), origin: { predictionId: fresh.ranking.predictionId, deliveryRequestId: fresh.request.requestId } } });
    expect(f.recordImpression).toHaveBeenCalledOnce();
  });

  it('keeps usable prepared cards through background failure and retries its exact continuation', async () => {
    const f = fixture(); await f.display(); f.flow.warm();
    await f.reply(0, [10]); await f.reply(1, [11]);
    const failedRequest = f.reads[2]!.request;
    await f.fail(2);
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, loading: false, navigationPending: false,
      message: null, refillError: 'Reply lost' });
    expect(f.flow.advance()).toBe(true);
    const skip = f.submit.mock.calls[0]![0];
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(10));
    f.flow.acknowledged(skip.actionId);
    await f.display();
    const active = f.flow.snapshot().delivery;
    f.flow.retryRefill();
    expect(f.reads[3]!.request).toBe(failedRequest);
    for (let index = 3; index < 7; index++) await f.reply(index, [9 + index]);
    expect(f.flow.snapshot()).toMatchObject({ delivery: active, refilling: false, refillError: null });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([11, 12, 13, 14, 15].map(id));
    expect(f.recordImpression).toHaveBeenCalledTimes(2);
    expect(f.submit).toHaveBeenCalledOnce();
  });

  it('undoes the exact old action, discards a late refill, and restores a fresh origin', async () => {
    const f = fixture(); await f.display(); await f.warm();
    f.flow.advance(); const skip = f.submit.mock.calls[0]![0]; f.flow.acknowledged(skip.actionId);
    expect(f.flow.previous()).toBe(true);
    const withdrawal = f.submit.mock.calls[1]![0];
    expect(withdrawal).toMatchObject({ kind: 'WITHDRAW_CONTEXTUAL_SKIP', itemId: initial.item.id,
      reversesActionId: skip.actionId, origin: skip.origin });
    expect(f.flow.snapshot().upcoming).toEqual([]);
    f.flow.acknowledged(withdrawal.actionId);
    const stale = await f.reply(5, [15]);
    expect(f.reads[6]!.request).toMatchObject({ limit: 50, cursor: null, replacesChainId: stale.chainId });
    const restoration = await f.reply(6, [4, 50, 51]);
    const restored = f.flow.snapshot().delivery!;
    expect(restored).toMatchObject({ item: initial.item, origin: { predictionId: restoration.ranking.predictionId,
      deliveryRequestId: restoration.request.requestId } });
    expect(restored.origin.deliveryRequestId).not.toBe(initial.origin.deliveryRequestId);
    expect(f.flow.snapshot()).toMatchObject({ source: null, canPrevious: false, navigationPending: false });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([50, 51].map(id));
    for (const delivery of f.flow.snapshot().upcoming) expect(delivery.origin).toMatchObject({
      predictionId: restoration.ranking.predictionId, deliveryRequestId: restoration.request.requestId,
    });
    expect(f.reads[7]!.request).toMatchObject({ cursor: null, replacesChainId: restoration.chainId });
    await f.reply(7, [4]);
    for (let index = 8; index < 11; index++) await f.reply(index, [12 + index]);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([50, 51, 20, 21, 22].map(id));
    expect(f.recordImpression).toHaveBeenCalledOnce();
    await f.display(); expect(f.flow.advance()).toBe(true);
    expect(f.submit.mock.calls[2]![0].origin).toMatchObject({ predictionId: restoration.ranking.predictionId,
      deliveryRequestId: restoration.request.requestId });
  });

  it('renews a full 1000-item reader without claiming catalogue exhaustion', async () => {
    const f = fixture(); await f.display(); await f.warm();
    async function advance() {
      await f.display(); expect(f.flow.advance()).toBe(true);
      f.flow.acknowledged(f.submit.mock.calls.at(-1)![0].actionId);
    }
    let terminal: PredictionPage | undefined;
    for (let index = 5; index < 1000; index++) {
      await advance(); terminal = await f.reply(index, [10 + index], index !== 999, index === 999);
    }
    expect(terminal).toMatchObject({ pageIndex: 1000, seenCount: 1000, nextCursor: null, continuationState: 'READER_LIMIT' });
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([1005, 1006, 1007, 1008, 1009].map(id));
    expect(f.flow.snapshot().exhausted).toBe(false);
    await advance();
    expect(f.reads[1000]!.request).toMatchObject({ cursor: null, replacesChainId: terminal!.chainId });
    await f.reply(1000, [2000], false);
    for (const next of [1006, 1007, 1008, 1009, 2000]) {
      await advance(); expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(next) }, exhausted: false });
    }
    await advance();
    expect(f.flow.snapshot()).toMatchObject({ delivery: null, upcoming: [], exhausted: true });
    expect(f.reads).toHaveLength(1001);
  });

  it.each([10, null])('invalidates unseen cards for an unrelated recovered atomic receipt (rating %s)', async rating => {
    const f = fixture(); await f.display(); await f.warm();
    f.flow.advance(); f.flow.acknowledged(f.submit.mock.calls[0]![0].actionId);
    const previousPage = await f.reply(5, [15]);
    await f.display();
    const active = f.flow.snapshot().delivery;
    const source = f.flow.snapshot().source;
    receiveDiscoveryFeedAction(f.flow, { version: 1, actionId: id(80), profileId: scope.profileId,
      itemId: id(99), interaction: { interest: null, saved: false, consumed: rating !== null, rating, notInterested: false } });
    expect(f.flow.snapshot()).toMatchObject({ delivery: active, source, upcoming: [], positiveCommitted: false,
      navigationPending: false, canPrevious: true });
    expect(f.reads[6]!.request).toMatchObject({ cursor: null, replacesChainId: previousPage.chainId });
    for (let index = 6; index < 11; index++) await f.reply(index, [14 + index]);
    expect(f.flow.snapshot().delivery).toBe(active);
    expect(f.flow.snapshot().source).toBe(source);
    expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([20, 21, 22, 23, 24].map(id));
    expect(f.flow.previous()).toBe(true);
    expect(f.submit.mock.calls[1]![0]).toMatchObject({ kind: 'WITHDRAW_CONTEXTUAL_SKIP',
      reversesActionId: f.submit.mock.calls[0]![0].actionId, origin: f.submit.mock.calls[0]![0].origin });
  });
});
