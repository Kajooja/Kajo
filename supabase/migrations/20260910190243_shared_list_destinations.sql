-- Additive multi-destination Shared proposals. Old single-List payloads remain
-- valid; a multi-List proposal requires confirmation of the exact visible set.
-- No existing user/history/receipt rows are rewritten by this forward.
create table private.shared_list_proposal_destinations (
  profile_id uuid not null,
  item_id uuid not null,
  list_id uuid not null references public.item_lists(id) on delete cascade,
  primary key(profile_id,item_id,list_id),
  foreign key(profile_id,item_id) references public.shared_item_list_proposals(profile_id,item_id) on delete cascade
);
create index shared_list_proposal_destinations_list_idx on private.shared_list_proposal_destinations(list_id);
alter table private.shared_list_proposal_destinations enable row level security;
revoke all on table private.shared_list_proposal_destinations from public,anon,authenticated,service_role;

create function private.endorse_shared_item_core_v1(target_profile_id uuid, target_item_id uuid)
 RETURNS TABLE(status text, profile_id uuid, item_id uuid, actor_user_id uuid, endorsement_created boolean, endorsement_count integer, required_member_count integer, consensus_reached boolean, consensus_saved boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  authenticated_user_id uuid := (select auth.uid());
  current_member_count integer;
  current_endorsement_count integer;
  endorsement_was_created boolean := false;
  shared_was_saved boolean := false;
  consensus_was_reached boolean := false;
  shared_is_saved boolean := false;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null or target_item_id is null then
    raise exception 'Shared profile and item are required' using errcode = '22023';
  end if;

  perform 1
  from public.profiles as shared_profile
  where shared_profile.id = target_profile_id
    and shared_profile.profile_type = 'SHARED'
  for update;

  if not found then
    raise exception 'Shared profile not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = target_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Shared profile access denied' using errcode = '42501';
  end if;

  select count(*)::integer
  into current_member_count
  from public.profile_members as membership
  where membership.profile_id = target_profile_id;

  if current_member_count < 2 then
    raise exception 'Shared profile is not ready' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.items as item
    where item.id = target_item_id
  ) then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  select coalesce(interaction.saved, false)
  into shared_was_saved
  from public.item_interactions as interaction
  where interaction.profile_id = target_profile_id
    and interaction.item_id = target_item_id;

  shared_was_saved := coalesce(shared_was_saved, false);

  if shared_was_saved then
    select count(*)::integer
    into current_endorsement_count
    from public.shared_item_endorsements as endorsement
    join public.profile_members as membership
      on membership.profile_id = endorsement.profile_id
     and membership.user_id = endorsement.actor_user_id
    where endorsement.profile_id = target_profile_id
      and endorsement.item_id = target_item_id;

    return query
    select
      'CONSENSUS_SAVED'::text,
      target_profile_id,
      target_item_id,
      authenticated_user_id,
      false,
      current_endorsement_count,
      current_member_count,
      false,
      true;
    return;
  end if;

  if exists (
    select 1
    from public.item_interactions as interaction
    where interaction.profile_id = target_profile_id
      and interaction.item_id = target_item_id
      and (interaction.consumed or interaction.rating is not null)
  ) then
    raise exception 'Item is already consumed in this Shared profile'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.profile_members as membership
    join public.profiles as personal_profile
      on personal_profile.owner_user_id = membership.user_id
     and personal_profile.profile_type = 'PERSONAL'
    join public.item_interactions as personal_interaction
      on personal_interaction.profile_id = personal_profile.id
     and personal_interaction.item_id = target_item_id
    where membership.profile_id = target_profile_id
      and (
        personal_interaction.consumed
        or personal_interaction.rating is not null
      )
  ) then
    raise exception 'Item is already consumed by a Shared profile member'
      using errcode = '55000';
  end if;

  insert into public.shared_item_endorsements (
    profile_id,
    item_id,
    actor_user_id
  )
  values (
    target_profile_id,
    target_item_id,
    authenticated_user_id
  )
  on conflict on constraint shared_item_endorsements_pkey do nothing;

  endorsement_was_created := found;

  select count(*)::integer
  into current_endorsement_count
  from public.shared_item_endorsements as endorsement
  join public.profile_members as membership
    on membership.profile_id = endorsement.profile_id
   and membership.user_id = endorsement.actor_user_id
  where endorsement.profile_id = target_profile_id
    and endorsement.item_id = target_item_id;

  if current_endorsement_count >= current_member_count then
    insert into public.item_interactions (
      profile_id,
      item_id,
      actor_user_id,
      interest,
      saved,
      consumed,
      rating,
      not_interested
    )
    values (
      target_profile_id,
      target_item_id,
      authenticated_user_id,
      null,
      true,
      false,
      null,
      false
    )
    on conflict on constraint item_interactions_pkey do update
    set
      actor_user_id = excluded.actor_user_id,
      saved = true,
      updated_at = now()
    where not public.item_interactions.saved;

    consensus_was_reached := found;
  end if;

  select coalesce(interaction.saved, false)
  into shared_is_saved
  from public.item_interactions as interaction
  where interaction.profile_id = target_profile_id
    and interaction.item_id = target_item_id;

  shared_is_saved := coalesce(shared_is_saved, false);

  return query
  select
    case
      when consensus_was_reached then 'CONSENSUS_REACHED'
      when endorsement_was_created then 'ENDORSED'
      else 'ALREADY_ENDORSED'
    end,
    target_profile_id,
    target_item_id,
    authenticated_user_id,
    endorsement_was_created,
    current_endorsement_count,
    current_member_count,
    consensus_was_reached,
    shared_is_saved;
