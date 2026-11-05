import { shrunkRatingResidual } from './rating-location.js';

/** Undated, external matrix evidence. Deliberately not an E1 temporal Observation. */
export interface StaticResearchRating {
  readonly kind: 'undated-external-rating';
  readonly sourceId: string;
  readonly snapshotId: string;
  readonly subjectId: string;
  readonly objectId: string;
  readonly sourceOccurredAt: null;
  readonly original: { readonly value: number; readonly min: number; readonly max: number };
  readonly value: number;
}
export interface StaticRatingSpec {
  readonly sourceId: string;
  readonly snapshotId: string;
  readonly originalScale: { readonly min: number; readonly max: number };
  readonly scale: { readonly min: number; readonly max: number };
  readonly multiplier: number;
  readonly itemShrinkage: number;
  readonly subjectShrinkage: number;
}
export const staticRatingVariants = ['global-mean', 'item-mean', 'profile-offset'] as const;
export type StaticRatingVariant = typeof staticRatingVariants[number];
export interface StaticRatingArtifact {
  readonly schema: 'static-rating-research-v1';
  readonly admission: 'NONE';
  readonly spec: StaticRatingSpec;
  readonly globalMean: number;
  readonly trainingCount: number;
  readonly items: Readonly<Record<string, { readonly mean: number; readonly count: number }>>;
  readonly trainingPairs: Readonly<Record<string, true>>;
}
export interface StaticRatingForecast {
  readonly objectId: string;
  readonly values: Readonly<Record<StaticRatingVariant, number>>;
  readonly itemSupport: number;
  readonly visibleSupport: number;
  readonly calibration: 'uncalibrated';
}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function id(value: string, source: string): boolean {
  return typeof value === 'string' && value.startsWith(`${source}:`)
    && value.length > source.length + 1 && value.length <= 256 && !/[\r\n\0]/.test(value);
}
function validateSpec(s: StaticRatingSpec): void {
  check(typeof s.sourceId === 'string' && /^[a-z0-9][a-z0-9:._-]{0,127}$/.test(s.sourceId)
    && typeof s.snapshotId === 'string' && /^[a-f0-9]{64}$/.test(s.snapshotId), 'Invalid source snapshot');
  check([s.originalScale.min, s.originalScale.max, s.scale.min, s.scale.max].every(Number.isFinite)
    && s.originalScale.max > s.originalScale.min && s.scale.max > s.scale.min
    && Number.isFinite(s.multiplier) && s.multiplier > 0
    && s.originalScale.min * s.multiplier === s.scale.min
    && s.originalScale.max * s.multiplier === s.scale.max, 'Invalid explicit scale mapping');
  check([s.itemShrinkage, s.subjectShrinkage].every(x => Number.isFinite(x) && x > 0), 'Invalid shrinkage');
}
function validateRow(r: StaticResearchRating, s: StaticRatingSpec): void {
  check(r.kind === 'undated-external-rating' && r.sourceOccurredAt === null
    && r.sourceId === s.sourceId && r.snapshotId === s.snapshotId
    && id(r.subjectId, s.sourceId) && id(r.objectId, s.sourceId), 'Foreign or dated matrix evidence');
  check(r.original.min === s.originalScale.min && r.original.max === s.originalScale.max
    && Number.isFinite(r.original.value) && r.original.value >= r.original.min && r.original.value <= r.original.max
    && Number.isFinite(r.value) && r.value === r.original.value * s.multiplier
    && r.value >= s.scale.min && r.value <= s.scale.max, 'Invalid preserved source grade');
}
const pair = (subject: string, object: string) => `${subject}\n${object}`;

/** Fit only the caller's frozen training partition; no timestamps or sequence inference. */
export function fitStaticRatings(rows: readonly StaticResearchRating[], spec: StaticRatingSpec): StaticRatingArtifact {
  validateSpec(spec);
  check(rows.length > 0 && rows.length <= 100000, 'Training budget exceeded or empty');
  const sums = new Map<string, [number, number]>(), subjects = new Set<string>();
  const trainingPairs: Record<string, true> = Object.create(null);
  let total = 0;
  for (const r of rows) {
    validateRow(r, spec);
    const key = pair(r.subjectId, r.objectId);
    check(!Object.hasOwn(trainingPairs, key), 'Duplicate training pair');
    trainingPairs[key] = true; total += r.value; subjects.add(r.subjectId);
    const sum = sums.get(r.objectId) ?? [0, 0];
    sum[0] += r.value; sum[1]++; sums.set(r.objectId, sum);
    check(subjects.size <= 500 && sums.size <= 10000, 'Identity budget exceeded');
  }
  const globalMean = total / rows.length;
  check(Number.isFinite(globalMean), 'Nonfinite fitted mean');
  const items: Record<string, { mean: number; count: number }> = Object.create(null);
  for (const [key, [sum, count]] of sums) {
    const mean = (sum + spec.itemShrinkage * globalMean) / (count + spec.itemShrinkage);
    check(Number.isFinite(mean), 'Nonfinite item mean');
    items[key] = Object.freeze({ mean, count });
  }
  return Object.freeze({ schema: 'static-rating-research-v1', admission: 'NONE',
    spec: Object.freeze({ ...spec, scale: Object.freeze({ ...spec.scale }),
      originalScale: Object.freeze({ ...spec.originalScale }) }), globalMean, trainingCount: rows.length,
    items: Object.freeze(items), trainingPairs: Object.freeze(trainingPairs) });
}

/** Visible evidence is an unordered mask, not a temporal prefix. Targets have no label input. */
export function predictStaticRatings(artifact: StaticRatingArtifact, subjectId: string,
  visible: readonly StaticResearchRating[], objectIds: readonly string[]): StaticRatingForecast[] {
  check(artifact.schema === 'static-rating-research-v1' && artifact.admission === 'NONE', 'Invalid research artifact');
  const s = artifact.spec;
  validateSpec(s);
  check(id(subjectId, s.sourceId) && visible.length <= 10000 && objectIds.length > 0
    && objectIds.length <= 10000, 'Invalid query or budget');
  const seen = new Set<string>(), residuals: number[] = [];
  for (const r of visible) {
    validateRow(r, s);
    check(r.subjectId === subjectId && !seen.has(r.objectId), 'Foreign subject or duplicate visible pair');
    seen.add(r.objectId);
    residuals.push(r.value - (artifact.items[r.objectId]?.mean ?? artifact.globalMean));
  }
  const offset = shrunkRatingResidual(residuals, s.subjectShrinkage), targets = new Set<string>();
  return objectIds.map(objectId => {
    check(id(objectId, s.sourceId) && !seen.has(objectId) && !targets.has(objectId)
      && !Object.hasOwn(artifact.trainingPairs, pair(subjectId, objectId)), 'Target leakage or invalid target');
    targets.add(objectId);
    const item = artifact.items[objectId], base = item?.mean ?? artifact.globalMean;
    const values = { 'global-mean': artifact.globalMean, 'item-mean': base,
      'profile-offset': Math.min(s.scale.max, Math.max(s.scale.min, base + offset)) };
    check(Object.values(values).every(x => Number.isFinite(x) && x >= s.scale.min && x <= s.scale.max),
      'Invalid forecast');
    return { objectId, values, itemSupport: item?.count ?? 0, visibleSupport: visible.length,
      calibration: 'uncalibrated' };
  });
}
