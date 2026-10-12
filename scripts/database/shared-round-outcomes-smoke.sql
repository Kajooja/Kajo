create function pg_temp.assert_outcome(value jsonb, state text, revision integer) returns void
language plpgsql as $$ begin
  if value is null or value->>'contractVersion' is distinct from 'shared-round-outcome-v1'
    or value->>'sourceBasis' is distinct from 'COMMAND_RECEIPT_PREFIX'
    or value->>'availabilityBasis' is distinct from 'SERVER_COMMAND_ACCEPTED_AT'
    or value->'historicalFeatureEligible' is distinct from 'false'::jsonb
    or value->>'membershipValidity' is distinct from 'HISTORICAL_MEMBERSHIP_UNKNOWN'
    or value->>'commitVisibility' is distinct from 'UNKNOWN' or value->>'vectorStatus' is distinct from state
    or value#>'{source,revision}' is distinct from to_jsonb(revision) or value->'groupReward' is distinct from 'null'::jsonb
    or value->'learnable' is distinct from 'false'::jsonb then raise exception 'Outcome replay contract/state mismatch: %',value; end if;
end; $$;
create function pg_temp.reject_outcome(profile uuid, round uuid, outcome_at timestamptz, evidence_at timestamptz, maturity interval)
returns void language plpgsql as $$ begin
  begin perform private.shared_rating_round_outcome_v1(profile,round,outcome_at,evidence_at,maturity);
  exception when invalid_parameter_value then return; end;
  raise exception 'Invalid outcome cutoff/maturity was accepted';
end; $$;

-- Privileged synthetic receipt insertions model server-clock regression/ties.
-- They create their own new lineage; immutable existing receipts are not edited.
create function pg_temp.synthetic_outcome(profile uuid,item uuid,actor uuid,partner uuid,round uuid,times timestamptz[])
returns void language plpgsql as $$
declare participants jsonb; responses jsonb; snapshot jsonb; command jsonb; revision integer;
begin
  select r.participants into strict participants from private.shared_rating_rounds r where r.id=(select f.round from pg_temp.outcome_fixture f);
  insert into private.shared_rating_rounds(id,profile_id,item_id,experience_id,created_by_user_id,revision,
    participant_set_version,participants,current_state,created_at,updated_at)
    values(round,profile,item,gen_random_uuid(),actor,3,1,participants,'COMPLETED',times[1],times[3]);
  insert into private.shared_rating_round_responses(round_id,revision,participant_set_version,actor_user_id,status,rating,origin,received_at)
    values(round,2,1,actor,'RATED',0,null,times[2]),(round,3,1,partner,'RATED',10,null,times[3]);
  for revision in 1..3 loop
    responses := jsonb_build_array(
      jsonb_build_object('actorUserId',actor,'status',case when revision=1 then 'UNANSWERED' else 'RATED' end,
        'rating',case when revision=1 then null else 0 end,'responseRevision',case when revision=1 then null else 2 end,
        'receivedAt',case when revision=1 then null else times[2] end,'origin',null),
      jsonb_build_object('actorUserId',partner,'status',case when revision<3 then 'UNANSWERED' else 'RATED' end,
        'rating',case when revision<3 then null else 10 end,'responseRevision',case when revision<3 then null else 3 end,
        'receivedAt',case when revision<3 then null else times[3] end,'origin',null));
    snapshot := jsonb_build_object('version',1,'roundId',round,'experienceId',(select experience_id from private.shared_rating_rounds where id=round),
      'profileId',profile,'itemId',item,'revision',revision,'participantSetVersion',1,'participants',participants,
      'state',case when revision=3 then 'COMPLETED' else 'PENDING' end,'responses',responses,
      'createdAt',times[1],'updatedAt',times[revision],'groupReward',null,'learnable',false);
    command := pg_temp.outcome_command(case when revision=3 then partner else actor end,profile,round,
      case when revision=1 then 'OPEN_ROUND' else 'SET_RESPONSE' end,revision-1,
      case when revision=1 then jsonb_build_object('itemId',item,'experienceId',snapshot->'experienceId')
        else jsonb_build_object('rating',case when revision=2 then 0 else 10 end) end);
    insert into private.shared_rating_round_receipts(command_id,actor_user_id,profile_id,round_id,command,result,created_at)
      values((command->>'commandId')::uuid,(command->>'actorUserId')::uuid,profile,round,command,
        jsonb_build_object('version',1,'commandId',command->'commandId','round',snapshot),times[revision]);
  end loop;
