import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { predictionChainProvenanceSmokeSql } from './prediction-chain-provenance.mjs';

test('catalog continuation preserves later-page zero-rating, late exposure and frozen evaluation origins', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    assert.ok(files.some(file => file.name.endsWith('_catalog_prediction_chain.sql')),
      'The protocol-3 append-only forward is required');
    for (const file of files) await db.exec(`begin; ${file.sql} commit;`);
    for (const digits of [0, 3]) {
      await db.exec(`set extra_float_digits=${digits}`);
      const snapshots = (await db.exec(await predictionChainProvenanceSmokeSql()))
        .flatMap(result => result.rows.map(row => row.snapshot));
      assert.match(snapshots[0]?.catalogChainProvenance, /^PASS: later-page rating zero/);
      assert.equal((await db.query('select count(*)::integer n from private.prediction_page_receipts')).rows[0].n, 0);
      assert.equal((await db.query('select count(*)::integer n from public.events')).rows[0].n, 0);
      assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits, String(digits));
    }
  } finally { await db.close(); }
});
