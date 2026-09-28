import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { acquireEditionPrefixDiagnostic } from './acquire-edition-prefix-diagnostic.mjs';
import { digest, sha256 } from './open-library-descriptions.mjs';
import * as protocol from './seal-edition-prefix-diagnostic.mjs';
import { guardedEditionPrefixDiagnostic, validateEditionPrefixCommit, validateEditionPrefixRunBudget,
  EDITION_PREFIX_PREDECESSORS } from './run-edition-prefix-diagnostic.mjs';
import { CONFLICT_ACQUISITION_REQUIRED_JOBS, verifyCatalogArtifactZip } from './recover-conflict-dump-acquisition.mjs';
import { EDITION_SOURCE_FILES, EDITION_SOURCE_CONTRACT, EDITION_RUNTIME_CONTRACT, EDITION_CUSTODY_CONTRACT,
  EDITION_PREDECESSOR_INPUTS, collectEditionPrefixCodeBinding, validateEditionPrefixSourceReceipt, validateEditionPrefixReceipts,
  verifyEditionPredecessorCustody, readEditionPredecessorInputs, validateEditionPredecessorResult,
  authenticateEditionPredecessor } from './recover-edition-prefix-diagnostic.mjs';
import { fixture, predecessors, sourceHead, requestHead, rehash, transportFor } from './fixtures/edition-prefix-fixture.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = () => ({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Kajooja/Kajo', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '100', GITHUB_EVENT_NAME: 'push', GITHUB_REF: `refs/heads/${protocol.EDITION_PREFIX_BRANCH}`,
  GITHUB_SHA: requestHead, EDITION_PREFIX_GITHUB_TOKEN: 'synthetic-read-only-token' });
const budget = { total_count: 1, workflow_runs: [{ id: 100, head_branch: protocol.EDITION_PREFIX_BRANCH,
  run_attempt: 1, event: 'push', head_sha: requestHead }] };
const fetcher = async () => new Response(JSON.stringify(budget));
const privateCanary = 'PRIVATE_SENTINEL';
async function directory(t) {
  const root = await mkdtemp(join(tmpdir(), 'kajo-edition-operator-'));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}
function fixtureGit(request) {
  const fetched = new Set();
  return async args => {
    if (args[0] === 'fetch') { fetched.add(args[3]); return ''; }
    if (args[0] === 'status') return '';
    if (args[0] === 'merge-base') { assert.equal(args[2], protocol.EDITION_PREFIX_CORE_HEAD); assert.equal(args[3], sourceHead); return ''; }
    if (args[0] === 'rev-parse') return (args[1] === 'FETCH_HEAD' ? requestHead : sourceHead) + '\n';
    if (args[0] === 'show' && args[1] === '-s') return sourceHead + '\n';
    if (args[0] === 'show') {
      for (const [name, identity, path] of EDITION_PREFIX_PREDECESSORS) if (args[1] === `${identity.requestHead}:${path}`) {
        assert.ok(fetched.has(identity.requestHead)); return JSON.stringify(predecessors[name]);
      }
      assert.equal(args[1], `${requestHead}:${protocol.EDITION_PREFIX_REQUEST_PATH}`); return JSON.stringify(request);
    }
    if (args[0] === 'diff') return `A\t${protocol.EDITION_PREFIX_REQUEST_PATH}\n`;
    throw new Error('Unexpected Git fixture');
  };
}

