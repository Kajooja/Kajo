import { forecastPersonalRatingBaseline } from './personal-rating.js';
import type { PersonalRatingBaselineForecast, PersonalRatingBaselineInput, PersonalRatingPoint } from './personal-rating.js';

/** A source-only fixed-mean challenger. Regularized associations are not latent
 * taste, calibrated uncertainty, feature causality or serving admission. */
export const personalContentRating = Object.freeze({
  version: 'personal-content-rating-v1' as const,
  featureVersion: 'personal-content-feature-snapshot-v1' as const,
  fitVersion: 'centered-fixed-mean-ridge-v1' as const,
  maximumDimensions: 32, maximumRatings: 8192,
  // Numerical/resource bounds, not a fitted hyperparameter or quality threshold.
  minimumRidge: 1, maximumRidge: 1000000,
});

export interface PersonalContentFeature {
  readonly objectId: string;
  readonly domainId: string;
  readonly sourceId: string;
  readonly availableAtMicros: string;
  readonly status: 'AVAILABLE' | 'UNAVAILABLE' | 'WITHDRAWN';
  /** Complete vectors use a fixed declared schema; missing vectors remain null.
   * The adapter owns the meaning of a numeric zero, never the missingness rule. */
  readonly values: readonly number[] | null;
}
export interface PersonalContentFeatureSnapshot {
  readonly version: typeof personalContentRating.featureVersion;
  readonly snapshotId: string;
  readonly cutoffMicros: string;
  readonly sourceVersion: string;
  readonly featureIds: readonly string[];
  readonly objects: readonly PersonalContentFeature[];
}
export interface PersonalContentRatingInput extends Omit<PersonalRatingBaselineInput, 'prior'> {
  readonly prior: null;
  readonly content: PersonalContentFeatureSnapshot;
  readonly contentConfig: Readonly<{ version: string; ridge: number }>;
}
export type PersonalContentFitStatus = 'FITTED' | 'NO_NUMERIC_SUPPORT' | 'INSUFFICIENT_FEATURE_SUPPORT'
  | 'CONSTANT_FEATURED_RATINGS' | 'NO_TRAINING_FEATURE_VARIATION';
export type PersonalContentFallback = 'NONE' | Exclude<PersonalContentFitStatus, 'FITTED'>
  | 'FEATURE_UNAVAILABLE' | 'FEATURE_WITHDRAWN' | 'FUTURE_FEATURE' | 'NO_SUPPORTED_CONTENT_FEATURE';
