-- Exercise the committed fixtures before and after the upgrade. All additional
-- traces, import removal and membership changes are rolled back by the caller.
do $existing_runtime$
declare
  actor uuid := 'a2080000-0000-4000-8000-000000000001';
  partner uuid := 'a2080000-0000-4000-8000-000000000002';
  outsider uuid := 'a2080000-0000-4000-8000-000000000003';
  shared uuid := 'a2080000-0000-4000-8000-000000000004';
  candidate uuid := 'a2080000-0000-4000-8000-000000000006';
  job uuid := 'a2080000-0000-4000-8000-000000000008';
  profile uuid;
  ranked record;
  member uuid;
  new_actor uuid := gen_random_uuid();
begin
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  select * into strict ranked from public.rank_items_v1(profile,'FOR_YOU','BOOK',20,'{}') where item_id=candidate;
  if ranked.explanation->>'baseVersion' is distinct from 'prediction-v0.4-bootstrap'
    or coalesce((ranked.explanation->>'bootstrapLongTerm')::numeric,0) <= 0 then
    raise exception 'Existing Personal bootstrap ranking failed';
  end if;
  select * into strict ranked from public.rank_items_v1(shared,'FOR_YOU','BOOK',20,'{}') where item_id=candidate;
  if ranked.explanation->'sharedCommonFit'->>'version' is distinct from 'shared-common-fit-v1.1'
    or ranked.explanation->'sharedCommonFit'->>'memberCount' is distinct from '2'
    or ranked.explanation->'sharedCommonFit'->>'privacyBoundary' is distinct from 'AGGREGATE_ONLY' then
    raise exception 'Existing Shared ranking failed';
  end if;
  perform public.remove_profile_import_job_v1(job);
  select * into strict ranked from public.rank_items_v1(profile,'FOR_YOU','BOOK',20,'{}') where item_id=candidate;
  if coalesce((ranked.explanation->>'bootstrapLongTerm')::numeric,0) <> 0 then
    raise exception 'Existing import removal did not remove its ranking contribution';
  end if;
  if not exists(select 1 from public.item_interactions where profile_id=profile and rating=8)
    or not exists(select 1 from public.events where profile_id=profile and event_type='ITEM_RATED') then
    raise exception 'Import removal changed native evidence';
  end if;
  perform set_config('role','postgres',true);
  delete from public.profile_members where profile_id=shared and user_id=partner;
  foreach member in array array[outsider,partner] loop
    perform set_config('request.jwt.claim.sub',member::text,true);
    perform set_config('role','authenticated',true);
    begin
      perform public.rank_items_v1(shared,'FOR_YOU','BOOK',20,'{}');
      raise exception 'Existing Shared outsider/revoked-member denial failed';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.rank_items_v1(profile,'FOR_YOU','BOOK',20,'{}');
      raise exception 'Existing Personal outsider denial failed';
    exception when insufficient_privilege then null;
    end;
    perform set_config('role','postgres',true);
  end loop;
  insert into auth.users(id,email,raw_user_meta_data)
    values(new_actor,new_actor::text || '@example.invalid','{"kajo_nickname":"New upgrade user"}');
  if not exists(select 1 from public.profiles p join public.profile_members m on m.profile_id=p.id
    where p.owner_user_id=new_actor and p.profile_type='PERSONAL' and m.user_id=new_actor) then
    raise exception 'Post-upgrade Auth provisioning failed';
  end if;
end;
$existing_runtime$;
