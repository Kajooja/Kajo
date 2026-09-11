import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { predictionPageSmokeSql, predictionPageUpgradeSql } from './prediction-page.mjs';

test('identified first page preserves the scorer, immutable retries and empty run identity (full schema)', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(f => f.name.endsWith('_identified_prediction_page.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0,index)) await db.exec(`begin; ${file.sql} commit;`);
    const definition = async signature => (await db.query('select pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0].definition;
    const oldCore = await definition('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)');
    const oldPublic = await definition('public.rank_items_v1(uuid,text,text,integer,jsonb)');
    await db.exec('begin');
    try {
      await db.exec(oldCore.replace('+eligibility-first-v1','+unexpected-source'));
      await assert.rejects(db.exec(files[index].sql), /unexpected ranking source/);
    } finally { await db.exec('rollback'); }
    assert.equal(await definition('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'), oldCore);
    const fixture = await readFile(new URL('existing-application-fixture.sql', import.meta.url), 'utf8');
    const upgrade = (await db.exec(predictionPageUpgradeSql(files[index], fixture)))
      .flatMap(r => r.rows.map(row => {
        assert.deepEqual(Object.keys(row), ['snapshot']);
        return row.snapshot;
      }));
    assert.match(upgrade[0]?.predictionPageUpgrade, /^PASS: unchanged populated/);
    for (const file of files.slice(index)) await db.exec(`begin; ${file.sql} commit;`);
    assert.equal(await definition('private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)'),
      oldCore.replace('FUNCTION private.rank_items_v1_internal(',
        'FUNCTION private.rank_items_with_identity_v1(supplied_prediction_id uuid, ')
        .replace('current_prediction_id uuid := gen_random_uuid();','current_prediction_id uuid := supplied_prediction_id;'));
    assert.equal(await definition('public.rank_items_v1(uuid,text,text,integer,jsonb)'),oldPublic);
    const snapshots = (await db.exec(await predictionPageSmokeSql())).flatMap(r => r.rows.map(row => {
      assert.deepEqual(Object.keys(row),['snapshot']);
      return row.snapshot;
    }));
    assert.match(snapshots[0]?.predictionPage,/^PASS: identified/);
    assert.equal((await db.query('select count(*)::integer n from private.prediction_page_receipts')).rows[0].n,0);
  } finally { await db.close(); }
});
