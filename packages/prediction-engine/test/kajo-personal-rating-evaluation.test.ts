import { describe, expect, it } from 'vitest';
import { normalizeKajoPersonalRatingEvaluationInventory as normalize } from '../src/adapters/kajo-personal-rating-evaluation.js';
import { normalizeKajoPersonalRatingProspectivePrefix } from '../src/adapters/kajo-personal-rating-prospective.js';
import { forecastPersonalRatingBaseline } from '../src/personal-rating.js';

const id = (n: number) => `a4020000-0000-4000-8000-${String(n).padStart(12, '0')}`;
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };
function fixture(rating = 0) {
  const snapshotId = `native-prospective:${'a'.repeat(32)}`, cutoff = '1793275200000000';
  const input = {
    version: 'kajo-personal-rating-prospective-prefix-v1' as const, captureScope: 'PRIVATE_NATIVE_EVALUATION' as const,
    evidenceOrigin: 'synthetic' as const, forecastId: id(6), sourcePredictionId: id(7), targetItemId: id(5),
    snapshotId, complete: true as const, profile: { id: id(2), type: 'PERSONAL' as const, ownerUserId: id(1) }, actorUserId: id(1),
    itemType: 'BOOK' as const, cutoffMicros: cutoff,
    source: { signature: 'private.personal_source_evidence_v1(uuid,timestamp with time zone)' as const, bodyMd5: 'b'.repeat(32) },
    labels: [{ itemId: id(3), sourceEventId: id(4), sourceStatus: 'NATIVE_RATING' as const, orderingBasis: 'CANONICAL_RECEIPT_LINEAGE' as const,
      event: { id: id(4), actorUserId: id(1), profileId: id(2), itemId: id(3), itemType: 'BOOK' as const,
        eventType: 'ITEM_RATED' as const, rating: 7, occurredAtMicros: cutoff, availableAtMicros: cutoff } }],
    candidatePool: { snapshotId, cutoffMicros: cutoff, kind: 'FROZEN_DELIVERED_PERSONAL_POOL' as const, sourcePredictionId: id(7),
      items: [{ id: id(5), itemType: 'BOOK' as const, availableAtMicros: cutoff, discoverable: true as const }] },
  };
  const forecast = structuredClone(forecastPersonalRatingBaseline(normalizeKajoPersonalRatingProspectivePrefix(input))) as
    Mutable<ReturnType<typeof forecastPersonalRatingBaseline>>;
  const preparation = { version: 'kajo-personal-rating-preparation-v1', forecastId: id(6), sourcePredictionId: id(7),
    targetItemId: id(5), itemType: 'BOOK', cutoffMicros: cutoff, horizonEndMicros: '1793278800000000', requestHash: 'c'.repeat(32),
    input, config: { version: 'personal-native-location-v1', shrinkage: 2 }, forecast,
    cohort: 'FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN', selection: 'ONE_PREDECLARED_TARGET_FROM_COMPLETE_DELIVERED_POOL',
    qualityAdmission: 'NONE', servingActivation: 'NONE' };
  const inspection = { version: 'personal-rating-inspection-v1', forecastId: id(6), status: 'AVAILABLE', coverage: 'MEASURED_FIRST_RATING',
    preparation, firstAnswer: { version: 'personal-rating-first-answer-v1', forecastId: id(6), targetItemId: id(5), actionId: id(8), rating,
      acceptedAtMicros: '1793275200000001', measurement: { controlSquaredError: (7 - rating) ** 2, candidateSquaredError: (7 - rating) ** 2,
        controlAbsoluteError: Math.abs(7 - rating), candidateAbsoluteError: Math.abs(7 - rating) }, coverage: 'MEASURED_FIRST_RATING' },
    currentCanonicalState: { sourceStatus: 'NATIVE_RATING', sourceEventId: id(8), rating: 9 } };
  const binding = { origin: 'synthetic' as const, horizonSeconds: 3600,
    sourceVersions: { source: `personal-source-evidence-v1:${'b'.repeat(32)}`, model: 'personal-domain-mean-v1', control: 'personal-domain-mean-v1:PERSONAL_MEAN' },
    roster: [{ actorUserId: id(1), profileId: id(2), subjectId: 'fixture:subject' }],
    opportunities: [{ opportunityId: 'fixture:opportunity', actorUserId: id(1), profileId: id(2), sourcePredictionId: id(7),
      forecastId: id(6), targetItemId: id(5), objectId: 'fixture:item', domainId: 'BOOK' as const,
      attemptedAtMicros: cutoff, captureStatus: 'CAPTURED' as 'CAPTURED' | 'CAPTURE_UNAVAILABLE' | 'NOT_ATTEMPTED' }] };
  const census = { version: 'kajo-personal-rating-census-v1' as const, observedAtMicros: '1793280000000000', owners: [{
    version: 'kajo-personal-rating-owner-census-v1' as const, actorUserId: id(1), profileId: id(2), observedAtMicros: '1793280000000000',
    allocations: [{ id: id(6), sourcePredictionId: id(7), actorUserId: id(1), profileId: id(2), requestHash: 'c'.repeat(32), inspection }] }] };
  return { binding, census, input, forecast, preparation, inspection };
}
describe('Declared native numeric inventory', () => {
  it('retains all eleven immutable first grades and keeps current correction diagnostic separate', () => {
    for (let rating = 0; rating <= 10; rating++) {
      const { binding, census } = fixture(rating), actual = normalize(binding, census);
      expect(actual.complete).toBe(true);
      expect(actual.opportunities[0]).toMatchObject({ opportunityId: 'fixture:opportunity', subjectId: 'fixture:subject',
        objectId: 'fixture:item', firstAnswer: { rating, acceptedAtMicros: '1793275200000001' }, currentRating: 9,
        forecasts: { candidate: 7, control: 7 }, prefixSupport: 1 });
      expect(JSON.stringify(actual)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/u);
      expect(actual.reconciliation.nativeInventoryCompleteness).toBe('NOT_ESTABLISHED_BY_FILE');
      expect(Object.isFrozen(actual.opportunities[0]?.forecasts)).toBe(true);
    }
  });
  it('preserves missing, explicitly unavailable and unattempted opportunities without fabricating native failure', () => {
    const { binding, census } = fixture(); census.owners[0]!.allocations = [];
    const absent = normalize(binding, census);
    expect(absent.complete).toBe(false); expect(absent.reconciliation.missingExpectedCaptures).toBe(1);
    expect(absent.opportunities[0]?.captureStatus).toBe('MISSING_EXPECTED_CAPTURE');
    for (const status of ['CAPTURE_UNAVAILABLE', 'NOT_ATTEMPTED'] as const) {
      binding.opportunities[0]!.captureStatus = status;
      const declared = normalize(binding, census);
      expect(declared.complete).toBe(true); expect(declared.opportunities[0]?.captureStatus).toBe(status);
      expect(declared.opportunities[0]?.forecasts).toBe(null);
      expect(declared.reconciliation.attemptLedgerEvidence).toBe('SUPPLIED_DECLARATION_NOT_NATIVE_FAILURE_PROOF');
    }
  });
  it('keeps withdrawal grouped and unavailable even at an earlier evaluation cut', () => {
    const { binding, census } = fixture();
    Object.assign(census.owners[0]!.allocations[0]!.inspection, { status: 'WITHDRAWN', coverage: 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT',
      preparation: null, firstAnswer: null, currentCanonicalState: null });
    const row = normalize(binding, census).opportunities[0]!;
    expect(row.captureStatus).toBe('SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT');
    expect(row.firstAnswer).toBe(null); expect(row.forecasts).toBe(null); expect(row.horizonEndMicros).toBe(null);
  });
  it('detects undeclared retained tombstones and missing zero-opportunity owner censuses', () => {
    const { binding, census } = fixture();
    binding.roster.push({ actorUserId: id(20), profileId: id(21), subjectId: 'fixture:zero' });
    const extra = structuredClone(census.owners[0]!.allocations[0]!); extra.id = id(30); extra.sourcePredictionId = id(31);
    census.owners[0]!.allocations.push(extra);
    const result = normalize(binding, census);
    expect(result.complete).toBe(false);
    expect(result.reconciliation).toMatchObject({ undeclaredAllocations: 1, missingOwnerCensuses: 1, status: 'UNRESOLVED' });
  });
  it('keeps the cohort ledger budget independent of the per-owner retained allocation quota', () => {
    const { binding, census } = fixture(), base = binding.opportunities[0]!;
    census.owners[0]!.allocations = [];
    binding.opportunities = Array.from({ length: 256 }, (_, i) => ({ ...base,
      opportunityId: `fixture:opportunity-${i}`, forecastId: id(1000 + i * 3), sourcePredictionId: id(1001 + i * 3),
      targetItemId: id(1002 + i * 3), objectId: `fixture:item-${i}`, captureStatus: 'NOT_ATTEMPTED' }));
    const result = normalize(binding, census);
    expect(result.complete).toBe(true); expect(result.reconciliation.declaredNotAttempted).toBe(256);
    binding.opportunities = Array.from({ length: 4097 }, () => base);
    expect(() => normalize(binding, census)).toThrow('declared budgets');
  });
  it('retains the earliest owner observation so a newer owner cannot certify an older read at a later cut', () => {
    const { binding, census } = fixture();
    binding.roster.push({ actorUserId: id(20), profileId: id(21), subjectId: 'fixture:zero' });
    census.owners.push({ version: 'kajo-personal-rating-owner-census-v1', actorUserId: id(20), profileId: id(21),
      observedAtMicros: '1793275200000100', allocations: [] });
    const result = normalize(binding, census);
    expect(result.complete).toBe(true);
    expect(result.observedAtMicros).toBe('1793280000000000');
    expect(result.observedThroughMicros).toBe('1793275200000100');
  });
  it('tolerates decimal measurement roundoff without weakening config bindings or materially changed errors', () => {
    const f = fixture(3);
    f.forecast.forecasts[0]!.candidate.value = 3.4; f.forecast.forecasts[0]!.control.value = 3.4;
    f.forecast.location.personalMean = 3.4;
    Object.assign(f.inspection.firstAnswer.measurement, { candidateSquaredError: 0.16, controlSquaredError: 0.16,
      candidateAbsoluteError: 0.4, controlAbsoluteError: 0.4 });
    expect(normalize(f.binding, f.census).opportunities[0]?.firstAnswer?.rating).toBe(3);
    f.inspection.firstAnswer.measurement.candidateSquaredError += 1e-6;
    expect(() => normalize(f.binding, f.census)).toThrow('frozen measurement');
    const config = fixture(); config.preparation.config.shrinkage += 1e-13;
    expect(() => normalize(config.binding, config.census)).toThrow('preparation binding');
  });
  it('treats numeric-unavailable cold forecasts separately from pending or answered coverage', () => {
    const f = fixture(); f.input.labels = [];
    f.preparation.forecast = structuredClone(forecastPersonalRatingBaseline(normalizeKajoPersonalRatingProspectivePrefix(f.input))) as
      Mutable<ReturnType<typeof forecastPersonalRatingBaseline>>;
    f.inspection.coverage = 'NO_NUMERIC_FORECAST'; f.inspection.firstAnswer.coverage = 'NO_NUMERIC_FORECAST';
    Object.assign(f.inspection.firstAnswer.measurement, { controlSquaredError: null, candidateSquaredError: null,
      controlAbsoluteError: null, candidateAbsoluteError: null });
    const row = normalize(f.binding, f.census).opportunities[0]!;
    expect(row.firstAnswer?.rating).toBe(0); expect(row.forecasts).toEqual({ candidate: null, control: null });
    expect(row.prefixSupport).toBe(0);
    Object.assign(f.inspection, { firstAnswer: null, coverage: 'UNANSWERED_EXPIRED' });
    const pending = normalize(f.binding, f.census).opportunities[0]!;
    expect(pending.firstAnswer).toBe(null); expect(pending.captureStatus).toBe('AVAILABLE');
  });
  it('rejects changed scope, source/model/config, selection and duplicate native identities before aliasing', () => {
    const changes: ((f: ReturnType<typeof fixture>) => void)[] = [
      f => { f.binding.sourceVersions.source = `personal-source-evidence-v1:${'d'.repeat(32)}`; },
      f => { f.binding.sourceVersions.control = 'rank-score'; },
      f => { f.preparation.config.shrinkage = 3; },
      f => { f.input.profile.ownerUserId = id(99); },
      f => { f.input.evidenceOrigin = 'observed' as 'synthetic'; },
      f => { f.preparation.requestHash = 'd'.repeat(32); },
      f => { f.preparation.targetItemId = id(99); },
      f => { f.preparation.horizonEndMicros = '1793278800000001'; },
      f => { f.forecast.prefix.support = 99; },
      f => { f.forecast.prefix.ratings[0]!.value = 8; },
      f => { f.forecast.candidatePool.candidateIds[0] = id(99); },
      f => { f.binding.opportunities.push(structuredClone(f.binding.opportunities[0]!)); },
      f => { f.census.owners.push(structuredClone(f.census.owners[0]!)); },
      f => { f.census.owners[0]!.allocations.push(structuredClone(f.census.owners[0]!.allocations[0]!)); },
      f => { f.binding.roster[0]!.subjectId = id(99); },
      f => { f.binding.opportunities[0]!.opportunityId = f.binding.roster[0]!.subjectId; },
      f => { f.binding.opportunities[0]!.captureStatus = 'NOT_ATTEMPTED'; },
    ];
    for (const change of changes) { const f = fixture(); change(f); expect(() => normalize(f.binding, f.census)).toThrow(); }
  });
  it('rejects substituted current answers, malformed measurements and one-microsecond boundary violations', () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => { f.inspection.firstAnswer.rating = 5.5; },
      (f: ReturnType<typeof fixture>) => { f.inspection.firstAnswer.acceptedAtMicros = f.preparation.cutoffMicros; },
      (f: ReturnType<typeof fixture>) => { f.inspection.firstAnswer.acceptedAtMicros = '1793278800000001'; },
      (f: ReturnType<typeof fixture>) => { f.inspection.firstAnswer.measurement.candidateSquaredError = 0; },
      (f: ReturnType<typeof fixture>) => { f.inspection.firstAnswer.rating = f.inspection.currentCanonicalState.rating; },
      (f: ReturnType<typeof fixture>) => { f.census.owners[0]!.observedAtMicros = f.preparation.cutoffMicros; },
      (f: ReturnType<typeof fixture>) => { f.inspection.firstAnswer.targetItemId = id(99); },
    ]) { const f = fixture(); change(f); expect(() => normalize(f.binding, f.census)).toThrow(); }
  });
});
