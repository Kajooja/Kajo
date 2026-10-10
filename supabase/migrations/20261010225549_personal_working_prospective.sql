-- Private, bounded prospective Personal enrollment and immutable outcome captures.
-- OFF serving and public APIs stay unchanged; stored clocks do not certify commit availability.
create table private.personal_working_enrollments (
  id uuid primary key,
  source_prediction_id uuid not null unique references private.prediction_runs(id) on delete cascade,
  actor_user_id uuid not null,
  profile_id uuid not null,
  session_id uuid not null,
  request jsonb not null check(octet_length(request::text)<=16384),
  result jsonb not null check(octet_length(result::text)<=32768),
  declared_at timestamptz not null check(isfinite(declared_at)),
  declared_transaction xid8 not null,
  horizon_end timestamptz not null check(isfinite(horizon_end) and horizon_end>declared_at),
  mature_at timestamptz not null check(isfinite(mature_at) and mature_at>=horizon_end)
);
create index personal_working_enrollments_owner_idx on private.personal_working_enrollments(actor_user_id,profile_id);
-- Reservations outlive withdrawn captures, preventing ID reuse/resampling and
-- preserving the lifetime 16-write budget without mutable enrollment counters.
create table private.personal_working_outcome_allocations (
  id uuid primary key,
  enrollment_id uuid not null references private.personal_working_enrollments(id) on delete cascade,
  source_prediction_id uuid not null references private.prediction_runs(id) on delete cascade,
  revision integer not null check(revision between 1 and 16),
  unique(enrollment_id,revision)
);
create index personal_working_outcome_allocations_source_idx on private.personal_working_outcome_allocations(source_prediction_id);
create table private.personal_working_outcome_captures (
  id uuid primary key references private.personal_working_outcome_allocations(id) on delete cascade,
  enrollment_id uuid not null references private.personal_working_enrollments(id) on delete cascade,
  source_prediction_id uuid not null references private.prediction_runs(id) on delete cascade,
  revision integer not null check(revision between 1 and 16),
  origin_prediction_ids uuid[] not null check(cardinality(origin_prediction_ids)<=8192 and array_position(origin_prediction_ids,null) is null),
  result jsonb not null check(octet_length(result::text)<=262144),
  captured_at timestamptz not null check(isfinite(captured_at)),
  unique(enrollment_id,revision)
);
create index personal_working_outcome_captures_source_idx on private.personal_working_outcome_captures(source_prediction_id);
create index personal_working_outcome_captures_origins_idx on private.personal_working_outcome_captures using gin(origin_prediction_ids);
create table private.personal_working_outcome_event_refs (
  capture_id uuid not null references private.personal_working_outcome_captures(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key(capture_id,event_id)
);
create index personal_working_outcome_event_refs_event_idx on private.personal_working_outcome_event_refs(event_id);
alter table private.personal_working_enrollments enable row level security;
alter table private.personal_working_outcome_allocations enable row level security;
alter table private.personal_working_outcome_captures enable row level security;
alter table private.personal_working_outcome_event_refs enable row level security;
revoke all on private.personal_working_enrollments,private.personal_working_outcome_allocations,private.personal_working_outcome_captures,
  private.personal_working_outcome_event_refs from public,anon,authenticated,service_role;

create function private.guard_personal_working_prospective_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if tg_table_name='personal_working_outcome_event_refs' then
      if not exists(select 1 from private.personal_working_outcome_captures c where c.id=old.capture_id) then return old; end if;
    elsif tg_table_name in('personal_working_enrollments','personal_working_outcome_allocations') then
      if not exists(select 1 from private.prediction_runs r where r.id=old.source_prediction_id) then return old; end if;
    else
      -- Only trusted parent DELETE triggers may withdraw copied captures before
      -- their edge cascades. No API role can execute this private writer/trigger.
      if pg_trigger_depth()>1
        or not exists(select 1 from private.prediction_runs r where r.id=old.source_prediction_id)
        or not exists(select 1 from private.personal_working_enrollments e where e.id=old.enrollment_id) then return old; end if;
    end if;
  end if;
  raise exception 'Prospective evidence is immutable; withdraw its whole source instead' using errcode='55000';
end;
$$;
create trigger personal_working_enrollment_immutable before update or delete on private.personal_working_enrollments
  for each row execute function private.guard_personal_working_prospective_v1();
create trigger personal_working_outcome_allocation_immutable before update or delete on private.personal_working_outcome_allocations
  for each row execute function private.guard_personal_working_prospective_v1();
create trigger personal_working_outcome_immutable before update or delete on private.personal_working_outcome_captures
  for each row execute function private.guard_personal_working_prospective_v1();
create trigger personal_working_outcome_ref_immutable before update or delete on private.personal_working_outcome_event_refs
  for each row execute function private.guard_personal_working_prospective_v1();
create function private.withdraw_personal_working_outcomes_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Prospective source withdrawal requires READ COMMITTED' using errcode='25001'; end if;
  if tg_table_name='events' then
    delete from private.personal_working_outcome_captures c where exists(
      select 1 from private.personal_working_outcome_event_refs r where r.capture_id=c.id and r.event_id=old.id);
  else
    delete from private.personal_working_outcome_captures c where c.origin_prediction_ids @> array[old.id];
  end if;
  return old;
end;
$$;
create trigger withdraw_personal_working_outcomes_for_event before delete on public.events
  for each row execute function private.withdraw_personal_working_outcomes_v1();
create trigger withdraw_personal_working_outcomes_for_prediction before delete on private.prediction_runs
  for each row execute function private.withdraw_personal_working_outcomes_v1();

-- Only enrollment gains a deferred commit check; canonical Event INSERT APIs
-- keep their original triggers/permissions. SHARE on events and lifecycle
-- EXCLUSIVE remain held until COMMIT, so any newly visible paired evidence is
-- this declaration transaction's own write, including SAVEPOINT child XIDs.
create function private.check_personal_working_enrollment_commit_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from private.personal_working_enrollments e where e.id=new.id) then return null; end if;
  if exists(select 1 from public.events e where e.actor_user_id=new.actor_user_id and e.profile_id=new.profile_id
    and e.event_type in('ITEM_IMPRESSION','ITEM_RATED','ITEM_HISTORY_CLEARED','ITEM_NOT_INTERESTED','ITEM_INTEREST_CLEARED','ITEM_INTERACTION_UNDONE')
    and exists(select 1 from jsonb_array_elements(new.result->'pairs') p
      where e.item_id::text in(p->>'leftItemId',p->>'rightItemId'))) then
    raise exception 'Commit enrollment before paired exposure or terminal evidence' using errcode='55000'; end if;
  return null;
