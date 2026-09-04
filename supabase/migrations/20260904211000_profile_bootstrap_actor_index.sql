-- Sprint 014B / #185
-- Cover the actor_user_id foreign key used by import audit/removal paths.
create index if not exists profile_bootstrap_evidence_actor_idx
  on private.profile_bootstrap_evidence (actor_user_id, imported_at desc, id);
