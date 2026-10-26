import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';
import { sharedPredictionCutoffSmokeSql } from './shared-prediction-cutoff.mjs';

const actor = 'ab157000-0000-4000-8000-000000000001';
const id = n => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const changed = new Set(['rank_items_candidate_with_identity_v1']);

test('shared prediction cutoff / populated forward and complete current schema', async t => {
  const db = new PGlite();
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await query(sql, args))[0];
  const functionRows = () => query(`select oid,proname,oid::regprocedure::text signature,
    pg_get_functiondef(oid) definition,to_jsonb(p) metadata from pg_proc p
    where pronamespace in('public'::regnamespace,'private'::regnamespace) and prokind='f' order by oid`);
  const rows = async () => {
    const tables = await query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
      and n.nspname in('public','private','auth') order by 1`);
    return Promise.all(tables.map(async ({ name }) => [name,
      await query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)]));
  };
  const reject = async (operation, pattern) => {
    await db.exec('savepoint expected_failure;');
    try { await assert.rejects(operation, pattern); }
    finally { await db.exec('rollback to expected_failure;release expected_failure;'); }
  };
  const fixture = async () => {
    await db.exec(await personalTasteSessionFixtureSql());
    await query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    return (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).id;
  };
  const sub = async (name, operation) => t.test(name, async () => {
    await db.exec('begin;');
    try { await operation(); } finally { await db.exec('rollback;'); }
  });
  const request = (profile, version = 3) => ({ version, requestId: randomUUID(), profileId: profile,
    sessionId: randomUUID(), discoveryMode: 'FOR_YOU', itemType: 'MOVIE', limit: 5, context: {} });
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_shared_prediction_cutoff.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    const forward = files[index].sql;

    await sub('predecessor exposes distinct logical versus wall clocks; populated migration preserves rows, metadata and retries', async () => {
      const profile = await fixture();
      const oldRequest = request(profile);
      const oldPage = (await one('select public.rank_items_page_v1($1) value', [oldRequest])).value;
      const oldRun = await one(`select requested_at>now() wall_clock,
        state_snapshot->'predictionInput' input from private.prediction_runs where id=$1`, [oldPage.predictionId]);
      assert.equal(oldRun.wall_clock, true, 'Predecessor must reproduce a later request/state clock');
      assert.equal(oldRun.input, null);
      const tablesBefore = await rows();
      const functionsBefore = await functionRows();
      await db.exec(forward);
      assert.deepEqual(await rows(), tablesBefore, 'No retained row may be rewritten');
      for (const previous of functionsBefore) {
        const actual = (await one('select to_jsonb(p) value from pg_proc p where oid=$1', [previous.oid])).value;
        const expected = structuredClone(previous.metadata);
        if (changed.has(previous.proname)) { delete actual.prosrc; delete expected.prosrc; }
        assert.deepEqual(actual, expected, previous.signature);
      }
      assert.deepEqual((await one('select public.rank_items_page_v1($1) value', [oldRequest])).value, oldPage);
      assert.deepEqual(await rows(), tablesBefore, 'Exact retry must not create another forecast');
    });

    await sub('source, security and later-function drift roll back the entire forward', async () => {
      for (const row of (await functionRows()).filter(row => changed.has(row.proname))) {
        for (const mutation of [row.definition.replace(row.metadata.prosrc, () => `${row.metadata.prosrc}\n-- unexpected`),
          `grant execute on function ${row.signature} to authenticated;`,
          `alter function ${row.signature} set search_path='public';`]) {
          await db.exec('savepoint variant;');
          await db.exec(mutation);
          const before = await functionRows();
          await reject(() => db.exec(forward), /Shared prediction cutoff source\/security drift/);
          assert.deepEqual(await functionRows(), before, 'A later drift must roll back earlier body replacements');
          await db.exec('rollback to variant;release variant;');
        }
      }
    });
    await sub('post-transaction stored outcome exposes the old numeric Scenario mismatch and the corrected common arithmetic prefix', async () => {
      const profile = await fixture();
      const history = randomUUID();
      await query("select * from private.rank_items_with_identity_v1($1,$2,'FOR_YOU','MOVIE',50,'{}')", [history, profile]);
      await query(`update private.prediction_runs set requested_at=now()-interval '3 hours',created_at=now()-interval '3 hours' where id=$1`, [history]);
      await query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at,prediction_id)
        select gen_random_uuid(),$1,$2,$3,'MOVIE',kind,body,now()-interval '2 hours',clock_timestamp(),$4
        from (values('ITEM_IMPRESSION','{}'::jsonb),('ITEM_RATED','{"rating":9}'::jsonb)) e(kind,body)`,
      [actor, profile, id(101), history]);
      const score = async () => {
        const ordinary = randomUUID(), evaluation = randomUUID();
        await query("select * from private.rank_items_with_identity_v1($1,$2,'FOR_YOU','MOVIE',50,'{}')", [ordinary, profile]);
        await query("select private.capture_personal_evaluation_v1($1,$2,$3,now()-interval '1 second','{}')", [evaluation, profile, [id(102)]]);
        return query(`select r.id=$1::uuid ordinary,c.scenario_support,c.scenario_score,c.final_score,
          (r.state_snapshot->>'nativeEvidenceCount')::int state_count
          from private.prediction_runs r join private.prediction_candidates c on c.prediction_id=r.id
          where r.id=any($3::uuid[]) and c.item_id=$2 order by ordinary desc`, [ordinary, id(102), [ordinary, evaluation]]);
      };
      const before = await score();
      assert.equal(before.length, 2);
      assert.ok(before[0].scenario_support > before[1].scenario_support);
      assert.notEqual(before[0].final_score, before[1].final_score, 'Predecessor must exhibit a real score discrepancy');
      assert.ok(before[0].state_count > before[1].state_count);
      await db.exec(forward);
      const after = await score();
      assert.equal(after[0].scenario_support, 0);
      assert.equal(after[0].state_count, 0);
      assert.equal(after[0].final_score, after[1].final_score);
      assert.equal(after[0].scenario_score, after[1].scenario_score);
    });
    for (const file of files.slice(index)) await db.exec(`begin;${file.sql}commit;`);

    await t.test('native rollback smoke exercises ScenarioMemory, Working and frozen shadow with exact same-pool score bytes', async () => {
      const before = await rows();
      const result = (await db.exec(await sharedPredictionCutoffSmokeSql())).flatMap(value => value.rows);
      assert.match(result[0].snapshot.sharedPredictionCutoff, /^PASS:/);
      assert.deepEqual(await rows(), before);
    });

    await sub('a committed skip newer than transaction start still suppresses current delivery', async () => {
      const profile = await fixture();
      await query('update public.items set discoverable=(id=$1)', [id(101)]);
      // Local synthetic committed ledger models a writer that completed while
      // this request waited on its lifecycle lock. now() is already older.
      await query(`insert into private.contextual_skip_commands(action_id,actor_user_id,profile_id,item_id,
        surface,kind,origin_hash,origin,command,result,accepted_at)
        values($1,$2,$3,$4,'DISCOVERY','CONTEXTUAL_SKIP','clock-boundary','{}','{}','{}',
          clock_timestamp())`, [randomUUID(), actor, profile, id(101)]);
      const eligibility = await one(`select
        private.contextual_skip_decision_v1($1,$2,now(),true)->>'eligible' at_cutoff,
        private.contextual_skip_decision_v1($1,$2,clock_timestamp(),true)->>'eligible' at_wall`, [profile, id(101)]);
      assert.deepEqual(eligibility, { at_cutoff: 'true', at_wall: 'false' });
      const page = (await one('select public.rank_items_page_v1($1) value', [request(profile)])).value;
      assert.deepEqual(page.items, []);
      assert.equal(page.source.continuationState, 'CATALOG_EXHAUSTED');
      assert.equal(page.nextCursor, null);
      // Negative control: replacing current hard eligibility with now() would
      // resurrect the newly skipped Item in the very same visible database.
      await db.exec('savepoint stale_eligibility;');
      const base = (await functionRows()).find(row => row.proname === 'rank_items_request_base_v1');
      const clock = "eligibility_time timestamptz := case when request_acquisition = 'EXPLICIT_CANONICAL' then now() else clock_timestamp() end;";
      assert.equal(base.definition.split(clock).length - 1, 1, 'Mutate the actual current admission clock exactly once');
      await db.exec(base.definition.replace(clock, 'eligibility_time timestamptz := now();'));
      const stale = await query("select * from private.rank_items_with_identity_v1($1,$2,'FOR_YOU','MOVIE',50,'{}')", [randomUUID(), profile]);
      assert.deepEqual(stale.map(row => row.item_id), [id(101)]);
      await db.exec('rollback to stale_eligibility;release stale_eligibility;');
    });

    await sub('frozen continuation retains its original computation clock and expiry; private access stays closed', async () => {
      const profile = await fixture();
      const rootRequest = request(profile, 2);
      const root = (await one('select public.rank_items_page_v1($1) value', [rootRequest])).value;
      const origin = await one('select requested_at::text,state_snapshot from private.prediction_runs where id=$1', [root.predictionId]);
      assert.ok(root.nextCursor);
      const nextRequest = { ...rootRequest, requestId: randomUUID(), cursor: root.nextCursor };
      const next = (await one('select public.rank_items_page_v1($1) value', [nextRequest])).value;
      const later = await one('select requested_at::text,state_snapshot from private.prediction_runs where id=$1', [next.predictionId]);
      assert.deepEqual(later.state_snapshot.predictionInput, origin.state_snapshot.predictionInput);
      assert.ok(later.requested_at >= origin.requested_at, 'Delivery time may follow frozen computation time');
      assert.deepEqual((await one('select public.rank_items_page_v1($1) value', [nextRequest])).value, next);
      const expiry = await one(`select bool_and(expires_at=$1::timestamptz+interval '15 minutes') bounded
        from private.prediction_continuation_windows where source_prediction_id=$2`, [origin.requested_at, root.predictionId]);
      assert.equal(expiry.bounded, true);
      for (const row of (await functionRows()).filter(row => changed.has(row.proname))) {
        for (const role of ['anon', 'authenticated', 'service_role']) {
          assert.equal((await one("select has_function_privilege($1,$2,'EXECUTE') allowed", [role, row.oid])).allowed, false);
        }
      }
    });
  } finally { await db.close(); }
});
