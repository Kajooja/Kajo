import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import * as base from './open-library-descriptions.mjs';
import * as intake from './open-library-dump-descriptions.mjs';
import * as collector from './acquire-open-library-dumps.mjs';
import * as seals from './seal-dump-acquisition.mjs';
import * as evidence from './dump-failure-evidence.mjs';
import { FULL_CONTINUATION_REQUEST_BRANCH } from './seal-full-dump-continuation.mjs';
import { FULL_CONTINUATION_ARTIFACT_FILE, FULL_CONTINUATION_REQUIRED_JOBS, FULL_CONTINUATION_SOURCE_FILES,
  FULL_CONTINUATION_WORKFLOW_PATH, collectFullContinuationCodeBinding, inspectPinnedContinuationPayload,
  validateFullContinuationReceipts, validateFullContinuationSourceReceipt, verifyFullContinuationArtifactZip,
} from './inspect-full-dump-continuation.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const modules = { ...base, ...intake, ...collector, ...seals, ...evidence, FULL_CONTINUATION_REQUEST_BRANCH };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const at = '2026-09-27T20:00:01.000Z', ended = '2026-09-27T20:00:03.000Z';
const roster = [{ workId: 'OL123W', editionId: 'OL456M' }];
const description = 'A fictional traveller follows a quiet river and discovers how the choices of an earlier generation still shape the town.';
const snapshot = () => ({ contract: intake.TARGET_CONTRACT, checkedAt: '2026-09-24T10:00:00.000Z', targets: [{
  itemId: '11111111-1111-4111-8111-111111111111', sourceId: '22222222-2222-4222-8222-222222222222',
  ...roster[0], displayLanguage: 'eng', itemUpdatedAt: '2026-09-23T10:00:00.000Z',
  sourceUpdatedAt: '2026-09-23T10:00:00.000Z', descriptionSha256: null, managedDescription: false, identityMatches: true,
}] });
const freshSnapshot = () => ({ ...snapshot(), checkedAt: '2026-09-27T21:00:00.000Z' });
const record = kind => ({ key: kind === 'works' ? '/works/OL123W' : '/books/OL456M',
  type: { key: kind === 'works' ? '/type/work' : '/type/edition' },
  revision: 1, last_modified: { value: '2026-08-15T10:00:00.000' }, description,
  ...(kind === 'editions' ? { works: [{ key: '/works/OL123W' }] } : {}) });
const line = (kind, value = record(kind)) => [kind === 'works' ? '/type/work' : '/type/edition',
  kind === 'works' ? '/works/OL123W' : '/books/OL456M', '1', '2026-08-15T10:00:00.000', JSON.stringify(value)].join('\t') + '\n';