end;
$function$;

revoke all on function private.endorse_shared_item_core_v1(uuid,uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.endorse_shared_item(target_profile_id uuid, target_item_id uuid)
 RETURNS TABLE(status text, profile_id uuid, item_id uuid, actor_user_id uuid, endorsement_created boolean, endorsement_count integer, required_member_count integer, consensus_reached boolean, consensus_saved boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.is_profile_member(target_profile_id) then
    raise exception 'Shared profile access denied' using errcode='42501';
  end if;
  perform 1 from public.profiles where id=target_profile_id for update;
  if exists(select 1 from private.shared_list_proposal_destinations d
    where d.profile_id=target_profile_id and d.item_id=target_item_id
    group by d.profile_id,d.item_id having count(*)>1) then
    raise exception 'Päivitä sovellus hyväksyäksesi kaikki ehdotuksen listat.' using errcode='22023';
  end if;
  return query select * from private.endorse_shared_item_core_v1(target_profile_id,target_item_id);
end;
$function$;

create function private.endorse_shared_list_item_core_v1(
  target_profile_id uuid,
  target_item_id uuid,
  target_list_id uuid default null
)
returns table (
  status text,
  profile_id uuid,
  item_id uuid,
  actor_user_id uuid,
  endorsement_created boolean,
  endorsement_count integer,
  required_member_count integer,
  consensus_reached boolean,
  consensus_saved boolean,
  proposal_list_id uuid,
  proposal_list_name text,
  proposed_by_user_id uuid,
  list_entry_created boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  selected_list_id uuid;
  selected_list_name text;
  existing_list_id uuid;
  existing_list_name text;
  proposal_actor_user_id uuid;
  proposal_actor_endorsed_at timestamptz;
  endorsement_result record;
  custom_entry_created boolean := false;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null or target_item_id is null then
    raise exception 'Shared profile and item are required' using errcode = '22023';
  end if;

  perform 1
  from public.profiles as shared_profile
  where shared_profile.id = target_profile_id
    and shared_profile.profile_type = 'SHARED'
  for update;

  if not found then
    raise exception 'Shared profile not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = target_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Shared profile access denied' using errcode = '42501';
  end if;

  if target_list_id is not null then
    select item_list.id, item_list.name
    into selected_list_id, selected_list_name
    from public.item_lists as item_list
    where item_list.id = target_list_id
      and item_list.profile_id = target_profile_id
      and item_list.list_kind = 'CUSTOM'
    for update;

    if selected_list_id is null then
      raise exception 'Shared custom List not found' using errcode = 'P0002';
    end if;

    select
      proposal.list_id,
      item_list.name,
      proposal.proposed_by_user_id,
      proposal.proposed_at
    into
      existing_list_id,
      existing_list_name,
      proposal_actor_user_id,
      proposal_actor_endorsed_at
    from public.shared_item_list_proposals as proposal
    join public.item_lists as item_list
      on item_list.id = proposal.list_id
    where proposal.profile_id = target_profile_id
      and proposal.item_id = target_item_id
    for update of proposal;

    if found and (
      existing_list_id <> target_list_id
      or proposal_actor_user_id <> authenticated_user_id
    ) then
      raise exception 'Item already has a pending Shared List approval'
        using errcode = '23505';
    end if;

    if not found then
      insert into public.shared_item_list_proposals (
        profile_id,
        item_id,
        list_id,
        proposed_by_user_id
      )
      values (
        target_profile_id,
        target_item_id,
        target_list_id,
        authenticated_user_id
      );

      selected_list_id := target_list_id;
      proposal_actor_user_id := authenticated_user_id;
      proposal_actor_endorsed_at := now();
    else
      selected_list_id := existing_list_id;
      selected_list_name := existing_list_name;
    end if;
  else
    select
      proposal.list_id,
      item_list.name,
      proposal.proposed_by_user_id,
      proposal.proposed_at
    into
      selected_list_id,
      selected_list_name,
      proposal_actor_user_id,
      proposal_actor_endorsed_at
    from public.shared_item_list_proposals as proposal
    join public.item_lists as item_list
      on item_list.id = proposal.list_id
     and item_list.profile_id = proposal.profile_id
     and item_list.list_kind = 'CUSTOM'
    where proposal.profile_id = target_profile_id
      and proposal.item_id = target_item_id
    for update of proposal;

    if selected_list_id is null then
      raise exception 'Pending Shared List approval not found'
        using errcode = 'P0002';
    end if;
  end if;

  select *
  into endorsement_result
  from private.endorse_shared_item_core_v1(target_profile_id, target_item_id);

  if endorsement_result.consensus_saved then
    insert into public.item_list_entries (
      list_id,
      item_id,
      added_by_user_id,
      added_at,
      entry_source
    )
    values (
      selected_list_id,
      target_item_id,
      proposal_actor_user_id,
      proposal_actor_endorsed_at,
      'SHARED_CONSENSUS'
    )
    on conflict on constraint item_list_entries_pkey do nothing;

    custom_entry_created := found;

    update public.shared_item_list_proposals as proposal
    set
      completed_by_user_id = coalesce(
        proposal.completed_by_user_id,
        authenticated_user_id
      ),
      completed_at = coalesce(proposal.completed_at, now())
    where proposal.profile_id = target_profile_id
      and proposal.item_id = target_item_id;
  end if;

  return query
  select
    endorsement_result.status::text,
    endorsement_result.profile_id::uuid,
    endorsement_result.item_id::uuid,
    endorsement_result.actor_user_id::uuid,
    endorsement_result.endorsement_created::boolean,
    endorsement_result.endorsement_count::integer,
    endorsement_result.required_member_count::integer,
    endorsement_result.consensus_reached::boolean,
    endorsement_result.consensus_saved::boolean,
    selected_list_id,
    selected_list_name,
    proposal_actor_user_id,
    custom_entry_created;
end;
$$;
revoke all on function private.endorse_shared_list_item_core_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function private.endorse_shared_list_item(
  target_profile_id uuid,
  target_item_id uuid,
  target_list_id uuid default null
)
returns table (
  status text,
  profile_id uuid,
  item_id uuid,
  actor_user_id uuid,
  endorsement_created boolean,
  endorsement_count integer,
  required_member_count integer,
  consensus_reached boolean,
  consensus_saved boolean,
  proposal_list_id uuid,
  proposal_list_name text,
  proposed_by_user_id uuid,
  list_entry_created boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_profile_member(target_profile_id) then
    raise exception 'Shared profile access denied' using errcode='42501';
  end if;
  -- Lock before checking: an old client cannot approve only the primary List
  -- while another transaction binds a multi-destination proposal.
  perform 1 from public.profiles where id=target_profile_id for update;
  if exists(select 1 from private.shared_list_proposal_destinations d
    where d.profile_id=target_profile_id and d.item_id=target_item_id
    group by d.profile_id,d.item_id having count(*)>1) then
    raise exception 'Päivitä sovellus hyväksyäksesi kaikki ehdotuksen listat.' using errcode='22023';
  end if;
  return query select * from private.endorse_shared_list_item_core_v1(target_profile_id,target_item_id,target_list_id);
end;
$$;

create function private.shared_list_destinations_v1(target_profile uuid,target_item uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name)
    order by (l.id=p.list_id) desc,l.id),'[]'::jsonb)
  from public.shared_item_list_proposals p
  join public.item_lists l on l.profile_id=p.profile_id and l.list_kind='CUSTOM'
    and (l.id=p.list_id or exists(select 1 from private.shared_list_proposal_destinations d
      where d.profile_id=p.profile_id and d.item_id=p.item_id and d.list_id=l.id))
  where p.profile_id=target_profile and p.item_id=target_item;
$$;
revoke all on function private.shared_list_destinations_v1(uuid,uuid) from public,anon,authenticated,service_role;

create function private.endorse_shared_list_destinations_v1(target_profile uuid,target_item uuid,target_list uuid,requested_lists jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid(); ids uuid[]; existing_ids uuid[]; destination uuid;
  proposal public.shared_item_list_proposals%rowtype;
  committed jsonb; created_ids uuid[] := array[]::uuid[]; was_created boolean;
  destinations jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=target_profile and profile_type='SHARED' for update;
  if not found then raise exception 'Shared profile not found' using errcode='P0002'; end if;
  if not private.is_profile_member(target_profile) then raise exception 'Shared profile access denied' using errcode='42501'; end if;
  select * into proposal from public.shared_item_list_proposals p where p.profile_id=target_profile and p.item_id=target_item;
  select array_agg((d->>'id')::uuid order by (d->>'id')::uuid) into existing_ids
    from jsonb_array_elements(private.shared_list_destinations_v1(target_profile,target_item)) d;
  if requested_lists is null then
    if cardinality(existing_ids)>1 then
      raise exception 'Päivitä sovellus hyväksyäksesi kaikki ehdotuksen listat.' using errcode='22023';
    end if;
    ids := case when target_list is not null then array[target_list] else existing_ids end;
  else
    if jsonb_typeof(requested_lists) is distinct from 'array' or jsonb_array_length(requested_lists) not between 1 and 32
      or exists(select 1 from jsonb_array_elements(requested_lists) v where jsonb_typeof(v) is distinct from 'string') then
      raise exception 'Select between 1 and 32 Lists' using errcode='22023';
    end if;
    select array_agg(value::uuid order by value::uuid) into ids from jsonb_array_elements_text(requested_lists);
    if cardinality(ids)<>(select count(distinct id) from unnest(ids) id) then
      raise exception 'Duplicate List destination' using errcode='22023';
    end if;
  end if;
  if coalesce(cardinality(ids),0)=0 then raise exception 'Select a List or reload the proposal' using errcode='P0002'; end if;
  if target_list is not null and not target_list=any(ids) then raise exception 'Primary List is outside the selection' using errcode='22023'; end if;
  if existing_ids is not null and ids is distinct from existing_ids then
    raise exception 'Ehdotuksen listat ovat muuttuneet. Avaa ehdotus uudelleen.' using errcode='22023';
  end if;
  if existing_ids is null and target_list is null then raise exception 'Proposal no longer exists' using errcode='P0002'; end if;
  foreach destination in array ids loop
    perform 1 from public.item_lists where id=destination and profile_id=target_profile and list_kind='CUSTOM' for update;
    if not found then raise exception 'Shared custom List not found' using errcode='P0002'; end if;
  end loop;
  select to_jsonb(r) into committed from private.endorse_shared_list_item_core_v1(target_profile,target_item,target_list) r;
  insert into private.shared_list_proposal_destinations(profile_id,item_id,list_id)
    select target_profile,target_item,id from unnest(ids) id on conflict do nothing;
  select * into strict proposal from public.shared_item_list_proposals p where p.profile_id=target_profile and p.item_id=target_item;
  if (committed->>'list_entry_created')::boolean then created_ids := array[proposal.list_id]; end if;
  if (committed->>'consensus_saved')::boolean then
    foreach destination in array ids loop
      if destination=proposal.list_id then continue; end if;
      insert into public.item_list_entries(list_id,item_id,added_by_user_id,added_at,entry_source)
        values(destination,target_item,proposal.proposed_by_user_id,proposal.proposed_at,'SHARED_CONSENSUS') on conflict do nothing;
      was_created := found;
      if was_created then created_ids := array_append(created_ids,destination); end if;
    end loop;
  end if;
  destinations := private.shared_list_destinations_v1(target_profile,target_item);
  return jsonb_build_array(committed || jsonb_build_object('proposal_lists',destinations,
    'list_entry_created',cardinality(created_ids)>0,'created_list_ids',to_jsonb(created_ids)));
end;
$$;
revoke all on function private.endorse_shared_list_destinations_v1(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function private.get_shared_discovery_overlay_v2(target_profile_id uuid,requested_item_type text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_profile_member(target_profile_id) then
    raise exception 'Shared profile access denied' using errcode='42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('proposal_lists',
    case when r.proposed_list_id is not null then private.shared_list_destinations_v1(target_profile_id,r.item_id) else '[]'::jsonb end)
    order by r.item_id),'[]'::jsonb)
    from private.get_shared_discovery_overlay(target_profile_id,requested_item_type) r);
end;
$$;
revoke all on function private.get_shared_discovery_overlay_v2(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.get_shared_discovery_overlay_v2(uuid,text) to authenticated;
create function public.get_shared_discovery_overlay_v2(target_profile_id uuid,requested_item_type text default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.get_shared_discovery_overlay_v2(target_profile_id,requested_item_type);
$$;
revoke all on function public.get_shared_discovery_overlay_v2(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_shared_discovery_overlay_v2(uuid,text) to authenticated;

create or replace function private.clean_pending_shared_list_approval_for_list()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Removing any selected List cancels the whole still-pending proposal. Existing
  -- completed memberships on other Lists and consensus Saved survive.
  delete from public.shared_item_endorsements e using public.shared_item_list_proposals p
    where p.completed_at is null and e.profile_id=p.profile_id and e.item_id=p.item_id
      and (p.list_id=old.id or exists(select 1 from private.shared_list_proposal_destinations d
        where d.profile_id=p.profile_id and d.item_id=p.item_id and d.list_id=old.id));
  delete from public.shared_item_list_proposals p where p.completed_at is null
    and (p.list_id=old.id or exists(select 1 from private.shared_list_proposal_destinations d
      where d.profile_id=p.profile_id and d.item_id=p.item_id and d.list_id=old.id));
  return old;
end;
$$;

create or replace function private.commit_collection_action_v1(request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  action_id uuid;
  target_profile uuid;
  profile_kind text;
  target_item uuid;
  target_list uuid;
  kind text;
  source text;
  occurred timestamptz;
  session_started timestamptz;
  event_session_id uuid;
  session_context jsonb;
  prediction uuid;
  mode text;
  prior private.item_action_receipts%rowtype;
  reversed private.item_action_receipts%rowtype;
  previous_head uuid;
  reversed_id uuid;
  list_before public.item_lists%rowtype;
  entry_before jsonb;
  state_before jsonb;
  state_after jsonb;
  result jsonb;
  response jsonb;
  effects jsonb := '[]'::jsonb;
  effect jsonb;
  effect_id uuid;
  event_ids jsonb := '[]'::jsonb;
  present boolean;
  positive boolean;
  changed boolean := false;
  undoable boolean := false;
  cancelled record;
  correction record;
  cleared_bootstrap integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(request) is distinct from 'object' or octet_length(request::text)>16384
    or request->'version' is distinct from '1'::jsonb then
    raise exception 'Invalid collection action' using errcode='22023';
  end if;
  action_id := (request->>'actionId')::uuid;
  target_profile := (request->>'profileId')::uuid;
  target_item := (request->>'itemId')::uuid;
  target_list := (request->>'listId')::uuid;
  if (request->>'actorUserId')::uuid is distinct from actor then
    raise exception 'Actor mismatch' using errcode='42501';
  end if;
  if action_id is null or target_profile is null then
    raise exception 'Missing action identity' using errcode='22023';
  end if;
  if private.is_profile_member(target_profile) is distinct from true then
    raise exception 'Profile access denied' using errcode='42501';
  end if;
  select profile_type into profile_kind from public.profiles where id=target_profile for update;
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
  source := request->>'source';
  occurred := (request->>'occurredAt')::timestamptz;
  event_session_id := (request->'session'->>'sessionId')::uuid;
  session_started := (request->'session'->>'startedAt')::timestamptz;
  session_context := request->'session'->'context';
  mode := request->>'discoveryMode';
  if kind is null or kind not in ('CREATE_LIST','RENAME_LIST','DELETE_LIST','SET_LIST_ENTRY','UNDO_LIST_ENTRY','ENDORSE_SHARED_ITEM','REVERSE_ENDORSEMENT','CLEAR_HISTORY')
    or source is null or source not in ('LISTS','LIST_DETAIL','ITEM_DESTINATION_PICKER','SHARED_DISCOVERY')
    or occurred is null or not isfinite(occurred) or occurred>now()+interval '5 minutes'
    or event_session_id is null or session_started is null or not isfinite(session_started)
    or session_started>occurred or jsonb_typeof(session_context) is distinct from 'object'
    or (mode is not null and mode not in ('FOR_YOU','SURPRISE','RISK')) then
    raise exception 'Invalid action context' using errcode='22023';
  end if;
  if (kind in ('CREATE_LIST','RENAME_LIST','DELETE_LIST')) <> (target_item is null) then
    raise exception 'Invalid Item scope' using errcode='22023';
  end if;
  select jsonb_build_object('interest',interest,'saved',saved,'consumed',consumed,
    'rating',rating,'notInterested',not_interested) into state_before
    from public.item_interactions where profile_id=target_profile and item_id=target_item for update;
  state_before := coalesce(state_before,'{"interest":null,"saved":false,"consumed":false,"rating":null,"notInterested":false}'::jsonb);
  select h.action_id into previous_head from private.item_action_heads h
    where profile_id=target_profile and item_id=target_item;

  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
    values(event_session_id,actor,target_profile,session_started,session_context) on conflict(id) do nothing;
  if not exists(select 1 from public.event_sessions s where s.id=event_session_id
    and s.actor_user_id=actor and s.profile_id=target_profile and s.started_at=session_started and s.context=session_context) then
    raise exception 'Session identity payload mismatch' using errcode='22023';
  end if;

  -- Only domain rejection inside this subtransaction becomes discardable KJ002.
  -- Identity/authentication/receipt uncertainty stays outside that classification.
  begin
    if target_item is not null and not exists(select 1 from public.items where id=target_item) then
      raise exception 'Item no longer exists' using errcode='P0002';
    end if;
    if kind='UNDO_LIST_ENTRY' then
      reversed_id := (request->>'reversesActionId')::uuid;
      select * into reversed from private.item_action_receipts where id=reversed_id;
      if not found or reversed.actor_user_id<>actor or reversed.profile_id<>target_profile
        or reversed.item_id is distinct from target_item or reversed.command->>'kind'<>'SET_LIST_ENTRY'
        or reversed.result->>'undoable'<>'true' or previous_head is distinct from reversed_id then
        raise exception 'Undo target is no longer current' using errcode='KJ001';
      end if;
      target_list := reversed.list_id;
    end if;
    if kind in ('RENAME_LIST','DELETE_LIST','SET_LIST_ENTRY','UNDO_LIST_ENTRY') then
      select * into list_before from public.item_lists where id=target_list for update;
      if not found then raise exception 'List no longer exists' using errcode='P0002'; end if;
      if list_before.profile_id<>target_profile then
        raise exception 'List belongs to another Profile' using errcode='42501';
      end if;
      select to_jsonb(e) into entry_before from public.item_list_entries e
        where list_id=target_list and item_id=target_item for update;
    end if;
    if kind='CREATE_LIST' then
      select jsonb_agg(to_jsonb(r)) into result from private.create_custom_item_list(target_profile,request->>'name') r;
      target_list := (result->0->>'list_id')::uuid;
      effects := effects || jsonb_build_array(jsonb_build_object('type','LIST_CREATED','properties',
        jsonb_build_object('listId',target_list,'listName',result->0->>'name')));
    elsif kind='RENAME_LIST' then
      select jsonb_agg(to_jsonb(r)) into result from private.rename_custom_item_list(target_list,request->>'name') r;
      if list_before.name is distinct from result->0->>'name' then
        effects := effects || jsonb_build_array(jsonb_build_object('type','LIST_RENAMED','properties',
          jsonb_build_object('listId',target_list,'listName',result->0->>'name','previousName',list_before.name)));
      end if;
    elsif kind='DELETE_LIST' then
      -- Cancellation is an administrative correction with the real deleting actor,
      -- never a forged negative preference from the affected endorsing member.
      for cancelled in select e.item_id,e.actor_user_id from public.shared_item_endorsements e
        join public.shared_item_list_proposals p on p.profile_id=e.profile_id and p.item_id=e.item_id
        where p.completed_at is null and (p.list_id=target_list or exists(
          select 1 from private.shared_list_proposal_destinations d where d.profile_id=p.profile_id
            and d.item_id=p.item_id and d.list_id=target_list)) order by e.item_id,e.actor_user_id loop
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_ENDORSEMENT_REVERSED','itemId',cancelled.item_id,
          'properties',jsonb_build_object('source','LIST_DELETED','listId',target_list,
            'endorsementActorUserId',cancelled.actor_user_id,'reason','LIST_DELETED')));
      end loop;
      result := to_jsonb(private.delete_custom_item_list(target_list));
      effects := jsonb_build_array(jsonb_build_object('type','LIST_DELETED','properties',
        jsonb_build_object('listId',target_list,'listName',list_before.name))) || effects;
    elsif kind='CLEAR_HISTORY' then
      if target_list is not null or request->>'predictionId' is not null then
        raise exception 'History correction has no List or Prediction origin' using errcode='22023';
      end if;
      mode := null;
      update public.item_interactions set rating=null,consumed=false,actor_user_id=actor
        where profile_id=target_profile and item_id=target_item and (rating is not null or consumed);
      changed := found;
      update private.profile_bootstrap_evidence set active=false
        where profile_id=target_profile and item_id=target_item and active and evidence_kind in ('RATED','CONSUMED');
      get diagnostics cleared_bootstrap = row_count;
      -- Correct all active terminal evidence, so an older rating cannot reappear
      -- in Memory/outcome learning. Saved, interest and other Profiles survive.
      for correction in select e.id from public.events e
        where e.profile_id=target_profile and e.item_id=target_item and e.event_type in ('ITEM_RATED','ITEM_CONSUMED')
          and not exists(select 1 from public.events u where u.profile_id=target_profile
            and u.event_type='ITEM_INTERACTION_UNDONE' and u.properties->>'reversedEventId'=e.id::text)
        order by e.created_at,e.id loop
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_INTERACTION_UNDONE',
          'uncorrelated',true,'properties',jsonb_build_object('reversedEventId',correction.id,'reason','HISTORY_CLEARED')));
      end loop;
      if changed or cleared_bootstrap>0 or jsonb_array_length(effects)>0 then
        effects := jsonb_build_array(jsonb_build_object('type','ITEM_HISTORY_CLEARED','uncorrelated',true,
          'properties',jsonb_build_object('previousRating',state_before->'rating',
            'previousConsumed',state_before->'consumed','clearedBootstrapCount',cleared_bootstrap))) || effects;
      end if;
      result := 'true'::jsonb;
    elsif kind='SET_LIST_ENTRY' then
      if jsonb_typeof(request->'present') is distinct from 'boolean'
        or jsonb_typeof(request->'positive') is distinct from 'boolean' then
        raise exception 'Invalid List action' using errcode='22023';
      end if;
      present := (request->>'present')::boolean;
      positive := (request->>'positive')::boolean;
      if positive and (not present or profile_kind<>'PERSONAL' or source<>'ITEM_DESTINATION_PICKER') then
        raise exception 'Invalid positive List action' using errcode='22023';
      end if;
      if present is distinct from (entry_before is not null)
        or (list_before.list_kind='SYSTEM_SAVED' and present is distinct from (state_before->>'saved')::boolean) then
        perform private.set_item_list_entry(target_list,target_item,present);
      end if;
      if positive and state_before->>'interest' is distinct from 'LIKED' then
        insert into public.item_interactions(profile_id,item_id,actor_user_id,interest)
          values(target_profile,target_item,actor,'LIKED')
          on conflict(profile_id,item_id) do update set actor_user_id=excluded.actor_user_id,interest='LIKED';
      end if;
      if list_before.list_kind='CUSTOM' and present is distinct from (entry_before is not null) then
        effects := effects || jsonb_build_array(jsonb_build_object('type',case when present then 'ITEM_ADDED_TO_LIST' else 'ITEM_REMOVED_FROM_LIST' end,
          'properties',jsonb_build_object('listId',target_list,'listName',list_before.name)));
      end if;
      if list_before.list_kind='SYSTEM_SAVED' and present is distinct from (state_before->>'saved')::boolean then
        effects := effects || jsonb_build_array(jsonb_build_object('type',case when present then 'ITEM_SAVED' else 'ITEM_UNSAVED' end,
          'properties',jsonb_build_object('listId',target_list,'listName',list_before.name)));
      elsif positive and state_before->>'interest' is distinct from 'LIKED' then
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_LIKED',
          'properties',jsonb_build_object('listId',target_list,'listName',list_before.name)));
      end if;
      result := to_jsonb(present);
      undoable := jsonb_array_length(effects)>0;
    elsif kind='UNDO_LIST_ENTRY' then
      if private.is_shared_saved_state_valid(target_profile,target_item,(reversed.before_state->>'saved')::boolean) is distinct from true then
        raise exception 'Shared Saved requires consensus' using errcode='42501';
      end if;
      if reversed.before_list_entry is null then
        delete from public.item_list_entries where list_id=target_list and item_id=target_item;
      else
        insert into public.item_list_entries(list_id,item_id,added_by_user_id,added_at,entry_source)
          values(target_list,target_item,(reversed.before_list_entry->>'added_by_user_id')::uuid,
            (reversed.before_list_entry->>'added_at')::timestamptz,reversed.before_list_entry->>'entry_source')
          on conflict(list_id,item_id) do update set added_by_user_id=excluded.added_by_user_id,
            added_at=excluded.added_at,entry_source=excluded.entry_source;
      end if;
      insert into public.item_interactions(profile_id,item_id,actor_user_id,interest,saved,consumed,rating,not_interested)
        values(target_profile,target_item,actor,reversed.before_state->>'interest',(reversed.before_state->>'saved')::boolean,
          (reversed.before_state->>'consumed')::boolean,(reversed.before_state->>'rating')::integer,(reversed.before_state->>'notInterested')::boolean)
        on conflict(profile_id,item_id) do update set actor_user_id=excluded.actor_user_id,interest=excluded.interest,
          saved=excluded.saved,consumed=excluded.consumed,rating=excluded.rating,not_interested=excluded.not_interested;
      -- Existing learners cancel by exact reversedEventId. Correct every Event
      -- from the target command so a List+Like pair cannot leave stale taste.
      select jsonb_agg(jsonb_build_object('type','ITEM_INTERACTION_UNDONE','properties',
        jsonb_build_object('reversedEventId',original.value,'reversesActionId',reversed_id,
          'listId',target_list,'restoredListEntry',reversed.before_list_entry is not null,
          'restoredInterest',reversed.before_state->'interest','restoredSaved',reversed.before_state->'saved',
          'restoredConsumed',reversed.before_state->'consumed','restoredRating',reversed.before_state->'rating',
          'restoredNotInterested',reversed.before_state->'notInterested')) order by original.ordinality)
        into effects from jsonb_array_elements_text(reversed.result->'eventIds') with ordinality original(value,ordinality);
      result := 'true'::jsonb;
    elsif kind='ENDORSE_SHARED_ITEM' then
      result := private.endorse_shared_list_destinations_v1(target_profile,target_item,target_list,request->'listIds');
      target_list := (result->0->>'proposal_list_id')::uuid;
      if (result->0->>'endorsement_created')::boolean then
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_ENDORSED','properties',jsonb_build_object(
          'listId',target_list,'listName',result->0->>'proposal_list_name','destinations',result->0->'proposal_lists',
          'endorsementCount',result->0->'endorsement_count',
          'requiredMemberCount',result->0->'required_member_count')));
      end if;
      if (result->0->>'consensus_reached')::boolean then
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_SAVED','properties',
          jsonb_build_object('source','SHARED_CONSENSUS','endorsementCount',result->0->'endorsement_count',
            'requiredMemberCount',result->0->'required_member_count')));
      end if;
      for effect in select d from jsonb_array_elements(result->0->'proposal_lists') d
        where result->0->'created_list_ids' @> jsonb_build_array(d->>'id') loop
        effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_ADDED_TO_LIST','properties',jsonb_build_object(
          'source','SHARED_CONSENSUS','listId',effect->>'id','listName',effect->>'name',
          'proposedByUserId',result->0->>'proposed_by_user_id')));
      end loop;
    else
      select jsonb_agg(to_jsonb(r)) into result from private.reverse_shared_item_endorsement(target_profile,target_item) r;
      if (result->0->>'endorsement_reversed')::boolean then
        effects := jsonb_build_array(jsonb_build_object('type','ITEM_ENDORSEMENT_REVERSED','properties',
          jsonb_build_object('endorsementActorUserId',actor)));
      end if;
      if (result->0->>'endorsement_count')::integer=0 then
        delete from public.shared_item_list_proposals where profile_id=target_profile and item_id=target_item and completed_at is null;
      end if;
    end if;
  exception when data_exception or unique_violation or no_data_found or object_not_in_prerequisite_state then
    raise exception 'Collection action rejected: %',sqlerrm using errcode='KJ002';
  end;

  -- A withdrawal/cancelled proposal must also remove the original endorsement
  -- from outcome learning. Existing readers recognize exact Undo references.
  -- Corrections retain the actual withdrawing/deleting actor and no current-view trace.
  for effect in select value from jsonb_array_elements(effects) where value->>'type'='ITEM_ENDORSEMENT_REVERSED' loop
    for correction in select e.id from public.events e
      where e.profile_id=target_profile and e.item_id=coalesce((effect->>'itemId')::uuid,target_item)
        and e.actor_user_id=(effect->'properties'->>'endorsementActorUserId')::uuid and e.event_type='ITEM_ENDORSED'
        and not exists(select 1 from public.events u where u.profile_id=target_profile
          and u.event_type='ITEM_INTERACTION_UNDONE' and u.properties->>'reversedEventId'=e.id::text)
      order by e.created_at,e.id loop
      effects := effects || jsonb_build_array(jsonb_build_object('type','ITEM_INTERACTION_UNDONE',
        'itemId',coalesce((effect->>'itemId')::uuid,target_item),'uncorrelated',true,'properties',
        coalesce(effect->'properties','{}'::jsonb) || jsonb_build_object('reversedEventId',correction.id,'reversesEndorsement',true)));
    end loop;
  end loop;

  select jsonb_build_object('interest',interest,'saved',saved,'consumed',consumed,
    'rating',rating,'notInterested',not_interested) into state_after from public.item_interactions
    where profile_id=target_profile and item_id=target_item;
  if target_item is not null then state_after := coalesce(state_after,state_before); end if;
  if kind='UNDO_LIST_ENTRY' then
    prediction := (reversed.result->>'predictionId')::uuid;
    mode := reversed.result->>'discoveryMode';
  elsif target_item is not null and request->>'predictionId' is not null then
    select run.id into prediction from private.prediction_runs run
      join private.prediction_candidates c on c.prediction_id=run.id
      where run.id=(request->>'predictionId')::uuid and run.actor_user_id=actor and run.profile_id=target_profile
        and run.session_id=event_session_id and run.discovery_mode=mode and c.item_id=target_item and c.selected_for_delivery
        and run.requested_at<=occurred and exists(select 1 from public.events impression
          where impression.actor_user_id=actor and impression.profile_id=target_profile and impression.item_id=target_item
            and impression.session_id=event_session_id and impression.prediction_id=run.id and impression.event_type='ITEM_IMPRESSION'
            and impression.occurred_at between run.requested_at and occurred);
  end if;
  for effect in select value from jsonb_array_elements(effects) loop
    effect_id := case when jsonb_array_length(event_ids)=0 then action_id else gen_random_uuid() end;
    insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,session_id,prediction_id,discovery_mode,context,properties)
      select effect_id,actor,target_profile,i.id,i.item_type,effect->>'type',occurred,event_session_id,
        case when i.id=target_item and effect->>'uncorrelated' is distinct from 'true' then prediction else null end,
        case when effect->>'uncorrelated'='true' then null else mode end,session_context,
        jsonb_build_object('source',source,'actionId',action_id,'evidenceVersion','collection-action-v1',
          'attributionStatus',case when i.id=target_item and prediction is not null and effect->>'uncorrelated' is distinct from 'true'
            then 'VALIDATED_TRACE' else 'UNATTRIBUTED' end)
          || coalesce(effect->'properties','{}'::jsonb)
      from (select coalesce((effect->>'itemId')::uuid,target_item) id) ref
      left join public.items i on i.id=ref.id;
    event_ids := event_ids || jsonb_build_array(effect_id);
  end loop;
  changed := jsonb_array_length(event_ids)>0;
  response := jsonb_build_object('version',1,'actionId',action_id,'profileId',target_profile,'kind',kind,
    'itemId',target_item,'listId',target_list,'result',result,'eventIds',event_ids,'changed',changed,'undoable',undoable,
    'interaction',state_after,'beforeInteraction',case when target_item is null then null else state_before end,
    'predictionId',prediction,'discoveryMode',mode);
  insert into private.item_action_receipts(id,actor_user_id,profile_id,item_id,command,before_state,
    previous_action_id,reverses_action_id,result,list_id,before_list_entry)
    values(action_id,actor,target_profile,target_item,request,state_before,previous_head,reversed_id,response,target_list,entry_before);
  if target_item is not null and changed then
    delete from private.item_action_heads where profile_id=target_profile and item_id=target_item;
    previous_head := case when kind='UNDO_LIST_ENTRY' then reversed.previous_action_id else action_id end;
    if previous_head is not null then
      insert into private.item_action_heads(profile_id,item_id,action_id) values(target_profile,target_item,previous_head);
    end if;
  end if;
  return response;
end;
$$;
notify pgrst, 'reload schema';
