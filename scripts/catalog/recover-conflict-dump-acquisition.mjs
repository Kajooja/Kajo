#!/usr/bin/env node
// Offline private recovery. Receipts are operator-captured GitHub assertions;
// encryption authenticates the ciphertext, not its sender or source service.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const sha = value => createHash('sha256').update(value).digest('hex');
const check = (value, code) => { if (!value) throw new Error(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const gitHash = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => count(value) && value > 0;
const instant = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)
  && Number.isFinite(Date.parse(value));
const before = (a, b) => Math.floor(Date.parse(a) / 1000) <= Math.floor(Date.parse(b) / 1000);
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : object(value) ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
    : JSON.stringify(value);
const same = (a, b) => canonical(a) === canonical(b);
const decode = raw => new TextDecoder('utf-8', { fatal: true }).decode(raw);
const json = raw => JSON.parse(decode(raw));
const MAX_INPUT = 224 * 1024 * 1024;
const SELF = 'scripts/catalog/recover-conflict-dump-acquisition.mjs';
const CORE_HEAD = '686ac92fe5900287c0699ba69434b743e3e2515d';
const PREDECESSOR_HEAD = '8a9aefbf87870abd932dac53c6d4abae7fd0683d';
export const ORIGINAL_SNAPSHOT_SHA256 = '4ae7a429ef64faeb82386282c594a8a5d13cf49f17adc5f54a3a07d9fd136517';
export const CONFLICT_ACQUISITION_ARTIFACT_FILE = 'open-library-conflicts-20260831.sealed.json';
export const CONFLICT_ACQUISITION_WORKFLOW_PATH = '.github/workflows/catalog-book-conflict-acquisition.yml';
export const CONFLICT_ACQUISITION_REQUIRED_JOBS = Object.freeze(['validate', 'Supabase platform and forward defaults',
  'Two clean Supabase application installations', 'Existing Supabase application forward upgrade',
  'Supabase CLI installation and migration history']);
export const CONFLICT_ACQUISITION_SOURCE_FILES = Object.freeze([
  SELF, 'scripts/catalog/prepare-conflict-dump-acquisition.mjs', 'scripts/catalog/seal-conflict-dump-acquisition.mjs',
  'scripts/catalog/inspect-conflict-dump-acquisition.mjs', 'scripts/catalog/run-conflict-dump-acquisition.mjs',
  'scripts/catalog/acquire-open-library-dumps.mjs', 'scripts/catalog/open-library-dump-descriptions.mjs',
  'scripts/catalog/open-library-descriptions.mjs', 'scripts/catalog/dump-failure-evidence.mjs',
  'scripts/catalog/dump-conflict-policy.mjs', 'scripts/catalog/seal-dump-acquisition.mjs',
  'scripts/catalog/seal-full-dump-continuation.mjs', 'scripts/catalog/seal-work-prefix-diagnostic.mjs',
  'scripts/catalog/inspect-work-dump-prefix.mjs', 'scripts/catalog/prepare-dump-acquisition-request.mjs',
  'packages/catalog-contracts/index.js', 'packages/catalog-contracts/package.json',
  'package.json', 'package-lock.json', CONFLICT_ACQUISITION_WORKFLOW_PATH,
]);
const NOBLE_FILES = ['package.json', 'esm/package.json', 'esm/sha256.js', 'esm/sha2.js',
  'esm/_md.js', 'esm/_u64.js', 'esm/utils.js', 'esm/cryptoNode.js'];
const git = (repo, args, raw = false) => execFileSync('git', args, { cwd: repo,
  env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
  encoding: raw ? undefined : 'utf8', maxBuffer: 8 * 1024 * 1024,
  timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] });

export async function readConflictPrivateBytes(path, maximum, privateKey = false) {
  const info = await lstat(path);
  check(info.isFile() && !info.isSymbolicLink() && info.size <= maximum
    && (!privateKey || (info.mode & 0o077) === 0), 'invalid-private-input');
  const raw = await readFile(path);
  check(raw.length <= maximum, 'invalid-private-input');
  return raw;
}

