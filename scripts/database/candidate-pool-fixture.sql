-- Synthetic catalogue with enough positive taste to put 70 consumed cards above
-- every unseen card in the legacy scalar top-50, in either domain and all modes.
-- Caller owns the transaction and an otherwise empty application.
create temp table pool_profiles(profile_id uuid,profile_type text) on commit drop;
create temp table pool_items(item_id uuid,item_type text,kind text) on commit drop;
do $fixture$
declare
  actor uuid := 'a22a0000-0000-4000-8000-000000000001';
  partner uuid := 'a22a0000-0000-4000-8000-000000000002';
  outsider uuid := 'a22a0000-0000-4000-8000-000000000003';
  shared uuid := 'a22a0000-0000-4000-8000-000000000004';
  profile uuid; partner_profile uuid;
begin
  if exists(select 1 from auth.users) or exists(select 1 from public.items) then
    raise exception 'Candidate pool fixture requires empty synthetic state';
  end if;
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Pool '||right(id::text,6))
    from unnest(array[actor,partner,outsider]) fixture(id);
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Candidate pool');
  insert into public.profile_members(profile_id,user_id) values(shared,actor),(shared,partner);
  insert into pg_temp.pool_profiles select id,profile_type from public.profiles
    where id=shared or (owner_user_id=actor and profile_type='PERSONAL');
  select id into strict partner_profile from public.profiles where owner_user_id=partner and profile_type='PERSONAL';
  insert into pg_temp.pool_items
    select md5('kajo-pool-fixture:'||domain||':'||kind||':'||n)::uuid,domain,kind
    from (values ('BOOK'),('MOVIE')) domains(domain)
    cross join (values ('SEED',60),('CONSUMED',70),('ORDINARY',24),('REMINDER',2),('RECENT_SAVED',2)) kinds(kind,size)
    cross join lateral generate_series(1,size) n;
  insert into public.items(id,item_type,title,tags,discoverable)
    select item_id,item_type,kind||' '||item_id::text,
      case when kind in ('SEED','CONSUMED') then array['favored'] else array['unseen'] end,
      kind<>'SEED' from pg_temp.pool_items;
  for profile in select profile_id from pg_temp.pool_profiles loop
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
      select gen_random_uuid(),actor,profile,item_id,item_type,'ITEM_RATED',now()-interval '1 hour','{"rating":10}'::jsonb
      from pg_temp.pool_items where kind='SEED';
    insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,rating,saved)
      select profile,item_id,actor,kind='CONSUMED',case when kind='CONSUMED' then 10 else null end,
        kind in ('REMINDER','RECENT_SAVED') from pg_temp.pool_items where kind<>'SEED' and kind<>'ORDINARY';
    update public.item_list_entries e set added_at=now()-interval '45 days'
      from public.item_lists l,pg_temp.pool_items i where l.id=e.list_id and l.profile_id=profile
        and i.item_id=e.item_id and i.kind='REMINDER';
  end loop;
  -- One member's Personal consumption must not suppress the Shared context.
  insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,rating)
    select partner_profile,item_id,partner,true,8 from pg_temp.pool_items where kind='ORDINARY';
  perform set_config('request.jwt.claim.sub',actor::text,true);
end;
$fixture$;
