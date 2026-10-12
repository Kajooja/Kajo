// Apply the unchanged Shared multi-destination forward to a populated synthetic DB.
// The caller installs only preceding migrations; this rehearsal always rolls back.
export function sharedListDestinationsUpgradeSql(migration, fixture, tables) {
  if (!migration.name.endsWith('_shared_list_destinations.sql')
    || !migration.sql.includes('create table private.shared_list_proposal_destinations (')) {
    throw new Error('Expected the Shared List destinations forward');
  }
  const names = [...new Set([...tables, 'private.item_action_receipts', 'private.item_action_heads', 'auth.users'])];
  const fingerprints = names.map(name => {
    if (!/^(public|private|auth)\.[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid snapshot table');
    return `select '${name}' as identity, md5(coalesce((select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)
      from ${name} r),'[]'::jsonb)::text) as digest`;
  }).join('\nunion all\n');
  const functions = `select p.oid,p.oid::regprocedure::text as identity,p.proowner,p.proacl,p.prosecdef,p.proconfig,
    case when p.oid in ('private.commit_collection_action_v1(jsonb)'::regprocedure,
      'private.endorse_shared_item(uuid,uuid)'::regprocedure,
      'private.endorse_shared_list_item(uuid,uuid,uuid)'::regprocedure,'private.clean_pending_shared_list_approval_for_list()'::regprocedure)
      then null else pg_get_functiondef(p.oid) end as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'`;
  return `begin;
    ${fixture}
    -- Match the still-open hosted global defaults; explicit ACLs must suffice.
    alter default privileges for role postgres grant execute on functions to public;
    create temp table destinations_rows_before on commit drop as ${fingerprints};
    create temp table destinations_functions_before on commit drop as ${functions};
    ${migration.sql}
    do $verify$ begin
      if exists((${fingerprints}) except select * from pg_temp.destinations_rows_before) then
        raise exception 'Shared destinations forward changed existing application/Auth data';
      end if;
      if exists(select * from pg_temp.destinations_functions_before except (${functions})) then
        raise exception 'Shared destinations changed existing identities/ACLs or unrelated function definitions';
      end if;
      if (select count(*) from (${functions}) f)<>(select count(*)+6 from pg_temp.destinations_functions_before) then
        raise exception 'Unexpected number of new destination functions';
      end if;
      if has_function_privilege('authenticated','private.endorse_shared_item_core_v1(uuid,uuid)','execute')
        or has_function_privilege('anon','public.get_shared_discovery_overlay_v2(uuid,text)','execute')
        or has_function_privilege('authenticated','private.endorse_shared_list_item_core_v1(uuid,uuid,uuid)','execute')
        or has_function_privilege('service_role','private.endorse_shared_list_destinations_v1(uuid,uuid,uuid,jsonb)','execute') or has_table_privilege('authenticated','private.shared_list_proposal_destinations','select') then
        raise exception 'Open creator defaults leaked destination access';
      end if;
    end; $verify$;
    select jsonb_build_object('sharedListDestinationsUpgrade',
      'PASS: unchanged populated rows and old function identities/ACLs; only four intended old definitions and six new functions') as snapshot;
    rollback;`;
}
