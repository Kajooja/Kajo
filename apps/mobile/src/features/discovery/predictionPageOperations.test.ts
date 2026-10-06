import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createNextPredictionPageRequest, createPredictionPageRequest, loadCatalogPredictionPage, loadPredictionPage, mapPredictionPage, PREDICTION_PAGE_V1_RPC } from './predictionPageOperations';

const id = (n: number) => `a2290000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const request = createPredictionPageRequest({ requestId: id(1), profileId: id(2), sessionId: id(3),
  mode: 'FOR_YOU', itemType: 'BOOK', limit: 6, version: 1 });
const row = (n: number) => ({ prediction_id: id(4), item_id: id(n + 10), item_type: 'BOOK',
  title: `Book ${n}`, description: null, tags: ['quiet'], score: 0.8, confidence: 0.7, rank: n });
const page = () => ({ version: 1, requestId: request.requestId, profileId: request.profileId,
  sessionId: request.sessionId, discoveryMode: request.discoveryMode, itemType: request.itemType,
  predictionId: id(4), items: [row(1), row(2)], availability: 'ITEMS', nextCursor: null,
  continuationSupported: false, source: { version: 'eligibility-first-v1', candidateCount: 18, resultCount: 2, catalogEmpty: false } });

describe('Identified prediction page boundary', () => {
  it('preserves exact scope and per-Item run identity', () => {
    const result = mapPredictionPage(page(), request);
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('Expected page');
    expect(result.ranking.predictionId).toBe(id(4));
    expect(result.ranking.items.map(item => item.id)).toEqual([id(11), id(12)]);
    expect(result.ranking.predictions.every(p => p.predictionId === id(4) && p.profileId === id(2))).toBe(true);
    expect(result.continuationSupported).toBe(false);
  });

  it.each(['WINDOW_EXHAUSTED', 'CATALOG_EMPTY'])('accepts identified %s without inventing a run', availability => {
    const empty = { ...page(), items: [], availability, source: { version: 'eligibility-first-v1',
      candidateCount: availability === 'CATALOG_EMPTY' ? 0 : 18, resultCount: 0, catalogEmpty: availability === 'CATALOG_EMPTY' } };
    expect(mapPredictionPage(empty, request)).toMatchObject({ status: 'success', availability,
      ranking: { predictionId: id(4), items: [], predictions: [] } });
    expect(mapPredictionPage([], request).status).toBe('error');
  });

  it.each(['requestId', 'profileId', 'sessionId', 'discoveryMode', 'itemType'])('rejects mismatched %s', key => {
    expect(mapPredictionPage({ ...page(), [key]: id(99) }, request).status).toBe('error');
  });

  it.each([
    { version: 2 }, { predictionId: '' }, { items: [] }, { availability: 'CATALOG_EMPTY' },
    { continuationSupported: true }, { nextCursor: 'unsupported' }, { source: null },
    { items: [row(1), row(1)] }, { items: [row(2), row(1)] },
    { items: [row(1), { ...row(2), item_id: row(1).item_id }] },
    { items: [row(1), { ...row(2), prediction_id: id(99) }] },
    { items: [row(1), { ...row(2), item_type: 'MOVIE' }] },
    { items: [row(1), { ...row(2), score: NaN }] },
  ])('rejects malformed or ambiguous page %#', change => {
    expect(mapPredictionPage({ ...page(), ...change }, request).status).toBe('error');
  });

  it('checks source counts, limits and availability together', () => {
    for (const change of [{ candidateCount: -1 }, { candidateCount: 19 }, { candidateCount: 1 },
      { resultCount: 0 }, { catalogEmpty: true }, { version: 'unknown' }]) {
      expect(mapPredictionPage({ ...page(), source: { ...page().source, ...change } }, request).status).toBe('error');
    }
    const oversized = { ...page(), items: Array.from({ length: 7 }, (_, i) => row(i + 1)),
      source: { ...page().source, resultCount: 7 } };
    expect(mapPredictionPage(oversized, request).status).toBe('error');
  });

  it('freezes captured request/context for exact retries and later caller mutations', async () => {
    const context = { locale: 'fi-FI', attributes: { localHour: 12 } };
    const input = { requestId: id(1), profileId: id(2), sessionId: id(3), mode: 'FOR_YOU' as const, itemType: 'BOOK' as const, version: 1 as const, context };
    const captured = createPredictionPageRequest(input);
    input.profileId = id(99); context.attributes.localHour = 22;
    const rpc = vi.fn().mockResolvedValueOnce({ error: { message: 'offline' }, data: null })
      .mockResolvedValueOnce({ error: null, data: page() });
    expect((await loadPredictionPage(rpc, captured)).status).toBe('error');
    expect((await loadPredictionPage(rpc, captured)).status).toBe('success');
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc).toHaveBeenCalledWith(PREDICTION_PAGE_V1_RPC, { request: captured });
    expect(captured.profileId).toBe(id(2));
    expect(captured.context.attributes?.localHour).toBe(12);
    expect(Object.isFrozen(captured.context.attributes)).toBe(true);
  });

  it('keeps transport, authorization and malformed responses as errors', async () => {
    for (const rpc of [vi.fn().mockRejectedValue(new Error('private detail')),
      vi.fn().mockResolvedValue({ data: page(), error: { message: 'denied' } }),
      vi.fn().mockResolvedValue({ data: null, error: null })]) {
      expect(await loadPredictionPage(rpc, request)).toEqual({ status: 'error',
        message: 'Suositusten päivittäminen epäonnistui. Yritä uudelleen.', recovery: 'retry' });
    }
  });

  it.each(['Continuation window expired', 'Continuation source expired', 'Continuation cursor unavailable',
    'Continuation cursor already consumed', 'Continuation source changed'])(
    'offers fresh search for the exact server failure %s', async message => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '22023', message } });
      expect(await loadPredictionPage(rpc, request)).toEqual({ status: 'error', recovery: 'refresh',
        message: 'Tätä hakua ei voi enää jatkaa. Aloita uusi haku.' });
      expect(rpc).toHaveBeenCalledTimes(1);
    });

  it('does not mistake a transport, permission or unknown protocol error for proven expiry', async () => {
    for (const error of [{ code: '42501', message: 'Profile access denied' },
      { code: '22023', message: 'Continuation request scope mismatch' },
      { code: '22023', message: 'private unexpected detail' },
      { message: 'Continuation window expired' }, { code: '08006', message: 'Continuation window expired' }]) {
      expect(await loadPredictionPage(async () => ({ data: null, error }), request))
        .toEqual({ status: 'error', recovery: 'retry',
          message: 'Suositusten päivittäminen epäonnistui. Yritä uudelleen.' });
    }
  });

  it('keeps the failed request retryable when the active-window capacity is full', async () => {
    expect(await loadPredictionPage(async () => ({ data: null,
      error: { code: '54000', message: 'Too many active continuation windows' } }), request))
      .toEqual({ status: 'error', recovery: 'retry',
        message: 'Hakuja on tehty paljon lyhyessä ajassa. Odota hetki ja yritä uudelleen.' });
  });
});

describe('configured page transport and catalog cancellation', () => {
  // A single signature preserves URL inputs when Vitest wraps the DOM/native
  // fetch overloads; the mock still has to satisfy the actual SDK transport.
  type FetchTransport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  function clientWith(fetcher: typeof fetch) {
    return createClient('https://fixture.invalid', 'public-fixture-key', {
      global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  it('passes the same signal through the actual SDK RPC and metadata fetch, preserving ranks and identity', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<FetchTransport>().mockResolvedValueOnce(response(page()))
      .mockResolvedValueOnce(response([{
        id: id(12), item_type: 'BOOK', title: 'Enriched second book', description: null,
        tags: ['quiet'], creators: ['Author'], release_year: 2020, image_url: 'https://fixture.invalid/cover', original_language: 'fi',
      }]));
    const result = await loadCatalogPredictionPage(clientWith(fetcher), request, controller.signal);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0]![0])).toContain('/rest/v1/rpc/rank_items_page_v1');
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({ request });
    expect(String(fetcher.mock.calls[1]![0])).toContain('/rest/v1/items?');
    expect(fetcher.mock.calls.every(([, init]) => init?.signal === controller.signal)).toBe(true);
    expect(result).toMatchObject({ status: 'success', request, ranking: { predictionId: id(4) } });
    if (result.status !== 'success') throw new Error('Expected page');
    expect(result.ranking.items.map(item => item.id)).toEqual([id(11), id(12)]);
    expect(result.ranking.items.map(item => item.title)).toEqual(['Book 1', 'Enriched second book']);
  });

  it.each(['before', 'after-rpc'] as const)('skips subsequent work when cancelled %s', async stage => {
    const controller = new AbortController();
    const fetcher = vi.fn<FetchTransport>().mockImplementation(async () => {
      controller.abort();
      return response(page());
    });
    if (stage === 'before') controller.abort();
    expect((await loadCatalogPredictionPage(clientWith(fetcher), request, controller.signal)).status).toBe('error');
    expect(fetcher).toHaveBeenCalledTimes(stage === 'before' ? 0 : 1);
  });

  it('cancels a pending metadata fetch without publishing the delivered response as a completed load', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<FetchTransport>().mockResolvedValueOnce(response(page()))
      .mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
      }));
    const pending = loadCatalogPredictionPage(clientWith(fetcher), request, controller.signal);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    controller.abort();
    expect(await pending).toMatchObject({ status: 'error', recovery: 'retry' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('preserves the identified ranking if only metadata fails', async () => {
    const fetcher = vi.fn<FetchTransport>().mockResolvedValueOnce(response(page()))
      .mockResolvedValueOnce(response({ message: 'Metadata unavailable', code: '42501' }, 403));
    const result = await loadCatalogPredictionPage(clientWith(fetcher), request, new AbortController().signal);
    expect(result).toMatchObject({ status: 'success', ranking: { predictionId: id(4) } });
    if (result.status !== 'success') throw new Error('Expected page');
    expect(result.ranking.items.map(item => item.title)).toEqual(['Book 1', 'Book 2']);
  });

  it('retains SQL error codes through the configured SDK boundary without requesting metadata', async () => {
    const fetcher = vi.fn<FetchTransport>().mockResolvedValueOnce(response({
      code: '22023', message: 'Continuation window expired', details: 'private', hint: 'private',
    }, 400));
    const result = await loadCatalogPredictionPage(clientWith(fetcher), request, new AbortController().signal);
    expect(result).toEqual({ status: 'error', recovery: 'refresh',
      message: 'Tätä hakua ei voi enää jatkaa. Aloita uusi haku.' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('Protocol 2 continuation boundary', () => {
  const rootRequest = createPredictionPageRequest({ requestId: id(1), profileId: id(2), sessionId: id(3),
    mode: 'FOR_YOU', itemType: 'BOOK', limit: 6, context: { occurredAt: '2026-09-12T12:00:00.000Z' } });
  const root = () => ({ ...page(), version: 2, nextCursor: id(5), continuationSupported: true,
    source: { version: 'frozen-page-v1', candidateCount: 18, resultCount: 2, catalogEmpty: false,
      sourcePredictionId: id(4), pageIndex: 1, featureAt: '2026-09-12T12:00:00+00:00' } });
  const nextRequest = () => {
    const first = mapPredictionPage(root(), rootRequest);
    if (first.status !== 'success') throw new Error('Expected first page');
    return createNextPredictionPageRequest(first, id(6));
  };
  const later = () => ({ ...root(), requestId: id(6), predictionId: id(7), nextCursor: id(8),
    items: [1, 2].map(n => ({ ...row(n), item_id: id(n + 20), prediction_id: id(7) })),
    source: { ...root().source, pageIndex: 2 } });

  it('opts in explicitly and carries the exact frozen scope/context into the next request', () => {
    expect(rootRequest.version).toBe(2);
    const next = nextRequest();
    expect(next).toEqual({ ...rootRequest, requestId: id(6), cursor: id(5) });
    expect(next.context).toBe(rootRequest.context);
    expect(Object.isFrozen(next)).toBe(true);
    expect(mapPredictionPage(later(), next)).toMatchObject({ status: 'success', pageIndex: 2,
      sourcePredictionId: id(4), nextCursor: id(8), ranking: { predictionId: id(7) } });
  });

  it.each([
    { version: 1 }, { continuationSupported: false }, { nextCursor: 'invalid' }, { nextCursor: undefined },
    { items: [] }, { items: [{ ...row(1), rank: 2 }] },
  ])('rejects a malformed v2 envelope %#', change => {
    expect(mapPredictionPage({ ...root(), ...change }, rootRequest).status).toBe('error');
  });

  it.each([
    { version: 'eligibility-first-v1' }, { sourcePredictionId: id(99) }, { sourcePredictionId: null },
    { pageIndex: 0 }, { pageIndex: 2 }, { pageIndex: 1.5 }, { featureAt: null }, { featureAt: '2026-99-99Tbad' },
  ])('rejects incorrect first-page lineage %#', change => {
    expect(mapPredictionPage({ ...root(), source: { ...root().source, ...change } }, rootRequest).status).toBe('error');
  });

  it('rejects a cursor loop, reused source run and false later catalog emptiness', () => {
    const next = nextRequest();
    expect(mapPredictionPage({ ...later(), nextCursor: next.cursor }, next).status).toBe('error');
    expect(mapPredictionPage({ ...later(), source: { ...later().source, sourcePredictionId: id(7) } }, next).status).toBe('error');
    expect(mapPredictionPage({ ...later(), items: [], nextCursor: null, availability: 'CATALOG_EMPTY',
      source: { ...later().source, candidateCount: 0, resultCount: 0, catalogEmpty: true } }, next).status).toBe('error');
  });

  it('retains an empty terminal page as its own run', () => {
    const result = mapPredictionPage({ ...later(), items: [], nextCursor: null, availability: 'WINDOW_EXHAUSTED',
      source: { ...later().source, resultCount: 0 } }, nextRequest());
    expect(result).toMatchObject({ status: 'success', pageIndex: 2, availability: 'WINDOW_EXHAUSTED',
      ranking: { predictionId: id(7), items: [], predictions: [] } });
    if (result.status !== 'success') throw new Error('Expected empty page');
    expect(() => createNextPredictionPageRequest(result, id(9))).toThrow();
  });

  it('accepts a genuine empty initial catalog without manufacturing a cursor', () => {
    expect(mapPredictionPage({ ...root(), items: [], nextCursor: null, availability: 'CATALOG_EMPTY',
      source: { ...root().source, candidateCount: 0, resultCount: 0, catalogEmpty: true } }, rootRequest))
      .toMatchObject({ status: 'success', availability: 'CATALOG_EMPTY', nextCursor: null });
  });

  it('rejects invalid/nested and oversized contexts before transport', () => {
    for (const context of [{ sessionId: id(3) }, { attributes: { nested: {} } }, { attributes: { invalid: Infinity } },
      { locale: 'ä'.repeat(8000) }]) {
      expect(() => createPredictionPageRequest({ requestId: id(1), profileId: id(2), sessionId: id(3),
        mode: 'FOR_YOU', itemType: 'BOOK', context: context as never })).toThrow();
    }
  });
});

describe('Protocol 3 catalog-chain boundary', () => {
  const chainId = id(200);
  const rootPredictionId = id(201);
  const rootRequest = createPredictionPageRequest({ requestId: id(202), profileId: id(2), sessionId: id(3),
    mode: 'FOR_YOU', itemType: 'BOOK', limit: 40, version: 3,
    context: { occurredAt: '2026-10-06T13:00:00.000Z', attributes: { localHour: 16 } } });
  const root = () => ({ ...page(), version: 3, requestId: rootRequest.requestId, predictionId: rootPredictionId,
    nextCursor: id(203), continuationSupported: true,
    items: Array.from({ length: 40 }, (_, index) => ({ ...row(index + 1), prediction_id: rootPredictionId })),
    source: { version: 'catalog-chain-v1', candidateCount: 50, resultCount: 40, catalogEmpty: false,
      sourcePredictionId: rootPredictionId, rootPredictionId, parentPredictionId: null, chainId,
      pageIndex: 1, featureAt: '2026-10-06T13:00:00+00:00', seenCount: 40, chainLimit: 1000,
      continuationState: 'MORE' } });
  const nextRequest = () => {
    const first = mapPredictionPage(root(), rootRequest);
    if (first.status !== 'success') throw new Error('Expected catalog-chain root');
    return createNextPredictionPageRequest(first, id(204));
  };
  const later = () => ({ ...root(), requestId: id(204), predictionId: id(205), nextCursor: id(206),
    items: Array.from({ length: 40 }, (_, index) => ({ ...row(index + 1),
      prediction_id: id(205), item_id: id(index + 1000) })),
    source: { ...root().source, sourcePredictionId: id(205), parentPredictionId: rootPredictionId,
      pageIndex: 2, featureAt: '2026-10-06T13:01:00+00:00', candidateCount: 45, seenCount: 80 } });

  it('explicitly opts in and carries the original captured scope through the opaque cursor', async () => {
    expect(createPredictionPageRequest({ requestId: id(1), profileId: id(2), sessionId: id(3),
      mode: 'FOR_YOU', itemType: 'BOOK' }).version).toBe(2);
    const first = mapPredictionPage(root(), rootRequest);
    expect(first).toMatchObject({ status: 'success', sourcePredictionId: rootPredictionId, rootPredictionId,
      parentPredictionId: null, chainId, seenCount: 40, chainLimit: 1000, continuationState: 'MORE' });
    const next = nextRequest();
    expect(next).toEqual({ ...rootRequest, requestId: id(204), cursor: id(203) });
    expect(next.context).toBe(rootRequest.context);
    expect(Object.isFrozen(next)).toBe(true);
    const rpc = vi.fn().mockResolvedValue({ data: later(), error: null });
    expect(await loadPredictionPage(rpc, next)).toMatchObject({ status: 'success',
      sourcePredictionId: id(205), rootPredictionId, parentPredictionId: rootPredictionId,
      pageIndex: 2, featureAt: '2026-10-06T13:01:00+00:00', candidateCount: 45, seenCount: 80,
      ranking: { predictionId: id(205) } });
    expect(rpc).toHaveBeenCalledWith(PREDICTION_PAGE_V1_RPC, { request: next });
  });

  it.each([
    { version: 'frozen-page-v1' }, { chainId: null }, { chainId: 'invalid' },
    { sourcePredictionId: id(999) }, { rootPredictionId: id(999) }, { parentPredictionId: id(999) },
    { pageIndex: 0 }, { pageIndex: 2 }, { pageIndex: 1.5 }, { seenCount: 39 }, { seenCount: 41 },
    { seenCount: NaN }, { chainLimit: 999 }, { chainLimit: 1001 },
    { continuationState: 'unknown' }, { featureAt: null }, { featureAt: '2026-99-99Tbad' },
    { candidateCount: 51 }, { candidateCount: 39 }, { resultCount: 39 },
  ])('rejects malformed root lineage or counts %#', change => {
    expect(mapPredictionPage({ ...root(), source: { ...root().source, ...change } }, rootRequest).status).toBe('error');
  });

  it.each([
    { sourcePredictionId: rootPredictionId }, { rootPredictionId: id(205) }, { parentPredictionId: null },
    { parentPredictionId: id(205) }, { pageIndex: 1 }, { pageIndex: 1002 }, { seenCount: 39 },
  ])('rejects malformed later-page lineage %#', change => {
    expect(mapPredictionPage({ ...later(), source: { ...later().source, ...change } }, nextRequest()).status).toBe('error');
  });

  it('allows the final nonempty page to report catalog exhaustion without an extra empty fetch', () => {
    const terminal = { ...later(), nextCursor: null,
      source: { ...later().source, candidateCount: 40, continuationState: 'CATALOG_EXHAUSTED' } };
    const result = mapPredictionPage(terminal, nextRequest());
    expect(result).toMatchObject({ status: 'success', availability: 'ITEMS', nextCursor: null,
      continuationState: 'CATALOG_EXHAUSTED', seenCount: 80, ranking: { predictionId: id(205) } });
    if (result.status !== 'success') throw new Error('Expected final nonempty page');
    expect(result.ranking.items).toHaveLength(40);
    expect(() => createNextPredictionPageRequest(result, id(207))).toThrow();
  });

  it('distinguishes an empty domain from an exhausted nonempty catalog and the reader safety limit', () => {
    const empty = { ...root(), items: [], nextCursor: null, availability: 'CATALOG_EMPTY',
      source: { ...root().source, candidateCount: 0, resultCount: 0, catalogEmpty: true,
        seenCount: 0, continuationState: 'CATALOG_EXHAUSTED' } };
    expect(mapPredictionPage(empty, rootRequest)).toMatchObject({ status: 'success', availability: 'CATALOG_EMPTY',
      continuationState: 'CATALOG_EXHAUSTED', ranking: { predictionId: rootPredictionId, items: [] } });
    expect(mapPredictionPage({ ...empty, availability: 'CATALOG_EXHAUSTED',
      source: { ...empty.source, catalogEmpty: false } }, rootRequest))
      .toMatchObject({ status: 'success', availability: 'CATALOG_EXHAUSTED', seenCount: 0 });
    const exhausted = { ...later(), items: [], nextCursor: null, availability: 'CATALOG_EXHAUSTED',
      source: { ...later().source, candidateCount: 0, resultCount: 0, seenCount: 40,
        continuationState: 'CATALOG_EXHAUSTED' } };
    expect(mapPredictionPage(exhausted, nextRequest())).toMatchObject({ status: 'success',
      availability: 'CATALOG_EXHAUSTED', ranking: { predictionId: id(205), items: [] } });
    expect(mapPredictionPage({ ...later(), nextCursor: null, source: { ...later().source,
      candidateCount: 40, pageIndex: 25, seenCount: 1000, continuationState: 'READER_LIMIT' } }, nextRequest()))
      .toMatchObject({ status: 'success', availability: 'ITEMS', continuationState: 'READER_LIMIT',
        pageIndex: 25, seenCount: 1000 });
  });

  it('rejects false termination, cursor loops, duplicate Items and a later empty-domain claim', () => {
    const next = nextRequest();
    for (const changed of [
      { ...later(), nextCursor: next.cursor },
      { ...later(), nextCursor: null },
      { ...later(), source: { ...later().source, continuationState: 'CATALOG_EXHAUSTED' } },
      { ...later(), availability: 'WINDOW_EXHAUSTED' },
      { ...later(), items: [later().items[0], { ...later().items[1], item_id: later().items[0]!.item_id }],
        source: { ...later().source, resultCount: 2 } },
      { ...later(), items: [], nextCursor: null, availability: 'CATALOG_EMPTY',
        source: { ...later().source, candidateCount: 0, resultCount: 0, catalogEmpty: true,
          continuationState: 'CATALOG_EXHAUSTED' } },
    ]) expect(mapPredictionPage(changed, next).status).toBe('error');
  });
});
