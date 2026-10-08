-- Synthetic source-only evidence rehearsal. No old Events/interactions are
-- rewritten and no round response becomes a scalar joint reward.
create function pg_temp.round_commit(actor uuid, request jsonb) returns jsonb
language plpgsql as $$ declare response jsonb; begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  response := public.commit_shared_rating_round_v1(request);
  perform set_config('role','postgres',true);
  return response;
exception when others then perform set_config('role','postgres',true); raise;
end; $$;
create function pg_temp.round_read(actor uuid, profile uuid, round uuid) returns jsonb
language plpgsql as $$ declare response jsonb; begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  response := public.get_shared_rating_round_v1(profile,round);
  perform set_config('role','postgres',true);
  return response;
exception when others then perform set_config('role','postgres',true); raise;
end; $$;
create function pg_temp.round_request(actor uuid, profile uuid, round uuid, kind text, revision integer, extra jsonb default '{}')
returns jsonb language sql as $$ select jsonb_build_object('version',1,'commandId',gen_random_uuid(),
  'actorUserId',actor,'profileId',profile,'roundId',round,'kind',kind,'expectedRevision',revision)||extra $$;
create function pg_temp.assert_round(snapshot jsonb, state text, revision integer) returns void
language plpgsql as $$ begin
  if snapshot->>'state' is distinct from state or snapshot->'revision' is distinct from to_jsonb(revision)
    or snapshot->'groupReward' is distinct from 'null'::jsonb or snapshot->'learnable' is distinct from 'false'::jsonb then
    raise exception 'Round lost state/revision or fabricated scalar joint reward: %',snapshot;
  end if;
end; $$;
create function pg_temp.reject_round(actor uuid, request jsonb) returns void
language plpgsql as $$ begin
  begin
    perform pg_temp.round_commit(actor,request);
  exception when others then
    if sqlstate in ('22023','42501','40001','55000','23505','KJ001') then return; end if;
    raise;
  end;
  raise exception 'Invalid round command was accepted: %',request;
end; $$;

do $rounds$
declare
  a uuid := 'a2320000-0000-4000-8000-000000000001';
  b uuid := 'a2320000-0000-4000-8000-000000000002';
  c uuid := 'a2320000-0000-4000-8000-000000000003';
  outsider uuid := 'a2320000-0000-4000-8000-000000000004';
  pair uuid := 'a2320000-0000-4000-8000-000000000010';
  multi uuid := 'a2320000-0000-4000-8000-000000000011';
  foreign_profile uuid := 'a2320000-0000-4000-8000-000000000012';
  single_profile uuid := 'a2320000-0000-4000-8000-000000000013';
  large_profile uuid := 'a2320000-0000-4000-8000-000000000014';
  item uuid := 'a2320000-0000-4000-8000-000000000020';
  movie uuid := 'a2320000-0000-4000-8000-000000000021';
  legacy_item uuid := 'a2320000-0000-4000-8000-000000000022';
  round uuid := gen_random_uuid(); n_round uuid := gen_random_uuid(); experience uuid := gen_random_uuid();
  origin_round uuid := gen_random_uuid(); origin_item uuid; personal uuid;
  cap_round uuid; cancelled_cap_round uuid; completed_cap_round uuid := gen_random_uuid();
  large_round uuid := gen_random_uuid(); n integer; checkpoint record;
  request jsonb; response jsonb; original jsonb; before jsonb; current jsonb; vector jsonb;
  delivery jsonb; origin jsonb; origin_session uuid := gen_random_uuid(); started timestamptz := clock_timestamp();
  events_before integer; interactions_before integer; receipts_before integer; invalid jsonb; participants_before jsonb; relation text;
