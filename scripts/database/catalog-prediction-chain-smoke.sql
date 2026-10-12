-- Each page owns a fresh, immutable, exclusion-before-admission PredictionRun.
-- Caller installs catalog-prediction-chain-fixture.sql and rolls everything back.
do $chains$
declare
  profile record; domain text; mode text; request jsonb; response jsonb;
  root_id uuid; previous_id uuid; page_id uuid; chain_uuid uuid;
  seen uuid[]; delivered uuid[]; step integer; reminders integer; runs_before integer;
  candidate_count integer; result_count integer; run private.prediction_runs%rowtype;
  worker jsonb; page_count integer := 0;
begin
  for profile in select * from pg_temp.pool_profiles order by profile_type loop
    foreach domain in array array['BOOK','MOVIE'] loop
      foreach mode in array array['FOR_YOU','SURPRISE','RISK'] loop
        request := jsonb_build_object('version',3,'requestId',gen_random_uuid(),'profileId',profile.profile_id,
          'sessionId',gen_random_uuid(),'discoveryMode',mode,'itemType',domain,'limit',50,
          'context','{"attributes":{"surface":"DISCOVERY_GRID"}}'::jsonb);
        seen := '{}'; step := 0; previous_id := null; reminders := 0;
        loop
          perform set_config('role','authenticated',true);
          response := public.rank_items_page_v1(request);
          perform set_config('role','postgres',true);
          step := step+1; page_count := page_count+1;
          page_id := (response->>'predictionId')::uuid;
          if step=1 then root_id := page_id; chain_uuid := (response#>>'{source,chainId}')::uuid; end if;
          select * into strict run from private.prediction_runs where id=page_id;
          select coalesce(array_agg((item->>'item_id')::uuid order by (item->>'rank')::integer),'{}'::uuid[])
            into delivered from jsonb_array_elements(response->'items') item;
          candidate_count := (response#>>'{source,candidateCount}')::integer;
          result_count := cardinality(delivered);
          if step>4 or response->'version'<>'3'::jsonb
            or response->'continuationSupported'<>'true'::jsonb
            or response#>>'{source,version}'<>'catalog-chain-v1'
            or response#>>'{source,sourcePredictionId}'<>page_id::text
            or response#>>'{source,rootPredictionId}'<>root_id::text
            or response#>>'{source,parentPredictionId}' is distinct from previous_id::text
            or response#>>'{source,chainId}'<>chain_uuid::text
            or (response#>>'{source,pageIndex}')::integer<>step
            or (response#>>'{source,chainLimit}')::integer<>1000
            or (response#>>'{source,seenCount}')::integer<>cardinality(seen)+result_count
            or (response#>>'{source,resultCount}')::integer<>result_count
            or (response#>>'{source,featureAt}')::timestamptz<>run.requested_at
            or candidate_count>50 or candidate_count<result_count then
            raise exception 'Invalid catalog-chain envelope at % % % page %: %',profile.profile_type,domain,mode,step,response->'source';
          end if;
          if result_count=0 or result_count>50 or seen&&delivered
            or response->>'availability'<>'ITEMS'
            or response#>'{source,catalogEmpty}'<>'false'::jsonb
            or exists(select 1 from jsonb_array_elements(response->'items') with ordinality a(item,n)
              where item->>'prediction_id'<>page_id::text or (item->>'rank')::integer<>n
                or item->>'item_type'<>domain) then
            raise exception 'Chain repeated an Item or lost exact ordered page origins';
          end if;
          if run.profile_id<>profile.profile_id or run.actor_user_id<>'a22c0000-0000-4000-8000-000000000001'::uuid
            or run.session_id<>(request->>'sessionId')::uuid or run.result_count<>result_count
            or run.candidate_count<>candidate_count or run.requested_item_type<>domain or run.discovery_mode<>mode
            or not 'catalog-chain-v1'=any(string_to_array(run.policy_version,'+')) then
            raise exception 'Chain run lost scope, trace counts or version';
          end if;
          if not exists(select 1 from private.prediction_catalog_chain_pages p where p.prediction_id=page_id
            and p.chain_id=chain_uuid and p.root_prediction_id=root_id
            and p.parent_prediction_id is not distinct from previous_id and p.page_index=step
            and p.seen_before=seen and p.reminder_previously_delivered=(reminders>0)) then
            raise exception 'Chain lost exact predecessor and server-owned delivery prefix';
          end if;
          if exists(select 1 from private.prediction_candidates c where c.prediction_id=page_id and c.item_id=any(seen))
            or (select count(*) from private.prediction_candidates c where c.prediction_id=page_id)<>candidate_count then
            raise exception 'Seen Items entered the bounded candidate source before admission';
          end if;
          reminders := reminders+(select count(*) from private.prediction_candidates c where c.prediction_id=page_id
            and c.selected_for_delivery and c.explanation#>>'{resurfacingPolicy,classification}'='SAVED_REMINDER');
          if reminders>1 then raise exception 'Reminder budget replenished between chain pages'; end if;
          select count(*) into runs_before from private.prediction_runs;
          perform set_config('role','authenticated',true);
          if public.rank_items_page_v1(request)<>response then raise exception 'Chain exact retry changed receipt'; end if;
          perform set_config('role','postgres',true);
          if (select count(*) from private.prediction_runs)<>runs_before then raise exception 'Chain retry created another run'; end if;
          insert into private.shadow_prediction_jobs(source_prediction_id,genome_id) values(page_id,run.genome_id)
            on conflict do nothing;
          seen := seen||delivered;
          if response->'nextCursor'='null'::jsonb then
            if response#>>'{source,continuationState}'<>'CATALOG_EXHAUSTED' then raise exception 'Final real page claims a reader cap or MORE'; end if;
            exit;
          end if;
          if response#>>'{source,continuationState}'<>'MORE' then raise exception 'Live cursor has non-continuable state'; end if;
          previous_id := page_id;
          request := request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',response->'nextCursor');
        end loop;
        if cardinality(seen)<>145 or step<>3 or reminders<>1
          or (select count(*) from unnest(seen) id join pg_temp.pool_items i on i.item_id=id where i.kind='ORDINARY')<>144 then
          raise exception 'Chain stopped at bounded source instead of entire eligible catalog: % seen, % pages, % reminders',cardinality(seen),step,reminders;
        end if;
        if not exists(select 1 from private.prediction_catalog_chains c where c.id=chain_uuid
          and c.seen_item_ids=seen and c.reminder_delivered) then raise exception 'Chain did not retain cumulative delivery budget'; end if;
      end loop;
    end loop;
  end loop;
  -- Shadow must use each page's own frozen admitted source after later live changes.
  update public.items set tags=array['later-catalog'],discoverable=false;
  update public.item_interactions set rating=0 where rating is not null;
  worker := private.process_shadow_prediction_jobs_v1(250);
  if worker->>'failed'<>'0' then raise exception 'Catalog-chain shadow failed: %',
    (select jsonb_agg(last_error) from private.shadow_prediction_jobs where status='FAILED'); end if;
  if (select count(*) from private.shadow_prediction_runs s
    join private.prediction_catalog_chain_pages p on p.prediction_id=s.source_prediction_id
    join private.prediction_runs r on r.id=s.source_prediction_id where s.genome_id=r.genome_id)<>page_count then
    raise exception 'Missing page-specific catalog-chain baseline shadows'; end if;
  if exists(select 1 from private.shadow_prediction_runs s
    join private.prediction_catalog_chain_pages p on p.prediction_id=s.source_prediction_id
    join private.prediction_runs r on r.id=s.source_prediction_id
    join private.shadow_prediction_candidates sc on sc.shadow_prediction_id=s.id
    join private.prediction_candidates pc on pc.prediction_id=r.id and pc.item_id=sc.item_id
    where s.genome_id=r.genome_id and (sc.shadow_score<>pc.final_score or sc.shadow_rank<>pc.final_rank
      or sc.hypothetical_selected<>pc.selected_for_delivery)) then
    raise exception 'Fresh catalog-chain page cannot replay its immutable baseline source'; end if;
end;
$chains$;
select jsonb_build_object('catalogChain','PASS: 12 Personal/Shared/domain/mode chains, 36 fresh pages, 144 ordinary Items plus one reminder, exact retries and frozen baseline replay') snapshot;
