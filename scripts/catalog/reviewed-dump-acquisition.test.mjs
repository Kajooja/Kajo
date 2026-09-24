import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { ACQUISITION_CONTRACT, ACQUISITION_LIMITS, REVIEWED_ACQUISITION_LIMITS,
  REVIEWED_SOURCE_EVIDENCE, REVIEWED_SOURCE_PINS, acquireReviewedOpenLibraryDumps } from './acquire-open-library-dumps.mjs';
import { digest } from './open-library-descriptions.mjs';
import { prepareReviewedAcquisitionRequest } from './prepare-reviewed-dump-acquisition.mjs';
import { guardedReviewedAcquisition, validateReviewedCommit, validateReviewedRunBudget } from './run-reviewed-dump-acquisition.mjs';
import { DIAGNOSTIC_LIMITS, DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_CONTRACT, DIAGNOSTIC_REQUEST_PATH, FAILURE_CONTRACT, REQUEST_CONTRACT,
  REQUEST_LIMITS, REQUEST_PATH, REVIEWED_PREVIOUS_DIAGNOSTIC, REVIEWED_REQUEST_BRANCH, REVIEWED_REQUEST_CONTRACT,
  REVIEWED_REQUEST_PATH, REVIEWED_REQUEST_PURPOSE, recipientFingerprint, sealReviewedAcquisition,
  unsealReviewedAcquisition, validateAcquisitionRequest, validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';

const keys = generateKeyPairSync('rsa', { modulusLength: 3072,
  publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const sourceHead = 'a'.repeat(40), requestHead = 'b'.repeat(40);
const roster = [{ workId: 'OL123W', editionId: 'OL456M' }];
const body = { contract: REVIEWED_REQUEST_CONTRACT, purpose: REVIEWED_REQUEST_PURPOSE, release: '2026-08-31',
  sourceHead, roster, limits: { ...REVIEWED_ACQUISITION_LIMITS }, sourcePins: structuredClone(REVIEWED_SOURCE_PINS),
  sourceEvidence: { ...REVIEWED_SOURCE_EVIDENCE }, previousAcquisition: { ...DIAGNOSTIC_PREVIOUS_ACQUISITION },
  previousDiagnostic: { ...REVIEWED_PREVIOUS_DIAGNOSTIC }, recipientPublicKey: keys.publicKey,
  recipientFingerprint: recipientFingerprint(keys.publicKey) };
const request = { ...body, requestSha256: digest(body) };
// Production fetches these from fixed, already accepted Git objects. The
// synthetic transport supplies matching identities without real source calls.
const previousRequest = { sourceHead: DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead,
  requestSha256: DIAGNOSTIC_PREVIOUS_ACQUISITION.requestSha256, roster,
  recipientPublicKey: keys.publicKey, recipientFingerprint: request.recipientFingerprint };
const diagnosticRequest = { sourceHead: REVIEWED_PREVIOUS_DIAGNOSTIC.sourceHead,
  requestSha256: REVIEWED_PREVIOUS_DIAGNOSTIC.requestSha256,
  recipientPublicKey: keys.publicKey, recipientFingerprint: request.recipientFingerprint };
const env = () => ({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Kajooja/Kajo', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '100', GITHUB_EVENT_NAME: 'push', GITHUB_REF: `refs/heads/${REVIEWED_REQUEST_BRANCH}`,
  GITHUB_SHA: requestHead, REVIEWED_GITHUB_TOKEN: 'fixture-read-only-token' });
const budget = { total_count: 1, workflow_runs: [{ id: 100, head_branch: REVIEWED_REQUEST_BRANCH, run_attempt: 1 }] };
const fetcher = async () => new Response(JSON.stringify(budget));
function fixtureGit() {
  const fetched = new Set();
  return async args => {
    if (args[0] === 'fetch') { fetched.add(args[3]); return ''; }
    if (args[0] === 'rev-parse') return (args[1] === 'FETCH_HEAD' ? requestHead : sourceHead) + '\n';
    if (args[0] === 'show' && args[1] === '-s') return sourceHead + '\n';
    if (args[0] === 'show') {
      for (const [head, path, value] of [[DIAGNOSTIC_PREVIOUS_ACQUISITION.requestHead, REQUEST_PATH, previousRequest],
        [REVIEWED_PREVIOUS_DIAGNOSTIC.requestHead, DIAGNOSTIC_REQUEST_PATH, diagnosticRequest]]) {
        if (args[1] === `${head}:${path}`) { assert.ok(fetched.has(head)); return JSON.stringify(value); }
      }
      assert.equal(args[1], `${requestHead}:${REVIEWED_REQUEST_PATH}`); return JSON.stringify(request);
    }
    if (args[0] === 'diff') return `A\t${REVIEWED_REQUEST_PATH}\n`;
    throw new Error('Unexpected Git fixture');
  };
}
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'kajo-reviewed-acquisition-'));
  t.after(() => rm(path, { recursive: true, force: true })); return path;
}
const canary = 'PRIVATE selected unapproved record must not appear in artifacts or logs';
function collected() {
  return { contract: ACQUISITION_CONTRACT, status: 'collected', release: request.release,
    rosterSha256: digest(roster), limits: request.limits, sourceEvidence: request.sourceEvidence,
    approved: 0, databaseWrites: 0, individualProviderRequests: 0, rights: 'unreviewed',
    records: [{ ...roster[0], work: { raw: canary }, edition: null }],
    sources: Object.fromEntries(Object.entries(REVIEWED_SOURCE_PINS).map(([kind, pin]) => [kind,
      { ...pin, sha256: 'c'.repeat(64), complete: true, publisherChecksumsVerified: true }])),
    accounting: { metadata: { bytes: 0, complete: false, skipped: true }, requests: { metadata: 0, works: 1, editions: 1 },
      retainedRecordBytes: 100, individualProviderRequests: 0, databaseWrites: 0 }, coverage: { found: 1, missing: 1 } };
}

