import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { inspectPersonalRatingOwnerCensus, verifyPersonalRatingEvaluation } from './personal-rating-evaluation.mjs';

test('trusted owner census rejects malformed scope before acquiring a connection', async () => {
  const id = 'a4021000-0000-4000-8000-000000000001';
  const forbidden = () => { throw new Error('Must not acquire a database connection'); };
  for (const request of [null, { actorUserId: id, profileId: "x';select 1;--" }, { actorUserId: [], profileId: id }]) {
    await assert.rejects(inspectPersonalRatingOwnerCensus(forbidden, request), /Invalid numeric census owner/);
  }
});

test('owner census releases its lifecycle transaction on a missing owner or preflight payload budget', async () => {
  const id = 'a4021000-0000-4000-8000-000000000001';
  for (const stage of ['personal-rating-census-owner', 'personal-rating-census-budget']) {
    const calls = [];
    const withSqlSession = callback => callback(async (sql, options) => {
      calls.push(options.stage);
      if (options.stage === 'personal-rating-census-owner') return stage === options.stage ? [] : [id];
      if (options.stage === 'personal-rating-census-budget') return [{ count: 129, bytes: 1 }];
      return [];
    });
    await assert.rejects(inspectPersonalRatingOwnerCensus(withSqlSession, { actorUserId: id, profileId: id }),
      /Numeric census (owner unavailable|budget exceeded)/);
    assert.equal(calls.at(-1), 'personal-rating-census-rollback');
    assert.equal(calls.includes('personal-rating-census-commit'), false);
    assert.equal(calls.includes('personal-rating-census-inspections'), false);
  }
});

test('actual numeric captures reconcile all owner allocations, frozen answers, fractional measurements and withdrawals',
  { timeout: 240_000 }, async t => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      for (const file of (await buildFreshInstallation()).files) await db.exec(`begin;${file.sql}commit;`);
      const exec = async sql => {
        try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
        catch (error) { await db.exec('rollback;'); throw error; }
      };
      // A single PGlite connection preserves the ordinary READ COMMITTED
      // lifecycle transaction; independent lock races remain native-only.
      const report = await verifyPersonalRatingEvaluation(exec, callback => callback(exec));
      assert.equal(report.status, 'PASS');
      assert.equal(report.fractionalNativeMeasurement, 'SQL_DECIMAL_TOLERATED_REPLAYED_PERTURBATION_REJECTED');
      assert.equal(report.qualityAdmission, 'NONE'); assert.equal(report.servingActivation, 'NONE');
      assert.equal(report.cleanup, 'CANONICAL_ROWS_RESTORED');
      t.diagnostic(JSON.stringify(report));
    } finally { await db.close(); }
  });
