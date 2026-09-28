import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { acquireFramedOpenLibraryDumps } from './acquire-open-library-dumps.mjs';
import { digest, sha256 } from './open-library-descriptions.mjs';
import * as protocol from './seal-framed-dump-acquisition.mjs';
import { guardedFramedDumpAcquisition, validateFramedAcquisitionCommit, validateFramedAcquisitionRunBudget,
  FRAMED_PREDECESSORS } from './run-framed-dump-acquisition.mjs';
import { CONFLICT_ACQUISITION_REQUIRED_JOBS, verifyCatalogArtifactZip, collectCatalogCodeBinding,
  collectHistoricalCatalogCodeBinding } from './recover-conflict-dump-acquisition.mjs';
import { FRAMED_SOURCE_FILES, FRAMED_SOURCE_CONTRACT, FRAMED_RUNTIME_CONTRACT, FRAMED_CUSTODY_CONTRACT,
  FRAMED_PREDECESSOR_INPUTS, collectFramedAcquisitionCodeBinding, validateFramedAcquisitionSourceReceipt, validateFramedAcquisitionReceipts,
  verifyFramedPredecessorCustody, readFramedPredecessorInputs, validateFramedPredecessorResult,
  authenticateFramedPredecessor, verifyFramedHistoricalSource, stageFramedHistoricalRecovery,
  FRAMED_HISTORICAL_SOURCES } from './recover-framed-dump-acquisition.mjs';
import { EDITION_PREDECESSOR_INPUTS, EDITION_SOURCE_FILES, EDITION_SOURCE_CONTRACT } from './recover-edition-prefix-diagnostic.mjs';
import { predecessors as olderPredecessors, sourceHead, requestHead } from './fixtures/edition-prefix-fixture.mjs';
import { frozenRequest, previousEditionDiagnostic } from './fixtures/framed-acquisition-fixture.mjs';
const predecessors = { previousEditionDiagnostic, ...olderPredecessors };
const fixture = () => ({ request: structuredClone(frozenRequest) });

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = () => ({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Kajooja/Kajo', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '100', GITHUB_EVENT_NAME: 'push', GITHUB_REF: `refs/heads/${protocol.FRAMED_REQUEST_BRANCH}`,
  GITHUB_SHA: requestHead, FRAMED_ACQUISITION_GITHUB_TOKEN: 'synthetic-read-only-token' });
const budget = { total_count: 1, workflow_runs: [{ id: 100, head_branch: protocol.FRAMED_REQUEST_BRANCH,
  run_attempt: 1, event: 'push', head_sha: requestHead }] };
const fetcher = async () => new Response(JSON.stringify(budget));
const privateCanary = 'PRIVATE_SENTINEL';
async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'kajo-framed-operator-'));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}
function fixtureGit(request) {
  const fetched = new Set();
  return async args => {
    if (args[0] === 'fetch') { fetched.add(args[3]); return ''; }
    if (args[0] === 'status') return '';
    if (args[0] === 'merge-base') { assert.equal(args[2], protocol.FRAMED_COLLECTION_SOURCE_HEAD); assert.equal(args[3], sourceHead); return ''; }
    if (args[0] === 'rev-parse') return (args[1] === 'FETCH_HEAD' ? requestHead : sourceHead) + '\n';
    if (args[0] === 'show' && args[1] === '-s') return sourceHead + '\n';
    if (args[0] === 'show') {
      for (const [name, identity, path] of FRAMED_PREDECESSORS) if (args[1] === `${identity.requestHead}:${path}`) {
        assert.ok(fetched.has(identity.requestHead)); return JSON.stringify(predecessors[name]);
      }
      assert.equal(args[1], `${requestHead}:${protocol.FRAMED_REQUEST_PATH}`); return JSON.stringify(request);
    }
    if (args[0] === 'diff') return `A\t${protocol.FRAMED_REQUEST_PATH}\n`;
    throw new Error('Unexpected Git fixture');
  };
}

test('sole-file main-child request validates all seven exact predecessor values', () => {
  const { request } = fixture(), input = { sourceHead, requestHead, parents: sourceHead,
    changes: `A\t${protocol.FRAMED_REQUEST_PATH}\n`, request, ...predecessors };
  assert.equal(FRAMED_PREDECESSORS.length, 7);
  for (const [name, identity] of FRAMED_PREDECESSORS) assert.equal(predecessors[name].requestSha256, identity.requestSha256);
  assert.equal(validateFramedAcquisitionCommit(input), request);
  for (const patch of [{ parents: `${sourceHead} ${requestHead}` }, { sourceHead: 'c'.repeat(40) },
    { changes: `M\t${protocol.FRAMED_REQUEST_PATH}\n` },
    { changes: `A\t${protocol.FRAMED_REQUEST_PATH}\nM\tpackage.json\n` },
    ...Object.keys(predecessors).flatMap(name => [{ [name]: undefined }, { [name]: { ...predecessors[name], requestSha256: '0'.repeat(64) } }])])
    assert.throws(() => validateFramedAcquisitionCommit({ ...input, ...patch }));
});

