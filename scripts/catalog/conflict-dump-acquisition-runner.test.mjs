import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { CONFLICT_ACQUISITION_CONTRACT, acquireConflictAwareOpenLibraryDumps, collectConflictDumpStreams } from './acquire-open-library-dumps.mjs';
import { createHash } from 'node:crypto';
import { CONFLICT_POLICY_CONTRACT } from './dump-conflict-policy.mjs';
import { WORK_PREFIX_LIMITS, WORK_PREFIX_RANGE, WORK_PREFIX_SOURCE_PIN } from './inspect-work-dump-prefix.mjs';
import { digest, sha256 } from './open-library-descriptions.mjs';
import { CONFLICT_ARTIFACT_FILE, CONFLICT_WORKFLOW_FILE, guardedConflictDumpAcquisition,
  validateConflictAcquisitionCommit, validateConflictAcquisitionRunBudget } from './run-conflict-dump-acquisition.mjs';
import { CONFLICT_CORE_SOURCE_HEAD, CONFLICT_POLICY_SOURCE_HEAD, CONFLICT_PREVIOUS_CONTINUATION,
  CONFLICT_REQUEST_BRANCH, CONFLICT_REQUEST_PATH } from './seal-conflict-dump-acquisition.mjs';
import * as protocol from './seal-conflict-dump-acquisition.mjs';
import { constructConflictAcquisitionRequest } from './prepare-conflict-dump-acquisition.mjs';
import { DIAGNOSTIC_LIMITS, DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_CONTRACT, DIAGNOSTIC_REQUEST_PATH,
  REQUEST_CONTRACT, REQUEST_LIMITS, REQUEST_PATH, REVIEWED_PREVIOUS_DIAGNOSTIC, REVIEWED_REQUEST_PATH } from './seal-dump-acquisition.mjs';
import { FULL_CONTINUATION_CORRECTION_HEAD, FULL_CONTINUATION_PREVIOUS_PREFIX, FULL_CONTINUATION_PREVIOUS_REVIEWED,
  FULL_CONTINUATION_REQUEST_CONTRACT, FULL_CONTINUATION_REQUEST_PATH,
  FULL_CONTINUATION_REQUEST_PURPOSE } from './seal-full-dump-continuation.mjs';
import { WORK_PREFIX_PREVIOUS_ACQUISITION, WORK_PREFIX_REQUEST_CONTRACT, WORK_PREFIX_REQUEST_PATH,
  WORK_PREFIX_REQUEST_PURPOSE } from './seal-work-prefix-diagnostic.mjs';

// Rebuild public predecessor values using the already committed public roster;
// no historical Git object, private key, source response or network is needed.
const reviewedRequest = JSON.parse(await readFile(new URL('./fixtures/work-prefix-previous-request.json', import.meta.url), 'utf8'));
const sign = body => ({ ...body, requestSha256: digest(body) });
const recipient = { recipientPublicKey: reviewedRequest.recipientPublicKey,
  recipientFingerprint: reviewedRequest.recipientFingerprint };
const originalRequest = sign({ contract: REQUEST_CONTRACT, release: reviewedRequest.release,
  sourceHead: DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead, roster: reviewedRequest.roster, limits: { ...REQUEST_LIMITS }, ...recipient });
const diagnosticRequest = sign({ contract: DIAGNOSTIC_REQUEST_CONTRACT, purpose: 'metadata-only-failure-diagnosis',
  release: reviewedRequest.release, sourceHead: REVIEWED_PREVIOUS_DIAGNOSTIC.sourceHead, limits: { ...DIAGNOSTIC_LIMITS },
  ...recipient, previousAcquisition: { ...DIAGNOSTIC_PREVIOUS_ACQUISITION } });
const prefixRequest = sign({ contract: WORK_PREFIX_REQUEST_CONTRACT, purpose: WORK_PREFIX_REQUEST_PURPOSE,
  release: reviewedRequest.release, sourceHead: FULL_CONTINUATION_PREVIOUS_PREFIX.sourceHead, roster: reviewedRequest.roster,
  sourcePin: { ...WORK_PREFIX_SOURCE_PIN }, range: { ...WORK_PREFIX_RANGE }, limits: { ...WORK_PREFIX_LIMITS },
  previousAcquisition: { ...WORK_PREFIX_PREVIOUS_ACQUISITION }, ...recipient });
