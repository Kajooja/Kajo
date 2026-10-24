-- Keep the same complete historical outcome set, top-30 ordering, scoring
-- expressions and frozen artifacts. Evaluate its shared history once per
-- ranking and the immutable similarity once per candidate/outcome pair.
do $scenario_similarity_evaluation$
declare
  target constant regprocedure := 'private.rank_items_candidate_with_identity_v1(timestamptz,uuid[],boolean,uuid[],boolean,uuid,uuid,text,text,integer,jsonb)'::regprocedure;
  previous pg_catalog.pg_proc%rowtype;
  current_function pg_catalog.pg_proc%rowtype;
  definition text;
  next_source text;
  patch record;
begin
  select p.* into strict previous from pg_catalog.pg_proc p where p.oid=target;
  if pg_catalog.md5(previous.prosrc)<>'45f4f03f4a4fb99d84a02c83c472ae89'
    or pg_catalog.pg_get_userbyid(previous.proowner)<>'postgres'
    or previous.proacl::text is distinct from '{postgres=X/postgres}'
    or previous.proconfig is distinct from array['search_path=""']::text[]
    or not previous.prosecdef then
    raise exception 'Scenario similarity evaluation source/security/configuration drift' using errcode='55000';
  end if;
  definition:=pg_catalog.pg_get_functiondef(previous.oid);
  if (pg_catalog.length(definition)-pg_catalog.length(pg_catalog.replace(definition,previous.prosrc,'')))
    /pg_catalog.length(previous.prosrc)<>1 then
    raise exception 'Scenario similarity evaluation definition substitution drift' using errcode='55000';
  end if;
  next_source:=previous.prosrc;
  for patch in select * from (values
    ($before$  historical_outcomes as ($before$,
     $after$  historical_outcomes as materialized ($after$),
    ($before$          ) as value
        ) as similarity$before$,
     $after$          ) as value
          offset 0
        ) as similarity$after$)
  ) replacements(before_text,after_text) loop
    if (pg_catalog.length(next_source)-pg_catalog.length(pg_catalog.replace(next_source,patch.before_text,'')))
      /pg_catalog.length(patch.before_text)<>1 then
      raise exception 'Scenario similarity evaluation anchor drift' using errcode='55000';
    end if;
    next_source:=pg_catalog.replace(next_source,patch.before_text,patch.after_text);
  end loop;
  execute pg_catalog.replace(definition,previous.prosrc,next_source);
  select p.* into strict current_function from pg_catalog.pg_proc p where p.oid=previous.oid;
  if current_function.prosrc is distinct from next_source
    or (pg_catalog.to_jsonb(current_function)-'prosrc') is distinct from (pg_catalog.to_jsonb(previous)-'prosrc') then
    raise exception 'Scenario similarity evaluation function identity/metadata drift' using errcode='55000';
  end if;
end;
$scenario_similarity_evaluation$;
