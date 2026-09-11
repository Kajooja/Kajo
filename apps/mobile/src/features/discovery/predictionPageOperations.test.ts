import { describe, expect, it, vi } from 'vitest';
import { createPredictionPageRequest, loadPredictionPage, mapPredictionPage, PREDICTION_PAGE_V1_RPC } from './predictionPageOperations';

const id = (n: number) => `a2290000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const request = createPredictionPageRequest({ requestId: id(1), profileId: id(2), sessionId: id(3),
  mode: 'FOR_YOU', itemType: 'BOOK', limit: 6 });
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
    const input = { requestId: id(1), profileId: id(2), sessionId: id(3), mode: 'FOR_YOU' as const, itemType: 'BOOK' as const, context };
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
        message: 'Suositusten päivittäminen epäonnistui. Yritä uudelleen.' });
    }
  });
});