async function successFixture() {
  const limits = { ...collector.REVIEWED_ACQUISITION_LIMITS, maxDecodedBytes: 4 * 1024 ** 2, maxRows: 100 };
  const budget = { bytes: 0 }, sources = {}, sourcePins = {}, scans = {};
  for (const kind of ['works', 'editions']) {
    const raw = record(kind); raw.location = raw.key;
    const compressed = gzipSync(line(kind, raw));
    const pin = { url: `https://archive.org/download/ol_dump_2026-08-31/ol_dump_${kind}_2026-08-31.txt.gz`,
      bytes: compressed.length, compression: 'gzip', md5: createHash('md5').update(compressed).digest('hex'),
      sha1: createHash('sha1').update(compressed).digest('hex'), maxDecodedBytes: limits.maxDecodedBytes, maxRows: limits.maxRows };
    scans[kind] = await intake.scanDumpStream(Readable.from([compressed]), pin, kind, roster, at, budget,
      { keyOf: row => row.workId, lineBytes: limits.lineBytes, retainedBytes: limits.retainedBytes });
    sourcePins[kind] = pin;
    sources[kind] = { ...pin, ...scans[kind].stats, publisherChecksumsVerified: true };
  }
  const request = { release: '2026-08-31', roster, limits, sourcePins,
    sourceEvidence: collector.REVIEWED_SOURCE_EVIDENCE, sourceHead: 'a'.repeat(40), requestSha256: 'b'.repeat(64),
    recipientFingerprint: 'c'.repeat(64) };
  const collected = { contract: collector.ACQUISITION_CONTRACT, status: 'collected', release: request.release,
    retrievedAt: at, completedAt: ended, rosterSha256: base.digest(roster), limits,
    sourceEvidence: request.sourceEvidence, sources,
    sourceManifest: { contract: intake.SOURCE_CONTRACT, release: request.release, retrievedAt: at,
      sources: Object.fromEntries(Object.entries(sources).map(([kind, source]) => [kind,
        Object.fromEntries(['url', 'sha256', 'bytes', 'compression', 'maxDecodedBytes', 'maxRows'].map(key => [key, source[key]]))])) },
    records: [{ ...roster[0], work: scans.works.records.get('OL123W'), edition: scans.editions.records.get('OL123W') }],
    coverage: { targets: 1, found: 2, missing: 0, eligibleTexts: 2, targetsWithEligibleText: 1 },
    retainedRecordBytes: budget.bytes, approved: 0, databaseWrites: 0, individualProviderRequests: 0, rights: 'unreviewed',
    accounting: { startedAt: at, completedAt: ended, activeSource: null, retainedRecordBytes: budget.bytes,
      requests: { metadata: 0, works: 1, editions: 1 }, individualProviderRequests: 0, databaseWrites: 0,
      metadata: { bytes: 0, complete: false, skipped: true, reason: 'reviewed-pinned-source-evidence' },
      sources: Object.fromEntries(Object.entries(scans).map(([kind, scan]) => [kind, { ...scan.stats,
        expectedBytes: sourcePins[kind].bytes, publisherChecksumsVerified: true }])) } };
  return { collected, request, snapshot: snapshot(), currentSnapshot: freshSnapshot(), modules };
}

test('private success replays both raw records and preserves unreconciled review/rights boundaries', async () => {
  const f = await successFixture(), result = inspectPinnedContinuationPayload(f);
  assert.equal(result.summary.coverage.eligibleTexts, 2);
  assert.equal(result.summary.reconciliation.unchanged, 1);
  assert.equal(result.summary.fullDumpChecksumsRecomputedLocally, false);
  assert.ok(result.candidates.every(row => row.approved === false && row.rights === 'unreviewed'));
  delete f.currentSnapshot;
  const unreconciled = inspectPinnedContinuationPayload(f);
  assert.equal(unreconciled.summary.reconciliation.status, 'not-performed');
  assert.ok(unreconciled.candidates.every(row => row.catalogBinding === 'unreconciled' && !row.reviewEligible));
});

test('success rejects forged record, inspection, row framing, manifest, accounting and missing-record coverage', async () => {
  for (const mutate of [
    f => { f.collected.records[0].work.raw = f.collected.records[0].work.raw.replace('river', 'ocean'); },
    f => { f.collected.records[0].work.inspection.description.text = 'forged'; },
    f => { f.collected.records[0].work.inspectionSha256 = 'f'.repeat(64); },
    f => { f.collected.records[0].work.dump.revision++; },
    f => { f.collected.records[0].edition.dump.modifiedAt = '2026-08-16T10:00:00.000'; },
    f => { f.collected.sourceManifest.sources.works.sha256 = 'f'.repeat(64); },
    f => { f.collected.accounting.sources.editions.sha1 = 'f'.repeat(40); },
    f => { f.collected.retainedRecordBytes++; f.collected.accounting.retainedRecordBytes++; },
    f => { f.collected.records[0].edition = null; },
    f => { f.collected.coverage.eligibleTexts--; },
    f => { f.collected.accounting.requests.editions = 0; },
  ]) {
    const f = await successFixture(); mutate(f);
    assert.throws(() => inspectPinnedContinuationPayload(f));
  }
});