begin
  if exists(select 1 from auth.users) or exists(select 1 from public.items) then
    raise exception 'Shared round fixture requires empty synthetic state'; end if;
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text||'@example.invalid',jsonb_build_object('kajo_nickname','Round '||right(id::text,4))
    from unnest(array[a,b,c,outsider]) fixture(id);
  select id into strict personal from public.profiles where owner_user_id=a and profile_type='PERSONAL';
  insert into public.profiles(id,profile_type,name) values(pair,'SHARED','Pair evidence'),
    (multi,'SHARED','N member evidence'),(foreign_profile,'SHARED','Other context');
  insert into public.profile_members(profile_id,user_id) values(pair,a),(pair,b),(multi,a),(multi,b),(multi,c),
    (foreign_profile,a),(foreign_profile,c);
  insert into public.items(id,item_type,title,tags,discoverable) values(item,'BOOK','Round book',array['round'],true),
    (movie,'MOVIE','Round movie',array['round'],true),(legacy_item,'BOOK','Legacy one-actor book',array['round'],true);
  -- Actual legacy command remains one actor's immutable history; no retrofit.
  request := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',a,'profileId',pair,
    'itemId',legacy_item,'kind','SET_RATING','rating',7,'occurredAt',started,'predictionId',null,
    'discoveryMode','FOR_YOU','session',jsonb_build_object('sessionId',gen_random_uuid(),'startedAt',started,'context','{}'::jsonb));
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('role','authenticated',true);
  perform public.commit_item_action_v1(request);
  perform set_config('role','postgres',true);
  select count(*) into events_before from public.events;
  select count(*) into interactions_before from public.item_interactions;
  foreach relation in array array['private.shared_rating_rounds','private.shared_rating_round_responses',
    'private.shared_rating_round_receipts','private.shared_round_membership_generations'] loop
    if has_table_privilege('anon',relation,'select,insert,update,delete')
      or has_table_privilege('authenticated',relation,'select,insert,update,delete') then
      raise exception 'Direct API-role access leaked private round storage: %',relation; end if;
  end loop;
  if has_function_privilege('anon','public.commit_shared_rating_round_v1(jsonb)','execute')
    or has_function_privilege('anon','public.get_shared_rating_round_v1(uuid,uuid)','execute')
    or not has_function_privilege('authenticated','public.commit_shared_rating_round_v1(jsonb)','execute')
    or not has_function_privilege('authenticated','public.get_shared_rating_round_v1(uuid,uuid)','execute') then
    raise exception 'Round public boundary ACL mismatch'; end if;

  request := pg_temp.round_request(a,pair,round,'OPEN_ROUND',0,jsonb_build_object('itemId',item,'experienceId',experience));
  response := pg_temp.round_commit(a,request); original := response;
  perform pg_temp.assert_round(response->'round','PENDING',1);
  if pg_temp.round_commit(a,request)<>original then raise exception 'OPEN retry changed immutable receipt'; end if;
  current := pg_temp.round_read(b,pair,round);
  if current<>response->'round' or jsonb_array_length(current->'participants')<>2
    or current->'participantSetVersion'<>'1'::jsonb
    or current#>>'{participants,0,actorUserId}'<>a::text or current#>>'{participants,1,actorUserId}'<>b::text
    or jsonb_array_length(current->'responses')<>2
    or exists(select 1 from jsonb_array_elements(current->'responses') r where r->>'status'<>'UNANSWERED' or r->'rating'<>'null'::jsonb) then
    raise exception 'Round did not freeze sorted accepted members with truthful unanswered responses'; end if;
  participants_before := current->'participants';
  perform pg_temp.reject_round(a,request||jsonb_build_object('itemId',movie));
  perform pg_temp.reject_round(a,pg_temp.round_request(a,pair,gen_random_uuid(),'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',experience)));
  perform pg_temp.reject_round(a,pg_temp.round_request(a,personal,gen_random_uuid(),'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  perform pg_temp.reject_round(outsider,pg_temp.round_request(outsider,pair,round,'SET_RESPONSE',1,'{"rating":8}'));
  perform pg_temp.reject_round(b,pg_temp.round_request(a,pair,round,'SET_RESPONSE',1,'{"rating":8}'));
  before := pg_temp.round_read(a,pair,round);
  select count(*) into receipts_before from private.shared_rating_round_receipts;
  for invalid in select value from jsonb_array_elements('[{"rating":-1},{"rating":11},{"rating":1.5},{"rating":"0"},{"rating":true},{"rating":0,"occurredAt":"2026-10-08T00:00:00Z"},{"rating":0,"participants":[]},{"rating":0,"origin":{}},{"rating":0,"expectedRevision":"1"},{"rating":0,"version":2},{"rating":0,"commandId":null},{"rating":0,"kind":"ITEM_RATED"}]') loop
    perform pg_temp.reject_round(a,pg_temp.round_request(a,pair,round,'SET_RESPONSE',1,invalid));
  end loop;
  perform pg_temp.reject_round(a,pg_temp.round_request(a,pair,round,'SET_RESPONSE',1,
    jsonb_build_object('rating',0,'extra',repeat('x',5000))));
  if pg_temp.round_read(a,pair,round)<>before or (select count(*) from private.shared_rating_round_receipts)<>receipts_before then
    raise exception 'Rejected payload partially changed round state or committed a receipt'; end if;

  request := pg_temp.round_request(a,pair,round,'SET_RESPONSE',1,'{"rating":0.0,"expectedRevision":1.0}');
  response := pg_temp.round_commit(a,request); original := response;
  perform pg_temp.assert_round(response->'round','PENDING',2);
  if response#>>'{round,responses,0,status}'<>'RATED' or response#>'{round,responses,0,rating}'<>'0'::jsonb then
    raise exception 'Rating zero was lost or counted as missing'; end if;
  perform pg_temp.reject_round(b,pg_temp.round_request(b,pair,round,'SET_RESPONSE',1,'{"rating":10}'));
  response := pg_temp.round_commit(b,pg_temp.round_request(b,pair,round,'SET_RESPONSE',2,'{"rating":null}'));
  perform pg_temp.assert_round(response->'round','PENDING',3);
  if response#>>'{round,responses,1,status}'<>'UNKNOWN' or response#>'{round,responses,1,rating}'<>'null'::jsonb then
    raise exception 'Unknown became rating zero or completion'; end if;
  response := pg_temp.round_commit(b,pg_temp.round_request(b,pair,round,'SET_RESPONSE',3,'{"rating":10}'));
  perform pg_temp.assert_round(response->'round','COMPLETED',4);
  if response#>'{round,responses,0,rating}'<>'0'::jsonb or response#>'{round,responses,1,rating}'<>'10'::jsonb then
    raise exception 'Completion collapsed disagreement into group preference'; end if;
  if pg_temp.round_commit(a,request)<>original then raise exception 'Later completion rewrote an older response receipt'; end if;
  response := pg_temp.round_commit(b,pg_temp.round_request(b,pair,round,'CLEAR_RESPONSE',4));
  perform pg_temp.assert_round(response->'round','PENDING',5);
  if response#>>'{round,responses,1,status}'<>'CLEARED' or response#>'{round,responses,1,rating}'<>'null'::jsonb then
    raise exception 'Clear retained a completed response'; end if;
  response := pg_temp.round_commit(a,pg_temp.round_request(a,pair,round,'SET_RESPONSE',5,'{"rating":5}'));
  perform pg_temp.assert_round(response->'round','PENDING',6);
  response := pg_temp.round_commit(b,pg_temp.round_request(b,pair,round,'SET_RESPONSE',6,'{"rating":4}'));
  perform pg_temp.assert_round(response->'round','COMPLETED',7);
  response := pg_temp.round_commit(a,pg_temp.round_request(a,pair,round,'CANCEL_ROUND',7));
  perform pg_temp.assert_round(response->'round','CANCELLED',8);
  if (select count(*) from private.shared_rating_round_responses where round_id=round)<>6
    or not exists(select 1 from private.shared_rating_round_responses where round_id=round and revision=2 and rating=0)
    or not exists(select 1 from private.shared_rating_round_responses where round_id=round and revision=3 and status='UNKNOWN') then
    raise exception 'Correction/cancellation erased immutable response revisions'; end if;
  begin
    insert into private.shared_rating_round_responses(round_id,revision,participant_set_version,actor_user_id,status,rating,received_at)
      values(round,4095,1,a,'RATED',null,clock_timestamp());
    raise exception 'RATED evidence admitted a null rating';
  exception when check_violation then null; end;
  begin
    update private.shared_rating_round_responses set rating=9 where round_id=round and revision=2;
    raise exception 'Immutable response evidence allowed direct update';
  exception when object_not_in_prerequisite_state then null; end;
  begin
    update private.shared_rating_round_receipts set result='{}' where round_id=round;
    raise exception 'Immutable exact receipts allowed direct update';
  exception when object_not_in_prerequisite_state then null; end;
  perform pg_temp.reject_round(b,pg_temp.round_request(b,pair,round,'SET_RESPONSE',8,'{"rating":8}'));
  perform pg_temp.reject_round(a,pg_temp.round_request(a,pair,round,'RECONFIRM_ROUND',8));

  -- N-member completion requires all frozen participants, in either domain.
  response := pg_temp.round_commit(a,pg_temp.round_request(a,multi,n_round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',movie,'experienceId',gen_random_uuid())));
  perform pg_temp.assert_round(response->'round','PENDING',1);
  response := pg_temp.round_commit(c,pg_temp.round_request(c,multi,n_round,'SET_RESPONSE',1,'{"rating":10}'));
  response := pg_temp.round_commit(a,pg_temp.round_request(a,multi,n_round,'SET_RESPONSE',2,'{"rating":0}'));
  perform pg_temp.assert_round(response->'round','PENDING',3);
  response := pg_temp.round_commit(b,pg_temp.round_request(b,multi,n_round,'SET_RESPONSE',3,'{"rating":5}'));
  perform pg_temp.assert_round(response->'round','COMPLETED',4);
  participants_before := response#>'{round,participants}';
  delete from public.profile_members where profile_id=multi and user_id=c;
  -- Same actor/time/transaction rejoin is a new membership generation.
  insert into public.profile_members(profile_id,user_id) values(multi,c);
  current := pg_temp.round_read(a,multi,n_round);
  perform pg_temp.assert_round(current,'RECONFIRMATION_REQUIRED',4);
  if current->'participants'<>participants_before then raise exception 'Read silently replaced frozen participants'; end if;
  perform pg_temp.reject_round(c,pg_temp.round_request(c,multi,n_round,'SET_RESPONSE',4,'{"rating":8}'));
  response := pg_temp.round_commit(a,pg_temp.round_request(a,multi,n_round,'RECONFIRM_ROUND',4));
  perform pg_temp.assert_round(response->'round','PENDING',5);
  if response#>'{round,participantSetVersion}'<>'2'::jsonb or response#>'{round,participants}'=participants_before
    or exists(select 1 from jsonb_array_elements(response#>'{round,responses}') r where r->>'status'<>'UNANSWERED') then
    raise exception 'Reconfirmation reused old generations or old confirmations'; end if;
  if (select count(*) from private.shared_rating_round_responses where round_id=n_round and participant_set_version=1)<>3 then
    raise exception 'Reconfirmation erased earlier participant response evidence'; end if;
  insert into public.profile_members(profile_id,user_id) values(multi,outsider);
  current := pg_temp.round_read(outsider,multi,n_round);
  perform pg_temp.assert_round(current,'RECONFIRMATION_REQUIRED',5);
  perform pg_temp.reject_round(outsider,pg_temp.round_request(outsider,multi,n_round,'SET_RESPONSE',5,'{"rating":4}'));
  response := pg_temp.round_commit(outsider,pg_temp.round_request(outsider,multi,n_round,'RECONFIRM_ROUND',5));
  perform pg_temp.assert_round(response->'round','PENDING',6);
  if jsonb_array_length(response#>'{round,participants}')<>4 then raise exception 'Reconfirmation omitted new accepted participant'; end if;

  -- Per-person origin requires that actor's own exact delivered Shared trace.
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('role','authenticated',true);
  delivery := public.rank_items_page_v1(jsonb_build_object('version',3,'requestId',gen_random_uuid(),
    'profileId',pair,'sessionId',origin_session,'discoveryMode','FOR_YOU','itemType','BOOK','limit',10,'context','{}'::jsonb));
  perform set_config('role','postgres',true);
  origin_item := (delivery#>>'{items,0,item_id}')::uuid;
  if origin_item is null then raise exception 'Origin fixture has no actually selected Item'; end if;
  origin := jsonb_build_object('predictionId',delivery->'predictionId','sessionId',origin_session,'discoveryMode','FOR_YOU');
  response := pg_temp.round_commit(a,pg_temp.round_request(a,pair,origin_round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',origin_item,'experienceId',gen_random_uuid())));
  request := pg_temp.round_request(a,pair,origin_round,'SET_RESPONSE',1,jsonb_build_object('rating',9,'origin',origin));
  response := pg_temp.round_commit(a,request); original := response;
  if response#>>'{round,responses,0,origin,status}'<>'UNATTRIBUTED'
    or response#>'{round,responses,0,origin,predictionId}'<>'null'::jsonb then
    raise exception 'Absent exposure manufactured validated provenance'; end if;
  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
    values(origin_session,a,pair,started,'{}'::jsonb);
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id)
    values(gen_random_uuid(),a,pair,origin_item,'BOOK','ITEM_IMPRESSION',clock_timestamp(),origin_session,(delivery->>'predictionId')::uuid);
  if pg_temp.round_commit(a,request)<>original then raise exception 'Late exposure rewrote immutable unvalidated response'; end if;
  response := pg_temp.round_commit(a,pg_temp.round_request(a,pair,origin_round,'SET_RESPONSE',2,jsonb_build_object('rating',9,'origin',origin)));
  if response#>>'{round,responses,0,origin,status}'<>'VALIDATED_TRACE'
    or response#>'{round,responses,0,origin,predictionId}'<>delivery->'predictionId' then
    raise exception 'Real actor/Shared/session/selected Item exposure did not validate'; end if;
  request := pg_temp.round_request(b,pair,origin_round,'SET_RESPONSE',3,jsonb_build_object('rating',2,'origin',origin));
  response := pg_temp.round_commit(b,request); original := response;
  perform pg_temp.assert_round(response->'round','COMPLETED',4);
  if response#>>'{round,responses,1,origin,status}'<>'UNATTRIBUTED'
    or response#>'{round,responses,1,origin,predictionId}'<>'null'::jsonb
    or response#>'{round,responses,1,origin,claimedPredictionId}'<>delivery->'predictionId' then
    raise exception 'Second actor borrowed another participant prediction or lost truthful claim'; end if;
  delete from public.profile_members where profile_id=pair and user_id=b;
  perform pg_temp.reject_round(b,request);
  begin
    perform pg_temp.round_read(b,pair,origin_round);
    raise exception 'Revoked member read retained round receipt';
  exception when insufficient_privilege then null; end;
  insert into public.profile_members(profile_id,user_id) values(pair,b);
  if pg_temp.round_commit(b,request)<>original then raise exception 'Authorized replay changed its original immutable receipt'; end if;
  perform pg_temp.assert_round(pg_temp.round_read(a,pair,origin_round),'RECONFIRMATION_REQUIRED',4);
  begin
    perform pg_temp.round_read(c,pair,origin_round);
    raise exception 'Nonmember read Shared round';
  exception when insufficient_privilege then null; end;
  begin
    perform pg_temp.round_read(a,foreign_profile,origin_round);
    raise exception 'Cross-Profile read borrowed Shared round';
  exception when insufficient_privilege or no_data_found or invalid_parameter_value then null; end;

  -- Active round and participant bounds are enforced on derived current members.
  response := pg_temp.round_commit(a,pg_temp.round_request(a,foreign_profile,completed_cap_round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  response := pg_temp.round_commit(a,pg_temp.round_request(a,foreign_profile,completed_cap_round,'SET_RESPONSE',1,'{"rating":0}'));
  response := pg_temp.round_commit(c,pg_temp.round_request(c,foreign_profile,completed_cap_round,'SET_RESPONSE',2,'{"rating":10}'));
  perform pg_temp.assert_round(response->'round','COMPLETED',3);
  for n in 1..16 loop
    cap_round := gen_random_uuid();
    if n=1 then cancelled_cap_round := cap_round; end if;
    response := pg_temp.round_commit(a,pg_temp.round_request(a,foreign_profile,cap_round,'OPEN_ROUND',0,
      jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
    perform pg_temp.assert_round(response->'round','PENDING',1);
  end loop;
  perform pg_temp.reject_round(a,pg_temp.round_request(a,foreign_profile,gen_random_uuid(),'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  if (select count(*) from private.shared_rating_rounds where profile_id=foreign_profile and current_state='PENDING')<>16 then
    raise exception 'Rejected seventeenth active round left an orphan head'; end if;
  -- Allocation cannot make an already completed experience uncorrectable.
  response := pg_temp.round_commit(c,pg_temp.round_request(c,foreign_profile,completed_cap_round,'CLEAR_RESPONSE',3));
  perform pg_temp.assert_round(response->'round','PENDING',4);
  response := pg_temp.round_commit(a,pg_temp.round_request(a,foreign_profile,completed_cap_round,'SET_RESPONSE',4,'{"rating":null}'));
  perform pg_temp.assert_round(response->'round','PENDING',5);
  if (select count(*) from private.shared_rating_rounds where profile_id=foreign_profile and current_state='PENDING')<>17 then
    raise exception 'Full allocation budget rejected correction of historical completion'; end if;
  perform pg_temp.reject_round(a,pg_temp.round_request(a,foreign_profile,gen_random_uuid(),'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  response := pg_temp.round_commit(a,pg_temp.round_request(a,foreign_profile,completed_cap_round,'SET_RESPONSE',5,'{"rating":9}'));
  response := pg_temp.round_commit(c,pg_temp.round_request(c,foreign_profile,completed_cap_round,'SET_RESPONSE',6,'{"rating":3}'));
  perform pg_temp.assert_round(response->'round','COMPLETED',7);
  response := pg_temp.round_commit(a,pg_temp.round_request(a,foreign_profile,cancelled_cap_round,'CANCEL_ROUND',1));
  perform pg_temp.assert_round(response->'round','CANCELLED',2);
  response := pg_temp.round_commit(a,pg_temp.round_request(a,foreign_profile,gen_random_uuid(),'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  perform pg_temp.assert_round(response->'round','PENDING',1);
  insert into public.profiles(id,profile_type,name) values(single_profile,'SHARED','One member'),(large_profile,'SHARED','Bounded members');
  insert into public.profile_members(profile_id,user_id) values(single_profile,a),(large_profile,a);
  perform pg_temp.reject_round(a,pg_temp.round_request(a,single_profile,gen_random_uuid(),'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  insert into auth.users(id,email,raw_user_meta_data)
    select md5('round-member-bound:'||fixture.n)::uuid,'member-bound-'||fixture.n||'@example.invalid',jsonb_build_object('kajo_nickname','Bounded member '||fixture.n)
    from generate_series(1,31) fixture(n);
  insert into public.profile_members(profile_id,user_id)
    select large_profile,md5('round-member-bound:'||fixture.n)::uuid from generate_series(1,31) fixture(n);
  response := pg_temp.round_commit(a,pg_temp.round_request(a,large_profile,large_round,'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));
  perform pg_temp.assert_round(response->'round','PENDING',1);
  if jsonb_array_length(response#>'{round,participants}')<>32 then raise exception 'Legal 32-member round lost participants'; end if;
  insert into public.profile_members(profile_id,user_id) values(large_profile,outsider);
  perform pg_temp.reject_round(a,pg_temp.round_request(a,large_profile,large_round,'RECONFIRM_ROUND',1));
  perform pg_temp.assert_round(pg_temp.round_read(a,large_profile,large_round),'RECONFIRMATION_REQUIRED',1);
  perform pg_temp.reject_round(a,pg_temp.round_request(a,large_profile,gen_random_uuid(),'OPEN_ROUND',0,
    jsonb_build_object('itemId',item,'experienceId',gen_random_uuid())));

  -- Normal leaving retains frozen history; account deletion erases only the new
  -- lineages whose vectors/receipts would otherwise retain that deleted identity.
  delete from public.profile_members where profile_id=multi and user_id=c;
  response := pg_temp.round_commit(a,pg_temp.round_request(a,multi,n_round,'RECONFIRM_ROUND',6));
  perform pg_temp.assert_round(response->'round','PENDING',7);
  delete from public.profile_members where profile_id=foreign_profile and user_id=c;
  insert into public.profile_members(profile_id,user_id) values(foreign_profile,b);
  for checkpoint in select id,revision from private.shared_rating_rounds where profile_id=foreign_profile and current_state<>'CANCELLED' loop
    response := pg_temp.round_commit(a,pg_temp.round_request(a,foreign_profile,checkpoint.id,'RECONFIRM_ROUND',checkpoint.revision));
    perform pg_temp.assert_round(response->'round','PENDING',checkpoint.revision+1);
  end loop;
  -- For the unanswered foreign rounds C now exists only in earlier receipts;
  -- deletion must follow that evidence too, not merely the current head/vector.
  if exists(select 1 from private.shared_rating_rounds r,jsonb_array_elements(r.participants) p
      where r.profile_id=foreign_profile and r.current_state<>'CANCELLED' and p->>'actorUserId'=c::text) then
    raise exception 'Explicit reconfirmation did not replace old current participant set'; end if;
  if not exists(select 1 from private.shared_rating_round_responses where round_id=n_round and actor_user_id=c) then
    raise exception 'Ordinary leave/rejoin erased source response history'; end if;
  delete from auth.users where id=c;
  if exists(select 1 from private.shared_rating_rounds where id=n_round or profile_id=foreign_profile)
    or exists(select 1 from private.shared_rating_round_responses where round_id=n_round)
    or exists(select 1 from private.shared_rating_round_receipts where round_id=n_round or profile_id=foreign_profile)
    or exists(select 1 from private.shared_rating_rounds r,jsonb_array_elements(r.participants) p where p->>'actorUserId'=c::text)
    or exists(select 1 from private.shared_rating_round_receipts r where r.result::text like '%'||c::text||'%') then
    raise exception 'Account deletion retained deleted participant identity in new round lineage'; end if;
  perform pg_temp.assert_round(pg_temp.round_read(a,pair,round),'CANCELLED',8);
  if not exists(select 1 from private.shared_rating_rounds where id=origin_round)
    or not exists(select 1 from private.shared_rating_rounds where id=large_round) then
    raise exception 'Account deletion erased unrelated Shared round evidence'; end if;
  if (select count(*) from public.events)<>events_before+1 or (select count(*) from public.item_interactions)<>interactions_before
    or not exists(select 1 from public.item_interactions where profile_id=pair and item_id=legacy_item and rating=7 and consumed)
    or exists(select 1 from public.events where item_id in(item,movie) and event_type in('ITEM_RATED','ITEM_CONSUMED')) then
    raise exception 'Source-only foundation changed legacy history or emitted learnable joint scalar Events'; end if;
end; $rounds$;
select jsonb_build_object('sharedRatingRounds',
  'PASS: pair/N pending, zero/disagreement, corrections/immutability, membership generation/reconfirm, exact retry/origin/auth, bounded capacity, account-delete cleanup and no joint scalar Events') snapshot;
