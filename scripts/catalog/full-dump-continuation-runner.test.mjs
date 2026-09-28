import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { ACQUISITION_CONTRACT, acquireReviewedOpenLibraryDumps } from './acquire-open-library-dumps.mjs';
import { createDumpFailureEvidence } from './dump-failure-evidence.mjs';
import { WORK_PREFIX_LIMITS, WORK_PREFIX_RANGE, WORK_PREFIX_SOURCE_PIN } from './inspect-work-dump-prefix.mjs';
import { digest, inspectRecord, sha256 } from './open-library-descriptions.mjs';
import { SOURCE_CONTRACT } from './open-library-dump-descriptions.mjs';
import { FULL_CONTINUATION_ARTIFACT_FILE, FULL_CONTINUATION_WORKFLOW_FILE, guardedFullDumpContinuation,
  validateFullContinuationCommit, validateFullContinuationRunBudget } from './run-full-dump-continuation.mjs';
import { DIAGNOSTIC_LIMITS, DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_CONTRACT, DIAGNOSTIC_REQUEST_PATH,
  REQUEST_CONTRACT, REQUEST_LIMITS, REQUEST_PATH, REVIEWED_PREVIOUS_DIAGNOSTIC, REVIEWED_REQUEST_PATH } from './seal-dump-acquisition.mjs';
