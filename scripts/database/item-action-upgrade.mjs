// Rehearse the exact new forward file against a populated, isolated old schema.
// The outer rollback restores every test account, row, grant and new object.
export function itemActionUpgradeSql(migration, tables) {
  if (!migration.sql.includes('create function public.commit_item_action_v1(request jsonb)')) {
    throw new Error('Expected the reviewed atomic Item action migration');
  }
  const identities = [...tables, 'auth.users'];
  for (const name of identities) {
    if (!/^(public|private|auth)\.[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid snapshot table');
  }
  const fingerprints = identities.map(name => `select '${name}' as identity,
    md5(coalesce((select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from ${name} r),'[]'::jsonb)::text) as digest`).join('\nunion all\n');
  return `begin;
    -- Existing hosted global PUBLIC defaults are deliberately not repaired.
    alter default privileges for role postgres grant execute on functions to public;
    do $fixture$ declare actor uuid := gen_random_uuid(); profile uuid; item uuid := gen_random_uuid();
    begin
      insert into auth.users(id,email,raw_user_meta_data) values(actor,actor::text||'@example.invalid',
        jsonb_build_object('kajo_nickname','Upgrade '||left(actor::text,16)));
      select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
      insert into public.items(id,item_type,title,discoverable) values(item,'BOOK','Atomic upgrade fixture',true);
      insert into public.item_interactions(profile_id,item_id,actor_user_id,saved,consumed,rating)
        values(profile,item,actor,true,true,8);
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
        values(gen_random_uuid(),actor,profile,item,'BOOK','ITEM_RATED',now(),'{"rating":8}');
    end; $fixture$;
    create temp table kajo_item_action_upgrade_before on commit drop as ${fingerprints};
    ${migration.sql}
    do $verify$ begin
      if exists((${fingerprints}) except select * from pg_temp.kajo_item_action_upgrade_before) then
        raise exception 'Atomic action forward migration changed existing application/Auth rows';
      end if;
      if exists(select 1 from private.item_action_receipts) or exists(select 1 from private.item_action_heads)
        or has_function_privilege('anon','public.commit_item_action_v1(jsonb)','execute')
        or has_table_privilege('authenticated','private.item_action_receipts','select') then
        raise exception 'Forward migration leaked access or seeded action data';
      end if;
    end; $verify$;
    select jsonb_build_object('itemActionUpgrade','PASS: unchanged populated application/Auth rows; explicit grants survive hosted-style global defaults') as snapshot;
    rollback;`;
}
