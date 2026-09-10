-- Full-schema, rollback-only named-list eligibility acceptance.
begin;
do $lists$
declare
  actor uuid := gen_random_uuid(); partner uuid := gen_random_uuid();
  personal uuid; other_profile uuid; shared uuid := gen_random_uuid();
  item uuid := gen_random_uuid(); reminder uuid := gen_random_uuid();
  first_list uuid; second_list uuid; other_list uuid; shared_list uuid;
  base jsonb; cmd jsonb; result jsonb; policy jsonb;
  decision_time timestamptz := now();
  return_observed boolean;
  return_required boolean;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','List '||left(id::text,16))
    from unnest(array[actor,partner]) fixture(id);
  select id into strict personal from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  select id into strict other_profile from public.profiles where owner_user_id=partner and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','List eligibility');
  insert into public.profile_members(profile_id,user_id) values(shared,actor),(shared,partner);
  insert into public.items(id,item_type,title,discoverable) values(item,'BOOK','Listed book',true),(reminder,'BOOK','Old list book',true);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  base := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,'profileId',personal,
    'kind','CREATE_LIST','name','First','source','LISTS','occurredAt',now(),
    'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  result := public.commit_collection_action_v1(base); first_list := (result->>'listId')::uuid;
  result := public.commit_collection_action_v1(base || jsonb_build_object('actionId',gen_random_uuid(),'name','Second'));
  second_list := (result->>'listId')::uuid;
  cmd := base || jsonb_build_object('actionId',gen_random_uuid(),'kind','SET_LIST_ENTRY','listId',first_list,
    'itemId',item,'present',true,'positive',true,'source','ITEM_DESTINATION_PICKER');
  perform set_config('role','authenticated',true);
  perform public.commit_collection_action_v1(cmd);
  perform set_config('role','postgres',true);
  policy := private.resurfacing_policy_decision_v1(personal,item,'{}',decision_time);
  if policy->>'classification'<>'SAVED_SUPPRESSED' or policy->>'eligible'<>'false'
    or policy->>'listMembershipPolicyVersion'<>'active-list-v1' then raise exception 'Custom List did not suppress ordinary delivery: %',policy; end if;
  perform set_config('role','authenticated',true);
  if exists(select 1 from public.rank_items_v1(personal,'FOR_YOU','BOOK',20,'{}') where item_id=item) then
    raise exception 'Public ranking delivered a recently listed Item';
  end if;
  perform set_config('role','authenticated',true);
  perform public.commit_collection_action_v1(cmd || jsonb_build_object('actionId',gen_random_uuid(),'listId',second_list));
  perform set_config('role','authenticated',true);
  perform public.commit_collection_action_v1(cmd || jsonb_build_object('actionId',gen_random_uuid(),'present',false,'positive',false,'source','LIST_DETAIL'));
  perform set_config('role','postgres',true);
  policy := private.resurfacing_policy_decision_v1(personal,item,'{}',decision_time);
  if policy->>'eligible'<>'false' then raise exception 'One removal ignored remaining membership'; end if;
  perform set_config('role','authenticated',true);
  perform public.commit_collection_action_v1(cmd || jsonb_build_object('actionId',gen_random_uuid(),'listId',second_list,'present',false,'positive',false,'source','LIST_DETAIL'));
  perform set_config('role','postgres',true);
  policy := private.resurfacing_policy_decision_v1(personal,item,'{"interest":"LIKED"}',decision_time);
  if policy->>'classification'<>'ORDINARY' or policy->>'eligible'<>'true' then raise exception 'Final removal did not restore ordinary eligibility'; end if;
  perform set_config('role','authenticated',true);
  select exists(select 1 from public.rank_items_v1(personal,'FOR_YOU','BOOK',20,'{}') where item_id=item)
    into return_observed;
  -- A populated catalog can outrank this synthetic book. Eligibility restoration
  -- is mandatory above; exact top-20 return is only guaranteed in the small fixture.
  select count(*) <= 20 into return_required from public.items where item_type='BOOK' and discoverable;
  perform set_config('kajo.test.list_return_required',return_required::text,true);
  perform set_config('kajo.test.list_return_observed',return_observed::text,true);
  if return_required and not return_observed then
    raise exception 'Public ranking failed to return Item after final removal';
  end if;
  perform set_config('role','authenticated',true);
  perform public.commit_collection_action_v1(cmd || jsonb_build_object('actionId',gen_random_uuid()));
  perform set_config('role','authenticated',true);
  perform public.commit_collection_action_v1(base || jsonb_build_object('actionId',gen_random_uuid(),'kind','DELETE_LIST','listId',first_list));
  perform set_config('role','postgres',true);
  if private.resurfacing_policy_decision_v1(personal,item,'{}',decision_time)->>'eligible'<>'true' then
    raise exception 'Deleting final List left suppression';
  end if;
  -- An active older membership can be a bounded reminder; metadata access does
  -- not reset its age, and terminal reactions still win over List reminders.
  perform set_config('role','postgres',true);
  insert into public.item_list_entries(list_id,item_id,added_by_user_id,added_at)
    values(second_list,reminder,actor,now()-interval '31 days');
  perform set_config('role','postgres',true);
  policy := private.resurfacing_policy_decision_v1(personal,reminder,'{}',decision_time);
  if policy->>'classification'<>'SAVED_REMINDER_ELIGIBLE' or policy->>'eligible'<>'true' then raise exception 'Old List membership lost reminder eligibility: %',policy; end if;
  perform set_config('role','postgres',true);
  if private.resurfacing_policy_decision_v1(personal,reminder,'{"consumedSuppressed":true}',decision_time)->>'eligible'<>'false'
    or private.resurfacing_policy_decision_v1(personal,reminder,'{"rating":8}',decision_time)->>'eligible'<>'false'
    or private.resurfacing_policy_decision_v1(personal,reminder,'{"notInterested":true}',decision_time)->>'eligible'<>'false' then
    raise exception 'List reminder overrode terminal reaction';
  end if;
  -- Membership is Profile-specific, including distinct Shared membership.
  insert into public.item_lists(profile_id,name,list_kind,created_by_user_id) values(other_profile,'Other','CUSTOM',partner) returning id into other_list;
  insert into public.item_list_entries(list_id,item_id,added_by_user_id) values(other_list,item,partner);
  perform set_config('role','postgres',true);
  if private.resurfacing_policy_decision_v1(personal,item,'{}',decision_time)->>'eligible'<>'true' then raise exception 'Other Profile membership leaked'; end if;
  insert into public.item_lists(profile_id,name,list_kind,created_by_user_id) values(shared,'Shared','CUSTOM',actor) returning id into shared_list;
  perform set_config('role','authenticated',true);
  cmd := base || jsonb_build_object('actionId',gen_random_uuid(),'profileId',shared,'kind','ENDORSE_SHARED_ITEM',
    'itemId',item,'listId',shared_list,'source','SHARED_DISCOVERY',
    'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  perform public.commit_collection_action_v1(cmd);
  perform set_config('request.jwt.claim.sub',partner::text,true);
  cmd := cmd || jsonb_build_object('actionId',gen_random_uuid(),'actorUserId',partner,'listId',null,
    'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  perform public.commit_collection_action_v1(cmd);
  perform set_config('role','postgres',true);
  if private.resurfacing_policy_decision_v1(shared,item,'{}',decision_time)->>'eligible'<>'false' then raise exception 'Shared List membership ignored'; end if;
  perform set_config('role','authenticated',true);
  perform public.commit_collection_action_v1((cmd - 'itemId') || jsonb_build_object('actionId',gen_random_uuid(),
    'kind','DELETE_LIST','listId',shared_list,'source','LIST_DETAIL'));
  perform set_config('role','postgres',true);
  if private.resurfacing_policy_decision_v1(shared,item,'{}',decision_time)->>'eligible'<>'false' then
    raise exception 'Shared remaining Saved membership lost suppression';
  end if;
  -- Shared Saved is governed by consensus, not the Personal direct-remove path.
  select id into strict shared_list from public.item_lists where profile_id=shared and list_kind='SYSTEM_SAVED';
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_collection_action_v1(cmd || jsonb_build_object('actionId',gen_random_uuid(),'kind','SET_LIST_ENTRY',
      'listId',shared_list,'present',false,'positive',false,'source','LIST_DETAIL'));
    raise exception 'Personal removal bypassed Shared consensus';
  exception when insufficient_privilege then null;
  end;
end;
$lists$;
select jsonb_build_object('listMembership','PASS: public delivery suppression, eligibility restoration, multiple Lists, deletion, reminders, terminal reactions and Profile isolation',
  'top20ReturnRequired',current_setting('kajo.test.list_return_required')::boolean,
  'top20ReturnObserved',current_setting('kajo.test.list_return_observed')::boolean) as snapshot;
rollback;
