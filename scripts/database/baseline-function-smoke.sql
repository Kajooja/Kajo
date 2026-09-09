-- Called inside the rollback-only probe, also executed by repository-only CI fixtures.
-- Tests source-derived RPC bodies; does not establish complete platform/ACL parity.
do $baseline_functions_probe$
declare
  actor uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  profile uuid;
  candidate uuid := gen_random_uuid();
  job uuid;
  imported_row uuid;
  batch jsonb;
  result jsonb;
  decision jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    select id,id::text || '@example.invalid',jsonb_build_object('kajo_nickname','Source ' || left(id::text,17))
    from unnest(array[actor,outsider]) fixture(id);
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.items(id,item_type,title,tags,discoverable)
    values(candidate,'BOOK',candidate::text,array['source-probe'],false);

  decision := private.resurfacing_policy_decision_v1(profile,candidate,'{}',now());
  if decision->>'classification' is distinct from 'ORDINARY' or decision->>'eligible' is distinct from 'true' then
    raise exception 'Missing bootstrap evidence suppressed an ordinary candidate: %',decision;
  end if;
  if private.resurfacing_policy_decision_v1(profile,candidate,'{"notInterested":true}',now())->>'classification'
       is distinct from 'TERMINAL_SUPPRESSED'
     or private.resurfacing_policy_decision_v1(profile,candidate,'{"rating":8}',now())->>'classification'
       is distinct from 'TERMINAL_SUPPRESSED' then
    raise exception 'Null-bootstrap correction lost native suppression';
  end if;

  select jsonb_agg(jsonb_build_object('sourceRowKey',n::text,'itemType','BOOK',
    'title',candidate::text,'evidenceKind','RATED','rating',8) order by n)
    into batch from generate_series(1,5000) n;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('role','authenticated',true);
  job := public.create_profile_import_job_v1(profile,'KAJO_CSV','HISTORY',null,'source-probe:' || actor::text);
  result := public.stage_profile_import_rows_v1(job,batch);
  if (result->>'totalRows')::int is distinct from 5000 or (result->>'matchedRows')::int is distinct from 5000 then
    raise exception 'The 5000-row source import did not stage completely';
  end if;
  imported_row := (result #>> '{rows,0,rowId}')::uuid;
  -- Invalid batches must leave the staged batch intact, including at the upper boundary.
  begin
    perform public.stage_profile_import_rows_v1(job,batch || jsonb_build_array(batch->0));
    raise exception '5001 rows were accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.stage_profile_import_rows_v1(job,'[]');
    raise exception 'An empty import was accepted';
  exception when invalid_parameter_value then null;
  end;
  result := public.get_profile_import_job_v1(job);
  if (result->>'totalRows')::int is distinct from 5000 or jsonb_array_length(result->'rows') is distinct from 5000 then
    raise exception 'Rejected batch changed the staged import';
  end if;
  result := public.resolve_profile_import_row_v1(imported_row,null,true);
  if (result->>'skippedRows')::int is distinct from 1 then raise exception 'Import skip did not take effect'; end if;
  result := public.resolve_profile_import_row_v1(imported_row,candidate,false);
  if (result->>'matchedRows')::int is distinct from 5000 then raise exception 'Import correction did not restore the match'; end if;
  perform public.commit_profile_import_job_v1(job);
  perform public.commit_profile_import_job_v1(job);
  perform set_config('role','postgres',true);
  if (select count(*) from private.profile_bootstrap_evidence where profile_id=profile and active) <> 1
     or exists(select 1 from public.events where profile_id=profile) then
    raise exception 'Repeated source import commit duplicated evidence or created native Events';
  end if;
  decision := private.resurfacing_policy_decision_v1(profile,candidate,'{}',now());
  if decision->>'classification' is distinct from 'TERMINAL_SUPPRESSED'
     or decision->>'reason' is distinct from 'IMPORTED_RATED' then
    raise exception 'Imported rating did not suppress its candidate';
  end if;

  perform set_config('request.jwt.claim.sub',outsider::text,true);
  perform set_config('role','authenticated',true);
  begin
    perform public.stage_profile_import_rows_v1(job,batch);
    raise exception 'Outsider staged another Profile import';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.remove_profile_import_job_v1(job);
    raise exception 'Outsider removed another Profile import';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.get_profile_import_job_v1(job);
    raise exception 'Unauthenticated caller read an import';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.remove_profile_import_job_v1(job);
  perform set_config('role','postgres',true);
  decision := private.resurfacing_policy_decision_v1(profile,candidate,'{}',now());
  if decision->>'classification' is distinct from 'ORDINARY' or decision->>'eligible' is distinct from 'true' then
    raise exception 'Import removal did not restore ordinary eligibility';
  end if;
end;
$baseline_functions_probe$;
