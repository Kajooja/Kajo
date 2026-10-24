import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyPersonalTastePools, verifyPersonalTastePoolUpgrade } from './personal-taste-pool-native.mjs';

test('native Taste pool verifier executes its committed-command and cleanup assertions on the full current schema', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const files = (await buildFreshInstallation()).files;
    const index = files.findIndex(file => file.name.endsWith('_versioned_taste_candidate_pools.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    const stages = [];
    const exec = async (sql, options) => {
      stages.push(options.stage);
      try {
        return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0]));
      } catch (error) {
        // A failed native psql connection rolls back its open transaction.
        await db.exec('rollback;');
        throw error;
      }
    };
    assert.equal((await verifyPersonalTastePoolUpgrade(exec, files[index])).status, 'PASS');
    for (const file of files.slice(index + 1)) await db.exec(`begin;${file.sql}commit;`);
    const result = await verifyPersonalTastePools(exec);
    assert.equal(result.status, 'PASS');
    assert.equal(result.policy, 'CANONICAL_FORECAST_POOL_V4');
    assert.equal(stages.at(-1), 'taste-pool-canonical-after');
  } finally { await db.close(); }
});
