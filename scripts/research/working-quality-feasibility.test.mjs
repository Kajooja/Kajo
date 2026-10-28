import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createWorkingCohortDeclaration, buildWorkingCohortReport } from '../../packages/prediction-engine/scripts/working-cohort.mjs';
import { buildWorkingQualityFeasibility, WorkingQualityFeasibilityError } from '../../packages/prediction-engine/scripts/working-quality-feasibility.mjs';
import { workingReportNativeFixtureEntry } from './working-report.fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../../packages/prediction-engine/scripts/working-quality-feasibility.mjs', import.meta.url));
const id = number => `a9150000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const policy = 'scenario-memory-v1+resurfacing-v1+outcome-attribution-v1+frozen-replay-v2+eligibility-first-v1+personal-working-off-v3';
function declaration(overrides = {}, now = 1000) {
  return createWorkingCohortDeclaration({ contractVersion: 'kajo-personal-working-cohort-request-v2',
    scopeId: 'fixture', cohortRef: 'fixture:cohort',
    roster: [0, 1].map(index => ({ actorUserId: id(1 + 1000 * index), profileId: id(2 + 1000 * index),
      actorRef: `fixture:actor-${index}`, subjectRef: `fixture:subject-${index}` })),
    enrollmentWindow: { startAt: 1200, endAt: 3000 }, horizonMs: 1000, settlementMs: 0,
    evaluationAsOf: 6000, ...overrides }, now);
}
function entry(index = 0) {
  const result = workingReportNativeFixtureEntry(index, false), seen = new Set();
  const clocks = new Set(['cutoff', 'asOf', 'availableAt', 'created_at', 'requested_at', 'snapshotObservedAt',
    'createdAt', 'declaredAt', 'startAt', 'endAt', 'matureAt', 'capturedAt', 'occurredAt', 'exposedAt', 'occurred_at',
    'nativeEvidenceAsOf', 'memoryStateAsOf', 'scenarioAsOf', 'requestAsOf', 'workingStateAsOf', 'eligibilityAt']);
  const scale = value => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (clocks.has(key) && typeof child === 'number') value[key] *= 10; else scale(child);
    }
  };
  scale(result); result.planSnapshot.enrollment.matureAt = 3100; result.outcomeSnapshot.capture.matureAt = 3100;
  return result;
}
function inventory(declared, entries = [entry()], evidenceBasis = 'ENGINEERING_FIXTURE') {
  return { contractVersion: 'kajo-personal-working-cohort-inventory-v2', declarationDigest: declared.digest,
    inventory: entries.map(value => ({ enrollmentId: value.expectedScope.enrollmentId,
      actorUserId: value.expectedScope.actorUserId, profileId: value.expectedScope.profileId,
      declaredAt: value.planSnapshot.enrollment.declaredAt, pairCount: value.planSnapshot.enrollment.pairs.length,
      firstCaptureStatus: value.outcomeSnapshot === null ? 'NOT_RESERVED' : 'AVAILABLE' })),
    manifest: { contractVersion: 'kajo-personal-working-manifest-v2', selectionBasis: 'OWNER_DECLARED_NATIVE_ENROLLMENTS',
      evidenceBasis, scopeId: 'fixture', evaluationAsOf: declared.request.evaluationAsOf, entries } };
}
function experiment(declared, filled = false) {
  const { startAt, endAt } = declared.request.enrollmentWindow;
  const embargo = declared.request.horizonMs + declared.request.settlementMs;
  const value = { contractVersion: 'kajo-personal-working-quality-experiment-v1', cohortDeclarationDigest: declared.digest,
    sourceIdentity: { repositoryCommit: 'a'.repeat(40), migrationManifestSha256: 'b'.repeat(64),
      modelVersion: 'prediction-v1.0', baseModelVersion: 'prediction-v0.5-native-decay', policyVersion: policy },
    target: { quantity: 'PERSONAL_OWN_SCALE_EXPECTED_RATING', conditioning: 'POST_EXPERIENCE_AND_REPORTED', scale: { min: 0, max: 10 } },
    analysisUnit: 'PROFILE', controls: ['USER_MEAN', 'DOMAIN_PRIOR', 'CURRENT_RANKER_RANK_ONLY'],
    windows: { TRAIN: { startAt, endAt }, DEVELOPMENT: { startAt: endAt + embargo, endAt: endAt + embargo + 1000 },
      FINAL: { startAt: endAt + 2 * embargo + 1000, endAt: endAt + 2 * embargo + 2000 } }, dataRole: 'TRAIN',
    acceptance: { primaryMetric: 'PROFILE_MACRO_MSE', minimumUsefulImprovement: null, noninferiorityMargin: null },
    coverage: { minimumProfiles: null, minimumMatureNumericLabels: null, minimumLabelCoverage: null },
    precision: { intervalLevel: null, maximumIntervalWidth: null, method: null },
    resources: { p50Ms: null, p95Ms: null, maxRssMiB: null }, thresholdRationale: null };
  if (filled) {
    Object.assign(value.acceptance, { minimumUsefulImprovement: 0.1, noninferiorityMargin: 0 });
    Object.assign(value.coverage, { minimumProfiles: 2, minimumMatureNumericLabels: 4, minimumLabelCoverage: 0.5 });
    Object.assign(value.precision, { intervalLevel: 0.95, maximumIntervalWidth: 0.2, method: 'PROFILE_CLUSTER_BOOTSTRAP' });
    Object.assign(value.resources, { p50Ms: 10, p95Ms: 20, maxRssMiB: 128 });
    value.thresholdRationale = 'Engineering fixture values only, never native acceptance thresholds.';
  }
  return value;
}
async function build(entries = [entry()], options = {}) {
  const declared = declaration(), census = inventory(declared, entries, options.evidenceBasis);
  return buildWorkingQualityFeasibility(experiment(declared, options.filled), declared, census, 6000);
}
async function rejects(mutator, code) {
  const declared = declaration(), census = inventory(declared), protocol = experiment(declared);
  mutator(protocol, census);
  await assert.rejects(buildWorkingQualityFeasibility(protocol, declared, census, 6000), error =>
    error instanceof WorkingQualityFeasibilityError && error.code === code);
}

test('empty v2 cohort retains every Profile/domain, zero denominators and explicit missing protocol values', async () => {
  const report = await build([]);
  assert.equal(report.status, 'NOT_EVALUABLE'); assert.equal(report.protocolStatus, 'INSUFFICIENT');
  assert.equal(report.missingProtocolValues.length, 12);
  assert.equal(report.coverage.rosterProfiles, 2); assert.equal(report.coverage.byProfileDomain.length, 6);
  assert.equal(report.coverage.nativeLabelSlotCoverage, null);
  assert.equal(report.capabilities.numericalForecast.availableForecasts, 0);
  assert.equal(report.bindings.modelPolicyIdentity, 'NO_SUPPLIED_SOURCES');
  assert.ok(report.coverage.byProfileDomain.every(row => row.enrollments === 0 && row.matureNumericLabels === 0));
  for (const key of ['qualityAdmitted', 'nativeActivated', 'learnable', 'historicalFeatureEligible', 'numericalMetricsComputed']) assert.equal(report[key], false);
});

test('individual zero/tied ratings survive the ordinal mask, while fixture evidence never becomes native quality', async () => {
  const tied = entry(); tied.outcomeSnapshot.capture.labels[1].rating = 0;
  const report = await build([tied], { filled: true });
  assert.equal(report.protocolStatus, 'VALUES_PRESENT_NOT_ACCEPTANCE'); assert.equal(report.status, 'NOT_EVALUABLE');
  assert.equal(report.coverage.engineeringFixture.matureNumericLabels, 2);
  assert.equal(report.coverage.engineeringFixture.matureExperienceUnits, 2);
  assert.equal(report.coverage.engineeringFixture.comparablePairUnits, 0);
  assert.equal(report.coverage.engineeringFixture.pairExclusionReasons['all-tied'], 1);
  assert.equal(report.coverage.suppliedNative.matureNumericLabels, 0);
  assert.equal(report.coverage.nativeProfilesWithMatureLabels, 0);
  assert.equal(report.capabilities.frozenRanking.retainedCandidates, 6);
  assert.ok(report.reasonCodes.includes('NUMERIC_FORECAST_UNSUPPORTED'));
  assert.equal(report.capabilities.resourceMeasurement, 'NOT_PERFORMED_BUDGET_VALUES_ONLY');
  assert.equal(report.bindings.untouchedFinalWindow, 'NOT_ESTABLISHED');
});

test('one missing peer retains the other numeric label and supplied-native counts remain descriptive', async () => {
  const value = entry(), label = value.outcomeSnapshot.capture.labels[1];
  Object.assign(label, { status: 'missing', reason: 'NO_TERMINAL', eventId: null, occurredAt: null, rating: null });
  value.outcomeSnapshot.references.events.pop();
  const report = await build([value], { evidenceBasis: 'OWNER_AUTHORIZED_NATIVE_SNAPSHOTS' });
  assert.equal(report.coverage.suppliedNative.matureNumericLabels, 1);
  assert.equal(report.coverage.suppliedNative.recordedExposureUnits, 2);
  assert.equal(report.coverage.suppliedNative.matureExperienceUnits, 1);
  assert.equal(report.coverage.suppliedNative.labelStatuses.missing, 3);
  assert.equal(report.coverage.suppliedNative.comparablePairUnits, 0);
  assert.equal(report.coverage.nativeLabelSlotCoverage, 0.25);
  assert.equal(report.coverage.nativeProfilesWithMatureLabels, 1);
  assert.equal(report.bindings.currentAuthorization, 'NOT_ESTABLISHED_BY_FILE');
  assert.equal(report.qualityAdmitted, false);
});

test('null request domain is mixed, with no manufactured BOOK/MOVIE label attribution', async () => {
  const value = entry(); value.planSnapshot.sourceRun.requested_item_type = null;
  const report = await build([value]);
  assert.equal(report.coverage.byProfileDomain.find(row => row.domain === 'MIXED_OR_UNSPECIFIED').matureNumericLabels, 2);
  assert.equal(report.coverage.byProfileDomain.find(row => row.domain === 'BOOK').matureNumericLabels, 0);
});

test('missing, incomplete, not-yet-available and pre-maturity captures do not supply mature numeric support', async () => {
  for (const variant of ['absent', 'incomplete', 'unavailable', 'before-maturity']) {
    const value = entry();
    if (variant === 'absent') value.outcomeSnapshot = null;
    if (variant === 'incomplete') value.outcomeSnapshot.capture.complete = false;
    if (variant === 'unavailable') value.outcomeSnapshot.capture.capturedAt = 6500;
    if (variant === 'before-maturity') value.outcomeSnapshot.capture.capturedAt = 3000;
    const declared = declaration(), census = inventory(declared, [value]);
    const report = await buildWorkingQualityFeasibility(experiment(declared), declared, census, variant === 'unavailable' ? 7000 : 6000);
    assert.equal(report.coverage.engineeringFixture.matureNumericLabels, 0, variant);
    if (variant === 'absent') assert.equal(report.coverage.engineeringFixture.unreservedCaptureLabelSlots, 4);
    else assert.equal(report.coverage.engineeringFixture.reportedNumericLabels, 2);
  }
});

test('source identity, target, controls, temporal embargo and nullable numerical fields reject malformed input', async () => {
  for (const mutate of [value => { value.target.quantity = 'RANK_SCORE'; },
    value => { value.target.scale.min = 1; }, value => { value.acceptance.primaryMetric = 'PROFILE_MACRO_MAE'; }]) await rejects(mutate, 'TARGET_UNSUPPORTED');
  await rejects(value => { value.sourceIdentity.modelVersion = 'wrong-model'; }, 'SOURCE_IDENTITY_MISMATCH');
  await rejects(value => { value.cohortDeclarationDigest = 'c'.repeat(64); }, 'DECLARATION_MISMATCH');
  await rejects(value => { value.windows.DEVELOPMENT.startAt--; }, 'WINDOW_OVERLAP');
  await rejects(value => { value.dataRole = 'FINAL'; }, 'COHORT_OUTSIDE_ROLE');
  await rejects(value => { value.controls.pop(); }, 'EXPERIMENT_INVALID');
  for (const key of ['repositoryCommit', 'migrationManifestSha256']) {
    await rejects(value => { value.sourceIdentity[key] = [value.sourceIdentity[key]]; }, 'EXPERIMENT_INVALID');
  }
  for (const mutate of [value => { value.acceptance.minimumUsefulImprovement = -1; },
    value => { value.coverage.minimumProfiles = 1.5; }, value => { value.coverage.minimumLabelCoverage = 2; },
    value => { value.precision.intervalLevel = 1; }, value => { value.precision.method = 'PAIR_IID_BOOTSTRAP'; },
    value => { value.resources.p50Ms = 20; value.resources.p95Ms = 10; },
    value => { value.resources.maxRssMiB = Infinity; }, value => { delete value.resources.p95Ms; }]) {
    await rejects(mutate, mutate.toString().includes('delete') ? 'EXPERIMENT_INVALID' : 'THRESHOLD_INVALID');
  }
});

test('observed labels outside the frozen horizon reject before any feasibility counts are emitted', async () => {
  await rejects((_value, census) => { census.manifest.entries[0].outcomeSnapshot.capture.labels[0].occurredAt = 3200; },
    'COHORT_SNAPSHOT_REJECTED');
});

test('mature training labels must be available strictly before the next role starts, preserving reported counts', async () => {
  for (const capturedAt of [3999, 4000, 4001]) {
    const value = entry(); value.outcomeSnapshot.capture.capturedAt = capturedAt;
    const report = await build([value]);
    assert.equal(report.split.roleLabelAvailableBy, 4000);
    assert.equal(report.split.labelAvailabilityBoundary, 'STRICTLY_BEFORE_NEXT_ROLE_START');
    assert.equal(report.coverage.engineeringFixture.reportedNumericLabels, 2);
    assert.equal(report.coverage.engineeringFixture.matureNumericLabels, capturedAt < 4000 ? 2 : 0);
    assert.equal(report.coverage.engineeringFixture.excludedLabelReasons['capture-after-role-cutoff'], capturedAt < 4000 ? undefined : 4);
  }
});

test('development/final roles retain embargo and never certify an untouched final window', async () => {
  const declared = declaration({ enrollmentWindow: { startAt: 6000, endAt: 8000 }, evaluationAsOf: 10000 }, 5000);
  const protocol = experiment(declared, true);
  protocol.windows = { TRAIN: { startAt: 0, endAt: 1000 }, DEVELOPMENT: { startAt: 2000, endAt: 5000 },
    FINAL: { startAt: 6000, endAt: 8000 } };
  protocol.dataRole = 'FINAL';
  const report = await buildWorkingQualityFeasibility(protocol, declared, inventory(declared, []), 10000);
  assert.equal(report.split.embargoMs, 1000); assert.equal(report.split.dataRole, 'FINAL');
  assert.equal(report.split.roleLabelAvailableBy, 10000);
  assert.equal(report.split.labelAvailabilityBoundary, 'AT_OR_BEFORE_EVALUATION_AS_OF');
  assert.equal(report.bindings.untouchedFinalWindow, 'NOT_ESTABLISHED');
  assert.equal(report.status, 'NOT_EVALUABLE');
  protocol.windows.FINAL.startAt = 5999;
  await assert.rejects(buildWorkingQualityFeasibility(protocol, declared, inventory(declared, []), 10000),
    error => error.code === 'WINDOW_OVERLAP');
  protocol.windows.FINAL = { startAt: 6000, endAt: Number.MAX_SAFE_INTEGER };
  await assert.rejects(buildWorkingQualityFeasibility(protocol, declared, inventory(declared, []), 10000),
    error => error.code === 'WINDOW_INVALID');
});

test('withdrawal, duplicate native sources and input/outcome reuse remain fail-closed through the existing owner', async () => {
  await rejects((_value, census) => { census.inventory[0].firstCaptureStatus = 'WITHDRAWN'; }, 'COHORT_WITHDRAWN');
  await rejects((_value, census) => { census.inventory.push(structuredClone(census.inventory[0]));
    census.manifest.entries.push(structuredClone(census.manifest.entries[0])); }, 'COHORT_INVENTORY_INVALID');
  await rejects((_value, census) => {
    const item = census.manifest.entries[0], event = item.outcomeSnapshot.capture.labels[0].eventId;
    item.planSnapshot.sourceRun.state_snapshot.workingState.rawEvents.push({ id: event, actor_user_id: item.expectedScope.actorUserId,
      profile_id: item.expectedScope.profileId, session_id: item.expectedScope.sessionId, item_id: item.outcomeSnapshot.capture.labels[0].itemId,
      event_type: 'ITEM_RATED', occurred_at: 50, created_at: 50, properties: { rating: 9 } });
  }, 'COHORT_SOURCE_REUSE');
});

test('legacy v2 output and inputs are unchanged, and reordered inputs have deterministic feasibility output', async () => {
  const declared = declaration(), census = inventory(declared, [entry(), entry(1)]), protocol = experiment(declared);
  const before = JSON.stringify({ declared, census, protocol }), legacy = await buildWorkingCohortReport(declared, census, 6000);
  const first = await buildWorkingQualityFeasibility(protocol, declared, census, 6000);
  assert.equal(JSON.stringify({ declared, census, protocol }), before);
  assert.deepEqual(await buildWorkingCohortReport(declared, census, 6000), legacy);
  census.inventory.reverse(); census.manifest.entries.reverse();
  assert.deepEqual(await buildWorkingQualityFeasibility(protocol, declared, census, 6000), first);
  assert.ok(Object.isFrozen(first.coverage.byProfileDomain));
});

test('private CLI retains mode 0600, fixed messages, exclusive output, no Git output or symlink reads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-working-quality-'));
  try {
    const now = Date.now(), declared = declaration({ enrollmentWindow: { startAt: now - 11000, endAt: now - 9000 }, evaluationAsOf: now - 7000 }, now - 12000);
    const paths = ['experiment', 'declaration', 'inventory', 'report'].map(name => join(directory, `${name}.json`));
    for (const [index, value] of [experiment(declared), declared, inventory(declared, [])].entries()) await writeFile(paths[index], JSON.stringify(value));
    const command = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    const success = command(...paths);
    assert.equal(success.status, 0, success.stderr); assert.equal(success.stdout, 'WORKING_QUALITY_FEASIBILITY_REPORT_CREATED\n');
    assert.equal((await stat(paths[3])).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(paths[3], 'utf8')).status, 'NOT_EVALUABLE');
    const exists = command(...paths); assert.equal(exists.status, 1); assert.match(exists.stderr, /OUTPUT_EXISTS/u);
    const git = command(...paths.slice(0, 3), join(root, 'quality-private-test.json'));
    assert.equal(git.status, 1); assert.match(git.stderr, /OUTPUT_LOCATION/u);
    const link = join(directory, 'link.json'); await symlink(paths[0], link);
    const linked = command(link, ...paths.slice(1, 3), join(directory, 'new.json'));
    assert.equal(linked.status, 1); assert.match(linked.stderr, /INPUT_FILE/u);
    await writeFile(paths[0], '{private-secret');
    const malformed = command(...paths.slice(0, 3), join(directory, 'new.json'));
    assert.equal(malformed.status, 1); assert.equal(malformed.stderr, 'WORKING_QUALITY_FEASIBILITY_MANIFEST_INVALID\n');
    await assert.rejects(stat(join(directory, 'new.json')), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
