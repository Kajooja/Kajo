import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { constants, createCipheriv, generateKeyPairSync, publicEncrypt, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createDumpFailureEvidence } from './dump-failure-evidence.mjs';
import { WORK_PREFIX_DIAGNOSTIC_CONTRACT, WORK_PREFIX_LIMITS, WORK_PREFIX_RANGE, WORK_PREFIX_SOURCE_PIN,
  inspectWorkDumpPrefix } from './inspect-work-dump-prefix.mjs';
import { canonicalJson, digest, sha256 } from './open-library-descriptions.mjs';
import { prepareWorkPrefixRequest } from './prepare-work-prefix-diagnostic.mjs';
import { WORK_PREFIX_ARTIFACT_FILE, WORK_PREFIX_WORKFLOW_FILE, guardedWorkPrefixDiagnostic,
  validateWorkPrefixCommit, validateWorkPrefixRunBudget } from './run-work-prefix-diagnostic.mjs';
import { REVIEWED_REQUEST_PATH, recipientFingerprint, validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';
import { WORK_PREFIX_BRANCH, WORK_PREFIX_PREVIOUS_ACQUISITION, WORK_PREFIX_REQUEST_CONTRACT,
  WORK_PREFIX_REQUEST_PATH, WORK_PREFIX_REQUEST_PURPOSE, sealWorkPrefixDiagnostic,
  unsealWorkPrefixDiagnostic, validateWorkPrefixRequest, validateWorkPrefixResult } from './seal-work-prefix-diagnostic.mjs';

// Public fixture is the exact JSON value from the fixed consumed request Git
// object. It contains no private key, catalog snapshot or provider response.
const previousRequest = JSON.parse(await readFile(new URL('./fixtures/work-prefix-previous-request.json', import.meta.url), 'utf8'));
const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const sourceHead = 'a'.repeat(40), requestHead = 'b'.repeat(40), at = '2026-09-24T13:11:33.173Z';
function requestFor(previous = previousRequest) {
  const body = { contract: WORK_PREFIX_REQUEST_CONTRACT, purpose: WORK_PREFIX_REQUEST_PURPOSE,
    release: '2026-08-31', sourceHead, roster: structuredClone(previous.roster), sourcePin: { ...WORK_PREFIX_SOURCE_PIN },
    range: { ...WORK_PREFIX_RANGE }, limits: { ...WORK_PREFIX_LIMITS }, previousAcquisition: { ...WORK_PREFIX_PREVIOUS_ACQUISITION },
    recipientPublicKey: previous.recipientPublicKey, recipientFingerprint: previous.recipientFingerprint };
  return { ...body, requestSha256: digest(body) };
}
const realRequest = requestFor();
const syntheticRequest = requestFor({ roster: [{ workId: 'OL123W', editionId: 'OL456M' }],
  recipientPublicKey: keys.publicKey, recipientFingerprint: recipientFingerprint(keys.publicKey) });
const canary = 'PRIVATE selected-row diagnostic must never appear in public runner output';
function failedRow(request = syntheticRequest) {
  const expected = request.roster[0];
  return Buffer.from(['/type/work', `/works/${expected.workId}`, '1', '2026-08-15T10:00:00', JSON.stringify({
    key: `/works/${expected.workId}`, type: { key: '/type/work' }, description: canary, location: null })].join('\t') + '\r');
}
function resultFor(status = 'diagnosed', request = syntheticRequest) {
  const raw = failedRow(request), l = request.limits;
  const failureEvidence = status === 'diagnosed' ? createDumpFailureEvidence({ rowBytes: raw, terminated: true,
    sourceKind: 'works', source: request.sourcePin, roster: request.roster, expected: request.roster[0], row: 1,
    fetchedAt: at, predicate: 'record-location-present', limits: l }) : null;
  return { contract: WORK_PREFIX_DIAGNOSTIC_CONTRACT, status,
    code: status === 'diagnosed' ? 'provider-identity-mismatch' : status === 'inconclusive' ? 'work-prefix-row-limit' : 'work-prefix-range-not-honored',
    release: request.release, retrievedAt: at, completedAt: at, rosterSha256: digest(request.roster),
    sourcePin: request.sourcePin, range: request.range, limits: l,
    response: status === 'failed' ? null : { url: request.sourcePin.url, finalUrl: request.sourcePin.url, status: 206,
      contentRange: 'bytes 0-104857599/4058336593', contentLength: l.compressedBytes, redirects: [] },
    accounting: { requests: { works: 1, editions: 0, metadata: 0 }, receivedBodyBytes: status === 'failed' ? 0 : 100,
      compressedBytes: status === 'failed' ? 0 : 100, decodedBytes: status === 'failed' ? 0 : raw.length + 1,
      rows: status === 'failed' ? 0 : status === 'diagnosed' ? 1 : l.maxRows, matchedRecords: 0,
      unrelatedRows: status === 'inconclusive' ? l.maxRows : 0, malformedUnrelatedRows: 0, prefixComplete: false,
      prefixSha256: status === 'failed' ? null : 'c'.repeat(64), failureEvidenceBytes: failureEvidence?.rawBytes ?? 0,
      retainedRecordBytes: 0 }, failureEvidence, fullSourceComplete: false, publisherChecksumsVerified: false,
    candidates: 0, approved: 0, databaseWrites: 0, individualProviderRequests: 0 };
}
const env = () => ({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Kajooja/Kajo', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '100', GITHUB_EVENT_NAME: 'push', GITHUB_REF: `refs/heads/${WORK_PREFIX_BRANCH}`,
  GITHUB_SHA: requestHead, WORK_PREFIX_GITHUB_TOKEN: 'fixture-read-only-token' });
const budget = { total_count: 1, workflow_runs: [{ id: 100, head_branch: WORK_PREFIX_BRANCH, run_attempt: 1 }] };
const fetcher = async () => new Response(JSON.stringify(budget));
function fixtureGit(request = realRequest, previous = previousRequest) {
  const fetched = new Set();
  return async args => {
    if (args[0] === 'fetch') { fetched.add(args[3]); return ''; }
    if (args[0] === 'rev-parse') return (args[1] === 'FETCH_HEAD' ? requestHead : sourceHead) + '\n';
    if (args[0] === 'show' && args[1] === '-s') return sourceHead + '\n';
    if (args[0] === 'show') {
      if (args[1] === `${WORK_PREFIX_PREVIOUS_ACQUISITION.requestHead}:${REVIEWED_REQUEST_PATH}`) {
        assert.ok(fetched.has(WORK_PREFIX_PREVIOUS_ACQUISITION.requestHead)); return JSON.stringify(previous);
      }
      assert.equal(args[1], `${requestHead}:${WORK_PREFIX_REQUEST_PATH}`); return JSON.stringify(request);
    }
    if (args[0] === 'diff') return `A\t${WORK_PREFIX_REQUEST_PATH}\n`;
    throw new Error('unexpected Git fixture');
  };
}
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'kajo-work-prefix-'));
  t.after(() => rm(path, { recursive: true, force: true })); return path;
}

