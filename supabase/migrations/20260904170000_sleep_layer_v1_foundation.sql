-- Sprint 013C: controlled SleepLayer / EvolutionEngine foundation.
--
-- This migration deliberately does not change the visible ranking policy.
-- New production PredictionRuns are tagged with the current baseline Champion,
-- while transparent scalar Challengers are queued and evaluated only in shadow.
-- Automatic promotion remains disabled.

-- -----------------------------------------------------------------------------
-- Immutable PredictorGenome registry
-- -----------------------------------------------------------------------------

create or replace function private.genome_weight_v1(
  genome_config jsonb,
  requested_mode text,
  weight_key text
)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw_value text;
  parsed_value double precision;
begin
  if requested_mode not in ('FOR_YOU', 'SURPRISE', 'RISK') then
    raise exception 'Unsupported genome mode %', requested_mode using errcode = '22023';
  end if;

  if weight_key not in (
    'direct',
    'longTerm',
    'shortTerm',
    'novelty',
    'exploration',
    'scenario',
    'reactionPenalty',
    'impressionCooldown'
  ) then
    raise exception 'Unsupported genome weight %', weight_key using errcode = '22023';
  end if;

  raw_value := genome_config #>> array['modeWeights', requested_mode, weight_key];

  if raw_value is null
     or raw_value !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$' then
    raise exception 'Genome weight %.% is missing or non-numeric', requested_mode, weight_key
      using errcode = '22023';
  end if;

  parsed_value := raw_value::double precision;

  if parsed_value < 0.0 or parsed_value > 4.0 then
    raise exception 'Genome weight %.% must be between 0 and 4', requested_mode, weight_key
      using errcode = '22023';
  end if;

  return parsed_value;
end;
$$;

