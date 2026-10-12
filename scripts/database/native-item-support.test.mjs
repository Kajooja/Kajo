import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { nativeItemSupportFixtureSql, nativeItemSupportPatches, nativeItemSupportSmokeSql, nativeItemSupportUpgradeSql } from './native-item-support.mjs';

test('native confidence counts matching admitted distinct Items; preserves score versions and frozen history (full schema)', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_native_item_support.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_personal_working_prospective.sql')));
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    await t.test('actual populated confidence defect, unchanged live scoring and exact old receipt/row/function preservation', async () => {
      try {
        const result = (await db.exec(await nativeItemSupportUpgradeSql(files[index])))
          .flatMap(value => value.rows.map(row => row.snapshot));
        assert.match(result[0]?.nativeItemSupportUpgrade, /^PASS: old one-Item\/eight-tag defect/);
      } finally { await db.exec('rollback;'); }
    });
    await t.test('independent preservation verifier rejects unrelated rows, bootstrap or extra scorer edits and exposed helper ACLs', async () => {
      for (const [label, sql] of [
        ['populated row', `update public.items set title=title||' unexpected forward mutation';`],
        ['bootstrap floor', `create or replace function private.bootstrap_decay_v1(state_as_of timestamptz,evidence_at timestamptz)
          returns double precision language sql immutable security invoker set search_path='' as $$select 0.3::double precision$$;`],
        ['extra score edit', `do $extra$ declare p record;begin
          select pg_get_functiondef(oid) definition,prosrc into strict p from pg_proc
            where oid='private.rank_items_v0(uuid,text,text,integer,jsonb)'::regprocedure;
          execute replace(p.definition,p.prosrc,p.prosrc||E'\n-- Unapproved extra scorer body');
        end;$extra$;`],
        ['public helper', 'grant execute on function private.native_item_support_count_v1(uuid[]) to public;'],
      ]) {
        try {
          await assert.rejects(db.exec(await nativeItemSupportUpgradeSql({ ...files[index], sql: files[index].sql + '\n' + sql })),
            /changed|approved|public API roles/i, `${label} escaped independent preservation`);
        } finally { await db.exec('rollback;'); }
      }
    });
    await t.test('whole installed body guards reject either drifted kernel before helper creation', async () => {
      for (const { signature } of nativeItemSupportPatches) {
        await db.exec('begin;');
        try {
          const p = (await db.query('select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid=$1::regprocedure', [signature])).rows[0];
          await db.exec(p.definition.replace(p.prosrc, () => p.prosrc + '\n-- unknown installed source'));
          await assert.rejects(db.exec(files[index].sql), /Native Item support forward: unexpected source/);
        } finally { await db.exec('rollback;'); }
        assert.equal((await db.query("select to_regprocedure('private.native_item_support_count_v1(uuid[])') helper")).rows[0].helper, null);
      }
    });
    // Preserve the pre-fusion support contract; fused source ownership has its
    // own full-schema matrix and cannot satisfy this old overlap assertion.
    const fusionIndex = files.findIndex(file => file.name.endsWith('_personal_source_fusion.sql'));
    for (const file of files.slice(index, fusionIndex < 0 ? undefined : fusionIndex)) await db.exec(`begin;${file.sql}commit;`);
    await t.test('native/book/movie/tag/repeat/zero/undo/time/Profile/missing/bootstrap matrix and ordinary/catalogue parity', async () => {
      const result = (await db.exec(await nativeItemSupportSmokeSql())).flatMap(value => value.rows.map(row => row.snapshot));
      assert.match(result[0]?.nativeItemSupport, /^PASS: distinct native Item support/);
      for (const relation of ['auth.users', 'public.events', 'public.items', 'private.prediction_runs',
        'private.shadow_prediction_runs', 'private.prediction_page_receipts', 'private.profile_bootstrap_evidence']) {
        assert.equal((await db.query(`select count(*)::integer n from ${relation}`)).rows[0].n, 0, `${relation} escaped rollback`);
      }
    });
    await t.test('actual support evaluation is bounded by the retained limit even with more than 50 eligible candidates', async () => {
      const helper = (await db.query("select to_jsonb(p) body from pg_proc p where p.oid='private.native_item_support_count_v1(uuid[])'::regprocedure")).rows[0].body;
      await db.exec('begin;');
      try {
        await db.exec(await nativeItemSupportFixtureSql());
        await db.exec(`insert into public.items(id,item_type,title,tags,discoverable)
          select gen_random_uuid(),'BOOK','Support capacity '||n,
            (select i.tags from public.items i join pg_temp.item_support_fixture f on f.evidence=i.id),true
          from generate_series(1,120) n;`);
        const [{ personal }] = (await db.query('select personal from pg_temp.item_support_fixture')).rows;
        const query = async (kernel, limit) => (await db.query(`select jsonb_agg(pg_temp.item_support_comparable(to_jsonb(r))
          ||jsonb_build_object('confidence',r.confidence) order by r.rank) body
          from private.${kernel}(${kernel === 'rank_items_catalog_base_v1' ? "'{}',false," : ''}$1,'FOR_YOU','BOOK',$2,'{}') r`, [personal, limit])).rows[0].body;
        const expected = new Map();
        for (const kernel of ['rank_items_v0', 'rank_items_catalog_base_v1']) {
          for (const limit of [1, 7, 50]) expected.set(`${kernel}/${limit}`, await query(kernel, limit));
        }
        // Disposable instrumentation forces observable calls. It is rolled back
        // with the complete fixture; the production helper remains pure.
        await db.exec(`create temp table item_support_calls(id integer) on commit drop;
          create or replace function private.native_item_support_count_v1(evidence_item_ids uuid[])
          returns integer language plpgsql volatile parallel unsafe security invoker set search_path='' as $$
          begin
            insert into pg_temp.item_support_calls values(1);
            return (select count(distinct item_id)::integer from unnest(coalesce(evidence_item_ids,'{}'::uuid[])) ids(item_id)
              where item_id is not null);
          end;$$;`);
        for (const kernel of ['rank_items_v0', 'rank_items_catalog_base_v1']) {
          for (const limit of [1, 7, 50]) {
            await db.exec('truncate pg_temp.item_support_calls;');
            const actual = await query(kernel, limit);
            assert.equal(actual.length, limit, 'Large eligible catalog must retain the requested candidate count');
            assert.deepEqual(actual, expected.get(`${kernel}/${limit}`), 'Bounded support counting must retain actual scores/ranks/features/confidence');
            assert.equal((await db.query('select count(*)::integer n from pg_temp.item_support_calls')).rows[0].n, limit,
              `${kernel} evaluated support outside its retained limit ${limit}`);
          }
        }
      } finally { await db.exec('rollback;'); }
      assert.deepEqual((await db.query("select to_jsonb(p) body from pg_proc p where p.oid='private.native_item_support_count_v1(uuid[])'::regprocedure")).rows[0].body,
        helper, 'Runtime instrumentation must restore the complete helper metadata/body');
    });
  } finally { await db.close(); }
});
