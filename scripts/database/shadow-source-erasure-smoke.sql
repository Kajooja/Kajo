create function pg_temp.assert_source_erasure(scope text,target uuid,sources uuid[],expected_comparisons integer)
returns jsonb language plpgsql as $$
declare result jsonb; expected jsonb; windows jsonb; before jsonb; after jsonb; c record;
begin
  select * into strict c from pg_temp.erasure_fixture;
  before := pg_temp.erasure_snapshot();
  select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into windows from private.evaluation_windows w
    where exists(select 1 from private.prediction_runs r where r.id=any(sources)
      and r.requested_at>=w.prediction_from and r.requested_at<w.prediction_until)
      or (expected_comparisons>0 and w.id=c.affected_window_id);
  expected := jsonb_build_object('predictionRuns',cardinality(sources),
    'shadowJobs',(select count(*) from private.shadow_prediction_jobs where source_prediction_id=any(sources)),
    'shadowRuns',(select count(*) from private.shadow_prediction_runs where source_prediction_id=any(sources)),
    'shadowCandidates',(select count(*) from private.shadow_prediction_candidates d join private.shadow_prediction_runs r
      on r.id=d.shadow_prediction_id where r.source_prediction_id=any(sources)),
    'genomeEvaluations',(select count(*) from private.genome_evaluations where evaluation_window_id in
      (select value::text::uuid from jsonb_array_elements_text(windows))),
    'vectorComparisons',expected_comparisons);
  result := private.erase_prediction_sources_v1(scope,target);
  if result is null or result->>'contractVersion' is distinct from 'prediction-source-erasure-v1'
    or result->>'scope' is distinct from scope or result->>'targetId' is distinct from target::text
    or result->'rootsRetained' is distinct from 'true'::jsonb or result->'counts' is distinct from expected
    or result->'affectedEvaluationWindowIds' is distinct from windows then
    raise exception 'Source erasure returned a different exact closure: %, expected % / %',result,expected,windows; end if;
  if exists(select 1 from private.prediction_runs where id=any(sources))
    or exists(select 1 from private.shadow_prediction_jobs where source_prediction_id=any(sources))
    or exists(select 1 from private.shadow_prediction_runs where source_prediction_id=any(sources))
    or exists(select 1 from private.genome_evaluations where evaluation_window_id in
      (select value::text::uuid from jsonb_array_elements_text(windows)))
    or exists(select 1 from private.prediction_source_erasure_permissions) then
    raise exception 'Source erasure left an artifact, aggregate or deletion permission'; end if;
  if not exists(select 1 from private.prediction_runs where id=c.unrelated_source_id)
    or not exists(select 1 from private.shadow_prediction_runs where id=c.unrelated_shadow_id)
    or (select count(*) from private.genome_evaluations where evaluation_window_id=c.unrelated_window_id)<>2 then
    raise exception 'Unrelated source/window evidence was removed'; end if;
  after := pg_temp.erasure_snapshot();
  if exists(select 1 from jsonb_each_text(before) b where
    (b.key like 'public.%' or b.key='auth.users' or b.key in ('private.predictor_genomes',
      'private.evaluation_windows','private.promotion_decisions','private.policy_assignments',
      'private.shared_rating_rounds','private.shared_rating_round_responses','private.shared_rating_round_receipts',
      'private.shared_round_outcome_captures')) and after->>b.key is distinct from b.value) then
    raise exception 'Owner source eraser changed canonical roots/Events/state or retained policy/round evidence'; end if;
  return result;
end; $$;

do $source_erasure_matrix$
declare
  f record; c record; before jsonb; controlled jsonb; result jsonb; role_name text; relation regclass;
  target regprocedure := 'private.erase_prediction_sources_v1(text,uuid)'::regprocedure;
  shadow_item uuid; evaluation_id uuid; i integer; scope text; target_root uuid; sources uuid[];
  assignment_id uuid; dependent_id uuid; original_comparison jsonb; malformed jsonb; evaluation_rows jsonb; row jsonb;
