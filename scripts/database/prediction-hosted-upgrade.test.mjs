import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { predictionHostedUpgradeSql } from './prediction-hosted-upgrade.mjs';

test('reviewed compact hosted functions upgrade through six forwards; unrecognized variants roll back', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_late_outcome_attribution.sql'));
    for (const file of files.slice(0,index)) await db.exec(`begin; ${file.sql} commit;`);
    const snapshotSql = await readFile(new URL('function-schema-snapshot.sql', import.meta.url), 'utf8');
    const snapshot = async () => (await db.exec(snapshotSql)).flatMap(r => r.rows)[0].snapshot;
    const before = await snapshot();
    const results = (await db.exec(await predictionHostedUpgradeSql(files.slice(index, index + 6))))
      .flatMap(r => r.rows.map(row => row.snapshot));
    assert.match(results[0]?.hostedPredictionUpgrade, /^PASS: reviewed compact/);
    assert.match(results[1]?.atomicPages, /^PASS: 12 Personal/);
    assert.deepEqual(await snapshot(), before, 'Rehearsal must restore original functions/ACLs');
    const compact = await readFile(new URL('prediction-hosted-source-fixture.sql', import.meta.url), 'utf8');
    for (const variant of ['evaluation', 'shadow']) {
      await db.exec(`begin; ${compact}`);
      try {
        if (variant === 'shadow') await db.exec(files[index].sql);
        const identity = variant === 'evaluation' ? 'private.evaluate_shadow_genome_v1(uuid,uuid)'
          : 'private.process_shadow_prediction_jobs_v1(integer)';
        const definition = (await db.query('select pg_get_functiondef($1::regprocedure) d', [identity])).rows[0].d;
        // A semantic change must not be accepted as another formatting variant.
        const changed = variant === 'evaluation' ? definition.replace('inserted_count integer:=0', 'inserted_count integer:=1')
          : definition.replace('batch_limit>250', 'batch_limit>249');
        assert.notEqual(changed, definition);
        await db.exec(changed);
        await assert.rejects(db.exec(files[index + (variant === 'shadow' ? 1 : 0)].sql), /unexpected source anchor/);
      } finally { await db.exec('rollback'); }
      assert.deepEqual(await snapshot(), before, 'Rejected body must leave no changed functions/ACLs');
      assert.equal((await db.query("select to_regclass('private.prediction_page_receipts') r")).rows[0].r, null);
      assert.equal((await db.query('select count(*)::integer n from auth.users')).rows[0].n, 0);
    }
  } finally { await db.close(); }
});
