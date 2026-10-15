import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import {
  sequentialTasteHostedManifest, loadSequentialTasteHostedForwards, validateSequentialTasteHostedForwards,
  remainingSequentialTasteHostedForwards, sequentialTasteHostedFunctionReference,
  sequentialTasteHostedFunctionSnapshotSql, sequentialTasteHostedPreflightSql, sequentialTasteHostedUpgradeSql,
  loadSequentialTasteHostedPrerequisite, sequentialTasteBootstrapCompactBody,
} from './personal-sequential-taste-hosted-upgrade.mjs';

async function postV1Database() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const { files } = await buildFreshInstallation();
  const index = files.findIndex(file => file.name === sequentialTasteHostedManifest.sourceCheckpoint);
  assert.ok(index >= 0);
  for (const file of files.slice(0, index + 1)) await db.exec(`begin;${file.sql}commit;`);
  return db;
}

test('sequential hosted successor pins only two additive forwards and requires an exact installed prefix', async () => {
  const files = await loadSequentialTasteHostedForwards();
  assert.equal(files.length, 2);
  assert.equal(sequentialTasteHostedManifest.applicationSource, 'c776de5fcdb62c72216b25a955a8c4b8685b2580');
  assert.throws(() => validateSequentialTasteHostedForwards(files.slice(1)), /exact reviewed sequential/);
  assert.throws(() => validateSequentialTasteHostedForwards([...files].reverse()), /dependency order/);
  assert.throws(() => validateSequentialTasteHostedForwards(files.map((f, i) => i ? f : { ...f, sql: f.sql + '\n-- drift' })), /Reviewed sequential SQL changed/);
  assert.throws(() => remainingSequentialTasteHostedForwards(), /explicit observed installed-forward prefix/);
  assert.throws(() => remainingSequentialTasteHostedForwards([sequentialTasteHostedManifest.forwards[1]]), /contiguous prefix/);
  assert.throws(() => remainingSequentialTasteHostedForwards([{ ...sequentialTasteHostedManifest.forwards[0], sha256: '0'.repeat(64) }]), /contiguous prefix/);
  for (let n = 0; n <= 2; n++) assert.equal(remainingSequentialTasteHostedForwards(sequentialTasteHostedManifest.forwards.slice(0, n)).length, 2 - n);
  await assert.rejects(sequentialTasteHostedPreflightSql(), /private sequential operator checkpoint/);
});

test('post-v1 sequential compound upgrade preserves real old session/challenge rows and exact receipts', async () => {
  const db = await postV1Database();
  try {
    const sql = await sequentialTasteHostedUpgradeSql(await loadSequentialTasteHostedForwards());
    const results = (await db.exec(sql)).flatMap(r => r.rows.map(row => row.snapshot));
    assert.match(results[0]?.sequentialTasteHostedUpgrade, /^PASS: exact two-forward chain/);
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 0);
    assert.equal((await db.query("select to_regprocedure('public.taste_session_v2(jsonb)') endpoint")).rows[0].endpoint, null);
    const compact = await sequentialTasteHostedUpgradeSql(await loadSequentialTasteHostedForwards(), { bootstrapVariant: 'COMPACT_V1' });
    assert.match((await db.exec(compact)).flatMap(r => r.rows.map(row => row.snapshot))[0]?.sequentialTasteHostedUpgrade, /^PASS: exact two-forward chain/);
    const altered = sql.replace('do $preserve$', "update public.items set title=title||' drift';\ndo $preserve$");
    await assert.rejects(db.exec(altered), /changed old rows/); await db.exec('rollback;');
    const leaked = sql.replace('do $preserve$', 'grant execute on function private.capture_personal_evaluation_v1(uuid,uuid,uuid[],timestamptz,jsonb) to authenticated;\ndo $preserve$');
    await assert.rejects(db.exec(leaked), /exposed an RPC\/private helper/); await db.exec('rollback;');
    const changedBody = sql.replace('do $preserve$', `do $drift$ declare f record;begin
      select pg_get_functiondef(oid) definition,prosrc into f from pg_proc where oid='private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure;
      execute replace(f.definition,f.prosrc,f.prosrc||E'\\n-- unreviewed');end;$drift$;\ndo $preserve$`);
    await assert.rejects(db.exec(changedBody), /unreviewed old body/); await db.exec('rollback;');
    await db.exec("insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'existing@example.invalid','{\"kajo_nickname\":\"Existing\"}');");
    await assert.rejects(db.exec(sql), /empty disposable state/); await db.exec('rollback;');
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 1);
  } catch (error) { delete error.query; throw error; } finally { await db.close(); }
});

