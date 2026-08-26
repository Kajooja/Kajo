create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_nickname_not_blank check (btrim(nickname) <> '')
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  profile_type text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_profile_type_valid check (profile_type in ('PERSONAL', 'SHARED')),
  constraint profiles_name_not_blank check (btrim(name) <> '')
);

create table public.profile_members (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);

create index profile_members_user_id_idx
  on public.profile_members (user_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null,
  title text not null,
  description text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_item_type_valid check (item_type in ('BOOK', 'MOVIE')),
  constraint items_title_not_blank check (btrim(title) <> ''),
  constraint items_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create table public.item_interactions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  actor_user_id uuid not null references public.users (id) on delete restrict,
  interest text,
  saved boolean not null default false,
  consumed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, item_id),
  constraint item_interactions_interest_valid
    check (interest is null or interest in ('LIKED', 'DISLIKED'))
);

create index item_interactions_actor_user_id_idx
  on public.item_interactions (actor_user_id);

create index item_interactions_item_id_idx
  on public.item_interactions (item_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function private.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger items_set_updated_at
before update on public.items
for each row execute function private.set_updated_at();

create trigger item_interactions_set_updated_at
before update on public.item_interactions
for each row execute function private.set_updated_at();

create function private.is_profile_member(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_members
    where profile_id = target_profile_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.is_profile_member(uuid) from public, anon, authenticated;
grant execute on function private.is_profile_member(uuid) to authenticated;

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_members enable row level security;
alter table public.items enable row level security;
alter table public.item_interactions enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.profile_members from anon, authenticated;
revoke all on table public.items from anon, authenticated;
revoke all on table public.item_interactions from anon, authenticated;

grant select, update on table public.users to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.profile_members to authenticated;
grant select on table public.items to authenticated;
grant select, insert, update, delete on table public.item_interactions to authenticated;

create policy users_select_own
on public.users
for select
to authenticated
using ((select auth.uid()) = id);

create policy users_update_own
on public.users
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy profiles_select_for_member
on public.profiles
for select
to authenticated
using ((select private.is_profile_member(id)));

create policy profile_members_select_for_member
on public.profile_members
for select
to authenticated
using ((select private.is_profile_member(profile_id)));

create policy items_select_authenticated
on public.items
for select
to authenticated
using (true);

create policy item_interactions_select_for_member
on public.item_interactions
for select
to authenticated
using ((select private.is_profile_member(profile_id)));

create policy item_interactions_insert_for_member
on public.item_interactions
for insert
to authenticated
with check (
  (select private.is_profile_member(profile_id))
  and actor_user_id = (select auth.uid())
);

create policy item_interactions_update_for_member
on public.item_interactions
for update
to authenticated
using ((select private.is_profile_member(profile_id)))
with check (
  (select private.is_profile_member(profile_id))
  and actor_user_id = (select auth.uid())
);

create policy item_interactions_delete_for_member
on public.item_interactions
for delete
to authenticated
using ((select private.is_profile_member(profile_id)));