const sourceHead = 'a'.repeat(40), requestHead = 'b'.repeat(40), at = '2026-09-27T20:00:00.000Z';
const { requestSha256: reviewedDigest, ...reviewedBody } = reviewedRequest;
const previousContinuation = sign({ ...reviewedBody, contract: FULL_CONTINUATION_REQUEST_CONTRACT,
  purpose: FULL_CONTINUATION_REQUEST_PURPOSE, sourceHead: CONFLICT_PREVIOUS_CONTINUATION.sourceHead,
  previousReviewedAcquisition: { ...FULL_CONTINUATION_PREVIOUS_REVIEWED },
  previousPrefixDiagnostic: { ...FULL_CONTINUATION_PREVIOUS_PREFIX }, correctionHead: FULL_CONTINUATION_CORRECTION_HEAD });
const conflictPolicy = { contract: CONFLICT_POLICY_CONTRACT, maxConflictedPairs: 1, maxDiagnosticBytes: 1049600 };
const request = constructConflictAcquisitionRequest({ previousContinuation, sourceHead, conflictPolicy, modules: { ...protocol, digest } });
const predecessors = { previousContinuation, reviewedRequest, prefixRequest, originalRequest, diagnosticRequest };
const env = () => ({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Kajooja/Kajo', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '100', GITHUB_EVENT_NAME: 'push', GITHUB_REF: `refs/heads/${CONFLICT_REQUEST_BRANCH}`,
  GITHUB_SHA: requestHead, CONFLICT_ACQUISITION_GITHUB_TOKEN: 'fixture-read-only-token' });
const budget = { total_count: 1, workflow_runs: [{ id: 100, head_branch: CONFLICT_REQUEST_BRANCH,
  run_attempt: 1, event: 'push', head_sha: requestHead }] };
const fetcher = async () => new Response(JSON.stringify(budget));
const canary = 'PRIVATE unreviewed selected record must never appear in public output';

function fixtureGit() {
  const fetched = new Set();
  return async args => {
    if (args[0] === 'fetch') { fetched.add(args[3]); return ''; }
    if (args[0] === 'status') return '';
    if (args[0] === 'merge-base') {
      assert.ok([CONFLICT_CORE_SOURCE_HEAD, CONFLICT_POLICY_SOURCE_HEAD].includes(args[2]));
      assert.equal(args[3], sourceHead); return '';
    }
    if (args[0] === 'rev-parse') return (args[1] === 'FETCH_HEAD' ? requestHead : sourceHead) + '\n';
    if (args[0] === 'show' && args[1] === '-s') return sourceHead + '\n';
    if (args[0] === 'show') {
      for (const [identity, path, value] of [
        [CONFLICT_PREVIOUS_CONTINUATION, FULL_CONTINUATION_REQUEST_PATH, previousContinuation],
        [FULL_CONTINUATION_PREVIOUS_REVIEWED, REVIEWED_REQUEST_PATH, reviewedRequest],
        [FULL_CONTINUATION_PREVIOUS_PREFIX, WORK_PREFIX_REQUEST_PATH, prefixRequest],
        [DIAGNOSTIC_PREVIOUS_ACQUISITION, REQUEST_PATH, originalRequest],
        [REVIEWED_PREVIOUS_DIAGNOSTIC, DIAGNOSTIC_REQUEST_PATH, diagnosticRequest],
      ]) if (args[1] === `${identity.requestHead}:${path}`) {
        assert.ok(fetched.has(identity.requestHead)); return JSON.stringify(value);
      }
      assert.equal(args[1], `${requestHead}:${CONFLICT_REQUEST_PATH}`);
      return JSON.stringify(request);
    }
    if (args[0] === 'diff') return `A\t${CONFLICT_REQUEST_PATH}\n`;
    throw new Error('Unexpected Git fixture');
  };
}
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'kajo-full-continuation-'));
  t.after(() => rm(path, { recursive: true, force: true })); return path;
}
async function collected() {
  // Real tiny gzip input, followed by explicitly simulated full-source assertions
  // for the production encryption boundary. No publisher bytes are downloaded.
  const compressed = gzipSync('unrelated\n'), sourcePins = {};
  for (const kind of ['works', 'editions']) sourcePins[kind] = { ...request.sourcePins[kind], bytes: compressed.length,
    md5: createHash('md5').update(compressed).digest('hex'), sha1: createHash('sha1').update(compressed).digest('hex') };
  const value = await collectConflictDumpStreams({ ...request, sourcePins,
    openSource: async (_kind, source, _options, onRequest) => { onRequest(); return { status: 200, headers: {},
      url: source.url, redirects: [], body: Readable.from([compressed]) }; } });
  assert.equal(value.status, 'collected');
  for (const kind of ['works', 'editions']) {
    const pin = request.sourcePins[kind];
    for (const target of [value.sources[kind], value.accounting.sources[kind]])
      Object.assign(target, { bytes: pin.bytes, expectedBytes: pin.bytes, md5: pin.md5, sha1: pin.sha1 });
    value.sourceManifest.sources[kind].bytes = pin.bytes;
  }
  return { contract: CONFLICT_ACQUISITION_CONTRACT, ...value, sourceEvidence: request.sourceEvidence,
    approved: 0, databaseWrites: 0, modelAdmissions: 0, individualProviderRequests: 0, rights: 'unreviewed' };
}
test('runner fixtures reconstruct the five exact consumed public request hashes', () => {
  assert.equal(reviewedDigest, FULL_CONTINUATION_PREVIOUS_REVIEWED.requestSha256);
  assert.equal(originalRequest.requestSha256, DIAGNOSTIC_PREVIOUS_ACQUISITION.requestSha256);
  assert.equal(diagnosticRequest.requestSha256, REVIEWED_PREVIOUS_DIAGNOSTIC.requestSha256);
  assert.equal(prefixRequest.requestSha256, FULL_CONTINUATION_PREVIOUS_PREFIX.requestSha256);
  assert.equal(previousContinuation.requestSha256, CONFLICT_PREVIOUS_CONTINUATION.requestSha256);
  assert.equal(request.roster.length, 383);
});

