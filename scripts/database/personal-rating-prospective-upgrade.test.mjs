import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { verifyPersonalRatingProspectiveUpgrade } from './personal-rating-prospective-upgrade.mjs';

const snapshotSql = `create or replace function pg_temp.numeric_upgrade_snapshot()
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
    'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth')));
end;$$;`;

test('numeric prospective populated upgrade preserves previous receipts and rejects row, function metadata and ACL drift',
  { timeout: 240_000 }, async t => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      const { files } = await buildFreshInstallation();
      const index = files.findIndex(file => file.name.endsWith('_personal_rating_prospective.sql'));
      assert.ok(index > 0);
      for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
      const exec = async sql => {
        try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
        catch (error) { await db.exec('rollback;');throw error; }
      };
      await db.exec(snapshotSql);
      const snapshot = async () => (await db.query('select pg_temp.numeric_upgrade_snapshot() value')).rows[0].value;
      const before = await snapshot();
      const report = await verifyPersonalRatingProspectiveUpgrade(exec, files[index]);
      assert.equal(report.status, 'PASS');assert.equal(report.newPrivateTables, 5);assert.equal(report.retainedPageRetries, 3);
      assert.deepEqual(await snapshot(), before, 'Successful numeric upgrade verifier must restore predecessor rows and definitions');
      t.diagnostic(JSON.stringify(report));
      for (const [label, mutation] of [
        ['old populated Item bytes', "update public.items set title=title||' unreviewed numeric change';"],
        ['old eraser configuration', 'alter function private.erase_prediction_sources_v1(text,uuid) set statement_timeout=10;'],
        ['new table exposed permission', 'grant select on private.personal_rating_inputs to authenticated;'],
        ['new helper exposed execution', 'grant execute on function private.inspect_personal_rating_forecast_v1(uuid) to authenticated;'],
      ]) await t.test('rejects ' + label, async () => {
        await assert.rejects(verifyPersonalRatingProspectiveUpgrade(exec, { ...files[index], sql: files[index].sql + '\n' + mutation }),
          /changed|permission|EXECUTE/i);
        assert.deepEqual(await snapshot(), before, 'Rejected numeric upgrade verifier did not restore complete predecessor');
      });
    } finally { await db.close(); }
  });
