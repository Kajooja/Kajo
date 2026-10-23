import { describe, expect, it, vi } from 'vitest';
import { createDiscoveryFeed, receiveDiscoveryFeedAction, type FeedDelivery, type FeedPositiveReceipt } from './discoveryFeed';
import { createFeedPredictionPageRequest, createPredictionPageRequest, type PredictionPage, type PredictionPageRequest } from './predictionPageOperations';
import { CONTEXTUAL_SKIP_POLICY, CONTEXTUAL_SKIP_VERSION, type DiscoverySkipSource, type DiscoverySkipSourceRequest, type KajoSkipCommand } from '../events/contextualSkipOperations';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = { actorUserId: id(1), profileId: id(2), sessionId: id(3), mode: 'FOR_YOU' as const };
const item = (n: number) => ({ id: id(n), itemType: 'MOVIE' as const, title: `Item ${n}` });
const initial: FeedDelivery = { item: item(4), origin: { predictionId: id(5), deliveryRequestId: id(6),
  properties: { predictionSource: 'hosted', deliveryTier: 'RANKED' } } };
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
function source(request: DiscoverySkipSourceRequest): DiscoverySkipSource {
  return { ...request, version: CONTEXTUAL_SKIP_VERSION, policyVersion: CONTEXTUAL_SKIP_POLICY,
    contextChangePolicy: 'NO_TRUSTED_CONTEXT_CHANGE_V1' as const, contextRef: null, acceptsNewSkip: true };
}
function page(request: PredictionPageRequest, next = item(9)): PredictionPage {
  return { status: 'success', request, ranking: { predictionId: id(10), items: [next], predictions: [] }, availability: 'ITEMS',
    continuationSupported: true, nextCursor: null, candidateCount: 1, sourcePredictionId: id(10), pageIndex: 1, featureAt: null };
}
function fixture(bulk = false) {
  let sequence = 50;
  const createId = () => id(sequence++);
  const load = vi.fn(async (request: PredictionPageRequest) => page(request,
    request.context.attributes?.surface === 'DISCOVERY_FEED_RETURN' ? item(4) : item(9)));
  const loadSource = vi.fn(async (request: DiscoverySkipSourceRequest) => source(request));
  const undoPositive = vi.fn((_receipt: FeedPositiveReceipt, _actionId: string) => true);
  const recordImpression = vi.fn((_delivery: FeedDelivery) => id(7)); const submit = vi.fn((_command: KajoSkipCommand) => true);
  const flow = createDiscoveryFeed({ initial, scope, createId, nowMicros: () => '1000000',
    createRequest: replacesChainId => bulk
      ? createFeedPredictionPageRequest({ ...scope, requestId: createId(), itemType: 'MOVIE', limit: 5, replacesChainId })
      : createPredictionPageRequest({ ...scope, requestId: createId(), itemType: 'MOVIE', version: 3, limit: 1 }),
    createRestoreRequest: (replacesChainId, limit) => bulk
      ? createFeedPredictionPageRequest({ ...scope, requestId: createId(), itemType: 'MOVIE', limit, replacesChainId,
        context: { attributes: { surface: 'DISCOVERY_FEED_RETURN' } } })
      : createPredictionPageRequest({ ...scope, requestId: createId(), itemType: 'MOVIE', version: 3, limit,
        context: { attributes: { surface: 'DISCOVERY_FEED_RETURN' } } }),
    load, loadSource, recordImpression, submit, undoPositive, onChange: vi.fn() });
  flow.start();
  return { flow, load, loadSource, recordImpression, submit, undoPositive };
}

