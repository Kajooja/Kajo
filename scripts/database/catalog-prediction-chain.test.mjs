import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { catalogPredictionChainSmokeSql, catalogPredictionChainUpgradeSql,
  catalogPredictionChainUpgradeFixtureSql } from './catalog-prediction-chain.mjs';

test('catalog continuation admits beyond 50 with fresh immutable sources, exact retries and honest bounds (full schema)', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const chainIndex = files.findIndex(file => file.name.endsWith('_catalog_prediction_chain.sql'));
    assert.ok(chainIndex > files.findIndex(file => file.name.endsWith('_atomic_prediction_pages.sql')));
    for (const file of files.slice(0, chainIndex)) await db.exec(`begin; ${file.sql} commit;`);
    const original = (await db.query("select pg_get_functiondef('private.rank_items_page_v1(jsonb)'::regprocedure) d")).rows[0].d;
    assert.match(original, /Profile access denied/);
    await db.exec(`begin; ${original.replace('Profile access denied', 'Unexpected profile boundary')}`);
    try { await assert.rejects(db.exec(files[chainIndex].sql), /unexpected ranking source/); }
    finally { await db.exec('rollback'); }
    assert.equal((await db.query("select to_regclass('private.prediction_catalog_chains') r")).rows[0].r, null,
      'Rejected source drift left partial catalog-chain DDL');
    assert.equal((await db.query("select to_regprocedure('private.rank_items_frozen_page_v2(jsonb)') r")).rows[0].r, null,
      'Rejected source drift left a cloned dispatcher');
    assert.equal((await db.query("select to_regprocedure('private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)') r")).rows[0].r, null,
      'Rejected source drift left cloned ranking functions');
    assert.equal((await db.query("select pg_get_functiondef('private.rank_items_page_v1(jsonb)'::regprocedure) d")).rows[0].d, original);
    const fixture = await catalogPredictionChainUpgradeFixtureSql();
    let stageStarted = performance.now();
    const upgrade = await db.exec(catalogPredictionChainUpgradeSql(files[chainIndex], fixture));
    assert.match(upgrade.flatMap(result => result.rows)[0]?.snapshot.catalogChainUpgrade, /^PASS: populated v1\/v2/);
    t.diagnostic(`populated-upgrade completed in ${Math.round(performance.now() - stageStarted)} ms`);
    for (const file of files.slice(chainIndex)) await db.exec(`begin; ${file.sql} commit;`);
    for (const [digits, name] of [[0, 'catalog-prediction-chain-smoke.sql'], [3, 'catalog-prediction-chain-boundaries.sql']]) {
      await db.exec(`set extra_float_digits=${digits}`);
      stageStarted = performance.now();
      const snapshots = (await db.exec(await catalogPredictionChainSmokeSql(name)))
        .flatMap(result => result.rows.map(row => row.snapshot));
      assert.match(snapshots[0]?.catalogChain, /^PASS:/);
      assert.equal((await db.query('select count(*)::integer n from private.prediction_page_receipts')).rows[0].n, 0);
      assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits, String(digits));
      t.diagnostic(`${name} completed in ${Math.round(performance.now() - stageStarted)} ms`);
    }
  } finally { await db.close(); }
});
