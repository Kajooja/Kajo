import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createPersonalRatingEvaluationDeclaration, buildPersonalRatingEvaluationReport,
  runPersonalRatingEvaluationReport, PersonalRatingEvaluationFileError }
  from '../../packages/prediction-engine/scripts/personal-rating-evaluation.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../../packages/prediction-engine/scripts/personal-rating-evaluation.mjs', import.meta.url));
const BASE = 9007199254740993n; // Native clocks must not round through Number/Date.
const DAY = 86400n * 1000000n;
const id = number => `a4022000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const clock = (offset, base = BASE) => (base + BigInt(offset)).toString();
const command = (...args) => spawnSync(process.execPath, [cli, ...args], {
  cwd: root, encoding: 'utf8', timeout: 10_000, maxBuffer: 128 * 1024,
});
function request(base = BASE) {
  return { version: 'kajo-personal-rating-evaluation-request-v1', declaration: {
    version: 'personal-rating-evaluation-declaration-v1', cohortId: 'fixture:cohort', origin: 'synthetic',
    roster: ['fixture:subject-b', 'fixture:subject-a'], domains: ['MOVIE', 'BOOK'],
    target: 'FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN', scale: { min: 0, max: 10 },
    sourceVersions: { source: `personal-source-evidence-v1:${'a'.repeat(32)}`,
      model: 'personal-domain-mean-v1', control: 'personal-domain-mean-v1:PERSONAL_MEAN' },
    targetSelection: 'FIRST_DELIVERED_ITEM', captureWindow: { startMicros: clock(10000000, base), endMicros: clock(60000000, base) },
    horizonSeconds: 1, cohortCap: 256, windows: {
      DEVELOPMENT: { startMicros: clock(10000000, base), endMicros: clock(20000000, base) },
      SELECTION: { startMicros: clock(30000000, base), endMicros: clock(40000000, base) },
      FINAL: { startMicros: clock(50000000, base), endMicros: clock(60000000, base) },
    }, dataRole: 'DEVELOPMENT', checkpointsMicros: [clock(15000000, base), clock(21000000, base)], requirements: null,
  }, roster: [
    { actorUserId: id(3), profileId: id(4), subjectId: 'fixture:subject-b' },
    { actorUserId: id(1), profileId: id(2), subjectId: 'fixture:subject-a' },
  ] };
}
function sealed(base = BASE) { return createPersonalRatingEvaluationDeclaration(request(base), base.toString()); }
function inventory(declaration, opportunities = [], observedAtMicros = clock(22000000)) {
  return { version: 'kajo-personal-rating-evaluation-inventory-v1', declarationDigest: declaration.digest, opportunities,
    census: { version: 'kajo-personal-rating-census-v1', observedAtMicros,
      owners: declaration.roster.map(member => ({ version: 'kajo-personal-rating-owner-census-v1',
        actorUserId: member.actorUserId, profileId: member.profileId, observedAtMicros, allocations: [] })) } };
}
function opportunity(captureStatus = 'CAPTURE_UNAVAILABLE') {
  return { opportunityId: 'fixture:opportunity-a', actorUserId: id(1), profileId: id(2),
    sourcePredictionId: id(10), forecastId: id(11), targetItemId: id(12), objectId: 'fixture:object-a',
    domainId: 'BOOK', attemptedAtMicros: clock(11000000), captureStatus };
}
function report(declaration, input, checkpoint = clock(21000000), now = clock(22000000)) {
  return buildPersonalRatingEvaluationReport(declaration, input, checkpoint, now);
}
function throws(work, code) {
  assert.throws(work, error => error instanceof PersonalRatingEvaluationFileError
    && error.message === `PERSONAL_RATING_EVALUATION_${code}`);
}
async function workspace(work) {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-rating-evaluation-'));
  try { return await work(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
async function absent(path) { await assert.rejects(stat(path), { code: 'ENOENT' }); }
function failure(result, code) {
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.equal(result.stderr, `PERSONAL_RATING_EVALUATION_${code}\n`);
  assert.doesNotMatch(result.stderr, /synthetic-private-secret|a4022000|actorUserId|Error:|node:/u);
}

test('declaration canonically binds sorted roster, exact microseconds and an independent cohort cap', () => {
  const source = request(), original = structuredClone(source), declaration = createPersonalRatingEvaluationDeclaration(source, BASE.toString());
  assert.deepEqual(source, original);
  assert.deepEqual(declaration.declaration.roster, ['fixture:subject-a', 'fixture:subject-b']);
  assert.equal(declaration.declaration.createdAtMicros, BASE.toString());
  assert.equal(declaration.declaration.cohortCap, 256); // Independent of the per-owner retained allocation quota of 128.
  assert.equal(declaration.retainUntilMicros, (BASE + 21000000n + 7n * DAY).toString());
  assert.match(declaration.digest, /^[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(declaration.declaration.windows.DEVELOPMENT), true);
  assert.equal(Object.isFrozen(declaration.roster[0]), true);
  const reversed = request(); reversed.roster.reverse(); reversed.declaration.roster.reverse(); reversed.declaration.domains.reverse();
  assert.deepEqual(createPersonalRatingEvaluationDeclaration(reversed, BASE.toString()), declaration);
  assert.equal(declaration.predeclarationAuthenticity, 'NOT_ESTABLISHED_BY_FILE');
  assert.equal(declaration.nativeInventoryCompleteness, 'NOT_ESTABLISHED_BY_FILE');
  assert.equal(declaration.integrityBasis, 'CANONICAL_SHA256_NOT_AUTHENTICATION');
});

test('declaration rejects ambiguous identity maps, raw identifiers in aliases and a caller-supplied clock', () => {
  for (const change of [
    value => { value.roster[1].actorUserId = value.roster[0].actorUserId; },
    value => { value.roster[1].profileId = value.roster[0].profileId; },
    value => { value.roster[1].subjectId = value.roster[0].subjectId; },
    value => { value.roster[1].subjectId = 'fixture:foreign'; },
  ]) {
    const changed = request(); change(changed);
    throws(() => createPersonalRatingEvaluationDeclaration(changed, BASE.toString()), 'ROSTER_INVALID');
  }
  const rawAlias = request(); rawAlias.declaration.cohortId = `fixture:${id(90)}`;
  throws(() => createPersonalRatingEvaluationDeclaration(rawAlias, BASE.toString()), 'ALIASES_REQUIRED');
  const clockOverride = request(); clockOverride.declaration.createdAtMicros = '1';
  throws(() => createPersonalRatingEvaluationDeclaration(clockOverride, BASE.toString()), 'PROTOCOL_INVALID');
  throws(() => createPersonalRatingEvaluationDeclaration({ ...request(), hidden: true }, BASE.toString()), 'PROTOCOL_INVALID');
  throws(() => createPersonalRatingEvaluationDeclaration(request(), clock(10000000)), 'DECLARATION_INVALID');
});

test('empty native census remains a descriptive zero-opportunity report for every declared Profile', () => {
  const declaration = sealed(), input = inventory(declaration), original = structuredClone(input);
  const value = report(declaration, input);
  assert.deepEqual(input, original);
  assert.equal(value.declarationDigest, declaration.digest);
  assert.equal(value.result.status, 'DESCRIPTIVE_ONLY');
  assert.equal(value.result.counts.declaredProfiles, 2);
  assert.equal(value.result.counts.participatingProfiles, 0);
  assert.equal(value.result.counts.opportunities, 0);
  assert.equal(value.result.byProfile.length, 2);
  assert.equal(value.result.macro.candidate.mse, null);
  assert.equal(value.result.macro.paired.deltaMse, null);
  assert.equal(value.result.coverage.outcome, null);
  assert.equal(value.inventoryReconciliation.status, 'COMPLETE_DECLARED_RECONCILIATION');
  assert.equal(value.result.qualityAdmission, 'NONE');
  for (const key of ['historicalFeatureEligible', 'learnable', 'nativeActivated', 'qualityAdmitted']) assert.equal(value[key], false);
  for (const key of ['predeclarationAuthenticity', 'nativeInventoryCompleteness', 'currentAuthorization', 'withdrawalStatus']) {
    assert.equal(value[key], 'NOT_ESTABLISHED_BY_FILE');
  }
  assert.equal(Object.isFrozen(value.result.byProfile[0]), true);
  assert.doesNotMatch(JSON.stringify(value), /a4022000|actorUserId|profileId|sourcePredictionId|targetItemId/u);
});

test('declared failed or unattempted opportunities stay in coverage; a missing expected capture stays unresolved', () => {
  const declaration = sealed();
  for (const status of ['CAPTURE_UNAVAILABLE', 'NOT_ATTEMPTED']) {
    const value = report(declaration, inventory(declaration, [opportunity(status)]));
    assert.equal(value.result.status, 'DESCRIPTIVE_ONLY');
    assert.equal(value.result.counts.opportunities, 1);
    assert.equal(value.result.counts.captureStatuses[status], 1);
    assert.equal(value.result.coverage.outcome, 0);
    assert.equal(value.result.counts.firstAnswers, 0);
    assert.equal(value.result.macro.candidate.mse, null);
    assert.equal(value.result.byProfile[1].opportunities, 0);
  }
  const missing = report(declaration, inventory(declaration, [opportunity('CAPTURED')]));
  assert.equal(missing.result.status, 'INCOMPLETE_INVENTORY');
  assert.equal(missing.result.counts.captureStatuses.MISSING_EXPECTED_CAPTURE, 1);
  assert.equal(missing.inventoryReconciliation.missingExpectedCaptures, 1);
  assert.equal(missing.result.macro.candidate.mse, null);
  const omittedOwner = inventory(declaration); omittedOwner.census.owners.pop();
  const unresolved = report(declaration, omittedOwner);
  assert.equal(unresolved.result.status, 'INCOMPLETE_INVENTORY');
  assert.equal(unresolved.inventoryReconciliation.missingOwnerCensuses, 1);
});

test('sealed declarations and inventory digest bindings reject edits rather than accepting a favorable substitute', () => {
  const declaration = sealed();
  for (const change of [
    value => { value.declaration.cohortCap++; },
    value => { value.roster[0].profileId = id(99); },
    value => { value.retainUntilMicros = clock(90000000); },
    value => { value.digest = '0'.repeat(64); },
  ]) {
    const changed = structuredClone(declaration); change(changed);
    throws(() => report(changed, inventory(declaration)), 'DECLARATION_INVALID');
  }
  const wrong = inventory(declaration); wrong.declarationDigest = '0'.repeat(64);
  throws(() => report(declaration, wrong), 'DECLARATION_MISMATCH');
  const generation = inventory(declaration); generation.version = 'kajo-personal-rating-evaluation-inventory-v2';
  throws(() => report(declaration, generation), 'DECLARATION_MISMATCH');
  throws(() => report(declaration, { ...inventory(declaration), selectedOnly: true }), 'INVENTORY_INVALID');
});

test('fixed checkpoints, future snapshots and seven-day report retention use exact native microseconds', () => {
  const declaration = sealed(), input = inventory(declaration);
  throws(() => report(declaration, input, clock(21000000), clock(20999999)), 'EVALUATION_NOT_READY');
  throws(() => report(declaration, input, clock(21000001)), 'INVENTORY_INVALID');
  const future = inventory(declaration, [], clock(22000001));
  throws(() => report(declaration, future), 'FUTURE_SNAPSHOT');
  const beforeCut = inventory(declaration, [], clock(20999999));
  throws(() => report(declaration, beforeCut), 'INVENTORY_INVALID');
  assert.equal(report(declaration, input, clock(21000000), declaration.retainUntilMicros).result.status, 'DESCRIPTIVE_ONLY');
  throws(() => report(declaration, input, clock(21000000), (BigInt(declaration.retainUntilMicros) + 1n).toString()), 'EXPIRED');
});

test('an empty census cannot bypass pinned native source/model/control generations', () => {
  for (const field of ['source', 'model', 'control']) {
    const changed = request(); changed.declaration.sourceVersions[field] = 'unsupported-v9';
    const declaration = createPersonalRatingEvaluationDeclaration(changed, BASE.toString());
    throws(() => report(declaration, inventory(declaration)), 'INVENTORY_INVALID');
  }
});

test('owner CLI produces a private declaration, preserves existing files and rejects Git and symlink paths', async () => {
  await workspace(async directory => {
    const input = join(directory, 'synthetic-private-secret.json'), output = join(directory, 'declaration.json');
    failure(command(), 'ARGUMENTS'); failure(command('report', input, output), 'ARGUMENTS');
    failure(command('declare', input, output), 'INPUT_FILE');
    await writeFile(input, '{synthetic-private-secret'); failure(command('declare', input, output), 'MANIFEST_INVALID');
    const now = BigInt(Date.now()) * 1000n, protocol = request(now);
    await writeFile(input, JSON.stringify(protocol));
    const created = command('declare', input, output);
    assert.equal(created.status, 0, created.stderr); assert.equal(created.stdout, 'PERSONAL_RATING_EVALUATION_DECLARED\n');
    assert.equal(created.stderr, '');
    const bytes = await readFile(output, 'utf8'), declaration = JSON.parse(bytes);
    assert.ok(BigInt(declaration.declaration.createdAtMicros) >= now);
    assert.ok(BigInt(declaration.declaration.createdAtMicros) < BigInt(protocol.declaration.windows.DEVELOPMENT.startMicros));
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    failure(command('declare', input, output), 'OUTPUT_EXISTS'); assert.equal(await readFile(output, 'utf8'), bytes);
    const linkedInput = join(directory, 'linked-input.json'); await symlink(input, linkedInput);
    failure(command('declare', linkedInput, join(directory, 'new.json')), 'INPUT_FILE');
    const linkedOutput = join(directory, 'linked-output.json'); await symlink(output, linkedOutput);
    failure(command('declare', input, linkedOutput), 'OUTPUT_EXISTS'); assert.equal(await readFile(output, 'utf8'), bytes);
    failure(command('declare', directory, join(directory, 'directory-input.json')), 'INPUT_FILE');
    const inGit = join(root, 'synthetic-private-secret-rating-evaluation.json');
    failure(command('declare', input, inGit), 'OUTPUT_LOCATION'); await absent(inGit);
    await writeFile(input, ' '.repeat(16 * 1024 * 1024 + 1));
    failure(command('declare', input, join(directory, 'oversized.json')), 'INPUT_TOO_LARGE');
  });
});

test('actual report CLI preserves cohort binding and redacts native identities without certifying a supplied file', async () => {
  await workspace(async directory => {
    const base = BigInt(Date.now()) * 1000n - 120000000n, declaration = sealed(base);
    const census = inventory(declaration, [], clock(22000000, base));
    const declarationPath = join(directory, 'declaration.json'), inventoryPath = join(directory, 'synthetic-private-secret.json');
    const output = join(directory, 'report.json'), checkpoint = clock(21000000, base);
    await writeFile(declarationPath, JSON.stringify(declaration)); await writeFile(inventoryPath, JSON.stringify(census));
    const result = command('report', declarationPath, inventoryPath, checkpoint, output);
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, 'PERSONAL_RATING_EVALUATION_REPORT_CREATED\n');
    assert.equal(result.stderr, ''); assert.equal((await stat(output)).mode & 0o777, 0o600);
    const bytes = await readFile(output, 'utf8'), saved = JSON.parse(bytes);
    assert.equal(saved.declarationDigest, declaration.digest);
    assert.equal(saved.result.checkpointMicros, checkpoint);
    assert.equal(saved.result.counts.declaredProfiles, 2);
    assert.equal(saved.result.macro.candidate.mse, null);
    assert.equal(saved.predeclarationAuthenticity, 'NOT_ESTABLISHED_BY_FILE');
    assert.doesNotMatch(bytes, /a4022000|actorUserId|profileId|synthetic-private-secret/u);
    failure(command('report', declarationPath, inventoryPath, checkpoint, output), 'OUTPUT_EXISTS');
    assert.equal(await readFile(output, 'utf8'), bytes);
    census.declarationDigest = '0'.repeat(64); await writeFile(inventoryPath, JSON.stringify(census));
    const refused = join(directory, 'refused.json');
    failure(command('report', declarationPath, inventoryPath, checkpoint, refused), 'DECLARATION_MISMATCH'); await absent(refused);
  });
});

test('expired and malformed owner reports reserve no output file and expose only bounded errors', async () => {
  await workspace(async directory => {
    const base = BigInt(Date.now()) * 1000n - 8n * DAY, declaration = sealed(base);
    const declarationPath = join(directory, 'declaration.json'), inventoryPath = join(directory, 'inventory.json');
    const output = join(directory, 'expired.json'), checkpoint = clock(21000000, base);
    await writeFile(declarationPath, JSON.stringify(declaration));
    await writeFile(inventoryPath, JSON.stringify(inventory(declaration, [], clock(22000000, base))));
    failure(command('report', declarationPath, inventoryPath, checkpoint, output), 'EXPIRED'); await absent(output);
    await assert.rejects(runPersonalRatingEvaluationReport('', inventoryPath, checkpoint, output),
      { message: 'PERSONAL_RATING_EVALUATION_ARGUMENTS' });
    await absent(output);
  });
});
