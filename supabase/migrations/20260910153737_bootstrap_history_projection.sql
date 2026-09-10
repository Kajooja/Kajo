-- #228/#229: one read projection for native and initial-profile history.
-- No Events or mutable interactions are synthesized from bootstrap evidence.
-- Writes, receipts, Memory policy and deployed migration history stay unchanged.
create function private.profile_item_state_projection_v1(target_profile_id uuid)
returns table (
  item_id uuid,
  interest text,
  saved boolean,
  consumed boolean,
  rating integer,
  not_interested boolean,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bootstrap as (
    select distinct on (evidence.item_id)
      evidence.item_id, evidence.rating,
      coalesce(evidence.source_occurred_at, evidence.imported_at) as occurred_at
    from private.profile_bootstrap_evidence as evidence
    join public.profiles as profile on profile.id = evidence.profile_id
    where evidence.profile_id = target_profile_id
      and profile.profile_type = 'PERSONAL'
      and evidence.active
      and evidence.imported_at <= now()
      and evidence.evidence_kind in ('RATED', 'CONSUMED')
    order by evidence.item_id,
      case evidence.evidence_kind when 'RATED' then 3 else 2 end desc,
      evidence.source_occurred_at desc nulls last,
      evidence.imported_at desc,
      evidence.id
  ), native as (
    select interaction.* from public.item_interactions as interaction
    where interaction.profile_id = target_profile_id
  )
  select coalesce(native.item_id, bootstrap.item_id),
    native.interest,
    coalesce(native.saved, false),
    coalesce(native.consumed, false) or native.rating is not null or bootstrap.item_id is not null,
    coalesce(native.rating::integer, bootstrap.rating),
    coalesce(native.not_interested, false),
    case when native.consumed or native.rating is not null then native.updated_at
      else coalesce(bootstrap.occurred_at, native.updated_at) end
  from native full join bootstrap on bootstrap.item_id = native.item_id;
$$;

-- Only authorized owner/member boundaries below may call the internal projection.
revoke all on function private.profile_item_state_projection_v1(uuid)
  from public, anon, authenticated, service_role;

create function private.get_profile_item_states_v1(target_profile_id uuid)
returns table (
  item_id uuid,
  interest text,
  saved boolean,
  consumed boolean,
  rating integer,
  not_interested boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profile_members as membership
    where membership.profile_id = target_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;
  return query select state.*
    from private.profile_item_state_projection_v1(target_profile_id) as state
    order by state.item_id;
end;
$$;
revoke all on function private.get_profile_item_states_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.get_profile_item_states_v1(uuid) to authenticated;

create function public.get_profile_item_states_v1(target_profile_id uuid)
returns table (
  item_id uuid,
  interest text,
  saved boolean,
  consumed boolean,
  rating integer,
  not_interested boolean,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_profile_item_states_v1(target_profile_id);
$$;
revoke all on function public.get_profile_item_states_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_profile_item_states_v1(uuid) to authenticated;

create or replace function private.get_profile_consumed_items(
  target_profile_id uuid,
  requested_item_type text default null
)
returns table (
  profile_id uuid,
  item_id uuid,
  item_type text,
  title text,
  description text,
  tags text[],
  saved boolean,
  consumed boolean,
  rating integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if requested_item_type is not null
     and requested_item_type not in ('BOOK', 'MOVIE') then
    raise exception 'Unsupported item type' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = target_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;

  return query
  select
    target_profile_id,
    item.id,
    item.item_type,
    item.title,
    item.description,
    item.tags,
    interaction.saved,
    interaction.consumed,
    interaction.rating::integer,
    interaction.updated_at
  from private.profile_item_state_projection_v1(target_profile_id) as interaction
  join public.items as item
    on item.id = interaction.item_id
  where (interaction.consumed or interaction.rating is not null)
    and (requested_item_type is null or item.item_type = requested_item_type)
  order by interaction.updated_at desc, interaction.item_id;
end;
$$;

create or replace function private.get_item_list_entries(target_list_id uuid)
returns table (
  list_id uuid,
  profile_id uuid,
  list_kind text,
  list_name text,
  item_id uuid,
  item_type text,
  title text,
  description text,
  tags text[],
  added_by_user_id uuid,
  added_by_nickname text,
  added_at timestamptz,
  saved boolean,
  consumed boolean,
  rating integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  owned_profile_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select item_list.profile_id
  into owned_profile_id
  from public.item_lists as item_list
  where item_list.id = target_list_id;

  if owned_profile_id is null then
    raise exception 'List not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = owned_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;

  return query
  select
    item_list.id,
    item_list.profile_id,
    item_list.list_kind,
    item_list.name,
    item.id,
    item.item_type,
    item.title,
    item.description,
    item.tags,
    entry.added_by_user_id,
    added_by.nickname,
    entry.added_at,
    coalesce(interaction.saved, false),
    coalesce(interaction.consumed, false),
    interaction.rating::integer
  from public.item_lists as item_list
  join public.item_list_entries as entry
    on entry.list_id = item_list.id
  join public.items as item
    on item.id = entry.item_id
  left join public.users as added_by
    on added_by.id = entry.added_by_user_id
  left join private.profile_item_state_projection_v1(owned_profile_id) as interaction
    on interaction.item_id = entry.item_id
  where item_list.id = target_list_id
  order by entry.added_at desc, entry.item_id;
end;
$$;

create or replace function private.get_shared_discovery_overlay(
  target_profile_id uuid,
  requested_item_type text default null
)
returns table (
  item_id uuid,
  item_type text,
  title text,
  description text,
  tags text[],
  ineligible_for_discovery boolean,
  member_consumed_user_ids uuid[],
  member_max_rating integer,
  current_actor_endorsed boolean,
  pending_endorsement boolean,
  consensus_saved boolean,
  endorser_user_ids uuid[],
  first_endorsed_at timestamptz,
  proposed_list_id uuid,
  proposed_list_name text,
  proposed_by_user_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null then
    raise exception 'Shared profile is required' using errcode = '22023';
  end if;

  if requested_item_type is not null
     and requested_item_type not in ('BOOK', 'MOVIE') then
    raise exception 'Unsupported item type' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as shared_profile
    where shared_profile.id = target_profile_id
      and shared_profile.profile_type = 'SHARED'
  ) then
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

  return query
  with accepted_members as (
    select membership.user_id
    from public.profile_members as membership
    where membership.profile_id = target_profile_id
  ),
  member_history as (
    select
      interaction.item_id,
      array_agg(member.user_id order by member.user_id) as consumed_user_ids,
      max(interaction.rating)::integer as max_rating
    from accepted_members as member
    join public.profiles as personal_profile
      on personal_profile.owner_user_id = member.user_id
     and personal_profile.profile_type = 'PERSONAL'
    cross join lateral private.profile_item_state_projection_v1(personal_profile.id) as interaction
    where interaction.consumed
       or interaction.rating is not null
    group by interaction.item_id
  ),
  current_endorsements as (
    select
      endorsement.item_id,
      bool_or(endorsement.actor_user_id = authenticated_user_id)
        as actor_endorsed,
      array_agg(
        endorsement.actor_user_id
        order by endorsement.endorsed_at, endorsement.actor_user_id
      ) as actor_user_ids,
      min(endorsement.endorsed_at) as first_endorsed_at,
      count(*)::integer as endorsement_count
    from public.shared_item_endorsements as endorsement
    join accepted_members as member
      on member.user_id = endorsement.actor_user_id
    where endorsement.profile_id = target_profile_id
    group by endorsement.item_id
  ),
  accepted_member_count as (
    select count(*)::integer as value
    from accepted_members
  )
  select
    item.id,
    item.item_type,
    item.title,
    item.description,
    item.tags,
    coalesce(shared_interaction.consumed, false)
      or shared_interaction.rating is not null,
    coalesce(member_history.consumed_user_ids, array[]::uuid[]),
    member_history.max_rating,
    coalesce(current_endorsements.actor_endorsed, false),
    proposal.item_id is not null
      and coalesce(current_endorsements.endorsement_count, 0) > 0
      and not coalesce(shared_interaction.saved, false)
      and current_endorsements.endorsement_count < accepted_member_count.value,
    coalesce(shared_interaction.saved, false),
    coalesce(current_endorsements.actor_user_ids, array[]::uuid[]),
    current_endorsements.first_endorsed_at,
    proposal.list_id,
    proposed_list.name,
    proposal.proposed_by_user_id
  from public.items as item
  cross join accepted_member_count
  left join member_history
    on member_history.item_id = item.id
  left join public.item_interactions as shared_interaction
    on shared_interaction.profile_id = target_profile_id
   and shared_interaction.item_id = item.id
  left join current_endorsements
    on current_endorsements.item_id = item.id
  left join public.shared_item_list_proposals as proposal
    on proposal.profile_id = target_profile_id
   and proposal.item_id = item.id
   and proposal.completed_at is null
  left join public.item_lists as proposed_list
    on proposed_list.id = proposal.list_id
   and proposed_list.profile_id = proposal.profile_id
   and proposed_list.list_kind = 'CUSTOM'
  where requested_item_type is null
     or item.item_type = requested_item_type
  order by item.id;
end;
$$;
