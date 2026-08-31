export const MIN_ITEM_RATING = 0;
export const MAX_ITEM_RATING = 10;

export function clampRating(rating: number): number {
  return Math.min(MAX_ITEM_RATING, Math.max(MIN_ITEM_RATING, Math.round(rating)));
}

export function getRatingPosition(rating: number | null): number {
  return (rating ?? 5) / MAX_ITEM_RATING;
}

export function getRatingForTrackPosition(
  positionPx: number,
  trackWidthPx: number,
): number {
  if (trackWidthPx <= 0) return 5;
  return clampRating((positionPx / trackWidthPx) * MAX_ITEM_RATING);
}
