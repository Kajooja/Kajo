import type { Item, PredictionId } from '../../domain/contracts';

const MAX_CACHED_PREDICTIONS = 8;
const cachedItemsByPrediction = new Map<PredictionId, readonly Item[]>();

export function rememberPredictionItems(
  predictionId: PredictionId,
  items: readonly Item[],
) {
  cachedItemsByPrediction.delete(predictionId);
  cachedItemsByPrediction.set(predictionId, [...items]);

  while (cachedItemsByPrediction.size > MAX_CACHED_PREDICTIONS) {
    const oldestKey = cachedItemsByPrediction.keys().next().value as
      | PredictionId
      | undefined;
    if (!oldestKey) break;
    cachedItemsByPrediction.delete(oldestKey);
  }
}

export function getRememberedPredictionItems(
  predictionId: PredictionId | undefined,
): readonly Item[] {
  if (!predictionId) return [];
  const items = cachedItemsByPrediction.get(predictionId);
  if (!items) return [];

  cachedItemsByPrediction.delete(predictionId);
  cachedItemsByPrediction.set(predictionId, items);
  return items;
}

export function clearPredictionItemCacheForTests() {
  cachedItemsByPrediction.clear();
}
