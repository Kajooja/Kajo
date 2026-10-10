-- Disposable full native runtime acceptance. The caller owns BEGIN/ROLLBACK.
create function pg_temp.working_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Personal Working assertion: %',label;end if;end;$$;
do $native_working$
declare
  actor uuid := 'a9147000-0000-4000-8000-000000000001';
  evidence_a uuid := 'a9147000-0000-4000-8000-000000000020';
  evidence_b uuid := 'a9147000-0000-4000-8000-000000000021';
  session_id uuid := 'a9147000-0000-4000-8000-000000000030';
  profile_id uuid; source_id uuid; command jsonb; receipt jsonb; retry_receipt jsonb; page_request jsonb; page jsonb;
  capture jsonb; frozen_source jsonb; frozen_candidates jsonb; shadow_off jsonb; shadow_static jsonb; shadow_ordered jsonb;
  old_rows jsonb; candidate record; role_name text; signature text; expected double precision;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(actor,actor::text||'@example.invalid',
    jsonb_build_object('kajo_nickname','Native Working fixture'));
  select id into strict profile_id from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.items(id,item_type,title,tags,discoverable) values
    (evidence_a,'BOOK','Working zero source',array['native-working-warm'],false),
    (evidence_b,'BOOK','Working positive source',array['native-working-warm'],false);
  insert into public.items(id,item_type,title,tags,discoverable)
    select md5('working-native-candidate:'||n)::uuid,'BOOK','Working candidate '||n,
      case when n%2=0 then array['native-working-warm'] else array['native-working-cold'] end,true
      from generate_series(1,6) n;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  command := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,'profileId',profile_id,
    'itemId',evidence_a,'occurredAt',now()-interval '4 minutes','discoveryMode','FOR_YOU','predictionId',null,
    'session',jsonb_build_object('sessionId',session_id,'startedAt',now()-interval '5 minutes','context','{}'::jsonb),
    'kind','SET_RATING','rating',0);
  perform set_config('role','authenticated',true);receipt := public.commit_item_action_v1(command);
  retry_receipt := public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  perform pg_temp.working_assert(retry_receipt=receipt,'exact actual zero-command retry');
  command := command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_b,'occurredAt',now()-interval '3 minutes','rating',10);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  capture := private.capture_personal_working_state_v1(actor,profile_id,session_id,clock_timestamp());
  expected := 0.25::double precision*(1-sqrt(0.5::double precision))/(1+sqrt(0.5::double precision));
  perform pg_temp.working_assert(capture->>'version'='native-working-capture-v1' and capture->>'status'='ACTIVE'
    and capture#>>'{support,distinctItems}'='2' and capture->'prefixComplete'='true'::jsonb,
    'canonical zero/positive commands supply two independent native session Items');
  perform pg_temp.working_assert(abs(private.personal_working_adjustment_v1(capture,array['native-working-warm'],'ORDERED')-expected)<1e-12
    and private.personal_working_adjustment_v1(capture,array['native-working-warm'],'STATIC')=0
    and private.personal_working_adjustment_v1(capture,array['native-working-warm'])=0,
    'independent ordered/static/default-off numeric oracle');

  page_request := jsonb_build_object('version',3,'requestId',gen_random_uuid(),'profileId',profile_id,
    'sessionId',session_id,'discoveryMode','FOR_YOU','itemType','BOOK','limit',2,'context','{}'::jsonb);
  perform set_config('role','authenticated',true);page := public.rank_items_page_v1(page_request);
  perform set_config('role','postgres',true);source_id := (page->>'predictionId')::uuid;
  select to_jsonb(r) into strict frozen_source from private.prediction_runs r where id=source_id;
  select jsonb_agg(to_jsonb(c) order by c.final_rank) into frozen_candidates from private.prediction_candidates c where c.prediction_id=source_id;
  perform pg_temp.working_assert(frozen_source#>>'{state_snapshot,workingState,status}'='ACTIVE',
    'actual new Personal PredictionRun freezes the authorized capture before score consumption');
  shadow_off := private.record_personal_working_shadow_v1(source_id,'OFF');
  shadow_static := private.record_personal_working_shadow_v1(source_id,'STATIC');
  shadow_ordered := private.record_personal_working_shadow_v1(source_id,'ORDERED');
  perform pg_temp.working_assert(jsonb_array_length(shadow_off->'candidates')=(frozen_source->>'candidate_count')::integer
    and (select count(*) from private.personal_working_shadow_comparisons where source_prediction_id=source_id)=3,
    'real private comparison rows contain the complete frozen candidate pool for three controls');
  perform pg_temp.working_assert(not exists(
    select 1 from private.prediction_candidates p full join jsonb_array_elements(shadow_off->'candidates') s(value)
      on p.prediction_id=source_id and p.item_id=(s.value->>'itemId')::uuid
    where (p.prediction_id=source_id or s.value is not null) and (p.item_id is null or s.value is null
      or p.final_score is distinct from (s.value->>'score')::double precision
      or p.final_rank is distinct from (s.value->>'rank')::integer
      or p.selected_for_delivery is distinct from (s.value->>'selected')::boolean
      or private.prediction_delivery_tier_v1(p.explanation->'resurfacingPolicy') is distinct from (s.value->>'tier')::integer
      or coalesce((p.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) is distinct from (s.value->>'eligible')::boolean
      or (s.value->>'adjustment')::double precision<>0)),
    'default OFF preserves exact Items/scores/ranks/tier/eligibility/selection');
  perform pg_temp.working_assert(exists(select 1 from jsonb_array_elements(shadow_ordered->'candidates') s
    where (s->>'adjustment')::double precision>0) and not exists(select 1 from jsonb_array_elements(shadow_static->'candidates') s
    where (s->>'adjustment')::double precision<>0),'ordered and static are genuine separately scored frozen ablations');
  select jsonb_agg(to_jsonb(c) order by control) into old_rows
    from private.personal_working_shadow_comparisons c where c.source_prediction_id=source_id;
  command := command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_a,'occurredAt',now()-interval '2 minutes','rating',10);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  perform pg_temp.working_assert(private.personal_working_adjustment_v1(
    private.capture_personal_working_state_v1(actor,profile_id,session_id,clock_timestamp()),array['native-working-warm'],'ORDERED')=0.25,
    'prospective correction changes a future capture');
  update public.items set tags=array['changed-after-capture'],discoverable=false
    where id in(evidence_a,evidence_b) or title like 'Working candidate %';
  perform pg_temp.working_assert(private.record_personal_working_shadow_v1(source_id,'OFF')=shadow_off
    and private.record_personal_working_shadow_v1(source_id,'STATIC')=shadow_static
    and private.record_personal_working_shadow_v1(source_id,'ORDERED')=shadow_ordered,
    'exact control retries preserve copied inputs after native evidence/catalogue changes');
  perform pg_temp.working_assert((select jsonb_agg(to_jsonb(c) order by control)
    from private.personal_working_shadow_comparisons c where c.source_prediction_id=source_id)=old_rows
    and (select to_jsonb(r) from private.prediction_runs r where id=source_id)=frozen_source
    and (select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c where c.prediction_id=source_id)=frozen_candidates,
    'source/candidate/comparison artifact bytes remain immutable');
  perform set_config('role','authenticated',true);retry_receipt := public.rank_items_page_v1(page_request);
  perform set_config('role','postgres',true);
  perform pg_temp.working_assert(retry_receipt=page,'actual serving request retry remains exact');
  foreach role_name in array array['anon','authenticated','service_role'] loop
    foreach signature in array array[
      'private.capture_personal_working_state_v1(uuid,uuid,uuid,timestamptz)',
      'private.personal_working_adjustment_v1(jsonb,text[],text)',
      'private.personal_working_explanation_v1(jsonb,text[])',
      'private.prediction_candidate_score_working_v1(text,jsonb,double precision,jsonb,text)',
      'private.guard_personal_working_comparison_v1()',
      'private.record_personal_working_shadow_v1(uuid,text)'] loop
      perform pg_temp.working_assert(not has_function_privilege(role_name,signature,'EXECUTE'),'private API ACL: '||role_name||'/'||signature);
    end loop;
    perform pg_temp.working_assert(not has_table_privilege(role_name,'private.personal_working_shadow_comparisons','SELECT,INSERT,UPDATE,DELETE'),
      'copied private comparison has no API grants: '||role_name);
  end loop;
  perform private.erase_prediction_sources_v1('PREDICTION_RUN',source_id);
  perform pg_temp.working_assert(not exists(select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=source_id),
    'canonical source erasure removes every copied comparison');
end;$native_working$;
select jsonb_build_object('personalWorkingBridge',
  'PASS: actual canonical native Personal capture; independent ordered/static/OFF oracle; frozen real serving/comparison parity; future correction isolation; exact retries; private ACL; source erasure') snapshot;
