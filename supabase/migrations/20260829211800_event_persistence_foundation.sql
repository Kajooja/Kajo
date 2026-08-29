alter table public.items
add constraint items_id_item_type_key unique (id, item_type);

create table public.event_sessions (
  id uuid primary key,
  actor_user_id uuid not null
    references public.users (id) on delete cascade,
  profile_id uuid not null
    references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint event_sessions_identity_key
    unique (id, actor_user_id, profile_id),
  constraint event_sessions_context_is_object
    check (jsonb_typeof(context) = 'object')
);

create index event_sessions_profile_started_at_idx
  on public.event_sessions (profile_id, started_at desc, id);

create index event_sessions_actor_started_at_idx
  on public.event_sessions (actor_user_id, started_at desc, id);

create table public.events (
  id uuid primary key,
  actor_user_id uuid not null
    references public.users (id) on delete cascade,
  profile_id uuid not null
    references public.profiles (id) on delete cascade,
  item_id uuid,
  item_type text,
  event_type text not null,
  occurred_at timestamptz not null,
  session_id uuid,
  prediction_id uuid,
  discovery_mode text,
  context jsonb not null default '{}'::jsonb,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint events_item_identity_complete
    check (
      (item_id is null and item_type is null)
      or (item_id is not null and item_type is not null)
    ),
  constraint events_item_type_valid
    check (item_type is null or item_type in ('BOOK', 'MOVIE')),
  constraint events_event_type_valid
    check (
      event_type in (
        'ITEM_IMPRESSION',
        'ITEM_OPENED',
        'ITEM_DWELL',
        'ITEM_LIKED',
        'ITEM_DISLIKED',
        'ITEM_SAVED',
        'ITEM_UNSAVED',
        'ITEM_SUGGESTED',
        'ITEM_CONSUMED',
        'ITEM_RATED',
        'SEARCH_PERFORMED',
        'DISCOVERY_MODE_CHANGED'
      )
    ),
  constraint events_discovery_mode_valid
    check (
      discovery_mode is null
      or discovery_mode in ('FOR_YOU', 'SURPRISE', 'RISK')
    ),
  constraint events_context_is_object
    check (jsonb_typeof(context) = 'object'),
  constraint events_properties_is_object
    check (jsonb_typeof(properties) = 'object'),
  constraint events_item_identity_fkey
    foreign key (item_id, item_type)
    references public.items (id, item_type)
    on delete restrict,
  constraint events_session_identity_fkey
    foreign key (session_id, actor_user_id, profile_id)
    references public.event_sessions (id, actor_user_id, profile_id)
    on delete restrict
);

create index events_profile_occurred_at_idx
  on public.events (profile_id, occurred_at desc, id);

create index events_actor_occurred_at_idx
  on public.events (actor_user_id, occurred_at desc, id);

create index events_item_occurred_at_idx
  on public.events (item_id, occurred_at desc, id)
  where item_id is not null;

create index events_session_occurred_at_idx
  on public.events (session_id, occurred_at, id)
  where session_id is not null;

create index events_prediction_occurred_at_idx
  on public.events (prediction_id, occurred_at, id)
  where prediction_id is not null;

alter table public.event_sessions enable row level security;
alter table public.events enable row level security;

revoke all on table public.event_sessions from anon, authenticated;
revoke all on table public.events from anon, authenticated;

grant select, insert on table public.event_sessions to authenticated;
grant select, insert on table public.events to authenticated;

create policy event_sessions_select_for_member
on public.event_sessions
for select
to authenticated
using ((select private.is_profile_member(profile_id)));

create policy event_sessions_insert_for_member
on public.event_sessions
for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (select private.is_profile_member(profile_id))
);

create policy events_select_for_member
on public.events
for select
to authenticated
using ((select private.is_profile_member(profile_id)));

create policy events_insert_for_member
on public.events
for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (select private.is_profile_member(profile_id))
);
