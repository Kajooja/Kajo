create function private.get_shared_discovery_overlay(
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
  current_actor_endorsed boolean,
  pending_endorsement boolean,
  consensus_saved boolean,
  endorser_user_ids uuid[],
  first_endorsed_at timestamptz
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
    select distinct interaction.item_id
    from accepted_members as member
    join public.profiles as personal_profile
      on personal_profile.owner_user_id = member.user_id
     and personal_profile.profile_type = 'PERSONAL'
    join public.item_interactions as interaction
      on interaction.profile_id = personal_profile.id
    where interaction.consumed
       or interaction.rating is not null
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
    member_history.item_id is not null
      or coalesce(shared_interaction.consumed, false)
      or shared_interaction.rating is not null,
    coalesce(current_endorsements.actor_endorsed, false),
    coalesce(current_endorsements.endorsement_count, 0) > 0
      and not coalesce(shared_interaction.saved, false)
      and current_endorsements.endorsement_count
        < accepted_member_count.value,
    coalesce(shared_interaction.saved, false),
    coalesce(current_endorsements.actor_user_ids, array[]::uuid[]),
    current_endorsements.first_endorsed_at
  from public.items as item
  cross join accepted_member_count
  left join member_history
    on member_history.item_id = item.id
  left join public.item_interactions as shared_interaction
    on shared_interaction.profile_id = target_profile_id
   and shared_interaction.item_id = item.id
  left join current_endorsements
    on current_endorsements.item_id = item.id
  where requested_item_type is null
     or item.item_type = requested_item_type
  order by item.id;
end;
$$;

revoke all on function private.get_shared_discovery_overlay(uuid, text)
  from public, anon, authenticated;
grant execute on function private.get_shared_discovery_overlay(uuid, text)
  to authenticated;

create function public.get_shared_discovery_overlay(
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
  current_actor_endorsed boolean,
  pending_endorsement boolean,
  consensus_saved boolean,
  endorser_user_ids uuid[],
  first_endorsed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_shared_discovery_overlay(
    target_profile_id,
    requested_item_type
  );
$$;

revoke all on function public.get_shared_discovery_overlay(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_shared_discovery_overlay(uuid, text)
  to authenticated;
