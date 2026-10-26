import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyNativePredictionAdapter } from './native-prediction-adapter.mjs';

test('actual native sources and independent frozen replay cross the Kajo adapter and generic conformance boundary', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
    const tables = (await db.query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') order by 1`)).rows;
    const snapshot = async () => Promise.all(tables.map(async ({ name }) => [name,
      (await db.query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)).rows]));
    const before = await snapshot();
    const report = await verifyNativePredictionAdapter(async sql => (await db.exec(sql))
      .flatMap(result => result.rows.map(row => row.snapshot)));
    assert.equal(report.status, 'PASS');
    assert.equal(report.cases.length, 6);
    assert.ok(report.comparedCandidates > 50);
    assert.ok(report.scenarioCandidates > 0);
    assert.ok(report.maxAbsoluteScoreDifference <= report.absoluteTolerance);
    assert.equal(report.absoluteTolerance, 1e-12);
    assert.equal(report.predictiveQuality, 'NOT_EVALUATED');
    assert.deepEqual(await snapshot(), before, 'Native/portable conformance must leave every canonical table unchanged');
    t.diagnostic(JSON.stringify(report));
  } finally { await db.close(); }
});
