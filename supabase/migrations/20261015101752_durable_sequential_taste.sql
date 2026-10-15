-- Owned sequential Taste source. Existing v1 sessions and their receipts are
-- immutable predecessors. No anonymous entry, mobile activation or quality claim.
-- A distinct negative prior is admitted only through this owned Taste source.
-- It is not a numeric rating, consumption or native action outcome. Preserve
-- every existing bootstrap value; use the existing bootstrap/native rating
-- trust ratio (0.75/1.2) for the already defined native not-interest weight.
alter table private.profile_bootstrap_evidence drop constraint profile_bootstrap_evidence_kind_valid;
alter table private.profile_bootstrap_evidence add constraint profile_bootstrap_evidence_kind_valid check (
  evidence_kind in('RATED','CONSUMED','SAVED') or
  (evidence_kind='NOT_INTERESTED' and source_provider='KAJO_CALIBRATION' and dataset_kind='TASTE_SESSION_V2')
);
do $negative_prior$
declare patch jsonb;p record;body text;
begin
  for patch in select value from jsonb_array_elements($patches$[
    {"signature":"private.bootstrap_evidence_weight_v1(text,integer)","md5":"490d2609586ea36c389b05083b695520",
     "before":"    when 'SAVED' then 0.9","after":"    when 'NOT_INTERESTED' then private.event_evidence_weight_v1('ITEM_NOT_INTERESTED','{}'::jsonb) * (0.75/1.2)\n    when 'SAVED' then 0.9"},
    {"signature":"private.bootstrap_weighted_evidence_v1(uuid,timestamptz)","md5":"7f655aeb81c3d342b736e3217bcf463e",
     "before":"case evidence.evidence_kind when 'RATED' then 3","after":"case evidence.evidence_kind when 'NOT_INTERESTED' then 3 when 'RATED' then 3"},
    {"signature":"private.personal_source_evidence_v1(uuid,timestamptz)","md5":"f8daa5a484cc85229bebd1c8c8b56fb7",
     "before":"case b.evidence_kind when 'RATED' then 3","after":"case b.evidence_kind when 'NOT_INTERESTED' then 3 when 'RATED' then 3"}
  ]$patches$::jsonb) loop
    select prosrc,pg_get_functiondef(oid) definition into strict p from pg_proc where oid=(patch->>'signature')::regprocedure;
    if md5(p.prosrc)<>patch->>'md5' or (length(p.prosrc)-length(replace(p.prosrc,patch->>'before','')))/length(patch->>'before')<>1 then
      raise exception 'Sequential negative prior source drift: %',patch->>'signature';
    end if;
    body:=replace(p.prosrc,patch->>'before',patch->>'after');
    execute replace(p.definition,p.prosrc,body);
  end loop;
end;$negative_prior$;

create table private.sequential_taste_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  version text not null default 'personal-taste-session-v2' check(version='personal-taste-session-v2'),
  policy text not null default 'ADAPTIVE' check(policy in('ADAPTIVE','PRIOR_ONLY')),
  catalog jsonb not null check(jsonb_typeof(catalog)='array' and jsonb_array_length(catalog)<=50),
  catalog_as_of timestamptz not null,
  presentations jsonb not null default '[]' check(jsonb_typeof(presentations)='array' and jsonb_array_length(presentations)<=48),
  revision integer not null default 0 check(revision between 0 and 256),
  status text not null default 'ACTIVE' check(status in('ACTIVE','PAUSED','STOPPED','REMOVED')),
  stop_reason text,
  source_job_id uuid references private.profile_import_jobs(id) on delete restrict,
  receipt_at timestamptz not null,
  receipt_transaction text not null,
  created_at timestamptz not null,
  check(isfinite(catalog_as_of) and isfinite(receipt_at) and isfinite(created_at)),
  check(octet_length(catalog::text)+octet_length(presentations::text)<=262144)
);
create index sequential_taste_actor_idx on private.sequential_taste_sessions(actor_user_id);
create index sequential_taste_source_idx on private.sequential_taste_sessions(source_job_id) where source_job_id is not null;
create table private.sequential_taste_panels (
  id uuid primary key,
  session_id uuid not null references private.sequential_taste_sessions(id) on delete cascade,
  prediction_id uuid references private.prediction_runs(id) on delete set null,
  prefix_revision integer not null,
  prefix jsonb not null,
  frozen jsonb not null check(jsonb_typeof(frozen)='object' and octet_length(frozen::text)<=131072),
  captured_at timestamptz not null check(isfinite(captured_at)),
  captured_transaction text not null,
  invalidated boolean not null default false
);
create index sequential_taste_panels_session_idx on private.sequential_taste_panels(session_id);
create index sequential_taste_panels_prediction_idx on private.sequential_taste_panels(prediction_id);
create table private.sequential_taste_commands (
  session_id uuid not null references private.sequential_taste_sessions(id) on delete cascade,
  request_id uuid not null,
  command_hash text not null,
  result jsonb not null check(octet_length(result::text)<=32768),
  primary key(session_id,request_id)
);
alter table private.sequential_taste_sessions enable row level security;
alter table private.sequential_taste_panels enable row level security;
alter table private.sequential_taste_commands enable row level security;
revoke all on private.sequential_taste_sessions,private.sequential_taste_panels,private.sequential_taste_commands
  from public,anon,authenticated,service_role;

-- Binary projection of the portable reference's weighted Jaccard similarity.
-- A missing positive feature mass is unknown, never maximum differentiation.
create function private.sequential_taste_similarity_v2(a jsonb,b jsonb)
returns double precision language sql immutable set search_path='' as $$
  select (select count(*)::double precision from jsonb_array_elements_text(a) t where b ? t.value)
    / nullif((select count(*)::double precision from(
      select value from jsonb_array_elements_text(a) union select value from jsonb_array_elements_text(b)
    ) dimensions),0);
