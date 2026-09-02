create table public.item_lists (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  list_kind text not null,
  name text not null,
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_lists_kind_valid
    check (list_kind in ('SYSTEM_SAVED', 'CUSTOM')),
  constraint item_lists_name_length
    check (char_length(btrim(name)) between 1 and 40),
  constraint item_lists_system_name
    check (list_kind <> 'SYSTEM_SAVED' or name = 'Tallennetut'),
  constraint item_lists_custom_creator
    check (list_kind <> 'CUSTOM' or created_by_user_id is not null)
);

create unique index item_lists_one_system_saved_per_profile_idx
  on public.item_lists (profile_id)
  where list_kind = 'SYSTEM_SAVED';

create unique index item_lists_profile_name_ci_idx
  on public.item_lists (profile_id, lower(btrim(name)));

create index item_lists_created_by_user_id_idx
  on public.item_lists (created_by_user_id)
  where created_by_user_id is not null;

create table public.item_list_entries (
  list_id uuid not null references public.item_lists (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  added_by_user_id uuid references public.users (id) on delete set null,
  added_at timestamptz not null default now(),
  entry_source text not null default 'DIRECT',
  constraint item_list_entries_pkey primary key (list_id, item_id),
  constraint item_list_entries_source_valid
    check (
      entry_source in (
        'DIRECT',
        'SAVED_PROJECTION',
        'SAVED_BACKFILL',
        'SHARED_CONSENSUS'
      )
    ),
  constraint item_list_entries_direct_actor
    check (entry_source <> 'DIRECT' or added_by_user_id is not null)
);

create index item_list_entries_item_id_idx
  on public.item_list_entries (item_id);

create index item_list_entries_added_by_user_id_idx
  on public.item_list_entries (added_by_user_id)
  where added_by_user_id is not null;

alter table public.item_lists enable row level security;
alter table public.item_list_entries enable row level security;

revoke all on table public.item_lists from anon, authenticated;
revoke all on table public.item_list_entries from anon, authenticated;

grant select on table public.item_lists to authenticated;
grant select on table public.item_list_entries to authenticated;

create policy item_lists_select_for_member
on public.item_lists
for select
to authenticated
using ((select private.is_profile_member(profile_id)));

create policy item_list_entries_select_for_member
on public.item_list_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.item_lists as owned_list
    where owned_list.id = item_list_entries.list_id
      and (select private.is_profile_member(owned_list.profile_id))
  )
);

create trigger item_lists_set_updated_at
before update on public.item_lists
for each row execute function private.set_updated_at();

