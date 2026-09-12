import type { Context, DiscoveryMode, ItemType, ProfileId, SessionId } from '../../domain/contracts';
import { mapPredictionRows, type PredictionRanking, type PredictionRpcResponse } from './predictionOperations';

export const PREDICTION_PAGE_V1_RPC = 'rank_items_page_v1';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export interface PredictionPageRequest {
  readonly version: 1 | 2;
  readonly requestId: string;
  readonly profileId: ProfileId;
  readonly sessionId: SessionId;
  readonly discoveryMode: DiscoveryMode;
  readonly itemType: ItemType;
  readonly limit: number;
  readonly context: Readonly<Omit<Context, 'sessionId'>>;
  readonly cursor: string | null;
}

// Create once per logical request and retain this object across transport retries.
export function createPredictionPageRequest(input: {
  requestId: string; profileId: ProfileId; sessionId: SessionId;
  mode: DiscoveryMode; itemType: ItemType; limit?: number; context?: Omit<Context, 'sessionId'>;
  version?: 1 | 2;
}): PredictionPageRequest {
  const limit = input.limit ?? 20;
  if (![input.requestId, input.profileId, input.sessionId].every(isUuid) ||
    !Number.isInteger(limit) || limit < 1 || limit > 50 ||
    !['FOR_YOU', 'SURPRISE', 'RISK'].includes(input.mode) || !['BOOK', 'MOVIE'].includes(input.itemType) ||
    (input.version !== undefined && input.version !== 1 && input.version !== 2)) {
    throw new Error('Invalid prediction page scope');
  }
  const context = input.context ?? {};
  if (!record(context) || Object.keys(context).some(key => !['locale', 'timezone', 'occurredAt', 'attributes'].includes(key)) ||
    (['locale', 'timezone', 'occurredAt'] as const).some(key => key in context && typeof context[key] !== 'string') ||
    (context.attributes !== undefined && (!record(context.attributes) || Object.values(context.attributes).some(value =>
      value !== null && typeof value !== 'string' && typeof value !== 'boolean' &&
      (typeof value !== 'number' || !Number.isFinite(value)))))) throw new Error('Invalid prediction page context');
  const request: PredictionPageRequest = Object.freeze({
    version: input.version ?? 2, requestId: input.requestId.toLowerCase(), profileId: input.profileId.toLowerCase(),
    sessionId: input.sessionId.toLowerCase(), discoveryMode: input.mode, itemType: input.itemType, limit,
    context: Object.freeze({
      ...(context.locale ? { locale: context.locale } : {}),
      ...(context.timezone ? { timezone: context.timezone } : {}),
      ...(context.occurredAt ? { occurredAt: context.occurredAt } : {}),
      ...(context.attributes ? { attributes: Object.freeze({ ...context.attributes }) } : {}),
    }), cursor: null,
  });
  // Count UTF-8 bytes without requiring a native TextEncoder polyfill. Leave
  // room for Postgres jsonb whitespace and the later UUID cursor.
  if (encodeURIComponent(JSON.stringify(request)).replace(/%[0-9A-F]{2}/g, '_').length > 8000) {
    throw new Error('Prediction page context too large');
  }
  return request;
}

export function createNextPredictionPageRequest(page: PredictionPage, requestId: string): PredictionPageRequest {
  if (page.request.version !== 2 || !isUuid(page.nextCursor) || !isUuid(requestId) ||
    requestId.toLowerCase() === page.request.requestId) throw new Error('Invalid prediction continuation');
  return Object.freeze({ ...page.request, requestId: requestId.toLowerCase(), cursor: page.nextCursor });
}

export type PredictionPageRpc = (name: typeof PREDICTION_PAGE_V1_RPC,
  arguments_: { request: PredictionPageRequest }) => Promise<PredictionRpcResponse>;

export type PredictionAvailability = 'ITEMS' | 'WINDOW_EXHAUSTED' | 'CATALOG_EMPTY';
export interface PredictionPage {
  status: 'success'; request: PredictionPageRequest; ranking: PredictionRanking;
  availability: PredictionAvailability; continuationSupported: boolean; nextCursor: string | null;
  candidateCount: number; sourcePredictionId: string; pageIndex: number; featureAt: string | null;
}
export type PredictionPageResult =
  | PredictionPage
  | { status: 'error'; message: string };

