-- Sprint 014C / #177 / MVP-PRED-005
--
-- Forward-only hardening of the already-hosted shared-common-fit-v1 policy.
-- Historical v1 traces remain immutable. New SharedProfile runs use v1.1.
--
-- Improvements:
-- - build accepted-member Personal memory once per PredictionRun,
-- - include LongTerm + native ShortTerm taste,
-- - shrink sparse Personal estimates toward the neutral ColdStartPrior,
-- - decay only the neutral prior as Shared joint evidence accumulates,
-- - keep the client explanation aggregate-only and member-anonymous,
-- - keep PersonalProfile ranking and policy version numerically unchanged.

create or replace function private.shared_common_fit_config_v1_1()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 'shared-common-fit-v1.1',
    'memberEvidenceSaturation', 8,
    'sharedPriorHalfLifeEvidence', 8,
    'longTermWeight', 0.75,
    'shortTermWeight', 0.25,
    'negativeTagMultiplier', 1.25,
    'priorPointWeight', 1.25,
    'memberMeanPointWeight', 3.0,
    'consensusPointWeight', 1.25,
    'disagreementPointWeight', 2.5,
    'maximumAbsoluteContribution', 6.0,
    'privacyBoundary', 'AGGREGATE_ONLY'
  );
$$;

create or replace function private.build_shared_common_fit_context_v1_1(
  target_profile_id uuid,
  state_as_of timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_profile_type text;
  shared_state jsonb;
  member_states jsonb := '[]'::jsonb;
  shared_evidence_count integer := 0;
begin
  if target_profile_id is null or state_as_of is null then
    raise exception 'Profile and as-of time are required for Shared common-fit context'
      using errcode = '22023';
  end if;

  select profile.profile_type
    into target_profile_type
  from public.profiles as profile
  where profile.id = target_profile_id;

  if target_profile_type is null then
    raise exception 'Profile not found' using errcode = '22023';
  end if;

  if target_profile_type <> 'SHARED' then
    return jsonb_build_object(
      'version', 'shared-common-fit-context-v1.1',
      'applicable', false,
      'sharedEvidenceCount', 0,
      'memberCount', 0,
      'members', '[]'::jsonb
    );
  end if;

  shared_state := private.build_profile_memory_state_v1(target_profile_id, state_as_of);
  shared_evidence_count := coalesce((shared_state ->> 'evidenceCount')::integer, 0);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'evidenceCount', coalesce((memory.value ->> 'evidenceCount')::integer, 0),
        'longTermPositiveTags', coalesce(memory.value -> 'longTermPositiveTags', '[]'::jsonb),
        'longTermNegativeTags', coalesce(memory.value -> 'longTermNegativeTags', '[]'::jsonb),
        'shortTermPositiveTags', coalesce(memory.value -> 'shortTermPositiveTags', '[]'::jsonb),
        'shortTermNegativeTags', coalesce(memory.value -> 'shortTermNegativeTags', '[]'::jsonb)
      )
      order by member.user_id
    ),
    '[]'::jsonb
  )
  into member_states
  from public.profile_members as member
  left join public.profiles as personal_profile
    on personal_profile.profile_type = 'PERSONAL'
   and personal_profile.owner_user_id = member.user_id
  left join lateral (
    select case
      when personal_profile.id is null then jsonb_build_object(
        'evidenceCount', 0,
        'longTermPositiveTags', '[]'::jsonb,
        'longTermNegativeTags', '[]'::jsonb,
        'shortTermPositiveTags', '[]'::jsonb,
        'shortTermNegativeTags', '[]'::jsonb
      )
      else private.build_profile_memory_state_v1(personal_profile.id, state_as_of)
    end as value
  ) as memory on true
  where member.profile_id = target_profile_id;

  return jsonb_build_object(
    'version', 'shared-common-fit-context-v1.1',
    'applicable', true,
    'sharedEvidenceCount', shared_evidence_count,
    'memberCount', jsonb_array_length(member_states),
    'members', member_states
  );
end;
$$;

