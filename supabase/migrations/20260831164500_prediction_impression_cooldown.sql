create or replace function public.rank_items_v0(
  target_profile_id uuid,
  requested_mode text,
  requested_item_type text default null,
  result_limit integer default 20,
  request_context jsonb default '{}'::jsonb
)
returns table (
  prediction_id uuid,
  item_id uuid,
  item_type text,
  title text,
  description text,
  tags text[],
  score double precision,
  confidence double precision,
  rank integer,
  explanation jsonb
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if target_profile_id is null then
    raise exception 'Profile is required' using errcode = '22023';
  end if;

  if not (select private.is_profile_member(target_profile_id)) then
    raise exception 'Profile access denied' using errcode = '42501';
  end if;

  if requested_mode is null
     or requested_mode not in ('FOR_YOU', 'SURPRISE', 'RISK') then
    raise exception 'Unsupported discovery mode' using errcode = '22023';
  end if;

  if requested_item_type is not null
     and requested_item_type not in ('BOOK', 'MOVIE') then
    raise exception 'Unsupported item type' using errcode = '22023';
  end if;

  if result_limit < 1 or result_limit > 50 then
    raise exception 'Result limit must be between 1 and 50'
      using errcode = '22023';
  end if;

  if request_context is null or jsonb_typeof(request_context) <> 'object' then
    raise exception 'Request context must be a JSON object'
      using errcode = '22023';
  end if;

  return query
  with prediction as (
    select gen_random_uuid() as id
  ),
  reversed_events as (
    select (event.properties ->> 'reversedEventId')::uuid as event_id
    from public.events as event
    where event.profile_id = target_profile_id
      and event.event_type = 'ITEM_INTERACTION_UNDONE'
      and event.properties ? 'reversedEventId'
      and (event.properties ->> 'reversedEventId') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  weighted_events as (
    select
      event.item_id,
      event.occurred_at,
      case event.event_type
        when 'ITEM_RATED' then
          case
            when event.properties ->> 'rating' ~ '^(10|[0-9])$'
              then (((event.properties ->> 'rating')::double precision - 5.0) * 1.2)
            else 0.0
          end
        when 'ITEM_NOT_INTERESTED' then -5.5
        when 'ITEM_LIKED' then 3.0
        when 'ITEM_DISLIKED' then -4.0
        when 'ITEM_INTEREST_CLEARED' then -1.0
        when 'ITEM_SAVED' then 2.0
        when 'ITEM_UNSAVED' then -1.5
        when 'ITEM_OPENED' then 0.35
        when 'ITEM_CONSUMED' then 0.75
        when 'ITEM_CONSUMPTION_REVERSED' then -0.5
        else 0.0
      end as event_weight
    from public.events as event
    where event.profile_id = target_profile_id
      and event.item_id is not null
      and event.event_type in (
        'ITEM_RATED',
        'ITEM_NOT_INTERESTED',
        'ITEM_LIKED',
        'ITEM_DISLIKED',
        'ITEM_INTEREST_CLEARED',
        'ITEM_SAVED',
        'ITEM_UNSAVED',
        'ITEM_OPENED',
        'ITEM_CONSUMED',
        'ITEM_CONSUMPTION_REVERSED'
      )
      and not exists (
        select 1
        from reversed_events
        where reversed_events.event_id = event.id
      )
  ),
  tag_evidence as (
    select
      tag,
      sum(
        weighted_events.event_weight
        * exp(
            -least(
              365.0,
              greatest(
                0.0,
                extract(epoch from (now() - weighted_events.occurred_at))
                  / 86400.0
              )
            )
            / 180.0
          )
      ) as long_term_score,
      sum(
        case
          when weighted_events.occurred_at >= now() - interval '14 days'
            then weighted_events.event_weight
              * exp(
                  -greatest(
                    0.0,
                    extract(epoch from (now() - weighted_events.occurred_at))
                      / 86400.0
                  )
                  / 7.0
                )
          else 0.0
        end
      ) as short_term_score,
      count(*)::integer as evidence_count
    from weighted_events
    join public.items as evidence_item
      on evidence_item.id = weighted_events.item_id
    cross join lateral unnest(evidence_item.tags) as tag
    where weighted_events.event_weight <> 0
    group by tag
  ),
  recent_impressions as (
    select
      event.item_id,
      max(event.occurred_at) as last_impression_at
    from public.events as event
    where event.profile_id = target_profile_id
      and event.event_type = 'ITEM_IMPRESSION'
      and event.item_id is not null
      and event.occurred_at >= now() - interval '30 minutes'
    group by event.item_id
  ),
  candidate_signals as (
    select
      candidate.id,
      candidate.item_type,
      candidate.title,
      candidate.description,
      candidate.tags,
      coalesce(sum(tag_evidence.long_term_score), 0.0) as long_term_score,
      coalesce(sum(tag_evidence.short_term_score), 0.0) as short_term_score,
      coalesce(sum(tag_evidence.evidence_count), 0)::integer as evidence_count,
      coalesce(
        case interaction.interest
          when 'LIKED' then 4.0
          when 'DISLIKED' then -6.0
          else 0.0
        end,
        0.0
      )
      + case when interaction.saved then 2.5 else 0.0 end
      + case
          when interaction.rating is not null
            then (interaction.rating::double precision - 5.0) * 1.2
          else 0.0
        end
      - case when interaction.not_interested then 7.0 else 0.0 end
        as direct_score,
      coalesce(interaction.rating, null) as rating,
      coalesce(interaction.not_interested, false) as not_interested,
      coalesce(interaction.saved, false) as saved,
      interaction.interest as interest,
      coalesce(interaction.consumed, false) as consumed,
      recent_impressions.last_impression_at,
      case
        when coalesce(interaction.consumed, false) then 100.0
        when interaction.rating is not null
          or coalesce(interaction.not_interested, false)
          or coalesce(interaction.saved, false)
          or interaction.interest is not null
          then 18.0
        else 0.0
      end as reaction_queue_penalty,
      case
        when recent_impressions.last_impression_at is null
          or coalesce(interaction.consumed, false)
          or interaction.rating is not null
          or coalesce(interaction.not_interested, false)
          or coalesce(interaction.saved, false)
          or interaction.interest is not null
          then 0.0
        else 12.0 * greatest(
          0.0,
          1.0 - least(
            1800.0,
            greatest(
              0.0,
              extract(epoch from (now() - recent_impressions.last_impression_at))
            )
          ) / 1800.0
        )
      end as impression_cooldown_penalty,
      case
        when coalesce(cardinality(candidate.tags), 0) = 0 then 0.0
        else 1.0 - least(
          1.0,
          coalesce(count(tag_evidence.tag), 0)::double precision
            / cardinality(candidate.tags)::double precision
        )
      end as novelty_score,
      (
        ('x' || substr(md5(target_profile_id::text || ':' || candidate.id::text), 1, 8))
          ::bit(32)::bigint::double precision
        / 4294967295.0
      ) as exploration_score
    from public.items as candidate
    left join public.item_interactions as interaction
      on interaction.profile_id = target_profile_id
     and interaction.item_id = candidate.id
    left join recent_impressions
      on recent_impressions.item_id = candidate.id
    left join lateral unnest(candidate.tags) as candidate_tag on true
    left join tag_evidence on tag_evidence.tag = candidate_tag
    where requested_item_type is null
       or candidate.item_type = requested_item_type
    group by
      candidate.id,
      candidate.item_type,
      candidate.title,
      candidate.description,
      candidate.tags,
      interaction.interest,
      interaction.saved,
      interaction.rating,
      interaction.not_interested,
      interaction.consumed,
      recent_impressions.last_impression_at
  ),
  scored as (
    select
      candidate_signals.*,
      case requested_mode
        when 'FOR_YOU' then
          direct_score
          + long_term_score
          + short_term_score * 1.2
          + novelty_score * 0.1
        when 'SURPRISE' then
          direct_score
          + long_term_score * 0.75
          + short_term_score * 0.7
          + novelty_score * 1.5
          + exploration_score * 0.5
        when 'RISK' then
          direct_score
          + long_term_score * 0.4
          + short_term_score * 0.35
          + novelty_score * 2.5
          + exploration_score * 1.5
      end
      - reaction_queue_penalty
      - impression_cooldown_penalty as final_score
    from candidate_signals
  ),
  ranked as (
    select
      scored.*,
      row_number() over (order by final_score desc, id)::integer as result_rank
    from scored
  )
  select
    prediction.id,
    ranked.id,
    ranked.item_type,
    ranked.title,
    ranked.description,
    ranked.tags,
    ranked.final_score,
    least(1.0, ranked.evidence_count::double precision / 8.0),
    ranked.result_rank,
    jsonb_build_object(
      'version', 'prediction-v0.3',
      'mode', requested_mode,
      'longTerm', round(ranked.long_term_score::numeric, 4),
      'shortTerm', round(ranked.short_term_score::numeric, 4),
      'direct', round(ranked.direct_score::numeric, 4),
      'novelty', round(ranked.novelty_score::numeric, 4),
      'exploration', round(ranked.exploration_score::numeric, 4),
      'rating', ranked.rating,
      'notInterested', ranked.not_interested,
      'saved', ranked.saved,
      'consumedSuppressed', ranked.consumed,
      'lastImpressionAt', ranked.last_impression_at,
      'reactionQueuePenalty', round(ranked.reaction_queue_penalty::numeric, 4),
      'impressionCooldownPenalty', round(ranked.impression_cooldown_penalty::numeric, 4),
      'evidenceCount', ranked.evidence_count,
      'contextAccepted', request_context <> '{}'::jsonb
    )
  from ranked
  cross join prediction
  where ranked.result_rank <= result_limit
  order by ranked.result_rank;
end;
$$;

revoke all on function public.rank_items_v0(uuid, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.rank_items_v0(uuid, text, text, integer, jsonb)
  to authenticated;
