do $final_preflight$
declare expected jsonb; actual record;
begin
  if exists(select 1 from pg_proc where pronamespace='private'::regnamespace and proname=any(array[
    'native_final_candidate_input_v1','native_final_run_input_v1','validate_native_final_source_v1'])) then
    raise exception 'Native FINAL input target collision'; end if;
  for expected in select value from jsonb_array_elements($checks$[{"signature":"private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)","hash":"2a89229a9db505503a24b42b2a453d2c","definer":true,"configuration":["search_path=\"\""]},{"signature":"private.process_shadow_prediction_jobs_v1(integer)","hash":"603ec8d110a28c4d6dc1227549be8d01","definer":true,"configuration":["search_path=\"\""]},{"signature":"private.record_personal_working_shadow_v1(uuid,text)","hash":"d665f59b9ddf342e19bc2aa3eae004a9","definer":false,"configuration":["search_path=\"\"","extra_float_digits=3"]},{"signature":"private.rank_items_frozen_page_v2(jsonb)","hash":"1bb9b3d91dfac70a4db62a3e1e8605e7","definer":true,"configuration":["search_path=\"\"","extra_float_digits=3"]}]$checks$::jsonb) loop
    select * into strict actual from pg_proc where oid=(expected->>'signature')::regprocedure;
    if md5(actual.prosrc)<>expected->>'hash' or actual.proowner<>'postgres'::regrole
      or actual.prosecdef is distinct from (expected->>'definer')::boolean
      or to_jsonb(actual.proconfig) is distinct from expected->'configuration'
      or actual.provolatile<>'v' or actual.proleakproof or actual.proisstrict or actual.proparallel<>'u'
      or actual.prolang<>(select oid from pg_language where lanname='plpgsql')
      or exists(select 1 from aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) a
        where a.grantor<>actual.proowner or (a.grantee<>actual.proowner and not(
          expected->>'signature'='private.process_shadow_prediction_jobs_v1(integer)'
          and a.grantee='service_role'::regrole and a.privilege_type='EXECUTE' and not a.is_grantable)))
      or has_function_privilege('anon',actual.oid,'EXECUTE')
      or has_function_privilege('authenticated',actual.oid,'EXECUTE')
      or has_function_privilege('service_role',actual.oid,'EXECUTE') is distinct from
        (expected->>'signature'='private.process_shadow_prediction_jobs_v1(integer)') then
      raise exception 'Native FINAL input source/security drift: %',expected->>'signature';
    end if;
  end loop;
end;$final_preflight$;

-- Freeze the consumed FINAL-stage inputs without replacing scoring arithmetic.
-- Fresh requests and copied protocol-2 pages remain different computations.
-- Historical unmarked sources retain their old replay; no rows are backfilled.

