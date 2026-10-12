-- Artificial source-closure evidence only. Real serving and shadow workers create
-- the traces; scalar rows below exercise invalidation, not predictor quality.
create temp table erasure_fixture(
  source_id uuid,other_source_id uuid,unrelated_source_id uuid,
  shadow_id uuid,other_shadow_id uuid,unrelated_shadow_id uuid,
  genome_id uuid,affected_window_id uuid,unrelated_window_id uuid,
  unrelated_profile_id uuid,capture_id uuid,comparison_id uuid,
  chain_parent_id uuid,chain_child_id uuid
) on commit drop;
do $erasure_fixture$
declare
  f record; c record; delivery jsonb; worker jsonb; captured jsonb; compared jsonb; chain_request jsonb;
  personal uuid; unrelated_source uuid; unrelated_shadow uuid; requested timestamptz; chain_parent uuid; chain_child uuid;
  unrelated_window uuid := 'a232e000-0000-4000-8000-000000000040';
  capture_id uuid := 'a232e000-0000-4000-8000-000000000050';
  comparison_id uuid := 'a232e000-0000-4000-8000-000000000060';
begin
  select * into strict f from pg_temp.outcome_fixture;
  select * into strict c from pg_temp.capture_fixture;
  select id into strict personal from public.profiles where owner_user_id=f.outsider and profile_type='PERSONAL';
  perform set_config('request.jwt.claim.sub',f.outsider::text,true);
  perform set_config('role','authenticated',true);
  delivery := public.rank_items_page_v1(jsonb_build_object('version',3,'requestId',gen_random_uuid(),
    'profileId',personal,'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',10,'context','{}'::jsonb));
  perform set_config('role','postgres',true);
  unrelated_source := (delivery->>'predictionId')::uuid;
  if jsonb_array_length(delivery->'items')<1 then raise exception 'Unrelated source has no actual delivered candidates'; end if;
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id) values(unrelated_source,c.genome_id);
  worker := private.process_shadow_prediction_jobs_v1(250);
  if worker->>'failed' is distinct from '0' then raise exception 'Unrelated actual shadow failed: %',worker; end if;
  select id into strict unrelated_shadow from private.shadow_prediction_runs
    where source_prediction_id=unrelated_source and genome_id=c.genome_id;
  select requested_at into strict requested from private.prediction_runs where id=unrelated_source;
  insert into private.evaluation_windows(id,window_key,prediction_from,prediction_until,input_cutoff,outcome_cutoff,created_by)
    values(unrelated_window,'shadow-source-erasure-unrelated-'||unrelated_window,requested-interval '1 microsecond',
      requested+interval '1 microsecond',requested+interval '1 microsecond',clock_timestamp(),'ERASURE_FIXTURE');
  -- Every PROFILE estimate in an affected group depends on GLOBAL shrinkage.
  insert into private.genome_evaluations(evaluation_window_id,genome_id,scope_type,scope_key,
    production_metric,challenger_metric,raw_advantage,shrunk_advantage,outcome_count,exposed_count,
    prediction_count,profile_count,coverage,eligibility_reason,metrics)
    select c.window_id,c.genome_id,scope_type,scope_key,0,0,0,0,1,1,1,1,1,
      'MATURE_COMPARABLE_EXPOSED_OUTCOME','{"syntheticErasureDependency":true}'::jsonb
      from (values('GLOBAL','GLOBAL'),('PROFILE',f.pair::text),('PROFILE',personal::text)) scopes(scope_type,scope_key);
  insert into private.genome_evaluations(evaluation_window_id,genome_id,scope_type,scope_key,
    production_metric,challenger_metric,raw_advantage,shrunk_advantage,outcome_count,exposed_count,
    prediction_count,profile_count,coverage,eligibility_reason,metrics)
    select unrelated_window,c.genome_id,scope_type,scope_key,0,0,0,0,1,1,1,1,1,
      'MATURE_COMPARABLE_EXPOSED_OUTCOME','{"syntheticErasureDependency":true}'::jsonb
      from (values('GLOBAL','GLOBAL'),('PROFILE',personal::text)) scopes(scope_type,scope_key);
  captured := private.capture_shared_rating_round_outcome_v1(capture_id,f.pair,c.round_id,
    c.outcome_cutoff,c.outcome_cutoff,interval '0 seconds');
  compared := private.compare_shared_round_outcome_capture_v1(comparison_id,capture_id,c.genome_id,c.window_id);
  if compared->>'supportStatus' is distinct from 'COMPLETE_VECTOR_SUPPORTED'
    or compared->'groupReward' is distinct from 'null'::jsonb or compared->'learnable' is distinct from 'false'::jsonb then
    raise exception 'Erasure fixture lacks a real paired frozen source copy'; end if;
  insert into public.items(id,item_type,title,tags,discoverable) values
    ('a232e000-0000-4000-8000-000000000121','BOOK','Erasure child one',array['outcome'],true),
    ('a232e000-0000-4000-8000-000000000122','BOOK','Erasure child two',array['outcome'],true);
  chain_request := jsonb_build_object('version',3,'requestId',gen_random_uuid(),'profileId',f.pair,
    'sessionId',gen_random_uuid(),'discoveryMode','FOR_YOU','itemType','BOOK','limit',1,'context','{}'::jsonb);
  perform set_config('request.jwt.claim.sub',f.partner::text,true); perform set_config('role','authenticated',true);
  delivery := public.rank_items_page_v1(chain_request);
  chain_parent := (delivery->>'predictionId')::uuid;
  if delivery->>'nextCursor' is null then raise exception 'Erasure fixture lacks a real continuation cursor'; end if;
  delivery := public.rank_items_page_v1(chain_request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',delivery->'nextCursor'));
  chain_child := (delivery->>'predictionId')::uuid;
  perform set_config('role','postgres',true);
  if delivery#>>'{source,parentPredictionId}' is distinct from chain_parent::text then
    raise exception 'Erasure fixture child lineage is not the actual continuation parent'; end if;
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
    values(chain_parent,c.genome_id),(chain_child,c.genome_id);
  worker := private.process_shadow_prediction_jobs_v1(250);
  if worker->>'failed' is distinct from '0' then raise exception 'Actual continuation shadows failed: %',worker; end if;
  insert into pg_temp.erasure_fixture values(c.source_a,c.source_b,unrelated_source,c.shadow_a,c.shadow_b,
    unrelated_shadow,c.genome_id,c.window_id,unrelated_window,personal,capture_id,comparison_id,chain_parent,chain_child);
end; $erasure_fixture$;

create function pg_temp.erasure_snapshot() returns jsonb language plpgsql as $$
declare relation record; digest text; result jsonb := '{}';
begin
  for relation in select format('%I.%I',n.nspname,c.relname) identity from pg_class c
    join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
      and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users')) order by 1 loop
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
    result := result||jsonb_build_object(relation.identity,digest);
  end loop;
  return result;
end; $$;
create function pg_temp.erasure_reject(sql text,expected_state text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if sqlstate is distinct from expected_state then raise; end if;
    return;
  end;
  raise exception 'Invalid source erasure operation succeeded: %',sql;
end; $$;
