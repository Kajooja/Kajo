-- Rollback-only acceptance through the actual calibration/read/action APIs.
begin;
do $history_projection$
declare
  actor uuid := gen_random_uuid(); partner uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  profile uuid; partner_profile uuid; shared uuid := gen_random_uuid();
  items uuid[]; responses jsonb; job uuid := gen_random_uuid(); list uuid;
  base jsonb; command jsonb; receipt jsonb; cleared jsonb; row record; memory_before jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Projection '||left(id::text,10))
    from unnest(array[actor,partner,outsider]) fixture(id);
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  select id into strict partner_profile from public.profiles where owner_user_id=partner and profile_type='PERSONAL';
  select array_agg(gen_random_uuid()) into items from generate_series(1,10);
  insert into public.items(id,item_type,title,discoverable,tags)
    select id,case when n<=3 or n>6 then 'BOOK' else 'MOVIE' end,
      'Projection fixture '||n,true,array['projection-'||n]
    from unnest(items) with ordinality fixture(id,n);
  insert into private.item_sources(item_id,provider_key,provider_item_id)
    select id,'kajo_curated',id::text from unnest(items) fixture(id);
  select jsonb_agg(jsonb_build_object('itemId',id,'rating',case when n=1 then 0 else 8 end) order by n)
    into responses from unnest(items[1:6]) with ordinality fixture(id,n);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  perform public.commit_profile_calibration_v1(profile,responses);
  if (select count(*) from public.get_profile_consumed_items(profile,null))<>6
    or (select count(*) from public.get_profile_consumed_items(profile,'BOOK'))<>3
    or (select count(*) from public.get_profile_consumed_items(profile,'MOVIE'))<>3 then
    raise exception 'Calibration history is incomplete or ItemType filtering failed';
  end if;
  select * into strict row from public.get_profile_item_states_v1(profile) where item_id=items[1];
  if row.rating is distinct from 0 or not row.consumed or row.saved then
    raise exception 'Initial zero rating is not hydrated truthfully';
  end if;
  perform set_config('role','postgres',true);
  if exists(select 1 from public.events where profile_id=profile)
    or exists(select 1 from public.item_interactions where profile_id=profile) then
    raise exception 'Read projection synthesized native history';
  end if;
  memory_before := private.build_profile_memory_state_v1(profile,now());
  if memory_before->>'bootstrapEvidenceCount'<>'6' or memory_before->>'nativeEvidenceCount'<>'0' then
    raise exception 'Calibration lost its source provenance';
  end if;

  -- Multiple sources deduplicate deterministically. SAVED/inactive/future rows
  -- do not become consumed; no rating is invented for read-only imports.
  insert into private.profile_import_jobs(id,actor_user_id,profile_id,source_provider,dataset_kind,file_fingerprint)
    values(job,actor,profile,'KAJO_CSV','HISTORY','projection-fixture');
  insert into private.profile_bootstrap_evidence(actor_user_id,profile_id,item_id,item_type,source_provider,
    dataset_kind,source_job_id,source_row_key,evidence_kind,rating,source_occurred_at,imported_at,active)
    values
      (actor,profile,items[1],'BOOK','KAJO_CSV','OLD_RATING',job,'old','RATED',10,now()-interval '1 day',now(),true),
      (actor,profile,items[1],'BOOK','KAJO_CSV','HISTORY',job,'read','CONSUMED',null,now(),now(),true),
      (actor,profile,items[7],'BOOK','KAJO_CSV','HISTORY',job,'7','CONSUMED',null,null,now(),true),
      (actor,profile,items[8],'BOOK','KAJO_CSV','HISTORY',job,'8','SAVED',null,null,now(),true),
      (actor,profile,items[9],'BOOK','KAJO_CSV','HISTORY',job,'9','RATED',10,null,now(),false),
      (actor,profile,items[10],'BOOK','KAJO_CSV','HISTORY',job,'10','RATED',10,null,now()+interval '1 day',true);
  perform set_config('role','authenticated',true);
  if (select count(*) from public.get_profile_consumed_items(profile,null))<>7
    or (select rating from public.get_profile_consumed_items(profile,null) where item_id=items[1]) is distinct from 0
    or (select rating from public.get_profile_consumed_items(profile,null) where item_id=items[7]) is not null then
    raise exception 'Bootstrap precedence/deduplication/eligibility failed';
  end if;

  -- Native and bootstrap member history use the same attributed Shared tier.
  perform set_config('role','postgres',true);
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Projection Shared');
  insert into public.profile_members(profile_id,user_id) values(shared,actor),(shared,partner);
  insert into public.item_interactions(profile_id,item_id,actor_user_id,rating,consumed)
    values(partner_profile,items[1],partner,2,true);
  perform set_config('role','authenticated',true);
  if exists(select 1 from public.get_profile_consumed_items(shared,null))
    or exists(select 1 from public.get_profile_item_states_v1(shared)) then
    raise exception 'Personal history was copied into Shared state';
  end if;
  select * into strict row from public.get_shared_discovery_overlay(shared,'BOOK') where item_id=items[1];
  if cardinality(row.member_consumed_user_ids)<>2
    or not row.member_consumed_user_ids @> array[actor,partner]
    or row.member_max_rating is distinct from 2 or row.ineligible_for_discovery then
    raise exception 'Shared native/bootstrap history attribution differs';
  end if;
  select * into strict row from public.get_shared_discovery_overlay(shared,'BOOK') where item_id=items[2];
  if row.member_consumed_user_ids is distinct from array[actor] or row.member_max_rating is distinct from 8 then
    raise exception 'Bootstrap-only history would remain an unmarked ordinary Shared card';
  end if;
  -- A Shared member still cannot read another member's private complete history.
  perform set_config('request.jwt.claim.sub',partner::text,true);
  begin
    perform public.get_profile_item_states_v1(profile);
    raise exception 'Shared membership exposed a PersonalProfile';
  exception when insufficient_privilege then null; end;
  begin
    perform public.get_profile_consumed_items(profile,null);
    raise exception 'Shared membership exposed private consumed history';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);

  -- Editing and undo preserve the bootstrap source; clearing cancels both sources.
  base := jsonb_build_object('version',1,'actorUserId',actor,'profileId',profile,'itemId',items[1],
    'occurredAt',now(),'source','LIST_DETAIL','predictionId',null,'discoveryMode',null,
    'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  command := base||jsonb_build_object('actionId',gen_random_uuid(),'kind','SET_RATING','rating',9);
  receipt := public.commit_item_action_v1(command);
  if (select rating from public.get_profile_item_states_v1(profile) where item_id=items[1]) is distinct from 9
    or (select rating from public.get_profile_consumed_items(profile,null) where item_id=items[1]) is distinct from 9 then
    raise exception 'Native edit did not supersede displayed bootstrap rating';
  end if;
  perform public.commit_item_action_v1(command||jsonb_build_object('actionId',gen_random_uuid(),
    'kind','UNDO','reversesActionId',command->>'actionId'));
  if (select rating from public.get_profile_item_states_v1(profile) where item_id=items[1]) is distinct from 0 then
    raise exception 'Undo did not restore visible initial rating';
  end if;
  perform public.commit_item_action_v1(command||jsonb_build_object('actionId',gen_random_uuid(),'rating',4));
  receipt := public.commit_collection_action_v1(base||jsonb_build_object('actionId',gen_random_uuid(),
    'kind','CREATE_LIST','itemId',null,'name','Projection List'));
  list := (receipt->>'listId')::uuid;
  perform public.commit_collection_action_v1(base||jsonb_build_object('actionId',gen_random_uuid(),
    'kind','SET_LIST_ENTRY','listId',list,'present',true,'positive',false));
  if (select rating from public.get_item_list_entries(list) where item_id=items[1]) is distinct from 4 then
    raise exception 'Named List disagrees with effective history';
  end if;
  -- A bootstrap-only List entry gets the same badge, without creating a rating.
  perform public.commit_collection_action_v1(base||jsonb_build_object('actionId',gen_random_uuid(),
    'kind','SET_LIST_ENTRY','itemId',items[2],'listId',list,'present',true,'positive',false));
  if (select rating from public.get_item_list_entries(list) where item_id=items[2]) is distinct from 8 then
    raise exception 'Named List omitted initial rating';
  end if;
  command := base||jsonb_build_object('actionId',gen_random_uuid(),'kind','CLEAR_HISTORY');
  cleared := public.commit_collection_action_v1(command);
  if exists(select 1 from public.get_profile_consumed_items(profile,null) where item_id=items[1])
    or public.commit_collection_action_v1(command) is distinct from cleared then
    raise exception 'Clear/retry left initial history visible';
  end if;
  select * into strict row from public.get_item_list_entries(list) where item_id=items[1];
  if row.consumed or row.rating is not null then raise exception 'Clear left List history badge'; end if;
  select * into strict row from public.get_shared_discovery_overlay(shared,'BOOK') where item_id=items[1];
  if row.member_consumed_user_ids is distinct from array[partner] or row.member_max_rating is distinct from 2 then
    raise exception 'Clear erased another member or retained stale Shared provenance';
  end if;
  perform set_config('role','postgres',true);
  if private.build_profile_memory_state_v1(profile,now())->'longTermNegativeTags' ? 'projection-1'
    or private.build_profile_memory_state_v1(profile,now())->'longTermPositiveTags' ? 'projection-1' then
    raise exception 'Cleared initial/native rating remains in Memory';
  end if;
  if private.resurfacing_policy_decision_v1(profile,items[1],cleared->'interaction',now())->>'eligible'<>'false' then
    raise exception 'History removal bypassed remaining List membership';
  end if;
  perform set_config('role','authenticated',true);
  perform public.commit_collection_action_v1(base||jsonb_build_object('actionId',gen_random_uuid(),
    'kind','SET_LIST_ENTRY','listId',list,'present',false,'positive',false));
  perform set_config('role','postgres',true);
  if private.resurfacing_policy_decision_v1(profile,items[1],cleared->'interaction',now())->>'eligible'<>'true' then
    raise exception 'Cleared unlisted history is still ineligible';
  end if;
  delete from public.profile_members where profile_id=shared and user_id=partner;
  perform set_config('role','authenticated',true);
  select * into strict row from public.get_shared_discovery_overlay(shared,'BOOK') where item_id=items[1];
  if cardinality(row.member_consumed_user_ids)<>0 then raise exception 'Removed member history leaked'; end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.get_profile_item_states_v1(profile);
    raise exception 'Outsider read another Profile';
  exception when insufficient_privilege then null; end;
  begin
    perform public.get_shared_discovery_overlay(shared,null);
    raise exception 'Outsider read Shared member history';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.get_profile_item_states_v1(profile);
    raise exception 'Unauthenticated caller read state';
  exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
  if has_function_privilege('anon','public.get_profile_item_states_v1(uuid)','execute')
    or has_function_privilege('authenticated','private.profile_item_state_projection_v1(uuid)','execute')
    or has_function_privilege('service_role','private.get_profile_item_states_v1(uuid)','execute')
    or not has_function_privilege('authenticated','public.get_profile_item_states_v1(uuid)','execute') then
    raise exception 'Projection privileges are too broad';
  end if;
end;
$history_projection$;
select jsonb_build_object('bootstrapHistory',
  'PASS: calibration/import/native parity, zero/deduplication, edit/undo/clear, List/Memory/eligibility and Shared privacy') as snapshot;
rollback;