create or replace function private.genome_config_is_valid_v1(genome_config jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  requested_mode text;
  weight_key text;
begin
  if genome_config is null or jsonb_typeof(genome_config) <> 'object' then
    return false;
  end if;

  if genome_config ->> 'schemaVersion' <> 'scalar-genome-v1' then
    return false;
  end if;

  foreach requested_mode in array array['FOR_YOU', 'SURPRISE', 'RISK'] loop
    foreach weight_key in array array[
      'direct',
      'longTerm',
      'shortTerm',
      'novelty',
      'exploration',
      'scenario',
      'reactionPenalty',
      'impressionCooldown'
    ] loop
      perform private.genome_weight_v1(genome_config, requested_mode, weight_key);
    end loop;
  end loop;

  return true;
exception when others then
  return false;
end;
$$;

create table private.predictor_genomes (
  id uuid primary key default gen_random_uuid(),
  genome_key text not null unique,
  parent_genome_ids uuid[] not null default '{}'::uuid[],
  model_family text not null,
  code_version text not null,
  feature_version text not null,
  memory_version text not null,
  outcome_version text not null,
  reward_version text not null,
  config jsonb not null,
  random_seed bigint not null default 0,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint predictor_genomes_model_family_check
    check (model_family in ('PREDICTION_V1_BASELINE', 'SCALAR_V1')),
  constraint predictor_genomes_key_check
    check (genome_key ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  constraint predictor_genomes_config_check
    check (private.genome_config_is_valid_v1(config))
);

alter table private.predictor_genomes enable row level security;

-- -----------------------------------------------------------------------------
-- Append-only promotion / assignment audit. Production still remains on the
-- seeded baseline assignment until a later serving-wiring gate is accepted.
-- -----------------------------------------------------------------------------

create table private.evaluation_windows (
  id uuid primary key default gen_random_uuid(),
  window_key text not null unique,
  prediction_from timestamptz not null,
  prediction_until timestamptz not null,
  input_cutoff timestamptz not null,
  outcome_cutoff timestamptz not null,
  metric_version text not null default 'signed-exposed-rank-utility-v1',
  reward_version text not null default 'outcome-reward-v1',
  minimum_exposure_count integer not null default 1,
  config jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint evaluation_windows_time_check
    check (
      prediction_from < prediction_until
      and prediction_until <= input_cutoff
      and input_cutoff < outcome_cutoff
    ),
  constraint evaluation_windows_min_exposure_check
    check (minimum_exposure_count >= 1),
  constraint evaluation_windows_config_check
    check (jsonb_typeof(config) = 'object')
);

alter table private.evaluation_windows enable row level security;

create table private.promotion_decisions (
  id uuid primary key default gen_random_uuid(),
  genome_id uuid not null references private.predictor_genomes(id),
  scope_type text not null,
  scope_key text not null,
  from_state text,
  to_state text not null,
  evaluation_window_id uuid references private.evaluation_windows(id),
  metrics jsonb not null default '{}'::jsonb,
  guardrails jsonb not null default '{}'::jsonb,
  decided_by text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint promotion_decisions_scope_check
    check (scope_type in ('GLOBAL', 'COHORT', 'PROFILE')),
  constraint promotion_decisions_state_check
    check (to_state in (
      'DRAFT',
      'OFFLINE_VALIDATED',
      'SHADOW',
      'CANDIDATE',
      'CANARY',
      'EXPERIMENT',
      'CHAMPION',
      'RETIRED',
      'REJECTED',
      'ROLLED_BACK'
    )),
  constraint promotion_decisions_json_check
    check (jsonb_typeof(metrics) = 'object' and jsonb_typeof(guardrails) = 'object')
);

create index promotion_decisions_genome_created_idx
  on private.promotion_decisions (genome_id, created_at desc, id desc);

alter table private.promotion_decisions enable row level security;

create table private.policy_assignments (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null,
  scope_key text not null,
  genome_id uuid not null references private.predictor_genomes(id),
  previous_assignment_id uuid references private.policy_assignments(id),
  rollback_target_assignment_id uuid references private.policy_assignments(id),
  effective_from timestamptz not null,
  decided_by text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint policy_assignments_scope_check
    check (scope_type in ('GLOBAL', 'COHORT', 'PROFILE'))
);

create index policy_assignments_scope_effective_idx
  on private.policy_assignments (scope_type, scope_key, effective_from desc, created_at desc);

alter table private.policy_assignments enable row level security;

-- -----------------------------------------------------------------------------
-- Immutable shadow artifacts + mutable operational queue
-- -----------------------------------------------------------------------------

create table private.shadow_prediction_jobs (
  id uuid primary key default gen_random_uuid(),
  source_prediction_id uuid not null references private.prediction_runs(id) on delete cascade,
  genome_id uuid not null references private.predictor_genomes(id),
  status text not null default 'QUEUED',
  attempts integer not null default 0,
  last_error text,
  enqueued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint shadow_prediction_jobs_unique unique (source_prediction_id, genome_id),
  constraint shadow_prediction_jobs_status_check
    check (status in ('QUEUED', 'PROCESSING', 'DONE', 'FAILED')),
  constraint shadow_prediction_jobs_attempts_check
    check (attempts >= 0)
);

create index shadow_prediction_jobs_queue_idx
  on private.shadow_prediction_jobs (status, enqueued_at)
  where status in ('QUEUED', 'FAILED');

alter table private.shadow_prediction_jobs enable row level security;

create table private.shadow_prediction_runs (
  id uuid primary key default gen_random_uuid(),
  source_prediction_id uuid not null references private.prediction_runs(id),
  genome_id uuid not null references private.predictor_genomes(id),
  profile_id uuid not null references public.profiles(id),
  actor_user_id uuid not null references public.users(id),
  session_id uuid,
  as_of timestamptz not null,
  requested_item_type text,
  discovery_mode text not null,
  context jsonb not null,
  state_snapshot jsonb not null,
  source_model_version text not null,
  source_policy_version text not null,
  code_version text not null,
  feature_version text not null,
  memory_version text not null,
  outcome_version text not null,
  reward_version text not null,
  candidate_count integer not null,
  hypothetical_result_count integer not null,
  created_at timestamptz not null default now(),
  constraint shadow_prediction_runs_unique unique (source_prediction_id, genome_id),
  constraint shadow_prediction_runs_mode_check
    check (discovery_mode in ('FOR_YOU', 'SURPRISE', 'RISK')),
  constraint shadow_prediction_runs_counts_check
    check (candidate_count >= 1 and hypothetical_result_count >= 1 and hypothetical_result_count <= candidate_count),
  constraint shadow_prediction_runs_context_check
    check (jsonb_typeof(context) = 'object' and jsonb_typeof(state_snapshot) = 'object')
);

create index shadow_prediction_runs_source_idx
  on private.shadow_prediction_runs (source_prediction_id, genome_id);
create index shadow_prediction_runs_profile_asof_idx
  on private.shadow_prediction_runs (profile_id, as_of desc);

alter table private.shadow_prediction_runs enable row level security;

create table private.shadow_prediction_candidates (
  shadow_prediction_id uuid not null references private.shadow_prediction_runs(id) on delete cascade,
  item_id uuid not null references public.items(id),
  source_rank integer not null,
  production_final_rank integer not null,
  shadow_rank integer not null,
  source_score double precision not null,
  production_final_score double precision not null,
  shadow_score double precision not null,
  scenario_score double precision not null default 0.0,
  hypothetical_selected boolean not null,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (shadow_prediction_id, item_id),
  constraint shadow_prediction_candidates_rank_check
    check (source_rank >= 1 and production_final_rank >= 1 and shadow_rank >= 1),
  constraint shadow_prediction_candidates_explanation_check
    check (jsonb_typeof(explanation) = 'object')
);

create index shadow_prediction_candidates_rank_idx
  on private.shadow_prediction_candidates (shadow_prediction_id, shadow_rank);

alter table private.shadow_prediction_candidates enable row level security;

create table private.genome_evaluations (
  id uuid primary key default gen_random_uuid(),
  evaluation_window_id uuid not null references private.evaluation_windows(id),
  genome_id uuid not null references private.predictor_genomes(id),
  scope_type text not null,
  scope_key text not null,
  production_metric double precision,
  challenger_metric double precision,
  raw_advantage double precision,
  shrunk_advantage double precision,
  outcome_count integer not null,
  exposed_count integer not null,
  prediction_count integer not null,
  profile_count integer not null,
  coverage double precision not null,
  standard_error double precision,
  eligibility_reason text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint genome_evaluations_unique
    unique (evaluation_window_id, genome_id, scope_type, scope_key),
  constraint genome_evaluations_scope_check
    check (scope_type in ('GLOBAL', 'COHORT', 'PROFILE')),
  constraint genome_evaluations_counts_check
    check (
      outcome_count >= 0
      and exposed_count >= 0
      and prediction_count >= 0
      and profile_count >= 0
      and coverage >= 0.0
      and coverage <= 1.0
    ),
  constraint genome_evaluations_metrics_check
    check (jsonb_typeof(metrics) = 'object')
);

create index genome_evaluations_window_scope_idx
  on private.genome_evaluations (evaluation_window_id, scope_type, scope_key);

alter table private.genome_evaluations enable row level security;

-- -----------------------------------------------------------------------------
-- Immutability guards. Operational queue rows are intentionally excluded.
-- -----------------------------------------------------------------------------

create or replace function private.reject_immutable_prediction_artifact_change_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is immutable; create a new versioned row instead', tg_table_name
    using errcode = '55000';
end;
$$;

create trigger predictor_genomes_immutable
before update or delete on private.predictor_genomes
for each row execute function private.reject_immutable_prediction_artifact_change_v1();

create trigger evaluation_windows_immutable
before update or delete on private.evaluation_windows
for each row execute function private.reject_immutable_prediction_artifact_change_v1();

create trigger promotion_decisions_immutable
before update or delete on private.promotion_decisions
for each row execute function private.reject_immutable_prediction_artifact_change_v1();

create trigger policy_assignments_immutable
before update or delete on private.policy_assignments
for each row execute function private.reject_immutable_prediction_artifact_change_v1();

create trigger shadow_prediction_runs_immutable
before update or delete on private.shadow_prediction_runs
for each row execute function private.reject_immutable_prediction_artifact_change_v1();

create trigger shadow_prediction_candidates_immutable
before update or delete on private.shadow_prediction_candidates
for each row execute function private.reject_immutable_prediction_artifact_change_v1();

create trigger genome_evaluations_immutable
before update or delete on private.genome_evaluations
for each row execute function private.reject_immutable_prediction_artifact_change_v1();

-- -----------------------------------------------------------------------------
-- Seed the exact current production baseline plus three bounded scalar shadows.
-- IDs are deterministic from semantic keys so migrations never depend on an
-- externally generated identifier.
-- -----------------------------------------------------------------------------

insert into private.predictor_genomes (
  id,
  genome_key,
  parent_genome_ids,
  model_family,
  code_version,
  feature_version,
  memory_version,
  outcome_version,
  reward_version,
  config,
  random_seed,
  created_by
) values
(
  md5('kajo:predictor-genome:prediction-v1-baseline')::uuid,
  'prediction-v1-baseline',
  '{}'::uuid[],
  'PREDICTION_V1_BASELINE',
  'prediction-v1.0+sleep-layer-v1',
  'prediction-features-v1',
  'memory-state-v1',
  'outcome-precedence-v1',
  'outcome-reward-v1',
  '{
    "schemaVersion":"scalar-genome-v1",
    "modeWeights":{
      "FOR_YOU":{"direct":1.0,"longTerm":1.0,"shortTerm":1.2,"novelty":0.1,"exploration":0.0,"scenario":2.2,"reactionPenalty":1.0,"impressionCooldown":1.0},
      "SURPRISE":{"direct":1.0,"longTerm":0.75,"shortTerm":0.7,"novelty":1.5,"exploration":0.5,"scenario":1.6,"reactionPenalty":1.0,"impressionCooldown":1.0},
      "RISK":{"direct":1.0,"longTerm":0.4,"shortTerm":0.35,"novelty":2.5,"exploration":1.5,"scenario":1.0,"reactionPenalty":1.0,"impressionCooldown":1.0}
    }
  }'::jsonb,
  0,
  'migration:20260904170000_sleep_layer_v1_foundation'
),
(
  md5('kajo:predictor-genome:short-term-tilt-v1')::uuid,
  'short-term-tilt-v1',
  array[md5('kajo:predictor-genome:prediction-v1-baseline')::uuid],
  'SCALAR_V1',
  'sleep-layer-scalar-v1',
  'prediction-features-v1',
  'memory-state-v1',
  'outcome-precedence-v1',
  'outcome-reward-v1',
  '{
    "schemaVersion":"scalar-genome-v1",
    "modeWeights":{
      "FOR_YOU":{"direct":1.0,"longTerm":0.8,"shortTerm":1.5,"novelty":0.1,"exploration":0.0,"scenario":2.0,"reactionPenalty":1.0,"impressionCooldown":1.0},
      "SURPRISE":{"direct":1.0,"longTerm":0.6,"shortTerm":1.0,"novelty":1.5,"exploration":0.5,"scenario":1.5,"reactionPenalty":1.0,"impressionCooldown":1.0},
      "RISK":{"direct":1.0,"longTerm":0.3,"shortTerm":0.55,"novelty":2.5,"exploration":1.5,"scenario":0.9,"reactionPenalty":1.0,"impressionCooldown":1.0}
    }
  }'::jsonb,
  101,
  'migration:20260904170000_sleep_layer_v1_foundation'
),
(
  md5('kajo:predictor-genome:scenario-tilt-v1')::uuid,
  'scenario-tilt-v1',
  array[md5('kajo:predictor-genome:prediction-v1-baseline')::uuid],
  'SCALAR_V1',
  'sleep-layer-scalar-v1',
  'prediction-features-v1',
  'memory-state-v1',
  'outcome-precedence-v1',
  'outcome-reward-v1',
  '{
    "schemaVersion":"scalar-genome-v1",
    "modeWeights":{
      "FOR_YOU":{"direct":1.0,"longTerm":1.0,"shortTerm":1.2,"novelty":0.1,"exploration":0.0,"scenario":2.8,"reactionPenalty":1.0,"impressionCooldown":1.0},
      "SURPRISE":{"direct":1.0,"longTerm":0.75,"shortTerm":0.7,"novelty":1.5,"exploration":0.5,"scenario":2.0,"reactionPenalty":1.0,"impressionCooldown":1.0},
      "RISK":{"direct":1.0,"longTerm":0.4,"shortTerm":0.35,"novelty":2.5,"exploration":1.5,"scenario":1.2,"reactionPenalty":1.0,"impressionCooldown":1.0}
    }
  }'::jsonb,
  202,
  'migration:20260904170000_sleep_layer_v1_foundation'
),
(
  md5('kajo:predictor-genome:novelty-tilt-v1')::uuid,
  'novelty-tilt-v1',
  array[md5('kajo:predictor-genome:prediction-v1-baseline')::uuid],
  'SCALAR_V1',
  'sleep-layer-scalar-v1',
  'prediction-features-v1',
  'memory-state-v1',
  'outcome-precedence-v1',
  'outcome-reward-v1',
  '{
    "schemaVersion":"scalar-genome-v1",
    "modeWeights":{
      "FOR_YOU":{"direct":1.0,"longTerm":0.95,"shortTerm":1.15,"novelty":0.25,"exploration":0.15,"scenario":2.0,"reactionPenalty":1.0,"impressionCooldown":1.0},
      "SURPRISE":{"direct":1.0,"longTerm":0.7,"shortTerm":0.65,"novelty":1.9,"exploration":0.8,"scenario":1.4,"reactionPenalty":1.0,"impressionCooldown":1.0},
      "RISK":{"direct":1.0,"longTerm":0.35,"shortTerm":0.3,"novelty":3.0,"exploration":2.0,"scenario":0.9,"reactionPenalty":1.0,"impressionCooldown":1.0}
    }
  }'::jsonb,
  303,
  'migration:20260904170000_sleep_layer_v1_foundation'
);

