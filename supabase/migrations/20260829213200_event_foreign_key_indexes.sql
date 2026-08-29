drop index public.events_item_occurred_at_idx;

create index events_item_occurred_at_idx
  on public.events (item_id, item_type, occurred_at desc, id);

drop index public.events_session_occurred_at_idx;

create index events_session_occurred_at_idx
  on public.events (
    session_id,
    actor_user_id,
    profile_id,
    occurred_at,
    id
  );
