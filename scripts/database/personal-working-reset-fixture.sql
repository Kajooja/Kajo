-- Disposable full native runtime acceptance. The caller owns BEGIN/ROLLBACK.
create function pg_temp.working_reset_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'Personal Working reset assertion: %',label;end if;end;$$;
do $native_working_reset$
declare
  actor uuid := 'a9148001-0000-4000-8000-000000000001';
  chosen_session uuid := 'a9148001-0000-4000-8000-000000000010';
  empty_session uuid := 'a9148001-0000-4000-8000-000000000011';
  evidence_a uuid := 'a9148001-0000-4000-8000-000000000020';
  evidence_b uuid := 'a9148001-0000-4000-8000-000000000021';
  evidence_c uuid := 'a9148001-0000-4000-8000-000000000022';
  evidence_d uuid := 'a9148001-0000-4000-8000-000000000023';
  reset_id uuid := 'a9148001-0000-4000-8000-000000000030';
  owned_profile uuid; source_id uuid; fresh_source uuid; command jsonb; request jsonb; page jsonb;
  before_capture jsonb; cleared jsonb; receipt jsonb; frozen_source jsonb; frozen_candidates jsonb; shadow_off jsonb;
  canonical jsonb; ledger jsonb; role_name text; expected double precision;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(actor,actor::text||'@example.invalid',
    jsonb_build_object('kajo_nickname','Native reset fixture'));
  select id into strict owned_profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.items(id,item_type,title,tags,discoverable) values
    (evidence_a,'BOOK','Reset zero source',array['native-reset-warm'],false),
    (evidence_b,'BOOK','Reset positive source',array['native-reset-warm'],false),
    (evidence_c,'BOOK','Reset new zero source',array['native-reset-warm'],false),
    (evidence_d,'BOOK','Reset new positive source',array['native-reset-warm'],false);
  insert into public.items(id,item_type,title,tags,discoverable)
    select md5('working-reset-native-candidate:'||n)::uuid,'BOOK','Working reset candidate '||n,array['native-reset-warm'],true
      from generate_series(1,6) n;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  command := jsonb_build_object('version',1,'actionId',gen_random_uuid(),'actorUserId',actor,'profileId',owned_profile,
    'itemId',evidence_a,'occurredAt',now()-interval '4 minutes','discoveryMode','FOR_YOU','predictionId',null,
    'session',jsonb_build_object('sessionId',chosen_session,'startedAt',now()-interval '5 minutes','context','{}'::jsonb),
    'kind','SET_RATING','rating',0);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  command := command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_b,'occurredAt',now()-interval '3 minutes','rating',10);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  before_capture := private.capture_personal_working_state_v1(actor,owned_profile,chosen_session,clock_timestamp());
  perform pg_temp.working_reset_assert(before_capture->>'version'='native-working-capture-v2' and before_capture->>'status'='ACTIVE',
    'actual native commands produce the current v2 active capture');
  request := jsonb_build_object('version',3,'requestId',gen_random_uuid(),'profileId',owned_profile,'sessionId',chosen_session,
    'discoveryMode','FOR_YOU','itemType','BOOK','limit',2,'context','{}'::jsonb);
  perform set_config('role','authenticated',true);page := public.rank_items_page_v1(request);perform set_config('role','postgres',true);
  source_id := (page->>'predictionId')::uuid;
  select to_jsonb(r) into strict frozen_source from private.prediction_runs r where id=source_id;
  select jsonb_agg(to_jsonb(c) order by final_rank) into frozen_candidates from private.prediction_candidates c where prediction_id=source_id;
  shadow_off := private.record_personal_working_shadow_v1(source_id,'OFF');
  select jsonb_agg(to_jsonb(e) order by e.id) into canonical from public.events e where e.profile_id=owned_profile;
  receipt := private.commit_personal_working_reset_v1(reset_id,actor,owned_profile,chosen_session);
  perform pg_temp.working_reset_assert(receipt->>'version'='personal-working-reset-v1' and receipt->>'resetId'=reset_id::text
    and receipt->>'resetAt'=receipt->>'createdAt' and receipt->>'affects'='WORKING_STATE_ONLY'
    and receipt->'learnable'='false'::jsonb and receipt->'nativeActivated'='false'::jsonb,
    'typed private reset owns its server-clock boundary and creates no learnable/native activation');
  perform pg_temp.working_reset_assert(private.commit_personal_working_reset_v1(reset_id,actor,owned_profile,chosen_session)=receipt,
    'exact reset retry returns the immutable original receipt');
  cleared := private.capture_personal_working_state_v1(actor,owned_profile,chosen_session,clock_timestamp());
  perform pg_temp.working_reset_assert(cleared->>'version'='native-working-capture-v2' and cleared->>'status'='RESET_EMPTY'
    and cleared#>>'{support,distinctItems}'='0' and cleared->>'resetControlCount'='1'
    and cleared->'resetControlPrefixComplete'='true'::jsonb and jsonb_array_length(cleared->'resetControls')=1
    and private.personal_working_adjustment_v1(cleared,array['native-reset-warm'],'ORDERED')=0,
    'reset excludes old taste and activity without itself supplying support');
  perform pg_temp.working_reset_assert((select jsonb_agg(to_jsonb(e) order by e.id) from public.events e where e.profile_id=owned_profile)=canonical,
    'raw canonical event evidence survives Working reset exactly');
  perform pg_temp.working_reset_assert(private.capture_personal_working_state_v1(actor,owned_profile,chosen_session,(before_capture->>'cutoff')::timestamptz)->>'resetControlCount'='0',
    'an earlier cutoff cannot observe the later server-owned control');
  perform pg_temp.working_reset_assert(private.capture_personal_working_state_v1(actor,owned_profile,chosen_session,now()+interval '4 hours')->>'status'='SESSION_EXPIRED',
    'reset does not renew the original four-hour session');
  command := command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_c,'occurredAt',clock_timestamp(),'rating',0);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  command := command||jsonb_build_object('actionId',gen_random_uuid(),'itemId',evidence_d,'occurredAt',clock_timestamp(),'rating',10);
  perform set_config('role','authenticated',true);perform public.commit_item_action_v1(command);perform set_config('role','postgres',true);
  cleared := private.capture_personal_working_state_v1(actor,owned_profile,chosen_session,clock_timestamp());
  expected := 0.25::double precision*(1-sqrt(0.5::double precision))/(1+sqrt(0.5::double precision));
  perform pg_temp.working_reset_assert(cleared->>'status'='ACTIVE' and cleared#>>'{support,distinctItems}'='2'
    and abs(private.personal_working_adjustment_v1(cleared,array['native-reset-warm'],'ORDERED')-expected)<1e-12
    and private.personal_working_adjustment_v1(cleared,array['native-reset-warm'],'STATIC')=0,
    'two independent post-reset Items regain ordered intent with the numeric oracle');
  request := request||jsonb_build_object('requestId',gen_random_uuid());
  perform set_config('role','authenticated',true);page := public.rank_items_page_v1(request);perform set_config('role','postgres',true);
  fresh_source := (page->>'predictionId')::uuid;cleared := private.record_personal_working_shadow_v1(fresh_source,'OFF');
  perform pg_temp.working_reset_assert((select policy_version like '%+personal-working-off-v2' and state_snapshot#>>'{workingState,version}'='native-working-capture-v2'
    and state_snapshot#>>'{workingState,status}'='ACTIVE' and state_snapshot#>>'{workingState,resetControlCount}'='1'
    and state_snapshot#>>'{workingState,resetControls,0,resetId}'=reset_id::text
    from private.prediction_runs where id=fresh_source) and not exists(select 1 from private.prediction_candidates c where c.prediction_id=fresh_source
      and c.explanation#>>'{workingIntent,version}' is distinct from 'personal-working-features-v2'),
    'new native source consumes the actual preceding server reset and post-reset evidence with matching v2 capture/feature/OFF policy');
  perform pg_temp.working_reset_assert(not exists(select 1 from private.prediction_candidates p
    full join jsonb_array_elements(cleared->'candidates') s(value) on p.prediction_id=fresh_source and p.item_id=(s.value->>'itemId')::uuid
    where (p.prediction_id=fresh_source or s.value is not null) and (p.item_id is null or s.value is null
      or p.final_score is distinct from (s.value->>'score')::double precision or p.final_rank is distinct from (s.value->>'rank')::integer
      or p.selected_for_delivery is distinct from (s.value->>'selected')::boolean
      or private.prediction_delivery_tier_v1(p.explanation->'resurfacingPolicy') is distinct from (s.value->>'tier')::integer
      or coalesce((p.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false) is distinct from (s.value->>'eligible')::boolean
      or (s.value->>'adjustment')::double precision<>0)), 'OFF retains every exact score/rank/Item/tier/eligibility/selection');
  perform pg_temp.working_reset_assert((select to_jsonb(r) from private.prediction_runs r where id=source_id)=frozen_source
    and (select jsonb_agg(to_jsonb(c) order by final_rank) from private.prediction_candidates c where prediction_id=source_id)=frozen_candidates
    and private.record_personal_working_shadow_v1(source_id,'OFF')=shadow_off,
    'reset and later native signals leave the pre-reset source/candidates/comparison exactly frozen');
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform pg_temp.working_reset_assert(not has_function_privilege(role_name,'private.commit_personal_working_reset_v1(uuid,uuid,uuid,uuid)','EXECUTE')
      and not has_table_privilege(role_name,'private.personal_working_resets','SELECT,INSERT,UPDATE,DELETE'), 'private control ACL: '||role_name);
  end loop;
  select jsonb_agg(to_jsonb(r) order by id) into ledger from private.personal_working_resets r where r.profile_id=owned_profile;
  perform private.erase_prediction_sources_v1('PROFILE',owned_profile);
  perform pg_temp.working_reset_assert((select jsonb_agg(to_jsonb(r) order by id) from private.personal_working_resets r where r.profile_id=owned_profile)=ledger,
    'forecast-only source erasure retains raw reset controls');
  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context) values(empty_session,actor,owned_profile,now()-interval '5 minutes','{}');
  perform private.commit_personal_working_reset_v1(gen_random_uuid(),actor,owned_profile,empty_session);
  delete from public.event_sessions where id=empty_session;
  perform pg_temp.working_reset_assert(not exists(select 1 from private.personal_working_resets where session_id=empty_session),
    'genuine unused native session parent deletion cascades its controls');
end;$native_working_reset$;
select jsonb_build_object('personalWorkingReset',
  'PASS: actual canonical native reset; server-owned boundary; independent post-reset numeric oracle; exact frozen/current OFF parity; private ACL; raw-control erasure semantics') snapshot;
