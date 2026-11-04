import { describe, expect, it } from 'vitest';
import { forecastPersonalContentRating } from '../src/personal-content-rating.js';
import type { PersonalContentFeature, PersonalContentRatingInput } from '../src/personal-content-rating.js';

const cutoff = '1793606400000001';
const future = (BigInt(cutoff) + 1n).toString();
type Vector = readonly number[] | null;
function input(labels: readonly number[], vectors: readonly Vector[], candidates: readonly Vector[] = [[-1], [1]]): PersonalContentRatingInput {
  const dimensions = vectors.find(vector => vector !== null)?.length ?? candidates.find(vector => vector !== null)?.length ?? 1;
  const ratings = labels.map((value, i) => ({ sourceEventId: `event-${i}`, subjectId: 'subject', domainId: 'MOVIE',
    objectId: `rated-${i}`, value, occurredAtMicros: cutoff, availableAtMicros: cutoff }));
  const objects = [...vectors.map((values, i) => ({ objectId: `rated-${i}`, values })),
    ...candidates.map((values, i) => ({ objectId: `candidate-${i}`, values }))].map(row => ({ ...row,
    domainId: 'MOVIE', sourceId: `feature-source:${row.objectId}`, availableAtMicros: cutoff,
    status: row.values === null ? 'UNAVAILABLE' as const : 'AVAILABLE' as const }));
  return { subjectId: 'subject', domainId: 'MOVIE', cutoffMicros: cutoff,
    prefix: { sourceId: 'native-ratings', sourceVersion: 'resolver-v1', snapshotId: 'snapshot-v1', complete: true,
      provenance: { origin: 'synthetic', captureScope: 'ISOLATED_NATIVE_FIXTURE' }, ratings },
    candidatePool: { snapshotId: 'snapshot-v1', cutoffMicros: cutoff, candidateIds: candidates.map((_, i) => `candidate-${i}`) },
    config: { version: 'personal-native-location-v1', shrinkage: 2 }, prior: null,
    contentConfig: { version: 'personal-native-content-ridge-v1', ridge: 2 },
    content: { version: 'personal-content-feature-snapshot-v1', snapshotId: 'snapshot-v1', cutoffMicros: cutoff,
      sourceVersion: 'declared-assertions-v1', featureIds: Array.from({ length: dimensions }, (_, i) => `feature-${i}`), objects } };
}
function features(value: PersonalContentRatingInput, update: (row: PersonalContentFeature) => PersonalContentFeature): PersonalContentRatingInput {
  return { ...value, content: { ...value.content, objects: value.content.objects.map(update) } };
}
const values = (value: PersonalContentRatingInput) => forecastPersonalContentRating(value).forecasts.map(row => row.candidate.value);

