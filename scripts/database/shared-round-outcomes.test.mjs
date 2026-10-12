import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { sharedRoundOutcomesSmokeSql, sharedRoundOutcomesUpgradeSql } from './shared-round-outcomes.mjs';

test('joint outcome replay uses an immutable cutoff prefix with explicit visibility/membership uncertainty (full schema)', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_shared_round_outcomes.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_shared_rating_round_evidence.sql')));
    for (const file of files.slice(0, index)) await db.exec(`begin; ${file.sql} commit;`);
    let started = performance.now();
    const upgrade = (await db.exec(await sharedRoundOutcomesUpgradeSql(files[index])))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(upgrade[0]?.sharedRoundOutcomesUpgrade, /^PASS: every existing row/);
    t.diagnostic(`populated outcome-reader upgrade completed in ${Math.round(performance.now() - started)} ms`);
    for (const file of files.slice(index)) await db.exec(`begin; ${file.sql} commit;`);
    started = performance.now();
    const smoke = (await db.exec(await sharedRoundOutcomesSmokeSql()))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(smoke[0]?.sharedRoundOutcomes, /^PASS:/);
    t.diagnostic(`cutoff, maturity and attribution matrix completed in ${Math.round(performance.now() - started)} ms`);
    assert.equal((await db.query('select count(*)::integer n from auth.users')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::integer n from private.shared_rating_rounds')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::integer n from public.events')).rows[0].n, 0);
  } finally { await db.close(); }
});
