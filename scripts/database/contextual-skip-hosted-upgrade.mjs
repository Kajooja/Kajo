// Exact reviewed source and disposable rehearsal only. No hosted apply client.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { personalTasteChallengeFixtureSql } from './personal-taste-challenge.mjs';

export const contextualSkipHostedManifest = JSON.parse(await readFile(new URL('contextual-skip-hosted-upgrade.json', import.meta.url), 'utf8'));
const quote = value => "'" + value.replaceAll("'", "''") + "'";
export async function loadContextualSkipHostedChain() {
  return Promise.all(contextualSkipHostedManifest.operations.map(async expected => {
    const sql = await readFile(new URL('../../supabase/migrations/' + expected.filename, import.meta.url), 'utf8');
    assert.equal(createHash('sha256').update(sql).digest('hex'), expected.sha256,
      `Reviewed contextual skip operation changed: ${expected.filename}`);
    return { name: expected.filename, sql };
  }));
}

export async function contextualSkipImportBodies() {
  const [{ sql }] = await loadContextualSkipHostedChain();
  return Object.fromEntries(['canonical', 'compact'].map(name => {
    const marker = `$${name}$`;
    const parts = sql.split(marker);
    assert.equal(parts.length, 3, `Missing exact ${name} body`);
    return [name, parts[1]];
  }));
}

// These are the only existing bodies changed by the accepted #349 forwards.
export const contextualSkipChangedFunctions = [
  'private.capture_personal_working_state_v1(uuid,uuid,uuid,timestamptz)',
  'private.withdraw_sequential_event_v2()',
  'private.resurfacing_policy_decision_v1(uuid,uuid,jsonb,timestamptz)',
  'private.erase_prediction_sources_v1(text,uuid)',
  'private.sequential_taste_snapshot_v2(uuid)',
  'private.remove_profile_import_job_v1(uuid)',
  'private.commit_item_action_v1(jsonb)',
  'private.commit_collection_action_v1(jsonb)',
  'private.taste_session_v1(jsonb)',
  'private.taste_session_v2(jsonb)',
];

