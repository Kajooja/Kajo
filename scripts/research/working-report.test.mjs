import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, open, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertWorkingReportPlatform, runWorkingReport, WorkingReportError } from '../../packages/prediction-engine/scripts/working-report.mjs';
import { createPrivateReportFiles } from '../../packages/prediction-engine/scripts/private-report-files.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../../packages/prediction-engine/scripts/working-report.mjs', import.meta.url));
const controls = ['OFF', 'STATIC', 'ORDERED'];
const id = number => `a9150000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const manifest = overrides => ({ contractVersion: 'kajo-personal-working-manifest-v1',
  selectionBasis: 'OWNER_DECLARED_NATIVE_ENROLLMENTS', evidenceBasis: 'ENGINEERING_FIXTURE',
  scopeId: 'fixture', evaluationAsOf: 600, entries: [], ...overrides });
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

// Generated native shapes exercise bounded report consumption only. The actual
// SQL producer/active-feature bridge is tested in working-outcomes-kajo.test.mjs.
function entry(index = 0, sameScope = true) {
  const offset = index * 1000, native = number => id(number + offset);
  const scopeIndex = sameScope ? 0 : index, scopeOffset = scopeIndex * 1000;
  const actor = id(1 + scopeOffset), profile = id(2 + scopeOffset), session = id(3 + scopeOffset);
  const scoped = name => `fixture:${name}`;
  const flags = { learnable: false, historicalFeatureEligible: false, nativeActivated: false };
  const policy = 'personal-persona-v1+personal-working-off-v3';
  const artifact = { id: 'native-working-tags', version: '1', representationVersion: 'native-binary-tags-v1',
    availableAt: 100, trainedThrough: null, sourceRefs: ['kajo-canonical-events-v1'], use: 'research-only' };
  const capture = { captureId: native(5), version: 'native-working-capture-v3', kind: 'working-state',
    stateVersion: 'working-state-v1', actorUserId: actor, profile: { id: profile, type: 'PERSONAL', ownerUserId: actor },
    session: { id: session, actor_user_id: actor, profile_id: profile }, cutoff: 100, asOf: 100,
    ...flags, commitAvailability: 'UNKNOWN', availabilityBasis: 'STORED_CREATED_TIME',
    featureAvailabilityBasis: 'CURRENT_MVCC_SNAPSHOT_KNOWN_AT_CAPTURE', prefixComplete: true, status: 'INACTIVE',
    rawEvents: [], records: [], items: [], itemFeatures: [], featureSchema: { id: 'native-working-tags',
      version: '1', dimensions: [], artifact }, resetAt: null, resetControls: [], resetSourceRefs: [] };
  const candidates = [20, 21, 22, 23].map((number, rank) => ({ prediction_id: native(4), item_id: native(number),
    source_score: 0.8 - rank * 0.1, final_score: 0.8 - rank * 0.1, source_rank: rank + 1, final_rank: rank + 1,
    selected_for_delivery: true, created_at: 90, explanation: { policyVersion: policy,
      resurfacingPolicy: { eligible: true, classification: 'UNSEEN' },
      workingIntent: { version: 'personal-working-features-v3', captureId: native(5), stateVersion: 'working-state-v1',
        policyVersion: 'working-policy-v1', control: 'OFF', staticAdjustment: 0, orderedAdjustment: 0,
        ...flags, captureVersion: capture.version, resetAt: null, resetSourceRefs: [],
        candidateFeatures: { version: 'native-working-candidate-features-v1', status: 'UNAVAILABLE', captureId: native(5),
          asOf: 100, featureSchemaRef: { id: artifact.id, version: '1', artifactId: artifact.id, artifactVersion: '1',
            representationVersion: artifact.representationVersion, dimensionCount: 0 },
          featureEncoding: 'CAPTURE_DIMENSION_ORDER_BINARY_V1', availabilityBasis: 'SOURCE_RANKING_STATEMENT_SNAPSHOT',
          availableAt: null, commitAvailability: 'UNKNOWN', ...flags, features: null, unavailableReason: 'CAPTURE_INACTIVE' } } } }));
  const comparisons = controls.map(control => ({ source_prediction_id: native(4), control, created_at: 195,
    result: { version: 'personal-working-shadow-v3', sourcePredictionId: native(4), captureId: native(5), control,
      sourceModelVersion: 'native-model-v1', sourcePolicyVersion: policy, policyVersion: 'working-policy-v1',
      servingControl: 'OFF', comparisonScope: 'FROZEN_CANDIDATE_POOL_AND_FINAL_DELIVERY_POLICY',
      commitAvailability: 'UNKNOWN', observedEvaluationCount: 0, calibration: 'uncalibrated', uncertainty: 'unavailable',
      asOf: 100, candidateCount: 4, ...flags, captureVersion: capture.version, resetAt: null, resetSourceRefs: [],
      candidates: candidates.map(candidate => ({ itemId: candidate.item_id, eligible: true, tier: 0, selected: true,
        adjustment: 0, score: candidate.final_score, rank: candidate.final_rank })) } }));
  const nativeScope = { actorUserId: actor, profileId: profile, sessionId: session, sourcePredictionId: native(4) };
  const enrollment = { version: 'personal-working-enrollment-v1', enrollmentId: native(70), ...nativeScope,
    declaredAt: 210, horizon: { startAt: 210, endAt: 310 }, matureAt: 330,
    pairs: [0, 1].map(pairIndex => ({ pairId: native(71 + pairIndex),
      leftItemId: native(20 + pairIndex * 2), rightItemId: native(21 + pairIndex * 2) })),
    controls: controls.map((control, controlIndex) => ({ control, comparisonId: native(80 + controlIndex), createdAt: 195 })),
    commitAvailability: 'UNKNOWN', ...flags };
  const objectAliases = candidates.map(candidate => ({ itemId: candidate.item_id,
    objectRef: scoped(`object-${Number(candidate.item_id.slice(-12))}`) }));
  const planSnapshot = { actorUserId: actor, profile: { id: profile, type: 'PERSONAL', ownerUserId: actor },
    sourceRun: { id: native(4), actor_user_id: actor, profile_id: profile, session_id: session, genome_id: native(6),
      requested_at: 120, created_at: 180, discovery_mode: 'FOR_YOU', requested_item_type: 'BOOK',
      model_version: 'native-model-v1', base_model_version: 'native-base-v1', policy_version: policy,
      candidate_count: 4, result_count: 4, state_snapshot: { workingState: capture } },
    sourceCandidates: candidates, comparisons, enrollment, snapshotObservedAt: 400,
    planning: { id: scoped(`enrollment-${index}`), createdAt: 210, horizon: enrollment.horizon,
      pairs: enrollment.pairs.map((pair, pairIndex) => ({ pairId: scoped(`pair-${index}-${pairIndex}`),
        leftItemId: pair.leftItemId, rightItemId: pair.rightItemId })) },
    references: { scopeId: 'fixture', subjectRef: scoped(`subject-${scopeIndex}`), actorRef: scoped(`actor-${scopeIndex}`),
      sessionRef: scoped(`session-${scopeIndex}`), sourcePredictionRef: scoped(`source-${index}`),
      captureRef: scoped(`working-capture-${index}`), controlRefs: Object.fromEntries(controls.map(control =>
        [control, scoped(`${control.toLowerCase()}-${index}`)])), objects: objectAliases } };
  const labels = candidates.map((candidate, labelIndex) => ({ itemId: candidate.item_id,
    status: labelIndex < 2 ? 'observed' : 'missing', reason: labelIndex < 2 ? null : 'NO_TERMINAL',
    exposureId: labelIndex < 2 ? native(110 + labelIndex) : null, exposedAt: labelIndex < 2 ? 230 : null,
    eventId: labelIndex < 2 ? native(100 + labelIndex) : null, occurredAt: labelIndex < 2 ? 250 : null,
    eventSessionId: labelIndex < 2 ? session : null, originPredictionId: labelIndex < 2 ? native(4) : null,
    rating: labelIndex < 2 ? labelIndex * 10 : null }));
  const outcomeSnapshot = { capture: { version: 'personal-working-outcomes-v1', captureId: native(90),
    enrollmentId: native(70), ...nativeScope, revision: 1, capturedAt: 350, matureAt: 330, complete: true,
    resolutionVersion: 'personal-latest-terminal-v1', labels, commitAvailability: 'UNKNOWN', ...flags },
  references: { scopeId: 'fixture', enrollmentRef: planSnapshot.planning.id, captureRef: scoped(`outcome-${index}`),
    controls: Object.fromEntries(controls.map((control, controlIndex) => [control, { comparisonId: native(80 + controlIndex),
      controlRef: planSnapshot.references.controlRefs[control] }])),
    pairs: enrollment.pairs.map((pair, pairIndex) => ({ pairId: pair.pairId, pairRef: scoped(`pair-${index}-${pairIndex}`) })),
    objects: objectAliases, events: labels.filter(label => label.eventId !== null).map(label => ({ eventId: label.eventId,
      recordRef: scoped(`record-${Number(label.eventId.slice(-12))}`) })),
    exposures: labels.filter(label => label.exposureId !== null).map(label => ({ exposureId: label.exposureId,
      experienceRef: scoped(`experience-${Number(label.exposureId.slice(-12))}`) })) } };
  return { expectedScope: { ...nativeScope, enrollmentId: native(70) }, planSnapshot, outcomeSnapshot };
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
