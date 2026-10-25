import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

// Disposable local/CI only. Every record, temporary object and comparison is
// rolled back; no provider access, hosted mutation or model admission occurs.
export async function sharedPredictionCutoffSmokeSql() {
  return `begin;
${await personalTasteSessionFixtureSql()}
do $clock_smoke$
declare actor uuid := 'ab157000-0000-4000-8000-000000000001';
  profile uuid; session uuid := gen_random_uuid(); old_prediction uuid := gen_random_uuid();
  ordinary uuid := gen_random_uuid(); explicit uuid := gen_random_uuid(); chain uuid := gen_random_uuid();
  ids uuid[]; frozen jsonb; shadow jsonb; source private.prediction_runs%rowtype;
  before_count integer; future_event uuid := gen_random_uuid(); reset_receipt jsonb;
  after_reset uuid := gen_random_uuid(); reset_capture jsonb;
begin
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,created_at,context)
    values(session,actor,profile,now()-interval '5 minutes',now()-interval '5 minutes','{}');
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at,session_id)
    values(gen_random_uuid(),actor,profile,'ab157000-0000-4000-8000-000000000101','MOVIE','ITEM_RATED','{"rating":4}',
      now()-interval '2 minutes',now()-interval '2 minutes',session);
  perform * from private.rank_items_with_identity_v1(old_prediction,profile,'FOR_YOU','MOVIE',50,jsonb_build_object('sessionId',session));
  -- Genuine delivered-origin, matured synthetic history exercises ScenarioMemory.
  update private.prediction_runs set requested_at=now()-interval '3 hours',created_at=now()-interval '3 hours' where id=old_prediction;
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at,prediction_id)
    select gen_random_uuid(),actor,profile,c.item_id,'MOVIE',e.kind,e.body,now()-interval '2 hours',now()-interval '2 hours',old_prediction
    from private.prediction_candidates c cross join (values('ITEM_IMPRESSION','{}'::jsonb),('ITEM_RATED','{"rating":9}'::jsonb)) e(kind,body)
    where c.prediction_id=old_prediction and c.selected_for_delivery and c.item_id='ab157000-0000-4000-8000-000000000102';
  select array_agg(id order by id) into ids from public.items where item_type='MOVIE';
  perform * from private.rank_items_with_identity_v1(ordinary,profile,'FOR_YOU','MOVIE',50,jsonb_build_object('sessionId',session));
  frozen:=private.capture_personal_evaluation_v1(explicit,profile,ids,now()-interval '1 second',jsonb_build_object('sessionId',session));
  perform * from private.rank_items_catalog_with_identity_v1('{}',false,chain,profile,'FOR_YOU','MOVIE',50,jsonb_build_object('sessionId',session));
  if exists(select 1 from private.prediction_runs r where r.id=any(array[ordinary,explicit,chain]) and
    ((r.state_snapshot->>'asOf')::timestamptz<>now()
      or (r.state_snapshot#>>'{workingState,cutoff}')::timestamptz<>r.requested_at
      or r.state_snapshot#>>'{predictionInput,version}' is distinct from 'native-prediction-clocks-v1'
      or (r.state_snapshot#>>'{predictionInput,nativeEvidenceAsOf}')::timestamptz<>now()
      or (r.state_snapshot#>>'{predictionInput,memoryStateAsOf}')::timestamptz<>now()
      or (r.state_snapshot#>>'{predictionInput,scenarioAsOf}')::timestamptz<>now()
      or (r.state_snapshot#>>'{predictionInput,requestAsOf}')::timestamptz<>r.requested_at
      or r.state_snapshot#>>'{predictionInput,dataSnapshot}' is distinct from 'CURRENT_STATEMENT_SNAPSHOTS'
      or r.state_snapshot#>>'{predictionInput,commitVisibility}' is distinct from 'UNKNOWN')) then
    raise exception 'Shared logical cutoff/state declaration mismatch';
  end if;
  if exists(select 1 from private.prediction_candidates c where c.prediction_id=any(array[ordinary,explicit,chain]) and
    ((c.explanation#>>'{scoringFeatures,nativeEvidenceAsOf}')::timestamptz<>now()
      or (c.explanation#>>'{candidatePool,eligibilityAt}')::timestamptz<now())) then
    raise exception 'Candidate evidence/eligibility clock mismatch';
  end if;
  if not exists(select 1 from private.prediction_candidates c where c.prediction_id=ordinary and c.scenario_support>0) then
    raise exception 'Clock parity fixture did not exercise ScenarioMemory';
  end if;
  if exists(select 1 from private.prediction_candidates a full join private.prediction_candidates b
    on a.item_id=b.item_id and b.prediction_id=explicit where a.prediction_id=ordinary
    and (b.item_id is null or float8send(a.final_score)<>float8send(b.final_score)
      or float8send(a.scenario_score)<>float8send(b.scenario_score)))
    or (select count(*) from private.prediction_candidates where prediction_id=ordinary)
      <>(select count(*) from private.prediction_candidates where prediction_id=explicit) then
    raise exception 'Same-pool Discovery/evaluation scores differ';
  end if;
  if exists(select 1 from private.prediction_candidates a join private.prediction_candidates b using(item_id)
    where a.prediction_id=ordinary and b.prediction_id=chain and float8send(a.final_score)<>float8send(b.final_score)) then
    raise exception 'Same-pool catalogue-chain scores differ';
  end if;
  if (select state_snapshot#>>'{predictionInput,candidateAcquisition}' from private.prediction_runs where id=ordinary)<>'LEGACY_DISCOVERY'
    or (select state_snapshot#>>'{predictionInput,candidateAcquisition}' from private.prediction_runs where id=explicit)<>'EXPLICIT_CANONICAL'
    or (select state_snapshot#>>'{predictionInput,candidateAcquisition}' from private.prediction_runs where id=chain)<>'CATALOG_CHAIN' then
    raise exception 'Declared acquisition distinctions lost';
  end if;
  select * into source from private.prediction_runs where id=ordinary;
  shadow:=private.record_personal_working_shadow_v1(ordinary,'OFF');
  if (shadow->>'asOf')::timestamptz<>source.requested_at or exists(
    select 1 from jsonb_array_elements(shadow->'candidates') s join private.prediction_candidates c on c.item_id=(s->>'itemId')::uuid
    where c.prediction_id=ordinary and float8send((s->>'score')::float8)<>float8send(c.final_score)) then
    raise exception 'Frozen shadow diverged from source scores/cutoff';
  end if;
  -- Stored creation after the transaction clock must not enter a fresh Working
  -- capture under that same logical cutoff. This is not a commit-time certificate.
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at,session_id)
    values(future_event,actor,profile,'ab157000-0000-4000-8000-000000000103','MOVIE','ITEM_RATED','{"rating":0}',
      now()-interval '30 seconds',clock_timestamp(),session);
  if (select created_at from public.events where id=future_event)<=now() then raise exception 'Clock boundary fixture missing';end if;
  before_count:=jsonb_array_length(source.state_snapshot#>'{workingState,rawEvents}');
  if jsonb_array_length(private.capture_personal_working_state_v1(actor,profile,session,now())->'rawEvents')<>before_count then
    raise exception 'Working capture admitted a post-cutoff creation';
  end if;
  reset_receipt:=private.commit_personal_working_reset_v1(gen_random_uuid(),actor,profile,session);
  if (reset_receipt->>'createdAt')::timestamptz<=now() then raise exception 'Reset clock boundary fixture missing';end if;
  perform * from private.rank_items_with_identity_v1(after_reset,profile,'FOR_YOU','MOVIE',50,jsonb_build_object('sessionId',session));
  select state_snapshot->'workingState' into reset_capture from private.prediction_runs where id=after_reset;
  if reset_capture->>'status'<>'RESET_EMPTY' or not exists(select 1 from jsonb_array_elements(reset_capture->'resetControls') r
    where r->>'resetId'=reset_receipt->>'resetId') then
    raise exception 'Fresh serving lost the latest Working lifecycle reset';
  end if;
  update public.items set tags=array['changed-current-tag'] where id=any(ids);
  if private.record_personal_working_shadow_v1(ordinary,'OFF') is distinct from shadow
    or (select state_snapshot from private.prediction_runs where id=ordinary) is distinct from source.state_snapshot then
    raise exception 'Later rows changed frozen shadow/input evidence';
  end if;
end;$clock_smoke$;
select jsonb_build_object('sharedPredictionCutoff',
  'PASS: shared arithmetic clocks, separate current eligibility/Working, same-pool scenario scores, frozen OFF replay and latest Working reset') as snapshot;
rollback;`;
}
