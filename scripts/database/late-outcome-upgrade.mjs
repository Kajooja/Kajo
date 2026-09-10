// Unchanged forward, populated data, no hosted mutations. Caller owns the schema
// before this migration. Both the fixture and rehearsal always roll back.
export function lateOutcomeUpgradeSql(migration, fixture, tables) {
  if (!migration.name.endsWith('_late_outcome_attribution.sql')) throw new Error('Expected late Outcome forward');
  const names = [...new Set([...tables, 'private.item_action_receipts', 'private.item_action_heads',
    'private.shared_list_proposal_destinations', 'auth.users'])];
  const fingerprints = names.map(name => {
    if (!/^(public|private|auth)\.[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid snapshot table');
    return `select '${name}' as identity,md5(coalesce((select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)
      from ${name} r),'[]'::jsonb)::text) as digest`;
  }).join('\nunion all\n');
  const functions = `select p.oid,p.oid::regprocedure::text as identity,p.proowner,p.proacl,p.prosecdef,p.proconfig,
    case when p.oid in ('private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure,
      'private.evaluate_shadow_genome_v1(uuid,uuid)'::regprocedure) then null else pg_get_functiondef(p.oid) end as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'`;
  return `begin;
    ${fixture}
    -- Include a real pre-upgrade immutable receipt, not just legacy Events.
    do $receipt$ declare actor uuid; profile uuid; item uuid;
    begin
      select p.owner_user_id,p.id into actor,profile from public.profiles p where p.profile_type='PERSONAL' limit 1;
      select id into item from public.items limit 1;
      perform set_config('request.jwt.claim.sub',actor::text,true);
      perform public.commit_item_action_v1(jsonb_build_object('version',1,'actionId',gen_random_uuid(),
        'actorUserId',actor,'profileId',profile,'itemId',item,'kind','SET_RATING','rating',8,
        'occurredAt',now(),'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb)));
    end; $receipt$;
    alter default privileges for role postgres grant execute on functions to public;
    create temp table late_rows_before on commit drop as ${fingerprints};
    create temp table late_functions_before on commit drop as ${functions};
    ${migration.sql}
    do $verify$ begin
      if exists((${fingerprints}) except select * from pg_temp.late_rows_before) then
        raise exception 'Late Outcome forward changed existing application/Auth/receipt data';
      end if;
      if exists(select * from pg_temp.late_functions_before except (${functions})) then
        raise exception 'Late Outcome forward changed identities/ACLs or unrelated definitions';
      end if;
      if (select count(*) from (${functions}) f)<>(select count(*)+1 from pg_temp.late_functions_before) then
        raise exception 'Unexpected new attribution functions';
      end if;
      if has_function_privilege('authenticated','private.prediction_outcome_events_v1(uuid,timestamptz,timestamptz)','execute')
        or has_function_privilege('anon','private.prediction_outcome_events_v1(uuid,timestamptz,timestamptz)','execute')
        or has_function_privilege('service_role','private.prediction_outcome_events_v1(uuid,timestamptz,timestamptz)','execute') then
        raise exception 'Open creator defaults leaked private attribution access';
      end if;
    end; $verify$;
    select jsonb_build_object('lateOutcomeUpgrade',
      'PASS: unchanged populated data and receipts; all old identities/ACLs and unrelated definitions; one private reader') as snapshot;
    rollback;`;
}
