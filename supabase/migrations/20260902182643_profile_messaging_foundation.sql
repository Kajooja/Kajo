create table public.profile_messages (
  id uuid primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  actor_user_id uuid not null references public.users (id) on delete restrict,
  body text not null,
  list_id uuid references public.item_lists (id) on delete set null,
  item_id uuid references public.items (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint profile_messages_body_length
    check (char_length(btrim(body)) between 1 and 500),
  constraint profile_messages_body_plain_text
    check (body !~ '[[:cntrl:]]')
);

create index profile_messages_profile_created_idx
  on public.profile_messages (profile_id, created_at desc, id desc);

create index profile_messages_actor_user_id_idx
  on public.profile_messages (actor_user_id);

create index profile_messages_list_id_idx
  on public.profile_messages (list_id)
  where list_id is not null;

create index profile_messages_item_id_idx
  on public.profile_messages (item_id)
  where item_id is not null;

create table public.profile_message_read_states (
  profile_id uuid not null,
  user_id uuid not null,
  last_read_at timestamptz not null default '1970-01-01 00:00:00+00',
  updated_at timestamptz not null default now(),
  constraint profile_message_read_states_pkey primary key (profile_id, user_id),
  constraint profile_message_read_states_membership_fkey
    foreign key (profile_id, user_id)
    references public.profile_members (profile_id, user_id)
    on delete cascade
);

create index profile_message_read_states_user_id_idx
  on public.profile_message_read_states (user_id);

alter table public.profile_messages enable row level security;
alter table public.profile_message_read_states enable row level security;

revoke all on table public.profile_messages from anon, authenticated;
revoke all on table public.profile_message_read_states from anon, authenticated;

grant select on table public.profile_messages to authenticated;
grant select on table public.profile_message_read_states to authenticated;

create policy profile_messages_select_for_member
on public.profile_messages
for select
to authenticated
using ((select private.is_profile_member(profile_id)));

create policy profile_message_read_states_select_own
on public.profile_message_read_states
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_profile_member(profile_id))
);