// This check executes no repository or installed package code. All imports are
// verified before loadConflictAcquisitionModules can execute a parser or validator.
export async function collectConflictAcquisitionCodeBinding(repo, sourceHead) {
  return collectCatalogCodeBinding(repo, sourceHead, { sourceFiles: CONFLICT_ACQUISITION_SOURCE_FILES,
    executingFile: SELF, executingUrl: import.meta.url, dynamicImports: [SELF] });
}

// Shared by the distinct Edition operator. Each entrypoint supplies its fixed
// closure; historical conflict callers retain the exact default manifest.
export async function collectCatalogCodeBinding(repo, sourceHead, { sourceFiles, executingFile, executingUrl, dynamicImports }) {
  repo = resolve(repo);
  check(gitHash(sourceHead) && git(repo, ['rev-parse', 'HEAD']).trim() === sourceHead,
    'inspection-repo-head-mismatch');
  const files = {}, rawFiles = {};
  for (const path of sourceFiles) {
    const raw = await readConflictPrivateBytes(join(repo, path), 8 * 1024 * 1024);
    check(sha(raw) === sha(git(repo, ['show', `${sourceHead}:${path}`], true)), 'inspection-source-modified');
    files[path] = sha(raw); rawFiles[path] = decode(raw);
  }
  check(sha(await readConflictPrivateBytes(fileURLToPath(import.meta.url), 1024 * 1024)) === files[SELF]
    && sha(await readConflictPrivateBytes(fileURLToPath(executingUrl), 1024 * 1024)) === files[executingFile],
    'executing-inspector-source-mismatch');
  for (const [path, source] of Object.entries(rawFiles).filter(([path]) => /\.(?:mjs|js)$/.test(path))) {
    check(dynamicImports.includes(path) || !/\bimport\s*\(/.test(source), 'unreviewed-dynamic-import');
    for (const match of source.matchAll(/(?:^|\n)\s*(?:import\s+(?:[\s\S]*?\sfrom\s+)?|export\s+[^;]*?\sfrom\s+)['"]([^'"]+)['"]\s*;/g)) {
      const name = match[1];
      if (name.startsWith('node:')) continue;
      if (path === 'packages/catalog-contracts/index.js' && ['@noble/hashes/sha256', '@noble/hashes/utils'].includes(name)) continue;
      const target = name === '@kajo/catalog-contracts' ? 'packages/catalog-contracts/index.js'
        : name.startsWith('.') ? posix.normalize(posix.join(posix.dirname(path), name)) : null;
      check(target && Object.hasOwn(files, target), 'unbound-source-import');
    }
  }
  // Resolve actual ESM conditions in a fresh Node process. A cached CommonJS
  // require.resolve result cannot authenticate an import-only package route.
  const resolver = `const contracts=import.meta.resolve('@kajo/catalog-contracts',process.argv[1]);
const sha256=import.meta.resolve('@noble/hashes/sha256',contracts);
const utils=import.meta.resolve('@noble/hashes/utils',contracts);
const crypto=import.meta.resolve('@noble/hashes/crypto',utils);
console.log(JSON.stringify({contracts,sha256,utils,crypto}));`;
  const resolved = JSON.parse(execFileSync(process.execPath, ['--experimental-import-meta-resolve', '--input-type=module',
    '-e', resolver, pathToFileURL(join(repo, 'scripts/catalog/open-library-descriptions.mjs')).href],
  { cwd: repo, encoding: 'utf8', timeout: 30000, maxBuffer: 8192,
    env: { ...process.env, NODE_OPTIONS: '' }, stdio: ['ignore', 'pipe', 'ignore'] }));
  const contracts = fileURLToPath(resolved.contracts);
  check(sha(await readConflictPrivateBytes(join(dirname(contracts), 'package.json'), 1024 * 1024))
    === files['packages/catalog-contracts/package.json'], 'inspection-linked-contract-metadata-modified');
  check(sha(await readConflictPrivateBytes(contracts, 1024 * 1024)) === files['packages/catalog-contracts/index.js'],
    'inspection-linked-contract-modified');
  const dependencyRoot = resolve(dirname(fileURLToPath(resolved.sha256)), '..');
  check(['sha256', 'utils', 'crypto'].every(name => fileURLToPath(resolved[name]) === join(dependencyRoot,
    `esm/${name === 'crypto' ? 'cryptoNode' : name}.js`)), 'inspection-dependency-route-mismatch');
  const dependencyFiles = {};
  for (const path of NOBLE_FILES) dependencyFiles[path] = sha(await readConflictPrivateBytes(join(dependencyRoot, path), 1024 * 1024));
  const installed = json(await readConflictPrivateBytes(join(dependencyRoot, 'package.json'), 1024 * 1024));
  const lock = JSON.parse(rawFiles['package-lock.json']).packages['node_modules/@noble/hashes'];
  check(installed.name === '@noble/hashes' && installed.version === '1.8.0' && lock.version === installed.version
    && typeof lock.integrity === 'string' && /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(lock.integrity)
    && installed.exports['./sha256'].import === './esm/sha256.js'
    && installed.exports['./utils'].import === './esm/utils.js'
    && installed.exports['./crypto'].node.import === './esm/cryptoNode.js', 'inspection-dependency-mismatch');
  for (const path of NOBLE_FILES.filter(path => path.endsWith('.js'))) {
    const source = decode(await readConflictPrivateBytes(join(dependencyRoot, path), 1024 * 1024));
    check(!/\bimport\s*\(/.test(source), 'unreviewed-dependency-import');
    for (const match of source.matchAll(/(?:import|export)\s+[^;]*?\sfrom\s+['"]([^'"]+)['"]/g)) {
      const name = match[1];
      if (name.startsWith('node:')) continue;
      const target = name === '@noble/hashes/crypto' ? 'esm/cryptoNode.js'
        : name.startsWith('.') ? posix.normalize(posix.join(posix.dirname(path), name)) : null;
      check(target && Object.hasOwn(dependencyFiles, target), 'unbound-dependency-import');
    }
  }
  return { sourceHead, sourceTree: git(repo, ['rev-parse', `${sourceHead}^{tree}`]).trim(), files,
    dependencies: { '@noble/hashes': { version: lock.version, integrity: lock.integrity, files: dependencyFiles } } };
}

export function validateConflictAcquisitionSourceReceipt(s, codeBinding) {
  return validateCatalogSourceReceipt(s, codeBinding, 'kajo-conflict-acquisition-source-acceptance-v1');
}

export function validateCatalogSourceReceipt(s, codeBinding, expectedContract) {
  const ci = s?.ci;
  check(s?.contract === expectedContract
    && s.sourceHead === codeBinding.sourceHead && s.sourceTree === codeBinding.sourceTree
    && gitHash(s.reviewedHead) && positive(s.sourcePr) && positive(s.tests) && s.exports === 4
    && same(s.files, codeBinding.files) && same(s.dependencies, codeBinding.dependencies)
    && instant(s.acceptedAt) && positive(ci?.id) && ci.headSha === s.reviewedHead
    && ci.repository === 'Kajooja/Kajo' && ci.event === 'pull_request' && ci.path === '.github/workflows/ci.yml'
    && ci.status === 'completed' && ci.conclusion === 'success'
    && ci.url === `https://github.com/Kajooja/Kajo/actions/runs/${ci.id}`
    && instant(ci.createdAt) && instant(ci.updatedAt) && before(ci.createdAt, ci.updatedAt)
    && before(ci.updatedAt, s.acceptedAt)
    && Array.isArray(s.requiredJobs) && s.requiredJobs.length === 5
    && new Set(s.requiredJobs.map(job => job.id)).size === 5
    && CONFLICT_ACQUISITION_REQUIRED_JOBS.every(name => s.requiredJobs.filter(job => job.name === name && positive(job.id)
      && job.runId === ci.id && job.status === 'completed' && job.conclusion === 'success').length === 1),
  'source-acceptance-receipt-mismatch');
  return s;
}

export async function verifyConflictAcquisitionSource({ repo, sourceReceipt, sourceHead }) {
  const codeBinding = await collectConflictAcquisitionCodeBinding(repo, sourceHead);
  validateConflictAcquisitionSourceReceipt(sourceReceipt, codeBinding);
  git(repo, ['merge-base', '--is-ancestor', CORE_HEAD, sourceHead]);
  check(git(repo, ['rev-parse', `${sourceReceipt.reviewedHead}^{tree}`]).trim() === codeBinding.sourceTree,
    'reviewed-source-tree-mismatch');
  return codeBinding;
}

export async function loadConflictAcquisitionModules(repo, sourceHead, sourceReceipt) {
  const codeBinding = await verifyConflictAcquisitionSource({ repo, sourceHead, sourceReceipt });
  const modules = {};
  for (const path of ['open-library-descriptions', 'open-library-dump-descriptions', 'dump-conflict-policy',
    'seal-dump-acquisition', 'seal-work-prefix-diagnostic', 'seal-full-dump-continuation',
    'seal-conflict-dump-acquisition', 'inspect-conflict-dump-acquisition', 'run-conflict-dump-acquisition'])
    Object.assign(modules, await import(pathToFileURL(join(resolve(repo), `scripts/catalog/${path}.mjs`))));
  return { ...modules, codeBinding };
}

export function verifyConflictAcquisitionArtifactZip(zip, sealed) {
  return verifyCatalogArtifactZip(zip, sealed, CONFLICT_ACQUISITION_ARTIFACT_FILE);
}

export function verifyCatalogArtifactZip(zip, sealed, artifactFile) {
  check(Buffer.isBuffer(zip) && zip.length <= MAX_INPUT && Buffer.isBuffer(sealed) && sealed.length <= MAX_INPUT,
    'invalid-artifact-size');
  // Read hash-bound bytes, not a second pathname. Only ciphertext enters Python.
  const script = `import zipfile,hashlib,io,sys,stat\nwith zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:\n assert z.namelist()==[sys.argv[1]]\n i=z.infolist()[0]\n assert i.file_size==int(sys.argv[3]) and not i.is_dir() and not(i.flag_bits&1)\n assert stat.S_IFMT(i.external_attr>>16) in (0,stat.S_IFREG)\n assert i.compress_type in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED)\n assert z.testzip() is None\n assert hashlib.sha256(z.read(i)).hexdigest()==sys.argv[2]\n`;
  try { execFileSync('python3', ['-I', '-c', script, artifactFile, sha(sealed), String(sealed.length)],
    { input: zip, maxBuffer: 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'ignore'] }); }
  catch { throw new Error('artifact-zip-mismatch'); }
}

export function validateConflictAcquisitionReceipts({ request, collected, sourceReceipt: s, runReceipt: r,
  envelope, zip, sealed, modules }) {
  return validateCatalogAcquisitionReceipts({ request, collected, sourceReceipt: s, runReceipt: r, envelope, zip, sealed, modules },
    { sourceContract: 'kajo-conflict-acquisition-source-acceptance-v1', runtimeContract: 'kajo-conflict-acquisition-runtime-receipt-v1',
      workflowPath: CONFLICT_ACQUISITION_WORKFLOW_PATH, artifactFile: CONFLICT_ACQUISITION_ARTIFACT_FILE,
      artifactPrefix: 'kajo-book-conflicts-sealed', branch: modules.CONFLICT_REQUEST_BRANCH });
}

export function validateCatalogAcquisitionReceipts({ request, collected, sourceReceipt: s, runReceipt: r,
  envelope, zip, sealed, modules }, { sourceContract, runtimeContract, workflowPath, artifactFile, artifactPrefix, branch }) {
  validateCatalogSourceReceipt(s, modules.codeBinding, sourceContract);
  const run = r?.run, artifact = r?.artifact;
  check(s.requestSha256 === request.requestSha256 && gitHash(s.requestHead) && gitHash(s.requestTree)
    && s.recipientFingerprint === request.recipientFingerprint && s.targets === request.roster.length
    && s.policySha256 === modules.digest(request.conflictPolicy),
  'source-request-receipt-mismatch');
  check(r?.contract === runtimeContract && r.sourceHead === request.sourceHead
    && r.requestSha256 === request.requestSha256 && positive(run?.id) && run.runAttempt === 1
    && run.repository === 'Kajooja/Kajo' && run.event === 'push'
    && run.headBranch === branch && run.headSha === s.requestHead
    && run.path === workflowPath && run.url === `https://github.com/Kajooja/Kajo/actions/runs/${run.id}`
    && run.status === 'completed' && run.conclusion === (collected.status === 'failed' ? 'failure' : 'success')
    && instant(run.createdAt) && instant(run.updatedAt) && before(run.createdAt, run.updatedAt)
    && before(s.acceptedAt, run.createdAt), 'run-receipt-mismatch');
  check(positive(artifact?.id) && artifact.name === `${artifactPrefix}-${run.id}`
    && artifact.workflowRunId === run.id && artifact.headSha === s.requestHead && artifact.headBranch === run.headBranch
    && artifact.expired === false && artifact.singleMember === artifactFile
    && artifact.zipCrcVerified === true && artifact.authenticatedUnsealVerified === true
    && artifact.zipBytes === zip.length && artifact.zipSha256 === sha(zip)
    && artifact.sealedFileSha256 === sha(sealed) && artifact.recoveredPlaintextSha256 === envelope.header.plaintextSha256
    && instant(artifact.createdAt) && instant(artifact.updatedAt)
    && before(run.createdAt, artifact.createdAt) && before(artifact.createdAt, artifact.updatedAt)
    && before(artifact.updatedAt, run.updatedAt)
    && (artifact.githubDigest === null || artifact.githubDigest === `sha256:${sha(zip)}`), 'artifact-receipt-mismatch');
  check(hash(envelope.header.plaintextSha256) && envelope.header.sourceHead === request.sourceHead
    && envelope.header.requestSha256 === request.requestSha256 && envelope.header.recipientFingerprint === request.recipientFingerprint
    && envelope.header.rosterSha256 === modules.digest(request.roster), 'sealed-binding-mismatch');
  const started = collected.retrievedAt ?? collected.accounting?.startedAt;
  const ended = collected.completedAt ?? collected.accounting?.failedAt;
  check(instant(started) && instant(ended) && Date.parse(started) >= Date.parse(run.createdAt)
    && before(ended, run.updatedAt) && Date.parse(ended) >= Date.parse(started), 'run-time-binding-mismatch');
  return { sourceHead: s.sourceHead, sourceTree: s.sourceTree, reviewedHead: s.reviewedHead,
    sourcePr: s.sourcePr, ciRunId: s.ci.id, requestHead: s.requestHead, requestTree: s.requestTree,
    requestSha256: request.requestSha256, policySha256: modules.digest(request.conflictPolicy), runId: run.id, artifactId: artifact.id,
    zipSha256: sha(zip), sealedSha256: sha(sealed), plaintextSha256: envelope.header.plaintextSha256,
    receiptProvenance: 'operator-captured GitHub evidence checked against local Git and bytes; recipient encryption alone is not sender authentication' };
}

export function validateConflictAcquisitionGit(repo, request, sourceReceipt, modules) {
  const s = sourceReceipt;
  check(gitHash(s.requestHead) && gitHash(s.requestTree), 'invalid-request-git-identity');
  check(git(repo, ['rev-parse', `${s.requestHead}^{tree}`]).trim() === s.requestTree, 'request-git-tree-mismatch');
  const committed = json(git(repo, ['show', `${s.requestHead}:${modules.CONFLICT_REQUEST_PATH}`], true));
  check(same(committed, request), 'request-git-bytes-mismatch');
  check(git(repo, ['show', '-s', '--format=%P', s.requestHead]).trim() === request.sourceHead
    && git(repo, ['diff', '--name-status', '--no-renames', request.sourceHead, s.requestHead])
      === `A\t${modules.CONFLICT_REQUEST_PATH}\n`, 'request-git-parent-or-diff-mismatch');
  const read = (identity, path) => json(git(repo, ['show', `${identity.requestHead}:${path}`], true));
  const predecessors = {
    previousContinuation: read(modules.CONFLICT_PREVIOUS_CONTINUATION, modules.FULL_CONTINUATION_REQUEST_PATH),
    reviewedRequest: read(modules.FULL_CONTINUATION_PREVIOUS_REVIEWED, modules.REVIEWED_REQUEST_PATH),
    prefixRequest: read(modules.FULL_CONTINUATION_PREVIOUS_PREFIX, modules.WORK_PREFIX_REQUEST_PATH),
    originalRequest: read(modules.DIAGNOSTIC_PREVIOUS_ACQUISITION, modules.REQUEST_PATH),
    diagnosticRequest: read(modules.REVIEWED_PREVIOUS_DIAGNOSTIC, modules.DIAGNOSTIC_REQUEST_PATH),
  };
  modules.validateConflictAcquisitionCommit({ sourceHead: request.sourceHead, requestHead: s.requestHead,
    parents: request.sourceHead, changes: `A\t${modules.CONFLICT_REQUEST_PATH}\n`, request, ...predecessors });
  return predecessors;
}

export async function claimConflictPrivateOutput(path) {
  check(typeof path === 'string' && path.length > 0, 'invalid-private-output');
  const out = resolve(path);
  for (let parent = dirname(out); parent !== dirname(parent); parent = dirname(parent)) {
    const info = await lstat(parent);
    check(info.isDirectory() && !info.isSymbolicLink(), 'unsafe-output-parent');
  }
  await mkdir(out, { mode: 0o700 });
  return out;
}

export const CONFLICT_PREDECESSOR_INPUTS = Object.freeze(['request', 'prefix-sealed', 'sealed', 'artifact-zip',
  'recipient-key', 'snapshot', 'source-receipt', 'run-receipt']);
const exact = (value, keys) => object(value) && same(Object.keys(value).sort(), [...keys].sort());

export async function readConflictPredecessorInputs(manifestPath) {
  return readCatalogPrivateInputs(manifestPath, CONFLICT_PREDECESSOR_INPUTS);
}

export async function readCatalogPrivateInputs(manifestPath, keys,
  { largeNames = ['sealed', 'artifact-zip'], privateNames = ['recipient-key'] } = {}) {
  const manifest = json(await readConflictPrivateBytes(manifestPath, 1024 * 1024));
  check(exact(manifest, keys), 'invalid-predecessor-input-manifest');
  const input = {};
  try {
    for (const name of keys) {
      check(typeof manifest[name] === 'string' && resolve(manifest[name]) === manifest[name], 'invalid-predecessor-input-path');
      input[name] = await readConflictPrivateBytes(manifest[name], name === 'recipient-key' ? 8192
        : largeNames.includes(name) ? MAX_INPUT : 8 * 1024 * 1024, privateNames.includes(name));
    }
    return input;
  } catch (error) { input['recipient-key']?.fill(0); throw error; }
}

// The receipt is a private operator-captured durable readback assertion. Verify
// its actual archive and every required member; never publish these commitments.
export function verifyConflictPredecessorCustody(receipt, archive, input) {
  return verifyCatalogPredecessorCustody(receipt, archive, input,
    { contract: 'kajo-conflict-predecessor-custody-v1', keys: CONFLICT_PREDECESSOR_INPUTS });
}

export function verifyCatalogPredecessorCustody(receipt, archive, input, { contract, keys }) {
  check(exact(receipt, ['contract', 'storage', 'archive', 'files'])
    && receipt.contract === contract
    && exact(receipt.storage, ['fileId', 'version', 'readBackAt'])
    && typeof receipt.storage.fileId === 'string' && /^libfile_[A-Za-z0-9]+$/.test(receipt.storage.fileId)
    && positive(receipt.storage.version) && instant(receipt.storage.readBackAt)
    && exact(receipt.archive, ['bytes', 'sha256']) && Buffer.isBuffer(archive) && archive.length <= MAX_INPUT
    && receipt.archive.bytes === archive.length && receipt.archive.sha256 === sha(archive)
    && exact(receipt.files, keys), 'predecessor-custody-mismatch');
  const members = {};
  for (const name of keys) {
    const entry = receipt.files[name], raw = input[name];
    check(exact(entry, ['member', 'bytes', 'sha256']) && typeof entry.member === 'string'
      && entry.member.length < 512 && !entry.member.includes('\\') && !entry.member.startsWith('/')
      && entry.member.split('/').every(part => part && part !== '.' && part !== '..')
      && !Object.hasOwn(members, entry.member) && Buffer.isBuffer(raw)
      && entry.bytes === raw.length && entry.sha256 === sha(raw), 'predecessor-custody-mismatch');
    members[entry.member] = { bytes: entry.bytes, sha256: entry.sha256 };
  }
  const script = `import zipfile,hashlib,io,sys,json,stat
expected=json.loads(sys.argv[1])
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
 infos=z.infolist()
 assert len(infos)<=256 and len(z.namelist())==len(set(z.namelist()))
 assert sum(i.file_size for i in infos)<=224*1024*1024
 assert all(not(i.flag_bits&1) and stat.S_IFMT(i.external_attr>>16) in (0,stat.S_IFREG,stat.S_IFDIR)
            and i.compress_type in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED) for i in infos)
 assert all(not n.startswith('/') and chr(92) not in n and all(p not in ('','.','..') for p in n.rstrip('/').split('/')) for n in z.namelist())
 assert z.testzip() is None
 for name,want in expected.items():
  i=z.getinfo(name)
  assert not i.is_dir() and i.file_size==want['bytes']
  assert hashlib.sha256(z.read(i)).hexdigest()==want['sha256']
`;
  try { execFileSync('python3', ['-I', '-c', script, JSON.stringify(members)],
    { input: archive, maxBuffer: 1024, timeout: 60000, stdio: ['pipe', 'ignore', 'ignore'] }); }
  catch { throw new Error('predecessor-custody-archive-mismatch'); }
  return { archiveSha256: sha(archive), storage: structuredClone(receipt.storage),
    scope: 'operator-captured durable readback, verified against supplied archive and input bytes' };
}

// Freeze the historical inspector at its original accepted Git object. Execute
// it in a fresh process so today's parser/ESM cache cannot rewrite old evidence.
export async function authenticateConflictPredecessor({ previousRepo, input, custodyReceipt, archive, out, request, modules }) {
  const custody = verifyConflictPredecessorCustody(custodyReceipt, archive, input);
  const previous = json(input.request), source = json(input['source-receipt']), run = json(input['run-receipt']);
  modules.validateConflictDumpAcquisitionPredecessor(request, previous);
  const identity = modules.CONFLICT_PREVIOUS_CONTINUATION;
  check(source.sourceHead === identity.sourceHead && source.requestHead === identity.requestHead
    && source.requestSha256 === identity.requestSha256 && String(run.run?.id) === identity.runId
    && before(run.run.updatedAt, custodyReceipt.storage.readBackAt), 'predecessor-public-lineage-mismatch');
  const scriptPath = 'scripts/catalog/inspect-full-dump-continuation.mjs';
  check(git(previousRepo, ['rev-parse', 'HEAD']).trim() === PREDECESSOR_HEAD
    && sha(await readConflictPrivateBytes(join(previousRepo, scriptPath), 1024 * 1024))
      === sha(git(previousRepo, ['show', `${PREDECESSOR_HEAD}:${scriptPath}`], true)), 'historical-inspector-source-mismatch');
  const staged = await claimConflictPrivateOutput(join(out, 'predecessor-inputs'));
  const args = ['--repo', resolve(previousRepo), '--out', join(out, 'predecessor-inspection')];
  try {
    for (const name of CONFLICT_PREDECESSOR_INPUTS) {
      const path = join(staged, name);
      await writeFile(path, input[name], { flag: 'wx', mode: 0o600 });
      args.push(`--${name}`, path);
    }
    try { execFileSync(process.execPath, [join(resolve(previousRepo), scriptPath), ...args],
      { cwd: resolve(previousRepo), env: { ...process.env, NODE_OPTIONS: '', GIT_NO_REPLACE_OBJECTS: '1' },
        timeout: 60000, maxBuffer: 4096, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { throw new Error('predecessor-authentication-failed'); }
  } finally { await unlink(join(staged, 'recipient-key')).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  const collected = json(await readConflictPrivateBytes(join(out, 'predecessor-inspection/collected.json'), MAX_INPUT));
  check(collected.status === 'failed', 'predecessor-must-be-consumed-failure');
  const evidence = collected.accounting?.failureEvidence;
  check(evidence, 'predecessor-conflict-evidence-unavailable');
  const ledger = modules.createDumpConflictLedger({ policy: request.conflictPolicy, selected: request.roster });
  ledger.record(evidence, { source: request.sourcePins[evidence.sourceKind], limits: request.limits });
  const replay = ledger.snapshot();
  const proof = { contract: 'kajo-conflict-predecessor-proof-v1', custody,
    previousContinuation: { ...identity }, requestSha256: request.requestSha256,
    policySha256: modules.digest(request.conflictPolicy), quarantine: replay,
    inputFiles: Object.fromEntries(Object.entries(input).filter(([name]) => name !== 'recipient-key').map(([name, raw]) => [name, sha(raw)])),
    approved: 0, databaseWrites: 0, providerRequests: 0 };
  await writeFile(join(out, 'predecessor-proof.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return proof;
}

export async function runConflictAcquisitionRecovery(args = process.argv.slice(2)) {
  check(!process.env.GITHUB_ACTIONS, 'conflict-acquisition-recovery-local-only');
  const names = ['repo', 'request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt', 'current-snapshot',
    'predecessor-repo', 'predecessor-inputs', 'custody-receipt', 'custody-archive', 'out'];
  const { values } = parseArgs({ args, options: Object.fromEntries(names.map(name => [name, { type: 'string' }])) });
  check(names.filter(name => name !== 'current-snapshot').every(name => values[name]), 'invalid-conflict-recovery-command');
  const out = await claimConflictPrivateOutput(values.out), input = {};
  for (const name of ['request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt', 'current-snapshot', 'custody-receipt', 'custody-archive'])
    if (values[name]) input[name] = await readConflictPrivateBytes(values[name], ['sealed', 'artifact-zip', 'custody-archive'].includes(name)
      ? MAX_INPUT : 8 * 1024 * 1024, name === 'custody-archive');
  const request = json(input.request), sourceReceipt = json(input['source-receipt']);
  const modules = await loadConflictAcquisitionModules(values.repo, request.sourceHead, sourceReceipt);
  modules.validateConflictDumpAcquisitionRequest(request);
  validateConflictAcquisitionGit(values.repo, request, sourceReceipt, modules);
  verifyConflictAcquisitionArtifactZip(input['artifact-zip'], input.sealed);
  const previousInput = await readConflictPredecessorInputs(values['predecessor-inputs']);
  try {
    await authenticateConflictPredecessor({ previousRepo: values['predecessor-repo'], input: previousInput,
      custodyReceipt: json(input['custody-receipt']), archive: input['custody-archive'], out, request, modules });
    const snapshot = json(previousInput.snapshot);
    check(modules.digest(snapshot) === ORIGINAL_SNAPSHOT_SHA256, 'original-snapshot-mismatch');
    const envelope = json(input.sealed);
    const collected = modules.unsealConflictDumpAcquisition(envelope, request, previousInput['recipient-key']);
    const binding = validateConflictAcquisitionReceipts({ request, collected, sourceReceipt,
      runReceipt: json(input['run-receipt']), envelope, zip: input['artifact-zip'], sealed: input.sealed, modules });
    const result = modules.inspectConflictDumpPayload({ request, result: collected, originalSnapshot: snapshot,
      freshSnapshot: input['current-snapshot'] ? json(input['current-snapshot']) : undefined });
    // Keep the core's consistency-only label. This additional, narrower field
    // states exactly which operator assertions have been checked.
    result.summary.operatorProvenance = { status: 'verified-against-supplied-receipts', binding };
    result.summary.codeBinding = modules.codeBinding;
    result.summary.inputFiles = Object.fromEntries(Object.entries(input).map(([name, raw]) => [name, sha(raw)]));
    for (const [name, value] of Object.entries({ collected, candidates: result.candidates, quarantine: result.quarantine,
      reconciliation: result.reconciliation, summary: result.summary }))
      await writeFile(join(out, `${name}.json`), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ status: 'recovered', result: collected.status, requestSha256: request.requestSha256,
      candidates: result.candidates.length, approved: 0, databaseWrites: 0, inspectionSourceRequests: 0 }));
    return result;
  } finally { previousInput['recipient-key'].fill(0); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runConflictAcquisitionRecovery().catch(() => {
    console.error(JSON.stringify({ status: 'inspection-failed', code: 'conflict-acquisition-private-recovery-failed' }));
    process.exitCode = 1;
  });
}
