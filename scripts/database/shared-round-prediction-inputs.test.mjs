import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { sharedRoundPredictionInputsFixtureSql, sharedRoundPredictionInputsSmokeSql,
  sharedRoundPredictionInputsUpgradeSql } from './shared-round-prediction-inputs.mjs';

test('pre-response Shared inputs freeze complete enrollment and visible history without claiming prediction consumption (full schema)', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_shared_round_prediction_inputs.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_shadow_source_erasure.sql')),
      'Expected one new CLI-generated additive input capture forward after the lifecycle guard');
    for (const file of files.slice(0,index)) await db.exec(`begin;${file.sql}commit;`);
    let started = performance.now();
    const upgrade = (await db.exec(await sharedRoundPredictionInputsUpgradeSql(files[index])))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(upgrade[0]?.sharedRoundPredictionInputsUpgrade, /^PASS:/);
    t.diagnostic(`populated old-row/object preservation completed in ${Math.round(performance.now()-started)} ms`);

    // These exercise the upgrade verifier itself with explicitly changed
    // maintenance state, not with an assertion that mirrors new API behavior.
    for (const [label,sql] of [
      ['populated row', `update public.items set title=title||' changed by preservation negative control';`],
      ['unrelated function', `create or replace function private.get_shared_round_outcome_capture_v1(target_capture_id uuid)
        returns jsonb language sql stable security invoker set search_path='' as $$ select null::jsonb $$;`],
      ['extra eraser body', `do $extra$ declare p record;begin
        select pg_get_functiondef(oid) definition,prosrc into strict p from pg_proc
          where oid='private.erase_prediction_sources_v1(text,uuid)'::regprocedure;
        execute replace(p.definition,p.prosrc,replace(p.prosrc,E'\nbegin\n',E'\nbegin\n  perform 1;\n'));
      end;$extra$;`],
    ]) {
      const altered = { ...files[index],sql: `${files[index].sql}\n${sql}` };
      try {
        await assert.rejects(db.exec(await sharedRoundPredictionInputsUpgradeSql(altered)),
          error => /changed|preserv|guard|eraser|declared/i.test(error.message), `${label} escaped populated preservation`);
      } finally { await db.exec('rollback;'); }
    }
    for (const file of files.slice(index)) await db.exec(`begin;${file.sql}commit;`);
    started = performance.now();
    const smoke = (await db.exec(await sharedRoundPredictionInputsSmokeSql()))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(smoke[0]?.sharedRoundPredictionInputs, /^PASS:/);
    t.diagnostic(`full prefix/enrollment/source/erasure matrix completed in ${Math.round(performance.now()-started)} ms`);
    for (const table of ['auth.users','public.events','private.shared_rating_rounds',
      'private.shared_round_prediction_inputs','private.shared_round_prediction_input_sources']) {
      assert.equal((await db.query(`select count(*)::integer n from ${table}`)).rows[0].n,0,`${table} escaped rollback`);
    }

    // Commit only in the disposable instance so isolation is chosen before the
    // first statement. This does not replace independent native writer races.
    await db.exec(`begin;${await sharedRoundPredictionInputsFixtureSql()}`);
    const identity = (await db.query(`select jsonb_build_object('actorId',f.actor,'profileId',f.pair,
      'roundId',p.round_id,'sourceId',p.source_capture_id,'captureId',gen_random_uuid()) value
      from pg_temp.outcome_fixture f cross join pg_temp.prediction_input_fixture p`)).rows[0].value;
    await db.query(`select set_config('request.jwt.claim.sub',$1,true)`,[identity.actorId]);
    const args = [identity.captureId,identity.profileId,identity.roundId,1,[identity.sourceId]];
    const captureSql = `select private.capture_shared_round_prediction_input_v1($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid[]) value`;
    const captured = (await db.query(captureSql,args)).rows[0].value;
    await db.exec('commit;');
    for (const isolation of ['REPEATABLE READ','SERIALIZABLE']) {
      await db.exec(`begin isolation level ${isolation};`);
      try {
        await db.query(`select set_config('request.jwt.claim.sub',$1,true)`,[identity.actorId]);
        assert.deepEqual((await db.query(captureSql,args)).rows[0].value,captured,`${isolation} exact input retry changed`);
        await db.exec('savepoint allocation_guard;');
        const newId = (await db.query('select gen_random_uuid()::text id')).rows[0].id;
        await assert.rejects(db.query(captureSql,[newId,...args.slice(1)]),error => error.code==='25001',
          `${isolation} allocated from a stale cap/enrollment snapshot`);
        await db.exec('rollback to savepoint allocation_guard;release savepoint allocation_guard;');
        await db.exec('savepoint erasure_guard;');
        await assert.rejects(db.query('delete from private.shared_round_outcome_captures where id=$1::uuid',[identity.sourceId]),
          error => error.code==='25001',`${isolation} allowed copied-source erasure with an old MVCC snapshot`);
        await db.exec('rollback to savepoint erasure_guard;release savepoint erasure_guard;');
        assert.deepEqual((await db.query('select private.get_shared_round_prediction_input_v1($1::uuid) value',[identity.captureId])).rows[0].value,captured);
        assert.equal((await db.query('select count(*)::integer n from private.shared_round_prediction_inputs')).rows[0].n,1);
        assert.equal((await db.query('select count(*)::integer n from private.shared_round_prediction_input_sources')).rows[0].n,1);
        assert.equal((await db.query('select count(*)::integer n from private.shared_round_outcome_captures where id=$1::uuid',[identity.sourceId])).rows[0].n,1);
      } finally { await db.exec('rollback;'); }
    }
    t.diagnostic('independent RR/SERIALIZABLE transactions reject allocation and source deletion (25001), preserving exact stored retry/get');
  } finally { await db.close(); }
});
