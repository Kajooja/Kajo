import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { ACQUISITION_CONTRACT, acquireOpenLibraryDumps } from './acquire-open-library-dumps.mjs';
import { digest, sha256 } from './open-library-descriptions.mjs';
import { TARGET_CONTRACT } from './open-library-dump-descriptions.mjs';
import { prepareAcquisitionRequest, prepareRecipient } from './prepare-dump-acquisition-request.mjs';
import { guardedAcquisition, safePublicAcquisitionError, validateRequestCommit, validateRunBudget } from './run-dump-acquisition.mjs';
import { FAILURE_CONTRACT, REQUEST_BRANCH, REQUEST_PATH, recipientFingerprint, sealAcquisition,
  unsealAcquisition, validateAcquisitionRequest } from './seal-dump-acquisition.mjs';

const keys = generateKeyPairSync('rsa', { modulusLength: 3072,
  publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const at = '2026-09-24T09:00:00Z';
const sourceHead = 'a'.repeat(40), requestHead = 'b'.repeat(40);
const snapshot = { contract: TARGET_CONTRACT, checkedAt: at, targets: [{
  itemId: '00000000-0000-0000-0000-000000000001', sourceId: '00000000-0000-0000-0000-000000000002',
  workId: 'OL123W', editionId: 'OL456M', displayLanguage: 'fin', itemUpdatedAt: at, sourceUpdatedAt: at,
  descriptionSha256: null, managedDescription: false, identityMatches: true }] };
const request = prepareAcquisitionRequest(snapshot, sourceHead, keys.publicKey);
const secretText = 'UNAPPROVED private description canary. This sentence must never appear in a public artifact or failure log.';
function collected() {
  return { contract: ACQUISITION_CONTRACT, status: 'collected', release: request.release,
    rosterSha256: digest(request.roster), limits: request.limits, approved: 0, databaseWrites: 0,
    individualProviderRequests: 0, rights: 'unreviewed',
    records: [{ ...request.roster[0], work: { raw: secretText }, edition: null }],
    sources: { works: { complete: true, publisherChecksumsVerified: true },
      editions: { complete: true, publisherChecksumsVerified: true } }, coverage: { found: 1, missing: 1 } };
}
const env = () => ({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Kajooja/Kajo', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '100', GITHUB_EVENT_NAME: 'push', GITHUB_REF: `refs/heads/${REQUEST_BRANCH}`,
  GITHUB_SHA: requestHead, ACQUISITION_GITHUB_TOKEN: 'fixture-token' });
const budget = { total_count: 1, workflow_runs: [{ id: 100, head_branch: REQUEST_BRANCH, run_attempt: 1 }] };
const fetcher = async () => ({ ok: true, text: async () => JSON.stringify(budget) });
async function git(args) {
  if (args[0] === 'fetch') return '';
  if (args[0] === 'rev-parse') return (args[1] === 'FETCH_HEAD' ? requestHead : sourceHead) + '\n';
  if (args[0] === 'show' && args[1] === '-s') return sourceHead + '\n';
  if (args[0] === 'show') return JSON.stringify(request);
  if (args[0] === 'diff') return `A\t${REQUEST_PATH}\n`;
  throw new Error('Unexpected git fixture');
}
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'kajo-acquisition-envelope-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('public request exposes only exact provider pairs, reviewed source, caps and recipient key', () => {
  assert.deepEqual(request.roster, [{ workId: 'OL123W', editionId: 'OL456M' }]);
  assert.ok(!JSON.stringify(request).includes(snapshot.targets[0].itemId));
  assert.ok(!JSON.stringify(request).includes(snapshot.targets[0].sourceId));
  assert.ok(!JSON.stringify(request).includes('PRIVATE KEY'));
  assert.equal(request.recipientFingerprint, recipientFingerprint(keys.publicKey));
  assert.equal(validateAcquisitionRequest(request), request);
  for (const change of [value => { value.sourceHead = 'c'.repeat(40); },
    value => { value.limits.totalCompressedBytes += 1; }, value => { value.extra = 'private'; },
    value => { value.recipientFingerprint = '0'.repeat(64); }]) {
    const changed = structuredClone(request); change(changed);
    assert.throws(() => validateAcquisitionRequest(changed), /invalid-acquisition/);
  }
});

test('hybrid encryption roundtrips exact collected JSON without exposing selected source text', () => {
  const original = collected(), sealed = sealAcquisition(original, request);
  assert.ok(!JSON.stringify(sealed).includes(secretText));
  assert.deepEqual(unsealAcquisition(sealed, request, keys.privateKey), original);
  const second = sealAcquisition(original, request);
  assert.notEqual(second.iv, sealed.iv);
  assert.notEqual(second.ciphertext, sealed.ciphertext);
});

