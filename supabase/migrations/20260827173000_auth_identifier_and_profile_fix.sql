create unique index users_nickname_login_key_idx
  on public.users (lower(btrim(nickname)));

create function public.resolve_login_email(input_identifier text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select lower(btrim(input_identifier)) as value
  )
  select auth_user.email
  from auth.users as auth_user
  cross join normalized
  where lower(auth_user.email) = normalized.value
     or auth_user.id = (
       select app_user.id
       from public.users as app_user
       where lower(btrim(app_user.nickname)) = normalized.value
       limit 1
     )
  limit 1;
$$;

revoke all on function public.resolve_login_email(text)
  from public, anon, authenticated;
grant execute on function public.resolve_login_email(text) to service_role;

create or replace function public.complete_personal_profile(input_nickname text)
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

  if exists (
    select 1
    from public.users
    where lower(btrim(nickname)) = lower(normalized_nickname)
      and id <> authenticated_user_id
  ) then
    raise exception 'Nickname already exists' using errcode = '23505';
  end if;

  insert into public.users (id, nickname)
  values (authenticated_user_id, normalized_nickname)
  on conflict (id) do update
  set nickname = excluded.nickname;

  select id
  into personal_profile_id
  from public.profiles
  where owner_user_id = authenticated_user_id
    and profile_type = 'PERSONAL'
  limit 1;

  if personal_profile_id is null then
    insert into public.profiles (profile_type, name, owner_user_id)
    values ('PERSONAL', normalized_nickname, authenticated_user_id)
    returning id into personal_profile_id;
  else
    update public.profiles
    set name = normalized_nickname
    where id = personal_profile_id;
  end if;

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

revoke all on function public.complete_personal_profile(text)
  from public, anon, authenticated;
grant execute on function public.complete_personal_profile(text)
  to authenticated;

create function private.provision_personal_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_nickname text := regexp_replace(
    btrim(new.raw_user_meta_data ->> 'kajo_nickname'),
    '[[:space:]]+',
    ' ',
    'g'
  );
  personal_profile_id uuid;
begin
  if requested_nickname is null or requested_nickname = '' then
    return new;
  end if;

  if char_length(requested_nickname) not between 2 and 32 then
    raise exception 'Nickname must contain 2 to 32 characters'
      using errcode = '22023';
  end if;

  insert into public.users (id, nickname)
  values (new.id, requested_nickname);

  insert into public.profiles (profile_type, name, owner_user_id)
  values ('PERSONAL', requested_nickname, new.id)
  returning id into personal_profile_id;

  insert into public.profile_members (profile_id, user_id)
  values (personal_profile_id, new.id);

  return new;
end;
$$;

revoke all on function private.provision_personal_profile_from_auth_user()
  from public, anon, authenticated;

drop trigger if exists provision_kajo_personal_profile on auth.users;
create trigger provision_kajo_personal_profile
after insert on auth.users
for each row execute function private.provision_personal_profile_from_auth_user();
