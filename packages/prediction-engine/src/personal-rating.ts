import { shrunkRatingResidual } from './rating-location.js';

/** An isolated source baseline, never a serving policy or a calibrated grade. */
export const personalRatingBaseline = Object.freeze({
  version: 'personal-domain-mean-v1' as const,
  targetVersion: 'personal-own-scale-post-experience-rating-v1' as const,
  prefixVersion: 'canonical-resolved-rating-prefix-v1' as const,
  scale: Object.freeze({ min: 0, max: 10 }),
  cutoffPolicy: 'OCCURRED_AND_AVAILABLE_AT_OR_BEFORE_CUTOFF' as const,
});

/** Decimal Unix microseconds; preserve native receipt order without Date rounding. */
export type RatingInstant = string;
export interface ResolvedPersonalRating {
  readonly sourceEventId: string;
  readonly subjectId: string;
  readonly domainId: string;
  readonly objectId: string;
  readonly value: number;
  readonly occurredAtMicros: RatingInstant;
  readonly availableAtMicros: RatingInstant;
}
export interface DomainRatingPrior {
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly artifactId: string;
  readonly domainId: string;
  readonly value: number;
  readonly availableAtMicros: RatingInstant;
  /** This declaration comes from the trusted source admission boundary. */
  readonly permission: 'PERMITTED' | 'UNAVAILABLE' | 'WITHDRAWN';
}
export interface PersonalRatingBaselineInput {
  readonly subjectId: string;
  readonly domainId: string;
  readonly cutoffMicros: RatingInstant;
  readonly prefix: {
    readonly sourceId: string;
    readonly sourceVersion: string;
    readonly snapshotId: string;
    readonly provenance: Readonly<{ origin: 'observed' | 'synthetic'; captureScope: string }>;
    /** Supplied by the canonical resolver, not inferred from array length. */
    readonly complete: boolean;
    readonly ratings: readonly ResolvedPersonalRating[];
  };
  readonly candidatePool: {
    readonly snapshotId: string;
    readonly cutoffMicros: RatingInstant;
    readonly candidateIds: readonly string[];
  };
  readonly config: { readonly version: string; readonly shrinkage: number };
  readonly prior: DomainRatingPrior | null;
}
export interface PersonalRatingPoint {
  readonly value: number | null;
  readonly status: 'AVAILABLE' | 'UNAVAILABLE';
  readonly mode: 'PERSONAL_MEAN' | 'SHRUNK_PERSONAL_RESIDUAL' | 'DOMAIN_PRIOR_ONLY'
    | 'PERSONAL_MEAN_FALLBACK' | 'NO_NUMERIC_SUPPORT';
  readonly prefixSupport: number;
}
export interface PersonalRatingBaselineForecast {
  readonly version: typeof personalRatingBaseline.version;
  readonly targetVersion: typeof personalRatingBaseline.targetVersion;
  readonly capability: 'NUMERIC_POINT_BASELINE_V1' | 'NUMERIC_POINT_UNAVAILABLE_V1';
  readonly calibration: 'UNCALIBRATED';
  readonly qualityAdmission: 'NONE';
  readonly servingActivation: 'NONE';
  readonly subjectId: string;
  readonly domainId: string;
  readonly cutoffMicros: RatingInstant;
  readonly prefix: {
    readonly version: typeof personalRatingBaseline.prefixVersion;
    readonly sourceId: string;
    readonly sourceVersion: string;
    readonly snapshotId: string;
    readonly support: number;
    readonly provenance: PersonalRatingBaselineInput['prefix']['provenance'];
    readonly ratings: readonly ResolvedPersonalRating[];
    readonly excluded: Readonly<{ foreignSubject: number; foreignDomain: number; future: number; duplicate: number }>;
  };
  readonly candidatePool: PersonalRatingBaselineInput['candidatePool'];
  readonly config: PersonalRatingBaselineInput['config'];
  readonly prior: DomainRatingPrior | null;
  readonly priorDisposition: 'PERMITTED' | 'ABSENT' | 'UNAVAILABLE' | 'WITHDRAWN'
    | 'FOREIGN_DOMAIN' | 'FUTURE';
  readonly location: Readonly<{ personalMean: number | null; residual: number | null }>;
  readonly identified: Readonly<{ personalLocation: boolean; responseSpread: false; contentDifferentiation: false }>;
  readonly forecasts: readonly Readonly<{
    objectId: string; control: PersonalRatingPoint; candidate: PersonalRatingPoint;
  }>[];
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function ref(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$/u.test(value);
}
function instant(value: unknown): bigint {
  requireValue(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/u.test(value)
    && BigInt(value) <= 253402300799999999n, 'Invalid rating microsecond clock');
  return BigInt(value);
}
function validRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10;
}
function sameRating(a: ResolvedPersonalRating, b: ResolvedPersonalRating): boolean {
  return a.sourceEventId === b.sourceEventId && a.subjectId === b.subjectId && a.domainId === b.domainId
    && a.objectId === b.objectId && a.value === b.value && a.occurredAtMicros === b.occurredAtMicros
    && a.availableAtMicros === b.availableAtMicros;
}
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/**
 * The adapter supplies a complete, authorized, canonically resolved raw-label
 * prefix and the candidate pool observed at one cutoff. This function neither
 * resolves Kajo receipt revisions nor establishes authorization/completeness.
 * Corrections, clear, Undo and withdrawal require a new canonical snapshot;
 * earlier returned snapshots are immutable. No stored rank weight is a label.
 */