test('separate first-push ledger rejects other heads, attempts, workflows and any earlier run', () => {
  validateFramedAcquisitionRunBudget(budget, '100', requestHead);
  for (const patch of [{ total_count: 2 }, { total_count: 0, workflow_runs: [] }, ...[
    { run_attempt: 2 }, { event: 'workflow_dispatch' }, { head_sha: 'c'.repeat(40) }, { id: 99 },
    { head_branch: 'catalog-acquisition/ol-20260831-conflicts' },
  ].map(change => ({ workflow_runs: [{ ...budget.workflow_runs[0], ...change }] }))])
    assert.throws(() => validateFramedAcquisitionRunBudget({ ...budget, ...patch }, '100', requestHead), /consumed/);
});

test('invalid events, source drift, ancestry, predecessor or tree cannot reach the provider', async t => {
  const root = await directory(t), { request } = fixture(); let calls = 0;
  for (const patch of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_REPOSITORY: 'other/repo' },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/heads/main' }, { GITHUB_SHA: 'c'.repeat(40) }])
    await assert.rejects(guardedFramedDumpAcquisition({ env: { ...env(), ...patch }, git: fixtureGit(request), fetcher,
      acquire: async () => { calls++; }, outputDirectory: join(root, 'blocked') }));
  for (const kind of ['dirty', 'main', 'ancestry', 'tree', 'previous']) {
    const git = fixtureGit(request);
    await assert.rejects(guardedFramedDumpAcquisition({ env: env(), fetcher, acquire: async () => { calls++; },
      outputDirectory: join(root, kind), git: async args => {
        if (kind === 'dirty' && args[0] === 'status') return ' M parser.mjs\n';
        if (kind === 'main' && args[0] === 'rev-parse' && args[1] === 'refs/remotes/origin/main') return 'c'.repeat(40);
        if (kind === 'ancestry' && args[0] === 'merge-base') throw new Error(privateCanary);
        if (kind === 'tree' && args[0] === 'diff') return 'M\tpackage.json\n';
        if (kind === 'previous' && args[0] === 'show' && args[1] === `${protocol.FRAMED_PREVIOUS_EDITION_DIAGNOSTIC.requestHead}:scripts/catalog/requests/ol-20260831-edition-prefix.json`)
          return JSON.stringify({ ...predecessors.previousConflict, requestSha256: '0'.repeat(64) });
        return git(args);
      } }));
  }
  assert.equal(calls, 0);
});

test('existing output, symlinks and a concurrent claim stop before spending the provider budget', async t => {
  const root = await directory(t), { request } = fixture(); let calls = 0;
  await mkdir(join(root, 'existing')); await symlink(join(root, 'missing'), join(root, 'linked'));
  await symlink(root, join(root, 'parent'));
  for (const out of ['existing', 'linked', 'parent/new'])
    await assert.rejects(guardedFramedDumpAcquisition({ env: env(), git: async () => { calls++; }, fetcher,
      acquire: async () => { calls++; }, outputDirectory: join(root, out) }), /(?:exists|unsafe-output-parent)/);
  const outputDirectory = join(root, 'race');
  await assert.rejects(guardedFramedDumpAcquisition({ env: env(), git: fixtureGit(request),
    fetcher: async () => { await mkdir(outputDirectory); return fetcher(); },
    acquire: async () => { calls++; }, outputDirectory }), { code: 'EEXIST' });
  assert.equal(calls, 0);
});

test('spent, oversized or failed GitHub ledger responses cannot claim output or contact the provider', async t => {
  const root = await directory(t), { request } = fixture(); let calls = 0;
  for (const [index, response] of [new Response(JSON.stringify({ ...budget, total_count: 2 })),
    new Response('x'.repeat(2 * 1024 * 1024 + 1)), new Response(privateCanary, { status: 503 })].entries()) {
    const out = join(root, 'blocked-' + index);
    await assert.rejects(guardedFramedDumpAcquisition({ env: env(), git: fixtureGit(request), fetcher: async () => response,
      acquire: async () => { calls++; }, outputDirectory: out }));
    await assert.rejects(lstat(out), { code: 'ENOENT' });
  }
  assert.equal(calls, 0);
});