test('fresh snapshot reports changed identities/versions/existing descriptions without overwriting or approving', async () => {
  const f = await successFixture();
  Object.assign(f.currentSnapshot.targets[0], { identityMatches: false, itemUpdatedAt: '2026-09-25T10:00:00.000Z',
    descriptionSha256: 'f'.repeat(64), managedDescription: true });
  const result = inspectPinnedContinuationPayload(f);
  assert.equal(result.summary.reconciliation.changed, 1);
  assert.ok(result.reconciliation[0].changes.includes('identityChanged'));
  assert.ok(result.reconciliation[0].changes.includes('nowIneligible'));
  assert.ok(result.candidates.every(row => row.catalogBinding === 'changed' && !row.reviewEligible));
  f.currentSnapshot.checkedAt = '2026-09-26T00:00:00.000Z';
  assert.throws(() => inspectPinnedContinuationPayload(f), /snapshot-predates-collection/);
});

async function failedFixture(aborted = false) {
  const request = { release: collector.ACQUISITION_RELEASE, roster,
    limits: collector.REVIEWED_ACQUISITION_LIMITS, sourcePins: collector.REVIEWED_SOURCE_PINS,
    sourceEvidence: collector.REVIEWED_SOURCE_EVIDENCE, sourceHead: 'a'.repeat(40), requestSha256: 'b'.repeat(64) };
  const controller = new AbortController(); if (aborted) controller.abort();
  let failure;
  try { await collector.acquireReviewedOpenLibraryDumps({ ...request, signal: controller.signal,
    transport: async () => ({ status: 200, headers: {},
      body: Readable.from([gzipSync(line('works', { ...record('works'), location: null }))]) }) }); }
  catch (error) { failure = error; }
  assert.ok(failure);
  return { request, snapshot: snapshot(), modules,
    collected: { contract: seals.FAILURE_CONTRACT, status: 'failed', release: request.release,
      rosterSha256: base.digest(roster), limits: request.limits, code: failure.message, accounting: failure.accounting } };
}

test('actual bounded v2 failure replays raw bytes privately and forged evidence never becomes candidates', async () => {
  const f = await failedFixture(), result = inspectPinnedContinuationPayload(f);
  assert.equal(result.summary.status, 'failed-acquisition');
  assert.equal(result.summary.failureEvidence.predicateReplayed, true);
  assert.equal(result.summary.failureEvidence.predicate, 'record-location-mismatch');
  assert.equal(result.candidates.length, 0);
  assert.ok(!JSON.stringify(result.summary).includes('rawBase64'));
  const changed = structuredClone(f.collected);
  changed.accounting.failureEvidence.rawSha256 = 'f'.repeat(64);
  assert.throws(() => inspectPinnedContinuationPayload({ ...f, collected: changed }), /invalid-dump-failure-evidence/);
  const legacy = structuredClone(f.collected.accounting.failureEvidence);
  legacy.contract = evidence.LEGACY_FAILURE_EVIDENCE_CONTRACT;
  legacy.predicate = 'record-location-present';
  assert.equal(evidence.validateDumpFailureEvidence(legacy, { roster, source: requestPin(f), limits: f.request.limits }), legacy);
  changed.accounting.failureEvidence = legacy;
  assert.throws(() => inspectPinnedContinuationPayload({ ...f, collected: changed }), /continuation-requires-v2/);
});
const requestPin = f => f.request.sourcePins.works;

test('actual pre-aborted collection retains zero attempted source requests without claiming unused operation', async () => {
  const f = await failedFixture(true), result = inspectPinnedContinuationPayload(f);
  assert.equal(result.summary.status, 'failed-acquisition');
  assert.equal(result.summary.code, 'acquisition-aborted');
  assert.equal(result.summary.accounting.requests.works, 0);
  assert.equal(result.summary.accounting.retainedCandidateBytesInArtifact, 0);
});

