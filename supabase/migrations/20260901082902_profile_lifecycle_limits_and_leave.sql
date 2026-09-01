alter table public.users drop constraint users_nickname_length;
alter table public.users add constraint users_nickname_length check (
  char_length(btrim(nickname)) between 2 and 24
);

alter table public.profiles add constraint profiles_shared_name_length check (
  profile_type <> 'SHARED' or char_length(btrim(name)) between 2 and 32
);

create or replace function private.complete_personal_profile(input_nickname text)
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
    or char_length(normalized_nickname) not between 2 and 24
  then
    raise exception 'Nickname must contain 2 to 24 characters'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.users as app_user
    where lower(btrim(app_user.nickname)) = lower(normalized_nickname)
      and app_user.id <> authenticated_user_id
  ) then
    raise exception 'Nickname already exists' using errcode = '23505';
  end if;

  insert into public.users (id, nickname)
  values (authenticated_user_id, normalized_nickname)
  on conflict (id) do update
  set nickname = excluded.nickname;

  select profile.id
  into personal_profile_id
  from public.profiles as profile
  where profile.owner_user_id = authenticated_user_id
    and profile.profile_type = 'PERSONAL'
  limit 1;

  if personal_profile_id is null then
    insert into public.profiles (profile_type, name, owner_user_id)
    values ('PERSONAL', normalized_nickname, authenticated_user_id)
    returning id into personal_profile_id;
  else
    update public.profiles as profile
    set name = normalized_nickname
    where profile.id = personal_profile_id;
  end if;

  insert into public.profile_members (profile_id, user_id)
  values (personal_profile_id, authenticated_user_id)
  on conflict on constraint profile_members_pkey do nothing;

  return query
  select
    app_user.id,
    app_user.nickname,
    profile.id,
    profile.name
  from public.users as app_user
  join public.profiles as profile
    on profile.id = personal_profile_id
  where app_user.id = authenticated_user_id;
end;
$$;

revoke all on function private.complete_personal_profile(text)
  from public, anon, authenticated;
grant execute on function private.complete_personal_profile(text)
  to authenticated;

create or replace function public.complete_personal_profile(input_nickname text)
returns table (
  user_id uuid,
  nickname text,
  profile_id uuid,
  profile_name text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.complete_personal_profile(input_nickname);
$$;

revoke all on function public.complete_personal_profile(text)
  from public, anon, authenticated;
grant execute on function public.complete_personal_profile(text)
  to authenticated;

create or replace function private.provision_personal_profile_from_auth_user()
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

  if char_length(requested_nickname) not between 2 and 24 then
    raise exception 'Nickname must contain 2 to 24 characters'
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

create or replace function private.create_shared_profile(input_name text)
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
    or char_length(normalized_name) not between 2 and 32
    or normalized_name ~ '[[:cntrl:]]'
  then
    raise exception 'Shared profile name must contain 2 to 32 valid characters'
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

create or replace function private.invite_shared_profile_member(
  target_profile_id uuid,
  input_nickname text
)
returns table (
  profile_id uuid,
  invitation_id uuid,
  invited_user_id uuid,
  nickname text,
  member_count integer,
  is_ready boolean,
  invitation_created boolean,
  already_member boolean
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
  current_member_count integer;
  created_invitation_id uuid;
  invitation_was_created boolean := false;
  is_existing_member boolean;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null then
    raise exception 'Shared profile is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as shared_profile
    where shared_profile.id = target_profile_id
      and shared_profile.profile_type = 'SHARED'
  ) then
    raise exception 'Shared profile not found' using errcode = 'P0002';
  end if;

  if not (select private.is_profile_member(target_profile_id)) then
    raise exception 'Shared profile access denied' using errcode = '42501';
  end if;

  if normalized_nickname is null
    or char_length(normalized_nickname) not between 2 and 24
  then
    raise exception 'Nickname must contain 2 to 24 characters'
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

  if target_user_id = authenticated_user_id then
    raise exception 'Cannot invite yourself' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.profile_members as membership
    where membership.profile_id = target_profile_id
      and membership.user_id = target_user_id
  ) into is_existing_member;

  select count(*)::integer
  into current_member_count
  from public.profile_members as membership
  where membership.profile_id = target_profile_id;

  if is_existing_member then
    delete from public.profile_invitations as pending
    where pending.profile_id = target_profile_id
      and pending.invited_user_id = target_user_id;

    return query
    select
      target_profile_id,
      null::uuid,
      target_user_id,
      target_nickname,
      current_member_count,
      current_member_count >= 2,
      false,
      true;
    return;
  end if;

  insert into public.profile_invitations (
    profile_id,
    invited_user_id,
    invited_by_user_id
  )
  values (
    target_profile_id,
    target_user_id,
    authenticated_user_id
  )
  on conflict on constraint profile_invitations_profile_user_key do nothing
  returning public.profile_invitations.id into created_invitation_id;

  invitation_was_created := created_invitation_id is not null;

  if not invitation_was_created then
    select pending.id
    into created_invitation_id
    from public.profile_invitations as pending
    where pending.profile_id = target_profile_id
      and pending.invited_user_id = target_user_id;
  end if;

  return query
  select
    target_profile_id,
    created_invitation_id,
    target_user_id,
    target_nickname,
    current_member_count,
    current_member_count >= 2,
    invitation_was_created,
    false;
end;
$$;

create function private.leave_shared_profile(target_profile_id uuid)
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

create function public.leave_shared_profile(target_profile_id uuid)
returns table (
  profile_id uuid,
  profile_name text,
  remaining_member_count integer,
  profile_deleted boolean
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.leave_shared_profile(target_profile_id);
$$;

revoke all on function public.leave_shared_profile(uuid)
  from public, anon, authenticated;
grant execute on function public.leave_shared_profile(uuid)
  to authenticated;