insert into private.promotion_decisions (
  genome_id,
  scope_type,
  scope_key,
  from_state,
  to_state,
  decided_by,
  reason
)
select
  genome.id,
  'GLOBAL',
  'GLOBAL',
  'DRAFT',
  case when genome.genome_key = 'prediction-v1-baseline' then 'CHAMPION' else 'SHADOW' end,
  'migration:20260904170000_sleep_layer_v1_foundation',
  case
    when genome.genome_key = 'prediction-v1-baseline'
      then 'Record the already-serving Prediction V1 baseline as the initial global Champion.'
    else 'Seed a bounded transparent scalar Challenger for prospective shadow evaluation only.'
  end
from private.predictor_genomes as genome;

insert into private.policy_assignments (
  scope_type,
  scope_key,
  genome_id,
  effective_from,
  decided_by,
  reason
)
select
  'GLOBAL',
  'GLOBAL',
  genome.id,
  clock_timestamp(),
  'migration:20260904170000_sleep_layer_v1_foundation',
  'Initial assignment records the already-serving Prediction V1 baseline. Challenger assignment is disabled until a later accepted serving/promotion gate.'
from private.predictor_genomes as genome
where genome.genome_key = 'prediction-v1-baseline';

-- -----------------------------------------------------------------------------
-- Tag future production PredictionRuns with the resolved baseline assignment.
-- Existing historical runs intentionally remain null because genomes did not
-- exist as explicit artifacts when those predictions were produced.
-- -----------------------------------------------------------------------------

