-- Exact historical compact bootstrap compatibility, before sequential forwards.
-- Fresh chronological replay already has the canonical v2 body and is a no-op.
-- No rows, grants, triggers or previously accepted migrations are changed.
do $sequential_bootstrap_compatibility$
declare
  previous pg_catalog.pg_proc%rowtype;
  current_function pg_catalog.pg_proc%rowtype;
  definition text;
  canonical_body constant text := $canonical$
  select case evidence_kind
    when 'RATED' then case
      when evidence_rating between 0 and 10 then (evidence_rating::double precision - 5.0) * 0.75
      else 0.0 end
    when 'CONSUMED' then 0.4
    when 'SAVED' then 0.9
    else 0.0
  end;
$canonical$;
  compact_body constant text := $compact$
 select case evidence_kind when 'RATED' then case when evidence_rating between 0 and 10 then (evidence_rating::double precision-5.0)*0.75 else 0.0 end when 'CONSUMED' then 0.4 when 'SAVED' then 0.9 else 0.0 end;
$compact$;
  sequential_body text;
begin
  select p.* into strict previous from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('private.bootstrap_evidence_weight_v1(text,integer)');
  sequential_body:=pg_catalog.replace(canonical_body,'    when ''SAVED'' then 0.9',
    E'    when ''NOT_INTERESTED'' then private.event_evidence_weight_v1(''ITEM_NOT_INTERESTED'',''{}''::jsonb) * (0.75/1.2)\n    when ''SAVED'' then 0.9');
  if previous.prosrc is distinct from canonical_body and previous.prosrc is distinct from compact_body
    and previous.prosrc is distinct from sequential_body then
    raise exception 'Unknown bootstrap evidence body; sequential compatibility refused' using errcode='55000';
  end if;
  definition:=pg_catalog.pg_get_functiondef(previous.oid);
  if pg_catalog.pg_get_userbyid(previous.proowner)<>'postgres'
    or previous.proacl::text is distinct from '{postgres=X/postgres}'
    or pg_catalog.md5(pg_catalog.replace(definition,previous.prosrc,canonical_body))<>'c8925a26004591d58cdc0da3a0c8e4da' then
    raise exception 'Bootstrap evidence identity/security/configuration drift; sequential compatibility refused' using errcode='55000';
  end if;
  if previous.prosrc=canonical_body or previous.prosrc=sequential_body then return;end if;
  if (pg_catalog.length(definition)-pg_catalog.length(pg_catalog.replace(definition,previous.prosrc,'')))
    /pg_catalog.length(previous.prosrc)<>1 then
    raise exception 'Bootstrap evidence definition substitution drift' using errcode='55000';
  end if;
  execute pg_catalog.replace(definition,previous.prosrc,canonical_body);
  select p.* into strict current_function from pg_catalog.pg_proc p where p.oid=previous.oid;
  if current_function.prosrc is distinct from canonical_body
    or (pg_catalog.to_jsonb(current_function)-'prosrc') is distinct from (pg_catalog.to_jsonb(previous)-'prosrc') then
    raise exception 'Bootstrap evidence identity/metadata drift after compatibility' using errcode='55000';
  end if;
end;
$sequential_bootstrap_compatibility$;
