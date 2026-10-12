-- Own-Personal source foundation. No anonymous entry, challenge or UI activation.
-- Existing migrations, serving functions and frozen prediction rows are untouched.
create table private.taste_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  version text not null default 'personal-taste-session-v1' check (version='personal-taste-session-v1'),
  policy text not null default 'ADAPTIVE' check (policy in ('ADAPTIVE','PRIOR_ONLY')),
  policy_version text not null default 'taste-selection-v1' check (policy_version='taste-selection-v1'),
  feature_policy_version text not null default 'taste-tags-frequency-64-v1',
  catalog_as_of timestamptz not null,
  catalog jsonb not null check (jsonb_typeof(catalog)='array' and jsonb_array_length(catalog)<=256),
  presentations jsonb not null default '[]' check (jsonb_typeof(presentations)='array' and jsonb_array_length(presentations)<=24),
  books_acknowledged boolean not null default false,
  existing_completed boolean not null,
  revision integer not null default 0 check (revision between 0 and 200),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','STOPPED','REMOVED')),
  source_job_id uuid references private.profile_import_jobs(id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint taste_session_finite_time check (isfinite(catalog_as_of) and isfinite(created_at) and isfinite(updated_at))
);
create index taste_sessions_actor_idx on private.taste_sessions(actor_user_id);
create index taste_sessions_source_job_idx on private.taste_sessions(source_job_id) where source_job_id is not null;
create table private.taste_session_commands (
  session_id uuid not null references private.taste_sessions(id) on delete cascade,
  request_id uuid not null,
  command jsonb not null,
  result jsonb not null,
  primary key(session_id,request_id)
);
alter table private.taste_sessions enable row level security;
alter table private.taste_session_commands enable row level security;
revoke all on private.taste_sessions,private.taste_session_commands from public,anon,authenticated,service_role;

-- Removal through the existing import boundary also withdraws every retained
-- session/receipt copy in the same transaction. Lock conflicts abort atomically;
-- a racing answer cannot commit after this tombstone and reactivate its source.
create function private.withdraw_taste_source_v1() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
  if new.dataset_kind='TASTE_SESSION_V1' and new.source_provider='KAJO_CALIBRATION' and new.status='REMOVED' then
    update private.taste_sessions set status='REMOVED',catalog='[]',presentations='[]',updated_at=clock_timestamp()
      where source_job_id=new.id;
    delete from private.taste_session_commands where session_id in(select id from private.taste_sessions where source_job_id=new.id);
    update private.profile_bootstrap_evidence set active=false where source_job_id=new.id and active;
  end if;
  return new;
end;$$;
revoke all on function private.withdraw_taste_source_v1() from public,anon,authenticated,service_role;
create trigger withdraw_taste_source_v1 after update of status on private.profile_import_jobs
for each row when(new.status='REMOVED') execute function private.withdraw_taste_source_v1();

-- SQL adapter of the portable selector over a trusted binary-tag snapshot.
-- This private helper is parity-tested against the independent TS implementation.
create function private.select_taste_opportunity_v1(
  catalog jsonb, ledger jsonb, books_acknowledged boolean, existing_completed boolean, policy text
) returns jsonb language plpgsql immutable set search_path='' as $$
declare
  counts jsonb; decision jsonb; pending jsonb; candidate jsonb; stage text;
  movie_count integer; book_count integer; known_count integer; presented_count integer;
  recognition double precision; diversity double precision; information double precision;
