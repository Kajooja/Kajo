create function pg_temp.input_reject(sql text,expected_state text default '22023') returns void
language plpgsql as $$ begin
  begin execute sql; exception when others then
    if sqlstate is distinct from expected_state then raise; end if;
    return;
  end;
  raise exception 'Invalid pre-response input succeeded: %',sql;
end; $$;
create function pg_temp.assert_prediction_input(value jsonb,revision integer,members integer,sources integer)
returns void language plpgsql as $$ begin
  if value is null or value->>'contractVersion' is distinct from 'shared-round-prediction-input-v1'
    or value->>'usage' is distinct from 'INPUT_CAPTURE_ONLY'
    or value->>'predictorConsumption' is distinct from 'NOT_RECORDED'
    or value->>'sourceBasis' is distinct from 'SERVER_VISIBLE_PRE_RESPONSE_CONTEXT'
    or value->>'selectionBasis' is distinct from 'CALLER_DECLARED_SOURCE_CAPTURE_IDS'
    or value->>'membershipValidity' is distinct from 'CURRENT_FULL_ENROLLMENT_AT_CAPTURE'
    or value->>'commitVisibility' is distinct from 'OWN_TRANSACTION_MVCC_VISIBLE_NOT_COMMIT_TIME'
    or value->'consumerPredictionId' is distinct from 'null'::jsonb
    or value->'historicalFeatureEligible' is distinct from 'false'::jsonb
    or value->'learnable' is distinct from 'false'::jsonb or value->'groupReward' is distinct from 'null'::jsonb
    or value#>'{target,sourceRevision}' is distinct from to_jsonb(revision)
    or value#>'{target,round,revision}' is distinct from to_jsonb(revision)
    or value#>>'{target,round,state}' is distinct from 'PENDING'
    or jsonb_array_length(value#>'{target,round,participants}') is distinct from members
    or jsonb_array_length(value#>'{target,visibleCommands}') is distinct from revision
    or jsonb_array_length(value#>'{target,visibleCommandIds}') is distinct from revision
    or jsonb_array_length(value->'sources') is distinct from sources
    or value#>>'{target,prefixDigest}' is distinct from md5((value#>'{target,visibleCommands}')::text)
    or value->>'inputDigest' is distinct from md5((value-'inputDigest')::text)
    or exists(select 1 from jsonb_array_elements(value#>'{target,round,responses}') r
      where r->>'status' is distinct from 'UNANSWERED') then
    raise exception 'Input capture lost scope/prefix, enrollment or closed admission'; end if;
end; $$;
create function pg_temp.input_row_snapshot() returns jsonb language plpgsql as $$
declare r record; digest text; result jsonb := '{}';begin
  for r in select format('%I.%I',n.nspname,c.relname) identity from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
      and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users')) loop
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]'')::text) from %s r',r.identity) into digest;
    result := result||jsonb_build_object(r.identity,digest);
  end loop;return result;
end; $$;

do $input_matrix$ declare f record;c record;p record; value jsonb;frozen jsonb;cold jsonb;
  capture_id uuid := 'a232f100-0000-4000-8000-000000000060'; cold_id uuid := gen_random_uuid();
  r uuid; source_id uuid; target_id uuid; ids uuid[]; bad_source uuid; i integer;
  event_digest text; interaction_digest text; ranking_digest text; evaluation_digest text;
  role_name text; relation text; target regprocedure; source private.shared_round_outcome_captures%rowtype;
  deletion_kind text; large_profile uuid := gen_random_uuid(); members uuid[] := '{}';
  source_result jsonb; cutoff timestamptz; quota_round uuid; quota_id uuid; large_ids uuid[] := '{}'; before_state jsonb; rejoin_round uuid;
  delivery jsonb; origin jsonb; outsider_profile uuid; claimed_run uuid; claimed_input uuid; raw_command jsonb;
begin
  select * into strict f from pg_temp.outcome_fixture;select * into strict c from pg_temp.capture_fixture;
  select * into strict p from pg_temp.prediction_input_fixture;
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]')::text) into event_digest from public.events e;
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by to_jsonb(e)::text),'[]')::text) into interaction_digest from public.item_interactions e;
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]')::text) into ranking_digest from private.prediction_runs e;
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]')::text) into evaluation_digest from private.genome_evaluations e;

  foreach target in array array[
    'private.capture_shared_round_prediction_input_v1(uuid,uuid,uuid,integer,uuid[])'::regprocedure,
    'private.get_shared_round_prediction_input_v1(uuid)'::regprocedure] loop
    if exists(select 1 from pg_proc where oid=target and (prosecdef or proconfig is null or not ('search_path=""'=any(proconfig))
      or exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) where grantee=0 and privilege_type='EXECUTE'))) then
      raise exception 'Input API has definer authority, open path or PUBLIC execute'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_function_privilege(role_name,target,'EXECUTE') then raise exception 'API role can execute %',target; end if;
    end loop;
  end loop;
  foreach relation in array array['private.shared_round_prediction_inputs','private.shared_round_prediction_input_sources'] loop
    if not exists(select 1 from pg_class where oid=relation::regclass and relrowsecurity) then raise exception 'Input table lacks RLS'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(role_name,relation,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception 'API role holds input table privilege'; end if;
    end loop;
  end loop;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    perform set_config('role',role_name,true);
    begin perform private.get_shared_round_prediction_input_v1(capture_id);raise exception 'API input read succeeded';
      exception when insufficient_privilege then null;end;
    begin perform private.capture_shared_round_prediction_input_v1(capture_id,f.pair,p.round_id,1,'{}');
      raise exception 'API input write succeeded';exception when insufficient_privilege then null;end;
    foreach relation in array array['private.shared_round_prediction_inputs','private.shared_round_prediction_input_sources'] loop
      begin execute format('select count(*) from %s',relation);raise exception 'API input table read succeeded';
        exception when insufficient_privilege then null;end;
    end loop;
    perform set_config('role','postgres',true);
  end loop;

  value := pg_temp.input_capture(f.actor,capture_id,f.pair,p.round_id,1,array[p.source_capture_id]);
  perform pg_temp.assert_prediction_input(value,1,2,1);frozen := value;
  if value#>'{target,round}' is distinct from (select result->'round' from private.shared_rating_round_receipts
      where command_id=(value#>>'{target,sourceCommandId}')::uuid)
    or value->'sources' is distinct from jsonb_build_array(private.get_shared_round_outcome_capture_v1(p.source_capture_id))
    or value->>'capturedByActorUserId' is distinct from f.actor::text
    or private.get_shared_round_prediction_input_v1(capture_id) is distinct from frozen then
    raise exception 'Input artifact is not the exact actual visible source/target read';end if;
  cold := pg_temp.input_capture(f.actor,cold_id,f.multi,p.n_round_id,1,'{}');
  perform pg_temp.assert_prediction_input(cold,1,3,0);
  if exists(select 1 from private.shared_round_prediction_input_sources where input_id=cold_id) then
    raise exception 'Empty cold start fabricated a source';end if;

  -- The existing producer accepts integral JSON numeric scale and UUID case;
  -- their exact raw spelling must survive the new immutable prefix capture.
  r := gen_random_uuid();
  raw_command := jsonb_build_object('version',1,'commandId',upper(gen_random_uuid()::text),
    'actorUserId',upper(f.actor::text),'profileId',upper(f.pair::text),'roundId',upper(r::text),
    'kind','OPEN_ROUND','expectedRevision',0.0::numeric,'itemId',upper(f.movie::text),'experienceId',upper(gen_random_uuid()::text));
  perform pg_temp.outcome_commit(f.actor,raw_command);
  value := pg_temp.input_capture(f.actor,gen_random_uuid(),f.pair,r,1,'{}');
  perform pg_temp.assert_prediction_input(value,1,2,0);
  if value#>'{target,visibleCommands,0,command}' is distinct from raw_command
    or value#>>'{target,visibleCommands,0,command,actorUserId}' is distinct from upper(f.actor::text)
    or value#>>'{target,visibleCommands,0,command,expectedRevision}' is distinct from '0.0' then
    raise exception 'Genuine numeric-scale/uppercase producer command was rewritten';end if;
  insert into public.profile_members(profile_id,user_id) values(f.pair,f.third);
  raw_command := jsonb_build_object('version',1,'commandId',upper(gen_random_uuid()::text),
    'actorUserId',upper(f.actor::text),'profileId',upper(f.pair::text),'roundId',upper(r::text),
    'kind','RECONFIRM_ROUND','expectedRevision',1.0::numeric);
  perform pg_temp.outcome_commit(f.actor,raw_command);
  value := pg_temp.input_capture(f.actor,gen_random_uuid(),f.pair,r,2,'{}');
  perform pg_temp.assert_prediction_input(value,2,3,0);
  if value#>'{target,visibleCommands,1,command}' is distinct from raw_command
    or value#>>'{target,visibleCommands,1,command,actorUserId}' is distinct from upper(f.actor::text)
    or value#>>'{target,visibleCommands,1,command,expectedRevision}' is distinct from '1.0' then
    raise exception 'Genuine numeric-scale/uppercase RECONFIRM command was rewritten';end if;
  delete from public.profile_members where profile_id=f.pair and user_id=f.third;
  perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,r,'CANCEL_ROUND',2));

  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,0,''{}'')',f.actor,gen_random_uuid(),f.pair,p.round_id));
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,2,''{}'')',f.actor,gen_random_uuid(),f.pair,p.round_id),'55000');
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,null)',f.actor,gen_random_uuid(),f.pair,p.round_id));
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,array[null]::uuid[])',f.actor,gen_random_uuid(),f.pair,p.round_id));
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,array[%L,%L]::uuid[])',f.actor,gen_random_uuid(),f.pair,p.round_id,p.source_capture_id,p.source_capture_id));
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,array[%L]::uuid[])',f.actor,gen_random_uuid(),f.pair,p.round_id,gen_random_uuid()),'55000');
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,''{}'')',f.outsider,gen_random_uuid(),f.pair,p.round_id),'42501');
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,''{}'')',f.actor,gen_random_uuid(),f.personal,p.round_id),'42501');
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,''{}'')',f.actor,gen_random_uuid(),f.multi,p.round_id),'55000');
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,''{}'')',f.actor,capture_id,f.pair,p.round_id));
  perform pg_temp.input_reject(format('update private.shared_round_prediction_inputs set result=''{}'' where id=%L',capture_id),'55000');
  perform pg_temp.input_reject(format('update private.shared_round_prediction_input_sources set source_capture_id=source_capture_id where input_id=%L',capture_id),'55000');
  perform pg_temp.input_reject(format('delete from private.shared_round_prediction_input_sources where input_id=%L',capture_id),'55000');
  if private.get_shared_round_prediction_input_v1(capture_id) is distinct from frozen
    or not exists(select 1 from private.shared_round_prediction_input_sources where input_id=capture_id) then
    raise exception 'Denied direct dependency deletion changed parent or its source edge';end if;

  -- Distinct capture IDs cannot multiply one source experience, and a current
  -- target's pending capture cannot be supplied as its own preceding input.
  source_id := gen_random_uuid();
  perform private.capture_shared_rating_round_outcome_v1(source_id,f.pair,c.round_id,
    c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds');
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,array[%L,%L]::uuid[])',
    f.actor,gen_random_uuid(),f.pair,p.round_id,p.source_capture_id,source_id),'55000');
  source_id := gen_random_uuid();cutoff := clock_timestamp();
  perform private.capture_shared_rating_round_outcome_v1(source_id,f.pair,p.round_id,cutoff,cutoff,interval '0 seconds');
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,array[%L]::uuid[])',
    f.actor,gen_random_uuid(),f.pair,p.round_id,source_id),'55000');
  source_id := gen_random_uuid();cutoff := clock_timestamp();
  perform private.capture_shared_rating_round_outcome_v1(source_id,f.multi,p.n_round_id,cutoff,cutoff,interval '0 seconds');
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,array[%L]::uuid[])',
    f.actor,gen_random_uuid(),f.pair,p.round_id,source_id),'55000');

  -- Producer snapshots remain exact; malformed stored metadata is privileged
  -- rollback-only negative data, never a substitute for native observations.
  select * into strict source from private.shared_round_outcome_captures where id=p.source_capture_id;
  foreach deletion_kind in array array['DIGEST','FUTURE','INFINITE','SAME_EXPERIENCE'] loop
    begin
      bad_source := gen_random_uuid();source_result := source.result||jsonb_build_object('captureId',bad_source);
      if deletion_kind='DIGEST' then source_result := source_result||jsonb_build_object('outcomeDigest',repeat('0',32));
      elsif deletion_kind='FUTURE' then source_result := source_result||jsonb_build_object('observedAt',clock_timestamp()+interval '1 day');
      elsif deletion_kind='INFINITE' then source_result := source_result||jsonb_build_object('observedAt','infinity');
      else source_result := jsonb_set(source_result,'{outcome,round,experienceId}',
        (select to_jsonb(experience_id) from private.shared_rating_rounds where id=p.round_id));
        source_result := source_result||jsonb_build_object('outcomeDigest',md5((source_result->'outcome')::text));end if;
      insert into private.shared_round_outcome_captures(id,profile_id,round_id,item_id,source_command_id,source_revision,request,result,observed_at)
        values(bad_source,source.profile_id,source.round_id,source.item_id,source.source_command_id,source.source_revision,
          source.request||jsonb_build_object('captureId',bad_source),source_result,case when deletion_kind='INFINITE' then 'infinity'::timestamptz
            when deletion_kind='FUTURE' then clock_timestamp()+interval '1 day' else source.observed_at end);
      perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,array[%L]::uuid[])',
        f.actor,gen_random_uuid(),f.pair,p.round_id,bad_source),'55000');
      raise exception 'rollback malformed source control' using errcode='ZX232';
    exception when sqlstate 'ZX232' then null;end;
  end loop;

  -- A real source outside the input roster can be retained as an UNATTRIBUTED
  -- caller claim. It earns no exposure/quality credit, but its copied identifier
  -- remains an erasure dependency even though the input contains no trace pool.
  begin
    select id into strict outsider_profile from public.profiles where profile_type='PERSONAL' and owner_user_id=f.outsider;
    perform set_config('request.jwt.claim.sub',f.outsider::text,true);perform set_config('role','authenticated',true);
    delivery := public.rank_items_page_v1(jsonb_build_object('version',3,'requestId',gen_random_uuid(),
      'profileId',outsider_profile,'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',10,'context','{}'::jsonb));
    perform set_config('role','postgres',true);
    claimed_run := (delivery->>'predictionId')::uuid;
    origin := jsonb_build_object('predictionId',claimed_run,'sessionId',delivery->'sessionId','discoveryMode','FOR_YOU');
    r := pg_temp.input_open(f.actor,f.pair,f.book);
    perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,r,'SET_RESPONSE',1,
      jsonb_build_object('rating',0,'origin',origin)));
    perform pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.pair,r,'SET_RESPONSE',2,'{"rating":10}'));
    source_id := gen_random_uuid();cutoff := clock_timestamp();
    perform private.capture_shared_rating_round_outcome_v1(source_id,f.pair,r,cutoff,cutoff,interval '0 seconds');
    claimed_input := gen_random_uuid();value := pg_temp.input_capture(f.actor,claimed_input,f.pair,p.round_id,1,array[source_id]);
    perform pg_temp.assert_prediction_input(value,1,2,1);
    if value#>>'{sources,0,outcome,responses,0,attribution,status}' is distinct from 'UNATTRIBUTED'
      or value#>>'{sources,0,outcome,responses,0,origin,claimedPredictionId}' is distinct from claimed_run::text
      or not exists(select 1 from private.shared_round_prediction_inputs i where i.id=claimed_input
        and i.origin_prediction_ids @> array[claimed_run]) then
      raise exception 'Unattributed copied claim lost its erasure-only dependency';end if;
    perform private.erase_prediction_sources_v1('PREDICTION_RUN',claimed_run);
    if private.get_shared_round_prediction_input_v1(claimed_input) is not null
      or exists(select 1 from private.shared_round_prediction_input_sources where input_id=claimed_input)
      or private.get_shared_round_outcome_capture_v1(source_id) is null then
      raise exception 'Claimed run preparation did not erase whole input while retaining canonical outcome';end if;
    raise exception 'rollback claimed source control' using errcode='ZX232';
  exception when sqlstate 'ZX232' then null;end;

  -- The upper bound uses 16 different real prior experiences, not duplicated
  -- revisions. Reversing caller order retains one canonical immutable request.
  ids := array[p.source_capture_id];
  for i in 1..15 loop
    r := pg_temp.input_open(f.actor,f.pair,f.book);
    perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,r,'SET_RESPONSE',1,'{"rating":0}'));
    perform pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.pair,r,'SET_RESPONSE',2,'{"rating":10}'));
    source_id := gen_random_uuid();cutoff := clock_timestamp();
    perform private.capture_shared_rating_round_outcome_v1(source_id,f.pair,r,cutoff,cutoff,interval '0 seconds');
    ids := array_append(ids,source_id);
  end loop;
  quota_id := gen_random_uuid();value := pg_temp.input_capture(f.actor,quota_id,f.pair,p.round_id,1,ids);
  perform pg_temp.assert_prediction_input(value,1,2,16);
  if pg_temp.input_capture(f.actor,quota_id,f.pair,p.round_id,1,
    (select array_agg(id order by position desc) from unnest(ids) with ordinality members(id,position))) is distinct from value then
    raise exception 'Caller source ordering changed semantic exact retry';end if;
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,%L::uuid[])',f.actor,
    gen_random_uuid(),f.pair,p.round_id,array_append(ids,gen_random_uuid())),'22023');
  quota_round := pg_temp.input_open(f.actor,f.pair,f.movie);
  for i in 1..16 loop perform pg_temp.input_capture(f.actor,gen_random_uuid(),f.pair,quota_round,1,'{}');end loop;
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,''{}'')',f.actor,
    gen_random_uuid(),f.pair,quota_round),'54000');
  perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,quota_round,'CANCEL_ROUND',1));

  -- Per-source rows satisfy their old 512KiB constraint, while the complete new
  -- copied artifact exceeds its 8MiB budget. Failure leaves no parent/edges.
  begin
    for source in select * from private.shared_round_outcome_captures where id=any(ids) loop
      bad_source := gen_random_uuid();source_result := source.result||jsonb_build_object('captureId',bad_source,'padding','');
      source_result := source_result||jsonb_build_object('padding',repeat('x',524250-octet_length(source_result::text)));
      insert into private.shared_round_outcome_captures(id,profile_id,round_id,item_id,source_command_id,source_revision,request,result,observed_at)
        values(bad_source,source.profile_id,source.round_id,source.item_id,source.source_command_id,source.source_revision,
          source.request||jsonb_build_object('captureId',bad_source),source_result,source.observed_at);
      large_ids := array_append(large_ids,bad_source);
    end loop;
    quota_id := gen_random_uuid();
    perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,%L::uuid[])',f.actor,
      quota_id,f.pair,p.round_id,large_ids),'54000');
    if exists(select 1 from private.shared_round_prediction_inputs where id=quota_id)
      or exists(select 1 from private.shared_round_prediction_input_sources where input_id=quota_id) then
      raise exception 'Oversized capture partially allocated';end if;
    raise exception 'rollback size control' using errcode='ZX232';
  exception when sqlstate 'ZX232' then null;end;

  -- A whole zero-answer receipt prefix survives an unresponded reconfirmation.
  insert into public.profile_members(profile_id,user_id) values(f.pair,f.third);
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,''{}'')',f.actor,gen_random_uuid(),f.pair,p.round_id),'55000');
  perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,p.round_id,'RECONFIRM_ROUND',1));
  value := pg_temp.input_capture(f.actor,gen_random_uuid(),f.pair,p.round_id,2,'{}');
  perform pg_temp.assert_prediction_input(value,2,3,0);
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,2,array[%L]::uuid[])',f.actor,gen_random_uuid(),f.pair,p.round_id,p.source_capture_id),'55000');
  delete from public.profile_members where profile_id=f.pair and user_id=f.third;
  perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,p.round_id,'RECONFIRM_ROUND',2));
  value := pg_temp.input_capture(f.actor,gen_random_uuid(),f.pair,p.round_id,3,array[p.source_capture_id]);
  perform pg_temp.assert_prediction_input(value,3,2,1);

  -- No response history can be hidden by UNKNOWN, CLEAR or a later enrollment.
  foreach deletion_kind in array array['RATED','UNKNOWN','CLEARED','RATED_THEN_CLEAR','RATED_THEN_RECONFIRM'] loop
    r := pg_temp.input_open(f.actor,f.pair,f.movie);
    if deletion_kind='CLEARED' then
      perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,r,'CLEAR_RESPONSE',1));
    else
      perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,r,'SET_RESPONSE',1,
        jsonb_build_object('rating',case when deletion_kind='UNKNOWN' then null else 0 end)));
    end if;
    if deletion_kind='RATED_THEN_CLEAR' then
      perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,r,'CLEAR_RESPONSE',2));
    elsif deletion_kind='RATED_THEN_RECONFIRM' then
      insert into public.profile_members(profile_id,user_id) values(f.pair,f.third);
      perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,r,'RECONFIRM_ROUND',2));
    end if;
    perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,%s,''{}'')',f.actor,
      gen_random_uuid(),f.pair,r,(select revision from private.shared_rating_rounds where id=r)),'55000');
    if deletion_kind='RATED_THEN_RECONFIRM' then
      begin
        delete from private.shared_rating_round_responses where round_id=r;
        perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,3,''{}'')',f.actor,gen_random_uuid(),f.pair,r),'55000');
        raise exception 'rollback independently removed response' using errcode='ZX232';
      exception when sqlstate 'ZX232' then null;end;
    end if;
    if deletion_kind='RATED_THEN_RECONFIRM' then delete from public.profile_members where profile_id=f.pair and user_id=f.third;end if;
    perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,r,'CANCEL_ROUND',
      (select revision from private.shared_rating_rounds where id=r)));
  end loop;
  perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,p.round_id,'SET_RESPONSE',3,'{"rating":0}'));
  if pg_temp.input_capture(f.actor,capture_id,f.pair,p.round_id,1,array[p.source_capture_id]) is distinct from frozen then
    raise exception 'Exact capture retry after first answer changed';end if;
  rejoin_round := pg_temp.input_open(f.actor,f.pair,f.movie);
  delete from public.profile_members where profile_id=f.pair and user_id=f.actor;
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,array[%L]::uuid[])',f.actor,capture_id,f.pair,p.round_id,p.source_capture_id),'42501');
  insert into public.profile_members(profile_id,user_id) values(f.pair,f.actor);

  -- No canonical Event/state/ranking/evaluator reader receives these inputs.
  if event_digest is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]')::text) from public.events e)
    or interaction_digest is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(e) order by to_jsonb(e)::text),'[]')::text) from public.item_interactions e)
    or ranking_digest is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]')::text) from private.prediction_runs e)
    or evaluation_digest is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]')::text) from private.genome_evaluations e) then
    raise exception 'Capture foundation changed canonical taste, predictions or metrics';end if;

  -- Current generations changed on rejoin. Fresh target matches them; old source
  -- does not, and no subset/intersection may silently stand in for the group.
  r := rejoin_round;
  perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,r,'RECONFIRM_ROUND',1));
  value := pg_temp.input_capture(f.actor,gen_random_uuid(),f.pair,r,2,'{}');
  perform pg_temp.assert_prediction_input(value,2,2,0);
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,2,array[%L]::uuid[])',f.actor,gen_random_uuid(),f.pair,r,p.source_capture_id),'55000');

  -- Prefix holes/duplicate revisions and oversized participant groups fail atomically.
  begin
    delete from private.shared_rating_round_receipts where round_id=r;
    perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,2,''{}'')',f.actor,gen_random_uuid(),f.pair,r),'55000');
    raise exception 'rollback prefix deletion control' using errcode='ZX232';
  exception when sqlstate 'ZX232' then null;end;
  begin
    insert into private.shared_rating_round_receipts(command_id,actor_user_id,profile_id,round_id,command,result,created_at)
      select gen_random_uuid(),receipt.actor_user_id,receipt.profile_id,receipt.round_id,receipt.command,receipt.result,receipt.created_at
        from private.shared_rating_round_receipts receipt where receipt.round_id=r;
    perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,2,''{}'')',f.actor,gen_random_uuid(),f.pair,r),'55000');
    raise exception 'rollback duplicate prefix control' using errcode='ZX232';
  exception when sqlstate 'ZX232' then null;end;
  for i in 1..33 loop
    target_id := gen_random_uuid();members := array_append(members,target_id);
    insert into auth.users(id,email,raw_user_meta_data) values(target_id,target_id||'@example.invalid',
      jsonb_build_object('kajo_nickname','Input member '||lpad(i::text,2,'0')));
  end loop;
  insert into public.profiles(id,profile_type,name) values(large_profile,'SHARED','Bounded input');
  insert into public.profile_members(profile_id,user_id) select large_profile,id from unnest(members[1:32]) id;
  target_id := pg_temp.input_open(members[1],large_profile,f.movie);
  value := pg_temp.input_capture(members[1],gen_random_uuid(),large_profile,target_id,1,'{}');
  perform pg_temp.assert_prediction_input(value,1,32,0);
  insert into public.profile_members(profile_id,user_id) values(large_profile,members[33]);
  perform pg_temp.input_reject(format('select pg_temp.input_capture(%L,%L,%L,%L,1,''{}'')',members[1],gen_random_uuid(),large_profile,target_id),'55000');

  -- Existing unresolved learned influence rejects before new input invalidation;
  -- a denial must preserve every old and new populated row, not merely the root.
  begin
    insert into private.promotion_decisions(genome_id,scope_type,scope_key,to_state,evaluation_window_id,metrics,decided_by,reason)
      values(c.genome_id,'GLOBAL','GLOBAL','REJECTED',c.window_id,'{"copiedInputDependency":true}',
        'INPUT_NEGATIVE_CONTROL','Unresolved learned source influence');
    before_state := pg_temp.input_row_snapshot();
    perform pg_temp.input_reject(format('select private.erase_prediction_sources_v1(''ACTOR'',%L)',f.partner),'55000');
    if pg_temp.input_row_snapshot() is distinct from before_state
      or private.get_shared_round_prediction_input_v1(capture_id) is distinct from frozen then
      raise exception 'Policy guard failure partially invalidated copied inputs';end if;
    raise exception 'rollback promotion guard control' using errcode='ZX232';
  exception when sqlstate 'ZX232' then null;end;

  -- Source/target erasure removes WHOLE parents, never only dependency edges.
  foreach deletion_kind in array array['SOURCE_CAPTURE','TARGET_RECEIPT','PROFILE','ITEM','FORMER_PARTICIPANT','ACTOR_PREPARE','FORMER_ACTOR_PREPARE'] loop
    begin
      if deletion_kind='SOURCE_CAPTURE' then
        delete from private.shared_round_outcome_captures where id=p.source_capture_id;
        if private.get_shared_round_prediction_input_v1(capture_id) is not null then raise exception 'Copied source survived deletion';end if;
        if private.get_shared_round_prediction_input_v1(cold_id) is null then raise exception 'Unrelated cold capture erased';end if;
      elsif deletion_kind='TARGET_RECEIPT' then
        delete from private.shared_rating_round_receipts where command_id=(frozen#>>'{target,sourceCommandId}')::uuid;
        if private.get_shared_round_prediction_input_v1(capture_id) is not null then raise exception 'Target receipt capture survived';end if;
      elsif deletion_kind='PROFILE' then
        -- Remove immutable prediction sources first, then delete the root in
        -- this disposable transaction, preserving canonical preparation rules.
        perform private.erase_prediction_sources_v1('PROFILE',f.multi);
        delete from public.profiles where id=f.multi;
        if private.get_shared_round_prediction_input_v1(cold_id) is not null then raise exception 'Profile capture survived';end if;
      elsif deletion_kind='ITEM' then
        delete from public.items where id=f.movie;
        if private.get_shared_round_prediction_input_v1(capture_id) is not null then raise exception 'Item capture survived';end if;
      elsif deletion_kind='FORMER_PARTICIPANT' then
        delete from public.profile_members where profile_id=f.multi and user_id=f.third;
        delete from auth.users where id=f.third;
        if private.get_shared_round_prediction_input_v1(cold_id) is not null then raise exception 'Former participant retained in input vector';end if;
      elsif deletion_kind='ACTOR_PREPARE' then
        -- Preparation does not delete the User, but must remove frozen input
        -- rosters containing the erased actor, including noncreator membership.
        perform private.erase_prediction_sources_v1('ACTOR',f.partner);
        if not exists(select 1 from public.users where id=f.partner)
          or private.get_shared_round_prediction_input_v1(cold_id) is not null
          or private.get_shared_round_prediction_input_v1(capture_id) is not null then
          raise exception 'Actor preparation retained copied participant input or deleted root';end if;
      else
        delete from public.profile_members where profile_id=f.multi and user_id=f.third;
        perform pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.multi,p.n_round_id,'RECONFIRM_ROUND',1));
        target_id := gen_random_uuid();value := pg_temp.input_capture(f.actor,target_id,f.multi,p.n_round_id,2,'{}');
        perform pg_temp.assert_prediction_input(value,2,2,0);
        if exists(select 1 from private.prediction_runs where actor_user_id=f.third) then raise exception 'Control unexpectedly owns source runs';end if;
        perform private.erase_prediction_sources_v1('ACTOR',f.third);
        if not exists(select 1 from public.users where id=f.third)
          or private.get_shared_round_prediction_input_v1(cold_id) is not null
          or private.get_shared_round_prediction_input_v1(target_id) is not null then
          raise exception 'Departed noncreator survived copied prefix erasure';end if;
      end if;
      if exists(select 1 from private.shared_round_prediction_input_sources edge
        where not exists(select 1 from private.shared_round_prediction_inputs parent where parent.id=edge.input_id)) then
        raise exception 'Erasure left orphan input dependency';end if;
      raise exception 'rollback erasure control' using errcode='ZX232';
    exception when sqlstate 'ZX232' then null;end;
  end loop;
end; $input_matrix$;
select jsonb_build_object('sharedRoundPredictionInputs',
  'PASS: exact pre-response inputs, whole enrollment/prefix, cold start, immutable retries, closed admission, bounded sources and cascading erasure') snapshot;
