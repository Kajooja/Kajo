#!/usr/bin/env node
// Local recovery binds operator receipts, not sender authenticity. Historical
// inspectors execute only at their original accepted heads and rule versions.
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { CONFLICT_ACQUISITION_SOURCE_FILES, ORIGINAL_SNAPSHOT_SHA256, collectCatalogCodeBinding,
  collectHistoricalCatalogCodeBinding, validateCatalogSourceReceipt, validateCatalogAcquisitionReceipts,
  verifyCatalogArtifactZip, verifyCatalogPredecessorCustody, readCatalogPrivateInputs,
  claimConflictPrivateOutput, readConflictPrivateBytes } from './recover-conflict-dump-acquisition.mjs';
import { EDITION_SOURCE_FILES, EDITION_SOURCE_CONTRACT, EDITION_PREDECESSOR_INPUTS } from './recover-edition-prefix-diagnostic.mjs';
import { FULL_CONTINUATION_SOURCE_FILES } from './inspect-full-dump-continuation.mjs';

const SELF = 'scripts/catalog/recover-framed-dump-acquisition.mjs';
const EDITION_INSPECTOR = 'scripts/catalog/recover-edition-prefix-diagnostic.mjs';
const CONFLICT_INSPECTOR = 'scripts/catalog/recover-conflict-dump-acquisition.mjs';
const CONTINUATION_INSPECTOR = 'scripts/catalog/inspect-full-dump-continuation.mjs';
const CORE = 'cfa36d5810c1f5e6f91c4112e4376415f2f4ced1';
const ORIGINAL_EDITION = '3d12a7f69534fef305b7ca37767626ae584b688e';
const ORIGINAL_CONFLICT = '24631688fbbbf73b2197768d5df686e26ff361dd';
const ORIGINAL_CONTINUATION = '8a9aefbf87870abd932dac53c6d4abae7fd0683d';
const MAX_INPUT = 224 * 1024 * 1024;
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value));
const check = (value, code) => { if (!value) throw new Error(code); };
const gitHash = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const git = (repo, args, raw = false) => execFileSync('git', args, { cwd: repo,
  env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' }, encoding: raw ? undefined : 'utf8',
  timeout: 30000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const save = (out, name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const topNames = ['request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt'];
const conflictName = name => topNames.includes(name) ? 'conflict-' + name : name;
export const FRAMED_SOURCE_CONTRACT = 'kajo-framed-acquisition-source-acceptance-v1';
export const FRAMED_RUNTIME_CONTRACT = 'kajo-framed-acquisition-runtime-receipt-v1';
export const FRAMED_CUSTODY_CONTRACT = 'kajo-framed-acquisition-predecessor-custody-v1';
export const FRAMED_SOURCE_FILES = Object.freeze([...new Set([...EDITION_SOURCE_FILES, ...FULL_CONTINUATION_SOURCE_FILES,
  SELF, 'scripts/catalog/prepare-framed-dump-acquisition.mjs', 'scripts/catalog/run-framed-dump-acquisition.mjs',
  'scripts/catalog/seal-framed-dump-acquisition.mjs', '.github/workflows/catalog-book-framed-acquisition.yml'])]);
// The Edition result adds five inputs to the original conflict recovery's fifteen
// and its two custody inputs. The same recipient key is bound through all levels.
export const FRAMED_PREDECESSOR_INPUTS = Object.freeze([...topNames,
  ...EDITION_PREDECESSOR_INPUTS.map(conflictName), 'conflict-custody-receipt', 'conflict-custody-archive']);
// The original continuation predates conflict-policy code. Its receipt must
// bind its seventeen original files, not today's expanded continuation manifest.
export const FRAMED_HISTORICAL_SOURCES = Object.freeze([
  { repoName: 'edition', receiptName: 'source-receipt', sourceHead: ORIGINAL_EDITION,
    sourceFiles: EDITION_SOURCE_FILES, dynamicImports: [EDITION_INSPECTOR, CONFLICT_INSPECTOR], contract: EDITION_SOURCE_CONTRACT },
  { repoName: 'conflict', receiptName: 'conflict-source-receipt', sourceHead: ORIGINAL_CONFLICT,
    sourceFiles: CONFLICT_ACQUISITION_SOURCE_FILES, dynamicImports: [CONFLICT_INSPECTOR], contract: 'kajo-conflict-acquisition-source-acceptance-v1' },
  { repoName: 'continuation', receiptName: 'continuation-source-receipt', sourceHead: ORIGINAL_CONTINUATION,
    sourceFiles: FULL_CONTINUATION_SOURCE_FILES.filter(path => path !== 'scripts/catalog/dump-conflict-policy.mjs'),
    dynamicImports: [CONTINUATION_INSPECTOR], contract: 'kajo-full-continuation-source-acceptance-v1' },
].map(spec => Object.freeze({ ...spec, sourceFiles: Object.freeze([...spec.sourceFiles]), dynamicImports: Object.freeze(spec.dynamicImports) })));

export function collectFramedAcquisitionCodeBinding(repo, sourceHead) {
  return collectCatalogCodeBinding(repo, sourceHead, { sourceFiles: FRAMED_SOURCE_FILES,
    executingFile: SELF, executingUrl: import.meta.url,
    dynamicImports: [SELF, EDITION_INSPECTOR, CONFLICT_INSPECTOR, CONTINUATION_INSPECTOR] });
}
export function validateFramedAcquisitionSourceReceipt(receipt, binding) {
  return validateCatalogSourceReceipt(receipt, binding, FRAMED_SOURCE_CONTRACT);
}
export async function loadFramedAcquisitionModules(repo, sourceHead, sourceReceipt) {
  const codeBinding = await collectFramedAcquisitionCodeBinding(repo, sourceHead);
  validateFramedAcquisitionSourceReceipt(sourceReceipt, codeBinding);
  git(repo, ['merge-base', '--is-ancestor', CORE, sourceHead]);
  check(git(repo, ['rev-parse', `${sourceReceipt.reviewedHead}^{tree}`]).trim() === codeBinding.sourceTree,
    'reviewed-source-tree-mismatch');
  const modules = {};
  for (const name of ['open-library-descriptions', 'seal-framed-dump-acquisition',
    'inspect-conflict-dump-acquisition', 'run-framed-dump-acquisition'])
    Object.assign(modules, await import(pathToFileURL(join(resolve(repo), `scripts/catalog/${name}.mjs`))));
  return { ...modules, codeBinding };
}

export function validateFramedAcquisitionGit(repo, request, receipt, modules) {
  check(gitHash(receipt.requestHead) && gitHash(receipt.requestTree), 'invalid-request-git-identity');
  check(git(repo, ['rev-parse', `${receipt.requestHead}^{tree}`]).trim() === receipt.requestTree, 'request-git-tree-mismatch');
  check(modules.digest(json(git(repo, ['show', `${receipt.requestHead}:${modules.FRAMED_REQUEST_PATH}`], true)))
    === modules.digest(request), 'request-git-bytes-mismatch');
  const predecessors = Object.fromEntries(modules.FRAMED_PREDECESSORS.map(([name, identity, path]) =>
    [name, json(git(repo, ['show', `${identity.requestHead}:${path}`], true))]));
  return modules.validateFramedAcquisitionCommit({ sourceHead: request.sourceHead, requestHead: receipt.requestHead,
    parents: git(repo, ['show', '-s', '--format=%P', receipt.requestHead]).trim(),
    changes: git(repo, ['diff', '--name-status', '--no-renames', request.sourceHead, receipt.requestHead]), request, ...predecessors });
}
export function validateFramedSourceLimits(request, sourceReceipt, digest) {
  check(sourceReceipt.sourceHead === request.sourceHead && sourceReceipt.limitsSha256 === digest(request.limits)
    && sourceReceipt.policySha256 === digest(request.conflictPolicy)
    && sourceReceipt.framingSourceHead === request.framingSourceHead, 'source-framed-limits-mismatch');
}
export function validateFramedAcquisitionReceipts(input) {
  const { request, sourceReceipt, modules } = input;
  validateFramedSourceLimits(request, sourceReceipt, modules.digest);
  const binding = validateCatalogAcquisitionReceipts(input, { sourceContract: FRAMED_SOURCE_CONTRACT,
    runtimeContract: FRAMED_RUNTIME_CONTRACT, workflowPath: '.github/workflows/' + modules.FRAMED_WORKFLOW,
    artifactFile: modules.FRAMED_ARTIFACT, artifactPrefix: modules.FRAMED_ARTIFACT_NAME, branch: modules.FRAMED_REQUEST_BRANCH });
  return { ...binding, limitsSha256: sourceReceipt.limitsSha256, framingSourceHead: sourceReceipt.framingSourceHead };
}
export function readFramedPredecessorInputs(path) {
  return readCatalogPrivateInputs(path, FRAMED_PREDECESSOR_INPUTS, {
    largeNames: FRAMED_PREDECESSOR_INPUTS.filter(name => /(?:sealed|artifact-zip|custody-archive)$/.test(name)),
    privateNames: ['recipient-key', 'continuation-custody-archive', 'conflict-custody-archive'] });
}
export function verifyFramedPredecessorCustody(receipt, archive, input) {
  return verifyCatalogPredecessorCustody(receipt, archive, input,
    { contract: FRAMED_CUSTODY_CONTRACT, keys: FRAMED_PREDECESSOR_INPUTS });
}

// Read-only preflight of the complete historical closure and installed ESM
// bytes. This never imports the inspected code or reads/stages a private key.
export async function verifyFramedHistoricalSource({ repo, sourceHead, sourceReceipt, sourceFiles, dynamicImports, contract }) {
  const binding = await collectHistoricalCatalogCodeBinding(repo, sourceHead, { sourceFiles, dynamicImports });
  validateCatalogSourceReceipt(sourceReceipt, binding, contract);
  check(git(repo, ['rev-parse', `${sourceReceipt.reviewedHead}^{tree}`]).trim() === binding.sourceTree,
    'reviewed-source-tree-mismatch');
  return binding;
}

// POSIX process groups keep the nested original inspectors inside one deadline.
// Discard child output so neither a private parser error nor row can escape.
function historicalChild(repo, args, timeoutMs) {
  check(process.platform !== 'win32' && Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60000,
    'invalid-historical-process-budget');
  return new Promise((resolveChild, reject) => {
    const child = spawn(process.execPath, [join(resolve(repo), EDITION_INSPECTOR), ...args],
      { cwd: resolve(repo), env: { ...process.env, NODE_OPTIONS: '', GIT_NO_REPLACE_OBJECTS: '1' }, detached: true, stdio: 'ignore' });
    let timedOut = false;
    const killGroup = () => {
      if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    const timer = setTimeout(() => { timedOut = true; killGroup(); }, timeoutMs);
    const fail = () => reject(new Error('framed-predecessor-authentication-failed'));
    child.once('error', () => { clearTimeout(timer); killGroup(); fail(); });
    child.once('exit', killGroup);
    child.once('close', code => { clearTimeout(timer); if (code !== 0 || timedOut) fail(); else resolveChild(); });
  });
}

// Mechanical staging only: does not grant authentication or write a proof.
// The caller must first verify custody, public lineage and all three sources.
export async function stageFramedHistoricalRecovery({ editionRepo, conflictRepo, continuationRepo, input, out, timeoutMs = 60000 }) {
  const staged = await claimConflictPrivateOutput(join(out, 'predecessor-inputs'));
  const childOut = join(out, 'edition-recovery');
  try {
    for (const name of FRAMED_PREDECESSOR_INPUTS)
      await writeFile(join(staged, name), input[name], { flag: 'wx', mode: 0o600 });
    await save(staged, 'conflict-inputs.json', Object.fromEntries(EDITION_PREDECESSOR_INPUTS.map(name => [name, join(staged, conflictName(name))])));
    const args = ['--repo', resolve(editionRepo), '--conflict-repo', resolve(conflictRepo), '--continuation-repo', resolve(continuationRepo),
      '--predecessor-inputs', join(staged, 'conflict-inputs.json'), '--custody-receipt', join(staged, 'conflict-custody-receipt'),
      '--custody-archive', join(staged, 'conflict-custody-archive'), '--out', childOut];
    for (const name of topNames) args.push('--' + name, join(staged, name));
    await historicalChild(editionRepo, args, timeoutMs);
    return childOut;
  } finally {
    for (const path of [join(staged, 'recipient-key'), join(childOut, 'predecessor-inputs/recipient-key'),
      join(childOut, 'conflict-recovery/predecessor-inputs/recipient-key')])
      await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

// The original child already replayed its closed schema. Require only the
// accepted diagnostic outcome here; do not reinterpret its private header.
export function validateFramedPredecessorResult(result) {
  const d = result?.diagnostic, e = d?.failureEvidence;
  check(result?.contract === 'open-library-edition-prefix-result-v1' && result.status === 'diagnosed'
    && result.code === 'dump-line-limit' && result.provenanceVerified === false
    && ['candidates', 'approved', 'databaseWrites', 'modelAdmissions'].every(key => result[key] === 0)
    && d?.status === 'diagnosed' && d.code === 'dump-line-limit'
    && d.fullSourceComplete === false && d.publisherChecksumsVerified === false
    && e?.envelopeSelection?.status === 'unrelated' && e.envelopeSelection.reason === 'canonical-edition-envelope'
    && e.validationScope === 'bounded-outer-envelope-only' && e.rowComplete === false && e.rowBytes === null && e.rowSha256 === null,
  'framed-predecessor-result-mismatch');
  return result;
}

export async function authenticateFramedPredecessor({ editionRepo, conflictRepo, continuationRepo, input, custodyReceipt,
  archive, out, request, modules }) {
  const custody = verifyFramedPredecessorCustody(custodyReceipt, archive, input);
  const previous = json(input.request), source = json(input['source-receipt']), run = json(input['run-receipt']);
  modules.validateFramedDumpAcquisitionPredecessor(request, previous);
  const identity = modules.FRAMED_PREVIOUS_EDITION_DIAGNOSTIC;
  check(source.sourceHead === identity.sourceHead && source.requestHead === identity.requestHead
    && source.requestSha256 === identity.requestSha256 && String(run.run?.id) === identity.runId
    && Number.isFinite(Date.parse(run.run.updatedAt))
    && Date.parse(run.run.updatedAt) <= Date.parse(custodyReceipt.storage.readBackAt), 'predecessor-public-lineage-mismatch');
  // Fixed heads/manifests, not caller-selected code. All checks finish before
  // any historical process starts or any temporary copy of the key is written.
  const repos = { edition: editionRepo, conflict: conflictRepo, continuation: continuationRepo };
  for (const spec of FRAMED_HISTORICAL_SOURCES)
    await verifyFramedHistoricalSource({ ...spec, repo: repos[spec.repoName], sourceReceipt: json(input[spec.receiptName]) });
  const childOut = await stageFramedHistoricalRecovery({ editionRepo, conflictRepo, continuationRepo, input, out });
  const diagnostic = validateFramedPredecessorResult(json(await readConflictPrivateBytes(join(childOut, 'diagnostic.json'), 1024 * 1024)));
  const summary = json(await readConflictPrivateBytes(join(childOut, 'summary.json'), 8 * 1024 * 1024));
  check(summary.operatorProvenance?.status === 'verified-against-supplied-receipts'
    && String(summary.operatorProvenance.binding?.runId) === identity.runId
    && summary.operatorProvenance.binding.requestSha256 === identity.requestSha256, 'framed-predecessor-authentication-failed');
  const proof = { contract: 'kajo-framed-acquisition-predecessor-proof-v1', custody, previousEditionDiagnostic: { ...identity },
    requestSha256: request.requestSha256, limitsSha256: modules.digest(request.limits), policySha256: modules.digest(request.conflictPolicy),
    framingSourceHead: request.framingSourceHead,
    result: { status: diagnostic.status, code: diagnostic.code, envelopeSelection: 'unrelated',
      validationScope: 'bounded-outer-envelope-only', fullRowAvailable: false },
    inputFiles: Object.fromEntries(Object.entries(input).filter(([name]) => name !== 'recipient-key').map(([name, raw]) => [name, sha(raw)])),
    candidates: 0, approved: 0, databaseWrites: 0, providerRequests: 0, modelAdmissions: 0 };
  await save(out, 'predecessor-proof.json', proof); return proof;
}

export async function runFramedAcquisitionRecovery(args = process.argv.slice(2)) {
  check(!process.env.GITHUB_ACTIONS, 'framed-acquisition-recovery-local-only');
  const names = ['repo', ...topNames, 'current-snapshot', 'edition-repo', 'conflict-repo', 'continuation-repo',
    'predecessor-inputs', 'custody-receipt', 'custody-archive', 'out'];
  const { values } = parseArgs({ args, options: Object.fromEntries(names.map(name => [name, { type: 'string' }])) });
  check(names.filter(name => name !== 'current-snapshot').every(name => values[name]), 'invalid-framed-recovery-command');
  const out = await claimConflictPrivateOutput(values.out), input = {};
  for (const name of [...topNames, 'current-snapshot', 'custody-receipt', 'custody-archive'])
    if (values[name]) input[name] = await readConflictPrivateBytes(values[name], ['sealed', 'artifact-zip', 'custody-archive'].includes(name)
      ? MAX_INPUT : 8 * 1024 * 1024, name === 'custody-archive');
  const request = json(input.request), sourceReceipt = json(input['source-receipt']);
  const modules = await loadFramedAcquisitionModules(values.repo, request.sourceHead, sourceReceipt);
  modules.validateFramedDumpAcquisitionRequest(request);
  validateFramedAcquisitionGit(values.repo, request, sourceReceipt, modules);
  verifyCatalogArtifactZip(input['artifact-zip'], input.sealed, modules.FRAMED_ARTIFACT);
  const previous = await readFramedPredecessorInputs(values['predecessor-inputs']);
  try {
    await authenticateFramedPredecessor({ editionRepo: values['edition-repo'], conflictRepo: values['conflict-repo'],
      continuationRepo: values['continuation-repo'], input: previous, custodyReceipt: json(input['custody-receipt']),
      archive: input['custody-archive'], out, request, modules });
    const snapshot = json(previous.snapshot);
    check(modules.digest(snapshot) === ORIGINAL_SNAPSHOT_SHA256, 'original-snapshot-mismatch');
    const envelope = json(input.sealed), collected = modules.unsealFramedDumpAcquisition(envelope, request, previous['recipient-key']);
    const binding = validateFramedAcquisitionReceipts({ request, collected, sourceReceipt, runReceipt: json(input['run-receipt']),
      envelope, zip: input['artifact-zip'], sealed: input.sealed, modules });
    const result = modules.inspectFramedDumpPayload({ request, result: collected, originalSnapshot: snapshot,
      freshSnapshot: input['current-snapshot'] ? json(input['current-snapshot']) : undefined });
    result.summary.operatorProvenance = { status: 'verified-against-supplied-receipts', binding };
    result.summary.codeBinding = modules.codeBinding;
    result.summary.inputFiles = Object.fromEntries(Object.entries(input).map(([name, raw]) => [name, sha(raw)]));
    for (const [name, value] of Object.entries({ collected, candidates: result.candidates, quarantine: result.quarantine,
      reconciliation: result.reconciliation, summary: result.summary })) await save(out, name + '.json', value);
    console.log(JSON.stringify({ status: 'recovered', result: collected.status, candidates: result.candidates.length,
      approved: 0, databaseWrites: 0, inspectionSourceRequests: 0, modelAdmissions: 0 }));
    return result;
  } finally { previous['recipient-key'].fill(0); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFramedAcquisitionRecovery().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'framed-acquisition-private-recovery-failed' })); process.exitCode = 1;
  });
}
