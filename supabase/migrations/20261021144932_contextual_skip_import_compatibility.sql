-- Exact retained import-removal compatibility before the two #349 forwards.
-- Apply this prerequisite first on the reviewed compact hosted checkpoint.
-- Fresh chronological installation has the exact final Taste body: no-op.
-- Never normalize arbitrary source or change rows, grants, triggers or history.
do $contextual_skip_import_compatibility$
declare
  previous pg_catalog.pg_proc%rowtype;
  current_function pg_catalog.pg_proc%rowtype;
  definition text;
  canonical_body constant text := $canonical$
declare
  actor_id uuid := (select auth.uid());
  job_record private.profile_import_jobs%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select job.* into job_record
  from private.profile_import_jobs as job
  join public.profiles as profile on profile.id = job.profile_id
  where job.id = target_job_id
    and job.actor_user_id = actor_id
    and profile.profile_type = 'PERSONAL'
    and profile.owner_user_id = actor_id;

  if job_record.id is null then
    raise exception 'Import job access denied' using errcode = '42501';
  end if;

  update private.profile_bootstrap_evidence
  set active = false
  where source_job_id = target_job_id and active;

  update private.profile_import_jobs
  set status = 'REMOVED', updated_at = now()
  where id = target_job_id;

  return private.get_profile_import_job_v1(target_job_id);
end;
$canonical$;
  compact_body constant text := $compact$
declare actor_id uuid:=(select auth.uid()); job_record private.profile_import_jobs%rowtype;
begin
  if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select j.* into job_record from private.profile_import_jobs j join public.profiles p on p.id=j.profile_id where j.id=target_job_id and j.actor_user_id=actor_id and p.profile_type='PERSONAL' and p.owner_user_id=actor_id;
  if job_record.id is null then raise exception 'Import job access denied' using errcode='42501'; end if;
  update private.profile_bootstrap_evidence set active=false where source_job_id=target_job_id and active;
  update private.profile_import_jobs set status='REMOVED',updated_at=now() where id=target_job_id;
  return private.get_profile_import_job_v1(target_job_id);
end; $compact$;
  skip_body text;
begin
  select p.* into strict previous from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('private.remove_profile_import_job_v1(uuid)');
  skip_body:=pg_catalog.replace(canonical_body,E'begin\n  if actor_id is null',
    E'begin\n  perform pg_catalog.pg_advisory_xact_lock(1946841873,232004);\n  if pg_catalog.current_setting(''transaction_isolation'')<>''read committed'' then\n    raise exception ''Taste source removal requires READ COMMITTED'' using errcode=''25001'';end if;\n  if actor_id is null');
  if previous.prosrc is distinct from canonical_body and previous.prosrc is distinct from compact_body
    and previous.prosrc is distinct from skip_body then
    raise exception 'Unknown import removal body; contextual skip compatibility refused' using errcode='55000';
  end if;
  definition:=pg_catalog.pg_get_functiondef(previous.oid);
  if pg_catalog.pg_get_userbyid(previous.proowner)<>'postgres'
    or previous.proacl::text is distinct from '{postgres=X/postgres,authenticated=X/postgres}'
    or pg_catalog.md5(pg_catalog.replace(definition,previous.prosrc,canonical_body))<>'ee32379988f608030c7c2424562be1f2' then
    raise exception 'Import removal identity/security/configuration drift; contextual skip compatibility refused' using errcode='55000';
  end if;
  if previous.prosrc=canonical_body or previous.prosrc=skip_body then return;end if;
  if (pg_catalog.length(definition)-pg_catalog.length(pg_catalog.replace(definition,previous.prosrc,'')))
    /pg_catalog.length(previous.prosrc)<>1 then
    raise exception 'Import removal definition substitution drift' using errcode='55000';
  end if;
  execute pg_catalog.replace(definition,previous.prosrc,canonical_body);
  select p.* into strict current_function from pg_catalog.pg_proc p where p.oid=previous.oid;
  if current_function.prosrc is distinct from canonical_body
    or (pg_catalog.to_jsonb(current_function)-'prosrc') is distinct from (pg_catalog.to_jsonb(previous)-'prosrc') then
    raise exception 'Import removal identity/metadata drift after compatibility' using errcode='55000';
  end if;
end;
$contextual_skip_import_compatibility$;
