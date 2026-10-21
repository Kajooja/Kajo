import { describe, expect, it, vi } from 'vitest';
import { createDiscoveryFeed, type FeedDelivery } from './discoveryFeed';
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
  const load = vi.fn(async (request: PredictionPageRequest) => page(request));
  const loadSource = vi.fn(async (request: DiscoverySkipSourceRequest) => source(request));
  const recordImpression = vi.fn(() => id(7)); const submit = vi.fn((_command: KajoSkipCommand) => true);
  const flow = createDiscoveryFeed({ initial, scope, createId, nowMicros: () => '1000000',
    createRequest: () => createPredictionPageRequest({ ...scope, requestId: createId(), itemType: 'MOVIE', version: 3, limit: 1 }),
    load, loadSource, recordImpression, submit, onChange: vi.fn() });
  flow.start();
  return { flow, load, loadSource, recordImpression, submit };
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
    f.flow.acknowledged(id(80)); await flush(); expect(f.load).toHaveBeenCalledOnce(); expect(f.submit).not.toHaveBeenCalled(); f.flow.stop();
  });
  it('retries an ambiguous page using the exact request and drops all pre-action siblings', async () => {
    const f = fixture(); f.load.mockResolvedValueOnce({ status: 'error', message: 'lost reply', recovery: 'retry' } as never);
    f.flow.positiveCommitted(); await flush(); expect(f.flow.snapshot().delivery).toBeNull();
    const request = f.load.mock.calls[0]![0]; f.flow.retry(); await flush();
    expect(f.load.mock.calls[1]![0]).toBe(request); expect(f.flow.snapshot().delivery?.origin.deliveryRequestId).toBe(request.requestId); f.flow.stop();
  });
  it('rejects a late source/page completion after navigation, scope change or a newer committed refresh', async () => {
    const f = fixture(); const pending = deferred<ReturnType<typeof source>>();
    f.loadSource.mockImplementationOnce(() => pending.promise);
    f.flow.displayed(id(4), id(6)); f.flow.positiveCommitted(); await flush();
    pending.resolve(source({ ...scope, itemId: id(4), origin: { surface: 'DISCOVERY', sessionId: id(3), predictionId: id(5), deliveryRequestId: id(6), impressionEventId: id(7) } }));
    await flush(); expect(f.flow.snapshot().source).toBeNull(); expect(f.flow.snapshot().delivery?.item.id).toBe(id(9));
    const late = deferred<PredictionPage>(); f.load.mockImplementationOnce(() => late.promise);
    f.flow.positiveCommitted(); const request = f.load.mock.calls.at(-1)![0]; f.flow.stop();
    late.resolve(page(request, item(19))); await flush(); expect(f.flow.snapshot().delivery).toBeNull();
  });
  it('missing or not-yet-acknowledged exposure cannot become a skip; exposure ack retries only the source', async () => {
    const f = fixture(); f.loadSource.mockResolvedValueOnce(null as never);
    f.flow.displayed(id(4), id(6)); await flush(); expect(f.flow.skip()).toBe(false);
    f.flow.exposureAcknowledged(); await flush(); expect(f.flow.skip()).toBe(true); expect(f.load).not.toHaveBeenCalled(); f.flow.stop();
  });
});