test('new request fixes exact pins, diagnosed provenance and byte ceiling without altering old limits', () => {
  assert.equal(validateReviewedAcquisitionRequest(request), request);
  assert.equal(ACQUISITION_LIMITS.totalCompressedBytes, 15000000000);
  assert.equal(REQUEST_LIMITS.totalCompressedBytes, 15000000000);
  assert.equal(request.limits.totalCompressedBytes, 16644821648);
  assert.equal(request.sourcePins.works.bytes + request.sourcePins.editions.bytes, request.limits.totalCompressedBytes);
  for (const change of [value => { value.limits.totalCompressedBytes++; }, value => { value.limits.retainedBytes++; },
    value => { value.sourcePins.works.md5 = '0'.repeat(32); }, value => { value.sourcePins.editions.bytes--; },
    value => { value.previousDiagnostic.sealedArtifactSha256 = '0'.repeat(64); },
    value => { value.sourceEvidence.metadataSha256 = '0'.repeat(64); }, value => { value.purpose = 'retry'; }]) {
    const changed = structuredClone(body); change(changed);
    assert.throws(() => validateReviewedAcquisitionRequest({ ...changed, requestSha256: digest(changed) }),
      /invalid-reviewed-acquisition-request/);
  }
  assert.throws(() => validateAcquisitionRequest(request), /invalid-acquisition-request/);
});

test('local preparation rejects a valid but unrelated predecessor before trusting plaintext diagnosis', () => {
  const oldBody = { contract: REQUEST_CONTRACT, release: request.release, sourceHead: previousRequest.sourceHead,
    roster, limits: { ...REQUEST_LIMITS }, recipientPublicKey: keys.publicKey, recipientFingerprint: request.recipientFingerprint };
  const oldRequest = { ...oldBody, requestSha256: digest(oldBody) };
  const diagnosticBody = { contract: DIAGNOSTIC_REQUEST_CONTRACT, purpose: 'metadata-only-failure-diagnosis',
    release: request.release, sourceHead: diagnosticRequest.sourceHead, limits: { ...DIAGNOSTIC_LIMITS },
    previousAcquisition: { ...DIAGNOSTIC_PREVIOUS_ACQUISITION }, recipientPublicKey: keys.publicKey,
    recipientFingerprint: request.recipientFingerprint };
  assert.throws(() => prepareReviewedAcquisitionRequest({ previousRequest: oldRequest,
    diagnosticRequest: { ...diagnosticBody, requestSha256: digest(diagnosticBody) }, sourceHead }),
  /reviewed-acquisition-predecessor-mismatch/);
});