export async function contextualSkipHostedUpgradeSql() {
  const chain = await loadContextualSkipHostedChain();
  const { compact } = await contextualSkipImportBodies();
  return `begin;
    do $disposable_only$ begin
      if exists(select 1 from auth.users) or exists(select 1 from public.profiles)
        or exists(select 1 from public.items) or exists(select 1 from public.events) then
        raise exception 'Contextual skip rehearsal requires empty disposable state; never hosted';end if;
      if to_regclass('private.contextual_skip_commands') is not null then
        raise exception 'Contextual skip rehearsal requires the pre-skip checkpoint';end if;
    end;$disposable_only$;
    do $compact_fixture$ declare f record;begin
      select pg_get_functiondef(oid) definition,prosrc into strict f from pg_proc
        where oid='private.remove_profile_import_job_v1(uuid)'::regprocedure;
      execute replace(f.definition,f.prosrc,${quote(compact)});
    end;$compact_fixture$;
    ${await personalTasteChallengeFixtureSql()}
    create temp table skip_upgrade_receipts(actor uuid,endpoint text,request jsonb,result jsonb) on commit drop;
    do $retained_receipts$ declare actor uuid;profile uuid;request jsonb;response jsonb;begin
      for actor in select id from public.users where id::text like 'ab157000-%' order by id loop
        perform set_config('request.jwt.claim.sub',actor::text,true);
        select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
        request:=jsonb_build_object('operation','START','profileId',profile,'requestId',gen_random_uuid());
        if actor='ab157000-0000-4000-8000-000000000001' then
          response:=public.taste_session_v1(request);
          insert into pg_temp.skip_upgrade_receipts values(actor,'V1',request,response);
          request:=jsonb_build_object('operation','START','profileId',profile,'sessionId',response->'sessionId','requestId',gen_random_uuid());
          response:=public.taste_challenge_v1(request);
          if response->>'status'<>'ACTIVE' then raise exception 'Missing retained frozen challenge';end if;
          insert into pg_temp.skip_upgrade_receipts values(actor,'CHALLENGE',request,response);
        else
          response:=public.taste_session_v2(request);
          -- START deliberately contains no question. NEXT requires a separate
          -- committed transaction; this rollback-only rehearsal never fakes it.
          if response->>'status'<>'NEEDS_NEXT' then raise exception 'Missing retained sequential start';end if;
          insert into pg_temp.skip_upgrade_receipts values(actor,'V2',request,response);
        end if;
      end loop;
    end;$retained_receipts$;
    create temp table skip_upgrade_rows(identity text,digest text) on commit drop;
    create temp table skip_upgrade_functions on commit drop as
      select p.oid,to_jsonb(p)-'prosrc' metadata,p.prosrc from pg_proc p
      where p.pronamespace in('public'::regnamespace,'private'::regnamespace) and p.prokind='f';
    create temp table skip_upgrade_history(digest text) on commit drop;
    do $snapshot$ declare r record;body text;begin
      for r in select format('%I.%I',n.nspname,c.relname) identity from pg_class c
        join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from %s x',r.identity) into body;
        insert into pg_temp.skip_upgrade_rows values(r.identity,body);
      end loop;
      if to_regclass('supabase_migrations.schema_migrations') is not null then
        execute 'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from supabase_migrations.schema_migrations x' into body;
        insert into pg_temp.skip_upgrade_history values(body);
      end if;
    end;$snapshot$;
    ${chain.map(file => file.sql).join('\n')}
    do $preserve$ declare r record;body text;actual record;response jsonb;begin
      for r in select * from pg_temp.skip_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from %s x',r.identity) into body;
        if body is distinct from r.digest then raise exception 'Contextual skip upgrade changed old rows: %',r.identity;end if;
      end loop;
      for r in select * from pg_temp.skip_upgrade_functions loop
        select to_jsonb(p)-'prosrc' metadata,p.prosrc into actual from pg_proc p where p.oid=r.oid;
        if not found or actual.metadata is distinct from r.metadata then
          raise exception 'Contextual skip upgrade changed old function identity/security: %',r.oid;end if;
        if actual.prosrc is distinct from r.prosrc and r.oid<>all(array[${contextualSkipChangedFunctions.map(s => quote(s) + '::regprocedure').join(',')}]::oid[]) then
          raise exception 'Contextual skip upgrade changed an unreviewed body: %',r.oid;end if;
      end loop;
      if exists(select 1 from pg_temp.skip_upgrade_history) then
        execute 'select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb)::text) from supabase_migrations.schema_migrations x' into body;
        if body is distinct from(select digest from pg_temp.skip_upgrade_history) then
          raise exception 'Contextual skip rehearsal changed migration history';end if;
      end if;
      for r in select * from pg_temp.skip_upgrade_receipts loop
        perform set_config('request.jwt.claim.sub',r.actor::text,true);
        response:=case r.endpoint when 'V1' then public.taste_session_v1(r.request)
          when 'V2' then public.taste_session_v2(r.request) else public.taste_challenge_v1(r.request) end;
        if response is distinct from r.result then raise exception 'Retained exact Taste receipt changed';end if;
      end loop;
      if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'
        and c.relname in('contextual_skip_commands','contextual_skip_event_permissions','prediction_contextual_skip_sources')
        and (not c.relrowsecurity or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
          or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
          or has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) then
        raise exception 'Contextual skip upgrade exposed private storage';end if;
      for r in select unnest(array['public.commit_discovery_contextual_skip_v1(jsonb)',
        'public.discovery_contextual_skip_source_v1(jsonb)','public.commit_taste_contextual_skip_v1(jsonb)']) signature loop
        if has_function_privilege('anon',r.signature,'EXECUTE') or has_function_privilege('service_role',r.signature,'EXECUTE')
          or not has_function_privilege('authenticated',r.signature,'EXECUTE') then
          raise exception 'Contextual skip upgrade exposed an RPC';end if;
      end loop;
    end;$preserve$;
    select jsonb_build_object('contextualSkipHostedUpgrade',
      'PASS: exact compact prerequisite and two unchanged forwards; old rows, v1/challenge/v2 receipts, function metadata and history preserved') snapshot;
    rollback;`;
}