describe('Personal content expected-rating challenger', () => {
  it('fits the independent one-dimensional squared-error ridge oracle around the unchanged Personal mean', () => {
    const result = forecastPersonalContentRating(input([2, 8], [[-1], [1]]));
    // Σz²=2, Σz(y−5)=6; β=6/(2+2)=1.5.
    expect(result.forecasts.map(row => row.control.value)).toEqual([5, 5]);
    expect(result.contentFit.coefficients[0]).toBeCloseTo(1.5, 12);
    expect(result.forecasts[0]!.candidate.value).toBeCloseTo(3.5, 12);
    expect(result.forecasts[1]!.candidate.value).toBeCloseTo(6.5, 12);
    expect(result.contentFit).toMatchObject({ status: 'FITTED', numericSupport: 2, featureSupport: 2,
      featureCoverage: 1, featureDimensions: 1, variedFeatureCount: 1,
      replayPolicy: 'REBUILD_FROM_COMPLETE_RESOLVED_PREFIX', parameterInterpretation: 'REGULARIZED_ASSOCIATION_NOT_LATENT_TASTE',
      cost: { trainingRows: 2, featureDimensions: 1, variedDimensions: 1, centeredScalarProducts: 2 } });
    expect(result).toMatchObject({ version: 'personal-content-rating-v1', capability: 'NUMERIC_CONTENT_POINT_V1',
      calibration: 'UNCALIBRATED', qualityAdmission: 'NONE', servingActivation: 'NONE',
      identified: { personalLocation: true, responseSpread: false } });
  });

  it('keeps missing-feature ratings in the control and forecast anchor without adding fake feature rows', () => {
    const result = forecastPersonalContentRating(input([2, 8, 10], [[-1], [1], null]));
    expect(result.contentFit.featureMeans).toEqual([0]);
    expect(result.contentFit.coefficients[0]).toBeCloseTo(1.5, 12);
    expect(result.contentFit).toMatchObject({ numericSupport: 3, featureSupport: 2, featureCoverage: 2 / 3,
      excluded: { unavailable: 1, withdrawn: 0, future: 0 } });
    expect(result.forecasts[0]!.control.value).toBe(20 / 3);
    expect(result.forecasts[0]!.candidate.value).toBeCloseTo(31 / 6, 12);
    expect(result.forecasts[1]!.candidate.value).toBeCloseTo(49 / 6, 12);
    expect(result.forecasts.every(row => row.candidate.prefixSupport === 3)).toBe(true);
  });

  it('preserves unsaturated positive-affine own-scale responses and within-Profile order', () => {
    const generous = values(input([0, 10], [[-1], [1]]));
    const strict = values(input([4, 8], [[-1], [1]]));
    expect(generous[0]).toBeLessThan(generous[1]!); expect(strict[0]).toBeLessThan(strict[1]!);
    strict.forEach((value, i) => expect(value).toBeCloseTo(4 + 0.4 * generous[i]!, 12));
    expect(strict).toEqual([5, 7]);
  });

  it('keeps a narrow rating range small without inventing a minimum style spread', () => {
    const result = forecastPersonalContentRating(input([6, 7], [[-1], [1]]));
    expect(result.contentFit.status).toBe('FITTED');
    expect(result.forecasts[0]!.candidate.value).toBeCloseTo(6.25, 12);
    expect(result.forecasts[1]!.candidate.value).toBeCloseTo(6.75, 12);
    expect(result.identified.responseSpread).toBe(false);
  });

  it('preserves all eleven constant integer grades with the supported location and no fabricated content effect', () => {
    for (let grade = 0; grade <= 10; grade++) {
      const result = forecastPersonalContentRating(input([grade, grade], [[-1], [1]]));
      expect(result.contentFit.status).toBe('CONSTANT_FEATURED_RATINGS');
      expect(result.contentFit.coefficients).toEqual([0]);
      expect(result.forecasts.every(row => row.candidate.value === grade && row.control.value === grade)).toBe(true);
      expect(result.forecasts.every(row => row.candidate.mode === 'PERSONAL_MEAN_FALLBACK')).toBe(true);
    }
  });

  it('distinguishes no numeric support, one featured rating and no featured ratings', () => {
    const empty = forecastPersonalContentRating(input([], []));
    expect(empty.contentFit).toMatchObject({ status: 'NO_NUMERIC_SUPPORT', featureCoverage: null, featureMeans: [0], coefficients: [0] });
    expect(empty.forecasts[0]!.candidate).toEqual({ value: null, status: 'UNAVAILABLE', mode: 'NO_NUMERIC_SUPPORT', prefixSupport: 0 });
    expect(empty.forecasts[0]!.contentDiagnostic).toEqual({ fallback: 'NO_NUMERIC_SUPPORT', rawValue: null, clipped: false, supportedFeatureCount: 0 });
    for (const value of [input([7], [[1]]), input([2, 8], [null, null])]) {
      const result = forecastPersonalContentRating(value);
      expect(result.contentFit.status).toBe('INSUFFICIENT_FEATURE_SUPPORT');
      expect(result.forecasts[0]!.candidate.value).toBe(result.forecasts[0]!.control.value);
    }
  });

  it('does not mistake rounding of a constant decimal feature for feature variation', () => {
    const result = forecastPersonalContentRating(input([1, 6, 9], [[0.1], [0.1], [0.1]]));
    expect(result.contentFit).toMatchObject({ status: 'NO_TRAINING_FEATURE_VARIATION', variedFeatureCount: 0,
      featureMeans: [0.1], coefficients: [0] });
    expect(result.forecasts.every(row => row.candidate.value === 16 / 3)).toBe(true);
  });

  it('separates missing, withdrawn and future training features while retaining every raw rating', () => {
    const value = features(input([2, 8, 10, 0, 6], [[-1], [1], null, null, [1]]), row => row.objectId === 'rated-3'
      ? { ...row, status: 'WITHDRAWN' } : row.objectId === 'rated-4' ? { ...row, availableAtMicros: future } : row);
    const result = forecastPersonalContentRating(value);
    expect(result.contentFit).toMatchObject({ numericSupport: 5, featureSupport: 2,
      excluded: { unavailable: 1, withdrawn: 1, future: 1 } });
    expect(result.contentFit.coefficients[0]).toBeCloseTo(1.5, 12);
    expect(result.forecasts[0]!.candidate.value).toBeCloseTo(26 / 5 - 1.5, 12);
  });

  it('falls back for missing/withdrawn/future candidate vectors without reducing numeric coverage', () => {
    const value = features(input([2, 8], [[-1], [1]], [null, null, [1]]), row => row.objectId === 'candidate-1'
      ? { ...row, status: 'WITHDRAWN' } : row.objectId === 'candidate-2' ? { ...row, availableAtMicros: future } : row);
    const result = forecastPersonalContentRating(value);
    expect(result.forecasts.map(row => row.contentDiagnostic.fallback)).toEqual(['FEATURE_UNAVAILABLE', 'FEATURE_WITHDRAWN', 'FUTURE_FEATURE']);
    expect(result.forecasts.every(row => row.candidate.value === 5 && row.candidate.status === 'AVAILABLE'
      && row.contentDiagnostic.rawValue === 5 && !row.contentDiagnostic.clipped)).toBe(true);
  });

  it('does not extrapolate an unseen-only or all-zero candidate into learned content preference', () => {
    const result = forecastPersonalContentRating(input([2, 8], [[-1, 0], [1, 0]], [[0, 1], [0, 0], [1, 1]]));
    expect(result.forecasts.map(row => row.contentDiagnostic.supportedFeatureCount)).toEqual([0, 0, 1]);
    expect(result.forecasts.map(row => row.contentDiagnostic.fallback)).toEqual(['NO_SUPPORTED_CONTENT_FEATURE', 'NO_SUPPORTED_CONTENT_FEATURE', 'NONE']);
    expect(result.forecasts[0]!.candidate.value).toBe(5);
    expect(result.forecasts[1]!.candidate.value).toBe(5);
    expect(result.forecasts[2]!.candidate.value).toBeCloseTo(6.5, 12);
  });

  it('retains a fitted zero association and exact ties for identical feature vectors', () => {
    const result = forecastPersonalContentRating(input([4, 8, 4], [[-1], [0], [1]], [[1], [1]]));
    expect(result.contentFit.status).toBe('FITTED'); expect(result.contentFit.coefficients).toEqual([0]);
    expect(result.forecasts[0]!.candidate).toEqual(result.forecasts[1]!.candidate);
    expect(result.forecasts[0]!.candidate.value).toBe(16 / 3);
  });

  it('never fits centering, coefficients or vocabulary from the candidate pool', () => {
    const first = forecastPersonalContentRating(input([2, 8], [[-1], [1]], [[-1], [1]]));
    const changed = forecastPersonalContentRating(input([2, 8], [[-1], [1]], [[0.01], [0.02], [1], [-0.8]]));
    expect(changed.contentFit).toEqual(first.contentFit);
    expect(changed.forecasts[2]!.candidate).toEqual(first.forecasts[1]!.candidate);
    expect(changed.content.featureIds).toEqual(first.content.featureIds);
  });

  it('records raw and clipped values without claiming affine equality after saturation', () => {
    const labels = [...Array<number>(10).fill(0), ...Array<number>(10).fill(10)];
    const vectors = [...Array.from({ length: 10 }, () => [-0.5]), ...Array.from({ length: 10 }, () => [0.5])];
    const result = forecastPersonalContentRating(input(labels, vectors));
    expect(result.contentFit.coefficients[0]).toBeCloseTo(50 / 7, 12);
    expect(result.forecasts.map(row => row.candidate.value)).toEqual([0, 10]);
    expect(result.forecasts.every(row => row.contentDiagnostic.clipped)).toBe(true);
    expect(result.forecasts[1]!.contentDiagnostic.rawValue).toBeCloseTo(85 / 7, 12);
    const strict = forecastPersonalContentRating(input(labels.map(value => 4 + 0.4 * value), vectors));
    expect(strict.forecasts[1]!.candidate.value).toBeCloseTo(62 / 7, 12);
    expect(strict.forecasts[1]!.candidate.value).not.toBe(4 + 0.4 * result.forecasts[1]!.candidate.value!);
  });

  it('handles collinear declared features without claiming statistical feature identification', () => {
    const result = forecastPersonalContentRating(input([2, 8], [[-1, -1], [1, 1]], [[-1, -1], [1, 1]]));
    expect(result.contentFit.coefficients[0]).toBeCloseTo(1, 12);
    expect(result.contentFit.coefficients[1]).toBeCloseTo(1, 12);
    expect(result.forecasts[0]!.candidate.value).toBeCloseTo(3, 12);
    expect(result.forecasts[1]!.candidate.value).toBeCloseTo(7, 12);
    expect(result.identified).toEqual({ personalLocation: true, responseSpread: false });
  });

  it('rebuilds sequential answers, correction, Undo and removal against independent one-dimensional batch oracles', () => {
    const histories = [[], [2], [2, 8], [2, 8, 6], [4, 8, 6], [2, 8, 6], [8, 6]];
    const historiesX = [[], [-1], [-1, 1], [-1, 1, 0.5], [-1, 1, 0.5], [-1, 1, 0.5], [1, 0.5]];
    const frozen = [];
    for (let i = 0; i < histories.length; i++) {
      const y = histories[i]!, x = historiesX[i]!, result = forecastPersonalContentRating(input(y, x.map(value => [value])));
      frozen.push(result);
      if (y.length < 2) continue;
      const mean = y.reduce((a, b) => a + b, 0) / y.length, xm = x.reduce((a, b) => a + b, 0) / x.length;
      const covariance = x.reduce((sum, value, j) => sum + (value - xm) * (y[j]! - mean), 0);
      const variance = x.reduce((sum, value) => sum + (value - xm) ** 2, 0), beta = covariance / (variance + 2);
      expect(result.forecasts[1]!.candidate.value).toBeCloseTo(Math.max(0, Math.min(10, mean + beta * (1 - xm))), 12);
    }
    expect(frozen[2]!.forecasts[0]!.candidate.value).toBeCloseTo(3.5, 12);
    expect(frozen[3]).toEqual(frozen[5]); // Exact canonical Undo rebuild.
    expect(frozen[4]!.contentFit.numericSupport).toBe(3);
    expect(frozen[6]!.contentFit.numericSupport).toBe(2);
  });

  it('keeps future target labels out until their exact native microsecond', () => {
    const before = input([2, 8], [[-1], [1]]);
    const futureLabel = { ...before.prefix.ratings[0]!, sourceEventId: 'later', objectId: 'later-rated', value: 0,
      occurredAtMicros: future, availableAtMicros: future };
    const heldOut = forecastPersonalContentRating({ ...before, prefix: { ...before.prefix, ratings: [...before.prefix.ratings, futureLabel] } });
    expect(heldOut.contentFit).toEqual(forecastPersonalContentRating(before).contentFit);
    expect(heldOut.prefix.excluded.future).toBe(1);
    const after = input([2, 8, 0], [[-1], [1], [1]]);
    expect(forecastPersonalContentRating(after).forecasts[1]!.candidate.value).toBeLessThan(heldOut.forecasts[1]!.candidate.value!);
  });

  it('is deterministic under source-array permutations and freezes copies of all source and fit data', () => {
    const value = input([2, 8], [[-1], [1]]), result = forecastPersonalContentRating(value);
    const permuted = { ...value, prefix: { ...value.prefix, ratings: [...value.prefix.ratings].reverse() },
      content: { ...value.content, objects: [...value.content.objects].reverse() } };
    expect(forecastPersonalContentRating(permuted)).toEqual(result);
    const before = JSON.stringify(result);
    Reflect.set(value.content.objects[0]!.values!, 0, 0);
    Reflect.set(value.prefix.ratings[0]!, 'value', 10);
    expect(JSON.stringify(result)).toBe(before);
    expect(Object.isFrozen(result.content.objects[0]!.values)).toBe(true);
    expect(Object.isFrozen(result.contentFit.coefficients)).toBe(true);
    expect(() => Reflect.set(result.contentFit.coefficients, 0, 9)).not.toThrow();
    expect(Reflect.set(result.forecasts[0]!.contentDiagnostic, 'rawValue', 99)).toBe(false);
    expect(JSON.stringify(result)).toBe(before);
  });

  it('supports a non-media domain and retains the separate subject and domain boundaries', () => {
    const original = input([2, 8], [[-1], [1]]);
    const portable = { ...original, domainId: 'BICYCLE', prefix: { ...original.prefix,
      ratings: original.prefix.ratings.map(row => ({ ...row, domainId: 'BICYCLE' })) }, content: { ...original.content,
      objects: original.content.objects.map(row => ({ ...row, domainId: 'BICYCLE' })) } };
    expect(values(portable)).toEqual(values(original));
    expect(() => forecastPersonalContentRating(features(original, row => ({ ...row, domainId: 'foreign' })))).toThrow(/scope/);
  });

  it('rejects incomplete/duplicate inventories, unbound snapshots, partial vectors and missingness disguised as zero', () => {
    const value = input([2, 8], [[-1], [1]]);
    expect(() => forecastPersonalContentRating({ ...value, content: { ...value.content, objects: value.content.objects.slice(1) } })).toThrow(/inventory/);
    expect(() => forecastPersonalContentRating({ ...value, content: { ...value.content,
      objects: [value.content.objects[0]!, value.content.objects[0]!, ...value.content.objects.slice(2)] } })).toThrow(/identity/);
    expect(() => forecastPersonalContentRating({ ...value, content: { ...value.content, snapshotId: 'other' } })).toThrow(/binding/);
    expect(() => forecastPersonalContentRating({ ...value, content: { ...value.content, cutoffMicros: future } })).toThrow(/binding/);
    expect(() => forecastPersonalContentRating(features(value, row => ({ ...row, values: [] })))).toThrow(/vector/);
    expect(() => forecastPersonalContentRating(features(value, row => ({ ...row, status: 'UNAVAILABLE', values: [0] })))).toThrow(/missingness/);
    expect(() => forecastPersonalContentRating(features(value, row => ({ ...row, values: [NaN] })))).toThrow(/vector/);
    expect(() => forecastPersonalContentRating(features(value, row => ({ ...row, values: [1.01] })))).toThrow(/vector/);
  });

  it('enforces declared numerical/dimension budgets without inventing quality or confidence thresholds', () => {
    const value = input([2, 8], [[-1], [1]]);
    for (const ridge of [0, Number.MIN_VALUE, 0.5, 1000001, NaN, Infinity])
      expect(() => forecastPersonalContentRating({ ...value, contentConfig: { ...value.contentConfig, ridge } })).toThrow(/ridge/);
    for (const ridge of [1, 1000000])
      expect(values({ ...value, contentConfig: { ...value.contentConfig, ridge } }).every(Number.isFinite)).toBe(true);
    const vectors = [Array<number>(32).fill(-1), Array<number>(32).fill(1)];
    expect(forecastPersonalContentRating(input([2, 8], vectors, vectors)).contentFit.featureDimensions).toBe(32);
    const excessive = [Array<number>(33).fill(-1), Array<number>(33).fill(1)];
    expect(() => forecastPersonalContentRating(input([2, 8], excessive, excessive))).toThrow(/schema/);
    expect(() => forecastPersonalContentRating({ ...value, prefix: { ...value.prefix,
      ratings: Array.from({ length: 8193 }, () => value.prefix.ratings[0]!) } })).toThrow(/bounded numeric prefix/);
  });
});
