-- Sprint 014C / #177
-- Inspectable SharedProfile common-fit V1 on top of the canonical Prediction V1 path.
--
-- PersonalProfile ranking is unchanged: the helper returns zero contribution for
-- non-Shared Profiles. SharedProfile scoring may read accepted members' own
-- PersonalProfile LongTerm/bootstrap state, but never copies Personal evidence
-- into Shared history and never exposes raw member histories to the mobile client.

create or replace function private.shared_common_fit_v1(
  target_profile_id uuid,
  candidate_item_id uuid,
  candidate_tags text[],
  decision_time timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_profile_type text;
  prior jsonb;
  neutral_fit double precision := 0.0;
  accepted_member_count integer := 0;
  members_with_evidence integer := 0;
  mean_member_fit double precision := 0.0;
  minimum_member_fit double precision := 0.0;
  maximum_member_fit double precision := 0.0;
  mean_reliability double precision := 0.0;
  disagreement double precision := 0.0;
  contribution double precision := 0.0;
begin
  select profile.profile_type
    into target_profile_type
  from public.profiles as profile
  where profile.id = target_profile_id;

  if target_profile_type is distinct from 'SHARED' then
    return jsonb_build_object(
      'version', 'shared-common-fit-v1',
      'applicable', false,
      'scoreContribution', 0.0
    );
  end if;

  prior := private.catalog_cold_start_prior_v1(candidate_item_id, decision_time);
  neutral_fit := greatest(
    -1.0,
    least(
      1.0,
      (coalesce((prior ->> 'score')::double precision, 0.5) - 0.5) * 2.0
    )
  );

  with member_profiles as (
    select
      member.user_id,
      personal.id as personal_profile_id
    from public.profile_members as member
    join public.profiles as personal
      on personal.profile_type = 'PERSONAL'
     and personal.owner_user_id = member.user_id
    where member.profile_id = target_profile_id
  ),
  member_states as (
    select
      member_profiles.user_id,
      member_profiles.personal_profile_id,
      private.build_profile_memory_state_v1(
        member_profiles.personal_profile_id,
        decision_time
      ) as state
    from member_profiles
  ),
  member_components as (
    select
      member_states.user_id,
      greatest(
        0,
        case
          when member_states.state ->> 'evidenceCount' ~ '^\d+$'
            then (member_states.state ->> 'evidenceCount')::integer
          else 0
        end
      ) as evidence_count,
      private.text_array_jaccard(
        coalesce(candidate_tags, '{}'::text[]),
        private.jsonb_string_array(member_states.state, 'longTermPositiveTags')
      ) as positive_fit,
      private.text_array_jaccard(
        coalesce(candidate_tags, '{}'::text[]),
        private.jsonb_string_array(member_states.state, 'longTermNegativeTags')
      ) as negative_fit
    from member_states
  ),
  member_fit as (
    select
      member_components.user_id,
      member_components.evidence_count,
      greatest(
        -1.0,
        least(1.0, member_components.positive_fit - member_components.negative_fit)
      ) as raw_fit,
      member_components.evidence_count::double precision
        / (member_components.evidence_count::double precision + 8.0) as reliability
    from member_components
  ),
  shrunk_fit as (
    select
      member_fit.user_id,
      member_fit.evidence_count,
      member_fit.reliability,
      member_fit.reliability * member_fit.raw_fit
        + (1.0 - member_fit.reliability) * neutral_fit as fit
    from member_fit
  )
  select
    count(*)::integer,
    count(*) filter (where shrunk_fit.evidence_count > 0)::integer,
    coalesce(avg(shrunk_fit.fit), neutral_fit),
    coalesce(min(shrunk_fit.fit), neutral_fit),
    coalesce(max(shrunk_fit.fit), neutral_fit),
    coalesce(avg(shrunk_fit.reliability), 0.0)
  into
    accepted_member_count,
    members_with_evidence,
    mean_member_fit,
    minimum_member_fit,
    maximum_member_fit,
    mean_reliability
  from shrunk_fit;

  disagreement := greatest(
    0.0,
    least(1.0, (maximum_member_fit - minimum_member_fit) / 2.0)
  );

  -- V1 is deliberately conservative relative to the existing base-score scale.
  -- Sparse member estimates shrink toward the neutral catalog prior instead of
  -- allowing one early Personal rating to dominate a SharedProfile slate.
  contribution := 1.5 * (
      0.35 * mean_member_fit
    + 0.25 * minimum_member_fit
    - 0.20 * disagreement
    + 0.20 * (1.0 - mean_reliability) * neutral_fit
  );
  contribution := greatest(-1.5, least(1.5, contribution));

  return jsonb_build_object(
    'version', 'shared-common-fit-v1',
    'applicable', true,
    'acceptedMemberCount', accepted_member_count,
    'membersWithEvidence', members_with_evidence,
    'meanMemberFit', round(mean_member_fit::numeric, 4),
    'minimumMemberFit', round(minimum_member_fit::numeric, 4),
    'disagreement', round(disagreement::numeric, 4),
    'meanReliability', round(mean_reliability::numeric, 4),
    'neutralPrior', jsonb_build_object(
      'score', coalesce(prior -> 'score', '0.5'::jsonb),
      'source', prior -> 'source',
      'version', prior -> 'version'
    ),
    'scoreContribution', round(contribution::numeric, 4),
    'privacy', jsonb_build_object(
      'rawMemberHistoryExposed', false,
      'memberIdentifiersExposed', false,
      'personalEvidenceCopiedToShared', false
    )
  );
end;
$$;

revoke all on function private.shared_common_fit_v1(uuid, uuid, text[], timestamptz)
  from public, anon, authenticated, service_role;

-- Extend the existing canonical Prediction V1 implementation in place. This is
-- not a second Shared recommender: Shared common-fit is one additional scoring
-- component inside the same candidate pool, trace and public rank_items_v1 RPC.
do $$
declare
  definition text;
  patched text;
  old_score text := E'scenario_enriched.score\n        + scenario_enriched.scenario_score\n          * private.serving_scenario_weight_v1(\n              target_profile_id,\n              requested_mode,\n              request_time\n            ) as final_score';
  new_score text := E'scenario_enriched.score\n        + scenario_enriched.scenario_score\n          * private.serving_scenario_weight_v1(\n              target_profile_id,\n              requested_mode,\n              request_time\n            )\n        + coalesce(\n            (private.shared_common_fit_v1(\n              target_profile_id,\n              scenario_enriched.item_id,\n              scenario_enriched.tags,\n              request_time\n            ) ->> ''scoreContribution'')::double precision,\n            0.0\n          ) as final_score';
  old_explanation text := E'''maxEpisodes'', 30\n          )\n        )\n      ) as final_explanation';
  new_explanation text := E'''maxEpisodes'', 30\n          ),\n          ''sharedCommonFit'', private.shared_common_fit_v1(\n            target_profile_id,\n            rescored.item_id,\n            rescored.tags,\n            request_time\n          )\n        )\n      ) as final_explanation';
begin
  definition := pg_get_functiondef(
    'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure
  );

  if position(old_score in definition) = 0 then
    raise exception 'Expected Prediction V1 final-score block was not found';
  end if;

  if position(old_explanation in definition) = 0 then
    raise exception 'Expected Prediction V1 explanation block was not found';
  end if;

  patched := replace(definition, old_score, new_score);
  patched := replace(patched, old_explanation, new_explanation);

  if patched = definition then
    raise exception 'Shared common-fit patch made no changes';
  end if;

  execute patched;
end;
$$;
