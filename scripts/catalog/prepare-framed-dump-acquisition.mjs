#!/usr/bin/env node
// Offline preparation writes a request only after original-source recovery.
import { realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { claimConflictPrivateOutput, readConflictPrivateBytes } from './recover-conflict-dump-acquisition.mjs';
import { loadFramedAcquisitionModules, readFramedPredecessorInputs, authenticateFramedPredecessor,
  validateFramedSourceLimits } from './recover-framed-dump-acquisition.mjs';

export async function runFramedAcquisitionPrepare(args = process.argv.slice(2)) {
  if (process.env.GITHUB_ACTIONS) throw new Error('framed-acquisition-prepare-local-only');
  const names = ['repo', 'source-head', 'source-receipt', 'edition-repo', 'conflict-repo', 'continuation-repo',
    'predecessor-inputs', 'custody-receipt', 'custody-archive', 'out'];
  const { values } = parseArgs({ args, options: Object.fromEntries(names.map(name => [name, { type: 'string' }])) });
  if (!names.every(name => values[name])) throw new Error('invalid-framed-prepare-command');
  const out = await claimConflictPrivateOutput(values.out);
  if (await realpath(fileURLToPath(import.meta.url))
    !== await realpath(join(values.repo, 'scripts/catalog/prepare-framed-dump-acquisition.mjs')))
    throw new Error('framed-prepare-source-path-mismatch');
  const sourceReceipt = JSON.parse(await readConflictPrivateBytes(values['source-receipt'], 8 * 1024 * 1024));
  const modules = await loadFramedAcquisitionModules(values.repo, values['source-head'], sourceReceipt);
  const custodyReceipt = JSON.parse(await readConflictPrivateBytes(values['custody-receipt'], 8 * 1024 * 1024));
  const archive = await readConflictPrivateBytes(values['custody-archive'], 224 * 1024 * 1024, true);
  const input = await readFramedPredecessorInputs(values['predecessor-inputs']);
  try {
    const request = modules.constructFramedDumpAcquisitionRequest({ previousEditionDiagnostic: JSON.parse(input.request),
      sourceHead: values['source-head'] });
    validateFramedSourceLimits(request, sourceReceipt, modules.digest);
    await authenticateFramedPredecessor({ editionRepo: values['edition-repo'], conflictRepo: values['conflict-repo'],
      continuationRepo: values['continuation-repo'], input, custodyReceipt, archive, out, request, modules });
    await writeFile(join(out, 'request.json'), JSON.stringify(request, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const summary = { status: 'prepared', requestSha256: request.requestSha256, sourceHead: request.sourceHead,
      providerRequests: 0, candidates: 0, approved: 0, databaseWrites: 0, modelAdmissions: 0 };
    console.log(JSON.stringify(summary)); return summary;
  } finally { input['recipient-key'].fill(0); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFramedAcquisitionPrepare().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'framed-acquisition-local-preparation-failed' })); process.exitCode = 1;
  });
}