create function private.send_profile_message(
  target_profile_id uuid,
  requested_message_id uuid,
  requested_body text,
  referenced_list_id uuid default null,
  referenced_item_id uuid default null
)
returns table (
  message_id uuid,
  profile_id uuid,
  actor_user_id uuid,
  actor_nickname text,
  body text,
  list_id uuid,
  list_name text,
  item_id uuid,
  item_title text,
  created_at timestamptz,
  created boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  normalized_body text := btrim(requested_body);
  inserted boolean := false;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null or requested_message_id is null then
    raise exception 'Profile and message ID are required' using errcode = '22023';
  end if;

  if not (select private.is_profile_member(target_profile_id)) then
    raise exception 'Profile message access denied' using errcode = '42501';
  end if;

  if normalized_body is null
     or char_length(normalized_body) not between 1 and 500
     or normalized_body ~ '[[:cntrl:]]' then
    raise exception 'Message must contain 1 to 500 valid characters'
      using errcode = '22023';
  end if;

  if referenced_list_id is not null
     and not exists (
       select 1
       from public.item_lists as item_list
       where item_list.id = referenced_list_id
         and item_list.profile_id = target_profile_id
     ) then
    raise exception 'Referenced Profile List not found' using errcode = 'P0002';
  end if;

  if referenced_item_id is not null
     and not exists (
       select 1
       from public.items as item
       where item.id = referenced_item_id
     ) then
    raise exception 'Referenced Item not found' using errcode = 'P0002';
  end if;

  insert into public.profile_messages (
    id,
    profile_id,
    actor_user_id,
    body,
    list_id,
    item_id
  )
  values (
    requested_message_id,
    target_profile_id,
    authenticated_user_id,
    normalized_body,
    referenced_list_id,
    referenced_item_id
  )
  on conflict on constraint profile_messages_pkey do nothing;

  inserted := found;

  if not inserted and not exists (
    select 1
    from public.profile_messages as existing
    where existing.id = requested_message_id
      and existing.profile_id = target_profile_id
      and existing.actor_user_id = authenticated_user_id
      and existing.body = normalized_body
      and existing.list_id is not distinct from referenced_list_id
      and existing.item_id is not distinct from referenced_item_id
  ) then
    raise exception 'Message ID already exists with different content'
      using errcode = '23505';
  end if;

  return query
  select
    message.id,
    message.profile_id,
    message.actor_user_id,
    app_user.nickname,
    message.body,
    message.list_id,
    item_list.name,
    message.item_id,
    item.title,
    message.created_at,
    inserted
  from public.profile_messages as message
  join public.users as app_user
    on app_user.id = message.actor_user_id
  left join public.item_lists as item_list
    on item_list.id = message.list_id
   and item_list.profile_id = message.profile_id
  left join public.items as item
    on item.id = message.item_id
  where message.id = requested_message_id;
end;
$$;

revoke all on function private.send_profile_message(uuid, uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.send_profile_message(uuid, uuid, text, uuid, uuid)
  to authenticated;

create function public.send_profile_message(
  target_profile_id uuid,
  requested_message_id uuid,
  requested_body text,
  referenced_list_id uuid default null,
  referenced_item_id uuid default null
)
returns table (
  message_id uuid,
  profile_id uuid,
  actor_user_id uuid,
  actor_nickname text,
  body text,
  list_id uuid,
  list_name text,
  item_id uuid,
  item_title text,
  created_at timestamptz,
  created boolean
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.send_profile_message(
    target_profile_id,
    requested_message_id,
    requested_body,
    referenced_list_id,
    referenced_item_id
  );
$$;

revoke all on function public.send_profile_message(uuid, uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.send_profile_message(uuid, uuid, text, uuid, uuid)
  to authenticated;

create function private.get_profile_messages(
  target_profile_id uuid,
  requested_limit integer default 50
)
returns table (
  message_id uuid,
  profile_id uuid,
  actor_user_id uuid,
  actor_nickname text,
  body text,
  list_id uuid,
  list_name text,
  item_id uuid,
  item_title text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  safe_limit integer := least(greatest(coalesce(requested_limit, 50), 1), 100);
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null then
    raise exception 'Profile is required' using errcode = '22023';
  end if;

  if not (select private.is_profile_member(target_profile_id)) then
    raise exception 'Profile message access denied' using errcode = '42501';
  end if;

  return query
  select
    recent.message_id,
    recent.profile_id,
    recent.actor_user_id,
    recent.actor_nickname,
    recent.body,
    recent.list_id,
    recent.list_name,
    recent.item_id,
    recent.item_title,
    recent.created_at
  from (
    select
      message.id as message_id,
      message.profile_id,
      message.actor_user_id,
      app_user.nickname as actor_nickname,
      message.body,
      message.list_id,
      item_list.name as list_name,
      message.item_id,
      item.title as item_title,
      message.created_at
    from public.profile_messages as message
    join public.users as app_user
      on app_user.id = message.actor_user_id
    left join public.item_lists as item_list
      on item_list.id = message.list_id
     and item_list.profile_id = message.profile_id
    left join public.items as item
      on item.id = message.item_id
    where message.profile_id = target_profile_id
    order by message.created_at desc, message.id desc
    limit safe_limit
  ) as recent
  order by recent.created_at, recent.message_id;
end;
$$;

revoke all on function private.get_profile_messages(uuid, integer)
  from public, anon, authenticated;
grant execute on function private.get_profile_messages(uuid, integer)
  to authenticated;

create function public.get_profile_messages(
  target_profile_id uuid,
  requested_limit integer default 50
)
returns table (
  message_id uuid,
  profile_id uuid,
  actor_user_id uuid,
  actor_nickname text,
  body text,
  list_id uuid,
  list_name text,
  item_id uuid,
  item_title text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_profile_messages(target_profile_id, requested_limit);
$$;

revoke all on function public.get_profile_messages(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_profile_messages(uuid, integer)
  to authenticated;

create function private.mark_profile_messages_read(
  target_profile_id uuid,
  read_through timestamptz default null
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  effective_read_at timestamptz := coalesce(read_through, now());
  stored_read_at timestamptz;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null then
    raise exception 'Profile is required' using errcode = '22023';
  end if;

  if not (select private.is_profile_member(target_profile_id)) then
    raise exception 'Profile message access denied' using errcode = '42501';
  end if;

  if effective_read_at > now() + interval '5 minutes' then
    raise exception 'Read cursor cannot be in the future' using errcode = '22023';
  end if;

  insert into public.profile_message_read_states (
    profile_id,
    user_id,
    last_read_at,
    updated_at
  )
  values (
    target_profile_id,
    authenticated_user_id,
    effective_read_at,
    now()
  )
  on conflict on constraint profile_message_read_states_pkey do update
  set
    last_read_at = greatest(
      public.profile_message_read_states.last_read_at,
      excluded.last_read_at
    ),
    updated_at = now()
  returning last_read_at into stored_read_at;

  return stored_read_at;
end;
$$;

revoke all on function private.mark_profile_messages_read(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function private.mark_profile_messages_read(uuid, timestamptz)
  to authenticated;

create function public.mark_profile_messages_read(
  target_profile_id uuid,
  read_through timestamptz default null
)
returns timestamptz
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.mark_profile_messages_read(target_profile_id, read_through);
$$;

revoke all on function public.mark_profile_messages_read(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mark_profile_messages_read(uuid, timestamptz)
  to authenticated;

create function private.get_profile_message_threads()
returns table (
  profile_id uuid,
  profile_type text,
  profile_name text,
  latest_message_id uuid,
  latest_actor_user_id uuid,
  latest_actor_nickname text,
  latest_body text,
  latest_list_id uuid,
  latest_list_name text,
  latest_item_id uuid,
  latest_item_title text,
  latest_created_at timestamptz,
  unread_count integer
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

  return query
  select
    profile.id,
    profile.profile_type,
    profile.name,
    latest.message_id,
    latest.actor_user_id,
    latest.actor_nickname,
    latest.body,
    latest.list_id,
    latest.list_name,
    latest.item_id,
    latest.item_title,
    latest.created_at,
    coalesce(unread.value, 0)::integer
  from public.profile_members as membership
  join public.profiles as profile
    on profile.id = membership.profile_id
  left join public.profile_message_read_states as read_state
    on read_state.profile_id = membership.profile_id
   and read_state.user_id = authenticated_user_id
  left join lateral (
    select
      message.id as message_id,
      message.actor_user_id,
      app_user.nickname as actor_nickname,
      message.body,
      message.list_id,
      item_list.name as list_name,
      message.item_id,
      item.title as item_title,
      message.created_at
    from public.profile_messages as message
    join public.users as app_user
      on app_user.id = message.actor_user_id
    left join public.item_lists as item_list
      on item_list.id = message.list_id
     and item_list.profile_id = message.profile_id
    left join public.items as item
      on item.id = message.item_id
    where message.profile_id = membership.profile_id
    order by message.created_at desc, message.id desc
    limit 1
  ) as latest on true
  left join lateral (
    select count(*)::integer as value
    from public.profile_messages as message
    where message.profile_id = membership.profile_id
      and message.actor_user_id <> authenticated_user_id
      and message.created_at > coalesce(
        read_state.last_read_at,
        '1970-01-01 00:00:00+00'::timestamptz
      )
  ) as unread on true
  where membership.user_id = authenticated_user_id
  order by
    (coalesce(unread.value, 0) > 0) desc,
    latest.created_at desc nulls last,
    lower(profile.name),
    profile.id;
end;
$$;

revoke all on function private.get_profile_message_threads()
  from public, anon, authenticated;
grant execute on function private.get_profile_message_threads()
  to authenticated;

create function public.get_profile_message_threads()
returns table (
  profile_id uuid,
  profile_type text,
  profile_name text,
  latest_message_id uuid,
  latest_actor_user_id uuid,
  latest_actor_nickname text,
  latest_body text,
  latest_list_id uuid,
  latest_list_name text,
  latest_item_id uuid,
  latest_item_title text,
  latest_created_at timestamptz,
  unread_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_profile_message_threads();
$$;

revoke all on function public.get_profile_message_threads()
  from public, anon, authenticated;
grant execute on function public.get_profile_message_threads()
  to authenticated;
