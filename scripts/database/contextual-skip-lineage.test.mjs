import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

// Artificial source graphs exercise deletion and cutoff provenance, not scoring
// quality. Native command admission and real concurrent locks have separate tests.
test('contextual skip source lineage includes omitted candidates and erases complete dependent closures', async t => {
  const db = new PGlite();
  const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await rows(sql, args))[0];
  const actor = 'ab157000-0000-4000-8000-000000000001';
  const other = 'ab157000-0000-4000-8000-000000000002';
  const item = 'ab157000-0000-4000-8000-000000000100';
  const item2 = 'ab157000-0000-4000-8000-000000000101';
  const at = seconds => new Date(Date.UTC(2030, 0, 1) + seconds * 1000).toISOString();
  let profile, otherProfile;
  const run = async (seconds, { user = actor, target = profile } = {}) => {
    const id = randomUUID();
    await rows(`insert into private.prediction_runs(id,actor_user_id,profile_id,requested_at,
      requested_item_type,discovery_mode,model_version,base_model_version,policy_version)
      values($1,$2,$3,$4,'MOVIE','FOR_YOU','LINEAGE_FIXTURE','LINEAGE_FIXTURE','LINEAGE_FIXTURE')`,
    [id, user, target, at(seconds)]);
    return id;
  };
  const command = async (source, seconds, { user = actor, target = profile, object = item,
    reversal = null, impression = null } = {}) => {
    const id = randomUUID();
    await rows(`insert into private.contextual_skip_commands(action_id,actor_user_id,profile_id,item_id,
      surface,kind,origin_hash,origin,command,result,accepted_at,reverses_action_id,source_prediction_id,source_impression_id)
      values($1::uuid,$2,$3,$4,'DISCOVERY',$5,$1::uuid::text,'{}','{"fixture":true}','{"fixture":true}',$6,$7,$8,$9)`,
    [id, user, target, object, reversal ? 'WITHDRAW_CONTEXTUAL_SKIP' : 'CONTEXTUAL_SKIP', at(seconds), reversal, source, impression]);
    return id;
  };
  const captured = async id => (await rows(`select action_id from private.prediction_contextual_skip_sources
    where prediction_id=$1 order by action_id`, [id])).map(row => row.action_id);
  const shadow = async (source, object) => {
    const id = randomUUID();
    await rows(`insert into private.shadow_prediction_runs(id,source_prediction_id,genome_id,profile_id,actor_user_id,
      as_of,requested_item_type,discovery_mode,context,state_snapshot,source_model_version,source_policy_version,
      code_version,feature_version,memory_version,outcome_version,reward_version,candidate_count,hypothetical_result_count)
      select $1,id,genome_id,profile_id,actor_user_id,requested_at,requested_item_type,discovery_mode,'{}','{}',
        'FIXTURE','FIXTURE','FIXTURE','FIXTURE','FIXTURE','FIXTURE','FIXTURE',1,1
        from private.prediction_runs where id=$2`, [id, source]);
    await rows(`insert into private.shadow_prediction_candidates(shadow_prediction_id,item_id,source_rank,
      production_final_rank,shadow_rank,source_score,production_final_score,shadow_score,hypothetical_selected)
      values($1,$2,1,1,1,0,0,0,true)`, [id, object]);
    return id;
  };
  const fixture = async fn => {
    await db.exec(`begin;${await personalTasteSessionFixtureSql()}`);
    try {
      profile = (await one('select id from public.profiles where owner_user_id=$1', [actor])).id;
      otherProfile = (await one('select id from public.profiles where owner_user_id=$1', [other])).id;
      await fn();
    } finally { await db.exec('rollback;'); }
  };
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    await t.test('latest surviving source set honors scope, ties, historical withdrawal and expiry without a 256 cap', () => fixture(async () => {
      const source = await run(0);
      await command(source, 1);
      const latest = await command(source, 2), tie = await command(source, 2);
      await command(source, 3, { reversal: latest });
      await command(source, 10, { object: item2 });
      await command(source, 1, { user: other, target: otherProfile });
      assert.deepEqual(await captured(await run(0)), []);
      assert.deepEqual(await captured(await run(2)), [latest, tie].sort());
      assert.deepEqual(await captured(await run(3)), [tie]);
      assert.deepEqual(await captured(await run(86404)), [tie,
        (await one(`select action_id from private.contextual_skip_commands where item_id=$1`, [item2])).action_id].sort());
      const ties = [];
      for (let i = 0; i < 260; i++) ties.push(await command(source, 20));
      const all = await captured(await run(21));
      assert.equal(all.length, 261);
      assert.deepEqual(all.filter(id => ties.includes(id)), ties.sort());
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal((await one(`select has_table_privilege($1,'private.prediction_contextual_skip_sources',
          'SELECT,INSERT,UPDATE,DELETE') allowed`, [role])).allowed, false);
      }
    }));
    await t.test('prediction source erasure follows skip dependencies transitively and preserves unrelated history', () => fixture(async () => {
      const root = await run(0), prior = await run(0);
      const a = await command(root, 1), child = await run(2);
      const b = await command(child, 3, { object: item2 }), grandchild = await run(4);
      const unrelated = await run(4, { user: other, target: otherProfile });
      const untouched = await rows('select to_jsonb(r) body from private.prediction_runs r where id=any($1::uuid[]) order by id', [[prior, unrelated]]);
      await shadow(child, item); await shadow(grandchild, item2);
      assert.deepEqual(await captured(child), [a]);
      assert.deepEqual(await captured(grandchild), [a, b].sort());
      assert.equal((await one('select count(*)::int n from private.prediction_candidates')).n, 0,
        'Fixture must prove dependencies for candidates omitted before retention');
      const result = (await one("select private.erase_prediction_sources_v1('PREDICTION_RUN',$1) result", [root])).result;
      assert.equal(result.counts.predictionRuns, 3);
      assert.equal(result.counts.shadowRuns, 2); assert.equal(result.counts.shadowCandidates, 2);
      assert.deepEqual(await rows('select to_jsonb(r) body from private.prediction_runs r where id=any($1::uuid[]) order by id', [[prior, unrelated]]), untouched);
      assert.equal((await one('select count(*)::int n from private.prediction_contextual_skip_sources')).n, 0);
      assert.equal((await one('select count(*)::int n from private.prediction_source_erasure_permissions')).n, 0);
      for (const id of [a, b]) {
        const row = await one('select * from private.contextual_skip_commands where action_id=$1', [id]);
        assert.ok(row.erased_at); assert.equal(row.command, null); assert.equal(row.result, null);
        assert.equal(row.source_prediction_id, null);
      }
    }));
    await t.test('impression removal erases dependent runs before clearing payload while keeping its original delivery', () => fixture(async () => {
      const root = await run(0), impression = randomUUID();
      await rows(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,prediction_id)
        values($1,$2,$3,$4,'MOVIE','ITEM_IMPRESSION',$5,$6)`, [impression, actor, profile, item, at(0), root]);
      const a = await command(root, 1, { impression }), child = await run(2);
      const b = await command(child, 3, { object: item2 }), grandchild = await run(4);
      await shadow(child, item); await shadow(grandchild, item2);
      const original = await one('select to_jsonb(r) body from private.prediction_runs r where id=$1', [root]);
      await rows('delete from public.events where id=$1', [impression]);
      assert.deepEqual(await one('select to_jsonb(r) body from private.prediction_runs r where id=$1', [root]), original);
      assert.equal((await one('select count(*)::int n from private.prediction_runs where id=any($1::uuid[])', [[child, grandchild]])).n, 0);
      assert.equal((await one('select count(*)::int n from private.contextual_skip_commands where action_id=any($1::uuid[]) and erased_at is not null', [[a, b]])).n, 2);
      assert.equal((await one('select count(*)::int n from private.prediction_source_erasure_permissions')).n, 0);
    }));
  } finally { await db.close(); }
});
