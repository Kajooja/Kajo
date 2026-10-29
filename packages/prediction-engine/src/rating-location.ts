/** Shared D2/native location calculation. Callers own source and scale admission. */
export function shrunkRatingResidual(residuals: readonly number[], shrinkage: number): number {
  if (!Number.isFinite(shrinkage) || shrinkage <= 0 || !residuals.every(Number.isFinite)) {
    throw new Error('Invalid rating residual or shrinkage');
  }
  const result = residuals.reduce((sum, value) => sum + value, 0) / (residuals.length + shrinkage);
  if (!Number.isFinite(result)) throw new Error('Nonfinite rating residual');
  return result;
}