export interface PersonalContentRatingForecast extends Omit<PersonalRatingBaselineForecast,
  'version' | 'capability' | 'identified' | 'forecasts'> {
  readonly version: typeof personalContentRating.version;
  readonly capability: 'NUMERIC_CONTENT_POINT_V1' | 'NUMERIC_POINT_UNAVAILABLE_V1';
  readonly identified: Readonly<{ personalLocation: boolean; responseSpread: false }>;
  readonly content: PersonalContentFeatureSnapshot;
  readonly contentConfig: PersonalContentRatingInput['contentConfig'];
  readonly contentFit: Readonly<{
    version: typeof personalContentRating.fitVersion;
    status: PersonalContentFitStatus;
    numericSupport: number; featureSupport: number; featureCoverage: number | null;
    featureDimensions: number; variedFeatureCount: number;
    featureMeans: readonly number[]; coefficients: readonly number[];
    excluded: Readonly<{ unavailable: number; withdrawn: number; future: number }>;
    replayPolicy: 'REBUILD_FROM_COMPLETE_RESOLVED_PREFIX';
    parameterInterpretation: 'REGULARIZED_ASSOCIATION_NOT_LATENT_TASTE';
    cost: Readonly<{ trainingRows: number; featureDimensions: number; variedDimensions: number; centeredScalarProducts: number }>;
  }>;
  readonly forecasts: readonly Readonly<{
    objectId: string;
    control: PersonalRatingPoint;
    candidate: Readonly<Omit<PersonalRatingPoint, 'mode'> & {
      mode: 'CONTENT_RIDGE' | 'PERSONAL_MEAN_FALLBACK' | 'NO_NUMERIC_SUPPORT';
    }>;
    contentDiagnostic: Readonly<{
      fallback: PersonalContentFallback; rawValue: number | null;
      clipped: boolean; supportedFeatureCount: number;
    }>;
  }>[];
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Invalid Personal content rating: ${message}`);
}
const ref = (value: unknown): value is string => typeof value === 'string'
  && /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$/u.test(value);
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function micros(value: unknown): bigint {
  check(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/u.test(value)
    && BigInt(value) <= 253402300799999999n, 'microsecond clock');
  return BigInt(value);
}
function shape(value: unknown, keys: readonly string[]): void {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'feature shape');
}

function snapshot(input: PersonalContentRatingInput, baseline: PersonalRatingBaselineForecast): PersonalContentFeatureSnapshot {
  const source = input.content, cutoff = micros(input.cutoffMicros);
  shape(source, ['version', 'snapshotId', 'cutoffMicros', 'sourceVersion', 'featureIds', 'objects']);
  check(source.version === personalContentRating.featureVersion && source.snapshotId === baseline.prefix.snapshotId
    && source.cutoffMicros === input.cutoffMicros && ref(source.sourceVersion), 'feature snapshot binding');
  check(Array.isArray(source.featureIds) && source.featureIds.length >= 1
    && source.featureIds.length <= personalContentRating.maximumDimensions
    && Array.from(source.featureIds).every(ref)
    && new Set(source.featureIds).size === source.featureIds.length, 'fixed feature schema');
  const required = new Set([...baseline.prefix.ratings.map(row => row.objectId), ...baseline.candidatePool.candidateIds]);
  check(Array.isArray(source.objects) && source.objects.length === required.size && source.objects.length <= 11192,
    'complete bounded feature inventory');
  const seen = new Set<string>();
  const objects = Array.from(source.objects, row => {
    shape(row, ['objectId', 'domainId', 'sourceId', 'availableAtMicros', 'status', 'values']);
    check(ref(row.objectId) && required.has(row.objectId) && !seen.has(row.objectId)
      && row.domainId === input.domainId && ref(row.sourceId), 'feature object identity/scope');
    seen.add(row.objectId); micros(row.availableAtMicros);
    check(['AVAILABLE', 'UNAVAILABLE', 'WITHDRAWN'].includes(row.status), 'feature availability');
    check(row.status === 'AVAILABLE'
      ? Array.isArray(row.values) && row.values.length === source.featureIds.length
        && Array.from(row.values).every(value => typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1)
      : row.values === null, 'complete bounded feature vector or explicit missingness');
    return Object.freeze({ objectId: row.objectId, domainId: row.domainId, sourceId: row.sourceId,
      availableAtMicros: row.availableAtMicros, status: row.status,
      values: row.values === null ? null : Object.freeze([...row.values]) });
  }).sort((a, b) => lexical(a.objectId, b.objectId));
  check(micros(source.cutoffMicros) === cutoff, 'feature cutoff');
  return Object.freeze({ version: source.version, snapshotId: source.snapshotId, cutoffMicros: source.cutoffMicros,
    sourceVersion: source.sourceVersion, featureIds: Object.freeze([...source.featureIds]), objects: Object.freeze(objects) });
}

/** Positive definite because the declared ridge is at least one. No candidate
 * vector enters the normal equations. Arrays are bounded by 32 dimensions. */
function solve(matrix: number[][], rhs: number[]): number[] {
  const size = rhs.length, lower = Array.from({ length: size }, () => Array<number>(size).fill(0));
  for (let i = 0; i < size; i++) for (let j = 0; j <= i; j++) {
    let value = matrix[i]![j]!;
    for (let k = 0; k < j; k++) value -= lower[i]![k]! * lower[j]![k]!;
    check(Number.isFinite(value) && (i !== j || value > 0), 'finite positive ridge system');
    lower[i]![j] = i === j ? Math.sqrt(value) : value / lower[j]![j]!;
  }
  const intermediate = Array<number>(size).fill(0), coefficients = Array<number>(size).fill(0);
  for (let i = 0; i < size; i++) {
    let value = rhs[i]!;
    for (let j = 0; j < i; j++) value -= lower[i]![j]! * intermediate[j]!;
    intermediate[i] = value / lower[i]![i]!;
  }
  for (let i = size - 1; i >= 0; i--) {
    let value = intermediate[i]!;
    for (let j = i + 1; j < size; j++) value -= lower[j]![i]! * coefficients[j]!;
    coefficients[i] = value / lower[i]![i]!;
  }
  check(coefficients.every(Number.isFinite), 'finite ridge coefficients');
  return coefficients;
}

/** Refit after each accepted change from a new complete canonical prefix. The
 * caller resolves correction/Undo/clear/withdrawal; no hidden persistent state
 * merges removed evidence back in. Old returned forecasts are deeply immutable.
 * This proves neither source authorization nor the authenticity of the cutoff. */
export function forecastPersonalContentRating(input: PersonalContentRatingInput): PersonalContentRatingForecast {
  check(input?.prior === null && Array.isArray(input.prefix?.ratings)
    && input.prefix.ratings.length <= personalContentRating.maximumRatings, 'native-only bounded numeric prefix');
  check(Array.isArray(input.candidatePool?.candidateIds) && Array.from(input.candidatePool.candidateIds).every(ref), 'candidate identities');
  check(input.contentConfig && ref(input.contentConfig.version) && Number.isFinite(input.contentConfig.ridge)
    && input.contentConfig.ridge >= personalContentRating.minimumRidge
    && input.contentConfig.ridge <= personalContentRating.maximumRidge, 'declared bounded ridge/configuration');
  const baseline = forecastPersonalRatingBaseline(input), content = snapshot(input, baseline);
  const numericSupport = baseline.prefix.support, mean = baseline.location.personalMean;
  const cutoff = micros(input.cutoffMicros), dimensions = content.featureIds.length;
  const objects = new Map(content.objects.map(row => [row.objectId, row]));
  const excluded = { unavailable: 0, withdrawn: 0, future: 0 };
  const rows: { values: readonly number[]; rating: number }[] = [];
  for (const rating of baseline.prefix.ratings) {
    const feature = objects.get(rating.objectId)!;
    if (feature.status === 'UNAVAILABLE') excluded.unavailable++;
    else if (feature.status === 'WITHDRAWN') excluded.withdrawn++;
    else if (micros(feature.availableAtMicros) > cutoff) excluded.future++;
    else rows.push({ values: feature.values!, rating: rating.value });
  }
  const featureSupport = rows.length;
  const means = Array<number>(dimensions).fill(0), minimum = Array<number>(dimensions).fill(Infinity), maximum = Array<number>(dimensions).fill(-Infinity);
  for (const row of rows) for (let i = 0; i < dimensions; i++) {
    means[i] = means[i]! + row.values[i]!;
    minimum[i] = Math.min(minimum[i]!, row.values[i]!); maximum[i] = Math.max(maximum[i]!, row.values[i]!);
  }
  const varied = means.map((_, i) => featureSupport > 0 && minimum[i] !== maximum[i]);
  for (let i = 0; i < dimensions; i++) means[i] = featureSupport ? varied[i] ? means[i]! / featureSupport : minimum[i]! : 0;
  const variedIndices = varied.flatMap((value, index) => value ? [index] : []), variedFeatureCount = variedIndices.length;
  const status: PersonalContentFitStatus = numericSupport === 0 ? 'NO_NUMERIC_SUPPORT'
    : featureSupport < 2 ? 'INSUFFICIENT_FEATURE_SUPPORT'
      : rows.every(row => row.rating === rows[0]!.rating) ? 'CONSTANT_FEATURED_RATINGS'
        : variedFeatureCount === 0 ? 'NO_TRAINING_FEATURE_VARIATION' : 'FITTED';
  const coefficients = Array<number>(dimensions).fill(0);
  if (status === 'FITTED') {
    const matrix = Array.from({ length: variedFeatureCount }, (_, i) =>
      Array.from({ length: variedFeatureCount }, (_, j) => i === j ? input.contentConfig.ridge : 0));
    const rhs = Array<number>(variedFeatureCount).fill(0);
    // Stable object order, two-pass centered accumulation, no raw-moment
    // subtraction and no statistics fitted from future/held-out candidates.
    for (const row of rows) {
      const centered = variedIndices.map(i => row.values[i]! - means[i]!);
      for (let i = 0; i < variedFeatureCount; i++) {
        rhs[i] = rhs[i]! + centered[i]! * (row.rating - mean!);
        for (let j = 0; j <= i; j++) matrix[i]![j] = matrix[i]![j]! + centered[i]! * centered[j]!;
      }
    }
    for (let i = 0; i < variedFeatureCount; i++) for (let j = 0; j < i; j++) matrix[j]![i] = matrix[i]![j]!;
    solve(matrix, rhs).forEach((value, i) => { coefficients[variedIndices[i]!] = value; });
  }
  const forecasts = baseline.forecasts.map(row => {
    const feature = objects.get(row.objectId)!;
    const usable = feature.status === 'AVAILABLE' && micros(feature.availableAtMicros) <= cutoff;
    const supportedFeatureCount = usable ? variedIndices.filter(i => feature.values![i] !== 0).length : 0;
    const fallback: PersonalContentFallback = status !== 'FITTED' ? status
      : feature.status === 'UNAVAILABLE' ? 'FEATURE_UNAVAILABLE'
        : feature.status === 'WITHDRAWN' ? 'FEATURE_WITHDRAWN'
          : !usable ? 'FUTURE_FEATURE'
            : supportedFeatureCount === 0 ? 'NO_SUPPORTED_CONTENT_FEATURE' : 'NONE';
    const rawValue = fallback === 'NONE'
      ? mean! + coefficients.reduce((sum, coefficient, i) => sum + coefficient * (feature.values![i]! - means[i]!), 0) : mean;
    check(rawValue === null || Number.isFinite(rawValue), 'finite content forecast');
    const value = rawValue === null ? null : Math.min(10, Math.max(0, rawValue));
    return Object.freeze({ objectId: row.objectId, control: row.control,
      candidate: Object.freeze({ value, status: value === null ? 'UNAVAILABLE' as const : 'AVAILABLE' as const,
        mode: fallback === 'NONE' ? 'CONTENT_RIDGE' as const : mean === null ? 'NO_NUMERIC_SUPPORT' as const : 'PERSONAL_MEAN_FALLBACK' as const,
        prefixSupport: numericSupport }),
      contentDiagnostic: Object.freeze({ fallback, rawValue, clipped: rawValue !== value, supportedFeatureCount }) });
  });
  return Object.freeze({ ...baseline, version: personalContentRating.version,
    capability: numericSupport > 0 && forecasts.length > 0 ? 'NUMERIC_CONTENT_POINT_V1' : 'NUMERIC_POINT_UNAVAILABLE_V1',
    identified: Object.freeze({ personalLocation: numericSupport > 0, responseSpread: false as const }),
    content, contentConfig: Object.freeze({ version: input.contentConfig.version, ridge: input.contentConfig.ridge }),
    contentFit: Object.freeze({ version: personalContentRating.fitVersion, status, numericSupport, featureSupport,
      featureCoverage: numericSupport ? featureSupport / numericSupport : null, featureDimensions: dimensions,
      variedFeatureCount, featureMeans: Object.freeze(means), coefficients: Object.freeze(coefficients), excluded: Object.freeze(excluded),
      replayPolicy: 'REBUILD_FROM_COMPLETE_RESOLVED_PREFIX' as const,
      parameterInterpretation: 'REGULARIZED_ASSOCIATION_NOT_LATENT_TASTE' as const,
      cost: Object.freeze({ trainingRows: featureSupport, featureDimensions: dimensions, variedDimensions: variedFeatureCount,
        centeredScalarProducts: status === 'FITTED' ? featureSupport * variedFeatureCount * (variedFeatureCount + 1) / 2 : 0 }) }),
    forecasts: Object.freeze(forecasts) });
}