test('exact child/tree, fixed predecessor roster, and both original recipients are bound before source access', () => {
  const input = { sourceHead, requestHead, parents: sourceHead, changes: `A\t${REVIEWED_REQUEST_PATH}\n`,
    request, previousRequest, diagnosticRequest };
  assert.equal(validateReviewedCommit(input), request);
  for (const change of [{ parents: `${sourceHead} ${requestHead}` }, { sourceHead: 'c'.repeat(40) },
    { changes: `M\t${REVIEWED_REQUEST_PATH}\n` }, { changes: `A\t${REVIEWED_REQUEST_PATH}\nM\tpackage.json\n` },
    { previousRequest: { ...previousRequest, roster: [{ workId: 'OL789W', editionId: 'OL789M' }] } },
    { previousRequest: { ...previousRequest, recipientPublicKey: 'changed' } },
    { diagnosticRequest: { ...diagnosticRequest, recipientFingerprint: '0'.repeat(64) } }])
    assert.throws(() => validateReviewedCommit({ ...input, ...change }), /reviewed-acquisition-/);
});

test('old workflow ledgers cannot substitute for the distinct one-shot reviewed budget', () => {
  assert.doesNotThrow(() => validateReviewedRunBudget(budget, '100'));
  for (const document of [{ total_count: 2, workflow_runs: [...budget.workflow_runs, { id: 99, conclusion: 'cancelled' }] },
    { total_count: 1, workflow_runs: [{ ...budget.workflow_runs[0], run_attempt: 2 }] },
    { total_count: 1, workflow_runs: [{ ...budget.workflow_runs[0], head_branch: 'catalog-acquisition/ol-20260831' }] },
    { total_count: 1, workflow_runs: [{ ...budget.workflow_runs[0], head_branch: 'catalog-diagnostic/ol-20260831' }] },
    { total_count: 0, workflow_runs: [] }])
    assert.throws(() => validateReviewedRunBudget(document, '100'), /reviewed-acquisition-request-consumed/);
});

test('event, modified tree and spent-budget failures make zero publisher requests', async t => {
  const root = await directory(t); let calls = 0;
  const acquire = async () => { calls++; throw new Error(canary); };
  for (const changes of [{ GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_EVENT_NAME: 'workflow_dispatch' },
    { GITHUB_REF: 'refs/heads/catalog-acquisition/ol-20260831' }, { GITHUB_SHA: 'c'.repeat(40) }])
    await assert.rejects(guardedReviewedAcquisition({ env: { ...env(), ...changes }, git: fixtureGit(), fetcher, acquire,
      outputDirectory: join(root, 'blocked') }), /reviewed-acquisition-/);
  const git = fixtureGit();
  await assert.rejects(guardedReviewedAcquisition({ env: env(), git: args => args[0] === 'diff'
    ? `M\t${REVIEWED_REQUEST_PATH}\n` : git(args), fetcher, acquire, outputDirectory: join(root, 'tree') }),
  /reviewed-acquisition-request-tree-mismatch/);
  await assert.rejects(guardedReviewedAcquisition({ env: env(), git: fixtureGit(), acquire,
    fetcher: async () => new Response(JSON.stringify({ total_count: 2, workflow_runs: budget.workflow_runs })),
    outputDirectory: join(root, 'spent') }), /reviewed-acquisition-request-consumed/);
  assert.equal(calls, 0); assert.deepEqual(await readdir(root), []);
});

test('guarded success passes only reviewed pins and emits one private ciphertext artifact', async t => {
  const root = await directory(t), outputDirectory = join(root, 'success'); let calls = 0;
  const result = await guardedReviewedAcquisition({ env: env(), git: fixtureGit(), fetcher, outputDirectory,
    acquire: async options => {
      calls++; assert.deepEqual(options, { release: request.release, roster, sourcePins: request.sourcePins,
        sourceEvidence: request.sourceEvidence, limits: request.limits }); return collected();
    } });
  assert.equal(calls, 1); assert.equal(result.maximumMetadataRequests, 0);
  assert.deepEqual(await readdir(outputDirectory), ['open-library-reviewed-20260831.sealed.json']);
  const path = join(outputDirectory, 'open-library-reviewed-20260831.sealed.json');
  const bytes = await readFile(path, 'utf8');
  assert.ok(!bytes.includes(canary)); assert.ok(!JSON.stringify(result).includes(canary));
  assert.deepEqual(unsealReviewedAcquisition(JSON.parse(bytes), request, keys.privateKey), collected());
  assert.equal((await stat(path)).mode & 0o077, 0);
  assert.equal((await stat(outputDirectory)).mode & 0o077, 0);
});