test('recipient, header, ciphertext and authentication tag changes fail closed', () => {
  const sealed = sealAcquisition(collected(), request);
  for (const change of [value => { value.header.sourceHead = 'c'.repeat(40); },
    value => { value.header.plaintextSha256 = '0'.repeat(64); },
    value => { value.tag = Buffer.alloc(16).toString('base64'); },
    value => { value.ciphertext = value.ciphertext.slice(0, -8); },
    value => { value.wrappedKey = Buffer.alloc(384).toString('base64'); },
    value => { value.header.payloadKind = 'failure'; }]) {
    const changed = structuredClone(sealed); change(changed);
    assert.throws(() => unsealAcquisition(changed, request, keys.privateKey), /(?:invalid-acquisition|acquisition-unseal-failed)/);
  }
  assert.throws(() => unsealAcquisition(sealed, request, 'not a key'), /acquisition-unseal-failed/);
});

test('incomplete source or changed target identity cannot be sealed as successful acquisition', () => {
  for (const change of [value => { value.sources.editions.complete = false; },
    value => { value.records[0].workId = 'OL999W'; }, value => { value.approved = 1; },
    value => { value.limits = { ...value.limits, timeoutMs: 1 }; }]) {
    const value = collected(); change(value);
    assert.throws(() => sealAcquisition(value, request), /invalid-acquisition-collected/);
  }
});

test('request must be sole added file on one child of the exact accepted source', () => {
  const input = { sourceHead, requestHead, parents: sourceHead, changes: `A\t${REQUEST_PATH}\n`, request };
  assert.equal(validateRequestCommit(input), request);
  for (const change of [{ parents: `${sourceHead} ${requestHead}` }, { sourceHead: 'c'.repeat(40) },
    { changes: `A\t${REQUEST_PATH}\nM\tscripts/catalog/run-dump-acquisition.mjs\n` },
    { changes: `M\t${REQUEST_PATH}\n` }]) {
    assert.throws(() => validateRequestCommit({ ...input, ...change }), /acquisition-(?:unreviewed-source|request-tree-mismatch)/);
  }
});

test('a previous run of any status consumes the one-shot branch budget', () => {
  assert.doesNotThrow(() => validateRunBudget(budget, '100'));
  for (const document of [{ total_count: 2, workflow_runs: [...budget.workflow_runs,
    { id: 99, head_branch: REQUEST_BRANCH, run_attempt: 1, conclusion: 'failure' }] },
  { total_count: 1, workflow_runs: [{ ...budget.workflow_runs[0], run_attempt: 2 }] },
  { total_count: 101, workflow_runs: budget.workflow_runs }, { total_count: 1, workflow_runs: [] },
  { total_count: 0, workflow_runs: [] }]) {
    assert.throws(() => validateRunBudget(document, '100'), /acquisition-(?:request-already-consumed|github-check-failed)/);
  }
});

test('rerun, unreviewed code and spent budget stop before the source transport is called', async t => {
  const root = await directory(t);
  let downloads = 0;
  const acquire = async () => { downloads++; throw new Error('Source transport must not run'); };
  await assert.rejects(guardedAcquisition({ env: { ...env(), GITHUB_RUN_ATTEMPT: '2' }, git, fetcher, acquire,
    outputDirectory: join(root, 'one') }), /acquisition-request-already-consumed/);
  await assert.rejects(guardedAcquisition({ env: env(),
    git: args => args[0] === 'diff' ? `M\t${REQUEST_PATH}\n` : git(args), fetcher, acquire,
    outputDirectory: join(root, 'two') }), /acquisition-request-tree-mismatch/);
  await assert.rejects(guardedAcquisition({ env: env(), git, acquire,
    fetcher: async () => ({ ok: true, text: async () => JSON.stringify({ total_count: 1,
      workflow_runs: [{ id: 99, head_branch: REQUEST_BRANCH, run_attempt: 1 }] }) }),
    outputDirectory: join(root, 'three') }), /acquisition-request-already-consumed/);
  assert.equal(downloads, 0);
  assert.deepEqual(await readdir(root), []);
});

test('successful guarded run writes exactly one private ciphertext artifact and never plaintext', async t => {
  const root = await directory(t), outputDirectory = join(root, 'output');
  const result = await guardedAcquisition({ env: env(), git, fetcher, acquire: async () => collected(), outputDirectory });
  assert.equal(result.status, 'sealed');
  assert.deepEqual(await readdir(outputDirectory), ['open-library-20260831.sealed.json']);
  const bytes = await readFile(join(outputDirectory, 'open-library-20260831.sealed.json'), 'utf8');
  assert.ok(!bytes.includes(secretText));
  assert.deepEqual(unsealAcquisition(JSON.parse(bytes), request, keys.privateKey), collected());
  assert.equal((await stat(outputDirectory)).mode & 0o077, 0);
});

