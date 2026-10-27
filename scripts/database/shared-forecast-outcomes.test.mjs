import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifySharedForecastOutcomes } from './shared-forecast-outcomes.mjs';

test('prospective Shared forecast reconciliation preserves frozen first answers, corrections and source withdrawal', async t => {
  const db = new PGlite();
  const exec = async sql => {
    try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
    catch (e) { await db.exec('rollback;'); throw e; }
  };
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(f => f.name.endsWith('_shared_forecast_outcome_reconciliation.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    for (const [label, mutation] of [
      ['name collision', `create function private.reconcile_shared_forecast_outcome_v1() returns boolean language sql as $$select true$$;`],
      ['unknown default grant', `create role reconciliation_unreviewed;
        alter default privileges for role postgres grant execute on functions to reconciliation_unreviewed;`],
    ]) await t.test('atomic forward rejects ' + label, async () => {
      await db.exec('begin;' + mutation);
      await assert.rejects(db.exec(files[index].sql), /Shared reconciliation (predecessor or owner unavailable|owner-only access unavailable)/);
      await db.exec('rollback;');
      assert.equal((await db.query("select to_regprocedure('private.reconcile_shared_forecast_outcome_v1(uuid,uuid,integer)') is null absent")).rows[0].absent, true);
    });
    t.diagnostic(JSON.stringify(await verifySharedForecastOutcomes(exec, files[index])));
    for (const file of files.slice(index + 1)) await db.exec(`begin;${file.sql}commit;`);
  } catch (e) {
    if (e instanceof AggregateError) for (const failure of e.errors) t.diagnostic(failure.stack ?? failure.message);
    throw e;
  } finally { await db.close(); }
});
