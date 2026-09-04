-- Forward-only performance follow-up for the hosted SleepLayer V1 foundation.
-- Keep the already-deployed base migration immutable and add covering indexes
-- for foreign keys reported by the Supabase performance advisor.

create index genome_evaluations_genome_id_idx
  on private.genome_evaluations (genome_id);

create index policy_assignments_genome_id_idx
  on private.policy_assignments (genome_id);

create index policy_assignments_previous_assignment_id_idx
  on private.policy_assignments (previous_assignment_id)
  where previous_assignment_id is not null;

create index policy_assignments_rollback_target_assignment_id_idx
  on private.policy_assignments (rollback_target_assignment_id)
  where rollback_target_assignment_id is not null;

create index prediction_runs_policy_assignment_id_idx
  on private.prediction_runs (policy_assignment_id)
  where policy_assignment_id is not null;

create index promotion_decisions_evaluation_window_id_idx
  on private.promotion_decisions (evaluation_window_id)
  where evaluation_window_id is not null;

create index shadow_prediction_candidates_item_id_idx
  on private.shadow_prediction_candidates (item_id);

create index shadow_prediction_jobs_genome_id_idx
  on private.shadow_prediction_jobs (genome_id);

create index shadow_prediction_runs_actor_user_id_idx
  on private.shadow_prediction_runs (actor_user_id);

create index shadow_prediction_runs_genome_asof_idx
  on private.shadow_prediction_runs (genome_id, as_of desc);
