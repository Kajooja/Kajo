#!/usr/bin/env node
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { inspectItemFeatures, MAX_SNAPSHOT_BYTES, sha256 } from './item-features.mjs';

async function readSnapshot(path) {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_SNAPSHOT_BYTES) throw new Error('invalid-input-size');
    const buffer = Buffer.alloc(MAX_SNAPSHOT_BYTES + 1);
    let size = 0;
    while (size <= MAX_SNAPSHOT_BYTES) {
      const read = await handle.read(buffer, size, buffer.length - size, null);
      if (!read.bytesRead) break;
      size += read.bytesRead;
    }
    if (size > MAX_SNAPSHOT_BYTES) throw new Error('invalid-input-size');
    const bytes = buffer.subarray(0, size);
    return { snapshot: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
      inputFileSha256: sha256(bytes) };
  } finally { await handle.close(); }
}

export async function runFeatureCli(args = process.argv.slice(2)) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(`Offline shared-concept inspection; no network, credentials or database writes.
Usage:
  npm run catalog:features -- --snapshot SNAPSHOT.json --out dist/catalog-features/NEW_RUN

Obtain SNAPSHOT with scripts/catalog/catalog-feature-snapshot.sql read-only.
NEW_RUN must not exist. features.json contains private per-Item/source evidence;
keep it and the snapshot outside Git. coverage.json contains counts and hashes only.
Concept absence is null, not a negative; subject and genre evidence stay distinct.
This audit does not change canonical tags or admit features to prediction serving.`);
    return;
  }
  const { values } = parseArgs({ args, options: {
    snapshot: { type: 'string' }, out: { type: 'string' },
  } });
  if (!values.snapshot || !values.out) throw new Error('invalid-command');
  const { snapshot, inputFileSha256 } = await readSnapshot(values.snapshot);
  const { artifact, report } = inspectItemFeatures(snapshot);
  const sourceFiles = [
    'scripts/catalog/item-features.mjs',
    'scripts/catalog/inspect-item-features.mjs',
    'scripts/catalog/catalog-feature-snapshot.sql',
    'supabase/functions/_shared/catalog-normalizers.mjs',
  ];
  const root = new URL('../../', import.meta.url);
  const implementation = Object.fromEntries(await Promise.all(sourceFiles.map(async path =>
    [path, sha256(await readFile(new URL(path, root)))])));
  const featuresJson = `${JSON.stringify(artifact, null, 2)}\n`;
  const coverage = { ...report, inputFileSha256,
    artifactFileSha256: sha256(featuresJson), implementation };
  const coverageJson = `${JSON.stringify(coverage, null, 2)}\n`;
  const output = resolve(values.out);
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await mkdir(output, { mode: 0o700 });
  await writeFile(resolve(output, 'features.json'), featuresJson, { mode: 0o600, flag: 'wx' });
  await writeFile(resolve(output, 'coverage.json'), coverageJson, { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ status: 'inspected', items: report.items,
    featureVersion: report.featureVersion, mappingSha256: report.mappingSha256,
    inputFileSha256, reportFileSha256: sha256(coverageJson),
    assertions: Object.fromEntries(Object.entries(report.coverage)
      .map(([type, value]) => [type, value.itemsWithAssertions])) }));
  return coverage;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFeatureCli().catch(() => {
    // Input parsing and filesystem errors may contain private payload or paths.
    console.error(JSON.stringify({ status: 'error', code: 'feature-audit-failed' }));
    process.exitCode = 1;
  });
}
