import type { PersonalRatingBaselineForecast, PersonalRatingPoint } from '../personal-rating.js';
import type { PersonalRatingEvaluationInventory, PersonalRatingEvaluationOpportunity } from '../personal-rating-evaluation.js';
import { normalizeKajoPersonalRatingProspectivePrefix, personalRatingProspectiveConfig } from './kajo-personal-rating-prospective.js';
import type { KajoPersonalRatingProspectivePrefix } from './kajo-personal-rating-prospective.js';
import type { PersonalContentRatingForecast } from '../personal-content-rating.js';
import { normalizeKajoPersonalContentRatingPrefix, personalContentFeatureContract, personalContentRatingProspectiveConfig } from './kajo-personal-content-rating.js';
import type { KajoPersonalContentRatingPrefix } from './kajo-personal-content-rating.js';
import { normalizeKajoOwnedTasteRatingPrefix } from './kajo-owned-taste-rating.js';
import type { KajoOwnedTasteRatingPrefix } from './kajo-owned-taste-rating.js';
import { normalizeKajoWikidataContentRatingPrefix, wikidataContentFeatureContract } from './kajo-wikidata-content-rating.js';
import type { KajoWikidataContentRatingPrefix } from './kajo-wikidata-content-rating.js';

/** Private native identities stay in the supplied binding, never in the report.
 * A failed attempt is a supplied ledger claim, not inferred from a missing row.
 * Files establish consistency, not current authorization or a complete census. */
