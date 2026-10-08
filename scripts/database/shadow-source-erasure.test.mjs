import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { shadowSourceErasureFixtureSql, shadowSourceErasureSmokeSql, shadowSourceErasureUpgradeSql } from './shadow-source-erasure.mjs';

test('closed owner source erasure preserves unrelated evidence and fails atomically on unresolved policy lineage (full schema)', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_shadow_source_erasure.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_shared_round_outcome_captures.sql')));
    for (const file of files.slice(0, index)) await db.exec(`begin; ${file.sql} commit;`);
    let started = performance.now();
    const upgrade = (await db.exec(await shadowSourceErasureUpgradeSql(files[index])))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(upgrade[0]?.shadowSourceErasureUpgrade, /^PASS: every populated/);
    t.diagnostic(`populated source-erasure upgrade completed in ${Math.round(performance.now() - started)} ms`);
    for (const file of files.slice(index)) await db.exec(`begin; ${file.sql} commit;`);
    started = performance.now();
    const smoke = (await db.exec(await shadowSourceErasureSmokeSql()))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(smoke[0]?.shadowSourceErasure, /^PASS:/);
    t.diagnostic(`exact closure, guard and rollback matrix completed in ${Math.round(performance.now() - started)} ms`);
    for (const table of ['auth.users','public.events','private.prediction_runs','private.shadow_prediction_runs',
      'private.genome_evaluations','private.shared_round_outcome_captures','private.shared_round_vector_comparisons',
      'private.prediction_source_erasure_permissions']) {
      assert.equal((await db.query(`select count(*)::integer n from ${table}`)).rows[0].n, 0, `${table} escaped rollback`);
    }
    // Separate committed disposable fixture establishes valid roots before the
    // isolation declaration; a rejection cannot be explained by missing input.
    await db.exec(`begin; ${await shadowSourceErasureFixtureSql()}`);
    const sourceId = (await db.query('select source_id from pg_temp.erasure_fixture')).rows[0].source_id;
    const beforeIsolation = (await db.query('select pg_temp.erasure_snapshot() value')).rows[0].value;
    await db.exec('commit;');
    for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE']) {
      await db.exec(`begin isolation level ${isolation}; savepoint source_erasure;`);
      try {
        await assert.rejects(db.query("select private.erase_prediction_sources_v1('PREDICTION_RUN',$1::uuid)", [sourceId]),
          error => error.code === '25001', `${isolation} accepted an eraser with stale closure snapshots`);
        await db.exec('rollback to savepoint source_erasure; release savepoint source_erasure;');
        assert.deepEqual((await db.query('select pg_temp.erasure_snapshot() value')).rows[0].value, beforeIsolation);
      } finally { await db.exec('rollback;'); }
    }
    t.diagnostic('valid-root REPEATABLE READ/SERIALIZABLE erasure rejects 25001 without changing any source/canonical row');
  } finally { await db.close(); }
});
