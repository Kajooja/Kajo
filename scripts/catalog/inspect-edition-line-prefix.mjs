#!/usr/bin/env node
// Local files only. No publisher request, deployment or consumed-run retry.
import { createReadStream } from 'node:fs';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { digest } from './open-library-descriptions.mjs';
import { validateConflictDumpAcquisitionRequest } from './seal-conflict-dump-acquisition.mjs';
import { validateEditionLineContext } from './dump-failure-evidence.mjs';
import { claimDumpDiagnosticOutput, DEFAULT_STAGING_ROOT, scanEditionLinePrefix } from './open-library-dump-descriptions.mjs';

const check = value => { if (!value) throw new Error('invalid-local-edition-line-inspection'); };
async function jsonInput(path, maximum) {
  const info = await lstat(path);
  check(info.isFile() && !info.isSymbolicLink() && info.size <= maximum);
  const bytes = await readFile(path); check(bytes.length <= maximum);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export async function runEditionLineInspection(args = process.argv.slice(2)) {
  check(!process.env.GITHUB_ACTIONS);
  const names = ['request', 'limits', 'editions', 'out'];
  const { values } = parseArgs({ args, options: Object.fromEntries(names.map(name => [name, { type: 'string' }])) });
  check(names.every(name => values[name]));
  const request = validateConflictDumpAcquisitionRequest(await jsonInput(values.request, 256 * 1024));
  const limits = await jsonInput(values.limits, 8192), fetchedAt = new Date().toISOString();
  const context = validateEditionLineContext({ source: request.sourcePins.editions, roster: request.roster, limits, fetchedAt });
  check(limits.lineBytes === request.limits.lineBytes && limits.maxRows <= request.limits.maxRows
    && limits.maxDecodedBytes <= request.limits.maxDecodedBytes && limits.timeoutMs <= request.limits.timeoutMs);
  const info = await lstat(values.editions);
  check(info.isFile() && !info.isSymbolicLink());
  const out = await claimDumpDiagnosticOutput(DEFAULT_STAGING_ROOT, values.out);
  const save = (name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await save('request.json', request); await save('limits.json', limits);
  const diagnostic = await scanEditionLinePrefix(createReadStream(values.editions, { start: 0, end: limits.compressedBytes - 1 }), context);
  await save('diagnostic.json', { contract: 'kajo-local-edition-line-inspection-v1', requestSha256: request.requestSha256,
    contextSha256: digest(context), sourceAuthentication: 'not-performed', diagnostic });
  const summary = { status: diagnostic.status, code: diagnostic.code, candidates: 0, approved: 0,
    providerRequests: 0, databaseWrites: 0, modelAdmissions: 0 };
  console.log(JSON.stringify(summary)); return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runEditionLineInspection().then(result => { if (result.status === 'failed') process.exitCode = 1; }).catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'local-edition-line-inspection-failed' }));
    process.exitCode = 1;
  });
}