export interface KajoPersonalRatingEvaluationBinding {
  readonly origin: 'observed' | 'synthetic';
  readonly horizonSeconds: number;
  readonly sourceVersions: Readonly<{ source: string; model: string; control: string }>;
  readonly roster: readonly Readonly<{ actorUserId: string; profileId: string; subjectId: string }>[];
  readonly opportunities: readonly Readonly<{
    opportunityId: string; actorUserId: string; profileId: string; sourcePredictionId: string;
    forecastId: string; targetItemId: string; objectId: string; domainId: 'BOOK' | 'MOVIE';
    attemptedAtMicros: string; captureStatus: 'CAPTURED' | 'CAPTURE_UNAVAILABLE' | 'NOT_ATTEMPTED';
  }>[];
}
export interface KajoPersonalRatingAllocationInspection {
  readonly id: string;
  readonly sourcePredictionId: string;
  readonly actorUserId: string;
  readonly profileId: string;
  readonly requestHash: string;
  readonly inspection: unknown;
}
export interface KajoPersonalRatingOwnerCensus {
  readonly version: 'kajo-personal-rating-owner-census-v1';
  readonly actorUserId: string;
  readonly profileId: string;
  readonly observedAtMicros: string;
  readonly allocations: readonly KajoPersonalRatingAllocationInspection[];
}
export interface KajoPersonalRatingEvaluationCensus {
  readonly version: 'kajo-personal-rating-census-v1';
  readonly observedAtMicros: string;
  readonly owners: readonly KajoPersonalRatingOwnerCensus[];
}
export interface KajoPersonalRatingEvaluationInventory extends PersonalRatingEvaluationInventory {
  readonly reconciliation: Readonly<{
    status: 'COMPLETE_DECLARED_RECONCILIATION' | 'UNRESOLVED';
    expectedOpportunities: number;
    missingExpectedCaptures: number;
    undeclaredAllocations: number;
    missingOwnerCensuses: number;
    declaredUnavailableAttempts: number;
    declaredNotAttempted: number;
    nativeInventoryCompleteness: 'NOT_ESTABLISHED_BY_FILE';
    currentAuthorization: 'NOT_ESTABLISHED_BY_FILE';
    attemptLedgerEvidence: 'SUPPLIED_DECLARATION_NOT_NATIVE_FAILURE_PROOF';
  }>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const embeddedUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const versions = { model: 'personal-domain-mean-v1', control: 'personal-domain-mean-v1:PERSONAL_MEAN' };
function check(value: unknown, code: string): asserts value {
  if (!value) throw new Error(`Invalid Kajo numeric evaluation inventory: ${code}`);
}
function record(value: unknown, code: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code);
  return value as Record<string, unknown>;
}
function shape(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  const result = record(value, code);
  check(Object.keys(result).length === keys.length && keys.every(key => Object.hasOwn(result, key)), code);
  return result;
}
function uuid(value: unknown): asserts value is string { check(typeof value === 'string' && uuidPattern.test(value), 'native identity'); }
function alias(value: unknown): asserts value is string {
  check(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$/u.test(value)
    && !embeddedUuid.test(value), 'alias');
}
function micros(value: unknown): bigint {
  check(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/u.test(value)
    && BigInt(value) <= 253402300799999999n, 'microsecond clock');
  return BigInt(value);
}
function grade(value: unknown): asserts value is number {
  check(typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10, 'integer grade');
}
function numeric(value: unknown): asserts value is number | null {
  check(value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10), 'numeric point');
}
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && equal(x[k], y[k]));
  }
  return false;
}
function measurementEqual(actual: unknown, expected: Record<string, number | null>): boolean {
  const value = shape(actual, Object.keys(expected), 'measurement shape');
  // SQL decimal arithmetic and JS doubles differ at the last binary digits.
  // This tolerance applies only to error measurements, never identity/config.
  return Object.entries(expected).every(([key, target]) => target === null ? value[key] === null
    : typeof value[key] === 'number' && Number.isFinite(value[key]) && Math.abs(value[key] - target) <= 1e-12);
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Inspect retained values and bindings; do not rescore the historical prefix. */
function retainedForecast(raw: unknown, prefix: KajoPersonalRatingProspectivePrefix,
  binding: KajoPersonalRatingEvaluationBinding): PersonalRatingBaselineForecast {
  const input = normalizeKajoPersonalRatingProspectivePrefix(prefix);
  const f = record(raw, 'retained forecast') as unknown as PersonalRatingBaselineForecast;
  const support = input.prefix.ratings.length;
  check(f.version === versions.model && f.targetVersion === 'personal-own-scale-post-experience-rating-v1'
    && f.subjectId === input.subjectId && f.domainId === input.domainId && f.cutoffMicros === input.cutoffMicros
    && f.calibration === 'UNCALIBRATED' && f.qualityAdmission === 'NONE' && f.servingActivation === 'NONE'
    && f.capability === (support ? 'NUMERIC_POINT_BASELINE_V1' : 'NUMERIC_POINT_UNAVAILABLE_V1'), 'forecast scope/version');
  check(equal(f.config, personalRatingProspectiveConfig) && f.prior === null && f.priorDisposition === 'ABSENT'
    && equal(f.identified, { personalLocation: support > 0, responseSpread: false, contentDifferentiation: false }), 'native-only model');
  const expectedRatings = [...input.prefix.ratings].sort((a, b) => a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0);
  check(f.prefix?.version === 'canonical-resolved-rating-prefix-v1' && f.prefix.sourceId === input.prefix.sourceId
    && f.prefix.sourceVersion === binding.sourceVersions.source && f.prefix.sourceVersion === input.prefix.sourceVersion
    && f.prefix.snapshotId === input.prefix.snapshotId && f.prefix.support === support
    && equal(f.prefix.provenance, input.prefix.provenance) && equal(f.prefix.ratings, expectedRatings)
    && equal(f.prefix.excluded, { foreignSubject: 0, foreignDomain: 0, future: 0, duplicate: 0 })
    && equal(f.candidatePool, input.candidatePool), 'forecast prefix/pool binding');
  check(Array.isArray(f.forecasts) && f.forecasts.length === input.candidatePool.candidateIds.length, 'forecast pool cardinality');
  const validatePoint = (point: PersonalRatingPoint, mode: string) => {
    shape(point, ['value', 'status', 'mode', 'prefixSupport'], 'forecast point shape'); numeric(point.value);
    check(point.prefixSupport === support && point.mode === (support ? mode : 'NO_NUMERIC_SUPPORT')
      && point.status === (support ? 'AVAILABLE' : 'UNAVAILABLE') && (support ? point.value !== null : point.value === null), 'forecast point support');
  };
  for (const [index, row] of f.forecasts.entries()) {
    shape(row, ['objectId', 'control', 'candidate'], 'forecast entry');
    check(row.objectId === input.candidatePool.candidateIds[index], 'forecast target/order');
    validatePoint(row.control, 'PERSONAL_MEAN'); validatePoint(row.candidate, 'PERSONAL_MEAN_FALLBACK');
    check(row.control.value === row.candidate.value && row.control.value === f.forecasts[0]?.control.value, 'native fallback binding');
  }
  check(equal(f.location, { personalMean: f.forecasts[0]?.control.value, residual: null }), 'retained location binding');
  return f;
}

/** Validate a retained content forecast's bindings and diagnostic structure.
 * No coefficient fit or historical point forecast is recomputed here. Native
 * finalization is the producer boundary; a file remains a consistency claim. */
function retainedContentForecast(raw: unknown, prefix: KajoPersonalContentRatingPrefix | KajoOwnedTasteRatingPrefix | KajoWikidataContentRatingPrefix,
  binding: KajoPersonalRatingEvaluationBinding): PersonalContentRatingForecast {
  const input = prefix.version === 'kajo-personal-content-rating-prefix-v3' ? normalizeKajoWikidataContentRatingPrefix(prefix)
    : prefix.version === 'kajo-personal-content-rating-prefix-v2'
    ? normalizeKajoOwnedTasteRatingPrefix(prefix) : normalizeKajoPersonalContentRatingPrefix(prefix);
  const dense = (value: unknown): boolean => {
    if (Array.isArray(value)) return Array.from(value).every((row, index) => Object.hasOwn(value, index) && dense(row));
    return value === null || typeof value !== 'object' || Object.values(value).every(dense);
  };
  shape(raw, ['version', 'targetVersion', 'capability', 'calibration', 'qualityAdmission', 'servingActivation',
    'subjectId', 'domainId', 'cutoffMicros', 'prefix', 'candidatePool', 'config', 'prior', 'priorDisposition',
    'location', 'identified', 'forecasts', 'content', 'contentConfig', 'contentFit'], 'content forecast shape');
  check(dense(raw), 'dense retained content arrays');
  const f = record(raw, 'retained content forecast') as unknown as PersonalContentRatingForecast;
  const support = input.prefix.ratings.length, dimensions = input.content.featureIds.length;
  check(f.version === 'personal-content-rating-v1' && f.targetVersion === 'personal-own-scale-post-experience-rating-v1'
    && f.subjectId === input.subjectId && f.domainId === input.domainId && f.cutoffMicros === input.cutoffMicros
    && f.calibration === 'UNCALIBRATED' && f.qualityAdmission === 'NONE' && f.servingActivation === 'NONE'
    && f.capability === (support ? 'NUMERIC_CONTENT_POINT_V1' : 'NUMERIC_POINT_UNAVAILABLE_V1'), 'content forecast scope/version');
  check(equal(f.config, personalRatingProspectiveConfig) && equal(f.contentConfig, personalContentRatingProspectiveConfig)
    && f.prior === null && f.priorDisposition === 'ABSENT'
    && equal(f.identified, { personalLocation: support > 0, responseSpread: false }), 'native-only content model');
  const expectedRatings = [...input.prefix.ratings].sort((a, b) => a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0);
  const expectedObjects = [...input.content.objects].sort((a, b) => a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0);
  shape(f.prefix, ['version', 'sourceId', 'sourceVersion', 'snapshotId', 'support', 'ratings', 'excluded', 'provenance'], 'content forecast prefix shape');
  check(f.prefix?.version === 'canonical-resolved-rating-prefix-v1' && f.prefix.sourceId === input.prefix.sourceId
    && f.prefix.sourceVersion === binding.sourceVersions.source && f.prefix.sourceVersion === input.prefix.sourceVersion
    && f.prefix.snapshotId === input.prefix.snapshotId && f.prefix.support === support
    && equal(f.prefix.provenance, input.prefix.provenance) && equal(f.prefix.ratings, expectedRatings)
    && equal(f.prefix.excluded, { foreignSubject: 0, foreignDomain: 0, future: 0, duplicate: 0 })
    && equal(f.candidatePool, input.candidatePool)
    && equal(f.content, { ...input.content, objects: expectedObjects }), 'content prefix/feature/pool binding');
  const objects = new Map(input.content.objects.map(row => [row.objectId, row]));
  const training = expectedRatings.filter(row => objects.get(row.objectId)!.status === 'AVAILABLE');
  const featureSupport = training.length;
  const varied = Array.from({ length: dimensions }, (_, index) => featureSupport > 1
    && training.some(row => objects.get(row.objectId)!.values![index] !== objects.get(training[0]!.objectId)!.values![index]));
  const variedCount = varied.filter(Boolean).length;
  const fitStatus = !support ? 'NO_NUMERIC_SUPPORT' : featureSupport < 2 ? 'INSUFFICIENT_FEATURE_SUPPORT'
    : training.every(row => row.value === training[0]!.value) ? 'CONSTANT_FEATURED_RATINGS'
      : variedCount === 0 ? 'NO_TRAINING_FEATURE_VARIATION' : 'FITTED';
  const fit = f.contentFit;
  shape(fit, ['version', 'status', 'numericSupport', 'featureSupport', 'featureCoverage', 'featureDimensions',
    'variedFeatureCount', 'featureMeans', 'coefficients', 'excluded', 'replayPolicy', 'parameterInterpretation', 'cost'], 'content fit shape');
  check(fit.version === 'centered-fixed-mean-ridge-v1' && fit.status === fitStatus
    && fit.numericSupport === support && fit.featureSupport === featureSupport
    && fit.featureCoverage === (support ? featureSupport / support : null)
    && fit.featureDimensions === dimensions && fit.variedFeatureCount === variedCount
    && fit.replayPolicy === 'REBUILD_FROM_COMPLETE_RESOLVED_PREFIX'
    && fit.parameterInterpretation === 'REGULARIZED_ASSOCIATION_NOT_LATENT_TASTE'
    && equal(fit.excluded, { unavailable: support - featureSupport, withdrawn: 0, future: 0 })
    && equal(fit.cost, { trainingRows: featureSupport, featureDimensions: dimensions, variedDimensions: variedCount,
      centeredScalarProducts: fitStatus === 'FITTED' ? featureSupport * variedCount * (variedCount + 1) / 2 : 0 }), 'content fit support/version');
  check(Array.isArray(fit.featureMeans) && fit.featureMeans.length === dimensions
    && fit.featureMeans.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
      && (featureSupport > 0 || value === 0))
    && Array.isArray(fit.coefficients) && fit.coefficients.length === dimensions
    && fit.coefficients.every((value, index) => typeof value === 'number' && Number.isFinite(value)
      && Math.abs(value) <= 81920
      && (fitStatus === 'FITTED' && varied[index] || value === 0)), 'retained fit dimensions/parameters');
  check(Array.isArray(f.forecasts) && f.forecasts.length === input.candidatePool.candidateIds.length, 'content forecast pool cardinality');
  for (const [index, row] of f.forecasts.entries()) {
    shape(row, ['objectId', 'control', 'candidate', 'contentDiagnostic'], 'content forecast entry');
    check(row.objectId === input.candidatePool.candidateIds[index], 'content forecast target/order');
    for (const point of [row.control, row.candidate]) {
      shape(point, ['value', 'status', 'mode', 'prefixSupport'], 'content forecast point shape'); numeric(point.value);
      check(point.prefixSupport === support && point.status === (support ? 'AVAILABLE' : 'UNAVAILABLE')
        && (support ? point.value !== null : point.value === null), 'content forecast point support');
    }
    check(row.control.mode === (support ? 'PERSONAL_MEAN' : 'NO_NUMERIC_SUPPORT')
      && row.control.value === f.forecasts[0]!.control.value, 'content control binding');
    const feature = objects.get(row.objectId)!;
    const supported = feature.status === 'AVAILABLE' ? feature.values!.filter((value, j) => value !== 0 && varied[j]).length : 0;
    const fallback = fitStatus !== 'FITTED' ? fitStatus : feature.status !== 'AVAILABLE' ? 'FEATURE_UNAVAILABLE'
      : supported === 0 ? 'NO_SUPPORTED_CONTENT_FEATURE' : 'NONE';
    const diagnostic = row.contentDiagnostic;
    shape(diagnostic, ['fallback', 'rawValue', 'clipped', 'supportedFeatureCount'], 'content diagnostic shape');
    check(diagnostic.fallback === fallback && diagnostic.supportedFeatureCount === supported, 'content fallback/support binding');
    if (fallback === 'NONE') {
      check(row.candidate.mode === 'CONTENT_RIDGE' && typeof diagnostic.rawValue === 'number' && Number.isFinite(diagnostic.rawValue)
        && Math.abs(diagnostic.rawValue) <= 1000000
        && row.candidate.value === Math.max(0, Math.min(10, diagnostic.rawValue))
        && diagnostic.clipped === (row.candidate.value !== diagnostic.rawValue), 'retained content point clipping');
    } else {
      check(row.candidate.mode === (support ? 'PERSONAL_MEAN_FALLBACK' : 'NO_NUMERIC_SUPPORT')
        && row.candidate.value === row.control.value && diagnostic.rawValue === row.control.value
        && diagnostic.clipped === false, 'retained content fallback');
    }
  }
  check(equal(f.location, { personalMean: f.forecasts[0]!.control.value, residual: null }), 'retained content location');
  return f;
}

