-- Closed content-aware numeric evaluation. No public RPC, admitted data source,
-- serving activation or second implementation of the portable numeric model.
create table private.personal_rating_content_source_refs (
  forecast_id uuid not null references private.personal_rating_inputs(id) on delete cascade,
  source_id uuid not null references private.item_sources(id) on delete cascade,
  primary key(forecast_id,source_id)
);
create index personal_rating_content_source_idx on private.personal_rating_content_source_refs(source_id);
create table private.personal_rating_content_alias_refs (
  forecast_id uuid not null references private.personal_rating_inputs(id) on delete cascade,
  namespace text not null,external_id text not null,
  foreign key(namespace,external_id) references private.item_external_ids(namespace,external_id) on delete cascade,
  primary key(forecast_id,namespace,external_id)
);
create index personal_rating_content_alias_idx on private.personal_rating_content_alias_refs(namespace,external_id);
create table private.personal_rating_content_review_revocations (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  review_ref text not null check(char_length(review_ref) between 1 and 256),
  primary key(actor_user_id,review_ref)
);
alter table private.personal_rating_content_source_refs enable row level security;
alter table private.personal_rating_content_alias_refs enable row level security;
alter table private.personal_rating_content_review_revocations enable row level security;
revoke all on private.personal_rating_content_source_refs,private.personal_rating_content_alias_refs,
  private.personal_rating_content_review_revocations from public,anon,authenticated,service_role;

create function private.guard_personal_rating_content_artifact_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if tg_table_name='personal_rating_content_review_revocations' then
      if not exists(select 1 from auth.users u where u.id=old.actor_user_id) then return old;end if;
    elsif not exists(select 1 from private.personal_rating_inputs i where i.id=old.forecast_id) then return old;end if;
  end if;
  raise exception 'Content evaluation evidence is immutable; withdraw its source or review' using errcode='55000';
end;$$;
create trigger personal_rating_content_source_immutable before update or delete on private.personal_rating_content_source_refs
  for each row execute function private.guard_personal_rating_content_artifact_v1();
create trigger personal_rating_content_alias_immutable before update or delete on private.personal_rating_content_alias_refs
  for each row execute function private.guard_personal_rating_content_artifact_v1();
create trigger personal_rating_content_review_immutable before update or delete on private.personal_rating_content_review_revocations
  for each row execute function private.guard_personal_rating_content_artifact_v1();

-- Same complete dependent-row ceiling as native source erasure. Lock retained
-- parents before counting so a concurrent first answer cannot grow the closure.
create function private.check_personal_rating_content_withdrawal_budget_v1(forecast_ids uuid[])
returns void language plpgsql volatile security invoker set search_path='' as $$
declare dependents integer;
begin
  if coalesce(cardinality(forecast_ids),0)=0 then return;end if;
  if cardinality(forecast_ids)>250000 then
    raise exception 'Content source withdrawal exceeds complete dependency budget' using errcode='54000';end if;
  perform i.id from private.personal_rating_inputs i where i.id=any(forecast_ids) order by i.id for update;
  perform f.id from private.personal_rating_forecasts f where f.id=any(forecast_ids) order by f.id for update;
  select count(*) into dependents from (
    select 1 from private.personal_rating_inputs i where i.id=any(forecast_ids)
    union all select 1 from private.personal_rating_forecasts f where f.id=any(forecast_ids)
    union all select 1 from private.personal_rating_answers a where a.forecast_id=any(forecast_ids)
    union all select 1 from private.personal_rating_event_refs r where r.forecast_id=any(forecast_ids)
    union all select 1 from private.personal_rating_content_source_refs r where r.forecast_id=any(forecast_ids)
    union all select 1 from private.personal_rating_content_alias_refs r where r.forecast_id=any(forecast_ids)
    limit 250001) bounded;
  if dependents>250000 then
    raise exception 'Content source withdrawal exceeds complete dependency budget' using errcode='54000';end if;
end;$$;

