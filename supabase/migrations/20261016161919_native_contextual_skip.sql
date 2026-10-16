-- Native neutral contextual skip. CLI-generated additive forward; no historical rewrites.
create table private.contextual_skip_commands (
  action_id uuid primary key,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.items(id) on delete restrict,
  surface text not null check(surface in('TASTE','DISCOVERY')),
  kind text not null check(kind in('CONTEXTUAL_SKIP','WITHDRAW_CONTEXTUAL_SKIP')),
  origin_hash text not null,
  origin jsonb,
  command jsonb,
  result jsonb,
  accepted_at timestamptz not null,
  reverses_action_id uuid,
  erased_at timestamptz,
  source_prediction_id uuid,
  source_impression_id uuid,
  check((erased_at is null and item_id is not null and origin is not null and command is not null and result is not null)
    or (erased_at is not null and item_id is null and origin is null and command is null and result is null
      and reverses_action_id is null and source_prediction_id is null and source_impression_id is null))
);
create unique index contextual_skip_origin_once on private.contextual_skip_commands(actor_user_id,profile_id,origin_hash)
  where kind='CONTEXTUAL_SKIP';
create unique index contextual_skip_withdraw_once on private.contextual_skip_commands(reverses_action_id)
  where reverses_action_id is not null;
create index contextual_skip_eligibility on private.contextual_skip_commands(profile_id,item_id,accepted_at desc)
  where erased_at is null and kind='CONTEXTUAL_SKIP';
create index contextual_skip_profile_clock on private.contextual_skip_commands(profile_id,accepted_at desc);
create index contextual_skip_prediction_source on private.contextual_skip_commands(source_prediction_id) where erased_at is null;
create index contextual_skip_impression_source on private.contextual_skip_commands(source_impression_id) where erased_at is null;
alter table private.contextual_skip_commands enable row level security;
revoke all on private.contextual_skip_commands from public,anon,authenticated,service_role;

-- Short-lived, denied writer admission witness. Never retained after a successful command.
create table private.contextual_skip_event_permissions (
  backend_pid integer not null,transaction_id bigint not null,action_id uuid not null,
  primary key(backend_pid,transaction_id,action_id)
);
alter table private.contextual_skip_event_permissions enable row level security;
revoke all on private.contextual_skip_event_permissions from public,anon,authenticated,service_role;