/** Complete means every supplied declared identity was reconciled. It never
 * certifies completeness of historical/native opportunities or authorization.
 * Undeclared retained allocations invalidate completeness, including tombstones
 * whose erased clocks no longer establish whether they are outside the cohort. */
export function normalizeKajoPersonalRatingEvaluationInventory(binding: KajoPersonalRatingEvaluationBinding,
  census: KajoPersonalRatingEvaluationCensus): KajoPersonalRatingEvaluationInventory {
  check(binding && ['observed', 'synthetic'].includes(binding.origin) && Number.isInteger(binding.horizonSeconds)
    && binding.horizonSeconds >= 1 && binding.horizonSeconds <= 7776000, 'declaration');
  const contentModel = binding.sourceVersions?.model === 'personal-content-rating-v1';
  const wikidata = contentModel && binding.sourceVersions.source.startsWith('owned-rating-source-v3:');
  const ownedTaste = wikidata || contentModel && binding.sourceVersions.source.startsWith('owned-rating-source-v2:');
  const featureContract = wikidata ? wikidataContentFeatureContract : personalContentFeatureContract;
  const contentSourceSuffix = `:${featureContract.mappingVersion}:${featureContract.mappingHash}:${featureContract.transformVersion}`;
  check(binding.sourceVersions?.control === versions.control && (contentModel
    ? (ownedTaste ? /^owned-rating-source-v[23]:[0-9a-f]{32}:[0-9a-f]{32}:/u.test(binding.sourceVersions.source)
      && binding.sourceVersions.source.length === 'owned-rating-source-v2:'.length + 65 + contentSourceSuffix.length
      : /^personal-content-source-v1:[0-9a-f]{32}:/u.test(binding.sourceVersions.source)
      && binding.sourceVersions.source.length === 'personal-content-source-v1:'.length + 32 + contentSourceSuffix.length)
      && binding.sourceVersions.source.endsWith(contentSourceSuffix)
    : binding.sourceVersions.model === versions.model && /^personal-source-evidence-v1:[0-9a-f]{32}$/u.test(binding.sourceVersions.source)), 'source versions');
  check(Array.isArray(binding.roster) && binding.roster.length >= 1 && binding.roster.length <= 128
    && Array.isArray(binding.opportunities) && binding.opportunities.length <= 4096, 'declared budgets');
  check(census?.version === 'kajo-personal-rating-census-v1' && Array.isArray(census.owners)
    && census.owners.length <= 128, 'census');
  check(new TextEncoder().encode(JSON.stringify({ binding, census })).byteLength <= 16 * 1024 * 1024, 'serialized input budget');
  const observed = micros(census.observedAtMicros), roster = new Map<string, typeof binding.roster[number]>();
  const actorIds = new Set<string>(), aliases = new Map<string, string>(), nativeAliases = new Map<string, string>();
  const addAlias = (kind: string, id: string, ref: string) => {
    alias(ref); const identity = `${kind}:${id}`;
    check((!aliases.has(ref) || aliases.get(ref) === identity)
      && (!nativeAliases.has(identity) || nativeAliases.get(identity) === ref), 'alias identity collision');
    aliases.set(ref, identity); nativeAliases.set(identity, ref);
  };
  for (const member of binding.roster) {
    uuid(member.actorUserId); uuid(member.profileId);
    check(!roster.has(member.profileId) && !actorIds.has(member.actorUserId), 'duplicate roster identity');
    roster.set(member.profileId, member); actorIds.add(member.actorUserId); addAlias('subject', member.profileId, member.subjectId);
  }
  const expected = new Map<string, typeof binding.opportunities[number]>(), sourceIds = new Set<string>(), targets = new Set<string>();
  for (const opportunity of binding.opportunities) {
    for (const value of [opportunity.actorUserId, opportunity.profileId, opportunity.sourcePredictionId, opportunity.forecastId, opportunity.targetItemId]) uuid(value);
    const member = roster.get(opportunity.profileId);
    check(member?.actorUserId === opportunity.actorUserId && ['BOOK', 'MOVIE'].includes(opportunity.domainId)
      && ['CAPTURED', 'CAPTURE_UNAVAILABLE', 'NOT_ATTEMPTED'].includes(opportunity.captureStatus), 'opportunity scope/status');
    check(micros(opportunity.attemptedAtMicros) <= observed, 'future attempt');
    const target = `${opportunity.profileId}:${opportunity.targetItemId}`;
    check(!expected.has(opportunity.forecastId) && !sourceIds.has(opportunity.sourcePredictionId) && !targets.has(target), 'duplicate opportunity/source/target');
    addAlias('opportunity', opportunity.forecastId, opportunity.opportunityId); addAlias('object', opportunity.targetItemId, opportunity.objectId);
    expected.set(opportunity.forecastId, opportunity); sourceIds.add(opportunity.sourcePredictionId); targets.add(target);
  }
  const allocations = new Map<string, KajoPersonalRatingAllocationInspection>(), ownerClocks = new Map<string, bigint>();
  const retainedSources = new Set<string>();
  for (const owner of census.owners) {
    check(owner?.version === 'kajo-personal-rating-owner-census-v1', 'owner census version');
    uuid(owner.actorUserId); uuid(owner.profileId);
    check(roster.get(owner.profileId)?.actorUserId === owner.actorUserId && !ownerClocks.has(owner.profileId), 'owner census scope');
    const ownerClock = micros(owner.observedAtMicros); check(ownerClock <= observed, 'future owner census');
    ownerClocks.set(owner.profileId, ownerClock);
    check(Array.isArray(owner.allocations) && owner.allocations.length <= 128, 'retained allocation budget');
    for (const allocation of owner.allocations) {
      uuid(allocation.id); uuid(allocation.sourcePredictionId);
      check(allocation.actorUserId === owner.actorUserId && allocation.profileId === owner.profileId
        && /^[0-9a-f]{32}$/u.test(allocation.requestHash) && !allocations.has(allocation.id)
        && !retainedSources.has(allocation.sourcePredictionId), 'allocation binding/duplicate');
      allocations.set(allocation.id, allocation); retainedSources.add(allocation.sourcePredictionId);
    }
  }
  let missingExpectedCaptures = 0, declaredUnavailableAttempts = 0, declaredNotAttempted = 0;
  const answerIds = new Set<string>();
  const opportunities: PersonalRatingEvaluationOpportunity[] = binding.opportunities.map(opportunity => {
    const allocation = allocations.get(opportunity.forecastId), member = roster.get(opportunity.profileId)!;
    const base = { opportunityId: opportunity.opportunityId, subjectId: member.subjectId, domainId: opportunity.domainId,
      objectId: opportunity.objectId, opportunityAtMicros: opportunity.attemptedAtMicros,
      horizonEndMicros: null, prefixSupport: null, forecasts: null, firstAnswer: null, currentRating: null };
    if (opportunity.captureStatus !== 'CAPTURED') {
      check(!allocation, 'attempt ledger contradicts retained allocation');
      if (opportunity.captureStatus === 'CAPTURE_UNAVAILABLE') declaredUnavailableAttempts++; else declaredNotAttempted++;
      return { ...base, captureStatus: opportunity.captureStatus };
    }
    if (!allocation) { missingExpectedCaptures++; return { ...base, captureStatus: 'MISSING_EXPECTED_CAPTURE' }; }
    check(allocation.actorUserId === opportunity.actorUserId && allocation.profileId === opportunity.profileId
      && allocation.sourcePredictionId === opportunity.sourcePredictionId, 'declared allocation binding');
    const inspection = shape(allocation.inspection, ['version', 'forecastId', 'status', 'coverage', 'preparation', 'firstAnswer', 'currentCanonicalState'], 'inspection shape');
    check(inspection.version === 'personal-rating-inspection-v1' && inspection.forecastId === allocation.id, 'inspection identity');
    if (inspection.status === 'WITHDRAWN') {
      check(inspection.coverage === 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT' && inspection.preparation === null
        && inspection.firstAnswer === null && inspection.currentCanonicalState === null, 'withdrawn copy retained data');
      return { ...base, captureStatus: 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT' };
    }
    check(inspection.status === 'AVAILABLE', 'inspection status');
    const prep = record(inspection.preparation, 'preparation');
    check(prep.version === (wikidata ? 'kajo-personal-content-rating-preparation-v3' : ownedTaste ? 'kajo-personal-content-rating-preparation-v2'
      : contentModel ? 'kajo-personal-content-rating-preparation-v1' : 'kajo-personal-rating-preparation-v1') && prep.forecastId === allocation.id
      && prep.sourcePredictionId === opportunity.sourcePredictionId && prep.targetItemId === opportunity.targetItemId
      && prep.itemType === opportunity.domainId && prep.requestHash === allocation.requestHash
      && prep.cohort === 'FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN'
      && prep.selection === 'ONE_PREDECLARED_TARGET_FROM_COMPLETE_DELIVERED_POOL'
      && prep.qualityAdmission === 'NONE' && prep.servingActivation === 'NONE'
      && equal(prep.config, personalRatingProspectiveConfig)
      && (!contentModel || equal(prep.contentConfig, personalContentRatingProspectiveConfig)), 'preparation binding');
    const prefix = record(prep.input, 'input') as unknown as KajoPersonalRatingProspectivePrefix | KajoPersonalContentRatingPrefix | KajoOwnedTasteRatingPrefix | KajoWikidataContentRatingPrefix;
    check(prefix.actorUserId === opportunity.actorUserId && prefix.profile?.id === opportunity.profileId
      && prefix.evidenceOrigin === binding.origin && prefix.forecastId === allocation.id
      && prefix.sourcePredictionId === opportunity.sourcePredictionId && prefix.targetItemId === opportunity.targetItemId
      && prefix.itemType === opportunity.domainId && prefix.cutoffMicros === prep.cutoffMicros, 'native input binding');
    check(!contentModel || prefix.version === (wikidata ? 'kajo-personal-content-rating-prefix-v3'
      : ownedTaste ? 'kajo-personal-content-rating-prefix-v2' : 'kajo-personal-content-rating-prefix-v1'), 'declared source generation');
    const forecast = contentModel ? retainedContentForecast(prep.forecast, prefix as KajoPersonalContentRatingPrefix | KajoOwnedTasteRatingPrefix | KajoWikidataContentRatingPrefix, binding)
      : retainedForecast(prep.forecast, prefix as KajoPersonalRatingProspectivePrefix, binding);
    check(prefix.candidatePool.items[0]?.id === opportunity.targetItemId, 'first delivered target selection');
    const cutoff = micros(prep.cutoffMicros), horizon = micros(prep.horizonEndMicros), ownerClock = ownerClocks.get(opportunity.profileId)!;
    check(cutoff >= micros(opportunity.attemptedAtMicros) && cutoff <= ownerClock
      && horizon === cutoff + BigInt(binding.horizonSeconds) * 1000000n, 'frozen horizon/capture clock');
    if (contentModel) {
      const manifest = (prefix as KajoPersonalContentRatingPrefix).contentFeatures.featureUse;
      check(manifest === null || micros(manifest.validUntilMicros) >= horizon, 'feature-use horizon');
    }
    const point = forecast.forecasts[0]!;
    let firstAnswer: PersonalRatingEvaluationOpportunity['firstAnswer'] = null;
    if (inspection.firstAnswer !== null) {
      const answer = shape(inspection.firstAnswer, ['version', 'forecastId', 'targetItemId', 'actionId', 'rating', 'acceptedAtMicros', 'measurement', 'coverage'], 'first answer');
      check(answer.version === 'personal-rating-first-answer-v1' && answer.forecastId === allocation.id
        && answer.targetItemId === opportunity.targetItemId, 'first answer identity');
      uuid(answer.actionId); grade(answer.rating); check(!answerIds.has(answer.actionId), 'duplicate first answer'); answerIds.add(answer.actionId);
      const rating = answer.rating;
      const accepted = micros(answer.acceptedAtMicros);
      check(accepted > cutoff && accepted <= horizon && accepted <= ownerClock, 'first answer clock');
      const squared = (value: number | null) => value === null ? null : (value - rating) ** 2;
      const absolute = (value: number | null) => value === null ? null : Math.abs(value - rating);
      check(measurementEqual(answer.measurement, { controlSquaredError: squared(point.control.value), candidateSquaredError: squared(point.candidate.value),
        controlAbsoluteError: absolute(point.control.value), candidateAbsoluteError: absolute(point.candidate.value) }), 'frozen measurement');
      const coverage = point.control.value === null ? 'NO_NUMERIC_FORECAST' : 'MEASURED_FIRST_RATING';
      check(answer.coverage === coverage && inspection.coverage === coverage, 'first answer coverage');
      firstAnswer = { rating: answer.rating, acceptedAtMicros: answer.acceptedAtMicros as string };
    } else check(['PENDING_FIRST_REPORT', 'UNANSWERED_EXPIRED'].includes(inspection.coverage as string), 'pending coverage');
    let currentRating: number | null = null;
    if (inspection.currentCanonicalState !== null) {
      const current = shape(inspection.currentCanonicalState, ['sourceStatus', 'sourceEventId', 'rating'], 'current state');
      check(typeof current.sourceStatus === 'string' && /^[A-Z_]{1,64}$/u.test(current.sourceStatus), 'current source status');
      if (current.sourceEventId !== null) uuid(current.sourceEventId);
      if (current.sourceStatus === 'NATIVE_RATING') { grade(current.rating); currentRating = current.rating; }
      else check(current.rating === null, 'non-numeric current state');
    }
    return { ...base, captureStatus: 'AVAILABLE', opportunityAtMicros: prep.cutoffMicros as string,
      horizonEndMicros: prep.horizonEndMicros as string, prefixSupport: forecast.prefix.support,
      forecasts: { candidate: point.candidate.value, control: point.control.value }, firstAnswer, currentRating };
  });
  const undeclaredAllocations = [...allocations.keys()].filter(id => !expected.has(id)).length;
  const missingOwnerCensuses = binding.roster.length - ownerClocks.size;
  const complete = missingExpectedCaptures === 0 && undeclaredAllocations === 0 && missingOwnerCensuses === 0;
  const observedThrough = [...ownerClocks.values()].reduce((minimum, value) => value < minimum ? value : minimum, observed);
  return freeze({ version: 'personal-rating-evaluation-inventory-v1', origin: binding.origin, observedAtMicros: census.observedAtMicros,
    observedThroughMicros: observedThrough.toString(),
    complete, opportunities, reconciliation: { status: complete ? 'COMPLETE_DECLARED_RECONCILIATION' : 'UNRESOLVED',
      expectedOpportunities: binding.opportunities.length, missingExpectedCaptures, undeclaredAllocations, missingOwnerCensuses,
      declaredUnavailableAttempts, declaredNotAttempted, nativeInventoryCompleteness: 'NOT_ESTABLISHED_BY_FILE',
      currentAuthorization: 'NOT_ESTABLISHED_BY_FILE', attemptLedgerEvidence: 'SUPPLIED_DECLARATION_NOT_NATIVE_FAILURE_PROOF' } });
}
