-- Closed owner preparation for Prediction source erasure. Profile/User roots
-- remain locked and present; their owner can delete them in this transaction.
-- This does not activate automatic Auth deletion or arbitrary Item erasure.
-- Operational callers start a dedicated READ COMMITTED transaction and call
-- this before any lifecycle writer or parent lock. Upgrading an already-held
-- shared lifecycle gate is not a supported concurrent deletion workflow.
create table private.prediction_source_erasure_permissions (
  backend_pid integer not null check (backend_pid=pg_backend_pid()),
  transaction_id bigint not null check (transaction_id=txid_current()),
  relation_oid oid not null check (relation_oid in (
    'private.shadow_prediction_candidates'::regclass,
    'private.shadow_prediction_runs'::regclass,
    'private.genome_evaluations'::regclass)),
  row_key jsonb not null check (jsonb_typeof(row_key)='object' and octet_length(row_key::text)<=256),
  primary key (backend_pid,transaction_id,relation_oid,row_key)
);
alter table private.prediction_source_erasure_permissions enable row level security;
revoke all on private.prediction_source_erasure_permissions from public,anon,authenticated,service_role;

-- Preserve every ordinary UPDATE/DELETE denial. Only an exact backend and
-- transaction-scoped DELETE permit for one of these three relations is usable.
do $guard$ begin
  if (select p.prosrc from pg_proc p where p.oid='private.reject_immutable_prediction_artifact_change_v1()'::regprocedure)
    is distinct from $expected$
begin
  raise exception '% is immutable; create a new versioned row instead', tg_table_name
    using errcode = '55000';
end;
$expected$ then
    raise exception 'Unknown immutable Prediction artifact guard; erasure patch refused' using errcode='55000';
  end if;
end; $guard$;
create or replace function private.reject_immutable_prediction_artifact_change_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare exact_key jsonb;
begin
  if tg_op='DELETE' and tg_relid in (
    'private.shadow_prediction_candidates'::regclass,
    'private.shadow_prediction_runs'::regclass,
    'private.genome_evaluations'::regclass)
    and has_table_privilege(current_user,'private.prediction_source_erasure_permissions','SELECT') then
    exact_key := case when tg_relid='private.shadow_prediction_candidates'::regclass
      then jsonb_build_object('shadow_prediction_id',to_jsonb(old)->'shadow_prediction_id','item_id',to_jsonb(old)->'item_id')
      else jsonb_build_object('id',to_jsonb(old)->'id') end;
    if exists(select 1 from private.prediction_source_erasure_permissions p
      where p.backend_pid=pg_backend_pid() and p.transaction_id=txid_current()
        and p.relation_oid=tg_relid and p.row_key=exact_key) then return old; end if;
  end if;
  raise exception '% is immutable; create a new versioned row instead',tg_table_name using errcode='55000';
end;
$$;

-- Logical page lineage has no parent FK; index it for the bounded closure walk.
create index prediction_page_contexts_source_erasure_idx on private.prediction_page_contexts(source_prediction_id);
create index prediction_page_contexts_parent_erasure_idx on private.prediction_page_contexts(parent_prediction_id);
create index prediction_catalog_chain_pages_root_erasure_idx on private.prediction_catalog_chain_pages(root_prediction_id);
create index prediction_catalog_chain_pages_parent_erasure_idx on private.prediction_catalog_chain_pages(parent_prediction_id);

