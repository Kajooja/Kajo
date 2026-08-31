alter table public.item_interactions
drop constraint item_interactions_rating_valid;

alter table public.item_interactions
add constraint item_interactions_rating_valid
  check (rating is null or rating between 0 and 10);
