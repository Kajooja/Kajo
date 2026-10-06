do $boundaries$
declare
  actor uuid := 'a22c0000-0000-4000-8000-000000000001'; profile uuid; shared uuid;
  request jsonb; root jsonb; response jsonb; next_request jsonb; change jsonb;
  old_request jsonb; old_response jsonb; shared_request jsonb; shared_response jsonb;
  chain_uuid uuid; rejected_item uuid; unavailable_item uuid; seen_before uuid[];
  runs_before integer; receipts_before integer; pages_before integer; cursors_before integer;
  step integer; limit_request jsonb; limit_response jsonb; delivered uuid[]; seen uuid[];
begin
  select profile_id into strict profile from pg_temp.pool_profiles where profile_type='PERSONAL';
  select profile_id into strict shared from pg_temp.pool_profiles where profile_type='SHARED';
  request := jsonb_build_object('version',3,'requestId',gen_random_uuid(),'profileId',profile,
    'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',20,'context','{}'::jsonb);
  old_request := request||jsonb_build_object('version',2,'requestId',gen_random_uuid());
  perform set_config('role','authenticated',true);
  old_response := public.rank_items_page_v1(old_request);
  root := public.rank_items_page_v1(request);
  perform set_config('role','postgres',true);
  chain_uuid := (root#>>'{source,chainId}')::uuid;
  select seen_item_ids into strict seen_before from private.prediction_catalog_chains where id=chain_uuid;
  -- Current suppression and catalog withdrawal must apply before next admission,
  -- including Items outside the first page's 50-candidate source.
  select item_id into strict rejected_item from pg_temp.pool_items i where i.item_type='BOOK' and i.kind='ORDINARY'
    and not i.item_id=any(seen_before) order by item_id limit 1;
  select item_id into strict unavailable_item from pg_temp.pool_items i where i.item_type='BOOK' and i.kind='ORDINARY'
    and not i.item_id=any(seen_before) and item_id<>rejected_item order by item_id limit 1;
  insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,rating)
    values(profile,rejected_item,actor,true,0);
  update public.items set discoverable=false where id=unavailable_item;
  next_request := request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',root->'nextCursor');
  for change in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('profileId',shared),jsonb_build_object('sessionId',gen_random_uuid()),
    '{"discoveryMode":"RISK"}'::jsonb,'{"itemType":"MOVIE"}'::jsonb,'{"limit":10}'::jsonb,
    '{"context":{"x":1}}'::jsonb,'{"context":{"sessionId":"forged"}}'::jsonb,
    '{"cursor":"bad"}'::jsonb,'{"cursor":[]}'::jsonb,jsonb_build_object('cursor',gen_random_uuid()),
    '{"seenItemIds":[]}'::jsonb,'{"chainId":"forged"}'::jsonb,'{"extra":1}'::jsonb,
    '{"version":"3"}'::jsonb,'{"version":4}'::jsonb,'{"limit":0}'::jsonb,'{"limit":51}'::jsonb,
    '{"limit":1.5}'::jsonb,'{"context":null}'::jsonb)) loop
    perform set_config('role','authenticated',true);
    begin perform public.rank_items_page_v1(next_request||change); raise exception 'Accepted wrong catalog-chain scope: %',change;
    exception when invalid_parameter_value then null; end;
    perform set_config('role','postgres',true);
  end loop;
  shared_request := request||jsonb_build_object('profileId',shared,'requestId',gen_random_uuid());
  perform set_config('role','authenticated',true);
  shared_response := public.rank_items_page_v1(shared_request);
  perform set_config('request.jwt.claim.sub','a22c0000-0000-4000-8000-000000000002',true);
  begin perform public.rank_items_page_v1(shared_request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',shared_response->'nextCursor'));
    raise exception 'Another Shared member consumed the actor-owned chain'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.rank_items_page_v1(next_request); raise exception 'Missing actor read catalog chain'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','postgres',true);
  -- Mutable cache bookkeeping is proved against the previous immutable page.
  -- Tampering cannot silently refill the same seen Items or reset reminders.
  begin
    update private.prediction_catalog_chains set seen_item_ids='{}'::uuid[] where id=chain_uuid;
    perform public.rank_items_page_v1(next_request);
    raise exception 'Corrupt chain prefix accepted'; exception when invalid_parameter_value then null;
  end;
  begin
    update private.prediction_catalog_chains set reminder_delivered=not reminder_delivered where id=chain_uuid;
    perform public.rank_items_page_v1(next_request);
    raise exception 'Corrupt chain reminder budget accepted'; exception when invalid_parameter_value then null;
  end;
  begin
    update private.prediction_catalog_chain_pages set seen_before='{}'::uuid[] where prediction_id=(root->>'predictionId')::uuid;
    raise exception 'Immutable chain page updated'; exception when object_not_in_prerequisite_state then null;
  end;
  select count(*) into runs_before from private.prediction_runs;
  select count(*) into receipts_before from private.prediction_page_receipts;
  select count(*) into pages_before from private.prediction_catalog_chain_pages;
  select count(*) into cursors_before from private.prediction_catalog_chain_cursors;
  alter table private.prediction_page_receipts add constraint catalog_chain_fail check(false) not valid;
  perform set_config('role','authenticated',true);
  begin perform public.rank_items_page_v1(next_request); raise exception 'Injected chain receipt failure ignored';
  exception when check_violation then null; end;
  perform set_config('role','postgres',true);
  alter table private.prediction_page_receipts drop constraint catalog_chain_fail;
  if (select count(*) from private.prediction_runs)<>runs_before
    or (select count(*) from private.prediction_page_receipts)<>receipts_before
    or (select count(*) from private.prediction_catalog_chain_pages)<>pages_before
    or (select count(*) from private.prediction_catalog_chain_cursors)<>cursors_before
    or (select seen_item_ids from private.prediction_catalog_chains where id=chain_uuid)<>seen_before
    or exists(select 1 from private.prediction_catalog_chain_cursors c where c.token=(root->>'nextCursor')::uuid and c.used_request_id is not null) then
    raise exception 'Failed catalog-chain page leaked partial source, receipt or prefix state'; end if;
  perform set_config('role','authenticated',true);
  response := public.rank_items_page_v1(next_request);
  if jsonb_array_length(response->'items')<>20 or exists(select 1 from jsonb_array_elements(response->'items') item
    where (item->>'item_id')::uuid in (rejected_item,unavailable_item)) then raise exception 'Refilled chain ignored current eligibility'; end if;
  begin perform public.rank_items_page_v1(next_request||jsonb_build_object('requestId',gen_random_uuid()));
    raise exception 'Consumed chain cursor accepted another request'; exception when invalid_parameter_value then null; end;
  if public.rank_items_page_v1(next_request)<>response or public.rank_items_page_v1(old_request)<>old_response then
    raise exception 'Chain retry or old v2 receipt changed'; end if;
  perform set_config('role','postgres',true);
  update private.prediction_catalog_chains set created_at=now()-interval '16 minutes',expires_at=now()-interval '1 minute'
    where id=chain_uuid;
  perform set_config('role','authenticated',true);
  if public.rank_items_page_v1(next_request)<>response then raise exception 'Expired chain erased durable receipt'; end if;
  begin perform public.rank_items_page_v1(request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',response->'nextCursor'));
    raise exception 'Expired chain continued'; exception when invalid_parameter_value then null; end;
  perform set_config('role','postgres',true);
  delete from private.prediction_catalog_chains where id=chain_uuid;
  if not exists(select 1 from private.prediction_catalog_chain_pages where prediction_id=(response->>'predictionId')::uuid)
    or not exists(select 1 from private.prediction_page_receipts where request_id=(next_request->>'requestId')::uuid) then
    raise exception 'Cache reclamation removed durable chain evidence'; end if;
  perform set_config('role','authenticated',true);
  if public.rank_items_page_v1(next_request)<>response then raise exception 'Reclaimed chain erased receipt'; end if;
  perform set_config('role','postgres',true);
  -- Exceed the explicit reader budget. 1000 delivered Items is a reader cap,
  -- even though the server can prove more discoverable eligible Items remain.
  insert into public.items(id,item_type,title,tags,discoverable)
    select md5('catalog-reader-limit:'||n)::uuid,'BOOK','Limit Item '||n,array['unseen'],true from generate_series(1,900) n;
  limit_request := request||jsonb_build_object('requestId',gen_random_uuid(),'sessionId',gen_random_uuid(),'limit',50);
  seen := '{}'; step := 0;
  loop
    perform set_config('role','authenticated',true);
    limit_response := public.rank_items_page_v1(limit_request);
    perform set_config('role','postgres',true);
    step := step+1;
    select coalesce(array_agg((item->>'item_id')::uuid),'{}'::uuid[]) into delivered from jsonb_array_elements(limit_response->'items') item;
    if step>20 or cardinality(delivered)<>50 or seen&&delivered then raise exception 'Reader cap lost bounded unique append'; end if;
    seen := seen||delivered;
    exit when limit_response->'nextCursor'='null'::jsonb;
    limit_request := limit_request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',limit_response->'nextCursor');
  end loop;
  if cardinality(seen)<>1000 or step<>20 or limit_response#>>'{source,continuationState}'<>'READER_LIMIT'
    or limit_response->>'availability'<>'ITEMS' or limit_response#>'{source,catalogEmpty}'<>'false'::jsonb then
    raise exception 'Reader cap masqueraded as complete catalog exhaustion'; end if;
  -- Discoverable but universally suppressed is not an empty catalog.
  insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,rating)
    select profile,id,actor,true,0 from public.items
    on conflict(profile_id,item_id) do update set consumed=true,rating=0;
  perform set_config('role','authenticated',true);
  response := public.rank_items_page_v1(request||jsonb_build_object('requestId',gen_random_uuid()));
  if response->'items'<>'[]'::jsonb or response->>'availability'<>'CATALOG_EXHAUSTED'
    or response#>>'{source,continuationState}'<>'CATALOG_EXHAUSTED'
    or response#>'{source,catalogEmpty}'<>'false'::jsonb or response->'nextCursor'<>'null'::jsonb then
    raise exception 'Suppression exhaustion claimed an empty catalog'; end if;
  perform set_config('role','postgres',true);
  update public.items set discoverable=false;
  perform set_config('role','authenticated',true);
  response := public.rank_items_page_v1(shared_request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',shared_response->'nextCursor'));
  if response->'items'<>'[]'::jsonb or response->>'availability'<>'CATALOG_EXHAUSTED'
    or response#>>'{source,continuationState}'<>'CATALOG_EXHAUSTED'
    or response#>'{source,catalogEmpty}'<>'false'::jsonb or response->'nextCursor'<>'null'::jsonb then
    raise exception 'Catalog withdrawal misclassified a populated chain as initially empty'; end if;
  response := public.rank_items_page_v1(request||jsonb_build_object('requestId',gen_random_uuid()));
  if response->'items'<>'[]'::jsonb or response->>'availability'<>'CATALOG_EMPTY'
    or response#>>'{source,candidateCount}'<>'0' or response#>'{source,catalogEmpty}'<>'true'::jsonb
    or response->'nextCursor'<>'null'::jsonb then raise exception 'Proven catalog-empty page lost explicit identity'; end if;
  perform set_config('request.jwt.claim.sub','a22c0000-0000-4000-8000-000000000003',true);
  begin perform public.rank_items_page_v1(next_request); raise exception 'Outsider read cached chain receipt'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','postgres',true);
  delete from public.profile_members where profile_id=shared and user_id=actor;
  perform set_config('role','authenticated',true);
  begin perform public.rank_items_page_v1(shared_request); raise exception 'Revoked member read cached chain'; exception when insufficient_privilege then null; end;
  perform set_config('role','postgres',true);
  if has_table_privilege('authenticated','private.prediction_catalog_chains','select')
    or has_table_privilege('authenticated','private.prediction_catalog_chain_pages','select')
    or has_table_privilege('authenticated','private.prediction_catalog_chain_cursors','select')
    or has_function_privilege('authenticated','private.rank_items_catalog_chain_v1(jsonb)','execute')
    or has_function_privilege('authenticated','private.rank_items_frozen_page_v2(jsonb)','execute')
    or has_function_privilege('anon','public.rank_items_page_v1(jsonb)','execute') then raise exception 'Catalog-chain privileges escaped'; end if;
end;
$boundaries$;
select jsonb_build_object('catalogChain','PASS: current suppression, exact scope/actor/membership, immutable prefix proof, atomic failure, once-only consumption, expiry/reclamation, distinct catalog exhaustion and 1000-Item reader limit') snapshot;