create function private.erase_prediction_sources_v1(target_scope text,target_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' set timezone='UTC' as $$
declare
  source_ids uuid[]; shadow_ids uuid[]; profile_ids uuid[]; actor_ids uuid[];
  owned_profile_ids uuid[] := '{}'; window_ids uuid[]; comparison_ids uuid[];
  baseline_id uuid := md5('kajo:predictor-genome:prediction-v1-baseline')::uuid;
  source_count bigint := 0; job_count bigint := 0; shadow_count bigint := 0;
  candidate_count bigint := 0; evaluation_count bigint := 0; comparison_count bigint := 0;
  dependent_count integer;
  copied_run jsonb;
begin
  -- FIRST lock in every participating lifecycle entrypoint. It remains held
  -- after return, including an owner's subsequent Profile/User root deletion.
  perform pg_advisory_xact_lock(1946841873,232004);
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'Prediction source erasure requires READ COMMITTED' using errcode='25001'; end if;
  if target_scope is null or target_scope not in ('PREDICTION_RUN','PROFILE','ACTOR') or target_id is null then
    raise exception 'Invalid Prediction source erasure scope' using errcode='22023'; end if;
  if (target_scope='PREDICTION_RUN' and not exists(select 1 from private.prediction_runs r where r.id=target_id))
    or (target_scope='PROFILE' and not exists(select 1 from public.profiles p where p.id=target_id))
    or (target_scope='ACTOR' and not exists(select 1 from public.users u where u.id=target_id)) then
    raise exception 'Unknown Prediction source erasure root' using errcode='22023'; end if;
  if target_scope='ACTOR' then
    select coalesce(array_agg(p.id order by p.id),'{}'::uuid[]) into owned_profile_ids
      from public.profiles p where p.profile_type='PERSONAL' and p.owner_user_id=target_id;
  end if;

  -- UNION terminates cycles. The outer sentinel stops acquisition at 100001
  -- actual run IDs; no source can be erased from a truncated closure.
  with recursive closure(id) as (
    select r.id from private.prediction_runs r where
      (target_scope='PREDICTION_RUN' and r.id=target_id)
      or (target_scope='PROFILE' and r.profile_id=target_id)
      or (target_scope='ACTOR' and (r.actor_user_id=target_id or r.profile_id=any(owned_profile_ids)))
    union
    select child.prediction_id from closure parent cross join lateral (
      select p.prediction_id from private.prediction_page_contexts p
        where p.source_prediction_id=parent.id or p.parent_prediction_id=parent.id
      union
      select p.prediction_id from private.prediction_catalog_chain_pages p
        where p.root_prediction_id=parent.id or p.parent_prediction_id=parent.id
    ) child join private.prediction_runs actual on actual.id=child.prediction_id
  ) select coalesce(array_agg(bounded.id),'{}'::uuid[]) into source_ids
    from (select id from closure limit 100001) bounded;
  if cardinality(source_ids)>100000 then
    raise exception 'Prediction source erasure closure limit exceeded' using errcode='54000'; end if;
  select coalesce(array_agg(bounded.id order by bounded.id),'{}'::uuid[]) into shadow_ids
    from (select s.id from private.shadow_prediction_runs s where s.source_prediction_id=any(source_ids)
      or (target_scope='PROFILE' and s.profile_id=target_id)
      or (target_scope='ACTOR' and (s.actor_user_id=target_id or s.profile_id=any(owned_profile_ids))) limit 250001) bounded;
  if cardinality(shadow_ids)>250000 then
    raise exception 'Prediction source erasure dependent row limit exceeded' using errcode='54000'; end if;
  -- Comparisons contain copied traces and logical IDs, not source FKs. Match
  -- run IDs even if a caller independently removed its former source already.
  if exists(select 1 from private.shared_round_vector_comparisons c where
    c.result->>'contractVersion' is distinct from 'shared-round-vector-comparison-v1'
    or c.result#>>'{capturedOutcome,round,profileId}' is null
    or jsonb_typeof(c.result->'pairs') is distinct from 'array'
    or jsonb_typeof(c.result#>'{capturedOutcome,round,participants}') is distinct from 'array'
    or jsonb_typeof(c.result#>'{capturedOutcome,responses}') is distinct from 'array') then
    raise exception 'Prediction source erasure comparison lineage unavailable' using errcode='55000'; end if;
  if exists(select 1 from private.shared_round_vector_comparisons c cross join lateral (
    select value from jsonb_array_elements(c.result->'pairs')
    union all select value from jsonb_array_elements(c.result#>'{capturedOutcome,round,participants}')
    union all select value from jsonb_array_elements(c.result#>'{capturedOutcome,responses}')
  ) evidence where jsonb_typeof(evidence.value) is distinct from 'object' or evidence.value->>'actorUserId' is null) then
    raise exception 'Prediction source erasure comparison lineage unavailable' using errcode='55000'; end if;
  select coalesce(array_agg(bounded.id order by bounded.id),'{}'::uuid[]) into comparison_ids
    from (select c.id from private.shared_round_vector_comparisons c where exists(
      select 1 from jsonb_array_elements(c.result->'pairs') pair where
        pair->>'sourcePredictionId'=any(source_ids::text[])
        or pair->>'shadowPredictionId'=any(shadow_ids::text[])
        or pair#>>'{productionTrace,run,id}'=any(source_ids::text[])
        or pair#>>'{shadowTrace,run,source_prediction_id}'=any(source_ids::text[])
        or pair#>>'{shadowTrace,run,id}'=any(shadow_ids::text[])
        or (target_scope='PROFILE' and (pair#>>'{productionTrace,run,profile_id}'=target_id::text
          or pair#>>'{shadowTrace,run,profile_id}'=target_id::text))
        or (target_scope='ACTOR' and (pair->>'actorUserId'=target_id::text
          or pair#>>'{productionTrace,run,actor_user_id}'=target_id::text
          or pair#>>'{shadowTrace,run,actor_user_id}'=target_id::text
          or pair#>>'{productionTrace,run,profile_id}'=any(owned_profile_ids::text[])
          or pair#>>'{shadowTrace,run,profile_id}'=any(owned_profile_ids::text[]))))
      or exists(select 1 from jsonb_array_elements(c.result#>'{capturedOutcome,responses}') response where
        response#>>'{origin,predictionId}'=any(source_ids::text[])
        or response#>>'{origin,claimedPredictionId}'=any(source_ids::text[])
        or response#>>'{attribution,predictionId}'=any(source_ids::text[]))
      or (target_scope='PROFILE' and c.result#>>'{capturedOutcome,round,profileId}'=target_id::text)
      or (target_scope='ACTOR' and (c.result#>>'{capturedOutcome,round,profileId}'=any(owned_profile_ids::text[])
        or c.result#>'{capturedOutcome,round,participants}' @> jsonb_build_array(jsonb_build_object('actorUserId',target_id))))
      limit 250001) bounded;
  if cardinality(comparison_ids)>250000 then
    raise exception 'Prediction source erasure comparison limit exceeded' using errcode='54000'; end if;
  -- An independently purged source may survive only as frozen comparison
  -- metadata. Validate its time boundary before using it for batch invalidation.
  for copied_run in select trace.run from private.shared_round_vector_comparisons c
    cross join lateral jsonb_array_elements(c.result->'pairs') pair
    cross join lateral (values (pair#>'{productionTrace,run}'),(pair#>'{shadowTrace,run}')) trace(run)
    where c.id=any(comparison_ids) and trace.run is not null and trace.run<>'null'::jsonb loop
    begin
      if jsonb_typeof(copied_run) is distinct from 'object' or copied_run->>'id' is null
        or copied_run->>'profile_id' is null or copied_run->>'actor_user_id' is null
        or coalesce(copied_run->>'requested_at',copied_run->>'as_of') is null
        or not isfinite(coalesce(copied_run->>'requested_at',copied_run->>'as_of')::timestamptz) then
        raise exception 'Invalid copied Prediction source boundary' using errcode='55000'; end if;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Prediction source erasure copied boundary unavailable' using errcode='55000';
    end;
  end loop;
  select coalesce(array_agg(distinct p.id order by p.id),'{}'::uuid[]) into profile_ids from public.profiles p
    where p.id=any(owned_profile_ids) or (target_scope='PROFILE' and p.id=target_id)
      or exists(select 1 from private.prediction_runs r where r.id=any(source_ids) and r.profile_id=p.id)
      or exists(select 1 from private.shadow_prediction_runs s where
        s.id=any(shadow_ids) and s.profile_id=p.id)
      or exists(select 1 from private.shared_round_vector_comparisons c
        cross join lateral jsonb_array_elements(c.result->'pairs') pair where c.id=any(comparison_ids)
          and (pair#>>'{productionTrace,run,profile_id}'=p.id::text or pair#>>'{shadowTrace,run,profile_id}'=p.id::text))
      or exists(select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)
        and c.result#>>'{capturedOutcome,round,profileId}'=p.id::text);
  select coalesce(array_agg(distinct u.id order by u.id),'{}'::uuid[]) into actor_ids from public.users u
    where (target_scope='ACTOR' and u.id=target_id)
      or exists(select 1 from private.prediction_runs r where r.id=any(source_ids) and r.actor_user_id=u.id)
      or exists(select 1 from private.shadow_prediction_runs s where
        s.id=any(shadow_ids) and s.actor_user_id=u.id)
      or exists(select 1 from private.shared_round_vector_comparisons c
        cross join lateral jsonb_array_elements(c.result->'pairs') pair where c.id=any(comparison_ids)
          and (pair#>>'{productionTrace,run,actor_user_id}'=u.id::text or pair#>>'{shadowTrace,run,actor_user_id}'=u.id::text));
  -- Profile-before-User agrees with serving parent locks; UUID order is stable.
  perform p.id from public.profiles p where p.id=any(profile_ids) order by p.id for update;
  perform u.id from public.users u where u.id=any(actor_ids) order by u.id for update;
  if (target_scope='PROFILE' and not exists(select 1 from public.profiles p where p.id=target_id))
    or (target_scope='ACTOR' and not exists(select 1 from public.users u where u.id=target_id)) then
    raise exception 'Unknown Prediction source erasure root' using errcode='22023'; end if;
  perform r.id from private.prediction_runs r where r.id=any(source_ids) order by r.id for update;
  if target_scope='PREDICTION_RUN' and not exists(select 1 from private.prediction_runs r where r.id=target_id) then
    raise exception 'Unknown Prediction source erasure root' using errcode='22023'; end if;
  -- Missing tagged page context makes descendants unknowable. Fail closed
  -- rather than infer lineage from mutable catalog data or receipt timestamps.
  if exists(select 1 from private.prediction_runs r where r.profile_id=any(profile_ids) and (
    (r.policy_version like '%+catalog-chain-v1' and not exists(
      select 1 from private.prediction_catalog_chain_pages p where p.prediction_id=r.id))
    or (r.policy_version like '%+frozen-page-v1' and not exists(
      select 1 from private.prediction_page_contexts p where p.prediction_id=r.id)))) then
    raise exception 'Prediction source erasure lineage unavailable' using errcode='55000'; end if;
  perform s.id from private.shadow_prediction_runs s where s.id=any(shadow_ids) order by s.id for update;
  perform j.id from private.shadow_prediction_jobs j where j.source_prediction_id=any(source_ids) order by j.id for update;
  perform c.id from private.shared_round_vector_comparisons c where c.id=any(comparison_ids) order by c.id for update;
  select coalesce(array_agg(bounded.id order by bounded.id),'{}'::uuid[]) into window_ids
    from (select w.id from private.evaluation_windows w where exists(select 1 from private.prediction_runs r where r.id=any(source_ids)
      and r.requested_at>=w.prediction_from and r.requested_at<w.prediction_until)
      or exists(select 1 from private.shadow_prediction_runs s where s.id=any(shadow_ids)
        and s.as_of>=w.prediction_from and s.as_of<w.prediction_until)
      or exists(select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids) and c.window_id=w.id)
      or exists(select 1 from private.shared_round_vector_comparisons c
        cross join lateral jsonb_array_elements(c.result->'pairs') pair
        cross join lateral (values (pair#>'{productionTrace,run}'),(pair#>'{shadowTrace,run}')) trace(run)
        where c.id=any(comparison_ids) and trace.run is not null and trace.run<>'null'::jsonb
          and coalesce(trace.run->>'requested_at',trace.run->>'as_of')::timestamptz>=w.prediction_from
          and coalesce(trace.run->>'requested_at',trace.run->>'as_of')::timestamptz<w.prediction_until)
      or exists(select 1 from private.genome_evaluations e where e.evaluation_window_id=w.id
        and e.scope_type='PROFILE' and (
          (target_scope='PROFILE' and e.scope_key=target_id::text)
          or (target_scope='ACTOR' and e.scope_key=any(owned_profile_ids::text[]))))
      limit 250001) bounded;
  if cardinality(window_ids)>250000 then
    raise exception 'Prediction source erasure window limit exceeded' using errcode='54000'; end if;

  -- A Profile metric borrows the GLOBAL batch. Remove all genome/scope rows in
  -- each intersecting window, never just the target's PROFILE metric. Audit or
  -- serving influence cannot be inferred safe from a missing evaluation FK.
  if exists(select 1 from private.promotion_decisions d
    where d.evaluation_window_id=any(window_ids)
      or (d.scope_type='PROFILE' and d.scope_key=any(profile_ids::text[]))
      or ((cardinality(source_ids)>0 or cardinality(shadow_ids)>0 or cardinality(comparison_ids)>0) and d.scope_type in ('GLOBAL','COHORT')
        and not (d.scope_type='GLOBAL' and d.scope_key='GLOBAL' and d.from_state is not distinct from 'DRAFT'
          and d.evaluation_window_id is null and d.metrics='{}'::jsonb and d.guardrails='{}'::jsonb
          and d.decided_by='migration:20260904170000_sleep_layer_v1_foundation'
          and ((d.genome_id=baseline_id and d.to_state='CHAMPION'
            and d.reason='Record the already-serving Prediction V1 baseline as the initial global Champion.')
            or (d.genome_id in (md5('kajo:predictor-genome:short-term-tilt-v1')::uuid,
              md5('kajo:predictor-genome:scenario-tilt-v1')::uuid,md5('kajo:predictor-genome:novelty-tilt-v1')::uuid)
              and d.to_state='SHADOW'
              and d.reason='Seed a bounded transparent scalar Challenger for prospective shadow evaluation only.'))))) then
    raise exception 'Prediction source erasure blocked by promotion influence' using errcode='55000'; end if;
  if exists(select 1 from private.policy_assignments a where
    (cardinality(window_ids)>0 or a.scope_type in ('GLOBAL','COHORT')
      or (a.scope_type='PROFILE' and a.scope_key=any(profile_ids::text[])))
    and not (a.scope_type='GLOBAL' and a.scope_key='GLOBAL' and a.genome_id=baseline_id
      and a.previous_assignment_id is null and a.rollback_target_assignment_id is null
      and a.decided_by='migration:20260904170000_sleep_layer_v1_foundation'
      and a.reason='Initial assignment records the already-serving Prediction V1 baseline. Challenger assignment is disabled until a later accepted serving/promotion gate.')) then
    raise exception 'Prediction source erasure blocked by policy assignment or rollback influence' using errcode='55000'; end if;

  perform e.id from private.genome_evaluations e where e.evaluation_window_id=any(window_ids) order by e.id for update;

  select count(*) into dependent_count from (
    select 1 from private.shadow_prediction_candidates c where c.shadow_prediction_id=any(shadow_ids)
    union all select 1 from private.shadow_prediction_runs s where s.id=any(shadow_ids)
    union all select 1 from private.genome_evaluations e where e.evaluation_window_id=any(window_ids)
    union all select 1 from private.shadow_prediction_jobs j where j.source_prediction_id=any(source_ids)
    union all select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)
    limit 250001) bounded;
  if dependent_count>250000 then
    raise exception 'Prediction source erasure dependent row limit exceeded' using errcode='54000'; end if;

  -- All guards precede writes. No permission ever authorizes a genome, window,
  -- decision, assignment or UPDATE, and all permitted row keys are exact.
  insert into private.prediction_source_erasure_permissions
    select pg_backend_pid(),txid_current(),'private.shadow_prediction_candidates'::regclass,
      jsonb_build_object('shadow_prediction_id',c.shadow_prediction_id,'item_id',c.item_id)
      from private.shadow_prediction_candidates c where c.shadow_prediction_id=any(shadow_ids)
    union all select pg_backend_pid(),txid_current(),'private.shadow_prediction_runs'::regclass,jsonb_build_object('id',s.id)
      from private.shadow_prediction_runs s where s.id=any(shadow_ids)
    union all select pg_backend_pid(),txid_current(),'private.genome_evaluations'::regclass,jsonb_build_object('id',e.id)
      from private.genome_evaluations e where e.evaluation_window_id=any(window_ids);
  delete from private.shared_round_vector_comparisons c where c.id=any(comparison_ids);
  get diagnostics comparison_count=row_count;
  delete from private.genome_evaluations e where e.evaluation_window_id=any(window_ids);
  get diagnostics evaluation_count=row_count;
  delete from private.shadow_prediction_jobs j where j.source_prediction_id=any(source_ids);
  get diagnostics job_count=row_count;
  delete from private.shadow_prediction_candidates c where c.shadow_prediction_id=any(shadow_ids);
  get diagnostics candidate_count=row_count;
  delete from private.shadow_prediction_runs s where s.id=any(shadow_ids);
  get diagnostics shadow_count=row_count;
  delete from private.prediction_runs r where r.id=any(source_ids);
  get diagnostics source_count=row_count;
  delete from private.prediction_source_erasure_permissions p
    where p.backend_pid=pg_backend_pid() and p.transaction_id=txid_current();
  return jsonb_build_object('contractVersion','prediction-source-erasure-v1','scope',target_scope,'targetId',target_id,
    'rootsRetained',true,'affectedEvaluationWindowIds',to_jsonb(window_ids),'counts',jsonb_build_object(
      'predictionRuns',source_count,'shadowJobs',job_count,'shadowRuns',shadow_count,'shadowCandidates',candidate_count,
      'genomeEvaluations',evaluation_count,'vectorComparisons',comparison_count));
end;
$$;
revoke all on function private.erase_prediction_sources_v1(text,uuid) from public,anon,authenticated,service_role;

-- Surgical lifecycle serialization: no scoring, receipt, authorization or serving math changes.
-- Each approved source body is hash-guarded; exact anchors are checked before replacement.
-- CREATE OR REPLACE preserves the existing function identity, owner, ACL and settings.
do $prediction_lifecycle$
declare
  patch record;
  previous record;
  replacement text;
  definition text;
  anchor jsonb;
  old_anchor text;
  new_anchor text;
begin
  for patch in select * from (values
    ($lifecycle_text$private.process_shadow_prediction_jobs_v1(integer)$lifecycle_text$,$lifecycle_text$edd816db89780c88b46387a2cee77152$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.evaluate_shadow_genome_v1(uuid,uuid)$lifecycle_text$,$lifecycle_text$b803f9f94d1ee9c177dd96d81b2ab7ab$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"],["  evidence_cutoff timestamptz := clock_timestamp();","  evidence_cutoff timestamptz;"],["  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n","  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n  evidence_cutoff := pg_catalog.clock_timestamp();\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.manual_profile_canary_v1(uuid,uuid,uuid,text,text)$lifecycle_text$,$lifecycle_text$30cf875f728110aa0755022363e791ad$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.rollback_profile_canary_v1(uuid,text,text)$lifecycle_text$,$lifecycle_text$49705a7e33404305ec6ee506b2e81508$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.compare_shared_round_outcome_capture_v1(uuid,uuid,uuid,uuid)$lifecycle_text$,$lifecycle_text$be8d850bcb6eb1b854876c4937c11b52$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.rank_items_page_v1(jsonb)$lifecycle_text$,$lifecycle_text$f535ecc073e7d34c6a8b96c51d46fc03$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n"],["  profile_id uuid; request_id uuid; now_at timestamptz := clock_timestamp();","  profile_id uuid; request_id uuid; now_at timestamptz;"],["  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n","  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  now_at := pg_catalog.clock_timestamp();\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.rank_items_first_page_v1(jsonb)$lifecycle_text$,$lifecycle_text$9b2027e2bad96a80704510cffab1fa47$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n"],["    return receipt.response;\n  end if;\n  prediction_id := gen_random_uuid();","    return receipt.response;\n  end if;\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n  prediction_id := gen_random_uuid();"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.rank_items_frozen_page_v2(jsonb)$lifecycle_text$,$lifecycle_text$059efe4f3f85192a7356531f5f8caea5$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n"],["    return receipt.response;\n  end if;\n\n  prediction_id := gen_random_uuid();","    return receipt.response;\n  end if;\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n\n  prediction_id := gen_random_uuid();"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.rank_items_catalog_chain_v1(jsonb)$lifecycle_text$,$lifecycle_text$604b93ffb573b2212dadb03755380351$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n"],["    return receipt.response;\n  end if;\n  now_at := clock_timestamp();","    return receipt.response;\n  end if;\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n  now_at := clock_timestamp();"],["  availability text; continuation_state text; now_at timestamptz := clock_timestamp();","  availability text; continuation_state text; now_at timestamptz;"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)$lifecycle_text$,$lifecycle_text$00fd9755fd910214606a28d2a565359a$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"],["  request_time timestamptz := clock_timestamp();","  request_time timestamptz;"],["  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n","  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n  request_time := pg_catalog.clock_timestamp();\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)$lifecycle_text$,$lifecycle_text$0cacb6e416368606c17feb4f4a4e2d16$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"],["  request_time timestamptz := clock_timestamp();","  request_time timestamptz;"],["  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n","  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n  request_time := pg_catalog.clock_timestamp();\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.commit_item_action_v1(jsonb)$lifecycle_text$,$lifecycle_text$4df60960024b753ddf9fa2186c0ab1b6$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n"],["    return prior.result;\n  end if;\n","    return prior.result;\n  end if;\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.commit_collection_action_v1(jsonb)$lifecycle_text$,$lifecycle_text$0c418b3d52f1c58bb6a2856253517bcb$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n"],["    return prior.result;\n  end if;\n","    return prior.result;\n  end if;\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.commit_shared_rating_round_v1(jsonb)$lifecycle_text$,$lifecycle_text$7908bfc7276ba1c10f44f54c565b4185$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n"],["    return prior.result;\n  end if;\n","    return prior.result;\n  end if;\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"]]$lifecycle_text$::jsonb),
    ($lifecycle_text$private.open_prediction_window_v1(uuid)$lifecycle_text$,$lifecycle_text$2db7fcddac8efff0eab262bfafc2ef38$lifecycle_text$,$lifecycle_text$[["\nbegin\n","\nbegin\n  -- Serialize prediction-source lifecycle before existing row or receipt locks.\n  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);\n"],["  if found then return private.read_prediction_window_v1(existing_id); end if;\n","  if found then return private.read_prediction_window_v1(existing_id); end if;\n  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then\n    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';\n  end if;\n"]]$lifecycle_text$::jsonb)
  ) as patches(signature,expected_source_md5,anchors) loop
    select p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.prolang,p.prosrc,
      pg_catalog.pg_get_functiondef(p.oid) as definition
      into strict previous from pg_catalog.pg_proc p
      where p.oid=pg_catalog.to_regprocedure(patch.signature);
    if pg_catalog.md5(previous.prosrc) is distinct from patch.expected_source_md5 then
      raise exception 'Prediction lifecycle source drift: %',patch.signature using errcode='55000';
    end if;
    replacement := previous.prosrc;
    for anchor in select value from pg_catalog.jsonb_array_elements(patch.anchors) loop
      old_anchor := anchor->>0; new_anchor := anchor->>1;
      if (pg_catalog.length(replacement)-pg_catalog.length(pg_catalog.replace(replacement,old_anchor,'')))
        /pg_catalog.length(old_anchor) <> 1 then
        raise exception 'Prediction lifecycle anchor drift: %',patch.signature using errcode='55000';
      end if;
      replacement := pg_catalog.replace(replacement,old_anchor,new_anchor);
    end loop;
    if (pg_catalog.length(previous.definition)-pg_catalog.length(pg_catalog.replace(previous.definition,previous.prosrc,'')))
      /pg_catalog.length(previous.prosrc) <> 1 then
      raise exception 'Prediction lifecycle definition drift: %',patch.signature using errcode='55000';
    end if;
    definition := pg_catalog.replace(previous.definition,previous.prosrc,replacement);
    execute definition;
    if not exists(select 1 from pg_catalog.pg_proc p where p.oid=previous.oid
      and p.proowner=previous.proowner and p.proacl is not distinct from previous.proacl
      and p.prosecdef=previous.prosecdef and p.proconfig is not distinct from previous.proconfig
      and p.prolang=previous.prolang and p.prosrc=replacement) then
      raise exception 'Prediction lifecycle function identity or settings drift: %',patch.signature using errcode='55000';
    end if;
  end loop;
end;
$prediction_lifecycle$;
