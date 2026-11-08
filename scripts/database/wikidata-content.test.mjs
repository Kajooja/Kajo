import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyWikidataProjection, verifyWikidataContentCapture } from './wikidata-content-verification.mjs';

test('Wikidata SQL and JavaScript agree on bounded source, identity, rank and reference cases', { timeout: 120_000 }, async t => {
  const db = new PGlite();
  try {
    const sql = await readFile(new URL('../../supabase/migrations/20261108000938_wikidata_native_content_capture.sql', import.meta.url), 'utf8');
    await db.exec('create schema private;' + sql.slice(0, sql.indexOf('create function private.validate_personal_rating_feature_use_v2')));
    // psql emits blank for SQL NULL but literal "null" for JSON null. Preserve
    // that distinction rather than letting PGlite's decoder hide it.
    const exec = async sql => (await db.query(`select value::text as wire from (${sql.trim().replace(/;$/, '')}) result(value)`))
      .rows.filter(row => row.wire !== null).map(row => JSON.parse(row.wire));
    const report = await verifyWikidataProjection(exec);assert.equal(report.status, 'PASS');t.diagnostic(JSON.stringify(report));
  } finally { await db.close(); }
});

test('native Wikidata capture fits independent content, preserves retries and retires changed dependencies', { timeout: 240_000 }, async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    const exec = async sql => {
      try { return (await db.exec(sql)).flatMap(r => r.rows.map(row => Object.values(row)[0])); }
      catch (error) { await db.exec('rollback;');throw error; }
    };
    const report = await verifyWikidataContentCapture(exec, callback => callback(exec));
    assert.equal(report.status, 'PASS');t.diagnostic(JSON.stringify(report));
  } finally { await db.close(); }
});
