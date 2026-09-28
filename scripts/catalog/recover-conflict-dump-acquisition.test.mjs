import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as base from './open-library-descriptions.mjs';
import { CONFLICT_REQUEST_BRANCH } from './seal-conflict-dump-acquisition.mjs';
import { CONFLICT_ACQUISITION_ARTIFACT_FILE, CONFLICT_ACQUISITION_REQUIRED_JOBS, CONFLICT_ACQUISITION_SOURCE_FILES,
  CONFLICT_ACQUISITION_WORKFLOW_PATH, collectConflictAcquisitionCodeBinding, validateConflictAcquisitionReceipts,
  validateConflictAcquisitionSourceReceipt, verifyConflictAcquisitionArtifactZip, verifyConflictPredecessorCustody,
  CONFLICT_PREDECESSOR_INPUTS, claimConflictPrivateOutput, authenticateConflictPredecessor, readConflictPrivateBytes,
} from './recover-conflict-dump-acquisition.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const modules = { ...base, CONFLICT_REQUEST_BRANCH };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const at = '2026-09-28T06:00:01.000Z', ended = '2026-09-28T06:00:03.000Z';
const roster = [{ workId: 'OL123W', editionId: 'OL456M' }];
function receiptFixture() {
  const request = { sourceHead: 'a'.repeat(40), requestSha256: 'b'.repeat(64), recipientFingerprint: 'c'.repeat(64), roster,
    conflictPolicy: { contract: 'open-library-selected-record-conflict-policy-v1', maxConflictedPairs: 1, maxDiagnosticBytes: 4096 } };
  const codeBinding = { sourceHead: request.sourceHead, sourceTree: 'd'.repeat(40), files: { parser: 'e'.repeat(64) }, dependencies: {} };
  const sourceReceipt = { contract: 'kajo-conflict-acquisition-source-acceptance-v1', ...structuredClone(codeBinding),
    reviewedHead: 'f'.repeat(40), sourcePr: 1, tests: 620, exports: 4, acceptedAt: '2026-09-27T19:59:00Z',
    requestSha256: request.requestSha256, requestHead: '1'.repeat(40), requestTree: '2'.repeat(40),
    recipientFingerprint: request.recipientFingerprint, targets: 1, policySha256: base.digest(request.conflictPolicy),
    ci: { id: 10, headSha: 'f'.repeat(40), repository: 'Kajooja/Kajo', event: 'pull_request', path: '.github/workflows/ci.yml',
      status: 'completed', conclusion: 'success', url: 'https://github.com/Kajooja/Kajo/actions/runs/10',
      createdAt: '2026-09-27T19:50:00Z', updatedAt: '2026-09-27T19:58:00Z' },
    requiredJobs: CONFLICT_ACQUISITION_REQUIRED_JOBS.map((name, i) => ({ name, id: i + 1, runId: 10,
      status: 'completed', conclusion: 'success' })) };
  const zip = Buffer.from('fake zip hash bytes'), sealed = Buffer.from('ciphertext bytes');
  const envelope = { header: { sourceHead: request.sourceHead, requestSha256: request.requestSha256,
    recipientFingerprint: request.recipientFingerprint, rosterSha256: base.digest(roster), plaintextSha256: '3'.repeat(64) } };
  const runReceipt = { contract: 'kajo-conflict-acquisition-runtime-receipt-v1', sourceHead: request.sourceHead,
    requestSha256: request.requestSha256, run: { id: 20, runAttempt: 1, repository: 'Kajooja/Kajo', event: 'push',
      headBranch: CONFLICT_REQUEST_BRANCH, headSha: sourceReceipt.requestHead, path: CONFLICT_ACQUISITION_WORKFLOW_PATH,
      url: 'https://github.com/Kajooja/Kajo/actions/runs/20', status: 'completed', conclusion: 'success',
      createdAt: '2026-09-28T06:00:00Z', updatedAt: '2026-09-28T06:00:10Z' },
    artifact: { id: 30, name: 'kajo-book-conflicts-sealed-20', workflowRunId: 20, headSha: sourceReceipt.requestHead,
      headBranch: CONFLICT_REQUEST_BRANCH, expired: false, singleMember: CONFLICT_ACQUISITION_ARTIFACT_FILE,
      zipCrcVerified: true, authenticatedUnsealVerified: true, zipBytes: zip.length, zipSha256: sha(zip),
      sealedFileSha256: sha(sealed), recoveredPlaintextSha256: envelope.header.plaintextSha256,
      createdAt: '2026-09-28T06:00:05Z', updatedAt: '2026-09-28T06:00:06Z', githubDigest: null } };
  return { request, collected: { status: 'collected', retrievedAt: at, completedAt: ended }, sourceReceipt, runReceipt,
    envelope, zip, sealed, modules: { ...modules, codeBinding } };
}

