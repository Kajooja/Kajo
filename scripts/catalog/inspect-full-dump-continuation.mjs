#!/usr/bin/env node
// Offline private recovery. Receipts are operator-captured GitHub assertions;
// encryption authenticates the ciphertext, not its sender or source service.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
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
const dumpInstant = value => typeof value === 'string'
  && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)
  && Number.isFinite(timeValue(value));
const timeValue = value => Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');
const before = (a, b) => Math.floor(Date.parse(a) / 1000) <= Math.floor(Date.parse(b) / 1000);
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : object(value) ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
    : JSON.stringify(value);
const same = (a, b) => canonical(a) === canonical(b);
const decode = raw => new TextDecoder('utf-8', { fatal: true }).decode(raw);
const json = raw => JSON.parse(decode(raw));
const MAX_INPUT = 224 * 1024 * 1024;
const SELF = 'scripts/catalog/inspect-full-dump-continuation.mjs';
const CORRECTION_HEAD = '8c4d8ecf65187f12bb30ed4207d03848fd87d292';
export const ORIGINAL_SNAPSHOT_SHA256 = '4ae7a429ef64faeb82386282c594a8a5d13cf49f17adc5f54a3a07d9fd136517';
export const FULL_CONTINUATION_ARTIFACT_FILE = 'open-library-continuation-20260831.sealed.json';
export const FULL_CONTINUATION_WORKFLOW_PATH = '.github/workflows/catalog-book-full-continuation.yml';
export const FULL_CONTINUATION_REQUIRED_JOBS = Object.freeze(['validate', 'Supabase platform and forward defaults',
  'Two clean Supabase application installations', 'Existing Supabase application forward upgrade',
  'Supabase CLI installation and migration history']);
export const FULL_CONTINUATION_SOURCE_FILES = Object.freeze([
  SELF, 'scripts/catalog/prepare-full-dump-continuation.mjs', 'scripts/catalog/seal-full-dump-continuation.mjs',
  'scripts/catalog/run-full-dump-continuation.mjs', 'scripts/catalog/acquire-open-library-dumps.mjs',
  'scripts/catalog/open-library-dump-descriptions.mjs', 'scripts/catalog/open-library-descriptions.mjs',
  'scripts/catalog/dump-failure-evidence.mjs', 'scripts/catalog/dump-conflict-policy.mjs',
  'scripts/catalog/seal-dump-acquisition.mjs',
  'scripts/catalog/seal-work-prefix-diagnostic.mjs', 'scripts/catalog/inspect-work-dump-prefix.mjs',
  'scripts/catalog/prepare-dump-acquisition-request.mjs', 'packages/catalog-contracts/index.js',
  'packages/catalog-contracts/package.json', 'package.json', 'package-lock.json', FULL_CONTINUATION_WORKFLOW_PATH,
]);
const NOBLE_FILES = ['package.json', 'esm/package.json', 'esm/sha256.js', 'esm/sha2.js',
  'esm/_md.js', 'esm/_u64.js', 'esm/utils.js', 'esm/cryptoNode.js'];
const git = (repo, args, raw = false) => execFileSync('git', args, { cwd: repo,
  env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
  encoding: raw ? undefined : 'utf8', maxBuffer: 8 * 1024 * 1024,
  timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] });

async function bytes(path, maximum, privateKey = false) {
  const info = await lstat(path);
  check(info.isFile() && !info.isSymbolicLink() && info.size <= maximum
    && (!privateKey || (info.mode & 0o077) === 0), 'invalid-private-input');
  const raw = await readFile(path);
  check(raw.length <= maximum, 'invalid-private-input');
  return raw;
}

