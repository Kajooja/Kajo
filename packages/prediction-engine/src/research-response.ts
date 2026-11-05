import { shrunkRatingResidual } from './rating-location.js';

/** Arithmetic only, isolated research export. Caller admits source, prefix and scale. */
export interface ResponseConfig {
  readonly spreadShrinkage: number;
  readonly minimumRatings: number;
  readonly minimumBaseVariance: number;
  readonly minimumCorrection: number;
  readonly maximumCorrection: number;
}
export interface ResponseFit {
  readonly location: number;
  readonly center: number;
  readonly correction: number;
  readonly support: 'SUPPORTED' | 'EMPTY' | 'SPARSE' | 'CONSTANT_GRADES' | 'CONSTANT_BASE';
  readonly count: number;
  readonly baseVariance: number;
}

/** Identified centered ridge: one extra slope, no second unconstrained intercept. */
export function fitRatingResponse(bases: readonly number[], values: readonly number[],
  locationShrinkage: number, config: ResponseConfig): ResponseFit {
  if (bases.length !== values.length || bases.length > 10000
    || ![...bases, ...values].every(x => Number.isFinite(x) && x >= 0 && x <= 10)
    || !Number.isInteger(config.minimumRatings) || config.minimumRatings < 2
    || !Number.isFinite(config.spreadShrinkage) || config.spreadShrinkage <= 0
    || !Number.isFinite(config.minimumBaseVariance) || config.minimumBaseVariance <= 0
    || !Number.isFinite(config.minimumCorrection) || config.minimumCorrection <= -1 || config.minimumCorrection > 0
    || !Number.isFinite(config.maximumCorrection) || config.maximumCorrection < 0) {
    throw new Error('Invalid response evidence or configuration');
  }
  const count = bases.length, residuals = values.map((v, i) => v - bases[i]!);
  const location = shrunkRatingResidual(residuals, locationShrinkage);
  const center = count ? bases.reduce((a, b) => a + b, 0) / count : 0;
  const centered = bases.map(b => b - center);
  const ss = centered.reduce((sum, x) => sum + x * x, 0);
  const baseVariance = count ? ss / count : 0;
  const support = !count ? 'EMPTY' : count < config.minimumRatings ? 'SPARSE'
    : values.every(v => v === values[0]) ? 'CONSTANT_GRADES'
      : baseVariance < config.minimumBaseVariance ? 'CONSTANT_BASE' : 'SUPPORTED';
  const correction = support === 'SUPPORTED'
    ? Math.min(config.maximumCorrection, Math.max(config.minimumCorrection,
      centered.reduce((sum, x, i) => sum + x * residuals[i]!, 0) / (ss + config.spreadShrinkage))) : 0;
  return Object.freeze({ location, center, correction, support, count, baseVariance });
}

/** Both variants use the same base, shrunk location, and source-bound clipping. */
export function predictRatingResponse(fit: ResponseFit, base: number, min: number, max: number) {
  if (![base, min, max, fit.location, fit.center, fit.correction].every(Number.isFinite)
    || min < 0 || max > 10 || min >= max || base < min || base > max) throw new Error('Invalid response forecast');
  const clip = (v: number) => Math.min(max, Math.max(min, v));
  const control = clip(base + fit.location);
  return { 'profile-offset': control,
    'response-spread': fit.correction === 0 ? control : clip(base + fit.location + fit.correction * (base - fit.center)) };
}
