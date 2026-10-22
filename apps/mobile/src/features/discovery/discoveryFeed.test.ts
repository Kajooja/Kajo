import { describe, expect, it, vi } from 'vitest';
import { createDiscoveryFeed, receiveDiscoveryFeedAction, type FeedDelivery, type FeedPositiveReceipt } from './discoveryFeed';
import { createPredictionPageRequest, type PredictionPage, type PredictionPageRequest } from './predictionPageOperations';
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
function fixture() {
  let sequence = 50;
  const createId = () => id(sequence++);
  const load = vi.fn(async (request: PredictionPageRequest) => page(request, request.limit === 50 ? item(4) : item(9)));
  const loadSource = vi.fn(async (request: DiscoverySkipSourceRequest) => source(request));
  const undoPositive = vi.fn((_receipt: FeedPositiveReceipt, _actionId: string) => true);
  const recordImpression = vi.fn(() => id(7)); const submit = vi.fn((_command: KajoSkipCommand) => true);
  const flow = createDiscoveryFeed({ initial, scope, createId, nowMicros: () => '1000000',
    createRequest: () => createPredictionPageRequest({ ...scope, requestId: createId(), itemType: 'MOVIE', version: 3, limit: 1 }),
    createRestoreRequest: () => createPredictionPageRequest({ ...scope, requestId: createId(), itemType: 'MOVIE', version: 3, limit: 50 }),
    load, loadSource, recordImpression, submit, undoPositive, onChange: vi.fn() });
  flow.start();
  return { flow, load, loadSource, recordImpression, submit, undoPositive };
}