-- Catalogue writers already take their table write lock. Never acquire the
-- numeric lifecycle lock from these row triggers (that would reverse order).
-- Existing catalogue service_role writers have no private evaluation grants.
-- This closed trigger alone crosses that boundary for source retirement; its
-- relation/op guard and OLD identity cannot grant general evidence access.
create function private.withdraw_personal_rating_content_source_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare forecast_ids uuid[];
begin
  if tg_relid not in('private.item_sources'::regclass,'private.item_external_ids'::regclass)
    or tg_when<>'BEFORE' or tg_level<>'ROW' or tg_op not in('UPDATE','DELETE') then
    raise exception 'Content withdrawal trigger relation denied' using errcode='42501';end if;
  if tg_table_name='item_sources' then
    if tg_op='UPDATE' and new.id=old.id and new.item_id=old.item_id and new.provider_key=old.provider_key
      and new.provider_item_id=old.provider_item_id
      and new.source_payload->'id' is not distinct from old.source_payload->'id'
      and new.source_payload->'key' is not distinct from old.source_payload->'key' then return new;end if;
    if exists(select 1 from private.personal_rating_content_source_refs r where r.source_id=old.id)
      and current_setting('transaction_isolation')<>'read committed' then
      raise exception 'Content source withdrawal requires READ COMMITTED' using errcode='25001';end if;
    select array_agg(r.forecast_id) into forecast_ids from (select forecast_id from private.personal_rating_content_source_refs
      where source_id=old.id limit 250001) r;
    perform private.check_personal_rating_content_withdrawal_budget_v1(forecast_ids);
    delete from private.personal_rating_inputs i where i.id=any(forecast_ids);
  else
    if tg_op='UPDATE' and new.namespace=old.namespace and new.external_id=old.external_id and new.item_id=old.item_id then return new;end if;
    if exists(select 1 from private.personal_rating_content_alias_refs r where r.namespace=old.namespace and r.external_id=old.external_id)
      and current_setting('transaction_isolation')<>'read committed' then
      raise exception 'Content alias withdrawal requires READ COMMITTED' using errcode='25001';end if;
    select array_agg(r.forecast_id) into forecast_ids from (select forecast_id from private.personal_rating_content_alias_refs
      where namespace=old.namespace and external_id=old.external_id limit 250001) r;
    perform private.check_personal_rating_content_withdrawal_budget_v1(forecast_ids);
    delete from private.personal_rating_inputs i where i.id=any(forecast_ids);
  end if;
  if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger personal_rating_content_source_withdrawal before update or delete on private.item_sources
  for each row execute function private.withdraw_personal_rating_content_source_v1();
create trigger personal_rating_content_alias_withdrawal before update or delete on private.item_external_ids
  for each row execute function private.withdraw_personal_rating_content_source_v1();

create function private.retire_personal_rating_content_review_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare forecast_ids uuid[];
begin
  select array_agg(i.id) into forecast_ids from private.personal_rating_inputs i join private.personal_rating_allocations a on a.id=i.id
    where a.actor_user_id=new.actor_user_id and i.preparation#>>'{input,contentFeatures,featureUse,reviewRef}'=new.review_ref;
  perform private.check_personal_rating_content_withdrawal_budget_v1(forecast_ids);
  delete from private.personal_rating_inputs i where i.id=any(forecast_ids);
  return new;
end;$$;
create trigger personal_rating_content_review_withdrawal after insert on private.personal_rating_content_review_revocations
  for each row execute function private.retire_personal_rating_content_review_v1();
