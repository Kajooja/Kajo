-- Caller owns BEGIN/ROLLBACK and supplies an otherwise empty full schema.
-- Real synthetic Events appear only after a delivered Item is explicitly used.
do $catalog_chain_provenance$
declare
  actor uuid := 'a23e0000-0000-4000-8000-000000000001';
  profile uuid; request jsonb; response jsonb; target_request jsonb; target_response jsonb;
  first_id uuid; target_id uuid; target_item uuid; target_run private.prediction_runs%rowtype;
  first_snapshot jsonb; target_snapshot jsonb; seen uuid[] := '{}'; delivered uuid[];
  step integer := 0; action_id uuid := gen_random_uuid(); command jsonb; action_response jsonb;
  action_at timestamptz; impression_at timestamptz; session_started timestamptz;
  before_events integer; before_runs integer; worker jsonb; evaluation_id uuid := gen_random_uuid();
  projected record;
begin
  if exists(select 1 from auth.users) or exists(select 1 from public.items) then
    raise exception 'Catalog chain provenance fixture requires empty synthetic state';
  end if;
  insert into auth.users(id,email,raw_user_meta_data)
    values(actor,'catalog-chain-provenance@example.invalid','{"kajo_nickname":"Catalog chain origin"}');
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.items(id,item_type,title,tags,discoverable)
    select md5('catalog-chain-provenance:'||n)::uuid,'BOOK','Synthetic origin book '||n,array['synthetic-origin'],true
    from generate_series(1,130) n;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  request := jsonb_build_object('version',3,'requestId',gen_random_uuid(),'profileId',profile,
    'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',20,'context','{}'::jsonb);
  loop
    perform set_config('role','authenticated',true);
    response := public.rank_items_page_v1(request);
    perform set_config('role','postgres',true);
    step := step+1;
    if step>10 or response->'version'<>'3'::jsonb or response->>'availability'<>'ITEMS'
      or response#>>'{source,version}'<>'catalog-chain-v1'
      or response#>>'{source,sourcePredictionId}'<>response->>'predictionId'
      or (response#>>'{source,pageIndex}')::integer<>step then
      raise exception 'Later-page origin fixture lost its independent protocol-3 source';
    end if;
    select array_agg((row->>'item_id')::uuid order by (row->>'rank')::integer) into delivered
      from jsonb_array_elements(response->'items') row;
    if cardinality(delivered)<>20 or seen&&delivered then
      raise exception 'Catalog chain origin fixture repeated or prematurely exhausted eligible Items';
    end if;
    if step=1 then
      first_id := (response->>'predictionId')::uuid;
      first_snapshot := private.prediction_window_source_v1(first_id);
      session_started := (first_snapshot#>>'{run,requested_at}')::timestamptz-interval '1 second';
    end if;
    -- This delivered page starts after at least 70 prior Items, beyond the
    -- original 50-candidate source. Its own run must own the later outcome.
    if cardinality(seen)>=70 then target_request := request; target_response := response; exit; end if;
    seen := seen||delivered;
    if response->'nextCursor'='null'::jsonb then raise exception 'Catalog chain stopped at its old bounded source'; end if;
    request := request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',response->'nextCursor');
  end loop;
  target_id := (target_response->>'predictionId')::uuid;
  target_item := delivered[1];
  select * into strict target_run from private.prediction_runs where id=target_id;
  target_snapshot := private.prediction_window_source_v1(target_id);
  if target_id=first_id or not exists(select 1 from private.prediction_catalog_chain_pages p
      where p.prediction_id=target_id and p.root_prediction_id=first_id and p.page_index=step
        and p.seen_before=seen) then
    raise exception 'Later-page run lost its root and actually observed catalog prefix';
  end if;
  if exists(select 1 from private.prediction_candidates where prediction_id=first_id and item_id=target_item)
    or exists(select 1 from public.events where event_type='ITEM_IMPRESSION') then
    raise exception 'Continuation borrowed first-page candidates or fabricated impressions';
  end if;

  -- Simulate a lost action acknowledgement before the real queued impression
  -- arrives. Its occurrence still precedes the action; no exposure is invented.
  action_at := clock_timestamp();
  impression_at := target_run.requested_at+interval '1 microsecond';
  command := jsonb_build_object('version',1,'actionId',action_id,'actorUserId',actor,'profileId',profile,
    'itemId',target_item,'kind','SET_RATING','rating',0,'occurredAt',action_at,
    'predictionId',target_id,'discoveryMode',target_run.discovery_mode,
    'session',jsonb_build_object('sessionId',target_run.session_id,'startedAt',session_started,'context','{}'::jsonb));
  perform set_config('role','authenticated',true);
  action_response := public.commit_item_action_v1(command);
  perform set_config('role','postgres',true);
  if action_response->'predictionId'<>'null'::jsonb
    or action_response#>'{interaction,rating}'<>'0'::jsonb
    or not exists(select 1 from public.events where id=action_id and prediction_id is null
      and event_type='ITEM_RATED' and properties->>'rating'='0') then
    raise exception 'Unacknowledged exposure acquired invented attribution or lost rating zero';
  end if;
  if exists(select 1 from private.prediction_outcome_events_v1(profile,clock_timestamp(),clock_timestamp())
      where id=action_id) then raise exception 'Missing exposure became effective outcome evidence'; end if;
  select count(*) into before_events from public.events;
  perform set_config('role','authenticated',true);
  if public.commit_item_action_v1(command)<>action_response then raise exception 'Action retry changed immutable receipt'; end if;
  perform set_config('role','postgres',true);
  if (select count(*) from public.events)<>before_events then raise exception 'Lost acknowledgement replay duplicated rating'; end if;

  -- Duplicate delivery acknowledgements still represent one exposed Item.
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id)
    select gen_random_uuid(),actor,profile,target_item,'BOOK','ITEM_IMPRESSION',impression_at,target_run.session_id,target_id
    from generate_series(1,2);
  select * into strict projected from private.prediction_outcome_events_v1(profile,clock_timestamp(),clock_timestamp())
    where id=action_id;
  if projected.prediction_id<>target_id or projected.attribution_source<>'LATE_EXPOSURE_V1'
    or projected.properties->>'rating'<>'0' then
    raise exception 'Late impression borrowed a different page or lost the zero-rating outcome';
  end if;

  -- Future mutable state must not refit the later-page source or its baseline.
  update public.items set tags=array['after-delivery'],discoverable=false;
  update public.item_interactions set rating=10 where profile_id=profile and item_id=target_item;
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
    values(target_id,target_run.genome_id) on conflict do nothing;
  worker := private.process_shadow_prediction_jobs_v1(250);
  if worker->>'failed'<>'0' then raise exception 'Later-page frozen shadow failed'; end if;
  if not exists(select 1 from private.shadow_prediction_runs s where s.source_prediction_id=target_id
      and s.genome_id=target_run.genome_id and s.code_version='shadow-replay-v2'
      and s.as_of=target_run.requested_at and s.candidate_count=target_run.candidate_count)
    or exists(select 1 from private.shadow_prediction_runs s
      join private.shadow_prediction_candidates sc on sc.shadow_prediction_id=s.id
      join private.prediction_candidates pc on pc.prediction_id=target_id and pc.item_id=sc.item_id
      where s.source_prediction_id=target_id and s.genome_id=target_run.genome_id
        and (sc.shadow_score<>pc.final_score or sc.shadow_rank<>pc.final_rank
          or sc.hypothetical_selected<>pc.selected_for_delivery)) then
    raise exception 'Later-page baseline changed its frozen score, rank or delivered selection';
  end if;
  insert into private.evaluation_windows(id,window_key,prediction_from,prediction_until,input_cutoff,outcome_cutoff,created_by)
    values(evaluation_id,'catalog-chain-origin-'||evaluation_id,target_run.requested_at-interval '1 microsecond',
      target_run.requested_at+interval '1 microsecond',target_run.requested_at+interval '1 microsecond',
      clock_timestamp(),'CATALOG_CHAIN_PROVENANCE_FIXTURE');
  perform private.evaluate_shadow_genome_v1(evaluation_id,target_run.genome_id);
  if not exists(select 1 from private.genome_evaluations e where e.evaluation_window_id=evaluation_id
      and e.genome_id=target_run.genome_id and e.scope_type='GLOBAL' and e.outcome_count=1
      and e.exposed_count=1 and e.prediction_count=1 and e.production_metric<0 and e.raw_advantage=0) then
    raise exception 'Mature evaluation lost the later-page negative outcome or multiplied duplicate exposure';
  end if;
  if private.prediction_window_source_v1(first_id)<>first_snapshot
    or private.prediction_window_source_v1(target_id)<>target_snapshot then
    raise exception 'Later outcomes or mutable state rewrote an earlier prediction trace';
  end if;

  -- Derived reader cache is disposable. Historical retry receipts and evidence
  -- remain scoped and immutable after its chain/cursors are reclaimed.
  select count(*) into before_runs from private.prediction_runs;
  select count(*) into before_events from public.events;
  delete from private.prediction_catalog_chains where actor_user_id=actor;
  perform set_config('role','authenticated',true);
  if public.rank_items_page_v1(target_request)<>target_response
    or public.commit_item_action_v1(command)<>action_response then
    raise exception 'Derived cache cleanup erased or rewrote immutable page/action receipts';
  end if;
  perform set_config('role','postgres',true);
  if (select count(*) from private.prediction_runs)<>before_runs or (select count(*) from public.events)<>before_events
    or not exists(select 1 from private.prediction_catalog_chain_pages where prediction_id=target_id)
    or (select prediction_id from public.events where id=action_id) is not null then
    raise exception 'Retry recreated evidence or late attribution rewrote the raw unattributed Event';
  end if;
end;
$catalog_chain_provenance$;
select jsonb_build_object('catalogChainProvenance',
  'PASS: later-page rating zero, exact lost-ack retries, delayed exposure, frozen baseline/evaluation and cache-independent provenance') as snapshot;
