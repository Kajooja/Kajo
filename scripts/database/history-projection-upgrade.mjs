// Apply the unchanged read-only projection forward to a populated synthetic DB.
// The caller installs only preceding migrations; this rehearsal always rolls back.
export function historyProjectionUpgradeSql(migration, fixture, tables) {
  if (!migration.name.endsWith('_bootstrap_history_projection.sql')
    || !migration.sql.includes('create function private.profile_item_state_projection_v1(')) {
    throw new Error('Expected the bootstrap history projection forward');
  }
  const names = [...new Set([...tables, 'private.item_action_receipts', 'private.item_action_heads', 'auth.users'])];
  const fingerprints = names.map(name => {
    if (!/^(public|private|auth)\.[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid snapshot table');
    return `select '${name}' as identity, md5(coalesce((select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)
      from ${name} r),'[]'::jsonb)::text) as digest`;
  }).join('\nunion all\n');
  const functions = `select p.oid,p.oid::regprocedure::text as identity,p.proowner,p.proacl,p.prosecdef,p.proconfig,
    case when p.oid in ('private.get_profile_consumed_items(uuid,text)'::regprocedure,
      'private.get_item_list_entries(uuid)'::regprocedure,'private.get_shared_discovery_overlay(uuid,text)'::regprocedure)
      then null else pg_get_functiondef(p.oid) end as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'`;
  return `begin;
    ${fixture}
    -- Match the still-open hosted global defaults; explicit ACLs must suffice.
    alter default privileges for role postgres grant execute on functions to public;
    create temp table projection_rows_before on commit drop as ${fingerprints};
    create temp table projection_functions_before on commit drop as ${functions};
    ${migration.sql}
    do $verify$ begin
      if exists((${fingerprints}) except select * from pg_temp.projection_rows_before) then
        raise exception 'History projection forward changed existing application/Auth data';
      end if;
      if exists(select * from pg_temp.projection_functions_before except (${functions})) then
        raise exception 'History projection changed existing identities/ACLs or unrelated function definitions';
      end if;
      if (select count(*) from (${functions}) f)<>(select count(*)+3 from pg_temp.projection_functions_before) then
        raise exception 'Unexpected number of new projection functions';
      end if;
      if has_function_privilege('anon','public.get_profile_item_states_v1(uuid)','execute')
        or has_function_privilege('authenticated','private.profile_item_state_projection_v1(uuid)','execute')
        or has_function_privilege('service_role','private.get_profile_item_states_v1(uuid)','execute') then
        raise exception 'Open creator defaults leaked projection access';
      end if;
    end; $verify$;
    select jsonb_build_object('historyProjectionUpgrade',
      'PASS: unchanged populated rows and old function identities/ACLs; only three intended old definitions and three new functions') as snapshot;
    rollback;`;
}
