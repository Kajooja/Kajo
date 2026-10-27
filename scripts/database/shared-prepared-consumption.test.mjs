import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifySharedPreparedUpgrade, verifySharedPreparedConsumption } from './shared-prepared-consumption.mjs';

test('genuine Shared prepared-input consumer preserves old rows and consumes relative evidence through common FINAL', async t => {
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
    const index = files.findIndex(file => file.name.endsWith('_shared_prepared_input_consumption.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_native_v4_receipt_forecast_binding.sql')));
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    for (const [label, mutation] of [
      ['configuration', `alter function private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb) set timezone='Europe/Helsinki';`],
      ['definer', `alter function private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb) security invoker;`],
      ['public grant', `grant execute on function private.native_final_run_input_v1(jsonb,jsonb,jsonb,uuid) to public;`],
      ['owner collision', `create function private.validate_shared_consumption_v1(jsonb) returns boolean language sql as $$select true$$;`],
      ['unknown default grant', `create role prepared_unreviewed;
        alter default privileges for role postgres grant execute on functions to prepared_unreviewed;`],
    ]) await t.test('atomic migration rejects ' + label, async () => {
      await db.exec('begin;' + mutation);
      await assert.rejects(db.exec(files[index].sql), /Shared consumption (source\/security drift|owner or target collision|owner-only access unavailable)/);
      await db.exec('rollback;');
      assert.equal((await db.query("select to_regclass('private.shared_round_prediction_consumptions') is null absent")).rows[0].absent, true);
    });
    const upgrade = await verifySharedPreparedUpgrade(exec, files[index]);
    assert.equal(upgrade.status, 'PASS');
    t.diagnostic(JSON.stringify(upgrade));
    for (const file of files.slice(index + 1)) await db.exec(`begin;${file.sql}commit;`);
    const consumption = await verifySharedPreparedConsumption(exec);
    assert.equal(consumption.status, 'PASS');
    assert.equal(consumption.conformance.comparedCandidates, 4);
    t.diagnostic(JSON.stringify(consumption));
    assert.equal((await db.query('select count(*)::integer n from private.shared_round_prediction_consumptions')).rows[0].n, 0);
  } catch (error) {
    if (error instanceof AggregateError) for (const failure of error.errors) t.diagnostic(failure.stack ?? failure.message);
    throw error;
  } finally { await db.close(); }
});
