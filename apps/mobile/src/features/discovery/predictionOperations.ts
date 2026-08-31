import type {
  Context,
  DiscoveryMode,
  Item,
  ItemType,
  Prediction,
  PredictionId,
  ProfileId,
} from '../../domain/contracts';

export const PREDICTION_V0_RPC = 'rank_items_v0';

export interface PredictionRpcResponse {
  data: unknown;
  error: { message: string } | null;
}

export type PredictionRpc = (
  functionName: typeof PREDICTION_V0_RPC,
  arguments_: Readonly<Record<string, unknown>>,
) => Promise<PredictionRpcResponse>;

export interface PredictionRanking {
  predictionId: PredictionId;
  items: readonly Item[];
  predictions: readonly Prediction[];
}

export type PredictionRankingResult =
  | { status: 'success'; ranking: PredictionRanking }
  | { status: 'error'; message: string };

interface PredictionRow {
  prediction_id: string;
  item_id: string;
  item_type: ItemType;
  title: string;
  description: string | null;
  tags: string[];
  score: number;
  confidence: number;
  rank: number;
}

export async function loadPredictionRanking(
  rpc: PredictionRpc,
  input: {
    profileId: ProfileId;
    mode: DiscoveryMode;
    itemType: ItemType;
    limit?: number;
    context?: Context;
  },
): Promise<PredictionRankingResult> {
  try {
    const response = await rpc(PREDICTION_V0_RPC, {
      target_profile_id: input.profileId,
      requested_mode: input.mode,
      requested_item_type: input.itemType,
      result_limit: input.limit ?? 20,
      request_context: serializeContext(input.context ?? {}),
    });

    if (response.error) {
      return predictionError();
    }

    return mapPredictionRows(response.data, input.profileId, input.mode);
  } catch {
    return predictionError();
  }
}

export function mapPredictionRows(
  data: unknown,
  profileId: ProfileId,
  mode: DiscoveryMode,
): PredictionRankingResult {
  if (!Array.isArray(data) || data.length === 0) {
    return predictionError();
  }

  const rows = data.filter(isPredictionRow).sort((a, b) => a.rank - b.rank);
  const predictionId = rows[0]?.prediction_id;

  if (
    rows.length !== data.length ||
    !predictionId ||
    rows.some((row) => row.prediction_id !== predictionId)
  ) {
    return predictionError();
  }

  return {
    status: 'success',
    ranking: {
      predictionId,
      items: rows.map((row) => ({
        id: row.item_id,
        itemType: row.item_type,
        title: row.title,
        ...(row.description ? { description: row.description } : {}),
        tags: row.tags,
      })),
      predictions: rows.map((row) => ({
        predictionId,
        profileId,
        itemId: row.item_id,
        discoveryMode: mode,
        score: row.score,
        confidence: row.confidence,
      })),
    },
  };
}

function isPredictionRow(value: unknown): value is PredictionRow {
  if (!value || typeof value !== 'object') return false;

  const row = value as Record<string, unknown>;

  return (
    typeof row.prediction_id === 'string' &&
    typeof row.item_id === 'string' &&
    (row.item_type === 'BOOK' || row.item_type === 'MOVIE') &&
    typeof row.title === 'string' &&
    (row.description === null || typeof row.description === 'string') &&
    Array.isArray(row.tags) &&
    row.tags.every((tag) => typeof tag === 'string') &&
    typeof row.score === 'number' &&
    Number.isFinite(row.score) &&
    typeof row.confidence === 'number' &&
    Number.isFinite(row.confidence) &&
    typeof row.rank === 'number' &&
    Number.isInteger(row.rank) &&
    row.rank > 0
  );
}

function serializeContext(context: Context): Readonly<Record<string, unknown>> {
  return {
    ...(context.locale ? { locale: context.locale } : {}),
    ...(context.timezone ? { timezone: context.timezone } : {}),
    ...(context.occurredAt ? { occurredAt: context.occurredAt } : {}),
    ...(context.attributes ? { attributes: context.attributes } : {}),
  };
}

function predictionError(): PredictionRankingResult {
  return {
    status: 'error',
    message: 'Suositusten päivittäminen epäonnistui. Yritä uudelleen.',
  };
}