create function private.withdraw_personal_rating_content_review_v1(review_ref text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare actor uuid:=private.lock_personal_rating_transaction_v1();retained integer;
begin
  if review_ref is null or char_length(review_ref) not between 1 and 256 then
    raise exception 'Content review identity required' using errcode='22023';end if;
  perform p.id from public.profiles p where p.owner_user_id=actor and p.profile_type='PERSONAL' order by p.id for update;
  select count(*) into retained from private.personal_rating_inputs i join private.personal_rating_allocations a on a.id=i.id
    where a.actor_user_id=actor and i.preparation#>>'{input,contentFeatures,featureUse,reviewRef}'=review_ref;
  if retained>128 then raise exception 'Content review withdrawal exceeds owner budget' using errcode='54000';end if;
  insert into private.personal_rating_content_review_revocations(actor_user_id,review_ref) values(actor,review_ref) on conflict do nothing;
  return jsonb_build_object('version','personal-content-review-withdrawal-v1','reviewRef',review_ref,'retired',retained);
end;$$;

-- An operator assertion with an explicit review reference, never an inferred
-- license/certificate. The interval authorizes new capture plus answer horizon;
-- SOURCE_BOUND_UNTIL_WITHDRAWAL separately declares retained-copy permission.
create function private.validate_personal_rating_feature_use_v1(feature_use jsonb,evidence_origin text,cutoff_micros text,horizon_micros text)
returns void language plpgsql security invoker set search_path='' as $$
declare entry jsonb;
begin
  if feature_use is null or feature_use='null'::jsonb then return;end if;
  if jsonb_typeof(feature_use) is distinct from 'object' or octet_length(feature_use::text)>4096
    or (select array_agg(k order by k) from jsonb_object_keys(feature_use) k)
      is distinct from array['origin','purpose','retention','reviewRef','sources','validFromMicros','validUntilMicros','version']::text[]
    or feature_use->>'version' is distinct from 'personal-content-feature-use-v1'
    or feature_use->>'purpose' is distinct from 'PRIVATE_NATIVE_EVALUATION'
    or feature_use->>'origin' is distinct from evidence_origin
    or feature_use->>'retention' is distinct from 'SOURCE_BOUND_UNTIL_WITHDRAWAL'
    or jsonb_typeof(feature_use->'reviewRef') is distinct from 'string' or char_length(feature_use->>'reviewRef') not between 1 and 256
    or jsonb_typeof(feature_use->'validFromMicros') is distinct from 'string'
    or jsonb_typeof(feature_use->'validUntilMicros') is distinct from 'string'
    or coalesce(feature_use->>'validFromMicros','')!~'^(0|[1-9][0-9]{0,17})$'
    or coalesce(feature_use->>'validUntilMicros','')!~'^(0|[1-9][0-9]{0,17})$'
    or jsonb_typeof(feature_use->'sources') is distinct from 'array' then
    raise exception 'Invalid explicit content feature-use manifest' using errcode='22023';end if;
  if (feature_use->>'validFromMicros')::numeric>cutoff_micros::numeric
    or (feature_use->>'validUntilMicros')::numeric<horizon_micros::numeric
    or (feature_use->>'validUntilMicros')::numeric>253402300799999999
    or jsonb_array_length(feature_use->'sources')>2 then
    raise exception 'Content feature-use interval or source budget invalid' using errcode='22023';end if;
  for entry in select value from jsonb_array_elements(feature_use->'sources') loop
    if jsonb_typeof(entry) is distinct from 'object'
      or (select array_agg(k order by k) from jsonb_object_keys(entry) k) is distinct from array['disposition','evidenceKind','providerKey']::text[]
      or entry->>'disposition' is distinct from 'PERMITTED'
      or ((entry->>'providerKey'='tmdb' and entry->>'evidenceKind'='provider-genre')
        or (entry->>'providerKey'='open_library' and entry->>'evidenceKind'='provider-subject')) is not true then
      raise exception 'Invalid explicit content feature-use source' using errcode='22023';end if;
  end loop;
  if (select count(distinct value->>'providerKey') from jsonb_array_elements(feature_use->'sources'))<>jsonb_array_length(feature_use->'sources') then
    raise exception 'Duplicate content feature-use source' using errcode='22023';end if;
end;$$;

-- Frozen exact copy of the single catalog-concepts-v1 registry. The native
-- regression compares this JSON to scripts/catalog/item-features.mjs.
create function private.personal_rating_content_mapping_v1()
returns jsonb language sql immutable security invoker set search_path='' as $registry$
  select $mapping${"concepts":["fantasy","horror","mystery","romance","science-fiction","thriller"],"documentation":["https://developer.themoviedb.org/reference/genre-movie-list","https://openlibrary.org/dev/docs/api/search","https://openlibrary.org/dev/docs/api/subjects","https://openlibrary.org/subjects/science_fiction","https://openlibrary.org/subjects/fantasy_fiction","https://openlibrary.org/subjects/mystery_fiction","https://openlibrary.org/subjects/romance_fiction","https://openlibrary.org/subjects/horror_fiction","https://openlibrary.org/subjects/fiction%2C_thrillers"],"labelNormalization":"trim-collapse-whitespace-lowercase-v1","openLibrarySubjects":{"detective and mystery fiction":"mystery","detective and mystery stories":"mystery","fantasy":"fantasy","fantasy fiction":"fantasy","fiction / horror":"horror","fiction / science fiction / general":"science-fiction","fiction / thrillers":"thriller","fiction / thrillers / general":"thriller","fiction, fantasy, general":"fantasy","fiction, horror":"horror","fiction, mystery & detective, general":"mystery","fiction, romance, general":"romance","fiction, science fiction, general":"science-fiction","fiction, thrillers":"thriller","fiction, thrillers, general":"thriller","horror":"horror","horror fiction":"horror","horror stories":"horror","horror tales":"horror","love stories":"romance","mystery":"mystery","mystery and detective stories":"mystery","mystery fiction":"mystery","romance":"romance","romance fiction":"romance","science fiction":"science-fiction","thriller":"thriller","thrillers":"thriller"},"reviewedAt":"2026-09-24","tmdbGenreIds":{"10749":"romance","14":"fantasy","27":"horror","53":"thriller","878":"science-fiction","9648":"mystery"},"version":"catalog-concepts-v1"}$mapping$::jsonb;
$registry$;

create function private.capture_personal_rating_content_v1(input jsonb,feature_use jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare registry jsonb:=private.personal_rating_content_mapping_v1();objects jsonb:='[]';row_value jsonb;
  object_id uuid;domain text:=input->>'itemType';cutoff timestamptz:=to_timestamp((input->>'cutoffMicros')::numeric/1000000);
  source private.item_sources%rowtype;provider text;kind text;chosen_namespace text;field text;payload jsonb;labels jsonb;
  assertions jsonb;vector jsonb;asserted text[];concept text;label jsonb;valid boolean;feature_ids jsonb;
begin
  provider:=case domain when 'MOVIE' then 'tmdb' else 'open_library' end;
  kind:=case domain when 'MOVIE' then 'provider-genre' else 'provider-subject' end;
  select jsonb_agg(kind||':'||value order by n) into feature_ids
    from jsonb_array_elements_text(registry->'concepts') with ordinality x(value,n);
  for object_id in select id from (
    select (l->>'itemId')::uuid id from jsonb_array_elements(input->'labels') l
    union select (p->>'id')::uuid from jsonb_array_elements(input#>'{candidatePool,items}') p
  ) inventory order by id loop
    row_value:=jsonb_build_object('objectId',object_id,'domainId',domain,'sourceId','unavailable:'||object_id,
      'availableAtMicros',input->'cutoffMicros','status','UNAVAILABLE','assertions',null,'values',null,'provenance',null);
    if feature_use is null or feature_use='null'::jsonb or not exists(select 1 from jsonb_array_elements(feature_use->'sources') a
      where a->>'providerKey'=provider and a->>'evidenceKind'=kind and a->>'disposition'='PERMITTED') then
      objects:=objects||jsonb_build_array(row_value);continue;end if;
    select s.* into source from private.item_sources s join public.items i on i.id=s.item_id
      where s.item_id=object_id and i.item_type=domain and s.provider_key=provider
        and (select count(*) from private.item_sources other where other.item_id=object_id and other.provider_key=provider)=1;
    if not found then objects:=objects||jsonb_build_array(row_value);continue;end if;
    chosen_namespace:=case when provider='tmdb' then 'tmdb_movie'
      when source.provider_item_id~'^OL[0-9]+W$' then 'open_library_work'
      when source.provider_item_id~'^OL[0-9]+M$' then 'open_library_edition' else null end;
    if char_length(source.provider_item_id)>512 or chosen_namespace is null or (provider='tmdb' and (source.provider_item_id!~'^[0-9]+$'
        or source.source_payload->>'id' is distinct from source.provider_item_id))
      or (provider='open_library' and source.source_payload->>'key' is distinct from
        (case chosen_namespace when 'open_library_work' then '/works/' else '/books/' end)||source.provider_item_id)
      or (select count(*) from private.item_external_ids a where a.item_id=object_id and a.namespace=chosen_namespace)<>1
      or not exists(select 1 from private.item_external_ids a where a.item_id=object_id
        and a.namespace=chosen_namespace and a.external_id=source.provider_item_id
        and isfinite(a.created_at) and a.created_at<=cutoff and a.xmin::text<>pg_current_xact_id()::text)
      or not isfinite(source.created_at) or source.created_at>cutoff or not isfinite(source.updated_at) or source.updated_at>cutoff
      or not isfinite(source.synced_at) or source.synced_at>cutoff
      or extract(epoch from source.created_at)<0 or extract(epoch from source.updated_at)<0 or extract(epoch from source.synced_at)<0
      or (source.source_updated_at is not null and (not isfinite(source.source_updated_at)
        or extract(epoch from source.source_updated_at)*1000000 not between 0 and 253402300799999999))
      or (source.source_url is not null and (char_length(source.source_url)>2048 or source.source_url!~'^https?://'))
      or (source.source_hash is not null and char_length(source.source_hash) not between 1 and 512)
      or exists(select 1 from private.item_sources s where s.id=source.id and s.xmin::text=pg_current_xact_id()::text) then
      objects:=objects||jsonb_build_array(row_value);continue;end if;
    field:=case chosen_namespace when 'tmdb_movie' then 'genres' when 'open_library_work' then 'subject' else 'subjects' end;
    labels:=source.source_payload->field;
    if jsonb_typeof(labels) is distinct from 'array' then objects:=objects||jsonb_build_array(row_value);continue;end if;
    if jsonb_array_length(labels)>128 then objects:=objects||jsonb_build_array(row_value);continue;end if;
    valid:=true;asserted:='{}';payload:='[]';
    for label in select value from jsonb_array_elements(labels) loop
      if provider='tmdb' then
        if jsonb_typeof(label) is distinct from 'object' or jsonb_typeof(label->'id') is distinct from 'number' then valid:=false;exit;end if;
        if (label->>'id')::numeric not between 1 and 9007199254740991
          or trunc((label->>'id')::numeric)<>(label->>'id')::numeric then valid:=false;exit;end if;
        concept:=registry#>>array['tmdbGenreIds',((label->>'id')::bigint)::text];
        payload:=payload||jsonb_build_array(jsonb_build_object('id',(label->>'id')::bigint));
      else
        if jsonb_typeof(label) is distinct from 'string' or char_length(label#>>'{}') not between 1 and 256 then valid:=false;exit;end if;
        -- JS trim + whitespace collapse set, then ASCII case folding: all
        -- reviewed exact registry keys are ASCII, with no fuzzy/transliteration.
        concept:=registry#>>array['openLibrarySubjects',translate(btrim(regexp_replace(label#>>'{}',
          U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',' ','g')),
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')];
        payload:=payload||jsonb_build_array(label);
      end if;
      if concept is not null then asserted:=array_append(asserted,concept);end if;
    end loop;
    if not valid then objects:=objects||jsonb_build_array(row_value);continue;end if;
    payload:=jsonb_build_object(field,payload);
    select jsonb_agg(case when value=any(asserted) then 1 else null end order by n),
      jsonb_agg(case when value=any(asserted) then 1 else 0 end order by n) into assertions,vector
      from jsonb_array_elements_text(registry->'concepts') with ordinality x(value,n);
    row_value:=row_value||jsonb_build_object('sourceId',source.id,'assertions',assertions,
      'status',case when cardinality(asserted)>0 then 'AVAILABLE' else 'UNAVAILABLE' end,
      'values',case when cardinality(asserted)>0 then vector else null end,
      'provenance',jsonb_build_object('providerKey',provider,'providerItemId',source.provider_item_id,
        'sourceUrl',source.source_url,'sourceHash',source.source_hash,
        'sourceUpdatedAtMicros',case when source.source_updated_at is not null then (extract(epoch from source.source_updated_at)*1000000)::bigint::text else null end,
        'rowUpdatedAtMicros',(extract(epoch from source.updated_at)*1000000)::bigint::text,
        'syncedAtMicros',(extract(epoch from source.synced_at)*1000000)::bigint::text,
        'alias',jsonb_build_object('namespace',chosen_namespace,'externalId',source.provider_item_id),
        'evidenceKind',kind,'projectionHash',md5(payload::text),'featurePayload',payload));
    objects:=objects||jsonb_build_array(row_value);
  end loop;
  return jsonb_build_object('version','kajo-personal-content-features-v1','cutoffMicros',input->'cutoffMicros',
    'mappingVersion','catalog-concepts-v1','mappingHash','b4319f2554c8627b35f4d77428ff91a576e66ef7ab58fbb1d35f6f64d66f1642',
    'transformVersion','catalog-assertion-presence-v1','semantics','ASSERTION_PRESENCE','featureUse',feature_use,
    'featureIds',feature_ids,'objects',objects);
end;$$;

create function private.prepare_personal_rating_forecast_v2(
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
    'horizonSeconds',horizon_seconds,'evidenceOrigin',evidence_origin,'version','personal-content-rating-v1','featureUse',feature_use);
  select * into allocation from private.personal_rating_allocations where id=forecast_id;
  if found then
    if allocation.actor_user_id<>actor or allocation.request_hash<>md5(request::text) then
      raise exception 'Numeric forecast ID already has different intent' using errcode='22023';end if;
    select i.preparation,f.forecast into prepared,stored from private.personal_rating_inputs i
      left join private.personal_rating_forecasts f on f.id=i.id where i.id=forecast_id;
    if prepared is null then raise exception 'Numeric source was withdrawn; forecast ID cannot be reused' using errcode='55000';end if;
    if prepared->>'version' is distinct from 'kajo-personal-content-rating-preparation-v1' then
      raise exception 'Numeric preparation generation mismatch' using errcode='22023';end if;
    return prepared||jsonb_build_object('forecast',stored);
  end if;
  if exists(select 1 from private.personal_rating_allocations a where a.source_prediction_id=source_id)
    or (select count(*) from private.personal_rating_allocations a where a.actor_user_id=actor and a.profile_id=source.profile_id)>=128 then
    raise exception 'Numeric source already allocated or owner budget exceeded' using errcode='54000';end if;
  if exists(select 1 from private.personal_rating_inputs i join private.personal_rating_allocations a on a.id=i.id
    where i.target_item_id=prepare_personal_rating_forecast_v2.target_item_id
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
  with resolved as materialized(select * from private.personal_source_evidence_v1(source.profile_id,cutoff)
    where source_status='NATIVE_RATING' and not is_bootstrap), labels as (
    select jsonb_build_object('itemId',r.item_id,'sourceEventId',r.source_event_id,'sourceStatus',r.source_status,
      'orderingBasis',r.ordering_basis,'event',jsonb_build_object('id',e.id,'actorUserId',e.actor_user_id,
        'profileId',e.profile_id,'itemId',e.item_id,'itemType',e.item_type,'eventType',e.event_type,'rating',e.properties->'rating',
        'occurredAtMicros',(extract(epoch from e.occurred_at)*1000000)::bigint::text,
        'availableAtMicros',(extract(epoch from e.created_at)*1000000)::bigint::text)) value
    from resolved r join public.events e on e.id=r.source_event_id where e.item_type=domain
  ), pool as (
    select jsonb_build_object('id',i.id,'itemType',i.item_type,'discoverable',i.discoverable,
      'availableAtMicros',(extract(epoch from i.created_at)*1000000)::bigint::text) value,n
    from unnest(pool_ids) with ordinality requested(id,n) join public.items i on i.id=requested.id
  ) select jsonb_build_object('version','kajo-personal-content-rating-prefix-v1','captureScope','PRIVATE_NATIVE_EVALUATION',
    'evidenceOrigin',evidence_origin,'forecastId',forecast_id,'sourcePredictionId',source_id,'targetItemId',target_item_id,'complete',true,
    'profile',jsonb_build_object('id',source.profile_id,'type','PERSONAL','ownerUserId',actor),
    'actorUserId',actor,'itemType',domain,'cutoffMicros',(extract(epoch from cutoff)*1000000)::bigint::text,
    'source',jsonb_build_object('signature','private.personal_source_evidence_v1(uuid,timestamp with time zone)',
      'bodyMd5',(select md5(prosrc) from pg_proc where oid='private.personal_source_evidence_v1(uuid,timestamptz)'::regprocedure)),
    'labels',(select coalesce(jsonb_agg(value order by value->>'itemId'),'[]') from labels),
    'candidatePool',jsonb_build_object('kind','FROZEN_DELIVERED_PERSONAL_POOL','sourcePredictionId',source_id,
      'cutoffMicros',(extract(epoch from cutoff)*1000000)::bigint::text,
      'items',(select jsonb_agg(value order by n) from pool))) into input;
  input:=input||jsonb_build_object('contentFeatures',private.capture_personal_rating_content_v1(input,feature_use));
  digest:='native-content-prospective:'||md5(input::text);
  input:=input||jsonb_build_object('snapshotId',digest,'candidatePool',input->'candidatePool'||jsonb_build_object('snapshotId',digest),
    'contentFeatures',input->'contentFeatures'||jsonb_build_object('snapshotId',digest));
  prepared:=jsonb_build_object('version','kajo-personal-content-rating-preparation-v1','forecastId',forecast_id,'sourcePredictionId',source_id,
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
  insert into private.personal_rating_content_source_refs(forecast_id,source_id)
    select forecast_id,(f->>'sourceId')::uuid from jsonb_array_elements(input#>'{contentFeatures,objects}') f
      where f->'provenance'<>'null'::jsonb;
  insert into private.personal_rating_content_alias_refs(forecast_id,namespace,external_id)
    select forecast_id,f#>>'{provenance,alias,namespace}',f#>>'{provenance,alias,externalId}'
      from jsonb_array_elements(input#>'{contentFeatures,objects}') f where f->'provenance'<>'null'::jsonb;
  return prepared;
end;$$;

create function private.finalize_personal_rating_forecast_v2(forecast_id uuid,forecast jsonb)
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
  if i.preparation->>'version' is distinct from 'kajo-personal-content-rating-preparation-v1' then
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
  select coalesce(jsonb_agg(jsonb_build_object('sourceEventId',l->'sourceEventId','subjectId',l#>'{event,profileId}',
      'domainId',l#>'{event,itemType}','objectId',l->'itemId','value',l#>'{event,rating}',
      'occurredAtMicros',l#>'{event,occurredAtMicros}','availableAtMicros',l#>'{event,availableAtMicros}') order by l->>'itemId'),'[]')
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
    'prefix',jsonb_build_object('version','canonical-resolved-rating-prefix-v1','sourceId','kajo-canonical-native-rating-events',
      'sourceVersion','personal-content-source-v1:'||(input#>>'{source,bodyMd5}')||':'||feature_version,'snapshotId',input->'snapshotId','support',support,
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
    when (select count(distinct l#>'{event,rating}') from jsonb_array_elements(input->'labels') l
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

-- Only explicit generation guards and the complete dependent-row erasure budget
-- change existing bodies. Old identities, attributes, ACLs and retained payloads
-- remain intact; V1 source calculations and first-answer semantics stay V1.
do $content_predecessors$
declare patch jsonb;original text;definition text;
begin
  for patch in select value from jsonb_array_elements($patches$[{"signature":"private.prepare_personal_rating_forecast_v1(uuid,uuid,uuid,integer,text)","sourceMd5":"25446e05b218298a957f283bdc666c57","before":"    return prepared||jsonb_build_object('forecast',stored);","after":"    if prepared->>'version' is distinct from 'kajo-personal-rating-preparation-v1' then\n      raise exception 'Numeric preparation generation mismatch' using errcode='22023';end if;\n    return prepared||jsonb_build_object('forecast',stored);"},{"signature":"private.finalize_personal_rating_forecast_v1(uuid,jsonb)","sourceMd5":"a9296700aaf6353e6d652849a1bf2412","before":"  select f.forecast into prior from private.personal_rating_forecasts f where f.id=forecast_id;","after":"  if i.preparation->>'version' is distinct from 'kajo-personal-rating-preparation-v1' then\n    raise exception 'Numeric preparation generation mismatch' using errcode='22023';end if;\n  select f.forecast into prior from private.personal_rating_forecasts f where f.id=forecast_id;"},{"signature":"private.erase_prediction_sources_v1(text,uuid)","sourceMd5":"9c8f602da5c13bb870f693b2e21eea3c","before":"    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)","after":"    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)\n    union all select 1 from private.personal_rating_content_source_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)\n    union all select 1 from private.personal_rating_content_alias_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)"}]$patches$::jsonb) loop
    select prosrc,pg_get_functiondef(oid) into strict original,definition from pg_proc where oid=(patch->>'signature')::regprocedure;
    if md5(original) is distinct from patch->>'sourceMd5'
      or cardinality(string_to_array(original,patch->>'before'))<>2 then
      raise exception 'Content evaluation predecessor drift: %',patch->>'signature' using errcode='55000';end if;
    execute replace(definition,original,replace(original,patch->>'before',patch->>'after'));
  end loop;
end;$content_predecessors$;

revoke all on function private.guard_personal_rating_content_artifact_v1(),private.withdraw_personal_rating_content_source_v1(),
  private.retire_personal_rating_content_review_v1(),private.withdraw_personal_rating_content_review_v1(text),
  private.check_personal_rating_content_withdrawal_budget_v1(uuid[]),
  private.validate_personal_rating_feature_use_v1(jsonb,text,text,text),private.personal_rating_content_mapping_v1(),
  private.capture_personal_rating_content_v1(jsonb,jsonb),
  private.prepare_personal_rating_forecast_v2(uuid,uuid,uuid,integer,text,jsonb),private.finalize_personal_rating_forecast_v2(uuid,jsonb)
  from public,anon,authenticated,service_role;
