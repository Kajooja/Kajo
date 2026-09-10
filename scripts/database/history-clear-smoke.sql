-- Rollback-only public command acceptance, including actual Memory cancellation.
begin;
create function pg_temp.reject_history_correction() returns trigger language plpgsql as $$
begin
  if new.event_type='ITEM_INTERACTION_UNDONE' and new.properties->>'actionId'=current_setting('kajo.reject_history_action',true) then
    raise exception 'Forced history correction failure';
  end if;
  return new;
end;
$$;
create trigger reject_history_correction before insert on public.events
for each row execute function pg_temp.reject_history_correction();
do $history$
declare
  actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); profile uuid; other_profile uuid;
  item uuid:=gen_random_uuid(); job uuid:=gen_random_uuid(); saved_list uuid;
  base jsonb; rating_cmd jsonb; clear_cmd jsonb; receipt jsonb; result jsonb; before_count bigint;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','History '||left(id::text,12))
    from unnest(array[actor,outsider]) fixture(id);
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  select id into strict other_profile from public.profiles where owner_user_id=outsider and profile_type='PERSONAL';
  insert into public.items(id,item_type,title,discoverable,tags) values(item,'BOOK','History fixture',true,array['history-fixture']);
  base:=jsonb_build_object('version',1,'actorUserId',actor,'profileId',profile,'itemId',item,
    'occurredAt',now(),'source','LIST_DETAIL','predictionId',null,'discoveryMode',null,
    'session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',now(),'context','{}'::jsonb));
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  rating_cmd:=base||jsonb_build_object('actionId',gen_random_uuid(),'kind','SET_RATING','rating',8);
  perform public.commit_item_action_v1(rating_cmd);
  rating_cmd:=rating_cmd||jsonb_build_object('actionId',gen_random_uuid(),'rating',9);
  perform public.commit_item_action_v1(rating_cmd);
  perform set_config('role','postgres',true);
  if private.build_profile_memory_state_v1(profile,now())->>'nativeEvidenceCount'<>'2' then
    raise exception 'Fixture did not create two real rating evidence Events'; end if;
  perform set_config('role','authenticated',true);
  clear_cmd:=base||jsonb_build_object('actionId',gen_random_uuid(),'kind','CLEAR_HISTORY');
  perform set_config('kajo.reject_history_action',clear_cmd->>'actionId',true);
  begin
    perform public.commit_collection_action_v1(clear_cmd);
    raise exception 'History failure injection did not fire';
  exception when raise_exception then
    if sqlerrm<>'Forced history correction failure' then raise; end if;
  end;
  perform set_config('role','postgres',true);
  if (select rating from public.item_interactions where profile_id=profile and item_id=item)<>9
    or exists(select 1 from private.item_action_receipts where id=(clear_cmd->>'actionId')::uuid)
    or exists(select 1 from public.events where event_type='ITEM_HISTORY_CLEARED' and profile_id=profile) then
    raise exception 'Failed correction left partial state/receipt/evidence'; end if;
  perform set_config('kajo.reject_history_action','',true);
  perform set_config('role','authenticated',true);
  receipt:=public.commit_collection_action_v1(clear_cmd);
  if receipt->>'changed'<>'true' or receipt->>'undoable'<>'false' or receipt->'result'<>'true'::jsonb
    or receipt->'interaction'->'rating'<>'null'::jsonb or receipt->'interaction'->>'consumed'<>'false'
    or jsonb_array_length(receipt->'eventIds')<>3 then raise exception 'History receipt/state incorrect: %',receipt; end if;
  if public.commit_collection_action_v1(clear_cmd) is distinct from receipt then raise exception 'Retry changed receipt'; end if;
  begin
    perform public.commit_collection_action_v1(clear_cmd||'{"source":"LISTS"}');
    raise exception 'Changed payload reused history action ID';
  exception when data_exception then null; end;
  begin
    perform public.commit_item_action_v1(rating_cmd||jsonb_build_object('actionId',gen_random_uuid(),'kind','UNDO','reversesActionId',rating_cmd->>'actionId'));
    raise exception 'Old undo resurrected cleared history';
  exception when sqlstate 'KJ001' then null; end;
  result:=public.commit_collection_action_v1(clear_cmd||jsonb_build_object('actionId',gen_random_uuid()));
  if result->>'changed'<>'false' or result->'eventIds'<>'[]'::jsonb then raise exception 'No-op fabricated correction'; end if;
  perform set_config('role','postgres',true);
  if private.build_profile_memory_state_v1(profile,now())->>'evidenceCount'<>'0' then raise exception 'Cleared ratings still affect Memory'; end if;
  if exists(select 1 from public.events where profile_id=profile and event_type in ('ITEM_HISTORY_CLEARED','ITEM_INTERACTION_UNDONE')
    and (prediction_id is not null or discovery_mode is not null)) then raise exception 'Correction borrowed trace'; end if;
  if private.resurfacing_policy_decision_v1(profile,item,receipt->'interaction',now())->>'eligible'<>'true' then
    raise exception 'Cleared history not eligible'; end if;
  -- Saved/import evidence survives, rated/consumed import evidence does not.
  insert into private.profile_import_jobs(id,actor_user_id,profile_id,source_provider,dataset_kind,file_fingerprint)
    values(job,actor,profile,'KAJO_CSV','HISTORY','history-fixture-123456');
  insert into private.profile_bootstrap_evidence(actor_user_id,profile_id,item_id,item_type,source_provider,dataset_kind,
    source_job_id,source_row_key,evidence_kind,rating)
    select actor,profile,item,'BOOK','KAJO_CSV',kind,job,kind,kind,case when kind='RATED' then 7 else null end
    from unnest(array['RATED','CONSUMED','SAVED']) fixture(kind);
  insert into public.item_interactions(profile_id,item_id,actor_user_id,rating,consumed)
    values(other_profile,item,outsider,6,true);
  perform set_config('role','authenticated',true);
  result:=public.commit_collection_action_v1(base||jsonb_build_object('actionId',gen_random_uuid(),'kind','CREATE_LIST','itemId',null,'name','Preserved'));
  saved_list:=(result->>'listId')::uuid;
  perform public.commit_collection_action_v1(base||jsonb_build_object('actionId',gen_random_uuid(),'kind','SET_LIST_ENTRY',
    'listId',saved_list,'present',true,'positive',false));
  result:=public.commit_collection_action_v1(clear_cmd||jsonb_build_object('actionId',gen_random_uuid()));
  if result->>'changed'<>'true' then raise exception 'Imported-only history did not clear'; end if;
  perform set_config('role','postgres',true);
  if (select count(*) from private.profile_bootstrap_evidence where profile_id=profile and active)<>1
    or not exists(select 1 from private.profile_bootstrap_evidence where profile_id=profile and active and evidence_kind='SAVED')
    or not exists(select 1 from public.item_list_entries where list_id=saved_list and item_id=item)
    or not exists(select 1 from public.item_interactions where profile_id=other_profile and item_id=item and rating=6 and consumed)
    then raise exception 'History clear changed unrelated state'; end if;
  if private.resurfacing_policy_decision_v1(profile,item,result->'interaction',now())->>'eligible'<>'false' then
    raise exception 'History clear bypassed Saved suppression'; end if;
  -- Native Saved/interest/rejection are independently owned flags.
  update public.item_interactions set saved=true,interest='LIKED',not_interested=false,consumed=true,rating=5
    where profile_id=profile and item_id=item;
  perform set_config('role','authenticated',true);
  result:=public.commit_collection_action_v1(clear_cmd||jsonb_build_object('actionId',gen_random_uuid()));
  if result->'interaction'->>'saved'<>'true' or result->'interaction'->>'interest'<>'LIKED'
    or result->'interaction'->>'notInterested'<>'false' then raise exception 'Clear changed independent flags'; end if;
  perform set_config('role','postgres',true);
  update public.item_interactions set not_interested=true where profile_id=profile and item_id=item;
  perform set_config('role','authenticated',true);
  result:=public.commit_collection_action_v1(clear_cmd||jsonb_build_object('actionId',gen_random_uuid()));
  if result->'interaction'->>'notInterested'<>'true' then raise exception 'Clear removed rejection'; end if;
  perform public.commit_item_action_v1(rating_cmd||jsonb_build_object('actionId',gen_random_uuid(),'rating',10));
  if public.commit_collection_action_v1(clear_cmd) is distinct from receipt then raise exception 'Retry after rerating changed receipt'; end if;
  perform set_config('role','postgres',true);
  if (select rating from public.item_interactions where profile_id=profile and item_id=item)<>10 then
    raise exception 'Old retry erased later rating'; end if;
  select count(*) into before_count from public.events;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.commit_collection_action_v1(clear_cmd||jsonb_build_object('actionId',gen_random_uuid(),'actorUserId',outsider));
    raise exception 'Nonmember cleared another Profile';
  exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
  if (select count(*) from public.events)<>before_count then raise exception 'Rejected clear wrote evidence'; end if;
end;
$history$;
select jsonb_build_object('historyClear','PASS: atomic correction, Memory cancellation, import/state preservation, retry and authorization') as snapshot;
rollback;