test('guarded full collection seals a real pre-aborted result before reporting failure', async t => {
  const root = await directory(t), { request } = fixture(), outputDirectory = join(root, 'failed'), output = join(root, 'github-output');
  let actual;
  await assert.rejects(guardedFramedDumpAcquisition({ env: { ...env(), GITHUB_OUTPUT: output }, git: fixtureGit(request), outputDirectory,
    fetcher: async (url, options) => {
      assert.equal(new URL(url).pathname, `/repos/Kajooja/Kajo/actions/workflows/${protocol.FRAMED_WORKFLOW}/runs`);
      assert.equal(new URL(url).searchParams.get('branch'), protocol.FRAMED_REQUEST_BRANCH);
      assert.equal(options.redirect, 'error'); return fetcher();
    }, acquire: async value => {
      assert.deepEqual(value, request); assert.equal((await lstat(outputDirectory)).mode & 0o077, 0);
      actual = await acquireFramedOpenLibraryDumps({ ...value, signal: AbortSignal.abort(),
        transport: async () => { throw new Error('provider-must-not-be-opened'); } }); return actual;
    } }), /framed-acquisition-failed/);
  assert.equal(actual.status, 'failed'); assert.equal(actual.code, 'acquisition-aborted');
  assert.equal(await readFile(output, 'utf8'), 'sealed=true\n');
  assert.deepEqual(await readdir(outputDirectory), [protocol.FRAMED_ARTIFACT]);
  const path = join(outputDirectory, protocol.FRAMED_ARTIFACT), envelope = JSON.parse(await readFile(path));
  assert.equal(envelope.header.plaintextSha256, sha256(JSON.stringify(actual)));
  assert.equal(envelope.header.payloadKind, 'framed-acquisition-result'); assert.equal((await lstat(path)).mode & 0o077, 0);
  assert.ok(!JSON.stringify(envelope).includes('acquisition-aborted'));
});

test('exceptions, malformed results and mutated requests cannot mint ciphertext or a success marker', async t => {
  const root = await directory(t), { request } = fixture();
  for (const [index, acquire] of [async () => { throw new Error(privateCanary); }, async () => ({ status: 'failed', raw: privateCanary }),
    async value => { value.limits.timeoutMs--; return acquireFramedOpenLibraryDumps({ ...value, signal: AbortSignal.abort() }); }].entries()) {
    const outputDirectory = join(root, 'invalid-' + index), output = join(root, 'marker-' + index);
    await assert.rejects(guardedFramedDumpAcquisition({ env: { ...env(), GITHUB_OUTPUT: output }, git: fixtureGit(request), fetcher, acquire, outputDirectory }),
      error => error.message === 'framed-acquisition-failed' && !error.stack.includes(privateCanary));
    assert.deepEqual(await readdir(outputDirectory), []); await assert.rejects(lstat(output), { code: 'ENOENT' });
  }
});

test('workflow and runner CLI have one push path, immutable actions and ciphertext-only output', async t => {
  const root = await directory(t);
  const workflow = await readFile(join(repo, '.github/workflows/' + protocol.FRAMED_WORKFLOW), 'utf8');
  assert.ok(workflow.includes(`branches: [${protocol.FRAMED_REQUEST_BRANCH}]`));
  assert.ok(workflow.includes(`paths: [${protocol.FRAMED_REQUEST_PATH}]`));
  assert.ok(workflow.includes('timeout-minutes: 120')); assert.ok(workflow.includes('persist-credentials: false'));
  assert.ok(workflow.includes('--ignore-scripts')); assert.ok(workflow.includes('ref: main'));
  assert.ok(workflow.includes("if: always() && steps.collect.outputs.sealed == 'true'"));
  assert.ok(!/workflow_dispatch|schedule:|contents: write|actions: write/.test(workflow));
  const actions = [...workflow.matchAll(/uses: ([^\n]+)/g)]; assert.equal(actions.length, 3);
  for (const match of actions) assert.match(match[1], /@[0-9a-f]{40}(?: |$)/);
  const child = spawnSync(process.execPath, [join(repo, 'scripts/catalog/run-framed-dump-acquisition.mjs'), join(root, 'no')],
    { env: { PATH: process.env.PATH, GITHUB_ACTIONS: 'false' }, encoding: 'utf8' });
  assert.equal(child.status, 1); assert.equal(child.stdout, '');
  assert.deepEqual(JSON.parse(child.stderr), { status: 'failed', code: 'framed-acquisition-failed' });
});