test('sole-file main-child request validates all six exact predecessor values', () => {
  const { request } = fixture(), input = { sourceHead, requestHead, parents: sourceHead,
    changes: `A\t${protocol.EDITION_PREFIX_REQUEST_PATH}\n`, request, ...predecessors };
  assert.equal(EDITION_PREFIX_PREDECESSORS.length, 6);
  for (const [name, identity] of EDITION_PREFIX_PREDECESSORS) assert.equal(predecessors[name].requestSha256, identity.requestSha256);
  assert.equal(validateEditionPrefixCommit(input), request);
  for (const patch of [{ parents: `${sourceHead} ${requestHead}` }, { sourceHead: 'c'.repeat(40) },
    { changes: `M\t${protocol.EDITION_PREFIX_REQUEST_PATH}\n` },
    { changes: `A\t${protocol.EDITION_PREFIX_REQUEST_PATH}\nM\tpackage.json\n` },
    ...Object.keys(predecessors).flatMap(name => [{ [name]: undefined }, { [name]: { ...predecessors[name], requestSha256: '0'.repeat(64) } }])])
    assert.throws(() => validateEditionPrefixCommit({ ...input, ...patch }));
});

test('separate first-push ledger rejects other heads, attempts, workflows and any earlier run', () => {
  validateEditionPrefixRunBudget(budget, '100', requestHead);
  for (const patch of [{ total_count: 2 }, { total_count: 0, workflow_runs: [] }, ...[
    { run_attempt: 2 }, { event: 'workflow_dispatch' }, { head_sha: 'c'.repeat(40) }, { id: 99 },
    { head_branch: 'catalog-acquisition/ol-20260831-conflicts' },
  ].map(change => ({ workflow_runs: [{ ...budget.workflow_runs[0], ...change }] }))])
    assert.throws(() => validateEditionPrefixRunBudget({ ...budget, ...patch }, '100', requestHead), /consumed/);
});

