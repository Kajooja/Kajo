import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import * as core from '@kajo/prediction-engine';
import { createKajoAdapter } from '@kajo/prediction-engine/adapters/kajo';
import { compareFrozenRankings } from '@kajo/prediction-engine/ranking-conformance';
import { normalizeKajoNativePrediction } from '@kajo/prediction-engine/adapters/kajo-native-prediction';
import { runFixtures } from '@kajo/prediction-engine/fixtures';
import { evaluateOrdinalPair, evaluateOrdinalBatch } from '@kajo/prediction-engine/ordinal';
import { normalizeKajoOrdinalPair } from '@kajo/prediction-engine/adapters/kajo-ordinal';
import { deriveWorkingState, scoreWorkingAdjustment } from '@kajo/prediction-engine/working-state';
import { normalizeKajoWorkingSession } from '@kajo/prediction-engine/adapters/kajo-working-state';
import { summarizeWorkingSupport, freezeWorkingEvaluationPlan, evaluateWorkingPlan,
  evaluateWorkingBatch } from '@kajo/prediction-engine/working-evaluation';
import { normalizeKajoWorkingOutcomeCapture } from '@kajo/prediction-engine/adapters/kajo-working-outcomes';
import { normalizeKajoWorkingEvaluationPlan } from '@kajo/prediction-engine/adapters/kajo-working-evaluation';
import { selectTasteOpportunity } from '@kajo/prediction-engine/taste-selection';
import { createAdaptiveTaste, advanceAdaptiveTaste, inspectAdaptiveTaste } from '@kajo/prediction-engine/adaptive-taste';
import { normalizeKajoTasteSelection, kajoTasteStages } from '@kajo/prediction-engine/adapters/kajo-taste-selection';
import { decideContextualSkip } from '@kajo/prediction-engine/contextual-skip';
import { applyKajoContextualSkip, kajoContextualSkipRecords } from '@kajo/prediction-engine/adapters/kajo-contextual-skip';

assert.equal(typeof core.predict, 'function');
assert.equal(typeof createKajoAdapter, 'function');
assert.equal(core.createKajoAdapter, undefined);
assert.equal(typeof compareFrozenRankings, 'function');
assert.equal(typeof normalizeKajoNativePrediction, 'function');
assert.equal(core.compareFrozenRankings, undefined);
assert.equal(core.normalizeKajoNativePrediction, undefined);
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
for (const fn of [summarizeWorkingSupport, freezeWorkingEvaluationPlan, evaluateWorkingPlan, evaluateWorkingBatch]) {
  assert.equal(typeof fn, 'function');
}
assert.equal(core.freezeWorkingEvaluationPlan, undefined);
assert.equal(core.evaluateWorkingPlan, undefined);
assert.equal(typeof normalizeKajoWorkingEvaluationPlan, 'function');
assert.equal(core.normalizeKajoWorkingEvaluationPlan, undefined);
assert.equal(typeof normalizeKajoWorkingOutcomeCapture, 'function');
assert.equal(core.normalizeKajoWorkingOutcomeCapture, undefined);
assert.equal(typeof selectTasteOpportunity, 'function');
assert.equal(typeof normalizeKajoTasteSelection, 'function');
assert.equal(kajoTasteStages.length, 2);
assert.equal(core.selectTasteOpportunity, undefined);
for (const fn of [createAdaptiveTaste, advanceAdaptiveTaste, inspectAdaptiveTaste]) assert.equal(typeof fn, 'function');
assert.equal(core.createAdaptiveTaste, undefined);
assert.equal(core.advanceAdaptiveTaste, undefined);
assert.equal(core.inspectAdaptiveTaste, undefined);
assert.equal(core.normalizeKajoTasteSelection, undefined);
for (const fn of [decideContextualSkip, applyKajoContextualSkip, kajoContextualSkipRecords]) assert.equal(typeof fn, 'function');
assert.equal(core.decideContextualSkip, undefined);
assert.equal(core.applyKajoContextualSkip, undefined);

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
// Optional computation and adapter graphs stay separate from the root and
// contain no app or provider runtime dependency.
for (const file of ['ordinal.js', 'adapters/kajo-ordinal.js', 'working-state.js', 'adapters/kajo-working-state.js',
  'ranking-conformance.js', 'adapters/kajo-native-prediction.js',
  'working-evaluation.js', 'adapters/kajo-working-evaluation.js', 'adapters/kajo-working-outcomes.js',
  'taste-selection.js', 'adapters/kajo-taste-selection.js', 'adaptive-taste.js',
  'contextual-skip.js', 'adapters/kajo-contextual-skip.js']) {
  const source = await readFile(join(root, file), 'utf8');
  const allowed = {
    'ranking-conformance.js': ['./contracts.js'],
    'adapters/kajo-native-prediction.js': ['../contracts.js', '../ranking-conformance.js', './kajo.js'],
    'ordinal.js': ['./contracts.js'],
    'adapters/kajo-ordinal.js': ['../contracts.js', '../ordinal.js'],
    'working-state.js': ['./contracts.js'],
    'adapters/kajo-working-state.js': ['../contracts.js', '../working-state.js', './kajo.js'],
    'adapters/kajo-working-outcomes.js': ['../contracts.js', '../working-evaluation.js'],
    'working-evaluation.js': ['./contracts.js', './working-state.js'],
    'adapters/kajo-working-evaluation.js': ['../contracts.js', '../working-evaluation.js', '../working-state.js', './kajo-working-state.js'],
    'taste-selection.js': ['./contracts.js'],
    'adaptive-taste.js': ['./contracts.js', './taste-selection.js'],
    'adapters/kajo-taste-selection.js': ['../contracts.js', '../taste-selection.js'],
    'contextual-skip.js': [],
    'adapters/kajo-contextual-skip.js': ['../contextual-skip.js'],
  }[file];
  for (const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
    assert.ok(allowed.includes(match[1]), `Unexpected isolated runtime import in ${file}`);
  }
  assert.ok((await readFile(join(root, file.replace(/\.js$/, '.d.ts')), 'utf8')).length > 0);
}
console.log('Built ESM exports and independent core/ordinal/working-state/evaluation/Taste/adaptive-Taste import graphs passed.');