test('real reviewed core truncation records partial dump bytes with no metadata GET and seals failure only', async t => {
  const root = await directory(t), outputDirectory = join(root, 'failure'), output = join(root, 'outputs');
  const bytes = gzipSync(''), calls = [];
  await assert.rejects(guardedReviewedAcquisition({ env: { ...env(), GITHUB_OUTPUT: output }, git: fixtureGit(), fetcher,
    outputDirectory, acquire: options => acquireReviewedOpenLibraryDumps({ ...options, transport: async url => {
      calls.push(url); assert.equal(url, REVIEWED_SOURCE_PINS.works.url);
      return { status: 200, headers: {}, body: Readable.from([bytes]) };
    } }) }), error => { assert.equal(error.message, 'reviewed-acquisition-failed'); return true; });
  assert.deepEqual(calls, [REVIEWED_SOURCE_PINS.works.url]);
  assert.equal(await readFile(output, 'utf8'), 'sealed=true\n');
  const sealed = JSON.parse(await readFile(join(outputDirectory, 'open-library-reviewed-20260831.sealed.json')));
  const result = unsealReviewedAcquisition(sealed, request, keys.privateKey);
  assert.equal(result.contract, FAILURE_CONTRACT); assert.equal(result.status, 'failed');
  assert.equal(result.accounting.sources.works.bytes, bytes.length);
  assert.deepEqual(result.accounting.requests, { metadata: 0, works: 1, editions: 0 });
  assert.equal(result.accounting.metadata.skipped, true);
});

test('new envelopes reject changed source proofs, metadata fetches, ciphertext and request identities', () => {
  for (const change of [value => { value.sourceEvidence.metadataSha256 = '0'.repeat(64); },
    value => { value.sources.works.bytes--; }, value => { value.sources.editions.sha1 = '0'.repeat(40); },
    value => { value.accounting.requests.metadata = 1; }, value => { value.metadata = {}; },
    value => { value.approved = 1; }]) {
    const result = structuredClone(collected()); change(result);
    assert.throws(() => sealReviewedAcquisition(result, request), /invalid-(?:reviewed-)?acquisition/);
  }
  const overCap = structuredClone(collected());
  overCap.accounting.retainedRecordBytes = request.limits.retainedBytes + 1;
  assert.throws(() => sealReviewedAcquisition(overCap, request), /invalid-reviewed-acquisition-accounting/);
  const failure = { contract: FAILURE_CONTRACT, status: 'failed', release: request.release,
    rosterSha256: digest(roster), limits: request.limits, code: 'dump-staging-limit', accounting: overCap.accounting };
  assert.deepEqual(unsealReviewedAcquisition(sealReviewedAcquisition(failure, request), request, keys.privateKey), failure);
  const sealed = sealReviewedAcquisition(collected(), request);
  for (const change of [value => { value.header.requestSha256 = '0'.repeat(64); },
    value => { value.tag = Buffer.alloc(16).toString('base64'); }, value => { value.ciphertext = value.ciphertext.slice(0, -8); }]) {
    const mutated = structuredClone(sealed); change(mutated);
    assert.throws(() => unsealReviewedAcquisition(mutated, request, keys.privateKey), /(?:invalid-acquisition|acquisition-unseal-failed)/);
  }
});

test('workflow has a separate exact trigger, immutable actions, read-only token and ciphertext-only upload', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/catalog-book-reviewed-acquisition.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes(`branches: [${REVIEWED_REQUEST_BRANCH}]`));
  assert.ok(workflow.includes(`paths: [${REVIEWED_REQUEST_PATH}]`));
  assert.ok(workflow.includes('timeout-minutes: 120') && workflow.includes('ref: main'));
  assert.ok(workflow.includes('persist-credentials: false') && workflow.includes('actions: read') && workflow.includes('contents: read'));
  assert.ok(workflow.includes('steps.collect.outputs.sealed') && workflow.includes('open-library-reviewed-20260831.sealed.json'));
  assert.ok(!/workflow_dispatch|pull_request|secrets\.|run-dump-acquisition\.mjs/.test(workflow));
});