alter table private.prediction_runs
  add column genome_id uuid references private.predictor_genomes(id),
  add column policy_assignment_id uuid references private.policy_assignments(id);

create index prediction_runs_genome_requested_idx
  on private.prediction_runs (genome_id, requested_at desc)
  where genome_id is not null;

create or replace function private.resolve_policy_assignment_v1(
  target_profile_id uuid,
  decision_time timestamptz
)
returns table (
  assignment_id uuid,
  genome_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    assignment.id,
    assignment.genome_id
  from private.policy_assignments as assignment
  where assignment.effective_from <= decision_time
    and (
      (assignment.scope_type = 'PROFILE' and assignment.scope_key = target_profile_id::text)
      or (assignment.scope_type = 'GLOBAL' and assignment.scope_key = 'GLOBAL')
    )
  order by
    case when assignment.scope_type = 'PROFILE' then 0 else 1 end,
    assignment.effective_from desc,
    assignment.created_at desc,
    assignment.id desc
  limit 1;
$$;

create or replace function private.attach_prediction_policy_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved record;
begin
  if new.genome_id is not null or new.policy_assignment_id is not null then
    return new;
  end if;

  select * into resolved
  from private.resolve_policy_assignment_v1(new.profile_id, new.requested_at);

  if resolved.assignment_id is null or resolved.genome_id is null then
    raise exception 'No valid Prediction policy assignment for Profile %', new.profile_id
      using errcode = '55000';
  end if;

  new.policy_assignment_id := resolved.assignment_id;
  new.genome_id := resolved.genome_id;
  return new;
end;
$$;

create trigger prediction_runs_attach_policy_v1
before insert on private.prediction_runs
for each row execute function private.attach_prediction_policy_v1();

-- -----------------------------------------------------------------------------
-- Prospective shadow queue. This trigger only queues work; it never computes a
-- Challenger inside the online request and never changes delivery.
-- -----------------------------------------------------------------------------

create or replace function private.enqueue_prediction_shadows_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.candidate_count <= 0 then
    return new;
  end if;

  insert into private.shadow_prediction_jobs (
    source_prediction_id,
    genome_id
  )
  select
    new.id,
    latest_state.genome_id
  from (
    select distinct on (decision.genome_id)
      decision.genome_id,
      decision.to_state
    from private.promotion_decisions as decision
    order by decision.genome_id, decision.created_at desc, decision.id desc
  ) as latest_state
  where latest_state.to_state = 'SHADOW'
    and latest_state.genome_id <> new.genome_id
  on conflict (source_prediction_id, genome_id) do nothing;

  return new;
end;
$$;

create trigger prediction_runs_enqueue_shadows_v1
after update of candidate_count, result_count on private.prediction_runs
for each row
when (
  new.candidate_count > 0
  and (old.candidate_count is distinct from new.candidate_count
       or old.result_count is distinct from new.result_count)
)
execute function private.enqueue_prediction_shadows_v1();

-- -----------------------------------------------------------------------------
-- Frozen scalar shadow scorer. It consumes only the already-persisted candidate
-- explanation + Scenario score from the source PredictionRun.
-- -----------------------------------------------------------------------------

create or replace function private.jsonb_numeric_component_v1(
  source jsonb,
  component_key text
)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw_value text;
begin
  raw_value := source ->> component_key;

  if raw_value is null
     or raw_value !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$' then
    return 0.0;
  end if;

  return raw_value::double precision;
end;
$$;

create or replace function private.shadow_candidate_score_v1(
  requested_mode text,
  candidate_explanation jsonb,
  stored_scenario_score double precision,
  genome_config jsonb
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select
      private.jsonb_numeric_component_v1(candidate_explanation, 'direct')
        * private.genome_weight_v1(genome_config, requested_mode, 'direct')
    + private.jsonb_numeric_component_v1(candidate_explanation, 'longTerm')
        * private.genome_weight_v1(genome_config, requested_mode, 'longTerm')
    + private.jsonb_numeric_component_v1(candidate_explanation, 'shortTerm')
        * private.genome_weight_v1(genome_config, requested_mode, 'shortTerm')
    + private.jsonb_numeric_component_v1(candidate_explanation, 'novelty')
        * private.genome_weight_v1(genome_config, requested_mode, 'novelty')
    + private.jsonb_numeric_component_v1(candidate_explanation, 'exploration')
        * private.genome_weight_v1(genome_config, requested_mode, 'exploration')
    + coalesce(stored_scenario_score, 0.0)
        * private.genome_weight_v1(genome_config, requested_mode, 'scenario')
    - private.jsonb_numeric_component_v1(candidate_explanation, 'reactionQueuePenalty')
        * private.genome_weight_v1(genome_config, requested_mode, 'reactionPenalty')
    - private.jsonb_numeric_component_v1(candidate_explanation, 'impressionCooldownPenalty')
        * private.genome_weight_v1(genome_config, requested_mode, 'impressionCooldown');
$$;

create or replace function private.process_shadow_prediction_jobs_v1(
  batch_limit integer default 25
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  selected_job record;
  source_run record;
  genome record;
  shadow_run_id uuid;
  processed_count integer := 0;
  failed_count integer := 0;
begin
  if batch_limit < 1 or batch_limit > 250 then
    raise exception 'Batch limit must be between 1 and 250' using errcode = '22023';
  end if;

  for selected_job in
    select job.id, job.source_prediction_id, job.genome_id
    from private.shadow_prediction_jobs as job
    where job.status = 'QUEUED'
    order by job.enqueued_at, job.id
    limit batch_limit
    for update skip locked
  loop
    update private.shadow_prediction_jobs
    set
      status = 'PROCESSING',
      attempts = attempts + 1,
      started_at = clock_timestamp(),
      last_error = null
    where id = selected_job.id;

    begin
      select * into source_run
      from private.prediction_runs as production_run
      where production_run.id = selected_job.source_prediction_id;

      if source_run.id is null
         or source_run.candidate_count <= 0
         or source_run.result_count <= 0 then
        raise exception 'Source PredictionRun is missing or incomplete';
      end if;

      select * into genome
      from private.predictor_genomes as stored_genome
      where stored_genome.id = selected_job.genome_id;

      if genome.id is null then
        raise exception 'PredictorGenome is missing';
      end if;

      shadow_run_id := gen_random_uuid();

      insert into private.shadow_prediction_runs (
        id,
        source_prediction_id,
        genome_id,
        profile_id,
        actor_user_id,
        session_id,
        as_of,
        requested_item_type,
        discovery_mode,
        context,
        state_snapshot,
        source_model_version,
        source_policy_version,
        code_version,
        feature_version,
        memory_version,
        outcome_version,
        reward_version,
        candidate_count,
        hypothetical_result_count
      ) values (
        shadow_run_id,
        source_run.id,
        genome.id,
        source_run.profile_id,
        source_run.actor_user_id,
        source_run.session_id,
        source_run.requested_at,
        source_run.requested_item_type,
        source_run.discovery_mode,
        source_run.context,
        source_run.state_snapshot,
        source_run.model_version,
        source_run.policy_version,
        genome.code_version,
        genome.feature_version,
        genome.memory_version,
        genome.outcome_version,
        genome.reward_version,
        source_run.candidate_count,
        source_run.result_count
      );

      insert into private.shadow_prediction_candidates (
        shadow_prediction_id,
        item_id,
        source_rank,
        production_final_rank,
        shadow_rank,
        source_score,
        production_final_score,
        shadow_score,
        scenario_score,
        hypothetical_selected,
        explanation
      )
      with rescored as (
        select
          production_candidate.*,
          private.shadow_candidate_score_v1(
            source_run.discovery_mode,
            production_candidate.explanation,
            production_candidate.scenario_score,
            genome.config
          ) as challenger_score
        from private.prediction_candidates as production_candidate
        where production_candidate.prediction_id = source_run.id
      ),
      reranked as (
        select
          rescored.*,
          row_number() over (
            order by rescored.challenger_score desc, rescored.item_id
          )::integer as challenger_rank
        from rescored
      )
      select
        shadow_run_id,
        reranked.item_id,
        reranked.source_rank,
        reranked.final_rank,
        reranked.challenger_rank,
        reranked.source_score,
        reranked.final_score,
        reranked.challenger_score,
        reranked.scenario_score,
        reranked.challenger_rank <= source_run.result_count,
        jsonb_build_object(
          'version', 'shadow-prediction-v1',
          'sourcePredictionId', source_run.id,
          'genomeKey', genome.genome_key,
          'genomeId', genome.id,
          'asOf', source_run.requested_at,
          'input', jsonb_build_object(
            'productionExplanation', reranked.explanation,
            'storedScenarioScore', reranked.scenario_score
          ),
          'score', reranked.challenger_score,
          'productionRank', reranked.final_rank,
          'shadowRank', reranked.challenger_rank,
          'hypotheticalOnly', true
        )
      from reranked;

      if (
        select count(*)
        from private.shadow_prediction_candidates as stored_shadow
        where stored_shadow.shadow_prediction_id = shadow_run_id
      ) <> source_run.candidate_count then
        raise exception 'Shadow candidate count does not match frozen source pool';
      end if;

      update private.shadow_prediction_jobs
      set
        status = 'DONE',
        finished_at = clock_timestamp()
      where id = selected_job.id;

      processed_count := processed_count + 1;
    exception when others then
      update private.shadow_prediction_jobs
      set
        status = 'FAILED',
        finished_at = clock_timestamp(),
        last_error = left(sqlerrm, 1000)
      where id = selected_job.id;

      failed_count := failed_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'processed', processed_count,
    'failed', failed_count
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Mature exposed-outcome evaluation. The metric never labels an unexposed
-- shadow-only Item as a hit or miss. It only asks whether a Challenger would
-- have moved an actually exposed Item with an observed Outcome in the right
-- direction inside the same frozen candidate pool.
-- -----------------------------------------------------------------------------

create or replace function private.evaluate_shadow_genome_v1(
  target_window_id uuid,
  target_genome_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  evaluation_window record;
  inserted_count integer := 0;
begin
  select * into evaluation_window
  from private.evaluation_windows as stored_window
  where stored_window.id = target_window_id;

  if evaluation_window.id is null then
    raise exception 'EvaluationWindow not found' using errcode = '22023';
  end if;

  if clock_timestamp() < evaluation_window.outcome_cutoff then
    raise exception 'EvaluationWindow has not matured yet' using errcode = '55000';
  end if;

  if exists (
    select 1
    from private.genome_evaluations as existing
    where existing.evaluation_window_id = target_window_id
      and existing.genome_id = target_genome_id
  ) then
    raise exception 'GenomeEvaluation already exists for this immutable window/genome'
      using errcode = '23505';
  end if;

  with eligible_runs as materialized (
    select
      shadow.id as shadow_prediction_id,
      shadow.source_prediction_id,
      production.profile_id,
      production.requested_at,
      production.candidate_count
    from private.shadow_prediction_runs as shadow
    join private.prediction_runs as production
      on production.id = shadow.source_prediction_id
    where shadow.genome_id = target_genome_id
      and production.requested_at >= evaluation_window.prediction_from
      and production.requested_at < evaluation_window.prediction_until
      and shadow.as_of = production.requested_at
      and shadow.candidate_count = production.candidate_count
  ),
  reversed_events as (
    select (event.properties ->> 'reversedEventId')::uuid as event_id
    from public.events as event
    where event.event_type = 'ITEM_INTERACTION_UNDONE'
      and event.occurred_at <= evaluation_window.outcome_cutoff
      and event.properties ? 'reversedEventId'
      and (event.properties ->> 'reversedEventId') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  exposed as materialized (
    select distinct
      eligible.source_prediction_id,
      eligible.shadow_prediction_id,
      eligible.profile_id,
      eligible.candidate_count,
      event.item_id
    from eligible_runs as eligible
    join public.events as event
      on event.prediction_id = eligible.source_prediction_id
     and event.profile_id = eligible.profile_id
     and event.event_type = 'ITEM_IMPRESSION'
     and event.item_id is not null
     and event.occurred_at >= eligible.requested_at
     and event.occurred_at <= evaluation_window.outcome_cutoff
    join private.prediction_candidates as production_candidate
      on production_candidate.prediction_id = eligible.source_prediction_id
     and production_candidate.item_id = event.item_id
     and production_candidate.selected_for_delivery
  ),
  ranked_outcomes as (
    select
      exposed.source_prediction_id,
      exposed.profile_id,
      exposed.item_id,
      outcome.event_type,
      outcome.properties,
      row_number() over (
        partition by exposed.source_prediction_id, exposed.item_id
        order by
          private.outcome_priority_v1(outcome.event_type) desc,
          outcome.occurred_at desc,
          outcome.id desc
      ) as outcome_rank
    from exposed
    join private.prediction_runs as production
      on production.id = exposed.source_prediction_id
    join public.events as outcome
      on outcome.prediction_id = exposed.source_prediction_id
     and outcome.profile_id = exposed.profile_id
     and outcome.item_id = exposed.item_id
     and outcome.occurred_at >= production.requested_at
     and outcome.occurred_at <= evaluation_window.outcome_cutoff
     and private.outcome_priority_v1(outcome.event_type) > 0
    where not exists (
      select 1
      from reversed_events
      where reversed_events.event_id = outcome.id
    )
  ),
  labelled as materialized (
    select
      exposed.source_prediction_id,
      exposed.profile_id,
      exposed.item_id,
      exposed.candidate_count,
      production_candidate.final_rank as production_rank,
      shadow_candidate.shadow_rank,
      private.outcome_reward_v1(
        ranked_outcomes.event_type,
        ranked_outcomes.properties
      ) as reward
    from exposed
    join ranked_outcomes
      on ranked_outcomes.source_prediction_id = exposed.source_prediction_id
     and ranked_outcomes.item_id = exposed.item_id
     and ranked_outcomes.outcome_rank = 1
    join private.prediction_candidates as production_candidate
      on production_candidate.prediction_id = exposed.source_prediction_id
     and production_candidate.item_id = exposed.item_id
    join private.shadow_prediction_candidates as shadow_candidate
      on shadow_candidate.shadow_prediction_id = exposed.shadow_prediction_id
     and shadow_candidate.item_id = exposed.item_id
  ),
  contributions as materialized (
    select
      labelled.*,
      labelled.reward * case
        when labelled.candidate_count <= 1 then 1.0
        else 1.0 - (
          (labelled.production_rank - 1)::double precision
          / (labelled.candidate_count - 1)::double precision
        )
      end as production_contribution,
      labelled.reward * case
        when labelled.candidate_count <= 1 then 1.0
        else 1.0 - (
          (labelled.shadow_rank - 1)::double precision
          / (labelled.candidate_count - 1)::double precision
        )
      end as challenger_contribution
    from labelled
  ),
  sample_scopes as (
    select
      'GLOBAL'::text as scope_type,
      'GLOBAL'::text as scope_key,
      contributions.*
    from contributions
    union all
    select
      'PROFILE'::text,
      contributions.profile_id::text,
      contributions.*
    from contributions
  ),
  exposure_scopes as (
    select
      'GLOBAL'::text as scope_type,
      'GLOBAL'::text as scope_key,
      count(*)::integer as exposed_count
    from exposed
    union all
    select
      'PROFILE'::text,
      exposed.profile_id::text,
      count(*)::integer
    from exposed
    group by exposed.profile_id
  ),
  aggregated as (
    select
      sample_scopes.scope_type,
      sample_scopes.scope_key,
      avg(sample_scopes.production_contribution) as production_metric,
      avg(sample_scopes.challenger_contribution) as challenger_metric,
      avg(sample_scopes.challenger_contribution - sample_scopes.production_contribution) as raw_advantage,
      count(*)::integer as outcome_count,
      count(distinct sample_scopes.source_prediction_id)::integer as prediction_count,
      count(distinct sample_scopes.profile_id)::integer as profile_count,
      case
        when count(*) > 1
          then stddev_samp(
            sample_scopes.challenger_contribution - sample_scopes.production_contribution
          ) / sqrt(count(*)::double precision)
        else null
      end as standard_error
    from sample_scopes
    group by sample_scopes.scope_type, sample_scopes.scope_key
  ),
  global_stats as (
    select aggregated.raw_advantage
    from aggregated
    where aggregated.scope_type = 'GLOBAL'
      and aggregated.scope_key = 'GLOBAL'
  )
  insert into private.genome_evaluations (
    evaluation_window_id,
    genome_id,
    scope_type,
    scope_key,
    production_metric,
    challenger_metric,
    raw_advantage,
    shrunk_advantage,
    outcome_count,
    exposed_count,
    prediction_count,
    profile_count,
    coverage,
    standard_error,
    eligibility_reason,
    metrics
  )
  select
    target_window_id,
    target_genome_id,
    aggregated.scope_type,
    aggregated.scope_key,
    aggregated.production_metric,
    aggregated.challenger_metric,
    aggregated.raw_advantage,
    case
      when aggregated.scope_type = 'PROFILE' then
        (
          aggregated.outcome_count::double precision
          / (aggregated.outcome_count::double precision + 30.0)
        ) * aggregated.raw_advantage
        + (
          1.0 - (
            aggregated.outcome_count::double precision
            / (aggregated.outcome_count::double precision + 30.0)
          )
        ) * coalesce((select raw_advantage from global_stats), 0.0)
      else aggregated.raw_advantage
    end,
    aggregated.outcome_count,
    exposure_scopes.exposed_count,
    aggregated.prediction_count,
    aggregated.profile_count,
    aggregated.outcome_count::double precision
      / greatest(1, exposure_scopes.exposed_count)::double precision,
    aggregated.standard_error,
    'MATURE_COMPARABLE_EXPOSED_OUTCOME',
    jsonb_build_object(
      'metricVersion', evaluation_window.metric_version,
      'rewardVersion', evaluation_window.reward_version,
      'counterfactualLimit', 'UNEXPOSED_SHADOW_ITEMS_UNLABELLED',
      'profileShrinkageK', 30,
      'productionMetric', aggregated.production_metric,
      'challengerMetric', aggregated.challenger_metric,
      'rawAdvantage', aggregated.raw_advantage,
      'standardError', aggregated.standard_error
    )
  from aggregated
  join exposure_scopes
    on exposure_scopes.scope_type = aggregated.scope_type
   and exposure_scopes.scope_key = aggregated.scope_key
  where exposure_scopes.exposed_count >= evaluation_window.minimum_exposure_count;

  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    insert into private.genome_evaluations (
      evaluation_window_id,
      genome_id,
      scope_type,
      scope_key,
      production_metric,
      challenger_metric,
      raw_advantage,
      shrunk_advantage,
      outcome_count,
      exposed_count,
      prediction_count,
      profile_count,
      coverage,
      standard_error,
      eligibility_reason,
      metrics
    ) values (
      target_window_id,
      target_genome_id,
      'GLOBAL',
      'GLOBAL',
      null,
      null,
      null,
      null,
      0,
      0,
      0,
      0,
      0.0,
      null,
      'NO_MATURE_COMPARABLE_OUTCOMES',
      jsonb_build_object(
        'metricVersion', evaluation_window.metric_version,
        'rewardVersion', evaluation_window.reward_version,
        'counterfactualLimit', 'UNEXPOSED_SHADOW_ITEMS_UNLABELLED'
      )
    );
    inserted_count := 1;
  end if;

  return jsonb_build_object('evaluationsInserted', inserted_count);
end;
$$;

-- -----------------------------------------------------------------------------
-- Access boundary. Mobile roles cannot inspect or operate the SleepLayer.
-- The service role may invoke only the bounded worker/evaluator functions.
-- -----------------------------------------------------------------------------

revoke all on table private.predictor_genomes
  from public, anon, authenticated, service_role;
revoke all on table private.evaluation_windows
  from public, anon, authenticated, service_role;
revoke all on table private.promotion_decisions
  from public, anon, authenticated, service_role;
revoke all on table private.policy_assignments
  from public, anon, authenticated, service_role;
revoke all on table private.shadow_prediction_jobs
  from public, anon, authenticated, service_role;
revoke all on table private.shadow_prediction_runs
  from public, anon, authenticated, service_role;
revoke all on table private.shadow_prediction_candidates
  from public, anon, authenticated, service_role;
revoke all on table private.genome_evaluations
  from public, anon, authenticated, service_role;

revoke all on function private.genome_weight_v1(jsonb, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.genome_config_is_valid_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.reject_immutable_prediction_artifact_change_v1()
  from public, anon, authenticated, service_role;
revoke all on function private.resolve_policy_assignment_v1(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.attach_prediction_policy_v1()
  from public, anon, authenticated, service_role;
revoke all on function private.enqueue_prediction_shadows_v1()
  from public, anon, authenticated, service_role;
revoke all on function private.jsonb_numeric_component_v1(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function private.shadow_candidate_score_v1(text, jsonb, double precision, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.process_shadow_prediction_jobs_v1(integer)
  from public, anon, authenticated, service_role;
revoke all on function private.evaluate_shadow_genome_v1(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.process_shadow_prediction_jobs_v1(integer)
  to service_role;
grant execute on function private.evaluate_shadow_genome_v1(uuid, uuid)
  to service_role;
