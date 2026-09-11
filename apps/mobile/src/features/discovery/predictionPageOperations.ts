import type { Context, DiscoveryMode, ItemType, ProfileId, SessionId } from '../../domain/contracts';
import { mapPredictionRows, type PredictionRanking, type PredictionRpcResponse } from './predictionOperations';

export const PREDICTION_PAGE_V1_RPC = 'rank_items_page_v1';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export interface PredictionPageRequest {
  readonly version: 1;
  readonly requestId: string;
  readonly profileId: ProfileId;
  readonly sessionId: SessionId;
  readonly discoveryMode: DiscoveryMode;
  readonly itemType: ItemType;
  readonly limit: number;
  readonly context: Readonly<Omit<Context, 'sessionId'>>;
  readonly cursor: null;
}

// Create once per logical request and retain this object across transport retries.
// The active hook stays on the legacy RPC until server rollout/client activation.
export function createPredictionPageRequest(input: {
  requestId: string; profileId: ProfileId; sessionId: SessionId;
  mode: DiscoveryMode; itemType: ItemType; limit?: number; context?: Omit<Context, 'sessionId'>;
}): PredictionPageRequest {
  const limit = input.limit ?? 20;
  if (![input.requestId, input.profileId, input.sessionId].every(isUuid) ||
    !Number.isInteger(limit) || limit < 1 || limit > 50 ||
    !['FOR_YOU', 'SURPRISE', 'RISK'].includes(input.mode) || !['BOOK', 'MOVIE'].includes(input.itemType)) {
    throw new Error('Invalid prediction page scope');
  }
  const context = input.context ?? {};
  return Object.freeze({
    version: 1, requestId: input.requestId.toLowerCase(), profileId: input.profileId.toLowerCase(),
    sessionId: input.sessionId.toLowerCase(), discoveryMode: input.mode, itemType: input.itemType, limit,
    context: Object.freeze({
      ...(context.locale ? { locale: context.locale } : {}),
      ...(context.timezone ? { timezone: context.timezone } : {}),
      ...(context.occurredAt ? { occurredAt: context.occurredAt } : {}),
      ...(context.attributes ? { attributes: Object.freeze({ ...context.attributes }) } : {}),
    }), cursor: null,
  });
}

export type PredictionPageRpc = (name: typeof PREDICTION_PAGE_V1_RPC,
  arguments_: { request: PredictionPageRequest }) => Promise<PredictionRpcResponse>;

export type PredictionPageResult =
  | { status: 'success'; request: PredictionPageRequest; ranking: PredictionRanking;
      availability: 'ITEMS' | 'WINDOW_EXHAUSTED' | 'CATALOG_EMPTY';
      continuationSupported: false; nextCursor: null; candidateCount: number }
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
  if (!record(data) || data.version !== 1 || !isUuid(data.predictionId) ||
    data.requestId !== request.requestId || data.profileId !== request.profileId ||
    data.sessionId !== request.sessionId || data.discoveryMode !== request.discoveryMode ||
    data.itemType !== request.itemType || !Array.isArray(data.items) || data.items.length > request.limit ||
    data.continuationSupported !== false || data.nextCursor !== null || !record(data.source)) return pageError();
  const items = data.items;
  const source = data.source;
  if (source.version !== 'eligibility-first-v1' || typeof source.candidateCount !== 'number' ||
    !Number.isInteger(source.candidateCount) || source.candidateCount < data.items.length ||
    source.candidateCount > Math.min(50, request.limit * 3) || source.resultCount !== data.items.length ||
    source.catalogEmpty !== (data.availability === 'CATALOG_EMPTY')) return pageError();
  if (data.availability !== 'ITEMS' && data.availability !== 'WINDOW_EXHAUSTED' && data.availability !== 'CATALOG_EMPTY') return pageError();
  if ((data.availability === 'ITEMS') !== (data.items.length > 0) ||
    (data.availability === 'CATALOG_EMPTY' && source.candidateCount !== 0)) return pageError();

  let ranking: PredictionRanking;
  if (data.items.length === 0) {
    // Only the identified envelope can turn zero rows into a successful run.
    ranking = { predictionId: data.predictionId, items: [], predictions: [] };
  } else {
    if (data.items.some((row, index) => !record(row) || row.prediction_id !== data.predictionId ||
      !isUuid(row.item_id) || row.item_type !== request.itemType ||
      (index > 0 && Number(row.rank) <= Number(items[index - 1].rank)))) return pageError();
    const mapped = mapPredictionRows(data.items, request.profileId, request.discoveryMode);
    if (mapped.status !== 'success') return pageError();
    ranking = mapped.ranking;
  }
  return { status: 'success', request, ranking, availability: data.availability,
    continuationSupported: false, nextCursor: null, candidateCount: source.candidateCount };
}