test('separate request freezes purpose, full prior provenance, exact Work pin, byte range and limits', () => {
  assert.equal(validateReviewedAcquisitionRequest(previousRequest), previousRequest);
  assert.equal(previousRequest.requestSha256, WORK_PREFIX_PREVIOUS_ACQUISITION.requestSha256);
  assert.equal(previousRequest.roster.length, 383);
  assert.equal(previousRequest.recipientFingerprint, '8a5fa11d31492a719496d68b0c736426d9fa5fab4ce8e11474943b159997142b');
  assert.equal(validateWorkPrefixRequest(realRequest), realRequest);
  for (const change of [value => { value.range.end++; }, value => { value.range.start++; }, value => { value.range.totalBytes--; },
    value => { value.sourcePin.md5 = '0'.repeat(32); }, value => { value.limits.compressedBytes++; },
    value => { value.limits.timeoutMs++; }, value => { value.purpose = 'retry'; },
    value => { value.previousAcquisition.artifactZipSha256 = '0'.repeat(64); },
    value => { value.previousAcquisition.requestHead = '0'.repeat(40); }, value => { value.sourceHead = 'main'; }]) {
    const value = structuredClone(realRequest); change(value); delete value.requestSha256;
    assert.throws(() => validateWorkPrefixRequest({ ...value, requestSha256: digest(value) }), /invalid-work-prefix-request/);
  }
});

test('preparation rejects untrusted old plaintext or ciphertext before private key access', () => {
  for (const previousArtifact of ['{}', JSON.stringify(resultFor()), 'PRIVATE UNKNOWN BODY']) {
    assert.throws(() => prepareWorkPrefixRequest({ previousRequest, previousArtifact, sourceHead, privatePem: 'never parsed' }),
      /work-prefix-predecessor-artifact-mismatch/);
  }
  const forged = structuredClone(previousRequest); forged.roster[0].editionId = 'OL9999999999999M';
  assert.throws(() => prepareWorkPrefixRequest({ previousRequest: forged, previousArtifact: '{}', sourceHead }), /invalid-acquisition-request-hash/);
});

