// Rehearse the exact collection forward over existing Item receipts and List data.
// New nullable receipt columns are excluded from old-column fingerprints only.
export function collectionActionUpgradeSql(migration, tables) {
  if (!migration.sql.includes('create function public.commit_collection_action_v1(request jsonb)')) {
    throw new Error('Expected the reviewed atomic collection migration');
  }
  const identities = [...new Set([...tables, 'private.item_action_receipts', 'private.item_action_heads', 'auth.users'])];
  for (const name of identities) {
    if (!/^(public|private|auth)\.[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid snapshot table');
  }
  const fingerprints = identities.map(name => {
    const row = name === 'private.item_action_receipts' ? "to_jsonb(r)-'list_id'-'before_list_entry'" : 'to_jsonb(r)';
    return `select '${name}' as identity, md5(coalesce((select jsonb_agg(${row} order by (${row})::text)
      from ${name} r),'[]'::jsonb)::text) as digest`;
  }).join('\nunion all\n');
  const functions = `select p.oid::regprocedure::text as identity, p.prosrc, p.prosecdef, p.proconfig, p.proacl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')`;
  return `begin;
    alter default privileges for role postgres grant execute on functions to public;
    create temp table kajo_collection_upgrade_fixture(command jsonb, receipt jsonb) on commit drop;
    do $fixture$ declare actor uuid := gen_random_uuid(); partner uuid := gen_random_uuid(); personal uuid;
      shared uuid := gen_random_uuid(); item uuid := gen_random_uuid(); list uuid; command jsonb;
    begin
      insert into auth.users(id,email,raw_user_meta_data)
        select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Upgrade '||left(id::text,16))
        from unnest(array[actor,partner]) fixture(id);
      select id into strict personal from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
      insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Collection upgrade');
      insert into public.profile_members(profile_id,user_id) values(shared,actor),(shared,partner);
      insert into public.items(id,item_type,title,discoverable) values(item,'BOOK','Collection upgrade fixture',true);
      perform set_config('request.jwt.claim.sub',actor::text,true);
      select list_id into strict list from private.create_custom_item_list(personal,'Existing List');
      perform private.set_item_list_entry(list,item,true);
      select list_id into strict list from private.create_custom_item_list(shared,'Pending List');
      perform private.endorse_shared_list_item(shared,item,list);
      command := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,'profileId',personal,
        'itemId',item,'occurredAt',now(),'kind','SET_RATING','rating',8,'predictionId',null,'discoveryMode','FOR_YOU',
        'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
      insert into pg_temp.kajo_collection_upgrade_fixture values(command,private.commit_item_action_v1(command));
    end; $fixture$;
    create temp table kajo_collection_upgrade_before on commit drop as ${fingerprints};
    create temp table kajo_collection_functions_before on commit drop as ${functions};
    ${migration.sql}
    do $verify$ declare fixture record; current_source text; expected_source text; result jsonb;
    begin
      if exists((${fingerprints}) except select * from pg_temp.kajo_collection_upgrade_before) then
        raise exception 'Collection forward changed existing application/Auth/receipt/head columns';
      end if;
      if exists(select 1 from private.item_action_receipts where list_id is not null or before_list_entry is not null) then
        raise exception 'Collection forward fabricated old receipt metadata';
      end if;
      if exists(select 1 from pg_temp.kajo_collection_functions_before old left join (${functions}) current using(identity)
        where current.identity is null or old.prosecdef is distinct from current.prosecdef
          or old.proconfig is distinct from current.proconfig or old.proacl is distinct from current.proacl
          or (old.identity<>'private.commit_item_action_v1(jsonb)' and old.prosrc is distinct from current.prosrc)) then
        raise exception 'Collection forward altered an unrelated function or old ACL';
      end if;
      select replace(prosrc, 'or reversed.command->>''kind''=''UNDO''',
        'or reversed.command->>''kind'' not in (''SET_RATING'',''SET_NOT_INTERESTED'')') into strict expected_source
        from pg_temp.kajo_collection_functions_before where identity='private.commit_item_action_v1(jsonb)';
      select prosrc into strict current_source from pg_proc where oid='private.commit_item_action_v1(jsonb)'::regprocedure;
      if current_source is distinct from expected_source then raise exception 'Unexpected Item command replacement'; end if;
      if has_function_privilege('anon','public.commit_collection_action_v1(jsonb)','execute')
        or has_function_privilege('service_role','private.commit_collection_action_v1(jsonb)','execute')
        or not has_function_privilege('authenticated','public.commit_collection_action_v1(jsonb)','execute')
        or has_table_privilege('authenticated','private.item_action_receipts','select') then
        raise exception 'Collection forward ACL regression';
      end if;
      select * into strict fixture from pg_temp.kajo_collection_upgrade_fixture;
      if private.commit_item_action_v1(fixture.command) is distinct from fixture.receipt then
        raise exception 'Old receipt replay changed after forward';
      end if;
      result := private.commit_item_action_v1(fixture.command || jsonb_build_object('actionId',gen_random_uuid(),
        'kind','UNDO','reversesActionId',fixture.command->>'actionId'));
      if result->'interaction'->>'rating' is not null then raise exception 'Old receipt undo failed after forward'; end if;
    end; $verify$;
    select jsonb_build_object('collectionActionUpgrade',
      'PASS: unchanged populated application/Auth/receipt/head columns; exact Item undo guard; old retry/undo and explicit grants') as snapshot;
    rollback;`;
}