import { FULL_CONTINUATION_CORRECTION_HEAD, FULL_CONTINUATION_PREVIOUS_PREFIX, FULL_CONTINUATION_PREVIOUS_REVIEWED,
  FULL_CONTINUATION_REQUEST_BRANCH, FULL_CONTINUATION_REQUEST_CONTRACT, FULL_CONTINUATION_REQUEST_PATH,
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
const request = sign({ ...reviewedBody, contract: FULL_CONTINUATION_REQUEST_CONTRACT,
  purpose: FULL_CONTINUATION_REQUEST_PURPOSE, sourceHead,
  previousReviewedAcquisition: { ...FULL_CONTINUATION_PREVIOUS_REVIEWED },
  previousPrefixDiagnostic: { ...FULL_CONTINUATION_PREVIOUS_PREFIX }, correctionHead: FULL_CONTINUATION_CORRECTION_HEAD });
const predecessors = { reviewedRequest, prefixRequest, originalRequest, diagnosticRequest };
const env = () => ({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Kajooja/Kajo', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '100', GITHUB_EVENT_NAME: 'push', GITHUB_REF: `refs/heads/${FULL_CONTINUATION_REQUEST_BRANCH}`,
  GITHUB_SHA: requestHead, FULL_CONTINUATION_GITHUB_TOKEN: 'fixture-read-only-token' });
const budget = { total_count: 1, workflow_runs: [{ id: 100, head_branch: FULL_CONTINUATION_REQUEST_BRANCH,
  run_attempt: 1, event: 'push', head_sha: requestHead }] };
const fetcher = async () => new Response(JSON.stringify(budget));
const canary = 'PRIVATE unreviewed selected record must never appear in public output';

function fixtureGit() {
  const fetched = new Set();
  return async args => {
    if (args[0] === 'fetch') { fetched.add(args[3]); return ''; }
    if (args[0] === 'status') return '';
    if (args[0] === 'merge-base') {
      assert.deepEqual(args, ['merge-base', '--is-ancestor', FULL_CONTINUATION_CORRECTION_HEAD, sourceHead]); return '';
    }
    if (args[0] === 'rev-parse') return (args[1] === 'FETCH_HEAD' ? requestHead : sourceHead) + '\n';
    if (args[0] === 'show' && args[1] === '-s') return sourceHead + '\n';
    if (args[0] === 'show') {
      for (const [identity, path, value] of [
        [FULL_CONTINUATION_PREVIOUS_REVIEWED, REVIEWED_REQUEST_PATH, reviewedRequest],
        [FULL_CONTINUATION_PREVIOUS_PREFIX, WORK_PREFIX_REQUEST_PATH, prefixRequest],
        [DIAGNOSTIC_PREVIOUS_ACQUISITION, REQUEST_PATH, originalRequest],
        [REVIEWED_PREVIOUS_DIAGNOSTIC, DIAGNOSTIC_REQUEST_PATH, diagnosticRequest],
      ]) if (args[1] === `${identity.requestHead}:${path}`) {
        assert.ok(fetched.has(identity.requestHead)); return JSON.stringify(value);
      }
      assert.equal(args[1], `${requestHead}:${FULL_CONTINUATION_REQUEST_PATH}`);
      return JSON.stringify(request);
    }
    if (args[0] === 'diff') return `A\t${FULL_CONTINUATION_REQUEST_PATH}\n`;
    throw new Error('Unexpected Git fixture');
  };
}
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'kajo-full-continuation-'));
  t.after(() => rm(path, { recursive: true, force: true })); return path;
}
function collected() {
  // Simulated complete accounting exercises the runner/encryption boundary.
  // The shared collector suite separately streams real tiny gzip fixtures;
  // these fixed publisher sizes/hashes are never claimed as downloaded here.
  const expected = request.roster[0], key = `/works/${expected.workId}`, modifiedAt = '2026-08-15T10:00:00';
  const raw = JSON.stringify({ key, type: { key: '/type/work' }, location: key, revision: 1,
    last_modified: { value: modifiedAt }, description: canary });
  const inspection = inspectRecord(raw, expected, 'work', at), retainedRecordBytes = Buffer.byteLength(raw);
  const work = { raw, inspection, inspectionSha256: digest(inspection), dump: { row: 1, revision: 1, modifiedAt } };
  const sources = Object.fromEntries(Object.entries(request.sourcePins).map(([kind, pin]) => [kind,
    { ...pin, sha256: 'c'.repeat(64), complete: true, publisherChecksumsVerified: true,
      maxDecodedBytes: request.limits.maxDecodedBytes, maxRows: request.limits.maxRows,
      decodedBytes: kind === 'works' ? retainedRecordBytes + 100 : 100, rows: 1,
      matchedRecords: kind === 'works' ? 1 : 0, unrelatedRows: kind === 'works' ? 0 : 1,
      malformedUnrelatedRows: 0, finalUrl: pin.url, redirects: [] }]));
  const eligibleTexts = Number(inspection.description.status === 'eligible');
  return { contract: ACQUISITION_CONTRACT, status: 'collected', release: request.release, retrievedAt: at, completedAt: at,
    rosterSha256: digest(request.roster), limits: request.limits, sourceEvidence: request.sourceEvidence,
    approved: 0, databaseWrites: 0, individualProviderRequests: 0, rights: 'unreviewed',
    records: request.roster.map((row, index) => ({ ...row, work: index === 0 ? work : null, edition: null })), sources,
    sourceManifest: { contract: SOURCE_CONTRACT, release: request.release, retrievedAt: at,
      sources: Object.fromEntries(Object.entries(sources).map(([kind, source]) => [kind,
        Object.fromEntries(['url', 'sha256', 'bytes', 'compression', 'maxDecodedBytes', 'maxRows'].map(name => [name, source[name]]))])) },
    accounting: { metadata: { bytes: 0, complete: false, skipped: true }, requests: { metadata: 0, works: 1, editions: 1 },
      sources, activeSource: null, startedAt: at, completedAt: at, retainedRecordBytes, individualProviderRequests: 0, databaseWrites: 0 },
    retainedRecordBytes, coverage: { targets: 383, found: 1, missing: 765, eligibleTexts, targetsWithEligibleText: eligibleTexts } };
}

test('runner fixtures reconstruct the four exact consumed public request hashes', () => {
  assert.equal(reviewedDigest, FULL_CONTINUATION_PREVIOUS_REVIEWED.requestSha256);
  assert.equal(originalRequest.requestSha256, DIAGNOSTIC_PREVIOUS_ACQUISITION.requestSha256);
  assert.equal(diagnosticRequest.requestSha256, REVIEWED_PREVIOUS_DIAGNOSTIC.requestSha256);
  assert.equal(prefixRequest.requestSha256, FULL_CONTINUATION_PREVIOUS_PREFIX.requestSha256);
  assert.equal(request.roster.length, 383);
});

