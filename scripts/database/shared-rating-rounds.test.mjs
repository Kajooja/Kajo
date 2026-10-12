import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { sharedRatingRoundsSmokeSql, sharedRatingRoundsUpgradeSql } from './shared-rating-rounds.mjs';

test('Shared round evidence is additive, actor-specific, revisioned and never a scalar joint reward (full schema)', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_shared_rating_round_evidence.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_catalog_prediction_chain.sql')),
      'The additive round foundation must follow the immutable catalogue-chain forward');
    for (const file of files.slice(0, index)) await db.exec(`begin; ${file.sql} commit;`);
    let started = performance.now();
    const upgrade = (await db.exec(await sharedRatingRoundsUpgradeSql(files[index])))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(upgrade[0]?.sharedRatingRoundsUpgrade, /^PASS: every populated old row/);
    t.diagnostic(`populated additive upgrade completed in ${Math.round(performance.now() - started)} ms`);
    for (const file of files.slice(index)) await db.exec(`begin; ${file.sql} commit;`);
    started = performance.now();
    const smoke = (await db.exec(await sharedRatingRoundsSmokeSql()))
      .flatMap(result => result.rows.map(row => row.snapshot));
    assert.match(smoke[0]?.sharedRatingRounds, /^PASS:/);
    t.diagnostic(`round command/evidence matrix completed in ${Math.round(performance.now() - started)} ms`);
    assert.equal((await db.query('select count(*)::integer n from public.events')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::integer n from public.item_interactions')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::integer n from auth.users')).rows[0].n, 0,
      'The synthetic round rehearsal must leave no actors or durable evidence');
  } finally { await db.close(); }
});
