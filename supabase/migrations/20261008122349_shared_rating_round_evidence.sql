-- #232A: opt-in Shared experience evidence only. Existing Events, interactions,
-- action receipts, ranking and rewards are deliberately not changed or inferred.
create table private.shared_round_membership_generations (
  profile_id uuid not null,
  user_id uuid not null,
  generation_id uuid not null default gen_random_uuid() unique,
  primary key(profile_id,user_id),
  foreign key(profile_id,user_id) references public.profile_members(profile_id,user_id)
    on delete cascade on update cascade
);

insert into private.shared_round_membership_generations(profile_id,user_id)
  select profile_id,user_id from public.profile_members;

create function private.refresh_shared_round_membership_generation_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and old.profile_id=new.profile_id and old.user_id=new.user_id then
    return new;
  end if;
  insert into private.shared_round_membership_generations(profile_id,user_id)
    values(new.profile_id,new.user_id)
    on conflict(profile_id,user_id) do update set generation_id=gen_random_uuid();
  return new;
end;
$$;

create trigger shared_round_membership_generation_v1
  after insert or update of profile_id,user_id on public.profile_members
  for each row execute function private.refresh_shared_round_membership_generation_v1();

create table private.shared_rating_rounds (
  id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  experience_id uuid not null,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  revision integer not null check(revision between 1 and 4096),
  participant_set_version integer not null check(participant_set_version between 1 and 4096),
  participants jsonb not null check(jsonb_typeof(participants)='array'
    and jsonb_array_length(participants) between 2 and 32),
  current_state text not null check(current_state in ('PENDING','COMPLETED','CANCELLED')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(profile_id,experience_id)
);

create index shared_rating_rounds_active_profile_idx
  on private.shared_rating_rounds(profile_id) where current_state<>'CANCELLED';
create index shared_rating_rounds_creator_idx on private.shared_rating_rounds(created_by_user_id);
create index shared_rating_rounds_item_idx on private.shared_rating_rounds(item_id);
create index shared_rating_rounds_participants_idx
  on private.shared_rating_rounds using gin(participants jsonb_path_ops);

create table private.shared_rating_round_responses (
  round_id uuid not null references private.shared_rating_rounds(id) on delete cascade,
  revision integer not null check(revision between 2 and 4096),
  participant_set_version integer not null check(participant_set_version between 1 and 4096),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  status text not null check(status in ('RATED','UNKNOWN','CLEARED')),
  rating integer,
  origin jsonb check(origin is null or jsonb_typeof(origin)='object'),
  received_at timestamptz not null,
  primary key(round_id,revision),
  check((status='RATED' and rating is not null and rating between 0 and 10)
    or (status<>'RATED' and rating is null))
);
create index shared_rating_round_responses_latest_idx
  on private.shared_rating_round_responses(round_id,participant_set_version,actor_user_id,revision desc);
create index shared_rating_round_responses_actor_idx on private.shared_rating_round_responses(actor_user_id);

create table private.shared_rating_round_receipts (
  command_id uuid primary key,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  round_id uuid not null references private.shared_rating_rounds(id) on delete cascade,
  command jsonb not null check(jsonb_typeof(command)='object' and octet_length(command::text)<=4096),
  result jsonb not null check(jsonb_typeof(result)='object'),
  created_at timestamptz not null
);
create index shared_rating_round_receipts_actor_idx on private.shared_rating_round_receipts(actor_user_id);
create index shared_rating_round_receipts_profile_idx on private.shared_rating_round_receipts(profile_id);
create index shared_rating_round_receipts_round_idx on private.shared_rating_round_receipts(round_id);
create index shared_rating_round_receipts_participants_idx
  on private.shared_rating_round_receipts using gin((result#>'{round,participants}') jsonb_path_ops);

-- Account deletion removes this whole new lineage even when a prior participant
-- has left and a later participant set no longer contains them. Membership leave
-- alone does not erase historical answers or silently complete a round.
create function private.delete_user_shared_round_evidence_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from private.shared_rating_rounds where id in (
    select r.id from private.shared_rating_rounds r
      where r.participants @> jsonb_build_array(jsonb_build_object('actorUserId',old.id))
    union select a.round_id from private.shared_rating_round_responses a where a.actor_user_id=old.id
    union select c.round_id from private.shared_rating_round_receipts c
      where c.result#>'{round,participants}' @> jsonb_build_array(jsonb_build_object('actorUserId',old.id))
  );
  return old;
end;
$$;
create trigger delete_user_shared_round_evidence_v1 before delete on public.users
  for each row execute function private.delete_user_shared_round_evidence_v1();

create function private.deny_shared_round_evidence_update_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Shared round evidence is immutable' using errcode='55000';
end;
$$;
create trigger shared_round_response_immutable_v1 before update
  on private.shared_rating_round_responses for each row
  execute function private.deny_shared_round_evidence_update_v1();
create trigger shared_round_receipt_immutable_v1 before update
  on private.shared_rating_round_receipts for each row
  execute function private.deny_shared_round_evidence_update_v1();

alter table private.shared_round_membership_generations enable row level security;
alter table private.shared_rating_rounds enable row level security;
alter table private.shared_rating_round_responses enable row level security;
alter table private.shared_rating_round_receipts enable row level security;
revoke all on table private.shared_round_membership_generations,
  private.shared_rating_rounds,private.shared_rating_round_responses,
  private.shared_rating_round_receipts from public,anon,authenticated,service_role;

-- Profile first, current actor next, then supported membership rows in UUID
-- order with one overflow sentinel. The existing leave path uses the same Profile
-- lock; FK insertion and direct deletion also block. Oversized groups can still
-- read/cancel/replay, while OPEN/RECONFIRM reject an incomplete participant set.
-- Every receipt retry must pass current authorization under these locks.
create function private.lock_shared_round_members_v1(target_profile_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  actor uuid := (select auth.uid());
  member record;
  generation uuid;
  members jsonb := '[]';
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=target_profile_id and profile_type='SHARED' for update;
  if not found then raise exception 'Shared Profile access denied' using errcode='42501'; end if;
  perform 1 from public.profile_members where profile_id=target_profile_id and user_id=actor for update;
  if not found then raise exception 'Shared Profile access denied' using errcode='42501'; end if;
  for member in select user_id from public.profile_members where profile_id=target_profile_id
    order by user_id limit 33 for update loop
    select generation_id into generation from private.shared_round_membership_generations
      where profile_id=target_profile_id and user_id=member.user_id;
    if not found then raise exception 'Shared membership generation unavailable' using errcode='55000'; end if;
    members := members||jsonb_build_array(jsonb_build_object('actorUserId',member.user_id,'membershipGeneration',generation));
  end loop;
  return members;
end;
$$;

create function private.shared_rating_round_snapshot_v1(target_round_id uuid,current_members jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object('version',1,'roundId',r.id,'experienceId',r.experience_id,
    'profileId',r.profile_id,'itemId',r.item_id,'revision',r.revision,
    'participantSetVersion',r.participant_set_version,'participants',r.participants,
    'state',case when r.current_state='CANCELLED' then 'CANCELLED'
      when r.participants is distinct from current_members then 'RECONFIRMATION_REQUIRED' else r.current_state end,
    'responses',coalesce((select jsonb_agg(jsonb_build_object('actorUserId',p.value->'actorUserId',
      'status',coalesce(answer.status,'UNANSWERED'),'rating',answer.rating,
      'responseRevision',answer.revision,'receivedAt',answer.received_at,'origin',answer.origin)
      order by p.value->>'actorUserId')
      from jsonb_array_elements(r.participants) p
      left join lateral(select a.* from private.shared_rating_round_responses a
        where a.round_id=r.id and a.participant_set_version=r.participant_set_version
          and a.actor_user_id=(p.value->>'actorUserId')::uuid order by a.revision desc limit 1) answer on true),'[]'::jsonb),
    'createdAt',r.created_at,'updatedAt',r.updated_at,'groupReward',null,'learnable',false)
  from private.shared_rating_rounds r where r.id=target_round_id;
$$;

create function private.get_shared_rating_round_v1(target_profile_id uuid,target_round_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare members jsonb; result jsonb;
begin
  if target_profile_id is null or target_round_id is null then
    raise exception 'Profile and round are required' using errcode='22023'; end if;
  members := private.lock_shared_round_members_v1(target_profile_id);
  perform 1 from private.shared_rating_rounds where id=target_round_id and profile_id=target_profile_id;
  if not found then raise exception 'Shared round access denied' using errcode='42501'; end if;
  result := private.shared_rating_round_snapshot_v1(target_round_id,members);
  return result;
end;
$$;

create function private.commit_shared_rating_round_v1(request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := (select auth.uid());
  command_uuid uuid; profile_uuid uuid; round_uuid uuid; item_uuid uuid; experience_uuid uuid;
  kind text; key text; expected integer; next_revision integer;
  members jsonb; round_row private.shared_rating_rounds%rowtype;
  prior private.shared_rating_round_receipts%rowtype;
  accepted_at timestamptz; rating_value integer; answer_status text;
  response_origin jsonb; prediction_uuid uuid; origin_session uuid; mode text; validated uuid;
  result jsonb; snapshot jsonb; state text; active_count integer;
  allowed text[]; uuid_fields text[];
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(request) is distinct from 'object' or octet_length(request::text)>4096
    or jsonb_typeof(request->'version') is distinct from 'number' or request->'version'<>'1'::jsonb
    or jsonb_typeof(request->'kind') is distinct from 'string'
    or jsonb_typeof(request->'expectedRevision') is distinct from 'number' then
    raise exception 'Invalid Shared round command' using errcode='22023'; end if;
  kind := request->>'kind';
  if kind not in ('OPEN_ROUND','SET_RESPONSE','CLEAR_RESPONSE','CANCEL_ROUND','RECONFIRM_ROUND')
    or (request->>'expectedRevision')::numeric not between 0 and 4096
    or trunc((request->>'expectedRevision')::numeric)<>(request->>'expectedRevision')::numeric then
    raise exception 'Invalid Shared round command' using errcode='22023'; end if;
  expected := (request->>'expectedRevision')::numeric::integer;
  allowed := array['version','commandId','actorUserId','profileId','roundId','kind','expectedRevision'];
  uuid_fields := array['commandId','actorUserId','profileId','roundId'];
  if kind='OPEN_ROUND' then
    allowed := allowed||array['itemId','experienceId'];
    uuid_fields := uuid_fields||array['itemId','experienceId'];
  elsif kind='SET_RESPONSE' then allowed := allowed||array['rating','origin']; end if;
  if exists(select 1 from jsonb_object_keys(request) k where not k=any(allowed)) then
    raise exception 'Unknown Shared round command field' using errcode='22023'; end if;
  foreach key in array uuid_fields loop
    if jsonb_typeof(request->key) is distinct from 'string' or request->>key !~* uuid_pattern then
      raise exception 'Invalid Shared round identity' using errcode='22023'; end if;
  end loop;
  command_uuid := (request->>'commandId')::uuid;
  profile_uuid := (request->>'profileId')::uuid;
  round_uuid := (request->>'roundId')::uuid;
  if (request->>'actorUserId')::uuid<>actor then
    raise exception 'Shared round actor mismatch' using errcode='42501'; end if;
  if kind='SET_RESPONSE' then
    if not(request ? 'rating') or (request->'rating'<>'null'::jsonb and
      (jsonb_typeof(request->'rating') is distinct from 'number'
        or (request->>'rating')::numeric not between 0 and 10
        or trunc((request->>'rating')::numeric)<>(request->>'rating')::numeric)) then
      raise exception 'Rating must be an integer from 0 to 10 or unknown' using errcode='22023'; end if;
    rating_value := (request->>'rating')::numeric::integer;
    if request ? 'origin' and request->'origin'<>'null'::jsonb then
      if jsonb_typeof(request->'origin') is distinct from 'object'
        or exists(select 1 from jsonb_object_keys(request->'origin') k
          where k not in ('predictionId','sessionId','discoveryMode')) then
        raise exception 'Invalid Shared response origin' using errcode='22023'; end if;
      foreach key in array array['predictionId','sessionId'] loop
        if jsonb_typeof(request->'origin'->key) is distinct from 'string'
          or request->'origin'->>key !~* uuid_pattern then
          raise exception 'Invalid Shared response origin' using errcode='22023'; end if;
      end loop;
      if jsonb_typeof(request->'origin'->'discoveryMode') is distinct from 'string'
        or request#>>'{origin,discoveryMode}' not in ('FOR_YOU','SURPRISE','RISK') then
        raise exception 'Invalid Shared response origin' using errcode='22023'; end if;
      prediction_uuid := (request#>>'{origin,predictionId}')::uuid;
      origin_session := (request#>>'{origin,sessionId}')::uuid;
      mode := request#>>'{origin,discoveryMode}';
    end if;
  end if;

  -- New family-scoped command IDs never claim the legacy Item action namespace.
  perform pg_advisory_xact_lock(hashtextextended('shared-round-command:'||command_uuid::text,0));
  members := private.lock_shared_round_members_v1(profile_uuid);
  select * into prior from private.shared_rating_round_receipts where command_id=command_uuid;
  if found then
    if prior.actor_user_id<>actor or prior.profile_id<>profile_uuid or prior.round_id<>round_uuid
      or prior.command<>request then raise exception 'Shared round command ID payload mismatch' using errcode='22023'; end if;
    return prior.result;
  end if;
  accepted_at := clock_timestamp();
  if kind='OPEN_ROUND' then
    if expected<>0 or jsonb_array_length(members) not between 2 and 32 then
      raise exception 'Round requires revision zero and 2 to 32 accepted participants' using errcode='22023'; end if;
    item_uuid := (request->>'itemId')::uuid;
    experience_uuid := (request->>'experienceId')::uuid;
    perform 1 from public.items where id=item_uuid;
    if not found then raise exception 'Unknown Item' using errcode='22023'; end if;
    if exists(select 1 from private.shared_rating_rounds where id=round_uuid
      or (profile_id=profile_uuid and experience_id=experience_uuid)) then
      raise exception 'Shared round or experience already exists' using errcode='22023'; end if;
    state := 'PENDING'; next_revision := 1;
  else
    select * into round_row from private.shared_rating_rounds where id=round_uuid and profile_id=profile_uuid for update;
    if not found then raise exception 'Shared round access denied' using errcode='42501'; end if;
    if round_row.revision<>expected then raise exception 'Shared round revision conflict' using errcode='22023'; end if;
    if round_row.revision>=4096 then raise exception 'Shared round revision limit reached' using errcode='22023'; end if;
    if round_row.current_state='CANCELLED' then raise exception 'Shared round is cancelled' using errcode='22023'; end if;
    next_revision := expected+1;
    if kind in ('SET_RESPONSE','CLEAR_RESPONSE') then
      if round_row.participants is distinct from members then
        raise exception 'Shared round requires participant reconfirmation' using errcode='22023'; end if;
      if not exists(select 1 from jsonb_array_elements(round_row.participants) p where p->>'actorUserId'=actor::text) then
        raise exception 'Actor is outside the frozen participants' using errcode='42501'; end if;
      if prediction_uuid is not null then
        select r.id into validated from private.prediction_runs r
          join private.prediction_candidates c on c.prediction_id=r.id and c.item_id=round_row.item_id and c.selected_for_delivery
          where r.id=prediction_uuid and r.profile_id=profile_uuid and r.actor_user_id=actor
            and r.session_id=origin_session and r.discovery_mode=mode and r.requested_at<=accepted_at
            and exists(select 1 from public.events e where e.prediction_id=r.id and e.profile_id=profile_uuid
              and e.actor_user_id=actor and e.item_id=round_row.item_id and e.session_id=origin_session
              and e.event_type='ITEM_IMPRESSION' and e.occurred_at between r.requested_at and accepted_at
              and e.created_at<=accepted_at);
        response_origin := jsonb_build_object('status',case when validated is null then 'UNATTRIBUTED' else 'VALIDATED_TRACE' end,
          'predictionId',validated,'claimedPredictionId',prediction_uuid,'sessionId',origin_session,'discoveryMode',mode);
      end if;
      answer_status := case when kind='CLEAR_RESPONSE' then 'CLEARED' when rating_value is null then 'UNKNOWN' else 'RATED' end;
      insert into private.shared_rating_round_responses(round_id,revision,participant_set_version,actor_user_id,status,rating,origin,received_at)
        values(round_uuid,next_revision,round_row.participant_set_version,actor,answer_status,rating_value,response_origin,accepted_at);
      state := case when not exists(select 1 from jsonb_array_elements(round_row.participants) p
        left join lateral(select a.status from private.shared_rating_round_responses a
          where a.round_id=round_uuid and a.participant_set_version=round_row.participant_set_version
            and a.actor_user_id=(p->>'actorUserId')::uuid order by a.revision desc limit 1) latest on true
        where latest.status is distinct from 'RATED') then 'COMPLETED' else 'PENDING' end;
    elsif kind='CANCEL_ROUND' then state := 'CANCELLED';
    else
      if round_row.participants=members then raise exception 'Round participants already current' using errcode='22023'; end if;
      if jsonb_array_length(members) not between 2 and 32 then
        raise exception 'Round requires 2 to 32 accepted participants' using errcode='22023'; end if;
      state := 'PENDING';
    end if;
  end if;
  -- Allocation is bounded; a truthful correction/reconfirmation of an existing
  -- experience must not be rejected merely because other rounds are pending.
  if kind='OPEN_ROUND' then
    select count(*) into active_count from private.shared_rating_rounds r where r.profile_id=profile_uuid and r.id<>round_uuid
      and r.current_state<>'CANCELLED' and (r.current_state='PENDING' or r.participants is distinct from members);
    if active_count>=16 then raise exception 'Too many active Shared rounds' using errcode='22023'; end if;
  end if;
  if kind='OPEN_ROUND' then
    insert into private.shared_rating_rounds(id,profile_id,item_id,experience_id,created_by_user_id,
      revision,participant_set_version,participants,current_state,created_at,updated_at)
      values(round_uuid,profile_uuid,item_uuid,experience_uuid,actor,1,1,members,state,accepted_at,accepted_at);
  else
    update private.shared_rating_rounds set revision=next_revision,current_state=state,updated_at=accepted_at,
      participant_set_version=participant_set_version+case when kind='RECONFIRM_ROUND' then 1 else 0 end,
      participants=case when kind='RECONFIRM_ROUND' then members else participants end where id=round_uuid;
  end if;
  snapshot := private.shared_rating_round_snapshot_v1(round_uuid,members);
  result := jsonb_build_object('version',1,'commandId',command_uuid,'round',snapshot);
  insert into private.shared_rating_round_receipts(command_id,actor_user_id,profile_id,round_id,command,result,created_at)
    values(command_uuid,actor,profile_uuid,round_uuid,request,result,accepted_at);
  return result;
end;
$$;

create function public.commit_shared_rating_round_v1(request jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.commit_shared_rating_round_v1(request);
$$;
create function public.get_shared_rating_round_v1(target_profile_id uuid,target_round_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.get_shared_rating_round_v1(target_profile_id,target_round_id);
$$;

revoke all on function private.refresh_shared_round_membership_generation_v1(),
  private.delete_user_shared_round_evidence_v1(),private.deny_shared_round_evidence_update_v1(),private.lock_shared_round_members_v1(uuid),
  private.shared_rating_round_snapshot_v1(uuid,jsonb),private.commit_shared_rating_round_v1(jsonb),
  private.get_shared_rating_round_v1(uuid,uuid),public.commit_shared_rating_round_v1(jsonb),
  public.get_shared_rating_round_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.commit_shared_rating_round_v1(jsonb),
  private.get_shared_rating_round_v1(uuid,uuid),public.commit_shared_rating_round_v1(jsonb),
  public.get_shared_rating_round_v1(uuid,uuid) to authenticated;