test('commit gate requires the sole added request, exact main parent and all four fixed predecessors', () => {
  const input = { sourceHead, requestHead, parents: sourceHead, changes: `A\t${FULL_CONTINUATION_REQUEST_PATH}\n`,
    request, ...predecessors };
  assert.equal(validateFullContinuationCommit(input), request);
  for (const patch of [{ parents: `${sourceHead} ${requestHead}` }, { sourceHead: 'c'.repeat(40) },
    { changes: `M\t${FULL_CONTINUATION_REQUEST_PATH}\n` },
    { changes: `A\t${FULL_CONTINUATION_REQUEST_PATH}\nM\tpackage.json\n` },
    { changes: `A\tscripts/catalog/requests/ol-20260831-reviewed.json\n` },
    ...Object.keys(predecessors).flatMap(key => [{ [key]: undefined }, { [key]: { ...predecessors[key], requestSha256: '0'.repeat(64) } }]),
    { originalRequest: sign({ ...originalRequest, roster: originalRequest.roster.slice(1) }) },
    { diagnosticRequest: sign({ ...diagnosticRequest, recipientFingerprint: '0'.repeat(64) }) }])
    assert.throws(() => validateFullContinuationCommit({ ...input, ...patch }), /(?:invalid|full-continuation)-/);
});

test('workflow-specific first-run ledger binds push head and rejects every prior attempt', () => {
  validateFullContinuationRunBudget(budget, '100', requestHead);
  for (const document of [{ total_count: 0, workflow_runs: [] }, { ...budget, total_count: 2 },
    ...[{ run_attempt: 2 }, { head_branch: 'catalog-acquisition/ol-20260831-reviewed' }, { id: 99 },
      { head_sha: 'c'.repeat(40) }, { event: 'workflow_dispatch' }].map(patch => ({ total_count: 1,
      workflow_runs: [{ ...budget.workflow_runs[0], ...patch }] }))])
    assert.throws(() => validateFullContinuationRunBudget(document, '100', requestHead), /full-continuation-request-consumed/);
});

test('invalid events, main, ancestry, dirty source and request tree cannot reach a provider', async t => {
  const root = await directory(t); let calls = 0, githubCalls = 0;
  const acquire = async () => { calls++; };
  const checkedFetch = async () => { githubCalls++; return fetcher(); };
  for (const patch of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_REPOSITORY: 'other/repo' },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/heads/main' }, { GITHUB_SHA: 'c'.repeat(40) }])
    await assert.rejects(guardedFullDumpContinuation({ env: { ...env(), ...patch }, git: fixtureGit(), fetcher: checkedFetch,
      acquire, outputDirectory: join(root, 'blocked') }), /full-continuation-/);
  for (const kind of ['dirty', 'main', 'ancestry', 'tree', 'predecessor']) {
    const git = fixtureGit();
    await assert.rejects(guardedFullDumpContinuation({ env: env(), git: async args => {
      if (kind === 'dirty' && args[0] === 'status') return ' M scripts/catalog/dump-failure-evidence.mjs\n';
      if (kind === 'main' && args[0] === 'rev-parse' && args[1] === 'refs/remotes/origin/main') return 'c'.repeat(40);
      if (kind === 'ancestry' && args[0] === 'merge-base') throw new Error(canary);
      if (kind === 'tree' && args[0] === 'diff') return `A\t${FULL_CONTINUATION_REQUEST_PATH}\nM\tpackage.json\n`;
      if (kind === 'predecessor' && args[0] === 'show' && args[1] === `${FULL_CONTINUATION_PREVIOUS_PREFIX.requestHead}:${WORK_PREFIX_REQUEST_PATH}`)
        return JSON.stringify({ ...prefixRequest, requestSha256: '0'.repeat(64) });
      return git(args);
    }, fetcher: checkedFetch, acquire, outputDirectory: join(root, kind) }), /(?:invalid|full-continuation)-/);
  }
  assert.equal(calls, 0); assert.equal(githubCalls, 0); assert.deepEqual(await readdir(root), []);
});

