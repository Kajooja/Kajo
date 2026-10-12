import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { atomicPredictionPagesSmokeSql, predictionContinuationUpgradeSql } from './atomic-prediction-pages.mjs';

test('atomic continuation preserves distinct page evidence and frozen prefix replay (full schema)', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const windowIndex = files.findIndex(f => f.name.endsWith('_prediction_continuation_windows.sql'));
    const pageIndex = files.findIndex(f => f.name.endsWith('_atomic_prediction_pages.sql'));
    assert.equal(pageIndex, windowIndex + 1);
    for (const file of files.slice(0, windowIndex)) await db.exec(`begin; ${file.sql} commit;`);
    const upgrade = await db.exec(predictionContinuationUpgradeSql(files[windowIndex], files[pageIndex],
      await readFile(new URL('existing-application-fixture.sql', import.meta.url), 'utf8')));
    assert.match(upgrade.flatMap(r => r.rows)[0]?.snapshot.continuationUpgrade, /^PASS: populated pre-window/);
    await db.exec(`begin; ${files[windowIndex].sql} commit;`);
    // A mismatched source body fails the entire forward without partial DDL.
    const original = (await db.query("select pg_get_functiondef('private.rank_items_page_v1(jsonb)'::regprocedure) d")).rows[0].d;
    await db.exec(`begin; ${original.replace('continuation unavailable','unexpected continuation source')}`);
    try { await assert.rejects(db.exec(files[pageIndex].sql), /unexpected first-page source/); }
    finally { await db.exec('rollback'); }
    assert.equal((await db.query("select to_regclass('private.prediction_page_contexts') r")).rows[0].r, null);
    for (const file of files.slice(pageIndex)) await db.exec(`begin; ${file.sql} commit;`);
    for (const digits of [0, 3]) {
      await db.exec(`set extra_float_digits=${digits}`);
      for (const name of ['atomic-prediction-pages-smoke.sql', 'atomic-prediction-pages-boundaries.sql']) {
        const snapshots = (await db.exec(await atomicPredictionPagesSmokeSql(name)))
          .flatMap(r => r.rows.map(row => row.snapshot));
        assert.match(snapshots[0]?.atomicPages, /^PASS:/);
        assert.equal((await db.query('select count(*)::integer n from private.prediction_page_receipts')).rows[0].n, 0);
        assert.equal((await db.query('show extra_float_digits')).rows[0].extra_float_digits, String(digits));
      }
    }
  } finally { await db.close(); }
});