describe('Discovery displayed-origin and committed-prefix feed', () => {
  it('requires a mounted card and real source capability; exact late-page/request/impression reach the command', async () => {
    const f = fixture();
    expect(f.flow.skip()).toBe(false); expect(f.recordImpression).not.toHaveBeenCalled();
    f.flow.displayed(initial.item.id, initial.origin.deliveryRequestId!); await flush();
    expect(f.flow.skip()).toBe(true); expect(f.flow.skip()).toBe(false);
    const command = f.submit.mock.calls[0]![0];
    expect(command).toMatchObject({ actorUserId: scope.actorUserId, profileId: scope.profileId, itemId: id(4),
      kind: 'CONTEXTUAL_SKIP', reversesActionId: null, origin: { sessionId: id(3), predictionId: id(5), deliveryRequestId: id(6), impressionEventId: id(7) } });
    expect(f.load).not.toHaveBeenCalled();
    f.flow.acknowledged(id(999)); expect(f.load).not.toHaveBeenCalled();
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
  it('keeps a rating on the same card until its own receipt; positive advancement never emits skip', async () => {
    const f = fixture(); f.flow.displayed(id(4), id(6)); await flush();
    f.flow.expectPositive(id(80)); expect(f.flow.skip()).toBe(false);
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(4)); expect(f.load).not.toHaveBeenCalled();
    f.flow.acknowledged(id(80)); await flush();
    expect(f.flow.snapshot()).toMatchObject({ positiveCommitted: false, delivery: { item: item(9) } });
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
    expect(f.load).not.toHaveBeenCalled();
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
  it('missing or not-yet-acknowledged exposure cannot become a skip; exposure ack retries only the source', async () => {
    const f = fixture(); f.loadSource.mockResolvedValueOnce(null as never);
    f.flow.displayed(id(4), id(6)); await flush(); expect(f.flow.skip()).toBe(false);
    f.flow.exposureAcknowledged(); await flush(); expect(f.flow.skip()).toBe(true); expect(f.load).not.toHaveBeenCalled(); f.flow.stop();
  });
  it('withdraws an exact acknowledged skip before restoring the previous card', async () => {
    const f = fixture(); f.flow.displayed(id(4), id(6)); await flush();
    expect(f.flow.advance()).toBe(true);
    const skip = f.submit.mock.calls[0]![0]; f.flow.acknowledged(skip.actionId); await flush();
    expect(f.flow.snapshot().canPrevious).toBe(true);
    expect(f.flow.previous()).toBe(true);
    const withdrawal = f.submit.mock.calls[1]![0];
    expect(withdrawal).toMatchObject({ ...skip, actionId: expect.any(String),
      kind: 'WITHDRAW_CONTEXTUAL_SKIP', reversesActionId: skip.actionId });
    expect(withdrawal.actionId).not.toBe(skip.actionId);
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    expect(f.flow.advance()).toBe(false); expect(f.flow.previous()).toBe(false);
    f.flow.acknowledged(id(999)); expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    f.flow.acknowledged(withdrawal.actionId); await flush();
    expect(f.flow.snapshot().delivery?.item).toEqual(initial.item);
    expect(f.flow.snapshot().delivery?.origin.deliveryRequestId).not.toBe(initial.origin.deliveryRequestId);
    expect(f.flow.snapshot().canPrevious).toBe(false);
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
    f.undoPositive.mockReturnValueOnce(false);
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]);
    expect(f.flow.snapshot().waitingActionId).toBeNull();
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    f.flow.retry();
    expect(f.undoPositive.mock.calls.map(([receipt]) => receipt.actionId)).toEqual([id(81), id(80), id(80)]);
    f.flow.acknowledged(f.undoPositive.mock.calls[2]![1]); await flush();
    expect(f.flow.snapshot().delivery?.item).toEqual(initial.item);
    expect(f.flow.snapshot().delivery?.origin.deliveryRequestId).not.toBe(initial.origin.deliveryRequestId); f.flow.stop();
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
  it('retries the exact ambiguous restoration read without repeating acknowledged undo', async () => {
    const f = fixture(); f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80));
    f.flow.advance(); await flush(); f.flow.previous();
    f.load.mockResolvedValueOnce({ status: 'error', message: 'lost restoration reply', recovery: 'retry' } as never);
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]); await flush();
    const request = f.load.mock.calls.at(-1)![0];
    expect(f.flow.snapshot()).toMatchObject({ navigationPending: true, canCancelPrevious: true });
    expect(f.flow.advance()).toBe(false);
    f.flow.retry(); await flush();
    expect(f.load.mock.calls.at(-1)![0]).toBe(request);
    expect(f.undoPositive).toHaveBeenCalledOnce();
    expect(f.flow.snapshot()).toMatchObject({ navigationPending: false, delivery: { item: initial.item } }); f.flow.stop();
  });
  it('bounds absent-target restoration to three real pages and offers fresh-feed recovery', async () => {
    const f = fixture(); f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80));
    f.flow.advance(); await flush(); f.flow.previous();
    f.load.mockImplementation(async request => ({ ...page(request, item(99)), nextCursor: id(800) }));
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]); await flush(); await flush();
    expect(f.load).toHaveBeenCalledTimes(4); // Forward + three restoration pages.
    expect(f.flow.snapshot()).toMatchObject({ navigationPending: true, canCancelPrevious: true, delivery: { item: item(9) } });
    expect(f.flow.cancelPrevious()).toBe(true); await flush();
    expect(f.undoPositive).toHaveBeenCalledOnce();
    expect(f.flow.snapshot()).toMatchObject({ navigationPending: false, delivery: { item: item(99) } }); f.flow.stop();
  });
  it('declines nonreversible Shared actions before entering navigation and releases a failed first guard', async () => {
    const f = fixture(); f.flow.positiveReceipt({ actionId: id(80), itemId: id(4), undoable: false });
    f.flow.advance(); await flush();
    expect(f.flow.snapshot().canPrevious).toBe(false);
    expect(f.flow.previous()).toBe(false); expect(f.flow.snapshot().navigationPending).toBe(false);
    f.flow.stop();
    const g = fixture(); g.flow.expectPositive(id(80)); g.flow.acknowledged(id(80)); g.flow.advance(); await flush();
    g.undoPositive.mockReturnValue(false);
    expect(g.flow.previous()).toBe(false); expect(g.flow.snapshot().navigationPending).toBe(false);
    g.flow.positiveCommitted(); expect(g.flow.advance()).toBe(true); g.flow.stop();
  });
  it('ignores a restoration result after unmount', async () => {
    const f = fixture(); f.flow.expectPositive(id(80)); f.flow.acknowledged(id(80)); f.flow.advance(); await flush();
    f.flow.previous(); const later = deferred<PredictionPage>(); f.load.mockImplementationOnce(() => later.promise);
    f.flow.acknowledged(f.undoPositive.mock.calls[0]![1]);
    const request = f.load.mock.calls.at(-1)![0]; f.flow.stop(); later.resolve(page(request, item(4))); await flush();
    expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
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