test('operator receipt binds exact source files, five CI jobs, run/head/branch and artifact bytes independently of encryption', () => {
  const f = receiptFixture();
  assert.match(validateConflictAcquisitionReceipts(f).receiptProvenance, /not sender authentication/);
  for (const mutate of [
    v => { v.sourceReceipt.files.parser = '0'.repeat(64); },
    v => { v.sourceReceipt.dependencies.extra = {}; },
    v => { v.sourceReceipt.requiredJobs[0].runId++; },
    v => { v.sourceReceipt.requiredJobs[0].conclusion = 'failure'; },
    v => { v.sourceReceipt.requiredJobs[1].id = v.sourceReceipt.requiredJobs[0].id; },
    v => { v.sourceReceipt.ci.headSha = '0'.repeat(40); },
    v => { v.sourceReceipt.requestSha256 = '0'.repeat(64); },
    v => { v.sourceReceipt.policySha256 = '0'.repeat(64); },
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
  ]) { const altered = receiptFixture(); mutate(altered); assert.throws(() => validateConflictAcquisitionReceipts(altered)); }
});

function zipFor(sealed, member = CONFLICT_ACQUISITION_ARTIFACT_FILE, duplicate = false) {
  return execFileSync('python3', ['-c', 'import io,sys,zipfile\nb=io.BytesIO()\nwith zipfile.ZipFile(b,"w") as z:\n z.writestr(sys.argv[1],sys.stdin.buffer.read())\n if sys.argv[2]=="yes": z.writestr("extra.txt","forged")\nsys.stdout.buffer.write(b.getvalue())',
    member, duplicate ? 'yes' : 'no'], { input: sealed, maxBuffer: 1024 * 1024 });
}
test('ZIP verification rejects wrong member, extra member, altered bytes and mismatched ciphertext', () => {
  const sealed = Buffer.from('synthetic encrypted envelope'), zip = zipFor(sealed);
  verifyConflictAcquisitionArtifactZip(zip, sealed);
  for (const forged of [zipFor(sealed, 'wrong.json'), zipFor(sealed, CONFLICT_ACQUISITION_ARTIFACT_FILE, true),
    zipFor(Buffer.from('forged ciphertext')), Buffer.from('invalid zip')])
    assert.throws(() => verifyConflictAcquisitionArtifactZip(forged, sealed), /artifact-zip-mismatch/);
});

