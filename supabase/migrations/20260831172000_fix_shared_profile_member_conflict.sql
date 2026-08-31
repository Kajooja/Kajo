create or replace function private.add_shared_profile_member(
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
  on conflict on constraint profile_members_pkey do nothing;

  get diagnostics affected_rows = row_count;
  membership_added := affected_rows > 0;

  select count(*)::integer
  into current_member_count
  from public.profile_members as membership
  where membership.profile_id = target_profile_id;

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
