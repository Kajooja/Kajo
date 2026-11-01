import assert from 'node:assert/strict';
import test from 'node:test';
import { runIsolatedSqlProbe } from './ci-supabase-stack.mjs';
import { withIsolatedSqlSession } from './isolated-sql-session.mjs';
import { executePersonalContentRatingProbe } from './personal-content-rating-concurrency.mjs';

test('content concurrency launches pass the actual one-shot validator without changing SQL application identities', async () => {
  const names = ['kajo_content_upsert_waiter', 'kajo_content_source_waiter', 'kajo_content_alias_insert_waiter',
    'kajo_content_source_eraser', 'kajo_content_alias_reassignment', 'kajo_content_item_delete_waiter',
    'content-absent-canonical-alias', 'content-item-erasure-source-setup'];
  for (const name of names) {
    const sql = `begin;set local application_name='${name}';select to_jsonb(true);commit;`;
    let calls = 0;
    const docker = (args, options) => {
      calls++;
      assert.equal(options.input, sql, 'Stage normalization must not rename the observed backend');
      assert.equal(options.timeout, 45_000);
      assert.ok(args.includes('PGOPTIONS=-c statement_timeout=40000 -c lock_timeout=30000'));
      return 'true\n';
    };
    assert.deepEqual(await executePersonalContentRatingProbe((query, options) =>
      runIsolatedSqlProbe(docker, 'owned-container', query, options), sql, name), [true]);
    assert.equal(calls, 1);
  }
  await assert.rejects(runIsolatedSqlProbe(() => assert.fail('Malformed stage must not start Docker'),
    'owned-container', 'select 1;', { stage: names[0] }), /fixed SQL probe stage label/);
});

test('content writer stages satisfy the actual persistent-session validator', async () => {
  // This child acknowledges framing only; SQL and lock behavior remain native
  // PostgreSQL checks. Exercise the real separate session-stage validator.
  const receiver = String.raw`import { createInterface } from 'node:readline';
    createInterface({input:process.stdin}).on('line', line => {
      if (line === '\\q') process.exit(0);
      if (line.startsWith('\\echo ')) process.stdout.write(line.slice(6)+'\n');
    });`;
  await withIsolatedSqlSession(process.execPath, ['--input-type=module', '-e', receiver],
    { stage: 'content-stage-contract', timeoutMs: 10_000 }, async exec => {
      for (const name of ['kajo_content_upsert_holder', 'kajo_content_source_holder', 'kajo_content_batch_holder',
        'kajo_content_alias_holder', 'kajo_content_item_delete_holder']) {
        for (const suffix of ['begin', 'writer-role', 'initial-mutation', 'complete-mutation', 'commit', 'rollback']) {
          assert.deepEqual(await exec('select 1;', { stage: name + '-' + suffix }), []);
        }
      }
      for (const stage of ['content-session-name', 'content-session-pid', 'content-nowait-bound']) {
        assert.deepEqual(await exec('select 1;', { stage }), []);
      }
    });
});
