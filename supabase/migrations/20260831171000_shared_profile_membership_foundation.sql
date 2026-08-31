create function private.create_shared_profile(input_name text)
returns table (
  profile_id uuid,
  profile_name text,
  member_count integer,
  is_ready boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  normalized_name text := regexp_replace(
    btrim(input_name),
    '[[:space:]]+',
    ' ',
    'g'
  );
  created_profile_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_name is null
    or char_length(normalized_name) not between 2 and 64
    or normalized_name ~ '[[:cntrl:]]'
  then
    raise exception 'Shared profile name must contain 2 to 64 valid characters'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users
    where id = authenticated_user_id
  ) then
    raise exception 'Kajo user identity is required' using errcode = '42501';
  end if;

  insert into public.profiles (profile_type, name, owner_user_id)
  values ('SHARED', normalized_name, null)
  returning id into created_profile_id;

  insert into public.profile_members (profile_id, user_id)
  values (created_profile_id, authenticated_user_id);

  return query
  select
    shared_profile.id,
    shared_profile.name,
    1,
    false
  from public.profiles as shared_profile
  where shared_profile.id = created_profile_id;
end;
$$;

create function private.add_shared_profile_member(
  target_profile_id uuid,
  input_nickname text
)
returns table (
  profile_id uuid,
  user_id uuid,
  nickname text,
  member_count integer,
  is_ready boolean,
  added boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  normalized_nickname text := lower(btrim(input_nickname));
  target_user_id uuid;
  target_nickname text;
  affected_rows integer := 0;
  membership_added boolean := false;
  current_member_count integer;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null then
    raise exception 'Shared profile is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = target_profile_id
      and profile_type = 'SHARED'
  ) then
    raise exception 'Shared profile not found' using errcode = 'P0002';
  end if;

  if not (select private.is_profile_member(target_profile_id)) then
    raise exception 'Shared profile access denied' using errcode = '42501';
  end if;

  if normalized_nickname is null
    or char_length(normalized_nickname) not between 2 and 32
  then
    raise exception 'Nickname must contain 2 to 32 characters'
      using errcode = '22023';
  end if;

  select app_user.id, app_user.nickname
  into target_user_id, target_nickname
  from public.users as app_user
  where lower(btrim(app_user.nickname)) = normalized_nickname
  limit 1;

  if target_user_id is null then
    raise exception 'Kajo user not found' using errcode = 'P0002';
  end if;

  insert into public.profile_members (profile_id, user_id)
  values (target_profile_id, target_user_id)
  on conflict (profile_id, user_id) do nothing;

  get diagnostics affected_rows = row_count;
  membership_added := affected_rows > 0;

  select count(*)::integer
  into current_member_count
  from public.profile_members
  where profile_id = target_profile_id;

  return query
  select
    target_profile_id,
    target_user_id,
    target_nickname,
    current_member_count,
    current_member_count >= 2,
    membership_added;
end;
$$;

create function private.get_my_shared_profiles()
returns table (
  profile_id uuid,
  profile_name text,
  member_count integer,
  is_ready boolean,
  members jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    shared_profile.id,
    shared_profile.name,
    count(all_members.user_id)::integer as member_count,
    count(all_members.user_id) >= 2 as is_ready,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId', member_user.id,
          'nickname', member_user.nickname
        )
        order by lower(member_user.nickname), member_user.id
      ) filter (where member_user.id is not null),
      '[]'::jsonb
    ) as members
  from public.profiles as shared_profile
  join public.profile_members as my_membership
    on my_membership.profile_id = shared_profile.id
    and my_membership.user_id = (select auth.uid())
  left join public.profile_members as all_members
    on all_members.profile_id = shared_profile.id
  left join public.users as member_user
    on member_user.id = all_members.user_id
  where (select auth.uid()) is not null
    and shared_profile.profile_type = 'SHARED'
  group by shared_profile.id, shared_profile.name
  order by lower(shared_profile.name), shared_profile.id;
$$;

revoke all on function private.create_shared_profile(text)
  from public, anon, authenticated;
revoke all on function private.add_shared_profile_member(uuid, text)
  from public, anon, authenticated;
revoke all on function private.get_my_shared_profiles()
  from public, anon, authenticated;

grant execute on function private.create_shared_profile(text) to authenticated;
grant execute on function private.add_shared_profile_member(uuid, text) to authenticated;
grant execute on function private.get_my_shared_profiles() to authenticated;

create function public.create_shared_profile(input_name text)
returns table (
  profile_id uuid,
  profile_name text,
  member_count integer,
  is_ready boolean
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.create_shared_profile(input_name);
$$;

create function public.add_shared_profile_member(
  target_profile_id uuid,
  input_nickname text
)
returns table (
  profile_id uuid,
  user_id uuid,
  nickname text,
  member_count integer,
  is_ready boolean,
  added boolean
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.add_shared_profile_member(target_profile_id, input_nickname);
$$;

create function public.get_my_shared_profiles()
returns table (
  profile_id uuid,
  profile_name text,
  member_count integer,
  is_ready boolean,
  members jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_my_shared_profiles();
$$;

revoke all on function public.create_shared_profile(text)
  from public, anon, authenticated;
revoke all on function public.add_shared_profile_member(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_my_shared_profiles()
  from public, anon, authenticated;

grant execute on function public.create_shared_profile(text) to authenticated;
grant execute on function public.add_shared_profile_member(uuid, text) to authenticated;
grant execute on function public.get_my_shared_profiles() to authenticated;
