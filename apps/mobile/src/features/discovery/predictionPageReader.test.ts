import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPredictionPageReader, predictionReaderScopeKey, type PredictionReaderScope } from './predictionPageReader';
import { createPredictionPageRequest, loadPredictionPage, mapPredictionPage, type PredictionPageRequest, type PredictionPageResult } from './predictionPageOperations';

const id = (n: number) => `a2291000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope: PredictionReaderScope = { environment: 'https://first.invalid', actorUserId: id(1), profileId: id(2),
  sessionId: id(3), itemType: 'BOOK', mode: 'FOR_YOU', limit: 6, revision: 'initial' };
const featureAt = '2026-09-12T12:00:00+00:00';
let sequence = 100;
const newId = () => id(sequence++);
function page(request: PredictionPageRequest, index = 1, root = id(10), items = [index * 2, index * 2 + 1], next = id(30 + index)) {
  const predictionId = index === 1 ? root : id(10 + index);
  return { version: 2, requestId: request.requestId, profileId: request.profileId, sessionId: request.sessionId,
    discoveryMode: request.discoveryMode, itemType: request.itemType, predictionId, continuationSupported: true,
    nextCursor: items.length ? next : null, availability: items.length ? 'ITEMS' : 'WINDOW_EXHAUSTED',
    source: { version: 'frozen-page-v1', candidateCount: 18, resultCount: items.length, catalogEmpty: false,
      sourcePredictionId: root, pageIndex: index, featureAt },
    items: items.map((n, i) => ({ prediction_id: predictionId, item_id: id(50 + n), item_type: request.itemType,
      title: `Item ${n}`, description: null, tags: ['quiet'], score: 0.8, confidence: 0.7, rank: i + 1 })) };
}
const success = (request: PredictionPageRequest, index = 1, root = id(10), items?: number[]) =>
  mapPredictionPage(page(request, index, root, items), request);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function makeReader(load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>(async r => success(r)), capturedScope = scope) {
  const createRequest = vi.fn(() => createPredictionPageRequest({ requestId: newId(), profileId: capturedScope.profileId,
    sessionId: capturedScope.sessionId, mode: capturedScope.mode, itemType: capturedScope.itemType,
    limit: capturedScope.limit, context: { occurredAt: new Date().toISOString(), attributes: { localHour: 12 } } }));
  return { reader: createPredictionPageReader({ scope: capturedScope, createRequest, createRequestId: newId, load }), load, createRequest };
}
async function activate(reader: ReturnType<typeof makeReader>['reader']) {
  reader.activate();
  await vi.advanceTimersByTimeAsync(0);
}
async function settle() { await vi.advanceTimersByTimeAsync(0); }

beforeEach(() => { sequence = 100; vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-12T12:00:00Z')); });
afterEach(() => { vi.useRealTimers(); });

describe('captured prediction scope', () => {
  it.each(['environment', 'actorUserId', 'profileId', 'sessionId', 'itemType', 'mode', 'limit', 'revision'] as const)(
    'includes %s in cache identity', key => {
      expect(predictionReaderScopeKey({ ...scope, [key]: 'different' })).not.toBe(predictionReaderScopeKey(scope));
    });

  it('does no hidden-screen work and cancels a delayed activation before dispatch', async () => {
    const { reader, load, createRequest } = makeReader();
    reader.refresh(); reader.loadMore(); reader.retry();
    await vi.advanceTimersByTimeAsync(1000);
    expect(load).not.toHaveBeenCalled();
    expect(createRequest).not.toHaveBeenCalled();
    vi.setSystemTime(new Date('2026-09-12T14:00:00Z'));
    reader.activate(600);
    reader.deactivate();
    await vi.advanceTimersByTimeAsync(600);
    expect(load).not.toHaveBeenCalled();
    await activate(reader);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]![0].context.occurredAt).toBe('2026-09-12T14:00:00.600Z');
    expect(reader.getSnapshot().status).toBe('ready');
  });

  it('cannot resurrect A after A → B → A or bind a delayed error to the new view', async () => {
    const late = deferred<PredictionPageResult>();
    const a = makeReader(vi.fn(() => late.promise));
    await activate(a.reader);
    const oldRequest = a.load.mock.calls[0]![0];
    a.reader.deactivate();
    const b = makeReader(undefined, { ...scope, profileId: id(4) });
    await activate(b.reader);
    b.reader.deactivate();
    const returned = deferred<PredictionPageResult>();
    const newA = makeReader(vi.fn(() => returned.promise));
    await activate(newA.reader);
    expect(newA.reader.getSnapshot().viewId).not.toBe(a.reader.getSnapshot().viewId);
    late.resolve(success(oldRequest)); await settle();
    expect(a.reader.getSnapshot().items).toEqual([]);
    expect(newA.reader.getSnapshot().items).toEqual([]);
    returned.resolve({ status: 'error', message: 'offline', recovery: 'retry' }); await settle();
    expect(newA.reader.getSnapshot()).toMatchObject({ status: 'error', items: [], pages: [] });
  });

  it.each([{ actorUserId: id(8) }, { environment: 'https://other.invalid' }, { sessionId: id(9) }, { revision: 'changed' }])(
    'isolates delayed catalog-enriched results across a scope change %#', async change => {
      const enrichment = deferred<PredictionPageResult>();
      const old = makeReader(vi.fn(() => enrichment.promise));
      await activate(old.reader);
      old.reader.deactivate();
      const next = makeReader(undefined, { ...scope, ...change });
      await activate(next.reader);
      const accepted = next.reader.getSnapshot();
      enrichment.resolve(success(old.load.mock.calls[0]![0])); await settle();
      expect(next.reader.getSnapshot()).toBe(accepted);
      expect(old.reader.getSnapshot().items).toEqual([]);
    });
});

describe('exact request retry and bounded append', () => {
  it('bounds an unanswered first page and retries the original request instead of leaving loading stuck', async () => {
    const late = deferred<PredictionPageResult>();
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockImplementationOnce(() => late.promise).mockImplementation(async r => success(r));
    const { reader, createRequest } = makeReader(load);
    await activate(reader);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(reader.getSnapshot().status).toBe('loading');
    await vi.advanceTimersByTimeAsync(1);
    expect(reader.getSnapshot()).toMatchObject({ status: 'error', recovery: 'retry', items: [], pages: [] });
    expect(load.mock.calls[0]![1].aborted).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    reader.retry(); await settle();
    expect(load.mock.calls[1]![0]).toBe(load.mock.calls[0]![0]);
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[1]![1].aborted).toBe(false);
    const accepted = reader.getSnapshot();
    late.resolve(success(load.mock.calls[0]![0])); await settle();
    expect(reader.getSnapshot()).toBe(accepted);
    reader.deactivate();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out an append while retaining its prefix and rejects a late response before retry', async () => {
    const late = deferred<PredictionPageResult>();
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockImplementationOnce(async r => success(r)).mockImplementationOnce(() => late.promise)
      .mockImplementation(async r => success(r, 2));
    const { reader } = makeReader(load);
    await activate(reader);
    const prefix = reader.getSnapshot();
    expect(vi.getTimerCount()).toBe(0);
    reader.loadMore();
    await vi.advanceTimersByTimeAsync(15_000);
    const failed = reader.getSnapshot();
    expect(failed).toMatchObject({ status: 'error', recovery: 'retry' });
    expect(failed.pages).toBe(prefix.pages);
    expect(failed.predictionIds).toBe(prefix.predictionIds);
    late.resolve(success(load.mock.calls[1]![0], 2)); await settle();
    expect(reader.getSnapshot()).toBe(failed);
    reader.retry(); reader.retry(); await settle();
    expect(load).toHaveBeenCalledTimes(3);
    expect(load.mock.calls[2]![0]).toBe(load.mock.calls[1]![0]);
    expect(reader.getSnapshot().pages).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts on blur and leaves no deadline or error that can affect another activation', async () => {
    const abandoned = deferred<PredictionPageResult>();
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockImplementationOnce(() => abandoned.promise).mockImplementation(async r => success(r));
    const { reader } = makeReader(load);
    await activate(reader);
    const before = reader.getSnapshot();
    reader.deactivate(); await settle();
    expect(load.mock.calls[0]![1].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(reader.getSnapshot()).toBe(before);
    await activate(reader);
    expect(load.mock.calls[1]![0]).toBe(load.mock.calls[0]![0]);
    expect(reader.getSnapshot().status).toBe('ready');
    expect(load.mock.calls[1]![1].aborted).toBe(false);
  });

  it('cancels a replaced attempt without letting its deadline cancel the new window', async () => {
    const old = deferred<PredictionPageResult>();
    const fresh = deferred<PredictionPageResult>();
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockImplementationOnce(() => old.promise).mockImplementationOnce(() => fresh.promise);
    const { reader } = makeReader(load);
    await activate(reader);
    await vi.advanceTimersByTimeAsync(10_000);
    reader.refresh(); await settle();
    expect(load.mock.calls[0]![1].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(load.mock.calls[1]![1].aborted).toBe(false);
    expect(reader.getSnapshot().status).toBe('loading');
    fresh.resolve(success(load.mock.calls[1]![0], 1, id(90))); await settle();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(reader.getSnapshot().pages[0]!.sourcePredictionId).toBe(id(90));
    expect(load.mock.calls[1]![1].aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('requires explicit fresh search after server-proven expiry and preserves old delivery evidence', async () => {
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockImplementationOnce(async r => success(r))
      .mockImplementationOnce(r => loadPredictionPage(async () => ({ data: null,
        error: { code: '22023', message: 'Continuation window expired' } }), r))
      .mockImplementation(async r => success(r, 1, id(90)));
    const { reader } = makeReader(load);
    await activate(reader);
    const original = reader.getSnapshot();
    await vi.advanceTimersByTimeAsync(16 * 60_000);
    reader.loadMore(); await settle();
    expect(reader.getSnapshot()).toMatchObject({ status: 'error', recovery: 'refresh' });
    expect(reader.getSnapshot().items).toBe(original.items);
    reader.retry(); reader.loadMore(); await settle();
    expect(load).toHaveBeenCalledTimes(2);
    reader.refresh(); await settle();
    const fresh = load.mock.calls[2]![0];
    expect(fresh.requestId).not.toBe(original.pages[0]!.request.requestId);
    expect(fresh.cursor).toBeNull();
    expect(fresh.context.occurredAt).toBe('2026-09-12T12:16:00.000Z');
    expect(original.predictionIds[id(52)]).toBe(id(10));
    expect(reader.getSnapshot().predictionIds[id(52)]).toBe(id(90));
    expect(reader.getSnapshot().recovery).toBeNull();
  });

  it('retries first-page failure with the same immutable request and context', async () => {
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockResolvedValueOnce({ status: 'error', message: 'offline', recovery: 'retry' }).mockImplementation(async r => success(r));
    const { reader, createRequest } = makeReader(load);
    await activate(reader);
    vi.setSystemTime(new Date('2026-09-12T12:10:00Z'));
    reader.retry(); await settle();
    expect(load.mock.calls[1]![0]).toBe(load.mock.calls[0]![0]);
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(reader.getSnapshot().status).toBe('ready');
  });

  it('preserves page origins, duplicate-tap safety and the exact failed next request', async () => {
    const pending = deferred<PredictionPageResult>();
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockImplementationOnce(async r => success(r)).mockImplementationOnce(() => pending.promise)
      .mockImplementation(async r => success(r, 2));
    const { reader } = makeReader(load);
    await activate(reader);
    const first = reader.getSnapshot();
    reader.loadMore(); reader.loadMore(); reader.loadMore();
    expect(load).toHaveBeenCalledTimes(2);
    expect(reader.getSnapshot().items).toBe(first.items);
    pending.resolve({ status: 'error', message: 'network', recovery: 'retry' }); await settle();
    reader.loadMore(); expect(load).toHaveBeenCalledTimes(2);
    reader.retry(); await settle();
    expect(load.mock.calls[2]![0]).toBe(load.mock.calls[1]![0]);
    expect(load.mock.calls[1]![0].context).toBe(load.mock.calls[0]![0].context);
    expect(reader.getSnapshot().items.map(item => item.id)).toEqual([52, 53, 54, 55].map(id));
    expect(reader.getSnapshot().predictionIds).toEqual({ [id(52)]: id(10), [id(53)]: id(10), [id(54)]: id(12), [id(55)]: id(12) });
    expect(first.items).toHaveLength(2);
  });

  it('keeps an empty terminal run without erasing previous pages or fetching again', async () => {
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockImplementationOnce(async r => success(r)).mockImplementation(async r => success(r, 2, id(10), []));
    const { reader } = makeReader(load);
    await activate(reader);
    reader.loadMore(); await settle();
    expect(reader.getSnapshot().items).toHaveLength(2);
    expect(reader.getSnapshot().pages.at(-1)).toMatchObject({ availability: 'WINDOW_EXHAUSTED',
      ranking: { predictionId: id(12), items: [] }, nextCursor: null });
    reader.loadMore(); reader.retry(); await settle();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('resumes an interrupted delivery with the same request and ignores the earlier reply', async () => {
    const old = deferred<PredictionPageResult>(); const resumed = deferred<PredictionPageResult>();
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockImplementationOnce(() => old.promise).mockImplementationOnce(() => resumed.promise);
    const { reader } = makeReader(load);
    await activate(reader); reader.deactivate(); await activate(reader);
    expect(load.mock.calls[0]![0]).toBe(load.mock.calls[1]![0]);
    old.resolve(success(load.mock.calls[0]![0])); await settle();
    expect(reader.getSnapshot().items).toEqual([]);
    resumed.resolve(success(load.mock.calls[1]![0])); await settle();
    expect(reader.getSnapshot().pages).toHaveLength(1);
  });

  it('explicit refresh replaces the window; an older next-page completion cannot append', async () => {
    const late = deferred<PredictionPageResult>();
    const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
      .mockImplementationOnce(async r => success(r)).mockImplementationOnce(() => late.promise)
      .mockImplementation(async r => success(r, 1, id(90)));
    const { reader, createRequest } = makeReader(load);
    await activate(reader); const oldView = reader.getSnapshot().viewId;
    reader.loadMore(); reader.refresh(); await settle();
    expect(reader.getSnapshot().viewId).not.toBe(oldView);
    expect(createRequest).toHaveBeenCalledTimes(2);
    late.resolve(success(load.mock.calls[1]![0], 2)); await settle();
    expect(reader.getSnapshot().pages).toHaveLength(1);
    expect(reader.getSnapshot().pages[0]!.sourcePredictionId).toBe(id(90));
  });

  it.each(['source', 'index', 'features', 'count', 'run', 'duplicate', 'cursor'] as const)(
    'rejects a mismatched %s while retaining the accepted prefix', async defect => {
      const load = vi.fn<(r: PredictionPageRequest, signal: AbortSignal) => Promise<PredictionPageResult>>()
        .mockImplementationOnce(async r => success(r)).mockImplementation(async r => {
          const result = success(r, 2);
          if (result.status !== 'success') throw new Error('Expected page');
          if (defect === 'source') result.sourcePredictionId = id(80);
          if (defect === 'index') result.pageIndex = 3;
          if (defect === 'features') result.featureAt = '2026-09-12T12:00:01+00:00';
          if (defect === 'count') result.candidateCount = 17;
          if (defect === 'run') result.ranking.predictionId = id(10);
          if (defect === 'duplicate') result.ranking.items[0]!.id = id(52);
          if (defect === 'cursor') result.nextCursor = id(31);
          return result;
        });
      const { reader } = makeReader(load);
      await activate(reader); const before = reader.getSnapshot();
      reader.loadMore(); await settle();
      expect(reader.getSnapshot().status).toBe('error');
      expect(reader.getSnapshot().pages).toBe(before.pages);
      expect(reader.getSnapshot().items).toBe(before.items);
    });
});