test('read-only sequential preflight accepts exact zero/one/two-forward prefixes and rejects drift', async () => {
  const db = await postV1Database();
  const forwards = await loadSequentialTasteHostedForwards();
  const appliedForwards = [];
  const target = async () => ({ projectRef: 'aaaaaaaaaaaaaaaaaaaa', postgresMajor: 17,
    ...(await db.query(`select count(*)::int as "historyCount",md5(coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,
      'statementMd5',md5(array_to_string(statements,E'\\n'))) order by version),'[]'::jsonb)::text) as "historyMd5"
      from supabase_migrations.schema_migrations`)).rows[0] });
  try {
    await db.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text,statements text[]);');
    for (let n = 0; n <= 2; n++) {
      const installedForwards = sequentialTasteHostedManifest.forwards.slice(0, n);
      const functions = (await db.query(sequentialTasteHostedFunctionSnapshotSql)).rows[0].functions;
      assert.deepEqual(functions, await sequentialTasteHostedFunctionReference(installedForwards));
      const checkpoint = { target: await target(), functions, installedForwards, appliedForwards: [...appliedForwards] };
      const sql = await sequentialTasteHostedPreflightSql(checkpoint);
      const results = (await db.exec(sql)).flatMap(r => r.rows.map(row => row.snapshot));
      assert.match(results[0]?.sequentialTasteHostedPreflight, /^PASS: exact post-v1/);
      assert.equal(results[0].remainingForwards, 2 - n);
      await assert.rejects(db.exec(await sequentialTasteHostedPreflightSql({ ...checkpoint, target: { ...checkpoint.target, historyCount: 99 } })), /history changed/);
      await db.exec('rollback;');
      const f = (await db.query("select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid='private.reject_immutable_prediction_artifact_change_v1()'::regprocedure")).rows[0];
      await db.exec(f.definition.replace(f.prosrc, () => f.prosrc + '\n-- drift'));
      await assert.rejects(db.exec(sql), /source\/security\/prefix drift/); await db.exec('rollback;');
      await db.exec(f.definition);
      await db.exec('grant select on private.taste_session_commands to authenticated;');
      await assert.rejects(db.exec(sql), /private storage boundary drift/); await db.exec('rollback;');
      await db.exec('revoke select on private.taste_session_commands from authenticated;');
      const bodyDrift = structuredClone(functions); bodyDrift[0].definitionMd5 = '0'.repeat(32);
      await assert.rejects(sequentialTasteHostedPreflightSql({ ...checkpoint, functions: bodyDrift }), /exact reviewed installed prefix/);
      if (n > 0) {
        await assert.rejects(sequentialTasteHostedPreflightSql({ ...checkpoint, appliedForwards: [] }), /exact provider history receipt/);
        await db.query('update supabase_migrations.schema_migrations set statements=$1 where version=$2', [['unreviewed SQL'], appliedForwards[0].providerVersion]);
        await assert.rejects(db.exec(await sequentialTasteHostedPreflightSql({ ...checkpoint, target: await target() })), /provider\/source receipt mismatch/);
        await db.exec('rollback;');
        await db.query('update supabase_migrations.schema_migrations set statements=$1 where version=$2', [[forwards[0].sql], appliedForwards[0].providerVersion]);
        await db.query('delete from supabase_migrations.schema_migrations where version=$1', [appliedForwards[0].providerVersion]);
        await assert.rejects(db.exec(await sequentialTasteHostedPreflightSql({ ...checkpoint, target: await target() })), /provider\/source receipt mismatch/);
        await db.exec('rollback;');
        await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',
          [appliedForwards[0].providerVersion, appliedForwards[0].providerName, [forwards[0].sql]]);
        await db.query('insert into supabase_migrations.schema_migrations select * from supabase_migrations.schema_migrations where version=$1 limit 1', [appliedForwards[0].providerVersion]);
        await assert.rejects(db.exec(await sequentialTasteHostedPreflightSql({ ...checkpoint, target: await target() })), /provider\/source receipt mismatch/);
        await db.exec('rollback;');
        await db.query('delete from supabase_migrations.schema_migrations where ctid in(select ctid from supabase_migrations.schema_migrations where version=$1 limit 1)', [appliedForwards[0].providerVersion]);
        await db.exec('grant execute on function private.rank_items_candidate_with_identity_v1(timestamptz,uuid[],boolean,uuid[],boolean,uuid,uuid,text,text,integer,jsonb) to authenticated;');
        await assert.rejects(db.exec(sql), /source\/security\/prefix drift/); await db.exec('rollback;');
        await db.exec('revoke execute on function private.rank_items_candidate_with_identity_v1(timestamptz,uuid[],boolean,uuid[],boolean,uuid,uuid,text,text,integer,jsonb) from authenticated;');
      }
      if (n === 0) {
        await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',
          ['20261015999999', 'durable_sequential_taste', [forwards[1].sql]]);
        await assert.rejects(db.exec(await sequentialTasteHostedPreflightSql({ ...checkpoint, target: await target() })), /named history is missing/);
        await db.exec('rollback;');
        await db.exec("delete from supabase_migrations.schema_migrations where version='20261015999999';");
      }
      if (n === 2) {
        await db.exec('alter table private.sequential_taste_sessions disable trigger guard_sequential_taste_history_v2;');
        await assert.rejects(db.exec(sql), /lifecycle trigger drift/); await db.exec('rollback;');
        await db.exec('alter table private.sequential_taste_sessions enable trigger guard_sequential_taste_history_v2;');
      }
      if (n < 2) {
        await db.exec(`begin;${forwards[n].sql}commit;`);
        await assert.rejects(db.exec(sql), /source\/security\/prefix drift/); await db.exec('rollback;');
        const receipt = { ...sequentialTasteHostedManifest.forwards[n], providerVersion: `2026101520000${n}`,
          providerName: forwards[n].name.replace(/^\d+_/, '').replace(/\.sql$/, ''),
          statementMd5: createHash('md5').update(forwards[n].sql).digest('hex') };
        await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)', [receipt.providerVersion, receipt.providerName, [forwards[n].sql]]);
        appliedForwards.push(receipt);
      }
    }
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 0);
  } catch (error) { delete error.query; throw error; } finally { await db.close(); }
});

