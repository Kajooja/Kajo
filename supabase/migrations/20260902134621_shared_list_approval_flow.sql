create table public.shared_item_list_proposals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  list_id uuid not null references public.item_lists (id) on delete cascade,
  proposed_by_user_id uuid not null references public.users (id) on delete cascade,
  proposed_at timestamptz not null default now(),
  completed_by_user_id uuid references public.users (id) on delete set null,
  completed_at timestamptz,
  constraint shared_item_list_proposals_pkey
    primary key (profile_id, item_id),
  constraint shared_item_list_proposals_completion_pair
    check (
      (completed_by_user_id is null and completed_at is null)
      or (completed_by_user_id is not null and completed_at is not null)
    )
);

create index shared_item_list_proposals_list_id_idx
  on public.shared_item_list_proposals (list_id);

create index shared_item_list_proposals_proposer_idx
  on public.shared_item_list_proposals (proposed_by_user_id);

alter table public.shared_item_list_proposals enable row level security;

revoke all on table public.shared_item_list_proposals from anon, authenticated;
grant select on table public.shared_item_list_proposals to authenticated;

create policy shared_item_list_proposals_select_for_member
on public.shared_item_list_proposals
for select
to authenticated
using ((select private.is_profile_member(profile_id)));

-- Preserve already-created Shared custom-list intent as a pending approval.
insert into public.shared_item_list_proposals (
  profile_id,
  item_id,
  list_id,
  proposed_by_user_id,
  proposed_at
)
select distinct on (item_list.profile_id, entry.item_id)
  item_list.profile_id,
  entry.item_id,
  item_list.id,
  entry.added_by_user_id,
  entry.added_at
from public.item_list_entries as entry
join public.item_lists as item_list
  on item_list.id = entry.list_id
join public.profiles as profile
  on profile.id = item_list.profile_id
join public.shared_item_endorsements as endorsement
  on endorsement.profile_id = item_list.profile_id
 and endorsement.item_id = entry.item_id
 and endorsement.actor_user_id = entry.added_by_user_id
left join public.item_interactions as interaction
  on interaction.profile_id = item_list.profile_id
 and interaction.item_id = entry.item_id
where profile.profile_type = 'SHARED'
  and item_list.list_kind = 'CUSTOM'
  and entry.added_by_user_id is not null
  and not coalesce(interaction.saved, false)
order by
  item_list.profile_id,
  entry.item_id,
  entry.added_at desc,
  item_list.id
on conflict on constraint shared_item_list_proposals_pkey do nothing;

delete from public.item_list_entries as entry
using public.item_lists as item_list,
      public.shared_item_list_proposals as proposal
where entry.list_id = item_list.id
  and proposal.profile_id = item_list.profile_id
  and proposal.item_id = entry.item_id
  and item_list.profile_id = proposal.profile_id
  and item_list.list_kind = 'CUSTOM';

-- Retire pre-list pending endorsement state. Append-only Events remain intact.
delete from public.shared_item_endorsements as endorsement
where not exists (
    select 1
    from public.item_interactions as interaction
    where interaction.profile_id = endorsement.profile_id
      and interaction.item_id = endorsement.item_id
      and interaction.saved
  )
  and not exists (
    select 1
    from public.shared_item_list_proposals as proposal
    where proposal.profile_id = endorsement.profile_id
      and proposal.item_id = endorsement.item_id
  );

create function private.guard_shared_custom_list_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entry_source = 'DIRECT'
     and exists (
       select 1
       from public.item_lists as item_list
       join public.profiles as profile
         on profile.id = item_list.profile_id
       where item_list.id = new.list_id
         and item_list.list_kind = 'CUSTOM'
         and profile.profile_type = 'SHARED'
     ) then
    raise exception 'Shared custom List addition requires member approval'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_shared_custom_list_entry()
  from public, anon, authenticated;

create trigger item_list_entries_guard_shared_custom_add
before insert or update of list_id, entry_source on public.item_list_entries
for each row execute function private.guard_shared_custom_list_entry();

create function private.clean_pending_shared_list_approval_for_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.shared_item_endorsements as endorsement
  using public.shared_item_list_proposals as proposal
  where proposal.list_id = old.id
    and proposal.completed_at is null
    and endorsement.profile_id = proposal.profile_id
    and endorsement.item_id = proposal.item_id;

  return old;
end;
$$;

revoke all on function private.clean_pending_shared_list_approval_for_list()
  from public, anon, authenticated;

create trigger item_lists_clean_pending_shared_approval
before delete on public.item_lists
for each row execute function private.clean_pending_shared_list_approval_for_list();

create function private.clean_pending_shared_list_approval_for_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.shared_item_endorsements as endorsement
  using public.shared_item_list_proposals as proposal
  where proposal.profile_id = old.profile_id
    and proposal.proposed_by_user_id = old.user_id
    and proposal.completed_at is null
    and endorsement.profile_id = proposal.profile_id
    and endorsement.item_id = proposal.item_id;

  delete from public.shared_item_list_proposals as proposal
  where proposal.profile_id = old.profile_id
    and proposal.proposed_by_user_id = old.user_id
    and proposal.completed_at is null;

  return old;
end;
$$;

revoke all on function private.clean_pending_shared_list_approval_for_member()
  from public, anon, authenticated;

create trigger profile_members_clean_pending_shared_approval
before delete on public.profile_members
for each row execute function private.clean_pending_shared_list_approval_for_member();

create function private.endorse_shared_list_item(
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
  from private.endorse_shared_item(target_profile_id, target_item_id);

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

revoke all on function private.endorse_shared_list_item(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.endorse_shared_list_item(uuid, uuid, uuid)
  to authenticated;

create function public.endorse_shared_list_item(
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
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.endorse_shared_list_item(
    target_profile_id,
    target_item_id,
    target_list_id
  );
$$;

revoke all on function public.endorse_shared_list_item(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.endorse_shared_list_item(uuid, uuid, uuid)
  to authenticated;

drop function public.get_shared_discovery_overlay(uuid, text);
drop function private.get_shared_discovery_overlay(uuid, text);

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
    join public.item_interactions as interaction
      on interaction.profile_id = personal_profile.id
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
