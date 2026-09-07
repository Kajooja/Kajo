-- Admin-only integration smoke. All fixtures and prediction traces are rolled back.
begin;
do $$
declare
  actor uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  profile uuid;
  evidence_item uuid := gen_random_uuid();
  candidate uuid := gen_random_uuid();
  job uuid := gen_random_uuid();
  unique_tag text := 'bootstrap_smoke_' || gen_random_uuid()::text;
  ranked record;
  result_count integer;
begin
  insert into auth.users(id,email,raw_user_meta_data)
  values(actor,actor::text || '@example.invalid',jsonb_build_object('kajo_nickname','Bootstrap smoke'));
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.complete_personal_profile('Bootstrap smoke');
  select id into strict profile from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.items(id,item_type,title,tags,discoverable) values
    (evidence_item,'BOOK','Bootstrap smoke evidence',array[unique_tag],false),
    (candidate,'BOOK','Bootstrap smoke candidate',array[unique_tag],true);
  insert into private.profile_import_jobs(id,actor_user_id,profile_id,source_provider,dataset_kind,file_fingerprint,status,committed_at)
  values(job,actor,profile,'KAJO_CSV','SMOKE_TEST',gen_random_uuid()::text,'COMMITTED',now());
  insert into private.profile_bootstrap_evidence(actor_user_id,profile_id,item_id,item_type,source_provider,dataset_kind,source_job_id,source_row_key,evidence_kind,rating)
  values(actor,profile,evidence_item,'BOOK','KAJO_CSV','SMOKE_TEST',job,'1','RATED',10);
  perform set_config('role','authenticated',true);
  select * into strict ranked from public.rank_items_v1(profile,'FOR_YOU','BOOK',20,'{}') where item_id=candidate;
  if ranked.explanation->>'baseVersion' <> 'prediction-v0.4-bootstrap'
     or coalesce((ranked.explanation->>'bootstrapLongTerm')::numeric,0) <= 0 then
    raise exception 'Missing bootstrap contribution or version: %',ranked.explanation;
  end if;
  perform public.remove_profile_import_job_v1(job);
  select count(*) into result_count from public.rank_items_v1(profile,'FOR_YOU','BOOK',20,'{}')
    where coalesce((explanation->>'bootstrapLongTerm')::numeric,0) <> 0;
  if result_count <> 0 then raise exception 'Removed bootstrap still contributes'; end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.rank_items_v1(profile,'FOR_YOU','BOOK',20,'{}');
    raise exception 'Outsider was allowed';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role','postgres',true);
  if not exists(select 1 from private.prediction_runs where profile_id=profile and base_model_version='prediction-v0.4-bootstrap') then
    raise exception 'Missing versioned prediction trace';
  end if;
  perform set_config('kajo.bootstrap_smoke_result','PASS: authenticated public V1, bootstrap contribution, import removal, outsider denial, persisted base version; transaction rolled back',true);
end;
$$;
select current_setting('kajo.bootstrap_smoke_result') as result;
rollback;
