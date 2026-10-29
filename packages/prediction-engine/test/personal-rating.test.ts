import { describe, expect, it } from 'vitest';
import { forecastPersonalRatingBaseline, personalRatingBaseline } from '../src/personal-rating.js';
import type { DomainRatingPrior, PersonalRatingBaselineInput, ResolvedPersonalRating } from '../src/personal-rating.js';
import { shrunkRatingResidual } from '../src/rating-location.js';

const cutoff = '1793275200000001';
const earlier = (BigInt(cutoff) - 1n).toString();
const later = (BigInt(cutoff) + 1n).toString();
const row = (value: number, objectId = 'object-1', extra: Partial<ResolvedPersonalRating> = {}): ResolvedPersonalRating => ({
  sourceEventId: `event-${objectId}`, subjectId: 'personal-1', domainId: 'movie', objectId, value,
  occurredAtMicros: earlier, availableAtMicros: earlier, ...extra,
});
const prior = (extra: Partial<DomainRatingPrior> = {}): DomainRatingPrior => ({
  sourceId: 'domain-prior', sourceVersion: 'domain-prior-v1', artifactId: 'artifact-1', domainId: 'movie',
  value: 6, availableAtMicros: earlier, permission: 'PERMITTED', ...extra,
});
const input = (ratings: readonly ResolvedPersonalRating[] = [], extra: Partial<PersonalRatingBaselineInput> = {}): PersonalRatingBaselineInput => ({
  subjectId: 'personal-1', domainId: 'movie', cutoffMicros: cutoff,
  prefix: { sourceId: 'native-events', sourceVersion: 'resolver-v1', snapshotId: 'prefix-1', complete: true, ratings,
    provenance: { origin: 'synthetic', captureScope: 'ISOLATED_NATIVE_FIXTURE' } },
  candidatePool: { snapshotId: 'prefix-1', cutoffMicros: cutoff, candidateIds: ['next-1', 'next-2'] },
  config: { version: 'shrinkage-v1', shrinkage: 2 }, prior: null, ...extra,
});
const first = (value: PersonalRatingBaselineInput) => forecastPersonalRatingBaseline(value).forecasts[0]!;