test('ZIP checks cannot be disabled with Python optimization environment flags', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-continuation-zip-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const zip = join(root, 'forged.zip'), sealed = Buffer.from('ciphertext');
  await writeFile(zip, zipFor(sealed, 'wrong-member.json'));
  const script = `import { readFileSync } from 'node:fs';\nimport { verifyConflictAcquisitionArtifactZip } from ${JSON.stringify(join(repo, 'scripts/catalog/recover-conflict-dump-acquisition.mjs'))};\nverifyConflictAcquisitionArtifactZip(readFileSync(process.argv[1]), Buffer.from('ciphertext'));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, zip],
    { env: { ...process.env, PYTHONOPTIMIZE: '1' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /artifact-zip-mismatch/);
});

test('source closure rejects modified evidence and conflict modules, workflow, lock, inspector and dependency', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-continuation-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of CONFLICT_ACQUISITION_SOURCE_FILES) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await cp(join(repo, path), join(root, path));
  }
  await mkdir(join(root, 'node_modules/@kajo'), { recursive: true });
  await symlink(join(root, 'packages/catalog-contracts'), join(root, 'node_modules/@kajo/catalog-contracts'));
  const require = createRequire(import.meta.url), noble = dirname(require.resolve('@noble/hashes/sha256'));
  await cp(noble, join(root, 'node_modules/@noble/hashes'), { recursive: true });
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git(['init', '-q']); git(['add', ...CONFLICT_ACQUISITION_SOURCE_FILES]);
  git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'synthetic source fixture']);
  let head = git(['rev-parse', 'HEAD']);
  const binding = await collectConflictAcquisitionCodeBinding(root, head);
  assert.ok(binding.files['scripts/catalog/dump-failure-evidence.mjs']);
  assert.ok(binding.files['scripts/catalog/dump-conflict-policy.mjs']);
  assert.ok(binding.dependencies['@noble/hashes'].files['esm/sha2.js']);
  for (const path of ['scripts/catalog/dump-failure-evidence.mjs', 'scripts/catalog/dump-conflict-policy.mjs',
    'scripts/catalog/prepare-conflict-dump-acquisition.mjs', 'scripts/catalog/seal-conflict-dump-acquisition.mjs',
    'scripts/catalog/inspect-conflict-dump-acquisition.mjs', 'scripts/catalog/run-conflict-dump-acquisition.mjs',
    CONFLICT_ACQUISITION_WORKFLOW_PATH, 'package-lock.json']) {
    const original = await readFile(join(root, path));
    await writeFile(join(root, path), Buffer.concat([original, Buffer.from('\n// modified\n')]));
    await assert.rejects(collectConflictAcquisitionCodeBinding(root, head), /inspection-source-modified/);
    await writeFile(join(root, path), original);
  }
  const dependency = join(root, 'node_modules/@noble/hashes/esm/sha2.js'), original = await readFile(dependency);
  await writeFile(dependency, Buffer.concat([original, Buffer.from('\n// modified installed dependency\n')]));
  const changed = await collectConflictAcquisitionCodeBinding(root, head);
  const receipt = receiptFixture().sourceReceipt;
  Object.assign(receipt, binding);
  assert.throws(() => validateConflictAcquisitionSourceReceipt(receipt, changed), /source-acceptance-receipt-mismatch/);
  await writeFile(dependency, original);
  // A second installed workspace package must not redirect only ESM imports
  // while preserving the index selected by require.resolve.
  await rm(join(root, 'node_modules/@kajo/catalog-contracts'));
  await cp(join(root, 'packages/catalog-contracts'), join(root, 'node_modules/@kajo/catalog-contracts'), { recursive: true });
  const metadata = join(root, 'node_modules/@kajo/catalog-contracts/package.json');
  const manifest = JSON.parse(await readFile(metadata, 'utf8'));
  manifest.exports['.'].import = './unbound.js';
  await writeFile(metadata, JSON.stringify(manifest));
  await assert.rejects(collectConflictAcquisitionCodeBinding(root, head), /inspection-linked-contract-metadata-modified/);
  await rm(join(root, 'node_modules/@kajo/catalog-contracts'), { recursive: true });
  await symlink(join(root, 'packages/catalog-contracts'), join(root, 'node_modules/@kajo/catalog-contracts'));
  const inspector = join(root, 'scripts/catalog/recover-conflict-dump-acquisition.mjs');
  await writeFile(inspector, (await readFile(inspector, 'utf8')) + '\n// other accepted inspector bytes\n');
  git(['add', 'scripts/catalog/recover-conflict-dump-acquisition.mjs']);
  git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'different inspector']);
  head = git(['rev-parse', 'HEAD']);
  await assert.rejects(collectConflictAcquisitionCodeBinding(root, head), /executing-inspector-source-mismatch/);
});

test('local-only CLI and overwrite refusal run in isolated children with sanitized errors', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-continuation-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = join(repo, 'scripts/catalog/recover-conflict-dump-acquisition.mjs');
  const names = ['repo', 'request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt',
    'predecessor-repo', 'predecessor-inputs', 'custody-receipt', 'custody-archive'];
  const args = names.flatMap(name => [`--${name}`, '/PRIVATE_RAW_SENTINEL']);
  const env = { ...process.env }; delete env.GITHUB_ACTIONS;
  for (const childEnv of [{ ...env, GITHUB_ACTIONS: 'true' }, env]) {
    const result = spawnSync(process.execPath, [script, ...args, '--out', root], { env: childEnv, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), { status: 'inspection-failed', code: 'conflict-acquisition-private-recovery-failed' });
    assert.ok(!result.stderr.includes('PRIVATE_RAW_SENTINEL'));
  }
});

function custodyFixture() {
  const input = Object.fromEntries(CONFLICT_PREDECESSOR_INPUTS.map(name => [name, Buffer.from('synthetic-private-' + name)]));
  const files = Object.fromEntries(Object.entries(input).map(([name, raw]) => [name,
    { member: 'private/' + name, bytes: raw.length, sha256: sha(raw) }]));
  const archive = execFileSync('python3', ['-I', '-c', `import zipfile,io,json,sys
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z:
 for name,data in json.loads(sys.stdin.read()).items(): z.writestr('private/'+name,data)
sys.stdout.buffer.write(b.getvalue())`],
  { input: JSON.stringify(Object.fromEntries(Object.entries(input).map(([name, raw]) => [name, raw.toString()]))), maxBuffer: 1024 * 1024 });
  const receipt = { contract: 'kajo-conflict-predecessor-custody-v1',
    storage: { fileId: 'libfile_synthetic', version: 1, readBackAt: '2026-09-28T06:00:00Z' },
    archive: { bytes: archive.length, sha256: sha(archive) }, files };
  return { input, receipt, archive };
}

test('private custody checks archive bytes, unique paths and every required readback member including key', () => {
  const f = custodyFixture();
  assert.equal(verifyConflictPredecessorCustody(f.receipt, f.archive, f.input).archiveSha256, sha(f.archive));
  for (const mutate of [v => { v.receipt.archive.sha256 = '0'.repeat(64); }, v => { v.receipt.archive.bytes++; },
    v => { v.receipt.storage.version = 0; }, v => { v.receipt.storage.readBackAt = 'unknown'; },
    v => { delete v.receipt.files['recipient-key']; }, v => { v.receipt.files.sealed.member = '../outside'; },
    v => { v.receipt.files.sealed.member = v.receipt.files.request.member; },
    v => { v.input['recipient-key'] = Buffer.from('substituted key'); },
    v => { v.receipt.files.sealed.member = 'private/missing'; }]) {
    const changed = custodyFixture(); mutate(changed);
    assert.throws(() => verifyConflictPredecessorCustody(changed.receipt, changed.archive, changed.input), /predecessor-custody/);
  }
  const changed = custodyFixture(); changed.input.sealed = Buffer.from('changed matching receipt');
  changed.receipt.files.sealed.bytes = changed.input.sealed.length;
  changed.receipt.files.sealed.sha256 = sha(changed.input.sealed);
  assert.throws(() => verifyConflictPredecessorCustody(changed.receipt, changed.archive, changed.input), /custody-archive/);
});

test('private output rejects existing paths, dangling links and linked parents before reading inputs', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-conflict-output-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await symlink(join(root, 'absent'), join(root, 'dangling'));
  await symlink(root, join(root, 'parent'));
  await assert.rejects(claimConflictPrivateOutput(root), { code: 'EEXIST' });
  await assert.rejects(claimConflictPrivateOutput(join(root, 'dangling')), { code: 'EEXIST' });
  await assert.rejects(claimConflictPrivateOutput(join(root, 'parent', 'new')), /unsafe-output-parent/);
  const created = await claimConflictPrivateOutput(join(root, 'new'));
  assert.equal(created, join(root, 'new'));
});

test('predecessor authentication cannot run a historical inspector without verified custody', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-conflict-predecessor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const f = custodyFixture(); f.receipt.archive.sha256 = '0'.repeat(64);
  await assert.rejects(authenticateConflictPredecessor({ previousRepo: root, input: f.input, custodyReceipt: f.receipt,
    archive: f.archive, out: root, request: {}, modules: {} }), /custody-mismatch/);
});

test('preparation CLI rejects CI and existing output with a single sanitized error', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-conflict-prepare-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const names = ['repo', 'source-head', 'source-receipt', 'policy', 'predecessor-repo', 'predecessor-inputs',
    'custody-receipt', 'custody-archive'];
  const args = names.flatMap(name => [`--${name}`, '/PRIVATE_SENTINEL']);
  const env = { ...process.env }; delete env.GITHUB_ACTIONS;
  for (const childEnv of [env, { ...env, GITHUB_ACTIONS: 'true' }]) {
    const child = spawnSync(process.execPath, [join(repo, 'scripts/catalog/prepare-conflict-dump-acquisition.mjs'),
      ...args, '--out', root], { env: childEnv, encoding: 'utf8' });
    assert.equal(child.status, 1); assert.equal(child.stdout, '');
    assert.deepEqual(JSON.parse(child.stderr), { status: 'failed', code: 'conflict-acquisition-local-preparation-failed' });
  }
});

test('private keys and custody archives require regular owner-only bounded files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kajo-conflict-input-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'private'); await writeFile(path, 'synthetic', { mode: 0o600 });
  assert.equal((await readConflictPrivateBytes(path, 20, true)).toString(), 'synthetic');
  await assert.rejects(readConflictPrivateBytes(path, 3, true), /invalid-private-input/);
  await chmod(path, 0o644);
  await assert.rejects(readConflictPrivateBytes(path, 20, true), /invalid-private-input/);
  await symlink(path, join(root, 'link'));
  await assert.rejects(readConflictPrivateBytes(join(root, 'link'), 20), /invalid-private-input/);
});
