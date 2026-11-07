import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeAcquisitionPgliteExecutor } from './native-acquisition-pglite.mjs';

test('synthetic acquisition retains original query error when rollback also fails', async () => {
  const queryError = Object.assign(new Error('original fixture failure'), { code: 'XX001' });
  const rollbackError = new Error('cannot drop active portal ""');
  const calls = [], diagnostics = [], order = [];
  const exec = createNativeAcquisitionPgliteExecutor({ async exec(sql) {
    calls.push(sql); order.push(sql);
    throw sql === 'rollback;' ? rollbackError : queryError;
  } }, value => { const report = JSON.parse(value); diagnostics.push(report); order.push(report.phase); });

  await assert.rejects(exec('select synthetic_failure();', { stage: 'populated-matrix' }), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [queryError, rollbackError]);
    assert.equal(error.cause, queryError);
    return true;
  });
  assert.deepEqual(calls, ['select synthetic_failure();', 'rollback;']);
  assert.deepEqual(order, ['select synthetic_failure();', 'query', 'rollback;', 'rollback']);
  assert.deepEqual(diagnostics.map(({ stage, phase, message, code }) => ({ stage, phase, message, code })), [
    { stage: 'populated-matrix', phase: 'query', message: queryError.message, code: 'XX001' },
    { stage: 'populated-matrix', phase: 'rollback', message: rollbackError.message, code: undefined },
  ]);
});

test('synthetic acquisition rethrows the original error after successful rollback without retry', async () => {
  const failure = new Error('fixture query rejected');
  const calls = [], diagnostics = [];
  const exec = createNativeAcquisitionPgliteExecutor({ async exec(sql) {
    calls.push(sql);
    if (sql !== 'rollback;') throw failure;
    return [];
  } }, value => diagnostics.push(JSON.parse(value)));
  await assert.rejects(exec('select rejected();'), error => error === failure);
  assert.deepEqual(calls, ['select rejected();', 'rollback;']);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].phase, 'query');
});

test('synthetic acquisition success preserves JSON values and omits SQL null without rollback', async () => {
  const calls = [], diagnostics = [];
  const exec = createNativeAcquisitionPgliteExecutor({ async exec(sql) {
    calls.push(sql);
    return [{ rows: [{ value: null }, { value: false }, { value: 0 }] },
      { rows: [{ value: { preserved: true } }] }];
  } }, value => diagnostics.push(value));
  assert.deepEqual(await exec('select fixture_values();'), [false, 0, { preserved: true }]);
  assert.deepEqual(calls, ['select fixture_values();']);
  assert.deepEqual(diagnostics, []);
});
