-- Rollback-only acceptance of the actual legacy/v2 overlay read boundaries.
begin;
create temporary table overlay_eligibility_fixture (
  actor uuid, partner uuid, outsider uuid, shared uuid, other_shared uuid,
  personal uuid, items uuid[], destination uuid
) on commit drop;
do $fixture$
declare
  actor uuid := gen_random_uuid(); partner uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  shared uuid := gen_random_uuid(); other_shared uuid := gen_random_uuid(); personal uuid;
  items uuid[]; destination uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Overlay '||left(id::text,10))
    from unnest(array[actor,partner,outsider]) fixture(id);
  select id into strict personal from public.profiles where owner_user_id=partner and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name)
    values(shared,'SHARED','Overlay eligibility'),(other_shared,'SHARED','Other overlay');
  insert into public.profile_members(profile_id,user_id)
    values(shared,actor),(shared,partner),(other_shared,actor),(other_shared,partner);
  select array_agg(gen_random_uuid()) into items from generate_series(1,6);
  insert into public.items(id,item_type,title,tags,discoverable)
    select id,'BOOK','Overlay fixture '||n,array['overlay-fixture'],n not in (2,4)
    from unnest(items) with ordinality fixture(id,n);
  insert into public.item_interactions(profile_id,item_id,actor_user_id,rating,consumed)
    select personal,id,partner,case when n=2 then 0 else 8 end,true
    from unnest(items[1:3]) with ordinality fixture(id,n);
  insert into public.item_interactions(profile_id,item_id,actor_user_id,not_interested)
    values(shared,items[3],actor,true),(shared,items[5],actor,true);
  insert into public.item_lists(id,profile_id,list_kind,name,created_by_user_id)
    values(destination,shared,'CUSTOM','Overlay destination',partner);
  insert into public.shared_item_list_proposals(profile_id,item_id,list_id,proposed_by_user_id)
    select shared,id,destination,partner from unnest(items[4:6]) fixture(id);
  insert into public.shared_item_endorsements(profile_id,item_id,actor_user_id)
    select shared,id,partner from unnest(items[4:6]) fixture(id);
  insert into overlay_eligibility_fixture values(actor,partner,outsider,shared,other_shared,personal,items,destination);
end;
$fixture$;

-- Forward-under-test applies here in the populated-upgrade regression.

do $verify$
declare
  fixture record; item uuid; row record; rows jsonb; member uuid;
begin
  select * into strict fixture from overlay_eligibility_fixture;
  perform set_config('request.jwt.claim.sub',fixture.actor::text,true);
  perform set_config('role','authenticated',true);
  rows := public.get_shared_discovery_overlay_v2(fixture.shared,'BOOK');
  foreach item in array fixture.items loop
    select * into strict row from public.get_shared_discovery_overlay(fixture.shared,'BOOK') where item_id=item;
    if row.ineligible_for_discovery is distinct from (item=any(fixture.items[2:5])) then
      -- Items 2/4 are withdrawn; 3/5 are rejected in this SharedProfile.
      raise exception 'Shared overlay failed to retain catalogue/Shared discovery exclusions';
    end if;
    if not exists(select 1 from jsonb_array_elements(rows) value
      where value->>'item_id'=item::text
        and (value->>'ineligible_for_discovery')::boolean=row.ineligible_for_discovery) then
      raise exception 'V2 overlay disagrees with the canonical eligibility flag';
    end if;
  end loop;
  select * into strict row from public.get_shared_discovery_overlay(fixture.shared,'BOOK') where item_id=fixture.items[2];
  if row.member_consumed_user_ids is distinct from array[fixture.partner] or row.member_max_rating is distinct from 0 then
    raise exception 'Withdrawn Item lost truthful zero-rating member history';
  end if;
  select * into strict row from public.get_shared_discovery_overlay(fixture.shared,'BOOK') where item_id=fixture.items[4];
  if not row.pending_endorsement or row.proposed_list_id is distinct from fixture.destination then
    raise exception 'Withdrawn Item lost pending destination metadata';
  end if;
  select * into strict row from public.get_shared_discovery_overlay(fixture.other_shared,'BOOK') where item_id=fixture.items[3];
  if row.ineligible_for_discovery or row.member_consumed_user_ids is distinct from array[fixture.partner] then
    raise exception 'Shared rejection leaked into another Profile';
  end if;
  if exists(select 1 from public.get_shared_discovery_overlay(fixture.shared,'MOVIE') where item_id=any(fixture.items)) then
    raise exception 'Overlay ItemType filter changed';
  end if;
  perform set_config('role','postgres',true);
  if exists(select 1 from public.events where profile_id in (fixture.shared,fixture.other_shared,fixture.personal)) then
    raise exception 'Overlay read synthesized native evidence';
  end if;
  delete from public.profile_members where profile_id=fixture.shared and user_id=fixture.partner;
  foreach member in array array[fixture.outsider,fixture.partner] loop
    perform set_config('request.jwt.claim.sub',member::text,true);
    perform set_config('role','authenticated',true);
    begin
      perform public.get_shared_discovery_overlay_v2(fixture.shared,null);
      raise exception 'Nonmember could read Shared overlay';
    exception when insufficient_privilege then null; end;
    perform set_config('role','postgres',true);
  end loop;
end;
$verify$;
select jsonb_build_object('sharedOverlayEligibility',
  'PASS: withdrawn/rejected pending/member-history suppression, retained metadata, scope and authorization') as snapshot;
rollback;