create function private.ensure_system_saved_list(
  target_profile_id uuid,
  source_user_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  system_list_id uuid;
  profile_owner_user_id uuid;
  resolved_creator_user_id uuid;
begin
  select profile.owner_user_id
  into profile_owner_user_id
  from public.profiles as profile
  where profile.id = target_profile_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  resolved_creator_user_id := profile_owner_user_id;

  if resolved_creator_user_id is null
     and source_user_id is not null
     and exists (
       select 1
       from public.profile_members as membership
       where membership.profile_id = target_profile_id
         and membership.user_id = source_user_id
     ) then
    resolved_creator_user_id := source_user_id;
  end if;

  insert into public.item_lists (
    profile_id,
    list_kind,
    name,
    created_by_user_id
  )
  values (
    target_profile_id,
    'SYSTEM_SAVED',
    'Tallennetut',
    resolved_creator_user_id
  )
  on conflict (profile_id) where list_kind = 'SYSTEM_SAVED' do nothing
  returning id into system_list_id;

  if system_list_id is null then
    select item_list.id
    into system_list_id
    from public.item_lists as item_list
    where item_list.profile_id = target_profile_id
      and item_list.list_kind = 'SYSTEM_SAVED';
  end if;

  return system_list_id;
end;
$$;

revoke all on function private.ensure_system_saved_list(uuid, uuid)
  from public, anon, authenticated;

insert into public.item_lists (
  profile_id,
  list_kind,
  name,
  created_by_user_id,
  created_at,
  updated_at
)
select
  profile.id,
  'SYSTEM_SAVED',
  'Tallennetut',
  profile.owner_user_id,
  profile.created_at,
  profile.updated_at
from public.profiles as profile
on conflict (profile_id) where list_kind = 'SYSTEM_SAVED' do nothing;

insert into public.item_list_entries (
  list_id,
  item_id,
  added_by_user_id,
  added_at,
  entry_source
)
select
  system_list.id,
  interaction.item_id,
  case
    when profile.profile_type = 'PERSONAL' then
      coalesce(saved_event.actor_user_id, interaction.actor_user_id)
    else saved_event.actor_user_id
  end,
  coalesce(saved_event.occurred_at, interaction.updated_at),
  'SAVED_BACKFILL'
from public.item_interactions as interaction
join public.profiles as profile
  on profile.id = interaction.profile_id
join public.item_lists as system_list
  on system_list.profile_id = interaction.profile_id
 and system_list.list_kind = 'SYSTEM_SAVED'
left join lateral (
  select event.actor_user_id, event.occurred_at
  from public.events as event
  where event.profile_id = interaction.profile_id
    and event.item_id = interaction.item_id
    and event.event_type = 'ITEM_SAVED'
  order by event.occurred_at desc, event.id desc
  limit 1
) as saved_event on true
where interaction.saved
on conflict on constraint item_list_entries_pkey do nothing;

create function private.create_system_saved_list_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_system_saved_list(
    new.id,
    coalesce(new.owner_user_id, (select auth.uid()))
  );
  return new;
end;
$$;

revoke all on function private.create_system_saved_list_for_profile()
  from public, anon, authenticated;

create trigger profiles_create_system_saved_list
after insert on public.profiles
for each row execute function private.create_system_saved_list_for_profile();

create function private.sync_system_saved_list_from_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  system_list_id uuid;
  source_kind text;
begin
  if tg_op = 'DELETE' then
    select item_list.id
    into system_list_id
    from public.item_lists as item_list
    where item_list.profile_id = old.profile_id
      and item_list.list_kind = 'SYSTEM_SAVED';

    if system_list_id is not null then
      delete from public.item_list_entries as entry
      where entry.list_id = system_list_id
        and entry.item_id = old.item_id;
    end if;

    return old;
  end if;

  if new.saved
     and (tg_op = 'INSERT' or not coalesce(old.saved, false)) then
    system_list_id := private.ensure_system_saved_list(
      new.profile_id,
      new.actor_user_id
    );

    source_kind := case
      when exists (
        select 1
        from public.profiles as profile
        where profile.id = new.profile_id
          and profile.profile_type = 'SHARED'
      ) then 'SHARED_CONSENSUS'
      else 'SAVED_PROJECTION'
    end;

    insert into public.item_list_entries (
      list_id,
      item_id,
      added_by_user_id,
      entry_source
    )
    values (
      system_list_id,
      new.item_id,
      new.actor_user_id,
      source_kind
    )
    on conflict on constraint item_list_entries_pkey do nothing;
  elsif not new.saved
        and tg_op = 'UPDATE'
        and coalesce(old.saved, false) then
    select item_list.id
    into system_list_id
    from public.item_lists as item_list
    where item_list.profile_id = new.profile_id
      and item_list.list_kind = 'SYSTEM_SAVED';

    if system_list_id is not null then
      delete from public.item_list_entries as entry
      where entry.list_id = system_list_id
        and entry.item_id = new.item_id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_system_saved_list_from_interaction()
  from public, anon, authenticated;

create trigger item_interactions_sync_system_saved_list
after insert or update or delete on public.item_interactions
for each row execute function private.sync_system_saved_list_from_interaction();

create function private.get_profile_item_lists(
  target_profile_id uuid,
  target_item_id uuid default null
)
returns table (
  list_id uuid,
  profile_id uuid,
  list_kind text,
  name text,
  item_count integer,
  contains_item boolean,
  created_at timestamptz,
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

  if target_profile_id is null then
    raise exception 'Profile is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = target_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;

  if target_item_id is not null
     and not exists (
       select 1 from public.items as item where item.id = target_item_id
     ) then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  return query
  select
    item_list.id,
    item_list.profile_id,
    item_list.list_kind,
    item_list.name,
    count(entry.item_id)::integer,
    coalesce(bool_or(entry.item_id = target_item_id), false),
    item_list.created_at,
    item_list.updated_at
  from public.item_lists as item_list
  left join public.item_list_entries as entry
    on entry.list_id = item_list.id
  where item_list.profile_id = target_profile_id
  group by item_list.id
  order by
    case when item_list.list_kind = 'SYSTEM_SAVED' then 0 else 1 end,
    lower(item_list.name),
    item_list.id;
end;
$$;

revoke all on function private.get_profile_item_lists(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.get_profile_item_lists(uuid, uuid)
  to authenticated;

create function public.get_profile_item_lists(
  target_profile_id uuid,
  target_item_id uuid default null
)
returns table (
  list_id uuid,
  profile_id uuid,
  list_kind text,
  name text,
  item_count integer,
  contains_item boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_profile_item_lists(target_profile_id, target_item_id);
$$;

revoke all on function public.get_profile_item_lists(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_profile_item_lists(uuid, uuid)
  to authenticated;

create function private.create_custom_item_list(
  target_profile_id uuid,
  requested_name text
)
returns table (
  list_id uuid,
  profile_id uuid,
  list_kind text,
  name text,
  item_count integer,
  contains_item boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  normalized_name text := btrim(requested_name);
  created_list_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null then
    raise exception 'Profile is required' using errcode = '22023';
  end if;

  if normalized_name is null
     or char_length(normalized_name) not between 1 and 40 then
    raise exception 'List name must be 1-40 characters' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = target_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;

  insert into public.item_lists (
    profile_id,
    list_kind,
    name,
    created_by_user_id
  )
  values (
    target_profile_id,
    'CUSTOM',
    normalized_name,
    authenticated_user_id
  )
  returning id into created_list_id;

  return query
  select
    item_list.id,
    item_list.profile_id,
    item_list.list_kind,
    item_list.name,
    0,
    false,
    item_list.created_at,
    item_list.updated_at
  from public.item_lists as item_list
  where item_list.id = created_list_id;
exception
  when unique_violation then
    raise exception 'List name already exists' using errcode = '23505';
end;
$$;

revoke all on function private.create_custom_item_list(uuid, text)
  from public, anon, authenticated;
grant execute on function private.create_custom_item_list(uuid, text)
  to authenticated;

create function public.create_custom_item_list(
  target_profile_id uuid,
  requested_name text
)
returns table (
  list_id uuid,
  profile_id uuid,
  list_kind text,
  name text,
  item_count integer,
  contains_item boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.create_custom_item_list(target_profile_id, requested_name);
$$;

revoke all on function public.create_custom_item_list(uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_custom_item_list(uuid, text)
  to authenticated;

create function private.rename_custom_item_list(
  target_list_id uuid,
  requested_name text
)
returns table (
  list_id uuid,
  profile_id uuid,
  list_kind text,
  name text,
  item_count integer,
  contains_item boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  normalized_name text := btrim(requested_name);
  owned_profile_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_list_id is null then
    raise exception 'List is required' using errcode = '22023';
  end if;

  if normalized_name is null
     or char_length(normalized_name) not between 1 and 40 then
    raise exception 'List name must be 1-40 characters' using errcode = '22023';
  end if;

  select item_list.profile_id
  into owned_profile_id
  from public.item_lists as item_list
  where item_list.id = target_list_id
    and item_list.list_kind = 'CUSTOM'
  for update;

  if owned_profile_id is null then
    raise exception 'Custom list not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = owned_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;

  update public.item_lists as item_list
  set name = normalized_name
  where item_list.id = target_list_id;

  return query
  select
    item_list.id,
    item_list.profile_id,
    item_list.list_kind,
    item_list.name,
    count(entry.item_id)::integer,
    false,
    item_list.created_at,
    item_list.updated_at
  from public.item_lists as item_list
  left join public.item_list_entries as entry
    on entry.list_id = item_list.id
  where item_list.id = target_list_id
  group by item_list.id;
exception
  when unique_violation then
    raise exception 'List name already exists' using errcode = '23505';
end;
$$;

revoke all on function private.rename_custom_item_list(uuid, text)
  from public, anon, authenticated;
grant execute on function private.rename_custom_item_list(uuid, text)
  to authenticated;

create function public.rename_custom_item_list(
  target_list_id uuid,
  requested_name text
)
returns table (
  list_id uuid,
  profile_id uuid,
  list_kind text,
  name text,
  item_count integer,
  contains_item boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.rename_custom_item_list(target_list_id, requested_name);
$$;

revoke all on function public.rename_custom_item_list(uuid, text)
  from public, anon, authenticated;
grant execute on function public.rename_custom_item_list(uuid, text)
  to authenticated;

create function private.delete_custom_item_list(target_list_id uuid)
returns boolean
language plpgsql
volatile
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
  where item_list.id = target_list_id
    and item_list.list_kind = 'CUSTOM'
  for update;

  if owned_profile_id is null then
    raise exception 'Custom list not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = owned_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;

  delete from public.item_lists as item_list
  where item_list.id = target_list_id;

  return found;
end;
$$;

revoke all on function private.delete_custom_item_list(uuid)
  from public, anon, authenticated;
grant execute on function private.delete_custom_item_list(uuid)
  to authenticated;

create function public.delete_custom_item_list(target_list_id uuid)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.delete_custom_item_list(target_list_id);
$$;

revoke all on function public.delete_custom_item_list(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_custom_item_list(uuid)
  to authenticated;

create function private.set_item_list_destinations(
  target_profile_id uuid,
  target_item_id uuid,
  target_list_ids uuid[]
)
returns table (
  list_ids uuid[],
  system_saved boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  target_profile_type text;
  normalized_list_ids uuid[];
  requested_system_saved boolean := false;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null or target_item_id is null then
    raise exception 'Profile and item are required' using errcode = '22023';
  end if;

  select profile.profile_type
  into target_profile_type
  from public.profiles as profile
  where profile.id = target_profile_id
  for update;

  if target_profile_type is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = target_profile_id
      and membership.user_id = authenticated_user_id
  ) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.items as item where item.id = target_item_id
  ) then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct requested_id order by requested_id), array[]::uuid[])
  into normalized_list_ids
  from unnest(coalesce(target_list_ids, array[]::uuid[])) as requested(requested_id);

  if exists (
    select 1
    from unnest(normalized_list_ids) as requested(requested_id)
    left join public.item_lists as item_list
      on item_list.id = requested.requested_id
     and item_list.profile_id = target_profile_id
    where item_list.id is null
  ) then
    raise exception 'List does not belong to Profile' using errcode = '42501';
  end if;

  if target_profile_type = 'SHARED'
     and exists (
       select 1
       from public.item_lists as item_list
       where item_list.id = any(normalized_list_ids)
         and item_list.list_kind = 'SYSTEM_SAVED'
     ) then
    raise exception 'Shared Tallennetut requires consensus' using errcode = '42501';
  end if;

  delete from public.item_list_entries as entry
  using public.item_lists as item_list
  where entry.list_id = item_list.id
    and item_list.profile_id = target_profile_id
    and item_list.list_kind = 'CUSTOM'
    and entry.item_id = target_item_id
    and not (entry.list_id = any(normalized_list_ids));

  insert into public.item_list_entries (
    list_id,
    item_id,
    added_by_user_id,
    entry_source
  )
  select
    item_list.id,
    target_item_id,
    authenticated_user_id,
    'DIRECT'
  from public.item_lists as item_list
  where item_list.profile_id = target_profile_id
    and item_list.list_kind = 'CUSTOM'
    and item_list.id = any(normalized_list_ids)
  on conflict on constraint item_list_entries_pkey do nothing;

  if target_profile_type = 'PERSONAL' then
    select exists (
      select 1
      from public.item_lists as item_list
      where item_list.profile_id = target_profile_id
        and item_list.list_kind = 'SYSTEM_SAVED'
        and item_list.id = any(normalized_list_ids)
    ) into requested_system_saved;

    if requested_system_saved then
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
        updated_at = now();
    else
      update public.item_interactions as interaction
      set
        actor_user_id = authenticated_user_id,
        saved = false,
        updated_at = now()
      where interaction.profile_id = target_profile_id
        and interaction.item_id = target_item_id
        and interaction.saved;

      delete from public.item_list_entries as entry
      using public.item_lists as item_list
      where entry.list_id = item_list.id
        and item_list.profile_id = target_profile_id
        and item_list.list_kind = 'SYSTEM_SAVED'
        and entry.item_id = target_item_id;
    end if;
  end if;

  return query
  select
    coalesce(array_agg(entry.list_id order by entry.list_id), array[]::uuid[]),
    coalesce(bool_or(item_list.list_kind = 'SYSTEM_SAVED'), false)
  from public.item_list_entries as entry
  join public.item_lists as item_list
    on item_list.id = entry.list_id
  where item_list.profile_id = target_profile_id
    and entry.item_id = target_item_id;
end;
$$;

revoke all on function private.set_item_list_destinations(uuid, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function private.set_item_list_destinations(uuid, uuid, uuid[])
  to authenticated;

create function public.set_item_list_destinations(
  target_profile_id uuid,
  target_item_id uuid,
  target_list_ids uuid[]
)
returns table (
  list_ids uuid[],
  system_saved boolean
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.set_item_list_destinations(
    target_profile_id,
    target_item_id,
    target_list_ids
  );
$$;

revoke all on function public.set_item_list_destinations(uuid, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.set_item_list_destinations(uuid, uuid, uuid[])
  to authenticated;

create function private.set_item_list_entry(
  target_list_id uuid,
  target_item_id uuid,
  requested_present boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  owned_profile_id uuid;
  owned_profile_type text;
  owned_list_kind text;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_list_id is null or target_item_id is null or requested_present is null then
    raise exception 'List, item and requested state are required' using errcode = '22023';
  end if;

  select item_list.profile_id, profile.profile_type, item_list.list_kind
  into owned_profile_id, owned_profile_type, owned_list_kind
  from public.item_lists as item_list
  join public.profiles as profile
    on profile.id = item_list.profile_id
  where item_list.id = target_list_id
  for update;

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

  if not exists (
    select 1 from public.items as item where item.id = target_item_id
  ) then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  if owned_profile_type = 'SHARED' and owned_list_kind = 'SYSTEM_SAVED' then
    raise exception 'Shared Tallennetut requires consensus' using errcode = '42501';
  end if;

  if owned_list_kind = 'SYSTEM_SAVED' then
    if requested_present then
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
        owned_profile_id,
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
        updated_at = now();
    else
      update public.item_interactions as interaction
      set
        actor_user_id = authenticated_user_id,
        saved = false,
        updated_at = now()
      where interaction.profile_id = owned_profile_id
        and interaction.item_id = target_item_id
        and interaction.saved;

      delete from public.item_list_entries as entry
      where entry.list_id = target_list_id
        and entry.item_id = target_item_id;
    end if;

    return requested_present;
  end if;

  if requested_present then
    insert into public.item_list_entries (
      list_id,
      item_id,
      added_by_user_id,
      entry_source
    )
    values (
      target_list_id,
      target_item_id,
      authenticated_user_id,
      'DIRECT'
    )
    on conflict on constraint item_list_entries_pkey do nothing;
  else
    delete from public.item_list_entries as entry
    where entry.list_id = target_list_id
      and entry.item_id = target_item_id;
  end if;

  return requested_present;
end;
$$;

revoke all on function private.set_item_list_entry(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function private.set_item_list_entry(uuid, uuid, boolean)
  to authenticated;

create function public.set_item_list_entry(
  target_list_id uuid,
  target_item_id uuid,
  requested_present boolean
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.set_item_list_entry(
    target_list_id,
    target_item_id,
    requested_present
  );
$$;

revoke all on function public.set_item_list_entry(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_item_list_entry(uuid, uuid, boolean)
  to authenticated;

create function private.get_item_list_entries(target_list_id uuid)
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
  left join public.item_interactions as interaction
    on interaction.profile_id = item_list.profile_id
   and interaction.item_id = entry.item_id
  where item_list.id = target_list_id
  order by entry.added_at desc, entry.item_id;
end;
$$;

revoke all on function private.get_item_list_entries(uuid)
  from public, anon, authenticated;
grant execute on function private.get_item_list_entries(uuid)
  to authenticated;

create function public.get_item_list_entries(target_list_id uuid)
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
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_item_list_entries(target_list_id);
$$;

revoke all on function public.get_item_list_entries(uuid)
  from public, anon, authenticated;
grant execute on function public.get_item_list_entries(uuid)
  to authenticated;

create function private.get_profile_consumed_items(
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
    interaction.profile_id,
    item.id,
    item.item_type,
    item.title,
    item.description,
    item.tags,
    interaction.saved,
    interaction.consumed,
    interaction.rating::integer,
    interaction.updated_at
  from public.item_interactions as interaction
  join public.items as item
    on item.id = interaction.item_id
  where interaction.profile_id = target_profile_id
    and (interaction.consumed or interaction.rating is not null)
    and (requested_item_type is null or item.item_type = requested_item_type)
  order by interaction.updated_at desc, interaction.item_id;
end;
$$;

revoke all on function private.get_profile_consumed_items(uuid, text)
  from public, anon, authenticated;
grant execute on function private.get_profile_consumed_items(uuid, text)
  to authenticated;

create function public.get_profile_consumed_items(
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
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_profile_consumed_items(
    target_profile_id,
    requested_item_type
  );
$$;

revoke all on function public.get_profile_consumed_items(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_profile_consumed_items(uuid, text)
  to authenticated;

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
    'ITEM_ADDED_TO_LIST',
    'ITEM_REMOVED_FROM_LIST',
    'LIST_CREATED',
    'LIST_RENAMED',
    'LIST_DELETED',
    'SEARCH_PERFORMED',
    'DISCOVERY_MODE_CHANGED'
  )
);
