-- Full-schema acceptance. Temporary failure injection belongs only in isolated CI.
begin;
create function pg_temp.reject_collection_event() returns trigger language plpgsql as $$
begin
  if new.properties->>'actionId'=current_setting('kajo.reject_collection_action',true)
    and new.event_type=current_setting('kajo.reject_collection_type',true) then
    raise exception 'Forced collection Event failure';
  end if;
  return new;
end;
$$;
create trigger reject_collection_event before insert on public.events
for each row execute function pg_temp.reject_collection_event();
do $collections$
declare
  actor uuid := gen_random_uuid(); partner uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  personal uuid; shared uuid := gen_random_uuid(); item uuid := gen_random_uuid(); other_item uuid := gen_random_uuid();
  base jsonb; shared_base jsonb; cmd jsonb; created_cmd jsonb; entry_cmd jsonb; rating_cmd jsonb; undo_cmd jsonb;
  result jsonb; previous jsonb; personal_list uuid; shared_list uuid; second_list uuid; delete_cmd jsonb;
  pending_cmd jsonb; consensus_cmd jsonb; failed_id uuid := gen_random_uuid(); initial_entry jsonb; count_before bigint;
  ranked record; trace_cmd jsonb; trace_result jsonb; saved_list uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Collection '||left(id::text,12))
    from unnest(array[actor,partner,outsider]) fixture(id);
  select id into strict personal from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(shared,'SHARED','Collection smoke');
  insert into public.profile_members(profile_id,user_id) values(shared,actor),(shared,partner);
  insert into public.items(id,item_type,title,discoverable) values(item,'BOOK','Collection book',true),(other_item,'MOVIE','Collection movie',true);
  base := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,'profileId',personal,
    'itemId',null,'listId',null,'occurredAt',now(),'kind','CREATE_LIST','name','First','source','LISTS',
    'predictionId',null,'discoveryMode','FOR_YOU','session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  created_cmd := base;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  previous := public.commit_collection_action_v1(created_cmd);
  personal_list := (previous->>'listId')::uuid;
  if public.commit_collection_action_v1(created_cmd) is distinct from previous or personal_list is null then
    raise exception 'Create retry changed result';
  end if;
  begin
    perform public.commit_collection_action_v1(created_cmd || '{"name":"Changed"}'::jsonb);
    raise exception 'Changed payload reused ID';
  exception when data_exception then null; end;
  begin
    perform public.commit_collection_action_v1(created_cmd || jsonb_build_object('actionId',gen_random_uuid()));
    raise exception 'Duplicate name accepted';
  exception when sqlstate 'KJ002' then null; end;
  result := public.commit_collection_action_v1(base || jsonb_build_object('actionId',gen_random_uuid(),'kind','RENAME_LIST','listId',personal_list,'name','First'));
  if result->>'changed'<>'false' or result->'eventIds'<>'[]'::jsonb then raise exception 'No-op rename invented evidence'; end if;
  result := public.commit_collection_action_v1(base || jsonb_build_object('actionId',gen_random_uuid(),'kind','RENAME_LIST','listId',personal_list,'name','Renamed'));
  if result->'result'->0->>'name'<>'Renamed' then raise exception 'Rename failed'; end if;

  entry_cmd := base || jsonb_build_object('actionId',gen_random_uuid(),'kind','SET_LIST_ENTRY','listId',personal_list,
    'itemId',item,'present',true,'positive',true,'source','ITEM_DESTINATION_PICKER');
  previous := public.commit_collection_action_v1(entry_cmd);
  if previous->>'undoable'<>'true' or previous->'interaction'->>'interest'<>'LIKED'
    or jsonb_array_length(previous->'eventIds')<>2 then raise exception 'Personal positive List action lost state/evidence'; end if;
  if public.commit_collection_action_v1(entry_cmd) is distinct from previous then raise exception 'Entry retry changed'; end if;
  -- A no-op receipt exists without fabricating an Event and shares the global ID boundary.
  cmd := entry_cmd || jsonb_build_object('actionId',gen_random_uuid());
  result := public.commit_collection_action_v1(cmd);
  if result->>'changed'<>'false' or result->>'undoable'<>'false' then raise exception 'Duplicate add invented a transition'; end if;
  begin
    perform public.commit_item_action_v1(cmd || '{"kind":"SET_RATING","rating":8}'::jsonb);
    raise exception 'Another command family reused a no-op ID';
  exception when data_exception then null; end;
  begin
    perform public.commit_item_action_v1(entry_cmd || jsonb_build_object('actionId',gen_random_uuid(),'kind','UNDO','reversesActionId',entry_cmd->>'actionId'));
    raise exception 'Item undo bypassed List membership restoration';
  exception when sqlstate 'KJ001' then null; end;
  rating_cmd := base || jsonb_build_object('actionId',gen_random_uuid(),'itemId',item,'kind','SET_RATING','rating',9);
  perform public.commit_item_action_v1(rating_cmd);
  undo_cmd := base || jsonb_build_object('actionId',gen_random_uuid(),'itemId',item,'kind','UNDO_LIST_ENTRY',
    'reversesActionId',entry_cmd->>'actionId','source','LIST_DETAIL');
  begin
    perform public.commit_collection_action_v1(undo_cmd);
    raise exception 'List undo erased an intervening rating';
  exception when sqlstate 'KJ001' then null; end;
  perform public.commit_item_action_v1(rating_cmd || jsonb_build_object('actionId',gen_random_uuid(),'kind','UNDO','reversesActionId',rating_cmd->>'actionId'));
  result := public.commit_collection_action_v1(undo_cmd);
  if result->'interaction' is distinct from previous->'beforeInteraction'
    or public.commit_collection_action_v1(undo_cmd) is distinct from result then raise exception 'Mixed ordered undo/retry failed'; end if;
  perform set_config('role','postgres',true);
  if jsonb_array_length(result->'eventIds')<>jsonb_array_length(previous->'eventIds')
    or exists(select 1 from jsonb_array_elements_text(previous->'eventIds') original(id)
      where not exists(select 1 from public.events correction where correction.properties->>'actionId'=undo_cmd->>'actionId'
        and correction.event_type='ITEM_INTERACTION_UNDONE' and correction.properties->>'reversedEventId'=original.id)) then
    raise exception 'List undo left part of its taste evidence active';
  end if;
  if (private.build_profile_memory_state_v1(personal,now())->>'nativeEvidenceCount')::integer<>0 then
    raise exception 'Memory still learned from the undone List+Like/rating sequence';
  end if;
  if exists(select 1 from public.item_list_entries where item_id=item and list_id=personal_list) then
    raise exception 'List undo kept membership';
  end if;
  perform set_config('role','authenticated',true);
  entry_cmd := entry_cmd || jsonb_build_object('actionId',gen_random_uuid());
  perform public.commit_collection_action_v1(entry_cmd);
  perform set_config('role','postgres',true);
  select to_jsonb(e) into initial_entry from public.item_list_entries e where e.list_id=personal_list and e.item_id=item;
  delete from public.item_list_entries e where e.list_id=personal_list and e.item_id=item;
  insert into public.item_list_entries(list_id,item_id,added_by_user_id) values(personal_list,item,actor);
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_collection_action_v1(undo_cmd || jsonb_build_object('actionId',gen_random_uuid(),'reversesActionId',entry_cmd->>'actionId'));
    raise exception 'Legacy membership ABA was erased';
  exception when sqlstate 'KJ001' then null; end;

  -- Removing and undoing an existing Entry preserves its original provenance.
  perform set_config('role','postgres',true);
  update public.item_list_entries set added_by_user_id=partner,added_at=now()-interval '5 days'
    where list_id=personal_list and item_id=item;
  select to_jsonb(e) into initial_entry from public.item_list_entries e where e.list_id=personal_list and e.item_id=item;
  perform set_config('role','authenticated',true);
  cmd := entry_cmd || jsonb_build_object('actionId',gen_random_uuid(),'present',false,'positive',false,'source','LIST_DETAIL');
  perform public.commit_collection_action_v1(cmd);
  perform public.commit_collection_action_v1(undo_cmd || jsonb_build_object('actionId',gen_random_uuid(),'reversesActionId',cmd->>'actionId'));
  perform set_config('role','postgres',true);
  if (select to_jsonb(e) from public.item_list_entries e where e.list_id=personal_list and e.item_id=item) is distinct from initial_entry then
    raise exception 'Undo replaced original Entry actor/time/source';
  end if;
  perform set_config('role','authenticated',true);
  perform private.get_profile_item_lists(personal,null);
  select id into strict saved_list from public.item_lists where profile_id=personal and list_kind='SYSTEM_SAVED';
  cmd := entry_cmd || jsonb_build_object('actionId',gen_random_uuid(),'listId',saved_list);
  result := public.commit_collection_action_v1(cmd);
  if result->'interaction'->>'saved'<>'true' or jsonb_array_length(result->'eventIds')<>1 then
    raise exception 'System Saved action lost Saved state or doubled evidence';
  end if;
  perform public.commit_collection_action_v1(undo_cmd || jsonb_build_object('actionId',gen_random_uuid(),'reversesActionId',cmd->>'actionId'));

  -- Real selected delivery plus a recorded impression is required for correlation.
  select * into strict ranked from public.rank_items_v1(personal,'FOR_YOU','MOVIE',20,
    jsonb_build_object('sessionId',base->'session'->>'sessionId')) where item_id=other_item;
  trace_cmd := entry_cmd || jsonb_build_object('actionId',gen_random_uuid(),'itemId',other_item,
    'occurredAt',clock_timestamp(),'predictionId',ranked.prediction_id);
  result := public.commit_collection_action_v1(trace_cmd);
  if result->>'predictionId' is not null then raise exception 'Collection action correlated without exposure'; end if;
  perform public.commit_collection_action_v1(undo_cmd || jsonb_build_object('actionId',gen_random_uuid(),'itemId',other_item,
    'reversesActionId',trace_cmd->>'actionId'));
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id)
    values(gen_random_uuid(),actor,personal,other_item,'MOVIE','ITEM_IMPRESSION',clock_timestamp(),
      (base->'session'->>'sessionId')::uuid,ranked.prediction_id);
  trace_cmd := trace_cmd || jsonb_build_object('actionId',gen_random_uuid(),'occurredAt',clock_timestamp());
  trace_result := public.commit_collection_action_v1(trace_cmd);
  if trace_result->>'predictionId' is distinct from ranked.prediction_id::text then raise exception 'Valid collection trace lost'; end if;
  result := public.commit_collection_action_v1(undo_cmd || jsonb_build_object('actionId',gen_random_uuid(),'itemId',other_item,
    'reversesActionId',trace_cmd->>'actionId','predictionId',gen_random_uuid(),'discoveryMode','RISK'));
  if result->>'predictionId' is distinct from ranked.prediction_id::text or result->>'discoveryMode'<>'FOR_YOU' then
    raise exception 'Collection undo borrowed the current view origin';
  end if;
  result := public.commit_collection_action_v1(trace_cmd || jsonb_build_object('actionId',gen_random_uuid(),
    'predictionId',gen_random_uuid(),'occurredAt',clock_timestamp()));
  if result->>'predictionId' is not null then raise exception 'Fabricated collection trace accepted'; end if;

  shared_base := base || jsonb_build_object('actionId',gen_random_uuid(),'profileId',shared,'name','Shared List',
    'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  result := public.commit_collection_action_v1(shared_base);
  shared_list := (result->>'listId')::uuid;
  begin
    perform public.commit_collection_action_v1(shared_base || jsonb_build_object('actionId',gen_random_uuid(),'kind','SET_LIST_ENTRY',
      'itemId',item,'listId',personal_list,'present',true,'positive',false));
    raise exception 'List from another Profile was accepted';
  exception when insufficient_privilege then null; end;
  pending_cmd := shared_base || jsonb_build_object('actionId',gen_random_uuid(),'kind','ENDORSE_SHARED_ITEM','itemId',item,
    'listId',shared_list,'source','SHARED_DISCOVERY');
  result := public.commit_collection_action_v1(pending_cmd);
  if result->'result'->0->>'consensus_saved'<>'false' or jsonb_array_length(result->'eventIds')<>1 then raise exception 'First endorsement prematurely saved'; end if;
  consensus_cmd := pending_cmd || jsonb_build_object('actionId',failed_id,'actorUserId',partner,'listId',null,
    'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  perform set_config('role','postgres',true);
  select count(*) into count_before from public.events where profile_id=shared;
  perform set_config('kajo.reject_collection_action',failed_id::text,true);
  perform set_config('kajo.reject_collection_type','ITEM_SAVED',true);
  perform set_config('request.jwt.claim.sub',partner::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_collection_action_v1(consensus_cmd);
    raise exception 'Expected collection failure did not occur';
  exception when raise_exception then
    if sqlerrm<>'Forced collection Event failure' then raise; end if;
  end;
  perform set_config('role','postgres',true);
  if exists(select 1 from private.item_action_receipts where id=failed_id)
    or exists(select 1 from public.shared_item_endorsements where profile_id=shared and actor_user_id=partner)
    or exists(select 1 from public.item_interactions where profile_id=shared and item_id=item and saved)
    or exists(select 1 from public.item_list_entries e where e.list_id=shared_list and e.item_id=item)
    or exists(select 1 from public.event_sessions where id=(consensus_cmd->'session'->>'sessionId')::uuid)
    or (select count(*) from public.events where profile_id=shared)<>count_before then
    raise exception 'Late Event failure left partial consensus/session/receipt/evidence';
  end if;
  perform set_config('kajo.reject_collection_action','',true);
  perform set_config('role','authenticated',true);
  previous := public.commit_collection_action_v1(consensus_cmd);
  if previous->'result'->0->>'consensus_reached'<>'true' or jsonb_array_length(previous->'eventIds')<>3
    or public.commit_collection_action_v1(consensus_cmd) is distinct from previous then raise exception 'Consensus transition/retry failed'; end if;
  begin
    perform public.commit_collection_action_v1(consensus_cmd || jsonb_build_object('actionId',gen_random_uuid(),'kind','REVERSE_ENDORSEMENT'));
    raise exception 'Completed consensus was reversed';
  exception when sqlstate 'KJ002' then null; end;
  perform set_config('role','postgres',true);
  if (select count(*) from public.events where profile_id=shared and item_id=item and event_type='ITEM_SAVED')<>1 then
    raise exception 'Consensus emitted duplicate Saved evidence';
  end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_collection_action_v1(consensus_cmd || jsonb_build_object('actorUserId',outsider));
    raise exception 'Outsider received cached consensus';
  exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
  delete from public.profile_members where profile_id=shared and user_id=partner;
  perform set_config('request.jwt.claim.sub',partner::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_collection_action_v1(consensus_cmd);
    raise exception 'Revoked member received cached receipt';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  delete_cmd := shared_base || jsonb_build_object('actionId',gen_random_uuid(),'kind','DELETE_LIST','listId',shared_list);
  result := public.commit_collection_action_v1(delete_cmd);
  if result->'result'<>'true'::jsonb or public.commit_collection_action_v1(delete_cmd) is distinct from result then raise exception 'Deleted List replay failed'; end if;
  perform set_config('role','postgres',true);
  if not exists(select 1 from public.item_interactions where profile_id=shared and item_id=item and saved)
    or not exists(select 1 from public.shared_item_consensus where profile_id=shared and item_id=item) then
    raise exception 'List deletion erased durable consensus';
  end if;
  -- Pending proposal cancellation is a correction by the deleting member.
  insert into public.profile_members(profile_id,user_id) values(shared,partner);
  perform set_config('role','authenticated',true);
  result := public.commit_collection_action_v1(shared_base || jsonb_build_object('actionId',gen_random_uuid(),'name','Pending delete'));
  second_list := (result->>'listId')::uuid;
  pending_cmd := pending_cmd || jsonb_build_object('actionId',gen_random_uuid(),'itemId',other_item,'listId',second_list);
  perform public.commit_collection_action_v1(pending_cmd);
  cmd := pending_cmd || jsonb_build_object('actionId',gen_random_uuid(),'kind','REVERSE_ENDORSEMENT');
  result := public.commit_collection_action_v1(cmd);
  if result->'result'->0->>'endorsement_reversed'<>'true' or public.commit_collection_action_v1(cmd) is distinct from result then
    raise exception 'Pending reverse/retry failed';
  end if;
  result := public.commit_collection_action_v1(cmd || jsonb_build_object('actionId',gen_random_uuid()));
  if result->'eventIds'<>'[]'::jsonb then raise exception 'Repeated reversal invented evidence'; end if;
  perform set_config('role','postgres',true);
  if exists(select 1 from public.shared_item_list_proposals where profile_id=shared and item_id=other_item) then
    raise exception 'Empty pending proposal survived reversal';
  end if;
  perform set_config('role','authenticated',true);
  perform public.commit_collection_action_v1(pending_cmd || jsonb_build_object('actionId',gen_random_uuid()));
  perform set_config('request.jwt.claim.sub',partner::text,true);
  delete_cmd := consensus_cmd || jsonb_build_object('actionId',gen_random_uuid(),'kind','DELETE_LIST','itemId',null,'listId',second_list);
  result := public.commit_collection_action_v1(delete_cmd);
  if jsonb_array_length(result->'eventIds')<>3 then raise exception 'Pending List deletion lost cancellation evidence'; end if;
  perform set_config('role','postgres',true);
  if exists(select 1 from public.shared_item_endorsements where profile_id=shared and item_id=other_item)
    or not exists(select 1 from public.events where id=(result->'eventIds'->>1)::uuid and actor_user_id=partner
      and properties->>'endorsementActorUserId'=actor::text and properties->>'reason'='LIST_DELETED' and prediction_id is null) then
    raise exception 'Pending cancellation kept state or forged member preference/trace';
  end if;
  if exists(select 1 from public.events e where e.profile_id=shared and e.item_id=other_item and e.event_type='ITEM_ENDORSED'
    and not exists(select 1 from public.events u where u.profile_id=shared and u.event_type='ITEM_INTERACTION_UNDONE'
      and u.properties->>'reversedEventId'=e.id::text)) then
    raise exception 'Withdrawal/List deletion left Endorsement outcome reward active';
  end if;
  if has_function_privilege('anon','public.commit_collection_action_v1(jsonb)','execute')
    or has_function_privilege('service_role','private.commit_collection_action_v1(jsonb)','execute')
    or has_table_privilege('authenticated','private.item_action_receipts','select') then
    raise exception 'Collection command ACL leak';
  end if;
end;
$collections$;
select jsonb_build_object('collectionActions','PASS: atomic List lifecycle/membership, mixed ordered undo, idempotency, late consensus rollback, authorization and durable consensus') as snapshot;
rollback;
