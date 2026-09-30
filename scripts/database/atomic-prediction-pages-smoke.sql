-- Frozen scores, independent page runs and exact replay in both domains,
-- all modes and Personal/Shared scopes. The caller owns its synthetic fixture.
do $pages$
declare
  profile record; domain text; mode text; request jsonb; response jsonb; first_response jsonb;
  root_id uuid; previous_id uuid; page_id uuid; snapshot jsonb; seen uuid[]; delivered uuid[];
  step integer; count_before integer; baseline uuid; worker jsonb;
  evaluated record; evaluation_id uuid := gen_random_uuid(); action_response jsonb;
begin
  for profile in select * from pg_temp.pool_profiles loop
    foreach domain in array array['BOOK','MOVIE'] loop
      foreach mode in array array['FOR_YOU','SURPRISE','RISK'] loop
        request := jsonb_build_object('version',2,'requestId',gen_random_uuid(),'profileId',profile.profile_id,
          'sessionId',gen_random_uuid(),'discoveryMode',mode,'itemType',domain,'limit',10,'context','{"surface":"DISCOVERY_GRID"}'::jsonb);
        perform set_config('role','authenticated',true);
        response := public.rank_items_page_v1(request);
        perform set_config('role','postgres',true);
        first_response := response; root_id := (response->>'predictionId')::uuid;
        snapshot := private.prediction_window_source_v1(root_id);
        seen := '{}'; step := 0; previous_id := null;
        loop
          step := step+1; page_id := (response->>'predictionId')::uuid;
          if step>5 or response->'version'<>'2'::jsonb or response->'continuationSupported'<>'true'::jsonb
            or response#>>'{source,sourcePredictionId}'<>root_id::text
            or (response#>>'{source,pageIndex}')::integer<>step then raise exception 'Invalid continuation envelope'; end if;
          select coalesce(array_agg((r->>'item_id')::uuid order by (r->>'rank')::integer),'{}'::uuid[])
            into delivered from jsonb_array_elements(response->'items') r;
          if seen&&delivered or cardinality(delivered)>10
            or exists(select 1 from jsonb_array_elements(response->'items') with ordinality a(r,n)
              where r->>'prediction_id'<>page_id::text or (r->>'rank')::integer<>n or r->>'item_type'<>domain) then
            raise exception 'Page repeated an Item or lost unique ordered origins';
          end if;
          if step>1 and not exists(select 1 from private.prediction_page_contexts p
            where p.prediction_id=page_id and p.parent_prediction_id=previous_id and p.source_prediction_id=root_id
              and p.seen_before=seen and p.page_index=step and p.feature_at=(snapshot#>>'{run,requested_at}')::timestamptz) then
            raise exception 'Page lost its exact predecessor or decision-time prefix';
          end if;
          if not exists(select 1 from private.prediction_runs r where r.id=page_id
            and r.profile_id=profile.profile_id and r.session_id=(request->>'sessionId')::uuid
            and r.result_count=cardinality(delivered) and r.genome_id=(snapshot#>>'{run,genome_id}')::uuid
            and r.state_snapshot=snapshot#>'{run,state_snapshot}') then raise exception 'Page lost frozen state/genome/scope'; end if;
          select count(*) into count_before from private.prediction_runs;
          perform set_config('role','authenticated',true);
          if public.rank_items_page_v1(request)<>response then raise exception 'Exact page retry changed receipt'; end if;
          perform set_config('role','postgres',true);
          if (select count(*) from private.prediction_runs)<>count_before then raise exception 'Retry wrote another run'; end if;
          if cardinality(delivered)=0 and (response->>'availability'<>'WINDOW_EXHAUSTED'
            or response#>'{source,catalogEmpty}'<>'false'::jsonb) then raise exception 'Bounded exhaustion claimed empty catalog'; end if;
          seen := seen||delivered;
          insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
            select page_id,r.genome_id from private.prediction_runs r where r.id=page_id on conflict do nothing;
          exit when response->'nextCursor'='null'::jsonb;
          previous_id := page_id;
          request := request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',response->'nextCursor');
          perform set_config('role','authenticated',true);
          response := public.rank_items_page_v1(request);
          perform set_config('role','postgres',true);
        end loop;
        if cardinality(seen)<>25 or step<>4 then raise exception 'Expected 24 ordinary Items and one reminder across bounded pages: %, %',cardinality(seen),step; end if;
        if private.prediction_window_source_v1(root_id)<>snapshot then raise exception 'Later pages rewrote first-page evidence'; end if;
        if exists(select 1 from private.prediction_candidates c join private.prediction_page_contexts p on p.prediction_id=c.prediction_id
          join private.prediction_candidates original on original.prediction_id=p.source_prediction_id and original.item_id=c.item_id
          where p.source_prediction_id=root_id and (c.final_score<>original.final_score or c.scenario_score<>original.scenario_score
            or c.explanation->'scoringFeatures'<>original.explanation->'scoringFeatures')) then raise exception 'Page refitted frozen scores/features'; end if;
      end loop;
    end loop;
  end loop;
  -- Deliberately change today's catalog and taste before shadow execution.
  update public.items set tags=array['later'],discoverable=false;
  update public.item_interactions set rating=0 where rating is not null;
  worker := private.process_shadow_prediction_jobs_v1(250);
  if worker->>'failed'<>'0' then raise exception 'Page shadow failed: %', (select jsonb_agg(last_error) from private.shadow_prediction_jobs where status='FAILED'); end if;
  if exists(select 1 from private.shadow_prediction_runs s join private.prediction_runs r on r.id=s.source_prediction_id
    join private.shadow_prediction_candidates sc on sc.shadow_prediction_id=s.id
    join private.prediction_candidates pc on pc.prediction_id=r.id and pc.item_id=sc.item_id
    where s.genome_id=r.genome_id and (sc.shadow_score<>pc.final_score or sc.shadow_rank<>pc.final_rank
      or sc.hypothetical_selected<>pc.selected_for_delivery or sc.explanation->'resurfacingPolicy'<>pc.explanation->'resurfacingPolicy')) then
    raise exception 'Baseline replay differs from immutable page score/rank/selection';
  end if;
  if (select count(*) from private.shadow_prediction_runs s join private.prediction_page_contexts p on p.prediction_id=s.source_prediction_id
    join private.prediction_runs r on r.id=s.source_prediction_id where s.genome_id=r.genome_id and s.code_version='shadow-page-replay-v1')<>36 then
    raise exception 'Missing page-specific baseline shadows'; end if;
  if exists(select 1 from private.shadow_prediction_candidates sc join private.shadow_prediction_runs s on s.id=sc.shadow_prediction_id
    join private.prediction_page_contexts p on p.prediction_id=s.source_prediction_id
    where sc.explanation->>'comparisonScope'<>'FROZEN_SOURCE_POOL_AND_OBSERVED_PAGE_PREFIX') then
    raise exception 'Page shadow claims unconditional whole-session comparison'; end if;
  -- A real synthetic exposure/action belongs to the later page, and must reach
  -- the mature evaluator through its page replay version (including rating 0).
  select r.*,c.item_id into strict evaluated from private.prediction_runs r
    join private.prediction_page_contexts p on p.prediction_id=r.id
    join private.prediction_candidates c on c.prediction_id=r.id and c.selected_for_delivery
    join public.profiles scope_profile on scope_profile.id=r.profile_id
    where p.page_index=2 and scope_profile.profile_type='PERSONAL'
    order by r.requested_at,c.final_rank limit 1;
  insert into public.event_sessions(id,actor_user_id,profile_id,started_at)
    values(evaluated.session_id,evaluated.actor_user_id,evaluated.profile_id,evaluated.requested_at-interval '1 second');
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id)
    values(gen_random_uuid(),evaluated.actor_user_id,evaluated.profile_id,evaluated.item_id,evaluated.requested_item_type,
      'ITEM_IMPRESSION',evaluated.requested_at+interval '1 millisecond',evaluated.session_id,evaluated.id);
  perform set_config('role','authenticated',true);
  action_response := public.commit_item_action_v1(jsonb_build_object('version',1,'actionId',gen_random_uuid(),
    'actorUserId',evaluated.actor_user_id,'profileId',evaluated.profile_id,'itemId',evaluated.item_id,
    'kind','SET_RATING','rating',0,'occurredAt',evaluated.requested_at+interval '2 milliseconds',
    'predictionId',evaluated.id,'discoveryMode',evaluated.discovery_mode,
    'session',jsonb_build_object('sessionId',evaluated.session_id,'startedAt',evaluated.requested_at-interval '1 second','context','{}'::jsonb)));
  perform set_config('role','postgres',true);
  if action_response->>'predictionId'<>evaluated.id::text then raise exception 'Outcome lost later-page origin'; end if;
  insert into private.evaluation_windows(id,window_key,prediction_from,prediction_until,input_cutoff,outcome_cutoff,created_by)
    values(evaluation_id,'page-evaluation-'||evaluation_id,evaluated.requested_at-interval '1 microsecond',
      evaluated.requested_at+interval '1 microsecond',evaluated.requested_at+interval '1 microsecond',clock_timestamp(),'ATOMIC_PAGE_FIXTURE');
  perform private.evaluate_shadow_genome_v1(evaluation_id,evaluated.genome_id);
  if not exists(select 1 from private.genome_evaluations e where e.evaluation_window_id=evaluation_id
    and e.scope_type='GLOBAL' and e.outcome_count=1 and e.exposed_count=1 and e.prediction_count=1
    and e.production_metric<0 and e.raw_advantage=0
    and e.metrics->>'pageReplayVersion'='shadow-page-replay-v1'
    and e.metrics->>'comparisonScope'='FROZEN_SOURCE_POOL_AND_OBSERVED_PAGE_PREFIX') then
    raise exception 'Mature evaluation dropped page replay or rating-zero outcome'; end if;
end;
$pages$;
select jsonb_build_object('atomicPages','PASS: 12 Personal/Shared/domain/mode windows, 48 distinct pages, exact retries and baseline prefix replay') as snapshot;
