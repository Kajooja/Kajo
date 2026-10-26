import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

// Synthetic fixtures for the shared native request boundary, never hosted data.
export async function nativeCandidateRequestFixtureSql() {
  return `${await personalTasteSessionFixtureSql()}
insert into public.profiles(id,profile_type,name)
  values('ab157000-0000-4000-8000-000000000900','SHARED','Native request Shared');
insert into public.profile_members(profile_id,user_id)
  values('ab157000-0000-4000-8000-000000000900','ab157000-0000-4000-8000-000000000001'),
    ('ab157000-0000-4000-8000-000000000900','ab157000-0000-4000-8000-000000000002');
insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at)
  select gen_random_uuid(),p.owner_user_id,p.id,'ab157000-0000-4000-8000-000000000101','MOVIE','ITEM_RATED',
    jsonb_build_object('rating',case when p.owner_user_id='ab157000-0000-4000-8000-000000000001' then 9 else 2 end),
    now()-interval '2 hours',now()-interval '2 hours'
  from public.profiles p where p.profile_type='PERSONAL'
    and p.owner_user_id::text like 'ab157000-%';
insert into public.item_interactions(profile_id,item_id,actor_user_id,consumed,saved)
  select p.id,i.id,'ab157000-0000-4000-8000-000000000001',i.id='ab157000-0000-4000-8000-000000000102',
    i.id in('ab157000-0000-4000-8000-000000000103','ab157000-0000-4000-8000-000000000104')
  from public.profiles p cross join public.items i
  where (p.id='ab157000-0000-4000-8000-000000000900' or p.owner_user_id='ab157000-0000-4000-8000-000000000001')
    and i.id in('ab157000-0000-4000-8000-000000000102','ab157000-0000-4000-8000-000000000103','ab157000-0000-4000-8000-000000000104');
update public.item_list_entries e set added_at=now()-interval '45 days'
  where e.item_id='ab157000-0000-4000-8000-000000000103';`;
}

// Independent native CLI smoke uses the same real entry points as the local
// regression. The entire fixture, forecasts and deliberate rejection roll back.
export async function nativeCandidateRequestSmokeSql() {
  return `begin;
${await nativeCandidateRequestFixtureSql()}
do $native_request$
declare actor uuid:='ab157000-0000-4000-8000-000000000001'; personal uuid; profile uuid;
  prediction uuid; mode text; acquisition text; expected jsonb; actual jsonb; before_runs bigint;
  ids uuid[]:=array['ab157000-0000-4000-8000-000000000101','ab157000-0000-4000-8000-000000000121']::uuid[];
  seen uuid[]:=array['ab157000-0000-4000-8000-000000000100']::uuid[]; captured jsonb;
begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select id into strict personal from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  foreach profile in array array[personal,'ab157000-0000-4000-8000-000000000900'::uuid] loop
    foreach mode in array array['FOR_YOU','SURPRISE','RISK'] loop
      foreach acquisition in array array['LEGACY_DISCOVERY','CATALOG_CHAIN'] loop
        prediction:=gen_random_uuid();
        expected:=jsonb_build_object('version','native-candidate-request-v1','acquisition',acquisition,
          'intent','DELIVERY','itemIds',null,'seenItemIds',case when acquisition='CATALOG_CHAIN' then to_jsonb(seen) else '[]'::jsonb end,
          'reminderSpent',acquisition='CATALOG_CHAIN','requiredAfter',null);
        if acquisition='CATALOG_CHAIN' then
          perform * from private.rank_items_catalog_with_identity_v1(seen,true,prediction,profile,mode,'MOVIE',5,'{}');
        else
          perform * from private.rank_items_with_identity_v1(prediction,profile,mode,'MOVIE',5,
            jsonb_build_object('candidateRequest',jsonb_build_object('intent','EVALUATION','itemIds',to_jsonb(ids))));
        end if;
        select state_snapshot->'candidateRequest' into strict actual from private.prediction_runs where id=prediction;
        if actual is distinct from expected or not exists(select 1 from private.prediction_candidates
          where prediction_id=prediction and selected_for_delivery) then
          raise exception 'Native request delivery branch or private envelope changed';
        end if;
        if acquisition='CATALOG_CHAIN' and exists(select 1 from private.prediction_candidates
          where prediction_id=prediction and item_id=any(seen)) then
          raise exception 'Native request lost catalogue seen exclusion';
        end if;
      end loop;
    end loop;
  end loop;
  prediction:=gen_random_uuid();
  captured:=private.capture_personal_evaluation_v1(prediction,personal,ids,now()-interval '1 second','{}');
  select state_snapshot->'candidateRequest' into strict actual from private.prediction_runs where id=prediction;
  if actual->>'acquisition'<>'EXPLICIT_CANONICAL' or actual->>'intent'<>'EVALUATION'
    or actual->'itemIds'<>to_jsonb(ids) or jsonb_array_length(captured->'items')<>2
    or exists(select 1 from private.prediction_candidates where prediction_id=prediction and selected_for_delivery)
    or (select result_count from private.prediction_runs where id=prediction)<>0 then
    raise exception 'Native request explicit evaluation became delivery or lost requested identities';
  end if;
  select count(*) into before_runs from private.prediction_runs;
  begin
    perform * from private.rank_items_candidate_with_identity_v1(now()+interval '1 day',ids,false,'{}',false,
      gen_random_uuid(),personal,'FOR_YOU',null,2,'{}');
    raise exception 'Native request accepted an uncommitted evaluation prefix';
  exception when serialization_failure then null;
  end;
  if (select count(*) from private.prediction_runs)<>before_runs then
    raise exception 'Rejected native request retained a forecast';
  end if;
end;$native_request$;
select jsonb_build_object('nativeCandidateRequest',
  'PASS: consumed legacy/catalogue/explicit requests, Personal/Shared and all modes, context isolation, non-delivery evaluation and prewrite prefix rejection') as snapshot;
rollback;`;
}

