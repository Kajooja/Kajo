import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyPersonalRatingBaseline } from './personal-rating-baseline.mjs';

test('native numeric baseline consumes original resolved labels with frozen correction/Undo/clear/withdrawal prefixes', { timeout: 180_000 }, async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    const tables = (await db.query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') order by 1`)).rows;
    const rows = async () => Promise.all(tables.map(async ({ name }) => [name,
      (await db.query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)).rows]));
    const functions = async () => (await db.query(`select p.oid,to_jsonb(p) properties
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private','auth') order by p.oid`)).rows;
    const beforeRows = await rows(), beforeFunctions = await functions();
    const report = await verifyPersonalRatingBaseline(async sql => {
      try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => row.snapshot)); }
      catch (error) { await db.exec('rollback;'); throw error; }
    });
    assert.equal(report.status, 'PASS');
    assert.equal(report.caseCount, 15);
    assert.equal(report.qualityAdmission, 'NONE');
    assert.equal(report.sources.length, 5);
    assert.deepEqual(await rows(), beforeRows, 'Every canonical row survives the rollback-only numeric fixture');
    assert.deepEqual(await functions(), beforeFunctions, 'Existing function bodies, owners and grants remain unchanged');
    t.diagnostic(JSON.stringify({ status: report.status, version: report.version, caseCount: report.caseCount,
      sources: report.sources, cleanup: report.cleanup, qualityAdmission: report.qualityAdmission }));
  } finally { await db.close(); }
});
