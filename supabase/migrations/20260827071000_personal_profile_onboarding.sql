alter table public.profiles
add column owner_user_id uuid references public.users (id) on delete cascade;

alter table public.profiles
add constraint profiles_owner_matches_type
check (
  (profile_type = 'PERSONAL' and owner_user_id is not null)
  or (profile_type = 'SHARED' and owner_user_id is null)
);

create unique index profiles_one_personal_per_user_idx
  on public.profiles (owner_user_id)
  where profile_type = 'PERSONAL';

alter table public.users
add constraint users_nickname_length
check (char_length(btrim(nickname)) between 2 and 32);

alter table public.users
add constraint users_nickname_no_control_characters
check (nickname !~ '[[:cntrl:]]');

revoke update on table public.users from authenticated;
drop policy users_update_own on public.users;

create function public.get_my_personal_profile()
returns table (
  user_id uuid,
  nickname text,
  profile_id uuid,
  profile_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_user.id,
    app_user.nickname,
    personal_profile.id,
    personal_profile.name
  from public.users as app_user
  join public.profiles as personal_profile
    on personal_profile.owner_user_id = app_user.id
    and personal_profile.profile_type = 'PERSONAL'
  join public.profile_members as membership
    on membership.profile_id = personal_profile.id
    and membership.user_id = app_user.id
  where app_user.id = (select auth.uid());
$$;

create function public.complete_personal_profile(input_nickname text)
returns table (
  user_id uuid,
  nickname text,
  profile_id uuid,
  profile_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  normalized_nickname text := regexp_replace(
    btrim(input_nickname),
    '[[:space:]]+',
    ' ',
    'g'
  );
  personal_profile_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_nickname is null
    or char_length(normalized_nickname) not between 2 and 32
  then
    raise exception 'Nickname must contain 2 to 32 characters'
      using errcode = '22023';
  end if;

  insert into public.users (id, nickname)
  values (authenticated_user_id, normalized_nickname)
  on conflict (id) do update
  set nickname = excluded.nickname;

  insert into public.profiles (profile_type, name, owner_user_id)
  values ('PERSONAL', normalized_nickname, authenticated_user_id)
  on conflict (owner_user_id) where profile_type = 'PERSONAL'
  do update set name = excluded.name
  returning id into personal_profile_id;

  insert into public.profile_members (profile_id, user_id)
  values (personal_profile_id, authenticated_user_id)
  on conflict (profile_id, user_id) do nothing;

  return query
  select
    app_user.id,
    app_user.nickname,
    personal_profile.id,
    personal_profile.name
  from public.users as app_user
  join public.profiles as personal_profile
    on personal_profile.id = personal_profile_id
  where app_user.id = authenticated_user_id;
end;
$$;

revoke all on function public.get_my_personal_profile()
  from public, anon, authenticated;
revoke all on function public.complete_personal_profile(text)
  from public, anon, authenticated;

grant execute on function public.get_my_personal_profile() to authenticated;
grant execute on function public.complete_personal_profile(text) to authenticated;
