import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalSourceFusionPatches, personalSourceFusionFixtureSql, personalSourceFusionSmokeSql, personalSourceFusionUpgradeSql } from './personal-source-fusion.mjs';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const { files } = await buildFreshInstallation();
  const index = files.findIndex(file => file.name.endsWith('_personal_source_fusion.sql'));
  assert.ok(index > files.findIndex(file => file.name.endsWith('_native_item_support.sql')));
  for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
  return { db, files, index };
}
async function rows(db) {
  const tables = (await db.query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in('public','private','auth') order by 1`)).rows;
  return Promise.all(tables.map(async table => [table.name, (await db.query(`select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]') value from ${table.name} r`)).rows[0].value]));
}
async function functions(db) {
  return (await db.query(`select p.oid,p.oid::regprocedure::text signature,p.prosrc,to_jsonb(p)-'prosrc' properties
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f' order by p.oid`)).rows;
}
function verifyFunctions(before, after) {
  const current = new Map(after.map(row => [row.oid, row]));
  for (const old of before) {
    const actual = current.get(old.oid);
    assert.ok(actual, `old function removed: ${old.signature}`);
    assert.deepEqual(actual.properties, old.properties, `old function identity/owner/ACL/config changed: ${old.signature}`);
    const patch = personalSourceFusionPatches.find(p => p.signature === old.signature);
    let expected = old.prosrc;
    for (const replacement of patch?.replacements ?? []) {
      assert.equal(expected.split(replacement.before).length - 1, replacement.count, `approved fragment mismatch: ${old.signature}`);
      expected = expected.replaceAll(replacement.before, () => replacement.after);
    }
    assert.equal(actual.prosrc, expected, `unapproved old body change: ${old.signature}`);
  }
}

