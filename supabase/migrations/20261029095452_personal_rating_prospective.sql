-- Closed native evaluation only. A trusted worker holds one dedicated transaction
-- across input preparation, the portable TypeScript calculation and finalization.
-- No public RPC, serving policy, admitted prior or mobile routing is introduced.
create table private.personal_rating_allocations (
  id uuid primary key,
  source_prediction_id uuid not null unique references private.prediction_runs(id) on delete cascade,
  actor_user_id uuid not null,
  profile_id uuid not null,
  request_hash text not null check(request_hash ~ '^[0-9a-f]{32}$')
);
create index personal_rating_allocation_owner_idx on private.personal_rating_allocations(actor_user_id,profile_id);
create table private.personal_rating_inputs (
  id uuid primary key references private.personal_rating_allocations(id) on delete cascade,
  target_item_id uuid not null references public.items(id) on delete cascade,
  prepared_transaction xid8 not null,
  prepared_at timestamptz not null check(isfinite(prepared_at)),
  horizon_end timestamptz not null check(isfinite(horizon_end) and horizon_end>prepared_at),
  preparation jsonb not null check(octet_length(preparation::text)<=4194304)
);
create table private.personal_rating_forecasts (
  id uuid primary key references private.personal_rating_inputs(id) on delete cascade,
  forecast jsonb not null check(octet_length(forecast::text)<=4194304)
);
create index personal_rating_input_target_idx on private.personal_rating_inputs(target_item_id);
create table private.personal_rating_event_refs (
  forecast_id uuid not null references private.personal_rating_inputs(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key(forecast_id,event_id)
);
create index personal_rating_event_ref_source_idx on private.personal_rating_event_refs(event_id);
create table private.personal_rating_answers (
  forecast_id uuid primary key references private.personal_rating_forecasts(id) on delete cascade,
  action_id uuid not null unique,
  request jsonb not null check(octet_length(request::text)<=16384),
  result jsonb not null check(octet_length(result::text)<=32768)
);
alter table private.personal_rating_allocations enable row level security;
alter table private.personal_rating_inputs enable row level security;
alter table private.personal_rating_forecasts enable row level security;
alter table private.personal_rating_event_refs enable row level security;
alter table private.personal_rating_answers enable row level security;
revoke all on private.personal_rating_allocations,private.personal_rating_inputs,private.personal_rating_forecasts,
  private.personal_rating_event_refs,private.personal_rating_answers from public,anon,authenticated,service_role;

create function private.guard_personal_rating_artifact_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if tg_table_name='personal_rating_allocations' then
      if not exists(select 1 from private.prediction_runs r where r.id=old.source_prediction_id) then return old;end if;
    elsif tg_table_name='personal_rating_inputs' then
      if pg_trigger_depth()>1 or not exists(select 1 from private.personal_rating_allocations a where a.id=old.id) then return old;end if;
    elsif tg_table_name='personal_rating_forecasts' then
      if not exists(select 1 from private.personal_rating_inputs i where i.id=old.id) then return old;end if;
    elsif tg_table_name='personal_rating_answers' then
      if not exists(select 1 from private.personal_rating_forecasts f where f.id=old.forecast_id) then return old;end if;
    elsif tg_table_name='personal_rating_event_refs' then
      if not exists(select 1 from private.personal_rating_inputs i where i.id=old.forecast_id) then return old;end if;
    end if;
  end if;
  raise exception 'Numeric evaluation evidence is immutable; withdraw its source' using errcode='55000';
end;$$;

-- SQL verifies native binding and the closed output contract, not a second
-- implementation of numeric prediction. The trusted worker executes the shared
-- compiled TypeScript calculation; its source manifest is retained by the runner.
create function private.finalize_personal_rating_forecast_v1(forecast_id uuid,forecast jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare actor uuid:=private.lock_personal_rating_transaction_v1();a private.personal_rating_allocations%rowtype;
  i private.personal_rating_inputs%rowtype;prior jsonb;input jsonb;ratings jsonb;pool jsonb;expected jsonb;
  support integer;point jsonb;control jsonb;candidate jsonb;
begin
  select * into a from private.personal_rating_allocations where id=forecast_id;
  if a.id is null or a.actor_user_id<>actor then raise exception 'Numeric forecast access denied' using errcode='42501';end if;
  perform p.id from public.profiles p where p.id=a.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor for update;
  if not found then raise exception 'Numeric owner changed' using errcode='42501';end if;
  select * into i from private.personal_rating_inputs where id=forecast_id;
  if i.id is null then raise exception 'Numeric source was withdrawn' using errcode='55000';end if;
  select f.forecast into prior from private.personal_rating_forecasts f where f.id=forecast_id;
  if found then
    if prior is distinct from forecast then raise exception 'Finalized numeric forecast differs' using errcode='22023';end if;
    return i.preparation||jsonb_build_object('forecast',prior);
  end if;
  if i.prepared_transaction<>pg_current_xact_id() then
    raise exception 'Finalize in the same dedicated input transaction' using errcode='25001';end if;
  input:=i.preparation->'input';support:=jsonb_array_length(input->'labels');point:=forecast#>'{location,personalMean}';
  if forecast is null or jsonb_typeof(forecast)<>'object' or point is null
    or (support=0 and point<>'null'::jsonb)
    or (support>0 and (jsonb_typeof(point)<>'number' or (point::text)::numeric not between 0 and 10)) then
    raise exception 'Invalid numeric forecast point' using errcode='22023';end if;
  select coalesce(jsonb_agg(jsonb_build_object('sourceEventId',l->'sourceEventId','subjectId',l#>'{event,profileId}',
      'domainId',l#>'{event,itemType}','objectId',l->'itemId','value',l#>'{event,rating}',
      'occurredAtMicros',l#>'{event,occurredAtMicros}','availableAtMicros',l#>'{event,availableAtMicros}') order by l->>'itemId'),'[]')
    into ratings from jsonb_array_elements(input->'labels') l;
  select jsonb_agg(p->'id' order by n) into pool from jsonb_array_elements(input#>'{candidatePool,items}') with ordinality x(p,n);
  control:=jsonb_build_object('value',point,'status',case when support>0 then 'AVAILABLE' else 'UNAVAILABLE' end,
    'mode',case when support>0 then 'PERSONAL_MEAN' else 'NO_NUMERIC_SUPPORT' end,'prefixSupport',support);
  candidate:=control||jsonb_build_object('mode',case when support>0 then 'PERSONAL_MEAN_FALLBACK' else 'NO_NUMERIC_SUPPORT' end);
  expected:=jsonb_build_object('version','personal-domain-mean-v1','targetVersion','personal-own-scale-post-experience-rating-v1',
    'capability',case when support>0 then 'NUMERIC_POINT_BASELINE_V1' else 'NUMERIC_POINT_UNAVAILABLE_V1' end,
    'calibration','UNCALIBRATED','qualityAdmission','NONE','servingActivation','NONE',
    'subjectId',input#>'{profile,id}','domainId',input->'itemType','cutoffMicros',input->'cutoffMicros',
    'prefix',jsonb_build_object('version','canonical-resolved-rating-prefix-v1','sourceId','kajo-canonical-native-rating-events',
      'sourceVersion','personal-source-evidence-v1:'||(input#>>'{source,bodyMd5}'),'snapshotId',input->'snapshotId','support',support,
      'provenance',jsonb_build_object('origin',input->'evidenceOrigin','captureScope',input->'captureScope'),'ratings',ratings,
      'excluded',jsonb_build_object('foreignSubject',0,'foreignDomain',0,'future',0,'duplicate',0)),
    'candidatePool',jsonb_build_object('snapshotId',input->'snapshotId','cutoffMicros',input->'cutoffMicros','candidateIds',pool),
    'config',i.preparation->'config','prior',null,'priorDisposition','ABSENT','location',jsonb_build_object('personalMean',point,'residual',null),
    'identified',jsonb_build_object('personalLocation',support>0,'responseSpread',false,'contentDifferentiation',false),
    'forecasts',(select jsonb_agg(jsonb_build_object('objectId',p,'control',control,'candidate',candidate) order by n)
      from jsonb_array_elements(pool) with ordinality x(p,n)));
  if forecast is distinct from expected then raise exception 'Numeric forecast differs from native input binding' using errcode='22023';end if;
  insert into private.personal_rating_forecasts(id,forecast) values(forecast_id,forecast);
  return i.preparation||jsonb_build_object('forecast',forecast);
end;$$;

create function private.commit_personal_rating_answer_v1(forecast_id uuid,request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare actor uuid:=private.lock_personal_rating_transaction_v1();a private.personal_rating_allocations%rowtype;
  i private.personal_rating_inputs%rowtype;prior private.personal_rating_answers%rowtype;forecast jsonb;
  action uuid;rating integer;point jsonb;accepted timestamptz;result jsonb;action_result jsonb;
  control numeric;candidate numeric;
begin
  select * into a from private.personal_rating_allocations where id=forecast_id;
  if a.id is null or a.actor_user_id<>actor then raise exception 'Numeric answer access denied' using errcode='42501';end if;
  perform p.id from public.profiles p where p.id=a.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor for update;
  if not found then raise exception 'Numeric owner changed' using errcode='42501';end if;
  select * into i from private.personal_rating_inputs where id=forecast_id;
  select f.forecast into forecast from private.personal_rating_forecasts f where f.id=forecast_id;
  if i.id is null or forecast is null then raise exception 'Numeric forecast unavailable or withdrawn' using errcode='55000';end if;
  if jsonb_typeof(request) is distinct from 'object' or octet_length(request::text)>16384
    or request->'version' is distinct from '1'::jsonb or request->>'kind' is distinct from 'SET_RATING'
    or request->>'actorUserId' is distinct from actor::text or request->>'profileId' is distinct from a.profile_id::text
    or request->>'itemId' is distinct from i.target_item_id::text
    or jsonb_typeof(request->'rating') is distinct from 'number' or coalesce(request->>'rating','')!~'^(10|[0-9])$' then
    raise exception 'Numeric answer requires the bound own SET_RATING command' using errcode='22023';end if;
  action:=(request->>'actionId')::uuid;rating:=(request->>'rating')::integer;
  if action is null then raise exception 'Numeric answer action identity required' using errcode='22023';end if;
  select * into prior from private.personal_rating_answers where personal_rating_answers.forecast_id=commit_personal_rating_answer_v1.forecast_id;
  if found then
    if prior.action_id<>action or prior.request is distinct from request then
      raise exception 'Numeric first answer is already frozen with different intent' using errcode='22023';end if;
    return prior.result;
  end if;
  if i.prepared_transaction=pg_current_xact_id() or i.prepared_at>=now() then
    raise exception 'Commit numeric forecast before its first answer transaction' using errcode='25001';end if;
  accepted:=clock_timestamp();
  if accepted>i.horizon_end then raise exception 'Numeric first-answer horizon expired' using errcode='55000';end if;
  if private.personal_rating_target_has_report_v1(a.profile_id,i.target_item_id)
    or exists(select 1 from public.events where id=action)
    or exists(select 1 from private.item_action_receipts where id=action) then
    raise exception 'Numeric target acquired outside-path evidence; no substitute first answer' using errcode='55000';end if;
  select x into strict point from jsonb_array_elements(forecast->'forecasts') x where x->>'objectId'=i.target_item_id::text;
  control:=(point#>>'{control,value}')::numeric;candidate:=(point#>>'{candidate,value}')::numeric;
  result:=jsonb_build_object('version','personal-rating-first-answer-v1','forecastId',forecast_id,'targetItemId',i.target_item_id,
    'actionId',action,'rating',rating,'acceptedAtMicros',(extract(epoch from accepted)*1000000)::bigint::text,
    'measurement',jsonb_build_object('controlSquaredError',power(control-rating,2),'candidateSquaredError',power(candidate-rating,2),
      'controlAbsoluteError',abs(control-rating),'candidateAbsoluteError',abs(candidate-rating)),
    'coverage',case when control is null then 'NO_NUMERIC_FORECAST' else 'MEASURED_FIRST_RATING' end);
  -- Freeze the original first-answer measurement BEFORE projecting the command.
  -- The transaction rolls back both artifacts if the canonical command fails.
  insert into private.personal_rating_answers(forecast_id,action_id,request,result) values(forecast_id,action,request,result);
  action_result:=private.commit_item_action_v1(request);
  if action_result->>'actionId' is distinct from action::text
    or action_result#>'{interaction,rating}' is distinct from to_jsonb(rating)
    or not exists(select 1 from public.events e where e.id=action and e.actor_user_id=actor and e.profile_id=a.profile_id
      and e.item_id=i.target_item_id and e.event_type='ITEM_RATED' and e.properties->'rating'=to_jsonb(rating)) then
    raise exception 'Canonical numeric answer receipt mismatch' using errcode='55000';end if;
  insert into private.personal_rating_event_refs(forecast_id,event_id) values(forecast_id,action);
  return result;
end;$$;

create function private.inspect_personal_rating_forecast_v1(forecast_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare actor uuid:=private.lock_personal_rating_transaction_v1();a private.personal_rating_allocations%rowtype;
  prepared jsonb;forecast jsonb;first_answer jsonb;current_state jsonb;target uuid;
begin
  select * into a from private.personal_rating_allocations where id=forecast_id;
  if a.id is null or a.actor_user_id<>actor or not exists(select 1 from public.profiles p
    where p.id=a.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor) then
    raise exception 'Numeric inspection access denied' using errcode='42501';end if;
  select i.preparation,i.target_item_id,f.forecast into prepared,target,forecast from private.personal_rating_inputs i
    left join private.personal_rating_forecasts f on f.id=i.id where i.id=forecast_id;
  select r.result into first_answer from private.personal_rating_answers r where r.forecast_id=inspect_personal_rating_forecast_v1.forecast_id;
  if prepared is not null then
    select jsonb_build_object('sourceStatus',s.source_status,'sourceEventId',s.source_event_id,
      'rating',case when s.source_status='NATIVE_RATING' then e.properties->'rating' else null end) into current_state
      from private.personal_source_evidence_v1(a.profile_id,clock_timestamp()) s left join public.events e on e.id=s.source_event_id
      where s.item_id=target and s.source_status<>'NATIVE_OTHER' and not s.is_bootstrap;
  end if;
  return jsonb_build_object('version','personal-rating-inspection-v1','forecastId',forecast_id,
    'status',case when prepared is null then 'WITHDRAWN' else 'AVAILABLE' end,
    'coverage',case when prepared is null then 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT'
      when first_answer is not null then first_answer->>'coverage'
      when (prepared->>'horizonEndMicros')::numeric<(extract(epoch from clock_timestamp())*1000000) then 'UNANSWERED_EXPIRED'
      else 'PENDING_FIRST_REPORT' end,
    'preparation',case when prepared is not null then prepared||jsonb_build_object('forecast',forecast) else null end,
    'firstAnswer',first_answer,'currentCanonicalState',current_state);
end;$$;
create trigger personal_rating_allocation_immutable before update or delete on private.personal_rating_allocations
  for each row execute function private.guard_personal_rating_artifact_v1();
create trigger personal_rating_input_immutable before update or delete on private.personal_rating_inputs
  for each row execute function private.guard_personal_rating_artifact_v1();
create trigger personal_rating_forecast_immutable before update or delete on private.personal_rating_forecasts
  for each row execute function private.guard_personal_rating_artifact_v1();
create trigger personal_rating_answer_immutable before update or delete on private.personal_rating_answers
  for each row execute function private.guard_personal_rating_artifact_v1();
create trigger personal_rating_event_ref_immutable before update or delete on private.personal_rating_event_refs
  for each row execute function private.guard_personal_rating_artifact_v1();

create function private.withdraw_personal_rating_event_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Numeric source withdrawal requires READ COMMITTED' using errcode='25001';end if;
  -- Include the complete resolver dependency closure, not only winning labels.
  -- A withdrawn first answer also retires the whole copy; no replacement answer.
  delete from private.personal_rating_inputs i where exists(select 1 from private.personal_rating_event_refs r
    where r.forecast_id=i.id and r.event_id=old.id);
  return old;
end;$$;

create function private.personal_rating_target_has_report_v1(target_profile uuid,target_item uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.events e join public.profiles p on p.id=e.profile_id
      where p.id=target_profile and e.actor_user_id=p.owner_user_id and e.item_id=target_item
        and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_HISTORY_CLEARED','ITEM_INTEREST_CLEARED','ITEM_INTERACTION_UNDONE'))
    or exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=target_profile and b.item_id=target_item)
    or exists(select 1 from private.taste_challenges c cross join lateral jsonb_array_elements(c.answers) x
      where c.profile_id=target_profile and x->>'itemId'=target_item::text)
    or exists(select 1 from private.taste_sessions s cross join lateral jsonb_array_elements(s.presentations) x
      where s.profile_id=target_profile and x->>'objectId'=target_item::text and jsonb_array_length(x->'responses')>0)
    or exists(select 1 from private.sequential_taste_sessions s cross join lateral jsonb_array_elements(s.presentations) x
      where s.profile_id=target_profile and x->>'objectId'=target_item::text and jsonb_array_length(x->'responses')>0);
$$;

-- Observe outside-path reports as they occur. Never poll mutable timestamp order
-- later and relabel a correction as the first answer. No lifecycle lock is taken
-- in a row trigger: Event INSERT already owns its table lock.
create function private.invalidate_pending_personal_rating_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid;profile uuid;targets text[];
begin
  if tg_table_name='events' then
    if new.event_type not in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_HISTORY_CLEARED','ITEM_INTEREST_CLEARED','ITEM_INTERACTION_UNDONE') then return new;end if;
    owner_id:=new.actor_user_id;profile:=new.profile_id;targets:=array[new.item_id::text];
  elsif tg_table_name='profile_bootstrap_evidence' then
    owner_id:=new.actor_user_id;profile:=new.profile_id;targets:=array[new.item_id::text];
  elsif tg_table_name='taste_challenges' then
    owner_id:=new.actor_user_id;profile:=new.profile_id;
    select array_agg(x->>'itemId') into targets from jsonb_array_elements(new.answers) x;
  else
    owner_id:=new.actor_user_id;profile:=new.profile_id;
    select array_agg(x->>'objectId') into targets from jsonb_array_elements(new.presentations) x where jsonb_array_length(x->'responses')>0;
  end if;
  if targets is null then return new;end if;
  if not exists(select 1 from private.personal_rating_inputs i join private.personal_rating_allocations a on a.id=i.id
      where a.actor_user_id=owner_id and a.profile_id=profile and i.target_item_id::text=any(targets)
        and not exists(select 1 from private.personal_rating_answers r where r.forecast_id=i.id)) then return new;end if;
  -- Only an owned Personal report can retire this owner's private opportunity.
  -- The definer privilege is needed by the authenticated Event INSERT trigger;
  -- this function is not directly executable and exposes no private payload.
  if not exists(select 1 from public.profiles p where p.id=profile and p.profile_type='PERSONAL' and p.owner_user_id=owner_id) then return new;end if;
  if auth.uid() is distinct from owner_id and current_setting('role') not in('none','postgres','service_role') then
    raise exception 'Numeric report observer actor mismatch' using errcode='42501';end if;
  if exists(select 1 from private.personal_rating_inputs i join private.personal_rating_allocations a on a.id=i.id
      where a.actor_user_id=owner_id and a.profile_id=profile and i.target_item_id::text=any(targets)
        and not exists(select 1 from private.personal_rating_answers r where r.forecast_id=i.id)
        and (i.prepared_transaction=pg_current_xact_id() or i.prepared_at>=now())) then
    raise exception 'Commit numeric forecast before a target report' using errcode='55000';end if;
  delete from private.personal_rating_inputs i using private.personal_rating_allocations a
    where a.id=i.id and a.actor_user_id=owner_id and a.profile_id=profile and i.target_item_id::text=any(targets)
      and not exists(select 1 from private.personal_rating_answers r where r.forecast_id=i.id);
  return new;
end;$$;
create trigger invalidate_pending_personal_rating_for_event after insert on public.events
  for each row execute function private.invalidate_pending_personal_rating_v1();
create trigger invalidate_pending_personal_rating_for_challenge after insert or update on private.taste_challenges
  for each row execute function private.invalidate_pending_personal_rating_v1();
create trigger invalidate_pending_personal_rating_for_taste after insert or update on private.taste_sessions
  for each row execute function private.invalidate_pending_personal_rating_v1();
create trigger invalidate_pending_personal_rating_for_sequential after insert or update on private.sequential_taste_sessions
  for each row execute function private.invalidate_pending_personal_rating_v1();
create trigger invalidate_pending_personal_rating_for_bootstrap after insert or update on private.profile_bootstrap_evidence
  for each row execute function private.invalidate_pending_personal_rating_v1();
create trigger withdraw_personal_rating_event before delete on public.events
  for each row execute function private.withdraw_personal_rating_event_v1();

create function private.lock_personal_rating_transaction_v1()
returns uuid language plpgsql volatile security invoker set search_path='' as $$
declare actor uuid:=(select auth.uid());
begin
  if actor is null then raise exception 'Numeric evaluation owner required' using errcode='42501';end if;
  if exists(select 1 from pg_locks where locktype='advisory' and pid=pg_backend_pid()
      and classid=1946841873 and objid=232004 and objsubid=2 and granted and mode='ShareLock')
    and not exists(select 1 from pg_locks where locktype='advisory' and pid=pg_backend_pid()
      and classid=1946841873 and objid=232004 and objsubid=2 and granted and mode='ExclusiveLock') then
    raise exception 'Numeric evaluation requires a dedicated transaction before lifecycle readers' using errcode='25001';end if;
  perform pg_advisory_xact_lock(1946841873,232004);
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Numeric evaluation requires READ COMMITTED' using errcode='25001';end if;
  -- Raw INSERTs do not use the lifecycle gate. This precedes Profile row locks.
  lock table public.events in share mode;
  return actor;
end;$$;

create function private.check_personal_rating_commit_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare a private.personal_rating_allocations%rowtype;
begin
  if not exists(select 1 from private.personal_rating_inputs i where i.id=new.id) then return null;end if;
  if not exists(select 1 from private.personal_rating_forecasts f where f.id=new.id) then
    raise exception 'Finalize numeric forecast before committing preparation' using errcode='55000';end if;
  select * into strict a from private.personal_rating_allocations where id=new.id;
  if private.personal_rating_target_has_report_v1(a.profile_id,new.target_item_id) then
    raise exception 'Commit numeric forecast before its first target answer' using errcode='55000';end if;
  return null;
end;$$;
create constraint trigger personal_rating_commit_guard after insert on private.personal_rating_inputs
  deferrable initially deferred for each row execute function private.check_personal_rating_commit_v1();

create function private.prepare_personal_rating_forecast_v1(
  forecast_id uuid,source_id uuid,target_item_id uuid,horizon_seconds integer,evidence_origin text default 'observed'
) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
  actor uuid:=private.lock_personal_rating_transaction_v1();source private.prediction_runs%rowtype;
  allocation private.personal_rating_allocations%rowtype;receipt private.prediction_page_receipts%rowtype;
  request jsonb;input jsonb;prepared jsonb;stored jsonb;cutoff timestamptz;horizon timestamptz;
  pool_ids uuid[];event_ids uuid[];digest text;domain text;
begin
  if forecast_id is null or source_id is null or target_item_id is null or horizon_seconds is null
    or horizon_seconds not between 1 and 7776000 or evidence_origin is null or evidence_origin not in('observed','synthetic') then
    raise exception 'Invalid numeric preparation request' using errcode='22023';end if;
  select * into source from private.prediction_runs where id=source_id;
  if source.id is null or source.actor_user_id<>actor or source.requested_item_type is null or source.requested_item_type not in('BOOK','MOVIE')
    or not exists(select 1 from public.profiles p where p.id=source.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor) then
    raise exception 'Numeric Personal source access denied' using errcode='42501';end if;
  perform p.id from public.profiles p where p.id=source.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor for update;
  if not found then raise exception 'Numeric Personal owner changed' using errcode='42501';end if;
  perform r.id from private.prediction_runs r where r.id=source_id for key share;
  if not found then raise exception 'Numeric source disappeared' using errcode='42501';end if;
  request:=jsonb_build_object('sourcePredictionId',source_id,'targetItemId',target_item_id,
    'horizonSeconds',horizon_seconds,'evidenceOrigin',evidence_origin);
  select * into allocation from private.personal_rating_allocations where id=forecast_id;
  if found then
    if allocation.actor_user_id<>actor or allocation.request_hash<>md5(request::text) then
      raise exception 'Numeric forecast ID already has different intent' using errcode='22023';end if;
    select i.preparation,f.forecast into prepared,stored from private.personal_rating_inputs i
      left join private.personal_rating_forecasts f on f.id=i.id where i.id=forecast_id;
    if prepared is null then raise exception 'Numeric source was withdrawn; forecast ID cannot be reused' using errcode='55000';end if;
    return prepared||jsonb_build_object('forecast',stored);
  end if;
  if exists(select 1 from private.personal_rating_allocations a where a.source_prediction_id=source_id)
    or (select count(*) from private.personal_rating_allocations a where a.actor_user_id=actor and a.profile_id=source.profile_id)>=128 then
    raise exception 'Numeric source already allocated or owner budget exceeded' using errcode='54000';end if;
  if exists(select 1 from private.personal_rating_inputs i join private.personal_rating_allocations a on a.id=i.id
    where i.target_item_id=prepare_personal_rating_forecast_v1.target_item_id
      and a.actor_user_id=actor and a.profile_id=source.profile_id) then
    raise exception 'Numeric target already has a retained evaluation opportunity' using errcode='55000';end if;
  if source.requested_at<clock_timestamp()-interval '15 minutes' or source.requested_at>=now() or source.session_id is null then
    raise exception 'Numeric evaluation needs a fresh committed source with session' using errcode='55000';end if;
  perform s.id from public.event_sessions s where s.id=source.session_id and s.actor_user_id=actor and s.profile_id=source.profile_id for key share;
  if not found then raise exception 'Numeric source session unavailable' using errcode='42501';end if;
  select * into receipt from private.prediction_page_receipts where prediction_id=source_id;
  if receipt.prediction_id is null or receipt.actor_user_id<>actor or receipt.profile_id<>source.profile_id
    or receipt.response->>'predictionId' is distinct from source_id::text
    or receipt.request->>'sessionId' is distinct from source.session_id::text
    or jsonb_typeof(receipt.response->'items') is distinct from 'array' then
    raise exception 'Numeric evaluation requires an actual Personal page receipt' using errcode='55000';end if;
  select array_agg(c.item_id order by c.final_rank,c.item_id) into pool_ids from private.prediction_candidates c
    where c.prediction_id=source_id and c.selected_for_delivery;
  if coalesce(cardinality(pool_ids),0) not between 1 and 50 or not target_item_id=any(pool_ids)
    or jsonb_array_length(receipt.response->'items')<>cardinality(pool_ids)
    or exists(select 1 from private.prediction_candidates c where c.prediction_id=source_id and c.selected_for_delivery
      and not exists(select 1 from jsonb_array_elements(receipt.response->'items') x where x->>'item_id'=c.item_id::text
        and (x->>'rank')::integer=c.final_rank))
    or exists(select 1 from private.prediction_candidates c where c.prediction_id=source_id and c.item_id=target_item_id
      and (private.prediction_delivery_tier_v1(c.explanation->'resurfacingPolicy')>=2
        or not coalesce((c.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false))) then
    raise exception 'Numeric target requires a bounded actual eligible delivered pool' using errcode='22023';end if;
  if private.personal_rating_target_has_report_v1(source.profile_id,target_item_id) then
    raise exception 'Numeric target already has answer or terminal history' using errcode='55000';end if;
  -- Metadata is stable before assigning the common snapshot cutoff.
  perform i.id from public.items i where i.id=any(pool_ids) order by i.id for share;
  cutoff:=clock_timestamp();horizon:=cutoff+make_interval(secs=>horizon_seconds);domain:=source.requested_item_type;
  select coalesce(array_agg(e.id order by e.id),'{}'::uuid[]) into event_ids from (
    select e.id from public.events e where e.actor_user_id=actor and e.profile_id=source.profile_id
      and isfinite(e.created_at) and e.created_at<=cutoff and isfinite(e.occurred_at) and e.occurred_at<=cutoff limit 8193
  ) e;
  if cardinality(event_ids)>8192 then raise exception 'Complete numeric dependency prefix exceeds budget' using errcode='54000';end if;
  if exists(select 1 from public.events e where e.id=any(event_ids)
    and (e.xmin::text=pg_current_xact_id()::text or e.created_at>=now())) then
    raise exception 'Commit source evidence before preparing numeric forecast' using errcode='25001';end if;
  if (select count(*) from public.items i where i.id=any(pool_ids) and i.item_type=domain and i.discoverable
      and isfinite(i.created_at) and i.created_at<=cutoff)<>cardinality(pool_ids) then
    raise exception 'Numeric delivered Item snapshot unavailable' using errcode='55000';end if;
  with resolved as materialized(select * from private.personal_source_evidence_v1(source.profile_id,cutoff)
    where source_status='NATIVE_RATING' and not is_bootstrap), labels as (
    select jsonb_build_object('itemId',r.item_id,'sourceEventId',r.source_event_id,'sourceStatus',r.source_status,
      'orderingBasis',r.ordering_basis,'event',jsonb_build_object('id',e.id,'actorUserId',e.actor_user_id,
        'profileId',e.profile_id,'itemId',e.item_id,'itemType',e.item_type,'eventType',e.event_type,'rating',e.properties->'rating',
        'occurredAtMicros',(extract(epoch from e.occurred_at)*1000000)::bigint::text,
        'availableAtMicros',(extract(epoch from e.created_at)*1000000)::bigint::text)) value
    from resolved r join public.events e on e.id=r.source_event_id where e.item_type=domain
  ), pool as (
    select jsonb_build_object('id',i.id,'itemType',i.item_type,'discoverable',i.discoverable,
      'availableAtMicros',(extract(epoch from i.created_at)*1000000)::bigint::text) value,n
    from unnest(pool_ids) with ordinality requested(id,n) join public.items i on i.id=requested.id
  ) select jsonb_build_object('version','kajo-personal-rating-prospective-prefix-v1','captureScope','PRIVATE_NATIVE_EVALUATION',
    'evidenceOrigin',evidence_origin,'forecastId',forecast_id,'sourcePredictionId',source_id,'targetItemId',target_item_id,'complete',true,
    'profile',jsonb_build_object('id',source.profile_id,'type','PERSONAL','ownerUserId',actor),
    'actorUserId',actor,'itemType',domain,'cutoffMicros',(extract(epoch from cutoff)*1000000)::bigint::text,
    'source',jsonb_build_object('signature','private.personal_source_evidence_v1(uuid,timestamp with time zone)',
      'bodyMd5',(select md5(prosrc) from pg_proc where oid='private.personal_source_evidence_v1(uuid,timestamptz)'::regprocedure)),
    'labels',(select coalesce(jsonb_agg(value order by value->>'itemId'),'[]') from labels),
    'candidatePool',jsonb_build_object('kind','FROZEN_DELIVERED_PERSONAL_POOL','sourcePredictionId',source_id,
      'cutoffMicros',(extract(epoch from cutoff)*1000000)::bigint::text,
      'items',(select jsonb_agg(value order by n) from pool))) into input;
  digest:='native-prospective:'||md5(input::text);
  input:=input||jsonb_build_object('snapshotId',digest,'candidatePool',input->'candidatePool'||jsonb_build_object('snapshotId',digest));
  prepared:=jsonb_build_object('version','kajo-personal-rating-preparation-v1','forecastId',forecast_id,'sourcePredictionId',source_id,
    'targetItemId',target_item_id,'itemType',domain,'cutoffMicros',input->'cutoffMicros',
    'horizonEndMicros',(extract(epoch from horizon)*1000000)::bigint::text,'requestHash',md5(request::text),'input',input,
    'config',jsonb_build_object('version','personal-native-location-v1','shrinkage',2),'forecast',null,
    'cohort','FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN','selection','ONE_PREDECLARED_TARGET_FROM_COMPLETE_DELIVERED_POOL',
    'qualityAdmission','NONE','servingActivation','NONE');
  insert into private.personal_rating_allocations(id,source_prediction_id,actor_user_id,profile_id,request_hash)
    values(forecast_id,source_id,actor,source.profile_id,md5(request::text));
  set constraints private.personal_rating_commit_guard deferred;
  insert into private.personal_rating_inputs(id,target_item_id,prepared_transaction,prepared_at,horizon_end,preparation)
    values(forecast_id,target_item_id,pg_current_xact_id(),cutoff,horizon,prepared);
  insert into private.personal_rating_event_refs(forecast_id,event_id) select forecast_id,unnest(event_ids);
  return prepared;
end;$$;

-- Preserve the installed eraser's identity/attributes and extend its existing
-- complete dependency budget before cascades remove source-owned allocations.
do $numeric_eraser$
declare original text;definition text;before_text text:=$before$
    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)$before$;
  after_text text:=$after$
    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_rating_allocations a where a.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_rating_inputs i join private.personal_rating_allocations a on a.id=i.id where a.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_rating_forecasts f join private.personal_rating_allocations a on a.id=f.id where a.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_rating_answers r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)$after$;
begin
  select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc
    where oid='private.erase_prediction_sources_v1(text,uuid)'::regprocedure;
  if md5(original)<>'f69c58702752ee797d92c5f649489363'
    or (length(original)-length(replace(original,before_text,'')))/length(before_text)<>1 then
    raise exception 'Numeric evaluation eraser predecessor drift' using errcode='55000';end if;
  execute replace(definition,original,replace(original,before_text,after_text));
end;$numeric_eraser$;

revoke all on function private.guard_personal_rating_artifact_v1(),private.withdraw_personal_rating_event_v1(),
  private.lock_personal_rating_transaction_v1(),private.check_personal_rating_commit_v1(),
  private.personal_rating_target_has_report_v1(uuid,uuid),private.invalidate_pending_personal_rating_v1(),
  private.prepare_personal_rating_forecast_v1(uuid,uuid,uuid,integer,text),
  private.finalize_personal_rating_forecast_v1(uuid,jsonb),private.commit_personal_rating_answer_v1(uuid,jsonb),
  private.inspect_personal_rating_forecast_v1(uuid)
  from public,anon,authenticated,service_role;