test('commit gate requires the sole added request, exact main parent and all five fixed predecessors', () => {
  const input = { sourceHead, requestHead, parents: sourceHead, changes: `A\t${CONFLICT_REQUEST_PATH}\n`,
    request, ...predecessors };
  assert.equal(validateConflictAcquisitionCommit(input), request);
  for (const patch of [{ parents: `${sourceHead} ${requestHead}` }, { sourceHead: 'c'.repeat(40) },
    { changes: `M\t${CONFLICT_REQUEST_PATH}\n` },
    { changes: `A\t${CONFLICT_REQUEST_PATH}\nM\tpackage.json\n` },
    { changes: `A\tscripts/catalog/requests/ol-20260831-reviewed.json\n` },
    ...Object.keys(predecessors).flatMap(key => [{ [key]: undefined }, { [key]: { ...predecessors[key], requestSha256: '0'.repeat(64) } }]),
    { originalRequest: sign({ ...originalRequest, roster: originalRequest.roster.slice(1) }) },
    { diagnosticRequest: sign({ ...diagnosticRequest, recipientFingerprint: '0'.repeat(64) }) }])
    assert.throws(() => validateConflictAcquisitionCommit({ ...input, ...patch }), /(?:invalid|conflict-acquisition)-/);
});

test('workflow-specific first-run ledger binds push head and rejects every prior attempt', () => {
  validateConflictAcquisitionRunBudget(budget, '100', requestHead);
  for (const document of [{ total_count: 0, workflow_runs: [] }, { ...budget, total_count: 2 },
    ...[{ run_attempt: 2 }, { head_branch: 'catalog-acquisition/ol-20260831-reviewed' }, { id: 99 },
      { head_sha: 'c'.repeat(40) }, { event: 'workflow_dispatch' }].map(patch => ({ total_count: 1,
      workflow_runs: [{ ...budget.workflow_runs[0], ...patch }] }))])
    assert.throws(() => validateConflictAcquisitionRunBudget(document, '100', requestHead), /conflict-acquisition-request-consumed/);
});

test('invalid events, main, ancestry, dirty source and request tree cannot reach a provider', async t => {
  const root = await directory(t); let calls = 0, githubCalls = 0;
  const acquire = async () => { calls++; };
  const checkedFetch = async () => { githubCalls++; return fetcher(); };
  for (const patch of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_REPOSITORY: 'other/repo' },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/heads/main' }, { GITHUB_SHA: 'c'.repeat(40) }])
    await assert.rejects(guardedConflictDumpAcquisition({ env: { ...env(), ...patch }, git: fixtureGit(), fetcher: checkedFetch,
      acquire, outputDirectory: join(root, 'blocked') }), /conflict-acquisition-/);
  for (const kind of ['dirty', 'main', 'ancestry', 'tree', 'predecessor']) {
    const git = fixtureGit();
    await assert.rejects(guardedConflictDumpAcquisition({ env: env(), git: async args => {
      if (kind === 'dirty' && args[0] === 'status') return ' M scripts/catalog/dump-failure-evidence.mjs\n';
      if (kind === 'main' && args[0] === 'rev-parse' && args[1] === 'refs/remotes/origin/main') return 'c'.repeat(40);
      if (kind === 'ancestry' && args[0] === 'merge-base') throw new Error(canary);
      if (kind === 'tree' && args[0] === 'diff') return `A\t${CONFLICT_REQUEST_PATH}\nM\tpackage.json\n`;
      if (kind === 'predecessor' && args[0] === 'show' && args[1] === `${FULL_CONTINUATION_PREVIOUS_PREFIX.requestHead}:${WORK_PREFIX_REQUEST_PATH}`)
        return JSON.stringify({ ...prefixRequest, requestSha256: '0'.repeat(64) });
      return git(args);
    }, fetcher: checkedFetch, acquire, outputDirectory: join(root, kind) }), /(?:invalid|conflict-acquisition)-/);
  }
  assert.equal(calls, 0); assert.equal(githubCalls, 0); assert.deepEqual(await readdir(root), []);
});

