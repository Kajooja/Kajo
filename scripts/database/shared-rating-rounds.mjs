import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function sharedRatingRoundsSmokeSql() {
  const smoke = await readFile(new URL('shared-rating-rounds-smoke.sql', import.meta.url), 'utf8');
  return `begin; ${smoke}\nrollback;`;
}

// Populated rehearsal includes imported/native state, legacy one-actor Shared
// consumption, immutable action receipts and an identified prediction source.
// The additive foundation must not revise any of them or retrofit participants.
export async function sharedRatingRoundsUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_shared_rating_round_evidence.sql'), 'Expected the Shared round evidence forward');
  const fixture = await readFile(new URL('existing-application-fixture.sql', import.meta.url), 'utf8');
  return `begin;
    ${fixture}
    create temp table round_upgrade_receipts(request jsonb,response jsonb,kind text) on commit drop;
    do $legacy$ declare actor uuid := 'a2080000-0000-4000-8000-000000000001';
      shared uuid := 'a2080000-0000-4000-8000-000000000004';
      item uuid := 'a2080000-0000-4000-8000-000000000006';
      request jsonb; response jsonb; started timestamptz := clock_timestamp();
    begin
      request := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,
        'profileId',shared,'itemId',item,'kind','SET_RATING','rating',0,'occurredAt',started,
        'predictionId',null,'discoveryMode','FOR_YOU','session',jsonb_build_object(
          'sessionId',gen_random_uuid(),'startedAt',started,'context','{}'::jsonb));
      perform set_config('role','authenticated',true);
      response := public.commit_item_action_v1(request);
      perform set_config('role','postgres',true);
      insert into pg_temp.round_upgrade_receipts values(request,response,'ACTION');
      if response#>'{interaction,rating}'<>'0'::jsonb or response#>'{interaction,consumed}'<>'true'::jsonb then
        raise exception 'Legacy Shared single-actor fixture was not populated'; end if;
      request := jsonb_build_object('version',3,'requestId',gen_random_uuid(),'profileId',shared,
        'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',10,'context','{}'::jsonb);
      perform set_config('role','authenticated',true);
      response := public.rank_items_page_v1(request);
      perform set_config('role','postgres',true);
      insert into pg_temp.round_upgrade_receipts values(request,response,'PAGE');
    end; $legacy$;
    -- Host-like open creator defaults make explicit new ACLs part of the proof.
    alter default privileges for role postgres grant execute on functions to public;
    create temp table round_upgrade_rows(identity text primary key,oid oid,owner oid,acl aclitem[],rls boolean,digest text) on commit drop;
    do $snapshot$ declare relation record; digest text;
    begin
      for relation in select format('%I.%I',n.nspname,c.relname) identity,c.oid,c.relowner,c.relacl,c.relrowsecurity
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
          and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users')) loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        insert into pg_temp.round_upgrade_rows values(relation.identity,relation.oid,relation.relowner,relation.relacl,relation.relrowsecurity,digest);
      end loop;
    end; $snapshot$;
    create temp table round_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      p.proowner,p.proacl,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f';
    create temp table round_upgrade_triggers on commit drop as select t.oid,t.tgrelid,t.tgfoid,t.tgenabled,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private') and not t.tgisinternal;
    ${migration.sql}
    do $verify$ declare relation record; digest text; checkpoint record; count_rows bigint;
    begin
      for relation in select * from pg_temp.round_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        if digest is distinct from relation.digest then raise exception 'Shared round foundation changed populated %',relation.identity; end if;
        if not exists(select 1 from pg_class c where c.oid=relation.oid and c.relowner=relation.owner
          and c.relacl is not distinct from relation.acl and c.relrowsecurity=relation.rls) then
          raise exception 'Shared round foundation changed existing table identity/owner/ACL/RLS: %',relation.identity; end if;
      end loop;
      if exists(select 1 from pg_temp.round_upgrade_functions before left join pg_proc p on p.oid=before.oid
        where p.oid is null or p.proowner<>before.proowner or p.proacl is distinct from before.proacl
          or p.prosecdef<>before.prosecdef or p.proconfig is distinct from before.proconfig
          or before.definition<>pg_get_functiondef(p.oid)) then
        raise exception 'Shared round foundation changed existing function OIDs, owners, ACLs or bodies'; end if;
      if exists(select 1 from pg_temp.round_upgrade_triggers before left join pg_trigger t on t.oid=before.oid
        where t.oid is null or t.tgrelid<>before.tgrelid or t.tgfoid<>before.tgfoid or t.tgenabled<>before.tgenabled
          or pg_get_triggerdef(t.oid)<>before.definition) then
        raise exception 'Shared round foundation changed an existing trigger'; end if;
      for relation in select format('%I.%I',n.nspname,c.relname) identity from pg_class c
        join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'
          and not exists(select 1 from pg_temp.round_upgrade_rows before where before.oid=c.oid) loop
        execute format('select count(*) from %s',relation.identity) into count_rows;
        if relation.identity<>'private.shared_round_membership_generations' and count_rows<>0 then
          raise exception 'Shared round upgrade fabricated history in %',relation.identity; end if;
      end loop;
      if exists(select 1 from public.profile_members m left join private.shared_round_membership_generations g
          on g.profile_id=m.profile_id and g.user_id=m.user_id where g.generation_id is null)
        or exists(select 1 from private.shared_round_membership_generations g left join public.profile_members m
          on g.profile_id=m.profile_id and g.user_id=m.user_id where m.profile_id is null)
        or (select count(*) from private.shared_round_membership_generations)<>(select count(*) from public.profile_members) then
        raise exception 'Membership generation backfill was not exactly one token per existing membership'; end if;
      for checkpoint in select * from pg_temp.round_upgrade_receipts loop
        perform set_config('role','authenticated',true);
        if checkpoint.kind='ACTION' then
          if public.commit_item_action_v1(checkpoint.request)<>checkpoint.response then raise exception 'Upgrade changed immutable legacy action receipt'; end if;
        elsif public.rank_items_page_v1(checkpoint.request)<>checkpoint.response then raise exception 'Upgrade changed immutable prediction receipt'; end if;
        perform set_config('role','postgres',true);
      end loop;
    end; $verify$;
    select jsonb_build_object('sharedRatingRoundsUpgrade',
      'PASS: every populated old row/table/function identity, owner, ACL and body preserved; exact legacy/action/page retries; no fabricated rounds or responses') snapshot;
    rollback;`;
}
