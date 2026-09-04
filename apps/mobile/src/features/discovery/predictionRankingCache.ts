import type {
  Item,
  ItemId,
  ItemType,
  PredictionId,
} from '../../domain/contracts';

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

  touchPrediction(predictionId, items);
  return items;
}

export function getRememberedItem(itemId: ItemId): Item | undefined {
  const entries = [...cachedItemsByPrediction.entries()].reverse();

  for (const [predictionId, items] of entries) {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) continue;
    touchPrediction(predictionId, items);
    return item;
  }

  return undefined;
}

export function getMostRecentRememberedItems(
  itemType: ItemType,
): readonly Item[] {
  const entries = [...cachedItemsByPrediction.entries()].reverse();

  for (const [predictionId, items] of entries) {
    if (!items.some((item) => item.itemType === itemType)) continue;
    touchPrediction(predictionId, items);
    return items.filter((item) => item.itemType === itemType);
  }

  return [];
}

export function clearPredictionItemCacheForTests() {
  cachedItemsByPrediction.clear();
}

function touchPrediction(predictionId: PredictionId, items: readonly Item[]) {
  cachedItemsByPrediction.delete(predictionId);
  cachedItemsByPrediction.set(predictionId, items);
}