test('spent, oversized and failed ledger responses prevent output claim and provider access', async t => {
  const root = await directory(t); let calls = 0;
  for (const response of [new Response(JSON.stringify({ ...budget, total_count: 2 })),
    new Response('unavailable', { status: 503 }), new Response(' '.repeat(2 * 1024 * 1024 + 1))])
    await assert.rejects(guardedConflictDumpAcquisition({ env: env(), git: fixtureGit(), fetcher: async () => response,
      acquire: async () => { calls++; }, outputDirectory: join(root, 'blocked') }), /conflict-acquisition-/);
  assert.equal(calls, 0); assert.deepEqual(await readdir(root), []);
});

test('existing file, directory and dangling symlink refuse all Git/GitHub/provider network work', async t => {
  const root = await directory(t);
  await mkdir(join(root, 'directory')); await writeFile(join(root, 'file'), 'retained ciphertext');
  await symlink(join(root, 'missing'), join(root, 'link'));
  let calls = 0;
  for (const name of ['directory', 'file', 'link']) await assert.rejects(guardedConflictDumpAcquisition({ env: env(),
    git: async () => { calls++; }, fetcher: async () => { calls++; }, acquire: async () => { calls++; },
    outputDirectory: join(root, name) }), /conflict-acquisition-output-exists/);
  assert.equal(calls, 0); assert.equal(await readFile(join(root, 'file'), 'utf8'), 'retained ciphertext');
});

test('exclusive claim closes an output race before provider collection', async t => {
  const root = await directory(t), outputDirectory = join(root, 'claimed'); let calls = 0;
  await assert.rejects(guardedConflictDumpAcquisition({ env: env(), git: fixtureGit(), outputDirectory,
    fetcher: async () => { await mkdir(outputDirectory); return fetcher(); }, acquire: async () => { calls++; } }), { code: 'EEXIST' });
  assert.equal(calls, 0); assert.deepEqual(await readdir(outputDirectory), []);
});

test('guarded collection passes unchanged 110-minute bounds and publishes one private ciphertext', async t => {
  const root = await directory(t), outputDirectory = join(root, 'success'); let calls = 0;
  const fixture = await collected();
  const result = await guardedConflictDumpAcquisition({ env: env(), git: fixtureGit(), fetcher: async (url, options) => {
    assert.equal(new URL(url).pathname, `/repos/Kajooja/Kajo/actions/workflows/${CONFLICT_WORKFLOW_FILE}/runs`);
    assert.equal(new URL(url).searchParams.get('branch'), CONFLICT_REQUEST_BRANCH);
    assert.equal(options.redirect, 'error'); return fetcher();
  }, outputDirectory, acquire: async options => {
    calls++; assert.deepEqual(options, { release: request.release, roster: request.roster,
      sourcePins: request.sourcePins, sourceEvidence: request.sourceEvidence, limits: request.limits, conflictPolicy: request.conflictPolicy });
    assert.equal(options.limits.timeoutMs, 110 * 60 * 1000);
    assert.equal((await stat(outputDirectory)).mode & 0o077, 0); assert.deepEqual(await readdir(outputDirectory), []);
    return fixture;
  } });
  assert.equal(calls, 1); assert.equal(result.maximumMetadataRequests, 0);
  assert.equal(result.maximumAcceptedCompressedBytes, 16644821648); assert.equal(result.targets, 383);
  assert.equal(result.approved, 0); assert.equal(result.databaseWrites, 0);
  assert.deepEqual(await readdir(outputDirectory), [CONFLICT_ARTIFACT_FILE]);
  const path = join(outputDirectory, CONFLICT_ARTIFACT_FILE), bytes = await readFile(path, 'utf8');
  const envelope = JSON.parse(bytes);
  assert.equal(envelope.header.requestSha256, request.requestSha256);
  assert.equal(envelope.header.recipientFingerprint, request.recipientFingerprint);
  assert.equal(envelope.header.plaintextSha256, sha256(JSON.stringify(fixture)));
  assert.equal((await stat(path)).mode & 0o077, 0);
  assert.ok(!bytes.includes(canary)); assert.ok(!JSON.stringify(result).includes(canary));
});


