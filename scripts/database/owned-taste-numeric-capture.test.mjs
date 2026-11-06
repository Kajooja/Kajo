import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { captureOwnedTasteNumericForecast } from './owned-taste-numeric-capture.mjs';
import { verifyOwnedTasteNumericCapture } from './owned-taste-numeric-verification.mjs';

test('owned Taste capture validates intent before opening a connection', async () => {
  const id = 'a4320000-0000-4000-8000-000000000001';
  for (const change of [{ actor: 'bad' }, { horizon: 0 }, { horizon: '10' }, { origin: 'public' }]) {
    await assert.rejects(captureOwnedTasteNumericForecast(() => { throw new Error('Connection must not open'); },
      { id, actor: id, source: id, target: id, ...change }), /Invalid owned Taste capture/);
  }
});

test('new frozen numeric generation trains on owned Taste and retires only its dependent captures', { timeout: 240_000 }, async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    const exec = async sql => {
      try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
      catch (error) { await db.exec('rollback;'); throw error; }
    };
    const withSession = callback => callback(exec);
    const report = await verifyOwnedTasteNumericCapture(exec, withSession);
    assert.equal(report.status, 'PASS');t.diagnostic(JSON.stringify(report));
  } finally { await db.close(); }
});