function receiptFixture() {
  const request = { sourceHead: 'a'.repeat(40), requestSha256: 'b'.repeat(64), recipientFingerprint: 'c'.repeat(64), roster };
  const codeBinding = { sourceHead: request.sourceHead, sourceTree: 'd'.repeat(40), files: { parser: 'e'.repeat(64) }, dependencies: {} };
  const sourceReceipt = { contract: 'kajo-full-continuation-source-acceptance-v1', ...structuredClone(codeBinding),
    reviewedHead: 'f'.repeat(40), sourcePr: 1, tests: 620, exports: 4, acceptedAt: '2026-09-27T19:59:00Z',
    requestSha256: request.requestSha256, requestHead: '1'.repeat(40), requestTree: '2'.repeat(40),
    recipientFingerprint: request.recipientFingerprint, targets: 1,
    ci: { id: 10, headSha: 'f'.repeat(40), repository: 'Kajooja/Kajo', event: 'pull_request', path: '.github/workflows/ci.yml',
      status: 'completed', conclusion: 'success', url: 'https://github.com/Kajooja/Kajo/actions/runs/10',
      createdAt: '2026-09-27T19:50:00Z', updatedAt: '2026-09-27T19:58:00Z' },
    requiredJobs: FULL_CONTINUATION_REQUIRED_JOBS.map((name, i) => ({ name, id: i + 1, runId: 10,
      status: 'completed', conclusion: 'success' })) };
  const zip = Buffer.from('fake zip hash bytes'), sealed = Buffer.from('ciphertext bytes');
  const envelope = { header: { sourceHead: request.sourceHead, requestSha256: request.requestSha256,
    recipientFingerprint: request.recipientFingerprint, rosterSha256: base.digest(roster), plaintextSha256: '3'.repeat(64) } };
  const runReceipt = { contract: 'kajo-full-continuation-runtime-receipt-v1', sourceHead: request.sourceHead,
    requestSha256: request.requestSha256, run: { id: 20, runAttempt: 1, repository: 'Kajooja/Kajo', event: 'push',
      headBranch: FULL_CONTINUATION_REQUEST_BRANCH, headSha: sourceReceipt.requestHead, path: FULL_CONTINUATION_WORKFLOW_PATH,
      url: 'https://github.com/Kajooja/Kajo/actions/runs/20', status: 'completed', conclusion: 'success',
      createdAt: '2026-09-27T20:00:00Z', updatedAt: '2026-09-27T20:00:10Z' },
    artifact: { id: 30, name: 'kajo-book-continuation-sealed-20', workflowRunId: 20, headSha: sourceReceipt.requestHead,
      headBranch: FULL_CONTINUATION_REQUEST_BRANCH, expired: false, singleMember: FULL_CONTINUATION_ARTIFACT_FILE,
      zipCrcVerified: true, authenticatedUnsealVerified: true, zipBytes: zip.length, zipSha256: sha(zip),
      sealedFileSha256: sha(sealed), recoveredPlaintextSha256: envelope.header.plaintextSha256,
      createdAt: '2026-09-27T20:00:05Z', updatedAt: '2026-09-27T20:00:06Z', githubDigest: null } };
  return { request, collected: { status: 'collected', retrievedAt: at, completedAt: ended }, sourceReceipt, runReceipt,
    envelope, zip, sealed, modules: { ...modules, codeBinding } };
}

