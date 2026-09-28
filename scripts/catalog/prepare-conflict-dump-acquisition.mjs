#!/usr/bin/env node
// Local preparation only. Private predecessor identities never enter the request.
import { realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { authenticateConflictPredecessor, claimConflictPrivateOutput, loadConflictAcquisitionModules,
  readConflictPredecessorInputs, readConflictPrivateBytes } from './recover-conflict-dump-acquisition.mjs';

// Deliberately separate from authentication: this pure constructor gives no
// permission to publish or activate. The CLI completes custody/authentication.
export function constructConflictAcquisitionRequest({ previousContinuation, sourceHead, conflictPolicy, modules }) {
  const { contract: _contract, purpose: _purpose, sourceHead: _source, requestSha256: _hash, ...retained } = previousContinuation;
  const body = { ...structuredClone(retained), contract: modules.CONFLICT_REQUEST_CONTRACT,
    purpose: modules.CONFLICT_REQUEST_PURPOSE, sourceHead,
    policySourceHead: modules.CONFLICT_POLICY_SOURCE_HEAD,
    previousContinuation: { ...modules.CONFLICT_PREVIOUS_CONTINUATION }, conflictPolicy: structuredClone(conflictPolicy) };
  return modules.validateConflictDumpAcquisitionPredecessor({ ...body, requestSha256: modules.digest(body) }, previousContinuation);
}

export async function runConflictAcquisitionPrepare(args = process.argv.slice(2)) {
  if (process.env.GITHUB_ACTIONS) throw new Error('conflict-acquisition-prepare-local-only');
  const names = ['repo', 'source-head', 'source-receipt', 'policy', 'predecessor-repo', 'predecessor-inputs',
    'custody-receipt', 'custody-archive', 'out'];
  const { values } = parseArgs({ args, options: Object.fromEntries(names.map(name => [name, { type: 'string' }])) });
  if (!names.every(name => values[name])) throw new Error('invalid-conflict-prepare-command');
  const out = await claimConflictPrivateOutput(values.out);
  if (await realpath(fileURLToPath(import.meta.url))
    !== await realpath(join(values.repo, 'scripts/catalog/prepare-conflict-dump-acquisition.mjs')))
    throw new Error('conflict-prepare-source-path-mismatch');
  const sourceReceipt = JSON.parse(await readConflictPrivateBytes(values['source-receipt'], 1024 * 1024));
  const modules = await loadConflictAcquisitionModules(values.repo, values['source-head'], sourceReceipt);
  const conflictPolicy = JSON.parse(await readConflictPrivateBytes(values.policy, 8192));
  const custodyReceipt = JSON.parse(await readConflictPrivateBytes(values['custody-receipt'], 1024 * 1024));
  const archive = await readConflictPrivateBytes(values['custody-archive'], 224 * 1024 * 1024, true);
  const input = await readConflictPredecessorInputs(values['predecessor-inputs']);
  try {
    const request = constructConflictAcquisitionRequest({ previousContinuation: JSON.parse(input.request),
      sourceHead: values['source-head'], conflictPolicy, modules });
    await authenticateConflictPredecessor({ previousRepo: values['predecessor-repo'], input,
      custodyReceipt, archive, out, request, modules });
    // The public request is written last, after historical authentication,
    // durable readback verification and policy replay have all succeeded.
    await writeFile(join(out, 'request.json'), JSON.stringify(request, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const result = { status: 'prepared', requestSha256: request.requestSha256, sourceHead: request.sourceHead,
      targets: request.roster.length, policySha256: modules.digest(conflictPolicy), approved: 0, databaseWrites: 0,
      providerRequests: 0 };
    console.log(JSON.stringify(result)); return result;
  } finally { input['recipient-key'].fill(0); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runConflictAcquisitionPrepare().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'conflict-acquisition-local-preparation-failed' }));
    process.exitCode = 1;
  });
}
