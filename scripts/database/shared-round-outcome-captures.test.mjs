import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { sharedRoundOutcomeCapturesFixtureSql, sharedRoundOutcomeCapturesSmokeSql,
  sharedRoundOutcomeCapturesUpgradeSql } from './shared-round-outcome-captures.mjs';

test('observed Shared vectors freeze exact replay and paired support without inventing joint metrics (full schema)', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_shared_round_outcome_captures.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_shared_round_outcomes.sql')));
    for (const file of files.slice(0, index)) await db.exec(`begin; ${file.sql} commit;`);
    let started = performance.now();
    const upgrade = (await db.exec(await sharedRoundOutcomeCapturesUpgradeSql(files[index])))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(upgrade[0]?.sharedRoundOutcomeCapturesUpgrade, /^PASS: every populated row/);
    t.diagnostic(`populated capture upgrade completed in ${Math.round(performance.now() - started)} ms`);
    for (const file of files.slice(index)) await db.exec(`begin; ${file.sql} commit;`);
    started = performance.now();
    const smoke = (await db.exec(await sharedRoundOutcomeCapturesSmokeSql()))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(smoke[0]?.sharedRoundOutcomeCaptures, /^PASS:/);
    t.diagnostic(`frozen replay, common support and privacy matrix completed in ${Math.round(performance.now() - started)} ms`);
    for (const table of ['auth.users','public.events','private.shared_rating_rounds',
      'private.shared_round_outcome_captures','private.shared_round_vector_comparisons']) {
      assert.equal((await db.query(`select count(*)::integer n from ${table}`)).rows[0].n, 0, `${table} escaped rollback`);
    }
    // Commit only inside this disposable PGlite instance: isolation must be
    // declared before a transaction's first query, outside the rollback matrix DO.
    await db.exec(`begin; ${await sharedRoundOutcomeCapturesFixtureSql()}`);
    const identity = (await db.query(`select jsonb_build_object('profileId',f.pair,'roundId',c.round_id,
      'cutoff',c.outcome_cutoff,'genomeId',c.genome_id,'windowId',c.window_id,
      'captureId',gen_random_uuid(),'comparisonId',gen_random_uuid()) value
      from pg_temp.outcome_fixture f cross join pg_temp.capture_fixture c`)).rows[0].value;
    const captureArgs = [identity.captureId, identity.profileId, identity.roundId, identity.cutoff, identity.cutoff];
    const compareArgs = [identity.comparisonId, identity.captureId, identity.genomeId, identity.windowId];
    const captureSql = `select private.capture_shared_rating_round_outcome_v1($1::uuid,$2::uuid,$3::uuid,
      $4::timestamptz,$5::timestamptz,interval '0 seconds') value`;
    const compareSql = `select private.compare_shared_round_outcome_capture_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid) value`;
    const captured = (await db.query(captureSql, captureArgs)).rows[0].value;
    const compared = (await db.query(compareSql, compareArgs)).rows[0].value;
    await db.exec('commit;');
    for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE']) {
      await db.exec(`begin isolation level ${isolation};`);
      try {
        assert.deepEqual((await db.query(captureSql, captureArgs)).rows[0].value, captured, `${isolation} exact capture retry changed`);
        assert.deepEqual((await db.query(compareSql, compareArgs)).rows[0].value, compared, `${isolation} exact comparison retry changed`);
        for (const [sql, args] of [[captureSql, captureArgs], [compareSql, compareArgs]]) {
          await db.exec('savepoint allocation_guard;');
          const newId = (await db.query('select gen_random_uuid()::text id')).rows[0].id;
          await assert.rejects(db.query(sql, [newId, ...args.slice(1)]), error => error.code === '25001',
            `${isolation} accepted a new allocation under a stale quota snapshot`);
          await db.exec('rollback to savepoint allocation_guard; release savepoint allocation_guard;');
        }
        assert.deepEqual((await db.query('select private.get_shared_round_outcome_capture_v1($1::uuid) value', [identity.captureId])).rows[0].value, captured);
        assert.deepEqual((await db.query('select private.get_shared_round_vector_comparison_v1($1::uuid) value', [identity.comparisonId])).rows[0].value, compared);
        assert.equal((await db.query('select count(*)::integer n from private.shared_round_outcome_captures')).rows[0].n, 1);
        assert.equal((await db.query('select count(*)::integer n from private.shared_round_vector_comparisons')).rows[0].n, 1);
      } finally { await db.exec('rollback;'); }
    }
    t.diagnostic('independent REPEATABLE READ/SERIALIZABLE transactions reject new allocations (25001), preserving exact retries/replay');
  } finally { await db.close(); }
});
