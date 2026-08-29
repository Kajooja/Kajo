alter table public.events
drop constraint events_event_type_valid;

alter table public.events
add constraint events_event_type_valid
check (
  event_type in (
    'ITEM_IMPRESSION',
    'ITEM_OPENED',
    'ITEM_DWELL',
    'ITEM_LIKED',
    'ITEM_DISLIKED',
    'ITEM_INTEREST_CLEARED',
    'ITEM_SAVED',
    'ITEM_UNSAVED',
    'ITEM_SUGGESTED',
    'ITEM_CONSUMED',
    'ITEM_CONSUMPTION_REVERSED',
    'ITEM_INTERACTION_UNDONE',
    'ITEM_RATED',
    'SEARCH_PERFORMED',
    'DISCOVERY_MODE_CHANGED'
  )
);
