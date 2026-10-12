-- Bounded Personal native capture and default-OFF consumer bridge.
-- Research-only binary current Item tags, not historical feature availability.
-- Explicit frozen STATIC/ORDERED/OFF comparisons never mutate old predictions,
-- scalar genomes, Shared scoring, hard eligibility or learning admission.
-- CLI 2.117.0 generated this forward; all earlier migration bytes are immutable.

do $working_preflight$
declare patch jsonb; current_source text; replacement jsonb; before_text text;
begin
  for patch in select value from jsonb_array_elements($working_manifest$[{"signature":"private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)","sourceMd5":"d4853d50c3bb2da1ad9f807c4548010b","replacements":[{"before":"  current_state jsonb;","after":"  current_state jsonb;\n  current_working_state jsonb;","count":1},{"before":"  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);","after":"  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);\n  current_working_state := private.capture_personal_working_state_v1(\n    current_actor_user_id,target_profile_id,requested_session_id,request_time);\n  if current_working_state is not null then\n    current_state := current_state || jsonb_build_object('workingState',current_working_state);\n  end if;","count":1},{"before":"  end || '+frozen-replay-v2+eligibility-first-v1';","after":"  end || '+frozen-replay-v2+eligibility-first-v1';\n  if current_working_state is not null then\n    current_policy_version := current_policy_version || '+personal-working-off-v1';\n  end if;","count":1},{"before":"      private.prediction_candidate_score_v2(\n        requested_mode,\n        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit),\n        scenario_enriched.scenario_score,\n        serving_genome_config\n      ) as final_score,","after":"      private.prediction_candidate_score_working_v1(\n        requested_mode,\n        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit)\n          || private.personal_working_explanation_v1(current_working_state,scenario_enriched.tags),\n        scenario_enriched.scenario_score,\n        serving_genome_config,'OFF'\n      ) as final_score,","count":1},{"before":"          'sharedCommonFit', rescored.shared_common_fit\n        )","after":"          'sharedCommonFit', rescored.shared_common_fit\n        ) || private.personal_working_explanation_v1(current_working_state,rescored.tags)","count":1}]},{"signature":"private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)","sourceMd5":"f57dada80dfafd3630624f7e6ac9e9b5","replacements":[{"before":"  current_state jsonb;","after":"  current_state jsonb;\n  current_working_state jsonb;","count":1},{"before":"  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);","after":"  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);\n  current_working_state := private.capture_personal_working_state_v1(\n    current_actor_user_id,target_profile_id,requested_session_id,request_time);\n  if current_working_state is not null then\n    current_state := current_state || jsonb_build_object('workingState',current_working_state);\n  end if;","count":1},{"before":"  end || '+frozen-replay-v2+eligibility-first-v1+catalog-chain-v1';","after":"  end || '+frozen-replay-v2+eligibility-first-v1+catalog-chain-v1';\n  if current_working_state is not null then\n    current_policy_version := current_policy_version || '+personal-working-off-v1';\n  end if;","count":1},{"before":"      private.prediction_candidate_score_v2(\n        requested_mode,\n        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit),\n        scenario_enriched.scenario_score,\n        serving_genome_config\n      ) as final_score,","after":"      private.prediction_candidate_score_working_v1(\n        requested_mode,\n        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit)\n          || private.personal_working_explanation_v1(current_working_state,scenario_enriched.tags),\n        scenario_enriched.scenario_score,\n        serving_genome_config,'OFF'\n      ) as final_score,","count":1},{"before":"          'sharedCommonFit', rescored.shared_common_fit\n        )","after":"          'sharedCommonFit', rescored.shared_common_fit\n        ) || private.personal_working_explanation_v1(current_working_state,rescored.tags)","count":1}]},{"signature":"private.erase_prediction_sources_v1(text,uuid)","sourceMd5":"9c5f87a2f535b72d70e048a5dd46bc68","replacements":[{"before":"    union all select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)\n    limit 250001) bounded;","after":"    union all select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)\n    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)\n    limit 250001) bounded;","count":1}]},{"signature":"private.open_prediction_window_v1(uuid)","sourceMd5":"0735bf53841890557764031cb897cc1a","replacements":[{"before":"    or run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1' then","after":"    or (run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1'\n      and run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1+personal-working-off-v1') then","count":1}]}]$working_manifest$::jsonb) loop
    select p.prosrc into strict current_source from pg_catalog.pg_proc p where p.oid=(patch->>'signature')::regprocedure;
    if pg_catalog.md5(current_source) is distinct from patch->>'sourceMd5' then
      raise exception 'Personal working source drift: %',patch->>'signature' using errcode='55000'; end if;
    for replacement in select value from jsonb_array_elements(patch->'replacements') loop
      before_text := replacement->>'before';
      if before_text='' or (length(current_source)-length(replace(current_source,before_text,'')))/length(before_text)
        <>(replacement->>'count')::integer then
        raise exception 'Personal working anchor drift: %',patch->>'signature' using errcode='55000'; end if;
    end loop;
  end loop;
end;
$working_preflight$;

