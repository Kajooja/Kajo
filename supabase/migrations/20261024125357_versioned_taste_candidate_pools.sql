-- New sessions refresh a bounded recognition pool at each committed NEXT.
-- Old policies, START catalogs, panels, first measurements and replies are frozen.
alter table private.sequential_taste_sessions drop constraint sequential_taste_sessions_policy_check;
alter table private.sequential_taste_sessions add constraint sequential_taste_sessions_policy_check
  check(policy in('ADAPTIVE','PRIOR_ONLY','CANONICAL_FORECAST_V3','CANONICAL_FORECAST_POOL_V4'));
alter table private.sequential_taste_sessions alter column policy set default 'CANONICAL_FORECAST_POOL_V4';

create table private.sequential_taste_candidate_pools_v4 (
  panel_id uuid primary key references private.sequential_taste_panels(id) on delete cascade,
  session_id uuid not null references private.sequential_taste_sessions(id) on delete cascade,
  catalog_as_of timestamptz not null check(isfinite(catalog_as_of)),
  catalog jsonb not null check(jsonb_typeof(catalog)='array' and jsonb_array_length(catalog)<=50 and octet_length(catalog::text)<=262144),
  invalidated boolean not null default false,
  check(not invalidated or catalog='[]'::jsonb)
);
create index sequential_taste_candidate_pools_session_v4 on private.sequential_taste_candidate_pools_v4(session_id);
alter table private.sequential_taste_candidate_pools_v4 enable row level security;
revoke all on table private.sequential_taste_candidate_pools_v4 from public,anon,authenticated,service_role;

-- All prior opportunities/labels and neutral suppression are excluded BEFORE
-- the 128/domain recognition source bound. This is not full-catalog coverage.
create function private.taste_candidate_catalog_v4(target_session uuid,cutoff timestamptz)
returns jsonb language sql stable set search_path='' as $$
  with session as materialized (
    select * from private.sequential_taste_sessions where id=target_session and policy='CANONICAL_FORECAST_POOL_V4'
      and status='ACTIVE' and actor_user_id=auth.uid()
  ), eligible as materialized (
    select i.id,i.item_type,i.title,i.tags,
      private.catalog_cold_start_prior_v1(i.id,cutoff) prior,
      (coalesce(i.metadata->>'coldStartRecognition','') ~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$'
        or coalesce(i.metadata->>'voteCount','') ~ '^[0-9]+$') has_recognition,
      array(select distinct src.provider_key from private.item_sources src where src.item_id=i.id
        and src.provider_key<>'kajo_mock' and isfinite(src.created_at) and src.created_at<=cutoff
        order by src.provider_key limit 16) providers
    from session s cross join public.items i
    where i.item_type in('BOOK','MOVIE') and i.discoverable and isfinite(i.created_at) and i.created_at<=cutoff
      and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'
        and isfinite(src.created_at) and src.created_at<=cutoff)
      and not exists(select 1 from jsonb_array_elements(s.presentations) q where q->>'objectId'=i.id::text)
      and not exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=s.profile_id and b.item_id=i.id)
      and not exists(select 1 from public.events e where e.profile_id=s.profile_id and e.item_id=i.id
        and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED','ITEM_SAVED'))
      and not exists(select 1 from public.item_interactions a where a.profile_id=s.profile_id and a.item_id=i.id)
      and (private.contextual_skip_decision_v1(s.profile_id,i.id,cutoff,true)->>'eligible')::boolean
  ), bounded as materialized (
    select * from (select e.*,row_number() over(partition by item_type
      order by (prior->>'recognition')::double precision desc,id) n from eligible e) ranked where n<=128
  ), dimensions as (
    select tag from (select distinct id,tag from bounded b,lateral unnest(b.tags) tag
      where length(tag) between 1 and 256 and tag !~ '[[:cntrl:]]') tags
    group by tag order by count(*) desc,tag collate "C" limit 64
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'itemType',item_type,'title',left(title,512),
    'providerKeys',providers,'availableAt',floor(extract(epoch from cutoff)*1000)::bigint,
    'tags',array(select distinct tag from unnest(b.tags) tag where tag in(select tag from dimensions) order by tag),
    'rawTags',to_jsonb(b.tags),
    'recognitionPrior',case when has_recognition then (prior->>'recognition')::double precision else null end,
    'priorBasis',case when not has_recognition then 'UNAVAILABLE'
      when prior->>'source'='KAJO_CURATED_RECOGNITION' then 'CURATED_RECOGNITION' else 'PROVIDER_CATALOG' end)
    order by id),'[]') from bounded b where n<=25;