end;
$$;
create constraint trigger personal_working_enrollment_commit_guard after insert on private.personal_working_enrollments
  deferrable initially deferred for each row execute function private.check_personal_working_enrollment_commit_v1();

create function private.enroll_personal_working_evaluation_v1(
  plan_id uuid,source_id uuid,pairs jsonb,horizon_seconds integer,maturity_seconds integer
) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
  actor uuid := (select auth.uid()); source private.prediction_runs%rowtype;
  prior private.personal_working_enrollments%rowtype; request jsonb; result jsonb;
  receipt private.prediction_page_receipts%rowtype; item_ids uuid[]; controls jsonb := '[]';
  comparison private.personal_working_shadow_comparisons%rowtype; control_name text;
  declared_at timestamptz; horizon_end timestamptz; mature_at timestamptz;
begin
  -- Dedicated declaration transaction. Upgrading a preheld SHARE lock can
  -- deadlock an atomic writer that already owns Profile then needs Event INSERT.
  if exists(select 1 from pg_catalog.pg_locks where locktype='advisory' and pid=pg_backend_pid()
    and classid=1946841873 and objid=232004 and objsubid=2 and granted and mode='ShareLock')
    and not exists(select 1 from pg_catalog.pg_locks where locktype='advisory' and pid=pg_backend_pid()
      and classid=1946841873 and objid=232004 and objsubid=2 and granted and mode='ExclusiveLock') then
    raise exception 'Enrollment requires a dedicated transaction before lifecycle readers' using errcode='25001'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1946841873,232004);
  if plan_id is null or source_id is null or jsonb_typeof(pairs) is distinct from 'array'
    or horizon_seconds is null or horizon_seconds not between 1 and 7776000
    or maturity_seconds is null or maturity_seconds not between 0 and 604800 then
    raise exception 'Invalid prospective enrollment request' using errcode='22023'; end if;
  if jsonb_array_length(pairs) not between 1 and 25 or octet_length(pairs::text)>16384
    or exists(select 1 from jsonb_array_elements(pairs) p where jsonb_typeof(p) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(p))<>3
      or coalesce(p->>'pairId','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(p->>'leftItemId','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(p->>'rightItemId','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or (select count(distinct p->>'pairId') from jsonb_array_elements(pairs) p)<>jsonb_array_length(pairs) then
    raise exception 'Invalid or duplicate prospective pair' using errcode='22023'; end if;
  select array_agg(x.id order by x.id) into item_ids from (
    select (p->>'leftItemId')::uuid id from jsonb_array_elements(pairs) p
    union all select (p->>'rightItemId')::uuid from jsonb_array_elements(pairs) p) x;
  if (select count(distinct x) from unnest(item_ids) x)<>cardinality(item_ids) then
    raise exception 'Prospective pairs must be disjoint' using errcode='22023'; end if;
  request := jsonb_build_object('sourceId',source_id,'pairs',pairs,'horizonSeconds',horizon_seconds,'maturitySeconds',maturity_seconds);
  select r.* into source from private.prediction_runs r where r.id=source_id;
  if actor is null or source.id is null or source.actor_user_id<>actor or source.session_id is null
    or not exists(select 1 from public.profiles p where p.id=source.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor)
    or not exists(select 1 from public.event_sessions s where s.id=source.session_id and s.actor_user_id=actor and s.profile_id=source.profile_id) then
    raise exception 'Prospective Personal source access denied' using errcode='42501'; end if;
  select e.* into prior from private.personal_working_enrollments e where e.id=plan_id;
  if found then
    if prior.actor_user_id<>actor or prior.request is distinct from request then
      raise exception 'Enrollment ID already has different intent' using errcode='22023'; end if;
    return prior.result;
  end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'New enrollment requires READ COMMITTED' using errcode='25001'; end if;
  -- Direct Event INSERT has no lifecycle lock. Acquiring SHARE before Profile
  -- locks waits for existing raw writers and prevents new inserts until COMMIT.
  lock table public.events in share mode;
  perform p.id from public.profiles p where p.id=source.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor for update;
  if not found then raise exception 'Prospective owner changed' using errcode='42501'; end if;
  perform s.id from public.event_sessions s where s.id=source.session_id and s.actor_user_id=actor and s.profile_id=source.profile_id for key share;
  if not found then raise exception 'Prospective session disappeared' using errcode='42501'; end if;
  perform r.id from private.prediction_runs r where r.id=source.id for key share;
  if not found then raise exception 'Prospective source disappeared' using errcode='42501'; end if;
  if exists(select 1 from private.personal_working_enrollments e where e.source_prediction_id=source.id)
    or (select count(*) from private.personal_working_enrollments e where e.actor_user_id=actor and e.profile_id=source.profile_id)>=128 then
    raise exception 'Prospective source or owner enrollment budget exceeded' using errcode='54000'; end if;
  if source.state_snapshot#>>'{workingState,version}' is distinct from 'native-working-capture-v3'
    or source.requested_at<clock_timestamp()-interval '15 minutes' then
    raise exception 'Enrollment requires a fresh actual v3 source' using errcode='55000'; end if;
  select r.* into receipt from private.prediction_page_receipts r where r.prediction_id=source.id;
  if receipt.prediction_id is null or receipt.actor_user_id<>actor or receipt.profile_id<>source.profile_id
    or receipt.request->>'sessionId' is distinct from source.session_id::text
    or receipt.request->>'discoveryMode' is distinct from source.discovery_mode
    or receipt.response->>'predictionId' is distinct from source.id::text
    or jsonb_typeof(receipt.response->'items') is distinct from 'array' then
    raise exception 'Actual page receipt is required for prospective enrollment' using errcode='55000'; end if;
  if exists(select 1 from unnest(item_ids) i(id) left join private.prediction_candidates c
      on c.prediction_id=source.id and c.item_id=i.id where c.item_id is null or not c.selected_for_delivery
      or private.prediction_delivery_tier_v1(c.explanation->'resurfacingPolicy')>=2
      or not coalesce((c.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false)
      or not exists(select 1 from jsonb_array_elements(receipt.response->'items') p where p->>'item_id'=i.id::text and (p->>'rank')::integer=c.final_rank))
    or exists(select 1 from jsonb_array_elements(pairs) p
      join private.prediction_candidates l on l.prediction_id=source.id and l.item_id=(p->>'leftItemId')::uuid
      join private.prediction_candidates r on r.prediction_id=source.id and r.item_id=(p->>'rightItemId')::uuid
      where private.prediction_delivery_tier_v1(l.explanation->'resurfacingPolicy')
        <>private.prediction_delivery_tier_v1(r.explanation->'resurfacingPolicy')) then
    raise exception 'Pairs require actual OFF delivered eligible same-tier candidates' using errcode='22023'; end if;
  if exists(select 1 from public.events e where e.actor_user_id=actor and e.profile_id=source.profile_id
    and e.item_id=any(item_ids) and e.event_type in('ITEM_IMPRESSION','ITEM_RATED',
      'ITEM_HISTORY_CLEARED','ITEM_NOT_INTERESTED','ITEM_INTEREST_CLEARED','ITEM_INTERACTION_UNDONE')) then
    raise exception 'Prospective pairs already have own outcome or exposure evidence' using errcode='55000'; end if;
  foreach control_name in array array['OFF','STATIC','ORDERED'] loop
    perform private.record_personal_working_shadow_v1(source.id,control_name);
    select c.* into strict comparison from private.personal_working_shadow_comparisons c where c.source_prediction_id=source.id and c.control=control_name;
    controls := controls||jsonb_build_array(jsonb_build_object('control',control_name,'comparisonId',md5('kajo:personal-working-comparison:'||source.id::text||':'||control_name)::uuid,
      'createdAt',extract(epoch from comparison.created_at)*1000));
  end loop;
  declared_at := clock_timestamp(); horizon_end := declared_at+make_interval(secs=>horizon_seconds);
  mature_at := horizon_end+make_interval(secs=>maturity_seconds);
  result := jsonb_build_object('version','personal-working-enrollment-v1','enrollmentId',plan_id,'sourcePredictionId',source.id,
    'actorUserId',actor,'profileId',source.profile_id,'sessionId',source.session_id,'declaredAt',extract(epoch from declared_at)*1000,
    'horizon',jsonb_build_object('startAt',extract(epoch from declared_at)*1000,'endAt',extract(epoch from horizon_end)*1000),
    'matureAt',extract(epoch from mature_at)*1000,'pairs',pairs,'controls',controls,'commitAvailability','UNKNOWN',
    'historicalFeatureEligible',false,'learnable',false,'nativeActivated',false);
  -- Restore this specific private constraint to deferred even when a trusted
  -- caller began with immediate constraint defaults. Commit owns the check.
  set constraints private.personal_working_enrollment_commit_guard deferred;
  insert into private.personal_working_enrollments(id,source_prediction_id,actor_user_id,profile_id,session_id,request,result,declared_at,declared_transaction,horizon_end,mature_at)
    values(plan_id,source.id,actor,source.profile_id,source.session_id,request,result,declared_at,pg_current_xact_id(),horizon_end,mature_at);
  return result;
end;
$$;

create function private.capture_personal_working_outcomes_v1(capture_id uuid,plan_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
  actor uuid := (select auth.uid()); enrollment private.personal_working_enrollments%rowtype;
  source private.prediction_runs%rowtype; prior private.personal_working_outcome_captures%rowtype;
  plan_xmin text; captured_at timestamptz; item_ids uuid[]; event_ids uuid[]; origins uuid[];
  prefix jsonb; label jsonb; labels jsonb := '[]'; terminal jsonb; impression jsonb; item_id uuid;
  terminal_at timestamptz; control_at timestamptz; complete boolean; revision integer; result jsonb;
  active jsonb; bad_undo boolean; terminal_count integer; status text; reason text; rating integer;
  unavailable_reason text := 'EVENT_BUDGET';
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);
  if capture_id is null or plan_id is null then raise exception 'Invalid capture request' using errcode='22023'; end if;
  select e.* into enrollment from private.personal_working_enrollments e where e.id=plan_id;
  select r.* into source from private.prediction_runs r where r.id=enrollment.source_prediction_id;
  if actor is null or enrollment.id is null or enrollment.actor_user_id<>actor or source.id is null
    or source.actor_user_id<>actor or not exists(select 1 from public.profiles p where p.id=enrollment.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor)
    or not exists(select 1 from public.event_sessions s where s.id=enrollment.session_id and s.actor_user_id=actor and s.profile_id=enrollment.profile_id) then
    raise exception 'Prospective Personal capture access denied' using errcode='42501'; end if;
  if enrollment.declared_transaction=pg_current_xact_id() then
    raise exception 'Commit enrollment before reading outcomes' using errcode='25001'; end if;
  select c.* into prior from private.personal_working_outcome_captures c where c.id=capture_id;
  if found then
    if prior.enrollment_id<>plan_id then raise exception 'Capture ID already has another enrollment' using errcode='22023'; end if;
    return prior.result;
  end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'New capture requires READ COMMITTED' using errcode='25001'; end if;
  perform p.id from public.profiles p where p.id=enrollment.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor for update;
  if not found then raise exception 'Prospective owner changed' using errcode='42501'; end if;
  select e.xmin::text into plan_xmin from private.personal_working_enrollments e where e.id=plan_id for update;
  if not found then raise exception 'Prospective enrollment disappeared' using errcode='42501'; end if;
  select c.* into prior from private.personal_working_outcome_captures c where c.id=capture_id;
  if found then
    if prior.enrollment_id<>plan_id then raise exception 'Capture ID already has another enrollment' using errcode='22023'; end if;
    return prior.result;
  end if;
  if exists(select 1 from private.personal_working_outcome_allocations a where a.id=capture_id) then
    raise exception 'Capture was withdrawn; its ID cannot be reused' using errcode='55000'; end if;
  select coalesce(max(a.revision),0)+1 into revision from private.personal_working_outcome_allocations a where a.enrollment_id=plan_id;
  if revision>16 then raise exception 'Prospective capture budget exceeded' using errcode='54000'; end if;
  captured_at := clock_timestamp();
  if captured_at<enrollment.mature_at then raise exception 'Prospective horizon has not matured' using errcode='55000'; end if;
  select array_agg(x.id order by x.id) into item_ids from (
    select (p->>'leftItemId')::uuid id from jsonb_array_elements(enrollment.result->'pairs') p
    union all select (p->>'rightItemId')::uuid from jsonb_array_elements(enrollment.result->'pairs') p) x;
  select greatest(enrollment.declared_at,max(to_timestamp((c->>'createdAt')::double precision/1000))) into control_at
    from jsonb_array_elements(enrollment.result->'controls') c;
  -- One MVCC statement freezes the entire own relevant terminal/correction
  -- prefix through the predetermined maturity boundary, not a chosen read date.
  -- created_at is a stored proxy only. xmin solely excludes declaration-TX writes.
  with bounded as materialized (
    select e.* from public.events e where e.actor_user_id=actor and e.profile_id=enrollment.profile_id and e.item_id=any(item_ids)
      and e.event_type in('ITEM_IMPRESSION','ITEM_RATED','ITEM_HISTORY_CLEARED','ITEM_NOT_INTERESTED','ITEM_INTEREST_CLEARED','ITEM_INTERACTION_UNDONE')
      and e.xmin::text<>plan_xmin and isfinite(e.occurred_at) and e.occurred_at<=enrollment.mature_at
      and isfinite(e.created_at) and e.created_at<=captured_at order by e.id limit 8193
  ), budget as materialized (
    select count(*)<=8192 and coalesce(sum(octet_length(to_jsonb(e)::text)),0)<=8388608 valid from bounded e
  ) select b.valid,case when b.valid then (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'itemId',e.item_id,'type',e.event_type,'at',e.occurred_at,
      'sessionId',e.session_id,'predictionId',e.prediction_id,'mode',e.discovery_mode,'properties',e.properties) order by e.id),'[]'::jsonb)
    from bounded e) else '[]'::jsonb end into complete,prefix from budget b;
  event_ids := '{}'; origins := '{}';
  if complete then
    select coalesce(array_agg((e->>'id')::uuid order by e->>'id'),'{}'::uuid[]) into event_ids from jsonb_array_elements(prefix) e;
    -- Parent DELETE must wait until this transaction stores dependency edges.
    perform e.id from public.events e where e.id=any(event_ids) order by e.id for key share;
    if (select count(*) from public.events e where e.id=any(event_ids))<>cardinality(event_ids) then
      raise exception 'Prospective event source disappeared; retry complete capture' using errcode='55000'; end if;
    select coalesce(array_agg(distinct (e->>'predictionId')::uuid order by (e->>'predictionId')::uuid),'{}'::uuid[]) into origins
      from jsonb_array_elements(prefix) e where e->>'predictionId' is not null;
    perform r.id from private.prediction_runs r where r.id=any(origins)
      and r.actor_user_id=actor and r.profile_id=enrollment.profile_id order by r.id for key share;
    -- Canonical Events intentionally survive forecast erasure and have no
    -- Prediction FK. Do not rebuild a copied erased/foreign origin from its raw
    -- pointer, including a DELETE that won before these dependency locks.
    if (select count(*) from private.prediction_runs r where r.id=any(origins)
      and r.actor_user_id=actor and r.profile_id=enrollment.profile_id)<>cardinality(origins) then
      complete := false; unavailable_reason := 'ORIGIN_SOURCE_UNAVAILABLE'; event_ids := '{}'; origins := '{}';
    end if;
  end if;
  foreach item_id in array item_ids loop
    status := 'missing'; reason := 'NO_TERMINAL'; rating := null; terminal := null; impression := null; terminal_at := null;
    if not complete then status := 'unknown'; reason := unavailable_reason;
    else
      select exists(select 1 from jsonb_array_elements(prefix) u where u->>'itemId'=item_id::text and u->>'type'='ITEM_INTERACTION_UNDONE'
        and not exists(select 1 from jsonb_array_elements(prefix) t where t->>'id'=u#>>'{properties,reversedEventId}'
          and t->>'itemId'=item_id::text and t->>'type' in('ITEM_RATED','ITEM_HISTORY_CLEARED','ITEM_NOT_INTERESTED','ITEM_INTEREST_CLEARED')
          and (t->>'at')::timestamptz<=(u->>'at')::timestamptz)) into bad_undo;
      select coalesce(jsonb_agg(t),'[]'::jsonb) into active from jsonb_array_elements(prefix) t
        where t->>'itemId'=item_id::text and t->>'type' in('ITEM_RATED','ITEM_HISTORY_CLEARED','ITEM_NOT_INTERESTED','ITEM_INTEREST_CLEARED')
        and not exists(select 1 from jsonb_array_elements(prefix) u where u->>'itemId'=item_id::text and u->>'type'='ITEM_INTERACTION_UNDONE'
          and u#>>'{properties,reversedEventId}'=t->>'id' and (u->>'at')::timestamptz>=(t->>'at')::timestamptz);
      select max((t->>'at')::timestamptz) into terminal_at from jsonb_array_elements(active) t;
      select count(*) into terminal_count from jsonb_array_elements(active) t where (t->>'at')::timestamptz=terminal_at;
      if bad_undo then status := 'unknown'; reason := 'UNRESOLVED_UNDO';
      elsif terminal_count>1 then status := 'unknown'; reason := 'AMBIGUOUS_TERMINAL_TIME';
      elsif terminal_count=1 then
        select t into terminal from jsonb_array_elements(active) t where (t->>'at')::timestamptz=terminal_at;
        if terminal_at<enrollment.declared_at or terminal_at>enrollment.horizon_end then status := 'unknown'; reason := 'TERMINAL_OUTSIDE_HORIZON';
        elsif terminal->>'type' in('ITEM_HISTORY_CLEARED') then status := 'clear'; reason := 'RATING_CLEARED';
        elsif terminal->>'type'<>'ITEM_RATED' then status := 'unknown'; reason := 'NOT_A_RATING';
        elsif jsonb_typeof(terminal#>'{properties,rating}')='number'
          and (terminal#>>'{properties,rating}')::numeric between 0 and 10
          and trunc((terminal#>>'{properties,rating}')::numeric)=(terminal#>>'{properties,rating}')::numeric then
          status := 'observed'; reason := null; rating := (terminal#>>'{properties,rating}')::integer;
        else status := 'unknown'; reason := 'INVALID_RATING'; end if;
      elsif exists(select 1 from jsonb_array_elements(prefix) u where u->>'itemId'=item_id::text and u->>'type'='ITEM_INTERACTION_UNDONE') then
        status := 'undone'; reason := 'NO_SURVIVING_TERMINAL';
      end if;
      select e into impression from jsonb_array_elements(prefix) e where e->>'itemId'=item_id::text and e->>'type'='ITEM_IMPRESSION'
        and e->>'predictionId'=enrollment.source_prediction_id::text and e->>'sessionId'=enrollment.session_id::text
        and e->>'mode'=source.discovery_mode and (e->>'at')::timestamptz>control_at
        and (e->>'at')::timestamptz<=enrollment.horizon_end
        and (terminal_at is null or (e->>'at')::timestamptz<=terminal_at)
        order by (e->>'at')::timestamptz,e->>'id' limit 1;
      if status='observed' and impression is null then status := 'unknown'; reason := 'NO_ACTUAL_EXPOSURE'; rating := null; end if;
    end if;
    label := jsonb_build_object('itemId',item_id,'status',status,'reason',reason,'rating',rating,
      'eventId',terminal->'id','occurredAt',case when terminal is not null then extract(epoch from (terminal->>'at')::timestamptz)*1000 end,
      'eventSessionId',terminal->'sessionId','originPredictionId',terminal->'predictionId',
      'exposureId',impression->'id','exposedAt',case when impression is not null then extract(epoch from (impression->>'at')::timestamptz)*1000 end);
    labels := labels||jsonb_build_array(label);
  end loop;
  result := jsonb_build_object('version','personal-working-outcomes-v1','captureId',capture_id,'enrollmentId',enrollment.id,
    'sourcePredictionId',enrollment.source_prediction_id,'actorUserId',actor,'profileId',enrollment.profile_id,'sessionId',enrollment.session_id,
    'revision',revision,'capturedAt',extract(epoch from captured_at)*1000,'matureAt',extract(epoch from enrollment.mature_at)*1000,
    'complete',complete,'resolutionVersion','personal-latest-terminal-v1','labels',labels,'commitAvailability','UNKNOWN',
    'historicalFeatureEligible',false,'learnable',false,'nativeActivated',false);
  insert into private.personal_working_outcome_allocations(id,enrollment_id,source_prediction_id,revision)
    values(capture_id,enrollment.id,enrollment.source_prediction_id,revision);
  insert into private.personal_working_outcome_captures(id,enrollment_id,source_prediction_id,revision,origin_prediction_ids,result,captured_at)
    values(capture_id,enrollment.id,enrollment.source_prediction_id,revision,origins,result,captured_at);
  insert into private.personal_working_outcome_event_refs(capture_id,event_id) select capture_id,unnest(event_ids);
  return result;
end;
$$;
revoke all on function private.guard_personal_working_prospective_v1(),private.withdraw_personal_working_outcomes_v1(),
  private.check_personal_working_enrollment_commit_v1(),
  private.enroll_personal_working_evaluation_v1(uuid,uuid,jsonb,integer,integer),private.capture_personal_working_outcomes_v1(uuid,uuid)
  from public,anon,authenticated,service_role;

-- Preserve installed eraser OID, ACL and attributes; only expand its existing
-- complete dependent-row sentinel for these new source-owned rows and bindings.
do $prospective_eraser$
declare body text; definition text; before_text text := $before$
    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)
    limit 250001) bounded;$before$;
  after_text text := $after$
    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_working_enrollments e where e.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_working_outcome_allocations a where a.source_prediction_id=any(source_ids)
    union all select 1 from private.personal_working_outcome_captures c where c.source_prediction_id=any(source_ids) or c.origin_prediction_ids && source_ids
    union all select 1 from private.personal_working_outcome_event_refs e join private.personal_working_outcome_captures c on c.id=e.capture_id
      where c.source_prediction_id=any(source_ids) or c.origin_prediction_ids && source_ids
    limit 250001) bounded;$after$;
begin
  select p.prosrc,pg_get_functiondef(p.oid) into strict body,definition from pg_proc p where p.oid='private.erase_prediction_sources_v1(text,uuid)'::regprocedure;
  if md5(body)<>'2eac4bba2e3486e3a78404dad3c0ffb7' or (length(body)-length(replace(body,before_text,'')))/length(before_text)<>1 then
    raise exception 'Unexpected installed Prediction eraser predecessor' using errcode='55000'; end if;
  execute replace(definition,body,replace(body,before_text,after_text));
end;
$prospective_eraser$;