function receiptFixture() {
  const { request } = fixture(), codeBinding = { sourceHead, sourceTree: 'c'.repeat(40), files: { parser: 'd'.repeat(64) }, dependencies: {} };
  const sourceReceipt = { contract: FRAMED_SOURCE_CONTRACT, ...structuredClone(codeBinding), reviewedHead: 'e'.repeat(40), sourcePr: 1,
    tests: 757, exports: 4, acceptedAt: '2026-09-28T07:00:00Z', requestSha256: request.requestSha256,
    requestHead, requestTree: 'f'.repeat(40), recipientFingerprint: request.recipientFingerprint,
    targets: request.roster.length, policySha256: digest(request.conflictPolicy), limitsSha256: digest(request.limits), framingSourceHead: request.framingSourceHead,
    ci: { id: 10, headSha: 'e'.repeat(40), repository: 'Kajooja/Kajo', event: 'pull_request', path: '.github/workflows/ci.yml',
      status: 'completed', conclusion: 'success', url: 'https://github.com/Kajooja/Kajo/actions/runs/10',
      createdAt: '2026-09-28T06:40:00Z', updatedAt: '2026-09-28T06:50:00Z' },
    requiredJobs: CONFLICT_ACQUISITION_REQUIRED_JOBS.map((name, i) => ({ name, id: i + 1, runId: 10, status: 'completed', conclusion: 'success' })) };
  const zip = Buffer.from('synthetic zip bytes'), sealed = Buffer.from('synthetic ciphertext');
  const envelope = { header: { sourceHead, requestSha256: request.requestSha256, recipientFingerprint: request.recipientFingerprint,
    rosterSha256: digest(request.roster), plaintextSha256: '0'.repeat(64) } };
  const runReceipt = { contract: FRAMED_RUNTIME_CONTRACT, sourceHead, requestSha256: request.requestSha256,
    run: { id: 20, runAttempt: 1, repository: 'Kajooja/Kajo', event: 'push', headBranch: protocol.FRAMED_REQUEST_BRANCH,
      headSha: requestHead, path: '.github/workflows/' + protocol.FRAMED_WORKFLOW,
      url: 'https://github.com/Kajooja/Kajo/actions/runs/20', status: 'completed', conclusion: 'success',
      createdAt: '2026-09-28T07:10:00Z', updatedAt: '2026-09-28T07:10:10Z' },
    artifact: { id: 30, name: protocol.FRAMED_ARTIFACT_NAME + '-20', workflowRunId: 20, headSha: requestHead,
      headBranch: protocol.FRAMED_REQUEST_BRANCH, expired: false, singleMember: protocol.FRAMED_ARTIFACT,
      zipCrcVerified: true, authenticatedUnsealVerified: true, zipBytes: zip.length, zipSha256: sha256(zip),
      sealedFileSha256: sha256(sealed), recoveredPlaintextSha256: envelope.header.plaintextSha256,
      createdAt: '2026-09-28T07:10:05Z', updatedAt: '2026-09-28T07:10:06Z', githubDigest: null } };
  return { request, collected: { status: 'collected', retrievedAt: '2026-09-28T07:10:01Z', completedAt: '2026-09-28T07:10:03Z' },
    sourceReceipt, runReceipt, envelope, zip, sealed, modules: { ...protocol, digest, codeBinding } };
}

test('recovery receipt binds framed source, five CI gates, caps, run, artifact and chronology', () => {
  const f = receiptFixture(); assert.match(validateFramedAcquisitionReceipts(f).receiptProvenance, /not sender authentication/);
  for (const mutate of [v => { v.sourceReceipt.contract = 'kajo-conflict-acquisition-source-acceptance-v1'; },
    v => { v.sourceReceipt.files.parser = '1'.repeat(64); }, v => { v.sourceReceipt.dependencies.extra = {}; },
    v => { v.sourceReceipt.policySha256 = '1'.repeat(64); },
    v => { v.sourceReceipt.limitsSha256 = '1'.repeat(64); }, v => { v.sourceReceipt.framingSourceHead = '1'.repeat(40); }, v => { v.sourceReceipt.requiredJobs[0].conclusion = 'failure'; },
    v => { v.sourceReceipt.requiredJobs[0].runId++; }, v => { v.sourceReceipt.requiredJobs[1].id = 1; },
    v => { v.sourceReceipt.ci.headSha = '1'.repeat(40); }, v => { v.sourceReceipt.requestHead = '1'.repeat(40); },
    v => { v.runReceipt.run.runAttempt = 2; }, v => { v.runReceipt.run.path = '.github/workflows/catalog-book-conflict-acquisition.yml'; },
    v => { v.runReceipt.run.headBranch = 'main'; }, v => { v.runReceipt.artifact.name = 'kajo-book-conflicts-sealed-20'; },
    v => { v.runReceipt.artifact.zipSha256 = '1'.repeat(64); }, v => { v.runReceipt.artifact.singleMember = 'other.json'; },
    v => { v.runReceipt.artifact.recoveredPlaintextSha256 = '1'.repeat(64); },
    v => { v.collected.completedAt = '2026-09-28T07:20:00Z'; }, v => { v.collected.status = 'failed'; }]) {
    const altered = receiptFixture(); mutate(altered); assert.throws(() => validateFramedAcquisitionReceipts(altered));
  }
});