create or replace function private.shared_common_fit_candidate_v1_1(
  common_context jsonb,
  target_item_id uuid,
  decision_time timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  config jsonb := private.shared_common_fit_config_v1_1();
  prior jsonb;
  prior_score double precision := 0.5;
  prior_centered double precision := 0.0;
  item_tags text[] := '{}'::text[];
  item_tag_count integer := 0;
  member_state jsonb;
  long_positive text[];
  long_negative text[];
  short_positive text[];
  short_negative text[];
  long_positive_hits integer := 0;
  long_negative_hits integer := 0;
  short_positive_hits integer := 0;
  short_negative_hits integer := 0;
  long_centered double precision := 0.0;
  short_centered double precision := 0.0;
  personal_centered double precision := 0.0;
  personal_fit double precision := 0.5;
  evidence_count integer := 0;
  evidence_strength double precision := 0.0;
  shrunk_fit double precision := 0.5;
  member_count integer := 0;
  evidence_member_count integer := 0;
  fit_sum double precision := 0.0;
  strength_sum double precision := 0.0;
  minimum_fit double precision;
  maximum_fit double precision;
  mean_fit double precision := 0.5;
  mean_strength double precision := 0.0;
  member_delta double precision := 0.0;
  consensus_delta double precision := 0.0;
  disagreement double precision := 0.0;
  shared_evidence_count integer := 0;
  prior_sparsity_weight double precision := 1.0;
  prior_component double precision := 0.0;
  member_component double precision := 0.0;
  consensus_component double precision := 0.0;
  disagreement_penalty double precision := 0.0;
  contribution double precision := 0.0;
  max_abs double precision := (config ->> 'maximumAbsoluteContribution')::double precision;
begin
  if common_context is null or jsonb_typeof(common_context) <> 'object' then
    raise exception 'Shared common-fit context must be a JSON object'
      using errcode = '22023';
  end if;

  if target_item_id is null or decision_time is null then
    raise exception 'Item and decision time are required for Shared common-fit'
      using errcode = '22023';
  end if;

  if not coalesce(
    case when common_context ->> 'applicable' in ('true', 'false')
      then (common_context ->> 'applicable')::boolean end,
    false
  ) then
    return jsonb_build_object(
      'version', config ->> 'version',
      'applicable', false,
      'contribution', 0.0,
      'privacyBoundary', config ->> 'privacyBoundary'
    );
  end if;

  select coalesce(item.tags, '{}'::text[])
    into item_tags
  from public.items as item
  where item.id = target_item_id;

  if not found then
    raise exception 'Item not found for Shared common-fit' using errcode = '22023';
  end if;

  item_tag_count := coalesce(cardinality(item_tags), 0);
  prior := private.catalog_cold_start_prior_v1(target_item_id, decision_time);
  prior_score := least(
    1.0,
    greatest(0.0, coalesce((prior ->> 'score')::double precision, 0.5))
  );
  prior_centered := (prior_score - 0.5) * 2.0;
  shared_evidence_count := greatest(
    0,
    coalesce((common_context ->> 'sharedEvidenceCount')::integer, 0)
  );
  prior_sparsity_weight := 1.0 / (
    1.0
    + shared_evidence_count::double precision
      / (config ->> 'sharedPriorHalfLifeEvidence')::double precision
  );

  for member_state in
    select value
    from jsonb_array_elements(coalesce(common_context -> 'members', '[]'::jsonb))
  loop
    member_count := member_count + 1;
    evidence_count := greatest(0, coalesce((member_state ->> 'evidenceCount')::integer, 0));
    evidence_strength := least(
      1.0,
      evidence_count::double precision
        / (config ->> 'memberEvidenceSaturation')::double precision
    );

    if evidence_count > 0 then
      evidence_member_count := evidence_member_count + 1;
    end if;

    long_positive := private.jsonb_string_array(member_state, 'longTermPositiveTags');
    long_negative := private.jsonb_string_array(member_state, 'longTermNegativeTags');
    short_positive := private.jsonb_string_array(member_state, 'shortTermPositiveTags');
    short_negative := private.jsonb_string_array(member_state, 'shortTermNegativeTags');

    if item_tag_count > 0 then
      select count(*)::integer into long_positive_hits
      from unnest(item_tags) as tag
      where tag = any(long_positive);

      select count(*)::integer into long_negative_hits
      from unnest(item_tags) as tag
      where tag = any(long_negative);

      select count(*)::integer into short_positive_hits
      from unnest(item_tags) as tag
      where tag = any(short_positive);

      select count(*)::integer into short_negative_hits
      from unnest(item_tags) as tag
      where tag = any(short_negative);

      long_centered := least(
        1.0,
        greatest(
          -1.0,
          (
            long_positive_hits::double precision
            - long_negative_hits::double precision
              * (config ->> 'negativeTagMultiplier')::double precision
          ) / item_tag_count::double precision
        )
      );
      short_centered := least(
        1.0,
        greatest(
          -1.0,
          (
            short_positive_hits::double precision
            - short_negative_hits::double precision
              * (config ->> 'negativeTagMultiplier')::double precision
          ) / item_tag_count::double precision
        )
      );
    else
      long_positive_hits := 0;
      long_negative_hits := 0;
      short_positive_hits := 0;
      short_negative_hits := 0;
      long_centered := 0.0;
      short_centered := 0.0;
    end if;

    personal_centered := least(
      1.0,
      greatest(
        -1.0,
        long_centered * (config ->> 'longTermWeight')::double precision
        + short_centered * (config ->> 'shortTermWeight')::double precision
      )
    );
    personal_fit := 0.5 + personal_centered * 0.5;

    -- Sparse Personal evidence shrinks toward the same neutral catalog prior.
    shrunk_fit := prior_score + evidence_strength * (personal_fit - prior_score);

    fit_sum := fit_sum + shrunk_fit;
    strength_sum := strength_sum + evidence_strength;
    minimum_fit := case
      when minimum_fit is null then shrunk_fit
      else least(minimum_fit, shrunk_fit)
    end;
    maximum_fit := case
      when maximum_fit is null then shrunk_fit
      else greatest(maximum_fit, shrunk_fit)
    end;
  end loop;

  if member_count = 0 then
    mean_fit := prior_score;
    minimum_fit := prior_score;
    maximum_fit := prior_score;
  else
    mean_fit := fit_sum / member_count::double precision;
    mean_strength := strength_sum / member_count::double precision;
  end if;

  member_delta := mean_fit - prior_score;
  if member_count >= 2 then
    consensus_delta := greatest(0.0, minimum_fit - prior_score);
    disagreement := greatest(0.0, maximum_fit - minimum_fit);
  end if;

  -- Only the neutral prior decays with Shared joint evidence. Accepted-member
  -- Personal fit remains useful even for a mature SharedProfile.
  prior_component := prior_centered
    * (config ->> 'priorPointWeight')::double precision
    * prior_sparsity_weight;
  member_component := member_delta * 2.0
    * (config ->> 'memberMeanPointWeight')::double precision;
  consensus_component := consensus_delta * 2.0
    * (config ->> 'consensusPointWeight')::double precision;
  disagreement_penalty := disagreement
    * (config ->> 'disagreementPointWeight')::double precision;

  contribution := least(
    max_abs,
    greatest(
      -max_abs,
      prior_component
      + member_component
      + consensus_component
      - disagreement_penalty
    )
  );

  return jsonb_build_object(
    'version', config ->> 'version',
    'applicable', true,
    'memberCount', member_count,
    'evidenceMemberCount', evidence_member_count,
    'sharedEvidenceCount', shared_evidence_count,
    'coverage', case
      when member_count = 0 then 0.0
      else round((evidence_member_count::numeric / member_count::numeric), 4)
    end,
    'meanMemberEvidenceStrength', round(mean_strength::numeric, 4),
    'neutralPrior', jsonb_build_object(
      'version', prior ->> 'version',
      'source', prior ->> 'source',
      'score', round(prior_score::numeric, 4),
      'sparsityWeight', round(prior_sparsity_weight::numeric, 4),
      'component', round(prior_component::numeric, 4)
    ),
    'memberFit', jsonb_build_object(
      'mean', round(mean_fit::numeric, 4),
      'minimum', round(minimum_fit::numeric, 4),
      'maximum', round(maximum_fit::numeric, 4),
      'deltaFromPrior', round(member_delta::numeric, 4),
      'component', round(member_component::numeric, 4)
    ),
    'consensus', jsonb_build_object(
      'deltaAbovePrior', round(consensus_delta::numeric, 4),
      'component', round(consensus_component::numeric, 4)
    ),
    'disagreement', jsonb_build_object(
      'range', round(disagreement::numeric, 4),
      'penalty', round(disagreement_penalty::numeric, 4)
    ),
    'contribution', round(contribution::numeric, 4),
    'privacyBoundary', config ->> 'privacyBoundary',
    'personalEvidenceCopied', false
  );
end;
$$;

-- Retain the original private helper signature only as a compatibility wrapper.
-- New serving code below uses the pre-built context directly and therefore does
-- not rebuild member memory for every candidate/explanation call.
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
  result jsonb;
begin
  result := private.shared_common_fit_candidate_v1_1(
    private.build_shared_common_fit_context_v1_1(target_profile_id, decision_time),
    candidate_item_id,
    decision_time
  );

  return result || jsonb_build_object(
    'scoreContribution', coalesce(result -> 'contribution', '0'::jsonb)
  );
end;
$$;

revoke all on function private.shared_common_fit_config_v1_1()
  from public, anon, authenticated, service_role;
revoke all on function private.build_shared_common_fit_context_v1_1(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.shared_common_fit_candidate_v1_1(jsonb, uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.shared_common_fit_v1(uuid, uuid, text[], timestamptz)
  from public, anon, authenticated, service_role;

-- Patch only the already-hosted canonical V1 function. The guards describe the
-- exact shared-common-fit-v1 state this forward migration expects.
do $$
declare
  definition text;
  patched text;
  old_declaration text := '  candidate_pool_limit integer;';
  new_declaration text := E'  candidate_pool_limit integer;\n  shared_common_context jsonb;\n  current_policy_version text;';
  old_state_build text := '  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);';
  new_state_build text := E'  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);\n  shared_common_context := private.build_shared_common_fit_context_v1_1(target_profile_id, request_time);\n  current_policy_version := case\n    when coalesce((shared_common_context ->> ''applicable'')::boolean, false)\n      then ''scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1''\n    else ''scenario-memory-v1+resurfacing-v1''\n  end;';
  old_policy_literal text := '''scenario-memory-v1+resurfacing-v1''';
  old_scenario_select text := E'    select\n      base_ranking.*,\n      coalesce(scenario.raw_score, 0.0) as scenario_raw_score,';
  new_scenario_select text := E'    select\n      base_ranking.*,\n      private.shared_common_fit_candidate_v1_1(\n        shared_common_context,\n        base_ranking.item_id,\n        request_time\n      ) as shared_common_fit,\n      coalesce(scenario.raw_score, 0.0) as scenario_raw_score,';
  old_score text := E'      scenario_enriched.score\n        + scenario_enriched.scenario_score\n          * private.serving_scenario_weight_v1(\n              target_profile_id,\n              requested_mode,\n              request_time\n            )\n        + coalesce(\n            (private.shared_common_fit_v1(\n              target_profile_id,\n              scenario_enriched.item_id,\n              scenario_enriched.tags,\n              request_time\n            ) ->> ''scoreContribution'')::double precision,\n            0.0\n          ) as final_score,';
  new_score text := E'      scenario_enriched.score\n        + scenario_enriched.scenario_score\n          * private.serving_scenario_weight_v1(\n              target_profile_id,\n              requested_mode,\n              request_time\n            )\n        + coalesce(\n            (scenario_enriched.shared_common_fit ->> ''contribution'')::double precision,\n            0.0\n          ) as final_score,';
  old_explanation text := E'          ''policyVersion'', ''scenario-memory-v1+resurfacing-v1'',\n          ''scenarioMemory'', jsonb_build_object(\n            ''rawScore'', round(rescored.scenario_raw_score::numeric, 4),\n            ''score'', round(rescored.scenario_score::numeric, 4),\n            ''support'', rescored.scenario_support,\n            ''maxSimilarity'', round(rescored.scenario_max_similarity::numeric, 4),\n            ''retrievalScope'', ''PROFILE'',\n            ''maxEpisodes'', 30\n          ),\n          ''sharedCommonFit'', private.shared_common_fit_v1(\n            target_profile_id,\n            rescored.item_id,\n            rescored.tags,\n            request_time\n          )';
  new_explanation text := E'          ''policyVersion'', current_policy_version,\n          ''scenarioMemory'', jsonb_build_object(\n            ''rawScore'', round(rescored.scenario_raw_score::numeric, 4),\n            ''score'', round(rescored.scenario_score::numeric, 4),\n            ''support'', rescored.scenario_support,\n            ''maxSimilarity'', round(rescored.scenario_max_similarity::numeric, 4),\n            ''retrievalScope'', ''PROFILE'',\n            ''maxEpisodes'', 30\n          ),\n          ''sharedCommonFit'', rescored.shared_common_fit';
begin
  definition := pg_get_functiondef(
    'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure
  );
  patched := definition;

  if position(old_declaration in patched) = 0 then
    raise exception 'shared-common-fit-v1.1 guard failed: declaration anchor missing';
  end if;
  patched := replace(patched, old_declaration, new_declaration);

  if position(old_state_build in patched) = 0 then
    raise exception 'shared-common-fit-v1.1 guard failed: state anchor missing';
  end if;
  patched := replace(patched, old_state_build, new_state_build);

  if position(old_policy_literal in patched) = 0 then
    raise exception 'shared-common-fit-v1.1 guard failed: policy anchor missing';
  end if;
  patched := replace(patched, old_policy_literal, 'current_policy_version');

  if position(old_scenario_select in patched) = 0 then
    raise exception 'shared-common-fit-v1.1 guard failed: scenario anchor missing';
  end if;
  patched := replace(patched, old_scenario_select, new_scenario_select);

  if position(old_score in patched) = 0 then
    raise exception 'shared-common-fit-v1.1 guard failed: score anchor missing';
  end if;
  patched := replace(patched, old_score, new_score);

  -- old_policy_literal replacement intentionally changes the old explanation
  -- anchor's policy literal. Normalize the anchor before replacing it.
  old_explanation := replace(old_explanation, '''scenario-memory-v1+resurfacing-v1''', 'current_policy_version');
  if position(old_explanation in patched) = 0 then
    raise exception 'shared-common-fit-v1.1 guard failed: explanation anchor missing';
  end if;
  patched := replace(patched, old_explanation, new_explanation);

  execute patched;
end;
$$;

revoke all on function private.rank_items_v1_internal(uuid, text, text, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.rank_items_v1_internal(uuid, text, text, integer, jsonb)
  to authenticated;
