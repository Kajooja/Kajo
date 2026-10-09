import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import * as core from '@kajo/prediction-engine';
import { createKajoAdapter } from '@kajo/prediction-engine/adapters/kajo';
import { runFixtures } from '@kajo/prediction-engine/fixtures';
import { evaluateOrdinalPair, evaluateOrdinalBatch } from '@kajo/prediction-engine/ordinal';
import { normalizeKajoOrdinalPair } from '@kajo/prediction-engine/adapters/kajo-ordinal';
import { deriveWorkingState, scoreWorkingAdjustment } from '@kajo/prediction-engine/working-state';
import { normalizeKajoWorkingSession } from '@kajo/prediction-engine/adapters/kajo-working-state';

assert.equal(typeof core.predict, 'function');
assert.equal(typeof createKajoAdapter, 'function');
assert.equal(core.createKajoAdapter, undefined);
assert.equal(runFixtures().length, 2);
assert.equal(typeof evaluateOrdinalPair, 'function');
assert.equal(typeof evaluateOrdinalBatch, 'function');
assert.equal(typeof normalizeKajoOrdinalPair, 'function');
assert.equal(core.evaluateOrdinalPair, undefined);
assert.equal(core.normalizeKajoOrdinalPair, undefined);
assert.equal(typeof deriveWorkingState, 'function');
assert.equal(typeof scoreWorkingAdjustment, 'function');
assert.equal(typeof normalizeKajoWorkingSession, 'function');
assert.equal(core.deriveWorkingState, undefined);
assert.equal(core.normalizeKajoWorkingSession, undefined);

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
// The ordinal computation graph is independent too; the Kajo adapter remains
// a separately imported snapshot boundary with no app/provider runtime import.
for (const file of ['ordinal.js', 'adapters/kajo-ordinal.js', 'working-state.js', 'adapters/kajo-working-state.js']) {
  const source = await readFile(join(root, file), 'utf8');
  const allowed = file === 'ordinal.js' || file === 'working-state.js' ? ['./contracts.js']
    : file === 'adapters/kajo-working-state.js' ? ['../contracts.js', '../working-state.js', './kajo.js']
      : ['../contracts.js', '../ordinal.js'];
  for (const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
    assert.ok(allowed.includes(match[1]), `Unexpected ordinal runtime import in ${file}`);
  }
  assert.ok((await readFile(join(root, file.replace(/\.js$/, '.d.ts')), 'utf8')).length > 0);
}
console.log('Built ESM exports and independent core/ordinal/working-state import graphs passed.');
