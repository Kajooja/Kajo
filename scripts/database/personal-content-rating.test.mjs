import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { capturePersonalContentRatingForecast, verifyPersonalContentRating } from './personal-content-rating.mjs';

test('trusted content worker rejects malformed native identities and intent before acquiring a connection', async () => {
  const id = 'a4051000-0000-4000-8000-000000000001';
  const request = { actor: id, source: id, target: id, id, horizon: 3600, origin: 'synthetic' };
  const forbidden = () => { throw new Error('Must not acquire a database connection'); };
  for (const changes of [{ actor: "x';drop table public.events;--" }, { source: null }, { target: [] },
    { horizon: '3600);select 1;--' }, { horizon: 0 }, { horizon: Infinity }, { horizon: 1.5 },
    { origin: 'synthetic-as-observed' }]) {
    await assert.rejects(capturePersonalContentRatingForecast(forbidden, { ...request, ...changes }), /Invalid content capture/);
  }
});

test('native frozen content features produce held-out own-scale forecasts with actual compiled ridge and lifecycle cleanup',
  { timeout: 240_000 }, async t => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
      const exec = async sql => {
        try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
        catch (error) { await db.exec('rollback;');throw error; }
      };
      // One connection remains open across SQL prepare, actual TypeScript and
      // SQL finalize. Native independent-session checks cover lock scheduling.
      const report = await verifyPersonalContentRating(exec, callback => callback(exec));
      assert.equal(report.status, 'PASS');
      assert.equal(report.cases.filter(row => /^grade-/.test(row.name)).length, 11);
      assert.equal(report.qualityAdmission, 'NONE');
      assert.equal(report.servingActivation, 'NONE');
      assert.equal(report.cleanup, 'CANONICAL_ROWS_RESTORED');
      t.diagnostic(JSON.stringify({ status: report.status, cases: report.caseCount, sources: report.sources,
        actualForecast: report.actualForecast, cleanup: report.cleanup }));
    } finally { await db.close(); }
  });