test('Personal source fusion/forgetting has exact owned current semantics and preserves frozen generations (full schema)', async t => {
  const { db, files, index } = await setup();
  try {
    await t.test('native CLI populated verifier preserves old generations and rejects row/body/grant drift', async () => {
      try {
        const result = (await db.exec(await personalSourceFusionUpgradeSql(files[index])))
          .flatMap(value => value.rows.map(row => row.snapshot));
        assert.match(result[0]?.personalSourceFusionUpgrade, /^PASS: old duplicate contribution/);
      } finally { await db.exec('rollback;'); }
      for (const corruption of [
        "update public.items set title=title||' unexpected mutation';",
        'grant execute on function private.personal_source_evidence_v1(uuid,timestamptz) to public;',
        `do $drift$ declare p record;begin
          select pg_get_functiondef(oid) definition,prosrc into p from pg_proc
            where oid='private.build_profile_memory_state_v1(uuid,timestamptz)'::regprocedure;
          execute replace(p.definition,p.prosrc,p.prosrc||E'\\n-- extra unapproved change');
        end;$drift$;`,
      ]) {
        try {
          await assert.rejects(db.exec(await personalSourceFusionUpgradeSql({ ...files[index], sql: files[index].sql + '\n' + corruption })),
            /changed|exposed/);
        } finally { await db.exec('rollback;'); }
      }
    });
    await t.test('predecessor same-Item native/bootstrap double contribution is reproduced before the forward', async () => {
      await db.exec('begin;');
      try {
        await db.exec(await personalSourceFusionFixtureSql());
        await db.exec(`update private.profile_bootstrap_evidence set active=true;
          do $old$ declare f record;r record;begin select * into f from pg_temp.item_support_fixture;
            select * into r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
            perform pg_temp.fusion_assert((r.explanation->>'bootstrapLongTerm')::double precision>0
              and(r.explanation->>'longTerm')::double precision>(r.explanation->>'bootstrapLongTerm')::double precision,
              'old same-Item rating/import contributes twice');end;$old$;`);
        const beforeRows = await rows(db), beforeFunctions = await functions(db);
        await db.exec(files[index].sql);
        assert.deepEqual(await rows(db), beforeRows, 'forward changed populated old source/frozen/table rows');
        verifyFunctions(beforeFunctions, await functions(db));
        assert.equal((await functions(db)).length - beforeFunctions.length, 3, 'only the three scoped helpers may be added');
        for (const helper of ['bootstrap_decay_v2(timestamptz,timestamptz)', 'personal_source_evidence_v1(uuid,timestamptz)', 'personal_source_fusion_metadata_v1(jsonb)']) {
          for (const role of ['anon', 'authenticated', 'service_role']) assert.equal((await db.query(`select has_function_privilege($1,$2,'EXECUTE') allowed`, [role, `private.${helper}`])).rows[0].allowed, false);
        }
        const pages = (await db.query('select * from pg_temp.item_support_pages')).rows;
        for (const page of pages) {
          await db.query("select set_config('request.jwt.claim.sub',$1,true)", [page.actor]);
          assert.deepEqual((await db.query('select public.rank_items_page_v1($1) body', [page.request])).rows[0].body, page.response,
            'old protocol2/3 exact receipt retries changed after new current scoring');
        }
        const [job] = (await db.query("select private.process_shadow_prediction_jobs_v1(250) body")).rows;
        assert.equal(job.body.failed, 0, 'old frozen shadow compatibility failed');
      } finally { await db.exec('rollback;'); }
    });
    await t.test('all six old body guards reject source drift before creating helpers', async () => {
      for (const patch of personalSourceFusionPatches) {
        await db.exec('begin;');
        try {
          const [old] = (await db.query('select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid=$1::regprocedure', [patch.signature])).rows;
          await db.exec(old.definition.replace(old.prosrc, () => old.prosrc + '\n-- unexpected source drift'));
          await assert.rejects(db.exec(files[index].sql), /unexpected source/);
        } finally { await db.exec('rollback;'); }
        assert.equal((await db.query("select to_regprocedure('private.personal_source_evidence_v1(uuid,timestamptz)') helper")).rows[0].helper, null);
      }
    });
    for (const file of files.slice(index)) await db.exec(`begin;${file.sql}commit;`);
    await t.test('actual command zero/neutral/correction/selective clear/backdated Undo/history barrier/future Undo/ambiguity/decay matrix', async () => {
      let result;
      try {
        result = (await db.exec(await personalSourceFusionSmokeSql())).flatMap(value => value.rows.map(row => row.snapshot));
      } finally { await db.exec('rollback;'); }
      assert.match(result[0]?.personalSourceFusion, /^PASS: current own rating\/prior fusion/);
      for (const relation of ['auth.users','public.events','public.items','private.prediction_runs','private.shadow_prediction_runs', 'private.profile_bootstrap_evidence']) {
        assert.equal((await db.query(`select count(*)::integer n from ${relation}`)).rows[0].n, 0, `${relation} escaped rollback`);
      }
    });
    await t.test('foreign actor/Item/Profile Undo, finite unavailable creation and future bootstrap cannot erase available own evidence', async () => {
      await db.exec('begin;');
      try {
        await db.exec(await personalSourceFusionFixtureSql());
        await db.exec(`do $boundaries$ declare f record;s jsonb;begin select * into f from pg_temp.item_support_fixture;
          insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties) values
            (gen_random_uuid(),f.foreign_actor,f.personal,f.evidence,'BOOK','ITEM_INTERACTION_UNDONE',now(),
              '{"reversedEventId":"a181d000-0000-4000-8000-000000000100"}'),
            (gen_random_uuid(),f.actor,f.personal,f.unmatched,'BOOK','ITEM_INTERACTION_UNDONE',now(),
              '{"reversedEventId":"a181d000-0000-4000-8000-000000000100"}'),
            (gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED','infinity','{"rating":0}');
          insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,created_at,properties) values
            (gen_random_uuid(),f.actor,f.personal,f.evidence,'BOOK','ITEM_RATED',now(),now()+interval '1 day','{"rating":0}');
          s:=private.build_profile_memory_state_v1(f.personal,now());
          perform pg_temp.fusion_assert(s->>'nativeEvidenceCount'='1' and s#>>'{sourceFusion,nativeRatingItems}'='1','foreign/missing/future inputs cannot remove own rating');
          update private.profile_bootstrap_evidence set active=true,source_occurred_at='infinity';
          perform pg_temp.fusion_assert(not exists(select 1 from private.personal_source_evidence_v1(f.personal,now()) e where e.is_bootstrap), 'nonfinite bootstrap unavailable');
          update private.profile_bootstrap_evidence set source_occurred_at=now()+interval '1 day';
          perform pg_temp.fusion_assert(not exists(select 1 from private.personal_source_evidence_v1(f.personal,now()) e where e.is_bootstrap), 'future source bootstrap unavailable');
          perform pg_temp.fusion_assert(not exists(select 1 from private.personal_source_evidence_v1(f.foreign_personal,now()) e), 'foreign Personal own empty state remains isolated');
        end;$boundaries$;`);
      } finally { await db.exec('rollback;'); }
    });
  } finally { await db.close(); }
});