const pageError = (): PredictionPageResult => ({ status: 'error',
  message: 'Suositusten päivittäminen epäonnistui. Yritä uudelleen.' });

export async function loadPredictionPage(rpc: PredictionPageRpc, request: PredictionPageRequest): Promise<PredictionPageResult> {
  try {
    const response = await rpc(PREDICTION_PAGE_V1_RPC, { request });
    if (response.error) return pageError();
    return mapPredictionPage(response.data, request);
  } catch { return pageError(); }
}

export function mapPredictionPage(data: unknown, request: PredictionPageRequest): PredictionPageResult {
  if (!record(data) || data.version !== request.version || !isUuid(data.predictionId) ||
    data.requestId !== request.requestId || data.profileId !== request.profileId ||
    data.sessionId !== request.sessionId || data.discoveryMode !== request.discoveryMode ||
    data.itemType !== request.itemType || !Array.isArray(data.items) || data.items.length > request.limit ||
    data.continuationSupported !== (request.version === 2) || !record(data.source)) return pageError();
  const items = data.items;
  const source = data.source;
  if (source.version !== (request.version === 2 ? 'frozen-page-v1' : 'eligibility-first-v1') || typeof source.candidateCount !== 'number' ||
    !Number.isInteger(source.candidateCount) || source.candidateCount < data.items.length ||
    source.candidateCount > Math.min(50, request.limit * 3) || source.resultCount !== data.items.length ||
    source.catalogEmpty !== (data.availability === 'CATALOG_EMPTY')) return pageError();
  if (data.availability !== 'ITEMS' && data.availability !== 'WINDOW_EXHAUSTED' && data.availability !== 'CATALOG_EMPTY') return pageError();
  if ((data.availability === 'ITEMS') !== (data.items.length > 0) ||
    (data.availability === 'CATALOG_EMPTY' && (source.candidateCount !== 0 || request.cursor !== null))) return pageError();
  if (request.version === 1) {
    if (request.cursor !== null || data.nextCursor !== null) return pageError();
  } else {
    if ((data.nextCursor !== null && (!isUuid(data.nextCursor) || data.nextCursor === request.cursor || items.length === 0)) ||
      !isUuid(source.sourcePredictionId) || typeof source.pageIndex !== 'number' ||
      !Number.isInteger(source.pageIndex) || source.pageIndex < 1 || source.pageIndex > 51 ||
      typeof source.featureAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(source.featureAt) || !Number.isFinite(Date.parse(source.featureAt)) ||
      (request.cursor === null ? source.pageIndex !== 1 || source.sourcePredictionId !== data.predictionId
        : source.pageIndex < 2 || source.sourcePredictionId === data.predictionId) ||
      (data.nextCursor !== null && source.candidateCount <= items.length)) return pageError();
  }

  let ranking: PredictionRanking;
  if (data.items.length === 0) {
    // Only the identified envelope can turn zero rows into a successful run.
    ranking = { predictionId: data.predictionId, items: [], predictions: [] };
  } else {
    if (data.items.some((row, index) => !record(row) || row.prediction_id !== data.predictionId ||
      !isUuid(row.item_id) || row.item_type !== request.itemType ||
      row.rank !== index + 1)) return pageError();
    const mapped = mapPredictionRows(data.items, request.profileId, request.discoveryMode);
    if (mapped.status !== 'success') return pageError();
    ranking = mapped.ranking;
  }
  return { status: 'success', request, ranking, availability: data.availability,
    continuationSupported: request.version === 2, nextCursor: data.nextCursor as string | null,
    candidateCount: source.candidateCount,
    sourcePredictionId: request.version === 2 ? source.sourcePredictionId as string : data.predictionId,
    pageIndex: request.version === 2 ? source.pageIndex as number : 1,
    featureAt: request.version === 2 ? source.featureAt as string : null };
}
