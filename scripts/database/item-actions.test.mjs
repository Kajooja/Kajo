import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { assertEmptyApplication, snapshotApplication } from './baseline-installation.mjs';
import { itemActionUpgradeSql } from './item-action-upgrade.mjs';
import { collectionActionUpgradeSql } from './collection-action-upgrade.mjs';
import { historyProjectionUpgradeSql } from './history-projection-upgrade.mjs';

test('atomic Item actions on the full fresh schema (PGlite; native smoke also runs in required CLI CI)', async () => {
  const installation = await buildFreshInstallation();
  const db = new PGlite();
  const snapshots = async sql => (await db.exec(sql)).flatMap(r => r.rows.filter(row => Object.hasOwn(row, 'snapshot')).map(row => row.snapshot));
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const actionIndex = installation.files.findIndex(file => file.name.endsWith('_atomic_item_actions.sql'));
    assert.ok(actionIndex > 0);
    for (const file of installation.files.slice(0, actionIndex)) await db.exec(`begin; ${file.sql} commit;`);
    const upgrade = await snapshots(itemActionUpgradeSql(installation.files[actionIndex], installation.candidate.tables));
    assert.match(upgrade[0]?.itemActionUpgrade, /^PASS: unchanged populated/);
    const collectionIndex = installation.files.findIndex(file => file.name.endsWith('_atomic_collection_actions.sql'));
    assert.ok(collectionIndex > actionIndex);
    for (const file of installation.files.slice(actionIndex, collectionIndex)) await db.exec(`begin; ${file.sql} commit;`);
    const collectionUpgrade = await snapshots(collectionActionUpgradeSql(installation.files[collectionIndex], installation.candidate.tables));
    assert.match(collectionUpgrade[0]?.collectionActionUpgrade, /^PASS: unchanged populated/);
    for (const file of installation.files.slice(collectionIndex)) {
      if (file.name.endsWith('_bootstrap_history_projection.sql')) {
        const fixture = await readFile(new URL('existing-application-fixture.sql', import.meta.url), 'utf8');
        const upgrade = await snapshots(historyProjectionUpgradeSql(file, fixture, installation.candidate.tables));
        assert.match(upgrade[0]?.historyProjectionUpgrade, /^PASS: unchanged populated/);
      }
      const historyClear = file.name.endsWith('_clear_consumed_history.sql');
      if (!file.name.endsWith('_list_membership_resurfacing.sql') && !historyClear) {
        await db.exec(`begin; ${file.sql} commit;`); continue;
      }
      const target = historyClear ? 'private.commit_collection_action_v1(jsonb)'
        : 'private.resurfacing_policy_decision_v1(uuid,uuid,jsonb,timestamptz)';
      const definitions = `select n.nspname,p.proname,p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig,
        case when p.oid='${target}'::regprocedure
          then null else pg_get_functiondef(p.oid) end as definition
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('public','private') and p.prokind='f' order by p.oid`;
      const beforeFunctions = (await db.query(definitions)).rows;
      await db.exec(`begin; ${file.sql} commit;`);
      assert.deepEqual((await db.query(definitions)).rows, beforeFunctions,
        'Collection forward must preserve all function identities/ACLs and every unrelated definition');
    }
    const before = await snapshotApplication(snapshots, installation.candidate, { forward: true });
    assertEmptyApplication(before);
    const result = await snapshots(await readFile(new URL('item-action-smoke.sql', import.meta.url), 'utf8'));
    assert.match(result[0]?.itemActions, /^PASS: atomic/);
    const collections = await snapshots(await readFile(new URL('collection-action-smoke.sql', import.meta.url), 'utf8'));
    assert.match(collections[0]?.collectionActions, /^PASS: atomic/);
    const delivery = await snapshots(await readFile(new URL('delivery-order-smoke.sql', import.meta.url), 'utf8'));
    assert.match(delivery[0]?.deliveryOrder, /^PASS: 14 Item/);
    const listed = await snapshots(await readFile(new URL('list-membership-smoke.sql', import.meta.url), 'utf8'));
    assert.match(listed[0]?.listMembership, /^PASS: public delivery/);
    const history = await snapshots(await readFile(new URL('history-clear-smoke.sql', import.meta.url), 'utf8'));
    assert.match(history[0]?.historyClear, /^PASS: atomic correction/);
    const bootstrap = await snapshots(await readFile(new URL('bootstrap-history-smoke.sql', import.meta.url), 'utf8'));
    assert.match(bootstrap[0]?.bootstrapHistory, /^PASS: calibration/);
    assert.deepEqual(await snapshotApplication(snapshots, installation.candidate, { forward: true }), before,
      'Command acceptance must roll back all test objects, accounts, state and evidence');
  } finally { await db.close(); }
});
