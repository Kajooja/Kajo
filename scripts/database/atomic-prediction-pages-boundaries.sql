do $boundaries$
declare
  actor uuid := 'a22a0000-0000-4000-8000-000000000001'; profile uuid; other_profile uuid;
  request jsonb; root jsonb; response jsonb; next_request jsonb; change jsonb; retry jsonb;
  window_id uuid; source_snapshot jsonb; rejected_item uuid; unavailable_item uuid;
  runs_before integer; receipts_before integer; seen_before uuid[]; old_request jsonb; old_response jsonb;
  shared_request jsonb; shared_response jsonb;
begin
  select profile_id into strict profile from pg_temp.pool_profiles where profile_type='PERSONAL';
  select profile_id into strict other_profile from pg_temp.pool_profiles where profile_type='SHARED';
  request := jsonb_build_object('version',2,'requestId',gen_random_uuid(),'profileId',profile,
    'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',20,'context','{}'::jsonb);
  old_request := request||jsonb_build_object('version',1,'requestId',gen_random_uuid());
  perform set_config('role','authenticated',true);
  old_response := public.rank_items_page_v1(old_request);
  root := public.rank_items_page_v1(request);
  perform set_config('role','postgres',true);
  select w.id,w.source_snapshot,w.seen_item_ids into strict window_id,source_snapshot,seen_before
    from private.prediction_continuation_windows w where w.request_id=(request->>'requestId')::uuid;
  select c.item_id into rejected_item from private.prediction_candidates c join pg_temp.pool_items i on i.item_id=c.item_id
    where c.prediction_id=(root->>'predictionId')::uuid and not c.selected_for_delivery and i.kind='ORDINARY' order by c.final_rank limit 1;
  select c.item_id into unavailable_item from private.prediction_candidates c join pg_temp.pool_items i on i.item_id=c.item_id
    where c.prediction_id=(root->>'predictionId')::uuid and not c.selected_for_delivery and i.kind='ORDINARY'
      and c.item_id<>rejected_item order by c.final_rank limit 1;
  insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,rating)
    values(profile,rejected_item,actor,true,0);
  update public.items set discoverable=false where id=unavailable_item;
  next_request := request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',root->'nextCursor');
  for change in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('profileId',other_profile),jsonb_build_object('sessionId',gen_random_uuid()),
    '{"discoveryMode":"RISK"}'::jsonb,'{"itemType":"MOVIE"}'::jsonb,'{"limit":10}'::jsonb,
    '{"context":{"x":1}}'::jsonb,'{"cursor":"bad"}'::jsonb,'{"cursor":[]}'::jsonb,
    jsonb_build_object('cursor',gen_random_uuid()),'{"extra":1}'::jsonb)) loop
    perform set_config('role','authenticated',true);
    begin perform public.rank_items_page_v1(next_request||change); raise exception 'Accepted wrong continuation scope';
    exception when invalid_parameter_value then null; end;
    perform set_config('role','postgres',true);
  end loop;
  -- A different accepted member is still not the actor who owns this cursor.
  shared_request := request||jsonb_build_object('profileId',other_profile,'requestId',gen_random_uuid());
  perform set_config('role','authenticated',true);
  shared_response := public.rank_items_page_v1(shared_request);
  perform set_config('request.jwt.claim.sub','a22a0000-0000-4000-8000-000000000002',true);
  begin perform public.rank_items_page_v1(shared_request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',shared_response->'nextCursor'));
    raise exception 'Shared member reused another actor cursor'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.rank_items_page_v1(next_request); raise exception 'Missing actor read page'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','postgres',true);
  begin
    update private.prediction_candidates set final_score=final_score+1 where prediction_id=(root->>'predictionId')::uuid;
    perform public.rank_items_page_v1(next_request);
    raise exception 'Changed source accepted';
  exception when invalid_parameter_value then null; end;
  select count(*) into runs_before from private.prediction_runs;
  select count(*) into receipts_before from private.prediction_page_receipts;
  alter table private.prediction_page_receipts add constraint atomic_page_fail check(false) not valid;
  perform set_config('role','authenticated',true);
  begin perform public.rank_items_page_v1(next_request); raise exception 'Injected receipt failure ignored';
  exception when check_violation then null; end;
  perform set_config('role','postgres',true);
  alter table private.prediction_page_receipts drop constraint atomic_page_fail;
  if (select count(*) from private.prediction_runs)<>runs_before or (select count(*) from private.prediction_page_receipts)<>receipts_before
    or (select w.seen_item_ids from private.prediction_continuation_windows w where w.id=window_id)<>seen_before
    or exists(select 1 from private.prediction_page_cursors c where c.token=(root->>'nextCursor')::uuid and c.used_request_id is not null)
    or exists(select 1 from private.prediction_page_contexts) then raise exception 'Failed page leaked partial state'; end if;
  perform set_config('role','authenticated',true);
  response := public.rank_items_page_v1(next_request);
  if jsonb_array_length(response->'items')<>3 or exists(select 1 from jsonb_array_elements(response->'items') r
    where (r->>'item_id')::uuid in (rejected_item,unavailable_item)) then raise exception 'Page ignored current rating-zero/catalog eligibility'; end if;
  begin perform public.rank_items_page_v1(next_request||jsonb_build_object('requestId',gen_random_uuid()));
    raise exception 'Cursor reused with another request'; exception when invalid_parameter_value then null; end;
  if public.rank_items_page_v1(next_request)<>response or public.rank_items_page_v1(old_request)<>old_response
    or old_response->'continuationSupported'<>'false'::jsonb then raise exception 'Retry or v1 contract changed'; end if;
  perform set_config('role','postgres',true);
  if private.prediction_window_source_v1((root->>'predictionId')::uuid)<>source_snapshot then raise exception 'First-page trace changed'; end if;
  -- A committed response survives cache expiry and reclamation; unused cursors do not.
  update private.prediction_continuation_windows w set created_at=now()-interval '16 minutes',expires_at=now()-interval '1 minute'
    where w.id=window_id;
  perform set_config('role','authenticated',true);
  if public.rank_items_page_v1(next_request)<>response then raise exception 'Expired cache erased durable receipt'; end if;
  begin perform public.rank_items_page_v1(request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',response->'nextCursor'));
    raise exception 'Expired cursor delivered a page'; exception when invalid_parameter_value then null; end;
  perform set_config('role','postgres',true);
  delete from private.prediction_continuation_windows w where w.id=window_id;
  if not exists(select 1 from private.prediction_page_contexts p where p.prediction_id=(response->>'predictionId')::uuid)
    or not exists(select 1 from private.prediction_page_receipts r where r.request_id=(next_request->>'requestId')::uuid) then
    raise exception 'Cache reclamation removed page evidence'; end if;
  perform set_config('role','authenticated',true);
  if public.rank_items_page_v1(next_request)<>response then raise exception 'Reclaimed cache erased receipt'; end if;
  perform set_config('role','postgres',true);
  update public.items set discoverable=false;
  perform set_config('role','authenticated',true);
  retry := public.rank_items_page_v1(request||jsonb_build_object('requestId',gen_random_uuid()));
  if retry->>'availability'<>'CATALOG_EMPTY' or retry#>>'{source,candidateCount}'<>'0'
    or retry->'nextCursor'<>'null'::jsonb or retry->'items'<>'[]'::jsonb then raise exception 'v2 empty catalog lost identity/availability'; end if;
  perform set_config('request.jwt.claim.sub','a22a0000-0000-4000-8000-000000000003',true);
  begin perform public.rank_items_page_v1(next_request); raise exception 'Outsider read page'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','postgres',true);
  delete from public.profile_members where profile_id=profile and user_id=actor;
  perform set_config('role','authenticated',true);
  begin perform public.rank_items_page_v1(next_request); raise exception 'Revoked member read page'; exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
  if has_table_privilege('authenticated','private.prediction_page_contexts','select')
    or has_table_privilege('authenticated','private.prediction_page_cursors','select')
    or has_function_privilege('authenticated','private.rank_items_first_page_v1(jsonb)','execute')
    or has_function_privilege('anon','public.rank_items_page_v1(jsonb)','execute') then raise exception 'Page privilege boundary escaped'; end if;
end;
$boundaries$;
select jsonb_build_object('atomicPages','PASS: current eligibility, exact scope, atomic failure, cursor consumption, expiry, v1 compatibility and authorization') as snapshot;
