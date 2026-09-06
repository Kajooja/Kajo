-- Keep the platform RLS event trigger active, but remove its SECURITY DEFINER
-- implementation from the Data API's exposed public schema.
alter function public.rls_auto_enable() set schema private;

revoke all on function private.rls_auto_enable()
  from public, anon, authenticated, service_role;

-- Preserve the mobile RPC contract while keeping privileged reads behind a
-- checked private implementation. The public wrapper executes as the caller.
create or replace function private.get_my_personal_profile()
returns table (
  user_id uuid,
  nickname text,
  profile_id uuid,
  profile_name text
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
  where app_user.id = authenticated_user_id;
end;
$$;

revoke all on function private.get_my_personal_profile()
  from public, anon, authenticated, service_role;
grant execute on function private.get_my_personal_profile()
  to authenticated;

create or replace function public.get_my_personal_profile()
returns table (
  user_id uuid,
  nickname text,
  profile_id uuid,
  profile_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_my_personal_profile();
$$;

revoke all on function public.get_my_personal_profile()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_personal_profile()
  to authenticated;

-- New Data API objects start closed. Every future migration must grant only
-- the table, sequence and RPC privileges that its authenticated flow needs.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;
