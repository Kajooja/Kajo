import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function sharedRoundOutcomesSmokeSql() {
  const [fixture, smoke] = await Promise.all([
    readFile(new URL('shared-round-outcomes-fixture.sql', import.meta.url), 'utf8'),
    readFile(new URL('shared-round-outcomes-smoke.sql', import.meta.url), 'utf8'),
  ]);
  return `begin; ${fixture}\n${smoke}\nrollback;`;
}

export async function sharedRoundOutcomesUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_shared_round_outcomes.sql'), 'Expected the additive joint outcome reader');
  const fixture = await readFile(new URL('shared-round-outcomes-fixture.sql', import.meta.url), 'utf8');
  return `begin;
    ${fixture}
    alter default privileges for role postgres grant execute on functions to public;
    create temp table outcome_upgrade_rows(identity text primary key,oid oid,owner oid,acl aclitem[],rls boolean,digest text) on commit drop;
    do $snapshot$ declare relation record; digest text;
    begin
      for relation in select format('%I.%I',n.nspname,c.relname) identity,c.oid,c.relowner,c.relacl,c.relrowsecurity
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
          and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users')) loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        insert into pg_temp.outcome_upgrade_rows values(relation.identity,relation.oid,relation.relowner,relation.relacl,relation.relrowsecurity,digest);
      end loop;
    end; $snapshot$;
    create temp table outcome_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      p.proowner,p.proacl,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f';
    create temp table outcome_upgrade_triggers on commit drop as select t.oid,t.tgrelid,t.tgfoid,t.tgenabled,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private') and not t.tgisinternal;
    ${migration.sql}
    do $verify$ declare relation record; digest text; checkpoint record; derived jsonb;
    begin
      for relation in select * from pg_temp.outcome_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        if digest is distinct from relation.digest then raise exception 'Outcome reader changed populated %',relation.identity; end if;
        if not exists(select 1 from pg_class c where c.oid=relation.oid and c.relowner=relation.owner
          and c.relacl is not distinct from relation.acl and c.relrowsecurity=relation.rls) then
          raise exception 'Outcome reader changed old table identity/owner/ACL/RLS: %',relation.identity; end if;
      end loop;
      if exists(select 1 from pg_temp.outcome_upgrade_functions before left join pg_proc p on p.oid=before.oid
        where p.oid is null or p.proowner<>before.proowner or p.proacl is distinct from before.proacl
          or p.prosecdef<>before.prosecdef or p.proconfig is distinct from before.proconfig
          or before.definition<>pg_get_functiondef(p.oid)) then
        raise exception 'Outcome reader changed old function identity, owner, ACL, config or body'; end if;
      if exists(select 1 from pg_temp.outcome_upgrade_triggers before left join pg_trigger t on t.oid=before.oid
        where t.oid is null or t.tgrelid<>before.tgrelid or t.tgfoid<>before.tgfoid or t.tgenabled<>before.tgenabled
          or pg_get_triggerdef(t.oid)<>before.definition) then raise exception 'Outcome reader changed an old trigger'; end if;
      for checkpoint in select * from pg_temp.outcome_receipts loop
        if pg_temp.outcome_commit((checkpoint.command->>'actorUserId')::uuid,checkpoint.command)<>checkpoint.result then
          raise exception 'Outcome forward changed exact old round receipt'; end if;
      end loop;
      select * into strict checkpoint from pg_temp.outcome_receipts where revision=3;
      derived := private.shared_rating_round_outcome_v1((checkpoint.command->>'profileId')::uuid,
        (checkpoint.command->>'roundId')::uuid,checkpoint.accepted_at,checkpoint.accepted_at,interval '0 seconds');
      if derived->'round'<>checkpoint.result->'round' or derived->>'vectorStatus'<>'READY_FOR_VECTOR_REVIEW'
        or derived->'historicalFeatureEligible'<>'false'::jsonb or derived->'groupReward'<>'null'::jsonb
        or derived->'learnable'<>'false'::jsonb then
        raise exception 'New reader did not retain old frozen completion without admitting a reward'; end if;
    end; $verify$;
    select jsonb_build_object('sharedRoundOutcomesUpgrade',
      'PASS: every existing row, table/function/trigger identity, owner, ACL and body preserved; old round receipts immutable; additive cutoff replay') snapshot;
    rollback;`;
}
