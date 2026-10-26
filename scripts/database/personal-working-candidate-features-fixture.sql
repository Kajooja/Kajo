-- Disposable actual native sources. The caller owns BEGIN/ROLLBACK.
create function pg_temp.candidate_feature_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Working candidate feature assertion: %',label;end if;end;$$;
create temp table candidate_feature_pages(actor uuid,request jsonb,response jsonb) on commit drop;
create temp table candidate_feature_sources(id uuid primary key,body jsonb,candidates jsonb,comparisons jsonb) on commit drop;
create function pg_temp.candidate_feature_page(actor uuid,profile uuid,session uuid,domain text,mode text,protocol integer,
  expected_availability text,page_limit integer default 2) returns uuid language plpgsql as $$
declare request jsonb;page jsonb;source private.prediction_runs%rowtype;capture jsonb;candidate record;features jsonb;
  expected jsonb;control text;shadow jsonb;config jsonb;baseline double precision;
begin
  request := jsonb_build_object('version',protocol,'requestId',gen_random_uuid(),'profileId',profile,'sessionId',session,
    'discoveryMode',mode,'itemType',domain,'limit',page_limit,'context','{}'::jsonb);
  perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('role','authenticated',true);
  page := public.rank_items_page_v1(request);perform set_config('role','postgres',true);
  select * into strict source from private.prediction_runs where id=(page->>'predictionId')::uuid;
  capture := source.state_snapshot->'workingState';
  perform pg_temp.candidate_feature_assert(capture->>'version'='native-working-capture-v3'
    and source.policy_version like '%+personal-working-off-v3' and source.candidate_count between 1 and 50,
    'actual bounded ordinary/catalogue Personal source carries matched v3 capture and fixed OFF policy');
  select g.config into strict config from private.predictor_genomes g where g.id=source.genome_id;
  for candidate in select c.*,i.tags from private.prediction_candidates c join public.items i on i.id=c.item_id
    where c.prediction_id=source.id loop
    features := candidate.explanation#>'{workingIntent,candidateFeatures}';
    perform pg_temp.candidate_feature_assert(candidate.explanation#>>'{workingIntent,version}'='personal-working-features-v3'
      and features->>'version'='native-working-candidate-features-v1' and features->>'status'=expected_availability
      and features->'captureId'=capture->'captureId' and features->'asOf'=capture->'asOf'
      and features->'featureSchemaRef'=jsonb_build_object('id',capture#>'{featureSchema,id}',
        'version',capture#>'{featureSchema,version}','artifactId',capture#>'{featureSchema,artifact,id}',
        'artifactVersion',capture#>'{featureSchema,artifact,version}',
        'representationVersion',capture#>'{featureSchema,artifact,representationVersion}',
        'dimensionCount',jsonb_array_length(capture#>'{featureSchema,dimensions}'))
      and not (features ? 'featureSchema') and features->>'featureEncoding'='CAPTURE_DIMENSION_ORDER_BINARY_V1'
      and features->>'availabilityBasis'='SOURCE_RANKING_STATEMENT_SNAPSHOT' and features->'availableAt'='null'::jsonb
      and features->>'commitAvailability'='UNKNOWN' and features->'historicalFeatureEligible'='false'::jsonb
      and features->'learnable'='false'::jsonb and features->'nativeActivated'='false'::jsonb,
      'each candidate freezes complete schema/capture/clock/availability identity without learning or commit claims');
    if expected_availability='AVAILABLE' then
      select jsonb_agg(case when dimension=any(candidate.tags) then 1 else 0 end order by ordinal) into expected
        from jsonb_array_elements_text(capture#>'{featureSchema,dimensions}') with ordinality d(dimension,ordinal);
      perform pg_temp.candidate_feature_assert(features->'features'=expected and features->'unavailableReason'='null'::jsonb
        and jsonb_array_length(capture#>'{featureSchema,dimensions}') between 1 and 32,
        'dense binary vector follows original capture dimension order and actual ranked Item tags');
    else
      perform pg_temp.candidate_feature_assert(features->'features'='null'::jsonb
        and features->>'unavailableReason' in('CAPTURE_INACTIVE','INCOMPLETE_CAPTURE','EMPTY_FEATURE_SCHEMA','INVALID_FEATURE_SCHEMA'),
        'inactive or rejected captures expose no invented partial candidate features');
    end if;
    baseline := private.prediction_candidate_score_v2(mode,candidate.explanation,candidate.scenario_score,config);
    perform pg_temp.candidate_feature_assert(float8send(baseline)=float8send(candidate.final_score)
      and float8send(private.prediction_candidate_score_working_v1(mode,candidate.explanation,candidate.scenario_score,config,'OFF'))=float8send(baseline),
      'OFF returns the unchanged baseline binary score directly in every discovery mode');
    perform pg_temp.candidate_feature_assert(float8send((candidate.explanation#>>'{workingIntent,staticAdjustment}')::double precision)
      =float8send(private.personal_working_adjustment_v1(capture,candidate.tags,'STATIC'))
      and float8send((candidate.explanation#>>'{workingIntent,orderedAdjustment}')::double precision)
      =float8send(private.personal_working_adjustment_v1(capture,candidate.tags,'ORDERED')),
      'frozen candidate components preserve the existing native STATIC/ORDERED scorer');
  end loop;
  foreach control in array array['OFF','STATIC','ORDERED'] loop
    shadow := private.record_personal_working_shadow_v1(source.id,control);
    perform pg_temp.candidate_feature_assert(shadow->>'version'='personal-working-shadow-v3'
      and shadow->'captureId'=capture->'captureId' and current_setting('extra_float_digits')='0',
      'new v3 frozen comparisons match capture generation and restore explicit caller precision0');
    if control='OFF' then
      perform pg_temp.candidate_feature_assert(not exists(select 1 from
        (select * from private.prediction_candidates where prediction_id=source.id) p
        full join jsonb_array_elements(shadow->'candidates') s(value) on p.item_id=(s.value->>'itemId')::uuid
        where p.item_id is null or s.value is null
          or float8send(p.final_score) is distinct from float8send((s.value->>'score')::double precision)
          or p.final_rank is distinct from (s.value->>'rank')::integer
          or p.selected_for_delivery is distinct from (s.value->>'selected')::boolean
          or private.prediction_delivery_tier_v1(p.explanation->'resurfacingPolicy') is distinct from (s.value->>'tier')::integer
          or coalesce((p.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) is distinct from (s.value->>'eligible')::boolean
          or (s.value->>'adjustment')::double precision is distinct from 0::double precision),
        'exact complete OFF candidate set/float8 scores/ranks/delivery tier/eligibility/selection');
    end if;
  end loop;
  insert into pg_temp.candidate_feature_pages values(actor,request,page);
  insert into pg_temp.candidate_feature_sources select source.id,to_jsonb(r),
    (select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c where c.prediction_id=r.id),
    (select jsonb_agg(to_jsonb(c) order by c.control) from private.personal_working_shadow_comparisons c where c.source_prediction_id=r.id)
    from private.prediction_runs r where r.id=source.id;
  return source.id;
exception when others then perform set_config('role','postgres',true);raise;end;$$;
do $candidate_fixture$
declare actor uuid:='a9160000-0000-4000-8000-000000000001';profile uuid;
  session uuid:='a9160000-0000-4000-8000-000000000010';empty_session uuid:='a9160000-0000-4000-8000-000000000011';
  evidence_a uuid:='a9160000-0000-4000-8000-000000000020';evidence_b uuid:='a9160000-0000-4000-8000-000000000021';
  command jsonb;domain text;mode text;protocol integer;source uuid;root_source uuid;continued_source uuid;blocked_item uuid;
  continued_request jsonb;continued_page jsonb;continued_off jsonb;
  frozen record;comparison record;page record;result jsonb;role_name text;dimension_tags text[];
begin
  insert into auth.users(id,email,raw_user_meta_data) values(actor,actor::text||'@example.invalid',jsonb_build_object('kajo_nickname','Candidate features'));
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  update public.items set discoverable=false;
  insert into public.items(id,item_type,title,tags,discoverable) values
    (evidence_a,'BOOK','Candidate feature zero',array['candidate-warm','candidate-contrast'],false),
    (evidence_b,'BOOK','Candidate feature positive',array['candidate-warm'],false);
  insert into public.items(id,item_type,title,tags,discoverable)
    select md5('candidate-feature:'||d||':'||n)::uuid,d,'Candidate feature '||d||' '||n,
      case n%4 when 0 then array['candidate-warm'] when 1 then array['candidate-contrast']
        when 2 then array['outside-frozen-schema'] else '{}'::text[] end,true
      from unnest(array['BOOK','MOVIE']) d cross join generate_series(1,8) n;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  command := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,'profileId',profile,
    'itemId',evidence_a,'occurredAt',now()-interval '4 minutes','discoveryMode','FOR_YOU','predictionId',null,
    'session',jsonb_build_object('sessionId',session,'startedAt',now()-interval '5 minutes','context','{}'::jsonb),'kind','SET_RATING','rating',0);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  command:=command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_b,'occurredAt',now()-interval '3 minutes','rating',10);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  foreach domain in array array['BOOK','MOVIE'] loop foreach mode in array array['FOR_YOU','SURPRISE','RISK'] loop
    foreach protocol in array array[2,3] loop
      perform pg_temp.candidate_feature_page(actor,profile,session,domain,mode,protocol,'AVAILABLE');
    end loop;
  end loop;end loop;
  -- Missing sessions and genuinely empty sessions remain baseline-readable.
  perform pg_temp.candidate_feature_page(actor,profile,gen_random_uuid(),'BOOK','FOR_YOU',3,'UNAVAILABLE');
  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context) values(empty_session,actor,profile,now()-interval '5 minutes','{}');
  perform pg_temp.candidate_feature_page(actor,profile,empty_session,'MOVIE','RISK',2,'UNAVAILABLE');
  -- Native upper-bound and overflow/incompatible-tag paths use real Item state.
  -- A second genuine owner keeps this larger disposable matrix inside the
  -- existing per-Profile active continuation-window budget.
  actor:='a9160000-0000-4000-8000-000000000002';session:=gen_random_uuid();
  insert into auth.users(id,email,raw_user_meta_data) values(actor,actor::text||'@example.invalid',jsonb_build_object('kajo_nickname','Candidate boundaries'));
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  command:=command||jsonb_build_object('actionId',gen_random_uuid(),'actorUserId',actor,'profileId',profile,'itemId',evidence_a,
    'occurredAt',now()-interval '4 minutes','rating',0,
    'session',jsonb_build_object('sessionId',session,'startedAt',now()-interval '5 minutes','context','{}'::jsonb));
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  command:=command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_b,'occurredAt',now()-interval '3 minutes','rating',10);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  select array_agg('candidate-dimension-'||lpad(n::text,2,'0') order by n) into dimension_tags from generate_series(1,32) n;
  update public.items set tags=dimension_tags where id in(evidence_a,evidence_b);
  update public.items set tags=array[dimension_tags[1],dimension_tags[32],'outside-frozen-schema'] where title like 'Candidate feature BOOK %';
  insert into public.items(id,item_type,title,tags,discoverable)
    select md5('candidate-feature-max-pool:'||n)::uuid,'BOOK','Candidate feature boundary '||n,
      array[dimension_tags[1],dimension_tags[32]],true from generate_series(1,42) n;
  source:=pg_temp.candidate_feature_page(actor,profile,session,'BOOK','FOR_YOU',3,'AVAILABLE',50);
  perform pg_temp.candidate_feature_assert((select candidate_count=50
    and jsonb_array_length(state_snapshot#>'{workingState,featureSchema,dimensions}')=32
    from private.prediction_runs where id=source),'actual maximum50 pool and 32-dimensional capture remain complete: '
      ||(select candidate_count::text||'/'||jsonb_array_length(state_snapshot#>'{workingState,featureSchema,dimensions}')::text
        from private.prediction_runs where id=source));
  update public.items set tags=dimension_tags||array['candidate-dimension-33'] where id in(evidence_a,evidence_b);
  source:=pg_temp.candidate_feature_page(actor,profile,session,'BOOK','FOR_YOU',2,'UNAVAILABLE');
  perform pg_temp.candidate_feature_assert((select state_snapshot#>>'{workingState,status}'='BUDGET_EXCEEDED'
    and state_snapshot#>'{workingState,prefixComplete}'='false'::jsonb from private.prediction_runs where id=source),
    '33 dimensions never become a truncated active candidate vector');
  update public.items set tags='{}' where id in(evidence_a,evidence_b);
  source:=pg_temp.candidate_feature_page(actor,profile,session,'MOVIE','SURPRISE',3,'UNAVAILABLE');
  update public.items set tags=array[''] where id in(evidence_a,evidence_b);
  source:=pg_temp.candidate_feature_page(actor,profile,session,'BOOK','RISK',3,'UNAVAILABLE');
  perform pg_temp.candidate_feature_assert((select state_snapshot#>>'{workingState,status}'='INPUT_UNAVAILABLE'
    from private.prediction_runs where id=source),'invalid native tag capture leaves actual baseline OFF serving readable');
  -- Correction, catalogue mutation and reset affect future state only.
  update public.items set tags=array['changed-after-source'] where id in(evidence_a,evidence_b) or title like 'Candidate feature %';
  command:=command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_a,'occurredAt',clock_timestamp(),'rating',10);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  perform private.commit_personal_working_reset_v1(gen_random_uuid(),actor,profile,session);
  -- A genuine protocol2 cursor consumes the original v3 source after catalogue
  -- changes. Taste features and score bytes remain frozen; eligibility refreshes.
  select * into strict page from pg_temp.candidate_feature_pages
    where request->>'version'='2' and request->>'itemType'='BOOK' and request->>'discoveryMode'='FOR_YOU'
      and response->'nextCursor' is distinct from 'null'::jsonb limit 1;
  root_source:=(page.response->>'predictionId')::uuid;
  select c.item_id into strict blocked_item from private.prediction_candidates c
    where c.prediction_id=root_source and not c.selected_for_delivery order by c.final_rank limit 1;
  update public.items set discoverable=false where id=blocked_item;
  continued_request:=page.request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',page.response->'nextCursor');
  perform set_config('request.jwt.claim.sub',page.actor::text,true);perform set_config('role','authenticated',true);
  continued_page:=public.rank_items_page_v1(continued_request);perform set_config('role','postgres',true);
  continued_source:=(continued_page->>'predictionId')::uuid;
  perform pg_temp.candidate_feature_assert(continued_source<>root_source and
    (select continued.state_snapshot-'finalScoringInput'=original.state_snapshot-'finalScoringInput'
      and continued.policy_version like '%+personal-working-off-v3+frozen-page-v1'
      from private.prediction_runs continued join private.prediction_runs original on original.id=root_source where continued.id=continued_source)
    and not exists(select 1 from (select * from private.prediction_candidates where prediction_id=root_source) original
      full join (select * from private.prediction_candidates where prediction_id=continued_source) continued using(item_id)
      where original.item_id is null or continued.item_id is null
        or float8send(original.final_score) is distinct from float8send(continued.final_score)
        or original.explanation->'workingIntent' is distinct from continued.explanation->'workingIntent'),
    'actual V2 cursor inherits the complete original v3 capture/candidate features and exact source score bytes');
  -- This fixture also runs on the historical candidate-feature prefix. Preserve
  -- every original state field; new FINAL bindings identify each independent page.
  if (select state_snapshot ? 'finalScoringInput' from private.prediction_runs where id=root_source) then
    perform pg_temp.candidate_feature_assert(private.validate_native_final_source_v1(root_source)
      and private.validate_native_final_source_v1(continued_source)
      and (select state_snapshot#>>'{finalScoringInput,predictionId}'=root_source::text
        and state_snapshot#>>'{finalScoringInput,featureSourcePredictionId}'=root_source::text
        and state_snapshot#>>'{finalScoringInput,computation}'='FRESH_FINAL'
        from private.prediction_runs where id=root_source)
      and (select state_snapshot#>>'{finalScoringInput,predictionId}'=continued_source::text
        and state_snapshot#>>'{finalScoringInput,featureSourcePredictionId}'=root_source::text
        and state_snapshot#>>'{finalScoringInput,computation}'='FROZEN_PAGE_REUSE'
        from private.prediction_runs where id=continued_source),
      'actual V2 source and continuation retain complete, independently bound FINAL inputs');
  else
    perform pg_temp.candidate_feature_assert((select not (state_snapshot ? 'finalScoringInput')
      from private.prediction_runs where id=continued_source),'historical V2 continuation remains unmarked');
  end if;
  perform pg_temp.candidate_feature_assert((select not c.selected_for_delivery
    and c.explanation#>'{resurfacingPolicy,eligible}'='false'::jsonb from private.prediction_candidates c
      where c.prediction_id=continued_source and c.item_id=blocked_item),
    'V2 later-page current catalogue eligibility suppresses the withdrawn Item independently of frozen taste features');
  continued_off:=private.record_personal_working_shadow_v1(continued_source,'OFF');
  perform pg_temp.candidate_feature_assert(continued_off->>'version'='personal-working-shadow-v3' and not exists(select 1 from
    (select * from private.prediction_candidates where prediction_id=continued_source) p
    full join jsonb_array_elements(continued_off->'candidates') s(value) on p.item_id=(s.value->>'itemId')::uuid
    where p.item_id is null or s.value is null
      or float8send(p.final_score) is distinct from float8send((s.value->>'score')::double precision)
      or p.final_rank is distinct from (s.value->>'rank')::integer
      or p.selected_for_delivery is distinct from (s.value->>'selected')::boolean
      or private.prediction_delivery_tier_v1(p.explanation->'resurfacingPolicy') is distinct from (s.value->>'tier')::integer
      or coalesce((p.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) is distinct from (s.value->>'eligible')::boolean
      or (s.value->>'adjustment')::double precision is distinct from 0::double precision),
    'continued V2 source retains exact complete OFF score/rank/delivery-policy parity');
  perform set_config('role','authenticated',true);result:=public.rank_items_page_v1(continued_request);perform set_config('role','postgres',true);
  perform pg_temp.candidate_feature_assert(result=continued_page,'actual consumed V2 cursor receipt retries exactly');
  for frozen in select * from pg_temp.candidate_feature_sources loop
    perform set_config('request.jwt.claim.sub',frozen.body->>'actor_user_id',true);
    perform pg_temp.candidate_feature_assert((select to_jsonb(r) from private.prediction_runs r where r.id=frozen.id)=frozen.body
      and (select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c where c.prediction_id=frozen.id)=frozen.candidates,
      'late correction/reset/catalogue changes leave old capture/features/scores/ranks exact');
    for comparison in select * from private.personal_working_shadow_comparisons c where c.source_prediction_id=frozen.id loop
      perform pg_temp.candidate_feature_assert(private.record_personal_working_shadow_v1(frozen.id,comparison.control)=comparison.result,
        'exact frozen control retries never consult current Item tags or native evidence');
    end loop;
    perform pg_temp.candidate_feature_assert((select jsonb_agg(to_jsonb(c) order by c.control)
      from private.personal_working_shadow_comparisons c where c.source_prediction_id=frozen.id)=frozen.comparisons,
      'comparison rows remain byte-identical after every retry');
  end loop;
  for page in select * from pg_temp.candidate_feature_pages loop
    perform set_config('request.jwt.claim.sub',page.actor::text,true);
    perform set_config('role','authenticated',true);result:=public.rank_items_page_v1(page.request);perform set_config('role','postgres',true);
    perform pg_temp.candidate_feature_assert(result=page.response,'original actual V2/V3 serving receipt remains byte-identical');
  end loop;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.candidate_feature_assert(not has_function_privilege(role_name,'private.personal_working_explanation_v1(jsonb,text[])','EXECUTE'),
      'native candidate feature helper denies broad/API EXECUTE: '||role_name);
  end loop;
  perform pg_temp.candidate_feature_assert((select proconfig @> array['extra_float_digits=3'] from pg_proc
    where oid='private.record_personal_working_shadow_v1(uuid,text)'::regprocedure),'comparison writer preserves precision72 function-local SET3');
end;$candidate_fixture$;
select jsonb_build_object('personalWorkingCandidateFeatures',
  'PASS: actual BOOK/MOVIE mode/V2/V3 matrix; complete dense bounded candidate vectors; inert/overflow/invalid baseline OFF; exact binary delivery parity and caller0; correction/reset/catalogue freeze; genuine frozen V2 cursor with current eligibility; retries; private ACL') snapshot;
