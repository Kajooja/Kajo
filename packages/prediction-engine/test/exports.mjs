import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import * as core from '@kajo/prediction-engine';
import { createKajoAdapter } from '@kajo/prediction-engine/adapters/kajo';
import { runFixtures } from '@kajo/prediction-engine/fixtures';

assert.equal(typeof core.predict, 'function');
assert.equal(typeof createKajoAdapter, 'function');
assert.equal(core.createKajoAdapter, undefined);
assert.equal(runFixtures().length, 2);

// Inspect the actual built core import graph: no app, adapter or provider dependency.
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const seen = new Set();
async function inspect(path) {
  if (seen.has(path)) return;
  seen.add(path);
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
    assert.match(match[1], /^\.\/(?:contracts|engine)\.js$/);
    await inspect(join(root, match[1]));
  }
}
await inspect(join(root, 'index.js'));
assert.ok((await readdir(root)).includes('index.d.ts'));
console.log('Built ESM exports and independent core import graph passed.');
