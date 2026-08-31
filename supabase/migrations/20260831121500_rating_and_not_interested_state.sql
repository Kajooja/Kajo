alter table public.item_interactions
add column rating smallint,
add column not_interested boolean not null default false;

update public.item_interactions
set not_interested = true
where interest = 'DISLIKED'
  and consumed = false;

alter table public.item_interactions
add constraint item_interactions_rating_valid
  check (rating is null or rating between 1 and 10),
add constraint item_interactions_rating_implies_consumed
  check (rating is null or (consumed and not not_interested)),
add constraint item_interactions_not_interested_unconsumed
  check (not not_interested or (not consumed and rating is null));

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
    'ITEM_NOT_INTERESTED',
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
