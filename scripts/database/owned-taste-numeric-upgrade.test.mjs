import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyOwnedTasteNumericUpgrade } from './owned-taste-numeric-upgrade.mjs';

test('owned Taste forward preserves populated captures, committed answers, private ACLs and rollback', { timeout: 240_000 }, async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation(), index = files.findIndex(file => file.name.endsWith('_owned_taste_numeric_sources.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    const exec = async sql => {
      try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
      catch (error) { await db.exec('rollback;');throw error; }
    };
    const report = await verifyOwnedTasteNumericUpgrade(exec, callback => callback(exec), files[index]);
    assert.equal(report.status, 'PASS');t.diagnostic(JSON.stringify(report));
    for (const mutation of [
      'grant execute on function private.prepare_personal_rating_forecast_v3(uuid,uuid,uuid,integer,text,jsonb) to authenticated;',
      "alter function private.finalize_personal_rating_forecast_v2(uuid,jsonb) set statement_timeout='10s';",
      'update public.items set title=title||\' unwanted rewrite\';',
    ]) await assert.rejects(verifyOwnedTasteNumericUpgrade(exec, callback => callback(exec),
      { ...files[index], sql: files[index].sql + '\n' + mutation }), /changed|closed/);
  } finally { await db.close(); }
});
