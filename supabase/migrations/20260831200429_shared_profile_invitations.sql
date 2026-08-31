create table public.profile_invitations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  invited_user_id uuid not null references public.users (id) on delete cascade,
  invited_by_user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint profile_invitations_profile_user_key unique (profile_id, invited_user_id),
  constraint profile_invitations_not_self check (invited_user_id <> invited_by_user_id)
);

create index profile_invitations_invited_user_id_idx
  on public.profile_invitations (invited_user_id, created_at desc);

create index profile_invitations_invited_by_user_id_idx
  on public.profile_invitations (invited_by_user_id);

alter table public.profile_invitations enable row level security;

revoke all on table public.profile_invitations from anon, authenticated;

create policy profile_invitations_select_invited
on public.profile_invitations
for select
to authenticated
using (invited_user_id = (select auth.uid()));

create function private.invite_shared_profile_member(
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

create function private.get_my_shared_profile_invitations()
returns table (
  invitation_id uuid,
  profile_id uuid,
  profile_name text,
  inviter_user_id uuid,
  inviter_nickname text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    invitation.id,
    invitation.profile_id,
    shared_profile.name,
    invitation.invited_by_user_id,
    inviter.nickname,
    invitation.created_at
  from public.profile_invitations as invitation
  join public.profiles as shared_profile
    on shared_profile.id = invitation.profile_id
    and shared_profile.profile_type = 'SHARED'
  join public.users as inviter
    on inviter.id = invitation.invited_by_user_id
  where invitation.invited_user_id = (select auth.uid())
    and (select auth.uid()) is not null
  order by invitation.created_at desc, invitation.id;
$$;

create function private.respond_shared_profile_invitation(
  target_invitation_id uuid,
  input_accept boolean
)
returns table (
  invitation_id uuid,
  profile_id uuid,
  profile_name text,
  accepted boolean,
  member_count integer,
  is_ready boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  invited_profile_id uuid;
  invited_profile_name text;
  current_member_count integer;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_invitation_id is null or input_accept is null then
    raise exception 'Invitation response is required' using errcode = '22023';
  end if;

  select invitation.profile_id, shared_profile.name
  into invited_profile_id, invited_profile_name
  from public.profile_invitations as invitation
  join public.profiles as shared_profile
    on shared_profile.id = invitation.profile_id
  where invitation.id = target_invitation_id
    and invitation.invited_user_id = authenticated_user_id
  for update of invitation;

  if invited_profile_id is null then
    raise exception 'Shared profile invitation not found' using errcode = 'P0002';
  end if;

  if input_accept then
    insert into public.profile_members (profile_id, user_id)
    values (invited_profile_id, authenticated_user_id)
    on conflict on constraint profile_members_pkey do nothing;
  end if;

  delete from public.profile_invitations as pending
  where pending.id = target_invitation_id
    and pending.invited_user_id = authenticated_user_id;

  select count(*)::integer
  into current_member_count
  from public.profile_members as membership
  where membership.profile_id = invited_profile_id;

  return query
  select
    target_invitation_id,
    invited_profile_id,
    invited_profile_name,
    input_accept,
    current_member_count,
    current_member_count >= 2;
end;
$$;

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
language sql
volatile
security definer
set search_path = ''
as $$
  select
    invitation.profile_id,
    invitation.invited_user_id,
    invitation.nickname,
    invitation.member_count,
    invitation.is_ready,
    invitation.invitation_created
  from private.invite_shared_profile_member(
    target_profile_id,
    input_nickname
  ) as invitation;
$$;

revoke all on function private.invite_shared_profile_member(uuid, text)
  from public, anon, authenticated;
revoke all on function private.get_my_shared_profile_invitations()
  from public, anon, authenticated;
revoke all on function private.respond_shared_profile_invitation(uuid, boolean)
  from public, anon, authenticated;

grant execute on function private.invite_shared_profile_member(uuid, text)
  to authenticated;
grant execute on function private.get_my_shared_profile_invitations()
  to authenticated;
grant execute on function private.respond_shared_profile_invitation(uuid, boolean)
  to authenticated;

create function public.invite_shared_profile_member(
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
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.invite_shared_profile_member(
    target_profile_id,
    input_nickname
  );
$$;

create function public.get_my_shared_profile_invitations()
returns table (
  invitation_id uuid,
  profile_id uuid,
  profile_name text,
  inviter_user_id uuid,
  inviter_nickname text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_my_shared_profile_invitations();
$$;

create function public.respond_shared_profile_invitation(
  target_invitation_id uuid,
  input_accept boolean
)
returns table (
  invitation_id uuid,
  profile_id uuid,
  profile_name text,
  accepted boolean,
  member_count integer,
  is_ready boolean
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.respond_shared_profile_invitation(
    target_invitation_id,
    input_accept
  );
$$;

revoke all on function public.invite_shared_profile_member(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_my_shared_profile_invitations()
  from public, anon, authenticated;
revoke all on function public.respond_shared_profile_invitation(uuid, boolean)
  from public, anon, authenticated;

grant execute on function public.invite_shared_profile_member(uuid, text)
  to authenticated;
grant execute on function public.get_my_shared_profile_invitations()
  to authenticated;
grant execute on function public.respond_shared_profile_invitation(uuid, boolean)
  to authenticated;