test('exact compact bootstrap bridge preserves semantics/metadata and accepts final chronological no-op only', async () => {
  const db = await postV1Database();
  const bridge = (await loadSequentialTasteHostedPrerequisite()).sql;
  const signature = 'private.bootstrap_evidence_weight_v1(text,integer)';
  const snapshot = async () => (await db.query(`select to_jsonb(p) metadata,pg_get_functiondef(oid) definition from pg_proc p where oid=$1::regprocedure`, [signature])).rows[0];
  const weights = async () => (await db.query(`select kind,rating,private.bootstrap_evidence_weight_v1(kind,rating) weight
    from unnest(array['RATED','CONSUMED','SAVED','UNKNOWN','NOT_INTERESTED',null]::text[]) k(kind)
    cross join unnest(array[-1,0,1,2,3,4,5,6,7,8,9,10,11,null]::integer[]) r(rating) order by kind nulls last,rating nulls last`)).rows;
  try {
    const canonical = await snapshot(), expected = await weights();
    await db.exec(canonical.definition.replace(canonical.metadata.prosrc, () => sequentialTasteBootstrapCompactBody));
    assert.equal(createHash('md5').update((await snapshot()).metadata.prosrc).digest('hex'), '6bb947d7276f7e45413f82e30e0b454f');
    assert.deepEqual(await weights(), expected);
    await db.exec(bridge); assert.deepEqual(await snapshot(), canonical); assert.deepEqual(await weights(), expected);
    await db.exec(bridge); assert.deepEqual(await snapshot(), canonical);
    for (const mutation of [
      canonical.definition.replace(canonical.metadata.prosrc, () => canonical.metadata.prosrc + '\n-- drift'),
      'grant execute on function private.bootstrap_evidence_weight_v1(text,integer) to authenticated;',
      "alter function private.bootstrap_evidence_weight_v1(text,integer) set search_path='public';",
      'alter function private.bootstrap_evidence_weight_v1(text,integer) stable;',
    ]) {
      await db.exec('begin;'+mutation);
      await assert.rejects(db.exec(bridge), /compatibility refused/); await db.exec('rollback;');
    }
    const forwards = await loadSequentialTasteHostedForwards();
    for (const f of forwards) await db.exec(`begin;${f.sql}commit;`);
    const final = await snapshot(); await db.exec(bridge); assert.deepEqual(await snapshot(), final);
  } catch (error) { delete error.query; throw error; } finally { await db.close(); }
});

test('observed compact preflight reports exact bridge requirement and refuses canonical declaration', async () => {
  const db = await postV1Database();
  try {
    await db.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text,name text,statements text[]);');
    const f = (await db.query("select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid='private.bootstrap_evidence_weight_v1(text,integer)'::regprocedure")).rows[0];
    await db.exec(f.definition.replace(f.prosrc, () => sequentialTasteBootstrapCompactBody));
    const checkpoint = { target: { projectRef:'aaaaaaaaaaaaaaaaaaaa',postgresMajor:17,historyCount:0,historyMd5:'d751713988987e9331980363e24189ce' },
      installedForwards: [], appliedForwards: [], bootstrapVariant:'COMPACT_V1',
      functions: (await db.query(sequentialTasteHostedFunctionSnapshotSql)).rows[0].functions };
    const results = (await db.exec(await sequentialTasteHostedPreflightSql(checkpoint))).flatMap(r => r.rows.map(row => row.snapshot));
    assert.match(results[0]?.sequentialTasteHostedPreflight, /^BRIDGE_REQUIRED:/);
    assert.equal(results[0].remainingForwards, 2);
    await assert.rejects(sequentialTasteHostedPreflightSql({...checkpoint,bootstrapVariant:'CANONICAL'}), /exact reviewed installed prefix/);
    await assert.rejects(sequentialTasteHostedPreflightSql({...checkpoint,prerequisiteReceipt:{}}), /never replay the bridge/);
  } catch (error) { delete error.query; throw error; } finally { await db.close(); }
});
