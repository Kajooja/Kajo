import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalRatingHostedMetadataSql, personalRatingHostedRowsSql }
  from './personal-rating-hosted-upgrade.mjs';
import { verifyPersonalRatingHostedUpgrade } from './personal-rating-hosted-native.mjs';

const values = results => results.flatMap(result => result.rows.map(row => Object.values(row)[0]));
async function predecessor() {
  const db = new PGlite();
  await db.exec(`create role rehearsal_admin superuser;set session authorization rehearsal_admin;
    alter role postgres rename to rehearsal_bootstrap;create role postgres superuser;set session authorization postgres;
    create role anon;create role authenticated;create role service_role bypassrls;grant authenticated,service_role to postgres;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
    create role supabase_auth_admin;create table auth.schema_migrations(version text);
    alter table auth.schema_migrations owner to supabase_auth_admin;grant select on auth.schema_migrations to postgres;
    insert into auth.schema_migrations values('retained-provider-history');`);
  const { files } = await buildFreshInstallation();
  for (const file of files.slice(0, 53)) {
    await db.exec(`begin;${file.sql}commit;`);
    await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',
      [file.name.slice(0, 14), file.name.slice(15, -4), [file.sql]]);
  }
  await db.exec(`alter default privileges for role postgres grant execute on functions to public;
    alter default privileges for role postgres grant select,insert,update,delete on tables to public;
    alter role postgres nosuperuser;`);
  return db;
}
async function checkpoint(db) {
  const [metadata] = values(await db.exec(personalRatingHostedMetadataSql));
  const [rows] = values(await db.exec(personalRatingHostedRowsSql(metadata)));
  return { metadata, rows };
}

test('rollback-only guarded forward seam preserves first53 and reports PGlite scope without native claims', async () => {
  const db = await predecessor();
  const stages = [];
  const exec = async (sql, options) => {
    assert.match(options.stage, /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/);
    assert.equal(options.timeoutMs, 45_000);
    stages.push(options.stage);
    return values(await db.exec(sql));
  };
  try {
    const before = await checkpoint(db);
    const report = await verifyPersonalRatingHostedUpgrade(exec, { runtimeScope: 'DISPOSABLE_PGLITE_ONLY' });
    assert.equal(report.status, 'PASS');assert.equal(report.runtimeScope, 'DISPOSABLE_PGLITE_ONLY');
    assert.equal(report.baseline, 'CANONICAL_FIRST_53');assert.equal(report.optional54, 'NOT_INSTALLED');
    assert.equal(report.additionalResets, 0);assert.equal(report.preservedHistoryReceipts, 53);
    assert.equal(report.newTables, 8);assert.equal(report.newFunctions, 20);assert.equal(report.newTriggers, 18);
    assert.deepEqual(report.faults.map(({ name }) => name), ['old-row-drift', 'second-forward-failure', 'new-column-grant']);
    assert.ok(report.faults.every(fault => fault.status === 'REJECTED' && fault.restoration === 'EXACT_CHECKPOINT'));
    assert.equal(report.providerReceipt, 'SIMULATED_SINGLE_TRANSACTION');
    assert.equal(report.cleanup, 'EXACT_CANONICAL_CHECKPOINT');
    assert.equal(report.hostedDeployment, 'NONE');assert.equal(report.qualityAdmission, 'NONE');
    assert.equal(report.servingActivation, 'NONE');assert.match(report.wrapperSha256, /^[a-f0-9]{64}$/);
    assert.ok(report.elapsedMs > 0 && report.elapsedMs < 120_000);
    assert.ok(Buffer.byteLength(JSON.stringify(report)) < 8192, 'Bounded report must not include SQL or raw fixtures');
    assert.deepEqual(await checkpoint(db), before);
    assert.ok(stages.includes('numeric-hosted-exact-forward-and-receipt'));
    assert.ok(stages.includes('personal-rating-fixture-cleanup'));

    let injected = false;
    await assert.rejects(verifyPersonalRatingHostedUpgrade(async (sql, options) => {
      if (options.stage === 'numeric-hosted-populated-metadata') {
        injected = true;throw new Error('intentional populated checkpoint failure');
      }
      return exec(sql, options);
    }, { runtimeScope: 'DISPOSABLE_PGLITE_ONLY' }), /intentional populated checkpoint failure/);
    assert.equal(injected, true);assert.deepEqual(await checkpoint(db), before,
      'Unexpected failure after committed fixture setup must restore the complete canonical checkpoint');
  } catch (error) { delete error.query;throw error; }
  finally { await db.close(); }
});

test('near-budget exhaustion refuses another query while preserving the full server/outer margin and cleanup', async t => {
  const db = await predecessor();
  let clockMs = 0;
  const clock = t.mock.method(performance, 'now', () => clockMs);
  try {
    const before = await checkpoint(db);
    for (const exhaustionStage of ['numeric-hosted-populated-metadata', 'personal-rating-source-page']) {
      clockMs = 0;
      const stages = [], deadlines = [];
      let exhausted = false;
      await assert.rejects(verifyPersonalRatingHostedUpgrade(async (sql, options) => {
        stages.push(options.stage);deadlines.push(options.timeoutMs);
        assert.equal(options.timeoutMs, 45_000, 'A server30s statement must keep the full outer45s deadline');
        const rows = values(await db.exec(sql));
        if (!exhausted && options.stage === exhaustionStage) {
          exhausted = true;
          clockMs = 75_001; // Only44999ms of the120s work budget remains.
        }
        return rows;
      }, { runtimeScope: 'DISPOSABLE_PGLITE_ONLY' }), /lacks a full query deadline within its execution budget/);
      assert.equal(exhausted, true, 'Reach the intended committed-fixture exhaustion point');
      if (exhaustionStage === 'numeric-hosted-populated-metadata')
        assert.ok(!stages.includes('numeric-hosted-populated-rows'), 'Do not start the next checkpoint query on a shortened deadline');
      else assert.equal(stages.filter(stage => stage === 'personal-rating-source-page').length, 1,
        'Do not create the next committed page after the work budget expires');
      assert.ok(!stages.includes('numeric-hosted-exact-forward-and-receipt'));
      assert.ok(stages.includes('personal-rating-fixture-cleanup'));
      assert.ok(stages.includes('numeric-hosted-final-metadata') && stages.includes('numeric-hosted-final-rows'));
      assert.ok(deadlines.every(deadline => deadline === 45_000));
      assert.deepEqual(await checkpoint(db), before, 'Budget exhaustion must restore all metadata/history/rows even during fixture setup');
    }
  } catch (error) { delete error.query;throw error; }
  finally { clock.mock.restore();await db.close(); }
});
