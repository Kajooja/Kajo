-- Synthetic membership fixtures; called inside the local probe's outer transaction.
-- Does not test the invitation/consent UI or establish recommendation quality.
do $shared_probe$
declare
  actor uuid := gen_random_uuid();
  partner uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  shared uuid := gen_random_uuid();
  candidate uuid := gen_random_uuid();
  member uuid;
  personal_ids uuid[];
  common_fit jsonb;
  ranked record;
begin
  insert into auth.users(id,email,raw_user_meta_data)
  select id,id::text || '@example.invalid',jsonb_build_object('kajo_nickname','Probe ' || left(id::text,18))
  from unnest(array[actor,partner,outsider]) as fixture(id);
  select array_agg(id) into personal_ids from public.profiles
    where owner_user_id in (actor,partner) and profile_type='PERSONAL';
  if coalesce(cardinality(personal_ids),0) <> 2 then
    raise exception 'Shared members missing automatically provisioned PersonalProfiles';
  end if;
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Install probe');
  insert into public.profile_members(profile_id,user_id) values(shared,actor),(shared,partner);
  insert into public.items(id,item_type,title,tags,discoverable)
    values(candidate,'BOOK','Shared install candidate',array['shared-install-probe'],true);
  foreach member in array array[actor,partner] loop
    perform set_config('request.jwt.claim.sub',member::text,true);
    perform set_config('role','authenticated',true);
    select * into strict ranked from public.rank_items_v1(shared,'FOR_YOU','BOOK',20,'{}')
      where item_id=candidate;
    common_fit := ranked.explanation->'sharedCommonFit';
    if common_fit->>'version' is distinct from 'shared-common-fit-v1.1'
       or common_fit->>'applicable' is distinct from 'true'
       or common_fit->>'memberCount' is distinct from '2'
       or common_fit->>'privacyBoundary' is distinct from 'AGGREGATE_ONLY'
       or common_fit->>'personalEvidenceCopied' is distinct from 'false' then
      raise exception 'Invalid Shared common-fit explanation: %',common_fit;
    end if;
    if exists(select 1 from unnest(array[actor,partner] || personal_ids) id
      where position(id::text in common_fit::text) > 0) then
      raise exception 'Shared common-fit exposed member or PersonalProfile identity';
    end if;
    perform set_config('role','postgres',true);
  end loop;
  -- Outsider and revoked member must both fail through the public RPC.
  delete from public.profile_members where profile_id=shared and user_id=partner;
  foreach member in array array[outsider,partner] loop
    perform set_config('request.jwt.claim.sub',member::text,true);
    perform set_config('role','authenticated',true);
    begin
      perform public.rank_items_v1(shared,'FOR_YOU','BOOK',20,'{}');
      raise exception 'Nonmember was allowed to rank SharedProfile';
    exception when insufficient_privilege then null;
    end;
    perform set_config('role','postgres',true);
  end loop;
  if (select count(*) from private.prediction_runs where profile_id=shared
      and policy_version like '%shared-common-fit-v1.1%'
      and base_model_version='prediction-v0.4-bootstrap') <> 2 then
    raise exception 'Missing Shared versioned traces or denied call persisted a trace';
  end if;
end;
$shared_probe$;
