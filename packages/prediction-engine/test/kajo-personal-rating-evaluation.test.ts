import { describe, expect, it } from 'vitest';
import { normalizeKajoPersonalRatingEvaluationInventory as normalize } from '../src/adapters/kajo-personal-rating-evaluation.js';
import { normalizeKajoPersonalRatingProspectivePrefix } from '../src/adapters/kajo-personal-rating-prospective.js';
import { forecastPersonalRatingBaseline } from '../src/personal-rating.js';
import { normalizeKajoPersonalContentRatingPrefix, personalContentFeatureContract } from '../src/adapters/kajo-personal-content-rating.js';
import type { KajoPersonalContentRatingPrefix } from '../src/adapters/kajo-personal-content-rating.js';
import { forecastPersonalContentRating } from '../src/personal-content-rating.js';
import { normalizeKajoOwnedTasteRatingPrefix } from '../src/adapters/kajo-owned-taste-rating.js';
import type { KajoOwnedTasteRatingPrefix } from '../src/adapters/kajo-owned-taste-rating.js';

const id = (n: number) => `a4020000-0000-4000-8000-${String(n).padStart(12, '0')}`;
type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
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
function contentFixture(rating = 0) {
  const old = fixture(rating), cutoff = old.input.cutoffMicros;
  old.input.snapshotId = old.input.snapshotId.replace('native-prospective:', 'native-content-prospective:');
  old.input.candidatePool.snapshotId = old.input.snapshotId;
  const label = structuredClone(old.input.labels[0]!);
  Object.assign(label, { itemId: id(33), sourceEventId: id(34) });
  Object.assign(label.event, { id: id(34), itemId: id(33), rating: 2 });
  const input: Mutable<KajoPersonalContentRatingPrefix> = { ...old.input, version: 'kajo-personal-content-rating-prefix-v1',
    labels: [{ ...old.input.labels[0]!, event: { ...old.input.labels[0]!.event, rating: 8 } }, label],
    contentFeatures: { version: 'kajo-personal-content-features-v1', snapshotId: old.input.snapshotId, cutoffMicros: cutoff,
      mappingVersion: personalContentFeatureContract.mappingVersion, mappingHash: personalContentFeatureContract.mappingHash,
      transformVersion: personalContentFeatureContract.transformVersion, semantics: 'ASSERTION_PRESENCE',
      featureUse: { version: 'personal-content-feature-use-v1', purpose: 'PRIVATE_NATIVE_EVALUATION', origin: 'synthetic',
        reviewRef: 'fixture:content-evaluation', validFromMicros: cutoff, validUntilMicros: old.preparation.horizonEndMicros,
        retention: 'SOURCE_BOUND_UNTIL_WITHDRAWAL', sources: [{ providerKey: 'open_library', evidenceKind: 'provider-subject', disposition: 'PERMITTED' }] },
      featureIds: personalContentFeatureContract.concepts.map(concept => `provider-subject:${concept}`),
      objects: [id(3), id(33), id(5)].map((objectId, index) => {
        const concept = index === 1 ? 'horror' : 'fantasy';
        return { objectId, domainId: 'BOOK', sourceId: id(100 + index), availableAtMicros: cutoff, status: 'AVAILABLE',
          assertions: personalContentFeatureContract.concepts.map(c => c === concept ? 1 : null),
          values: personalContentFeatureContract.concepts.map(c => c === concept ? 1 : 0),
          provenance: { providerKey: 'open_library', providerItemId: `OL${100 + index}W`, sourceUrl: null, sourceHash: null,
            sourceUpdatedAtMicros: null, rowUpdatedAtMicros: cutoff, syncedAtMicros: cutoff,
            alias: { namespace: 'open_library_work', externalId: `OL${100 + index}W` }, evidenceKind: 'provider-subject',
            projectionHash: 'd'.repeat(32), featurePayload: { subject: [concept] } } };
      }) },
  };
  const forecast = structuredClone(forecastPersonalContentRating(normalizeKajoPersonalContentRatingPrefix(input))) as
    Mutable<ReturnType<typeof forecastPersonalContentRating>>;
  const preparation = { ...old.preparation, version: 'kajo-personal-content-rating-preparation-v1', input, forecast,
    contentConfig: { version: 'personal-native-content-ridge-v1', ridge: 2 } };
  const inspection = { ...old.inspection, preparation };
  const binding = { ...old.binding, sourceVersions: { ...old.binding.sourceVersions,
    source: forecast.prefix.sourceVersion, model: forecast.version } };
  const census = { ...old.census, owners: [{ ...old.census.owners[0]!, allocations: [{ ...old.census.owners[0]!.allocations[0]!, inspection }] }] };
  const measure = () => {
    const point = preparation.forecast.forecasts[0]!, answer = inspection.firstAnswer;
    Object.assign(answer.measurement, {
      controlSquaredError: point.control.value === null ? null : (point.control.value - answer.rating) ** 2,
      candidateSquaredError: point.candidate.value === null ? null : (point.candidate.value - answer.rating) ** 2,
      controlAbsoluteError: point.control.value === null ? null : Math.abs(point.control.value - answer.rating),
      candidateAbsoluteError: point.candidate.value === null ? null : Math.abs(point.candidate.value - answer.rating),
    });
    inspection.coverage = answer.coverage = point.control.value === null ? 'NO_NUMERIC_FORECAST' : 'MEASURED_FIRST_RATING';
  };
  measure();
  return { binding, census, input, forecast, preparation, inspection, measure };
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

describe('Retained content challenger evaluation compatibility', () => {
  it('requires an explicitly declared owned-Taste source generation and retains its original numeric forecast', () => {
    const f = contentFixture(4), oldBinding = structuredClone(f.binding);
    const snapshotId = f.input.snapshotId.replace('native-content-prospective:', 'native-owned-content:');
    const input: KajoOwnedTasteRatingPrefix = { ...f.input, version: 'kajo-personal-content-rating-prefix-v2', snapshotId,
      trainingSource: { signature: 'private.personal_rating_training_sources_v2(uuid,text,timestamp with time zone)', bodyMd5: 'e'.repeat(32) },
      candidatePool: { ...f.input.candidatePool, snapshotId }, contentFeatures: { ...f.input.contentFeatures, snapshotId },
      labels: f.input.labels.map((label, index) => ({ itemId: label.itemId, sourceStatus: 'OWNED_TASTE_RATING',
        sourceBootstrapId: id(200 + index), orderingBasis: 'ACCEPTED_SEQUENTIAL_TASTE_RESPONSE', bootstrap: {
          id: id(200 + index), actorUserId: f.input.actorUserId, profileId: f.input.profile.id,
          itemId: label.itemId, itemType: 'BOOK', sourceProvider: 'KAJO_CALIBRATION', datasetKind: 'TASTE_SESSION_V2',
          evidenceKind: 'RATED', rating: label.event.rating, sourceJobId: id(210), sessionId: id(211),
          sessionVersion: 'personal-taste-session-v2', questionId: id(220 + index), panelId: id(230 + index),
          responseId: id(240 + index), responseRevision: 1, commandHash: 'f'.repeat(32),
          acceptedAtMicros: label.event.availableAtMicros, availableAtMicros: label.event.availableAtMicros, experienceTime: 'UNKNOWN',
        } })),
    };
    f.preparation.forecast = structuredClone(forecastPersonalContentRating(normalizeKajoOwnedTasteRatingPrefix(input))) as
      Mutable<ReturnType<typeof forecastPersonalContentRating>>;
    f.binding.sourceVersions.source = f.preparation.forecast.prefix.sourceVersion;f.measure();
    const preparation = { ...f.preparation, version: 'kajo-personal-content-rating-preparation-v2', input };
    const census = { ...f.census, owners: [{ ...f.census.owners[0]!, allocations: [{ ...f.census.owners[0]!.allocations[0]!,
      inspection: { ...f.inspection, preparation } }] }] };
    expect(normalize(f.binding, census).opportunities[0]).toMatchObject({ prefixSupport: 2, firstAnswer: { rating: 4 },
      forecasts: { candidate: preparation.forecast.forecasts[0]!.candidate.value, control: 5 } });
    expect(() => normalize(oldBinding, census)).toThrow(/preparation binding/);
    preparation.version = 'kajo-personal-content-rating-preparation-v1';
    expect(() => normalize(f.binding, census)).toThrow(/preparation binding/);
  });
  it('passes different frozen candidate/control values through the same first-answer measurement for every grade', () => {
    for (let rating = 0; rating <= 10; rating++) {
      const f = contentFixture(rating), result = normalize(f.binding, f.census);
      expect(result.complete).toBe(true);
      expect(result.opportunities[0]).toMatchObject({ firstAnswer: { rating }, currentRating: 9, prefixSupport: 2,
        forecasts: { candidate: f.forecast.forecasts[0]!.candidate.value, control: 5 } });
      expect(result.opportunities[0]!.forecasts!.candidate).toBeGreaterThan(5);
      expect(JSON.stringify(result)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/u);
    }
  });
  it('validates retained point consistency without fitting or rescoring historical points', () => {
    const f = contentFixture(3), row = f.forecast.forecasts[0]!;
    row.candidate.value = 6.25; row.contentDiagnostic.rawValue = 6.25; f.measure();
    expect(normalize(f.binding, f.census).opportunities[0]!.forecasts).toEqual({ candidate: 6.25, control: 5 });
    f.inspection.firstAnswer.measurement.candidateSquaredError += 1;
    expect(() => normalize(f.binding, f.census)).toThrow('frozen measurement');
  });
  it('preserves mean fallback and no-numeric support in the unchanged report inventory schema', () => {
    const fallback = contentFixture(); fallback.input.contentFeatures.featureUse = null;
    fallback.input.contentFeatures.objects.forEach(row => Object.assign(row, { sourceId: `unavailable:${row.objectId}`,
      status: 'UNAVAILABLE', assertions: null, values: null, provenance: null }));
    fallback.preparation.forecast = structuredClone(forecastPersonalContentRating(normalizeKajoPersonalContentRatingPrefix(fallback.input))) as
      Mutable<ReturnType<typeof forecastPersonalContentRating>>;
    fallback.measure();
    expect(normalize(fallback.binding, fallback.census).opportunities[0]!.forecasts).toEqual({ candidate: 5, control: 5 });
    fallback.input.labels = [];
    fallback.input.contentFeatures.objects = fallback.input.contentFeatures.objects.filter(row => row.objectId === fallback.input.targetItemId);
    fallback.preparation.forecast = structuredClone(forecastPersonalContentRating(normalizeKajoPersonalContentRatingPrefix(fallback.input))) as
      Mutable<ReturnType<typeof forecastPersonalContentRating>>;
    fallback.measure();
    expect(normalize(fallback.binding, fallback.census).opportunities[0]).toMatchObject({ prefixSupport: 0,
      forecasts: { candidate: null, control: null }, firstAnswer: { rating: 0 } });
  });
  it('rejects version mixing and changed feature/config/support/fit/point bindings', () => {
    const mutations: ((f: ReturnType<typeof contentFixture>) => void)[] = [
      f => { f.binding.sourceVersions.source = fixture().binding.sourceVersions.source; },
      f => { f.binding.sourceVersions.source = f.binding.sourceVersions.source.replace(personalContentFeatureContract.mappingHash, 'f'.repeat(64)); },
      f => { f.binding.sourceVersions.model = 'personal-domain-mean-v1' as typeof f.binding.sourceVersions.model; },
      f => { f.preparation.version = 'kajo-personal-rating-preparation-v1'; },
      f => { f.preparation.contentConfig.ridge = 4; },
      f => { f.forecast.contentConfig.ridge = 4; },
      f => { f.forecast.content.featureIds.reverse(); },
      f => { f.forecast.content.objects[0]!.sourceId = id(99); },
      f => { f.forecast.content.objects[0]!.values![0] = 0; },
      f => { delete f.forecast.content.objects[0]; },
      f => { delete f.forecast.contentFit.featureMeans[0]; },
      f => { f.forecast.contentFit.featureSupport = 1; },
      f => { f.forecast.contentFit.variedFeatureCount = 1; },
      f => { f.forecast.contentFit.coefficients[0] = NaN; },
      f => { f.forecast.contentFit.coefficients.pop(); },
      f => { Object.assign(f.forecast.contentFit, { version: 'changed-fit-v2' }); },
      f => { f.forecast.forecasts[0]!.candidate.prefixSupport = 1; },
      f => { f.forecast.forecasts[0]!.contentDiagnostic.supportedFeatureCount = 0; },
      f => { f.forecast.forecasts[0]!.contentDiagnostic.rawValue = 0; },
      f => { f.forecast.forecasts[0]!.candidate.mode = 'PERSONAL_MEAN_FALLBACK'; },
      f => { f.input.contentFeatures.featureUse!.validUntilMicros = '1793278799999999'; },
    ];
    for (const mutate of mutations) { const f = contentFixture(); mutate(f); expect(() => normalize(f.binding, f.census)).toThrow(); }
    const old = fixture(); old.binding.sourceVersions.model = 'personal-content-rating-v1';
    old.binding.sourceVersions.source = contentFixture().binding.sourceVersions.source;
    expect(() => normalize(old.binding, old.census)).toThrow('preparation binding');
  });
  it('does not silently filter older retained allocations from a new-model census', () => {
    const f = contentFixture(), old = fixture().census.owners[0]!.allocations[0]!;
    Object.assign(old, { id: id(70), sourcePredictionId: id(71) });
    // The undeclared row is counted before interpreting any old payload/version.
    f.census.owners[0]!.allocations.push(old as unknown as typeof f.census.owners[0]['allocations'][number]);
    const result = normalize(f.binding, f.census);
    expect(result.complete).toBe(false); expect(result.reconciliation.undeclaredAllocations).toBe(1);
  });
});