test('spent, oversized and failed ledger responses prevent output claim and provider access', async t => {
  const root = await directory(t); let calls = 0;
  for (const response of [new Response(JSON.stringify({ ...budget, total_count: 2 })),
    new Response('unavailable', { status: 503 }), new Response(' '.repeat(2 * 1024 * 1024 + 1))])
    await assert.rejects(guardedFullDumpContinuation({ env: env(), git: fixtureGit(), fetcher: async () => response,
      acquire: async () => { calls++; }, outputDirectory: join(root, 'blocked') }), /full-continuation-/);
  assert.equal(calls, 0); assert.deepEqual(await readdir(root), []);
});

test('existing file, directory and dangling symlink refuse all Git/GitHub/provider network work', async t => {
  const root = await directory(t);
  await mkdir(join(root, 'directory')); await writeFile(join(root, 'file'), 'retained ciphertext');
  await symlink(join(root, 'missing'), join(root, 'link'));
  let calls = 0;
  for (const name of ['directory', 'file', 'link']) await assert.rejects(guardedFullDumpContinuation({ env: env(),
    git: async () => { calls++; }, fetcher: async () => { calls++; }, acquire: async () => { calls++; },
    outputDirectory: join(root, name) }), /full-continuation-output-exists/);
  assert.equal(calls, 0); assert.equal(await readFile(join(root, 'file'), 'utf8'), 'retained ciphertext');
});

test('exclusive claim closes an output race before provider collection', async t => {
  const root = await directory(t), outputDirectory = join(root, 'claimed'); let calls = 0;
  await assert.rejects(guardedFullDumpContinuation({ env: env(), git: fixtureGit(), outputDirectory,
    fetcher: async () => { await mkdir(outputDirectory); return fetcher(); }, acquire: async () => { calls++; } }), { code: 'EEXIST' });
  assert.equal(calls, 0); assert.deepEqual(await readdir(outputDirectory), []);
});

test('guarded collection passes unchanged 110-minute bounds and publishes one private ciphertext', async t => {
  const root = await directory(t), outputDirectory = join(root, 'success'); let calls = 0;
  const result = await guardedFullDumpContinuation({ env: env(), git: fixtureGit(), fetcher: async (url, options) => {
    assert.equal(new URL(url).pathname, `/repos/Kajooja/Kajo/actions/workflows/${FULL_CONTINUATION_WORKFLOW_FILE}/runs`);
    assert.equal(new URL(url).searchParams.get('branch'), FULL_CONTINUATION_REQUEST_BRANCH);
    assert.equal(options.redirect, 'error'); return fetcher();
  }, outputDirectory, acquire: async options => {
    calls++; assert.deepEqual(options, { release: request.release, roster: request.roster,
      sourcePins: request.sourcePins, sourceEvidence: request.sourceEvidence, limits: request.limits });
    assert.equal(options.limits.timeoutMs, 110 * 60 * 1000);
    assert.equal((await stat(outputDirectory)).mode & 0o077, 0); assert.deepEqual(await readdir(outputDirectory), []);
    return collected();
  } });
  assert.equal(calls, 1); assert.equal(result.maximumMetadataRequests, 0);
  assert.equal(result.maximumAcceptedCompressedBytes, 16644821648); assert.equal(result.targets, 383);
  assert.equal(result.approved, 0); assert.equal(result.databaseWrites, 0);
  assert.deepEqual(await readdir(outputDirectory), [FULL_CONTINUATION_ARTIFACT_FILE]);
  const path = join(outputDirectory, FULL_CONTINUATION_ARTIFACT_FILE), bytes = await readFile(path, 'utf8');
  const envelope = JSON.parse(bytes);
  assert.equal(envelope.header.requestSha256, request.requestSha256);
  assert.equal(envelope.header.recipientFingerprint, request.recipientFingerprint);
  assert.equal(envelope.header.plaintextSha256, sha256(JSON.stringify(collected())));
  assert.equal((await stat(path)).mode & 0o077, 0);
  assert.ok(!bytes.includes(canary)); assert.ok(!JSON.stringify(result).includes(canary));
});

