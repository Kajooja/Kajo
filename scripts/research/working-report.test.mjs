import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, open, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertWorkingReportPlatform, buildWorkingReport, runWorkingReport, WorkingReportError,
  WORKING_NATIVE_SOURCE_ADMISSION } from '../../packages/prediction-engine/scripts/working-report.mjs';
import { createPrivateReportFiles } from '../../packages/prediction-engine/scripts/private-report-files.mjs';
import { workingReportFixtureEntry as entry, workingReportNativeFixtureEntry as nativeEntry } from './working-report.fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../../packages/prediction-engine/scripts/working-report.mjs', import.meta.url));
const id = number => `a9150000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const manifest = overrides => ({ contractVersion: 'kajo-personal-working-manifest-v1',
  selectionBasis: 'OWNER_DECLARED_NATIVE_ENROLLMENTS', evidenceBasis: 'ENGINEERING_FIXTURE',
  scopeId: 'fixture', evaluationAsOf: 600, entries: [], ...overrides });
const nativeManifest = overrides => manifest({ contractVersion: 'kajo-personal-working-manifest-v2', ...overrides });
const command = (...args) => spawnSync(process.execPath, [cli, ...args], {
  cwd: root, encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024,
});
async function workspace(work) {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-working-report-'));
  try { return await work(directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
async function absent(path) { await assert.rejects(stat(path), { code: 'ENOENT' }); }
function failure(result, code) {
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.equal(result.stderr, `WORKING_REPORT_${code}\n`);
  assert.doesNotMatch(result.stderr, /synthetic-private-secret|postgresql:|Error:|node:|a9150000/);
}

async function runManifest(directory, value, name = 'report') {
  const input = join(directory, `${name}-input.json`), output = join(directory, `${name}.json`);
  await writeFile(input, JSON.stringify(value));
  const result = command(input, output);
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, 'WORKING_REPORT_CREATED\n');
  assert.equal(result.stderr, ''); assert.equal((await stat(output)).mode & 0o777, 0o600);
  return JSON.parse(await readFile(output, 'utf8'));
}

test('POSIX capability rejection precedes every path and keeps the pure evaluator portable', async () => {
  assert.doesNotThrow(() => assertWorkingReportPlatform());
  for (const platform of ['win32', 'freebsd', 'synthetic-private-secret']) {
    assert.throws(() => assertWorkingReportPlatform(platform), { message: 'WORKING_REPORT_PLATFORM' });
  }
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  try { await assert.rejects(runWorkingReport('/synthetic-private-secret', '/missing/report.json'),
    { message: 'WORKING_REPORT_PLATFORM' }); }
  finally { Object.defineProperty(process, 'platform', original); }
});

test('empty and producer-shaped reports preserve zero fixture quality, zero ratings, missing-pair coverage and exact deterministic bytes', async () => {
  await workspace(async directory => {
    const empty = await runManifest(directory, manifest(), 'empty');
    assert.equal(empty.result.plannedPairUnits, 0); assert.equal(empty.observedEvidencePairUnits, 0);
    assert.deepEqual(empty.actorClusters, { actors: 0, actorSessions: 0, observedActors: 0, observedActorSessions: 0 });
    const value = manifest({ entries: [entry()] }), before = JSON.stringify(value);
    const first = await runManifest(directory, value, 'first'), second = await runManifest(directory, value, 'second');
    assert.deepEqual(second, first); assert.equal(JSON.stringify(value), before);
    assert.equal(await readFile(join(directory, 'first.json'), 'utf8'), await readFile(join(directory, 'second.json'), 'utf8'));
    assert.equal(first.result.plannedPairUnits, 2); assert.equal(first.result.comparablePairUnits, 1);
    assert.equal(first.result.unscoredPairUnits, 1); assert.equal(first.result.observedNativePairUnits, 1);
    assert.equal(first.observedEvidencePairUnits, 0); assert.equal(first.result.reports[0].pairs[0].observedOrder, 'right');
    assert.equal(first.result.reports[0].pairs[1].reasons.includes('missing-label'), true);
    assert.equal(first.commitAvailability, 'UNKNOWN'); assert.equal(first.sourceAuthenticity, 'NOT_ESTABLISHED_BY_FILE');
    assert.equal(first.cohortSelectionWasPredeclared, 'NOT_ESTABLISHED'); assert.equal(first.cohortWindowPreregistered, 'NOT_ESTABLISHED');
    assert.equal(first.independence, 'not-established'); assert.equal(first.result.independence, 'not-established');
    assert.equal(first.uncertainty, 'unavailable');
    for (const key of ['historicalFeatureEligible', 'learnable', 'nativeActivated', 'qualityAdmitted']) {
      assert.equal(first[key], false); assert.equal(first.result[key], false);
    }
    assert.doesNotMatch(JSON.stringify(first), /a9150000|actorUserId|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu);
  });
});

test('v1 empty and populated report bytes retain their accepted hashes', async () => {
  const expected = ['10d6179ac569ee3c6f1664e5cc21f65cda3b5c8965d28390ce7b422bd8028ce5',
    '15e9bd2255781255e51d53ffd41b2f46ccc69f7e31f83969ab21f4f1ff90d70d'];
  for (const [index, entries] of [[], [entry()]].entries()) {
    const report = await buildWorkingReport(manifest({ entries }));
    assert.equal(createHash('sha256').update(`${JSON.stringify(report, null, 2)}\n`).digest('hex'), expected[index]);
    assert.equal(Object.hasOwn(report, 'nativeSourceAdmission'), false);
  }
});

test('v2 admits the complete retained OFF pool without exposing native inputs or altering pair denominators', async () => {
  await workspace(async directory => {
    const value = nativeManifest({ entries: [nativeEntry()] }), before = JSON.stringify(value);
    const first = await runManifest(directory, value, 'native-first');
    const second = await runManifest(directory, value, 'native-second');
    assert.deepEqual(first, second); assert.equal(JSON.stringify(value), before);
    assert.equal(await readFile(join(directory, 'native-first.json'), 'utf8'), await readFile(join(directory, 'native-second.json'), 'utf8'));
    assert.equal(first.contractVersion, 'kajo-personal-working-report-v2');
    assert.deepEqual(first.nativeSourceAdmission, { rules: WORKING_NATIVE_SOURCE_ADMISSION, sources: [{
      sourcePredictionRef: 'fixture:source-0', enrollmentRef: 'fixture:enrollment-0', acquisition: 'LEGACY_DISCOVERY',
      status: 'PASS', comparedCandidates: 6, selectedCandidates: 4, maxAbsoluteScoreDifference: 0 }] });
    assert.equal(first.result.plannedPairUnits, 2); assert.equal(first.result.comparablePairUnits, 1);
    assert.equal(first.result.unscoredPairUnits, 1); assert.equal(first.observedEvidencePairUnits, 0);
    assert.equal(first.result.reports[0].plan.controls.OFF.candidates.length, 6);
    assert.deepEqual(first.result.reports[0].plan.controls.OFF.candidates.slice(4).map(candidate => [candidate.eligible, candidate.selected]),
      [[true, false], [false, false]]);
    for (const key of ['historicalFeatureEligible', 'learnable', 'nativeActivated', 'qualityAdmitted']) assert.equal(first[key], false);
    assert.doesNotMatch(JSON.stringify(first), /a9150000|sourceGenome|scoringFeatures|inputSnapshot|state_snapshot/u);
    const empty = await buildWorkingReport(nativeManifest());
    assert.deepEqual(empty.nativeSourceAdmission.sources, []); assert.equal(empty.result.plannedPairUnits, 0);
    const owner = await buildWorkingReport(nativeManifest({ evidenceBasis: 'OWNER_AUTHORIZED_NATIVE_SNAPSHOTS', entries: [nativeEntry()] }));
    assert.equal(owner.observedEvidencePairUnits, 1); assert.equal(owner.sourceAuthenticity, 'NOT_ESTABLISHED_BY_FILE');
    assert.equal(owner.commitAvailability, 'UNKNOWN'); assert.equal(owner.qualityAdmitted, false);
  });
});

test('v2 rules are fixed and nested-frozen, while sourceGenome and generation cannot cross manifest versions', async () => {
  for (const value of [WORKING_NATIVE_SOURCE_ADMISSION, WORKING_NATIVE_SOURCE_ADMISSION.adapter,
    WORKING_NATIVE_SOURCE_ADMISSION.clocks, WORKING_NATIVE_SOURCE_ADMISSION.acquisitions,
    WORKING_NATIVE_SOURCE_ADMISSION.comparedFields]) assert.equal(Object.isFrozen(value), true);
  assert.throws(() => { WORKING_NATIVE_SOURCE_ADMISSION.absoluteScoreTolerance = 1; }, TypeError);
  assert.throws(() => { WORKING_NATIVE_SOURCE_ADMISSION.acquisitions.push('EXPLICIT_CANONICAL'); }, TypeError);
  for (const value of [nativeManifest({ entries: [entry()] }), manifest({ entries: [nativeEntry()] }),
    nativeManifest({ nativeSourceAdmission: { absoluteScoreTolerance: 1 } })]) {
    await assert.rejects(buildWorkingReport(value), { code: 'MANIFEST_INVALID' });
  }
  const old = entry(); old.planSnapshot.sourceGenome = nativeEntry().planSnapshot.sourceGenome;
  await assert.rejects(buildWorkingReport(nativeManifest({ entries: [old] })), { code: 'SNAPSHOT_REJECTED' });
});

test('v2 catalogue acquisition preserves its declared seen prefix and maps reordered aliases over the complete OFF pool', async () => {
  const item = nativeEntry(), snapshot = item.planSnapshot, source = snapshot.sourceRun, state = source.state_snapshot;
  source.policy_version = source.policy_version.replace('+personal-working', '+catalog-chain-v1+personal-working');
  Object.assign(state.candidateRequest, { acquisition: 'CATALOG_CHAIN', seenItemIds: [id(999)], reminderSpent: true });
  state.predictionInput.candidateAcquisition = 'CATALOG_CHAIN';
  for (const candidate of snapshot.sourceCandidates) {
    candidate.explanation.policyVersion = source.policy_version;
    Object.assign(candidate.explanation.candidatePool, { catalogChainVersion: 'catalog-chain-v1', seenCount: 1,
      reminderPreviouslyDelivered: true, seenPrefixHash: '0'.repeat(32) });
  }
  for (const comparison of snapshot.comparisons) comparison.result.sourcePolicyVersion = source.policy_version;
  snapshot.sourceCandidates.reverse(); snapshot.references.objects.reverse();
  snapshot.comparisons.reverse();
  for (const comparison of snapshot.comparisons) comparison.result.candidates.reverse();
  const report = await buildWorkingReport(nativeManifest({ entries: [item] }));
  assert.equal(report.nativeSourceAdmission.sources[0].acquisition, 'CATALOG_CHAIN');
  assert.equal(report.nativeSourceAdmission.sources[0].comparedCandidates, 6);
  assert.equal(report.nativeSourceAdmission.sources[0].maxAbsoluteScoreDifference, 0);
  assert.equal(report.result.plannedPairUnits, 2); assert.equal(report.observedEvidencePairUnits, 0);
});

test('v2 native admission retains missing, immature, unknown and tied label coverage', async () => {
  for (const variant of ['missing', 'incomplete', 'future', 'unknown', 'tie']) {
    const item = nativeEntry();
    if (variant === 'missing') item.outcomeSnapshot = null;
    if (variant === 'incomplete') item.outcomeSnapshot.capture.complete = false;
    if (variant === 'future') item.outcomeSnapshot.capture.capturedAt = 650;
    if (variant === 'unknown') Object.assign(item.outcomeSnapshot.capture.labels[0], { status: 'unknown', rating: null });
    if (variant === 'tie') item.outcomeSnapshot.capture.labels[1].rating = 0;
    const report = await buildWorkingReport(nativeManifest({ entries: [item] }));
    assert.equal(report.nativeSourceAdmission.sources[0].comparedCandidates, 6);
    assert.equal(report.result.plannedPairUnits, 2); assert.equal(report.result.comparablePairUnits, 0);
    assert.equal(report.result.unscoredPairUnits, 2); assert.equal(report.observedEvidencePairUnits, 0);
    const reason = { missing: 'malformed-capture', incomplete: 'incomplete-capture', future: 'capture-unavailable',
      unknown: 'unknown-label', tie: 'all-tied' }[variant];
    assert.equal(report.result.reports[0].pairs[0].reasons.includes(reason), true);
  }
});

test('v2 rejects unsupported envelopes, clocks, genome bindings and malformed native rows before reporting', async () => {
  const mutations = [
    snapshot => { delete snapshot.sourceRun.state_snapshot.candidateRequest; },
    snapshot => { delete snapshot.sourceRun.state_snapshot.predictionInput; },
    snapshot => { snapshot.sourceRun.state_snapshot.candidateRequest.version = 'native-candidate-request-v2'; },
    snapshot => { snapshot.sourceRun.state_snapshot.predictionInput.version = 'native-prediction-clocks-v2'; },
    snapshot => { snapshot.sourceRun.state_snapshot.candidateRequest.intent = 'EVALUATION'; },
    snapshot => { snapshot.sourceRun.state_snapshot.candidateRequest.acquisition = 'EXPLICIT_CANONICAL'; },
    snapshot => { snapshot.sourceRun.state_snapshot.candidateRequest.requiredAfter = '1970-01-01T00:00:00Z'; },
    snapshot => { snapshot.sourceRun.state_snapshot.predictionInput.memoryStateAsOf = 91; },
    snapshot => { snapshot.sourceRun.state_snapshot.predictionInput.nativeEvidenceAsOf = 121; },
    snapshot => { snapshot.sourceRun.state_snapshot.predictionInput.requestAsOf = 121; },
    snapshot => { snapshot.sourceRun.state_snapshot.predictionInput.workingStateAsOf = 100.001; },
    snapshot => { snapshot.sourceRun.state_snapshot.predictionInput.eligibilityClock = 'TRANSACTION_START'; },
    snapshot => { snapshot.sourceRun.state_snapshot.predictionInput.commitVisibility = 'KNOWN'; },
    snapshot => { snapshot.sourceRun.state_snapshot.predictionInput.historicalReconstruction = 'AVAILABLE'; },
    snapshot => { snapshot.sourceGenome = null; },
    snapshot => { snapshot.sourceGenome.id = id(999); },
    snapshot => { snapshot.sourceGenome.created_at = 121; },
    snapshot => { snapshot.sourceGenome.feature_version = 'prediction-features-v2'; },
    snapshot => { snapshot.sourceCandidates[0].explanation.scalarGenome.genomeId = id(999); },
    snapshot => { snapshot.sourceCandidates[0].explanation.scoringFeatures.nativeEvidenceAsOf = 91; },
    snapshot => { snapshot.sourceCandidates[0].explanation.candidatePool.eligibilityAt = 119; },
    snapshot => { snapshot.sourceCandidates[0].source_rank = 2; snapshot.sourceCandidates[1].source_rank = 1; },
    snapshot => { snapshot.sourceCandidates[0].confidence = 2; },
    snapshot => {
      snapshot.sourceRun.policy_version += '+frozen-page-v1';
      for (const candidate of snapshot.sourceCandidates) candidate.explanation.policyVersion = snapshot.sourceRun.policy_version;
      for (const comparison of snapshot.comparisons) comparison.result.sourcePolicyVersion = snapshot.sourceRun.policy_version;
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const value = nativeManifest({ entries: [nativeEntry()] }); mutate(value.entries[0].planSnapshot);
    await assert.rejects(buildWorkingReport(value), { code: 'SNAPSHOT_REJECTED' }, `mutation ${index}`);
  }
  await workspace(async directory => {
    const value = nativeManifest({ entries: [nativeEntry()] }); value.entries[0].planSnapshot.sourceGenome.id = id(999);
    const input = join(directory, 'input.json'), output = join(directory, 'report.json');
    await writeFile(input, JSON.stringify(value)); failure(command(input, output), 'SNAPSHOT_REJECTED'); await absent(output);
  });
});

test('v2 preserves exact OFF checks even inside numeric tolerance and covers unselected, suppressed and unpaired rows', async () => {
  const mutations = [
    pool => { pool[0].score += 5e-13; },
    pool => { pool[4].score += 5e-13; },
    pool => { pool[5].score += 5e-13; },
    pool => { pool.pop(); },
    pool => { pool.push({ ...pool[5], itemId: id(999), rank: 7 }); },
    pool => { pool[5].itemId = id(999); },
    pool => { pool[4].rank = 6; pool[5].rank = 5; },
    pool => { pool[5].eligible = true; },
    pool => { pool[5].tier = 0; },
    pool => { pool[4].selected = true; },
  ];
  for (const mutate of mutations) {
    const value = nativeManifest({ entries: [nativeEntry()] });
    mutate(value.entries[0].planSnapshot.comparisons.find(comparison => comparison.control === 'OFF').result.candidates);
    await assert.rejects(buildWorkingReport(value), { code: 'SNAPSHOT_REJECTED' });
  }
  const remapped = nativeEntry(); remapped.planSnapshot.references.objects[5].objectRef = remapped.planSnapshot.references.objects[4].objectRef;
  await assert.rejects(buildWorkingReport(nativeManifest({ entries: [remapped] })), { code: 'ALIASES_INVALID' });
});

test('v2 binds repeated immutable genome identities across otherwise distinct sources', async () => {
  const first = nativeEntry(), second = nativeEntry(1);
  second.planSnapshot.sourceGenome = structuredClone(first.planSnapshot.sourceGenome);
  second.planSnapshot.sourceRun.genome_id = first.planSnapshot.sourceGenome.id;
  for (const candidate of second.planSnapshot.sourceCandidates) candidate.explanation.scalarGenome.genomeId = first.planSnapshot.sourceGenome.id;
  const value = nativeManifest({ entries: [first, second] });
  const report = await buildWorkingReport(value);
  assert.equal(report.nativeSourceAdmission.sources.length, 2); assert.equal(report.result.plannedPairUnits, 4);
  second.planSnapshot.sourceGenome.config.modeWeights.FOR_YOU.longTerm = 2;
  await assert.rejects(buildWorkingReport(value), { code: 'SNAPSHOT_REJECTED' });
});

test('missing, incomplete, future, tied and unknown captures retain every native planned pair', async () => {
  await workspace(async directory => {
    const variants = ['missing', 'incomplete', 'future', 'tie', 'unknown'];
    for (const variant of variants) {
      const item = entry();
      if (variant === 'missing') item.outcomeSnapshot = null;
      if (variant === 'incomplete') item.outcomeSnapshot.capture.complete = false;
      if (variant === 'future') item.outcomeSnapshot.capture.capturedAt = 650;
      if (variant === 'tie') item.outcomeSnapshot.capture.labels[1].rating = 0;
      if (variant === 'unknown') Object.assign(item.outcomeSnapshot.capture.labels[0], { status: 'unknown', rating: null });
      const report = await runManifest(directory, manifest({ entries: [item] }), variant);
      assert.equal(report.result.plannedPairUnits, 2); assert.equal(report.result.comparablePairUnits, 0);
      assert.equal(report.result.unscoredPairUnits, 2); assert.equal(report.observedEvidencePairUnits, 0);
      const expected = { missing: 'malformed-capture', incomplete: 'incomplete-capture', future: 'capture-unavailable',
        tie: 'all-tied', unknown: 'unknown-label' }[variant];
      assert.equal(report.result.reports[0].pairs[0].reasons.includes(expected), true);
    }
  });
});

test('actor and actor/session clusters cannot grow by relabeling one native identity', async () => {
  await workspace(async directory => {
    const same = await runManifest(directory, manifest({ entries: [entry(), entry(1)] }), 'same');
    assert.deepEqual(same.actorClusters, { actors: 1, actorSessions: 1, observedActors: 1, observedActorSessions: 1 });
    assert.deepEqual(same.result.clusters, { subjects: 1, subjectSessions: 1, observedSubjects: 1, observedSubjectSessions: 1 });
    const distinct = await runManifest(directory, manifest({ entries: [entry(), entry(1, false)] }), 'distinct');
    assert.equal(distinct.actorClusters.actors, 2); assert.equal(distinct.actorClusters.actorSessions, 2);
    assert.equal(distinct.result.clusters.subjects, 2);
    const observed = await runManifest(directory, manifest({ evidenceBasis: 'OWNER_AUTHORIZED_NATIVE_SNAPSHOTS',
      entries: [entry()] }), 'observed-descriptor');
    assert.equal(observed.observedEvidencePairUnits, 1); assert.equal(observed.qualityAdmitted, false);
    assert.equal(observed.sourceAuthenticity, 'NOT_ESTABLISHED_BY_FILE');
  });
});

test('explicit manifest scope, budgets and snapshots fail with fixed codes and no partial output', async () => {
  await workspace(async directory => {
    const input = join(directory, 'synthetic-private-secret.json'), output = join(directory, 'report.json');
    failure(command(), 'ARGUMENTS'); failure(command(input), 'ARGUMENTS'); failure(command(input, output), 'INPUT_FILE');
    await writeFile(input, '{"synthetic-private-secret":"postgresql://secret'); failure(command(input, output), 'MANIFEST_INVALID');
    for (const value of [null, [], manifest({ contractVersion: 'invalid' }), manifest({ selectionBasis: 'PROSPECTIVE' }),
      manifest({ evidenceBasis: 'OBSERVED_QUALITY' }), manifest({ scopeId: 'fixture:private\n' }),
      manifest({ scopeId: `fixture:${id(1)}` }), manifest({ evaluationAsOf: -1 }), manifest({ entries: {} }),
      manifest({ entries: Array.from({ length: 129 }, () => entry()) }), manifest({ entries: Array.from({ length: 65 }, () => entry()) }),
      { ...manifest(), unknown: 'synthetic-private-secret' }, manifest({ entries: [{ planSnapshot: null }] })]) {
      await writeFile(input, JSON.stringify(value)); failure(command(input, output), 'MANIFEST_INVALID'); await absent(output);
    }
    const scope = entry(); scope.expectedScope.actorUserId = id(900);
    await writeFile(input, JSON.stringify(manifest({ entries: [scope] }))); failure(command(input, output), 'SCOPE_MISMATCH');
    const source = entry(); source.planSnapshot.comparisons.pop();
    await writeFile(input, JSON.stringify(manifest({ entries: [source] }))); failure(command(input, output), 'SNAPSHOT_REJECTED');
    const lateRead = entry(); lateRead.planSnapshot.snapshotObservedAt = 601;
    await writeFile(input, JSON.stringify(manifest({ entries: [lateRead] }))); failure(command(input, output), 'SCOPE_MISMATCH');
    await absent(output);
  });
});

test('native source, enrollment, captures, unordered Profile/Item pairs and raw terminal/exposure Events cannot be reused behind aliases', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    const duplicate = entry(), relabeled = JSON.parse(JSON.stringify(duplicate).replaceAll('fixture:', 'fixture:changed-'));
    const cases = [[entry(), relabeled]];
    const pairReuse = entry(1);
    pairReuse.planSnapshot.enrollment.pairs[0].leftItemId = id(21);
    pairReuse.planSnapshot.enrollment.pairs[0].rightItemId = id(20);
    pairReuse.outcomeSnapshot = null;
    cases.push([entry(), pairReuse]);
    for (const key of ['eventId', 'exposureId']) {
      const reused = entry(1); reused.outcomeSnapshot.capture.labels[0][key] = entry().outcomeSnapshot.capture.labels[0][key];
      cases.push([entry(), reused]);
    }
    const captures = entry(1); captures.outcomeSnapshot.capture.captureId = entry().outcomeSnapshot.capture.captureId;
    cases.push([entry(), captures]);
    const enrollment = entry(1); enrollment.planSnapshot.enrollment.enrollmentId = entry().expectedScope.enrollmentId;
    enrollment.expectedScope.enrollmentId = enrollment.planSnapshot.enrollment.enrollmentId;
    cases.push([entry(), enrollment]);
    for (const correction of [false, true]) {
      const ownInput = entry();
      ownInput.planSnapshot.sourceRun.state_snapshot.workingState.rawEvents = [{
        id: correction ? id(900) : id(100), event_type: correction ? 'ITEM_INTERACTION_UNDONE' : 'ITEM_RATED',
        actor_user_id: id(1), profile_id: id(2), session_id: id(3), item_id: id(20), item_type: 'BOOK',
        occurred_at: 50, created_at: 50, properties: correction ? { reversedEventId: id(100) } : { rating: 9 },
      }];
      cases.push([ownInput]);
    }
    for (const entries of cases) {
      await writeFile(input, JSON.stringify(manifest({ entries }))); failure(command(input, output), 'SOURCE_REUSE'); await absent(output);
    }
  });
});

test('canonical native actor/Profile/session/Item/Event alias mappings and reverse collisions are checked across entries', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    for (const key of ['actorRef', 'subjectRef', 'sessionRef']) {
      const changed = entry(1); changed.planSnapshot.references[key] = `fixture:changed-${key}`;
      await writeFile(input, JSON.stringify(manifest({ entries: [entry(), changed] })));
      failure(command(input, output), 'ALIASES_INVALID');
    }
    const item = entry(1); item.planSnapshot.references.objects[0].itemId = entry().planSnapshot.references.objects[0].itemId;
    const event = entry(1); event.planSnapshot.references.inputRecords = [{ recordId: id(100), recordRef: 'fixture:changed-record' }];
    const collision = entry(1, false); collision.planSnapshot.references.actorRef = entry().planSnapshot.references.actorRef;
    for (const changed of [item, event, collision]) {
      await writeFile(input, JSON.stringify(manifest({ entries: [entry(), changed] })));
      failure(command(input, output), 'ALIASES_INVALID'); await absent(output);
    }
    const stableInput = entry(1); stableInput.planSnapshot.sourceRun.state_snapshot.workingState.rawEvents = [{
      id: id(100), actor_user_id: id(1), profile_id: id(2), session_id: id(3), item_id: id(20), item_type: 'BOOK',
      event_type: 'ITEM_RATED', occurred_at: 50, created_at: 50, properties: { rating: 9 },
    }];
    await writeFile(input, JSON.stringify(manifest({ entries: [entry(), stableInput] })));
    failure(command(input, output), 'SOURCE_REUSE'); await absent(output);
    const embedded = entry(); embedded.planSnapshot.references.actorRef = `fixture:actor-${id(999).toUpperCase()}`;
    await writeFile(input, JSON.stringify(manifest({ entries: [embedded] }))); failure(command(input, output), 'ALIASES_INVALID');
    const version = entry(); version.planSnapshot.sourceRun.base_model_version = id(999);
    await writeFile(input, JSON.stringify(manifest({ entries: [version] }))); failure(command(input, output), 'SNAPSHOT_REJECTED');
  });
});

test('16 MiB input bound accepts its exact regular-file boundary and rejects symlinks, directories and nonblocking FIFOs', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    await writeFile(input, ' '.repeat(16 * 1024 * 1024 + 1)); failure(command(input, output), 'INPUT_TOO_LARGE'); await absent(output);
    const payload = JSON.stringify(manifest());
    await writeFile(input, payload + ' '.repeat(16 * 1024 * 1024 - Buffer.byteLength(payload)));
    assert.equal(command(input, output).status, 0); await rm(output);
    const link = join(directory, 'input-link.json'); await symlink(input, link); failure(command(link, output), 'INPUT_FILE');
    failure(command(directory, output), 'INPUT_FILE');
    const fifo = join(directory, 'input-fifo'); execFileSync('mkfifo', [fifo]); failure(command(fifo, output), 'INPUT_FILE');
    await absent(output);
  });
});

test('exclusive private output preserves existing files/symlinks and rejects repository/worktree/bare aliases', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    await writeFile(input, JSON.stringify(manifest())); await writeFile(output, 'synthetic-private-secret');
    failure(command(input, output), 'OUTPUT_EXISTS'); assert.equal(await readFile(output, 'utf8'), 'synthetic-private-secret');
    const linked = join(directory, 'report-link.json'); await symlink(output, linked); failure(command(input, linked), 'OUTPUT_EXISTS');
    assert.equal(await readFile(output, 'utf8'), 'synthetic-private-secret');
    failure(command(input, join(directory, 'missing', 'report.json')), 'OUTPUT_LOCATION');
    const repositoryOutput = join(root, 'synthetic-private-working-report.json');
    failure(command(input, repositoryOutput), 'OUTPUT_LOCATION'); await absent(repositoryOutput);
    const repositoryAlias = join(directory, 'repo'); await symlink(root, repositoryAlias);
    failure(command(input, join(repositoryAlias, 'synthetic-private-working-report.json')), 'OUTPUT_LOCATION');
    const bare = join(directory, 'bare'); execFileSync('git', ['init', '--bare', '--initial-branch=main', bare], { stdio: 'pipe' });
    const bareAlias = join(directory, 'bare-alias'); await symlink(bare, bareAlias);
    failure(command(input, join(bareAlias, 'report.json')), 'OUTPUT_LOCATION');
    await writeFile(join(directory, '.git'), 'gitdir: synthetic-private-secret');
    failure(command(input, join(directory, 'new-report.json')), 'OUTPUT_LOCATION');
  });
});

test('exact pretty-JSON output bytes, including UTF-8 and final newline, are bounded before any file reservation', async () => {
  await workspace(async directory => {
    const output = join(directory, 'report.json');
    const value = { nested: { names: ['ä', 'ö', '字'] } };
    const serialized = `${JSON.stringify(value, null, 2)}\n`, bytes = Buffer.byteLength(serialized);
    assert.ok(Buffer.byteLength(JSON.stringify(value)) < bytes);
    const boundary = limit => createPrivateReportFiles({
      reject: code => { throw new WorkingReportError(code); }, isReportError: error => error instanceof WorkingReportError,
      maximumInputBytes: 16 * 1024 * 1024, maximumOutputBytes: limit,
    });
    await assert.rejects(boundary(bytes - 1).writeReport(output, value), { message: 'WORKING_REPORT_OUTPUT_TOO_LARGE' });
    await absent(output);
    await boundary(bytes).writeReport(output, value);
    assert.equal(await readFile(output, 'utf8'), serialized); assert.equal((await stat(output)).size, bytes);
  });
});

test('failed writes clean only identified new inodes, including fstat failure and pathname replacement', async () => {
  await workspace(async directory => {
    const input = join(directory, 'manifest.json'), output = join(directory, 'report.json');
    await writeFile(input, JSON.stringify(manifest()));
    const probe = await open(join(directory, 'probe'), 'wx'), prototype = Object.getPrototypeOf(probe);
    const originalWrite = prototype.writeFile, originalStat = prototype.stat;
    await probe.close();
    prototype.writeFile = async function () { await this.write('partial-private-report'); throw new Error('synthetic-private-secret'); };
    try { await assert.rejects(runWorkingReport(input, output), { message: 'WORKING_REPORT_OUTPUT_WRITE' }); }
    finally { prototype.writeFile = originalWrite; }
    await absent(output);
    for (const persistent of [false, true]) {
      let calls = 0;
      prototype.stat = async function (...args) {
        calls++;
        if (calls === 2 || persistent && calls > 2) throw new Error('synthetic-private-secret');
        return originalStat.apply(this, args);
      };
      try { await assert.rejects(runWorkingReport(input, output),
        { message: `WORKING_REPORT_${persistent ? 'OUTPUT_CLEANUP' : 'OUTPUT_WRITE'}` }); }
      finally { prototype.stat = originalStat; }
      if (persistent) { assert.equal((await stat(output)).size, 0); await rm(output); } else await absent(output);
    }
    prototype.writeFile = async function () {
      await this.write('partial-private-report'); await rm(output); await writeFile(output, 'replacement-private-report');
      throw new Error('synthetic-private-secret');
    };
    try { await assert.rejects(runWorkingReport(input, output), { message: 'WORKING_REPORT_OUTPUT_CLEANUP' }); }
    finally { prototype.writeFile = originalWrite; }
    assert.equal(await readFile(output, 'utf8'), 'replacement-private-report');
    assert.equal(JSON.parse(await readFile(input, 'utf8')).entries.length, 0);
  });
});
