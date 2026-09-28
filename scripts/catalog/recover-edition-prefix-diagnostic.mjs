#!/usr/bin/env node
// Local receipt-bound recovery. No provider access or source-authentication claim
// follows from possession of the recipient key or a consistent private payload.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { CONFLICT_ACQUISITION_SOURCE_FILES, CONFLICT_PREDECESSOR_INPUTS,
  collectCatalogCodeBinding, validateCatalogSourceReceipt, validateCatalogAcquisitionReceipts,
  verifyCatalogArtifactZip, verifyCatalogPredecessorCustody, readCatalogPrivateInputs,
  claimConflictPrivateOutput, readConflictPrivateBytes } from './recover-conflict-dump-acquisition.mjs';

const SELF = 'scripts/catalog/recover-edition-prefix-diagnostic.mjs';
const CORE = '12c1dc203a4d4e5a326c6f2a64db4c5fe49b0cb4';
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
export const EDITION_SOURCE_CONTRACT = 'kajo-edition-prefix-source-acceptance-v1';
export const EDITION_RUNTIME_CONTRACT = 'kajo-edition-prefix-runtime-receipt-v1';
export const EDITION_CUSTODY_CONTRACT = 'kajo-edition-prefix-predecessor-custody-v1';
export const EDITION_SOURCE_FILES = Object.freeze([...CONFLICT_ACQUISITION_SOURCE_FILES, SELF,
  'scripts/catalog/prepare-edition-prefix-diagnostic.mjs', 'scripts/catalog/run-edition-prefix-diagnostic.mjs',
  'scripts/catalog/seal-edition-prefix-diagnostic.mjs', 'scripts/catalog/acquire-edition-prefix-diagnostic.mjs',
  '.github/workflows/catalog-book-edition-prefix-diagnostic.yml']);
// The original conflict recovery recursively needs the authenticated continuation
// and its earlier custody archive. Every required byte is bound by new readback.
export const EDITION_PREDECESSOR_INPUTS = Object.freeze(['request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt',
  'continuation-request', 'prefix-sealed', 'continuation-sealed', 'continuation-artifact-zip', 'recipient-key', 'snapshot',
  'continuation-source-receipt', 'continuation-run-receipt', 'continuation-custody-receipt', 'continuation-custody-archive']);
const continuationName = name => ['request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt'].includes(name)
  ? 'continuation-' + name : name;

export function collectEditionPrefixCodeBinding(repo, sourceHead) {
  return collectCatalogCodeBinding(repo, sourceHead, { sourceFiles: EDITION_SOURCE_FILES,
    executingFile: SELF, executingUrl: import.meta.url,
    dynamicImports: [SELF, 'scripts/catalog/recover-conflict-dump-acquisition.mjs'] });
}
export function validateEditionPrefixSourceReceipt(receipt, binding) {
  return validateCatalogSourceReceipt(receipt, binding, EDITION_SOURCE_CONTRACT);
}
export async function loadEditionPrefixModules(repo, sourceHead, sourceReceipt) {
  const codeBinding = await collectEditionPrefixCodeBinding(repo, sourceHead);
  validateEditionPrefixSourceReceipt(sourceReceipt, codeBinding);
  git(repo, ['merge-base', '--is-ancestor', CORE, sourceHead]);
  check(git(repo, ['rev-parse', `${sourceReceipt.reviewedHead}^{tree}`]).trim() === codeBinding.sourceTree,
    'reviewed-source-tree-mismatch');
  const modules = {};
  for (const name of ['open-library-descriptions', 'seal-edition-prefix-diagnostic', 'run-edition-prefix-diagnostic'])
    Object.assign(modules, await import(pathToFileURL(join(resolve(repo), `scripts/catalog/${name}.mjs`))));
  return { ...modules, codeBinding };
}

export function validateEditionPrefixGit(repo, request, receipt, modules) {
  check(gitHash(receipt.requestHead) && gitHash(receipt.requestTree), 'invalid-request-git-identity');
  check(git(repo, ['rev-parse', `${receipt.requestHead}^{tree}`]).trim() === receipt.requestTree, 'request-git-tree-mismatch');
  check(modules.digest(json(git(repo, ['show', `${receipt.requestHead}:${modules.EDITION_PREFIX_REQUEST_PATH}`], true)))
    === modules.digest(request), 'request-git-bytes-mismatch');
  const predecessors = Object.fromEntries(modules.EDITION_PREFIX_PREDECESSORS.map(([name, identity, path]) =>
    [name, json(git(repo, ['show', `${identity.requestHead}:${path}`], true))]));
  return modules.validateEditionPrefixCommit({ sourceHead: request.sourceHead, requestHead: receipt.requestHead,
    parents: git(repo, ['show', '-s', '--format=%P', receipt.requestHead]).trim(),
    changes: git(repo, ['diff', '--name-status', '--no-renames', request.sourceHead, receipt.requestHead]), request, ...predecessors });
}

