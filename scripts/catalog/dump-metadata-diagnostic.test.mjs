import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { inspectOpenLibraryDumpMetadata } from './acquire-open-library-dumps.mjs';
import { digest, sha256 } from './open-library-descriptions.mjs';
import { prepareMetadataDiagnosticRequest } from './prepare-dump-metadata-diagnostic.mjs';
import { guardedMetadataDiagnostic, validateDiagnosticCommit, validateDiagnosticRunBudget } from './run-dump-metadata-diagnostic.mjs';
import { DIAGNOSTIC_BRANCH, DIAGNOSTIC_LIMITS, DIAGNOSTIC_PREVIOUS_ACQUISITION,
  DIAGNOSTIC_REQUEST_CONTRACT, DIAGNOSTIC_REQUEST_PATH, REQUEST_CONTRACT, REQUEST_LIMITS, REQUEST_PATH, recipientFingerprint,
  unsealMetadataDiagnostic, validateMetadataDiagnosticRequest } from './seal-dump-acquisition.mjs';

const keys = generateKeyPairSync('rsa', { modulusLength: 3072,
  publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const sourceHead = 'a'.repeat(40), requestHead = 'b'.repeat(40);
const body = { contract: DIAGNOSTIC_REQUEST_CONTRACT, purpose: 'metadata-only-failure-diagnosis',
  release: '2026-08-31', sourceHead, limits: { ...DIAGNOSTIC_LIMITS },
  recipientPublicKey: keys.publicKey, recipientFingerprint: recipientFingerprint(keys.publicKey),
  previousAcquisition: { ...DIAGNOSTIC_PREVIOUS_ACQUISITION } };
const request = { ...body, requestSha256: digest(body) };
// The runner reads this binding only from the fixed predecessor Git object.
const previousRequest = { sourceHead: DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead,
  requestSha256: DIAGNOSTIC_PREVIOUS_ACQUISITION.requestSha256,
  recipientPublicKey: keys.publicKey, recipientFingerprint: request.recipientFingerprint };
const budget = { total_count: 1, workflow_runs: [{ id: 100, head_branch: DIAGNOSTIC_BRANCH, run_attempt: 1 }] };
const env = () => ({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Kajooja/Kajo', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '100', GITHUB_EVENT_NAME: 'push', GITHUB_REF: `refs/heads/${DIAGNOSTIC_BRANCH}`,
  GITHUB_SHA: requestHead, DIAGNOSTIC_GITHUB_TOKEN: 'fixture-read-only-token' });
const fetcher = async () => new Response(JSON.stringify(budget));
const canary = 'PRIVATE metadata evidence must not appear in runner output or its ciphertext artifact';
function metadata(valid) {
  return Buffer.from(JSON.stringify({ privateCanary: canary,
    metadata: { identifier: `ol_dump_${request.release}` }, files: valid ? ['works', 'editions'].map(kind => ({
      name: `ol_dump_${kind}_${request.release}.txt.gz`, size: '100', md5: 'a'.repeat(32), sha1: 'b'.repeat(40),
    })) : [] }));
}
function fixtureGit() {
  let previousFetched = false;
  return async args => {
    if (args[0] === 'fetch') {
      if (args[3] === DIAGNOSTIC_PREVIOUS_ACQUISITION.requestHead) previousFetched = true;
      else assert.equal(args[3], `refs/heads/${DIAGNOSTIC_BRANCH}`);
      return '';
    }
    if (args[0] === 'rev-parse') return (args[1] === 'FETCH_HEAD' ? requestHead : sourceHead) + '\n';
    if (args[0] === 'show' && args[1] === '-s') return sourceHead + '\n';
    if (args[0] === 'show') {
      if (args[1] === `${DIAGNOSTIC_PREVIOUS_ACQUISITION.requestHead}:${REQUEST_PATH}`) {
        assert.equal(previousFetched, true, 'fresh runner must explicitly fetch the unmerged predecessor');
        return JSON.stringify(previousRequest);
      }
      assert.equal(args[1], `${requestHead}:${DIAGNOSTIC_REQUEST_PATH}`);
      return JSON.stringify(request);
    }
    if (args[0] === 'diff') return `A\t${DIAGNOSTIC_REQUEST_PATH}\n`;
    throw new Error('Unexpected Git fixture');
  };
}
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'kajo-metadata-diagnostic-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
const inspection = (raw, calls) => options => inspectOpenLibraryDumpMetadata({ ...options,
  transport: async url => {
    calls.push(url);
    assert.equal(url, 'https://archive.org/metadata/ol_dump_2026-08-31');
    return { status: 200, headers: {}, body: Readable.from([raw]) };
  } });

test('diagnostic request binds a distinct purpose, exact old evidence and one bounded metadata request', () => {
  assert.equal(validateMetadataDiagnosticRequest(request), request);
  assert.equal(request.roster, undefined);
  assert.deepEqual(request.limits, { metadataBytes: 2097152, timeoutMs: 30000, maxRedirects: 0 });
  for (const change of [value => { value.purpose = 'retry'; }, value => { value.limits.maxRedirects = 1; },
    value => { value.limits.timeoutMs++; }, value => { value.previousAcquisition.artifactZipSha256 = '0'.repeat(64); },
    value => { value.previousAcquisition.sealedArtifactSha256 = '0'.repeat(64); },
    value => { value.previousAcquisition.metadataSha256 = '0'.repeat(64); },
    value => { value.roster = []; }]) {
    const changed = structuredClone(body); change(changed);
    assert.throws(() => validateMetadataDiagnosticRequest({ ...changed, requestSha256: digest(changed) }),
      /invalid-metadata-diagnostic-request/);
  }
  // Preparation must reject a reconstructed/noncanonical predecessor rather
  // than trusting copied hash fields supplied by a caller.
  assert.throws(() => prepareMetadataDiagnosticRequest(previousRequest, sourceHead), /invalid-acquisition-request/);
  const unrelated = { contract: REQUEST_CONTRACT, release: request.release,
    sourceHead: DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead, limits: { ...REQUEST_LIMITS },
    roster: [{ workId: 'OL123W', editionId: 'OL456M' }], recipientPublicKey: keys.publicKey,
    recipientFingerprint: request.recipientFingerprint };
  assert.throws(() => prepareMetadataDiagnosticRequest({ ...unrelated, requestSha256: digest(unrelated) }, sourceHead),
    /metadata-diagnostic-previous-request-mismatch/);
});

test('only one added request on the exact accepted parent and the original recipient passes', () => {
  const input = { sourceHead, requestHead, parents: sourceHead,
    changes: `A\t${DIAGNOSTIC_REQUEST_PATH}\n`, request, previousRequest };
  assert.equal(validateDiagnosticCommit(input), request);
  for (const change of [{ parents: `${sourceHead} ${requestHead}` }, { sourceHead: 'c'.repeat(40) },
    { changes: `M\t${DIAGNOSTIC_REQUEST_PATH}\n` },
    { changes: `A\t${DIAGNOSTIC_REQUEST_PATH}\nM\t.github/workflows/catalog-book-metadata-diagnostic.yml\n` },
    { previousRequest: { ...previousRequest, requestSha256: '0'.repeat(64) } },
    { previousRequest: { ...previousRequest, recipientPublicKey: 'different recipient' } }])
    assert.throws(() => validateDiagnosticCommit({ ...input, ...change }), /metadata-diagnostic-/);
});

test('any prior diagnostic run, including canceled or failed preflight, consumes this distinct budget', () => {
  assert.doesNotThrow(() => validateDiagnosticRunBudget(budget, '100'));
  for (const document of [{ total_count: 2, workflow_runs: [...budget.workflow_runs,
    { id: 99, head_branch: DIAGNOSTIC_BRANCH, run_attempt: 1, conclusion: 'cancelled' }] },
  { total_count: 1, workflow_runs: [{ ...budget.workflow_runs[0], run_attempt: 2 }] },
  { total_count: 1, workflow_runs: [{ ...budget.workflow_runs[0], id: 99 }] },
  { total_count: 1, workflow_runs: [{ ...budget.workflow_runs[0], head_branch: 'catalog-acquisition/ol-20260831' }] },
  { total_count: 101, workflow_runs: budget.workflow_runs }, { total_count: 0, workflow_runs: [] }])
    assert.throws(() => validateDiagnosticRunBudget(document, '100'), /metadata-diagnostic-request-consumed/);
});

test('event, source, tree and spent-budget gates reject before any publisher call', async t => {
  const root = await directory(t); let calls = 0;
  const inspect = async () => { calls++; throw new Error(canary); };
  for (const changes of [{ GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_EVENT_NAME: 'workflow_dispatch' },
    { GITHUB_REF: 'refs/heads/catalog-acquisition/ol-20260831' }, { GITHUB_SHA: 'c'.repeat(40) }])
    await assert.rejects(guardedMetadataDiagnostic({ env: { ...env(), ...changes }, git: fixtureGit(),
      fetcher, inspect, outputDirectory: join(root, 'blocked') }), /metadata-diagnostic-/);
  const git = fixtureGit();
  await assert.rejects(guardedMetadataDiagnostic({ env: env(),
    git: args => args[0] === 'diff' ? `M\t${DIAGNOSTIC_REQUEST_PATH}\n` : git(args), fetcher, inspect,
    outputDirectory: join(root, 'tree') }), /metadata-diagnostic-request-tree-mismatch/);
  await assert.rejects(guardedMetadataDiagnostic({ env: env(), git: fixtureGit(), inspect,
    fetcher: async () => new Response(JSON.stringify({ total_count: 2, workflow_runs: budget.workflow_runs })),
    outputDirectory: join(root, 'spent') }), /metadata-diagnostic-request-consumed/);
  assert.equal(calls, 0);
  assert.deepEqual(await readdir(root), []);
});

test('GitHub budget response has a separate bounded read and checks only diagnostic workflow runs', async t => {
  const root = await directory(t); let inspected = false;
  await assert.rejects(guardedMetadataDiagnostic({ env: env(), git: fixtureGit(),
    inspect: async () => { inspected = true; }, outputDirectory: join(root, 'bounded'),
    fetcher: async (url, options) => {
      assert.ok(url.includes('/catalog-book-metadata-diagnostic.yml/runs?branch=catalog-diagnostic%2Fol-20260831'));
      assert.equal(options.redirect, 'error');
      return new Response(' '.repeat(2 * 1024 * 1024 + 1));
    } }), /metadata-diagnostic-github-check-failed/);
  assert.equal(inspected, false);
});

test('valid and invalid metadata both stop after one GET and preserve exact evidence solely in ciphertext', async t => {
  const root = await directory(t);
  for (const valid of [true, false]) {
    const raw = metadata(valid), calls = [], outputDirectory = join(root, String(valid));
    const result = await guardedMetadataDiagnostic({ env: env(), git: fixtureGit(), fetcher,
      inspect: inspection(raw, calls), outputDirectory });
    assert.equal(result.status, 'sealed');
    assert.equal(result.maximumDumpRequests, 0);
    assert.deepEqual(calls, ['https://archive.org/metadata/ol_dump_2026-08-31']);
    assert.deepEqual(await readdir(outputDirectory), ['open-library-metadata-20260831.sealed.json']);
    const file = join(outputDirectory, 'open-library-metadata-20260831.sealed.json');
    const bytes = await readFile(file, 'utf8');
    assert.ok(!bytes.includes(canary) && !bytes.includes(raw.toString('base64')));
    assert.ok(!JSON.stringify(result).includes(canary));
    const recovered = unsealMetadataDiagnostic(JSON.parse(bytes), request, keys.privateKey);
    assert.equal(recovered.status, 'inspected');
    assert.equal(recovered.validation.valid, valid);
    assert.equal(recovered.validation.code, valid ? null : 'invalid-acquisition-source-count');
    assert.equal(recovered.metadata.sha256, sha256(raw));
    assert.deepEqual(Buffer.from(recovered.metadata.rawBase64, 'base64'), raw);
    assert.deepEqual(recovered.accounting.requests, { metadata: 1, works: 0, editions: 0 });
    assert.equal(recovered.approved, 0);
    assert.equal(recovered.databaseWrites, 0);
    assert.equal((await stat(file)).mode & 0o077, 0);
    assert.equal((await stat(outputDirectory)).mode & 0o077, 0);
  }
});

test('partial transport failure seals accounting before returning only a generic public failure', async t => {
  const root = await directory(t), outputDirectory = join(root, 'partial'), output = join(root, 'outputs');
  const partial = Buffer.from('partial private metadata');
  await assert.rejects(guardedMetadataDiagnostic({ env: { ...env(), GITHUB_OUTPUT: output }, git: fixtureGit(),
    fetcher, outputDirectory, inspect: options => inspectOpenLibraryDumpMetadata({ ...options,
      transport: async () => ({ status: 200, headers: {}, body: Readable.from((async function* () {
        yield partial; throw new Error(canary);
      })()) }) }) }), error => {
    assert.equal(error.message, 'metadata-diagnostic-failed'); return true;
  });
  assert.equal(await readFile(output, 'utf8'), 'sealed=true\n');
  const bytes = await readFile(join(outputDirectory, 'open-library-metadata-20260831.sealed.json'), 'utf8');
  assert.ok(!bytes.includes(canary));
  const recovered = unsealMetadataDiagnostic(JSON.parse(bytes), request, keys.privateKey);
  assert.equal(recovered.status, 'failed');
  assert.equal(recovered.code, 'acquisition-failed');
  assert.equal(recovered.accounting.metadata.bytes, partial.length);
  assert.equal(recovered.accounting.metadata.complete, false);
  assert.equal(recovered.accounting.metadata.rawBase64, undefined);
  assert.deepEqual(recovered.accounting.requests, { metadata: 1, works: 0, editions: 0 });
});

test('local CLI recovery marks a changed metadata body as new evidence and preserves private permissions', async t => {
  const root = await directory(t), outputDirectory = join(root, 'sealed'), keyDir = join(root, 'keys');
  await mkdir(keyDir, { mode: 0o700 });
  await writeFile(join(keyDir, 'recipient-private.pem'), keys.privateKey, { mode: 0o600 });
  const requestPath = join(root, 'request.json');
  await writeFile(requestPath, JSON.stringify(request));
  const raw = metadata(false);
  await guardedMetadataDiagnostic({ env: env(), git: fixtureGit(), fetcher,
    inspect: inspection(raw, []), outputDirectory });
  const args = [fileURLToPath(new URL('./prepare-dump-metadata-diagnostic.mjs', import.meta.url)), 'unseal',
    '--request', requestPath, '--key-dir', keyDir, '--input',
    join(outputDirectory, 'open-library-metadata-20260831.sealed.json'), '--out', join(root, 'recovered')];
  const childEnv = { ...process.env }; delete childEnv.GITHUB_ACTIONS;
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: childEnv });
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.bodyMatchesPrevious, false);
  assert.equal(summary.metadataSha256, sha256(raw));
  assert.equal(summary.diagnosticStatus, 'inspected');
  assert.ok(!result.stdout.includes(canary));
  const privateFile = join(root, 'recovered', 'metadata-diagnostic.json');
  assert.equal((await stat(privateFile)).mode & 0o077, 0);
  assert.deepEqual(Buffer.from(JSON.parse(await readFile(privateFile)).metadata.rawBase64, 'base64'), raw);
  const repeat = spawnSync(process.execPath, args, { encoding: 'utf8', env: childEnv });
  assert.equal(repeat.status, 1);
  assert.deepEqual(JSON.parse(repeat.stderr), { status: 'failed', code: 'metadata-diagnostic-local-operation-failed' });
});

test('workflow activates only the dedicated request and uploads one encrypted result', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/catalog-book-metadata-diagnostic.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes(`branches: [${DIAGNOSTIC_BRANCH}]`));
  assert.ok(workflow.includes(`paths: [${DIAGNOSTIC_REQUEST_PATH}]`));
  assert.ok(workflow.includes('ref: main') && workflow.includes('persist-credentials: false'));
  assert.ok(workflow.includes('actions: read') && workflow.includes('contents: read'));
  assert.ok(workflow.includes('steps.diagnose.outputs.sealed') && workflow.includes('open-library-metadata-20260831.sealed.json'));
  assert.ok(!/workflow_dispatch|pull_request|secrets\.|acquire-open-library-dumps\.mjs/.test(workflow));
});