test('operator receipt binds exact source files, five CI jobs, run/head/branch and artifact bytes independently of encryption', () => {
  const f = receiptFixture();
  assert.match(validateFullContinuationReceipts(f).receiptProvenance, /not sender authentication/);
  for (const mutate of [
    v => { v.sourceReceipt.files.parser = '0'.repeat(64); },
    v => { v.sourceReceipt.dependencies.extra = {}; },
    v => { v.sourceReceipt.requiredJobs[0].runId++; },
    v => { v.sourceReceipt.requiredJobs[0].conclusion = 'failure'; },
    v => { v.sourceReceipt.requiredJobs[1].id = v.sourceReceipt.requiredJobs[0].id; },
    v => { v.sourceReceipt.ci.headSha = '0'.repeat(40); },
    v => { v.sourceReceipt.requestSha256 = '0'.repeat(64); },
    v => { v.runReceipt.run.runAttempt = 2; },
    v => { v.runReceipt.run.event = 'workflow_dispatch'; },
    v => { v.runReceipt.run.headBranch = 'main'; },
    v => { v.runReceipt.run.headSha = '0'.repeat(40); },
    v => { v.runReceipt.run.repository = 'attacker/Kajo'; },
    v => { v.runReceipt.artifact.workflowRunId++; },
    v => { v.runReceipt.artifact.headSha = '0'.repeat(40); },
    v => { v.runReceipt.artifact.zipSha256 = '0'.repeat(64); },
    v => { v.runReceipt.artifact.singleMember = 'unrelated.json'; },
    v => { v.runReceipt.artifact.sealedFileSha256 = '0'.repeat(64); },
    v => { v.runReceipt.artifact.recoveredPlaintextSha256 = '0'.repeat(64); },
    v => { v.envelope.header.recipientFingerprint = '0'.repeat(64); },
    v => { v.collected.completedAt = '2026-09-27T21:00:00Z'; },
  ]) { const altered = receiptFixture(); mutate(altered); assert.throws(() => validateFullContinuationReceipts(altered)); }
});

function zipFor(sealed, member = FULL_CONTINUATION_ARTIFACT_FILE, duplicate = false) {
  return execFileSync('python3', ['-c', 'import io,sys,zipfile\nb=io.BytesIO()\nwith zipfile.ZipFile(b,"w") as z:\n z.writestr(sys.argv[1],sys.stdin.buffer.read())\n if sys.argv[2]=="yes": z.writestr("extra.txt","forged")\nsys.stdout.buffer.write(b.getvalue())',
    member, duplicate ? 'yes' : 'no'], { input: sealed, maxBuffer: 1024 * 1024 });
}
test('ZIP verification rejects wrong member, extra member, altered bytes and mismatched ciphertext', () => {
  const sealed = Buffer.from('synthetic encrypted envelope'), zip = zipFor(sealed);
  verifyFullContinuationArtifactZip(zip, sealed);
  for (const forged of [zipFor(sealed, 'wrong.json'), zipFor(sealed, FULL_CONTINUATION_ARTIFACT_FILE, true),
    zipFor(Buffer.from('forged ciphertext')), Buffer.from('invalid zip')])
    assert.throws(() => verifyFullContinuationArtifactZip(forged, sealed), /artifact-zip-mismatch/);
});

