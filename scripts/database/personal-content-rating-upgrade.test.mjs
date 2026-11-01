import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyPersonalContentRatingUpgrade } from './personal-content-rating-upgrade.mjs';

const snapshotSql = `create or replace function pg_temp.content_predecessor_snapshot()
returns jsonb language plpgsql as $$declare r record;rows jsonb;tables jsonb:='{}';begin
  for r in select c.oid,format('%I.%I',n.nspname,c.relname) identity,
    to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] properties
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in('public','private','auth') order by 2 loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from %s r',r.identity) into rows;
    tables:=tables||jsonb_build_object(r.identity,jsonb_build_object('metadata',r.properties,'rows',rows));
  end loop;
  return jsonb_build_object('tables',tables,'functions',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f'),
    'defaults',(select jsonb_agg(to_jsonb(d) order by d.oid) from pg_default_acl d),
    'schemas',(select jsonb_agg(to_jsonb(n) order by n.oid) from pg_namespace n where nspname in('public','private','auth')),
    'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p join pg_class c on c.oid=p.polrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth')),
    'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth')));
end;$$;`;

test('content forward preserves actual populated V1 captures and first answers and rejects schema/ACL/body drift',
  { timeout: 240_000 }, async t => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      const { files } = await buildFreshInstallation();
      const index = files.findIndex(file => file.name.endsWith('_personal_content_rating.sql'));
      assert.ok(index > 0, 'Content forward must be a separate installation migration');
      for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
      const exec = async sql => {
        try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
        catch (error) { await db.exec('rollback;');throw error; }
      };
      const withSqlSession = callback => callback(exec);
      await db.exec(snapshotSql);
      const snapshot = async () => (await db.query('select pg_temp.content_predecessor_snapshot() value')).rows[0].value;
      const before = await snapshot();
      const report = await verifyPersonalContentRatingUpgrade(exec, withSqlSession, files[index]);
      assert.equal(report.status, 'PASS');assert.equal(report.newPrivateTables, 3);
      assert.equal(report.newPrivateFunctions, 10);assert.equal(report.retainedV1Captures, 3);
      assert.equal(report.retainedV1FirstAnswers, 1);assert.equal(report.v1CaptureAndFirstAnswerRetries, 'EXACT');
      assert.equal(report.qualityAdmission, 'NONE');assert.equal(report.servingActivation, 'NONE');
      assert.deepEqual(await snapshot(), before, 'Successful content upgrade must restore predecessor rows and metadata');
      t.diagnostic(JSON.stringify(report));
      for (const [label, mutation] of [
        ['old populated Item bytes', "update public.items set title=title||' unreviewed content change';"],
        ['old V1 function configuration', 'alter function private.finalize_personal_rating_forecast_v1(uuid,jsonb) set statement_timeout=10;'],
        ['new content table exposed permission', 'grant select on private.personal_rating_content_source_refs to authenticated;'],
        ['new V2 helper exposed execution', 'grant execute on function private.finalize_personal_rating_forecast_v2(uuid,jsonb) to service_role;'],
        ['new V2 helper unexpected definer', 'alter function private.finalize_personal_rating_forecast_v2(uuid,jsonb) security definer;'],
        ['new review table missing RLS', 'alter table private.personal_rating_content_review_revocations disable row level security;'],
        ['new alias reference unexpected column', 'alter table private.personal_rating_content_alias_refs add column unreviewed text;'],
        ['old catalogue policy addition', 'create policy unreviewed_content on private.item_sources for select using(true);'],
      ]) await t.test('rejects ' + label, async () => {
        await assert.rejects(verifyPersonalContentRatingUpgrade(exec, withSqlSession,
          { ...files[index], sql: files[index].sql + '\n' + mutation }), /changed|permission|EXECUTE|RLS/i);
        assert.deepEqual(await snapshot(), before, 'Rejected content upgrade must restore predecessor rows and metadata');
      });
    } finally { await db.close(); }
  });
