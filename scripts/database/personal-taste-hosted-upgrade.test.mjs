import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { loadTasteHostedForwards, validateTasteHostedForwards, tasteHostedPreflightSql, tasteHostedUpgradeSql, tasteCatalogFunctionReference, tasteImmutableGuardCompactBody } from './personal-taste-hosted-upgrade.mjs';

async function catalogDatabase() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const {files}=await buildFreshInstallation();
  const start=files.findIndex(f=>f.name.endsWith('_shared_rating_round_evidence.sql'));
  for(const file of files.slice(0,start))await db.exec(`begin;${file.sql}commit;`);
  return db;
}

test('reviewed hosted chain rejects missing, reordered and altered forwards', async () => {
  const files=await loadTasteHostedForwards();
  assert.throws(()=>validateTasteHostedForwards(files.slice(1)),/exact reviewed/);
  assert.throws(()=>validateTasteHostedForwards([files[1],files[0],...files.slice(2)]),/dependency order/);
  assert.throws(()=>validateTasteHostedForwards(files.map((f,i)=>i===0?{...f,sql:f.sql+'\n-- unreviewed change'}:f)),/Reviewed SQL changed/);
  await assert.rejects(tasteHostedPreflightSql(),/private operator checkpoint/);
});

test('complete catalog-to-Taste upgrade preserves populated old state and permits frozen challenge (full schema)', async () => {
  const db=await catalogDatabase();
  try {
    const forwards=await loadTasteHostedForwards();
    const sql=await tasteHostedUpgradeSql(forwards);
    const results=(await db.exec(sql)).flatMap(r=>r.rows.map(row=>row.snapshot));
    assert.match(results[0]?.hostedTasteUpgrade,/^PASS: complete reviewed chain/);
    assert.match(results[1]?.personalTasteChallenge,/^PASS: canonical pre-answer freeze/);
    assert.equal((await db.query('select count(*)::integer n from auth.users')).rows[0].n,0);
    assert.equal((await db.query("select to_regprocedure('public.taste_session_v1(jsonb)') endpoint")).rows[0].endpoint,null);
    // Independently prove the compound snapshot rejects an extra old-row mutation.
    const altered=sql.replace('do $preserve$',"update public.items set title=title||' unexpected mutation';\ndo $preserve$");
    await assert.rejects(db.exec(altered),/changed old rows/);
    await db.exec('rollback;');
    const leaked=sql.replace('do $preserve$',"grant execute on function private.native_long_term_decay_v2(timestamptz,timestamptz) to authenticated;\ndo $preserve$");
    await assert.rejects(db.exec(leaked),/exposed new private helpers/);
    await db.exec('rollback;');
    // The guard precedes every forward and forbids use on an existing database.
    await db.exec("insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'existing@example.invalid','{\"kajo_nickname\":\"Existing\"}');");
    await assert.rejects(db.exec(sql),/empty disposable state/);
    await db.exec('rollback;');
    assert.equal((await db.query("select to_regprocedure('public.taste_session_v1(jsonb)') endpoint")).rows[0].endpoint,null);
  }catch(error){delete error.query;throw error;}finally{await db.close();}
});

test('read-only hosted preflight rejects history, body and endpoint drift (isolated catalog generation)', async () => {
  const db=await catalogDatabase();
  try {
    await db.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text,statements text[]);');
    const checkpoint={target:{projectRef:'aaaaaaaaaaaaaaaaaaaa',postgresMajor:17,historyCount:1,
      historyMd5:'00000000000000000000000000000000'},functions:await tasteCatalogFunctionReference()};
    const sql=await tasteHostedPreflightSql(checkpoint);
    await assert.rejects(db.exec(sql),/history changed/);await db.exec('rollback;');
    const isolated=await tasteHostedPreflightSql({...checkpoint,target:{...checkpoint.target,
      historyCount:0,historyMd5:'d751713988987e9331980363e24189ce'}});
    const result=(await db.exec(isolated)).flatMap(r=>r.rows.map(row=>row.snapshot));
    assert.match(result[0]?.hostedTastePreflight,/^PASS: observed history/);
    const guard=(await db.query("select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid='private.reject_immutable_prediction_artifact_change_v1()'::regprocedure")).rows[0];
    await db.exec(guard.definition.replace(guard.prosrc,()=>tasteImmutableGuardCompactBody));
    await assert.rejects(db.exec(isolated),/exact compatibility bridge before forwards/);await db.exec('rollback;');
    await db.exec(guard.definition.replace(guard.prosrc,()=>guard.prosrc+'\n-- unreviewed immutable guard'));
    await assert.rejects(db.exec(isolated),/immutable guard source drift/);await db.exec('rollback;');
    await db.exec(guard.definition);
    await db.exec('grant execute on function private.reject_immutable_prediction_artifact_change_v1() to authenticated;');
    await assert.rejects(db.exec(isolated),/immutable guard security\/configuration drift/);await db.exec('rollback;');
    await db.exec('revoke execute on function private.reject_immutable_prediction_artifact_change_v1() from authenticated;');
    const f=(await db.query("select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid='private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure")).rows[0];
    await db.exec(f.definition.replace(f.prosrc,()=>f.prosrc+'\n-- unreviewed source'));
    await assert.rejects(db.exec(isolated),/source drift/);await db.exec('rollback;');
    await db.exec(f.definition);
    await db.exec('grant execute on function private.rank_items_v0(uuid,text,text,integer,jsonb) to anon;');
    await assert.rejects(db.exec(isolated),/security\/configuration drift/);await db.exec('rollback;');
    await db.exec('revoke execute on function private.rank_items_v0(uuid,text,text,integer,jsonb) from anon;');
    await db.exec("create function public.taste_session_v1(jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;");
    await assert.rejects(db.exec(isolated),/endpoint checkpoint changed/);await db.exec('rollback;');
  }catch(error){delete error.query;throw error;}finally{await db.close();}
});
