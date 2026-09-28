#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { planDumpDescriptions, safeDumpError, stageDumpDescriptions,
  stageDumpDescriptionsWithConflicts } from './open-library-dump-descriptions.mjs';
import { requireValue } from './open-library-descriptions.mjs';

async function readJson(path, maximum) {
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    requireValue(info.isFile() && info.size <= maximum, 'invalid-dump-input-size');
    const buffer = Buffer.alloc(maximum + 1);
    let bytes = 0;
    while (bytes <= maximum) {
      const read = await handle.read(buffer, bytes, buffer.length - bytes, null);
      if (!read.bytesRead) break;
      bytes += read.bytesRead;
    }
    requireValue(bytes <= maximum, 'invalid-dump-input-size');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytes)));
  } finally { await handle.close(); }
}

export async function runDumpCli(args = process.argv.slice(2)) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(`Offline BOOK description intake; no database credentials or network access.
Usage:
  npm run catalog:book-descriptions:dump -- plan --targets SNAPSHOT.json [--manifest SOURCE.json]
  npm run catalog:book-descriptions:dump -- stage --targets SNAPSHOT.json --manifest SOURCE.json \\
    --works LOCAL_WORKS.txt.gz --editions LOCAL_EDITIONS.txt.gz --out dist/catalog-enrichment/NEW_RUN
  npm run catalog:book-descriptions:dump -- stage-with-conflicts --targets SNAPSHOT.json --manifest SOURCE.json \\
    --works LOCAL_WORKS.txt.gz --editions LOCAL_EDITIONS.txt.gz --policy POLICY.json --out dist/catalog-enrichment/NEW_RUN

Run scripts/catalog/book-description-dump-targets.sql read-only to obtain SNAPSHOT.
SOURCE uses open-library-description-dump-source-v1, a dated release, retrievedAt,
and sources.works/sources.editions: url, sha256, bytes, compression (gzip|none),
maxDecodedBytes and maxRows. Both source URLs must name that release, not latest.
Pin actual full-file hashes and explicit scan bounds before staging. Plan needs no dumps.
Stage consumes both complete local files. Output is private, unapproved review material;
it cannot be passed to the completed ten-Item pilot's review/apply commands.
stage-with-conflicts requires an explicit bounded policy and separately excludes whole
Work/Edition pairs with a narrowly verified foreign-location conflict. It does not remap
identities or grant a new acquisition budget. The default stage still aborts on conflicts.`);
    return;
  }
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options:
    Object.fromEntries(['targets', 'manifest', 'works', 'editions', 'out', 'policy'].map(key => [key, { type: 'string' }])) });
  const command = positionals[0];
  const allowed = command === 'plan' ? ['targets', 'manifest'] : ['targets', 'manifest', 'works', 'editions', 'out',
    ...(command === 'stage-with-conflicts' ? ['policy'] : [])];
  requireValue(positionals.length === 1 && ['plan', 'stage', 'stage-with-conflicts'].includes(command)
    && values.targets && Object.keys(values).every(key => allowed.includes(key))
    && (command === 'plan' || allowed.every(key => values[key])), 'invalid-dump-command');
  const snapshot = await readJson(values.targets, 2 * 1024 * 1024);
  const manifest = values.manifest ? await readJson(values.manifest, 65536) : undefined;
  const result = command === 'plan' ? planDumpDescriptions(snapshot, manifest)
    : command === 'stage-with-conflicts'
      ? await stageDumpDescriptionsWithConflicts({ snapshot, manifest, policy: await readJson(values.policy, 4096),
        worksPath: values.works, editionsPath: values.editions, outputDirectory: values.out })
      : await stageDumpDescriptions({ snapshot, manifest, worksPath: values.works, editionsPath: values.editions,
        outputDirectory: values.out });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDumpCli().catch(error => {
    console.error(JSON.stringify({ status: 'error', code: safeDumpError(error) }));
    process.exitCode = 1;
  });
}
