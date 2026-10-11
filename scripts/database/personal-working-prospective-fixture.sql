-- Disposable native acceptance. This fixture owns separate committed setup,
-- enrollment and evidence transactions; wrapping it in one outer transaction
-- would manufacture a pre-commit exposure and invalidate prospective meaning.
begin;
create function pg_temp.working_prospective_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Personal Working prospective assertion: %',label;end if;end;$$;
create temp table working_prospective_original_items on commit preserve rows as select id,discoverable from public.items;
create temp table working_prospective_fixture(actor uuid,profile uuid,session uuid,source uuid,plan uuid,
  left_item uuid,right_item uuid,pairs jsonb,frozen_source jsonb,frozen_candidates jsonb,enrollment jsonb,capture jsonb)
  on commit preserve rows;
do $prospective_setup$
declare actor uuid:='a9172000-0000-4000-8000-000000000001';profile uuid;
  session uuid:='a9172000-0000-4000-8000-000000000010';plan uuid:='a9172000-0000-4000-8000-000000000030';
  evidence_a uuid:='a9172000-0000-4000-8000-000000000020';evidence_b uuid:='a9172000-0000-4000-8000-000000000021';
  command jsonb;request jsonb;page jsonb;source uuid;selected uuid[];pairs jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(actor,actor::text||'@example.invalid',
    jsonb_build_object('kajo_nickname','Prospective native'));
  select p.id into strict profile from public.profiles p where p.owner_user_id=actor and p.profile_type='PERSONAL';
  update public.items set discoverable=false;
  insert into public.items(id,item_type,title,tags,discoverable) values
    (evidence_a,'BOOK','Prospective zero input',array['native-prospective-warm'],false),
    (evidence_b,'BOOK','Prospective positive input',array['native-prospective-warm'],false);
  insert into public.items(id,item_type,title,tags,discoverable)
    select md5('native-working-prospective-candidate:'||n)::uuid,'BOOK','Native prospective candidate '||n,
      array['native-prospective-warm'],true from generate_series(1,4) n;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  command:=jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,'profileId',profile,
    'itemId',evidence_a,'occurredAt',now()-interval '4 minutes','discoveryMode','FOR_YOU','predictionId',null,
    'session',jsonb_build_object('sessionId',session,'startedAt',now()-interval '5 minutes','context','{}'::jsonb),
    'kind','SET_RATING','rating',0);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  command:=command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_b,'occurredAt',now()-interval '3 minutes','rating',10);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  request:=jsonb_build_object('version',3,'requestId',gen_random_uuid(),'profileId',profile,'sessionId',session,
    'discoveryMode','FOR_YOU','itemType','BOOK','limit',2,'context','{}'::jsonb);
  perform set_config('role','authenticated',true);page:=public.rank_items_page_v1(request);perform set_config('role','postgres',true);
  source:=(page->>'predictionId')::uuid;
  select array_agg(c.item_id order by c.final_rank) into selected from private.prediction_candidates c
    where c.prediction_id=source and c.selected_for_delivery;
  perform pg_temp.working_prospective_assert(cardinality(selected)=2 and (select r.state_snapshot#>>'{workingState,version}'='native-working-capture-v3'
    from private.prediction_runs r where r.id=source),'actual private version3 OFF page freezes two selected candidates');
  pairs:=jsonb_build_array(jsonb_build_object('pairId',gen_random_uuid(),'leftItemId',selected[1],'rightItemId',selected[2]));
  insert into pg_temp.working_prospective_fixture values(actor,profile,session,source,plan,selected[1],selected[2],pairs,
    (select to_jsonb(r) from private.prediction_runs r where r.id=source),
    (select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c where c.prediction_id=source),null,null);
end;$prospective_setup$;
commit;

begin;
do $prospective_enroll$
declare f record;receipt jsonb;
begin
  select * into strict f from pg_temp.working_prospective_fixture;
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  receipt:=private.enroll_personal_working_evaluation_v1(f.plan,f.source,f.pairs,1,0);
  perform pg_temp.working_prospective_assert(receipt->>'version'='personal-working-enrollment-v1'
    and receipt->>'enrollmentId'=f.plan::text and receipt->>'sourcePredictionId'=f.source::text
    and receipt->'pairs'=f.pairs and jsonb_array_length(receipt->'controls')=3
    and receipt->>'commitAvailability'='UNKNOWN' and receipt->'historicalFeatureEligible'='false'::jsonb
    and receipt->'learnable'='false'::jsonb and receipt->'nativeActivated'='false'::jsonb,
    'native enrollment freezes exact source/pairs/controls with closed admission');
  perform pg_temp.working_prospective_assert(private.enroll_personal_working_evaluation_v1(f.plan,f.source,f.pairs,1,0)=receipt,
    'exact retry returns the immutable enrollment before committed observation');
  update pg_temp.working_prospective_fixture set enrollment=receipt;
end;$prospective_enroll$;
commit;

