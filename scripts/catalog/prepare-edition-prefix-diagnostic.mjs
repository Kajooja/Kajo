#!/usr/bin/env node
// Offline preparation authenticates the consumed result before writing a request.
import { realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { claimConflictPrivateOutput, readConflictPrivateBytes } from './recover-conflict-dump-acquisition.mjs';
import { loadEditionPrefixModules, readEditionPredecessorInputs, authenticateEditionPredecessor } from './recover-edition-prefix-diagnostic.mjs';

export async function runEditionPrefixPrepare(args = process.argv.slice(2)) {
  if (process.env.GITHUB_ACTIONS) throw new Error('edition-prefix-prepare-local-only');
  const names = ['repo', 'source-head', 'source-receipt', 'limits', 'conflict-repo', 'continuation-repo',
    'predecessor-inputs', 'custody-receipt', 'custody-archive', 'out'];
  const { values } = parseArgs({ args, options: Object.fromEntries(names.map(name => [name, { type: 'string' }])) });
  if (!names.every(name => values[name])) throw new Error('invalid-edition-prefix-prepare-command');
  const out = await claimConflictPrivateOutput(values.out);
  if (await realpath(fileURLToPath(import.meta.url))
    !== await realpath(join(values.repo, 'scripts/catalog/prepare-edition-prefix-diagnostic.mjs')))
    throw new Error('edition-prefix-prepare-source-path-mismatch');
  const sourceReceipt = JSON.parse(await readConflictPrivateBytes(values['source-receipt'], 1024 * 1024));
  const modules = await loadEditionPrefixModules(values.repo, values['source-head'], sourceReceipt);
  const diagnosticLimits = JSON.parse(await readConflictPrivateBytes(values.limits, 8192));
  const custodyReceipt = JSON.parse(await readConflictPrivateBytes(values['custody-receipt'], 1024 * 1024));
  const archive = await readConflictPrivateBytes(values['custody-archive'], 224 * 1024 * 1024, true);
  const input = await readEditionPredecessorInputs(values['predecessor-inputs']);
  try {
    const request = modules.constructEditionPrefixRequest({ previousConflict: JSON.parse(input.request),
      sourceHead: values['source-head'], diagnosticLimits });
    await authenticateEditionPredecessor({ conflictRepo: values['conflict-repo'], continuationRepo: values['continuation-repo'],
      input, custodyReceipt, archive, out, request, modules });
    await writeFile(join(out, 'request.json'), JSON.stringify(request, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const summary = { status: 'prepared', requestSha256: request.requestSha256, sourceHead: request.sourceHead,
      providerRequests: 0, candidates: 0, approved: 0, databaseWrites: 0, modelAdmissions: 0 };
    console.log(JSON.stringify(summary)); return summary;
  } finally { input['recipient-key'].fill(0); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runEditionPrefixPrepare().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'edition-prefix-local-preparation-failed' })); process.exitCode = 1;
  });
}