test('real Work identity failure prevents Edition and seals only v2 evidence behind a fixed public error', async t => {
  const root = await directory(t), outputDirectory = join(root, 'failed'), githubOutput = join(root, 'step-output'), calls = [];
  const selected = request.roster[0], key = `/works/${selected.workId}`;
  const raw = ['/type/work', key, '1', '2026-08-15T10:00:00', JSON.stringify({ key, type: { key: '/type/work' },
    location: null, description: canary })].join('\t') + '\n';
  const body = gzipSync(raw); let accounting;
  await assert.rejects(guardedFullDumpContinuation({ env: { ...env(), GITHUB_OUTPUT: githubOutput }, git: fixtureGit(), fetcher,
    outputDirectory, acquire: async options => {
      try { return await acquireReviewedOpenLibraryDumps({ ...options, transport: async url => {
        calls.push(url); return { status: 200, headers: {}, body: Readable.from([body]) };
      } }); } catch (error) { accounting = error.accounting; throw error; }
    } }), error => { assert.equal(error.message, 'full-continuation-failed');
    assert.deepEqual(Object.getOwnPropertyNames(error).sort(), ['message', 'stack']); assert.ok(!error.stack.includes(canary)); return true; });
  assert.deepEqual(calls, [request.sourcePins.works.url]);
  assert.deepEqual(accounting.requests, { metadata: 0, works: 1, editions: 0 });
  assert.equal(accounting.failureEvidence.contract, 'open-library-selected-row-failure-evidence-v2');
  assert.equal(await readFile(githubOutput, 'utf8'), 'sealed=true\n');
  const bytes = await readFile(join(outputDirectory, FULL_CONTINUATION_ARTIFACT_FILE), 'utf8');
  assert.equal(JSON.parse(bytes).header.payloadKind, 'failure'); assert.ok(!bytes.includes(canary));
  assert.ok(!bytes.includes('record-location-mismatch')); assert.ok(!bytes.includes(accounting.failureEvidence.rawBase64));
});

test('Edition failure discards prior Work candidates and seals bounded pinned-source evidence', async t => {
  const root = await directory(t), outputDirectory = join(root, 'edition-failed'), expected = request.roster[0];
  const key = `/books/${expected.editionId}`;
  const raw = Buffer.from(['/type/edition', key, '1', '2026-08-15T10:00:00', JSON.stringify({ key,
    type: { key: '/type/edition' }, location: null, works: [{ key: `/works/${expected.workId}` }], description: canary })].join('\t'));
  const evidence = createDumpFailureEvidence({ rowBytes: raw, terminated: true, sourceKind: 'editions',
    source: request.sourcePins.editions, roster: request.roster, expected, row: 1, fetchedAt: at,
    predicate: 'record-location-mismatch', limits: request.limits });
  const failure = new Error('provider-identity-mismatch');
  failure.accounting = { startedAt: at, failedAt: at, activeSource: 'editions',
    requests: { metadata: 0, works: 1, editions: 1 }, metadata: { bytes: 0, complete: false, skipped: true },
    sources: { works: { bytes: request.sourcePins.works.bytes, complete: true, publisherChecksumsVerified: true },
      editions: { bytes: 500, decodedBytes: raw.length + 1, rows: 1, matchedRecords: 0,
        unrelatedRows: 0, malformedUnrelatedRows: 0, complete: false, expectedBytes: request.sourcePins.editions.bytes } },
    failureEvidence: evidence, diagnosticRetainedBytes: raw.length, retainedRecordBytes: 200,
    individualProviderRequests: 0, databaseWrites: 0 };
  // Throwing a receipt cannot smuggle a previously held Work record into the
  // failure result: the runner constructs only the declared failure contract.
  failure.records = [{ raw: 'PRIOR WORK CANDIDATE' }];
  await assert.rejects(guardedFullDumpContinuation({ env: env(), git: fixtureGit(), fetcher, outputDirectory,
    acquire: async () => { throw failure; } }), /full-continuation-failed/);
  const bytes = await readFile(join(outputDirectory, FULL_CONTINUATION_ARTIFACT_FILE), 'utf8'), header = JSON.parse(bytes).header;
  assert.equal(header.payloadKind, 'failure'); assert.ok(!bytes.includes(canary)); assert.ok(!bytes.includes('PRIOR WORK CANDIDATE'));
  assert.deepEqual(await readdir(outputDirectory), [FULL_CONTINUATION_ARTIFACT_FILE]);
});