test('failed transfer returns a failed step and an encrypted partial-accounting receipt only', async t => {
  const root = await directory(t), outputDirectory = join(root, 'output'), outputs = join(root, 'outputs');
  const accounting = { activeSource: 'works', sources: { works: { bytes: 123, complete: false } },
    requests: { metadata: 1, works: 1, editions: 0 } };
  const error = Object.assign(new Error(secretText), { accounting });
  await assert.rejects(guardedAcquisition({ env: { ...env(), GITHUB_OUTPUT: outputs }, git, fetcher,
    acquire: async () => { throw error; }, outputDirectory }), /acquisition-failed/);
  assert.equal(await readFile(outputs, 'utf8'), 'sealed=true\n');
  const bytes = await readFile(join(outputDirectory, 'open-library-20260831.sealed.json'), 'utf8');
  assert.ok(!bytes.includes(secretText));
  assert.ok(!bytes.includes('activeSource'));
  const recovered = unsealAcquisition(JSON.parse(bytes), request, keys.privateKey);
  assert.equal(recovered.contract, FAILURE_CONTRACT);
  assert.equal(recovered.status, 'failed');
  assert.deepEqual(recovered.accounting, accounting);
  assert.equal(recovered.code, 'acquisition-failed');
  assert.equal(safePublicAcquisitionError(new Error('acquisition-private-secret-in-error')), 'acquisition-failed');
});

test('original collector seals selected-row evidence bound to its retained publisher metadata', async t => {
  const root = await directory(t), outputDirectory = join(root, 'identity-failure');
  const row = Buffer.from('/type/work\t/works/OL123W\t1\t2026-08-31T00:00:00Z\t'
    + JSON.stringify({ key: '/works/OL999W', type: { key: '/type/work' }, description: secretText }));
  const streams = { works: gzipSync(Buffer.concat([row, Buffer.from('\n')])), editions: gzipSync('') };
  const metadata = { metadata: { identifier: `ol_dump_${request.release}` },
    files: Object.entries(streams).map(([kind, bytes]) => ({ name: `ol_dump_${kind}_${request.release}.txt.gz`,
      size: String(bytes.length), md5: createHash('md5').update(bytes).digest('hex'),
      sha1: createHash('sha1').update(bytes).digest('hex') })) };
  const metadataBytes = Buffer.from(JSON.stringify(metadata)), calls = [];
  await assert.rejects(guardedAcquisition({ env: env(), git, fetcher, outputDirectory,
    acquire: options => acquireOpenLibraryDumps({ ...options, transport: async url => {
      calls.push(url);
      assert.ok(url === `https://archive.org/metadata/ol_dump_${request.release}`
        || url.endsWith(`/ol_dump_works_${request.release}.txt.gz`));
      return { status: 200, headers: {}, body: Readable.from([calls.length === 1 ? metadataBytes : streams.works]) };
    } }) }), error => { assert.equal(error.message, 'acquisition-failed'); return true; });
  assert.equal(calls.length, 2);
  const encrypted = await readFile(join(outputDirectory, 'open-library-20260831.sealed.json'), 'utf8');
  assert.ok(!encrypted.includes(secretText));
  assert.ok(!encrypted.includes(row.toString('base64')));
  const recovered = unsealAcquisition(JSON.parse(encrypted), request, keys.privateKey);
  assert.equal(recovered.status, 'failed');
  assert.equal(recovered.accounting.failureEvidence.predicate, 'record-key-mismatch');
  assert.deepEqual(Buffer.from(recovered.accounting.failureEvidence.rawBase64, 'base64'), row);
  assert.equal(recovered.accounting.failureEvidence.source.md5, metadata.files[0].md5);
  assert.deepEqual(recovered.accounting.requests, { metadata: 1, works: 1, editions: 0 });
  // A self-consistent changed metadata body still cannot rebind the row's source.
  const changed = structuredClone(recovered), differentMetadata = structuredClone(metadata);
  differentMetadata.files[0].md5 = '0'.repeat(32);
  const differentBytes = Buffer.from(JSON.stringify(differentMetadata));
  Object.assign(changed.accounting.metadata, { rawBase64: differentBytes.toString('base64'),
    bytes: differentBytes.length, sha256: sha256(differentBytes) });
  assert.throws(() => sealAcquisition(changed, request), /invalid-dump-failure-evidence/);
});