begin
  select * into strict f from pg_temp.outcome_fixture; select * into strict c from pg_temp.erasure_fixture;
  before := pg_temp.erasure_snapshot(); original_comparison := private.get_shared_round_vector_comparison_v1(c.comparison_id);
  if exists(select 1 from pg_proc where oid=target and (prosecdef or exists(select 1
    from aclexplode(coalesce(proacl,acldefault('f',proowner))) where grantee=0 and privilege_type='EXECUTE'))) then
    raise exception 'Source eraser gained definer authority or PUBLIC execute'; end if;
  if not (select relrowsecurity from pg_class where oid='private.prediction_source_erasure_permissions'::regclass) then
    raise exception 'Deletion permissions have no RLS'; end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(role_name,target,'EXECUTE')
      or has_table_privilege(role_name,'private.prediction_source_erasure_permissions','SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'API role can enter the source-erasure boundary'; end if;
    perform set_config('role',role_name,true);
    begin perform private.erase_prediction_sources_v1('PREDICTION_RUN',c.source_id);
      raise exception 'API erasure executed'; exception when insufficient_privilege then null; end;
    begin perform 1 from private.prediction_source_erasure_permissions;
      raise exception 'API role read deletion permits'; exception when insufficient_privilege then null; end;
    begin insert into private.prediction_source_erasure_permissions(backend_pid,transaction_id,relation_oid,row_key)
      values(0,0,0,'{}'); raise exception 'API role inserted deletion permit'; exception when insufficient_privilege then null; end;
    perform set_config('role','postgres',true);
  end loop;
  perform pg_temp.erasure_reject('select private.erase_prediction_sources_v1(null,null)','22023');
  perform pg_temp.erasure_reject(format('select private.erase_prediction_sources_v1(''ITEM'',%L)',f.book),'22023');
  perform pg_temp.erasure_reject(format('select private.erase_prediction_sources_v1(''PREDICTION_RUN'',%L)',gen_random_uuid()),'22023');
  perform pg_temp.erasure_reject(format('select private.erase_prediction_sources_v1(''PROFILE'',%L)',gen_random_uuid()),'22023');
  perform pg_temp.erasure_reject(format('select private.erase_prediction_sources_v1(''ACTOR'',%L)',gen_random_uuid()),'22023');
  -- The same populated User/Profile/run deletion is still blocked without the
  -- closed preparation entrypoint, so success below proves a real dependency fix.
  perform pg_temp.erasure_reject(format('delete from auth.users where id=%L',f.partner),'23503');
  perform pg_temp.erasure_reject(format('delete from public.profiles where id=%L',f.pair),'23503');
  perform pg_temp.erasure_reject(format('delete from private.prediction_runs where id=%L',c.source_id),'23503');
  select item_id into strict shadow_item from private.shadow_prediction_candidates where shadow_prediction_id=c.shadow_id order by item_id limit 1;
  select id into strict evaluation_id from private.genome_evaluations where evaluation_window_id=c.affected_window_id and scope_type='GLOBAL';
  -- Generic immutable guards remain closed, including caller-controlled settings.
  perform set_config('kajo.allow_prediction_artifact_delete','true',true);
  perform set_config('kajo.prediction_source_erasure','true',true);
  for i in 1..2 loop
    perform pg_temp.erasure_reject(format('delete from private.shadow_prediction_runs where id=%L',c.shadow_id),'55000');
    perform pg_temp.erasure_reject(format('update private.shadow_prediction_runs set code_version=code_version where id=%L',c.shadow_id),'55000');
    perform pg_temp.erasure_reject(format('delete from private.shadow_prediction_candidates where shadow_prediction_id=%L and item_id=%L',c.shadow_id,shadow_item),'55000');
    perform pg_temp.erasure_reject(format('update private.shadow_prediction_candidates set shadow_score=shadow_score where shadow_prediction_id=%L and item_id=%L',c.shadow_id,shadow_item),'55000');
    perform pg_temp.erasure_reject(format('delete from private.genome_evaluations where id=%L',evaluation_id),'55000');
    perform pg_temp.erasure_reject(format('update private.genome_evaluations set coverage=coverage where id=%L',evaluation_id),'55000');
  end loop;
  -- Permissions are exact and tied to this backend/transaction; UPDATE never opens.
  for i in 1..4 loop
    begin
      if i<=2 then
        perform pg_temp.erasure_reject(format('insert into private.prediction_source_erasure_permissions(backend_pid,transaction_id,relation_oid,row_key) values(%s,%s,''private.shadow_prediction_runs''::regclass,%L::jsonb)',
          case when i=1 then pg_backend_pid()+1 else pg_backend_pid() end,
          case when i=2 then txid_current()+1 else txid_current() end,jsonb_build_object('id',c.shadow_id)), '23514');
        raise exception 'ROLLBACK_CONTROL' using errcode='Z0001';
      end if;
      insert into private.prediction_source_erasure_permissions(backend_pid,transaction_id,relation_oid,row_key)
        values(case when i=1 then pg_backend_pid()+1 else pg_backend_pid() end,
          case when i=2 then txid_current()+1 else txid_current() end,
          case when i=3 then 'private.genome_evaluations'::regclass else 'private.shadow_prediction_runs'::regclass end,
          jsonb_build_object('id',case when i=4 then gen_random_uuid() else c.shadow_id end));
      perform pg_temp.erasure_reject(format('delete from private.shadow_prediction_runs where id=%L',c.shadow_id),'55000');
      raise exception 'ROLLBACK_CONTROL' using errcode='Z0001';
    exception when sqlstate 'Z0001' then null; end;
  end loop;
  begin
    insert into private.prediction_source_erasure_permissions(backend_pid,transaction_id,relation_oid,row_key)
      values(pg_backend_pid(),txid_current(),'private.shadow_prediction_runs'::regclass,jsonb_build_object('id',c.shadow_id));
    perform pg_temp.erasure_reject(format('update private.shadow_prediction_runs set code_version=code_version where id=%L',c.shadow_id),'55000');
    raise exception 'ROLLBACK_CONTROL' using errcode='Z0001';
  exception when sqlstate 'Z0001' then null; end;
  if pg_temp.erasure_snapshot() is distinct from before then raise exception 'Denied operation changed populated evidence'; end if;

  -- Malformed retained provenance must reject before any deletion, including
  -- an invalid time in the otherwise complete frozen source metadata.
  for i in 1..2 loop
    begin
      malformed := case when i=1 then jsonb_set(original_comparison,'{pairs}','{}'::jsonb)
        else jsonb_set(original_comparison,'{pairs,0,productionTrace,run,requested_at}','"infinity"'::jsonb) end;
      insert into private.shared_round_vector_comparisons(id,capture_id,genome_id,window_id,request,result,observed_at)
        select gen_random_uuid(),capture_id,genome_id,window_id,request,malformed,observed_at
          from private.shared_round_vector_comparisons where id=c.comparison_id;
      controlled := pg_temp.erasure_snapshot();
      perform pg_temp.erasure_reject(format('select private.erase_prediction_sources_v1(''PREDICTION_RUN'',%L)',c.source_id),'55000');
      if pg_temp.erasure_snapshot() is distinct from controlled then raise exception 'Malformed copied lineage left partial deletion'; end if;
      raise exception 'ROLLBACK_CONTROL' using errcode='Z0001';
    exception when sqlstate 'Z0001' then null; end;
    if pg_temp.erasure_snapshot() is distinct from before then raise exception 'Malformed lineage control failed to roll back'; end if;
  end loop;

  -- An unrelated decision remains historical; no guessed influence subtraction.
  insert into private.promotion_decisions(id,genome_id,scope_type,scope_key,to_state,evaluation_window_id,metrics,decided_by,reason)
    values('a232e000-0000-4000-8000-000000000070',c.genome_id,'PROFILE',c.unrelated_profile_id::text,
      'REJECTED',c.unrelated_window_id,'{"syntheticErasureDependency":true}','ERASURE_FIXTURE','Unrelated retained audit');
  before := pg_temp.erasure_snapshot();
  for i in 1..6 loop
    begin
      if i<=2 then
        insert into private.promotion_decisions(genome_id,scope_type,scope_key,to_state,evaluation_window_id,metrics,decided_by,reason)
          values(c.genome_id,case when i=1 then 'GLOBAL' else 'PROFILE' end,
            case when i=1 then 'GLOBAL' else f.pair::text end,'REJECTED',
            case when i=1 then c.affected_window_id else null end,'{"copiedEvidence":true}',
            'ERASURE_NEGATIVE_CONTROL','Unresolved copied audit influence');
      elsif i=6 then
        -- NULL is not the seeded DRAFT lineage. SQL UNKNOWN must never make
        -- a copied custom decision disappear from the fail-closed predicate.
        insert into private.promotion_decisions select (jsonb_populate_record(null::private.promotion_decisions,
          to_jsonb(d)||jsonb_build_object('id',gen_random_uuid(),'from_state',null))).*
          from private.promotion_decisions d where d.genome_id=c.genome_id and d.scope_type='GLOBAL'
            and d.scope_key='GLOBAL' and d.from_state='DRAFT' and d.evaluation_window_id is null;
      else
        assignment_id := gen_random_uuid();
        insert into private.policy_assignments(id,scope_type,scope_key,genome_id,effective_from,decided_by,reason)
          values(assignment_id,case when i=3 then 'PROFILE' else 'GLOBAL' end,
            case when i=3 then f.pair::text else 'GLOBAL' end,c.genome_id,
            clock_timestamp()+interval '1 day','ERASURE_NEGATIVE_CONTROL','Future/custom policy still retains unknown influence');
        if i>=4 then
          insert into private.policy_assignments(scope_type,scope_key,genome_id,previous_assignment_id,rollback_target_assignment_id,
            effective_from,decided_by,reason) values('PROFILE',c.unrelated_profile_id::text,c.genome_id,
              case when i=4 then assignment_id else null end,case when i=5 then assignment_id else null end,
              clock_timestamp()+interval '2 days','ERASURE_NEGATIVE_CONTROL','Immutable ancestry remains unresolved');
        end if;
      end if;
      controlled := pg_temp.erasure_snapshot();
      perform pg_temp.erasure_reject(format('select private.erase_prediction_sources_v1(''PREDICTION_RUN'',%L)',c.source_id),'55000');
      if pg_temp.erasure_snapshot() is distinct from controlled then raise exception 'Unresolved audit failure left partial erasure'; end if;
      raise exception 'ROLLBACK_CONTROL' using errcode='Z0001';
    exception when sqlstate 'Z0001' then null; end;
    if pg_temp.erasure_snapshot() is distinct from before then raise exception 'Policy control fixture failed to roll back'; end if;
  end loop;

  -- Successful internal cleanup is rolled back to independently exercise scopes.
  for i in 1..5 loop
    begin
      scope := case i when 1 then 'PREDICTION_RUN' when 2 then 'PROFILE' when 3 then 'ACTOR' else 'PREDICTION_RUN' end;
      if i=5 then scope := 'ACTOR'; end if;
      target_root := case i when 1 then c.source_id when 2 then f.pair when 3 then f.partner when 4 then c.chain_parent_id else f.actor end;
      sources := case i when 1 then array[c.source_id] when 2 then array[c.source_id,c.other_source_id,c.chain_parent_id,c.chain_child_id]
        when 3 then array[c.other_source_id,c.chain_parent_id,c.chain_child_id]
        when 4 then array[c.chain_parent_id,c.chain_child_id] else array[c.source_id] end;
      result := pg_temp.assert_source_erasure(scope,target_root,sources,case when i=4 then 0 else 1 end);
      if i=4 then
        if private.get_shared_round_vector_comparison_v1(c.comparison_id) is distinct from original_comparison then
          raise exception 'Unrelated continuation closure removed the earlier comparison'; end if;
      elsif private.get_shared_round_vector_comparison_v1(c.comparison_id) is not null then
        raise exception 'Copied source trace survived explicit source erasure';
      end if;
      if i=2 then
        delete from public.profiles where id=f.pair;
        if exists(select 1 from public.profiles where id=f.pair)
          or private.get_shared_round_outcome_capture_v1(c.capture_id) is not null then
          raise exception 'Same-transaction owner Profile deletion failed after source closure'; end if;
      elsif i=3 then
        delete from auth.users where id=f.partner;
        if exists(select 1 from auth.users where id=f.partner) or exists(select 1 from public.users where id=f.partner)
          or private.get_shared_round_outcome_capture_v1(c.capture_id) is not null then
          raise exception 'Same-transaction owner User deletion failed after source closure'; end if;
      elsif i=5 then
        -- Legacy Item state has a separate User NO ACTION FK. Source cleanup
        -- does not silently delete that canonical state or promise full erasure.
        controlled := pg_temp.erasure_snapshot();
        perform pg_temp.erasure_reject(format('delete from auth.users where id=%L',f.actor),'23503');
        if pg_temp.erasure_snapshot() is distinct from controlled then
          raise exception 'Residual canonical User restriction left partial deletion'; end if;
      end if;
      raise exception 'ROLLBACK_CONTROL' using errcode='Z0001';
    exception when sqlstate 'Z0001' then null; end;
    if pg_temp.erasure_snapshot() is distinct from before then raise exception 'Atomic owner operation rollback did not restore full evidence'; end if;
  end loop;
  -- Recreate only a historical copied observation after its source was purged.
  -- Its frozen time/window still invalidates the entire scalar batch, despite
  -- there being no current PredictionRun for the target actor to enumerate.
  begin
    select jsonb_agg(to_jsonb(e) order by e.id) into evaluation_rows from private.genome_evaluations e
      where evaluation_window_id=c.affected_window_id;
    perform pg_temp.assert_source_erasure('PREDICTION_RUN',c.source_id,array[c.source_id],1);
    dependent_id := gen_random_uuid();
    insert into private.shared_round_vector_comparisons(id,capture_id,genome_id,window_id,request,result,observed_at)
      values(dependent_id,c.capture_id,c.genome_id,c.affected_window_id,'{}',
        original_comparison||jsonb_build_object('comparisonId',dependent_id),clock_timestamp());
    for row in select value from jsonb_array_elements(evaluation_rows) loop
      insert into private.genome_evaluations select (jsonb_populate_record(null::private.genome_evaluations,row)).*;
    end loop;
    result := pg_temp.assert_source_erasure('ACTOR',f.actor,'{}'::uuid[],1);
    if private.get_shared_round_vector_comparison_v1(dependent_id) is not null
      or not exists(select 1 from private.prediction_runs where id=c.other_source_id) then
      raise exception 'Orphan copied source survived or unrelated current actor was erased'; end if;
    raise exception 'ROLLBACK_CONTROL' using errcode='Z0001';
  exception when sqlstate 'Z0001' then null; end;
  if pg_temp.erasure_snapshot() is distinct from before then raise exception 'Copied-orphan erasure rollback did not restore all evidence'; end if;
  -- Item hard erasure is deliberately outside this owner API and remains atomic.
  perform pg_temp.erasure_reject(format('delete from public.items where id=%L',f.book),'23503');
  if pg_temp.erasure_snapshot() is distinct from before then raise exception 'Restricted Item deletion left partial changes'; end if;
  result := pg_temp.assert_source_erasure('PREDICTION_RUN',c.source_id,array[c.source_id],1);
  if private.get_shared_round_vector_comparison_v1(c.comparison_id) is not null
    or private.get_shared_round_outcome_capture_v1(c.capture_id) is null then
    raise exception 'Run purge failed to remove copied traces or wrongly erased retained receipt observations'; end if;
  perform pg_temp.erasure_reject(format('delete from private.shadow_prediction_runs where id=%L',c.other_shadow_id),'55000');
  perform pg_temp.erasure_reject(format('delete from private.genome_evaluations where evaluation_window_id=%L',c.unrelated_window_id),'55000');
  if not exists(select 1 from private.prediction_runs where id=c.other_source_id)
    or exists(select 1 from private.prediction_source_erasure_permissions) then
    raise exception 'Post-erasure permissions leaked or untouched actor source vanished'; end if;
end; $source_erasure_matrix$;
select jsonb_build_object('shadowSourceErasure',
  'PASS: exact owner source/descendant closure; all affected GLOBAL/PROFILE aggregates and copied traces erased; unrelated canonical evidence preserved; API/ordinary guards closed; policy lineage failures and owner root deletion rollback atomic; Item/automatic Auth activation remain outside scope') snapshot;
