import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { predictionWindowSmokeSql } from './prediction-page.mjs';

test('bounded continuation sources preserve frozen evidence and scope (full schema)', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of (await buildFreshInstallation()).files) await db.exec(`begin; ${file.sql} commit;`);
    const snapshots = (await db.exec(await predictionWindowSmokeSql())).flatMap(r => r.rows.map(row => {
      assert.deepEqual(Object.keys(row), ['snapshot']); return row.snapshot;
    }));
    assert.match(snapshots[0]?.predictionWindow, /^PASS: bounded frozen/);
    assert.equal((await db.query('select count(*)::integer n from private.prediction_continuation_windows')).rows[0].n,0);
  } finally { await db.close(); }
});
