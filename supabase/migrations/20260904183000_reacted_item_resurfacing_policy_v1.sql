-- Issue #174: bounded resurfacing of already-reacted Items.
--
-- This extends the existing canonical Prediction V1 path. It does not create a
-- second recommender and it does not change Lists/history visibility.
--
-- Policy V1 hypotheses:
-- - consumed, rated and not-interested Items are terminal for normal discovery,
-- - a saved-only Item is normally suppressed,
-- - one saved-only Item may become a reminder after 30 days,
-- - reminder impressions have a 30-day cooldown and a max of 2 per rolling 90d,
-- - at most one saved reminder is eligible in one Prediction candidate pool,
-- - ordinary eligible Items always rank ahead of the reminder; suppressed Items
--   remain in the internal candidate trace when they are inside the bounded pool
--   but can never be selected for delivery.
--
-- Future threshold changes require a new policy version rather than rewriting
-- historical Prediction traces.

create or replace function private.resurfacing_policy_config_v1()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 'resurfacing-v1',
    'minimumSavedAgeDays', 30,
    'reminderCooldownDays', 30,
    'frequencyWindowDays', 90,
    'maxReminderImpressionsPerWindow', 2,
    'maxSavedRemindersPerCandidatePool', 1,
    'ordinaryBeforeReminder', true
  );
$$;