test('ZIP checks cannot be disabled with Python optimization environment flags', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-continuation-zip-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const zip = join(root, 'forged.zip'), sealed = Buffer.from('ciphertext');
  await writeFile(zip, zipFor(sealed, 'wrong-member.json'));
  const script = `import { readFileSync } from 'node:fs';\nimport { verifyFullContinuationArtifactZip } from ${JSON.stringify(join(repo, 'scripts/catalog/inspect-full-dump-continuation.mjs'))};\nverifyFullContinuationArtifactZip(readFileSync(process.argv[1]), Buffer.from('ciphertext'));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, zip],
    { env: { ...process.env, PYTHONOPTIMIZE: '1' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /artifact-zip-mismatch/);
});

test('source closure rejects modified evidence and conflict modules, workflow, lock, inspector and dependency', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-continuation-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of FULL_CONTINUATION_SOURCE_FILES) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await cp(join(repo, path), join(root, path));
  }
  await mkdir(join(root, 'node_modules/@kajo'), { recursive: true });
  await symlink(join(root, 'packages/catalog-contracts'), join(root, 'node_modules/@kajo/catalog-contracts'));
  const require = createRequire(import.meta.url), noble = dirname(require.resolve('@noble/hashes/sha256'));
  await cp(noble, join(root, 'node_modules/@noble/hashes'), { recursive: true });
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git(['init', '-q']); git(['add', ...FULL_CONTINUATION_SOURCE_FILES]);
  git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'synthetic source fixture']);
  let head = git(['rev-parse', 'HEAD']);
  const binding = await collectFullContinuationCodeBinding(root, head);
  assert.ok(binding.files['scripts/catalog/dump-failure-evidence.mjs']);
  assert.ok(binding.files['scripts/catalog/dump-conflict-policy.mjs']);
  assert.ok(binding.dependencies['@noble/hashes'].files['esm/sha2.js']);
  for (const path of ['scripts/catalog/dump-failure-evidence.mjs', 'scripts/catalog/dump-conflict-policy.mjs',
    FULL_CONTINUATION_WORKFLOW_PATH, 'package-lock.json']) {
    const original = await readFile(join(root, path));
    await writeFile(join(root, path), Buffer.concat([original, Buffer.from('\n// modified\n')]));
    await assert.rejects(collectFullContinuationCodeBinding(root, head), /inspection-source-modified/);
    await writeFile(join(root, path), original);
  }
  const dependency = join(root, 'node_modules/@noble/hashes/esm/sha2.js'), original = await readFile(dependency);
  await writeFile(dependency, Buffer.concat([original, Buffer.from('\n// modified installed dependency\n')]));
  const changed = await collectFullContinuationCodeBinding(root, head);
  const receipt = receiptFixture().sourceReceipt;
  Object.assign(receipt, binding);
  assert.throws(() => validateFullContinuationSourceReceipt(receipt, changed), /source-acceptance-receipt-mismatch/);
  await writeFile(dependency, original);
  // A second installed workspace package must not redirect only ESM imports
  // while preserving the index selected by require.resolve.
  await rm(join(root, 'node_modules/@kajo/catalog-contracts'));
  await cp(join(root, 'packages/catalog-contracts'), join(root, 'node_modules/@kajo/catalog-contracts'), { recursive: true });
  const metadata = join(root, 'node_modules/@kajo/catalog-contracts/package.json');
  const manifest = JSON.parse(await readFile(metadata, 'utf8'));
  manifest.exports['.'].import = './unbound.js';
  await writeFile(metadata, JSON.stringify(manifest));
  await assert.rejects(collectFullContinuationCodeBinding(root, head), /inspection-linked-contract-metadata-modified/);
  await rm(join(root, 'node_modules/@kajo/catalog-contracts'), { recursive: true });
  await symlink(join(root, 'packages/catalog-contracts'), join(root, 'node_modules/@kajo/catalog-contracts'));
  const inspector = join(root, 'scripts/catalog/inspect-full-dump-continuation.mjs');
  await writeFile(inspector, (await readFile(inspector, 'utf8')) + '\n// other accepted inspector bytes\n');
  git(['add', 'scripts/catalog/inspect-full-dump-continuation.mjs']);
  git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'different inspector']);
  head = git(['rev-parse', 'HEAD']);
  await assert.rejects(collectFullContinuationCodeBinding(root, head), /executing-inspector-source-mismatch/);
});

test('local-only CLI and overwrite refusal run in isolated children with sanitized errors', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-continuation-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = join(repo, 'scripts/catalog/inspect-full-dump-continuation.mjs');
  const names = ['repo', 'request', 'prefix-sealed', 'sealed', 'artifact-zip', 'recipient-key', 'snapshot', 'source-receipt', 'run-receipt'];
  const args = names.flatMap(name => [`--${name}`, '/PRIVATE_RAW_SENTINEL']);
  const env = { ...process.env }; delete env.GITHUB_ACTIONS;
  for (const childEnv of [{ ...env, GITHUB_ACTIONS: 'true' }, env]) {
    const result = spawnSync(process.execPath, [script, ...args, '--out', root], { env: childEnv, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), { status: 'inspection-failed', code: 'full-continuation-private-inspection-validation-failed' });
    assert.ok(!result.stderr.includes('PRIVATE_RAW_SENTINEL'));
  }
});
