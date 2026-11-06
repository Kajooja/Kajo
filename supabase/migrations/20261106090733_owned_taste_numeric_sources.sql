-- A closed, read-only source boundary for the next numeric capture generation.
-- This does not change existing captures, promote bootstrap rows to Events, or
-- make an earlier answered Taste question a prospective numeric opportunity.
create function private.personal_rating_training_sources_v2(target_profile uuid,target_type text,cutoff timestamptz)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;
begin
  if actor is null or not exists(select 1 from public.profiles p where p.id=target_profile
    and p.profile_type='PERSONAL' and p.owner_user_id=actor) then
    raise exception 'Numeric training source owner required' using errcode='42501';end if;
  if target_type is null or target_type not in('MOVIE','BOOK') or cutoff is null
    or not isfinite(cutoff) or cutoff>clock_timestamp() then
    raise exception 'Invalid numeric training source scope' using errcode='22023';end if;
  -- Count the whole inventory, including future/inactive rows. Do not silently
  -- turn a partial prefix into complete training support.
  if (select count(*) from (select 1 from public.events e where e.profile_id=target_profile
      and e.actor_user_id=actor limit 8193) bounded)>8192
    or (select count(*) from (select 1 from private.profile_bootstrap_evidence b
      where b.profile_id=target_profile and b.actor_user_id=actor limit 8193) bounded)>8192 then
    raise exception 'Complete numeric source inventory exceeds budget' using errcode='54000';end if;
  with resolved as materialized(select * from private.personal_source_evidence_v1(target_profile,cutoff)),
  native as (
    select r.item_id,jsonb_build_object('itemId',r.item_id,'sourceEventId',r.source_event_id,
      'sourceStatus',r.source_status,'orderingBasis',r.ordering_basis,
      'event',jsonb_build_object('id',e.id,'actorUserId',e.actor_user_id,'profileId',e.profile_id,
        'itemId',e.item_id,'itemType',e.item_type,'eventType',e.event_type,'rating',e.properties->'rating',
        'occurredAtMicros',(extract(epoch from e.occurred_at)*1000000)::bigint::text,
        'availableAtMicros',(extract(epoch from e.created_at)*1000000)::bigint::text)) value
    from resolved r join public.events e on e.id=r.source_event_id join public.items i on i.id=e.item_id
    where not r.is_bootstrap and r.source_status='NATIVE_RATING' and e.event_type='ITEM_RATED'
      and e.profile_id=target_profile and e.actor_user_id=actor and e.item_id=r.item_id
      and e.item_type=target_type and i.item_type=target_type
      and jsonb_typeof(e.properties->'rating')='number' and e.properties->>'rating' ~ '^(10|[0-9])$'
      and e.created_at<now() and e.xmin::text<>pg_current_xact_id()::text
  ), taste as (
    select b.item_id,jsonb_build_object('itemId',b.item_id,'sourceStatus','OWNED_TASTE_RATING',
      'sourceBootstrapId',b.id,'orderingBasis','ACCEPTED_SEQUENTIAL_TASTE_RESPONSE',
      'bootstrap',jsonb_build_object('id',b.id,'actorUserId',b.actor_user_id,'profileId',b.profile_id,
        'itemId',b.item_id,'itemType',b.item_type,'sourceProvider',b.source_provider,'datasetKind',b.dataset_kind,
        'evidenceKind',b.evidence_kind,'rating',b.rating,'sourceJobId',b.source_job_id,
        'sessionId',s.id,'sessionVersion',s.version,'questionId',q->>'id','panelId',p.id,
        'responseId',r->>'id','responseRevision',r->'revision','commandHash',c.command_hash,
        'acceptedAtMicros',(extract(epoch from (r->>'acceptedAt')::timestamptz)*1000000)::bigint::text,
        'availableAtMicros',(extract(epoch from b.imported_at)*1000000)::bigint::text,
        'experienceTime','UNKNOWN')) value
    from resolved chosen join private.profile_bootstrap_evidence b on b.id=chosen.source_event_id
    join public.items i on i.id=b.item_id
    join private.sequential_taste_sessions s on s.id::text=b.source_metadata->>'tasteSessionId'
    join private.profile_import_jobs j on j.id=b.source_job_id and j.id=s.source_job_id
    cross join lateral jsonb_array_elements(s.presentations) q
    cross join lateral (select q#>'{responses,-1}' r) response
    join private.sequential_taste_commands c on c.session_id=s.id and c.request_id::text=r->>'id'
    join private.sequential_taste_panels p on p.session_id=s.id and p.id::text=q->>'poolId'
    where chosen.is_bootstrap and chosen.source_status='BOOTSTRAP_PRIOR'
      and b.profile_id=target_profile and b.actor_user_id=actor and b.item_type=target_type and i.item_type=target_type
      and b.active and b.source_provider='KAJO_CALIBRATION' and b.dataset_kind='TASTE_SESSION_V2'
      and b.evidence_kind='RATED' and b.rating between 0 and 10
      and b.source_row_key=b.item_id::text and b.source_metadata->>'source'='TASTE_TEST'
      and b.source_metadata->>'version'='personal-taste-session-v2'
      and b.source_metadata->>'questionPolicyVersion'=case s.policy
        when 'CANONICAL_FORECAST_POOL_V4' then 'canonical-ordinal-pool-v4'
        when 'CANONICAL_FORECAST_V3' then 'canonical-ordinal-v3'
        when 'ADAPTIVE' then 'sequential-taste-numeric-v2'
        when 'PRIOR_ONLY' then 'sequential-taste-numeric-v2' end
      and b.source_metadata->>'evidencePolicyVersion'='taste-prior-v2'
      and s.profile_id=target_profile and s.actor_user_id=actor and s.status<>'REMOVED'
      and s.version='personal-taste-session-v2' and s.receipt_at<now() and s.receipt_at<=cutoff
      and s.xmin::text<>pg_current_xact_id()::text
      and j.profile_id=target_profile and j.actor_user_id=actor and j.status='COMMITTED'
      and j.source_provider=b.source_provider and j.dataset_kind=b.dataset_kind
      and j.file_fingerprint='taste:v2:'||s.id::text and j.committed_at<=b.imported_at
      and isfinite(j.committed_at) and j.xmin::text<>pg_current_xact_id()::text
      and q->>'id'=b.source_metadata->>'questionId' and q->>'objectId'=b.item_id::text
      and q->>'itemType'=target_type and q->'invalidated'='false'::jsonb
      and jsonb_array_length(q->'responses') between 1 and 9
      and r->>'id'=b.source_metadata->>'responseId' and r->'revision'=b.source_metadata->'responseRevision'
      and r->'revision'=to_jsonb(jsonb_array_length(q->'responses'))
      and r#>>'{answer,kind}'='RATING' and r#>'{answer,value}'=to_jsonb(b.rating)
      and c.command_hash ~ '^[0-9a-f]{32}$' and c.result->>'sessionId'=s.id::text
      and c.result->>'profileId'=target_profile::text and c.result->>'version'=s.version
      and c.result->>'status' not in('REMOVED','SOURCE_WITHDRAWN')
      and (c.result->>'acceptedAt')::timestamptz=(r->>'acceptedAt')::timestamptz
      and c.xmin::text<>pg_current_xact_id()::text
      and not p.invalidated and p.prediction_id is not null
      and p.captured_at<(r->>'acceptedAt')::timestamptz and p.xmin::text<>pg_current_xact_id()::text
      and b.imported_at=(r->>'acceptedAt')::timestamptz and b.source_occurred_at=b.imported_at
      and b.imported_at<now() and b.imported_at<=cutoff and isfinite(b.imported_at)
      and b.xmin::text<>pg_current_xact_id()::text
      -- The canonical ranker may use a weaker bootstrap fallback after a clear
      -- or unresolved native authority. Numeric labels must not resurrect it.
      and not exists(select 1 from resolved authority where authority.item_id=b.item_id and not authority.is_bootstrap
        and (authority.source_status<>'NATIVE_OTHER' or exists(select 1 from public.events e
          where e.id=authority.source_event_id and e.event_type='ITEM_HISTORY_CLEARED')))
      -- The canonical bootstrap tie-break is deterministic, not proof that two
      -- equally available conflicting sources are a verified own Taste label.
      and not exists(select 1 from private.profile_bootstrap_evidence other where other.profile_id=b.profile_id
        and other.actor_user_id=actor and other.item_id=b.item_id and other.id<>b.id and other.active
        and other.evidence_kind=b.evidence_kind and other.source_occurred_at is not distinct from b.source_occurred_at
        and other.imported_at=b.imported_at)
  ) select coalesce(jsonb_agg(value order by item_id),'[]') into result
    from (select * from native union all select * from taste) labels;
  if jsonb_array_length(result)>8192 or octet_length(result::text)>4194304 then
    raise exception 'Complete numeric label prefix exceeds budget' using errcode='54000';end if;
  return result;
end;$$;
revoke all on function private.personal_rating_training_sources_v2(uuid,text,timestamptz)
  from public,anon,authenticated,service_role;

create table private.personal_rating_bootstrap_refs (
  forecast_id uuid not null references private.personal_rating_inputs(id) on delete cascade,
  bootstrap_id uuid not null references private.profile_bootstrap_evidence(id) on delete cascade,
  primary key(forecast_id,bootstrap_id)
);
create index personal_rating_bootstrap_source_idx on private.personal_rating_bootstrap_refs(bootstrap_id);
create table private.personal_rating_taste_lineage_refs (
  forecast_id uuid not null references private.personal_rating_inputs(id) on delete cascade,
  bootstrap_id uuid not null references private.profile_bootstrap_evidence(id) on delete cascade,
  session_id uuid not null references private.sequential_taste_sessions(id) on delete cascade,
  command_id uuid not null,
  panel_id uuid not null references private.sequential_taste_panels(id) on delete cascade,
  foreign key(session_id,command_id) references private.sequential_taste_commands(session_id,request_id) on delete cascade,
  primary key(forecast_id,bootstrap_id)
);
create index personal_rating_taste_session_idx on private.personal_rating_taste_lineage_refs(session_id,command_id);
create index personal_rating_taste_panel_idx on private.personal_rating_taste_lineage_refs(panel_id);
create index personal_rating_taste_bootstrap_idx on private.personal_rating_taste_lineage_refs(bootstrap_id);
alter table private.personal_rating_bootstrap_refs enable row level security;
alter table private.personal_rating_taste_lineage_refs enable row level security;
revoke all on private.personal_rating_bootstrap_refs,private.personal_rating_taste_lineage_refs from public,anon,authenticated,service_role;
create trigger personal_rating_bootstrap_ref_immutable before update or delete on private.personal_rating_bootstrap_refs
  for each row execute function private.guard_personal_rating_content_artifact_v1();
create trigger personal_rating_taste_ref_immutable before update or delete on private.personal_rating_taste_lineage_refs
  for each row execute function private.guard_personal_rating_content_artifact_v1();

-- Row writers already own relation locks. Do not acquire the lifecycle gate here;
-- preparation fences these relations with NOWAIT before reading any new source.
create function private.withdraw_personal_rating_training_source_v2()
returns trigger language plpgsql security definer set search_path='' as $$
declare forecast_ids uuid[];
begin
  if tg_level<>'ROW' or not (
    tg_when='BEFORE' and tg_op in('UPDATE','DELETE') and tg_relid in(
      'private.profile_bootstrap_evidence'::regclass,'private.profile_import_jobs'::regclass,
      'private.sequential_taste_sessions'::regclass,'private.sequential_taste_commands'::regclass,
      'private.sequential_taste_panels'::regclass,'public.items'::regclass)
    or tg_when='AFTER' and tg_op='INSERT' and tg_relid='public.events'::regclass) then
    raise exception 'Numeric training withdrawal relation denied' using errcode='42501';end if;
  if tg_op='UPDATE' and new is not distinct from old then return new;end if;
  if tg_relid='private.profile_bootstrap_evidence'::regclass then
    select array_agg(r.forecast_id) into forecast_ids from private.personal_rating_bootstrap_refs r where r.bootstrap_id=old.id;
  elsif tg_relid='private.profile_import_jobs'::regclass then
    if tg_op='UPDATE' and row(new.id,new.actor_user_id,new.profile_id,new.source_provider,new.dataset_kind,new.file_fingerprint,new.status,new.committed_at)
      is not distinct from row(old.id,old.actor_user_id,old.profile_id,old.source_provider,old.dataset_kind,old.file_fingerprint,old.status,old.committed_at)
      then return new;end if;
    select array_agg(distinct r.forecast_id) into forecast_ids from private.personal_rating_bootstrap_refs r
      join private.profile_bootstrap_evidence b on b.id=r.bootstrap_id where b.source_job_id=old.id;
  elsif tg_relid='private.sequential_taste_commands'::regclass then
    select array_agg(r.forecast_id) into forecast_ids from private.personal_rating_taste_lineage_refs r
      where r.session_id=old.session_id and r.command_id=old.request_id;
  elsif tg_relid='private.sequential_taste_panels'::regclass then
    select array_agg(r.forecast_id) into forecast_ids from private.personal_rating_taste_lineage_refs r where r.panel_id=old.id;
  elsif tg_relid='private.sequential_taste_sessions'::regclass then
    if tg_op='DELETE' then
      select array_agg(distinct r.forecast_id) into forecast_ids from private.personal_rating_taste_lineage_refs r where r.session_id=old.id;
    else
      -- NEXT, pause and later independent answers do not alter retained labels.
      -- Compare only the current response of each actually referenced question.
      select array_agg(distinct r.forecast_id) into forecast_ids from private.personal_rating_taste_lineage_refs r
        join private.personal_rating_inputs i on i.id=r.forecast_id
        cross join lateral jsonb_array_elements(i.preparation#>'{input,labels}') label
        where r.session_id=old.id and label#>>'{bootstrap,id}'=r.bootstrap_id::text
          and (row(new.id,new.profile_id,new.actor_user_id,new.source_job_id,new.version)
            is distinct from row(old.id,old.profile_id,old.actor_user_id,old.source_job_id,old.version)
            or new.status='REMOVED' or not exists(select 1 from jsonb_array_elements(new.presentations) q
              where q->>'id'=label#>>'{bootstrap,questionId}' and q->>'objectId'=label->>'itemId'
                and q->>'itemType'=label#>>'{bootstrap,itemType}' and q->'invalidated'='false'::jsonb
                and q#>>'{responses,-1,id}'=label#>>'{bootstrap,responseId}'
                and q#>'{responses,-1,revision}'=label#>'{bootstrap,responseRevision}'
                and q#>>'{responses,-1,answer,kind}'='RATING'
                and q#>'{responses,-1,answer,value}'=label#>'{bootstrap,rating}'));
    end if;
  elsif tg_relid='public.items'::regclass then
    select array_agg(distinct r.forecast_id) into forecast_ids from private.personal_rating_bootstrap_refs r
      join private.profile_bootstrap_evidence b on b.id=r.bootstrap_id where b.item_id=old.id;
  else
    if new.event_type not in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_HISTORY_CLEARED','ITEM_INTEREST_CLEARED','ITEM_INTERACTION_UNDONE')
      then return new;end if;
    select array_agg(i.id) into forecast_ids from private.personal_rating_inputs i
      join private.personal_rating_allocations a on a.id=i.id
      where a.actor_user_id=new.actor_user_id and a.profile_id=new.profile_id
        and i.preparation->>'version'='kajo-personal-content-rating-preparation-v2'
        and (exists(select 1 from jsonb_array_elements(i.preparation#>'{input,labels}') label where label->>'itemId'=new.item_id::text)
          or exists(select 1 from private.personal_rating_bootstrap_refs r join private.profile_bootstrap_evidence b on b.id=r.bootstrap_id
            where r.forecast_id=i.id and b.item_id=new.item_id));
  end if;
  if coalesce(cardinality(forecast_ids),0)>0 then
    if current_setting('transaction_isolation')<>'read committed' then
      raise exception 'Numeric training withdrawal requires READ COMMITTED' using errcode='25001';end if;
    select array_agg(distinct id) into forecast_ids from unnest(forecast_ids) id;
    perform private.check_personal_rating_content_withdrawal_budget_v1(forecast_ids);
    delete from private.personal_rating_inputs where id=any(forecast_ids);
  end if;
  if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger personal_rating_bootstrap_withdrawal before update or delete on private.profile_bootstrap_evidence
  for each row execute function private.withdraw_personal_rating_training_source_v2();
create trigger personal_rating_import_withdrawal before update or delete on private.profile_import_jobs
  for each row execute function private.withdraw_personal_rating_training_source_v2();
create trigger personal_rating_taste_session_withdrawal before update or delete on private.sequential_taste_sessions
  for each row execute function private.withdraw_personal_rating_training_source_v2();
create trigger personal_rating_taste_command_withdrawal before update or delete on private.sequential_taste_commands
  for each row execute function private.withdraw_personal_rating_training_source_v2();
create trigger personal_rating_taste_panel_withdrawal before update or delete on private.sequential_taste_panels
  for each row execute function private.withdraw_personal_rating_training_source_v2();
create trigger personal_rating_training_item_withdrawal before update or delete on public.items
  for each row execute function private.withdraw_personal_rating_training_source_v2();
create trigger personal_rating_training_event_withdrawal after insert on public.events
  for each row execute function private.withdraw_personal_rating_training_source_v2();
revoke all on function private.withdraw_personal_rating_training_source_v2() from public,anon,authenticated,service_role;

create function private.prepare_personal_rating_forecast_v3(
  forecast_id uuid,source_id uuid,target_item_id uuid,horizon_seconds integer,evidence_origin text default 'observed',feature_use jsonb default null
) returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
  actor uuid:=private.lock_personal_rating_transaction_v1();source private.prediction_runs%rowtype;
  allocation private.personal_rating_allocations%rowtype;receipt private.prediction_page_receipts%rowtype;
  request jsonb;input jsonb;prepared jsonb;stored jsonb;cutoff timestamptz;horizon timestamptz;
  pool_ids uuid[];event_ids uuid[];digest text;domain text;
begin
  if forecast_id is null or source_id is null or target_item_id is null or horizon_seconds is null
    or horizon_seconds not between 1 and 7776000 or evidence_origin is null or evidence_origin not in('observed','synthetic') then
    raise exception 'Invalid numeric preparation request' using errcode='22023';end if;
  select * into source from private.prediction_runs where id=source_id;
  if source.id is null or source.actor_user_id<>actor or source.requested_item_type is null or source.requested_item_type not in('BOOK','MOVIE')
    or not exists(select 1 from public.profiles p where p.id=source.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor) then
    raise exception 'Numeric Personal source access denied' using errcode='42501';end if;
  perform p.id from public.profiles p where p.id=source.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor for update;
  if not found then raise exception 'Numeric Personal owner changed' using errcode='42501';end if;
  perform r.id from private.prediction_runs r where r.id=source_id for key share;
  if not found then raise exception 'Numeric source disappeared' using errcode='42501';end if;
  request:=jsonb_build_object('sourcePredictionId',source_id,'targetItemId',target_item_id,
    'horizonSeconds',horizon_seconds,'evidenceOrigin',evidence_origin,'version','personal-owned-content-rating-v2','featureUse',feature_use);
  select * into allocation from private.personal_rating_allocations where id=forecast_id;
  if found then
    if allocation.actor_user_id<>actor or allocation.request_hash<>md5(request::text) then
      raise exception 'Numeric forecast ID already has different intent' using errcode='22023';end if;
    select i.preparation,f.forecast into prepared,stored from private.personal_rating_inputs i
      left join private.personal_rating_forecasts f on f.id=i.id where i.id=forecast_id;
    if prepared is null then raise exception 'Numeric source was withdrawn; forecast ID cannot be reused' using errcode='55000';end if;
    if prepared->>'version' is distinct from 'kajo-personal-content-rating-preparation-v2' then
      raise exception 'Numeric preparation generation mismatch' using errcode='22023';end if;
    return prepared||jsonb_build_object('forecast',stored);
  end if;
  if exists(select 1 from private.personal_rating_allocations a where a.source_prediction_id=source_id)
    or (select count(*) from private.personal_rating_allocations a where a.actor_user_id=actor and a.profile_id=source.profile_id)>=128 then
    raise exception 'Numeric source already allocated or owner budget exceeded' using errcode='54000';end if;
  if exists(select 1 from private.personal_rating_inputs i join private.personal_rating_allocations a on a.id=i.id
    where i.target_item_id=prepare_personal_rating_forecast_v3.target_item_id
      and a.actor_user_id=actor and a.profile_id=source.profile_id) then
    raise exception 'Numeric target already has a retained evaluation opportunity' using errcode='55000';end if;
  if source.requested_at<clock_timestamp()-interval '15 minutes' or source.requested_at>=now() or source.session_id is null then
    raise exception 'Numeric evaluation needs a fresh committed source with session' using errcode='55000';end if;
  perform s.id from public.event_sessions s where s.id=source.session_id and s.actor_user_id=actor and s.profile_id=source.profile_id for key share;
  if not found then raise exception 'Numeric source session unavailable' using errcode='42501';end if;
  select * into receipt from private.prediction_page_receipts where prediction_id=source_id;
  if receipt.prediction_id is null or receipt.actor_user_id<>actor or receipt.profile_id<>source.profile_id
    or receipt.response->>'predictionId' is distinct from source_id::text
    or receipt.request->>'sessionId' is distinct from source.session_id::text
    or jsonb_typeof(receipt.response->'items') is distinct from 'array' then
    raise exception 'Numeric evaluation requires an actual Personal page receipt' using errcode='55000';end if;
  select array_agg(c.item_id order by c.final_rank,c.item_id) into pool_ids from private.prediction_candidates c
    where c.prediction_id=source_id and c.selected_for_delivery;
  if coalesce(cardinality(pool_ids),0) not between 1 and 50 or not target_item_id=any(pool_ids)
    or jsonb_array_length(receipt.response->'items')<>cardinality(pool_ids)
    or exists(select 1 from private.prediction_candidates c where c.prediction_id=source_id and c.selected_for_delivery
      and not exists(select 1 from jsonb_array_elements(receipt.response->'items') x where x->>'item_id'=c.item_id::text
        and (x->>'rank')::integer=c.final_rank))
    or exists(select 1 from private.prediction_candidates c where c.prediction_id=source_id and c.item_id=target_item_id
      and (private.prediction_delivery_tier_v1(c.explanation->'resurfacingPolicy')>=2
        or not coalesce((c.explanation#>>'{resurfacingPolicy,eligible}')::boolean,false))) then
    raise exception 'Numeric target requires a bounded actual eligible delivered pool' using errcode='22023';end if;
  if private.personal_rating_target_has_report_v1(source.profile_id,target_item_id) then
    raise exception 'Numeric target already has answer or terminal history' using errcode='55000';end if;
  -- Bound the entire owned Event inventory, including future timestamps, before
  -- taking catalogue fences. Event SHARE already excludes new dependency rows.
  select coalesce(array_agg(e.id),'{}'::uuid[]) into event_ids from (
    select e.id from public.events e where e.actor_user_id=actor and e.profile_id=source.profile_id limit 8193
  ) e;
  if cardinality(event_ids)>8192 then raise exception 'Complete numeric lock dependency prefix exceeds budget' using errcode='54000';end if;
  -- Never wait for catalogue writers while owning the numeric lifecycle lock:
  -- raw Item DELETE takes its relation lock before a lifecycle statement trigger,
  -- and multi-Item catalogue batches revisit Items after writing sources. Either
  -- can cycle with a waiting capture. NOWAIT fails 55P03 and the dedicated worker
  -- rolls back the whole attempt; retry only after the writer commits. Capture-
  -- first writers wait behind these relation fences through TS finalization.
  lock table private.profile_bootstrap_evidence,private.profile_import_jobs,
    private.sequential_taste_sessions,private.sequential_taste_commands,private.sequential_taste_panels in share mode nowait;
  if exists(select 1 from private.profile_bootstrap_evidence b where b.actor_user_id=actor and b.profile_id=source.profile_id
      and b.imported_at<=clock_timestamp() and (b.xmin::text=pg_current_xact_id()::text or b.imported_at>=now()))
    or exists(select 1 from private.sequential_taste_sessions s where s.actor_user_id=actor and s.profile_id=source.profile_id
      and (s.xmin::text=pg_current_xact_id()::text or s.receipt_at>=now())) then
    raise exception 'Commit Taste source evidence before numeric capture' using errcode='25001';end if;
  lock table public.items in share mode nowait;
  lock table private.item_sources in share mode nowait;
  lock table private.item_external_ids in share mode nowait;
  cutoff:=clock_timestamp();horizon:=cutoff+make_interval(secs=>horizon_seconds);domain:=source.requested_item_type;
  perform private.validate_personal_rating_feature_use_v1(feature_use,evidence_origin,
    (extract(epoch from cutoff)*1000000)::bigint::text,(extract(epoch from horizon)*1000000)::bigint::text);
  if feature_use is not null and exists(select 1 from private.personal_rating_content_review_revocations r
    where r.actor_user_id=actor and r.review_ref=feature_use->>'reviewRef') then
    raise exception 'Content feature-use review was withdrawn' using errcode='55000';end if;
  select coalesce(array_agg(e.id order by e.id),'{}'::uuid[]) into event_ids from (
    select e.id from public.events e where e.actor_user_id=actor and e.profile_id=source.profile_id
      and isfinite(e.created_at) and e.created_at<=cutoff and isfinite(e.occurred_at) and e.occurred_at<=cutoff limit 8193
  ) e;
  if cardinality(event_ids)>8192 then raise exception 'Complete numeric dependency prefix exceeds budget' using errcode='54000';end if;
  if exists(select 1 from public.events e where e.id=any(event_ids)
    and (e.xmin::text=pg_current_xact_id()::text or e.created_at>=now())) then
    raise exception 'Commit source evidence before preparing numeric forecast' using errcode='25001';end if;
  if (select count(*) from public.items i where i.id=any(pool_ids) and i.item_type=domain and i.discoverable
      and isfinite(i.created_at) and i.created_at<=cutoff)<>cardinality(pool_ids) then
    raise exception 'Numeric delivered Item snapshot unavailable' using errcode='55000';end if;
  with labels as (
    select value from jsonb_array_elements(private.personal_rating_training_sources_v2(source.profile_id,domain,cutoff))
  ), pool as (
    select jsonb_build_object('id',i.id,'itemType',i.item_type,'discoverable',i.discoverable,
      'availableAtMicros',(extract(epoch from i.created_at)*1000000)::bigint::text) value,n
    from unnest(pool_ids) with ordinality requested(id,n) join public.items i on i.id=requested.id
  ) select jsonb_build_object('version','kajo-personal-content-rating-prefix-v2','captureScope','PRIVATE_NATIVE_EVALUATION',
    'evidenceOrigin',evidence_origin,'forecastId',forecast_id,'sourcePredictionId',source_id,'targetItemId',target_item_id,'complete',true,
    'profile',jsonb_build_object('id',source.profile_id,'type','PERSONAL','ownerUserId',actor),
    'actorUserId',actor,'itemType',domain,'cutoffMicros',(extract(epoch from cutoff)*1000000)::bigint::text,
    'source',jsonb_build_object('signature','private.personal_source_evidence_v1(uuid,timestamp with time zone)',
      'bodyMd5',(select md5(prosrc) from pg_proc where oid='private.personal_source_evidence_v1(uuid,timestamptz)'::regprocedure)),
    'trainingSource',jsonb_build_object('signature','private.personal_rating_training_sources_v2(uuid,text,timestamp with time zone)',
      'bodyMd5',(select md5(prosrc) from pg_proc where oid='private.personal_rating_training_sources_v2(uuid,text,timestamptz)'::regprocedure)),
    'labels',(select coalesce(jsonb_agg(value order by value->>'itemId'),'[]') from labels),
    'candidatePool',jsonb_build_object('kind','FROZEN_DELIVERED_PERSONAL_POOL','sourcePredictionId',source_id,
      'cutoffMicros',(extract(epoch from cutoff)*1000000)::bigint::text,
      'items',(select jsonb_agg(value order by n) from pool))) into input;
  input:=input||jsonb_build_object('contentFeatures',private.capture_personal_rating_content_v1(input,feature_use));
  digest:='native-owned-content:'||md5(input::text);
  input:=input||jsonb_build_object('snapshotId',digest,'candidatePool',input->'candidatePool'||jsonb_build_object('snapshotId',digest),
    'contentFeatures',input->'contentFeatures'||jsonb_build_object('snapshotId',digest));
  prepared:=jsonb_build_object('version','kajo-personal-content-rating-preparation-v2','forecastId',forecast_id,'sourcePredictionId',source_id,
    'targetItemId',target_item_id,'itemType',domain,'cutoffMicros',input->'cutoffMicros',
    'horizonEndMicros',(extract(epoch from horizon)*1000000)::bigint::text,'requestHash',md5(request::text),'input',input,
    'config',jsonb_build_object('version','personal-native-location-v1','shrinkage',2),
    'contentConfig',jsonb_build_object('version','personal-native-content-ridge-v1','ridge',2),'forecast',null,
    'cohort','FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN','selection','ONE_PREDECLARED_TARGET_FROM_COMPLETE_DELIVERED_POOL',
    'qualityAdmission','NONE','servingActivation','NONE');
  insert into private.personal_rating_allocations(id,source_prediction_id,actor_user_id,profile_id,request_hash)
    values(forecast_id,source_id,actor,source.profile_id,md5(request::text));
  set constraints private.personal_rating_commit_guard deferred;
  insert into private.personal_rating_inputs(id,target_item_id,prepared_transaction,prepared_at,horizon_end,preparation)
    values(forecast_id,target_item_id,pg_current_xact_id(),cutoff,horizon,prepared);
  insert into private.personal_rating_event_refs(forecast_id,event_id) select forecast_id,unnest(event_ids);
  insert into private.personal_rating_bootstrap_refs(forecast_id,bootstrap_id)
    select forecast_id,b.id from private.profile_bootstrap_evidence b
      where b.profile_id=source.profile_id and b.actor_user_id=actor and b.item_type=domain;
  insert into private.personal_rating_taste_lineage_refs(forecast_id,bootstrap_id,session_id,command_id,panel_id)
    select forecast_id,(l->>'sourceBootstrapId')::uuid,(l#>>'{bootstrap,sessionId}')::uuid,
      (l#>>'{bootstrap,responseId}')::uuid,(l#>>'{bootstrap,panelId}')::uuid
      from jsonb_array_elements(input->'labels') l where l->>'sourceStatus'='OWNED_TASTE_RATING';
  insert into private.personal_rating_content_source_refs(forecast_id,source_id)
    select forecast_id,(f->>'sourceId')::uuid from jsonb_array_elements(input#>'{contentFeatures,objects}') f
      where f->'provenance'<>'null'::jsonb;
  insert into private.personal_rating_content_alias_refs(forecast_id,namespace,external_id)
    select forecast_id,f#>>'{provenance,alias,namespace}',f#>>'{provenance,alias,externalId}'
      from jsonb_array_elements(input#>'{contentFeatures,objects}') f where f->'provenance'<>'null'::jsonb;
  return prepared;
end;$$;

create function private.finalize_personal_rating_forecast_v3(forecast_id uuid,forecast jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare actor uuid:=private.lock_personal_rating_transaction_v1();a private.personal_rating_allocations%rowtype;
  i private.personal_rating_inputs%rowtype;prior jsonb;input jsonb;ratings jsonb;pool jsonb;expected jsonb;
  support integer;point jsonb;control jsonb;candidate jsonb;
  content jsonb;fit jsonb;feature_version text;feature_support integer;varied_count integer:=0;varied boolean[]:='{}';
  dimension integer;has_variation boolean;feature_status text;rows jsonb:='[]';row_value jsonb;row_feature jsonb;
  diagnostic jsonb;raw_point jsonb;candidate_point jsonb;fallback text;supported integer;expected_fit jsonb;
begin
  select * into a from private.personal_rating_allocations where id=forecast_id;
  if a.id is null or a.actor_user_id<>actor then raise exception 'Numeric forecast access denied' using errcode='42501';end if;
  perform p.id from public.profiles p where p.id=a.profile_id and p.profile_type='PERSONAL' and p.owner_user_id=actor for update;
  if not found then raise exception 'Numeric owner changed' using errcode='42501';end if;
  select * into i from private.personal_rating_inputs where id=forecast_id;
  if i.id is null then raise exception 'Numeric source was withdrawn' using errcode='55000';end if;
  if i.preparation->>'version' is distinct from 'kajo-personal-content-rating-preparation-v2' then
    raise exception 'Numeric preparation generation mismatch' using errcode='22023';end if;
  select f.forecast into prior from private.personal_rating_forecasts f where f.id=forecast_id;
  if found then
    if prior is distinct from forecast then raise exception 'Finalized numeric forecast differs' using errcode='22023';end if;
    return i.preparation||jsonb_build_object('forecast',prior);
  end if;
  if i.prepared_transaction<>pg_current_xact_id() then
    raise exception 'Finalize in the same dedicated input transaction' using errcode='25001';end if;
  input:=i.preparation->'input';support:=jsonb_array_length(input->'labels');point:=forecast#>'{location,personalMean}';
  if forecast is null or jsonb_typeof(forecast)<>'object' or point is null
    or (support=0 and point<>'null'::jsonb)
    or (support>0 and (jsonb_typeof(point)<>'number' or (point::text)::numeric not between 0 and 10)) then
    raise exception 'Invalid numeric forecast point' using errcode='22023';end if;
  select coalesce(jsonb_agg(case when l->>'sourceStatus'='OWNED_TASTE_RATING' then
    jsonb_build_object('sourceEventId','taste:'||(l->>'sourceBootstrapId')||':'||(l#>>'{bootstrap,responseId}'),
      'subjectId',l#>'{bootstrap,profileId}','domainId',l#>'{bootstrap,itemType}','objectId',l->'itemId',
      'value',l#>'{bootstrap,rating}','occurredAtMicros',l#>'{bootstrap,acceptedAtMicros}',
      'availableAtMicros',l#>'{bootstrap,availableAtMicros}') else
    jsonb_build_object('sourceEventId',l->'sourceEventId','subjectId',l#>'{event,profileId}',
      'domainId',l#>'{event,itemType}','objectId',l->'itemId','value',l#>'{event,rating}',
      'occurredAtMicros',l#>'{event,occurredAtMicros}','availableAtMicros',l#>'{event,availableAtMicros}') end order by l->>'itemId'),'[]')
    into ratings from jsonb_array_elements(input->'labels') l;
  select jsonb_agg(p->'id' order by n) into pool from jsonb_array_elements(input#>'{candidatePool,items}') with ordinality x(p,n);
  control:=jsonb_build_object('value',point,'status',case when support>0 then 'AVAILABLE' else 'UNAVAILABLE' end,
    'mode',case when support>0 then 'PERSONAL_MEAN' else 'NO_NUMERIC_SUPPORT' end,'prefixSupport',support);
  candidate:=control||jsonb_build_object('mode',case when support>0 then 'PERSONAL_MEAN_FALLBACK' else 'NO_NUMERIC_SUPPORT' end);
  feature_version:='catalog-concepts-v1:b4319f2554c8627b35f4d77428ff91a576e66ef7ab58fbb1d35f6f64d66f1642:catalog-assertion-presence-v1';
  expected:=jsonb_build_object('version','personal-content-rating-v1','targetVersion','personal-own-scale-post-experience-rating-v1',
    'capability',case when support>0 then 'NUMERIC_CONTENT_POINT_V1' else 'NUMERIC_POINT_UNAVAILABLE_V1' end,
    'calibration','UNCALIBRATED','qualityAdmission','NONE','servingActivation','NONE',
    'subjectId',input#>'{profile,id}','domainId',input->'itemType','cutoffMicros',input->'cutoffMicros',
    'prefix',jsonb_build_object('version','canonical-resolved-rating-prefix-v1','sourceId','kajo-owned-native-and-taste-ratings',
      'sourceVersion','owned-rating-source-v2:'||(input#>>'{trainingSource,bodyMd5}')||':'||(input#>>'{source,bodyMd5}')||':'||feature_version,'snapshotId',input->'snapshotId','support',support,
      'provenance',jsonb_build_object('origin',input->'evidenceOrigin','captureScope',input->'captureScope'),'ratings',ratings,
      'excluded',jsonb_build_object('foreignSubject',0,'foreignDomain',0,'future',0,'duplicate',0)),
    'candidatePool',jsonb_build_object('snapshotId',input->'snapshotId','cutoffMicros',input->'cutoffMicros','candidateIds',pool),
    'config',i.preparation->'config','prior',null,'priorDisposition','ABSENT','location',jsonb_build_object('personalMean',point,'residual',null),
    'identified',jsonb_build_object('personalLocation',support>0,'responseSpread',false),
    'forecasts',(select jsonb_agg(jsonb_build_object('objectId',p,'control',control,'candidate',candidate) order by n)
      from jsonb_array_elements(pool) with ordinality x(p,n)));
  content:=jsonb_build_object('version','personal-content-feature-snapshot-v1','snapshotId',input->'snapshotId',
    'cutoffMicros',input->'cutoffMicros','sourceVersion',feature_version,'featureIds',input#>'{contentFeatures,featureIds}',
    'objects',(select jsonb_agg(f-array['assertions','provenance'] order by f->>'objectId')
      from jsonb_array_elements(input#>'{contentFeatures,objects}') f));
  select count(*) into feature_support from jsonb_array_elements(input->'labels') l
    join jsonb_array_elements(content->'objects') f on f->>'objectId'=l->>'itemId' where f->>'status'='AVAILABLE';
  for dimension in 0..5 loop
    select count(distinct f->'values'->dimension)>1 into has_variation from jsonb_array_elements(input->'labels') l
      join jsonb_array_elements(content->'objects') f on f->>'objectId'=l->>'itemId' where f->>'status'='AVAILABLE';
    varied:=array_append(varied,has_variation);if has_variation then varied_count:=varied_count+1;end if;
  end loop;
  feature_status:=case when support=0 then 'NO_NUMERIC_SUPPORT' when feature_support<2 then 'INSUFFICIENT_FEATURE_SUPPORT'
    when (select count(distinct coalesce(l#>'{event,rating}',l#>'{bootstrap,rating}')) from jsonb_array_elements(input->'labels') l
      join jsonb_array_elements(content->'objects') f on f->>'objectId'=l->>'itemId' where f->>'status'='AVAILABLE')<=1
      then 'CONSTANT_FEATURED_RATINGS'
    when varied_count=0 then 'NO_TRAINING_FEATURE_VARIATION' else 'FITTED' end;
  fit:=forecast->'contentFit';
  if jsonb_typeof(fit) is distinct from 'object' or jsonb_typeof(fit->'coefficients') is distinct from 'array'
    or jsonb_typeof(fit->'featureMeans') is distinct from 'array' then
    raise exception 'Invalid native content fit shape' using errcode='22023';end if;
  if jsonb_array_length(fit->'coefficients')<>6 or jsonb_array_length(fit->'featureMeans')<>6
    or exists(select 1 from jsonb_array_elements(fit->'coefficients') x where jsonb_typeof(x)<>'number')
    or exists(select 1 from jsonb_array_elements(fit->'featureMeans') x where jsonb_typeof(x)<>'number') then
    raise exception 'Invalid native content fit dimensions' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(fit->'coefficients') x where abs((x::text)::numeric)>81920
      or (feature_status<>'FITTED' and (x::text)::numeric<>0))
    or exists(select 1 from jsonb_array_elements(fit->'featureMeans') x where (x::text)::numeric not between 0 and 1)
    or (support=0 and fit->'featureCoverage' is distinct from 'null'::jsonb)
    or (support>0 and (jsonb_typeof(fit->'featureCoverage') is distinct from 'number'
      or (fit->>'featureCoverage')::numeric not between 0 and 1)) then
    raise exception 'Invalid native content fit numerical bounds' using errcode='22023';end if;
  if support>0 and (fit->>'featureCoverage')::double precision is distinct from feature_support::double precision/support then
    raise exception 'Invalid native content coverage' using errcode='22023';end if;
  for dimension in 0..5 loop
    if (not varied[dimension+1] and (fit->'coefficients'->>dimension)::numeric<>0)
      or (feature_support=0 and (fit->'featureMeans'->>dimension)::numeric<>0) then
      raise exception 'Invalid unsupported native content fit dimension' using errcode='22023';end if;
  end loop;
  expected_fit:=jsonb_build_object('version','centered-fixed-mean-ridge-v1','status',feature_status,'numericSupport',support,
    'featureSupport',feature_support,'featureCoverage',fit->'featureCoverage','featureDimensions',6,'variedFeatureCount',varied_count,
    'featureMeans',fit->'featureMeans','coefficients',fit->'coefficients',
    'excluded',jsonb_build_object('unavailable',support-feature_support,'withdrawn',0,'future',0),
    'replayPolicy','REBUILD_FROM_COMPLETE_RESOLVED_PREFIX','parameterInterpretation','REGULARIZED_ASSOCIATION_NOT_LATENT_TASTE',
    'cost',jsonb_build_object('trainingRows',feature_support,'featureDimensions',6,'variedDimensions',varied_count,
      'centeredScalarProducts',case when feature_status='FITTED' then feature_support*varied_count*(varied_count+1)/2 else 0 end));
  if jsonb_typeof(forecast->'forecasts') is distinct from 'array' then
    raise exception 'Invalid native content forecast rows' using errcode='22023';end if;
  for row_value in select value from jsonb_array_elements(forecast->'forecasts') loop
    select f into row_feature from jsonb_array_elements(content->'objects') f where f->>'objectId'=row_value->>'objectId';
    if row_feature is null then raise exception 'Content forecast object is outside snapshot' using errcode='22023';end if;
    supported:=0;
    if row_feature->>'status'='AVAILABLE' then
      for dimension in 0..5 loop
        if varied[dimension+1] and row_feature->'values'->dimension<>'0'::jsonb then supported:=supported+1;end if;
      end loop;
    end if;
    fallback:=case when feature_status<>'FITTED' then feature_status
      when row_feature->>'status'='UNAVAILABLE' then 'FEATURE_UNAVAILABLE'
      when supported=0 then 'NO_SUPPORTED_CONTENT_FEATURE' else 'NONE' end;
    raw_point:=row_value#>'{contentDiagnostic,rawValue}';candidate_point:=row_value#>'{candidate,value}';
    if fallback<>'NONE' then
      if raw_point is distinct from point or candidate_point is distinct from point then
        raise exception 'Content fallback must preserve all-label personal mean' using errcode='22023';end if;
    else
      if jsonb_typeof(raw_point) is distinct from 'number' or jsonb_typeof(candidate_point) is distinct from 'number' then
        raise exception 'Content fitted point must be numeric' using errcode='22023';end if;
      if abs((raw_point::text)::numeric)>1000000 or (candidate_point::text)::numeric not between 0 and 10
        or (candidate_point::text)::numeric<>greatest(0,least(10,(raw_point::text)::numeric)) then
        raise exception 'Content fitted point violates clipping contract' using errcode='22023';end if;
    end if;
    candidate:=control||jsonb_build_object('value',candidate_point,'mode',case when fallback='NONE' then 'CONTENT_RIDGE'
      when support>0 then 'PERSONAL_MEAN_FALLBACK' else 'NO_NUMERIC_SUPPORT' end);
    diagnostic:=jsonb_build_object('fallback',fallback,'rawValue',raw_point,'clipped',raw_point is distinct from candidate_point,
      'supportedFeatureCount',supported);
    rows:=rows||jsonb_build_array(jsonb_build_object('objectId',row_value->'objectId','control',control,
      'candidate',candidate,'contentDiagnostic',diagnostic));
  end loop;
  if (select coalesce(jsonb_agg(x->'objectId' order by n),'[]') from jsonb_array_elements(rows) with ordinality r(x,n)) is distinct from pool then
    raise exception 'Content forecast candidate order differs from frozen pool' using errcode='22023';end if;
  expected:=expected||jsonb_build_object('content',content,'contentConfig',i.preparation->'contentConfig','contentFit',expected_fit,'forecasts',rows);
  if forecast is distinct from expected then raise exception 'Numeric forecast differs from native input binding' using errcode='22023';end if;
  insert into private.personal_rating_forecasts(id,forecast) values(forecast_id,forecast);
  return i.preparation||jsonb_build_object('forecast',forecast);
end;$$;


revoke all on function private.prepare_personal_rating_forecast_v3(uuid,uuid,uuid,integer,text,jsonb),
  private.finalize_personal_rating_forecast_v3(uuid,jsonb) from public,anon,authenticated,service_role;

-- Existing generations retain every calculation, byte and retry. Only the shared
-- complete dependent-row budgets learn about the new closed reference tables.
do $owned_taste_budgets$
declare signature text;expected text;before_text text;after_text text;original text;definition text;
begin
  for signature,expected,before_text,after_text in values
    ('private.check_personal_rating_content_withdrawal_budget_v1(uuid[])','c758162ff683be41252b1df75061431d',
     '    union all select 1 from private.personal_rating_event_refs r where r.forecast_id=any(forecast_ids)',
     E'    union all select 1 from private.personal_rating_event_refs r where r.forecast_id=any(forecast_ids)\n    union all select 1 from private.personal_rating_bootstrap_refs r where r.forecast_id=any(forecast_ids)\n    union all select 1 from private.personal_rating_taste_lineage_refs r where r.forecast_id=any(forecast_ids)'),
    ('private.erase_prediction_sources_v1(text,uuid)','0301656179b0b91106ac427daed62705',
     '    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)',
     E'    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)\n    union all select 1 from private.personal_rating_bootstrap_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)\n    union all select 1 from private.personal_rating_taste_lineage_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)')
  loop
    select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc where oid=signature::regprocedure;
    if md5(original)<>expected or cardinality(string_to_array(original,before_text))<>2 then
      raise exception 'Owned Taste numeric predecessor drift: %',signature using errcode='55000';end if;
    execute replace(definition,original,replace(original,before_text,after_text));
  end loop;
end;$owned_taste_budgets$;
