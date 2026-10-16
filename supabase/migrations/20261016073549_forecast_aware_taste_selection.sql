-- New sessions consume the actual committed canonical forecast for question
-- selection. Existing ADAPTIVE/PRIOR_ONLY sessions keep their exact policy,
-- catalog, panels, first measurements and command replies. Wire protocol stays v2.
alter table private.sequential_taste_sessions drop constraint sequential_taste_sessions_policy_check;
alter table private.sequential_taste_sessions add constraint sequential_taste_sessions_policy_check
  check(policy in('ADAPTIVE','PRIOR_ONLY','CANONICAL_FORECAST_V3'));
alter table private.sequential_taste_sessions alter column policy set default 'CANONICAL_FORECAST_V3';

create function private.select_sequential_taste_v3(catalog jsonb,ledger jsonb,panel jsonb,control text)
returns jsonb language sql immutable set search_path='' as $$
  with available as materialized (
    select c,(forecast.f->>'score')::double precision score
    from jsonb_array_elements(catalog) c
    join lateral(select f from jsonb_array_elements(panel->'items') f where f->>'itemId'=c->>'id') forecast on true
    where forecast.f->>'status'='AVAILABLE' and not coalesce((forecast.f->>'labelSeen')::boolean,false)
      and jsonb_typeof(forecast.f->'score')='number'
      and not exists(select 1 from jsonb_array_elements(ledger) p where p->>'objectId'=c->>'id')
  ), choices as materialized (
    select c,score,private.sequential_taste_components_v2(c,ledger,'ADAPTIVE') base,
      least(1,(select count(*)::double precision/4 from jsonb_array_elements(ledger) p
        where p->>'itemType'=c->>'itemType' and not coalesce((p->>'invalidated')::boolean,false)
          and p#>>'{responses,-1,answer,kind}'='RATING')) progress,
      (select count(*) from jsonb_array_elements(ledger) p where p->>'itemType'=c->>'itemType') presented
    from available a where jsonb_array_length(c->'tags')>0 and exists(select 1 from available b
      where b.c->>'itemType'=a.c->>'itemType' and jsonb_array_length(b.c->'tags')>0
        and 1-private.sequential_taste_similarity_v2(a.c->'tags',b.c->'tags')>=.10)
  ), ordinal as (
    select a.*,r.n candidate_count,case when r.n<=1 then .5 else
      (r.lower_count+.5*(r.tied_count-1))/(r.n-1) end preference
    from choices a cross join lateral (
      select count(*)::double precision n,
        count(*) filter(where b.score<a.score and not comparison.tied)::double precision lower_count,
        count(*) filter(where comparison.tied)::double precision tied_count
      from choices b cross join lateral (
        -- Opposite wide finite scores cannot tie; avoid an overflowing float8
        -- subtraction while keeping exact float tolerance for nearby values.
        select case when (a.score>1 and b.score< -1) or (a.score< -1 and b.score>1)
          then false else abs(b.score-a.score)<=1e-9 end tied
      ) comparison where b.c->>'itemType'=a.c->>'itemType'
    ) r
  ), scored as (
    select *,jsonb_build_object('recognition',base->'recognition','preference',preference,
      'diversity',base->'diversity','coverage',base->'coverage','utility',
      case when control='PRIOR_ONLY' then (base->>'recognition')::double precision else
        .35*(base->>'recognition')::double precision+.45*preference
          +.10*(base->>'diversity')::double precision+.10*(base->>'coverage')::double precision end) components
    from ordinal
  ), bounds as (select min(presented) minimum_presented,max(presented) maximum_presented from choices)
  select jsonb_build_object('item',c,'components',components,'trace',jsonb_build_object(
    'version','canonical-ordinal-v3','scoreBasis','WITHIN_DOMAIN_CURRENT_PANEL_TIED_MIDRANK',
    'poolId',panel->>'predictionId','preference',preference,'candidateCount',candidate_count,
    'coverageIntervention',maximum_presented-minimum_presented>=2,
    'minimumPresented',minimum_presented,'maximumPresented',maximum_presented,'maximumDomainLead',2))
  from scored cross join bounds
  where maximum_presented-minimum_presented<2 or presented=minimum_presented
  order by (components->>'utility')::double precision desc,progress,presented,
    c->>'itemType' collate "C",c->>'id' collate "C" limit 1;
$$;
revoke all on function private.select_sequential_taste_v3(jsonb,jsonb,jsonb,text)
  from public,anon,authenticated,service_role;

-- Replace only reviewed dispatch/trace metadata. pg_get_functiondef preserves
-- identity, owner and ACL; reject unknown source or authorization configuration.
do $forecast_policy$
declare patch jsonb;p record;body text;before_text text;after_text text;
begin
  for patch in select value from jsonb_array_elements($patches$[
    {"signature":"private.taste_session_v2(jsonb)","md5":"aac507516e153bbcdb75342de7523ecb","definer":true,"replacements":[
      ["chosen:=private.select_sequential_taste_v2(s.catalog,s.presentations,frozen,s.policy);",
       "chosen:=case when s.policy='CANONICAL_FORECAST_V3' then private.select_sequential_taste_v3(s.catalog,s.presentations,frozen,s.policy) else private.select_sequential_taste_v2(s.catalog,s.presentations,frozen,s.policy) end;"],
      ["'selectionComponents',chosen->'components','invalidated',false,'responses','[]'::jsonb);",
       "'selectionComponents',chosen->'components','invalidated',false,'responses','[]'::jsonb);\n          if s.policy='CANONICAL_FORECAST_V3' then q:=q||jsonb_build_object('selectionTrace',chosen->'trace');end if;"]
    ]},
    {"signature":"private.project_sequential_taste_evidence_v2(uuid,jsonb,jsonb)","md5":"8ae31870e2e8a76893537635de365554","definer":false,"replacements":[
      ["'questionPolicyVersion','sequential-taste-numeric-v2'",
       "'questionPolicyVersion',case when s.policy='CANONICAL_FORECAST_V3' then 'canonical-ordinal-v3' else 'sequential-taste-numeric-v2' end"]
    ]}
  ]$patches$::jsonb) loop
    select proc.*,pg_get_functiondef(proc.oid) definition into strict p from pg_proc proc where proc.oid=(patch->>'signature')::regprocedure;
    if md5(p.prosrc)<>patch->>'md5' or p.proowner<>'postgres'::regrole
      or p.prosecdef is distinct from (patch->>'definer')::boolean or p.provolatile<>'v'
      or p.prolang<>(select oid from pg_language where lanname='plpgsql') or p.proleakproof or p.proisstrict or p.proparallel<>'u'
      or p.proconfig is distinct from array['search_path=""']::text[]
      or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from (patch->>'definer')::boolean
      or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
        where acl.grantor<>p.proowner or acl.grantee not in(p.proowner,
          case when (patch->>'definer')::boolean then 'authenticated'::regrole else p.proowner end)
          or (acl.grantee<>p.proowner and acl.is_grantable)) then
      raise exception 'Forecast-aware Taste source/security drift: %',patch->>'signature';
    end if;
    body:=p.prosrc;
    for before_text,after_text in select value->>0,value->>1 from jsonb_array_elements(patch->'replacements') loop
      if (length(body)-length(replace(body,before_text,'')))/length(before_text)<>1 then
        raise exception 'Forecast-aware Taste replacement drift: %',patch->>'signature';end if;
      body:=replace(body,before_text,after_text);
    end loop;
    execute replace(p.definition,p.prosrc,body);
  end loop;
end;$forecast_policy$;
