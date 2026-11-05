-- Complete ordinal pairs grow quadratically. A 48-opportunity session can have
-- 1,128 pairs; 32 KiB rejected legitimate ANSWER receipts before that limit.
-- Retain every pair and every old reply; the new finite limit is 512 KiB.
do $taste_recovery_preflight$
declare p record; c record;
begin
  if current_user<>'postgres' or exists(select 1 from pg_proc where pronamespace='private'::regnamespace
    and proname='select_movie_first_taste_v1') then
    raise exception 'Taste recovery owner or target collision';end if;
  select * into strict p from pg_proc where oid='private.taste_session_v2(jsonb)'::regprocedure;
  if md5(p.prosrc)<>'61e695602b8941031afe240f864fc413' or p.proowner<>'postgres'::regrole
    or not p.prosecdef or p.provolatile<>'v' or p.prolang<>(select oid from pg_language where lanname='plpgsql')
    or p.proleakproof or p.proisstrict or p.proparallel<>'u'
    or p.proconfig is distinct from array['search_path=""']::text[]
    or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')
    or not has_function_privilege('authenticated',p.oid,'EXECUTE')
    or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantor<>p.proowner or a.is_grantable or a.grantee not in(p.proowner,'authenticated'::regrole)) then
    raise exception 'Taste recovery source/security drift';end if;
  select * into strict c from pg_constraint where conrelid='private.sequential_taste_commands'::regclass
    and conname='sequential_taste_commands_result_check';
  if c.contype<>'c' or not c.convalidated or c.connoinherit
    or pg_get_expr(c.conbin,c.conrelid)<>'(octet_length((result)::text) <= 32768)' then
    raise exception 'Taste recovery reply constraint drift';end if;
end;$taste_recovery_preflight$;

alter table private.sequential_taste_commands drop constraint sequential_taste_commands_result_check;
alter table private.sequential_taste_commands add constraint sequential_taste_commands_result_check
  check(octet_length(result::text)<=524288);

-- Version progression independently of the retained V4 candidate-pool policy.
-- Only a fresh NEXT uses this selector. Pending questions and exact old retries
-- retain their old selection/panel. Old interleaved BOOK exposures do not mark
-- the new BOOK phase as started; all prior opportunities still consume bounds.
create function private.select_movie_first_taste_v1(catalog jsonb,ledger jsonb,panel jsonb,control text)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare chosen jsonb; domain_catalog jsonb; movie_count integer; books_started boolean; reason text;
begin
  select count(*) filter(where p->>'itemType'='MOVIE'),
    coalesce(bool_or(p->>'itemType'='BOOK' and p#>>'{selectionTrace,domainProgression,version}'='movie-first-v1'),false)
    into movie_count,books_started from jsonb_array_elements(ledger) p;
  if not books_started and movie_count<24 then
    select coalesce(jsonb_agg(c order by n),'[]') into domain_catalog
      from jsonb_array_elements(catalog) with ordinality x(c,n) where c->>'itemType'='MOVIE';
    chosen:=private.select_sequential_taste_v3(domain_catalog,ledger,panel,control);
    if chosen is not null then
      return jsonb_set(chosen,'{trace}',chosen->'trace'||jsonb_build_object('domainProgression',jsonb_build_object(
        'version','movie-first-v1','phase','MOVIE','movieOpportunityLimit',24,'transitionReason',null)));
    end if;
  end if;
  reason:=case when books_started then 'BOOK_PHASE_CONTINUATION' when movie_count>=24
    then 'MOVIE_OPPORTUNITY_LIMIT' else 'MOVIE_SUPPORT_EXHAUSTED' end;
  select coalesce(jsonb_agg(c order by n),'[]') into domain_catalog
    from jsonb_array_elements(catalog) with ordinality x(c,n) where c->>'itemType'='BOOK';
  chosen:=private.select_sequential_taste_v3(domain_catalog,ledger,panel,control);
  if chosen is null then return null;end if;
  return jsonb_set(chosen,'{trace}',chosen->'trace'||jsonb_build_object('domainProgression',jsonb_build_object(
    'version','movie-first-v1','phase','BOOK','movieOpportunityLimit',24,'transitionReason',reason)));
end;$$;
revoke all on function private.select_movie_first_taste_v1(jsonb,jsonb,jsonb,text)
  from public,anon,authenticated,service_role;

do $taste_recovery_dispatch$
declare p record;
  before_text text:=$before$chosen:=case when s.policy in('CANONICAL_FORECAST_V3','CANONICAL_FORECAST_POOL_V4') then private.select_sequential_taste_v3(catalog,s.presentations,frozen,s.policy) else private.select_sequential_taste_v2(catalog,s.presentations,frozen,s.policy) end;$before$;
  after_text text:=$after$chosen:=case when s.policy='CANONICAL_FORECAST_POOL_V4' then private.select_movie_first_taste_v1(catalog,s.presentations,frozen,s.policy) when s.policy='CANONICAL_FORECAST_V3' then private.select_sequential_taste_v3(catalog,s.presentations,frozen,s.policy) else private.select_sequential_taste_v2(catalog,s.presentations,frozen,s.policy) end;$after$;
begin
  select pg_get_functiondef(oid) definition,prosrc into strict p from pg_proc where oid='private.taste_session_v2(jsonb)'::regprocedure;
  if (length(p.prosrc)-length(replace(p.prosrc,before_text,'')))/length(before_text)<>1 then
    raise exception 'Taste recovery dispatch drift';end if;
  execute replace(p.definition,p.prosrc,replace(p.prosrc,before_text,after_text));
end;$taste_recovery_dispatch$;

do $taste_recovery_helper_access$
declare p record;
begin
  select * into strict p from pg_proc where oid='private.select_movie_first_taste_v1(jsonb,jsonb,jsonb,text)'::regprocedure;
  if p.proowner<>'postgres'::regrole or p.prosecdef or p.provolatile<>'i'
    or p.proconfig is distinct from array['search_path=""']::text[]
    or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantor<>p.proowner or a.grantee<>p.proowner or a.is_grantable) then
    raise exception 'Taste recovery new-function access drift';end if;
end;$taste_recovery_helper_access$;