test('production guard checks canonical real predecessor, original roster/key, exact main child and sole added file', () => {
  const input = { sourceHead, requestHead, parents: sourceHead, changes: `A\t${WORK_PREFIX_REQUEST_PATH}\n`, request: realRequest, previousRequest };
  assert.equal(validateWorkPrefixCommit(input), realRequest);
  for (const patch of [{ parents: `${sourceHead} ${requestHead}` }, { sourceHead: 'c'.repeat(40) },
    { changes: `M\t${WORK_PREFIX_REQUEST_PATH}\n` }, { changes: `A\t${WORK_PREFIX_REQUEST_PATH}\nM\tpackage.json\n` },
    { request: syntheticRequest }, { previousRequest: { ...previousRequest, requestSha256: '0'.repeat(64) } }])
    assert.throws(() => validateWorkPrefixCommit({ ...input, ...patch }), /(?:invalid|work-prefix)-/);
});

test('attempt and cumulative workflow ledger reject all reruns and other request runs', async t => {
  validateWorkPrefixRunBudget(budget, '100');
  for (const document of [{ total_count: 0, workflow_runs: [] }, { ...budget, total_count: 2 },
    { total_count: 1, workflow_runs: [{ ...budget.workflow_runs[0], run_attempt: 2 }] },
    { total_count: 1, workflow_runs: [{ ...budget.workflow_runs[0], head_branch: 'other' }] }])
    assert.throws(() => validateWorkPrefixRunBudget(document, '100'), /work-prefix-request-consumed/);
  const root = await directory(t); let calls = 0;
  for (const patch of [{ GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_REF: 'refs/heads/main' }, { GITHUB_EVENT_NAME: 'workflow_dispatch' }])
    await assert.rejects(guardedWorkPrefixDiagnostic({ env: { ...env(), ...patch }, git: fixtureGit(), fetcher,
      inspect: async () => { calls++; }, outputDirectory: join(root, 'not-created') }), /work-prefix-request-consumed/);
  await assert.rejects(guardedWorkPrefixDiagnostic({ env: env(), git: fixtureGit(),
    fetcher: async () => new Response(JSON.stringify({ ...budget, total_count: 2 })),
    inspect: async () => { calls++; }, outputDirectory: join(root, 'not-created') }), /work-prefix-request-consumed/);
  assert.equal(calls, 0);
  assert.deepEqual(await readdir(root), []);
});

test('all diagnostic statuses roundtrip authenticated encryption with one neutral public payload kind', () => {
  for (const status of ['diagnosed', 'inconclusive', 'failed']) {
    const result = resultFor(status), sealed = sealWorkPrefixDiagnostic(result, syntheticRequest);
    assert.equal(sealed.header.payloadKind, 'work-prefix-diagnostic');
    assert.deepEqual(unsealWorkPrefixDiagnostic(sealed, syntheticRequest, keys.privateKey), result);
    assert.ok(!JSON.stringify(sealed).includes(canary));
    assert.ok(!JSON.stringify(sealed).includes('record-location-present'));
    if (result.failureEvidence) assert.ok(!JSON.stringify(sealed).includes(result.failureEvidence.rawBase64));
    const damaged = structuredClone(sealed); damaged.header.sourceHead = 'd'.repeat(40);
    assert.throws(() => unsealWorkPrefixDiagnostic(damaged, syntheticRequest, keys.privateKey), /invalid-acquisition-envelope-binding/);
  }
});