// This check executes no repository or installed package code. All imports are
// verified before loadFullContinuationModules can execute a parser or validator.
export async function collectFullContinuationCodeBinding(repo, sourceHead) {
  repo = resolve(repo);
  check(gitHash(sourceHead) && git(repo, ['rev-parse', 'HEAD']).trim() === sourceHead,
    'inspection-repo-head-mismatch');
  const files = {}, rawFiles = {};
  for (const path of FULL_CONTINUATION_SOURCE_FILES) {
    const raw = await bytes(join(repo, path), 8 * 1024 * 1024);
    check(sha(raw) === sha(git(repo, ['show', `${sourceHead}:${path}`], true)), 'inspection-source-modified');
    files[path] = sha(raw); rawFiles[path] = decode(raw);
  }
  check(sha(await bytes(fileURLToPath(import.meta.url), 1024 * 1024)) === files[SELF],
    'executing-inspector-source-mismatch');
  for (const [path, source] of Object.entries(rawFiles).filter(([path]) => /\.(?:mjs|js)$/.test(path))) {
    check(path === SELF || !/\bimport\s*\(/.test(source), 'unreviewed-dynamic-import');
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
  check(sha(await bytes(join(dirname(contracts), 'package.json'), 1024 * 1024))
    === files['packages/catalog-contracts/package.json'], 'inspection-linked-contract-metadata-modified');
  check(sha(await bytes(contracts, 1024 * 1024)) === files['packages/catalog-contracts/index.js'],
    'inspection-linked-contract-modified');
  const dependencyRoot = resolve(dirname(fileURLToPath(resolved.sha256)), '..');
  check(['sha256', 'utils', 'crypto'].every(name => fileURLToPath(resolved[name]) === join(dependencyRoot,
    `esm/${name === 'crypto' ? 'cryptoNode' : name}.js`)), 'inspection-dependency-route-mismatch');
  const dependencyFiles = {};
  for (const path of NOBLE_FILES) dependencyFiles[path] = sha(await bytes(join(dependencyRoot, path), 1024 * 1024));
  const installed = json(await bytes(join(dependencyRoot, 'package.json'), 1024 * 1024));
  const lock = JSON.parse(rawFiles['package-lock.json']).packages['node_modules/@noble/hashes'];
  check(installed.name === '@noble/hashes' && installed.version === '1.8.0' && lock.version === installed.version
    && typeof lock.integrity === 'string' && /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(lock.integrity)
    && installed.exports['./sha256'].import === './esm/sha256.js'
    && installed.exports['./utils'].import === './esm/utils.js'
    && installed.exports['./crypto'].node.import === './esm/cryptoNode.js', 'inspection-dependency-mismatch');
  for (const path of NOBLE_FILES.filter(path => path.endsWith('.js'))) {
    const source = decode(await bytes(join(dependencyRoot, path), 1024 * 1024));
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

export function validateFullContinuationSourceReceipt(s, codeBinding) {
  const ci = s?.ci;
  check(s?.contract === 'kajo-full-continuation-source-acceptance-v1'
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
    && FULL_CONTINUATION_REQUIRED_JOBS.every(name => s.requiredJobs.filter(job => job.name === name && positive(job.id)
      && job.runId === ci.id && job.status === 'completed' && job.conclusion === 'success').length === 1),
  'source-acceptance-receipt-mismatch');
  return s;
}

export async function verifyFullContinuationSource({ repo, sourceReceipt, sourceHead }) {
  const codeBinding = await collectFullContinuationCodeBinding(repo, sourceHead);
  validateFullContinuationSourceReceipt(sourceReceipt, codeBinding);
  git(repo, ['merge-base', '--is-ancestor', CORRECTION_HEAD, sourceHead]);
  check(git(repo, ['rev-parse', `${sourceReceipt.reviewedHead}^{tree}`]).trim() === codeBinding.sourceTree,
    'reviewed-source-tree-mismatch');
  return codeBinding;
}

export async function loadFullContinuationModules(repo, sourceHead, sourceReceipt) {
  const codeBinding = await verifyFullContinuationSource({ repo, sourceHead, sourceReceipt });
  const modules = {};
  for (const path of FULL_CONTINUATION_SOURCE_FILES.filter(path => path.startsWith('scripts/')
    && path.endsWith('.mjs') && path !== SELF)) Object.assign(modules, await import(pathToFileURL(join(resolve(repo), path))));
  return { ...modules, codeBinding };
}

export function verifyFullContinuationArtifactZip(zip, sealed) {
  check(Buffer.isBuffer(zip) && zip.length <= MAX_INPUT && Buffer.isBuffer(sealed) && sealed.length <= MAX_INPUT,
    'invalid-artifact-size');
  // Read hash-bound bytes, not a second pathname. Only ciphertext enters Python.
  const script = `import zipfile,hashlib,io,sys,stat\nwith zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:\n assert z.namelist()==[sys.argv[1]]\n i=z.infolist()[0]\n assert i.file_size==int(sys.argv[3]) and not i.is_dir() and not(i.flag_bits&1)\n assert stat.S_IFMT(i.external_attr>>16) in (0,stat.S_IFREG)\n assert i.compress_type in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED)\n assert z.testzip() is None\n assert hashlib.sha256(z.read(i)).hexdigest()==sys.argv[2]\n`;
  try { execFileSync('python3', ['-I', '-c', script, FULL_CONTINUATION_ARTIFACT_FILE, sha(sealed), String(sealed.length)],
    { input: zip, maxBuffer: 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'ignore'] }); }
  catch { throw new Error('artifact-zip-mismatch'); }
}

export function validateFullContinuationReceipts({ request, collected, sourceReceipt: s, runReceipt: r,
  envelope, zip, sealed, modules }) {
  validateFullContinuationSourceReceipt(s, modules.codeBinding);
  const run = r?.run, artifact = r?.artifact;
  check(s.requestSha256 === request.requestSha256 && gitHash(s.requestHead) && gitHash(s.requestTree)
    && s.recipientFingerprint === request.recipientFingerprint && s.targets === request.roster.length,
  'source-request-receipt-mismatch');
  check(r?.contract === 'kajo-full-continuation-runtime-receipt-v1' && r.sourceHead === request.sourceHead
    && r.requestSha256 === request.requestSha256 && positive(run?.id) && run.runAttempt === 1
    && run.repository === 'Kajooja/Kajo' && run.event === 'push'
    && run.headBranch === modules.FULL_CONTINUATION_REQUEST_BRANCH && run.headSha === s.requestHead
    && run.path === FULL_CONTINUATION_WORKFLOW_PATH && run.url === `https://github.com/Kajooja/Kajo/actions/runs/${run.id}`
    && run.status === 'completed' && run.conclusion === (collected.status === 'failed' ? 'failure' : 'success')
    && instant(run.createdAt) && instant(run.updatedAt) && before(run.createdAt, run.updatedAt)
    && before(s.acceptedAt, run.createdAt), 'run-receipt-mismatch');
  check(positive(artifact?.id) && artifact.name === `kajo-book-continuation-sealed-${run.id}`
    && artifact.workflowRunId === run.id && artifact.headSha === s.requestHead && artifact.headBranch === run.headBranch
    && artifact.expired === false && artifact.singleMember === FULL_CONTINUATION_ARTIFACT_FILE
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
    requestSha256: request.requestSha256, runId: run.id, artifactId: artifact.id,
    zipSha256: sha(zip), sealedSha256: sha(sealed), plaintextSha256: envelope.header.plaintextSha256,
    receiptProvenance: 'operator-captured GitHub evidence checked against local Git and bytes; recipient encryption alone is not sender authentication' };
}

export function validateFullContinuationGit(repo, request, sourceReceipt, modules) {
  const s = sourceReceipt;
  check(gitHash(s.requestHead) && gitHash(s.requestTree), 'invalid-request-git-identity');
  check(git(repo, ['rev-parse', `${s.requestHead}^{tree}`]).trim() === s.requestTree, 'request-git-tree-mismatch');
  const committed = json(git(repo, ['show', `${s.requestHead}:${modules.FULL_CONTINUATION_REQUEST_PATH}`], true));
  check(same(committed, request), 'request-git-bytes-mismatch');
  check(git(repo, ['show', '-s', '--format=%P', s.requestHead]).trim() === request.sourceHead
    && git(repo, ['diff', '--name-status', '--no-renames', request.sourceHead, s.requestHead])
      === `A\t${modules.FULL_CONTINUATION_REQUEST_PATH}\n`, 'request-git-parent-or-diff-mismatch');
  const read = (identity, path) => json(git(repo, ['show', `${identity.requestHead}:${path}`], true));
  const predecessors = {
    reviewedRequest: read(modules.FULL_CONTINUATION_PREVIOUS_REVIEWED, modules.REVIEWED_REQUEST_PATH),
    prefixRequest: read(modules.FULL_CONTINUATION_PREVIOUS_PREFIX, modules.WORK_PREFIX_REQUEST_PATH),
    originalRequest: read(modules.DIAGNOSTIC_PREVIOUS_ACQUISITION, modules.REQUEST_PATH),
    diagnosticRequest: read(modules.REVIEWED_PREVIOUS_DIAGNOSTIC, modules.DIAGNOSTIC_REQUEST_PATH),
  };
  modules.validateFullDumpContinuationPredecessors(request, predecessors);
  return predecessors;
}

function reconcileSnapshots(snapshot, currentSnapshot, selected, modules) {
  check(Array.isArray(currentSnapshot?.targets) && currentSnapshot.targets.every(row => typeof row.identityMatches === 'boolean'),
    'invalid-current-snapshot');
  // False identity is a reconciliation conflict. All other shape/uniqueness and
  // version bounds still pass the canonical snapshot validator.
  modules.validateDumpTargets({ ...currentSnapshot,
    targets: currentSnapshot.targets.map(row => ({ ...row, identityMatches: true })) });
  check(timeValue(currentSnapshot.checkedAt) >= timeValue(snapshot.checkedAt), 'current-snapshot-older');
  const current = new Map(currentSnapshot.targets.map(row => [row.itemId, row]));
  return selected.map(original => {
    const row = current.get(original.itemId), changes = [];
    if (!row) changes.push('missing');
    else {
      const flags = {
        identityChanged: !row.identityMatches || ['sourceId', 'workId', 'editionId'].some(key => row[key] !== original[key]),
        itemVersionChanged: row.itemUpdatedAt !== original.itemUpdatedAt,
        sourceVersionChanged: row.sourceUpdatedAt !== original.sourceUpdatedAt,
        descriptionChanged: row.descriptionSha256 !== original.descriptionSha256,
        managedDescriptionChanged: row.managedDescription !== original.managedDescription,
        displayLanguageChanged: row.displayLanguage !== original.displayLanguage,
        nowIneligible: row.descriptionSha256 !== null || row.managedDescription,
      };
      for (const [name, changed] of Object.entries(flags)) if (changed) changes.push(name);
    }
    return { itemId: original.itemId, workId: original.workId, editionId: original.editionId,
      status: changes.length ? 'changed' : 'unchanged', changes };
  });
}

// Explicit pinned-payload adapter. The public CLI separately validates the fixed
// continuation request. Synthetic tests may exercise this lower-level adapter
// with small pinned sources, without changing historical request dispatch.
export function inspectPinnedContinuationPayload({ collected, request, snapshot, currentSnapshot, modules }) {
  modules.validatePinnedAcquisitionPayload(collected, request);
  const selected = modules.validateDumpTargets(snapshot);
  const roster = modules.validateAcquisitionRoster(selected.map(({ workId, editionId }) => ({ workId, editionId })));
  check(same(roster, request.roster), 'original-snapshot-roster-mismatch');
  const a = collected.accounting, success = collected.status === 'collected';
  const started = collected.retrievedAt ?? a.startedAt, ended = collected.completedAt ?? a.failedAt;
  check(instant(started) && instant(ended) && Date.parse(ended) >= Date.parse(started)
    && a.startedAt === started && (success ? a.completedAt === ended : a.failedAt === ended)
    && a.metadata.reason === 'reviewed-pinned-source-evidence' && collected.metadata === undefined
    && object(a.sources) && ['works', 'editions', null].includes(a.activeSource), 'invalid-continuation-accounting');
  const summary = { contract: 'kajo-private-full-continuation-inspection-v1',
    status: success ? 'verified-unreviewed-collection' : 'failed-acquisition',
    requestSha256: request.requestSha256, sourceHead: request.sourceHead, rosterSha256: modules.digest(roster),
    originalSnapshotSha256: modules.digest(snapshot), retrievedAt: started, completedAt: ended,
    rights: 'unreviewed', approved: 0, databaseWrites: 0, inspectionSourceRequests: 0,
    fullDumpBytesRetainedLocally: 0, fullDumpChecksumsRecomputedLocally: false,
    fullSourceChecksumsScope: 'Collector manifest assertions checked against publisher pins; full dump bytes are not present in recovery.' };
  let completeBytes = 0;
  for (const kind of ['works', 'editions']) {
    const source = a.sources[kind], pin = request.sourcePins[kind];
    if (!source) { check(a.requests[kind] === 0, 'source-accounting-mismatch'); continue; }
    const counters = ['bytes', 'decodedBytes', 'rows', 'matchedRecords', 'unrelatedRows', 'malformedUnrelatedRows'];
    const abortedBeforeRequest = !success && collected.code === 'acquisition-aborted' && a.requests[kind] === 0
      && source.complete === false && counters.every(key => source[key] === 0);
    check((a.requests[kind] >= 1 || abortedBeforeRequest) && source.expectedBytes === pin.bytes && typeof source.complete === 'boolean'
      && ['bytes', 'decodedBytes', 'rows', 'matchedRecords', 'unrelatedRows', 'malformedUnrelatedRows'].every(key => count(source[key]))
      && source.matchedRecords <= roster.length && source.malformedUnrelatedRows <= source.unrelatedRows,
    'source-accounting-mismatch');
    if (source.complete) {
      check(source.publisherChecksumsVerified === true && source.bytes === pin.bytes && source.md5 === pin.md5
        && source.sha1 === pin.sha1 && hash(source.sha256) && source.decodedBytes <= request.limits.maxDecodedBytes
        && source.rows <= request.limits.maxRows && source.rows === source.matchedRecords + source.unrelatedRows,
      'completed-source-accounting-mismatch');
      completeBytes += source.bytes;
    } else check(source.publisherChecksumsVerified === undefined
      && ['sha256', 'md5', 'sha1'].every(key => source[key] === undefined), 'incomplete-source-checksum-claim');
  }
  check(a.requests.editions === 0 || a.sources.works?.complete === true, 'edition-before-complete-work');
  if (!success) {
    check(collected.code === modules.safeAcquisitionError(new Error(collected.code)), 'invalid-failure-code');
    const evidence = a.failureEvidence;
    if (evidence) {
      check(evidence.contract === modules.FAILURE_EVIDENCE_CONTRACT, 'continuation-requires-v2-failure-evidence');
      modules.validateDumpFailureEvidence(evidence, { roster, source: request.sourcePins[evidence.sourceKind], limits: request.limits });
    }
    return { summary: { ...summary, code: collected.code, candidates: 0,
      accounting: { requests: a.requests, sources: a.sources, activeSource: a.activeSource,
        retainedRecordBytesReportedByCollector: a.retainedRecordBytes,
        retainedCandidateBytesInArtifact: 0, completeSourceBytesReportedByCollector: completeBytes,
        diagnosticRetainedBytes: a.diagnosticRetainedBytes ?? 0 },
      failureEvidence: evidence ? { contract: evidence.contract, sourceKind: evidence.sourceKind,
        predicate: evidence.predicate, rawSha256: evidence.rawSha256, rawBytes: evidence.rawBytes, predicateReplayed: true } : null },
    reconciliation: [], candidates: [] };
  }
  check(a.activeSource === null && a.retainedRecordBytes === collected.retainedRecordBytes
    && a.failureEvidence === undefined && (a.diagnosticRetainedBytes === undefined || a.diagnosticRetainedBytes === 0),
  'success-accounting-mismatch');
  modules.validateDumpSources(collected.sourceManifest);
  check(collected.sourceManifest.release === request.release && collected.sourceManifest.retrievedAt === started,
    'source-manifest-binding-mismatch');
  const reconciliation = currentSnapshot === undefined ? [] : reconcileSnapshots(snapshot, currentSnapshot, selected, modules);
  check(currentSnapshot === undefined || timeValue(currentSnapshot.checkedAt) >= Date.parse(ended), 'snapshot-predates-collection');
  for (const kind of ['works', 'editions']) {
    const source = collected.sources[kind], manifest = collected.sourceManifest.sources[kind], observed = a.sources[kind];
    check(['bytes', 'decodedBytes', 'rows', 'matchedRecords', 'unrelatedRows', 'malformedUnrelatedRows',
      'sha256', 'md5', 'sha1', 'complete', 'publisherChecksumsVerified'].every(key => source[key] === observed[key])
      && ['url', 'sha256', 'bytes', 'compression', 'maxDecodedBytes', 'maxRows'].every(key => source[key] === manifest[key])
      && source.compression === request.sourcePins[kind].compression
      && source.maxDecodedBytes === request.limits.maxDecodedBytes && source.maxRows === request.limits.maxRows,
    'source-manifest-binding-mismatch');
  }
  const targets = new Map(selected.map(row => [row.workId, row]));
  const changes = new Map(reconciliation.map(row => [row.itemId, row]));
  const coverage = { targets: roster.length, found: 0, missing: 0, eligibleTexts: 0, targetsWithEligibleText: 0 };
  const found = { work: 0, edition: 0 }, seen = { work: new Set(), edition: new Set() }, candidates = [];
  let retainedBytes = 0;
  for (const [index, expected] of roster.entries()) {
    const row = collected.records[index], target = targets.get(expected.workId);
    let eligible = false;
    for (const kind of ['work', 'edition']) {
      const record = row[kind];
      check(record === null || object(record), 'invalid-collected-record');
      if (record === null) { coverage.missing++; continue; }
      const inspected = modules.inspectRecord(record.raw, expected, kind, started);
      check(same(inspected, record.inspection) && modules.digest(inspected) === record.inspectionSha256
        && inspected.recordSha256 === sha(record.raw), 'record-inspection-mismatch');
      const envelope = record.dump, source = collected.sources[kind === 'work' ? 'works' : 'editions'];
      check(object(envelope) && positive(envelope.row) && envelope.row <= source.rows && !seen[kind].has(envelope.row)
        && positive(envelope.revision) && dumpInstant(envelope.modifiedAt)
        && (inspected.sourceRevision === null || inspected.sourceRevision === envelope.revision)
        && (inspected.sourceModifiedAt === null || timeValue(inspected.sourceModifiedAt) === timeValue(envelope.modifiedAt)),
      'record-envelope-mismatch');
      seen[kind].add(envelope.row); retainedBytes += Buffer.byteLength(record.raw);
      coverage.found++; found[kind]++;
      if (inspected.description.status === 'eligible') { coverage.eligibleTexts++; eligible = true; }
      const raw = JSON.parse(record.raw), change = changes.get(target.itemId);
      candidates.push({ itemId: target.itemId, sourceId: target.sourceId, workId: row.workId, editionId: row.editionId,
        kind, catalogBinding: change?.status ?? 'unreconciled', catalogChanges: change?.changes ?? null,
        reviewEligible: false, displayLanguage: target.displayLanguage,
        raw: record.raw, recordSha256: inspected.recordSha256, inspectionSha256: record.inspectionSha256,
        dump: record.dump, description: inspected.description,
        providerLanguageField: { present: Object.hasOwn(raw, 'languages'), value: raw.languages ?? null },
        textLanguage: null, languageReview: 'unreviewed', rights: 'unreviewed', approved: false });
    }
    if (eligible) coverage.targetsWithEligibleText++;
  }
  check(retainedBytes === collected.retainedRecordBytes && retainedBytes <= request.limits.retainedBytes,
    'retained-record-byte-mismatch');
  check(found.work === collected.sources.works.matchedRecords && found.edition === collected.sources.editions.matchedRecords
    && same(coverage, collected.coverage), 'coverage-evidence-mismatch');
  return { summary: { ...summary, currentSnapshotSha256: currentSnapshot === undefined ? null : modules.digest(currentSnapshot),
    sourceManifestSha256: modules.digest(collected.sourceManifest), coverage, candidates: candidates.length,
    eligibleIsTextShapeOnly: true, retainedRecordBytes: retainedBytes,
    completeSourceBytesReportedByCollector: completeBytes,
    reconciliation: { status: currentSnapshot === undefined ? 'not-performed' : 'reconciled',
      unchanged: reconciliation.filter(row => row.status === 'unchanged').length,
      changed: reconciliation.filter(row => row.status === 'changed').length } }, reconciliation, candidates };
}

async function claimPrivateOutput(path) {
  const out = resolve(path);
  for (let parent = dirname(out); parent !== dirname(parent); parent = dirname(parent)) {
    const info = await lstat(parent);
    check(info.isDirectory() && !info.isSymbolicLink(), 'unsafe-output-parent');
  }
  await mkdir(out, { mode: 0o700 }); // exclusive: EEXIST is not retried or cleared
  return out;
}

export async function runFullContinuationInspection(args = process.argv.slice(2)) {
  check(!process.env.GITHUB_ACTIONS, 'full-continuation-inspection-local-only');
  const names = ['repo', 'request', 'prefix-sealed', 'sealed', 'artifact-zip', 'recipient-key',
    'snapshot', 'current-snapshot', 'source-receipt', 'run-receipt', 'out'];
  const { values } = parseArgs({ args, options: Object.fromEntries(names.map(name => [name, { type: 'string' }])) });
  check(names.filter(name => name !== 'current-snapshot').every(name => values[name]), 'invalid-inspection-command');
  // Claim before reading the key or decrypting. Failed validation leaves the
  // empty claimed directory as evidence; never overwrite a recovery package.
  const out = await claimPrivateOutput(values.out);
  const input = {};
  for (const name of names.filter(name => values[name] && !['repo', 'out', 'recipient-key'].includes(name)))
    input[name] = await bytes(values[name], ['sealed', 'artifact-zip'].includes(name) ? MAX_INPUT : 8 * 1024 * 1024);
  const request = json(input.request), sourceReceipt = json(input['source-receipt']);
  const modules = await loadFullContinuationModules(values.repo, request.sourceHead, sourceReceipt);
  const predecessors = validateFullContinuationGit(values.repo, request, sourceReceipt, modules);
  verifyFullContinuationArtifactZip(input['artifact-zip'], input.sealed);
  const snapshot = json(input.snapshot);
  check(modules.digest(snapshot) === ORIGINAL_SNAPSHOT_SHA256, 'original-snapshot-mismatch');
  const key = await bytes(values['recipient-key'], 8192, true);
  let collected;
  const envelope = json(input.sealed);
  try {
    const prepared = modules.prepareFullDumpContinuationRequest({ ...predecessors,
      prefixArtifact: decode(input['prefix-sealed']), privatePem: key, sourceHead: request.sourceHead });
    check(same(prepared, request), 'predecessor-request-binding-mismatch');
    collected = modules.unsealFullDumpContinuation(envelope, request, key);
  } finally { key.fill(0); }
  const binding = validateFullContinuationReceipts({ request, collected, sourceReceipt,
    runReceipt: json(input['run-receipt']), envelope, zip: input['artifact-zip'], sealed: input.sealed, modules });
  const result = inspectPinnedContinuationPayload({ collected, request, snapshot,
    currentSnapshot: input['current-snapshot'] ? json(input['current-snapshot']) : undefined, modules });
  result.summary.binding = binding;
  result.summary.codeBinding = modules.codeBinding;
  result.summary.inputFiles = Object.fromEntries(Object.entries(input).map(([name, raw]) => [name, sha(raw)]));
  for (const [name, value] of Object.entries({ summary: result.summary, reconciliation: result.reconciliation,
    candidates: result.candidates, collected })) await writeFile(join(out, `${name}.json`), JSON.stringify(value, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: result.summary.status, requestSha256: request.requestSha256,
    candidates: result.candidates.length, eligibleTexts: result.summary.coverage?.eligibleTexts ?? 0,
    approved: 0, databaseWrites: 0, inspectionSourceRequests: 0 }));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFullContinuationInspection().catch(() => {
    console.error(JSON.stringify({ status: 'inspection-failed', code: 'full-continuation-private-inspection-validation-failed' }));
    process.exitCode = 1;
  });
}
