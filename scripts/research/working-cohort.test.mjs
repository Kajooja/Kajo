import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createWorkingCohortDeclaration, buildWorkingCohortReport, runWorkingCohortDeclaration,
  runWorkingCohortReport, WorkingCohortError } from '../../packages/prediction-engine/scripts/working-cohort.mjs';
import { buildWorkingReport, runWorkingReport, WORKING_NATIVE_SOURCE_ADMISSION } from '../../packages/prediction-engine/scripts/working-report.mjs';
import { workingReportFixtureEntry, workingReportNativeFixtureEntry } from './working-report.fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../../packages/prediction-engine/scripts/working-cohort.mjs', import.meta.url));
const DAY = 24 * 60 * 60 * 1000;
const id = number => `a9150000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const command = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024 });
function request(overrides = {}) {
  return { contractVersion: 'kajo-personal-working-cohort-request-v1', scopeId: 'fixture', cohortRef: 'fixture:cohort',
    roster: [{ actorUserId: id(1), profileId: id(2), actorRef: 'fixture:actor-0', subjectRef: 'fixture:subject-0' },
      { actorUserId: id(1001), profileId: id(1002), actorRef: 'fixture:actor-1', subjectRef: 'fixture:subject-1' }],
    enrollmentWindow: { startAt: 1200, endAt: 3000 }, horizonMs: 1000, settlementMs: 0, evaluationAsOf: 6000, ...overrides };
}
function entry(index = 0, native = false) {
  const result = (native ? workingReportNativeFixtureEntry : workingReportFixtureEntry)(index, false), seen = new Set();
  const clocks = new Set(['cutoff', 'asOf', 'availableAt', 'created_at', 'requested_at', 'snapshotObservedAt',
    'createdAt', 'declaredAt', 'startAt', 'endAt', 'matureAt', 'capturedAt', 'occurredAt', 'exposedAt', 'occurred_at',
    'nativeEvidenceAsOf', 'memoryStateAsOf', 'scenarioAsOf', 'requestAsOf', 'workingStateAsOf', 'eligibilityAt']);
  const scale = value => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (clocks.has(key) && typeof child === 'number') value[key] *= 10;
      else scale(child);
    }
  };
  scale(result);
  result.planSnapshot.enrollment.matureAt = 3100; result.outcomeSnapshot.capture.matureAt = 3100;
  return result;
}
function inventory(declaration, entries = [entry(0, declaration.request.contractVersion.endsWith('-v2'))]) {
  const version = declaration.request.contractVersion.endsWith('-v2') ? 'v2' : 'v1';
  return { contractVersion: `kajo-personal-working-cohort-inventory-${version}`, declarationDigest: declaration.digest,
    inventory: entries.map(value => ({ enrollmentId: value.expectedScope.enrollmentId, actorUserId: value.expectedScope.actorUserId,
      profileId: value.expectedScope.profileId, declaredAt: value.planSnapshot.enrollment.declaredAt,
      pairCount: value.planSnapshot.enrollment.pairs.length, firstCaptureStatus: value.outcomeSnapshot === null ? 'NOT_RESERVED' : 'AVAILABLE' })),
    manifest: { contractVersion: `kajo-personal-working-manifest-${version}`, selectionBasis: 'OWNER_DECLARED_NATIVE_ENROLLMENTS',
      evidenceBasis: 'ENGINEERING_FIXTURE', scopeId: 'fixture', evaluationAsOf: declaration.request.evaluationAsOf, entries } };
}
async function rejects(declaration, census, code, now = 6000) {
  await assert.rejects(buildWorkingCohortReport(declaration, census, now), error =>
    error instanceof WorkingCohortError && error.message === `WORKING_COHORT_${code}`);
}
async function workspace(work) {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-working-cohort-'));
  try { return await work(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
async function absent(path) { await assert.rejects(stat(path), { code: 'ENOENT' }); }
function failure(result, code) {
  assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.equal(result.stderr, `WORKING_COHORT_${code}\n`);
  assert.doesNotMatch(result.stderr, /synthetic-private-secret|a9150000|Error:|node:/);
}

test('canonical future declarations bind sorted explicit roster, native versions and fixed lifecycle without certifying timing or authenticity', () => {
  const value = request(), before = structuredClone(value), declaration = createWorkingCohortDeclaration(value, 1000);
  assert.deepEqual(value, before); assert.equal(Object.isFrozen(declaration.request.roster[0]), true);
  assert.equal(declaration.retainUntil, 6000 + 7 * DAY); assert.match(declaration.digest, /^[0-9a-f]{64}$/u);
  assert.equal(declaration.predeclarationAuthenticity, 'NOT_ESTABLISHED_BY_FILE');
  assert.equal(declaration.nativeInventoryCompleteness, 'NOT_ESTABLISHED_BY_FILE');
  assert.equal(declaration.integrityBasis, 'CANONICAL_SHA256_NOT_AUTHENTICATION');
  const reordered = request({ roster: [...value.roster].reverse() });
  assert.deepEqual(createWorkingCohortDeclaration(reordered, 1000), declaration);
  for (const changed of [null, { ...request(), extra: true }, request({ enrollmentWindow: { startAt: 1000, endAt: 3000 } }),
    request({ horizonMs: 999 }), request({ horizonMs: 1500 }), request({ horizonMs: 90 * DAY + 1000 }),
    request({ settlementMs: 1 }), request({ settlementMs: 7 * DAY + 1000 }), request({ evaluationAsOf: 3999 }),
    request({ evaluationAsOf: Number.MAX_SAFE_INTEGER }), request({ roster: [] }),
    request({ roster: Array.from({ length: 129 }, () => value.roster[0]) }), request({ roster: [value.roster[0], value.roster[0]] }),
    request({ cohortRef: value.roster[0].actorRef }), request({ scopeId: `fixture:${id(9)}` })]) {
    assert.throws(() => createWorkingCohortDeclaration(changed, 1000), { message: 'WORKING_COHORT_PROTOCOL_INVALID' });
  }
});

test('complete supplied inventory is deterministic, keeps missing pairs and zero-enrollment roster members, and never invents fixture quality', async () => {
  const declaration = createWorkingCohortDeclaration(request(), 1000), census = inventory(declaration), before = structuredClone(census);
  const report = await buildWorkingCohortReport(declaration, census, 6000);
  assert.deepEqual(census, before); assert.equal(report.result.plannedPairUnits, 2); assert.equal(report.result.comparablePairUnits, 1);
  assert.equal(report.result.unscoredPairUnits, 1); assert.equal(report.observedEvidencePairUnits, 0);
  assert.equal(report.cohort.rosterCoverage[0].enrollmentUnits, 1); assert.equal(report.cohort.rosterCoverage[1].enrollmentUnits, 0);
  assert.equal(report.cohort.supportStrata.UNAVAILABLE.plannedPairUnits, 2);
  assert.equal(report.cohort.suppliedEnrollmentUnits, 1); assert.equal(report.cohort.firstCaptureAvailableUnits, 1);
  assert.equal(report.cohort.declarationDigest, declaration.digest); assert.equal(report.independence, 'not-established');
  for (const key of ['predeclarationAuthenticity', 'nativeInventoryCompleteness', 'currentAuthorization', 'withdrawalStatus']) {
    assert.equal(report.cohort[key], 'NOT_ESTABLISHED_BY_FILE');
  }
  for (const key of ['historicalFeatureEligible', 'learnable', 'nativeActivated', 'qualityAdmitted']) assert.equal(report[key], false);
  assert.doesNotMatch(JSON.stringify(report), /a9150000|actorUserId|profileId/u);
  const all = inventory(declaration, [entry(), entry(1)]), swapped = structuredClone(all);
  swapped.inventory.reverse(); swapped.manifest.entries.reverse();
  assert.deepEqual(await buildWorkingCohortReport(declaration, swapped, 6000), await buildWorkingCohortReport(declaration, all, 6000));
  const empty = await buildWorkingCohortReport(declaration, inventory(declaration, []), 6000);
  assert.equal(empty.result.plannedPairUnits, 0); assert.equal(empty.cohort.rosterCoverage.length, 2);
});

test('hash, exact ledger-entry bijection, scope and budgets reject edits, omissions and favorable subsets', async () => {
  const declaration = createWorkingCohortDeclaration(request(), 1000);
  const edited = structuredClone(declaration); edited.request.horizonMs = 2000;
  await rejects(edited, inventory(declaration), 'DECLARATION_INVALID');
  const alteredRule = structuredClone(declaration); alteredRule.rules.support = 'ACTIVE_ONLY';
  await rejects(alteredRule, inventory(declaration), 'DECLARATION_INVALID');
  const wrongDigest = inventory(declaration); wrongDigest.declarationDigest = '0'.repeat(64);
  await rejects(declaration, wrongDigest, 'DECLARATION_MISMATCH');
  const omitted = inventory(declaration); omitted.manifest.entries = [];
  await rejects(declaration, omitted, 'INVENTORY_MISMATCH');
  const droppedLedger = inventory(declaration); droppedLedger.inventory = [];
  await rejects(declaration, droppedLedger, 'INVENTORY_MISMATCH');
  const duplicate = inventory(declaration); duplicate.inventory.push(structuredClone(duplicate.inventory[0]));
  await rejects(declaration, duplicate, 'INVENTORY_INVALID');
  const foreign = inventory(declaration); foreign.inventory[0].profileId = id(999);
  await rejects(declaration, foreign, 'INVENTORY_INVALID');
  const wrongCount = inventory(declaration); wrongCount.inventory[0].pairCount = 1;
  await rejects(declaration, wrongCount, 'INVENTORY_MISMATCH');
  const hiddenPairs = inventory(declaration); hiddenPairs.inventory[0].pairCount = 1;
  hiddenPairs.manifest.entries[0].planSnapshot.enrollment.pairs.pop(); hiddenPairs.manifest.entries[0].planSnapshot.planning.pairs.pop();
  hiddenPairs.manifest.entries[0].outcomeSnapshot = null; hiddenPairs.inventory[0].firstCaptureStatus = 'NOT_RESERVED';
  await rejects(declaration, hiddenPairs, 'PAIR_POLICY');
  const countOverflow = inventory(declaration); countOverflow.inventory = Array.from({ length: 129 }, () => countOverflow.inventory[0]);
  await rejects(declaration, countOverflow, 'INVENTORY_INVALID');
  const pairOverflow = inventory(declaration); pairOverflow.inventory = Array.from({ length: 6 }, (_, index) => ({
    ...pairOverflow.inventory[0], enrollmentId: id(9000 + index), pairCount: 25 }));
  await rejects(declaration, pairOverflow, 'BUDGET');
});

test('half-open window, exact native-second horizon, source clock and fixed evaluation boundaries fail closed', async () => {
  const boundaryRequest = request({ enrollmentWindow: { startAt: 2100, endAt: 3000 } });
  const declaration = createWorkingCohortDeclaration(boundaryRequest, 1000), left = inventory(declaration);
  left.manifest.entries[0].planSnapshot.sourceRun.requested_at = 2100;
  assert.equal((await buildWorkingCohortReport(declaration, left, 6000)).result.plannedPairUnits, 2);
  for (const at of [2099.999, 3000]) {
    const boundary = inventory(declaration); boundary.inventory[0].declaredAt = at;
    await rejects(declaration, boundary, 'INVENTORY_INVALID');
  }
  const standard = createWorkingCohortDeclaration(request(), 1000);
  const sourceBefore = inventory(standard); sourceBefore.manifest.entries[0].planSnapshot.sourceRun.requested_at = 1199.999;
  await rejects(standard, sourceBefore, 'SOURCE_BEFORE_WINDOW');
  const sourceAfter = inventory(standard); sourceAfter.manifest.entries[0].planSnapshot.sourceRun.requested_at = 2200;
  await rejects(standard, sourceAfter, 'SOURCE_BEFORE_WINDOW');
  const wrongHorizon = inventory(standard); wrongHorizon.manifest.entries[0].planSnapshot.enrollment.horizon.endAt++;
  await rejects(standard, wrongHorizon, 'HORIZON_MISMATCH');
  const wrongMaturity = inventory(standard); wrongMaturity.manifest.entries[0].planSnapshot.enrollment.matureAt++;
  await rejects(standard, wrongMaturity, 'HORIZON_MISMATCH');
  const differentEval = inventory(standard); differentEval.manifest.evaluationAsOf++;
  await rejects(standard, differentEval, 'INVENTORY_INVALID');
  await rejects(standard, inventory(standard), 'EVALUATION_NOT_READY', 5999.999);
  assert.equal((await buildWorkingCohortReport(standard, inventory(standard), standard.retainUntil)).result.plannedPairUnits, 2);
  await rejects(standard, inventory(standard), 'EXPIRED', standard.retainUntil + 0.001);
});

test('first reservation, withdrawal and honest read clocks retain absent/incomplete/future coverage without allowing replacement', async () => {
  const declaration = createWorkingCohortDeclaration(request(), 1000);
  const missing = inventory(declaration); missing.manifest.entries[0].outcomeSnapshot = null; missing.inventory[0].firstCaptureStatus = 'NOT_RESERVED';
  const absentReport = await buildWorkingCohortReport(declaration, missing, 6000);
  assert.equal(absentReport.result.unscoredPairUnits, 2); assert.equal(absentReport.cohort.firstCaptureNotReservedUnits, 1);
  const incomplete = inventory(declaration); incomplete.manifest.entries[0].outcomeSnapshot.capture.complete = false;
  assert.equal((await buildWorkingCohortReport(declaration, incomplete, 6000)).result.unscoredPairUnits, 2);
  const future = inventory(declaration); future.manifest.entries[0].outcomeSnapshot.capture.capturedAt = 6500;
  assert.equal((await buildWorkingCohortReport(declaration, future, 6600)).result.unscoredPairUnits, 2);
  await rejects(declaration, future, 'FUTURE_SNAPSHOT', 6000);
  for (const variant of ['revision2', 'withdrawn', 'nullAvailable', 'hiddenAvailable', 'unknownStatus']) {
    const changed = inventory(declaration);
    if (variant === 'revision2') changed.manifest.entries[0].outcomeSnapshot.capture.revision = 2;
    if (variant === 'withdrawn') changed.inventory[0].firstCaptureStatus = 'WITHDRAWN';
    if (variant === 'nullAvailable') changed.manifest.entries[0].outcomeSnapshot = null;
    if (variant === 'hiddenAvailable') changed.inventory[0].firstCaptureStatus = 'NOT_RESERVED';
    if (variant === 'unknownStatus') changed.inventory[0].firstCaptureStatus = 'NONE';
    await rejects(declaration, changed, variant === 'withdrawn' ? 'WITHDRAWN' : variant === 'unknownStatus' ? 'INVENTORY_INVALID' : 'CAPTURE_STATUS');
  }
});

test('OFF pairs are adjacent within each tier, preserve odd tails, and reserve aliases for every registered actor', async () => {
  const declaration = createWorkingCohortDeclaration(request(), 1000), swapped = inventory(declaration);
  const planned = swapped.manifest.entries[0].planSnapshot;
  for (const pairs of [planned.enrollment.pairs, planned.planning.pairs]) {
    [pairs[0].rightItemId, pairs[1].leftItemId] = [pairs[1].leftItemId, pairs[0].rightItemId];
  }
  swapped.manifest.entries[0].outcomeSnapshot = null; swapped.inventory[0].firstCaptureStatus = 'NOT_RESERVED';
  await rejects(declaration, swapped, 'PAIR_POLICY');
  const reversed = inventory(declaration); reversed.manifest.entries[0].outcomeSnapshot = null; reversed.inventory[0].firstCaptureStatus = 'NOT_RESERVED';
  for (const pairs of [reversed.manifest.entries[0].planSnapshot.enrollment.pairs, reversed.manifest.entries[0].planSnapshot.planning.pairs]) {
    [pairs[0].leftItemId, pairs[0].rightItemId] = [pairs[0].rightItemId, pairs[0].leftItemId];
  }
  await rejects(declaration, reversed, 'PAIR_POLICY');
  const tail = inventory(declaration), plan = tail.manifest.entries[0].planSnapshot;
  plan.sourceCandidates[3].explanation.resurfacingPolicy.classification = 'SAVED_REMINDER';
  for (const comparison of plan.comparisons) comparison.result.candidates[3].tier = 1;
  plan.enrollment.pairs.pop(); plan.planning.pairs.pop(); tail.inventory[0].pairCount = 1;
  tail.inventory[0].firstCaptureStatus = 'NOT_RESERVED'; tail.manifest.entries[0].outcomeSnapshot = null;
  const tailReport = await buildWorkingCohortReport(declaration, tail, 6000);
  assert.equal(tailReport.result.plannedPairUnits, 1); assert.equal(tailReport.cohort.oddTierTailCandidates, 2);
  const crossTier = structuredClone(tail); crossTier.manifest.entries[0].planSnapshot.enrollment.pairs[0].rightItemId = id(23);
  crossTier.manifest.entries[0].planSnapshot.planning.pairs[0].rightItemId = id(23);
  await rejects(declaration, crossTier, 'PAIR_POLICY');
  const absentAlias = inventory(declaration); absentAlias.manifest.entries[0].planSnapshot.references.objects[0].objectRef = 'fixture:actor-1';
  await rejects(declaration, absentAlias, 'ROSTER_ALIASES');
  for (const target of ['plan', 'outcome']) {
    const malformed = inventory(declaration);
    if (target === 'plan') malformed.manifest.entries[0].planSnapshot.references.objects = {};
    else malformed.manifest.entries[0].outcomeSnapshot.references.events = [null];
    await rejects(declaration, malformed, 'SNAPSHOT_REJECTED');
  }
});

test('existing v1 builder and CLI retain identical bytes and behavior after extraction', async () => {
  await workspace(async directory => {
    const declaration = createWorkingCohortDeclaration(request(), 1000), census = inventory(declaration), value = census.manifest;
    const expected = await buildWorkingReport(value), input = join(directory, 'input.json'), output = join(directory, 'report.json');
    const prettyHash = body => createHash('sha256').update(`${JSON.stringify(body, null, 2)}\n`).digest('hex');
    // Captured from accepted main 286cc83 before adding the v2 branch. Comparing
    // two current functions alone would miss a coordinated change to v1 bytes.
    assert.equal(declaration.digest, '747a1065aca65723bf617c688f1a73210f7276ea94a62c040d30fa90fcac4616');
    assert.equal(prettyHash(declaration), 'c7e333687baec14019e084c34e8254b210ee0a8d1f52017b03815481cfbe18dc');
    assert.equal(prettyHash(expected), '137c38cf448b863d7a2dadf67fc2f6595862eef92042c7071bbcfe552cd1f28d');
    assert.equal(prettyHash(await buildWorkingCohortReport(declaration, census, 6000)),
      'aaa0c733f0f825afd8561f1d7ab8715a3e93652db240abe1fb55a11e8bcf3791');
    await writeFile(input, JSON.stringify(value)); assert.deepEqual(await runWorkingReport(input, output), expected);
    assert.equal(await readFile(output, 'utf8'), `${JSON.stringify(expected, null, 2)}\n`);
  });
});

test('v2 declaration pins native admission before outcomes and rejects edited or mixed generations even when empty', async () => {
  const declarations = ['v1', 'v2'].map(version => createWorkingCohortDeclaration(request({
    contractVersion: `kajo-personal-working-cohort-request-${version}` }), 1000));
  const declaration = declarations[1];
  assert.equal(declaration.contractVersion, 'kajo-personal-working-cohort-declaration-v2');
  assert.deepEqual(declaration.rules.nativeSourceAdmission, WORKING_NATIVE_SOURCE_ADMISSION);
  assert.equal(Object.isFrozen(declaration.rules.nativeSourceAdmission.clocks), true);
  assert.equal(declarations[0].rules.nativeSourceAdmission, undefined);
  assert.notEqual(declaration.digest, declarations[0].digest);
  for (const declared of declarations) {
    const version = declared.request.contractVersion.slice(-2);
    for (const inventoryVersion of ['v1', 'v2', 'v3']) for (const manifestVersion of ['v1', 'v2', 'v3']) {
      const census = inventory(declared, []);
      census.contractVersion = `kajo-personal-working-cohort-inventory-${inventoryVersion}`;
      census.manifest.contractVersion = `kajo-personal-working-manifest-${manifestVersion}`;
      if (inventoryVersion === version && manifestVersion === version) {
        const report = await buildWorkingCohortReport(declared, census, 6000);
        assert.equal(report.contractVersion, `kajo-personal-working-cohort-report-${version}`);
        assert.equal(report.result.plannedPairUnits, 0);
        if (version === 'v2') assert.deepEqual(report.nativeSourceAdmission.sources, []);
      } else await rejects(declared, census, 'DECLARATION_MISMATCH');
    }
  }
  const changes = [
    value => { value.rules.nativeSourceAdmission.absoluteScoreTolerance = 2e-12; },
    value => { value.rules.nativeSourceAdmission.clocks.arithmetic = 'CURRENT_WALL_TIME'; },
    value => { value.rules.nativeSourceAdmission.precision = 'ROUND_TO_MILLISECONDS'; },
    value => { value.rules.nativeSourceAdmission.candidateRequest = 'native-candidate-request-v2'; },
    value => { value.rules.nativeSourceAdmission.adapter.ranking = 'frozen-ranking-v2'; },
    value => { value.rules.nativeSourceAdmission.intent = 'EVALUATION'; },
    value => { value.rules.nativeSourceAdmission.comparedFields.pop(); },
    value => { value.rules.sourceVersions.resolution = 'first-label-v1'; },
    value => { value.contractVersion = 'kajo-personal-working-cohort-declaration-v1'; },
    value => { value.request.contractVersion = 'kajo-personal-working-cohort-request-v1'; },
  ];
  for (const change of changes) {
    const edited = structuredClone(declaration); change(edited);
    const { digest: ignored, ...body } = edited; void ignored;
    edited.digest = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    await rejects(edited, inventory(edited, []), 'DECLARATION_INVALID');
  }
  for (const extra of ['absoluteScoreTolerance', 'clocks', 'sourceVersions', 'nativeSourceAdmission']) {
    assert.throws(() => createWorkingCohortDeclaration({ ...declaration.request, [extra]: {} }, 1000),
      { message: 'WORKING_COHORT_PROTOCOL_INVALID' });
  }
});

test('v2 admits complete native OFF pools while preserving coverage, first capture, windows, pair policy and withdrawal', async () => {
  const declaration = createWorkingCohortDeclaration(request({ contractVersion: 'kajo-personal-working-cohort-request-v2' }), 1000);
  const census = inventory(declaration), before = structuredClone(census);
  const report = await buildWorkingCohortReport(declaration, census, 6000);
  assert.deepEqual(census, before);
  assert.equal(report.contractVersion, 'kajo-personal-working-cohort-report-v2');
  assert.deepEqual(report.cohort.rules.nativeSourceAdmission, report.nativeSourceAdmission.rules);
  assert.equal(report.nativeSourceAdmission.sources.length, 1);
  assert.equal(report.nativeSourceAdmission.sources[0].comparedCandidates, 6);
  assert.equal(report.nativeSourceAdmission.sources[0].selectedCandidates, 4);
  assert.equal(report.nativeSourceAdmission.sources[0].maxAbsoluteScoreDifference, 0);
  assert.equal(report.result.plannedPairUnits, 2); assert.equal(report.result.comparablePairUnits, 1);
  assert.equal(report.result.unscoredPairUnits, 1); assert.equal(report.observedEvidencePairUnits, 0);
  assert.equal(report.cohort.rosterCoverage[1].enrollmentUnits, 0);
  assert.equal(report.cohort.rules.captureSelection, 'FIRST_RESERVED_CAPTURE_REVISION_1');
  assert.equal(report.cohort.rules.sourceVersions.resolution, 'personal-latest-terminal-v1');
  assert.doesNotMatch(JSON.stringify(report), /a9150000|actorUserId|profileId|sourceGenome|genome_id/u);
  for (const key of ['historicalFeatureEligible', 'learnable', 'nativeActivated', 'qualityAdmitted']) assert.equal(report[key], false);
  const all = inventory(declaration, [entry(0, true), entry(1, true)]), reordered = structuredClone(all);
  reordered.inventory.reverse(); reordered.manifest.entries.reverse();
  assert.deepEqual(await buildWorkingCohortReport(declaration, all, 6000), await buildWorkingCohortReport(declaration, reordered, 6000));
  const missing = structuredClone(census); missing.manifest.entries[0].outcomeSnapshot = null;
  missing.inventory[0].firstCaptureStatus = 'NOT_RESERVED';
  const absent = await buildWorkingCohortReport(declaration, missing, 6000);
  assert.equal(absent.result.unscoredPairUnits, 2); assert.equal(absent.nativeSourceAdmission.sources[0].comparedCandidates, 6);
  const changedLabel = structuredClone(census); changedLabel.manifest.entries[0].outcomeSnapshot.capture.labels[0].rating = 10;
  const corrected = await buildWorkingCohortReport(declaration, changedLabel, 6000);
  assert.equal(corrected.result.reports[0].pairs[0].observedOrder, 'tie');
  assert.deepEqual(corrected.nativeSourceAdmission, report.nativeSourceAdmission);
  const variants = [
    ['INVENTORY_MISMATCH', value => { value.manifest.entries = []; }],
    ['INVENTORY_INVALID', value => { value.inventory[0].declaredAt = 3000; }],
    ['HORIZON_MISMATCH', value => { value.manifest.entries[0].planSnapshot.enrollment.matureAt++; }],
    ['CAPTURE_STATUS', value => { value.manifest.entries[0].outcomeSnapshot.capture.revision = 2; }],
    ['WITHDRAWN', value => { value.inventory[0].firstCaptureStatus = 'WITHDRAWN'; }],
    ['ROSTER_ALIASES', value => { value.manifest.entries[0].planSnapshot.references.objects[0].objectRef = 'fixture:actor-1'; }],
    ['PAIR_POLICY', value => {
      for (const pairs of [value.manifest.entries[0].planSnapshot.enrollment.pairs, value.manifest.entries[0].planSnapshot.planning.pairs]) {
        [pairs[0].leftItemId, pairs[0].rightItemId] = [pairs[0].rightItemId, pairs[0].leftItemId];
      }
      value.manifest.entries[0].outcomeSnapshot = null; value.inventory[0].firstCaptureStatus = 'NOT_RESERVED';
    }],
  ];
  for (const [code, change] of variants) { const changed = structuredClone(census); change(changed); await rejects(declaration, changed, code); }
  await rejects(declaration, census, 'EVALUATION_NOT_READY', 5999.999);
  await rejects(declaration, census, 'EXPIRED', declaration.retainUntil + 0.001);
});

test('owner CLI stamps only a future declaration, emits fixed private errors and reuses exclusive no-follow output outside Git', async () => {
  await workspace(async directory => {
    const input = join(directory, 'synthetic-private-secret.json'), output = join(directory, 'declaration.json');
    failure(command(), 'ARGUMENTS'); failure(command('report', input, output), 'ARGUMENTS');
    failure(command('declare', input, output), 'INPUT_FILE');
    await writeFile(input, '{synthetic-private-secret'); failure(command('declare', input, output), 'MANIFEST_INVALID');
    const now = Date.now(), protocol = request({ enrollmentWindow: { startAt: now + 60_000, endAt: now + 120_000 }, evaluationAsOf: now + 122_000 });
    await writeFile(input, JSON.stringify(protocol));
    const result = command('declare', input, output); assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'WORKING_COHORT_DECLARED\n'); assert.equal(result.stderr, '');
    const declaration = JSON.parse(await readFile(output, 'utf8'));
    assert.ok(declaration.createdAt >= now && declaration.createdAt < protocol.enrollmentWindow.startAt);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    failure(command('declare', input, output), 'OUTPUT_EXISTS');
    const linked = join(directory, 'linked.json'); await symlink(input, linked);
    failure(command('declare', linked, join(directory, 'new.json')), 'INPUT_FILE');
    const inGit = join(root, 'synthetic-private-secret-cohort.json');
    failure(command('declare', input, inGit), 'OUTPUT_LOCATION'); await absent(inGit);
    const census = join(directory, 'inventory.json'); await writeFile(census, JSON.stringify(inventory(declaration, [])));
    const reportPath = join(directory, 'report.json');
    failure(command('report', output, census, reportPath), 'EVALUATION_NOT_READY'); await absent(reportPath);
    await writeFile(input, ' '.repeat(16 * 1024 * 1024 + 1));
    failure(command('declare', input, join(directory, 'oversized.json')), 'INPUT_TOO_LARGE');
  });
});

test('private report CLI success and expiration retain identical cohort binding without real native data or trusted timestamps', async () => {
  await workspace(async directory => {
    const now = Date.now(), declaration = createWorkingCohortDeclaration(request({
      enrollmentWindow: { startAt: now - 10_000, endAt: now - 8_000 }, evaluationAsOf: now - 6_000 }), now - 12_000);
    const census = inventory(declaration, []), declarationPath = join(directory, 'declaration.json'), inventoryPath = join(directory, 'inventory.json');
    const output = join(directory, 'report.json');
    await writeFile(declarationPath, JSON.stringify(declaration)); await writeFile(inventoryPath, JSON.stringify(census));
    const result = command('report', declarationPath, inventoryPath, output);
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, 'WORKING_COHORT_REPORT_CREATED\n');
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    const saved = JSON.parse(await readFile(output, 'utf8')); assert.equal(saved.cohort.declarationDigest, declaration.digest);
    assert.equal(saved.result.plannedPairUnits, 0); assert.equal(saved.cohort.rosterCoverage.length, 2);
    assert.equal(saved.cohort.predeclarationAuthenticity, 'NOT_ESTABLISHED_BY_FILE');
    const originalClock = Date.now; Date.now = () => declaration.retainUntil + 1;
    try { await assert.rejects(runWorkingCohortReport(declarationPath, inventoryPath, join(directory, 'expired.json')),
      { message: 'WORKING_COHORT_EXPIRED' }); }
    finally { Date.now = originalClock; }
    await absent(join(directory, 'expired.json'));
    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    try { await assert.rejects(runWorkingCohortDeclaration(inputMissing(), output), { message: 'WORKING_COHORT_PLATFORM' }); }
    finally { Object.defineProperty(process, 'platform', platform); }
  });
});
function inputMissing() { return '/synthetic-private-secret-missing'; }