-- Native Personal WorkingState source. The forward migration embeds this exact
-- source; this file is not independently installed on a hosted database.
create function private.capture_personal_working_state_v1(
  actor uuid, profile uuid, session uuid, cutoff timestamptz
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $working$
declare
  capture_id uuid := pg_catalog.gen_random_uuid();
  snapshot jsonb; result jsonb; raw_events jsonb; objects jsonb := '[]';
  records jsonb := '[]'; items jsonb := '[]'; groups jsonb := '[]';
  ordered_vector jsonb := '{}'; static_vector jsonb := '{}'; exclusions jsonb := '{}';
  schema jsonb; artifact jsonb; config jsonb; refs jsonb; current_session jsonb;
  dimensions text[]; invalidated text[] := '{}';
  event jsonb; record jsonb; object jsonb; latest jsonb; taste_group jsonb;
  item_id text; dimension text; reason text; kind text; status text;
  time_group double precision; as_of double precision; started_at double precision;
  last_at double precision; rating double precision; direction double precision;
  total double precision; weight double precision; ordered_total double precision;
  ordered_weight double precision; recency double precision; feature double precision;
  group_distance integer; rating_count integer := 0; negative_count integer := 0;
  clears_value boolean; clears_negative boolean; ambiguous boolean;
  source_time timestamptz; source_base double precision; source_micros double precision;
  source_instant double precision; source_instants double precision[];
  unavailable_reason text;
begin
  if actor is null or profile is null or actor is distinct from auth.uid() then
    raise exception using errcode='42501',message='Personal working capture actor is unauthorized';
  end if;
  if cutoff is null or not pg_catalog.isfinite(cutoff)
    or extract(epoch from cutoff) < 0 or extract(epoch from cutoff)*1000 > 9007199254740991 then
    raise exception using errcode='22023',message='Personal working capture cutoff is invalid';
  end if;
  as_of := extract(epoch from cutoff)*1000;

  -- One statement captures every relation under one MVCC snapshot. LIMITs are
  -- overflow sentinels, never accepted evidence subsets. Corrections contain the
  -- full own same-Item history, including earlier sessions and exact UNDO links.
  with selected_profile as materialized (
    select p.id,p.profile_type,p.owner_user_id,
      exists(select 1 from public.profile_members m where m.profile_id=p.id and m.user_id=actor) as member
    from public.profiles p where p.id=profile
  ), selected_session as materialized (
    select s.id,s.actor_user_id,s.profile_id,s.started_at,s.created_at
    from public.event_sessions s join selected_profile p on p.profile_type='PERSONAL' and p.owner_user_id=actor
    where s.id=session and s.actor_user_id=actor and s.profile_id=profile
      and pg_catalog.isfinite(s.started_at) and pg_catalog.isfinite(s.created_at)
      and s.started_at<=cutoff and s.created_at<=cutoff and s.started_at>='epoch'::timestamptz
      and s.created_at>='epoch'::timestamptz
  ), session_prefix as materialized (
    select e.id,e.item_id from public.events e join selected_session s on s.id=e.session_id
    where e.actor_user_id=actor and e.profile_id=profile and e.item_id is not null
      and pg_catalog.isfinite(e.occurred_at) and pg_catalog.isfinite(e.created_at)
      and e.occurred_at<=cutoff and e.created_at<=cutoff
      and e.occurred_at>='epoch'::timestamptz and e.created_at>='epoch'::timestamptz
    order by e.occurred_at,e.id limit 129
  ), prefix_items as materialized (
    select distinct e.item_id from session_prefix e order by e.item_id limit 33
  ), closure as materialized (
    select e.id,e.actor_user_id,e.profile_id,e.session_id,e.item_id,e.item_type,e.event_type,
      e.occurred_at,e.created_at,
      case e.event_type when 'ITEM_RATED' then jsonb_build_object('rating',e.properties->'rating')
        when 'ITEM_INTERACTION_UNDONE' then jsonb_build_object('reversedEventId',e.properties->'reversedEventId')
        else '{}'::jsonb end as properties,
      original.item_id as undo_item_id,original.event_type as undo_event_type
    from public.events e
    left join public.events original on original.id=case
      when e.event_type='ITEM_INTERACTION_UNDONE' and e.properties->>'reversedEventId'
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (e.properties->>'reversedEventId')::uuid else null end
      and original.actor_user_id=actor and original.profile_id=profile
      and pg_catalog.isfinite(original.occurred_at) and pg_catalog.isfinite(original.created_at)
      and original.occurred_at<=cutoff and original.created_at<=cutoff
    where e.actor_user_id=actor and e.profile_id=profile and e.item_id is not null
      and pg_catalog.isfinite(e.occurred_at) and pg_catalog.isfinite(e.created_at)
      and e.occurred_at<=cutoff and e.created_at<=cutoff
      and e.occurred_at>='epoch'::timestamptz and e.created_at>='epoch'::timestamptz
      and (e.id in(select p.id from session_prefix p)
        or (e.item_id in(select p.item_id from prefix_items p) and e.event_type in(
          'ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_HISTORY_CLEARED','ITEM_INTEREST_CLEARED','ITEM_INTERACTION_UNDONE')))
    order by e.occurred_at,e.created_at,e.id limit 129
  ), closure_items as materialized (
    select distinct e.item_id from closure e order by e.item_id limit 33
  ), feature_dimensions as materialized (
    select tag from public.items i join closure_items c on c.item_id=i.id,
      lateral pg_catalog.unnest(i.tags) t(tag)
    group by tag order by tag collate "C" limit 33
  ), item_snapshots as materialized (
    select i.id,i.item_type,i.created_at,i.updated_at,
      coalesce((select jsonb_agg(t.tag order by t.tag collate "C")
        from feature_dimensions t where t.tag=any(i.tags)),'[]'::jsonb) as tags
    from public.items i join closure_items c on c.item_id=i.id
  ) select jsonb_build_object(
    'profile',(select to_jsonb(p) from selected_profile p),
    'session',(select to_jsonb(s) from selected_session s),
    'prefixCount',(select count(*) from session_prefix),
    'rawEvents',coalesce((select jsonb_agg(to_jsonb(e) order by e.occurred_at,e.created_at,e.id) from closure e),'[]'::jsonb),
    'itemSnapshots',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from item_snapshots i),'[]'::jsonb),
    'dimensions',coalesce((select jsonb_agg(tag order by tag collate "C") from feature_dimensions),'[]'::jsonb)
  ) into snapshot;

  if snapshot->'profile'='null'::jsonb or snapshot->'profile' is null then
    raise exception using errcode='42501',message='Personal working capture Profile is unauthorized';
  end if;
  if snapshot#>>'{profile,profile_type}'='SHARED' then
    if not (snapshot#>>'{profile,member}')::boolean then
      raise exception using errcode='42501',message='Shared working capture Profile is unauthorized';
    end if;
    return null; -- This component never supplies Shared state or member taste.
  end if;
  if snapshot#>>'{profile,owner_user_id}' is distinct from actor::text then
    raise exception using errcode='42501',message='Personal working capture Profile is unauthorized';
  end if;

  config := jsonb_build_object('maxRecords',128,'maxItems',32,'maxFeatures',32,'maxInvalidations',256,
    'idleTtlMs',1800000,'maxSessionMs',14400000,'minItems',2,'maxAdjustment',0.25,'recencyHalfLifeGroups',2);
  refs := jsonb_build_object('scopeId','native-working:'||capture_id,
    'subjectRef','native-working:'||capture_id||':subject','actorRef','native-working:'||capture_id||':actor',
    'sessionRef','native-working:'||capture_id||':session');
  artifact := jsonb_build_object('id','native-working-tags','version','1','representationVersion','native-binary-tags-v1',
    'availableAt',as_of,'trainedThrough',null,'use','research-only',
    'sourceRefs',jsonb_build_array('kajo-canonical-events-v1'));
  current_session := nullif(snapshot->'session','null'::jsonb);
  status := case when current_session is null then 'NO_SESSION' else 'EMPTY' end;
  result := jsonb_build_object('kind','working-state','version','native-working-capture-v1','stateVersion','working-state-v1',
    'captureId',capture_id,'actorUserId',actor,'profile',jsonb_build_object('id',profile,'type','PERSONAL','ownerUserId',actor),
    'refs',refs,'cutoff',cutoff,'asOf',as_of,'session',current_session,'resetAt',null,'prefixComplete',true,
    'config',config,'availabilityBasis','STORED_CREATED_TIME','commitAvailability','UNKNOWN',
    'completenessBasis','NATIVE_SESSION_PREFIX_AND_OWN_SAME_ITEM_CORRECTION_CLOSURE',
    'featureAvailabilityBasis','CURRENT_MVCC_SNAPSHOT_KNOWN_AT_CAPTURE',
    'interpretation','TEMPORARY_INTENT_HYPOTHESIS','historicalFeatureEligible',false,
    'learnable',false,'nativeActivated',false,'observedEvaluationCount',0,
    'uncertainty','unavailable','calibration','uncalibrated');
  if (snapshot->>'prefixCount')::integer>128 or jsonb_array_length(snapshot->'rawEvents')>128
    or jsonb_array_length(snapshot->'itemSnapshots')>32 or jsonb_array_length(snapshot->'dimensions')>32 then
    status := 'BUDGET_EXCEEDED';
    result := result||jsonb_build_object('prefixComplete',false,'budgetExceeded',jsonb_build_object(
      'records',(snapshot->>'prefixCount')::integer>128 or jsonb_array_length(snapshot->'rawEvents')>128,
      'items',jsonb_array_length(snapshot->'itemSnapshots')>32,'features',jsonb_array_length(snapshot->'dimensions')>32));
    snapshot := snapshot||jsonb_build_object('rawEvents','[]'::jsonb,'itemSnapshots','[]'::jsonb,'dimensions','[]'::jsonb);
  end if;
  select coalesce(array_agg(value order by value collate "C"),'{}'::text[]) into dimensions
    from jsonb_array_elements_text(snapshot->'dimensions');
  if exists(select 1 from pg_catalog.unnest(dimensions) t(tag)
    where tag is null or length(tag)=0 or length(tag)+(
      select count(*) from pg_catalog.regexp_split_to_table(tag,'') c(character)
      where pg_catalog.ascii(c.character)>65535)>256 or tag~'[[:cntrl:]]') then
    unavailable_reason := 'UNSUPPORTED_FEATURE_DIMENSION';
  end if;
  if current_session is not null and status<>'BUDGET_EXCEEDED' then
    -- Validate the complete bounded snapshot before copying/deriving any accepted
    -- evidence. Unsupported legacy source data abstains in this component; OFF
    -- must not turn an existing catalog/Event into a live recommendation failure.
    for event in select value from jsonb_array_elements(snapshot->'rawEvents') loop
      if event->>'item_type' is null or event->>'item_type' not in('BOOK','MOVIE') then
        unavailable_reason := 'UNSUPPORTED_EVENT_ITEM_TYPE';
      elsif event->>'event_type'='ITEM_INTERACTION_UNDONE' and (
        event#>>'{properties,reversedEventId}' is null or event#>>'{properties,reversedEventId}'
          !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or lower(event#>>'{properties,reversedEventId}')=event->>'id'
        or event->>'undo_event_type'='ITEM_INTERACTION_UNDONE'
        or (event->>'undo_item_id' is not null and event->>'undo_item_id'<>event->>'item_id')) then
        unavailable_reason := 'UNSUPPORTED_UNDO_SOURCE';
      end if;
    end loop;
    for source_time in select (current_session->>'started_at')::timestamptz
      union all select (current_session->>'created_at')::timestamptz
      union all select (value->>'occurred_at')::timestamptz from jsonb_array_elements(snapshot->'rawEvents')
      union all select (value->>'created_at')::timestamptz from jsonb_array_elements(snapshot->'rawEvents') loop
      source_base := floor(extract(epoch from source_time))*1000;
      source_micros := (extract(epoch from source_time)-floor(extract(epoch from source_time)))*1000000;
      source_instant := source_base+source_micros/1000;
      if source_micros<>0 and (source_instant<=source_base
        or source_base+(source_micros-1)/1000>=source_instant
        or source_base+(source_micros+1)/1000<=source_instant) then
        unavailable_reason := 'TIMESTAMP_PRECISION_COLLAPSE';
      end if;
    end loop;
  end if;
  if unavailable_reason is not null then
    status := 'INPUT_UNAVAILABLE';
    result := result||jsonb_build_object('prefixComplete',false,'inputUnavailableReason',unavailable_reason);
    snapshot := snapshot||jsonb_build_object('rawEvents','[]'::jsonb,'itemSnapshots','[]'::jsonb,'dimensions','[]'::jsonb);
    dimensions := '{}';
  end if;
  -- Native inactive envelopes may have no dimensions. They are not portable
  -- accepted WorkingState inputs: do not invent a feature for empty/no-session/
  -- missing-feature or rejected-budget capture, or pass it to portable derivation.
  schema := jsonb_build_object('id','native-working-tags','version','1','dimensions',to_jsonb(dimensions),'artifact',artifact);
  for object in select value from jsonb_array_elements(snapshot->'itemSnapshots') loop
    objects := objects||jsonb_build_array(jsonb_build_object('id',object->>'id','availableAt',as_of,'artifact',artifact,
      'tags',object->'tags','sourceCreatedAt',object->'created_at','sourceUpdatedAt',object->'updated_at',
      'features',coalesce((select jsonb_object_agg(tag,case when object->'tags' ? tag then 1 else 0 end)
        from pg_catalog.unnest(dimensions) t(tag)),'{}'::jsonb)));
  end loop;
  raw_events := '[]'::jsonb;
  if current_session is not null and status not in('BUDGET_EXCEEDED','INPUT_UNAVAILABLE') then
    source_instants := '{}';
    foreach source_time in array array[(current_session->>'started_at')::timestamptz,
      (current_session->>'created_at')::timestamptz] loop
      source_base := floor(extract(epoch from source_time))*1000;
      source_micros := (extract(epoch from source_time)-floor(extract(epoch from source_time)))*1000000;
      source_instant := source_base+source_micros/1000;
      source_instants := array_append(source_instants,source_instant);
    end loop;
    started_at := source_instants[1];
    for event in select value from jsonb_array_elements(snapshot->'rawEvents') loop
      raw_events := raw_events||jsonb_build_array(event-'undo_item_id'-'undo_event_type');
      source_instants := '{}';
      foreach source_time in array array[(event->>'occurred_at')::timestamptz,(event->>'created_at')::timestamptz] loop
        -- Match the adapter's base + stored-microseconds conversion and reject
        -- an epoch whose adjacent microseconds cannot remain distinct numbers.
        source_base := floor(extract(epoch from source_time))*1000;
        source_micros := (extract(epoch from source_time)-floor(extract(epoch from source_time)))*1000000;
        source_instant := source_base+source_micros/1000;
        source_instants := array_append(source_instants,source_instant);
      end loop;
      kind := case event->>'event_type' when 'ITEM_RATED' then 'VALUE'
        when 'ITEM_NOT_INTERESTED' then 'NEGATIVE' when 'ITEM_HISTORY_CLEARED' then 'CLEAR'
        when 'ITEM_INTEREST_CLEARED' then 'CLEAR' when 'ITEM_INTERACTION_UNDONE' then 'UNDO'
        when 'ITEM_IMPRESSION' then 'ATTENTION' when 'ITEM_OPENED' then 'ATTENTION' when 'ITEM_DWELL' then 'ATTENTION'
        when 'ITEM_LIKED' then 'ATTENTION' when 'ITEM_DISLIKED' then 'ATTENTION' when 'ITEM_SAVED' then 'ATTENTION'
        when 'ITEM_UNSAVED' then 'ATTENTION' when 'ITEM_CONSUMED' then 'ATTENTION'
        when 'ITEM_CONSUMPTION_REVERSED' then 'ATTENTION' when 'ITEM_SUGGESTED' then 'ATTENTION'
        when 'ITEM_ADDED_TO_LIST' then 'ATTENTION' when 'ITEM_REMOVED_FROM_LIST' then 'ATTENTION'
        when 'ITEM_ENDORSED' then 'ATTENTION' when 'SEARCH_PERFORMED' then 'ATTENTION'
        when 'DISCOVERY_MODE_CHANGED' then 'ATTENTION' else null end;
      if kind is null then continue; end if;
      if event->>'session_id' is distinct from session::text then
        exclusions := jsonb_set(exclusions,array['FOREIGN_SESSION'],to_jsonb(coalesce((exclusions->>'FOREIGN_SESSION')::integer,0)+1));
        if kind='ATTENTION' then continue; end if;
      end if;
      if kind='UNDO' then
        invalidated := array_append(invalidated,lower(event#>>'{properties,reversedEventId}'));
      end if;
      rating := null;
      if kind='VALUE' and jsonb_typeof(event#>'{properties,rating}')='number' then
        if (event#>>'{properties,rating}')::numeric between 0 and 10
          and (event#>>'{properties,rating}')::numeric=trunc((event#>>'{properties,rating}')::numeric) then
          rating := (event#>>'{properties,rating}')::double precision;
        end if;
      end if;
      select value into object from jsonb_array_elements(objects) where value->>'id'=event->>'item_id';
      record := jsonb_build_object('eventId',event->>'id','itemId',event->>'item_id','kind',kind,'rating',rating,
        'occurredAt',source_instants[1],'availableAt',source_instants[2],
        'sessionRef',case when event->>'session_id'=session::text then refs->>'sessionRef' else null end,
        'clearTargets',case when event->>'event_type'='ITEM_HISTORY_CLEARED' then jsonb_build_array('VALUE')
          when event->>'event_type'='ITEM_INTEREST_CLEARED' then jsonb_build_array('NEGATIVE') else '[]'::jsonb end,
        'features',object->'features','sourceRef',jsonb_build_object('sourceId','kajo-canonical-events-v1','recordId',event->>'id','revision',1));
      records := records||jsonb_build_array(record);
      if record->>'sessionRef'=refs->>'sessionRef' and (record->>'occurredAt')::double precision>=started_at then
        last_at := greatest(last_at,(record->>'occurredAt')::double precision);
      end if;
    end loop;
    for record in select value from jsonb_array_elements(records) loop
      reason := case when record->>'eventId'=any(invalidated) then 'INVALIDATED'
        when record->>'kind'='ATTENTION' then 'ATTENTION_NOT_TASTE'
        when record->>'kind'='UNDO' then null
        when (record->>'occurredAt')::double precision<started_at then 'BEFORE_SESSION_OR_RESET' else null end;
      if reason is not null then
        exclusions := jsonb_set(exclusions,array[reason],to_jsonb(coalesce((exclusions->>reason)::integer,0)+1));
      end if;
    end loop;
    for item_id in select distinct value->>'itemId' from jsonb_array_elements(records)
      where value->>'kind' in('VALUE','NEGATIVE','CLEAR') and not value->>'eventId'=any(invalidated)
        and (value->>'occurredAt')::double precision>=started_at order by 1 loop
      latest := '[]'::jsonb;
      for time_group in select distinct (value->>'occurredAt')::double precision from jsonb_array_elements(records)
        where value->>'itemId'=item_id and value->>'kind' in('VALUE','NEGATIVE','CLEAR')
          and not value->>'eventId'=any(invalidated) and (value->>'occurredAt')::double precision>=started_at order by 1 loop
        select coalesce(jsonb_agg(value),'[]'::jsonb),
          coalesce(bool_or(value->'clearTargets' ? 'VALUE'),false),coalesce(bool_or(value->'clearTargets' ? 'NEGATIVE'),false)
          into taste_group,clears_value,clears_negative
          from jsonb_array_elements(records) where value->>'itemId'=item_id
            and not value->>'eventId'=any(invalidated) and (value->>'occurredAt')::double precision=time_group
            and value->>'kind' in('VALUE','NEGATIVE','CLEAR');
        select coalesce(jsonb_agg(value),'[]'::jsonb),count(distinct jsonb_build_array(value->'kind',value->'rating',value->'sessionRef'))>1
          into taste_group,ambiguous from jsonb_array_elements(taste_group) where value->>'kind' in('VALUE','NEGATIVE');
        if jsonb_array_length(taste_group)=0 then
          if (latest#>>'{0,kind}'='VALUE' and clears_value) or (latest#>>'{0,kind}'='NEGATIVE' and clears_negative) then latest := '[]'; end if;
        elsif ambiguous or (taste_group#>>'{0,kind}'='VALUE' and clears_value)
          or (taste_group#>>'{0,kind}'='NEGATIVE' and clears_negative) then
          latest := '[]';
          exclusions := jsonb_set(exclusions,array['AMBIGUOUS_LATEST_TIME_GROUP'],
            to_jsonb(coalesce((exclusions->>'AMBIGUOUS_LATEST_TIME_GROUP')::integer,0)+1));
        else latest := taste_group; end if;
      end loop;
      record := latest->0;
      reason := case when record is null then 'CLEARED_OR_UNKNOWN_ITEM'
        when record->>'sessionRef' is distinct from refs->>'sessionRef' then 'FOREIGN_SESSION_RESOLVED_ITEM'
        when record->>'kind'='VALUE' and record->'rating'='null'::jsonb then 'CLEARED_OR_UNKNOWN_ITEM'
        when not exists(select 1 from jsonb_each_text(coalesce(record->'features','{}'::jsonb)) where value::double precision>0)
          then 'MISSING_FEATURES' else null end;
      if reason is not null then
        exclusions := jsonb_set(exclusions,array[reason],to_jsonb(coalesce((exclusions->>reason)::integer,0)+1));
        continue;
      end if;
      direction := case when record->>'kind'='NEGATIVE' then -1 else (record->>'rating')::double precision/5-1 end;
      items := items||jsonb_build_array(jsonb_build_object('objectId',item_id,'direction',direction,'occurredAt',record->'occurredAt',
        'sourceRefs',(select jsonb_agg(value->'sourceRef') from jsonb_array_elements(latest)),
        'features',record->'features','source','native','kind',record->>'kind'));
    end loop;
    select coalesce(jsonb_agg(value order by (value->>'occurredAt')::double precision,value->>'objectId'),'[]'::jsonb)
      into items from jsonb_array_elements(items);
    select coalesce(jsonb_agg(jsonb_build_object('occurredAt',at,'objectIds',ids) order by at),'[]'::jsonb) into groups
      from (select (value->>'occurredAt')::double precision at,jsonb_agg(value->'objectId' order by value->>'objectId') ids
        from jsonb_array_elements(items) group by 1) g;
    status := case when as_of-started_at>=14400000 then 'SESSION_EXPIRED'
      when last_at is not null and as_of-last_at>=1800000 then 'IDLE_EXPIRED'
      when jsonb_array_length(items)=0 then 'EMPTY' when jsonb_array_length(items)<2 then 'INSUFFICIENT_SUPPORT' else 'ACTIVE' end;
  end if;
  foreach dimension in array dimensions loop
    total := 0;weight := 0;ordered_total := 0;ordered_weight := 0;
    for record in select value from jsonb_array_elements(items) loop
      feature := coalesce((record->'features'->>dimension)::double precision,0);
      select count(*) into group_distance from jsonb_array_elements(groups)
        where (value->>'occurredAt')::double precision>(record->>'occurredAt')::double precision;
      recency := pg_catalog.power(2::double precision,-group_distance::double precision/2);
      total := total+feature*(record->>'direction')::double precision;weight := weight+feature;
      ordered_total := ordered_total+feature*recency*(record->>'direction')::double precision;
      ordered_weight := ordered_weight+feature*recency;
    end loop;
    static_vector := static_vector||jsonb_build_object(dimension,case when weight=0 then 0 else greatest(-1,least(1,total/weight)) end);
    ordered_vector := ordered_vector||jsonb_build_object(dimension,case when ordered_weight=0 then 0 else greatest(-1,least(1,ordered_total/ordered_weight)) end);
  end loop;
  select count(*) filter(where value->>'kind'='VALUE'),count(*) filter(where value->>'kind'='NEGATIVE')
    into rating_count,negative_count from jsonb_array_elements(items);
  return result||jsonb_build_object('status',status,'featureSchema',schema,'rawEvents',raw_events,'itemFeatures',objects,
    'records',records,'items',items,'groups',groups,'vectors',jsonb_build_object('ordered',ordered_vector,'static',static_vector),
    'lastActivityAt',last_at,'exclusions',exclusions,'support',jsonb_build_object('distinctItems',jsonb_array_length(items),
      'currentSessions',case when jsonb_array_length(items)=0 then 0 else 1 end,'nativeItems',jsonb_array_length(items),
      'syntheticItems',0,'observedRatings',rating_count,'explicitNegativeItems',negative_count));
end;
$working$;

create function private.personal_working_adjustment_v1(capture jsonb,tags text[],control text default 'OFF')
returns double precision language plpgsql immutable security invoker set search_path = '' as $working$
declare vector jsonb;adjustment_value double precision;total double precision := 0;weight integer := 0;dimension text;
begin
  if control is null or control not in('OFF','STATIC','ORDERED') then
    raise exception using errcode='22023',message='Personal working control is invalid';
  end if;
  if control='OFF' or capture is null then return 0; end if;
  if capture->>'version' is distinct from 'native-working-capture-v1' then
    raise exception using errcode='22023',message='Personal working capture version is invalid';
  end if;
  if capture->>'status' is distinct from 'ACTIVE' or capture->'prefixComplete' is distinct from 'true'::jsonb then return 0; end if;
  if jsonb_typeof(capture#>'{featureSchema,dimensions}') is distinct from 'array'
    or jsonb_array_length(capture#>'{featureSchema,dimensions}')>32 then
    raise exception using errcode='22023',message='Personal working feature schema is invalid';
  end if;
  vector := capture->'vectors'->case when control='ORDERED' then 'ordered' else 'static' end;
  for dimension in select value from jsonb_array_elements_text(capture#>'{featureSchema,dimensions}')
    where value=any(tags) group by value order by value collate "C" loop
    if jsonb_typeof(vector->dimension) is distinct from 'number' then
      raise exception using errcode='22023',message='Personal working vector is invalid';
    end if;
    adjustment_value := (vector->>dimension)::double precision;
    if adjustment_value<'-1'::double precision or adjustment_value>'1'::double precision or adjustment_value='NaN'::double precision then
      raise exception using errcode='22023',message='Personal working vector is invalid';
    end if;
    total := total+adjustment_value;weight := weight+1;
  end loop;
  if weight=0 then return 0; end if;
  adjustment_value := greatest(-0.25::double precision,least(0.25::double precision,0.25::double precision*total/weight));
  if adjustment_value=0 then return 0; end if;
  return adjustment_value;
end;
$working$;

revoke all on function private.capture_personal_working_state_v1(uuid,uuid,uuid,timestamptz),
  private.personal_working_adjustment_v1(jsonb,text[],text) from public,anon,authenticated,service_role;

-- One consumer for live OFF and explicit frozen comparisons. The legacy scorer
-- and scalar genome contracts retain their exact bytes and numeric evaluation.
create function private.personal_working_explanation_v1(capture jsonb,candidate_tags text[])
returns jsonb language sql immutable security invoker set search_path='' as $$
  select case when capture is null then '{}'::jsonb else jsonb_build_object(
    'workingIntent',jsonb_build_object('version','personal-working-features-v1',
      'captureId',capture->'captureId','stateVersion','working-state-v1',
      'policyVersion','working-policy-v1','control','OFF','status',capture->'status',
      'staticAdjustment',private.personal_working_adjustment_v1(capture,candidate_tags,'STATIC'),
      'orderedAdjustment',private.personal_working_adjustment_v1(capture,candidate_tags,'ORDERED'),
      'uncertainty','unavailable','calibration','uncalibrated',
      'learnable',false,'historicalFeatureEligible',false,'nativeActivated',false)) end;
$$;

create function private.prediction_candidate_score_working_v1(
  requested_mode text,explanation jsonb,stored_scenario_score double precision,
  genome_config jsonb,control text default 'OFF')
returns double precision language plpgsql immutable security invoker set search_path='' as $$
declare baseline double precision; adjustment double precision; intent jsonb := explanation->'workingIntent';
begin
  if control is null or control not in ('OFF','STATIC','ORDERED') then
    raise exception 'Unsupported working comparison control' using errcode='22023'; end if;
  baseline := private.prediction_candidate_score_v2(requested_mode,explanation,stored_scenario_score,genome_config);
  -- Return the old number directly. Even adding numeric zero is unnecessary.
  if control='OFF' then return baseline; end if;
  if intent->>'version' is distinct from 'personal-working-features-v1'
    or intent->>'stateVersion' is distinct from 'working-state-v1'
    or intent->>'policyVersion' is distinct from 'working-policy-v1'
    or intent->>'control' is distinct from 'OFF' then
    raise exception 'Missing frozen working comparison features' using errcode='22023'; end if;
  if jsonb_typeof(intent->case when control='STATIC' then 'staticAdjustment' else 'orderedAdjustment' end)
    is distinct from 'number' then
    raise exception 'Invalid frozen working adjustment' using errcode='22023'; end if;
  adjustment := (intent->>case when control='STATIC' then 'staticAdjustment' else 'orderedAdjustment' end)::double precision;
  if adjustment in ('NaN'::double precision,'Infinity'::double precision,'-Infinity'::double precision)
    or abs(adjustment)>0.25 then
    raise exception 'Invalid frozen working adjustment' using errcode='22023'; end if;
  return baseline+adjustment;
end;
$$;
revoke all on function private.personal_working_explanation_v1(jsonb,text[]),
  private.prediction_candidate_score_working_v1(text,jsonb,double precision,jsonb,text)
  from public,anon,authenticated,service_role;

-- Private diagnostic forecasts retain actual consumption of the source capture.
-- They do not add scalar genomes, queue jobs or become learning/promotion inputs.
create table private.personal_working_shadow_comparisons (
  source_prediction_id uuid not null references private.prediction_runs(id) on delete cascade,
  control text not null check(control in ('OFF','STATIC','ORDERED')),
  result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=262144
    and jsonb_typeof(result->'candidates')='array' and jsonb_array_length(result->'candidates')<=50),
  created_at timestamptz not null default clock_timestamp(),
  primary key(source_prediction_id,control)
);
alter table private.personal_working_shadow_comparisons enable row level security;
revoke all on private.personal_working_shadow_comparisons from public,anon,authenticated,service_role;

create function private.guard_personal_working_comparison_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  -- FK cascade is allowed only after its whole source has actually disappeared.
  if tg_op='DELETE' and not exists(select 1 from private.prediction_runs r where r.id=old.source_prediction_id)
    then return old; end if;
  raise exception 'Working comparison is immutable; erase its source instead' using errcode='55000';
end;
$$;
revoke all on function private.guard_personal_working_comparison_v1() from public,anon,authenticated,service_role;
create trigger personal_working_comparison_immutable before update or delete
  on private.personal_working_shadow_comparisons for each row
  execute function private.guard_personal_working_comparison_v1();

create function private.record_personal_working_shadow_v1(source_prediction_id uuid,control text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare source private.prediction_runs%rowtype; actor uuid := (select auth.uid());
  config jsonb; stored jsonb; result jsonb; rows jsonb; capture jsonb;
begin
  -- First lock, matching all native writers and source erasure.
  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);
  if source_prediction_id is null or control is null or control not in ('OFF','STATIC','ORDERED') then
    raise exception 'Invalid working comparison request' using errcode='22023'; end if;
  select r.* into source from private.prediction_runs r where r.id=source_prediction_id;
  if actor is null or source.id is null or source.actor_user_id<>actor or not exists(
    select 1 from public.profiles p where p.id=source.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor)
    then raise exception 'Personal working source access denied' using errcode='42501'; end if;
  -- Retries always reauthorize; stored replay does not recapture current Events.
  select c.result into stored from private.personal_working_shadow_comparisons c
    where c.source_prediction_id=source.id and c.control=record_personal_working_shadow_v1.control;
  if found then return stored; end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'New working comparisons require READ COMMITTED' using errcode='25001'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(source.id::text||':'||control,1946841873));
  select c.result into stored from private.personal_working_shadow_comparisons c
    where c.source_prediction_id=source.id and c.control=record_personal_working_shadow_v1.control;
  if found then return stored; end if;
  capture := source.state_snapshot->'workingState';
  if capture->>'version' is distinct from 'native-working-capture-v1'
    or not('personal-working-off-v1'=any(string_to_array(source.policy_version,'+')))
    or source.candidate_count<0 or source.candidate_count>50
    or source.result_count<0 or source.result_count>source.candidate_count
    or (select count(*) from private.prediction_candidates c where c.prediction_id=source.id)<>source.candidate_count
    or exists(select 1 from private.prediction_candidates c where c.prediction_id=source.id
      and (c.explanation#>>'{workingIntent,captureId}' is distinct from capture->>'captureId'
        or c.explanation#>>'{workingIntent,version}' is distinct from 'personal-working-features-v1')) then
    raise exception 'Missing or inconsistent frozen Personal working capture' using errcode='55000'; end if;
  select g.config into strict config from private.predictor_genomes g where g.id=source.genome_id;
  with scored as materialized (
    select c.*,private.prediction_candidate_score_working_v1(source.discovery_mode,c.explanation,c.scenario_score,config,control) score,
      private.prediction_delivery_tier_v1(c.explanation->'resurfacingPolicy') tier
    from private.prediction_candidates c where c.prediction_id=source.id
  ), ranked as (
    select scored.*,row_number() over(order by tier,score desc,item_id)::integer rank from scored
  ) select coalesce(jsonb_agg(jsonb_build_object('itemId',item_id,'score',score,'rank',rank,
    'tier',tier,'eligible',coalesce((explanation#>>'{resurfacingPolicy,eligible}')::boolean,false),
    'selected',tier<2 and rank<=source.result_count,
    'adjustment',case control when 'STATIC' then (explanation#>>'{workingIntent,staticAdjustment}')::double precision
      when 'ORDERED' then (explanation#>>'{workingIntent,orderedAdjustment}')::double precision else 0.0 end)
    order by rank),'[]'::jsonb) into rows from ranked;
  result := jsonb_build_object('version','personal-working-shadow-v1','sourcePredictionId',source.id,
    'captureId',capture->'captureId','control',control,'policyVersion','working-policy-v1',
    'servingControl','OFF','comparisonScope','FROZEN_CANDIDATE_POOL_AND_FINAL_DELIVERY_POLICY',
    'candidateCount',source.candidate_count,'candidates',rows,'asOf',capture->'cutoff',
    'sourceModelVersion',source.model_version,'sourcePolicyVersion',source.policy_version,
    'commitAvailability','UNKNOWN','historicalFeatureEligible',false,'learnable',false,
    'nativeActivated',false,'observedEvaluationCount',0,'calibration','uncalibrated','uncertainty','unavailable');
  insert into private.personal_working_shadow_comparisons(source_prediction_id,control,result)
    values(source.id,control,result);
  return result;
end;
$$;
revoke all on function private.record_personal_working_shadow_v1(uuid,text) from public,anon,authenticated,service_role;

do $working_patch$
declare patch jsonb; replacement jsonb; previous record; next_source text; before_text text;
begin
  for patch in select value from jsonb_array_elements($working_manifest$[{"signature":"private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)","sourceMd5":"d4853d50c3bb2da1ad9f807c4548010b","replacements":[{"before":"  current_state jsonb;","after":"  current_state jsonb;\n  current_working_state jsonb;","count":1},{"before":"  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);","after":"  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);\n  current_working_state := private.capture_personal_working_state_v1(\n    current_actor_user_id,target_profile_id,requested_session_id,request_time);\n  if current_working_state is not null then\n    current_state := current_state || jsonb_build_object('workingState',current_working_state);\n  end if;","count":1},{"before":"  end || '+frozen-replay-v2+eligibility-first-v1';","after":"  end || '+frozen-replay-v2+eligibility-first-v1';\n  if current_working_state is not null then\n    current_policy_version := current_policy_version || '+personal-working-off-v1';\n  end if;","count":1},{"before":"      private.prediction_candidate_score_v2(\n        requested_mode,\n        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit),\n        scenario_enriched.scenario_score,\n        serving_genome_config\n      ) as final_score,","after":"      private.prediction_candidate_score_working_v1(\n        requested_mode,\n        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit)\n          || private.personal_working_explanation_v1(current_working_state,scenario_enriched.tags),\n        scenario_enriched.scenario_score,\n        serving_genome_config,'OFF'\n      ) as final_score,","count":1},{"before":"          'sharedCommonFit', rescored.shared_common_fit\n        )","after":"          'sharedCommonFit', rescored.shared_common_fit\n        ) || private.personal_working_explanation_v1(current_working_state,rescored.tags)","count":1}]},{"signature":"private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)","sourceMd5":"f57dada80dfafd3630624f7e6ac9e9b5","replacements":[{"before":"  current_state jsonb;","after":"  current_state jsonb;\n  current_working_state jsonb;","count":1},{"before":"  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);","after":"  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);\n  current_working_state := private.capture_personal_working_state_v1(\n    current_actor_user_id,target_profile_id,requested_session_id,request_time);\n  if current_working_state is not null then\n    current_state := current_state || jsonb_build_object('workingState',current_working_state);\n  end if;","count":1},{"before":"  end || '+frozen-replay-v2+eligibility-first-v1+catalog-chain-v1';","after":"  end || '+frozen-replay-v2+eligibility-first-v1+catalog-chain-v1';\n  if current_working_state is not null then\n    current_policy_version := current_policy_version || '+personal-working-off-v1';\n  end if;","count":1},{"before":"      private.prediction_candidate_score_v2(\n        requested_mode,\n        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit),\n        scenario_enriched.scenario_score,\n        serving_genome_config\n      ) as final_score,","after":"      private.prediction_candidate_score_working_v1(\n        requested_mode,\n        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit)\n          || private.personal_working_explanation_v1(current_working_state,scenario_enriched.tags),\n        scenario_enriched.scenario_score,\n        serving_genome_config,'OFF'\n      ) as final_score,","count":1},{"before":"          'sharedCommonFit', rescored.shared_common_fit\n        )","after":"          'sharedCommonFit', rescored.shared_common_fit\n        ) || private.personal_working_explanation_v1(current_working_state,rescored.tags)","count":1}]},{"signature":"private.erase_prediction_sources_v1(text,uuid)","sourceMd5":"9c5f87a2f535b72d70e048a5dd46bc68","replacements":[{"before":"    union all select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)\n    limit 250001) bounded;","after":"    union all select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)\n    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)\n    limit 250001) bounded;","count":1}]},{"signature":"private.open_prediction_window_v1(uuid)","sourceMd5":"0735bf53841890557764031cb897cc1a","replacements":[{"before":"    or run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1' then","after":"    or (run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1'\n      and run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1+personal-working-off-v1') then","count":1}]}]$working_manifest$::jsonb) loop
    select p.oid,p.prosrc,to_jsonb(p)-'prosrc' metadata,pg_get_functiondef(p.oid) definition into strict previous
      from pg_catalog.pg_proc p where p.oid=(patch->>'signature')::regprocedure;
    if md5(previous.prosrc) is distinct from patch->>'sourceMd5' then
      raise exception 'Personal working source changed after preflight' using errcode='55000'; end if;
    next_source := previous.prosrc;
    for replacement in select value from jsonb_array_elements(patch->'replacements') loop
      before_text := replacement->>'before';
      if before_text='' or (length(next_source)-length(replace(next_source,before_text,'')))/length(before_text)
        <>(replacement->>'count')::integer then
        raise exception 'Personal working replacement drift' using errcode='55000'; end if;
      next_source := replace(next_source,before_text,replacement->>'after');
    end loop;
    if (length(previous.definition)-length(replace(previous.definition,previous.prosrc,'')))/length(previous.prosrc)<>1 then
      raise exception 'Personal working definition drift' using errcode='55000'; end if;
    execute replace(previous.definition,previous.prosrc,next_source);
    if not exists(select 1 from pg_catalog.pg_proc p where p.oid=previous.oid
      and to_jsonb(p)-'prosrc'=previous.metadata and p.prosrc=next_source) then
      raise exception 'Personal working function identity/metadata drift' using errcode='55000'; end if;
  end loop;
end;
$working_patch$;
