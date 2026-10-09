import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalNativeDecaySmokeSql, personalNativeDecayUpgradeSql } from './personal-native-decay.mjs';

test('native LongTerm state/scoring use one versioned elapsed kernel while frozen history remains exact (full schema)', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_personal_native_decay_parity.sql'));
    assert.ok(index>files.findIndex(file => file.name.endsWith('_shared_round_prediction_inputs.sql')),
      'Expected one new CLI-generated forward; historical migration bytes stay in the accepted lineage');
    for (const file of files.slice(0,index)) await db.exec(`begin;${file.sql}commit;`);
    let started = performance.now();
    const upgrade = (await db.exec(await personalNativeDecayUpgradeSql(files[index])))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(upgrade[0]?.personalNativeDecayUpgrade,/^PASS: actual old memory/);
    t.diagnostic(`populated actual old sign contradiction + exact upgrade preservation ${Math.round(performance.now()-started)} ms`);

    // Independently challenge the preservation verifier. Each altered forward
    // must abort without changing persisted application/schema state.
    for (const [label,sql] of [
      ['populated Item row',`update public.items set title=title||' unexpected forward mutation';`],
      ['unrelated bootstrap floor',`create or replace function private.bootstrap_decay_v1(state_as_of timestamptz,evidence_at timestamptz)
        returns double precision language sql immutable security invoker set search_path='' as $$select 0.3::double precision$$;`],
      ['extra approved scorer change',`do $extra$ declare p record;begin
        select pg_get_functiondef(oid) definition,prosrc into strict p from pg_proc
          where oid='private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure;
        execute replace(p.definition,p.prosrc,p.prosrc||E'\n-- Unapproved extra scorer body');
      end;$extra$;`],
    ]) {
      try {
        await assert.rejects(db.exec(await personalNativeDecayUpgradeSql({...files[index],sql:files[index].sql+'\n'+sql})),
          /changed|approved|preserv/i,`${label} escaped populated preservation`);
      } finally { await db.exec('rollback;'); }
    }
    // Migration guard rejects a drifted live clone before any rewrite is
    // committed. This is the actual installed protocol3 body, not old-file text.
    await db.exec('begin;');
    try {
      const p = (await db.query(`select pg_get_functiondef(oid) definition,prosrc from pg_proc
        where oid='private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)'::regprocedure`)).rows[0];
      await db.exec(p.definition.replace(p.prosrc,()=>p.prosrc+'\n-- unknown installed source'));
      await assert.rejects(db.exec(files[index].sql),/unexpected|source|drift|guard/i);
    } finally { await db.exec('rollback;'); }
    assert.equal((await db.query("select to_regprocedure('private.native_long_term_decay_v2(timestamptz,timestamptz)') helper")).rows[0].helper,null,
      'Rejected drift left the new helper behind');
    for (const file of files.slice(index)) await db.exec(`begin;${file.sql}commit;`);
    started = performance.now();
    const smoke = (await db.exec(await personalNativeDecaySmokeSql()))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(smoke[0]?.personalNativeDecay,/^PASS: shared native LT math/);
    t.diagnostic(`full math/source-selection/bootstrap/serving/frozen-replay matrix ${Math.round(performance.now()-started)} ms`);
    for (const relation of ['auth.users','public.events','private.prediction_runs','private.shadow_prediction_runs',
      'private.prediction_page_receipts','private.profile_bootstrap_evidence']) {
      assert.equal((await db.query(`select count(*)::integer n from ${relation}`)).rows[0].n,0,`${relation} escaped rollback`);
    }
  } finally { await db.close(); }
});