$$;

create function private.sequential_taste_question_catalog_v4(target_session uuid,target_question uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb;
begin
  select pool.catalog into result from private.sequential_taste_sessions s
    cross join lateral jsonb_array_elements(s.presentations) q
    join private.sequential_taste_panels panel on panel.id=(q->>'poolId')::uuid and panel.session_id=s.id
    join private.sequential_taste_candidate_pools_v4 pool on pool.panel_id=panel.id and pool.session_id=s.id
    where s.id=target_session and q->>'id'=target_question::text and s.status<>'REMOVED'
      and not pool.invalidated and not panel.invalidated and panel.prediction_id is not null
      and not (q->>'invalidated')::boolean;
  if result is null or result='[]'::jsonb then raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;
  return result;
end;$$;

create function private.assert_sequential_taste_pool_live_v4(target_session uuid,target_question uuid)
returns void language plpgsql volatile set search_path='' as $$
declare catalog jsonb;
begin
  catalog:=private.sequential_taste_question_catalog_v4(target_session,target_question);
  perform 1 from public.items where id in(select (c->>'id')::uuid from jsonb_array_elements(catalog) c) order by id for share;
  if exists(select 1 from jsonb_array_elements(catalog) c where not exists(select 1 from public.items i
    where i.id=(c->>'id')::uuid and i.discoverable and i.item_type=c->>'itemType' and to_jsonb(i.tags)=c->'rawTags'
      and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then
    raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;
end;$$;

create function private.guard_sequential_taste_candidate_pool_v4() returns trigger
language plpgsql set search_path='' as $$
declare p private.sequential_taste_panels;
begin
  select * into strict p from private.sequential_taste_panels where id=new.panel_id;
  if tg_op='INSERT' then
    if new.session_id<>p.session_id or new.catalog_as_of<>p.captured_at or new.invalidated or p.invalidated
      or p.prediction_id is null or jsonb_array_length(new.catalog) not between 1 and 50
      or (select policy from private.sequential_taste_sessions where id=new.session_id)<>'CANONICAL_FORECAST_POOL_V4'
      or (select array_agg(c->>'id' order by c->>'id') from jsonb_array_elements(new.catalog) c)
        is distinct from (select array_agg(c->>'itemId' order by c->>'itemId') from jsonb_array_elements(p.frozen->'items') c)
      or exists(select 1 from jsonb_array_elements(new.catalog) c group by c->>'itemType' having count(*)>25) then
      raise exception 'Invalid Taste candidate pool binding' using errcode='55000';end if;
  else
    if new.panel_id<>old.panel_id or new.session_id<>old.session_id or new.catalog_as_of<>old.catalog_as_of
      or (old.invalidated and not new.invalidated) then raise exception 'Taste candidate pool identity is immutable' using errcode='55000';end if;
    if p.invalidated or p.prediction_id is null then new.invalidated:=true;new.catalog:='[]';
    elsif new.catalog<>old.catalog or new.invalidated<>old.invalidated then
      raise exception 'Taste candidate pool is immutable' using errcode='55000';end if;
  end if;
  return new;
end;$$;
create trigger guard_sequential_taste_candidate_pool_v4 before insert or update on private.sequential_taste_candidate_pools_v4
for each row execute function private.guard_sequential_taste_candidate_pool_v4();

create function private.redact_sequential_taste_candidate_pool_v4() returns trigger
language plpgsql set search_path='' as $$
begin
  update private.sequential_taste_candidate_pools_v4 set invalidated=true,catalog='[]' where panel_id=new.id and not invalidated;
  return new;
end;$$;
create trigger redact_sequential_taste_candidate_pool_v4 after update on private.sequential_taste_panels
for each row when(new.invalidated or new.prediction_id is null)
execute function private.redact_sequential_taste_candidate_pool_v4();

revoke all on function private.taste_candidate_catalog_v4(uuid,timestamptz),
  private.sequential_taste_question_catalog_v4(uuid,uuid),private.assert_sequential_taste_pool_live_v4(uuid,uuid),
  private.guard_sequential_taste_candidate_pool_v4(),private.redact_sequential_taste_candidate_pool_v4()
from public,anon,authenticated,service_role;

-- Exact source and metadata guards preserve every existing function identity,
-- owner, ACL and historical-policy behavior. Drift aborts the whole transaction.
do $candidate_pools$
declare patch jsonb;p record;body text;before_text text;after_text text;
begin
  for patch in select value from jsonb_array_elements($patches$[
  {
    "signature": "private.sequential_taste_snapshot_v2(uuid)",
    "md5": "b1801db537ee924af7debe68508578d4",
    "definer": false,
    "replacements": [
      [
        "if p is not null and jsonb_array_length(p->'responses')=0 and not (p->>'invalidated')::boolean then",
        "if p is not null and jsonb_array_length(p->'responses')=0 and not (p->>'invalidated')::boolean\n    and (s.policy<>'CANONICAL_FORECAST_POOL_V4' or s.status='ACTIVE') then"
      ],
      [
        "jsonb_array_elements(s.catalog) c where c->>'id'=p->>'objectId'",
        "jsonb_array_elements(case when s.policy='CANONICAL_FORECAST_POOL_V4' then private.sequential_taste_question_catalog_v4(s.id,(p->>'id')::uuid) else s.catalog end) c where c->>'id'=p->>'objectId'"
      ]
    ]
  },
  {
    "signature": "private.project_sequential_taste_evidence_v2(uuid,jsonb,jsonb)",
    "md5": "056a678f7ee9a70fb8741661e3339621",
    "definer": false,
    "replacements": [
      [
        "case when s.policy='CANONICAL_FORECAST_V3' then 'canonical-ordinal-v3' else 'sequential-taste-numeric-v2' end",
        "case when s.policy='CANONICAL_FORECAST_POOL_V4' then 'canonical-ordinal-pool-v4' when s.policy='CANONICAL_FORECAST_V3' then 'canonical-ordinal-v3' else 'sequential-taste-numeric-v2' end"
      ]
    ]
  },
  {
    "signature": "private.taste_session_v2(jsonb)",
    "md5": "e6bac50462c01a86ff5284abd6f96736",
    "definer": true,
    "replacements": [
      [
        "  if operation<>'REMOVE' and not(operation='CORRECT' and request#>>'{answer,kind}'='WITHDRAWN') then",
        "  if s.policy<>'CANONICAL_FORECAST_POOL_V4' and operation<>'REMOVE' and not(operation='CORRECT' and request#>>'{answer,kind}'='WITHDRAWN') then"
      ],
      [
        "  if operation='RESUME' then return private.sequential_taste_snapshot_v2(s.id);end if;",
        "  if operation='RESUME' then\n    if s.policy='CANONICAL_FORECAST_POOL_V4' and s.status in('ACTIVE','PAUSED') and s.presentations->-1 is not null\n      and jsonb_array_length(s.presentations#>'{-1,responses}')=0 and not (s.presentations#>>'{-1,invalidated}')::boolean then\n      begin\n        perform private.assert_sequential_taste_pool_live_v4(s.id,(s.presentations#>>'{-1,id}')::uuid);\n      exception when sqlstate 'KJ002' then\n        update private.sequential_taste_sessions set status='STOPPED',stop_reason='CATALOG_CHANGED_INSUFFICIENT' where id=s.id;\n      end;\n    end if;\n    return private.sequential_taste_snapshot_v2(s.id);\n  end if;"
      ],
      [
        "    return saved.result;",
        "    if s.policy='CANONICAL_FORECAST_POOL_V4' and saved.result->>'questionId' is not null then\n      perform private.assert_sequential_taste_pool_live_v4(s.id,(saved.result->>'questionId')::uuid);\n    end if;\n    return saved.result;"
      ],
      [
        "    select * into strict panel from private.sequential_taste_panels where id=(q->>'poolId')::uuid;",
        "    if s.policy='CANONICAL_FORECAST_POOL_V4' and answer->>'kind'<>'WITHDRAWN' then\n      perform private.assert_sequential_taste_pool_live_v4(s.id,(q->>'id')::uuid);\n    end if;\n    select * into strict panel from private.sequential_taste_panels where id=(q->>'poolId')::uuid;"
      ],
      [
        "  if operation='START' and exists(select 1 from private.sequential_taste_commands where session_id=s.id) then\n    return private.sequential_taste_snapshot_v2(s.id);",
        "  if operation='START' and exists(select 1 from private.sequential_taste_commands where session_id=s.id) then\n    if s.policy='CANONICAL_FORECAST_POOL_V4' and s.status in('ACTIVE','PAUSED') and s.presentations->-1 is not null\n      and jsonb_array_length(s.presentations#>'{-1,responses}')=0 and not (s.presentations#>>'{-1,invalidated}')::boolean then\n      begin\n        perform private.assert_sequential_taste_pool_live_v4(s.id,(s.presentations#>>'{-1,id}')::uuid);\n      exception when sqlstate 'KJ002' then\n        update private.sequential_taste_sessions set status='STOPPED',stop_reason='CATALOG_CHANGED_INSUFFICIENT' where id=s.id;\n      end;\n    end if;\n    return private.sequential_taste_snapshot_v2(s.id);"
      ],
      [
        "    update private.sequential_taste_sessions set status='ACTIVE',stop_reason=null where id=s.id;",
        "    if s.policy='CANONICAL_FORECAST_POOL_V4' and s.presentations->-1 is not null\n      and jsonb_array_length(s.presentations#>'{-1,responses}')=0 and not (s.presentations#>>'{-1,invalidated}')::boolean then\n      perform private.assert_sequential_taste_pool_live_v4(s.id,(s.presentations#>>'{-1,id}')::uuid);\n    end if;\n    update private.sequential_taste_sessions set status='ACTIVE',stop_reason=null where id=s.id;"
      ],
      [
        "    if jsonb_array_length(s.presentations)>=48 then\n      update private.sequential_taste_sessions set status='STOPPED',stop_reason='OPPORTUNITY_BUDGET_INSUFFICIENT' where id=s.id;\n    elsif jsonb_array_length(s.catalog)=0 then\n      update private.sequential_taste_sessions set status='STOPPED',stop_reason='CATALOG_EXHAUSTED_INSUFFICIENT' where id=s.id;\n    else\n      select array_agg((c->>'id')::uuid order by c->>'id') into ids from jsonb_array_elements(s.catalog) c;\n      perform 1 from public.items where id=any(ids) order by id for share;\n      if exists(select 1 from jsonb_array_elements(s.catalog) c where not exists(select 1 from public.items i\n        where i.id=(c->>'id')::uuid and i.discoverable and i.item_type=c->>'itemType' and to_jsonb(i.tags)=c->'rawTags'\n          and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then\n        update private.sequential_taste_sessions set status='STOPPED',stop_reason='CATALOG_CHANGED_INSUFFICIENT' where id=s.id;\n      else\n        select coalesce(jsonb_agg(jsonb_build_object('questionId',p->>'id','objectId',p->>'objectId',\n          'responseId',p#>>'{responses,-1,id}','revision',p#>'{responses,-1,revision}') order by n),'[]') into prefix\n          from jsonb_array_elements(s.presentations) with ordinality l(p,n)\n          where jsonb_array_length(p->'responses')>0 and not (p->>'invalidated')::boolean and p#>>'{responses,-1,answer,kind}' not in('WITHDRAWN','WITHDRAW_CONTEXTUAL_SKIP');\n        prediction:=gen_random_uuid();\n        frozen:=private.capture_personal_evaluation_v1(prediction,profile,ids,s.receipt_at,jsonb_build_object('sessionId',s.id));\n        select jsonb_set(frozen,'{items}',jsonb_agg(i||jsonb_build_object('labelSeen',\n          exists(select 1 from jsonb_array_elements(s.presentations) p where p->>'objectId'=i->>'itemId' and jsonb_array_length(p->'responses')>0)\n          or exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=(i->>'itemId')::uuid)\n          or exists(select 1 from public.events e where e.profile_id=profile and e.item_id=(i->>'itemId')::uuid\n            and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED'))) order by n)) into frozen\n          from jsonb_array_elements(frozen->'items') with ordinality l(i,n);\n        frozen:=frozen||jsonb_build_object('coverage','BOUNDED_CANONICAL_POOL','featurePolicyVersion','taste-tags-frequency-64-v2',\n          'requiredReceiptTransaction',s.receipt_transaction,'requiredReceiptRevision',s.revision);\n        insert into private.sequential_taste_panels(id,session_id,prediction_id,prefix_revision,prefix,frozen,captured_at,captured_transaction)\n          values(prediction,s.id,prediction,s.revision,prefix,frozen,now(),tx);\n        chosen:=case when s.policy='CANONICAL_FORECAST_V3' then private.select_sequential_taste_v3(s.catalog,s.presentations,frozen,s.policy) else private.select_sequential_taste_v2(s.catalog,s.presentations,frozen,s.policy) end;\n        if chosen is null then\n          update private.sequential_taste_sessions set status='STOPPED',stop_reason='NO_SUPPORTED_INFORMATION_INSUFFICIENT' where id=s.id;\n        else\n          q:=jsonb_build_object('id',command_id,'index',jsonb_array_length(s.presentations),'objectId',chosen#>>'{item,id}',\n            'itemType',chosen#>>'{item,itemType}','tags',chosen#>'{item,tags}','poolId',prediction,'presentedAt',at_time,\n            'selectionComponents',chosen->'components','invalidated',false,'responses','[]'::jsonb);\n          if s.policy='CANONICAL_FORECAST_V3' then q:=q||jsonb_build_object('selectionTrace',chosen->'trace');end if;\n          update private.sequential_taste_sessions set presentations=presentations||jsonb_build_array(q) where id=s.id;\n        end if;\n      end if;\n    end if;\n",
        "    catalog:=case when s.policy='CANONICAL_FORECAST_POOL_V4' and jsonb_array_length(s.presentations)<48 then private.taste_candidate_catalog_v4(s.id,now()) else s.catalog end;\n    if jsonb_array_length(s.presentations)>=48 then\n      update private.sequential_taste_sessions set status='STOPPED',stop_reason='OPPORTUNITY_BUDGET_INSUFFICIENT' where id=s.id;\n    elsif jsonb_array_length(catalog)=0 then\n      update private.sequential_taste_sessions set status='STOPPED',stop_reason=case when s.policy='CANONICAL_FORECAST_POOL_V4' then 'NO_SUPPORTED_INFORMATION_INSUFFICIENT' else 'CATALOG_EXHAUSTED_INSUFFICIENT' end where id=s.id;\n    else\n      select array_agg((c->>'id')::uuid order by c->>'id') into ids from jsonb_array_elements(catalog) c;\n      perform 1 from public.items where id=any(ids) order by id for share;\n      if exists(select 1 from jsonb_array_elements(catalog) c where not exists(select 1 from public.items i\n        where i.id=(c->>'id')::uuid and i.discoverable and i.item_type=c->>'itemType' and to_jsonb(i.tags)=c->'rawTags'\n          and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then\n        update private.sequential_taste_sessions set status='STOPPED',stop_reason='CATALOG_CHANGED_INSUFFICIENT' where id=s.id;\n      else\n        select coalesce(jsonb_agg(jsonb_build_object('questionId',p->>'id','objectId',p->>'objectId',\n          'responseId',p#>>'{responses,-1,id}','revision',p#>'{responses,-1,revision}') order by n),'[]') into prefix\n          from jsonb_array_elements(s.presentations) with ordinality l(p,n)\n          where jsonb_array_length(p->'responses')>0 and not (p->>'invalidated')::boolean and p#>>'{responses,-1,answer,kind}' not in('WITHDRAWN','WITHDRAW_CONTEXTUAL_SKIP');\n        prediction:=gen_random_uuid();\n        frozen:=private.capture_personal_evaluation_v1(prediction,profile,ids,s.receipt_at,jsonb_build_object('sessionId',s.id));\n        select jsonb_set(frozen,'{items}',jsonb_agg(i||jsonb_build_object('labelSeen',\n          exists(select 1 from jsonb_array_elements(s.presentations) p where p->>'objectId'=i->>'itemId' and jsonb_array_length(p->'responses')>0)\n          or exists(select 1 from private.profile_bootstrap_evidence b where b.profile_id=profile and b.item_id=(i->>'itemId')::uuid)\n          or exists(select 1 from public.events e where e.profile_id=profile and e.item_id=(i->>'itemId')::uuid\n            and e.event_type in('ITEM_RATED','ITEM_NOT_INTERESTED'))) order by n)) into frozen\n          from jsonb_array_elements(frozen->'items') with ordinality l(i,n);\n        frozen:=frozen||jsonb_build_object('coverage','BOUNDED_CANONICAL_POOL','featurePolicyVersion',case when s.policy='CANONICAL_FORECAST_POOL_V4' then 'taste-tags-frequency-64-pool-v4' else 'taste-tags-frequency-64-v2' end,\n          'requiredReceiptTransaction',s.receipt_transaction,'requiredReceiptRevision',s.revision);\n        if s.policy='CANONICAL_FORECAST_POOL_V4' then frozen:=frozen||jsonb_build_object('candidateCatalogAsOf',now());end if;\n        insert into private.sequential_taste_panels(id,session_id,prediction_id,prefix_revision,prefix,frozen,captured_at,captured_transaction)\n          values(prediction,s.id,prediction,s.revision,prefix,frozen,now(),tx);\n        if s.policy='CANONICAL_FORECAST_POOL_V4' then\n          insert into private.sequential_taste_candidate_pools_v4(panel_id,session_id,catalog_as_of,catalog)\n            values(prediction,s.id,now(),catalog);\n        end if;\n        chosen:=case when s.policy in('CANONICAL_FORECAST_V3','CANONICAL_FORECAST_POOL_V4') then private.select_sequential_taste_v3(catalog,s.presentations,frozen,s.policy) else private.select_sequential_taste_v2(catalog,s.presentations,frozen,s.policy) end;\n        if chosen is null then\n          update private.sequential_taste_sessions set status='STOPPED',stop_reason='NO_SUPPORTED_INFORMATION_INSUFFICIENT' where id=s.id;\n        else\n          q:=jsonb_build_object('id',command_id,'index',jsonb_array_length(s.presentations),'objectId',chosen#>>'{item,id}',\n            'itemType',chosen#>>'{item,itemType}','tags',chosen#>'{item,tags}','poolId',prediction,'presentedAt',at_time,\n            'selectionComponents',chosen->'components','invalidated',false,'responses','[]'::jsonb);\n          if s.policy in('CANONICAL_FORECAST_V3','CANONICAL_FORECAST_POOL_V4') then q:=q||jsonb_build_object('selectionTrace',chosen->'trace');end if;\n          update private.sequential_taste_sessions set presentations=presentations||jsonb_build_array(q) where id=s.id;\n        end if;\n      end if;\n    end if;\n"
      ]
    ]
  },
  {
    "signature": "private.commit_taste_contextual_skip_v1(jsonb)",
    "md5": "95286c7da1c019af3f1151cdbfe3a06b",
    "definer": true,
    "replacements": [
      [
        "  perform 1 from public.items where id in(select (c->>'id')::uuid from jsonb_array_elements(s.catalog) c) order by id for share;\n  if exists(select 1 from jsonb_array_elements(s.catalog) c where not exists(select 1 from public.items i\n    where i.id=(c->>'id')::uuid and i.discoverable and i.item_type=c->>'itemType' and to_jsonb(i.tags)=c->'rawTags'\n      and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then\n    raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;",
        "  if s.policy='CANONICAL_FORECAST_POOL_V4' then\n    perform private.assert_sequential_taste_pool_live_v4(s.id,(q->>'id')::uuid);\n  else\n  perform 1 from public.items where id in(select (c->>'id')::uuid from jsonb_array_elements(s.catalog) c) order by id for share;\n  if exists(select 1 from jsonb_array_elements(s.catalog) c where not exists(select 1 from public.items i\n    where i.id=(c->>'id')::uuid and i.discoverable and i.item_type=c->>'itemType' and to_jsonb(i.tags)=c->'rawTags'\n      and exists(select 1 from private.item_sources src where src.item_id=i.id and src.provider_key<>'kajo_mock'))) then\n    raise exception 'SOURCE_WITHDRAWN' using errcode='KJ002';end if;\n  end if;"
      ]
    ]
  }
]$patches$::jsonb) loop
    select proc.*,pg_get_functiondef(proc.oid) definition into strict p from pg_proc proc where proc.oid=(patch->>'signature')::regprocedure;
    if md5(p.prosrc)<>patch->>'md5' or p.proowner<>'postgres'::regrole
      or p.prosecdef is distinct from (patch->>'definer')::boolean
      or p.provolatile<>(case when patch->>'signature'='private.sequential_taste_snapshot_v2(uuid)' then 's' else 'v' end)
      or p.prolang<>(select oid from pg_language where lanname='plpgsql') or p.proleakproof or p.proisstrict or p.proparallel<>'u'
      or p.proconfig is distinct from array['search_path=""']::text[]
      or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from (patch->>'definer')::boolean
      or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
        where acl.grantor<>p.proowner or acl.grantee not in(p.proowner,
          case when (patch->>'definer')::boolean then 'authenticated'::regrole else p.proowner end)
          or (acl.grantee<>p.proowner and is_grantable)) then
      raise exception 'Taste candidate pool source/security drift: %',patch->>'signature';
    end if;
    body:=p.prosrc;
    for before_text,after_text in select value->>0,value->>1 from jsonb_array_elements(patch->'replacements') loop
      if (length(body)-length(replace(body,before_text,'')))/length(before_text)<>1 then
        raise exception 'Taste candidate pool replacement drift: %',patch->>'signature';end if;
      body:=replace(body,before_text,after_text);
    end loop;
    execute replace(p.definition,p.prosrc,body);
  end loop;
end;$candidate_pools$;
