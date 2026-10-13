-- Exact compatibility for the reviewed compact SleepLayer immutable guard.
-- Operational recovery applies this new bridge before the unchanged source-
-- erasure forward; chronological fresh installation sees its final no-op state.
-- No rows, grants, trigger attachments or immutable-history files are changed.
do $taste_guard_compatibility$
declare
  previous pg_catalog.pg_proc%rowtype;
  current_function pg_catalog.pg_proc%rowtype;
  definition text;
  canonical_body constant text := $canonical$
begin
  raise exception '% is immutable; create a new versioned row instead', tg_table_name
    using errcode = '55000';
end;
$canonical$;
  compact_body constant text := $compact$ begin raise exception '% is immutable; create a new versioned row instead', tg_table_name using errcode = '55000'; end; $compact$;
begin
  select p.* into strict previous from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('private.reject_immutable_prediction_artifact_change_v1()');
  if previous.prosecdef or previous.prokind<>'f'
    or previous.prorettype<>'pg_catalog.trigger'::pg_catalog.regtype
    or previous.prolang<>(select oid from pg_catalog.pg_language where lanname='plpgsql')
    or pg_catalog.pg_get_userbyid(previous.proowner)<>'postgres'
    or previous.proconfig is distinct from array['search_path=""']::text[]
    or previous.proacl::text is distinct from '{postgres=X/postgres}' then
    raise exception 'Taste immutable guard security/configuration drift; compatibility refused' using errcode='55000';
  end if;
  -- These complete bodies are exact identities, never whitespace normalization.
  if previous.prosrc=canonical_body
    or pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(previous.prosrc,'UTF8')),'hex')
      ='76b0626a920624a6c480876ba76d4c84ce2a8d10c854bcc1f798bf195c77a51f' then
    return;
  end if;
  if previous.prosrc is distinct from compact_body then
    raise exception 'Unknown immutable Prediction artifact guard; compatibility refused' using errcode='55000';
  end if;
  definition:=pg_catalog.pg_get_functiondef(previous.oid);
  if (pg_catalog.length(definition)-pg_catalog.length(pg_catalog.replace(definition,previous.prosrc,'')))
    /pg_catalog.length(previous.prosrc)<>1 then
    raise exception 'Taste immutable guard definition substitution drift' using errcode='55000';
  end if;
  execute pg_catalog.replace(definition,previous.prosrc,canonical_body);
  select p.* into strict current_function from pg_catalog.pg_proc p where p.oid=previous.oid;
  if current_function.prosrc is distinct from canonical_body
    or (pg_catalog.to_jsonb(current_function)-'prosrc') is distinct from (pg_catalog.to_jsonb(previous)-'prosrc') then
    raise exception 'Taste immutable guard identity/metadata drift after compatibility' using errcode='55000';
  end if;
end;
$taste_guard_compatibility$;