create function private.native_final_candidate_input_v1(
  prediction_id uuid, item_id uuid, source_genome_id uuid,
  explanation jsonb, scenario_score double precision
) returns jsonb language plpgsql immutable set search_path='' set extra_float_digits=3 as $input$
declare features jsonb:=explanation->'scoringFeatures'; key text; value double precision;
begin
  if prediction_id is null or item_id is null or source_genome_id is null
    or jsonb_typeof(explanation) is distinct from 'object'
    or features->>'version' is distinct from 'prediction-features-v2'
    or jsonb_typeof(explanation->'sharedCommonFit') is distinct from 'object'
    or jsonb_typeof(explanation->'resurfacingInput') is distinct from 'object'
    or jsonb_typeof(explanation->'resurfacingPolicy') is distinct from 'object'
    or jsonb_typeof(explanation#>'{resurfacingInput,eligible}') is distinct from 'boolean'
    or jsonb_typeof(explanation#>'{resurfacingPolicy,eligible}') is distinct from 'boolean'
    or (explanation ? 'workingIntent' and jsonb_typeof(explanation->'workingIntent') is distinct from 'object')
    or scenario_score is null or scenario_score in('Infinity'::float8,'-Infinity'::float8,'NaN'::float8) then
    raise exception 'Invalid native FINAL scoring input' using errcode='22023';
  end if;
  foreach key in array array['direct','longTerm','shortTerm','novelty','exploration',
    'reactionQueuePenalty','impressionCooldownPenalty'] loop
    if jsonb_typeof(features->key) is distinct from 'number' then
      raise exception 'Invalid native FINAL scoring feature: %',key using errcode='22023'; end if;
    value:=(features->>key)::float8;
    if value in('Infinity'::float8,'-Infinity'::float8,'NaN'::float8) then
      raise exception 'Nonfinite native FINAL scoring feature' using errcode='22023'; end if;
  end loop;
  if jsonb_typeof(explanation#>'{sharedCommonFit,contribution}') is distinct from 'number'
    or (explanation#>>'{sharedCommonFit,contribution}')::float8 in('Infinity'::float8,'-Infinity'::float8,'NaN'::float8) then
    raise exception 'Invalid native FINAL common-fit input' using errcode='22023'; end if;
  return jsonb_build_object('version','native-final-scoring-input-v1','stage','FINAL',
    'predictionId',prediction_id,'itemId',item_id,'sourceGenomeId',source_genome_id,
    'scenarioScore',scenario_score,'explanation',jsonb_build_object(
      'scoringFeatures',features,'sharedCommonFit',explanation->'sharedCommonFit',
      'resurfacingInput',explanation->'resurfacingInput','resurfacingPolicy',explanation->'resurfacingPolicy')
      ||case when explanation ? 'workingIntent' then jsonb_build_object('workingIntent',explanation->'workingIntent') else '{}'::jsonb end);
end;$input$;

-- The run owns common bindings and the source genome once; candidate inputs
-- carry no duplicated genome configuration or caller-controlled request clocks.
create function private.native_final_run_input_v1(
  source jsonb, source_genome_config jsonb, candidate_ids jsonb, feature_source_id uuid
) returns jsonb language sql immutable set search_path='' set extra_float_digits=3 set timezone='UTC' as $run$
  select jsonb_build_object('version','native-final-scoring-input-v1','stage','FINAL',
    'computation',case when feature_source_id is null then 'FRESH_FINAL' else 'FROZEN_PAGE_REUSE' end,
    'predictionId',source->'id','featureSourcePredictionId',coalesce(to_jsonb(feature_source_id),source->'id'),
    'actorUserId',source->'actor_user_id','profileId',source->'profile_id','sessionId',source->'session_id',
    'requestedAt',(source->>'requested_at')::timestamptz,'itemType',source->'requested_item_type','mode',source->'discovery_mode',
    'modelVersion',source->'model_version','baseModelVersion',source->'base_model_version','policyVersion',source->'policy_version',
    'context',source->'context','candidateRequest',source#>'{state_snapshot,candidateRequest}',
    'predictionInput',source#>'{state_snapshot,predictionInput}',
    'sourceGenome',jsonb_build_object('id',source->'genome_id','config',source_genome_config),
    'candidateCount',source->'candidate_count','candidateIds',candidate_ids);
$run$;

-- Owner-only read of one complete immutable source. Validate before any marked
-- source reaches a replay consumer, including empty and suppressed-only pools.
-- This does not authenticate an exported file or certify historical visibility.
create function private.validate_native_final_source_v1(source_prediction_id uuid)
returns boolean language plpgsql stable set search_path='' set extra_float_digits=3 as $source$
declare source private.prediction_runs%rowtype; marker jsonb; ids jsonb; config jsonb;
  candidate record; feature_source_id uuid; input_bytes bigint;
begin
  select r.* into strict source from private.prediction_runs r where r.id=source_prediction_id;
  marker:=source.state_snapshot->'finalScoringInput';
  if not(source.state_snapshot ? 'finalScoringInput') then
    if exists(select 1 from private.prediction_candidates c where c.prediction_id=source.id
      and c.explanation ? 'finalScoringInput') then
      raise exception 'Native FINAL source marker is missing' using errcode='22023'; end if;
    return false;
  end if;
  if jsonb_typeof(marker) is distinct from 'object' or marker->>'version' is distinct from 'native-final-scoring-input-v1'
    or source.candidate_count not between 0 and 50 or source.result_count not between 0 and source.candidate_count
    or source.state_snapshot#>>'{candidateRequest,version}' is distinct from 'native-candidate-request-v1'
    or source.state_snapshot#>>'{predictionInput,version}' is distinct from 'native-prediction-clocks-v1' then
    raise exception 'Unsupported native FINAL source contract' using errcode='22023'; end if;
  select coalesce(jsonb_agg(c.item_id order by c.item_id),'[]'::jsonb),
    coalesce(sum(octet_length((c.explanation->'finalScoringInput')::text)),0)
    into ids,input_bytes from private.prediction_candidates c where c.prediction_id=source.id;
  if jsonb_array_length(ids)<>source.candidate_count or input_bytes+octet_length(marker::text)>2097152 then
    raise exception 'Incomplete or oversized native FINAL source pool' using errcode='22023'; end if;
  select g.config into strict config from private.predictor_genomes g where g.id=source.genome_id;
  if 'frozen-page-v1'=any(string_to_array(source.policy_version,'+')) then
    select p.source_prediction_id into strict feature_source_id from private.prediction_page_contexts p where p.prediction_id=source.id;
  end if;
  if marker is distinct from private.native_final_run_input_v1(to_jsonb(source),config,ids,feature_source_id) then
    raise exception 'Native FINAL source scope, clocks, genome or pool mismatch' using errcode='22023'; end if;
  for candidate in select c.* from private.prediction_candidates c where c.prediction_id=source.id loop
    if candidate.explanation->'finalScoringInput' is distinct from private.native_final_candidate_input_v1(
      source.id,candidate.item_id,source.genome_id,candidate.explanation,candidate.scenario_score) then
      raise exception 'Missing or inconsistent native FINAL candidate input' using errcode='22023'; end if;
  end loop;
  return true;
end;$source$;

revoke all on function private.native_final_candidate_input_v1(uuid,uuid,uuid,jsonb,float8),
  private.native_final_run_input_v1(jsonb,jsonb,jsonb,uuid),private.validate_native_final_source_v1(uuid)
  from public,anon,authenticated,service_role;

-- Changes are confined to preparation/consumption and immutable source binding.
-- Existing math, acquisition, reminder reselection, request/lifecycle clocks,
-- public signatures, policy versions and historical records remain unchanged.
do $final_consumers$
declare patch jsonb; definition text; body text; before_text text;
begin
  for patch in select value from jsonb_array_elements($patches$[
  {
    "signature": "private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)",
    "before": "  rescored as (\n    select\n      scenario_enriched.*,\n      private.prediction_candidate_score_working_v1(\n        requested_mode,\n        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit)\n          || private.personal_working_explanation_v1(current_working_state,scenario_enriched.tags),\n        scenario_enriched.scenario_score,\n        serving_genome_config,'OFF'\n      ) as final_score,",
    "after": "  final_inputs as materialized (\n    select scenario_enriched.*,\n      private.native_final_candidate_input_v1(current_prediction_id,scenario_enriched.item_id,serving_genome_id,\n        scenario_enriched.explanation||jsonb_build_object('sharedCommonFit',scenario_enriched.shared_common_fit)\n          ||private.personal_working_explanation_v1(current_working_state,scenario_enriched.tags),\n        scenario_enriched.scenario_score) as final_scoring_input\n    from scenario_enriched\n  ),\n  rescored as (\n    select\n      scenario_enriched.*,\n      private.prediction_candidate_score_working_v1(\n        requested_mode,\n        scenario_enriched.final_scoring_input->'explanation',\n        (scenario_enriched.final_scoring_input->>'scenarioScore')::double precision,\n        serving_genome_config,'OFF'\n      ) as final_score,"
  },
  {
    "signature": "private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)",
    "before": "      ) as final_confidence\n    from scenario_enriched",
    "after": "      ) as final_confidence\n    from final_inputs as scenario_enriched"
  },
  {
    "signature": "private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)",
    "before": "        ) || private.personal_working_explanation_v1(current_working_state,rescored.tags)\n      ) as final_explanation",
    "after": "        ) || (rescored.final_scoring_input->'explanation')\n          || jsonb_build_object('finalScoringInput',rescored.final_scoring_input)\n      ) as final_explanation"
  },
  {
    "signature": "private.rank_items_request_with_identity_v1(jsonb,uuid,uuid,text,text,integer,jsonb)",
    "before": "  where private.prediction_runs.id = current_prediction_id;\nend;",
    "after": "  where private.prediction_runs.id = current_prediction_id;\n\n  update private.prediction_runs r set state_snapshot=r.state_snapshot||jsonb_build_object('finalScoringInput',\n    private.native_final_run_input_v1(to_jsonb(r),g.config,\n      (select coalesce(jsonb_agg(c.item_id order by c.item_id),'[]'::jsonb)\n        from private.prediction_candidates c where c.prediction_id=r.id),null))\n  from private.predictor_genomes g where r.id=current_prediction_id and g.id=r.genome_id;\n  perform private.validate_native_final_source_v1(current_prediction_id);\nend;"
  },
  {
    "signature": "private.process_shadow_prediction_jobs_v1(integer)",
    "before": "  shadow_run_id uuid;",
    "after": "  shadow_run_id uuid;\n  has_final_input boolean;"
  },
  {
    "signature": "private.process_shadow_prediction_jobs_v1(integer)",
    "before": "      shadow_run_id := gen_random_uuid();",
    "after": "      has_final_input:=private.validate_native_final_source_v1(source_run.id);\n      shadow_run_id := gen_random_uuid();"
  },
  {
    "signature": "private.process_shadow_prediction_jobs_v1(integer)",
    "before": "      with rescored as materialized (",
    "after": "      with frozen_inputs as materialized (\n        select c.*,\n          case when has_final_input then c.explanation#>'{finalScoringInput,explanation}' else c.explanation end as scoring_explanation,\n          case when has_final_input then (c.explanation#>>'{finalScoringInput,scenarioScore}')::double precision else c.scenario_score end as scoring_scenario\n        from private.prediction_candidates c where c.prediction_id=source_run.id\n      ), rescored as materialized ("
  },
  {
    "signature": "private.process_shadow_prediction_jobs_v1(integer)",
    "before": "source_run.discovery_mode, production_candidate.explanation,\n            production_candidate.scenario_score, genome.config",
    "after": "source_run.discovery_mode, production_candidate.scoring_explanation,\n            production_candidate.scoring_scenario, genome.config"
  },
  {
    "signature": "private.process_shadow_prediction_jobs_v1(integer)",
    "before": "source_run.discovery_mode, production_candidate.explanation - 'sharedCommonFit',",
    "after": "source_run.discovery_mode, production_candidate.scoring_explanation - 'sharedCommonFit',"
  },
  {
    "signature": "private.process_shadow_prediction_jobs_v1(integer)",
    "before": "        from private.prediction_candidates as production_candidate\n        where production_candidate.prediction_id = source_run.id",
    "after": "        from frozen_inputs as production_candidate"
  },
  {
    "signature": "private.process_shadow_prediction_jobs_v1(integer)",
    "before": "where rescored.explanation #>> '{resurfacingInput,classification}' ",
    "after": "where rescored.scoring_explanation #>> '{resurfacingInput,classification}' "
  },
  {
    "signature": "private.process_shadow_prediction_jobs_v1(integer)",
    "before": "rescored.explanation -> 'resurfacingInput', eligible_reminders.reminder_order",
    "after": "rescored.scoring_explanation -> 'resurfacingInput', eligible_reminders.reminder_order"
  },
  {
    "signature": "private.record_personal_working_shadow_v1(uuid,text)",
    "before": "  config jsonb; stored jsonb; result jsonb; rows jsonb; capture jsonb;",
    "after": "  config jsonb; stored jsonb; result jsonb; rows jsonb; capture jsonb;\n  has_final_input boolean;"
  },
  {
    "signature": "private.record_personal_working_shadow_v1(uuid,text)",
    "before": "  -- Retries always reauthorize; stored replay does not recapture current Events.",
    "after": "  has_final_input:=private.validate_native_final_source_v1(source.id);\n  -- Retries always reauthorize; stored replay does not recapture current Events."
  },
  {
    "signature": "private.record_personal_working_shadow_v1(uuid,text)",
    "before": "  with scored as materialized (\n    select c.*,private.prediction_candidate_score_working_v1(source.discovery_mode,c.explanation,c.scenario_score,config,control) score,\n      private.prediction_delivery_tier_v1(c.explanation->'resurfacingPolicy') tier\n    from private.prediction_candidates c where c.prediction_id=source.id",
    "after": "  with frozen_inputs as materialized (\n    select c.*,\n      case when has_final_input then c.explanation#>'{finalScoringInput,explanation}' else c.explanation end as scoring_explanation,\n      case when has_final_input then (c.explanation#>>'{finalScoringInput,scenarioScore}')::double precision else c.scenario_score end as scoring_scenario\n    from private.prediction_candidates c where c.prediction_id=source.id\n  ), scored as materialized (\n    select c.*,private.prediction_candidate_score_working_v1(source.discovery_mode,c.scoring_explanation,c.scoring_scenario,config,control) score,\n      private.prediction_delivery_tier_v1(c.scoring_explanation->'resurfacingPolicy') tier\n    from frozen_inputs c"
  },
  {
    "signature": "private.rank_items_frozen_page_v2(jsonb)",
    "before": "  next_cursor uuid; window_json jsonb; now_at timestamptz;",
    "after": "  next_cursor uuid; window_json jsonb; now_at timestamptz;\n  has_final_input boolean;"
  },
  {
    "signature": "private.rank_items_frozen_page_v2(jsonb)",
    "before": "    source_run := jsonb_populate_record(null::private.prediction_runs,stored_window.source_snapshot->'run');",
    "after": "    source_run := jsonb_populate_record(null::private.prediction_runs,stored_window.source_snapshot->'run');\n    has_final_input:=private.validate_native_final_source_v1(source_run.id);"
  },
  {
    "signature": "private.rank_items_frozen_page_v2(jsonb)",
    "before": "          'featureAt',source_run.requested_at,'eligibilityAt',now_at))\n    from ranked c;",
    "after": "          'featureAt',source_run.requested_at,'eligibilityAt',now_at))\n        ||case when has_final_input then jsonb_build_object('finalScoringInput',\n          private.native_final_candidate_input_v1(page_request.prediction_id,c.item_id,source_run.genome_id,\n            c.explanation||jsonb_build_object('resurfacingInput',c.policy,'resurfacingPolicy',c.final_policy),c.scenario_score))\n          else '{}'::jsonb end\n    from ranked c;"
  },
  {
    "signature": "private.rank_items_frozen_page_v2(jsonb)",
    "before": "      where r.id=page_request.prediction_id;\n    select coalesce(jsonb_agg",
    "after": "      where r.id=page_request.prediction_id;\n    if has_final_input then\n      update private.prediction_runs r set state_snapshot=r.state_snapshot||jsonb_build_object('finalScoringInput',\n        private.native_final_run_input_v1(to_jsonb(r),g.config,\n          (select coalesce(jsonb_agg(c.item_id order by c.item_id),'[]'::jsonb)\n            from private.prediction_candidates c where c.prediction_id=r.id),source_run.id))\n      from private.predictor_genomes g where r.id=page_request.prediction_id and g.id=r.genome_id;\n      perform private.validate_native_final_source_v1(page_request.prediction_id);\n    end if;\n    select coalesce(jsonb_agg"
  }
]$patches$::jsonb) loop
    select pg_get_functiondef(p.oid),p.prosrc into strict definition,body
      from pg_proc p where p.oid=(patch->>'signature')::regprocedure;
    before_text:=patch->>'before';
    if (length(body)-length(replace(body,before_text,'')))/length(before_text)<>1 then
      raise exception 'Native FINAL input anchor drift: %',patch->>'signature'; end if;
    execute replace(definition,body,replace(body,before_text,patch->>'after'));
  end loop;
end;$final_consumers$;

do $final_access$
declare target regprocedure; actual record;
begin
  foreach target in array array[
    'private.native_final_candidate_input_v1(uuid,uuid,uuid,jsonb,double precision)'::regprocedure,
    'private.native_final_run_input_v1(jsonb,jsonb,jsonb,uuid)'::regprocedure,
    'private.validate_native_final_source_v1(uuid)'::regprocedure
  ] loop
    select * into strict actual from pg_proc where oid=target;
    if actual.proowner<>'postgres'::regrole or actual.prosecdef
      or exists(select 1 from aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) a
        where a.grantor<>actual.proowner or a.grantee<>actual.proowner)
      or has_function_privilege('anon',target,'EXECUTE')
      or has_function_privilege('authenticated',target,'EXECUTE')
      or has_function_privilege('service_role',target,'EXECUTE') then
      raise exception 'Native FINAL input helper access drift: %',target; end if;
  end loop;
end;$final_access$;
