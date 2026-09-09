-- Synthetic populated state for the independent forward-upgrade test only.
-- Caller has restored the pre-upgrade schema and owns BEGIN/COMMIT.
do $existing_fixture$
declare
  actor uuid := 'a2080000-0000-4000-8000-000000000001';
  partner uuid := 'a2080000-0000-4000-8000-000000000002';
  outsider uuid := 'a2080000-0000-4000-8000-000000000003';
  shared uuid := 'a2080000-0000-4000-8000-000000000004';
  evidence uuid := 'a2080000-0000-4000-8000-000000000005';
  candidate uuid := 'a2080000-0000-4000-8000-000000000006';
  native_item uuid := 'a2080000-0000-4000-8000-000000000007';
  job uuid := 'a2080000-0000-4000-8000-000000000008';
  profile uuid;
begin
  if exists(select 1 from auth.users) or exists(select 1 from public.items) then
    raise exception 'Existing-application fixture requires empty synthetic state';
  end if;
  insert into auth.users(id,email,raw_user_meta_data)
  select id,id::text || '@example.invalid',jsonb_build_object('kajo_nickname','Upgrade ' || right(id::text,6))
    from unnest(array[actor,partner,outsider]) as fixture(id);
  select id into strict profile from public.profiles
    where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Upgrade fixture');
  insert into public.profile_members(profile_id,user_id) values(shared,actor),(shared,partner);
  insert into public.items(id,item_type,title,tags,discoverable) values
    (evidence,'BOOK','Imported evidence',array['upgrade-fixture'],false),
    (candidate,'BOOK','Unseen candidate',array['upgrade-fixture'],true),
    (native_item,'BOOK','Native rating',array['native-fixture'],false);
  insert into private.profile_import_jobs(id,actor_user_id,profile_id,source_provider,
    dataset_kind,file_fingerprint,status,committed_at)
  values(job,actor,profile,'KAJO_CSV','UPGRADE_FIXTURE','upgrade-fixture','COMMITTED',now());
  insert into private.profile_bootstrap_evidence(actor_user_id,profile_id,item_id,item_type,
    source_provider,dataset_kind,source_job_id,source_row_key,evidence_kind,rating)
  values(actor,profile,evidence,'BOOK','KAJO_CSV','UPGRADE_FIXTURE',job,'1','RATED',10);
  insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,rating)
    values(profile,native_item,actor,true,8);
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,properties)
    values(gen_random_uuid(),actor,profile,native_item,'BOOK','ITEM_RATED',now(),'{"rating":8}');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  perform public.rank_items_v1(profile,'FOR_YOU','BOOK',20,'{}');
  perform public.rank_items_v1(shared,'FOR_YOU','BOOK',20,'{}');
  perform set_config('role','postgres',true);
end;
$existing_fixture$;