test('real unsupported identity failure seals truthful failure and never opens Edition', async t => {
  const root = await directory(t), outputDirectory = join(root, 'failed'), calls = [], githubOutput = join(root, 'output');
  const pair = request.roster[0], key = `/works/${pair.workId}`;
  const compressed = gzipSync(['/type/work', key, '1', '2026-08-15T10:00:00',
    JSON.stringify({ key, type: { key: '/type/work' }, location: null, description: canary })].join('\t') + '\n');
  let failure;
  await assert.rejects(guardedConflictDumpAcquisition({ env: { ...env(), GITHUB_OUTPUT: githubOutput }, git: fixtureGit(), fetcher,
    outputDirectory, acquire: async options => {
      failure = await acquireConflictAwareOpenLibraryDumps({ ...options, transport: async url => {
        calls.push(url); return { status: 200, headers: {}, body: Readable.from([compressed]) };
      } }); return failure;
    } }), error => { assert.equal(error.message, 'conflict-acquisition-failed'); assert.ok(!error.stack.includes(canary)); return true; });
  assert.deepEqual(calls, [request.sourcePins.works.url]);
  assert.equal(failure.code, 'dump-conflict-fatal'); assert.equal(failure.records, undefined);
  assert.equal(await readFile(githubOutput, 'utf8'), 'sealed=true\n');
  const sealed = await readFile(join(outputDirectory, CONFLICT_ARTIFACT_FILE), 'utf8');
  assert.equal(JSON.parse(sealed).header.payloadKind, 'conflict-acquisition-result');
  assert.equal(JSON.parse(sealed).header.plaintextSha256, sha256(JSON.stringify(failure)));
  assert.ok(!sealed.includes(canary));
});

test('mutated options, malformed results and unknown exceptions cannot mint a valid ciphertext', async t => {
  const root = await directory(t);
  for (const [index, acquire] of [async () => { throw new Error(canary); }, async () => ({ status: 'failed', raw: canary }),
    async options => { options.conflictPolicy.maxConflictedPairs = 300; const value = await collected();
      value.conflictPolicy = options.conflictPolicy; return value; }].entries()) {
    const outputDirectory = join(root, String(index));
    await assert.rejects(guardedConflictDumpAcquisition({ env: env(), git: fixtureGit(), fetcher, acquire, outputDirectory }),
      error => error.message === 'conflict-acquisition-failed' && !error.stack.includes(canary));
    assert.deepEqual(await readdir(outputDirectory), []);
  }
  assert.equal(request.conflictPolicy.maxConflictedPairs, 1);
});
test('CLI cannot activate outside Actions and emits one fixed sanitized line', async t => {
  const root = await directory(t);
  // Do not inherit the outer CI's GITHUB_ACTIONS or attempt/source variables.
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./run-conflict-dump-acquisition.mjs', import.meta.url)), join(root, 'blocked')],
    { env: { PATH: process.env.PATH, GITHUB_ACTIONS: 'false' }, encoding: 'utf8' });
  assert.equal(child.status, 1); assert.equal(child.stdout, '');
  assert.equal(child.stderr, '{"status":"failed","code":"conflict-acquisition-failed"}\n');
  assert.deepEqual(await readdir(root), []);
});

test('workflow exposes only the fixed push, read permissions, accepted checkout and ciphertext upload', async () => {
  const workflow = await readFile(new URL(`../../.github/workflows/${CONFLICT_WORKFLOW_FILE}`, import.meta.url), 'utf8');
  assert.match(workflow, /branches: \[catalog-acquisition\/ol-20260831-conflicts\]/);
  assert.match(workflow, /paths: \[scripts\/catalog\/requests\/ol-20260831-conflicts.json\]/);
  assert.doesNotMatch(workflow, /workflow_dispatch|schedule:|pull_request:|permissions: write|contents: write|actions: write/);
  assert.match(workflow, /permissions:\n  contents: read\n  actions: read/);
  assert.match(workflow, /timeout-minutes: 120/); assert.match(workflow, /ref: main/);
  assert.match(workflow, /fetch-depth: 0/); assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /npm ci .*--ignore-scripts/); assert.match(workflow, /if: always\(\) && steps.collect.outputs.sealed == 'true'/);
  assert.match(workflow, /open-library-conflicts-20260831\.sealed\.json/);
});
