-- First Phase 14.1 command boundary: rating, not-interest and their undo.
-- Existing List/Endorsement clients retain their separate rollout boundary.
create table private.item_action_receipts (
  id uuid primary key references public.events(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  command jsonb not null check (jsonb_typeof(command) = 'object'),
  before_state jsonb not null,
  previous_action_id uuid references private.item_action_receipts(id) on delete set null,
  reverses_action_id uuid unique references private.item_action_receipts(id) on delete set null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index item_action_receipts_actor_idx on private.item_action_receipts(actor_user_id);
create index item_action_receipts_profile_item_idx on private.item_action_receipts(profile_id,item_id);
create index item_action_receipts_item_idx on private.item_action_receipts(item_id);
create index item_action_receipts_previous_idx on private.item_action_receipts(previous_action_id)
  where previous_action_id is not null;

-- A legacy write invalidates the undo head, including an ABA state change.
-- Successful undo restores the preceding head, allowing an ordered undo stack.
create table private.item_action_heads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  action_id uuid not null references private.item_action_receipts(id) on delete cascade,
  primary key(profile_id,item_id)
);
create index item_action_heads_item_idx on private.item_action_heads(item_id);
create index item_action_heads_action_idx on private.item_action_heads(action_id);
alter table private.item_action_receipts enable row level security;
alter table private.item_action_heads enable row level security;
revoke all on table private.item_action_receipts,private.item_action_heads
  from public,anon,authenticated,service_role;

create function private.invalidate_item_action_head()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from private.item_action_heads
    where profile_id = coalesce(new.profile_id,old.profile_id)
      and item_id = coalesce(new.item_id,old.item_id);
  return coalesce(new,old);
end;
$$;
revoke all on function private.invalidate_item_action_head() from public,anon,authenticated,service_role;
create trigger item_interactions_invalidate_action_head
after insert or update or delete on public.item_interactions
for each row execute function private.invalidate_item_action_head();

create function private.commit_item_action_v1(request jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  action_id uuid;
  target_profile uuid;
  target_item uuid;
  item_kind text;
  kind text;
  event_kind text;
  occurred timestamptz;
  session_started timestamptz;
  event_session_id uuid;
  session_context jsonb;
  prediction uuid;
  mode text;
  previous_head uuid;
  next_head uuid;
  reversed_id uuid;
  prior private.item_action_receipts%rowtype;
  reversed private.item_action_receipts%rowtype;
  state_before jsonb;
  state_after jsonb;
  event_properties jsonb;
  response jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(request) is distinct from 'object' or octet_length(request::text) > 16384
    or request->'version' is distinct from '1'::jsonb then
    raise exception 'Invalid item action' using errcode='22023';
  end if;
  action_id := (request->>'actionId')::uuid;
  target_profile := (request->>'profileId')::uuid;
  target_item := (request->>'itemId')::uuid;
  if (request->>'actorUserId')::uuid is distinct from actor then
    raise exception 'Actor mismatch' using errcode='42501';
  end if;
  if action_id is null or target_profile is null or target_item is null then
    raise exception 'Missing action identity' using errcode='22023';
  end if;
  if private.is_profile_member(target_profile) is distinct from true then
    raise exception 'Profile access denied' using errcode='42501';
  end if;

  -- Serialize with existing Shared/List profile transitions; retain membership
  -- until commit so revocation cannot race a fresh call or cached result.
  perform 1 from public.profiles where id=target_profile for update;
  perform 1 from public.profile_members where profile_id=target_profile and user_id=actor for key share;
  if not found then raise exception 'Profile access denied' using errcode='42501'; end if;
  select * into prior from private.item_action_receipts where id=action_id;
  if found then
    if prior.actor_user_id<>actor or prior.profile_id<>target_profile or prior.command<>request then
      raise exception 'Action ID payload mismatch' using errcode='22023';
    end if;
    return prior.result;
  end if;
  if exists(select 1 from public.events where id=action_id) then
    raise exception 'Action ID already used' using errcode='22023';
  end if;
  kind := request->>'kind';
  if kind is null or kind not in ('SET_RATING','SET_NOT_INTERESTED','UNDO') then
    raise exception 'Unsupported item action' using errcode='22023';
  end if;
  occurred := (request->>'occurredAt')::timestamptz;
  event_session_id := (request->'session'->>'sessionId')::uuid;
  session_started := (request->'session'->>'startedAt')::timestamptz;
  session_context := request->'session'->'context';
  mode := request->>'discoveryMode';
  if occurred is null or not isfinite(occurred) or occurred>now()+interval '5 minutes'
    or event_session_id is null or session_started is null or not isfinite(session_started)
    or session_started>occurred or jsonb_typeof(session_context) is distinct from 'object'
    or (mode is not null and mode not in ('FOR_YOU','SURPRISE','RISK')) then
    raise exception 'Invalid action context' using errcode='22023';
  end if;
  select item_type into item_kind from public.items where id=target_item;
  if not found then raise exception 'Unknown Item' using errcode='22023'; end if;

  -- Lock current state before reading the undo head. Commands patch only their
  -- owned taste fields; Saved and other unrelated state are never client copies.
  select jsonb_build_object('interest',interest,'saved',saved,'consumed',consumed,
    'rating',rating,'notInterested',not_interested)
    into state_before from public.item_interactions
    where profile_id=target_profile and item_id=target_item for update;
  state_before := coalesce(state_before,'{"interest":null,"saved":false,"consumed":false,"rating":null,"notInterested":false}'::jsonb);
  select heads.action_id into previous_head from private.item_action_heads heads
    where profile_id=target_profile and item_id=target_item;
  state_after := state_before;
  event_properties := jsonb_build_object('source','ITEM_DETAIL','actionId',action_id,'evidenceVersion','item-action-v1');
  if kind='SET_RATING' then
    if jsonb_typeof(request->'rating') is distinct from 'number'
      or (request->>'rating')::numeric not between 0 and 10
      or trunc((request->>'rating')::numeric)<>(request->>'rating')::numeric then
      raise exception 'Rating must be an integer from 0 to 10' using errcode='22023';
    end if;
    state_after := state_after || jsonb_build_object('interest',null,'consumed',true,
      'rating',(request->>'rating')::integer,'notInterested',false);
    event_kind := 'ITEM_RATED';
    event_properties := event_properties || jsonb_build_object('rating',(request->>'rating')::integer);
  elsif kind='SET_NOT_INTERESTED' then
    if jsonb_typeof(request->'notInterested') is distinct from 'boolean' then
      raise exception 'Not-interest must be boolean' using errcode='22023';
    end if;
    state_after := state_after || jsonb_build_object('notInterested',(request->>'notInterested')::boolean);
    if (request->>'notInterested')::boolean then
      state_after := state_after || '{"interest":null,"consumed":false,"rating":null}'::jsonb;
      event_kind := 'ITEM_NOT_INTERESTED';
    else event_kind := 'ITEM_INTEREST_CLEARED';
    end if;
  else
    reversed_id := (request->>'reversesActionId')::uuid;
    select * into reversed from private.item_action_receipts where id=reversed_id;
    if not found or reversed.actor_user_id<>actor or reversed.profile_id<>target_profile
      or reversed.item_id<>target_item or reversed.command->>'kind'='UNDO'
      or previous_head is distinct from reversed_id then
      raise exception 'Undo target is no longer current' using errcode='KJ001';
    end if;
    state_after := reversed.before_state;
    event_kind := 'ITEM_INTERACTION_UNDONE';
    event_properties := event_properties || jsonb_build_object('reversedEventId',reversed_id,
      'restoredInterest',state_after->'interest','restoredSaved',state_after->'saved',
      'restoredConsumed',state_after->'consumed','restoredRating',state_after->'rating',
      'restoredNotInterested',state_after->'notInterested');
  end if;
  if private.is_shared_saved_state_valid(target_profile,target_item,(state_after->>'saved')::boolean) is distinct from true then
    raise exception 'Shared Saved requires consensus' using errcode='42501';
  end if;

  -- Unverified/fallback attribution must not prevent an otherwise valid action.
  -- Complete frozen delivered-slate provenance remains the next Phase 14.1 gate.
  prediction := null;
  if kind='UNDO' then
    prediction := (reversed.result->>'predictionId')::uuid;
    mode := reversed.result->>'discoveryMode';
  elsif request->>'predictionId' is not null then
    select run.id into prediction
    from private.prediction_runs run
    join private.prediction_candidates candidate on candidate.prediction_id=run.id
    where run.id=(request->>'predictionId')::uuid and run.actor_user_id=actor
      and run.profile_id=target_profile and run.session_id=event_session_id
      and run.discovery_mode=mode and candidate.item_id=target_item and candidate.selected_for_delivery
      and run.requested_at<=occurred
      and exists(select 1 from public.events impression
        where impression.profile_id=target_profile and impression.actor_user_id=actor
          and impression.session_id=event_session_id and impression.prediction_id=run.id
          and impression.item_id=target_item and impression.event_type='ITEM_IMPRESSION'
          and impression.occurred_at between run.requested_at and occurred);
  end if;
  event_properties := event_properties || jsonb_build_object('attributionStatus',
    case when prediction is null then 'UNATTRIBUTED' else 'VALIDATED_TRACE' end);

  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
    values(event_session_id,actor,target_profile,session_started,session_context) on conflict(id) do nothing;
  if not exists(select 1 from public.event_sessions existing
    where existing.id=event_session_id and existing.actor_user_id=actor and existing.profile_id=target_profile
      and existing.started_at=session_started and existing.context=session_context) then
    raise exception 'Session identity payload mismatch' using errcode='22023';
  end if;
  insert into public.item_interactions(profile_id,item_id,actor_user_id,interest,saved,consumed,rating,not_interested)
    values(target_profile,target_item,actor,state_after->>'interest',(state_after->>'saved')::boolean,
      (state_after->>'consumed')::boolean,(state_after->>'rating')::integer,(state_after->>'notInterested')::boolean)
    on conflict(profile_id,item_id) do update set actor_user_id=excluded.actor_user_id,
      interest=excluded.interest,saved=excluded.saved,consumed=excluded.consumed,
      rating=excluded.rating,not_interested=excluded.not_interested;
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,
    session_id,prediction_id,discovery_mode,context,properties)
    values(action_id,actor,target_profile,target_item,item_kind,event_kind,occurred,
      event_session_id,prediction,mode,session_context,event_properties);
  response := jsonb_build_object('version',1,'actionId',action_id,'profileId',target_profile,
    'itemId',target_item,'interaction',state_after,'predictionId',prediction,'discoveryMode',mode);
  insert into private.item_action_receipts(id,actor_user_id,profile_id,item_id,command,before_state,
    previous_action_id,reverses_action_id,result)
    values(action_id,actor,target_profile,target_item,request,state_before,previous_head,reversed_id,response);
  next_head := case when kind='UNDO' then reversed.previous_action_id else action_id end;
  if next_head is not null then
    insert into private.item_action_heads(profile_id,item_id,action_id) values(target_profile,target_item,next_head);
  end if;
  return response;
end;
$$;
revoke all on function private.commit_item_action_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.commit_item_action_v1(jsonb) to authenticated;

create function public.commit_item_action_v1(request jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.commit_item_action_v1(request);
$$;
revoke all on function public.commit_item_action_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.commit_item_action_v1(jsonb) to authenticated;