create or replace function private.resurfacing_policy_decision_v1(
  target_profile_id uuid,
  target_item_id uuid,
  candidate_explanation jsonb,
  decision_time timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  config jsonb := private.resurfacing_policy_config_v1();
  is_consumed boolean := coalesce(
    case when candidate_explanation ->> 'consumedSuppressed' in ('true', 'false')
      then (candidate_explanation ->> 'consumedSuppressed')::boolean end,
    false
  );
  has_rating boolean := candidate_explanation -> 'rating' is not null
    and candidate_explanation -> 'rating' <> 'null'::jsonb;
  is_not_interested boolean := coalesce(
    case when candidate_explanation ->> 'notInterested' in ('true', 'false')
      then (candidate_explanation ->> 'notInterested')::boolean end,
    false
  );
  is_saved boolean := coalesce(
    case when candidate_explanation ->> 'saved' in ('true', 'false')
      then (candidate_explanation ->> 'saved')::boolean end,
    false
  );
  last_saved_at timestamptz;
  last_reminder_at timestamptz;
  reminder_count_90d integer := 0;
  saved_age_days double precision;
begin
  if target_profile_id is null or target_item_id is null then
    raise exception 'Profile and Item are required for resurfacing policy'
      using errcode = '22023';
  end if;

  if decision_time is null then
    raise exception 'Decision time is required for resurfacing policy'
      using errcode = '22023';
  end if;

  if is_consumed or has_rating or is_not_interested then
    return jsonb_build_object(
      'version', config ->> 'version',
      'classification', 'TERMINAL_SUPPRESSED',
      'eligible', false,
      'reason', case
        when is_consumed then 'CONSUMED'
        when has_rating then 'RATED'
        else 'NOT_INTERESTED'
      end,
      'consumed', is_consumed,
      'rated', has_rating,
      'notInterested', is_not_interested,
      'saved', is_saved
    ) || config;
  end if;

  if not is_saved then
    return jsonb_build_object(
      'version', config ->> 'version',
      'classification', 'ORDINARY',
      'eligible', true,
      'reason', 'NO_TERMINAL_OR_SAVED_REACTION',
      'consumed', false,
      'rated', false,
      'notInterested', false,
      'saved', false
    ) || config;
  end if;

  select max(event.occurred_at)
    into last_saved_at
  from public.events as event
  where event.profile_id = target_profile_id
    and event.item_id = target_item_id
    and event.event_type = 'ITEM_SAVED'
    and event.occurred_at <= decision_time;

  select
    max(impression.occurred_at),
    count(*) filter (
      where impression.occurred_at > decision_time - interval '90 days'
    )::integer
    into last_reminder_at, reminder_count_90d
  from public.events as impression
  join private.prediction_candidates as candidate
    on candidate.prediction_id = impression.prediction_id
   and candidate.item_id = impression.item_id
  where impression.profile_id = target_profile_id
    and impression.item_id = target_item_id
    and impression.event_type = 'ITEM_IMPRESSION'
    and impression.occurred_at <= decision_time
    and candidate.explanation #>> '{resurfacingPolicy,classification}' = 'SAVED_REMINDER';

  saved_age_days := case
    when last_saved_at is null then null
    else greatest(
      0.0,
      extract(epoch from (decision_time - last_saved_at)) / 86400.0
    )
  end;

  if last_saved_at is null then
    return jsonb_build_object(
      'version', config ->> 'version',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'UNKNOWN_SAVE_AGE',
      'saved', true,
      'savedAt', null,
      'savedAgeDays', null,
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d
    ) || config;
  end if;

  if saved_age_days < (config ->> 'minimumSavedAgeDays')::double precision then
    return jsonb_build_object(
      'version', config ->> 'version',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'MINIMUM_SAVED_AGE',
      'saved', true,
      'savedAt', last_saved_at,
      'savedAgeDays', round(saved_age_days::numeric, 3),
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d
    ) || config;
  end if;

  if last_reminder_at is not null
     and last_reminder_at > decision_time
       - make_interval(days => (config ->> 'reminderCooldownDays')::integer) then
    return jsonb_build_object(
      'version', config ->> 'version',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'REMINDER_COOLDOWN',
      'saved', true,
      'savedAt', last_saved_at,
      'savedAgeDays', round(saved_age_days::numeric, 3),
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d
    ) || config;
  end if;

  if reminder_count_90d >= (config ->> 'maxReminderImpressionsPerWindow')::integer then
    return jsonb_build_object(
      'version', config ->> 'version',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'REMINDER_FREQUENCY_CAP',
      'saved', true,
      'savedAt', last_saved_at,
      'savedAgeDays', round(saved_age_days::numeric, 3),
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d
    ) || config;
  end if;

  return jsonb_build_object(
    'version', config ->> 'version',
    'classification', 'SAVED_REMINDER_ELIGIBLE',
    'eligible', true,
    'reason', 'AGED_SAVED_ONLY',
    'saved', true,
    'savedAt', last_saved_at,
    'savedAgeDays', round(saved_age_days::numeric, 3),
    'lastReminderAt', last_reminder_at,
    'reminderImpressions90d', reminder_count_90d
  ) || config;
end;
$$;

revoke all on function private.resurfacing_policy_config_v1()
  from public, anon, authenticated, service_role;
revoke all on function private.resurfacing_policy_decision_v1(uuid, uuid, jsonb, timestamptz)
  from public, anon, authenticated, service_role;

-- Replace the existing genome-aware scalar layer in place. It still owns no
-- independent taste model: it fetches the one proven private V0.3 baseline pool,
-- applies assigned genome scalar weights, then annotates candidate eligibility.
create or replace function private.rank_items_scalar_v1(
  target_profile_id uuid,
  requested_mode text,
  requested_item_type text default null,
  result_limit integer default 20,
  request_context jsonb default '{}'::jsonb,
  forced_genome_id uuid default null
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
security definer
set search_path = ''
as $$
declare
  resolved_genome_id uuid;
  resolved_genome_key text;
  resolved_genome_config jsonb;
  decision_time timestamptz := clock_timestamp();
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

  if forced_genome_id is null then
    select resolved.genome_id
      into resolved_genome_id
    from private.resolve_policy_assignment_v1(
      target_profile_id,
      decision_time
    ) as resolved;
  else
    resolved_genome_id := forced_genome_id;
  end if;

  select genome.genome_key, genome.config
    into resolved_genome_key, resolved_genome_config
  from private.predictor_genomes as genome
  where genome.id = resolved_genome_id;

  if resolved_genome_id is null
     or resolved_genome_config is null
     or not private.genome_config_is_valid_v1(resolved_genome_config) then
    raise exception 'No valid scalar PredictorGenome for Profile %', target_profile_id
      using errcode = '55000';
  end if;

  return query
  with baseline_pool as materialized (
    select baseline.*
    from private.rank_items_v0(
      target_profile_id,
      requested_mode,
      requested_item_type,
      50,
      request_context
    ) as baseline
  ),
  rescored as (
    select
      baseline_pool.*,
      case
        when resolved_genome_key = 'prediction-v1-baseline'
          then baseline_pool.score
        else private.shadow_candidate_score_v1(
          requested_mode,
          baseline_pool.explanation,
          0.0,
          resolved_genome_config
        )
      end as scalar_score
    from baseline_pool
  ),
  policy_evaluated as materialized (
    select
      rescored.*,
      private.resurfacing_policy_decision_v1(
        target_profile_id,
        rescored.item_id,
        rescored.explanation,
        decision_time
      ) as resurfacing_policy
    from rescored
  ),
  eligible_reminders as (
    select
      policy_evaluated.item_id,
      row_number() over (
        order by policy_evaluated.scalar_score desc, policy_evaluated.item_id
      )::integer as reminder_order
    from policy_evaluated
    where policy_evaluated.resurfacing_policy ->> 'classification'
      = 'SAVED_REMINDER_ELIGIBLE'
  ),
  finalized_policy as (
    select
      policy_evaluated.*,
      case
        when policy_evaluated.resurfacing_policy ->> 'classification'
               = 'SAVED_REMINDER_ELIGIBLE'
             and eligible_reminders.reminder_order = 1 then
          policy_evaluated.resurfacing_policy
          || jsonb_build_object(
            'classification', 'SAVED_REMINDER',
            'eligible', true,
            'reason', 'AGED_SAVED_ONLY_REMINDER'
          )
        when policy_evaluated.resurfacing_policy ->> 'classification'
               = 'SAVED_REMINDER_ELIGIBLE' then
          policy_evaluated.resurfacing_policy
          || jsonb_build_object(
            'classification', 'SAVED_SUPPRESSED',
            'eligible', false,
            'reason', 'CANDIDATE_POOL_REMINDER_CAP'
          )
        else policy_evaluated.resurfacing_policy
      end as final_resurfacing_policy
    from policy_evaluated
    left join eligible_reminders
      on eligible_reminders.item_id = policy_evaluated.item_id
  ),
  reranked as (
    select
      finalized_policy.*,
      row_number() over (
        order by
          case
            when coalesce(
              (finalized_policy.final_resurfacing_policy ->> 'eligible')::boolean,
              false
            ) = false then 2
            when finalized_policy.final_resurfacing_policy ->> 'classification'
              = 'SAVED_REMINDER' then 1
            else 0
          end,
          finalized_policy.scalar_score desc,
          finalized_policy.item_id
      )::integer as scalar_rank
    from finalized_policy
  )
  select
    reranked.prediction_id,
    reranked.item_id,
    reranked.item_type,
    reranked.title,
    reranked.description,
    reranked.tags,
    reranked.scalar_score,
    reranked.confidence,
    reranked.scalar_rank,
    reranked.explanation
      || jsonb_build_object(
        'scalarGenome', jsonb_build_object(
          'genomeId', resolved_genome_id,
          'genomeKey', resolved_genome_key,
          'baselineEquivalent', resolved_genome_key = 'prediction-v1-baseline'
        ),
        'resurfacingPolicy', reranked.final_resurfacing_policy
      )
  from reranked
  where reranked.scalar_rank <= result_limit
  order by reranked.scalar_rank;
end;
$$;

revoke all on function private.rank_items_scalar_v1(uuid, text, text, integer, jsonb, uuid)
  from public, anon, authenticated, service_role;

-- Patch only delivery/ranking policy in the already-canonical V1 function.
-- Suppressed candidates remain traceable but can never be selected. Ordinary
-- eligible candidates rank before the single saved reminder, and both rank
-- before suppressed candidates regardless of ScenarioMemory score.
do $$
declare
  definition text;
  patched text;
  old_order text := E'order by rescored.final_score desc, rescored.item_id';
  new_order text := E'order by\n          case\n            when coalesce(\n              (rescored.explanation #>> ''{resurfacingPolicy,eligible}'')::boolean,\n              false\n            ) = false then 2\n            when rescored.explanation #>> ''{resurfacingPolicy,classification}''\n              = ''SAVED_REMINDER'' then 1\n            else 0\n          end,\n          rescored.final_score desc,\n          rescored.item_id';
  old_delivery text := 'reranked.final_rank <= result_limit';
  new_delivery text := E'coalesce(\n        (reranked.final_explanation #>> ''{resurfacingPolicy,eligible}'')::boolean,\n        false\n      )\n      and reranked.final_rank <= result_limit';
  old_policy_version text := '''scenario-memory-v1''';
  new_policy_version text := '''scenario-memory-v1+resurfacing-v1''';
begin
  definition := pg_get_functiondef(
    'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure
  );

  if position(old_order in definition) = 0 then
    raise exception 'Expected V1 final score ordering block was not found';
  end if;

  if position(old_delivery in definition) = 0 then
    raise exception 'Expected V1 delivery predicate was not found';
  end if;

  if position(old_policy_version in definition) = 0 then
    raise exception 'Expected V1 policy version was not found';
  end if;

  patched := replace(definition, old_order, new_order);
  patched := replace(patched, old_delivery, new_delivery);
  patched := replace(patched, old_policy_version, new_policy_version);

  if patched = definition then
    raise exception 'Prediction V1 resurfacing patch made no changes';
  end if;

  execute patched;
end;
$$;
