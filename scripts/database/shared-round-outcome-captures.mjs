import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export const sharedRoundOutcomeCapturesFixtureSql = async () => (await Promise.all([
  'shared-round-outcomes-fixture.sql', 'shared-round-outcome-captures-fixture.sql',
].map(name => readFile(new URL(name, import.meta.url), 'utf8')))).join('\n');

export async function sharedRoundOutcomeCapturesSmokeSql() {
  return `begin; ${await sharedRoundOutcomeCapturesFixtureSql()}\n${await readFile(new URL('shared-round-outcome-captures-smoke.sql', import.meta.url), 'utf8')}\nrollback;`;
}

export async function sharedRoundOutcomeCapturesUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_shared_round_outcome_captures.sql'), 'Expected the additive observed-vector capture forward');
  return `begin;
    ${await sharedRoundOutcomeCapturesFixtureSql()}
    alter default privileges for role postgres grant execute on functions to public;
    create temp table capture_upgrade_rows(identity text primary key,oid oid,owner oid,acl aclitem[],rls boolean,digest text) on commit drop;
    do $snapshot$ declare relation record; digest text; begin
      for relation in select format('%I.%I',n.nspname,c.relname) identity,c.oid,c.relowner,c.relacl,c.relrowsecurity
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
          and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users')) loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        insert into pg_temp.capture_upgrade_rows values(relation.identity,relation.oid,relation.relowner,relation.relacl,relation.relrowsecurity,digest);
      end loop;
    end; $snapshot$;
    create temp table capture_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      p.proowner,p.proacl,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f';
    create temp table capture_upgrade_triggers on commit drop as select t.oid,t.tgrelid,t.tgfoid,t.tgenabled,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private') and not t.tgisinternal;
    ${migration.sql}
    do $verify$ declare relation record; digest text; checkpoint record; f record; c record; captured jsonb;
    begin
      for relation in select * from pg_temp.capture_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        if digest is distinct from relation.digest then raise exception 'Capture forward changed populated %',relation.identity; end if;
        if not exists(select 1 from pg_class p where p.oid=relation.oid and p.relowner=relation.owner
          and p.relacl is not distinct from relation.acl and p.relrowsecurity=relation.rls) then
          raise exception 'Capture forward changed old table identity/owner/ACL/RLS: %',relation.identity; end if;
      end loop;
      if exists(select 1 from pg_temp.capture_upgrade_functions before left join pg_proc p on p.oid=before.oid
        where p.oid is null or p.proowner<>before.proowner or p.proacl is distinct from before.proacl
          or p.prosecdef<>before.prosecdef or p.proconfig is distinct from before.proconfig
          or before.definition<>pg_get_functiondef(p.oid)) then
        raise exception 'Capture forward changed old function identity, owner, ACL, config or body'; end if;
      if exists(select 1 from pg_temp.capture_upgrade_triggers before left join pg_trigger t on t.oid=before.oid
        where t.oid is null or t.tgrelid<>before.tgrelid or t.tgfoid<>before.tgfoid or t.tgenabled<>before.tgenabled
          or pg_get_triggerdef(t.oid)<>before.definition) then raise exception 'Capture forward changed an old trigger'; end if;
      if exists(select 1 from private.shared_round_outcome_captures) or exists(select 1 from private.shared_round_vector_comparisons) then
        raise exception 'Additive capture forward fabricated historical observations'; end if;
      for checkpoint in select * from pg_temp.outcome_receipts loop
        if pg_temp.outcome_commit((checkpoint.command->>'actorUserId')::uuid,checkpoint.command) is distinct from checkpoint.result then
          raise exception 'Capture forward changed an exact old command receipt'; end if;
      end loop;
      select * into strict f from pg_temp.outcome_fixture; select * into strict c from pg_temp.capture_fixture;
      captured := private.capture_shared_rating_round_outcome_v1(gen_random_uuid(),f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds');
      if captured->'outcome' is distinct from private.shared_rating_round_outcome_v1(f.pair,c.round_id,c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds')
        or captured->'historicalFeatureEligible' is distinct from 'false'::jsonb
        or captured->'groupReward' is distinct from 'null'::jsonb or captured->'learnable' is distinct from 'false'::jsonb then
        raise exception 'New capture did not freeze the exact existing supported vector'; end if;
    end; $verify$;
    select jsonb_build_object('sharedRoundOutcomeCapturesUpgrade',
      'PASS: every populated row and existing table/function/trigger identity, owner, ACL, config and body preserved; old round and serving/shadow receipts unchanged') snapshot;
    rollback;`;
}