test('new source closure covers every operator import, workflow, lock and actual ESM dependency bytes', async t => {
  const root = await directory(t);
  for (const path of FRAMED_SOURCE_FILES) { await mkdir(dirname(join(root, path)), { recursive: true }); await cp(join(repo, path), join(root, path)); }
  await mkdir(join(root, 'node_modules/@kajo'), { recursive: true });
  await symlink(join(root, 'packages/catalog-contracts'), join(root, 'node_modules/@kajo/catalog-contracts'));
  const require = createRequire(import.meta.url); await cp(dirname(require.resolve('@noble/hashes/sha256')), join(root, 'node_modules/@noble/hashes'), { recursive: true });
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git(['init', '-q']); git(['add', ...FRAMED_SOURCE_FILES]); git(['-c', 'user.name=Fixture', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture']);
  const head = git(['rev-parse', 'HEAD']), binding = await collectFramedAcquisitionCodeBinding(root, head);
  const receipt = { ...receiptFixture().sourceReceipt, ...binding }; validateFramedAcquisitionSourceReceipt(receipt, binding);
  for (const path of FRAMED_SOURCE_FILES.filter(path => /framed|recover-conflict|package-lock/.test(path))) {
    const bytes = await readFile(join(root, path)); await writeFile(join(root, path), Buffer.concat([bytes, Buffer.from('\n// modified\n')]));
    await assert.rejects(collectFramedAcquisitionCodeBinding(root, head), /inspection-source-modified/); await writeFile(join(root, path), bytes);
  }
  const path = join(root, 'node_modules/@noble/hashes/esm/sha2.js'), bytes = await readFile(path);
  await writeFile(path, Buffer.concat([bytes, Buffer.from('\n// changed dependency\n')]));
  assert.throws(() => validateFramedAcquisitionSourceReceipt(receipt, { ...binding,
    dependencies: { '@noble/hashes': { ...binding.dependencies['@noble/hashes'], files: {} } } }));
  const altered = await collectFramedAcquisitionCodeBinding(root, head);
  assert.throws(() => validateFramedAcquisitionSourceReceipt(receipt, altered));
});

function custodyFixture(inputOverride = {}) {
  const input = Object.fromEntries(FRAMED_PREDECESSOR_INPUTS.map(name => [name, Buffer.from('synthetic-' + name)]));
  Object.assign(input, inputOverride);
  const files = Object.fromEntries(Object.entries(input).map(([name, raw]) => [name, { member: 'private/' + name, bytes: raw.length, sha256: sha256(raw) }]));
  const archive = execFileSync('python3', ['-I', '-c', `import zipfile,io,json,sys,base64
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z:
 for n,data in json.loads(sys.stdin.read()).items(): z.writestr('private/'+n,base64.b64decode(data))
sys.stdout.buffer.write(b.getvalue())`],
  { input: JSON.stringify(Object.fromEntries(Object.entries(input).map(([name, bytes]) => [name, bytes.toString('base64')]))), maxBuffer: 1024 * 1024 });
  return { input, archive, receipt: { contract: FRAMED_CUSTODY_CONTRACT,
    storage: { fileId: 'libfile_synthetic', version: 1, readBackAt: '2026-09-28T08:00:00Z' },
    archive: { bytes: archive.length, sha256: sha256(archive) }, files } };
}

test('custody requires the Edition result, nested continuation inputs and every readback member including the key', () => {
  const f = custodyFixture(); verifyFramedPredecessorCustody(f.receipt, f.archive, f.input);
  for (const name of FRAMED_PREDECESSOR_INPUTS) {
    const altered = { ...f.input, [name]: Buffer.from('substituted') };
    assert.throws(() => verifyFramedPredecessorCustody(f.receipt, f.archive, altered), /custody/);
  }
  const bad = structuredClone(f.receipt); bad.files['recipient-key'].member = '../key';
  assert.throws(() => verifyFramedPredecessorCustody(bad, f.archive, f.input));
  const missing = structuredClone(f.receipt); missing.files.sealed.member = 'private/missing';
  assert.throws(() => verifyFramedPredecessorCustody(missing, f.archive, f.input), /custody-archive/);
});

test('original-source child cannot be reached through changed custody or a substituted public predecessor', async t => {
  const out = await directory(t), { request } = fixture(), modules = { ...protocol, digest };
  await assert.rejects(authenticateFramedPredecessor({ out, request, modules, input: {}, custodyReceipt: {}, archive: Buffer.from('forged'),
    editionRepo: '/not-read', conflictRepo: '/not-read', continuationRepo: '/not-read' }), /custody/);
  const f = custodyFixture({ request: Buffer.from(JSON.stringify(predecessors.previousEditionDiagnostic)),
    'source-receipt': Buffer.from(JSON.stringify({ sourceHead: '0'.repeat(40) })), 'run-receipt': Buffer.from('{}') });
  await assert.rejects(authenticateFramedPredecessor({ out, request, modules, input: f.input, custodyReceipt: f.receipt, archive: f.archive,
    editionRepo: '/not-read', conflictRepo: '/not-read', continuationRepo: '/not-read' }), /predecessor-public-lineage-mismatch/);
  assert.deepEqual(await readdir(out), []);
});

test('manifest requires exact absolute private regular-file key and nested archive inputs', async t => {
  const root = await directory(t), manifest = {};
  for (const name of FRAMED_PREDECESSOR_INPUTS) { manifest[name] = join(root, name); await writeFile(manifest[name], 'synthetic', { mode: 0o600 }); }
  const path = join(root, 'manifest.json'); await writeFile(path, JSON.stringify(manifest));
  const input = await readFramedPredecessorInputs(path); input['recipient-key'].fill(0);
  for (const name of ['recipient-key', 'continuation-custody-archive', 'conflict-custody-archive']) {
    await chmod(manifest[name], 0o644); await assert.rejects(readFramedPredecessorInputs(path), /invalid-private-input/); await chmod(manifest[name], 0o600);
  }
  await writeFile(path, JSON.stringify({ ...manifest, extra: '/private' })); await assert.rejects(readFramedPredecessorInputs(path), /manifest/);
});

test('framed artifact verification rejects a differently named ciphertext ZIP even with matching content', () => {
  const sealed = Buffer.from('synthetic ciphertext');
  const zip = name => execFileSync('python3', ['-I', '-c', `import io,sys,zipfile
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z:z.writestr(sys.argv[1],sys.stdin.buffer.read())
sys.stdout.buffer.write(b.getvalue())`, name], { input: sealed, maxBuffer: 1024 * 1024 });
  verifyCatalogArtifactZip(zip(protocol.FRAMED_ARTIFACT), sealed, protocol.FRAMED_ARTIFACT);
  assert.throws(() => verifyCatalogArtifactZip(zip('open-library-conflicts-20260831.sealed.json'), sealed,
    protocol.FRAMED_ARTIFACT), /artifact-zip-mismatch/);
});

test('preparation/recovery CLIs block CI and existing outputs with fixed errors and no private paths', async t => {
  const out = await directory(t);
  for (const [script, names, code] of [
    ['prepare', ['repo', 'source-head', 'source-receipt', 'edition-repo', 'conflict-repo', 'continuation-repo',
      'predecessor-inputs', 'custody-receipt', 'custody-archive'], 'framed-acquisition-local-preparation-failed'],
    ['recover', ['repo', 'request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt', 'edition-repo', 'conflict-repo', 'continuation-repo',
      'predecessor-inputs', 'custody-receipt', 'custody-archive'], 'framed-acquisition-private-recovery-failed'],
  ]) for (const ci of ['', 'true']) {
    const result = spawnSync(process.execPath, [join(repo, `scripts/catalog/${script}-framed-dump-acquisition.mjs`),
      ...names.flatMap(name => ['--' + name, '/PRIVATE_SENTINEL']), '--out', out],
    { env: { ...process.env, GITHUB_ACTIONS: ci, NODE_OPTIONS: '' }, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.deepEqual(JSON.parse(result.stderr), { status: 'failed', code });
    assert.ok(!result.stderr.includes(privateCanary));
  }
});

test('only the original unrelated bounded-header diagnosis can authorize preparation', () => {
  const result = { contract: 'open-library-edition-prefix-result-v1', status: 'diagnosed', code: 'dump-line-limit',
    provenanceVerified: false, candidates: 0, approved: 0, databaseWrites: 0, modelAdmissions: 0,
    diagnostic: { status: 'diagnosed', code: 'dump-line-limit', fullSourceComplete: false, publisherChecksumsVerified: false,
      failureEvidence: { envelopeSelection: { status: 'unrelated', reason: 'canonical-edition-envelope' },
        validationScope: 'bounded-outer-envelope-only', rowComplete: false, rowBytes: null, rowSha256: null } } };
  assert.equal(validateFramedPredecessorResult(result), result);
  for (const mutate of [r => { r.contract = 'other'; }, r => { r.status = 'failed'; }, r => { r.provenanceVerified = true; },
    r => { r.code = 'edition-line-range-exhausted'; }, r => { r.candidates = 1; }, r => { r.diagnostic = null; },
    r => { r.diagnostic.fullSourceComplete = true; }, r => { r.diagnostic.publisherChecksumsVerified = true; },
    r => { r.diagnostic.failureEvidence.envelopeSelection.status = 'selected'; },
    r => { r.diagnostic.failureEvidence.envelopeSelection.reason = 'unknown'; },
    r => { r.diagnostic.failureEvidence.validationScope = 'whole-row'; },
    r => { r.diagnostic.failureEvidence.rowComplete = true; }, r => { r.diagnostic.failureEvidence.rowBytes = 1049601; },
    r => { r.diagnostic.failureEvidence.rowSha256 = 'a'.repeat(64); }]) {
    const altered = structuredClone(result); mutate(altered); assert.throws(() => validateFramedPredecessorResult(altered));
  }
});

test('historical preflight authenticates closure, reviewed tree and actual dependencies without executing inspected code', async t => {
  const root = await directory(t), inspector = 'scripts/catalog/recover-edition-prefix-diagnostic.mjs';
  for (const path of EDITION_SOURCE_FILES) { await mkdir(dirname(join(root, path)), { recursive: true }); await cp(join(repo, path), join(root, path)); }
  // A valid historical manifest may differ from today's executing module. It
  // is read only here: even this top-level canary must never execute.
  await writeFile(join(root, inspector), (await readFile(join(root, inspector))) + '\nthrow new Error("PRIVATE_SENTINEL");\n');
  await mkdir(join(root, 'node_modules/@kajo'), { recursive: true });
  await symlink(join(root, 'packages/catalog-contracts'), join(root, 'node_modules/@kajo/catalog-contracts'));
  const require = createRequire(import.meta.url);
  await cp(dirname(require.resolve('@noble/hashes/sha256')), join(root, 'node_modules/@noble/hashes'), { recursive: true });
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git(['init', '-q']); git(['add', ...EDITION_SOURCE_FILES]); git(['-c', 'user.name=Fixture', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'historical fixture']);
  const head = git(['rev-parse', 'HEAD']), options = { sourceFiles: EDITION_SOURCE_FILES,
    dynamicImports: [inspector, 'scripts/catalog/recover-conflict-dump-acquisition.mjs'] };
  const binding = await collectHistoricalCatalogCodeBinding(root, head, options);
  const sourceReceipt = { ...receiptFixture().sourceReceipt, ...binding, contract: EDITION_SOURCE_CONTRACT, reviewedHead: head };
  sourceReceipt.ci.headSha = head;
  const spec = { repo: root, sourceHead: head, sourceReceipt, ...options, contract: EDITION_SOURCE_CONTRACT };
  assert.deepEqual(await verifyFramedHistoricalSource(spec), binding);
  await assert.rejects(collectCatalogCodeBinding(root, head, options), /executing-inspector-source-mismatch/);
  await assert.rejects(collectCatalogCodeBinding(root, head, { ...options, executingFile: '', executingUrl: import.meta.url }),
    /executing-inspector-source-mismatch/);
  for (const path of [inspector, 'scripts/catalog/recover-conflict-dump-acquisition.mjs',
    'scripts/catalog/open-library-dump-descriptions.mjs', '.github/workflows/catalog-book-edition-prefix-diagnostic.yml', 'package-lock.json']) {
    const bytes = await readFile(join(root, path)); await writeFile(join(root, path), Buffer.concat([bytes, Buffer.from('\n// changed\n')]));
    await assert.rejects(verifyFramedHistoricalSource(spec), /inspection-source-modified/); await writeFile(join(root, path), bytes);
  }
  const dependency = join(root, 'node_modules/@noble/hashes/esm/sha2.js'), original = await readFile(dependency);
  await writeFile(dependency, Buffer.concat([original, Buffer.from('\n// changed dependency\n')]));
  await assert.rejects(verifyFramedHistoricalSource(spec), /source-acceptance-receipt-mismatch/); await writeFile(dependency, original);
  await writeFile(join(root, 'extra'), 'different reviewed tree'); git(['add', 'extra']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'other tree']);
  const other = git(['rev-parse', 'HEAD']); git(['checkout', '--detach', head]);
  const changed = structuredClone(sourceReceipt); changed.reviewedHead = other; changed.ci.headSha = other;
  await assert.rejects(verifyFramedHistoricalSource({ ...spec, sourceReceipt: changed }), /reviewed-source-tree-mismatch/);
});

test('historical manifests preserve their original Git contracts, including the pre-conflict continuation closure', () => {
  // Digests reproduced from the accepted 3d12a7f / 2463168 / 8a9aefb
  // manifests, independently read from those Git objects during implementation.
  const expected = [
    ['edition', 26, 'bb49c69a36254303fa324e6a4aef084035cf8a86ad5a95455cfb59057b1e6511'],
    ['conflict', 20, 'f0ac0642239290f739930276a8a38cb143da54ea39a036d37397c5da187c9a06'],
    ['continuation', 17, '4c5f0a4ddd319ea8963214937ea51a8d53406427a61256e22d1fc8d40755aade'],
  ];
  assert.deepEqual(FRAMED_HISTORICAL_SOURCES.map(spec => [spec.repoName, spec.sourceFiles.length, digest([...spec.sourceFiles].sort())]), expected);
  for (const spec of FRAMED_HISTORICAL_SOURCES) {
    assert.ok(Object.isFrozen(spec) && Object.isFrozen(spec.sourceFiles) && Object.isFrozen(spec.dynamicImports));
  }
});

test('correct custody and public lineage still cannot stage a key from an unaccepted historical checkout', async t => {
  const root = await directory(t), out = join(root, 'out'); await mkdir(out);
  const identity = protocol.FRAMED_PREVIOUS_EDITION_DIAGNOSTIC;
  const f = custodyFixture({ request: Buffer.from(JSON.stringify(previousEditionDiagnostic)),
    'source-receipt': Buffer.from(JSON.stringify(identity)),
    'run-receipt': Buffer.from(JSON.stringify({ run: { id: identity.runId, updatedAt: '2026-09-28T07:00:00Z' } })),
    'conflict-source-receipt': Buffer.from('{}'), 'continuation-source-receipt': Buffer.from('{}') });
  await assert.rejects(authenticateFramedPredecessor({ out, request: frozenRequest, modules: { ...protocol, digest },
    input: f.input, custodyReceipt: f.receipt, archive: f.archive, editionRepo: repo, conflictRepo: repo, continuationRepo: repo }),
  /inspection-repo-head-mismatch/);
  assert.deepEqual(await readdir(out), []);
});

for (const mode of ['success', 'failure', 'timeout']) test(`historical process ${mode} cleans all three staged key copies and stops descendants`, async t => {
  const root = await directory(t), editionRepo = join(root, 'edition'), out = join(root, 'out');
  await mkdir(join(editionRepo, 'scripts/catalog'), { recursive: true }); await mkdir(out);
  const fakeInspector = `import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const args=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,i)=>[process.argv[2+i*2],process.argv[3+i*2]]));
const manifest=JSON.parse(readFileSync(args['--predecessor-inputs']));
if(JSON.stringify(Object.keys(manifest).sort())!==JSON.stringify(${JSON.stringify([...EDITION_PREDECESSOR_INPUTS].sort())}))process.exit(7);
for(const name of ['request','sealed','artifact-zip','source-receipt','run-receipt']) {
 if(readFileSync(manifest[name],'utf8')!=='synthetic-conflict-'+name)process.exit(8);
 if(readFileSync(args['--'+name],'utf8')!=='synthetic-'+name)process.exit(9);
}
if(readFileSync(args['--custody-archive'],'utf8')!=='synthetic-conflict-custody-archive')process.exit(10);
const key=readFileSync(manifest['recipient-key']);
for(const path of ['predecessor-inputs/recipient-key','conflict-recovery/predecessor-inputs/recipient-key']) {
 const target=join(args['--out'],path);mkdirSync(dirname(target),{recursive:true,mode:0o700});writeFileSync(target,key,{mode:0o600});
}
mkdirSync(args['--out'],{recursive:true});writeFileSync(join(args['--out'],'ready'),'yes');
console.log('PRIVATE_SENTINEL');console.error('PRIVATE_SENTINEL');
const child=spawn(process.execPath,['-e',"setInterval(()=>{},1000)"],{stdio:'ignore'});
writeFileSync(join(args['--out'],'grandchild'),String(child.pid));
${mode === 'timeout' ? 'setInterval(()=>{},1000);' : `process.exit(${mode === 'success' ? 0 : 3});`}
`;
  await writeFile(join(editionRepo, 'scripts/catalog/recover-edition-prefix-diagnostic.mjs'), fakeInspector);
  const input = Object.fromEntries(FRAMED_PREDECESSOR_INPUTS.map(name => [name, Buffer.from('synthetic-' + name)]));
  assert.equal(FRAMED_PREDECESSOR_INPUTS.length, 22); assert.equal(new Set(FRAMED_PREDECESSOR_INPUTS).size, 22);
  const operation = stageFramedHistoricalRecovery({ editionRepo, conflictRepo: root, continuationRepo: root, input, out,
    timeoutMs: mode === 'timeout' ? 2000 : 10000 });
  if (mode === 'success') assert.equal(await operation, join(out, 'edition-recovery'));
  else await assert.rejects(operation, error => error.message === 'framed-predecessor-authentication-failed');
  assert.equal(await readFile(join(out, 'edition-recovery/ready'), 'utf8'), 'yes');
  for (const name of ['predecessor-inputs/recipient-key', 'edition-recovery/predecessor-inputs/recipient-key',
    'edition-recovery/conflict-recovery/predecessor-inputs/recipient-key', 'request.json', 'predecessor-proof.json'])
    await assert.rejects(lstat(join(out, name)), { code: 'ENOENT' });
  const pid = Number(await readFile(join(out, 'edition-recovery/grandchild'), 'utf8'));
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } });
  // Linux may retain a killed orphan as a zombie until init reaps it. Neither
  // absence nor zombie state can execute more code or recreate an erased key.
  const statPath = `/proc/${pid}/stat`;
  if (process.platform === 'linux') {
    let state;
    for (let attempt = 0; attempt < 50; attempt++) {
      state = await readFile(statPath, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (state === null || /\) [ZX] /.test(state)) break;
      await new Promise(resolveWait => setTimeout(resolveWait, 10));
    }
    assert.ok(state === null || /\) [ZX] /.test(state), 'historical grandchild must be stopped');
  }
  assert.equal(input['recipient-key'].toString(), 'synthetic-recipient-key'); // Caller owns in-memory cleanup.
});
