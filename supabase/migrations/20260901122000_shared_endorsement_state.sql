create table public.shared_item_endorsements (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  actor_user_id uuid not null references public.users (id) on delete cascade,
  endorsed_at timestamptz not null default now(),
  constraint shared_item_endorsements_pkey
    primary key (profile_id, item_id, actor_user_id)
);

create index shared_item_endorsements_profile_item_time_idx
  on public.shared_item_endorsements (profile_id, item_id, endorsed_at);

create index shared_item_endorsements_actor_user_id_idx
  on public.shared_item_endorsements (actor_user_id);

alter table public.shared_item_endorsements enable row level security;

revoke all on table public.shared_item_endorsements from anon, authenticated;
grant select on table public.shared_item_endorsements to authenticated;

create policy shared_item_endorsements_select_for_member
on public.shared_item_endorsements
for select
to authenticated
using ((select private.is_profile_member(profile_id)));

alter table public.events
drop constraint events_event_type_valid;

alter table public.events
add constraint events_event_type_valid
check (
  event_type in (
    'ITEM_IMPRESSION',
    'ITEM_OPENED',
    'ITEM_DWELL',
    'ITEM_LIKED',
    'ITEM_DISLIKED',
    'ITEM_INTEREST_CLEARED',
    'ITEM_NOT_INTERESTED',
    'ITEM_SAVED',
    'ITEM_UNSAVED',
    'ITEM_SUGGESTED',
    'ITEM_ENDORSED',
    'ITEM_ENDORSEMENT_REVERSED',
    'ITEM_CONSUMED',
    'ITEM_CONSUMPTION_REVERSED',
    'ITEM_INTERACTION_UNDONE',
    'ITEM_RATED',
    'SEARCH_PERFORMED',
    'DISCOVERY_MODE_CHANGED'
  )
);

create function private.endorse_shared_item(
  target_profile_id uuid,
  target_item_id uuid
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
  consensus_saved boolean
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function private.endorse_shared_item(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.endorse_shared_item(uuid, uuid)
  to authenticated;

create function public.endorse_shared_item(
  target_profile_id uuid,
  target_item_id uuid
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
  consensus_saved boolean
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.endorse_shared_item(
    target_profile_id,
    target_item_id
  );
$$;

revoke all on function public.endorse_shared_item(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.endorse_shared_item(uuid, uuid)
  to authenticated;

create function private.reverse_shared_item_endorsement(
  target_profile_id uuid,
  target_item_id uuid
)
returns table (
  profile_id uuid,
  item_id uuid,
  actor_user_id uuid,
  endorsement_reversed boolean,
  endorsement_count integer,
  required_member_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  current_member_count integer;
  current_endorsement_count integer;
  endorsement_was_reversed boolean := false;
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

  select coalesce(interaction.saved, false)
  into shared_is_saved
  from public.item_interactions as interaction
  where interaction.profile_id = target_profile_id
    and interaction.item_id = target_item_id;

  if coalesce(shared_is_saved, false) then
    raise exception 'Consensus endorsement cannot be reversed here'
      using errcode = '55000';
  end if;

  delete from public.shared_item_endorsements as endorsement
  where endorsement.profile_id = target_profile_id
    and endorsement.item_id = target_item_id
    and endorsement.actor_user_id = authenticated_user_id;

  endorsement_was_reversed := found;

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
    target_profile_id,
    target_item_id,
    authenticated_user_id,
    endorsement_was_reversed,
    current_endorsement_count,
    current_member_count;
end;
$$;

revoke all on function private.reverse_shared_item_endorsement(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.reverse_shared_item_endorsement(uuid, uuid)
  to authenticated;

create function public.reverse_shared_item_endorsement(
  target_profile_id uuid,
  target_item_id uuid
)
returns table (
  profile_id uuid,
  item_id uuid,
  actor_user_id uuid,
  endorsement_reversed boolean,
  endorsement_count integer,
  required_member_count integer
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.reverse_shared_item_endorsement(
    target_profile_id,
    target_item_id
  );
$$;

revoke all on function public.reverse_shared_item_endorsement(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reverse_shared_item_endorsement(uuid, uuid)
  to authenticated;

create or replace function private.leave_shared_profile(target_profile_id uuid)
returns table (
  profile_id uuid,
  profile_name text,
  remaining_member_count integer,
  profile_deleted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  leaving_profile_name text;
  current_member_count integer;
  deleted_profile boolean := false;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null then
    raise exception 'Shared profile is required' using errcode = '22023';
  end if;

  select shared_profile.name
  into leaving_profile_name
  from public.profiles as shared_profile
  where shared_profile.id = target_profile_id
    and shared_profile.profile_type = 'SHARED'
  for update;

  if leaving_profile_name is null then
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

  delete from public.profile_invitations as pending
  where pending.profile_id = target_profile_id
    and (
      pending.invited_by_user_id = authenticated_user_id
      or pending.invited_user_id = authenticated_user_id
    );

  delete from public.shared_item_endorsements as endorsement
  where endorsement.profile_id = target_profile_id
    and endorsement.actor_user_id = authenticated_user_id;

  delete from public.profile_members as membership
  where membership.profile_id = target_profile_id
    and membership.user_id = authenticated_user_id;

  select count(*)::integer
  into current_member_count
  from public.profile_members as membership
  where membership.profile_id = target_profile_id;

  if current_member_count = 0 then
    delete from public.profiles as shared_profile
    where shared_profile.id = target_profile_id
      and shared_profile.profile_type = 'SHARED';
    deleted_profile := true;
  end if;

  return query
  select
    target_profile_id,
    leaving_profile_name,
    current_member_count,
    deleted_profile;
end;
$$;

revoke all on function private.leave_shared_profile(uuid)
  from public, anon, authenticated;
grant execute on function private.leave_shared_profile(uuid)
  to authenticated;