describe('Personal own-scale numeric point baseline', () => {
  it('preserves every integer rating from 0 through 10 without bucketing', () => {
    for (let value = 0; value <= 10; value++) {
      const source = row(value), result = forecastPersonalRatingBaseline(input([source]));
      expect(result.forecasts[0]!.control.value).toBe(value);
      expect(result.forecasts[0]!.candidate.value).toBe(value);
      expect(result.prefix.ratings).toEqual([source]);
      expect(source.value).toBe(value);
    }
  });

  it('retains a true personal mean, numeric zero and honest ties across the complete pool', () => {
    const result = forecastPersonalRatingBaseline(input([row(0), row(5, 'object-2'), row(10, 'object-3')]));
    expect(result.prefix.support).toBe(3);
    expect(result.location).toEqual({ personalMean: 5, residual: null });
    expect(result.forecasts).toHaveLength(2);
    expect(result.forecasts.map(f => f.control.value)).toEqual([5, 5]);
    expect(result.forecasts.map(f => f.candidate.value)).toEqual([5, 5]);
    expect(result.forecasts[0]!.candidate.mode).toBe('PERSONAL_MEAN_FALLBACK');
    expect(result).toMatchObject({ capability: 'NUMERIC_POINT_BASELINE_V1', calibration: 'UNCALIBRATED',
      qualityAdmission: 'NONE', servingActivation: 'NONE',
      identified: { personalLocation: true, responseSpread: false, contentDifferentiation: false } });
    expect(first(input([row(0)])).control.value).toBe(0);
    expect(first(input([row(0)])).candidate.value).toBe(0);
  });

  it('uses the D2 residual equation with explicit shrinkage and source lineage', () => {
    const result = forecastPersonalRatingBaseline(input([row(0), row(10, 'object-2')], { prior: prior() }));
    expect(result.location).toEqual({ personalMean: 5, residual: -0.5 });
    expect(result.forecasts[0]!.candidate).toEqual({ value: 5.5, status: 'AVAILABLE', mode: 'SHRUNK_PERSONAL_RESIDUAL', prefixSupport: 2 });
    expect(result.prior).toEqual(prior());
    expect(result.config).toEqual({ version: 'shrinkage-v1', shrinkage: 2 });
    expect(result.prefix).toMatchObject({ version: personalRatingBaseline.prefixVersion, sourceId: 'native-events',
      sourceVersion: 'resolver-v1', snapshotId: 'prefix-1',
      provenance: { origin: 'synthetic', captureScope: 'ISOLATED_NATIVE_FIXTURE' } });
    const residuals = [-6, 4, -1];
    expect(shrunkRatingResidual(residuals, 3)).toBe(residuals.reduce((a, b) => a + b, 0) / (residuals.length + 3));
    expect(shrunkRatingResidual([], 3)).toBe(0);
  });

  it('excludes each 0/5/10 answer before its native microsecond and changes only later snapshots', () => {
    const baseline = input([row(4)]), original = forecastPersonalRatingBaseline(baseline);
    for (const value of [0, 5, 10]) {
      const answer = row(value, 'answered-target', { occurredAtMicros: later, availableAtMicros: later });
      const sameCutoff = forecastPersonalRatingBaseline(input([...baseline.prefix.ratings, answer]));
      expect(sameCutoff.forecasts).toEqual(original.forecasts);
      expect(sameCutoff.prefix.excluded.future).toBe(1);
      const afterAnswer = forecastPersonalRatingBaseline(input([...baseline.prefix.ratings, answer], {
        cutoffMicros: later, candidatePool: { ...baseline.candidatePool, cutoffMicros: later },
      }));
      expect(afterAnswer.forecasts[0]!.control.value).toBe((4 + value) / 2);
      expect(afterAnswer.prefix.support).toBe(2);
      expect(original.forecasts[0]!.control.value).toBe(4);
    }
  });

  it('keeps native cutoff equality and ignores either future occurrence or availability', () => {
    const ratings = [row(0, 'accepted', { occurredAtMicros: cutoff, availableAtMicros: cutoff }),
      row(10, 'future-occurrence', { occurredAtMicros: later }),
      row(10, 'future-availability', { availableAtMicros: later })];
    const result = forecastPersonalRatingBaseline(input(ratings));
    expect(result.forecasts[0]!.control.value).toBe(0);
    expect(result.prefix).toMatchObject({ support: 1, excluded: { future: 2 } });
    expect(result.prefix.ratings[0]!.availableAtMicros).toBe(cutoff);
  });

  it('never borrows another subject/domain or lets repeated rows multiply support', () => {
    const original = row(0), duplicate = { ...original };
    const result = forecastPersonalRatingBaseline(input([original, duplicate,
      row(10, 'foreign-subject', { subjectId: 'shared-1' }), row(10, 'foreign-domain', { domainId: 'book' })]));
    expect(result.prefix).toMatchObject({ support: 1, excluded: { foreignSubject: 1, foreignDomain: 1, duplicate: 1, future: 0 } });
    expect(result.forecasts[0]!.candidate.value).toBe(0);
    expect(result.prefix.ratings).toEqual([original]);
    expect(forecastPersonalRatingBaseline(input([duplicate, original])).forecasts).toEqual(result.forecasts);
  });

  it('does not choose between conflicting source Events or unresolved contributions for one Item', () => {
    for (const conflict of [row(10), row(0, 'other-item', { sourceEventId: row(0).sourceEventId }),
      row(0, 'object-1', { sourceEventId: 'correction-event' })]) {
      expect(() => forecastPersonalRatingBaseline(input([row(0), conflict]))).toThrow(/Conflicting duplicate/);
    }
    const original = first(input([row(0)]));
    const corrected = first(input([row(10, 'object-1', { sourceEventId: 'correction-event' })]));
    expect(original.control.value).toBe(0);
    expect(corrected.control).toMatchObject({ value: 10, prefixSupport: 1 });
  });

  it('accepts canonical rebuilds after correction, Undo, clear or withdrawal without rewriting old forecasts', () => {
    // The core never independently interprets distinct-Event receipt lineage.
    const before = forecastPersonalRatingBaseline(input([row(2), row(8, 'object-2')]));
    const correction = input([row(6, 'object-1', { sourceEventId: 'corrected' }), row(8, 'object-2')]);
    expect(first(correction).control.value).toBe(7);
    const undoRebuild = input([row(2), row(8, 'object-2')]);
    expect(forecastPersonalRatingBaseline(undoRebuild)).toEqual(before);
    const clearedRebuild = input([row(8, 'object-2')]);
    expect(first(clearedRebuild).control).toMatchObject({ value: 8, prefixSupport: 1 });
    expect(first(input()).control).toMatchObject({ value: null, status: 'UNAVAILABLE' });
    expect(before.forecasts[0]!.control.value).toBe(5);
  });

  it('keeps sparse and constant supported locations without inventing spread or differentiated taste', () => {
    for (const value of [0, 4, 8, 10]) for (const size of [1, 2, 25]) {
      const ratings = Array.from({ length: size }, (_, i) => row(value, `item-${i}`));
      const result = forecastPersonalRatingBaseline(input(ratings, { prior: prior() }));
      expect(result.forecasts[0]!.control.value).toBe(value);
      expect(result.forecasts[0]!.candidate.value).toBeCloseTo(6 + size * (value - 6) / (size + 2));
      expect(result.forecasts[0]!.candidate.value).toBeGreaterThanOrEqual(0);
      expect(result.forecasts[0]!.candidate.value).toBeLessThanOrEqual(10);
      expect(result.identified).toEqual({ personalLocation: true, responseSpread: false, contentDifferentiation: false });
    }
  });

  it('preserves corresponding affine own-scale locations without calling 8 love or 4 hatred', () => {
    const generous = first(input([row(0), row(10, 'other')], { prior: prior({ value: 5 }) }));
    const strict = first(input([row(4), row(8, 'other')], { prior: prior({ value: 6 }) }));
    expect(strict.control.value).toBe(4 + 0.4 * generous.control.value!);
    expect(strict.candidate.value).toBe(4 + 0.4 * generous.candidate.value!);
  });

  it('uses only an explicitly permitted available domain prior, otherwise the native mean', () => {
    const cases: [DomainRatingPrior | null, string][] = [
      [null, 'ABSENT'], [prior({ permission: 'UNAVAILABLE' }), 'UNAVAILABLE'],
      [prior({ permission: 'WITHDRAWN' }), 'WITHDRAWN'], [prior({ domainId: 'book' }), 'FOREIGN_DOMAIN'],
      [prior({ availableAtMicros: later }), 'FUTURE'],
    ];
    for (const [supplied, disposition] of cases) {
      const result = forecastPersonalRatingBaseline(input([row(0)], { prior: supplied }));
      expect(result.priorDisposition).toBe(disposition);
      expect(result.prior).toBeNull();
      expect(result.forecasts[0]!.candidate).toMatchObject({ value: 0, mode: 'PERSONAL_MEAN_FALLBACK' });
    }
    expect(first(input([], { prior: prior({ availableAtMicros: cutoff, value: 7.5 }) })).candidate)
      .toMatchObject({ value: 7.5, mode: 'DOMAIN_PRIOR_ONLY', prefixSupport: 0 });
  });

  it('distinguishes no native support from prior-only support and fully unavailable output', () => {
    const noLabels = forecastPersonalRatingBaseline(input([], { prior: prior() }));
    expect(noLabels.forecasts[0]!.control).toMatchObject({ value: null, status: 'UNAVAILABLE', mode: 'NO_NUMERIC_SUPPORT' });
    expect(noLabels.forecasts[0]!.candidate).toMatchObject({ value: 6, status: 'AVAILABLE', mode: 'DOMAIN_PRIOR_ONLY' });
    expect(noLabels.identified.personalLocation).toBe(false);
    expect(first(input()).candidate).toMatchObject({ value: null, status: 'UNAVAILABLE', mode: 'NO_NUMERIC_SUPPORT' });
    expect(forecastPersonalRatingBaseline(input()).capability).toBe('NUMERIC_POINT_UNAVAILABLE_V1');
    const emptyPool = forecastPersonalRatingBaseline(input([row(0)], {
      candidatePool: { snapshotId: 'prefix-1', cutoffMicros: cutoff, candidateIds: [] },
    }));
    expect(emptyPool.forecasts).toEqual([]);
    expect(emptyPool.capability).toBe('NUMERIC_POINT_UNAVAILABLE_V1');
    expect(emptyPool.prefix.support).toBe(1);
  });

  it('freezes copied source values, pool and configuration against caller mutation', () => {
    const source = { ...row(4) }, suppliedPrior = { ...prior() };
    const value = input([source], { prior: suppliedPrior });
    const result = forecastPersonalRatingBaseline(value), encoded = JSON.stringify(result);
    source.value = 10; suppliedPrior.value = 0;
    expect(JSON.stringify(result)).toBe(encoded);
    for (const frozen of [result, result.prefix, result.prefix.ratings, result.prefix.ratings[0], result.candidatePool,
      result.candidatePool.candidateIds, result.config, result.prior, result.location, result.identified,
      result.forecasts, result.forecasts[0], result.forecasts[0]!.candidate]) expect(Object.isFrozen(frozen)).toBe(true);
  });

  it('makes ordering and repeated calls deterministic without fitting or accumulating another observation', () => {
    const a = row(0), b = row(9, 'object-2'), value = input([b, a], { prior: prior({ value: 5.7 }) });
    const firstResult = forecastPersonalRatingBaseline(value);
    expect(forecastPersonalRatingBaseline(value)).toEqual(firstResult);
    expect(forecastPersonalRatingBaseline(input([a, b], { prior: prior({ value: 5.7 }) }))).toEqual(firstResult);
    expect(firstResult.prefix.support).toBe(2);
  });

  it('rejects missing prefixes, mixed clocks, invalid raw labels, missing versions and malformed priors', () => {
    const base = input();
    expect(() => forecastPersonalRatingBaseline({ ...base, prefix: { ...base.prefix, complete: false } })).toThrow(/complete/);
    expect(() => forecastPersonalRatingBaseline({ ...base, prefix: { ...base.prefix,
      provenance: { origin: 'observed', captureScope: 'ISOLATED_NATIVE_FIXTURE' } } })).toThrow(/evidence origin/);
    expect(() => forecastPersonalRatingBaseline({ ...base, candidatePool: { ...base.candidatePool, cutoffMicros: later } })).toThrow(/cutoff/);
    expect(() => forecastPersonalRatingBaseline({ ...base, candidatePool: { ...base.candidatePool, snapshotId: 'other-snapshot' } })).toThrow(/snapshot/);
    for (const shrinkage of [0, -1, NaN, Infinity]) expect(() => first(input([], { config: { version: 'v1', shrinkage } }))).toThrow(/shrinkage/);
    expect(() => first(input([], { config: { version: '', shrinkage: 2 } }))).toThrow(/version/);
    for (const value of [-1, 11, NaN, Infinity, 0.5]) expect(() => first(input([row(value)]))).toThrow(/original numeric/);
    for (const micros of ['-1', '01', '1e12', '1.5', '253402300800000000']) {
      expect(() => first(input([], { cutoffMicros: micros }))).toThrow(/clock/);
    }
    expect(() => first(input([], { prior: prior({ value: NaN }) }))).toThrow(/prior/);
    expect(() => first(input([], { prior: prior({ sourceVersion: '' }) }))).toThrow(/prior/);
    expect(() => first(input([], { prior: prior({ permission: 'UNAVAILABLE', availableAtMicros: 'bad' }) }))).toThrow(/clock/);
    expect(() => first(input([], { candidatePool: { ...base.candidatePool, candidateIds: ['same', 'same'] } }))).toThrow(/duplicate candidate/);
  });
});