export function validateEditionPrefixReceipts(input) {
  const { request, sourceReceipt, modules } = input;
  check(sourceReceipt.sourceHead === request.sourceHead
    && sourceReceipt.diagnosticLimitsSha256 === modules.digest(request.diagnosticLimits), 'source-diagnostic-limits-mismatch');
  const binding = validateCatalogAcquisitionReceipts(input, { sourceContract: EDITION_SOURCE_CONTRACT,
    runtimeContract: EDITION_RUNTIME_CONTRACT, workflowPath: '.github/workflows/' + modules.EDITION_PREFIX_WORKFLOW,
    artifactFile: modules.EDITION_PREFIX_ARTIFACT, artifactPrefix: modules.EDITION_PREFIX_ARTIFACT_NAME,
    branch: modules.EDITION_PREFIX_BRANCH });
  return { ...binding, diagnosticLimitsSha256: sourceReceipt.diagnosticLimitsSha256 };
}

export function readEditionPredecessorInputs(path) {
  return readCatalogPrivateInputs(path, EDITION_PREDECESSOR_INPUTS, {
    largeNames: ['sealed', 'artifact-zip', 'continuation-sealed', 'continuation-artifact-zip', 'continuation-custody-archive'],
    privateNames: ['recipient-key', 'continuation-custody-archive'] });
}
export function verifyEditionPredecessorCustody(receipt, archive, input) {
  return verifyCatalogPredecessorCustody(receipt, archive, input,
    { contract: EDITION_CUSTODY_CONTRACT, keys: EDITION_PREDECESSOR_INPUTS });
}

export function validateEditionPredecessorResult(collected) {
  check(collected?.status === 'failed' && collected.code === 'dump-line-limit'
    && collected.accounting?.activeSource === 'editions'
    && collected.accounting.sources?.works?.complete === true
    && collected.accounting.sources.works.publisherChecksumsVerified === true
    && collected.accounting.sources.editions?.complete === false
    && collected.terminalFailureEvidence === null && collected.individualProviderRequests === 0 && collected.rights === 'unreviewed'
    && !Object.hasOwn(collected.accounting, 'failureEvidence') && !Object.hasOwn(collected, 'records')
    && ['approved', 'databaseWrites', 'modelAdmissions'].every(key => collected[key] === 0),
  'edition-prefix-predecessor-result-mismatch');
  return collected;
}