test('invalid events, source drift, ancestry, predecessor or tree cannot reach the provider', async t => {
  const root = await directory(t), { request } = fixture(); let calls = 0;
  for (const patch of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_REPOSITORY: 'other/repo' },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/heads/main' }, { GITHUB_SHA: 'c'.repeat(40) }])
    await assert.rejects(guardedEditionPrefixDiagnostic({ env: { ...env(), ...patch }, git: fixtureGit(request), fetcher,
      acquire: async () => { calls++; }, outputDirectory: join(root, 'blocked') }));
  for (const kind of ['dirty', 'main', 'ancestry', 'tree', 'previous']) {
    const git = fixtureGit(request);
    await assert.rejects(guardedEditionPrefixDiagnostic({ env: env(), fetcher, acquire: async () => { calls++; },
      outputDirectory: join(root, kind), git: async args => {
        if (kind === 'dirty' && args[0] === 'status') return ' M parser.mjs\n';
        if (kind === 'main' && args[0] === 'rev-parse' && args[1] === 'refs/remotes/origin/main') return 'c'.repeat(40);
        if (kind === 'ancestry' && args[0] === 'merge-base') throw new Error(privateCanary);
        if (kind === 'tree' && args[0] === 'diff') return 'M\tpackage.json\n';
        if (kind === 'previous' && args[0] === 'show' && args[1] === `${protocol.EDITION_PREVIOUS_CONFLICT.requestHead}:scripts/catalog/requests/ol-20260831-conflicts.json`)
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
    await assert.rejects(guardedEditionPrefixDiagnostic({ env: env(), git: async () => { calls++; }, fetcher,
      acquire: async () => { calls++; }, outputDirectory: join(root, out) }), /(?:exists|unsafe-output-parent)/);
  const outputDirectory = join(root, 'race');
  await assert.rejects(guardedEditionPrefixDiagnostic({ env: env(), git: fixtureGit(request),
    fetcher: async () => { await mkdir(outputDirectory); return fetcher(); },
    acquire: async () => { calls++; }, outputDirectory }), { code: 'EEXIST' });
  assert.equal(calls, 0);
});

test('spent, oversized or failed GitHub ledger responses cannot claim output or contact the provider', async t => {
  const root = await directory(t), { request } = fixture(); let calls = 0;
  for (const [index, response] of [new Response(JSON.stringify({ ...budget, total_count: 2 })),
    new Response('x'.repeat(2 * 1024 * 1024 + 1)), new Response(privateCanary, { status: 503 })].entries()) {
    const out = join(root, 'blocked-' + index);
    await assert.rejects(guardedEditionPrefixDiagnostic({ env: env(), git: fixtureGit(request), fetcher: async () => response,
      acquire: async () => { calls++; }, outputDirectory: out }));
    await assert.rejects(lstat(out), { code: 'ENOENT' });
  }
  assert.equal(calls, 0);
});

test('real guarded diagnostic stores one private ciphertext and reports no row or outcome', async t => {
  const root = await directory(t), f = fixture(), outputDirectory = join(root, 'diagnosis');
  let actual;
  const result = await guardedEditionPrefixDiagnostic({ env: env(), git: fixtureGit(f.request), outputDirectory,
    fetcher: async (url, options) => {
      assert.equal(new URL(url).pathname, `/repos/Kajooja/Kajo/actions/workflows/${protocol.EDITION_PREFIX_WORKFLOW}/runs`);
      assert.equal(new URL(url).searchParams.get('branch'), protocol.EDITION_PREFIX_BRANCH); assert.equal(options.redirect, 'error'); return fetcher();
    }, acquire: async request => {
      assert.deepEqual(request, f.request); assert.equal((await lstat(outputDirectory)).mode & 0o077, 0);
      actual = await acquireEditionPrefixDiagnostic(request, { transport: transportFor(request, f.zipped) }); return actual;
    } });
  assert.equal(actual.status, 'diagnosed'); assert.equal(result.status, 'sealed');
  assert.equal(result.candidates, 0); assert.ok(!JSON.stringify(result).includes('dump-line-limit'));
  assert.deepEqual(await readdir(outputDirectory), [protocol.EDITION_PREFIX_ARTIFACT]);
  const path = join(outputDirectory, protocol.EDITION_PREFIX_ARTIFACT), envelope = JSON.parse(await readFile(path));
  assert.equal(envelope.header.plaintextSha256, sha256(JSON.stringify(actual)));
  assert.equal(envelope.header.payloadKind, 'edition-prefix-diagnostic'); assert.equal((await lstat(path)).mode & 0o077, 0);
});

test('failed transport still uploads encrypted failure, while malformed payloads cannot mint ciphertext', async t => {
  const root = await directory(t), f = fixture(), outputDirectory = join(root, 'failed'), output = join(root, 'github-output');
  await assert.rejects(guardedEditionPrefixDiagnostic({ env: { ...env(), GITHUB_OUTPUT: output }, git: fixtureGit(f.request), fetcher,
    outputDirectory, acquire: request => acquireEditionPrefixDiagnostic(request, { transport: async () => { throw new Error(privateCanary); } }) }),
  /edition-prefix-failed/);
  assert.equal(await readFile(output, 'utf8'), 'sealed=true\n');
  assert.deepEqual(await readdir(outputDirectory), [protocol.EDITION_PREFIX_ARTIFACT]);
  for (const [index, acquire] of [async () => { throw new Error(privateCanary); }, async () => ({ status: 'failed', raw: privateCanary }),
    async request => { request.diagnosticLimits.prefixBytes--; return acquireEditionPrefixDiagnostic(rehash(request), { transport: transportFor(f.request, f.zipped) }); }].entries()) {
    const out = join(root, 'invalid-' + index);
    await assert.rejects(guardedEditionPrefixDiagnostic({ env: env(), git: fixtureGit(f.request), fetcher, acquire, outputDirectory: out }),
      error => error.message === 'edition-prefix-failed' && !error.stack.includes(privateCanary));
    assert.deepEqual(await readdir(out), []);
  }
});

test('workflow and runner CLI have one push path, immutable actions and ciphertext-only output', async t => {
  const root = await directory(t);
  const workflow = await readFile(join(repo, '.github/workflows/' + protocol.EDITION_PREFIX_WORKFLOW), 'utf8');
  assert.ok(workflow.includes(`branches: [${protocol.EDITION_PREFIX_BRANCH}]`));
  assert.ok(workflow.includes(`paths: [${protocol.EDITION_PREFIX_REQUEST_PATH}]`));
  assert.ok(workflow.includes('timeout-minutes: 30')); assert.ok(workflow.includes('persist-credentials: false'));
  assert.ok(workflow.includes('--ignore-scripts')); assert.ok(workflow.includes('ref: main'));
  assert.ok(workflow.includes("if: always() && steps.collect.outputs.sealed == 'true'"));
  assert.ok(!/workflow_dispatch|schedule:|contents: write|actions: write/.test(workflow));
  const actions = [...workflow.matchAll(/uses: ([^\n]+)/g)]; assert.equal(actions.length, 3);
  for (const match of actions) assert.match(match[1], /@[0-9a-f]{40}(?: |$)/);
  const child = spawnSync(process.execPath, [join(repo, 'scripts/catalog/run-edition-prefix-diagnostic.mjs'), join(root, 'no')],
    { env: { PATH: process.env.PATH, GITHUB_ACTIONS: 'false' }, encoding: 'utf8' });
  assert.equal(child.status, 1); assert.equal(child.stdout, '');
  assert.deepEqual(JSON.parse(child.stderr), { status: 'failed', code: 'edition-prefix-failed' });
});

function receiptFixture() {
  const { request } = fixture(), codeBinding = { sourceHead, sourceTree: 'c'.repeat(40), files: { parser: 'd'.repeat(64) }, dependencies: {} };
  const sourceReceipt = { contract: EDITION_SOURCE_CONTRACT, ...structuredClone(codeBinding), reviewedHead: 'e'.repeat(40), sourcePr: 1,
    tests: 757, exports: 4, acceptedAt: '2026-09-28T07:00:00Z', requestSha256: request.requestSha256,
    requestHead, requestTree: 'f'.repeat(40), recipientFingerprint: request.recipientFingerprint,
    targets: request.roster.length, policySha256: digest(request.conflictPolicy), diagnosticLimitsSha256: digest(request.diagnosticLimits),
    ci: { id: 10, headSha: 'e'.repeat(40), repository: 'Kajooja/Kajo', event: 'pull_request', path: '.github/workflows/ci.yml',
      status: 'completed', conclusion: 'success', url: 'https://github.com/Kajooja/Kajo/actions/runs/10',
      createdAt: '2026-09-28T06:40:00Z', updatedAt: '2026-09-28T06:50:00Z' },
    requiredJobs: CONFLICT_ACQUISITION_REQUIRED_JOBS.map((name, i) => ({ name, id: i + 1, runId: 10, status: 'completed', conclusion: 'success' })) };
  const zip = Buffer.from('synthetic zip bytes'), sealed = Buffer.from('synthetic ciphertext');
  const envelope = { header: { sourceHead, requestSha256: request.requestSha256, recipientFingerprint: request.recipientFingerprint,
    rosterSha256: digest(request.roster), plaintextSha256: '0'.repeat(64) } };
  const runReceipt = { contract: EDITION_RUNTIME_CONTRACT, sourceHead, requestSha256: request.requestSha256,
    run: { id: 20, runAttempt: 1, repository: 'Kajooja/Kajo', event: 'push', headBranch: protocol.EDITION_PREFIX_BRANCH,
      headSha: requestHead, path: '.github/workflows/' + protocol.EDITION_PREFIX_WORKFLOW,
      url: 'https://github.com/Kajooja/Kajo/actions/runs/20', status: 'completed', conclusion: 'success',
      createdAt: '2026-09-28T07:10:00Z', updatedAt: '2026-09-28T07:10:10Z' },
    artifact: { id: 30, name: protocol.EDITION_PREFIX_ARTIFACT_NAME + '-20', workflowRunId: 20, headSha: requestHead,
      headBranch: protocol.EDITION_PREFIX_BRANCH, expired: false, singleMember: protocol.EDITION_PREFIX_ARTIFACT,
      zipCrcVerified: true, authenticatedUnsealVerified: true, zipBytes: zip.length, zipSha256: sha256(zip),
      sealedFileSha256: sha256(sealed), recoveredPlaintextSha256: envelope.header.plaintextSha256,
      createdAt: '2026-09-28T07:10:05Z', updatedAt: '2026-09-28T07:10:06Z', githubDigest: null } };
  return { request, collected: { status: 'diagnosed', retrievedAt: '2026-09-28T07:10:01Z', completedAt: '2026-09-28T07:10:03Z' },
    sourceReceipt, runReceipt, envelope, zip, sealed, modules: { ...protocol, digest, codeBinding } };
}

test('recovery receipt binds Edition source, five CI gates, caps, run, artifact and chronology', () => {
  const f = receiptFixture(); assert.match(validateEditionPrefixReceipts(f).receiptProvenance, /not sender authentication/);
  for (const mutate of [v => { v.sourceReceipt.contract = 'kajo-conflict-acquisition-source-acceptance-v1'; },
    v => { v.sourceReceipt.files.parser = '1'.repeat(64); }, v => { v.sourceReceipt.dependencies.extra = {}; },
    v => { v.sourceReceipt.diagnosticLimitsSha256 = '1'.repeat(64); }, v => { v.sourceReceipt.requiredJobs[0].conclusion = 'failure'; },
    v => { v.sourceReceipt.requiredJobs[0].runId++; }, v => { v.sourceReceipt.requiredJobs[1].id = 1; },
    v => { v.sourceReceipt.ci.headSha = '1'.repeat(40); }, v => { v.sourceReceipt.requestHead = '1'.repeat(40); },
    v => { v.runReceipt.run.runAttempt = 2; }, v => { v.runReceipt.run.path = '.github/workflows/catalog-book-conflict-acquisition.yml'; },
    v => { v.runReceipt.run.headBranch = 'main'; }, v => { v.runReceipt.artifact.name = 'kajo-book-conflicts-sealed-20'; },
    v => { v.runReceipt.artifact.zipSha256 = '1'.repeat(64); }, v => { v.runReceipt.artifact.singleMember = 'other.json'; },
    v => { v.runReceipt.artifact.recoveredPlaintextSha256 = '1'.repeat(64); },
    v => { v.collected.completedAt = '2026-09-28T07:20:00Z'; }, v => { v.collected.status = 'failed'; }]) {
    const altered = receiptFixture(); mutate(altered); assert.throws(() => validateEditionPrefixReceipts(altered));
  }
});

test('new source closure covers every operator import, workflow, lock and actual ESM dependency bytes', async t => {
  const root = await directory(t);
  for (const path of EDITION_SOURCE_FILES) { await mkdir(dirname(join(root, path)), { recursive: true }); await cp(join(repo, path), join(root, path)); }
  await mkdir(join(root, 'node_modules/@kajo'), { recursive: true });
  await symlink(join(root, 'packages/catalog-contracts'), join(root, 'node_modules/@kajo/catalog-contracts'));
  const require = createRequire(import.meta.url); await cp(dirname(require.resolve('@noble/hashes/sha256')), join(root, 'node_modules/@noble/hashes'), { recursive: true });
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git(['init', '-q']); git(['add', ...EDITION_SOURCE_FILES]); git(['-c', 'user.name=Fixture', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture']);
  const head = git(['rev-parse', 'HEAD']), binding = await collectEditionPrefixCodeBinding(root, head);
  const receipt = { ...receiptFixture().sourceReceipt, ...binding }; validateEditionPrefixSourceReceipt(receipt, binding);
  for (const path of EDITION_SOURCE_FILES.filter(path => /edition-prefix|recover-conflict|package-lock/.test(path))) {
    const bytes = await readFile(join(root, path)); await writeFile(join(root, path), Buffer.concat([bytes, Buffer.from('\n// modified\n')]));
    await assert.rejects(collectEditionPrefixCodeBinding(root, head), /inspection-source-modified/); await writeFile(join(root, path), bytes);
  }
  const path = join(root, 'node_modules/@noble/hashes/esm/sha2.js'), bytes = await readFile(path);
  await writeFile(path, Buffer.concat([bytes, Buffer.from('\n// changed dependency\n')]));
  assert.throws(() => validateEditionPrefixSourceReceipt(receipt, { ...binding,
    dependencies: { '@noble/hashes': { ...binding.dependencies['@noble/hashes'], files: {} } } }));
  const altered = await collectEditionPrefixCodeBinding(root, head);
  assert.throws(() => validateEditionPrefixSourceReceipt(receipt, altered));
});

function custodyFixture(inputOverride = {}) {
  const input = Object.fromEntries(EDITION_PREDECESSOR_INPUTS.map(name => [name, Buffer.from('synthetic-' + name)]));
  Object.assign(input, inputOverride);
  const files = Object.fromEntries(Object.entries(input).map(([name, raw]) => [name, { member: 'private/' + name, bytes: raw.length, sha256: sha256(raw) }]));
  const archive = execFileSync('python3', ['-I', '-c', `import zipfile,io,json,sys,base64
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z:
 for n,data in json.loads(sys.stdin.read()).items(): z.writestr('private/'+n,base64.b64decode(data))
sys.stdout.buffer.write(b.getvalue())`],
  { input: JSON.stringify(Object.fromEntries(Object.entries(input).map(([name, bytes]) => [name, bytes.toString('base64')]))), maxBuffer: 1024 * 1024 });
  return { input, archive, receipt: { contract: EDITION_CUSTODY_CONTRACT,
    storage: { fileId: 'libfile_synthetic', version: 1, readBackAt: '2026-09-28T08:00:00Z' },
    archive: { bytes: archive.length, sha256: sha256(archive) }, files } };
}

test('custody requires the conflict result, nested continuation inputs and every readback member including the key', () => {
  const f = custodyFixture(); verifyEditionPredecessorCustody(f.receipt, f.archive, f.input);
  for (const name of EDITION_PREDECESSOR_INPUTS) {
    const altered = { ...f.input, [name]: Buffer.from('substituted') };
    assert.throws(() => verifyEditionPredecessorCustody(f.receipt, f.archive, altered), /custody/);
  }
  const bad = structuredClone(f.receipt); bad.files['recipient-key'].member = '../key';
  assert.throws(() => verifyEditionPredecessorCustody(bad, f.archive, f.input));
  const missing = structuredClone(f.receipt); missing.files.sealed.member = 'private/missing';
  assert.throws(() => verifyEditionPredecessorCustody(missing, f.archive, f.input), /custody-archive/);
});

test('predecessor must be the consumed Edition line failure after verified complete Work', () => {
  const collected = { status: 'failed', code: 'dump-line-limit', terminalFailureEvidence: null, individualProviderRequests: 0,
    rights: 'unreviewed', approved: 0, databaseWrites: 0, modelAdmissions: 0,
    accounting: { activeSource: 'editions', sources: { works: { complete: true, publisherChecksumsVerified: true }, editions: { complete: false } } } };
  assert.equal(validateEditionPredecessorResult(collected), collected);
  for (const mutate of [r => { r.code = 'dump-file-size-mismatch'; }, r => { r.accounting.activeSource = 'works'; },
    r => { r.accounting.sources.works.publisherChecksumsVerified = false; }, r => { r.accounting.sources.editions.complete = true; },
    r => { r.terminalFailureEvidence = {}; }, r => { r.records = []; }, r => { r.approved = 1; }]) {
    const bad = structuredClone(collected); mutate(bad); assert.throws(() => validateEditionPredecessorResult(bad));
  }
});

test('original-source child cannot be reached through changed custody or a substituted public predecessor', async t => {
  const out = await directory(t), { request } = fixture(), modules = { ...protocol, digest };
  await assert.rejects(authenticateEditionPredecessor({ out, request, modules, input: {}, custodyReceipt: {}, archive: Buffer.from('forged'),
    conflictRepo: '/not-read', continuationRepo: '/not-read' }), /custody/);
  const f = custodyFixture({ request: Buffer.from(JSON.stringify(predecessors.previousConflict)),
    'source-receipt': Buffer.from(JSON.stringify({ sourceHead: '0'.repeat(40) })), 'run-receipt': Buffer.from('{}') });
  await assert.rejects(authenticateEditionPredecessor({ out, request, modules, input: f.input, custodyReceipt: f.receipt, archive: f.archive,
    conflictRepo: '/not-read', continuationRepo: '/not-read' }), /predecessor-public-lineage-mismatch/);
  assert.deepEqual(await readdir(out), []);
});

test('manifest requires exact absolute private regular-file key and nested archive inputs', async t => {
  const root = await directory(t), manifest = {};
  for (const name of EDITION_PREDECESSOR_INPUTS) { manifest[name] = join(root, name); await writeFile(manifest[name], 'synthetic', { mode: 0o600 }); }
  const path = join(root, 'manifest.json'); await writeFile(path, JSON.stringify(manifest));
  const input = await readEditionPredecessorInputs(path); input['recipient-key'].fill(0);
  for (const name of ['recipient-key', 'continuation-custody-archive']) {
    await chmod(manifest[name], 0o644); await assert.rejects(readEditionPredecessorInputs(path), /invalid-private-input/); await chmod(manifest[name], 0o600);
  }
  await writeFile(path, JSON.stringify({ ...manifest, extra: '/private' })); await assert.rejects(readEditionPredecessorInputs(path), /manifest/);
});

test('Edition artifact verification rejects a differently named ciphertext ZIP even with matching content', () => {
  const sealed = Buffer.from('synthetic ciphertext');
  const zip = name => execFileSync('python3', ['-I', '-c', `import io,sys,zipfile
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z:z.writestr(sys.argv[1],sys.stdin.buffer.read())
sys.stdout.buffer.write(b.getvalue())`, name], { input: sealed, maxBuffer: 1024 * 1024 });
  verifyCatalogArtifactZip(zip(protocol.EDITION_PREFIX_ARTIFACT), sealed, protocol.EDITION_PREFIX_ARTIFACT);
  assert.throws(() => verifyCatalogArtifactZip(zip('open-library-conflicts-20260831.sealed.json'), sealed,
    protocol.EDITION_PREFIX_ARTIFACT), /artifact-zip-mismatch/);
});

test('preparation/recovery CLIs block CI and existing outputs with fixed errors and no private paths', async t => {
  const out = await directory(t);
  for (const [script, names, code] of [
    ['prepare', ['repo', 'source-head', 'source-receipt', 'limits', 'conflict-repo', 'continuation-repo',
      'predecessor-inputs', 'custody-receipt', 'custody-archive'], 'edition-prefix-local-preparation-failed'],
    ['recover', ['repo', 'request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt', 'conflict-repo', 'continuation-repo',
      'predecessor-inputs', 'custody-receipt', 'custody-archive'], 'edition-prefix-private-recovery-failed'],
  ]) for (const ci of ['', 'true']) {
    const result = spawnSync(process.execPath, [join(repo, `scripts/catalog/${script}-edition-prefix-diagnostic.mjs`),
      ...names.flatMap(name => ['--' + name, '/PRIVATE_SENTINEL']), '--out', out],
    { env: { ...process.env, GITHUB_ACTIONS: ci, NODE_OPTIONS: '' }, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.deepEqual(JSON.parse(result.stderr), { status: 'failed', code });
    assert.ok(!result.stderr.includes(privateCanary));
  }
});