create function private.validate_contextual_skip_command_v1(command jsonb,surface text)
returns void language plpgsql immutable security invoker set search_path='' as $$
declare key text;uuid_pattern text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if jsonb_typeof(command) is distinct from 'object' or octet_length(command::text)>8192
    or command->>'version' is distinct from 'kajo-contextual-skip-v1'
    or not coalesce(command->>'kind' in('CONTEXTUAL_SKIP','WITHDRAW_CONTEXTUAL_SKIP'),false)
    or not(command ?& array['version','kind','actionId','actorUserId','profileId','itemId','occurredAt','origin','contextRef','reversesActionId'])
    or exists(select 1 from jsonb_object_keys(command) k where k not in('version','kind','actionId','actorUserId','profileId','itemId','occurredAt','origin','contextRef','reversesActionId'))
    or command->'contextRef' is distinct from 'null'::jsonb
    or jsonb_typeof(command->'occurredAt') is distinct from 'string'
    or not coalesce(command->>'occurredAt' ~ '^(0|[1-9][0-9]{0,17})$',false)
    or jsonb_typeof(command->'origin') is distinct from 'object'
    or command#>>'{origin,surface}' is distinct from surface or surface not in('TASTE','DISCOVERY') then
    raise exception 'INVALID_COMMAND' using errcode='22023';end if;
  if (command->>'occurredAt')::numeric>253402300799999999 then raise exception 'INVALID_COMMAND' using errcode='22023';end if;
  foreach key in array array['actionId','actorUserId','profileId','itemId'] loop
    if jsonb_typeof(command->key) is distinct from 'string' or not coalesce(command->>key ~ uuid_pattern,false) then
      raise exception 'INVALID_COMMAND' using errcode='22023';end if;
  end loop;
  if (command->>'kind'='CONTEXTUAL_SKIP' and command->'reversesActionId' is distinct from 'null'::jsonb)
    or (command->>'kind'='WITHDRAW_CONTEXTUAL_SKIP' and (jsonb_typeof(command->'reversesActionId') is distinct from 'string'
      or not coalesce(command->>'reversesActionId' ~ uuid_pattern,false))) then
    raise exception 'INVALID_COMMAND' using errcode='22023';end if;
  if surface='DISCOVERY' then
    if not(command->'origin' ?& array['surface','sessionId','predictionId','deliveryRequestId','impressionEventId'])
      or exists(select 1 from jsonb_object_keys(command->'origin') k where k not in('surface','sessionId','predictionId','deliveryRequestId','impressionEventId')) then
      raise exception 'INVALID_COMMAND' using errcode='22023';end if;
    foreach key in array array['sessionId','predictionId','deliveryRequestId','impressionEventId'] loop
      if jsonb_typeof(command->'origin'->key) is distinct from 'string' or not coalesce(command->'origin'->>key ~ uuid_pattern,false) then
        raise exception 'INVALID_COMMAND' using errcode='22023';end if;
    end loop;
  else
    if not(command->'origin' ?& array['surface','sessionId','questionId','panelId','prefixRevision'])
      or exists(select 1 from jsonb_object_keys(command->'origin') k where k not in('surface','sessionId','questionId','panelId','prefixRevision'))
      or jsonb_typeof(command#>'{origin,prefixRevision}') is distinct from 'number'
      or not coalesce(command#>>'{origin,prefixRevision}' ~ '^(0|[1-9][0-9]{0,2})$',false) then
      raise exception 'INVALID_COMMAND' using errcode='22023';end if;
    if (command#>>'{origin,prefixRevision}')::integer>256 then raise exception 'INVALID_COMMAND' using errcode='22023';end if;
    foreach key in array array['sessionId','questionId','panelId'] loop
      if jsonb_typeof(command->'origin'->key) is distinct from 'string' or not coalesce(command->'origin'->>key ~ uuid_pattern,false) then
        raise exception 'INVALID_COMMAND' using errcode='22023';end if;
    end loop;
  end if;
end;
$$;

create function private.lock_contextual_skip_scope_v1(command jsonb)
returns void language plpgsql volatile security invoker set search_path='' as $$
declare actor uuid:=auth.uid();profile uuid:=(command->>'profileId')::uuid;owner uuid;kind text;
begin
  -- A writer fences preceding serving/capture transactions before taking any row lock.
  perform pg_catalog.pg_advisory_xact_lock(1946841873,232004);
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ_COMMITTED_REQUIRED' using errcode='25001';end if;
  if current_setting('role',true) is distinct from 'authenticated' or actor is null
    or actor is distinct from (command->>'actorUserId')::uuid
    or not exists(select 1 from auth.users u where u.id=actor and u.is_anonymous is false) then
    raise exception 'ACCESS_DENIED' using errcode='42501';end if;
  select p.owner_user_id,p.profile_type into owner,kind from public.profiles p where p.id=profile for update;
  if not found or (kind='PERSONAL' and owner<>actor) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
  perform 1 from public.profile_members m where m.profile_id=profile and m.user_id=actor for key share;
  if not found then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
end;
$$;

create function private.contextual_skip_origin_hash_v1(command jsonb)
returns text language sql immutable security invoker set search_path='' as $$
 select md5(jsonb_build_array(command->'actorUserId',command->'profileId',command->'itemId',command->'origin')::text)
$$;
create function private.contextual_skip_instant_v1(micros text)
returns timestamptz language sql immutable security invoker set search_path='' as $$
 select 'epoch'::timestamptz+((micros::bigint/1000000)::text||' seconds')::interval
   +((micros::bigint%1000000)::text||' microseconds')::interval
$$;
create function private.contextual_skip_receipt_v1(command jsonb,accepted timestamptz)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('version','kajo-contextual-skip-v1','actionId',command->'actionId','actorUserId',command->'actorUserId',
   'profileId',command->'profileId','itemId',command->'itemId','acceptedAt',(extract(epoch from accepted)*1000000)::numeric(18,0)::text,
   'policyVersion','contextual-skip-cooldown-v1','evidence',case command#>>'{origin,surface}' when 'TASTE' then 'PRIVATE_TASTE_RESPONSE' else 'CANONICAL_DISCOVERY_EVENT' end,
   'semantic',command->'kind','reversesActionId',command->'reversesActionId')
$$;

create function private.contextual_skip_decision_v1(profile uuid,item uuid,cutoff timestamptz,otherwise_eligible boolean default true)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare latest timestamptz;sources jsonb;deadline timestamptz;
begin
  if profile is null or item is null or cutoff is null or not isfinite(cutoff) or cutoff<'epoch'::timestamptz
    or cutoff>='10000-01-01'::timestamptz or otherwise_eligible is null then raise exception 'INVALID_SKIP_DECISION' using errcode='22023';end if;
  select max(s.accepted_at) into latest from private.contextual_skip_commands s
    where s.profile_id=profile and s.item_id=item and s.kind='CONTEXTUAL_SKIP' and s.erased_at is null and s.accepted_at<=cutoff
    and not exists(select 1 from private.contextual_skip_commands w where w.reverses_action_id=s.action_id and w.erased_at is null and w.accepted_at<=cutoff);
  select coalesce(jsonb_agg(s.action_id order by s.action_id),'[]'::jsonb) into sources from private.contextual_skip_commands s
    where s.profile_id=profile and s.item_id=item and s.kind='CONTEXTUAL_SKIP' and s.erased_at is null and s.accepted_at=latest
    and not exists(select 1 from private.contextual_skip_commands w where w.reverses_action_id=s.action_id and w.erased_at is null and w.accepted_at<=cutoff);
  deadline:=latest+interval '24 hours';
  return jsonb_build_object('version','contextual-skip-cooldown-v1','contextChangePolicy','NO_TRUSTED_CONTEXT_CHANGE_V1',
    'eligible',otherwise_eligible and (latest is null or cutoff>=deadline),
    'reason',case when not otherwise_eligible then 'OTHER_POLICY_SUPPRESSED' when latest is null then 'NO_ACTIVE_SKIP'
      when cutoff<deadline then 'SKIP_COOLDOWN' else 'SKIP_COOLDOWN_ELAPSED' end,
    'sourceIds',sources,'reconsiderAt',case when deadline is null then null else (extract(epoch from deadline)*1000000)::numeric(18,0)::text end);
end;
$$;

create function private.discovery_contextual_skip_source_v1(command jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare r private.prediction_runs%rowtype;p private.prediction_page_receipts%rowtype;e public.events%rowtype;
  profile uuid:=(command->>'profileId')::uuid;actor uuid:=(command->>'actorUserId')::uuid;item uuid:=(command->>'itemId')::uuid;
  committed timestamptz;open boolean;source_xid text;
begin
  select * into r from private.prediction_runs x where x.id=(command#>>'{origin,predictionId}')::uuid;
  select * into p from private.prediction_page_receipts x where x.request_id=(command#>>'{origin,deliveryRequestId}')::uuid;
  select x.* into e from public.events x where x.id=(command#>>'{origin,impressionEventId}')::uuid;
  -- Resolve the actual committed page and impression; evaluation-only panels have neither.
  if r.id is null or p.request_id is null or e.id is null
    or r.actor_user_id<>actor or r.profile_id<>profile or r.session_id is distinct from (command#>>'{origin,sessionId}')::uuid
    or p.actor_user_id<>actor or p.profile_id<>profile or p.prediction_id<>r.id
    or p.response->>'predictionId'<>r.id::text or p.response->>'sessionId'<>r.session_id::text
    or not exists(select 1 from jsonb_array_elements(p.response->'items') i where coalesce(i->>'item_id',i->>'itemId',i->>'id')=item::text)
    or not exists(select 1 from private.prediction_candidates c where c.prediction_id=r.id and c.item_id=item and c.selected_for_delivery)
    or e.event_type<>'ITEM_IMPRESSION' or e.actor_user_id<>actor or e.profile_id<>profile or e.item_id is distinct from item
    or e.prediction_id is distinct from r.id or e.session_id is distinct from r.session_id or e.discovery_mode is distinct from r.discovery_mode
    or e.occurred_at<r.requested_at
    or not exists(select 1 from public.items i where i.id=item and i.discoverable) then
    raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;
  committed:=greatest(r.requested_at,p.created_at,e.created_at);
  -- MVCC hides other uncommitted writers. The wrap-aware top-XID boundary also
  -- rejects own subtransactions (including released SAVEPOINTs), whose xmin is
  -- newer than the top xid; timestamps alone are not commitment evidence.
  if committed>=clock_timestamp() or exists(select 1 from public.events x where x.id=e.id and pg_catalog.age(x.xmin)<=pg_catalog.age(pg_catalog.pg_current_xact_id()::xid))
    or exists(select 1 from private.prediction_page_receipts x where x.request_id=p.request_id and pg_catalog.age(x.xmin)<=pg_catalog.age(pg_catalog.pg_current_xact_id()::xid)) then
    raise exception 'SOURCE_NOT_COMMITTED' using errcode='40001';end if;
  open:=not exists(select 1 from public.item_interactions s where s.profile_id=profile and s.item_id=item
      and (s.rating is not null or s.consumed or s.not_interested or s.saved or s.interest is not null))
    and not exists(select 1 from public.item_list_entries le join public.item_lists l on l.id=le.list_id where l.profile_id=profile and le.item_id=item)
    and not exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=item and b.active)
    and not exists(select 1 from public.events positive where positive.profile_id=profile and positive.item_id=item
      and positive.created_at>=r.requested_at
      and positive.event_type in('ITEM_RATED','ITEM_SAVED','ITEM_ADDED_TO_LIST','ITEM_ENDORSED','ITEM_NOT_INTERESTED','ITEM_CONSUMED'))
    and not exists(select 1 from private.item_action_receipts receipt where receipt.profile_id=profile and receipt.item_id=item
      and receipt.created_at>=r.requested_at and (receipt.command->>'kind' in('SET_RATING','ENDORSE_SHARED_ITEM')
        or (receipt.command->>'kind'='SET_LIST_ENTRY' and receipt.command->'present'='true'::jsonb)))
    and not exists(select 1 from public.shared_item_list_proposals proposal where proposal.profile_id=profile and proposal.item_id=item)
    and not exists(select 1 from public.shared_item_endorsements s where s.profile_id=profile and s.item_id=item and s.actor_user_id=actor);
  return jsonb_build_object('version','kajo-contextual-skip-v1','policyVersion','contextual-skip-cooldown-v1',
    'contextChangePolicy','NO_TRUSTED_CONTEXT_CHANGE_V1','actorUserId',actor,'profileId',profile,'itemId',item,
    'origin',command->'origin','contextRef',null,'acceptsNewSkip',open);
end;
$$;

create function private.commit_discovery_contextual_skip_v1(command jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
#variable_conflict use_variable
declare prior private.contextual_skip_commands%rowtype;target private.contextual_skip_commands%rowtype;
  source jsonb;response jsonb;at_time timestamptz;origin_fingerprint text;event_kind text;run private.prediction_runs%rowtype;
begin
  perform private.validate_contextual_skip_command_v1(command,'DISCOVERY');
  perform private.lock_contextual_skip_scope_v1(command);
  origin_fingerprint:=private.contextual_skip_origin_hash_v1(command);
  select * into prior from private.contextual_skip_commands c where c.action_id=(command->>'actionId')::uuid;
  if prior.action_id is not null and (prior.actor_user_id<>(command->>'actorUserId')::uuid or prior.profile_id<>(command->>'profileId')::uuid) then
    raise exception 'IDENTITY_CONFLICT' using errcode='22023';end if;
  if prior.action_id is not null and prior.erased_at is not null then raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;
  source:=private.discovery_contextual_skip_source_v1(command);
  if prior.action_id is not null then
    if prior.command is distinct from command then raise exception 'IDENTITY_CONFLICT' using errcode='22023';end if;
    return prior.result;
  end if;
  if exists(select 1 from public.events e where e.id=(command->>'actionId')::uuid) then raise exception 'IDENTITY_CONFLICT' using errcode='22023';end if;
  at_time:=greatest(clock_timestamp(),(select max(c.accepted_at)+interval '1 microsecond' from private.contextual_skip_commands c where c.profile_id=(command->>'profileId')::uuid));
  if (command->>'occurredAt')::numeric>extract(epoch from at_time)*1000000+300000000 then raise exception 'INVALID_COMMAND' using errcode='22023';end if;
  if command->>'kind'='CONTEXTUAL_SKIP' then
    select * into target from private.contextual_skip_commands c where c.actor_user_id=(command->>'actorUserId')::uuid
      and c.profile_id=(command->>'profileId')::uuid and c.origin_hash=origin_fingerprint and c.kind='CONTEXTUAL_SKIP';
    if target.action_id is not null then
      if target.erased_at is not null then raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;
      raise exception 'ORIGIN_CONFLICT' using errcode='22023';end if;
    if (source->>'acceptsNewSkip')::boolean is not true then raise exception 'SOURCE_CLOSED' using errcode='KJ002';end if;
  else
    select * into target from private.contextual_skip_commands c where c.action_id=(command->>'reversesActionId')::uuid;
    if target.action_id is null or target.erased_at is not null or target.kind<>'CONTEXTUAL_SKIP'
      or target.actor_user_id<>(command->>'actorUserId')::uuid or target.profile_id<>(command->>'profileId')::uuid
      or target.item_id<>(command->>'itemId')::uuid or target.origin is distinct from command->'origin'
      or exists(select 1 from private.contextual_skip_commands c where c.reverses_action_id=target.action_id) then
      raise exception 'WITHDRAWAL_CONFLICT' using errcode='KJ003';end if;
  end if;
  response:=private.contextual_skip_receipt_v1(command,at_time);
  insert into private.contextual_skip_commands(action_id,actor_user_id,profile_id,item_id,surface,kind,origin_hash,origin,command,result,accepted_at,reverses_action_id,source_prediction_id,source_impression_id)
    values((command->>'actionId')::uuid,(command->>'actorUserId')::uuid,(command->>'profileId')::uuid,(command->>'itemId')::uuid,
      'DISCOVERY',command->>'kind',origin_fingerprint,command->'origin',command,response,at_time,(command->>'reversesActionId')::uuid,
      (command#>>'{origin,predictionId}')::uuid,(command#>>'{origin,impressionEventId}')::uuid);
  select * into strict run from private.prediction_runs r where r.id=(command#>>'{origin,predictionId}')::uuid;
  event_kind:=case command->>'kind' when 'CONTEXTUAL_SKIP' then 'ITEM_CONTEXTUALLY_SKIPPED' else 'ITEM_CONTEXTUAL_SKIP_WITHDRAWN' end;
  insert into private.contextual_skip_event_permissions(backend_pid,transaction_id,action_id)
    values(pg_backend_pid(),txid_current(),(command->>'actionId')::uuid);
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode,context,properties,created_at)
    select (command->>'actionId')::uuid,(command->>'actorUserId')::uuid,(command->>'profileId')::uuid,i.id,i.item_type,event_kind,
      private.contextual_skip_instant_v1(command->>'occurredAt'),run.session_id,run.id,run.discovery_mode,
      run.context,jsonb_build_object('version','kajo-contextual-skip-v1','actionId',command->'actionId','origin',command->'origin',
        'reversesActionId',command->'reversesActionId','contextRef',null),at_time
    from public.items i where i.id=(command->>'itemId')::uuid;
  delete from private.contextual_skip_event_permissions p where p.backend_pid=pg_backend_pid()
    and p.transaction_id=txid_current() and p.action_id=(command->>'actionId')::uuid;
  return response;
end;
$$;
create function public.commit_discovery_contextual_skip_v1(command jsonb)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.commit_discovery_contextual_skip_v1(command)$$;
create function private.read_discovery_contextual_skip_source_v1(request jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare command jsonb;
begin
  if jsonb_typeof(request) is distinct from 'object' or not(request ?& array['actorUserId','profileId','itemId','origin'])
    or exists(select 1 from jsonb_object_keys(request) k where k not in('actorUserId','profileId','itemId','origin')) then
    raise exception 'INVALID_COMMAND' using errcode='22023';end if;
  command:=request||jsonb_build_object('version','kajo-contextual-skip-v1','kind','CONTEXTUAL_SKIP','actionId',gen_random_uuid(),
    'occurredAt','0','contextRef',null,'reversesActionId',null);
  perform private.validate_contextual_skip_command_v1(command,'DISCOVERY');perform private.lock_contextual_skip_scope_v1(command);
  return private.discovery_contextual_skip_source_v1(command);
end;
$$;
create function public.discovery_contextual_skip_source_v1(request jsonb)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.read_discovery_contextual_skip_source_v1(request)$$;

-- Admission requires the exact trusted command row even for BYPASSRLS callers.
create function private.guard_contextual_skip_event_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare c private.contextual_skip_commands%rowtype;
begin
  if tg_op='UPDATE' and (old.event_type in('ITEM_CONTEXTUALLY_SKIPPED','ITEM_CONTEXTUAL_SKIP_WITHDRAWN')
    or new.event_type in('ITEM_CONTEXTUALLY_SKIPPED','ITEM_CONTEXTUAL_SKIP_WITHDRAWN')) then
    raise exception 'Contextual skip Event is immutable' using errcode='42501';end if;
  if new.event_type not in('ITEM_CONTEXTUALLY_SKIPPED','ITEM_CONTEXTUAL_SKIP_WITHDRAWN') then return new;end if;
  select * into c from private.contextual_skip_commands s where s.action_id=new.id;
  if c.action_id is null or c.erased_at is not null or c.surface<>'DISCOVERY'
    or c.actor_user_id<>new.actor_user_id or c.profile_id<>new.profile_id or c.item_id is distinct from new.item_id
    or c.source_prediction_id is distinct from new.prediction_id
    or c.origin->>'sessionId' is distinct from new.session_id::text
    or c.accepted_at is distinct from new.created_at
    or new.occurred_at is distinct from private.contextual_skip_instant_v1(c.command->>'occurredAt')
    or not exists(select 1 from private.contextual_skip_event_permissions permission where permission.action_id=new.id
      and permission.backend_pid=pg_backend_pid() and permission.transaction_id=txid_current())
    or not exists(select 1 from public.items i where i.id=c.item_id and i.item_type=new.item_type)
    or not exists(select 1 from private.prediction_runs r where r.id=c.source_prediction_id
      and r.context=new.context and r.discovery_mode=new.discovery_mode)
    or new.event_type is distinct from (case c.kind when 'CONTEXTUAL_SKIP' then 'ITEM_CONTEXTUALLY_SKIPPED' else 'ITEM_CONTEXTUAL_SKIP_WITHDRAWN' end)
    or new.properties is distinct from jsonb_build_object('version','kajo-contextual-skip-v1','actionId',c.command->'actionId','origin',c.origin,
      'reversesActionId',c.command->'reversesActionId','contextRef',null) then
    raise exception 'Contextual skip Event requires canonical command' using errcode='42501';end if;
  return new;
end;
$$;
create trigger contextual_skip_event_admission before insert or update on public.events
for each row execute function private.guard_contextual_skip_event_v1();
create policy contextual_skip_command_only on public.events as restrictive for insert to authenticated
with check(event_type not in('ITEM_CONTEXTUALLY_SKIPPED','ITEM_CONTEXTUAL_SKIP_WITHDRAWN'));

create function private.erase_contextual_skip_commands_v1(action_ids uuid[],excluded_event uuid default null,erase_dependents boolean default true)
returns void language plpgsql volatile security definer set search_path='' as $$
declare ids uuid[];
begin
  select coalesce(array_agg(c.action_id),'{}'::uuid[]) into ids from private.contextual_skip_commands c
    where c.erased_at is null and exists(select 1 from private.contextual_skip_commands root where root.action_id=any(action_ids)
      and root.actor_user_id=c.actor_user_id and root.profile_id=c.profile_id and root.origin_hash=c.origin_hash);
  if erase_dependents and cardinality(ids)>0 then perform private.erase_contextual_skip_prediction_dependencies_v1(ids);end if;
  update private.contextual_skip_commands c set erased_at=clock_timestamp(),item_id=null,origin=null,command=null,result=null,
    reverses_action_id=null,source_prediction_id=null,source_impression_id=null where c.action_id=any(ids);
  delete from public.events e where e.id=any(ids) and e.id is distinct from excluded_event
    and exists(select 1 from public.users u where u.id=e.actor_user_id)
    and exists(select 1 from public.profiles p where p.id=e.profile_id)
    and e.event_type in('ITEM_CONTEXTUALLY_SKIPPED','ITEM_CONTEXTUAL_SKIP_WITHDRAWN');
end;
$$;
create function private.withdraw_contextual_skip_source_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
  if tg_table_name='prediction_runs' then
    select coalesce(array_agg(c.action_id),'{}'::uuid[]) into ids from private.contextual_skip_commands c
      where c.erased_at is null and c.source_prediction_id=old.id;
  elsif tg_table_name='prediction_page_receipts' then
    select coalesce(array_agg(c.action_id),'{}'::uuid[]) into ids from private.contextual_skip_commands c
      where c.erased_at is null and c.origin->>'deliveryRequestId'=old.request_id::text;
  else
    select coalesce(array_agg(c.action_id),'{}'::uuid[]) into ids from private.contextual_skip_commands c
      where c.erased_at is null and (c.source_impression_id=old.id or c.action_id=old.id);
  end if;
  if tg_table_name='events' then perform private.erase_contextual_skip_commands_v1(ids,old.id);
  elsif tg_table_name='prediction_runs' then perform private.erase_contextual_skip_commands_v1(ids,null,false);
  else perform private.erase_contextual_skip_commands_v1(ids);end if;
  return old;
end;
$$;
create trigger contextual_skip_prediction_source before delete on private.prediction_runs
for each row execute function private.withdraw_contextual_skip_source_v1();
create trigger contextual_skip_page_source before delete on private.prediction_page_receipts
for each row execute function private.withdraw_contextual_skip_source_v1();
create trigger contextual_skip_event_source before delete on public.events
for each row execute function private.withdraw_contextual_skip_source_v1();

create function private.withdraw_contextual_skip_item_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
  select coalesce(array_agg(c.action_id),'{}'::uuid[]) into ids from private.contextual_skip_commands c where c.item_id=old.id and c.erased_at is null;
  perform private.erase_contextual_skip_commands_v1(ids);
  return old;
end;
$$;
create trigger contextual_skip_item_source before delete on public.items
for each row execute function private.withdraw_contextual_skip_item_v1();

-- Deletion acquires lifecycle serialization before the executor takes source row locks.
create function private.lock_contextual_skip_source_erasure_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(1946841873,232004);
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'READ_COMMITTED_REQUIRED' using errcode='25001';end if;
  return null;
end;
$$;
create trigger contextual_skip_event_erasure_lock before delete on public.events
for each statement execute function private.lock_contextual_skip_source_erasure_v1();
create trigger contextual_skip_item_erasure_lock before delete on public.items
for each statement execute function private.lock_contextual_skip_source_erasure_v1();
create trigger contextual_skip_prediction_erasure_lock before delete on private.prediction_runs
for each statement execute function private.lock_contextual_skip_source_erasure_v1();
create trigger contextual_skip_page_erasure_lock before delete on private.prediction_page_receipts
for each statement execute function private.lock_contextual_skip_source_erasure_v1();

-- Extend only the admitted enum, guarding its exact old list.
do $event_constraint$
declare definition text;
begin
  select pg_get_constraintdef(oid) into strict definition from pg_constraint
    where conrelid='public.events'::regclass and conname='events_event_type_valid';
  if md5(definition)<>'7a342882d6963106ed258cfa72ab4690' then
    raise exception 'Contextual skip Event constraint drift' using errcode='55000';end if;
  definition:=replace(definition,'''ITEM_HISTORY_CLEARED''::text',
    '''ITEM_HISTORY_CLEARED''::text, ''ITEM_CONTEXTUALLY_SKIPPED''::text, ''ITEM_CONTEXTUAL_SKIP_WITHDRAWN''::text');
  alter table public.events drop constraint events_event_type_valid;
  execute 'alter table public.events add constraint events_event_type_valid '||definition;
end;
$event_constraint$;

-- Keep neutral commands outside all Working budgets; source cleanup cannot erase unrelated Taste panels.
do $neutral_consumers$
declare patch jsonb;body text;definition text;
begin
  for patch in select value from jsonb_array_elements($neutral_patches$[{"signature":"private.capture_personal_working_state_v1(uuid,uuid,uuid,timestamp with time zone)","sourceMd5":"53a43db778c605b09403821b989e975e","before":"    where e.actor_user_id=actor and e.profile_id=profile and e.item_id is not null\n","after":"    where e.actor_user_id=actor and e.profile_id=profile and e.item_id is not null\n      and e.event_type not in('ITEM_CONTEXTUALLY_SKIPPED','ITEM_CONTEXTUAL_SKIP_WITHDRAWN')\n","count":2},{"signature":"private.withdraw_sequential_event_v2()","sourceMd5":"5704630e0c5dcc068460659f21162c5f","before":"begin\n  profile:=case","after":"begin\n  if tg_op='DELETE' and old.event_type in('ITEM_CONTEXTUALLY_SKIPPED','ITEM_CONTEXTUAL_SKIP_WITHDRAWN') then return old;end if;\n  profile:=case","count":1}]$neutral_patches$::jsonb) loop
    select prosrc,pg_get_functiondef(oid) into strict body,definition from pg_proc where oid=(patch->>'signature')::regprocedure;
    if md5(body)<>patch->>'sourceMd5' or (length(body)-length(replace(body,patch->>'before','')))/length(patch->>'before')<>(patch->>'count')::integer then
      raise exception 'Contextual skip consumer source drift: %',patch->>'signature' using errcode='55000';end if;
    definition:=replace(definition,body,replace(body,patch->>'before',patch->>'after'));execute definition;
  end loop;
end;
$neutral_consumers$;

-- Preserve the independent historical resurfacing policy as a denied component.
-- Every existing serving admission/page/refill/exhaustion caller reaches the composite.
do $eligibility_component$
declare body text;definition text;
begin
  select prosrc,pg_get_functiondef(oid) into strict body,definition from pg_proc
    where oid='private.resurfacing_policy_decision_v1(uuid,uuid,jsonb,timestamptz)'::regprocedure;
  if md5(body)<>'f1bbd5d425a9d9a2aed1e8d2bf967cfc' then raise exception 'Contextual skip eligibility source drift' using errcode='55000';end if;
  definition:=replace(definition,'FUNCTION private.resurfacing_policy_decision_v1(','FUNCTION private.resurfacing_before_contextual_skip_v1(');
  execute definition;
end;
$eligibility_component$;
create or replace function private.resurfacing_policy_decision_v1(target_profile_id uuid,target_item_id uuid,candidate_explanation jsonb,decision_time timestamptz)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare original jsonb;skip jsonb;
begin
  original:=private.resurfacing_before_contextual_skip_v1(target_profile_id,target_item_id,candidate_explanation,decision_time);
  skip:=private.contextual_skip_decision_v1(target_profile_id,target_item_id,decision_time,(original->>'eligible')::boolean);
  if skip->'sourceIds'='[]'::jsonb then return original;end if;
  original:=original||jsonb_build_object('contextualSkip',skip);
  if skip->>'reason'='SKIP_COOLDOWN' then
    original:=original||jsonb_build_object('eligible',false,'classification','CONTEXTUAL_SKIP_SUPPRESSED','reason','SKIP_COOLDOWN');
  end if;
  return original;
end;
$$;

revoke all on function private.validate_contextual_skip_command_v1(jsonb,text),private.lock_contextual_skip_scope_v1(jsonb),
  private.contextual_skip_instant_v1(text),private.contextual_skip_origin_hash_v1(jsonb),private.contextual_skip_receipt_v1(jsonb,timestamptz),
  private.contextual_skip_decision_v1(uuid,uuid,timestamptz,boolean),private.discovery_contextual_skip_source_v1(jsonb),
  private.commit_discovery_contextual_skip_v1(jsonb),private.read_discovery_contextual_skip_source_v1(jsonb),
  private.lock_contextual_skip_source_erasure_v1(),private.withdraw_contextual_skip_item_v1(),private.guard_contextual_skip_event_v1(),private.erase_contextual_skip_commands_v1(uuid[],uuid,boolean),private.withdraw_contextual_skip_source_v1(),
  private.resurfacing_before_contextual_skip_v1(uuid,uuid,jsonb,timestamptz),
  public.commit_discovery_contextual_skip_v1(jsonb),public.discovery_contextual_skip_source_v1(jsonb)
from public,anon,authenticated,service_role;
grant execute on function private.commit_discovery_contextual_skip_v1(jsonb),private.read_discovery_contextual_skip_source_v1(jsonb),
  public.commit_discovery_contextual_skip_v1(jsonb),public.discovery_contextual_skip_source_v1(jsonb) to authenticated;

-- Suppression can exclude an Item before a retained candidate is persisted.
-- Record the exact latest surviving source set at each new run's trusted cutoff,
-- including expired sources whose elapsed decision may be copied. This is
-- conservative across Items within the same Profile, never across Profiles or
-- earlier cutoffs. Existing runs predate these sources and need no backfill.
create table private.prediction_contextual_skip_sources (
  prediction_id uuid not null references private.prediction_runs(id) on delete cascade,
  action_id uuid not null references private.contextual_skip_commands(action_id) on delete cascade,
  primary key(prediction_id,action_id)
);
create index prediction_contextual_skip_sources_action on private.prediction_contextual_skip_sources(action_id,prediction_id);
alter table private.prediction_contextual_skip_sources enable row level security;
revoke all on private.prediction_contextual_skip_sources from public,anon,authenticated,service_role;

create function private.capture_contextual_skip_prediction_sources_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  with active as materialized (
    select c.action_id,c.item_id,c.accepted_at from private.contextual_skip_commands c
      where c.profile_id=new.profile_id and c.kind='CONTEXTUAL_SKIP' and c.erased_at is null
        and c.accepted_at<=new.requested_at
        and not exists(select 1 from private.contextual_skip_commands w
          where w.reverses_action_id=c.action_id and w.erased_at is null and w.accepted_at<=new.requested_at)
  ), limiting as (
    select item_id,max(accepted_at) accepted_at from active group by item_id
  ) insert into private.prediction_contextual_skip_sources(prediction_id,action_id)
    select new.id,a.action_id from active a join limiting l using(item_id,accepted_at);
  return new;
end;
$$;
create trigger capture_contextual_skip_prediction_sources after insert on private.prediction_runs
for each row execute function private.capture_contextual_skip_prediction_sources_v1();

-- Event/panel/receipt withdrawal erases dependent run closures while their exact
-- source edges still exist. Prediction DELETE itself passes erase_dependents=false
-- to the command eraser: the outer canonical eraser already acquired the complete
-- closure and its immutable-artifact permissions must not be reset recursively.
create function private.erase_contextual_skip_prediction_dependencies_v1(ids uuid[])
returns void language plpgsql volatile security invoker set search_path='' as $$
declare dependent uuid;
begin
  if coalesce(cardinality(ids),0)=0 then return;end if;
  perform pg_advisory_xact_lock(1946841873,232004);
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Contextual skip source erasure requires READ COMMITTED' using errcode='25001';end if;
  for dependent in
    select dependencies.prediction_id from (
      select s.prediction_id from private.prediction_contextual_skip_sources s where s.action_id=any(ids)
      union
      select c.prediction_id from private.prediction_candidates c
        where (c.explanation#>'{resurfacingInput,contextualSkip,sourceIds}') ?| ids::text[]
          or (c.explanation#>'{resurfacingPolicy,contextualSkip,sourceIds}') ?| ids::text[]
    ) dependencies
    where not exists(select 1 from private.contextual_skip_commands origin
      where origin.action_id=any(ids) and origin.source_prediction_id=dependencies.prediction_id)
    order by dependencies.prediction_id
  loop
    -- An earlier closure in this loop can already have removed this run.
    if exists(select 1 from private.prediction_runs r where r.id=dependent) then
      perform private.erase_prediction_sources_v1('PREDICTION_RUN',dependent);
    end if;
  end loop;
end;
$$;
revoke all on function private.capture_contextual_skip_prediction_sources_v1(),
  private.erase_contextual_skip_prediction_dependencies_v1(uuid[]) from public,anon,authenticated,service_role;

-- Preserve the canonical eraser's checks, row/permission order, owner, ACL and
-- function identity; add only the new backwards-only source edges to its closure.
do $contextual_skip_erasure_lineage$
declare body text;definition text;before_metadata jsonb;after_metadata jsonb;oid_before oid;
  anchor text:=$before$      select p.prediction_id from private.prediction_catalog_chain_pages p
        where p.root_prediction_id=parent.id or p.parent_prediction_id=parent.id
$before$;
  replacement text:=$after$      select p.prediction_id from private.prediction_catalog_chain_pages p
        where p.root_prediction_id=parent.id or p.parent_prediction_id=parent.id
      union
      select dependency.prediction_id from private.contextual_skip_commands source
        join private.prediction_contextual_skip_sources dependency on dependency.action_id=source.action_id
        where source.source_prediction_id=parent.id and source.erased_at is null
      union
      select candidate.prediction_id from private.contextual_skip_commands source
        join private.prediction_candidates candidate on
          (candidate.explanation#>'{resurfacingInput,contextualSkip,sourceIds}') ? source.action_id::text
          or (candidate.explanation#>'{resurfacingPolicy,contextualSkip,sourceIds}') ? source.action_id::text
        where source.source_prediction_id=parent.id and source.erased_at is null
$after$;
begin
  select p.oid,p.prosrc,pg_get_functiondef(p.oid),to_jsonb(p)-'prosrc'
    into strict oid_before,body,definition,before_metadata from pg_proc p
    where p.oid='private.erase_prediction_sources_v1(text,uuid)'::regprocedure;
  if md5(body)<>'def659714a1d900629945d9b1b61f3fa' then
    raise exception 'Contextual skip erasure source drift' using errcode='55000';end if;
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then
    raise exception 'Contextual skip erasure closure anchor drift' using errcode='55000';end if;
  if position(body in definition)=0 then
    raise exception 'Contextual skip erasure definition drift' using errcode='55000';end if;
  execute replace(definition,body,replace(body,anchor,replacement));
  select to_jsonb(p)-'prosrc' into strict after_metadata from pg_proc p where p.oid=oid_before;
  if after_metadata is distinct from before_metadata then
    raise exception 'Contextual skip erasure metadata drift' using errcode='55000';end if;
end;
$contextual_skip_erasure_lineage$;