export async function authenticateEditionPredecessor({ conflictRepo, continuationRepo, input, custodyReceipt, archive,
  out, request, modules }) {
  const custody = verifyEditionPredecessorCustody(custodyReceipt, archive, input);
  const previous = json(input.request), source = json(input['source-receipt']), run = json(input['run-receipt']);
  modules.validateEditionPrefixPredecessor(request, previous);
  const identity = modules.EDITION_PREVIOUS_CONFLICT;
  check(source.sourceHead === identity.sourceHead && source.requestHead === identity.requestHead
    && source.requestSha256 === identity.requestSha256 && String(run.run?.id) === identity.runId
    && Number.isFinite(Date.parse(run.run.updatedAt))
    && Date.parse(run.run.updatedAt) <= Date.parse(custodyReceipt.storage.readBackAt), 'predecessor-public-lineage-mismatch');
  const originalInspector = 'scripts/catalog/recover-conflict-dump-acquisition.mjs';
  check(git(conflictRepo, ['rev-parse', 'HEAD']).trim() === ORIGINAL_CONFLICT
    && git(continuationRepo, ['rev-parse', 'HEAD']).trim() === ORIGINAL_CONTINUATION
    && sha(await readConflictPrivateBytes(join(conflictRepo, originalInspector), 1024 * 1024))
      === sha(git(conflictRepo, ['show', `${ORIGINAL_CONFLICT}:${originalInspector}`], true)), 'historical-inspector-source-mismatch');
  const staged = await claimConflictPrivateOutput(join(out, 'predecessor-inputs'));
  const childOut = join(out, 'conflict-recovery');
  try {
    for (const name of EDITION_PREDECESSOR_INPUTS)
      await writeFile(join(staged, name), input[name], { flag: 'wx', mode: 0o600 });
    const manifest = Object.fromEntries(CONFLICT_PREDECESSOR_INPUTS.map(name => [name, join(staged, continuationName(name))]));
    await save(staged, 'continuation-inputs.json', manifest);
    const args = ['--repo', resolve(conflictRepo), '--predecessor-repo', resolve(continuationRepo),
      '--predecessor-inputs', join(staged, 'continuation-inputs.json'),
      '--custody-receipt', join(staged, 'continuation-custody-receipt'),
      '--custody-archive', join(staged, 'continuation-custody-archive'), '--out', childOut];
    for (const name of ['request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt']) args.push('--' + name, join(staged, name));
    try { execFileSync(process.execPath, [join(resolve(conflictRepo), originalInspector), ...args],
      { cwd: resolve(conflictRepo), env: { ...process.env, NODE_OPTIONS: '', GIT_NO_REPLACE_OBJECTS: '1' },
        timeout: 60000, maxBuffer: 4096, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { throw new Error('edition-prefix-predecessor-authentication-failed'); }
  } finally {
    // Clean both known temporary copies even when the historical child times out.
    for (const path of [join(staged, 'recipient-key'), join(childOut, 'predecessor-inputs/recipient-key')])
      await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  const collected = validateEditionPredecessorResult(json(await readConflictPrivateBytes(join(childOut, 'collected.json'), MAX_INPUT)));
  const summary = json(await readConflictPrivateBytes(join(childOut, 'summary.json'), 8 * 1024 * 1024));
  check(summary.operatorProvenance?.status === 'verified-against-supplied-receipts'
    && String(summary.operatorProvenance.binding?.runId) === identity.runId
    && summary.operatorProvenance.binding.requestSha256 === identity.requestSha256,
  'edition-prefix-predecessor-authentication-failed');
  const proof = { contract: 'kajo-edition-prefix-predecessor-proof-v1', custody, previousConflict: { ...identity },
    requestSha256: request.requestSha256, diagnosticLimitsSha256: modules.digest(request.diagnosticLimits),
    result: { status: collected.status, code: collected.code, activeSource: 'editions', terminalRowRetained: false },
    inputFiles: Object.fromEntries(Object.entries(input).filter(([name]) => name !== 'recipient-key').map(([name, raw]) => [name, sha(raw)])),
    candidates: 0, approved: 0, databaseWrites: 0, providerRequests: 0, modelAdmissions: 0 };
  await save(out, 'predecessor-proof.json', proof); return proof;
}

export async function runEditionPrefixRecovery(args = process.argv.slice(2)) {
  check(!process.env.GITHUB_ACTIONS, 'edition-prefix-recovery-local-only');
  const names = ['repo', 'request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt',
    'conflict-repo', 'continuation-repo', 'predecessor-inputs', 'custody-receipt', 'custody-archive', 'out'];
  const { values } = parseArgs({ args, options: Object.fromEntries(names.map(name => [name, { type: 'string' }])) });
  check(names.every(name => values[name]), 'invalid-edition-prefix-recovery-command');
  const out = await claimConflictPrivateOutput(values.out), input = {};
  for (const name of ['request', 'sealed', 'artifact-zip', 'source-receipt', 'run-receipt', 'custody-receipt', 'custody-archive'])
    input[name] = await readConflictPrivateBytes(values[name], name === 'custody-archive' ? MAX_INPUT : 1024 * 1024,
      name === 'custody-archive');
  const request = json(input.request), sourceReceipt = json(input['source-receipt']);
  const modules = await loadEditionPrefixModules(values.repo, request.sourceHead, sourceReceipt);
  modules.validateEditionPrefixRequest(request);
  validateEditionPrefixGit(values.repo, request, sourceReceipt, modules);
  verifyCatalogArtifactZip(input['artifact-zip'], input.sealed, modules.EDITION_PREFIX_ARTIFACT);
  const previous = await readEditionPredecessorInputs(values['predecessor-inputs']);
  try {
    await authenticateEditionPredecessor({ conflictRepo: values['conflict-repo'], continuationRepo: values['continuation-repo'],
      input: previous, custodyReceipt: json(input['custody-receipt']), archive: input['custody-archive'], out, request, modules });
    const envelope = json(input.sealed), collected = modules.unsealEditionPrefixDiagnostic(envelope, request, previous['recipient-key']);
    const binding = validateEditionPrefixReceipts({ request, collected, sourceReceipt, runReceipt: json(input['run-receipt']),
      envelope, zip: input['artifact-zip'], sealed: input.sealed, modules });
    await save(out, 'diagnostic.json', collected);
    const summary = { status: 'recovered', result: collected.status, code: collected.code,
      requestSha256: request.requestSha256, validationScope: 'payload-consistency-only', provenanceVerified: false,
      operatorProvenance: { status: 'verified-against-supplied-receipts', binding }, codeBinding: modules.codeBinding,
      inputFiles: Object.fromEntries(Object.entries(input).map(([name, raw]) => [name, sha(raw)])),
      candidates: 0, approved: 0, databaseWrites: 0, modelAdmissions: 0, inspectionSourceRequests: 0 };
    await save(out, 'summary.json', summary);
    console.log(JSON.stringify({ status: 'recovered', candidates: 0, approved: 0, databaseWrites: 0,
      modelAdmissions: 0, inspectionSourceRequests: 0 }));
    return summary;
  } finally { previous['recipient-key'].fill(0); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runEditionPrefixRecovery().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'edition-prefix-private-recovery-failed' })); process.exitCode = 1;
  });
}