// Both engines rehearse this against the actual populated predecessor. Clock
// overrides and fresh Working-reference normalization exist only in the fixture.
export async function verifyNativeAcquisitionUpgrade(execSql, migration) {
  const { default: assert } = await import('node:assert/strict');
  const { randomUUID } = await import('node:crypto');
  const actor = 'ab157000-0000-4000-8000-000000000001';
  const literal = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
  const exec = (sql, stage) => execSql(sql, { stage: 'native-acquisition-upgrade-' + stage, timeoutMs: 300_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  let snapshots, original, failure, fixture = false;
  try {
    assert.match(migration.name, /_shared_native_candidate_acquisition\.sql$/);
    assert.equal(await one("select to_jsonb(to_regprocedure('private.acquire_native_candidates_v1(jsonb)'));", 'predecessor'), null);
    const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and n.nspname in('public','private','auth');`, 'tables');
    snapshots = 'begin read only;set local extra_float_digits=3;select jsonb_object_agg(name,value) from (' + tables.map(name => `select '${name}' name,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value
      from ${name} r`).join(' union all ') + ') s;rollback;';
    original = await one(snapshots, 'original');
    assert.equal(await one("select to_jsonb(count(*)) from auth.users where id::text like 'ab157000-%';", 'reserved-scope'), 0);
    fixture = true;
    await exec('begin;' + await nativeCandidateRequestFixtureSql() + 'commit;', 'fixture');
    const profileId = await one(`select to_jsonb(id) from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL';`, 'profile');
    const call = request => one(`begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;
      select public.taste_session_v2(${literal(request)});commit;`, 'command');
    const start = await call({ operation: 'START', profileId, requestId: randomUUID() });
    const next = { operation: 'NEXT', profileId, sessionId: start.sessionId, requestId: randomUUID(), expectedRevision: start.revision };
    const question = await call(next);
    assert.equal(question.status, 'QUESTION');
    const pageRequest = { version: 3, requestId: randomUUID(), profileId, sessionId: start.sessionId,
      discoveryMode: 'FOR_YOU', itemType: 'MOVIE', limit: 5, context: {}, cursor: null, replacesChainId: null };
    const page = await one(`begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;
      select public.rank_items_feed_v1(${literal(pageRequest)});commit;`, 'retained-chain');
    const populated = await one(snapshots, 'populated');
    const report = await one(`begin;set local extra_float_digits=3;set local request.jwt.claim.sub='${actor}';
      create temp table acq_functions as select oid,proname,to_jsonb(p)-'prosrc' metadata,prosrc from pg_proc p
        where pronamespace in('private'::regnamespace,'public'::regnamespace) and prokind='f';
      create temp table acq_defaults as select to_jsonb(d) value from pg_default_acl d;
      create function pg_temp.acq_normalize(v jsonb) returns jsonb language plpgsql as $normalize$
      declare result jsonb;begin
        if jsonb_typeof(v)='object' then
          select coalesce(jsonb_object_agg(key,case when key='captureId' then '"fresh-working-capture"'::jsonb
            else pg_temp.acq_normalize(value) end),'{}') into result from jsonb_each(v);return result;
        elsif jsonb_typeof(v)='array' then
          select coalesce(jsonb_agg(pg_temp.acq_normalize(value) order by ord),'[]') into result
            from jsonb_array_elements(v) with ordinality x(value,ord);return result;
        elsif jsonb_typeof(v)='string' and (v#>>'{}') ~ '^native-working:[0-9a-f-]{36}(:|$)' then
          return to_jsonb(regexp_replace(v#>>'{}','^native-working:[0-9a-f-]{36}','native-working:fresh-working-capture'));
        end if;return v;
      end;$normalize$;
      create function pg_temp.acq_matrix() returns jsonb language plpgsql as $matrix$
      declare p uuid;m text;d text;b integer;f record;body text;result jsonb:='[]';output jsonb;lower_rows jsonb;
        run_row jsonb;candidates jsonb;seen uuid[];prediction uuid;case_n integer:=0;catalog jsonb;
      begin
        begin
          for f in select oid,prosrc,pg_get_functiondef(oid) definition from pg_proc where pronamespace='private'::regnamespace
            and proname in('rank_items_request_base_v1','rank_items_request_scalar_v1','rank_items_request_with_identity_v1') loop
            if (length(f.prosrc)-length(replace(f.prosrc,'clock_timestamp()','')))/length('clock_timestamp()')<>1 then
              raise exception 'Acquisition fixture wall-clock owner drift';end if;
            body:=replace(f.prosrc,'clock_timestamp()','transaction_timestamp()');execute replace(f.definition,f.prosrc,body);
          end loop;
          foreach p in array array['${profileId}'::uuid,'ab157000-0000-4000-8000-000000000900'::uuid] loop
            foreach m in array array['FOR_YOU','SURPRISE','RISK'] loop
              foreach d in array array[null,'BOOK','MOVIE'] loop
                for b in 0..2 loop
                  case_n:=case_n+1;prediction:=('ab157111-0000-4000-8000-'||lpad(case_n::text,12,'0'))::uuid;
                  seen:=case when b=2 then array['ab157000-0000-4000-8000-000000000100','ab157000-0000-4000-8000-000000000120']::uuid[] else '{}'::uuid[] end;
                  if b=0 then
                    select jsonb_agg(to_jsonb(r)||jsonb_build_object('prediction_id','score-only-id','scoreBits',encode(float8send(score),'hex'))) into lower_rows
                      from private.rank_items_v0(p,m,d,20,'{}') r;
                    select lower_rows||jsonb_agg(to_jsonb(r)||jsonb_build_object('prediction_id','score-only-id','scoreBits',encode(float8send(score),'hex'))) into lower_rows
                      from private.rank_items_scalar_v1(p,m,d,20,'{}') r;
                    select jsonb_agg(to_jsonb(r)||jsonb_build_object('scoreBits',encode(float8send(score),'hex'))) into output
                      from private.rank_items_with_identity_v1(prediction,p,m,d,20,'{}') r;
                  else
                    select jsonb_agg(to_jsonb(r)||jsonb_build_object('prediction_id','score-only-id','scoreBits',encode(float8send(score),'hex'))) into lower_rows
                      from private.rank_items_catalog_base_v1(seen,b=2,p,m,d,20,'{}') r;
                    select lower_rows||jsonb_agg(to_jsonb(r)||jsonb_build_object('prediction_id','score-only-id','scoreBits',encode(float8send(score),'hex'))) into lower_rows
                      from private.rank_items_catalog_scalar_v1(seen,b=2,p,m,d,20,'{}') r;
                    select jsonb_agg(to_jsonb(r)||jsonb_build_object('scoreBits',encode(float8send(score),'hex'))) into output
                      from private.rank_items_catalog_with_identity_v1(seen,b=2,prediction,p,m,d,20,'{}') r;
                  end if;
                  select to_jsonb(r) into strict run_row from private.prediction_runs r where id=prediction;
                  select jsonb_agg(to_jsonb(c)||jsonb_build_object('scoreBits',encode(float8send(final_score),'hex'),
                    'scenarioBits',encode(float8send(scenario_score),'hex')) order by final_rank) into candidates
                    from private.prediction_candidates c where prediction_id=prediction;
                  if candidates is null then raise exception 'Acquisition matrix lost candidates';end if;
                  result:=result||jsonb_build_array(jsonb_build_object('case',case_n,'profile',p,'mode',m,'domain',d,'branch',b,
                    'digest',md5(pg_temp.acq_normalize(jsonb_build_object('lower',lower_rows,'output',output,'run',run_row,'candidates',candidates))::text)));
                end loop;
              end loop;
            end loop;
          end loop;
          prediction:='ab157111-0000-4000-8000-000000000055';
          output:=private.capture_personal_evaluation_v1(prediction,'${profileId}',
            array['ab157000-0000-4000-8000-000000000101','ab157000-0000-4000-8000-000000000121','ab157000-0000-4000-8000-000000000999']::uuid[],
            '2000-01-01','{}');
          select to_jsonb(r) into strict run_row from private.prediction_runs r where id=prediction;
          select jsonb_agg(to_jsonb(c) order by item_id) into candidates from private.prediction_candidates c where prediction_id=prediction;
          catalog:=private.taste_candidate_catalog_v4('${start.sessionId}',now());
          if jsonb_array_length(catalog)=0 then raise exception 'Acquisition forward needs a live V4 catalogue';end if;
          result:=result||jsonb_build_array(jsonb_build_object('explicit',md5(pg_temp.acq_normalize(jsonb_build_object(
            'output',output,'run',run_row,'candidates',candidates))::text),'catalog',catalog));
          raise exception 'Rollback fixture-only clocks and matrix forecasts' using errcode='KJ001';
        exception when sqlstate 'KJ001' then null;end;
        return result;
      end;$matrix$;
      create temp table acq_before as select pg_temp.acq_matrix() value;
      ${migration.sql}
      do $metadata$ declare f record;begin
        for f in select * from acq_functions loop
          if (select to_jsonb(p)-'prosrc' from pg_proc p where oid=f.oid) is distinct from f.metadata
            or (f.proname not in('rank_items_request_base_v1','rank_items_request_with_identity_v1','taste_candidate_catalog_v4')
              and (select prosrc from pg_proc where oid=f.oid) is distinct from f.prosrc) then
            raise exception 'Acquisition forward changed unrelated body/identity/security metadata: %',f.proname;end if;
        end loop;
        if exists((select value from acq_defaults except select to_jsonb(d) from pg_default_acl d)
          union all (select to_jsonb(d) from pg_default_acl d except select value from acq_defaults)) then
          raise exception 'Acquisition forward changed ambient defaults';end if;
      end;$metadata$;
      select jsonb_build_object('before',(select value from acq_before),'after',pg_temp.acq_matrix());commit;`, 'populated-matrix');
    assert.equal(report.before.length, 55);
    assert.deepEqual(report.after, report.before, 'Acquisition forward changed complete fresh outputs, float8 bytes or V4 catalogue');
    assert.deepEqual(await one(snapshots, 'preserved'), populated, 'Acquisition forward changed a populated canonical row');
    assert.deepEqual(await call(next), question, 'Acquisition forward changed the retained V4 NEXT receipt');
    assert.deepEqual(await one(`begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;
      select public.rank_items_feed_v1(${literal(pageRequest)});commit;`, 'chain-retry'), page);
    assert.deepEqual(await one(snapshots, 'retries-preserved'), populated);
    return { status: 'PASS', cases: 54, explicitEvaluation: 'EXACT', scoreBytes: 'EXACT', v4Catalog: 'EXACT',
      canonicalRows: 'UNCHANGED', functionMetadata: 'UNCHANGED', defaultPrivileges: 'UNCHANGED',
      retainedRetries: 'V4_NEXT_AND_DISCOVERY_CHAIN', cleanup: 'CANONICAL_ROWS_RESTORED' };
  } catch (error) { failure = error; throw error; }
  finally {
    if (fixture) {
      try {
      await exec(`rollback;begin;
        do $erase$ declare a uuid;begin for a in select id from public.users where id::text like 'ab157000-%' loop
          perform private.erase_prediction_sources_v1('ACTOR',a);end loop;end;$erase$;
        delete from private.sequential_taste_sessions where actor_user_id::text like 'ab157000-%';
        delete from public.item_interactions where actor_user_id::text like 'ab157000-%';
        delete from public.profiles where id='ab157000-0000-4000-8000-000000000900';
        delete from auth.users where id::text like 'ab157000-%';
        delete from private.item_sources where item_id::text like 'ab157000-%';
        delete from public.items where id::text like 'ab157000-%';commit;`, 'cleanup');
      assert.deepEqual(await one(snapshots, 'cleaned'), original);
      } catch (error) { throw new AggregateError(failure ? [failure,error] : [error], 'Acquisition proof and cleanup failures retained'); }
    }
  }
}

// Real callers plus request capture, strict controls and full pre-selection pools.
// The temporary observer and every synthetic row roll back in both engines.
export async function nativeAcquisitionSmokeSql() {
  return `begin;set local extra_float_digits=3;
${await nativeCandidateRequestFixtureSql()}
create function pg_temp.acquisition_reject(request jsonb, expected text) returns void language plpgsql as $reject$
begin
  begin perform * from private.acquire_native_candidates_v1(request);
  exception when others then if sqlstate<>expected then raise;end if;return;end;
  raise exception 'Acquisition accepted invalid contract: %',request;
end;$reject$;
do $observe$ declare f record;begin
  select prosrc,pg_get_functiondef(oid) definition into strict f from pg_proc
    where oid='private.acquire_native_candidates_v1(jsonb)'::regprocedure;
  execute replace(f.definition,f.prosrc,replace(f.prosrc,E'begin\n  if acquisition_request',
    E'begin\n  perform set_config(''kajo.acquisition_calls'',(coalesce(nullif(current_setting(''kajo.acquisition_calls'',true),''''),''[]'')::jsonb||jsonb_build_array(acquisition_request))::text,true);\n  if acquisition_request'));
end;$observe$;
insert into public.items(id,item_type,title,tags,metadata)
  select ('ab157000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
    case when n<500 then 'MOVIE' else 'BOOK' end,'Acquisition bounds '||n,
    array['common-acquisition','acquisition-'||n],jsonb_build_object('coldStartRecognition',0.05,
      'coldStartPriorSource','KAJO_CURATED_RECOGNITION') from generate_series(300,629) n where n<430 or n>=500;
insert into private.item_sources(item_id,provider_key,provider_item_id)
  select id,'kajo_curated',id::text from public.items where title like 'Acquisition bounds %';
do $acquisition$
declare actor uuid:='ab157000-0000-4000-8000-000000000001';profile uuid;started jsonb;session_id uuid;
  catalog jsonb;calls jsonb;req jsonb;legacy jsonb;explicit_request jsonb;bad jsonb;pool jsonb;again jsonb;
  count_source integer;count_retained integer;code text;before_runs bigint;f record;
begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  started:=public.taste_session_v2(jsonb_build_object('operation','START','profileId',profile,'requestId',gen_random_uuid()));
  session_id:=(started->>'sessionId')::uuid;
  perform set_config('kajo.acquisition_calls','[]',true);
  catalog:=private.taste_candidate_catalog_v4(session_id,now());
  perform public.rank_items_feed_v1(jsonb_build_object('version',3,'requestId',gen_random_uuid(),
    'profileId',profile,'sessionId',session_id,'discoveryMode','FOR_YOU','itemType','MOVIE','limit',5,
    'context','{}'::jsonb,'cursor',null,'replacesChainId',null));
  perform private.capture_personal_evaluation_v1(gen_random_uuid(),profile,
    array['ab157000-0000-4000-8000-000000000101','ab157000-0000-4000-8000-000000000121']::uuid[],
    now()-interval '1 second',jsonb_build_object('sessionId',session_id));
  calls:=current_setting('kajo.acquisition_calls')::jsonb;
  if jsonb_array_length(calls)<>3 then raise exception 'Actual V4/feed/evaluation did not each consume the shared acquisition owner: %',calls;end if;
  for req in select value from jsonb_array_elements(calls) loop
    if req#>>'{scope,profileId}'<>profile::text or req#>>'{scope,actorUserId}'<>actor::text
      or req#>>'{scope,sessionId}'<>session_id::text then raise exception 'Actual acquisition lost its Profile/actor/session binding';end if;
    select jsonb_agg(to_jsonb(c) order by id) into pool from private.acquire_native_candidates_v1(req) c;
    select jsonb_agg(to_jsonb(c) order by id) into again from private.acquire_native_candidates_v1(req) c;
    if pool is null or pool is distinct from again then raise exception 'Identical acquisition inputs changed the full eligible pool';end if;
  end loop;
  req:=calls->0;legacy:=calls->1;explicit_request:=calls->2;
  select count(*),count(*) filter(where retained) into count_source,count_retained from private.acquire_native_candidates_v1(req);
  if count_source<>256 or count_retained<>50 or jsonb_array_length(catalog)<>50 then
    raise exception 'V4 recognition bounds or before-limit exclusions changed';end if;
  if (select jsonb_agg(id::text order by id) from private.acquire_native_candidates_v1(req) where retained)
    is distinct from (select jsonb_agg(value->>'id' order by value->>'id') from jsonb_array_elements(catalog)) then
    raise exception 'V4 rendering failed to consume the shared retained identities';end if;
  if exists(select 1 from private.acquire_native_candidates_v1(req) where id in(
    'ab157000-0000-4000-8000-000000000101','ab157000-0000-4000-8000-000000000102',
    'ab157000-0000-4000-8000-000000000103','ab157000-0000-4000-8000-000000000104')) then
    raise exception 'V4 known evidence/interaction exclusions moved after recognition selection';end if;
  if (select count(distinct tag) from jsonb_array_elements(catalog) item,lateral jsonb_array_elements_text(item->'tags') tag)>64 then
    raise exception 'V4 selection dictionary exceeded its retained bound';end if;
  -- High-recognition unavailable rows cannot crowd the pool. Legacy Discovery
  -- deliberately keeps its old discoverable-row policy; explicit and V4 do not.
  update public.items set created_at=now()+interval '1 day' where id='ab157000-0000-4000-8000-000000000105';
  delete from private.item_sources where item_id='ab157000-0000-4000-8000-000000000106';
  update private.item_sources set created_at=now()+interval '1 day' where item_id='ab157000-0000-4000-8000-000000000107';
  update public.items set discoverable=false where id='ab157000-0000-4000-8000-000000000108';
  if exists(select 1 from private.acquire_native_candidates_v1(req) where id::text between
    'ab157000-0000-4000-8000-000000000105' and 'ab157000-0000-4000-8000-000000000108') then
    raise exception 'Canonical acquisition admitted unavailable or withdrawn sources';end if;
  if (select count(*) from private.acquire_native_candidates_v1(legacy) where id::text between
    'ab157000-0000-4000-8000-000000000105' and 'ab157000-0000-4000-8000-000000000107')<>3 then
    raise exception 'Legacy source availability was silently changed';end if;
  explicit_request:=jsonb_set(explicit_request,'{candidateRequest,itemIds}',
    '["ab157000-0000-4000-8000-000000000105","ab157000-0000-4000-8000-000000000106","ab157000-0000-4000-8000-000000000107"]');
  if exists(select 1 from private.acquire_native_candidates_v1(explicit_request)) then
    raise exception 'Explicit canonical acquisition admitted unavailable sources';end if;
  select count(*) into before_runs from private.prediction_runs;
  for bad in select value from jsonb_array_elements(jsonb_build_array(
    null,'[]'::jsonb,'{}'::jsonb,req||'{"version":"future"}',req||'{"unknown":true}',req-'scope',
    req||'{"scope":null}',jsonb_set(req,'{scope,profileId}','null'),jsonb_set(req,'{scope,sessionId}','"invalid"'),
    req||'{"mode":null}',req||'{"mode":"SURPRISE"}',req||'{"itemType":"MOVIE"}',req||'{"itemType":5}',
    req||'{"nativeEvidenceAsOf":"2000-01-01T00:00:00Z"}',req||'{"nativeEvidenceAsOf":null}',
    req||'{"eligibilityAt":"infinity"}',req||'{"eligibilityAt":"2026-02-30T00:00:00Z"}',
    req||'{"eligibilityAt":"2026-01-01T00:00:00"}',req||'{"eligibilityClock":"CURRENT_WALL_TIME"}',
    req||'{"sourcePolicy":"LEGACY_DISCOVERABLE_ROWS"}',req||'{"candidateRequest":{}}',req||'{"tastePool":null}',
    jsonb_set(req,'{tastePool,retainedLimitPerDomain}','26'),jsonb_set(req,'{tastePool,selectionTagLimit}','65'),
    jsonb_set(req,'{tastePool,receiptAt}','"infinity"'),jsonb_set(req,'{tastePool,unknown}','true'),
    legacy||'{"sourcePolicy":"CANONICAL_AVAILABLE_AT_CUTOFF"}',legacy||'{"eligibilityClock":"TRANSACTION_START"}',
    legacy||jsonb_build_object('tastePool',req->'tastePool'),
    explicit_request||jsonb_build_object('eligibilityAt',now()-interval '1 day'),
    req||jsonb_build_object('padding',repeat('x',65536)))) loop
    perform pg_temp.acquisition_reject(bad,'22023');
  end loop;
  perform pg_temp.acquisition_reject(jsonb_set(req,'{scope,actorUserId}','"ab157000-0000-4000-8000-000000000002"'),'42501');
  perform pg_temp.acquisition_reject(jsonb_set(req,'{scope,profileId}',to_jsonb(gen_random_uuid())),'42501');
  perform pg_temp.acquisition_reject(jsonb_set(req,'{scope,sessionId}',to_jsonb(gen_random_uuid())),'42501');
  perform pg_temp.acquisition_reject(jsonb_set(req,'{tastePool,receiptRevision}','999'),'40001');
  perform pg_temp.acquisition_reject(jsonb_set(req,'{tastePool,receiptTransaction}','"uncommitted"'),'40001');
  perform pg_temp.acquisition_reject(jsonb_set(req,'{tastePool,receiptAt}','"2000-01-01T00:00:00Z"'),'40001');
  if (select count(*) from private.prediction_runs)<>before_runs then raise exception 'Acquisition rejection retained a forecast';end if;
  if private.taste_candidate_catalog_v4(session_id,'infinity')<>'[]'::jsonb
    or private.taste_candidate_catalog_v4(session_id,null)<>'[]'::jsonb then raise exception 'V4 invalid cutoff compatibility changed';end if;
  for f in select rolname from pg_roles where rolname in('anon','authenticated','service_role') loop
    if has_function_privilege(f.rolname,'private.acquire_native_candidates_v1(jsonb)','EXECUTE') then
      raise exception 'Private acquisition became an API grant';end if;
  end loop;
end;$acquisition$;
select jsonb_build_object('nativeAcquisition',jsonb_build_object('status','PASS',
  'version','native-candidate-acquisition-v1','actualConsumers',jsonb_build_array('TASTE_V4_CATALOG','DISCOVERY_FEED','EXPLICIT_EVALUATION'),
  'scope','PROFILE_ACTOR_ACTUAL_SESSION','sameInputPools','COMPLETE_EXACT','recognitionSourcePerDomain',128,
  'recognitionRetainedPerDomain',25,'selectionTagLimit',64,'invalidControls',37,
  'unlikePolicies','RETAINED_NOT_COMPARABLE','privateAccess','OWNER_ONLY','cleanup','ROLLBACK')) snapshot;
rollback;`;
}
