import assert from 'node:assert/strict';
import test from 'node:test';
import { compareMigrationHistory } from './migration-parity.mjs';

const a = { version: '20260901000000', name: 'foundation' };
const b = { version: '20260902000000', name: 'foundation' };
test('matching history is independent of input order', () => {
  assert.equal(compareMigrationHistory([a,b], [b,a]).status, 'MATCH');
});
test('same-name timestamp differences are not treated as applied migrations', () => {
  const report = compareMigrationHistory([a], [b]);
  assert.equal(report.status, 'MISMATCH');
  assert.deepEqual(report.localOnly, [a]);
  assert.deepEqual(report.hostedOnly, [b]);
});
test('missing and repeated hosted names remain explicit', () => {
  const report = compareMigrationHistory([a], [a,b]);
  assert.deepEqual(report.ambiguousHostedNames, ['foundation']);
  assert.deepEqual(report.hostedOnly, [b]);
  assert.equal(compareMigrationHistory([a], []).status, 'MISMATCH');
});
test('malformed rows and duplicate versions fail instead of inventing a mapping', () => {
  assert.throws(() => compareMigrationHistory([a,a], []), /Duplicate/);
  assert.throws(() => compareMigrationHistory([], [{name:'foundation'}]), /Invalid/);
  assert.throws(() => compareMigrationHistory([], {}), /array/);
});