test('self-location reaches the EOF guard and never permits a short synthetic Work source', async t => {
  const root = await directory(t), expected = request.roster[0], key = `/works/${expected.workId}`, calls = [];
  const record = { key, type: { key: '/type/work' }, location: key, description: canary };
  assert.equal(inspectRecord(JSON.stringify(record), expected, 'work', at).status, 'found');
  const body = gzipSync(['/type/work', key, '1', '2026-08-15T10:00:00', JSON.stringify(record)].join('\t') + '\n');
  let code;
  await assert.rejects(guardedFullDumpContinuation({ env: env(), git: fixtureGit(), fetcher, outputDirectory: join(root, 'short'),
    acquire: async options => {
      try { return await acquireReviewedOpenLibraryDumps({ ...options, transport: async url => {
        calls.push(url); return { status: 200, headers: {}, body: Readable.from([body]) };
      } }); } catch (error) { code = error.message; throw error; }
    } }), /full-continuation-failed/);
  assert.equal(code, 'dump-file-size-mismatch'); assert.deepEqual(calls, [request.sourcePins.works.url]);
  assert.deepEqual(await readdir(join(root, 'short')), [FULL_CONTINUATION_ARTIFACT_FILE]);
});

test('unknown collector failure cannot fabricate accounting or expose private exception text', async t => {
  const root = await directory(t), outputDirectory = join(root, 'unknown');
  await assert.rejects(guardedFullDumpContinuation({ env: env(), git: fixtureGit(), fetcher, outputDirectory,
    acquire: async () => { throw new Error(canary); } }), error => {
    assert.equal(error.message, 'full-continuation-failed'); assert.ok(!error.stack.includes(canary)); return true;
  });
  assert.deepEqual(await readdir(outputDirectory), []);
});

test('CLI cannot activate outside Actions and emits one fixed sanitized line', async t => {
  const root = await directory(t);
  // Do not inherit the outer CI's GITHUB_ACTIONS or attempt/source variables.
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./run-full-dump-continuation.mjs', import.meta.url)), join(root, 'blocked')],
    { env: { PATH: process.env.PATH, GITHUB_ACTIONS: 'false' }, encoding: 'utf8' });
  assert.equal(child.status, 1); assert.equal(child.stdout, '');
  assert.equal(child.stderr, '{"status":"failed","code":"full-continuation-failed"}\n');
  assert.deepEqual(await readdir(root), []);
});

test('workflow exposes only the fixed push, read permissions, accepted checkout and ciphertext upload', async () => {
  const workflow = await readFile(new URL(`../../.github/workflows/${FULL_CONTINUATION_WORKFLOW_FILE}`, import.meta.url), 'utf8');
  assert.match(workflow, /branches: \[catalog-acquisition\/ol-20260831-continuation\]/);
  assert.match(workflow, /paths: \[scripts\/catalog\/requests\/ol-20260831-continuation.json\]/);
  assert.doesNotMatch(workflow, /workflow_dispatch|schedule:|pull_request:|permissions: write|contents: write|actions: write/);
  assert.match(workflow, /permissions:\n  contents: read\n  actions: read/);
  assert.match(workflow, /timeout-minutes: 120/); assert.match(workflow, /ref: main/);
  assert.match(workflow, /fetch-depth: 0/); assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /npm ci .*--ignore-scripts/); assert.match(workflow, /if: always\(\) && steps.collect.outputs.sealed == 'true'/);
  assert.match(workflow, /open-library-continuation-20260831\.sealed\.json/);
});