export function forecastPersonalRatingBaseline(input: PersonalRatingBaselineInput): PersonalRatingBaselineForecast {
  requireValue(input && ref(input.subjectId) && ref(input.domainId), 'Invalid Personal rating scope');
  const cutoff = instant(input.cutoffMicros), prefix = input.prefix, pool = input.candidatePool;
  requireValue(prefix && ref(prefix.sourceId) && ref(prefix.sourceVersion) && ref(prefix.snapshotId)
    && prefix.complete === true && Array.isArray(prefix.ratings) && prefix.ratings.length <= 100000,
  'A complete resolved rating prefix and source identity are required');
  requireValue(prefix.provenance && ['observed', 'synthetic'].includes(prefix.provenance.origin)
    && ref(prefix.provenance.captureScope)
    && (prefix.provenance.captureScope !== 'ISOLATED_NATIVE_FIXTURE' || prefix.provenance.origin === 'synthetic'),
  'Explicit rating evidence origin and capture scope are required');
  requireValue(pool && ref(pool.snapshotId) && Array.isArray(pool.candidateIds) && pool.candidateIds.length <= 3000
    && pool.candidateIds.every(ref) && new Set(pool.candidateIds).size === pool.candidateIds.length,
  'Invalid or duplicate candidate pool');
  requireValue(instant(pool.cutoffMicros) === cutoff, 'Candidate pool and prefix must share one cutoff');
  requireValue(pool.snapshotId === prefix.snapshotId, 'Candidate pool and prefix must share one snapshot');
  requireValue(input.config && ref(input.config.version) && Number.isFinite(input.config.shrinkage)
    && input.config.shrinkage > 0, 'Explicit positive finite shrinkage and config version are required');
  requireValue(input.prior === null || (input.prior && ref(input.prior.sourceId) && ref(input.prior.sourceVersion)
    && ref(input.prior.artifactId) && ref(input.prior.domainId) && Number.isFinite(input.prior.value)
    && input.prior.value >= 0 && input.prior.value <= 10
    && ['PERMITTED', 'UNAVAILABLE', 'WITHDRAWN'].includes(input.prior.permission)), 'Invalid versioned domain prior');

  const excluded = { foreignSubject: 0, foreignDomain: 0, future: 0, duplicate: 0 };
  const byEvent = new Map<string, ResolvedPersonalRating>(), byObject = new Map<string, ResolvedPersonalRating>();
  for (const row of prefix.ratings) {
    requireValue(row && ref(row.sourceEventId) && ref(row.subjectId) && ref(row.domainId) && ref(row.objectId),
      'Invalid resolved rating identity');
    if (row.subjectId !== input.subjectId) { excluded.foreignSubject++; continue; }
    if (row.domainId !== input.domainId) { excluded.foreignDomain++; continue; }
    const occurred = instant(row.occurredAtMicros), available = instant(row.availableAtMicros);
    if (occurred > cutoff || available > cutoff) { excluded.future++; continue; }
    requireValue(validRating(row.value), 'An original numeric integer rating in 0..10 is required');
    const event = byEvent.get(row.sourceEventId), object = byObject.get(row.objectId);
    if (event || object) {
      requireValue(event && object && sameRating(event, row) && sameRating(object, row),
        'Conflicting duplicate source or unresolved Item contributions');
      excluded.duplicate++; continue;
    }
    const copy = Object.freeze({ sourceEventId: row.sourceEventId, subjectId: row.subjectId,
      domainId: row.domainId, objectId: row.objectId, value: row.value,
      occurredAtMicros: row.occurredAtMicros, availableAtMicros: row.availableAtMicros });
    byEvent.set(row.sourceEventId, copy); byObject.set(row.objectId, copy);
  }
  // Stable source ordering makes repeated calls/order permutations reproducible.
  const ratings = Object.freeze([...byObject.values()].sort((a, b) => lexical(a.objectId, b.objectId)));
  const support = ratings.length;
  const personalMean = support ? ratings.reduce((sum, row) => sum + row.value, 0) / support : null;
  const prior = input.prior;
  const priorDisposition = prior === null ? 'ABSENT' : prior.permission !== 'PERMITTED' ? prior.permission
    : prior.domainId !== input.domainId ? 'FOREIGN_DOMAIN'
      : instant(prior.availableAtMicros) > cutoff ? 'FUTURE' : 'PERMITTED';
  // Validate the clock even for an unavailable prior; it never contributes.
  if (prior !== null) instant(prior.availableAtMicros);
  const admitted = prior !== null && priorDisposition === 'PERMITTED' ? Object.freeze({ sourceId: prior.sourceId,
    sourceVersion: prior.sourceVersion, artifactId: prior.artifactId, domainId: prior.domainId,
    value: prior.value, availableAtMicros: prior.availableAtMicros, permission: prior.permission }) : null;
  const residual = admitted ? shrunkRatingResidual(ratings.map(row => row.value - admitted.value), input.config.shrinkage) : null;
  const candidateValue = admitted ? Math.min(10, Math.max(0, admitted.value + residual!)) : personalMean;
  const point = (value: number | null, mode: PersonalRatingPoint['mode']): PersonalRatingPoint => Object.freeze({
    value, mode, status: value === null ? 'UNAVAILABLE' : 'AVAILABLE', prefixSupport: support,
  });
  const control = point(personalMean, personalMean === null ? 'NO_NUMERIC_SUPPORT' : 'PERSONAL_MEAN');
  const candidate = point(candidateValue, admitted ? support ? 'SHRUNK_PERSONAL_RESIDUAL' : 'DOMAIN_PRIOR_ONLY'
    : personalMean === null ? 'NO_NUMERIC_SUPPORT' : 'PERSONAL_MEAN_FALLBACK');
  return Object.freeze({ version: personalRatingBaseline.version, targetVersion: personalRatingBaseline.targetVersion,
    capability: pool.candidateIds.length > 0 && (personalMean !== null || candidateValue !== null)
      ? 'NUMERIC_POINT_BASELINE_V1' : 'NUMERIC_POINT_UNAVAILABLE_V1',
    calibration: 'UNCALIBRATED', qualityAdmission: 'NONE', servingActivation: 'NONE',
    subjectId: input.subjectId, domainId: input.domainId, cutoffMicros: input.cutoffMicros,
    prefix: Object.freeze({ version: personalRatingBaseline.prefixVersion, sourceId: prefix.sourceId,
      sourceVersion: prefix.sourceVersion, snapshotId: prefix.snapshotId, support, ratings, excluded: Object.freeze(excluded),
      provenance: Object.freeze({ origin: prefix.provenance.origin, captureScope: prefix.provenance.captureScope }) }),
    candidatePool: Object.freeze({ snapshotId: pool.snapshotId, cutoffMicros: pool.cutoffMicros,
      candidateIds: Object.freeze([...pool.candidateIds]) }),
    config: Object.freeze({ version: input.config.version, shrinkage: input.config.shrinkage }), prior: admitted, priorDisposition,
    location: Object.freeze({ personalMean, residual }),
    identified: Object.freeze({ personalLocation: support > 0, responseSpread: false, contentDifferentiation: false }),
    forecasts: Object.freeze(pool.candidateIds.map(objectId => Object.freeze({ objectId, control, candidate }))),
  });
}