begin;
do $prospective_evidence$
declare f record;item uuid;
begin
  select * into strict f from pg_temp.working_prospective_fixture;
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  foreach item in array array[f.left_item,f.right_item] loop
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,
      session_id,prediction_id,discovery_mode,properties)
      values(gen_random_uuid(),f.actor,f.profile,item,'BOOK','ITEM_IMPRESSION',clock_timestamp(),f.session,f.source,'FOR_YOU','{}');
  end loop;
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,
    session_id,prediction_id,discovery_mode,properties)
    values(gen_random_uuid(),f.actor,f.profile,f.left_item,'BOOK','ITEM_RATED',clock_timestamp(),f.session,f.source,'FOR_YOU','{"rating":9}');
  -- Wasm clocks may have millisecond granularity. Wait for an actual later
  -- server instant so this fixture tests replacement rather than an honest tie.
  perform pg_sleep(0.01);
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,
    session_id,prediction_id,discovery_mode,properties)
    values(gen_random_uuid(),f.actor,f.profile,f.left_item,'BOOK','ITEM_RATED',clock_timestamp(),f.session,f.source,'FOR_YOU','{"rating":0}');
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,
    session_id,prediction_id,discovery_mode,properties)
    values(gen_random_uuid(),f.actor,f.profile,f.right_item,'BOOK','ITEM_RATED',clock_timestamp(),f.session,f.source,'FOR_YOU','{"rating":10}');
end;$prospective_evidence$;
commit;
-- Keep setup and maturity waits silent for the native JSON-line reader.
do $prospective_mature$ begin perform pg_sleep(1.1);end;$prospective_mature$;

begin;
do $prospective_capture$
declare f record;receipt jsonb;owned_capture_id uuid:=gen_random_uuid();role_name text;
begin
  select * into strict f from pg_temp.working_prospective_fixture;
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  receipt:=private.capture_personal_working_outcomes_v1(owned_capture_id,f.plan);
  perform pg_temp.working_prospective_assert(receipt->>'version'='personal-working-outcomes-v1' and receipt->'complete'='true'::jsonb
    and receipt->>'resolutionVersion'='personal-latest-terminal-v1' and jsonb_array_length(receipt->'labels')=2
    and exists(select 1 from jsonb_array_elements(receipt->'labels') l where l->>'itemId'=f.left_item::text
      and l->>'status'='observed' and l->'rating'='0'::jsonb and l->>'exposureId' is not null)
    and exists(select 1 from jsonb_array_elements(receipt->'labels') l where l->>'itemId'=f.right_item::text
      and l->>'status'='observed' and l->'rating'='10'::jsonb and l->>'exposureId' is not null)
    and receipt->'historicalFeatureEligible'='false'::jsonb and receipt->'learnable'='false'::jsonb
    and receipt->'nativeActivated'='false'::jsonb,
    'later committed own impressions plus latest zero/positive labels retain exact uncalibrated observed provenance');
  perform pg_temp.working_prospective_assert(private.capture_personal_working_outcomes_v1(owned_capture_id,f.plan)=receipt,
    'exact matured capture retry is immutable');
  perform pg_temp.working_prospective_assert((select to_jsonb(r) from private.prediction_runs r where r.id=f.source)=f.frozen_source
    and (select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c where c.prediction_id=f.source)=f.frozen_candidates,
    'prospective captures never rewrite original source/scorer/candidate bytes');
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.working_prospective_assert(not has_function_privilege(role_name,
      'private.enroll_personal_working_evaluation_v1(uuid,uuid,jsonb,integer,integer)','EXECUTE')
      and not has_function_privilege(role_name,'private.capture_personal_working_outcomes_v1(uuid,uuid)','EXECUTE')
      and not has_table_privilege(role_name,'private.personal_working_enrollments','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege(role_name,'private.personal_working_outcome_allocations','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege(role_name,'private.personal_working_outcome_captures','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege(role_name,'private.personal_working_outcome_event_refs','SELECT,INSERT,UPDATE,DELETE'),
      'native internal enrollment/capture/lineage ACL: '||role_name);
  end loop;
  perform private.erase_prediction_sources_v1('PREDICTION_RUN',f.source);
  perform pg_temp.working_prospective_assert(not exists(select 1 from private.personal_working_enrollments e where e.id=f.plan)
    and not exists(select 1 from private.personal_working_outcome_captures c where c.id=owned_capture_id)
    and not exists(select 1 from private.personal_working_outcome_event_refs r where r.capture_id=owned_capture_id),
    'genuine source withdrawal atomically cascades enrollment/capture/raw lineage');
  perform private.erase_prediction_sources_v1('ACTOR',f.actor);
  delete from public.item_interactions where actor_user_id=f.actor;
  delete from auth.users where id=f.actor;
  delete from public.items where id in('a9172000-0000-4000-8000-000000000020','a9172000-0000-4000-8000-000000000021')
    or id in(select md5('native-working-prospective-candidate:'||n)::uuid from generate_series(1,4) n);
  update public.items i set discoverable=old.discoverable from pg_temp.working_prospective_original_items old where old.id=i.id;
  perform pg_temp.working_prospective_assert(not exists(select 1 from public.events e where e.actor_user_id=f.actor)
    and not exists(select 1 from auth.users u where u.id=f.actor),'all owned native fixture rows are removed');
end;$prospective_capture$;
commit;
drop table pg_temp.working_prospective_fixture;
drop table pg_temp.working_prospective_original_items;
drop function pg_temp.working_prospective_assert(boolean,text);
select jsonb_build_object('personalWorkingProspective',
  'PASS: actual version3 source; committed prospective enrollment; frozen OFF controls; own receipt-bound exposures; latest rating zero; immutable retries; private ACL; source-erasure lineage; owned cleanup') snapshot;