end; $$;

do $outcomes$
declare
  f record; checkpoint record; value jsonb; frozen jsonb; repeated jsonb; request jsonb; response jsonb;
  t1 timestamptz; t2 timestamptz; t3 timestamptz; t4 timestamptz; current_cutoff timestamptz;
  n_round uuid := gen_random_uuid(); rewatch uuid := gen_random_uuid(); origin_round uuid := gen_random_uuid();
  skew_round uuid := gen_random_uuid(); regression_round uuid := gen_random_uuid(); tied_round uuid := gen_random_uuid(); dst_round uuid := gen_random_uuid();
  gap_round uuid := gen_random_uuid(); duplicate_round uuid := gen_random_uuid(); duplicate_command uuid := gen_random_uuid();
  origin_session uuid := gen_random_uuid(); delivery jsonb; origin jsonb; selected_item uuid; proof uuid := gen_random_uuid();
  backdated_proof uuid := gen_random_uuid();
  response_at timestamptz; proof_available timestamptz; proof_occurred timestamptz; origin_command jsonb;
  before_events integer; before_interactions text; before_receipts text; after_receipts text; denied_role text;
  source_round jsonb; stamp timestamptz := clock_timestamp()-interval '5 days'; anchor timestamptz;
begin
  select * into strict f from pg_temp.outcome_fixture;
  select accepted_at into strict t1 from pg_temp.outcome_receipts where revision=1;
  select accepted_at into strict t2 from pg_temp.outcome_receipts where revision=2;
  select accepted_at into strict t3 from pg_temp.outcome_receipts where revision=3;
  select accepted_at into strict t4 from pg_temp.outcome_receipts where revision=4;
  select count(*) into before_events from public.events;
  select md5(coalesce(jsonb_agg(to_jsonb(i) order by to_jsonb(i)::text),'[]'::jsonb)::text)
    into before_interactions from public.item_interactions i;
  foreach denied_role in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(denied_role,'private.shared_rating_round_outcome_v1(uuid,uuid,timestamp with time zone,timestamp with time zone,interval)','execute') then
      raise exception 'Outcome reader EXECUTE leaked to %',denied_role; end if;
    perform set_config('role',denied_role,true);
    begin
      perform private.shared_rating_round_outcome_v1(f.pair,f.round,t3,t3,interval '0 seconds');
      raise exception 'API role directly executed private outcome reader';
    exception when insufficient_privilege then null; end;
    perform set_config('role','postgres',true);
  end loop;
  if (select prosecdef from pg_proc where oid='private.shared_rating_round_outcome_v1(uuid,uuid,timestamptz,timestamptz,interval)'::regprocedure) then
    raise exception 'Private outcome reader unexpectedly escalates privileges'; end if;
  perform pg_temp.reject_outcome(f.pair,f.round,null,t3,interval '0 seconds');
  perform pg_temp.reject_outcome(f.pair,f.round,t3,null,interval '0 seconds');
  perform pg_temp.reject_outcome(f.pair,f.round,t3,t3,null);
  perform pg_temp.reject_outcome(f.pair,f.round,'infinity',t3,interval '0 seconds');
  perform pg_temp.reject_outcome(f.pair,f.round,t3,'-infinity',interval '0 seconds');
  perform pg_temp.reject_outcome(f.pair,f.round,clock_timestamp()+interval '1 day',t3,interval '0 seconds');
  perform pg_temp.reject_outcome(f.pair,f.round,t3,clock_timestamp()+interval '1 day',interval '0 seconds');
  perform pg_temp.reject_outcome(f.pair,f.round,t3,t3,interval '-1 second');
  perform pg_temp.reject_outcome(f.pair,f.round,t3,t3,interval '91 days');
  perform pg_temp.reject_outcome(f.pair,f.round,t3,t3,interval '1 month');
  perform pg_temp.reject_outcome(f.pair,f.round,t3,t3,interval '1 month -30 days');
  perform pg_temp.reject_outcome(f.personal,f.round,t4,t4,interval '0 seconds');
  if private.shared_rating_round_outcome_v1(f.pair,f.round,t1-interval '1 microsecond',t4,interval '0 seconds') is not null
    or private.shared_rating_round_outcome_v1(f.pair,gen_random_uuid(),t4,t4,interval '0 seconds') is not null then
    raise exception 'No visible round/foreign scope fabricated a joint result'; end if;
  value := private.shared_rating_round_outcome_v1(f.pair,f.round,t1,t1,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',1);
  if value#>'{coverage,ratedCount}'<>'0'::jsonb or value#>'{coverage,unansweredCount}'<>'2'::jsonb then
    raise exception 'OPEN acquired implicit confirmations'; end if;
  value := private.shared_rating_round_outcome_v1(f.pair,f.round,t2,t4,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',2);
  if value#>'{coverage,ratedCount}'<>'1'::jsonb or value#>'{responses,0,rating}'<>'0'::jsonb
    or value#>'{descriptive,minRating}'<>'null'::jsonb then raise exception 'One zero rating became completed joint preference'; end if;
  repeated := private.shared_rating_round_outcome_v1(f.pair,f.round,t4,t2,interval '0 seconds');
  if repeated->'round'<>value->'round' or repeated->'source'<>value->'source' then
    raise exception 'Evidence and outcome bounds did not independently limit one receipt prefix'; end if;
  frozen := private.shared_rating_round_outcome_v1(f.pair,f.round,t3,t3,interval '0 seconds');
  perform pg_temp.assert_outcome(frozen,'READY_FOR_VECTOR_REVIEW',3);
  select result->'round' into strict source_round from pg_temp.outcome_receipts where revision=3;
  if frozen->'round'<>source_round or frozen#>'{coverage,participantCount}'<>'2'::jsonb
    or frozen#>'{coverage,ratedCount}'<>'2'::jsonb or frozen#>'{coverage,eligibleVectorResponseCount}'<>'0'::jsonb
    or frozen#>'{descriptive,minRating}'<>'0'::jsonb or frozen#>'{descriptive,ratingSpread}'<>'10'::jsonb
    or exists(select 1 from jsonb_array_elements(frozen->'responses') r where r#>>'{attribution,status}'<>'UNRANKED') then
    raise exception 'Frozen completion lost disagreement/zero or invented exposure/support'; end if;
  value := private.shared_rating_round_outcome_v1(f.pair,f.round,t3,t3,interval '1 day');
  perform pg_temp.assert_outcome(value,'IMMATURE',3);
  if value#>'{maturity,intervalSeconds}'<>'86400'::jsonb or value#>'{coverage,eligibleVectorResponseCount}'<>'0'::jsonb then
    raise exception 'Maturity was not explicit elapsed time'; end if;
  value := private.shared_rating_round_outcome_v1(f.pair,f.round,t4,t4,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',4);
  if value#>'{coverage,clearedCount}'<>'1'::jsonb or value#>'{coverage,ratedCount}'<>'1'::jsonb then
    raise exception 'Later clear retained a stale completed label'; end if;

  -- Current membership/catalog/head changes must not rewrite a historical receipt.
  delete from public.profile_members where profile_id=f.pair and user_id=f.partner;
  insert into public.profile_members(profile_id,user_id) values(f.pair,f.partner);
  update public.items set tags=array['changed-after-round'],discoverable=false where id=f.book;
  if private.shared_rating_round_outcome_v1(f.pair,f.round,t3,t3,interval '0 seconds')<>frozen then
    raise exception 'Current membership/catalog changes refit frozen historical outcome'; end if;
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,f.round,'RECONFIRM_ROUND',4));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.pair,f.round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',5);
  if value#>'{source,participantSetVersion}'<>'2'::jsonb or value#>'{coverage,ratedCount}'<>'0'::jsonb then
    raise exception 'New enrollment reused earlier participant answers'; end if;
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,f.round,'SET_RESPONSE',5,'{"rating":null}'));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.pair,f.round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',6);
  if value#>'{coverage,unknownCount}'<>'1'::jsonb or value#>'{responses,0,rating}'<>'null'::jsonb then
    raise exception 'Unknown was converted into rating zero'; end if;
  response := pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.pair,f.round,'SET_RESPONSE',6,'{"rating":8}'));
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,f.round,'SET_RESPONSE',7,'{"rating":4}'));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.pair,f.round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'READY_FOR_VECTOR_REVIEW',8);
  if value#>'{descriptive,minRating}'<>'4'::jsonb or value#>'{descriptive,ratingSpread}'<>'4'::jsonb then
    raise exception 'Corrected participant vector retained old ratings'; end if;
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,f.round,'CANCEL_ROUND',8));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.pair,f.round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'CANCELLED',9);
  if value#>'{descriptive,minRating}'<>'null'::jsonb or value#>'{coverage,eligibleVectorResponseCount}'<>'0'::jsonb
    or private.shared_rating_round_outcome_v1(f.pair,f.round,t3,t3,interval '0 seconds')<>frozen then
    raise exception 'Cancellation became success or changed the old cutoff label'; end if;
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,rewatch,'OPEN_ROUND',0,
    jsonb_build_object('itemId',f.book,'experienceId',gen_random_uuid())));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.pair,rewatch,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',1);
  if value#>'{coverage,ratedCount}'<>'0'::jsonb then raise exception 'Separate experience borrowed old Item answers'; end if;

  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.multi,n_round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',f.movie,'experienceId',gen_random_uuid())));
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.multi,n_round,'SET_RESPONSE',1,'{"rating":0}'));
  response := pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.multi,n_round,'SET_RESPONSE',2,'{"rating":5}'));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.multi,n_round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',3);
  if value#>'{coverage,participantCount}'<>'3'::jsonb or value#>'{coverage,unansweredCount}'<>'1'::jsonb then
    raise exception 'N-member round completed after only two answers'; end if;
  response := pg_temp.outcome_commit(f.third,pg_temp.outcome_command(f.third,f.multi,n_round,'SET_RESPONSE',3,'{"rating":null}'));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.multi,n_round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',4);
  response := pg_temp.outcome_commit(f.third,pg_temp.outcome_command(f.third,f.multi,n_round,'SET_RESPONSE',4,'{"rating":10}'));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.multi,n_round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'READY_FOR_VECTOR_REVIEW',5);
  if value#>'{coverage,ratedCount}'<>'3'::jsonb or value#>'{descriptive,minRating}'<>'0'::jsonb
    or value#>'{descriptive,ratingSpread}'<>'10'::jsonb then raise exception 'N-member vector lost separate zero/disagreement'; end if;

  -- Unacknowledged exposure can prove a response later, without editing origin.
  perform set_config('request.jwt.claim.sub',f.actor::text,true);
  perform set_config('role','authenticated',true);
  delivery := public.rank_items_page_v1(jsonb_build_object('version',3,'requestId',gen_random_uuid(),
    'profileId',f.pair,'sessionId',origin_session,'discoveryMode','FOR_YOU','itemType','MOVIE','limit',10,'context','{}'::jsonb));
  perform set_config('role','postgres',true);
  selected_item := (delivery#>>'{items,0,item_id}')::uuid;
  if selected_item is null then raise exception 'Origin fixture has no actual selected Item'; end if;
  proof_occurred := clock_timestamp();
  origin := jsonb_build_object('predictionId',delivery->'predictionId','sessionId',origin_session,'discoveryMode','FOR_YOU');
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,origin_round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',selected_item,'experienceId',gen_random_uuid())));
  origin_command := pg_temp.outcome_command(f.actor,f.pair,origin_round,'SET_RESPONSE',1,jsonb_build_object('rating',0,'origin',origin));
  response := pg_temp.outcome_commit(f.actor,origin_command);
  select created_at into strict response_at from private.shared_rating_round_receipts where command_id=(origin_command->>'commandId')::uuid;
  frozen := private.shared_rating_round_outcome_v1(f.pair,origin_round,response_at,response_at,interval '0 seconds');
  if frozen#>>'{responses,0,origin,status}'<>'UNATTRIBUTED' or frozen#>>'{responses,0,attribution,status}'<>'UNATTRIBUTED' then
    raise exception 'Missing proof fabricated exposure'; end if;
  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
    values(origin_session,f.actor,f.pair,(delivery#>>'{source,featureAt}')::timestamptz,'{}'::jsonb);
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode,created_at)
    values(proof,f.actor,f.pair,selected_item,'MOVIE','ITEM_IMPRESSION',proof_occurred,origin_session,(delivery->>'predictionId')::uuid,'FOR_YOU',clock_timestamp());
  select created_at into strict proof_available from public.events where id=proof;
  value := private.shared_rating_round_outcome_v1(f.pair,origin_round,response_at,proof_available,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',2);
  if value#>>'{responses,0,attribution,status}'<>'LATE_EXPOSURE_V1'
    or value#>'{responses,0,attribution,predictionId}'<>delivery->'predictionId'
    or value#>>'{responses,0,attribution,proofEventId}'<>proof::text
    or value#>>'{responses,0,attribution,proofAvailabilityBasis}'<>'STORED_EVENT_CREATED_AT'
    or value#>>'{responses,0,origin,status}'<>'UNATTRIBUTED'
    or value#>'{coverage,attributedRatingCount}'<>'1'::jsonb
    or value#>'{coverage,eligibleVectorResponseCount}'<>'0'::jsonb
    or private.shared_rating_round_outcome_v1(f.pair,origin_round,response_at,response_at,interval '0 seconds')<>frozen then
    raise exception 'Late proof lost its evidence cutoff or rewrote recorded origin'; end if;
  -- Existing Event created_at is writable, so this is an explicitly declared
  -- stored-timestamp convention, never proof of actual historical availability.
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode,created_at)
    values(backdated_proof,f.actor,f.pair,selected_item,'MOVIE','ITEM_IMPRESSION',proof_occurred,origin_session,
      (delivery->>'predictionId')::uuid,'FOR_YOU',response_at-interval '1 microsecond');
  value := private.shared_rating_round_outcome_v1(f.pair,origin_round,response_at,response_at,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',2);
  if value#>>'{responses,0,attribution,proofEventId}'<>backdated_proof::text
    or value#>>'{responses,0,attribution,proofAvailabilityBasis}'<>'STORED_EVENT_CREATED_AT'
    or value->'historicalFeatureEligible'<>'false'::jsonb or value->>'commitVisibility'<>'UNKNOWN' then
    raise exception 'Backdated Event timestamp acquired trusted availability/admission'; end if;
  response := pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.pair,origin_round,'SET_RESPONSE',2,
    jsonb_build_object('rating',10,'origin',origin)));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.pair,origin_round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'READY_FOR_VECTOR_REVIEW',3);
  if value#>>'{responses,1,attribution,status}'<>'UNATTRIBUTED'
    or value#>'{coverage,attributedRatingCount}'<>'1'::jsonb or value#>'{coverage,eligibleVectorResponseCount}'<>'1'::jsonb then
    raise exception 'Another actor borrowed proof or multiplied one attributable response'; end if;
  response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,origin_round,'SET_RESPONSE',3,
    jsonb_build_object('rating',0,'origin',origin)));
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.pair,origin_round,current_cutoff,current_cutoff,interval '0 seconds');
  if value#>>'{responses,0,origin,status}'<>'VALIDATED_TRACE' or value#>>'{responses,0,attribution,status}'<>'VALIDATED_TRACE'
    or value#>'{responses,0,attribution,proofEventId}'<>'null'::jsonb then
    raise exception 'Recorded validated origin invented historical proof ID or lost attribution'; end if;

  -- An excluded earlier receipt blocks later older-dated receipts; timestamps
  -- alone must not bypass the source's immutable revision prefix.
  perform pg_temp.synthetic_outcome(f.pair,f.book,f.actor,f.partner,skew_round,
    array[stamp,clock_timestamp()+interval '1 day',clock_timestamp()-interval '1 day']);
  current_cutoff := clock_timestamp();
  value := private.shared_rating_round_outcome_v1(f.pair,skew_round,current_cutoff,current_cutoff,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',1);
  if value#>'{coverage,ratedCount}'<>'0'::jsonb then raise exception 'Future-prior receipt was bypassed by later older-dated response'; end if;
  anchor := stamp+interval '2 days';
  perform pg_temp.synthetic_outcome(f.pair,f.book,f.actor,f.partner,regression_round,array[stamp,anchor,stamp+interval '1 day']);
  value := private.shared_rating_round_outcome_v1(f.pair,regression_round,anchor+interval '12 hours',anchor+interval '12 hours',interval '1 day');
  perform pg_temp.assert_outcome(value,'IMMATURE',3);
  if (value#>>'{maturity,anchorAt}')::timestamptz<>anchor then raise exception 'Clock regression prematurely advanced maturity'; end if;
  perform pg_temp.synthetic_outcome(f.pair,f.book,f.actor,f.partner,tied_round,array[stamp,stamp,stamp]);
  value := private.shared_rating_round_outcome_v1(f.pair,tied_round,stamp,stamp,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'READY_FOR_VECTOR_REVIEW',3);
  perform pg_temp.synthetic_outcome(f.pair,f.book,f.actor,f.partner,gap_round,array[stamp,stamp,stamp]);
  delete from private.shared_rating_round_receipts where round_id=gap_round and result#>>'{round,revision}'='2';
  value := private.shared_rating_round_outcome_v1(f.pair,gap_round,stamp,stamp,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',1);
  perform pg_temp.synthetic_outcome(f.pair,f.book,f.actor,f.partner,duplicate_round,array[stamp,stamp,stamp]);
  insert into private.shared_rating_round_receipts(command_id,actor_user_id,profile_id,round_id,command,result,created_at)
    select duplicate_command,actor_user_id,profile_id,round_id,command||jsonb_build_object('commandId',duplicate_command),
      result||jsonb_build_object('commandId',duplicate_command),created_at from private.shared_rating_round_receipts
      where round_id=duplicate_round and result#>>'{round,revision}'='2';
  value := private.shared_rating_round_outcome_v1(f.pair,duplicate_round,stamp,stamp,interval '0 seconds');
  perform pg_temp.assert_outcome(value,'INCOMPLETE',1);

  -- One declared day means elapsed86400seconds, including a DST boundary.
  anchor := '2026-03-08T06:30:00Z'::timestamptz;
  perform pg_temp.synthetic_outcome(f.pair,f.book,f.actor,f.partner,dst_round,array[anchor,anchor,anchor]);
  perform set_config('TimeZone','UTC',true);
  frozen := private.shared_rating_round_outcome_v1(f.pair,dst_round,anchor+interval '24 hours',anchor+interval '24 hours',interval '1 day');
  perform pg_temp.assert_outcome(frozen,'READY_FOR_VECTOR_REVIEW',3);
  perform set_config('TimeZone','America/New_York',true);
  repeated := private.shared_rating_round_outcome_v1(f.pair,dst_round,anchor+interval '24 hours',anchor+interval '24 hours',interval '1 day');
  if repeated<>frozen or (repeated#>>'{maturity,matureAt}')::timestamptz<>anchor+interval '24 hours'
    or repeated#>'{maturity,intervalSeconds}'<>'86400'::jsonb then raise exception 'Session timezone/DST changed elapsed maturity or output bytes'; end if;
  value := private.shared_rating_round_outcome_v1(f.pair,dst_round,anchor+interval '24 hours'-interval '1 microsecond',
    anchor+interval '24 hours'-interval '1 microsecond',interval '1 day');
  perform pg_temp.assert_outcome(value,'IMMATURE',3);
  perform set_config('TimeZone','UTC',true);

  select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text)
    into before_receipts from private.shared_rating_round_receipts r;
  for checkpoint in select * from pg_temp.outcome_receipts loop
    if pg_temp.outcome_commit((checkpoint.command->>'actorUserId')::uuid,checkpoint.command)<>checkpoint.result then
      raise exception 'Historical outcome read changed exact old command acknowledgement'; end if;
  end loop;
  select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text)
    into after_receipts from private.shared_rating_round_receipts r;
  if after_receipts<>before_receipts or (select count(*) from public.events)<>before_events+2
    or (select md5(coalesce(jsonb_agg(to_jsonb(i) order by to_jsonb(i)::text),'[]'::jsonb)::text) from public.item_interactions i)<>before_interactions then
    raise exception 'Outcome read/retry mutated receipts, legacy Event evidence or interactions'; end if;
  delete from auth.users where id=f.third;
  current_cutoff := clock_timestamp();
  if private.shared_rating_round_outcome_v1(f.multi,n_round,current_cutoff,current_cutoff,interval '0 seconds') is not null then
    raise exception 'Deleted participant lineage was resurrected by historical replay'; end if;
end; $outcomes$;
select jsonb_build_object('sharedRoundOutcomes',
  'PASS: immutable temporal prefix, pair/N zero/unknown/corrections/maturity, independent cutoffs, frozen enrollment/experience, late own-origin proof, skew/ties/DST, API denial and no joint scalar learning') snapshot;