test('recovery rejects forged diagnostics, source completion, candidates, tail rows and accounting or predicate drift', () => {
  for (const change of [value => { value.fullSourceComplete = true; }, value => { value.publisherChecksumsVerified = true; },
    value => { value.candidates = 1; }, value => { value.records = []; }, value => { value.sourcePin = {}; },
    value => { value.accounting.requests.editions = 1; }, value => { value.accounting.requests.metadata = 1; },
    value => { value.accounting.retainedRecordBytes = 1; }, value => { value.accounting.rows++; },
    value => { value.failureEvidence.predicate = 'record-key-mismatch'; }, value => { value.failureEvidence.terminated = false; },
    value => { value.accounting.failureEvidenceBytes--; }, value => { value.response.status = 200; },
    value => { value.response.contentRange = 'bytes 1-104857600/4058336593'; },
    value => { value.response.finalUrl = 'https://evil.example/file'; }, value => { value.accounting.compressedBytes = WORK_PREFIX_LIMITS.compressedBytes + 1; },
    value => { value.accounting.prefixComplete = true; }, value => { value.failureEvidence = null; },
    value => { value.accounting.compressedBytes = 0; }, value => { value.accounting.decodedBytes = 0; },
    value => { value.code = canary; }, value => { value.completedAt = '2020-01-01T00:00:00Z'; }]) {
    const value = structuredClone(resultFor()); change(value);
    assert.throws(() => sealWorkPrefixDiagnostic(value, syntheticRequest), /invalid-(?:work-prefix-result|dump-failure-evidence)/);
  }
  // Authentic encryption is not sufficient: recovery also validates contents.
  const invalid = resultFor(); invalid.fullSourceComplete = true;
  const template = sealWorkPrefixDiagnostic(resultFor(), syntheticRequest), bytes = Buffer.from(JSON.stringify(invalid));
  const header = { ...template.header, plaintextSha256: sha256(bytes), plaintextBytes: bytes.length };
  const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(canonicalJson(header)));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const envelope = { header, wrappedKey: publicEncrypt({ key: keys.publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256' }, key).toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  assert.throws(() => unsealWorkPrefixDiagnostic(envelope, syntheticRequest, keys.privateKey), /acquisition-unseal-failed/);
});

test('inconclusive causes must actually reach their named bound and never contain a diagnostic row', () => {
  const rowLimited = resultFor('inconclusive');
  assert.equal(validateWorkPrefixResult(rowLimited, syntheticRequest), rowLimited);
  const decoded = structuredClone(rowLimited); decoded.code = 'work-prefix-decoded-limit';
  assert.throws(() => validateWorkPrefixResult(decoded, syntheticRequest), /invalid-work-prefix-result/);
  decoded.accounting.decodedBytes = WORK_PREFIX_LIMITS.maxDecodedBytes;
  assert.equal(validateWorkPrefixResult(decoded, syntheticRequest), decoded);
  const exhausted = structuredClone(rowLimited); exhausted.code = 'work-prefix-range-exhausted';
  assert.throws(() => validateWorkPrefixResult(exhausted, syntheticRequest), /invalid-work-prefix-result/);
  exhausted.accounting.receivedBodyBytes = exhausted.accounting.compressedBytes = WORK_PREFIX_LIMITS.compressedBytes;
  exhausted.accounting.prefixComplete = true;
  assert.equal(validateWorkPrefixResult(exhausted, syntheticRequest), exhausted);
});

test('observed body exhaustion or overrun is reported honestly as a failed cumulative body-limit receipt', () => {
  const overrun = resultFor('failed');
  overrun.accounting.receivedBodyBytes = WORK_PREFIX_LIMITS.compressedBytes + 65536;
  assert.throws(() => validateWorkPrefixResult(overrun, syntheticRequest), /invalid-work-prefix-result/);
  overrun.code = 'work-prefix-body-limit';
  assert.equal(validateWorkPrefixResult(overrun, syntheticRequest), overrun);
  overrun.accounting.receivedBodyBytes = WORK_PREFIX_LIMITS.compressedBytes;
  assert.equal(validateWorkPrefixResult(overrun, syntheticRequest), overrun);
  overrun.accounting.receivedBodyBytes--;
  assert.throws(() => validateWorkPrefixResult(overrun, syntheticRequest), /invalid-work-prefix-result/);
  const ordinary = resultFor(); ordinary.accounting.receivedBodyBytes = WORK_PREFIX_LIMITS.compressedBytes + 1;
  assert.throws(() => validateWorkPrefixResult(ordinary, syntheticRequest), /invalid-work-prefix-result/);
});

test('guarded real-roster core fixture writes only ciphertext and preserves no-candidate semantics', async t => {
  const root = await directory(t), calls = [];
  const body = gzipSync(Buffer.concat([failedRow(realRequest), Buffer.from('\n')]));
  const actual = await guardedWorkPrefixDiagnostic({ env: env(), git: fixtureGit(), fetcher,
    inspect: args => inspectWorkDumpPrefix({ ...args, transport: async (url, options) => {
      calls.push(url); assert.equal(options.maxBytes, WORK_PREFIX_LIMITS.compressedBytes);
      return { status: 206, headers: { 'content-length': String(WORK_PREFIX_LIMITS.compressedBytes),
        'content-range': 'bytes 0-104857599/4058336593' }, body: Readable.from([body]) };
    } }), outputDirectory: join(root, 'output') });
  assert.equal(actual.status, 'sealed');
  assert.deepEqual(calls, [WORK_PREFIX_SOURCE_PIN.url]);
  const sealed = await readFile(join(root, 'output', WORK_PREFIX_ARTIFACT_FILE), 'utf8');
  assert.ok(!sealed.includes(canary));
  assert.ok(!sealed.includes('record-location-present'));
  assert.equal(JSON.parse(sealed).header.recipientFingerprint, previousRequest.recipientFingerprint);
  assert.equal(actual.candidates, 0);
  assert.equal((await stat(join(root, 'output', WORK_PREFIX_ARTIFACT_FILE))).mode & 0o077, 0);
  assert.deepEqual(await readdir(join(root, 'output')), [WORK_PREFIX_ARTIFACT_FILE]);
  let called = false;
  await assert.rejects(guardedWorkPrefixDiagnostic({ env: env(), git: fixtureGit(), fetcher,
    inspect: async () => { called = true; }, outputDirectory: join(root, 'output') }), { code: 'EEXIST' });
  assert.equal(called, false);
});

test('failed prefix still uploads an encrypted receipt while exported/public errors contain fixed text only', async t => {
  const root = await directory(t), output = join(root, 'output'), githubOutput = join(root, 'step-output');
  await assert.rejects(guardedWorkPrefixDiagnostic({ env: { ...env(), GITHUB_OUTPUT: githubOutput }, git: fixtureGit(), fetcher,
    inspect: async () => resultFor('failed', realRequest), outputDirectory: output }), error => {
    assert.equal(error.message, 'work-prefix-diagnostic-failed');
    assert.deepEqual(Object.getOwnPropertyNames(error).sort(), ['message', 'stack']); return true;
  });
  assert.equal(await readFile(githubOutput, 'utf8'), 'sealed=true\n');
  assert.deepEqual(await readdir(output), [WORK_PREFIX_ARTIFACT_FILE]);
});

test('local recovery refuses overwrite and prints no private predicate or row', async t => {
  const root = await directory(t), requestPath = join(root, 'request.json'), inputPath = join(root, 'input.json');
  await writeFile(requestPath, JSON.stringify(syntheticRequest));
  await writeFile(inputPath, JSON.stringify(sealWorkPrefixDiagnostic(resultFor(), syntheticRequest)));
  await writeFile(join(root, 'recipient-private.pem'), keys.privateKey, { mode: 0o600 });
  const args = [fileURLToPath(new URL('./prepare-work-prefix-diagnostic.mjs', import.meta.url)),
    'unseal', '--request', requestPath, '--input', inputPath, '--key-dir', root, '--out', join(root, 'recovered')];
  const childEnv = { ...process.env }; delete childEnv.GITHUB_ACTIONS;
  const blocked = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...childEnv, GITHUB_ACTIONS: 'true' } });
  assert.equal(blocked.status, 1);
  assert.deepEqual(JSON.parse(blocked.stderr), { status: 'failed', code: 'work-prefix-local-operation-failed' });
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: childEnv });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).diagnosticStatus, 'diagnosed');
  const recovered = await readFile(join(root, 'recovered', 'work-prefix-diagnostic.json'), 'utf8');
  assert.equal(JSON.parse(recovered).failureEvidence.predicate, 'record-location-present');
  const repeat = spawnSync(process.execPath, args, { encoding: 'utf8', env: childEnv });
  assert.equal(repeat.status, 1);
  assert.deepEqual(JSON.parse(repeat.stderr), { status: 'failed', code: 'work-prefix-local-operation-failed' });
  assert.equal(await readFile(join(root, 'recovered', 'work-prefix-diagnostic.json'), 'utf8'), recovered);
  const logs = [blocked.stdout, blocked.stderr, result.stdout, result.stderr, repeat.stdout, repeat.stderr].join('');
  assert.ok(!logs.includes(canary));
  assert.ok(!logs.includes('record-location-present'));
});

test('dedicated workflow pins Actions, checks out main without credentials and uploads only encrypted artifact', async () => {
  const source = await readFile(new URL(`../../.github/workflows/${WORK_PREFIX_WORKFLOW_FILE}`, import.meta.url), 'utf8');
  assert.ok(source.includes(`branches: [${WORK_PREFIX_BRANCH}]`));
  assert.ok(source.includes(`paths: [${WORK_PREFIX_REQUEST_PATH}]`));
  assert.ok(source.includes('ref: main') && source.includes('persist-credentials: false'));
  assert.ok(source.includes('contents: read') && source.includes('actions: read'));
  assert.ok(source.includes('timeout-minutes: 20') && source.includes(WORK_PREFIX_ARTIFACT_FILE));
  for (const match of source.matchAll(/uses: (\S+)/g)) assert.match(match[1], /@[0-9a-f]{40}$/);
  assert.ok(!source.includes('workflow_dispatch') && !source.includes('secrets.'));
});