describe('Discovery displayed origins, durable navigation and recovery', () => {
  it('requires a mounted card and captures its exact page/request/impression before queuing a skip', async () => {
    const f = fixture();
    expect(f.flow.skip()).toBe(false); expect(f.recordImpression).not.toHaveBeenCalled();
    f.flow.displayed(initial.item.id, initial.origin.deliveryRequestId!); await flush();
    expect(f.flow.skip()).toBe(true); expect(f.flow.skip()).toBe(false);
    const command = f.submit.mock.calls[0]![0];
    expect(command).toMatchObject({ actorUserId: scope.actorUserId, profileId: scope.profileId, itemId: id(4),
      kind: 'CONTEXTUAL_SKIP', reversesActionId: null, origin: { sessionId: id(3), predictionId: id(5), deliveryRequestId: id(6), impressionEventId: id(7) } });
    expect(f.load).toHaveBeenCalledOnce();
    expect(f.flow.hasPendingAction(command.actionId)).toBe(true);
    f.flow.acknowledged(id(999)); expect(f.load).toHaveBeenCalledOnce();
    f.flow.acknowledged(command.actionId); await flush();
    expect(f.load).toHaveBeenCalledOnce(); expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    expect(f.recordImpression).toHaveBeenCalledOnce(); // Fetched is not yet displayed.
    f.flow.displayed(id(9), f.flow.snapshot().delivery!.origin.deliveryRequestId!); await flush();
    expect(f.recordImpression).toHaveBeenCalledTimes(2); f.flow.stop();
  });
  it('blocks a gesture synchronously while List or Shared controls own the current opportunity', async () => {
    const f = fixture(); f.flow.displayed(id(4), id(6)); await flush();
    f.flow.hold(true); expect(f.flow.skip()).toBe(false); expect(f.submit).not.toHaveBeenCalled();
    f.flow.hold(false); expect(f.flow.skip()).toBe(true); f.flow.stop();
  });
  it('advances a rating after durable local admission, before its receipt, without emitting a skip', async () => {
    const f = fixture(); f.flow.displayed(id(4), id(6)); await flush();
    f.flow.expectPositive(id(80)); expect(f.flow.skip()).toBe(false);
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(4)); expect(f.load).not.toHaveBeenCalled();
    expect(f.flow.positiveQueued(id(80))).toBe(true); await flush();
    expect(f.flow.snapshot()).toMatchObject({ positiveCommitted: false, delivery: { item: item(9) }, canPrevious: false });
    expect(f.flow.hasPendingAction(id(80))).toBe(true);
    f.flow.acknowledged(id(80)); await flush();
    expect(f.flow.snapshot()).toMatchObject({ positiveCommitted: false, delivery: { item: item(9) }, canPrevious: true });
    expect(f.flow.hasPendingAction(id(80))).toBe(false);
    expect(f.load).toHaveBeenCalledOnce(); expect(f.submit).not.toHaveBeenCalled(); f.flow.stop();
  });
  it('retries an ambiguous page using the exact request and drops all pre-action siblings', async () => {
    const f = fixture(); f.load.mockResolvedValueOnce({ status: 'error', message: 'lost reply', recovery: 'retry' } as never);
    f.flow.positiveCommitted(); f.flow.advance(); await flush();
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, navigationPending: true, loading: false });
    const request = f.load.mock.calls[0]![0]; f.flow.retry(); await flush();
    expect(f.load.mock.calls[1]![0]).toBe(request); expect(f.flow.snapshot().delivery?.origin.deliveryRequestId).toBe(request.requestId); f.flow.stop();
  });
  it('rejects a late source/page completion after navigation, scope change or a newer committed refresh', async () => {
    const f = fixture(); const pending = deferred<ReturnType<typeof source>>();
    f.loadSource.mockImplementationOnce(() => pending.promise);
    f.flow.displayed(id(4), id(6)); f.flow.positiveCommitted(); f.flow.advance(); await flush();
    pending.resolve(source({ ...scope, itemId: id(4), origin: { surface: 'DISCOVERY', sessionId: id(3), predictionId: id(5), deliveryRequestId: id(6), impressionEventId: id(7) } }));
    await flush(); expect(f.flow.snapshot().source).toBeNull(); expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    const late = deferred<PredictionPage>(); f.load.mockImplementationOnce(() => late.promise);
    f.flow.positiveCommitted(); f.flow.advance(); const request = f.load.mock.calls.at(-1)![0]; f.flow.stop();
    late.resolve(page(request, item(19))); await flush(); expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
  });
  it('keeps the outgoing card inert through slow successor loading and exact failed-request recovery', async () => {
    const f = fixture(); f.flow.displayed(id(4), id(6)); await flush();
    const pending = deferred<PredictionPage>(); f.load.mockImplementationOnce(() => pending.promise);
    expect(f.flow.advance()).toBe(true);
    const skip = f.submit.mock.calls[0]![0];
    expect(f.load).toHaveBeenCalledOnce();
    f.flow.acknowledged(skip.actionId);
    const request = f.load.mock.calls[0]![0];
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, loading: true, navigationPending: true, canPrevious: false });
    expect(f.flow.advance()).toBe(false); expect(f.flow.previous()).toBe(false);
    f.flow.displayed(id(4), id(6)); f.flow.exposureAcknowledged();
    f.flow.expectPositive(id(90)); f.flow.positiveCommitted();
    f.flow.positiveReceipt({ actionId: id(91), itemId: id(4), undoable: true });
    expect(f.recordImpression).toHaveBeenCalledOnce(); expect(f.load).toHaveBeenCalledOnce();
    expect(f.flow.snapshot()).toMatchObject({ waitingActionId: null, positiveCommitted: false });
    pending.resolve({ status: 'error', recovery: 'retry', message: 'connection lost' } as never); await flush();
    expect(f.flow.snapshot()).toMatchObject({ delivery: initial, loading: false, navigationPending: true, canPrevious: false });
    expect(f.flow.advance()).toBe(false); expect(f.flow.previous()).toBe(false);
    f.flow.retry(); await flush();
    expect(f.load.mock.calls[1]![0]).toBe(request);
    expect(f.submit).toHaveBeenCalledOnce(); expect(f.recordImpression).toHaveBeenCalledOnce();
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(9) }, navigationPending: false, canPrevious: true });
    f.flow.displayed(id(9), request.requestId); await flush();
    expect(f.recordImpression).toHaveBeenCalledTimes(2); f.flow.stop();
  });
  it('queues a captured skip immediately while its optional source read is unresolved', async () => {
    const f = fixture(); const pending = deferred<DiscoverySkipSource>();
    f.loadSource.mockImplementationOnce(() => pending.promise);
    expect(f.flow.snapshot().canSkip).toBe(false);
    f.flow.displayed(id(4), id(6));
    expect(f.flow.snapshot()).toMatchObject({ canSkip: true, source: null, message: null });
    expect(f.flow.skip()).toBe(true);
    expect(f.submit.mock.calls[0]![0]).toMatchObject({ itemId: id(4), origin: {
      predictionId: id(5), deliveryRequestId: id(6), impressionEventId: id(7),
    } });
    pending.resolve(source({ ...scope, itemId: id(4), origin: { surface: 'DISCOVERY', sessionId: id(3),
      predictionId: id(5), deliveryRequestId: id(6), impressionEventId: id(7) } }));
    await flush();
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(9) }, source: null, message: null });
    expect(f.submit).toHaveBeenCalledOnce(); f.flow.stop();
  });
  it('previews the exact previous Item after undo admission but grants no origin until fresh restoration', async () => {
    const f = fixture(); f.flow.displayed(id(4), id(6)); await flush();
    expect(f.flow.advance()).toBe(true);
    const skip = f.submit.mock.calls[0]![0]; f.flow.acknowledged(skip.actionId); await flush();
    expect(f.flow.snapshot().canPrevious).toBe(true);
    const outgoing = f.flow.snapshot().delivery;
    expect(f.flow.previous()).toBe(true);
    const withdrawal = f.submit.mock.calls[1]![0];
    expect(withdrawal).toMatchObject({ ...skip, actionId: expect.any(String),
      kind: 'WITHDRAW_CONTEXTUAL_SKIP', reversesActionId: skip.actionId });
    expect(withdrawal.actionId).not.toBe(skip.actionId);
    const preview = f.flow.snapshot().restoringPresentation;
    expect(preview).toMatchObject({ item: initial.item, visualKey: expect.any(String) });
    expect(f.flow.snapshot()).toMatchObject({ delivery: outgoing, navigationPending: true, canSkip: false });
    f.flow.displayed(initial.item.id, initial.origin.deliveryRequestId!);
    f.flow.displayed(outgoing!.item.id, outgoing!.origin.deliveryRequestId!);
    expect(f.recordImpression).toHaveBeenCalledOnce();
    expect(f.flow.advance()).toBe(false); expect(f.flow.previous()).toBe(false);
    f.flow.acknowledged(id(999)); expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    f.flow.acknowledged(withdrawal.actionId); await flush();
    expect(f.flow.snapshot().delivery?.item).toEqual(initial.item);
    expect(f.flow.snapshot().delivery?.origin.deliveryRequestId).not.toBe(initial.origin.deliveryRequestId);
    expect(f.flow.snapshot()).toMatchObject({ canPrevious: false, restoringPresentation: null, presentationKey: preview!.visualKey });
    expect(f.recordImpression).toHaveBeenCalledOnce(); f.flow.stop();
  });
  it('waits for every rating and List undo receipt and never adds skip to a positive card', async () => {
    const f = fixture(); f.flow.displayed(id(4), id(6)); await flush();
    f.flow.positiveReceipt({ actionId: id(80), itemId: id(4), undoable: true });
    f.flow.positiveReceipt({ actionId: id(80), itemId: id(4), undoable: true });
    f.flow.expectPositive(id(81)); expect(f.flow.skip()).toBe(false);
    f.flow.acknowledged(id(81)); await flush();
    expect(f.submit).not.toHaveBeenCalled();
    expect(f.flow.previous()).toBe(true);
    expect(f.undoPositive.mock.calls[0]![0].actionId).toBe(id(81));
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]);
    expect(f.undoPositive.mock.calls[1]![0].actionId).toBe(id(80));
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    f.flow.acknowledged(f.undoPositive.mock.calls[1]![1]); await flush();
    expect(f.flow.snapshot().delivery?.item).toEqual(initial.item);
    expect(f.flow.snapshot().delivery?.origin.deliveryRequestId).not.toBe(initial.origin.deliveryRequestId);
    expect(f.flow.snapshot().positiveCommitted).toBe(false); f.flow.stop();
  });
  it('does not navigate back when guarded undo is unavailable; retry retains only unacknowledged work', async () => {
    const f = fixture();
    f.flow.positiveReceipt({ actionId: id(80), itemId: id(4), undoable: true });
    f.flow.positiveReceipt({ actionId: id(81), itemId: id(4), undoable: true });
    f.flow.advance(); await flush();
    f.flow.previous();
    const preview = f.flow.snapshot().restoringPresentation;
    expect(preview).toMatchObject({ item: initial.item, visualKey: expect.any(String) });
    f.undoPositive.mockReturnValueOnce(false);
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]);
    expect(f.flow.snapshot().waitingActionId).toBeNull();
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    expect(f.flow.snapshot().restoringPresentation).toEqual(preview);
    f.flow.retry();
    expect(f.flow.snapshot().restoringPresentation).toEqual(preview);
    expect(f.undoPositive.mock.calls.map(([receipt]) => receipt.actionId)).toEqual([id(81), id(80), id(80)]);
    f.flow.acknowledged(f.undoPositive.mock.calls[2]![1]); await flush();
    expect(f.flow.snapshot().delivery?.item).toEqual(initial.item);
    expect(f.flow.snapshot().delivery?.origin.deliveryRequestId).not.toBe(initial.origin.deliveryRequestId);
    expect(f.flow.snapshot()).toMatchObject({ restoringPresentation: null, presentationKey: preview!.visualKey }); f.flow.stop();
  });
  it('undoes edits on the current card before undoing the previous card', async () => {
    const f = fixture(); f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80));
    f.flow.advance(); await flush();
    f.flow.positiveReceipt({ actionId: id(81), itemId: id(9), undoable: true });
    f.flow.previous();
    expect(f.undoPositive.mock.calls[0]![0]).toMatchObject({ itemId: id(9), actionId: id(81) });
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]);
    expect(f.undoPositive.mock.calls[1]![0]).toMatchObject({ itemId: id(4), actionId: id(80) });
    f.flow.acknowledged(f.undoPositive.mock.calls[1]![1]); await flush();
    expect(f.flow.snapshot().delivery?.item).toEqual(initial.item);
    expect(f.flow.snapshot().delivery?.origin.deliveryRequestId).not.toBe(initial.origin.deliveryRequestId); f.flow.stop();
  });
  it('retains backward recovery after true exhaustion without manufacturing more Items', async () => {
    const f = fixture(); f.load.mockImplementationOnce(async request => ({ ...page(request),
      ranking: { predictionId: id(10), items: [], predictions: [] }, availability: 'EXHAUSTED' as never }));
    f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80)); f.flow.advance(); await flush();
    expect(f.flow.snapshot()).toMatchObject({ exhausted: true, delivery: null, canPrevious: true });
    expect(f.flow.previous()).toBe(true);
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]); await flush();
    expect(f.flow.snapshot()).toMatchObject({ exhausted: false, delivery: { item: initial.item } }); f.flow.stop();
  });
  it('ignores a positive receipt from another card and all completions after stopping', async () => {
    const f = fixture();
    f.flow.positiveReceipt({ actionId: id(80), itemId: id(99), undoable: true });
    expect(f.flow.snapshot().positiveCommitted).toBe(false);
    f.flow.expectPositive(id(81)); f.flow.stop(); f.flow.acknowledged(id(81));
    expect(f.flow.snapshot().positiveCommitted).toBe(false); expect(f.load).not.toHaveBeenCalled();
  });
  it.each(['skip', 'rating'])('returns with a fresh writable origin after %s, then accepts another skip', async kind => {
    const f = fixture(); f.flow.displayed(id(4), id(6)); await flush();
    if (kind === 'skip') {
      f.flow.advance(); f.flow.acknowledged(f.submit.mock.calls[0]![0].actionId);
    } else { f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80)); f.flow.advance(); }
    await flush(); f.flow.previous();
    const undoId = kind === 'skip' ? f.submit.mock.calls.at(-1)![0].actionId : f.undoPositive.mock.calls.at(-1)![1];
    f.flow.acknowledged(undoId); await flush();
    const restored = f.flow.snapshot().delivery!;
    expect(restored.item.id).toBe(id(4));
    expect(restored.origin.deliveryRequestId).not.toBe(id(6));
    expect(f.flow.snapshot().source).toBeNull();
    expect(f.flow.advance()).toBe(false);
    f.flow.displayed(restored.item.id, restored.origin.deliveryRequestId!); await flush();
    expect(f.flow.advance()).toBe(true);
    const newSkip = f.submit.mock.calls.at(-1)![0];
    expect(newSkip.origin).toMatchObject({ predictionId: restored.origin.predictionId,
      deliveryRequestId: restored.origin.deliveryRequestId });
    expect(newSkip.origin).not.toEqual({ ...f.submit.mock.calls[0]![0].origin, deliveryRequestId: id(6) });
    f.flow.acknowledged(newSkip.actionId); await flush();
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(9)); f.flow.stop();
  });
  it('continues through the card after a restored skip while background pages are still filling', async () => {
    const f = fixture(true);
    const reads: { request: PredictionPageRequest; pending: ReturnType<typeof deferred<PredictionPage>> }[] = [];
    f.load.mockImplementation(request => {
      const pending = deferred<PredictionPage>(); reads.push({ request, pending }); return pending.promise;
    });
    async function reply(index: number, items: number[], more = true) {
      const request = reads[index]!.request;
      reads[index]!.pending.resolve({ ...page(request),
        ranking: { predictionId: id(500 + index), items: items.map(item), predictions: [] },
        candidateCount: items.length, nextCursor: more ? id(600 + index) : null,
        chainId: id(700 + index) });
      await flush();
    }
    async function display() {
      const delivery = f.flow.snapshot().delivery!;
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!); await flush();
    }
    try {
      await display(); f.flow.warm(); await reply(0, [10, 11, 12, 13, 14]);
      for (const next of [10, 11, 12]) {
        expect(f.flow.advance()).toBe(true);
        f.flow.acknowledged(f.submit.mock.calls.at(-1)![0].actionId);
        expect(f.flow.snapshot().delivery?.item.id).toBe(id(next)); await display();
      }
      // The first refill remains unresolved across several forward choices and Undo.
      expect(reads).toHaveLength(2); expect(f.flow.previous()).toBe(true);
      const withdrawal = f.submit.mock.calls.at(-1)![0];
      expect(withdrawal).toMatchObject({ kind: 'WITHDRAW_CONTEXTUAL_SKIP', itemId: id(11) });
      f.flow.acknowledged(withdrawal.actionId);
      await reply(1, [15, 16, 17, 18, 19]);
      expect(reads[2]!.request.limit).toBe(5); await reply(2, [11]);
      const restored = f.flow.snapshot().delivery!;
      expect(restored.item.id).toBe(id(11));
      expect(f.flow.snapshot()).toMatchObject({ restoringPresentation: null, loading: false,
        navigationPending: false, refilling: true });
      expect(reads[3]!.request).toMatchObject({ limit: 5, replacesChainId: id(702) });
      await display();
      expect(f.flow.snapshot().canSkip).toBe(true);
      expect(f.flow.advance()).toBe(true);
      const restoredSkip = f.submit.mock.calls.at(-1)![0];
      expect(restoredSkip).toMatchObject({ kind: 'CONTEXTUAL_SKIP', itemId: id(11), origin: {
        predictionId: restored.origin.predictionId, deliveryRequestId: restored.origin.deliveryRequestId } });
      f.flow.acknowledged(restoredSkip.actionId);
      expect(f.flow.snapshot()).toMatchObject({ loading: true, navigationPending: true });
      // B was viewed before Undo but never chosen; it can enter the fresh feed again.
      await reply(3, [12, 20, 21, 22, 23]);
      const next = f.flow.snapshot().delivery!;
      expect(next.item.id).toBe(id(12));
      expect(f.flow.snapshot()).toMatchObject({ loading: false, navigationPending: false, refilling: true });
      await display();
      expect(f.flow.snapshot().canSkip).toBe(true); expect(f.flow.advance()).toBe(true);
      expect(f.submit.mock.calls.at(-1)![0]).toMatchObject({ kind: 'CONTEXTUAL_SKIP', itemId: id(12), origin: {
        predictionId: next.origin.predictionId, deliveryRequestId: next.origin.deliveryRequestId } });
      expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(20) }, loading: false, navigationPending: false });
      expect(f.recordImpression.mock.calls.map(([delivery]) => delivery.item.id)).toEqual([4, 10, 11, 12, 11, 12].map(id));
    } finally {
      f.flow.stop();
      for (const read of reads) read.pending.resolve(page(read.request));
      await flush();
    }
  });
  it('prepares five fresh restoration siblings so forward resumes before another refill roundtrip', async () => {
    const f = fixture(true);
    const reads: { request: PredictionPageRequest; pending: ReturnType<typeof deferred<PredictionPage>> }[] = [];
    f.load.mockImplementation(request => {
      const pending = deferred<PredictionPage>(); reads.push({ request, pending }); return pending.promise;
    });
    async function reply(index: number, items: number[]) {
      const request = reads[index]!.request;
      reads[index]!.pending.resolve({ ...page(request),
        ranking: { predictionId: id(500 + index), items: items.map(item), predictions: [] },
        candidateCount: items.length, nextCursor: id(600 + index), chainId: id(700 + index) });
      await flush();
    }
    async function display() {
      const delivery = f.flow.snapshot().delivery!;
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!); await flush();
    }
    try {
      await display(); f.flow.warm(); await reply(0, [10, 11, 12, 13, 14]);
      for (const next of [10, 11]) {
        expect(f.flow.advance()).toBe(true);
        f.flow.acknowledged(f.submit.mock.calls.at(-1)![0].actionId);
        expect(f.flow.snapshot().delivery?.item.id).toBe(id(next)); await display();
      }
      const oldSuccessor = f.flow.snapshot().delivery!;
      expect(reads).toHaveLength(2); expect(f.flow.previous()).toBe(true);
      const withdrawal = f.submit.mock.calls.at(-1)![0];
      expect(withdrawal).toMatchObject({ kind: 'WITHDRAW_CONTEXTUAL_SKIP', itemId: id(10) });
      f.flow.acknowledged(withdrawal.actionId);
      // Resolve the old epoch before the exact restoration reader can replace it.
      await reply(1, [15, 16, 17, 18, 19]);
      const restoreRequest = reads[2]!.request;
      expect(restoreRequest).toMatchObject({ limit: 5, replacesChainId: id(701) });
      const impressionsBeforeRestore = f.recordImpression.mock.calls.length;
      // A missing-target probe supplies no siblings; the original wider search
      // replaces its known reader instead of resizing the probe's cursor.
      await reply(2, [4, 11, 12, 13, 14]);
      expect(f.flow.snapshot().upcoming).toHaveLength(0);
      expect(reads[3]!.request).toMatchObject({ limit: 50, cursor: null, replacesChainId: id(702) });
      const searchRequest = reads[3]!.request;
      // The fresh fallback includes handled Items, duplicates and more than five eligible siblings.
      await reply(3, [4, 10, 11, 11, 20, 21, 10, 22, 23, 24]);
      const restored = f.flow.snapshot();
      expect(restored).toMatchObject({ delivery: { item: item(10) }, restoringPresentation: null,
        canPrevious: false, navigationPending: false, loading: false, refilling: false });
      expect(restored.upcoming.map(entry => entry.item.id)).toEqual([11, 20, 21, 22, 23].map(id));
      for (const delivery of [restored.delivery!, ...restored.upcoming]) {
        expect(delivery.origin).toMatchObject({ predictionId: id(503), deliveryRequestId: searchRequest.requestId });
      }
      expect(restored.upcoming[0]!.origin).not.toEqual(oldSuccessor.origin);
      expect(reads).toHaveLength(4); // The full window needs no extra feed5 read.
      expect(f.recordImpression).toHaveBeenCalledTimes(impressionsBeforeRestore);
      expect(f.flow.previous()).toBe(false);
      await display();
      expect(f.flow.advance()).toBe(true);
      // The already prepared successor enters synchronously while its replacement is still loading.
      expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(11) },
        loading: false, navigationPending: false, refilling: true });
      expect(reads).toHaveLength(5);
      expect(reads[4]!.request).toMatchObject({ version: 3, limit: 5, cursor: null, replacesChainId: id(703) });
      expect(f.submit.mock.calls.at(-1)![0]).toMatchObject({ kind: 'CONTEXTUAL_SKIP', itemId: id(10),
        origin: { predictionId: id(503), deliveryRequestId: searchRequest.requestId } });
      f.flow.acknowledged(f.submit.mock.calls.at(-1)![0].actionId);
      expect(f.recordImpression).toHaveBeenCalledTimes(impressionsBeforeRestore + 1);
      await display();
      expect(f.flow.advance()).toBe(true);
      expect(f.submit.mock.calls.at(-1)![0]).toMatchObject({ kind: 'CONTEXTUAL_SKIP', itemId: id(11),
        origin: { predictionId: id(503), deliveryRequestId: searchRequest.requestId } });
      expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(20) }, loading: false, navigationPending: false });
      expect(reads).toHaveLength(5);
    } finally {
      f.flow.stop();
      for (const read of reads) read.pending.resolve(page(read.request));
      await flush();
    }
  });
  it.each(['skip', 'rating'])('consumes one Undo after %s despite older history, and rearms after a new forward choice', async kind => {
    const f = fixture(); let nextItem = -1;
    f.load.mockImplementation(async request => ({ ...page(request,
      request.context.attributes?.surface === 'DISCOVERY_FEED_RETURN' ? item(9) : item(nextItem += 10)),
      nextCursor: request.context.attributes?.surface === 'DISCOVERY_FEED_RETURN' ? null : id(900) }));
    async function display() {
      const delivery = f.flow.snapshot().delivery!;
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!); await flush();
    }
    async function choose(actionId: string) {
      if (kind === 'skip') {
        expect(f.flow.advance()).toBe(true);
        f.flow.acknowledged(f.submit.mock.calls.at(-1)![0].actionId);
      } else {
        f.flow.expectPositive(actionId); expect(f.flow.positiveQueued(actionId)).toBe(true);
        f.flow.acknowledged(actionId);
      }
      await flush();
    }
    try {
      // Preserve an older entry so a second Undo would otherwise remain available.
      await display(); await choose(id(80));
      expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
      await display(); await choose(id(81));
      expect(f.flow.snapshot().delivery?.item.id).toBe(id(19));
      expect(f.flow.previous()).toBe(true);
      const undoId = kind === 'skip' ? f.submit.mock.calls.at(-1)![0].actionId : f.undoPositive.mock.calls.at(-1)![1];
      f.flow.acknowledged(undoId); await flush();
      expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(9) }, canPrevious: false,
        restoringPresentation: null, navigationPending: false });
      const submitted = f.submit.mock.calls.length; const undone = f.undoPositive.mock.calls.length;
      expect(f.flow.previous()).toBe(false);
      expect(f.submit).toHaveBeenCalledTimes(submitted); expect(f.undoPositive).toHaveBeenCalledTimes(undone);
      await display(); await choose(id(82));
      expect(f.flow.snapshot().canPrevious).toBe(true); expect(f.flow.previous()).toBe(true);
      if (kind === 'skip') expect(f.submit.mock.calls.at(-1)![0]).toMatchObject({ kind: 'WITHDRAW_CONTEXTUAL_SKIP', itemId: id(9) });
      else expect(f.undoPositive.mock.calls.at(-1)![0]).toMatchObject({ itemId: id(9), actionId: id(82) });
    } finally { f.flow.stop(); }
  });
  it.each(['skip', 'rating'])('completes sixteen %s and Undo cycles with fresh origins and bounded background preparation', async kind => {
    const f = fixture(true);
    const reads: { request: PredictionPageRequest; pending: ReturnType<typeof deferred<PredictionPage>> }[] = [];
    const cursorChains = new Map<string, string>();
    const restoredOrigins = new Set<string>();
    f.load.mockImplementation(request => {
      const pending = deferred<PredictionPage>(); reads.push({ request, pending }); return pending.promise;
    });
    async function reply(index: number, items: number[]) {
      const request = reads[index]!.request;
      const chainId = request.cursor ? cursorChains.get(request.cursor)! : id(20_000 + index);
      expect(chainId).toBeDefined();
      const nextCursor = id(21_000 + index);
      cursorChains.set(nextCursor, chainId);
      const result = { ...page(request), chainId, nextCursor, candidateCount: items.length,
        ranking: { predictionId: id(22_000 + index), items: items.map(item), predictions: [] } };
      reads[index]!.pending.resolve(result); await flush();
      return result;
    }
    async function display() {
      const delivery = f.flow.snapshot().delivery!;
      const before = f.recordImpression.mock.calls.length;
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!);
      f.flow.displayed(delivery.item.id, delivery.origin.deliveryRequestId!);
      await flush();
      expect(f.recordImpression).toHaveBeenCalledTimes(before + 1);
      expect(f.recordImpression.mock.calls.at(-1)![0]).toEqual(delivery);
    }
    try {
      await display(); f.flow.warm();
      let currentChain = (await reply(0, [10, 11, 12, 13, 14])).chainId;
      for (let cycle = 0; cycle < 16; cycle++) {
        const target = f.flow.snapshot().delivery!;
        const impressions = f.recordImpression.mock.calls.length;
        expect(target.item.id).toBe(id(4));
        expect(f.flow.snapshot().upcoming).toHaveLength(5);
        const refillIndex = reads.length;
        const actionId = kind === 'skip' ? null : id(30_000 + cycle);
        if (actionId) {
          f.flow.expectPositive(actionId);
          expect(f.flow.positiveQueued(actionId)).toBe(true);
          expect(f.flow.positiveQueued(actionId)).toBe(false);
        } else {
          expect(f.flow.advance()).toBe(true);
          expect(f.submit.mock.calls.at(-1)![0]).toMatchObject({ kind: 'CONTEXTUAL_SKIP', itemId: target.item.id,
            origin: { predictionId: target.origin.predictionId, deliveryRequestId: target.origin.deliveryRequestId } });
        }
        const forwardId = actionId ?? f.submit.mock.calls.at(-1)![0].actionId;
        expect(f.flow.advance()).toBe(false); // The successor has not mounted yet.
        expect(f.flow.previous()).toBe(false); // Its exact forward receipt is still pending.
        expect(f.flow.snapshot()).toMatchObject({ navigationPending: false, loading: false, refilling: true });
        expect(f.flow.snapshot().upcoming).toHaveLength(4);
        expect(reads).toHaveLength(refillIndex + 1);
        expect(reads[refillIndex]!.request.limit).toBe(5);
        expect(cursorChains.get(reads[refillIndex]!.request.cursor!)).toBe(currentChain);
        expect(reads[refillIndex]!.request.replacesChainId).toBeUndefined();
        f.flow.acknowledged(forwardId); await flush();
        expect(f.flow.snapshot().canPrevious).toBe(true);
        await display();
        // Leave the first refill ambiguous across Undo. Subsequent cycles use
        // its confirmed successor so every replacement has a known owner.
        const refillItems = Array.from({ length: 5 }, (_, offset) => 40_000 + cycle * 10 + offset);
        if (cycle) currentChain = (await reply(refillIndex, refillItems)).chainId;
        expect(f.flow.previous()).toBe(true);
        const undoId = kind === 'skip' ? f.submit.mock.calls.at(-1)![0].actionId : f.undoPositive.mock.calls.at(-1)![1];
        if (kind === 'skip') expect(f.submit.mock.calls.at(-1)![0]).toMatchObject({ kind: 'WITHDRAW_CONTEXTUAL_SKIP',
          itemId: target.item.id, reversesActionId: forwardId,
          origin: { predictionId: target.origin.predictionId, deliveryRequestId: target.origin.deliveryRequestId } });
        else expect(f.undoPositive.mock.calls.at(-1)![0]).toEqual({ actionId: forwardId, itemId: target.item.id, undoable: true });
        const commands = f.submit.mock.calls.length + f.undoPositive.mock.calls.length;
        expect(f.flow.previous()).toBe(false); expect(f.flow.advance()).toBe(false);
        expect(f.flow.snapshot()).toMatchObject({ canPrevious: false, restoringPresentation: { item: target.item } });
        expect(f.submit.mock.calls.length + f.undoPositive.mock.calls.length).toBe(commands);
        expect(f.recordImpression).toHaveBeenCalledTimes(impressions + 1);
        f.flow.acknowledged(undoId); await flush();
        if (!cycle) {
          expect(reads).toHaveLength(refillIndex + 1);
          currentChain = (await reply(refillIndex, refillItems)).chainId;
          expect(f.flow.snapshot().upcoming).toHaveLength(0); // The old epoch never seeds restoration.
        }
        const restoreIndex = refillIndex + 1;
        expect(reads).toHaveLength(restoreIndex + 1);
        expect(reads[restoreIndex]!.request).toMatchObject({ limit: 5, cursor: null, replacesChainId: currentChain });
        const siblings = Array.from({ length: 4 }, (_, offset) => 50_000 + cycle * 10 + offset);
        const fresh = await reply(restoreIndex, [4, ...siblings]);
        const restored = f.flow.snapshot();
        expect(restored).toMatchObject({ delivery: { item: target.item }, restoringPresentation: null,
          canPrevious: false, navigationPending: false, loading: false, refilling: true, message: null, refillError: null });
        expect(restored.upcoming.map(delivery => delivery.item.id)).toEqual(siblings.map(id));
        for (const delivery of [restored.delivery!, ...restored.upcoming]) expect(delivery.origin).toMatchObject({
          predictionId: fresh.ranking.predictionId, deliveryRequestId: fresh.request.requestId,
        });
        expect(restored.delivery!.origin).not.toEqual(target.origin);
        expect(restoredOrigins.has(fresh.request.requestId)).toBe(false); restoredOrigins.add(fresh.request.requestId);
        expect(reads).toHaveLength(restoreIndex + 2); // Replenish the probe's single free slot in the background.
        expect(reads[restoreIndex + 1]!.request).toMatchObject({ limit: 5, cursor: null, replacesChainId: fresh.chainId });
        expect(f.recordImpression).toHaveBeenCalledTimes(impressions + 1);
        expect(f.flow.previous()).toBe(false);
        expect(f.submit.mock.calls.length + f.undoPositive.mock.calls.length).toBe(commands);
        await display();
        expect(f.flow.snapshot()).toMatchObject({ canPrevious: false, canSkip: true });
        const replacement = 60_000 + cycle * 10;
        currentChain = (await reply(restoreIndex + 1, Array.from({ length: 5 }, (_, offset) => replacement + offset))).chainId;
        expect(f.flow.snapshot().upcoming.map(delivery => delivery.item.id)).toEqual([...siblings, replacement].map(id));
        expect(f.recordImpression).toHaveBeenCalledTimes(impressions + 2);
      }
      expect(reads).toHaveLength(49);
      expect(restoredOrigins.size).toBe(16);
      expect(f.recordImpression).toHaveBeenCalledTimes(33);
      expect(f.submit).toHaveBeenCalledTimes(kind === 'skip' ? 32 : 0);
      expect(f.undoPositive).toHaveBeenCalledTimes(kind === 'rating' ? 16 : 0);
      const commandIds = [...f.submit.mock.calls.map(([command]) => command.actionId),
        ...f.undoPositive.mock.calls.map(([, actionId]) => actionId)];
      expect(new Set(commandIds).size).toBe(commandIds.length);
    } finally {
      f.flow.stop();
      for (const read of reads) read.pending.resolve(page(read.request));
      await flush();
    }
  });
  it('retains the one Undo when its first durable admission is refused', async () => {
    const f = fixture();
    try {
      f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80)); await flush();
      f.undoPositive.mockReturnValueOnce(false);
      expect(f.flow.previous()).toBe(false);
      expect(f.flow.snapshot()).toMatchObject({ canPrevious: true, navigationPending: false, restoringPresentation: null });
      expect(f.flow.previous()).toBe(true);
      expect(f.undoPositive).toHaveBeenCalledTimes(2);
      f.flow.acknowledged(f.undoPositive.mock.calls.at(-1)![1]); await flush();
      expect(f.flow.snapshot()).toMatchObject({ delivery: { item: initial.item }, canPrevious: false, navigationPending: false });
      expect(f.flow.previous()).toBe(false);
    } finally { f.flow.stop(); }
  });
  it('retries the exact ambiguous restoration read without repeating acknowledged undo', async () => {
    const f = fixture(); f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80));
    f.flow.advance(); await flush(); f.flow.previous();
    f.load.mockResolvedValueOnce({ status: 'error', message: 'lost restoration reply', recovery: 'retry' } as never);
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]); await flush();
    const request = f.load.mock.calls.at(-1)![0];
    const preview = f.flow.snapshot().restoringPresentation;
    expect(preview).toMatchObject({ item: initial.item });
    expect(f.flow.snapshot()).toMatchObject({ navigationPending: true, canCancelPrevious: true });
    expect(f.flow.advance()).toBe(false);
    f.flow.retry(); await flush();
    expect(f.load.mock.calls.at(-1)![0]).toBe(request);
    expect(f.undoPositive).toHaveBeenCalledOnce();
    expect(f.flow.snapshot()).toMatchObject({ navigationPending: false, delivery: { item: initial.item },
      restoringPresentation: null, presentationKey: preview!.visualKey }); f.flow.stop();
  });
  it('keeps the original three wide fallback pages after a missing-target probe and offers fresh-feed recovery', async () => {
    const f = fixture(); f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80));
    f.flow.advance(); await flush(); f.flow.previous();
    f.load.mockImplementation(async request => ({ ...page(request, item(99)), nextCursor: id(800) }));
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]); await flush(); await flush();
    expect(f.load).toHaveBeenCalledTimes(5); // Forward + small probe + the original three wide pages.
    const restorationRequests = f.load.mock.calls.slice(1).map(([request]) => request);
    expect(restorationRequests.map(request => request.limit)).toEqual([5, 50, 50, 50]);
    expect(restorationRequests.map(request => request.cursor)).toEqual([null, null, id(800), id(800)]);
    expect(f.flow.snapshot()).toMatchObject({ navigationPending: true, canCancelPrevious: true, delivery: { item: item(9) } });
    expect(f.flow.snapshot().restoringPresentation).toMatchObject({ item: initial.item });
    expect(f.flow.cancelPrevious()).toBe(true); await flush();
    expect(f.undoPositive).toHaveBeenCalledOnce();
    expect(f.flow.snapshot()).toMatchObject({ navigationPending: false, delivery: { item: item(99) }, restoringPresentation: null }); f.flow.stop();
  });
  it('declines nonreversible Shared actions before entering navigation and releases a failed first guard', async () => {
    const f = fixture(); f.flow.positiveReceipt({ actionId: id(80), itemId: id(4), undoable: false });
    f.flow.advance(); await flush();
    expect(f.flow.snapshot().canPrevious).toBe(false);
    expect(f.flow.previous()).toBe(false); expect(f.flow.snapshot()).toMatchObject({ navigationPending: false, restoringPresentation: null });
    f.flow.stop();
    const g = fixture(); g.flow.expectPositive(id(80)); g.flow.acknowledged(id(80)); g.flow.advance(); await flush();
    const currentKey = g.flow.snapshot().presentationKey;
    g.undoPositive.mockReturnValue(false);
    expect(g.flow.previous()).toBe(false);
    expect(g.flow.snapshot()).toMatchObject({ navigationPending: false, restoringPresentation: null, presentationKey: currentKey });
    g.flow.positiveCommitted(); expect(g.flow.advance()).toBe(true); g.flow.stop();
  });
  it('clears a provisional undo presentation when its rejected command is explicitly discarded', async () => {
    const f = fixture(); f.flow.displayed(initial.item.id, initial.origin.deliveryRequestId!); await flush();
    expect(f.flow.advance()).toBe(true);
    f.flow.acknowledged(f.submit.mock.calls[0]![0].actionId); await flush();
    expect(f.flow.previous()).toBe(true);
    const withdrawal = f.submit.mock.calls[1]![0];
    expect(f.flow.snapshot().restoringPresentation).toMatchObject({ item: initial.item });
    expect(f.flow.snapshot().waitingActionId).toBe(withdrawal.actionId);
    f.flow.recoverRejected('skip', withdrawal.actionId);
    expect(f.flow.snapshot().restoringPresentation).toBeNull();
    expect(f.flow.snapshot().waitingActionId).toBeNull();
    expect(f.recordImpression).toHaveBeenCalledOnce();
    await flush(); f.flow.stop();
  });
  it('can preview a history entry with no undo command without manufacturing a new exposure', async () => {
    const f = fixture(); f.flow.positiveCommitted(); expect(f.flow.advance()).toBe(true); await flush();
    const outgoing = f.flow.snapshot().delivery;
    expect(f.flow.previous()).toBe(true);
    const preview = f.flow.snapshot().restoringPresentation;
    expect(preview).toMatchObject({ item: initial.item, visualKey: expect.any(String) });
    expect(f.flow.snapshot()).toMatchObject({ delivery: outgoing, navigationPending: true, canSkip: false });
    expect(f.submit).not.toHaveBeenCalled(); expect(f.undoPositive).not.toHaveBeenCalled();
    expect(f.recordImpression).not.toHaveBeenCalled();
    await flush();
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: initial.item }, restoringPresentation: null,
      presentationKey: preview!.visualKey, navigationPending: false });
    expect(f.recordImpression).not.toHaveBeenCalled(); f.flow.stop();
  });
  it('ignores a restoration result after unmount', async () => {
    const f = fixture(); f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80)); f.flow.advance(); await flush();
    f.flow.previous(); const later = deferred<PredictionPage>(); f.load.mockImplementationOnce(() => later.promise);
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]);
    const request = f.load.mock.calls.at(-1)![0]; f.flow.stop(); later.resolve(page(request, item(4))); await flush();
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    expect(f.flow.snapshot().restoringPresentation).toBeNull();
  });
  it('drops a source failure that arrives after a positive choice was acknowledged', async () => {
    const f = fixture(); const later = deferred<DiscoverySkipSource>();
    f.loadSource.mockImplementationOnce(() => later.promise);
    f.flow.displayed(id(4), id(6));
    f.flow.positiveReceipt({ actionId: id(80), itemId: id(4), undoable: true });
    later.resolve(null as never); await flush();
    expect(f.flow.snapshot()).toMatchObject({ positiveCommitted: true, message: null, delivery: initial });
    expect(f.flow.advance()).toBe(true); await flush();
    expect(f.flow.snapshot().canPrevious).toBe(true); f.flow.stop();
  });
  it('refreshes a recreated card after its recovered skip receipt, without inventing local history', async () => {
    const f = fixture(); f.flow.recoveredAction(id(90)); expect(f.load).not.toHaveBeenCalled();
    f.flow.recoveredAction(id(4)); await flush();
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(9) }, canPrevious: false });
    expect(f.submit).not.toHaveBeenCalled(); f.flow.stop();
  });
  it('can undo the first auto-advanced rating without an earlier browsing history', async () => {
    const f = fixture(); f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80)); await flush();
    expect(f.flow.snapshot().canPrevious).toBe(true); expect(f.flow.previous()).toBe(true);
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]); await flush();
    expect(f.flow.snapshot()).toMatchObject({ delivery: { item: item(4) }, positiveCommitted: false, canPrevious: false });
    f.flow.stop();
  });
  it('does not replace a saved-choice state with a late source transport failure', async () => {
    const f = fixture(); let reject!: (error: Error) => void;
    f.loadSource.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    f.flow.displayed(id(4), id(6));
    f.flow.positiveReceipt({ actionId: id(80), itemId: id(4), undoable: true }); reject(new Error('disconnected')); await flush();
    expect(f.flow.snapshot()).toMatchObject({ positiveCommitted: true, message: null }); f.flow.stop();
  });
  it('does not classify an unmatched recovered atomic undo receipt as a new positive choice', async () => {
    const f = fixture();
    const restored = { interest: null, saved: false, consumed: false, rating: null, notInterested: false } as const;
    receiveDiscoveryFeedAction(f.flow, { version: 1, actionId: id(80), profileId: scope.profileId,
      itemId: id(99), interaction: restored });
    expect(f.load).not.toHaveBeenCalled();
    receiveDiscoveryFeedAction(f.flow, { version: 1, actionId: id(81), profileId: scope.profileId,
      itemId: initial.item.id, interaction: restored });
    await flush();
    expect(f.flow.snapshot()).toMatchObject({ positiveCommitted: false, canPrevious: false, delivery: { item: item(9) } });
    f.flow.displayed(id(9), f.flow.snapshot().delivery!.origin.deliveryRequestId!); await flush();
    expect(f.flow.advance()).toBe(true);
    expect(f.submit.mock.calls.at(-1)![0]).toMatchObject({ kind: 'CONTEXTUAL_SKIP', itemId: id(9) });
    f.flow.stop();
  });
  it('recognizes a locally expected atomic rating by exact action ID at the hook receipt boundary', async () => {
    const f = fixture(); f.flow.expectPositive(id(80));
    receiveDiscoveryFeedAction(f.flow, { version: 1, actionId: id(80), profileId: scope.profileId,
      itemId: initial.item.id, interaction: { interest: null, saved: false, consumed: true, rating: 0, notInterested: false } });
    await flush();
    expect(f.flow.snapshot()).toMatchObject({ positiveCommitted: false, delivery: { item: item(9) } });
    expect(f.load).toHaveBeenCalledOnce();
    expect(f.submit).not.toHaveBeenCalled(); f.flow.stop();
  });
});
