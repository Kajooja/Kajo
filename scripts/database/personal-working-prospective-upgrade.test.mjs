import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalWorkingProspectiveUpgradeSql } from './personal-working-prospective.mjs';

// Full original rows and installed definitions/default privileges must return
// after each disposable positive or rejected populated upgrade transaction.
const snapshotSql = `
  create or replace function pg_temp.prospective_upgrade_test_snapshot()
  returns jsonb language plpgsql as $$
  declare r record;rows jsonb;tables jsonb:='{}';result jsonb;
  begin
    for r in select c.oid,format('%I.%I',n.nspname,c.relname) identity,
      to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] properties
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and n.nspname in('public','private','auth') order by 2 loop
      execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from %s r',r.identity) into rows;
      tables:=tables||jsonb_build_object(r.identity,jsonb_build_object('metadata',r.properties,'rows',rows));
    end loop;
    select jsonb_build_object('tables',tables,'functions',
      (select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in('public','private','auth') and p.prokind='f'),
      'defaults',(select jsonb_agg(to_jsonb(d) order by d.oid) from pg_default_acl d),
      'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
        join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth')))
      into result;
    return result;
  end;$$;`;

test('prospective populated upgrade preserves actual v3 sources and rejects row, precision, eraser metadata and ACL mutations',
  { timeout: 180_000 }, async t => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;
        create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      const { files } = await buildFreshInstallation();
      const index = files.findIndex(file => file.name.endsWith('_personal_working_prospective.sql'));
      assert.ok(index > 0);
      assert.equal(files[index - 1].name.endsWith('_personal_working_candidate_features.sql'), true);
      for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
      await db.exec(snapshotSql);
      const snapshot = async () => (await db.query('select pg_temp.prospective_upgrade_test_snapshot() value')).rows[0].value;
      const original = await snapshot();
      const results = (await db.exec(await personalWorkingProspectiveUpgradeSql(files[index])))
        .flatMap(row => row.rows.map(item => item.snapshot));
      assert.match(results.find(row => row?.personalWorkingProspectiveUpgrade)?.personalWorkingProspectiveUpgrade,
        /^PASS: actual active v3/);
      assert.deepEqual(await snapshot(), original, 'Successful populated verifier leaked rows, definitions or defaults after rollback');

      for (const [label, mutation] of [
        ['populated Item row bytes', "update public.items set title=title||' unreviewed prospective mutation';"],
        ['comparison writer precision', 'alter function private.record_personal_working_shadow_v1(uuid,text) reset extra_float_digits;'],
        ['old eraser configuration', 'alter function private.erase_prediction_sources_v1(text,uuid) set statement_timeout=10;'],
        ['new allocation table exposed ACL', 'grant select on private.personal_working_outcome_allocations to authenticated;'],
      ]) await t.test(`populated prospective verifier rejects ${label}`, async () => {
        try {
          await assert.rejects(db.exec(await personalWorkingProspectiveUpgradeSql({ ...files[index],
            sql: files[index].sql + '\n' + mutation })), /changed|permission|EXECUTE/i);
        } finally { await db.exec('rollback;'); }
        assert.deepEqual(await snapshot(), original, 'Rejected verifier did not restore the entire original installed state');
      });
    } finally { await db.close(); }
  });
