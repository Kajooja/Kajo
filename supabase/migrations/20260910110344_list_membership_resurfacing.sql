-- #228 owner device correction. Preserve existing function identity/ACLs and
-- bootstrap/terminal/reminder rules; no table writes or migration-history repair.
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
  config jsonb := private.resurfacing_policy_config_v1()
    || '{"listMembershipPolicyVersion":"active-list-v1"}'::jsonb;
  native_consumed boolean := coalesce(
    case when candidate_explanation ->> 'consumedSuppressed' in ('true', 'false')
      then (candidate_explanation ->> 'consumedSuppressed')::boolean end,
    false
  );
  native_rated boolean := candidate_explanation -> 'rating' is not null
    and candidate_explanation -> 'rating' <> 'null'::jsonb;
  native_not_interested boolean := coalesce(
    case when candidate_explanation ->> 'notInterested' in ('true', 'false')
      then (candidate_explanation ->> 'notInterested')::boolean end,
    false
  );
  native_saved boolean := coalesce(
    case when candidate_explanation ->> 'saved' in ('true', 'false')
      then (candidate_explanation ->> 'saved')::boolean end,
    false
  );
  bootstrap_kind text;
  bootstrap_at timestamptz;
  is_consumed boolean;
  has_rating boolean;
  is_not_interested boolean;
  is_saved boolean;
  list_saved_at timestamptz;
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

  select evidence.evidence_kind, coalesce(evidence.source_occurred_at, evidence.imported_at)
    into bootstrap_kind, bootstrap_at
  from private.profile_bootstrap_evidence as evidence
  where evidence.profile_id = target_profile_id
    and evidence.item_id = target_item_id
    and evidence.active
    and evidence.imported_at <= decision_time
  order by
    case evidence.evidence_kind when 'RATED' then 3 when 'CONSUMED' then 2 else 1 end desc,
    evidence.source_occurred_at desc nulls last,
    evidence.imported_at desc,
    evidence.id
  limit 1;

  is_consumed := native_consumed or coalesce(bootstrap_kind in ('RATED', 'CONSUMED'), false);
  has_rating := native_rated or coalesce(bootstrap_kind = 'RATED', false);
  is_not_interested := native_not_interested;
  -- Current membership controls suppression. Historical List Events are taste
  -- evidence, but removing the final membership must restore ordinary eligibility.
  select max(entry.added_at) into list_saved_at
  from public.item_list_entries entry
  join public.item_lists list on list.id = entry.list_id
  where list.profile_id = target_profile_id and entry.item_id = target_item_id
    and entry.added_at <= decision_time;
  is_saved := native_saved or coalesce(bootstrap_kind = 'SAVED', false)
    or list_saved_at is not null;

  if is_consumed or has_rating or is_not_interested then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'TERMINAL_SUPPRESSED',
      'eligible', false,
      'reason', case
        when native_consumed then 'CONSUMED'
        when native_rated then 'RATED'
        when native_not_interested then 'NOT_INTERESTED'
        when bootstrap_kind = 'RATED' then 'IMPORTED_RATED'
        else 'IMPORTED_CONSUMED'
      end,
      'consumed', is_consumed,
      'rated', has_rating,
      'notInterested', is_not_interested,
      'saved', is_saved,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  if not is_saved then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'ORDINARY',
      'eligible', true,
      'reason', 'NO_TERMINAL_OR_SAVED_REACTION',
      'consumed', false,
      'rated', false,
      'notInterested', false,
      'saved', false,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  select max(saved_at) into last_saved_at
  from (
    select list_saved_at as saved_at
    union all
    select event.occurred_at as saved_at
    from public.events as event
    where event.profile_id = target_profile_id
      and event.item_id = target_item_id
      and event.event_type = 'ITEM_SAVED'
      and event.occurred_at <= decision_time
    union all
    select coalesce(evidence.source_occurred_at, evidence.imported_at)
    from private.profile_bootstrap_evidence as evidence
    where evidence.profile_id = target_profile_id
      and evidence.item_id = target_item_id
      and evidence.active
      and evidence.evidence_kind = 'SAVED'
      and evidence.imported_at <= decision_time
  ) as saves;

  select
    max(impression.occurred_at),
    count(*) filter (where impression.occurred_at > decision_time - interval '90 days')::integer
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
    else greatest(0.0, extract(epoch from (decision_time - last_saved_at)) / 86400.0)
  end;

  if last_saved_at is null then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'UNKNOWN_SAVE_AGE',
      'saved', true,
      'savedAt', null,
      'savedAgeDays', null,
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  if saved_age_days < (config ->> 'minimumSavedAgeDays')::double precision then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'MINIMUM_SAVED_AGE',
      'saved', true,
      'savedAt', last_saved_at,
      'savedAgeDays', round(saved_age_days::numeric, 3),
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  if last_reminder_at is not null
     and last_reminder_at > decision_time
       - make_interval(days => (config ->> 'reminderCooldownDays')::integer) then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'REMINDER_COOLDOWN',
      'saved', true,
      'savedAt', last_saved_at,
      'savedAgeDays', round(saved_age_days::numeric, 3),
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  if reminder_count_90d >= (config ->> 'maxReminderImpressionsPerWindow')::integer then
    return jsonb_build_object(
      'version', config ->> 'version',
      'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
      'classification', 'SAVED_SUPPRESSED',
      'eligible', false,
      'reason', 'REMINDER_FREQUENCY_CAP',
      'saved', true,
      'savedAt', last_saved_at,
      'savedAgeDays', round(saved_age_days::numeric, 3),
      'lastReminderAt', last_reminder_at,
      'reminderImpressions90d', reminder_count_90d,
      'bootstrapEvidenceKind', bootstrap_kind
    ) || config;
  end if;

  return jsonb_build_object(
    'version', config ->> 'version',
    'bootstrapPolicyVersion', 'bootstrap-evidence-v1',
    'classification', 'SAVED_REMINDER_ELIGIBLE',
    'eligible', true,
    'reason', 'AGED_SAVED_ONLY',
    'saved', true,
    'savedAt', last_saved_at,
    'savedAgeDays', round(saved_age_days::numeric, 3),
    'lastReminderAt', last_reminder_at,
    'reminderImpressions90d', reminder_count_90d,
    'bootstrapEvidenceKind', bootstrap_kind
  ) || config;
end;
$$;

