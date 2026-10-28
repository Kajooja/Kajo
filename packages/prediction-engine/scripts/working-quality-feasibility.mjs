// One supplied native cohort, reused validation, no model fitting or quality decision.
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorkingCohortReport, WorkingCohortError } from './working-cohort.mjs';
import { createPrivateReportFiles } from './private-report-files.mjs';

const MAX_INPUT_BYTES = 16 * 1024 * 1024, MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const roles = ['TRAIN', 'DEVELOPMENT', 'FINAL'], domains = ['BOOK', 'MOVIE', 'MIXED_OR_UNSPECIFIED'];
const controls = ['USER_MEAN', 'DOMAIN_PRIOR', 'CURRENT_RANKER_RANK_ONLY'];
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clock = value => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 512
  && !/[\u0000-\u001f]/u.test(value) && !uuidPattern.test(value);
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const positive = value => nonnegative(value) && value > 0;
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return record(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
function immutable(value) {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); }
  return value;
}
export class WorkingQualityFeasibilityError extends Error {
  constructor(code) { super(`WORKING_QUALITY_FEASIBILITY_${code}`); this.code = code; }
}
const reject = code => { throw new WorkingQualityFeasibilityError(code); };
function check(condition, code = 'EXPERIMENT_INVALID') { if (!condition) reject(code); }
function shape(value, keys) {
  check(record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
}
const { assertPlatform, readManifest, reportPath, writeReport } = createPrivateReportFiles({
  reject, isReportError: error => error instanceof WorkingQualityFeasibilityError,
  maximumInputBytes: MAX_INPUT_BYTES, maximumOutputBytes: MAX_OUTPUT_BYTES,
});

function validateExperiment(value, declaration) {
  shape(value, ['contractVersion', 'cohortDeclarationDigest', 'sourceIdentity', 'target', 'analysisUnit', 'controls',
    'windows', 'dataRole', 'acceptance', 'coverage', 'precision', 'resources', 'thresholdRationale']);
  check(value.contractVersion === 'kajo-personal-working-quality-experiment-v1');
  check(value.cohortDeclarationDigest === declaration.digest, 'DECLARATION_MISMATCH');
  shape(value.sourceIdentity, ['repositoryCommit', 'migrationManifestSha256', 'modelVersion', 'baseModelVersion', 'policyVersion']);
  check(typeof value.sourceIdentity.repositoryCommit === 'string' && /^[0-9a-f]{40}$/u.test(value.sourceIdentity.repositoryCommit)
    && typeof value.sourceIdentity.migrationManifestSha256 === 'string' && /^[0-9a-f]{64}$/u.test(value.sourceIdentity.migrationManifestSha256)
    && ['modelVersion', 'baseModelVersion', 'policyVersion'].every(key => text(value.sourceIdentity[key])));
  shape(value.target, ['quantity', 'conditioning', 'scale']); shape(value.target.scale, ['min', 'max']);
  check(value.target.quantity === 'PERSONAL_OWN_SCALE_EXPECTED_RATING'
    && value.target.conditioning === 'POST_EXPERIENCE_AND_REPORTED'
    && value.target.scale.min === 0 && value.target.scale.max === 10, 'TARGET_UNSUPPORTED');
  check(value.analysisUnit === 'PROFILE' && Array.isArray(value.controls)
    && JSON.stringify(value.controls) === JSON.stringify(controls));
  shape(value.windows, roles); check(roles.includes(value.dataRole));
  const embargoMs = declaration.request.horizonMs + declaration.request.settlementMs;
  for (const [index, role] of roles.entries()) {
    const window = value.windows[role]; shape(window, ['startAt', 'endAt']);
    check(clock(window.startAt) && clock(window.endAt) && window.endAt > window.startAt
      && clock(window.endAt + embargoMs), 'WINDOW_INVALID');
    if (index > 0) check(window.startAt >= value.windows[roles[index - 1]].endAt + embargoMs, 'WINDOW_OVERLAP');
  }
  const window = value.windows[value.dataRole], cohort = declaration.request.enrollmentWindow;
  check(cohort.startAt >= window.startAt && cohort.endAt <= window.endAt, 'COHORT_OUTSIDE_ROLE');
  shape(value.acceptance, ['primaryMetric', 'minimumUsefulImprovement', 'noninferiorityMargin']);
  check(value.acceptance.primaryMetric === 'PROFILE_MACRO_MSE', 'TARGET_UNSUPPORTED');
  shape(value.coverage, ['minimumProfiles', 'minimumMatureNumericLabels', 'minimumLabelCoverage']);
  shape(value.precision, ['intervalLevel', 'maximumIntervalWidth', 'method']);
  shape(value.resources, ['p50Ms', 'p95Ms', 'maxRssMiB']);
  const missing = [];
  const optional = (path, predicate) => {
    const [parent, key] = path.split('.'), item = key ? value[parent][key] : value[parent];
    if (item === null) missing.push(path); else check(predicate(item), 'THRESHOLD_INVALID');
  };
  for (const key of ['minimumUsefulImprovement', 'noninferiorityMargin']) optional(`acceptance.${key}`, nonnegative);
  for (const key of ['minimumProfiles', 'minimumMatureNumericLabels']) optional(`coverage.${key}`, positiveInteger);
  optional('coverage.minimumLabelCoverage', item => nonnegative(item) && item <= 1);
  optional('precision.intervalLevel', item => positive(item) && item < 1);
  optional('precision.maximumIntervalWidth', positive);
  optional('precision.method', item => item === 'PROFILE_CLUSTER_BOOTSTRAP');
  for (const key of ['p50Ms', 'p95Ms', 'maxRssMiB']) optional(`resources.${key}`, positive);
  optional('thresholdRationale', text);
  check(value.resources.p50Ms === null || value.resources.p95Ms === null
    || value.resources.p95Ms >= value.resources.p50Ms, 'THRESHOLD_INVALID');
  return { missing, embargoMs };
}

function counters() {
  return { enrollments: 0, frozenRankingPools: 0, retainedRankingCandidates: 0, selectedRankingCandidates: 0,
    plannedPairUnits: 0, comparablePairUnits: 0, unscoredPairUnits: 0, plannedLabelSlots: 0,
    reportedNumericLabels: 0, matureNumericLabels: 0, matureExperienceUnits: 0, recordedExposureUnits: 0,
    unreservedCaptureLabelSlots: 0, labelStatuses: { observed: 0, missing: 0, unknown: 0, clear: 0, undone: 0 },
    excludedLabelReasons: {}, pairExclusionReasons: {} };
}
function increment(object, key, amount = 1) { object[key] = (object[key] ?? 0) + amount; }
function mergeCounts(destination, source) {
  for (const key of Object.keys(destination)) {
    const value = source[key];
    if (typeof value === 'number') destination[key] += value;
    else for (const [reason, count] of Object.entries(value)) increment(destination[key], reason, count);
  }
}

/** Reuses v2 scope/source/lifecycle validation; supplied files do not authorize native reads. */
export async function buildWorkingQualityFeasibility(experiment, declaration, inventory, now) {
  check(declaration?.contractVersion === 'kajo-personal-working-cohort-declaration-v2', 'COHORT_VERSION');
  let base;
  try { base = await buildWorkingCohortReport(declaration, inventory, now); }
  catch (error) { if (error instanceof WorkingCohortError) reject(`COHORT_${error.code}`); throw error; }
  const { missing, embargoMs } = validateExperiment(experiment, declaration);
  const nextRole = roles[roles.indexOf(experiment.dataRole) + 1];
  const roleLabelAvailableBy = nextRole ? experiment.windows[nextRole].startAt : base.evaluationAsOf;
  const evidenceChannel = base.evidenceBasis === 'ENGINEERING_FIXTURE' ? 'engineeringFixture' : 'suppliedNative';
  const rows = base.cohort.rosterCoverage.flatMap(member => domains.map(domain =>
    ({ subjectRef: member.subjectRef, domain, ...counters() })));
  const entries = new Map(inventory.manifest.entries.map(entry => [entry.planSnapshot.planning.id, entry]));
  for (const original of base.result.reports) {
    const { plan } = original, entry = entries.get(plan.id), source = plan.sourceBinding;
    check(source, 'SOURCE_IDENTITY_MISMATCH');
    check(source.modelVersion === experiment.sourceIdentity.modelVersion
      && source.baseModelVersion === experiment.sourceIdentity.baseModelVersion
      && plan.versions.policy === experiment.sourceIdentity.policyVersion, 'SOURCE_IDENTITY_MISMATCH');
    const domain = ['BOOK', 'MOVIE'].includes(source.objectType) ? source.objectType : 'MIXED_OR_UNSPECIFIED';
    const row = rows.find(item => item.subjectRef === plan.scope.subject.id && item.domain === domain);
    row.enrollments++; row.frozenRankingPools++;
    row.retainedRankingCandidates += plan.controls.OFF.candidates.length;
    row.selectedRankingCandidates += plan.controls.OFF.candidates.filter(candidate => candidate.selected).length;
    row.plannedPairUnits += original.plannedPairUnits; row.comparablePairUnits += original.comparablePairUnits;
    row.unscoredPairUnits += original.unscoredPairUnits; row.plannedLabelSlots += original.plannedPairUnits * 2;
    for (const pair of original.pairs) for (const reason of pair.reasons) increment(row.pairExclusionReasons, reason);
    const capture = entry.outcomeSnapshot?.capture;
    if (!capture) {
      row.unreservedCaptureLabelSlots += original.plannedPairUnits * 2;
      increment(row.excludedLabelReasons, 'capture-not-reserved', original.plannedPairUnits * 2);
      continue;
    }
    // The v2 native adapter has already checked every label, exposure, time and
    // source identity. Count labels individually: a tied/missing peer does not
    // erase an otherwise usable reported number. These are descriptive slots,
    // not certified new-experience targets or independent outcome observations.
    const captureReasons = [];
    if (!capture.complete) captureReasons.push('incomplete-capture');
    if (capture.capturedAt > base.evaluationAsOf) captureReasons.push('capture-unavailable');
    if (capture.matureAt > base.evaluationAsOf) captureReasons.push('immature-window');
    if (capture.capturedAt < capture.matureAt) captureReasons.push('capture-before-maturity');
    // Capture time is the existing adapter's label-availability time. Training
    // and development cannot consume evidence first captured at/after the next
    // role begins; equality cannot establish earlier visibility under UNKNOWN
    // commit ordering. FINAL retains the existing inclusive evaluation cutoff.
    if (nextRole && capture.capturedAt >= roleLabelAvailableBy) captureReasons.push('capture-after-role-cutoff');
    for (const label of capture.labels) {
      row.labelStatuses[label.status]++;
      if (label.exposureId !== null) row.recordedExposureUnits++;
      for (const reason of captureReasons) increment(row.excludedLabelReasons, reason);
      if (label.status !== 'observed') {
        increment(row.excludedLabelReasons, `${label.status}-label`);
        continue;
      }
      row.reportedNumericLabels++;
      if (captureReasons.length === 0) { row.matureNumericLabels++; row.matureExperienceUnits++; }
    }
  }
  const totals = counters(); for (const row of rows) mergeCounts(totals, row);
  const nativeCounts = evidenceChannel === 'suppliedNative' ? totals : counters();
  const fixtureCounts = evidenceChannel === 'engineeringFixture' ? totals : counters();
  const nativeProfilesWithMatureLabels = evidenceChannel === 'suppliedNative'
    ? new Set(rows.filter(row => row.matureNumericLabels > 0).map(row => row.subjectRef)).size : 0;
  const reasons = ['NUMERIC_FORECAST_UNSUPPORTED'];
  if (missing.length) reasons.push('MISSING_PROTOCOL_VALUES');
  if (!nativeCounts.enrollments) reasons.push('NO_SUPPLIED_NATIVE_ENROLLMENTS');
  if (!nativeCounts.matureNumericLabels) reasons.push('NO_SUPPLIED_MATURE_NATIVE_NUMERIC_LABELS');
  const coverage = experiment.coverage;
  if (coverage.minimumProfiles !== null && nativeProfilesWithMatureLabels < coverage.minimumProfiles) reasons.push('INSUFFICIENT_PROFILE_COVERAGE');
  if (coverage.minimumMatureNumericLabels !== null && nativeCounts.matureNumericLabels < coverage.minimumMatureNumericLabels) reasons.push('INSUFFICIENT_NUMERIC_LABEL_COVERAGE');
  // This ratio is descriptive supplied-label coverage, not forecast coverage or
  // a missing-at-random assertion. Zero denominator remains unavailable.
  const labelCoverage = nativeCounts.plannedLabelSlots ? nativeCounts.matureNumericLabels / nativeCounts.plannedLabelSlots : null;
  if (coverage.minimumLabelCoverage !== null && (labelCoverage === null || labelCoverage < coverage.minimumLabelCoverage)) reasons.push('INSUFFICIENT_LABEL_SLOT_COVERAGE');
  const report = { contractVersion: 'kajo-personal-working-quality-feasibility-v1', purpose: 'FEASIBILITY_ONLY',
    status: 'NOT_EVALUABLE', protocolStatus: missing.length ? 'INSUFFICIENT' : 'VALUES_PRESENT_NOT_ACCEPTANCE',
    reasonCodes: reasons, missingProtocolValues: missing, qualityAdmitted: false, nativeActivated: false,
    learnable: false, historicalFeatureEligible: false, numericalMetricsComputed: false,
    experiment: structuredClone(experiment), experimentDigest: hash(experiment), cohortDeclarationDigest: declaration.digest,
    cohortReportDigest: hash(base), evidenceBasis: base.evidenceBasis, evidenceChannel, evaluatedAt: now,
    bindings: { integrity: 'CANONICAL_SHA256_NOT_AUTHENTICATION', sourceIdentity: 'DECLARED_COMMIT_AND_MIGRATIONS_NOT_AUTHENTICATED',
      modelPolicyIdentity: base.result.reports.length ? 'CHECKED_AGAINST_SUPPLIED_NATIVE_BINDINGS' : 'NO_SUPPLIED_SOURCES',
      currentAuthorization: base.cohort.currentAuthorization, withdrawalStatus: base.cohort.withdrawalStatus,
      sourceAuthenticity: base.sourceAuthenticity, nativeInventoryCompleteness: base.cohort.nativeInventoryCompleteness,
      predeclarationAuthenticity: base.cohort.predeclarationAuthenticity,
      crossRequestSplitDisjointness: 'NOT_ESTABLISHED', untouchedFinalWindow: 'NOT_ESTABLISHED',
      commitAvailability: base.commitAvailability, historicalReconstruction: 'UNAVAILABLE' },
    split: { dataRole: experiment.dataRole, embargoMs, cohortWindow: { ...base.cohort.enrollmentWindow },
      roleLabelAvailableBy, labelAvailabilityBoundary: nextRole ? 'STRICTLY_BEFORE_NEXT_ROLE_START' : 'AT_OR_BEFORE_EVALUATION_AS_OF',
      labelAvailabilityBasis: 'FIRST_RETAINED_CAPTURE_TIME_NOT_EVENT_OCCURRENCE',
      scope: 'ONE_SUPPLIED_COHORT_IDENTITY_AND_WINDOW_CHECKS_ONLY' },
    capabilities: { frozenRanking: { availablePools: totals.frozenRankingPools, retainedCandidates: totals.retainedRankingCandidates },
      numericalForecast: { status: 'UNSUPPORTED', availableForecasts: 0, currentRanker: 'RANK_ONLY_NOT_A_0_TO_10_FORECAST',
        userMean: 'REQUIRED_CONTROL_NOT_COMPUTED', domainPrior: 'REQUIRED_CONTROL_NOT_COMPUTED' },
      newExperiencePopulation: 'NOT_ESTABLISHED_BY_WORKING_EXPOSURE_AND_REPORTED_RATING',
      resourceMeasurement: 'NOT_PERFORMED_BUDGET_VALUES_ONLY' },
    coverage: { rosterProfiles: base.cohort.rosterCoverage.length, nativeProfilesWithMatureLabels,
      nativeLabelSlotCoverage: labelCoverage, suppliedNative: nativeCounts, engineeringFixture: fixtureCounts, byProfileDomain: rows,
      countingBasis: 'UNIQUE_VALIDATED_LABEL_AND_EXPOSURE_IDENTITIES_NOT_INDEPENDENT_N',
      matureLabelEligibility: 'MATURE_COMPLETE_AND_AVAILABLE_WITHIN_ROLE_AND_EVALUATION_CUTOFFS',
      labelCoverageDenominator: 'DECLARED_OFF_PAIR_OBJECT_SLOTS_INCLUDING_UNEXPOSED_OR_MISSING_LABELS',
      recordedExposureMeaning: 'IMPRESSION_NOT_CONFIRMED_EXPERIENCE_WITHOUT_A_NUMERIC_RATING',
      domainBasis: 'SOURCE_REQUEST_DOMAIN_NOT_PER_ITEM_DOMAIN',
      reasonCounts: 'LABEL_AND_PAIR_REASONS_ARE_SEPARATE_AND_MAY_OVERLAP', independence: 'not-established' },
    retainUntil: base.cohort.retainUntil, withdrawal: 'WITHDRAWAL_INVALIDATES_ENTIRE_REPORT',
  };
  const bytes = `${JSON.stringify(report, null, 2)}\n`;
  check(Buffer.byteLength(bytes) <= MAX_OUTPUT_BYTES, 'OUTPUT_TOO_LARGE');
  check(!uuidPattern.test(bytes), 'OUTPUT_IDENTITY');
  return immutable(report);
}

export async function runWorkingQualityFeasibility(experimentPath, declarationPath, inventoryPath, outputPath) {
  assertPlatform(); check([experimentPath, declarationPath, inventoryPath, outputPath]
    .every(value => typeof value === 'string' && value.length > 0), 'ARGUMENTS');
  const destination = await reportPath(outputPath);
  const experiment = await readManifest(experimentPath), declaration = await readManifest(declarationPath), inventory = await readManifest(inventoryPath);
  const report = await buildWorkingQualityFeasibility(experiment, declaration, inventory, Date.now());
  await writeReport(destination, report); return report;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const paths = process.argv.slice(2); check(paths.length === 4, 'ARGUMENTS');
    await runWorkingQualityFeasibility(...paths); process.stdout.write('WORKING_QUALITY_FEASIBILITY_REPORT_CREATED\n');
  } catch (error) {
    process.stderr.write(`${error instanceof WorkingQualityFeasibilityError ? error.message : 'WORKING_QUALITY_FEASIBILITY_FAILED'}\n`);
    process.exitCode = 1;
  }
}