begin
  select jsonb_build_object('presented',count(*),'answered',count(*) filter(where kind in('RATING','UNKNOWN','NOT_INTERESTED')),
    'knownRatings',count(*) filter(where kind='RATING'),'unknown',count(*) filter(where kind='UNKNOWN'),
    'notInterested',count(*) filter(where kind='NOT_INTERESTED'),'withdrawn',count(*) filter(where kind='WITHDRAWN'),
    'unanswered',count(*) filter(where kind is null or kind='WITHDRAWN')),
    count(*) filter(where p->>'stageId'='movies'),count(*) filter(where p->>'stageId'='books'),
    count(*) filter(where kind='RATING'),count(*)
  into counts,movie_count,book_count,known_count,presented_count
  from (select p,p#>>'{responses,-1,answer,kind}' kind from jsonb_array_elements(ledger) p) current_answers;
  pending:=ledger->-1;
  stage:=case when books_acknowledged then 'books' else 'movies' end;
  if existing_completed then
    decision:=jsonb_build_object('kind','STOP','reason','EXISTING_COMPLETION','failOpen',false);
  elsif pending is not null and (jsonb_array_length(pending->'responses')=0 or pending#>>'{responses,-1,answer,kind}'='WITHDRAWN') then
    decision:=jsonb_build_object('kind','QUESTION','stageId',pending->>'stageId','itemId',pending->>'objectId','replay',true,'components',null);
  elsif presented_count>=24 then
    decision:=jsonb_build_object('kind','STOP','reason','OPPORTUNITY_LIMIT','failOpen',known_count<8);
  elsif not books_acknowledged and (movie_count>=10 or not exists(
    select 1 from jsonb_array_elements(catalog) c where c->>'itemType'='MOVIE'
      and not exists(select 1 from jsonb_array_elements(ledger) p where p->>'objectId'=c->>'id'))) then
    decision:=jsonb_build_object('kind','TRANSITION','fromStageId','movies','stageId','books');
  elsif books_acknowledged and book_count>=10 and presented_count>=12 and known_count>=8 then
    decision:=jsonb_build_object('kind','STOP','reason','SUFFICIENT_RESPONSES','failOpen',false);
  else
    with candidates as materialized (
      select c from jsonb_array_elements(catalog) c
      where c->>'itemType'=case when books_acknowledged then 'BOOK' else 'MOVIE' end
        and not exists(select 1 from jsonb_array_elements(ledger) p where p->>'objectId'=c->>'id')
    ), support as (
      select tag,count(*)::double precision n from jsonb_array_elements(ledger) p
      join lateral (select c from jsonb_array_elements(catalog) c where c->>'id'=p->>'objectId') item on true,
      lateral jsonb_array_elements_text(item.c->'tags') tag
      where p#>>'{responses,-1,answer,kind}' in('RATING','NOT_INTERESTED') group by tag
    ), components as (
      select cand.c,coalesce((cand.c->>'recognitionPrior')::double precision,0) r,
        case when jsonb_array_length(cand.c->'tags')=0 then 0::double precision else 1-coalesce((
          select max((select count(*)::double precision from jsonb_array_elements_text(cand.c->'tags') a
            where previous.c->'tags' ? a) / nullif((select count(*)::double precision from (
              select value from jsonb_array_elements_text(cand.c->'tags') union select value from jsonb_array_elements_text(previous.c->'tags')
            ) union_tags),0))
          from jsonb_array_elements(ledger) p
          join lateral (select old_c c from jsonb_array_elements(catalog) old_c where old_c->>'id'=p->>'objectId') previous on true
        ),0) end d,
        coalesce((select sum(1.0::double precision/jsonb_array_length(cand.c->'tags')/(1+coalesce(s.n,0)))
          from jsonb_array_elements_text(cand.c->'tags') tag left join support s on s.tag=tag.value),0) i
      from candidates cand
    ) select c,r,d,i into candidate,recognition,diversity,information from components
      order by case when policy='PRIOR_ONLY' then r else 0.65*r+0.20*d+0.15*i end desc,c->>'id' collate "C" limit 1;
    if candidate is null then
      decision:=jsonb_build_object('kind','STOP','reason','CATALOG_EXHAUSTED','failOpen',presented_count<12 or known_count<8);
    else
      decision:=jsonb_build_object('kind','QUESTION','stageId',stage,'itemId',candidate->>'id','replay',false,
        'components',jsonb_build_object('recognitionPrior',recognition,'diversity',diversity,'informationProxy',information,
          'score',case when policy='PRIOR_ONLY' then recognition else 0.65*recognition+0.20*diversity+0.15*information end));
    end if;
  end if;
  return jsonb_build_object('version','taste-selection-v1','policy',policy,'decision',decision,'counts',counts,
    'config',jsonb_build_object('minimumOpportunities',12,'maximumOpportunities',24,'minimumKnownRatings',8),
    'informationBasis','UNCALIBRATED_FEATURE_COVERAGE_PROXY','uncertainty','unavailable','qualityAdmitted',false);
end;$$;
revoke all on function private.select_taste_opportunity_v1(jsonb,jsonb,boolean,boolean,text) from public,anon,authenticated,service_role;

-- No raw provider records, descriptions, account data or client-supplied candidates.
-- Freeze at most 128 real Items per domain and one explicit 64-tag dictionary.
create function private.taste_catalog_snapshot_v1(target_profile_id uuid, cutoff timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
  with reacted as materialized (select distinct item_id from private.personal_source_evidence_v1(target_profile_id,cutoff)),
  eligible as materialized (
    select i.id,i.item_type,i.title,i.tags,i.created_at,private.catalog_cold_start_prior_v1(i.id,cutoff) prior,
      (coalesce(i.metadata->>'coldStartRecognition','') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$'
        or coalesce(i.metadata->>'voteCount','') ~ '^[0-9]+$') has_recognition,
      array(select distinct s.provider_key from private.item_sources s where s.item_id=i.id and s.provider_key<>'kajo_mock'
        and isfinite(s.created_at) and s.created_at<=cutoff order by s.provider_key limit 16) providers
    from public.items i where i.discoverable and isfinite(i.created_at) and i.created_at<=cutoff
      and not exists(select 1 from reacted r where r.item_id=i.id)
      and exists(select 1 from private.item_sources s where s.item_id=i.id and s.provider_key<>'kajo_mock'
        and isfinite(s.created_at) and s.created_at<=cutoff)
  ), bounded as materialized (
    select * from (select e.*,row_number() over(partition by item_type order by (prior->>'recognition')::double precision desc,id) n
      from eligible e) ordered where n<=128
  ), dimensions as (
    select tag from (select distinct id,tag from bounded b,lateral unnest(b.tags) tag
      where length(tag) between 1 and 256 and tag !~ '[[:cntrl:]]') distinct_tags
    group by tag order by count(*) desc,tag collate "C" limit 64
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'itemType',item_type,'title',left(title,512),'providerKeys',providers,
    'availableAt',floor(extract(epoch from cutoff)*1000)::bigint,
    'tags',array(select distinct tag from unnest(b.tags) tag where tag in(select tag from dimensions) order by tag),
    'recognitionPrior',case when has_recognition then (prior->>'recognition')::double precision else null end,
    'priorBasis',case when not has_recognition then 'UNAVAILABLE'
      when prior->>'source'='KAJO_CURATED_RECOGNITION' then 'CURATED_RECOGNITION' else 'PROVIDER_CATALOG' end
  ) order by id),'[]') from bounded b;
$$;
revoke all on function private.taste_catalog_snapshot_v1(uuid,timestamptz) from public,anon,authenticated,service_role;

-- Project only the explicitly changed Item. A different answer cannot resurrect
-- another Item withdrawn through history/import removal. Native authority still wins.
create function private.project_taste_rating_v1(target_session_id uuid, presentation jsonb, response jsonb)
returns void language plpgsql volatile security definer set search_path='' as $$
declare s private.taste_sessions; job_id uuid; item jsonb; answer jsonb:=response->'answer'; accepted_at timestamptz;
begin
  select * into strict s from private.taste_sessions where id=target_session_id;
  accepted_at:=to_timestamp((response->>'availableAt')::double precision/1000);
  select c into strict item from jsonb_array_elements(s.catalog) c where c->>'id'=presentation->>'objectId';
  job_id:=s.source_job_id;
  if job_id is null and answer->>'kind'='RATING' then
    insert into private.profile_import_jobs(actor_user_id,profile_id,source_provider,dataset_kind,file_fingerprint,status,committed_at)
      values(s.actor_user_id,s.profile_id,'KAJO_CALIBRATION','TASTE_SESSION_V1','taste:v1:'||s.id::text,'COMMITTED',accepted_at)
      returning id into job_id;
    update private.taste_sessions set source_job_id=job_id where id=s.id;
  end if;
  if job_id is null then return; end if;
  if answer->>'kind'='RATING' then
    insert into private.profile_bootstrap_evidence(actor_user_id,profile_id,item_id,item_type,source_provider,dataset_kind,
      source_job_id,source_row_key,evidence_kind,rating,source_occurred_at,imported_at,source_metadata)
    values(s.actor_user_id,s.profile_id,(item->>'id')::uuid,item->>'itemType','KAJO_CALIBRATION','TASTE_SESSION_V1',job_id,
      item->>'id','RATED',(answer->>'value')::integer,accepted_at,accepted_at,
      jsonb_build_object('source','TASTE_TEST','tasteSessionId',s.id,'questionIndex',presentation->'index',
        'questionPolicyVersion',s.policy_version,'responseRevision',response->'revision','version',s.version))
    on conflict(profile_id,source_provider,dataset_kind,item_id) do update set rating=excluded.rating,
      source_occurred_at=excluded.source_occurred_at,imported_at=excluded.imported_at,active=true,source_metadata=excluded.source_metadata;
  else
    update private.profile_bootstrap_evidence set active=false,imported_at=accepted_at
      where source_job_id=job_id and item_id=(item->>'id')::uuid and active;
  end if;
  update private.profile_import_jobs set total_rows=jsonb_array_length(s.presentations),
    matched_rows=(select count(*) from private.profile_bootstrap_evidence where source_job_id=job_id and active),updated_at=accepted_at
    where id=job_id;
end;$$;
revoke all on function private.project_taste_rating_v1(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

create function private.taste_session_v1(request jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  actor uuid; profile uuid; command_id uuid; operation text; s private.taste_sessions; saved private.taste_session_commands;
  at_time timestamptz; at_ms bigint; selected jsonb; result jsonb; p jsonb; response jsonb; answer jsonb;
  question_index integer; answer_revision integer; keys text[]; expected integer;
begin
  if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>4096 then
    raise exception 'Invalid Taste request' using errcode='22023'; end if;
  operation:=request->>'operation';
  if operation is null or operation not in('START','RESUME','ANSWER','ACK_TRANSITION','REMOVE') then
    raise exception 'Invalid Taste operation' using errcode='22023'; end if;
  keys:=case operation when 'START' then array['operation','profileId','requestId'] when 'RESUME' then array['operation','profileId','sessionId']
    when 'ANSWER' then array['operation','profileId','sessionId','requestId','expectedRevision','questionIndex','answer']
    when 'ACK_TRANSITION' then array['operation','profileId','sessionId','requestId','expectedRevision']
    else array['operation','profileId','sessionId','requestId','expectedRevision'] end;
  if (select array_agg(k order by k) from jsonb_object_keys(request) k) is distinct from (select array_agg(k order by k) from unnest(keys) k)
    or jsonb_typeof(request->'profileId')<>'string' then raise exception 'Invalid Taste request fields' using errcode='22023'; end if;
  profile:=(request->>'profileId')::uuid;
  actor:=private.assert_personal_profile_owner_v1(profile);
  if exists(select 1 from auth.users a where a.id=actor and to_jsonb(a)->>'is_anonymous'='true') then
    raise exception 'Anonymous Taste entry is not available' using errcode='42501';end if;
  -- Lock order is Profile then session; no network work occurs while locked.
  perform 1 from public.profiles where id=profile for update;
  -- Reauthorize after waiting for the Profile lock, including ownership changes.
  actor:=private.assert_personal_profile_owner_v1(profile);
  select * into s from private.taste_sessions where profile_id=profile for update;
  if s.id is not null and s.actor_user_id<>actor then raise exception 'Taste owner access required' using errcode='42501'; end if;
  if operation<>'RESUME' then
    if jsonb_typeof(request->'requestId')<>'string' then raise exception 'Invalid Taste request identity' using errcode='22023';end if;
    command_id:=(request->>'requestId')::uuid;
    if command_id is null then raise exception 'Missing Taste request identity' using errcode='22023';end if;
  end if;
  if operation<>'START' then
    if s.id is null or jsonb_typeof(request->'sessionId')<>'string' or (request->>'sessionId')::uuid is distinct from s.id then
      raise exception 'Taste session unavailable' using errcode='42501';end if;
  end if;
  at_time:=date_trunc('milliseconds',clock_timestamp());
  if s.id is null then
    insert into private.taste_sessions(profile_id,actor_user_id,catalog_as_of,catalog,existing_completed,created_at,updated_at)
    values(profile,actor,at_time,private.taste_catalog_snapshot_v1(profile,at_time),
      not (private.get_profile_bootstrap_status_v1(profile)->>'needsCalibration')::boolean,at_time,at_time) returning * into s;
  end if;
  at_time:=greatest(at_time,s.updated_at+interval '1 millisecond');
  at_ms:=floor(extract(epoch from at_time)*1000)::bigint;
  if s.source_job_id is not null then
    perform 1 from private.profile_import_jobs where id=s.source_job_id for update;
  end if;
  -- The existing source-removal endpoint is authoritative too. Past command
  -- results are never replayed after the source/session has been removed.
  if s.status='REMOVED' or (s.source_job_id is not null and exists(
    select 1 from private.profile_import_jobs j where j.id=s.source_job_id and j.status='REMOVED')) or operation='REMOVE' then
    if operation='REMOVE' and s.status<>'REMOVED' then
      if jsonb_typeof(request->'expectedRevision')<>'number' or request->>'expectedRevision' !~ '^(0|[1-9][0-9]{0,2})$'
        or (request->>'expectedRevision')::integer<>s.revision then raise exception 'Taste revision conflict' using errcode='40001';end if;
      if s.source_job_id is not null then perform private.remove_profile_import_job_v1(s.source_job_id);end if;
    end if;
    update private.taste_sessions set status='REMOVED',catalog='[]',presentations='[]',updated_at=at_time where id=s.id;
    delete from private.taste_session_commands where session_id=s.id;
    return jsonb_build_object('version',s.version,'sessionId',s.id,'profileId',profile,'status','REMOVED');
  end if;
  -- A frozen feature dictionary never overrides a live catalog withdrawal.
  -- Preserve the exact session for operator recovery; only REMOVE remains writable.
  if exists(select 1 from jsonb_array_elements(s.catalog) c where not exists(
    select 1 from public.items i where i.id=(c->>'id')::uuid and i.discoverable
      and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then
    return jsonb_build_object('version',s.version,'sessionId',s.id,'profileId',profile,'revision',s.revision,
      'status','CATALOG_UNAVAILABLE','reason','CATALOG_WITHDRAWN');
  end if;
  if operation='RESUME' then
    -- Read current authorized state without advancing or appending receipts.
    null;
  else
    select * into saved from private.taste_session_commands where session_id=s.id and taste_session_commands.request_id=command_id;
    if saved.request_id is not null then
      if saved.command<>request then raise exception 'Taste request identity conflict' using errcode='22023';end if;
      return saved.result;
    end if;
    -- START resumes one logical session even with a new request ID. Do not
    -- allocate unbounded duplicate START receipts or reset completed state.
    if operation<>'START' then
      if jsonb_typeof(request->'expectedRevision')<>'number' or request->>'expectedRevision' !~ '^(0|[1-9][0-9]{0,2})$' then
        raise exception 'Invalid Taste revision' using errcode='22023';end if;
      expected:=(request->>'expectedRevision')::integer;
      if expected<>s.revision then raise exception 'Taste revision conflict' using errcode='40001';end if;
      if s.revision>=199 or s.existing_completed then raise exception 'Taste session is closed' using errcode='22023';end if;
    end if;
    selected:=private.select_taste_opportunity_v1(s.catalog,s.presentations,s.books_acknowledged,s.existing_completed,s.policy);
    if operation='ANSWER' then
      if jsonb_typeof(request->'questionIndex')<>'number' or request->>'questionIndex' !~ '^(0|[1-9][0-9]?)$' then
        raise exception 'Invalid Taste question index' using errcode='22023';end if;
      question_index:=(request->>'questionIndex')::integer;
      p:=s.presentations->question_index; answer:=request->'answer';
      if p is null or jsonb_typeof(answer)<>'object' or answer->>'kind' is null
        or answer->>'kind' not in('RATING','UNKNOWN','NOT_INTERESTED','WITHDRAWN')
        or (select count(*) from jsonb_object_keys(answer))<>(case when answer->>'kind'='RATING' then 2 else 1 end)
        or not (answer ? 'kind') then raise exception 'Invalid Taste answer' using errcode='22023';end if;
      if answer->>'kind'='RATING' and (jsonb_typeof(answer->'value') is distinct from 'number'
        or coalesce(answer->>'value','') !~ '^([0-9]|10)$') then raise exception 'Invalid Taste rating' using errcode='22023';end if;
      answer_revision:=jsonb_array_length(p->'responses')+1;
      if answer_revision>8 then raise exception 'Taste response revision limit' using errcode='22023';end if;
      response:=jsonb_build_object('revision',answer_revision,'occurredAt',at_ms,'availableAt',at_ms,'answer',answer);
      p:=jsonb_set(p,'{responses}',p->'responses'||jsonb_build_array(response));
      s.presentations:=jsonb_set(s.presentations,array[question_index::text],p);
      update private.taste_sessions set presentations=s.presentations where id=s.id;
      perform private.project_taste_rating_v1(s.id,p,response);
    elsif operation='ACK_TRANSITION' then
      if selected#>>'{decision,kind}'<>'TRANSITION' then raise exception 'Taste transition unavailable' using errcode='22023';end if;
      s.books_acknowledged:=true;
    end if;
    if operation<>'START' or not exists(select 1 from private.taste_session_commands where session_id=s.id) then
      selected:=private.select_taste_opportunity_v1(s.catalog,s.presentations,s.books_acknowledged,s.existing_completed,s.policy);
      if selected#>>'{decision,kind}'='QUESTION' and selected#>>'{decision,replay}'='false' then
        s.presentations:=s.presentations||jsonb_build_array(jsonb_build_object('index',jsonb_array_length(s.presentations),
          'objectId',selected#>>'{decision,itemId}','stageId',selected#>>'{decision,stageId}','presentedAt',at_ms,
          'selectionComponents',selected#>'{decision,components}','responses','[]'::jsonb));
      end if;
      s.status:=case when selected#>>'{decision,kind}'='STOP' then 'STOPPED' else 'ACTIVE' end;
      s.revision:=s.revision+1;
      update private.taste_sessions set presentations=s.presentations,books_acknowledged=s.books_acknowledged,
        status=s.status,revision=s.revision,updated_at=at_time where id=s.id;
    end if;
  end if;
  selected:=private.select_taste_opportunity_v1(s.catalog,s.presentations,s.books_acknowledged,s.existing_completed,s.policy);
  result:=jsonb_build_object('version',s.version,'sessionId',s.id,'profileId',s.profile_id,'revision',s.revision,'status',s.status,
    'catalogAsOf',floor(extract(epoch from s.catalog_as_of)*1000)::bigint,'featurePolicyVersion',s.feature_policy_version,
    'selection',selected,'presentations',s.presentations,'acknowledgedTransitions',
      case when s.books_acknowledged then '["books"]'::jsonb else '[]'::jsonb end,
    'currentItem',(select c from jsonb_array_elements(s.catalog) c where c->>'id'=selected#>>'{decision,itemId}'),
    'ratingProjection','TASTE_TEST_BOOTSTRAP_ONLY','challenge','NOT_IMPLEMENTED','anonymousEntry',false);
  if operation not in('RESUME','START') or (operation='START' and not exists(select 1 from private.taste_session_commands where session_id=s.id)) then
    insert into private.taste_session_commands(session_id,request_id,command,result) values(s.id,command_id,request,result);
  end if;
  return result;
end;$$;
revoke all on function private.taste_session_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.taste_session_v1(jsonb) to authenticated;
create function public.taste_session_v1(request jsonb)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.taste_session_v1(request);$$;
revoke all on function public.taste_session_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.taste_session_v1(jsonb) to authenticated;
