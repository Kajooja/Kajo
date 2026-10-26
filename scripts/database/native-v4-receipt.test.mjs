import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyNativeV4ReceiptUpgrade, verifyNativeV4Receipt } from './native-v4-receipt.mjs';

test('V4 receipt forward preserves prior generations and binds current forecast admission', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(f => f.name.endsWith('_native_v4_receipt_forecast_binding.sql'));
    assert.ok(index > 0);
    for (const f of files.slice(0, index)) await db.exec(`begin;${f.sql}commit;`);
    const migration = files[index];
    for (const [name, drift] of [
      ['body', `do $drift$ declare d text;b text;begin select pg_get_functiondef(oid),prosrc into d,b from pg_proc
        where oid='private.taste_session_v2(jsonb)'::regprocedure;execute replace(d,b,b||E'\n-- drift');end;$drift$;`],
      ['configuration', `alter function private.native_final_run_input_v1(jsonb,jsonb,jsonb,uuid) set search_path=public;`],
      ['definer', `alter function private.validate_native_final_source_v1(uuid) security definer;`],
      ['public grant', `grant execute on function private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb) to anon;`],
      ['lost existing access', `revoke execute on function private.taste_session_v2(jsonb) from authenticated;`],
      ['new owner collision', `create function private.capture_native_v4_receipt_v1() returns boolean language sql as $$select true$$;`],
      ['unknown default grant', `create role receipt_extra;alter default privileges for role postgres in schema private grant execute on functions to receipt_extra;`],
    ]) await t.test('atomic migration rejects ' + name, async () => {
      await db.exec('begin;' + drift);
      await assert.rejects(db.exec(migration.sql), /V4 receipt (source\/security drift|owner or target collision|new-function access drift)/u);
      await db.exec('rollback;');
      assert.equal((await db.query("select to_regprocedure('private.capture_native_v4_receipt_v1(uuid,pg_snapshot)') is null absent")).rows[0].absent, true);
    });
    const exec = async sql => {
      try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
      catch (error) { await db.exec('rollback;'); throw error; }
    };
    await t.test('populated forward retains complete rows, metadata and an old NEXT retry', async () => {
      const report = await verifyNativeV4ReceiptUpgrade(exec, migration);
      assert.equal(report.status, 'PASS'); t.diagnostic(JSON.stringify(report));
    });
    await t.test('current command, prewrite rejection, correction and source withdrawal', async () => {
      const report = await verifyNativeV4Receipt(exec);
      assert.equal(report.status, 'PASS'); t.diagnostic(JSON.stringify(report));
    });
  } finally { await db.close(); }
});
