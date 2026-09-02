create table public.shared_item_consensus (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  reached_by_user_id uuid references public.users (id) on delete set null,
  reached_at timestamptz not null default now(),
  constraint shared_item_consensus_pkey primary key (profile_id, item_id)
);

create index shared_item_consensus_item_id_idx
  on public.shared_item_consensus (item_id);

create index shared_item_consensus_reached_by_user_id_idx
  on public.shared_item_consensus (reached_by_user_id)
  where reached_by_user_id is not null;

alter table public.shared_item_consensus enable row level security;

revoke all on table public.shared_item_consensus from anon, authenticated;

insert into public.shared_item_consensus (
  profile_id,
  item_id,
  reached_by_user_id,
  reached_at
)
select
  interaction.profile_id,
  interaction.item_id,
  coalesce(consensus_event.actor_user_id, interaction.actor_user_id),
  coalesce(consensus_event.occurred_at, interaction.updated_at)
from public.item_interactions as interaction
join public.profiles as profile
  on profile.id = interaction.profile_id
 and profile.profile_type = 'SHARED'
left join lateral (
  select event.actor_user_id, event.occurred_at
  from public.events as event
  where event.profile_id = interaction.profile_id
    and event.item_id = interaction.item_id
    and event.event_type = 'ITEM_SAVED'
    and event.properties ->> 'source' = 'SHARED_CONSENSUS'
  order by event.occurred_at desc, event.id desc
  limit 1
) as consensus_event on true
where interaction.saved
  and (
    consensus_event.actor_user_id is not null
    or (
      (select count(*)
       from public.profile_members as membership
       where membership.profile_id = interaction.profile_id) >= 2
      and
      (select count(*)
       from public.shared_item_endorsements as endorsement
       join public.profile_members as membership
         on membership.profile_id = endorsement.profile_id
        and membership.user_id = endorsement.actor_user_id
       where endorsement.profile_id = interaction.profile_id
         and endorsement.item_id = interaction.item_id)
      =
      (select count(*)
       from public.profile_members as membership
       where membership.profile_id = interaction.profile_id)
    )
  )
on conflict on constraint shared_item_consensus_pkey do nothing;

create function private.record_shared_consensus_from_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_member_count integer;
  accepted_endorsement_count integer;
begin
  if not new.saved
     or (tg_op = 'UPDATE' and coalesce(old.saved, false))
     or not exists (
       select 1
       from public.profiles as profile
       where profile.id = new.profile_id
         and profile.profile_type = 'SHARED'
     ) then
    return new;
  end if;

  select count(*)::integer
  into accepted_member_count
  from public.profile_members as membership
  where membership.profile_id = new.profile_id;

  select count(*)::integer
  into accepted_endorsement_count
  from public.shared_item_endorsements as endorsement
  join public.profile_members as membership
    on membership.profile_id = endorsement.profile_id
   and membership.user_id = endorsement.actor_user_id
  where endorsement.profile_id = new.profile_id
    and endorsement.item_id = new.item_id;

  if accepted_member_count >= 2
     and accepted_endorsement_count >= accepted_member_count then
    insert into public.shared_item_consensus (
      profile_id,
      item_id,
      reached_by_user_id,
      reached_at
    )
    values (
      new.profile_id,
      new.item_id,
      new.actor_user_id,
      now()
    )
    on conflict on constraint shared_item_consensus_pkey do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.record_shared_consensus_from_interaction()
  from public, anon, authenticated;

create trigger item_interactions_record_shared_consensus
after insert or update of saved on public.item_interactions
for each row execute function private.record_shared_consensus_from_interaction();

create function private.is_shared_saved_state_valid(
  target_profile_id uuid,
  target_item_id uuid,
  requested_saved boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case profile.profile_type
    when 'PERSONAL' then true
    when 'SHARED' then requested_saved = exists (
      select 1
      from public.shared_item_consensus as consensus
      where consensus.profile_id = target_profile_id
        and consensus.item_id = target_item_id
    )
    else false
  end
  from public.profiles as profile
  where profile.id = target_profile_id;
$$;

revoke all on function private.is_shared_saved_state_valid(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function private.is_shared_saved_state_valid(uuid, uuid, boolean)
  to authenticated;

drop policy item_interactions_insert_for_member
  on public.item_interactions;
drop policy item_interactions_update_for_member
  on public.item_interactions;
drop policy item_interactions_delete_for_member
  on public.item_interactions;

create policy item_interactions_insert_for_member
on public.item_interactions
for insert
to authenticated
with check (
  (select private.is_profile_member(profile_id))
  and actor_user_id = (select auth.uid())
  and (select private.is_shared_saved_state_valid(profile_id, item_id, saved))
);

create policy item_interactions_update_for_member
on public.item_interactions
for update
to authenticated
using ((select private.is_profile_member(profile_id)))
with check (
  (select private.is_profile_member(profile_id))
  and actor_user_id = (select auth.uid())
  and (select private.is_shared_saved_state_valid(profile_id, item_id, saved))
);

create policy item_interactions_delete_for_member
on public.item_interactions
for delete
to authenticated
using (
  (select private.is_profile_member(profile_id))
  and (select private.is_shared_saved_state_valid(profile_id, item_id, false))
);