test('private receipt preserves exact metadata validation code and bytes while public errors remain generic', async t => {
  const root = await directory(t);
  const document = { privateCanary: secretText, metadata: { identifier: `ol_dump_${request.release}` },
    files: ['works', 'editions'].map(kind => ({ name: `ol_dump_${kind}_${request.release}.txt.gz`,
      size: '10', md5: 'a'.repeat(32), sha1: 'b'.repeat(40) })) };
  const missing = structuredClone(document); missing.files = [];
  const integrity = structuredClone(document); delete integrity.files[0].md5;
  const cap = structuredClone(document); cap.files[0].size = String(request.limits.totalCompressedBytes);
  const cases = [[Buffer.from([0xff]), 'invalid-acquisition-metadata'],
    [Buffer.from('{malformed JSON ' + secretText), 'invalid-acquisition-metadata'],
    [Buffer.from(JSON.stringify({ privateCanary: secretText })), 'invalid-acquisition-metadata'],
    [Buffer.from(JSON.stringify(missing)), 'invalid-acquisition-source-count'],
    [Buffer.from(JSON.stringify(integrity)), 'invalid-acquisition-source-integrity'],
    [Buffer.from(JSON.stringify(cap)), 'acquisition-compressed-byte-limit']];
  for (const [index, [raw, code]] of cases.entries()) {
    const outputDirectory = join(root, `diagnostic-failure-${index}`);
    let calls = 0;
    await assert.rejects(guardedAcquisition({ env: env(), git, fetcher, outputDirectory,
      acquire: options => acquireOpenLibraryDumps({ ...options, transport: async url => {
        calls++;
        assert.equal(url, `https://archive.org/metadata/ol_dump_${request.release}`);
        return { status: 200, headers: {}, body: Readable.from([raw]) };
      } }) }), error => {
      assert.equal(error.message, 'acquisition-failed');
      return true;
    });
    assert.equal(calls, 1);
    const bytes = await readFile(join(outputDirectory, 'open-library-20260831.sealed.json'), 'utf8');
    assert.ok(!bytes.includes(secretText));
    if (raw.length > 20) assert.ok(!bytes.includes(raw.toString('base64')));
    const recovered = unsealAcquisition(JSON.parse(bytes), request, keys.privateKey);
    assert.equal(recovered.code, code);
    assert.equal(recovered.accounting.metadata.sha256, sha256(raw));
    assert.deepEqual(Buffer.from(recovered.accounting.metadata.rawBase64, 'base64'), raw);
    assert.deepEqual(recovered.accounting.requests, { metadata: 1, works: 0, editions: 0 });
  }
});

test('local recipient custody refuses replacement and creates restrictive private files', async t => {
  const root = await directory(t), output = join(root, 'recipient');
  const previous = process.env.GITHUB_ACTIONS;
  try {
    process.env.GITHUB_ACTIONS = 'true';
    await assert.rejects(prepareRecipient(output), /acquisition-local-operation-only/);
    delete process.env.GITHUB_ACTIONS;
    const result = await prepareRecipient(output);
    assert.ok(!JSON.stringify(result).includes('KEY'));
    assert.equal((await stat(output)).mode & 0o077, 0);
    assert.equal((await stat(join(output, 'recipient-private.pem'))).mode & 0o077, 0);
    const before = await readFile(join(output, 'recipient-private.pem'));
    await assert.rejects(prepareRecipient(output), { code: 'EEXIST' });
    assert.deepEqual(await readFile(join(output, 'recipient-private.pem')), before);
  } finally {
    if (previous === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = previous;
  }
});

test('local unseal CLI preserves exact plaintext bytes and prints only bounded recovery metadata', async t => {
  const root = await directory(t), keyDirectory = join(root, 'keys'), output = join(root, 'recovered');
  await mkdir(keyDirectory, { mode: 0o700 });
  await writeFile(join(keyDirectory, 'recipient-private.pem'), keys.privateKey, { mode: 0o600 });
  await writeFile(join(root, 'request.json'), JSON.stringify(request));
  const sealed = sealAcquisition(collected(), request);
  await writeFile(join(root, 'sealed.json'), JSON.stringify(sealed));
  const cli = fileURLToPath(new URL('./prepare-dump-acquisition-request.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [cli, 'unseal', '--request', join(root, 'request.json'),
    '--key-dir', keyDirectory, '--input', join(root, 'sealed.json'), '--out', output], { env: {}, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).payloadKind, 'collected');
  assert.ok(!child.stdout.includes(secretText));
  assert.ok(!child.stdout.includes('PRIVATE KEY'));
  const bytes = await readFile(join(output, 'collected.json'));
  assert.equal(sha256(bytes), sealed.header.plaintextSha256);
  assert.deepEqual(JSON.parse(bytes), collected());
});