$$;
create function private.sequential_taste_components_v2(candidate jsonb,ledger jsonb,control text)
returns jsonb language sql immutable set search_path='' as $$
  with history as materialized (
    select p,p#>>'{responses,-1,answer,kind}' kind,
      private.sequential_taste_similarity_v2(candidate->'tags',p->'tags') overlap
    from jsonb_array_elements(ledger) p where p->>'itemType'=candidate->>'itemType'
      and not coalesce((p->>'invalidated')::boolean,false)
  ), components as (
    select coalesce((candidate->>'recognitionPrior')::double precision,0) recognition,
      coalesce(0.5+0.5*(select sum(coalesce(overlap,0)*case when kind='RATING'
        then (p#>>'{responses,-1,answer,value}')::double precision/5-1 else -1 end)
        /nullif(sum(coalesce(overlap,0)),0) from history where kind in('RATING','NOT_INTERESTED')),0.5) preference,
      case when jsonb_array_length(candidate->'tags')>0 then 1-coalesce((select max(overlap) from history),0) else 0 end diversity,
      coalesce((select sum(1.0::double precision/jsonb_array_length(candidate->'tags')/(1+
        (select count(*) from history where kind in('RATING','NOT_INTERESTED') and p->'tags' ? tag.value)))
        from jsonb_array_elements_text(candidate->'tags') tag),0) coverage
  ) select jsonb_build_object('recognition',recognition,'preference',preference,'diversity',diversity,'coverage',coverage,
    'utility',case when control='PRIOR_ONLY' then recognition else .35*recognition+.45*preference+.10*diversity+.10*coverage end)
  from components;
$$;
create function private.select_sequential_taste_v2(catalog jsonb,ledger jsonb,panel jsonb,control text)
returns jsonb language sql immutable set search_path='' as $$
  with available as materialized (
    select c from jsonb_array_elements(catalog) c
    join lateral(select f from jsonb_array_elements(panel->'items') f where f->>'itemId'=c->>'id') forecast on true
    where forecast.f->>'status'='AVAILABLE' and not coalesce((forecast.f->>'labelSeen')::boolean,false)
      and not exists(select 1 from jsonb_array_elements(ledger) p where p->>'objectId'=c->>'id')
  ), choices as (
    select c,private.sequential_taste_components_v2(c,ledger,control) components,
      least(1,(select count(*)::double precision/4 from jsonb_array_elements(ledger) p
        where p->>'itemType'=c->>'itemType' and not coalesce((p->>'invalidated')::boolean,false)
          and p#>>'{responses,-1,answer,kind}'='RATING')) progress,
      (select count(*) from jsonb_array_elements(ledger) p where p->>'itemType'=c->>'itemType') presented
    from available a where jsonb_array_length(c->'tags')>0 and exists(select 1 from available b
      where b.c->>'itemType'=a.c->>'itemType' and jsonb_array_length(b.c->'tags')>0
        and 1-private.sequential_taste_similarity_v2(a.c->'tags',b.c->'tags')>=.10)
  ) select jsonb_build_object('item',c,'components',components) from choices
  order by progress,presented,(components->>'utility')::double precision desc,c->>'itemType' collate "C",c->>'id' collate "C" limit 1;
$$;

-- The first native loop retains bounded coverage and never calls a count or a
-- stable tied score reliable. Full readiness admission remains a separate gate.
create function private.sequential_taste_evaluations_v2(target_session uuid,ledger jsonb)
returns jsonb language sql stable set search_path='' as $$
  with pairs as (
    select a,b,p.id panel_id,p.invalidated,p.frozen,
      a#>>'{responses,0,answer,value}' left_rating,b#>>'{responses,0,answer,value}' right_rating
    from jsonb_array_elements(ledger) a join jsonb_array_elements(ledger) b
      on (a->>'index')::integer<(b->>'index')::integer and a->>'itemType'=b->>'itemType'
    left join lateral (
      select p.* from private.sequential_taste_panels p
      where p.session_id=target_session and p.captured_at<least((a#>>'{responses,0,acceptedAt}')::timestamptz,
        (b#>>'{responses,0,acceptedAt}')::timestamptz)
        and not exists(select 1 from jsonb_array_elements(p.prefix) ref where ref->>'objectId' in(a->>'objectId',b->>'objectId'))
        and (select count(*) from jsonb_array_elements(p.frozen->'items') i
          where i->>'itemId' in(a->>'objectId',b->>'objectId') and i->>'status'='AVAILABLE'
            and not (i->>'labelSeen')::boolean)=2
      order by p.prefix_revision desc limit 1
    ) p on true
    where a#>>'{responses,0,answer,kind}'='RATING' and b#>>'{responses,0,answer,kind}'='RATING'
  ), measured as (
    select *,left_rating::integer-right_rating::integer label_delta,
      (select (i->>'score')::double precision from jsonb_array_elements(frozen->'items') i where i->>'itemId'=a->>'objectId')
      -(select (i->>'score')::double precision from jsonb_array_elements(frozen->'items') i where i->>'itemId'=b->>'objectId') delta,
      jsonb_array_length(a->'responses')<>1 or jsonb_array_length(b->'responses')<>1
        or coalesce((a->>'invalidated')::boolean,false) or coalesce((b->>'invalidated')::boolean,false)
        or coalesce(invalidated,false) invalid from pairs
  ) select coalesce(jsonb_agg(jsonb_build_object('leftObjectId',a->>'objectId','rightObjectId',b->>'objectId',
    'domain',a->>'itemType','poolId',panel_id,
    'status',case when invalid then 'INVALIDATED' when panel_id is null then 'NO_COMMON_UNSEEN_POOL'
      when label_delta=0 then 'RATING_TIE' when abs(delta)<=1e-9 then 'FORECAST_TIE' else 'COMPARABLE' end,
    'agreement',case when not invalid and panel_id is not null and label_delta<>0 and abs(delta)>1e-9
      then case when sign(delta)=sign(label_delta) then 'CONCORDANT' else 'DISCORDANT' end else null end)
    order by (a->>'index')::integer,(b->>'index')::integer),'[]') from measured;
$$;

create function private.sequential_taste_snapshot_v2(target_session uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare s private.sequential_taste_sessions;p jsonb;item jsonb;metrics jsonb;
begin
  select * into strict s from private.sequential_taste_sessions where id=target_session;
  if s.status='REMOVED' then return jsonb_build_object('version',s.version,'sessionId',s.id,'profileId',s.profile_id,'status','REMOVED');end if;
  p:=s.presentations->-1;
  if p is not null and jsonb_array_length(p->'responses')=0 and not (p->>'invalidated')::boolean then
    select c-'tags'-'rawTags' into item from jsonb_array_elements(s.catalog) c where c->>'id'=p->>'objectId';
  end if;
  metrics:=private.sequential_taste_evaluations_v2(s.id,s.presentations);
  return jsonb_build_object('version',s.version,'sessionId',s.id,'profileId',s.profile_id,'revision',s.revision,
    'status',case when s.status<>'ACTIVE' then s.status when item is not null then 'QUESTION' else 'NEEDS_NEXT' end,
    'stopReason',s.stop_reason,'currentItem',case when s.status='ACTIVE' then item else null end,
    'questionId',case when s.status='ACTIVE' and item is not null then p->>'id' else null end,
    'acceptedAt',s.receipt_at,'canContinueDiscovery',true,'profilePreserved',true,
    'answered',(select count(*) from jsonb_array_elements(s.presentations) q where jsonb_array_length(q->'responses')>0),
    'presented',jsonb_array_length(s.presentations),'maximumOpportunities',48,
    'readiness',jsonb_build_object('status','INSUFFICIENT','basis','CONTINUOUS_LEARNING_SOURCE_V2',
      'reason','FULL_READINESS_ADAPTER_NOT_ADMITTED','uncertainty',null,'qualityAdmitted',false),
    'evaluation',jsonb_build_object('metric','SAME_PREFIX_ORDINAL','accuracyPercent',null,'pairs',metrics),
    'ratingProjection','TASTE_TEST_BOOTSTRAP_ONLY','negativeProjection','DISTINCT_TASTE_PRIOR_V2','anonymousEntry',false);
end;$$;

-- A panel and the first measurement are retained before this projection runs.
-- Unknown affects recognition only. Explicit not-interest has a separate
-- negative bootstrap kind; neither is invented as a consumed numeric rating.
create function private.project_sequential_taste_evidence_v2(target_session uuid,question jsonb,response jsonb)
returns void language plpgsql set search_path='' as $$
declare s private.sequential_taste_sessions;job uuid;accepted timestamptz:=(response->>'acceptedAt')::timestamptz;
begin
  select * into strict s from private.sequential_taste_sessions where id=target_session;
  job:=s.source_job_id;
  if job is null and response#>>'{answer,kind}' in('RATING','NOT_INTERESTED') then
    insert into private.profile_import_jobs(actor_user_id,profile_id,source_provider,dataset_kind,file_fingerprint,status,committed_at)
      values(s.actor_user_id,s.profile_id,'KAJO_CALIBRATION','TASTE_SESSION_V2','taste:v2:'||s.id,'COMMITTED',accepted) returning id into job;
    update private.sequential_taste_sessions set source_job_id=job where id=s.id;
  end if;
  if job is null then return;end if;
  if response#>>'{answer,kind}' in('RATING','NOT_INTERESTED') then
    insert into private.profile_bootstrap_evidence(actor_user_id,profile_id,item_id,item_type,source_provider,dataset_kind,
      source_job_id,source_row_key,evidence_kind,rating,source_occurred_at,imported_at,source_metadata)
    values(s.actor_user_id,s.profile_id,(question->>'objectId')::uuid,question->>'itemType','KAJO_CALIBRATION','TASTE_SESSION_V2',
      job,question->>'objectId',case when response#>>'{answer,kind}'='RATING' then 'RATED' else 'NOT_INTERESTED' end,
      (response#>>'{answer,value}')::integer,accepted,accepted,
      jsonb_build_object('source','TASTE_TEST','tasteSessionId',s.id,'questionId',question->>'id',
        'responseId',response->>'id','responseRevision',response->'revision','version',s.version,
        'questionPolicyVersion','sequential-taste-numeric-v2','evidencePolicyVersion','taste-prior-v2'))
    on conflict(profile_id,source_provider,dataset_kind,item_id) do update set evidence_kind=excluded.evidence_kind,rating=excluded.rating,
      source_occurred_at=excluded.source_occurred_at,imported_at=excluded.imported_at,active=true,source_metadata=excluded.source_metadata;
  else
    update private.profile_bootstrap_evidence set active=false,imported_at=accepted
      where source_job_id=job and item_id=(question->>'objectId')::uuid and active;
  end if;
  update private.profile_import_jobs set total_rows=jsonb_array_length(s.presentations),
    matched_rows=(select count(*) from private.profile_bootstrap_evidence where source_job_id=job and active),updated_at=accepted where id=job;
end;$$;

create function private.guard_sequential_taste_panel_v2() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.id<>old.id or new.session_id<>old.session_id or new.prefix_revision<>old.prefix_revision
    or new.captured_at<>old.captured_at or new.captured_transaction<>old.captured_transaction
    or (new.prediction_id is not null and new.prediction_id is distinct from old.prediction_id)
    or (old.invalidated and not new.invalidated) then raise exception 'Sequential forecast identity is immutable' using errcode='55000';end if;
  if new.invalidated or new.prediction_id is null then
    new.invalidated:=true;new.frozen:='{}';new.prefix:='[]';
  elsif new.frozen<>old.frozen or new.prefix<>old.prefix then
    raise exception 'Sequential forecast is immutable' using errcode='55000';
  end if;
  return new;
end;$$;
create trigger guard_sequential_taste_panel_v2 before update on private.sequential_taste_panels
for each row execute function private.guard_sequential_taste_panel_v2();

-- Mark the backwards-only prefix dependency closure before deleting canonical
-- evaluation sources. Source removal may redact copied history; retry hashes
-- survive and cannot be used to resurrect an old response or forecast.
create function private.invalidate_sequential_taste_v2(target_session uuid,root_question text default null,all_panels boolean default false)
returns void language plpgsql set search_path='' as $$
declare s private.sequential_taste_sessions;p record;bad text[]:='{}';invalid_questions text[]:='{}';ledger jsonb;runs uuid[];run_id uuid;
begin
  select * into s from private.sequential_taste_sessions where id=target_session for update;
  if s.id is null or s.status='REMOVED' then return;end if;
  if root_question is not null then bad:=array[root_question];end if;
  for p in select * from private.sequential_taste_panels where session_id=s.id order by prefix_revision loop
    if all_panels or p.invalidated or exists(select 1 from jsonb_array_elements(p.prefix) ref where ref->>'questionId'=any(bad)) then
      select invalid_questions||coalesce(array_agg(e->>'id'),'{}') into invalid_questions
        from jsonb_array_elements(s.presentations) e where e->>'poolId'=p.id::text;
      bad:=bad||invalid_questions;
      update private.sequential_taste_panels set invalidated=true where id=p.id and not invalidated;
    end if;
  end loop;
  select coalesce(jsonb_agg(case when e->>'id'=any(invalid_questions) then e||'{"invalidated":true}'::jsonb else e end order by n),'[]')
    into ledger from jsonb_array_elements(s.presentations) with ordinality t(e,n);
  update private.sequential_taste_sessions set presentations=ledger where id=s.id;
  update private.profile_bootstrap_evidence set active=false where source_job_id=s.source_job_id and active
    and item_id in(select (e->>'objectId')::uuid from jsonb_array_elements(ledger) e where (e->>'invalidated')::boolean);
  update private.sequential_taste_commands set result=jsonb_build_object('version',s.version,'sessionId',s.id,
    'profileId',s.profile_id,'status','SOURCE_WITHDRAWN','reloadRequired',true) where session_id=s.id;
  select array_agg(prediction_id) into runs from private.sequential_taste_panels
    where session_id=s.id and invalidated and prediction_id is not null;
  if runs is not null then foreach run_id in array runs loop perform private.erase_prediction_sources_v1('PREDICTION_RUN',run_id);end loop;end if;
end;$$;

create function private.withdraw_sequential_panel_source_v2() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform private.invalidate_sequential_taste_v2(new.session_id);
  return new;
end;$$;
create trigger withdraw_sequential_panel_source_v2 after update of prediction_id on private.sequential_taste_panels
for each row when(old.prediction_id is not null and new.prediction_id is null and not old.invalidated)
execute function private.withdraw_sequential_panel_source_v2();

create function private.remove_sequential_taste_v2(target_session uuid)
returns void language plpgsql set search_path='' as $$
declare s private.sequential_taste_sessions;run_id uuid;
begin
  select * into s from private.sequential_taste_sessions where id=target_session for update;
  if s.id is null or s.status='REMOVED' then return;end if;
  update private.sequential_taste_sessions set status='REMOVED',catalog='[]',presentations='[]',stop_reason='SOURCE_REMOVED' where id=s.id;
  delete from private.sequential_taste_commands where session_id=s.id;
  update private.sequential_taste_panels set invalidated=true where session_id=s.id;
  for run_id in select prediction_id from private.sequential_taste_panels where session_id=s.id and prediction_id is not null loop
    perform private.erase_prediction_sources_v1('PREDICTION_RUN',run_id);
  end loop;
  delete from private.sequential_taste_panels where session_id=s.id;
  if s.source_job_id is not null then
    update private.profile_bootstrap_evidence set active=false where source_job_id=s.source_job_id and active;
    update private.profile_import_jobs set status='REMOVED',updated_at=clock_timestamp() where id=s.source_job_id and status<>'REMOVED';
  end if;
end;$$;
create function private.withdraw_sequential_import_v2() returns trigger
language plpgsql security definer set search_path='' as $$
declare s record;
begin
  for s in select id,source_job_id from private.sequential_taste_sessions where profile_id=new.profile_id and status<>'REMOVED' loop
    if s.source_job_id=new.id then perform private.remove_sequential_taste_v2(s.id);
    else perform private.invalidate_sequential_taste_v2(s.id,null,true);end if;
  end loop;
  return new;
end;$$;
create trigger withdraw_sequential_import_v2 after update of status on private.profile_import_jobs
for each row when(new.status='REMOVED' and old.status<>'REMOVED') execute function private.withdraw_sequential_import_v2();
create function private.withdraw_sequential_event_v2() returns trigger
language plpgsql security definer set search_path='' as $$
declare profile uuid;session uuid;
begin
  profile:=case when tg_op='DELETE' then old.profile_id else new.profile_id end;
  select id into session from private.sequential_taste_sessions where profile_id=profile and status<>'REMOVED';
  if session is not null then perform private.invalidate_sequential_taste_v2(session,null,true);end if;
  if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger withdraw_sequential_event_v2 before delete on public.events
for each row execute function private.withdraw_sequential_event_v2();
create trigger withdraw_sequential_reversal_v2 after insert on public.events
for each row when(new.event_type in('ITEM_INTERACTION_UNDONE','ITEM_HISTORY_CLEARED','ITEM_INTEREST_CLEARED'))
execute function private.withdraw_sequential_event_v2();

-- Selective removal can deactivate a prior without removing its whole job.
-- Own Taste revisions use their explicit dependency-closure path above.
create function private.withdraw_sequential_bootstrap_v2() returns trigger
language plpgsql security definer set search_path='' as $$
declare session uuid;
begin
  if tg_op='UPDATE' and old.source_provider='KAJO_CALIBRATION' and old.dataset_kind='TASTE_SESSION_V2' then
    if tg_op='DELETE' then return old;end if;return new;
  end if;
  select id into session from private.sequential_taste_sessions where profile_id=old.profile_id and status<>'REMOVED';
  if session is not null then perform private.invalidate_sequential_taste_v2(session,null,true);end if;
  if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger withdraw_sequential_bootstrap_delete_v2 after delete on private.profile_bootstrap_evidence
for each row execute function private.withdraw_sequential_bootstrap_v2();
create trigger withdraw_sequential_bootstrap_active_v2 after update of active on private.profile_bootstrap_evidence
for each row when(old.active and not new.active) execute function private.withdraw_sequential_bootstrap_v2();

create function private.taste_session_v2(request jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  actor uuid;profile uuid;operation text;command_id uuid;question_id uuid;keys text[];
  s private.sequential_taste_sessions;saved private.sequential_taste_commands;panel private.sequential_taste_panels;
  at_time timestamptz;tx text:=pg_current_xact_id()::text;catalog jsonb;ids uuid[];frozen jsonb;prefix jsonb;
  chosen jsonb;q jsonb;response jsonb;answer jsonb;ledger jsonb;result jsonb;metrics jsonb;measurement jsonb;
  prediction uuid;question_index integer;count_commands integer;
begin
  if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>4096 then
    raise exception 'Invalid sequential Taste request' using errcode='22023';end if;
  operation:=request->>'operation';
  if operation is null or operation not in('START','RESUME','NEXT','ANSWER','CORRECT','PAUSE','CONTINUE','REMOVE') then
    raise exception 'Invalid sequential Taste operation' using errcode='22023';end if;
  keys:=case operation when 'START' then array['operation','profileId','requestId']
    when 'RESUME' then array['operation','profileId','sessionId']
    when 'ANSWER' then array['operation','profileId','sessionId','requestId','expectedRevision','questionId','answer']
    when 'CORRECT' then array['operation','profileId','sessionId','requestId','expectedRevision','questionId','answer']
    else array['operation','profileId','sessionId','requestId','expectedRevision'] end;
  if (select array_agg(k order by k) from jsonb_object_keys(request) k) is distinct from
    (select array_agg(k order by k) from unnest(keys) k) or jsonb_typeof(request->'profileId')<>'string' then
    raise exception 'Invalid sequential Taste fields' using errcode='22023';end if;
  profile:=(request->>'profileId')::uuid;actor:=private.assert_personal_profile_owner_v1(profile);
  if exists(select 1 from auth.users u where u.id=actor and to_jsonb(u)->>'is_anonymous'='true') then
    raise exception 'Anonymous Taste entry is not available' using errcode='42501';end if;
  -- Same Profile-first lock as v1. Reauthorize after a potentially blocked wait.
  perform 1 from public.profiles where id=profile for update;
  actor:=private.assert_personal_profile_owner_v1(profile);
  select * into s from private.sequential_taste_sessions where profile_id=profile for update;
  if s.id is not null and s.actor_user_id<>actor then raise exception 'Taste owner access required' using errcode='42501';end if;
  if operation<>'RESUME' then
    if jsonb_typeof(request->'requestId') is distinct from 'string' then raise exception 'Invalid Taste request identity' using errcode='22023';end if;
    command_id:=(request->>'requestId')::uuid;
    if command_id is null then raise exception 'Missing Taste request identity' using errcode='22023';end if;
  end if;
  if operation<>'START' and (s.id is null or jsonb_typeof(request->'sessionId') is distinct from 'string'
    or (request->>'sessionId')::uuid is distinct from s.id) then raise exception 'Sequential Taste session unavailable' using errcode='42501';end if;
  if operation='START' and s.id is null then
    if exists(select 1 from private.taste_sessions where profile_id=profile) then
      return jsonb_build_object('version','personal-taste-session-v2','profileId',profile,'status','LEGACY_V1_PRESERVED',
        'legacySessionId',(select id from private.taste_sessions where profile_id=profile),'canContinueDiscovery',true);
    end if;
    if not (private.get_profile_bootstrap_status_v1(profile)->>'needsCalibration')::boolean then
      return jsonb_build_object('version','personal-taste-session-v2','profileId',profile,'status','EXISTING_COMPLETION','canContinueDiscovery',true);
    end if;
    at_time:=clock_timestamp();
    -- Bounded canonical pool, explicitly NOT full-domain forecast coverage.
    -- Exclude retained labels even when inactive: they are not unseen holdouts.
    with candidates as (
      select c,i.tags raw_tags,row_number() over(partition by c->>'itemType'
        order by coalesce((c->>'recognitionPrior')::double precision,0) desc,c->>'id' collate "C") n
      from jsonb_array_elements(private.taste_catalog_snapshot_v1(profile,at_time)) c
      join public.items i on i.id=(c->>'id')::uuid
      where not exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=i.id)
        and not exists(select 1 from public.events e where e.profile_id=profile and e.item_id=i.id
          and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED'))
        and not exists(select 1 from public.item_interactions a where a.profile_id=profile and a.item_id=i.id)
    ) select coalesce(jsonb_agg(c||jsonb_build_object('rawTags',to_jsonb(raw_tags)) order by c->>'id'),'[]')
      into catalog from candidates where n<=25;
    insert into private.sequential_taste_sessions(profile_id,actor_user_id,catalog,catalog_as_of,receipt_at,receipt_transaction,created_at)
      values(profile,actor,catalog,at_time,at_time,tx,at_time) returning * into s;
  end if;
  if s.source_job_id is not null then perform 1 from private.profile_import_jobs where id=s.source_job_id for update;end if;
  if s.status='REMOVED' then return private.sequential_taste_snapshot_v2(s.id);end if;
  -- Live catalog withdrawal wins even over a saved NEXT reply. Lock the bounded
  -- Item set so an answer cannot race a metadata/availability change.
  if operation<>'REMOVE' and not(operation='CORRECT' and request#>>'{answer,kind}'='WITHDRAWN') then
    perform 1 from public.items where id in(select (c->>'id')::uuid from jsonb_array_elements(s.catalog) c) order by id for share;
    if exists(select 1 from jsonb_array_elements(s.catalog) c where not exists(select 1 from public.items i
      where i.id=(c->>'id')::uuid and i.discoverable and i.item_type=c->>'itemType' and to_jsonb(i.tags)=c->'rawTags'
        and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then
      update private.sequential_taste_sessions set status='STOPPED',stop_reason='CATALOG_CHANGED_INSUFFICIENT' where id=s.id;
      return private.sequential_taste_snapshot_v2(s.id);
    end if;
  end if;
  if operation='RESUME' then return private.sequential_taste_snapshot_v2(s.id);end if;
  select * into saved from private.sequential_taste_commands where session_id=s.id and request_id=command_id;
  if saved.request_id is not null then
    if saved.command_hash<>md5(request::text) then raise exception 'Taste request identity conflict' using errcode='22023';end if;
    return saved.result;
  end if;
  if operation='START' and exists(select 1 from private.sequential_taste_commands where session_id=s.id) then
    return private.sequential_taste_snapshot_v2(s.id);
  end if;
  if operation<>'START' and (jsonb_typeof(request->'expectedRevision') is distinct from 'number'
    or coalesce(request->>'expectedRevision','') !~ '^(0|[1-9][0-9]{0,2})$'
    or (request->>'expectedRevision')::integer<>s.revision) then raise exception 'Taste revision conflict' using errcode='40001';end if;
  if operation='REMOVE' then
    perform private.remove_sequential_taste_v2(s.id);return private.sequential_taste_snapshot_v2(s.id);
  end if;
  select count(*) into count_commands from private.sequential_taste_commands where session_id=s.id;
  if count_commands>=160 and not(operation='CORRECT' and request#>>'{answer,kind}'='WITHDRAWN') then
    if s.status='STOPPED' then raise exception 'Taste command budget exhausted; resume state or remove source' using errcode='40001';end if;
    update private.sequential_taste_sessions set status='STOPPED',stop_reason='COMMAND_BUDGET_INSUFFICIENT',revision=revision+1,
      receipt_at=greatest(clock_timestamp(),receipt_at+interval '1 microsecond'),receipt_transaction=tx where id=s.id;
    result:=private.sequential_taste_snapshot_v2(s.id);
    insert into private.sequential_taste_commands(session_id,request_id,command_hash,result) values(s.id,command_id,md5(request::text),result);
    return result;
  end if;
  if s.revision>=255 then raise exception 'Taste command budget exhausted; removal remains available' using errcode='22023';end if;
  at_time:=greatest(clock_timestamp(),s.receipt_at+interval '1 microsecond');
  if operation in('ANSWER','CORRECT') then
    if jsonb_typeof(request->'questionId') is distinct from 'string' then raise exception 'Invalid Taste question' using errcode='22023';end if;
    question_id:=(request->>'questionId')::uuid;
    select p,(n-1)::integer into q,question_index from jsonb_array_elements(s.presentations) with ordinality l(p,n) where p->>'id'=question_id::text;
    answer:=request->'answer';
    if q is null or jsonb_typeof(answer) is distinct from 'object' or answer->>'kind' is null
      or answer->>'kind' not in('RATING','UNKNOWN','NOT_INTERESTED','WITHDRAWN')
      or (select array_agg(k order by k) from jsonb_object_keys(answer) k) is distinct from
        (case when answer->>'kind'='RATING' then array['kind','value'] else array['kind'] end)
      or (answer->>'kind'='RATING' and (jsonb_typeof(answer->'value') is distinct from 'number'
        or coalesce(answer->>'value','') !~ '^([0-9]|10)$')) then raise exception 'Invalid Taste answer' using errcode='22023';end if;
    if operation='ANSWER' and (q<>s.presentations->-1 or jsonb_array_length(q->'responses')<>0 or answer->>'kind'='WITHDRAWN')
      or operation='CORRECT' and (jsonb_array_length(q->'responses')=0 or q#>>'{responses,-1,answer,kind}'='WITHDRAWN'
        or q#>'{responses,-1,answer}'=answer) then raise exception 'Taste answer/correction order conflict' using errcode='40001';end if;
    if (s.status<>'ACTIVE' or (q->>'invalidated')::boolean) and answer->>'kind'<>'WITHDRAWN' then
      raise exception 'Taste is paused, stopped or question invalidated' using errcode='40001';end if;
    if jsonb_array_length(q->'responses')>=(case when answer->>'kind'='WITHDRAWN' then 9 else 8 end) then
      raise exception 'Taste response revision budget exhausted' using errcode='22023';end if;
    select * into strict panel from private.sequential_taste_panels where id=(q->>'poolId')::uuid;
    if operation='ANSWER' and (panel.invalidated or panel.captured_transaction=tx or panel.captured_at>=now()) then
      raise exception 'Commit the question forecast before its first answer' using errcode='40001';end if;
    if operation='ANSWER' and (exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=(q->>'objectId')::uuid)
      or exists(select 1 from public.events e where e.profile_id=profile and e.item_id=(q->>'objectId')::uuid and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED'))) then
      raise exception 'Question acquired another label; request NEXT' using errcode='40001';end if;
    response:=jsonb_build_object('id',command_id,'revision',jsonb_array_length(q->'responses')+1,'acceptedAt',at_time,'answer',answer);
    q:=jsonb_set(q,'{responses}',q->'responses'||jsonb_build_array(response));
    ledger:=jsonb_set(s.presentations,array[question_index::text],q);
    metrics:=private.sequential_taste_evaluations_v2(s.id,ledger);
    select jsonb_build_object('metric','SAME_PREFIX_ORDINAL','predictionId',panel.id,'prefixRevision',panel.prefix_revision,
      'firstMeasurement',operation='ANSWER','comparablePairs',count(*) filter(where e->>'status'='COMPARABLE'),
      'concordantPairs',count(*) filter(where e->>'agreement'='CONCORDANT'),
      'discordantPairs',count(*) filter(where e->>'agreement'='DISCORDANT'),
      'pendingComparison',count(*) filter(where e->>'status'='COMPARABLE')=0)
      into measurement from jsonb_array_elements(metrics) e where e->>'leftObjectId'=q->>'objectId' or e->>'rightObjectId'=q->>'objectId';
    response:=response||jsonb_build_object('measurement',measurement);
    q:=jsonb_set(q,array['responses',(jsonb_array_length(q->'responses')-1)::text],response);
    s.presentations:=jsonb_set(s.presentations,array[question_index::text],q);
    -- Persist first-answer/current evaluation BEFORE its evidence projection.
    update private.sequential_taste_sessions set presentations=s.presentations where id=s.id;
    perform private.project_sequential_taste_evidence_v2(s.id,q,response);
    if answer->>'kind'='WITHDRAWN' then perform private.invalidate_sequential_taste_v2(s.id,q->>'id');end if;
  elsif operation='NEXT' then
    if s.status<>'ACTIVE' then raise exception 'Resume Taste before requesting NEXT' using errcode='40001';end if;
    if s.receipt_transaction=tx or s.receipt_at>=now() then
      raise exception 'Commit the accepted response before NEXT' using errcode='40001';end if;
    q:=s.presentations->-1;
    if q is not null and jsonb_array_length(q->'responses')=0 and not (q->>'invalidated')::boolean then
      if exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=(q->>'objectId')::uuid)
        or exists(select 1 from public.events e where e.profile_id=profile and e.item_id=(q->>'objectId')::uuid and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED')) then
        s.presentations:=jsonb_set(s.presentations,array[(jsonb_array_length(s.presentations)-1)::text],q||'{"invalidated":true}'::jsonb);
        update private.sequential_taste_sessions set presentations=s.presentations where id=s.id;
      else raise exception 'Answer the current question before NEXT' using errcode='40001';end if;
    end if;
    if jsonb_array_length(s.presentations)>=48 then
      update private.sequential_taste_sessions set status='STOPPED',stop_reason='OPPORTUNITY_BUDGET_INSUFFICIENT' where id=s.id;
    elsif jsonb_array_length(s.catalog)=0 then
      update private.sequential_taste_sessions set status='STOPPED',stop_reason='CATALOG_EXHAUSTED_INSUFFICIENT' where id=s.id;
    else
      select array_agg((c->>'id')::uuid order by c->>'id') into ids from jsonb_array_elements(s.catalog) c;
      perform 1 from public.items where id=any(ids) order by id for share;
      if exists(select 1 from jsonb_array_elements(s.catalog) c where not exists(select 1 from public.items i
        where i.id=(c->>'id')::uuid and i.discoverable and i.item_type=c->>'itemType' and to_jsonb(i.tags)=c->'rawTags'
          and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then
        update private.sequential_taste_sessions set status='STOPPED',stop_reason='CATALOG_CHANGED_INSUFFICIENT' where id=s.id;
      else
        select coalesce(jsonb_agg(jsonb_build_object('questionId',p->>'id','objectId',p->>'objectId',
          'responseId',p#>>'{responses,-1,id}','revision',p#>'{responses,-1,revision}') order by n),'[]') into prefix
          from jsonb_array_elements(s.presentations) with ordinality l(p,n)
          where jsonb_array_length(p->'responses')>0 and not (p->>'invalidated')::boolean and p#>>'{responses,-1,answer,kind}'<>'WITHDRAWN';
        prediction:=gen_random_uuid();
        frozen:=private.capture_personal_evaluation_v1(prediction,profile,ids,s.receipt_at,jsonb_build_object('sessionId',s.id));
        select jsonb_set(frozen,'{items}',jsonb_agg(i||jsonb_build_object('labelSeen',
          exists(select 1 from jsonb_array_elements(s.presentations) p where p->>'objectId'=i->>'itemId' and jsonb_array_length(p->'responses')>0)
          or exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=(i->>'itemId')::uuid)
          or exists(select 1 from public.events e where e.profile_id=profile and e.item_id=(i->>'itemId')::uuid
            and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED'))) order by n)) into frozen
          from jsonb_array_elements(frozen->'items') with ordinality l(i,n);
        frozen:=frozen||jsonb_build_object('coverage','BOUNDED_CANONICAL_POOL','featurePolicyVersion','taste-tags-frequency-64-v2',
          'requiredReceiptTransaction',s.receipt_transaction,'requiredReceiptRevision',s.revision);
        insert into private.sequential_taste_panels(id,session_id,prediction_id,prefix_revision,prefix,frozen,captured_at,captured_transaction)
          values(prediction,s.id,prediction,s.revision,prefix,frozen,now(),tx);
        chosen:=private.select_sequential_taste_v2(s.catalog,s.presentations,frozen,s.policy);
        if chosen is null then
          update private.sequential_taste_sessions set status='STOPPED',stop_reason='NO_SUPPORTED_INFORMATION_INSUFFICIENT' where id=s.id;
        else
          q:=jsonb_build_object('id',command_id,'index',jsonb_array_length(s.presentations),'objectId',chosen#>>'{item,id}',
            'itemType',chosen#>>'{item,itemType}','tags',chosen#>'{item,tags}','poolId',prediction,'presentedAt',at_time,
            'selectionComponents',chosen->'components','invalidated',false,'responses','[]'::jsonb);
          update private.sequential_taste_sessions set presentations=presentations||jsonb_build_array(q) where id=s.id;
        end if;
      end if;
    end if;
  elsif operation='PAUSE' then
    update private.sequential_taste_sessions set status='PAUSED',stop_reason='VOLUNTARY_INSUFFICIENT' where id=s.id and status='ACTIVE';
  elsif operation='CONTINUE' then
    if s.status<>'PAUSED' then raise exception 'Taste is not paused' using errcode='40001';end if;
    update private.sequential_taste_sessions set status='ACTIVE',stop_reason=null where id=s.id;
  end if;
  update private.sequential_taste_sessions set revision=revision+1,receipt_at=at_time,receipt_transaction=tx where id=s.id;
  result:=private.sequential_taste_snapshot_v2(s.id);
  insert into private.sequential_taste_commands(session_id,request_id,command_hash,result) values(s.id,command_id,md5(request::text),result);
  return result;
end;$$;
create function public.taste_session_v2(request jsonb)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.taste_session_v2(request);$$;

-- Prevent a second writer if an old app starts v1 after v2 already exists.
create function private.guard_sequential_taste_writer_v2() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from private.sequential_taste_sessions where profile_id=new.profile_id) then
    raise exception 'Sequential Taste v2 already owns this Profile; preserve its session' using errcode='40001';end if;
  return new;
end;$$;
create trigger guard_sequential_taste_writer_v2 before insert on private.taste_sessions
for each row execute function private.guard_sequential_taste_writer_v2();

revoke all on function private.sequential_taste_similarity_v2(jsonb,jsonb),
  private.sequential_taste_components_v2(jsonb,jsonb,text),private.select_sequential_taste_v2(jsonb,jsonb,jsonb,text),
  private.sequential_taste_evaluations_v2(uuid,jsonb),private.sequential_taste_snapshot_v2(uuid),
  private.project_sequential_taste_evidence_v2(uuid,jsonb,jsonb),private.guard_sequential_taste_panel_v2(),
  private.invalidate_sequential_taste_v2(uuid,text,boolean),private.withdraw_sequential_panel_source_v2(),
  private.remove_sequential_taste_v2(uuid),private.withdraw_sequential_import_v2(),private.withdraw_sequential_event_v2(),private.withdraw_sequential_bootstrap_v2(),
  private.guard_sequential_taste_writer_v2(),private.taste_session_v2(jsonb),public.taste_session_v2(jsonb)
  from public,anon,authenticated,service_role;
grant execute on function private.taste_session_v2(jsonb),public.taste_session_v2(jsonb) to authenticated;

create function private.guard_sequential_taste_history_v2() returns trigger language plpgsql set search_path='' as $$
declare previous jsonb;current_question jsonb;n integer;r integer;
begin
  if new.id<>old.id or new.profile_id<>old.profile_id or new.actor_user_id<>old.actor_user_id or new.version<>old.version
    or new.created_at<>old.created_at or new.catalog_as_of<>old.catalog_as_of or new.policy<>old.policy
    or (old.status='REMOVED' and new.status<>'REMOVED') then
    raise exception 'Sequential Taste identity is immutable' using errcode='55000';end if;
  if new.status='REMOVED' then
    if new.catalog<>'[]'::jsonb or new.presentations<>'[]'::jsonb then raise exception 'Removed Taste retains copied state';end if;
    return new;
  end if;
  if new.catalog<>old.catalog or jsonb_array_length(new.presentations)<jsonb_array_length(old.presentations)
    or jsonb_array_length(new.presentations)>jsonb_array_length(old.presentations)+1 then
    raise exception 'Sequential Taste catalog/history is immutable' using errcode='55000';end if;
  for n in 0..jsonb_array_length(old.presentations)-1 loop
    previous:=old.presentations->n;current_question:=new.presentations->n;
    if previous-'responses'-'invalidated'<>current_question-'responses'-'invalidated'
      or ((previous->>'invalidated')::boolean and not (current_question->>'invalidated')::boolean)
      or jsonb_array_length(current_question->'responses')<jsonb_array_length(previous->'responses')
      or jsonb_array_length(current_question->'responses')>jsonb_array_length(previous->'responses')+1 then
      raise exception 'Sequential Taste question is immutable' using errcode='55000';end if;
    for r in 0..jsonb_array_length(previous->'responses')-1 loop
      if previous->'responses'->r<>current_question->'responses'->r then
        raise exception 'Sequential Taste first measurement is immutable' using errcode='55000';end if;
    end loop;
  end loop;
  return new;
end;$$;
revoke all on function private.guard_sequential_taste_history_v2() from public,anon,authenticated,service_role;
create trigger guard_sequential_taste_history_v2 before update on private.sequential_taste_sessions
for each row execute function private.guard_sequential_taste_history_v2();
