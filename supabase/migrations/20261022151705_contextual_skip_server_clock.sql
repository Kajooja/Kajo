-- A phone clock can trail the server even when the actual delivered page and
-- its impression have committed. Occurrence time is observational, not source
-- availability. Keep exact source bindings and the server-clock/MVCC checks.
do $contextual_skip_server_clock$
declare
  previous pg_catalog.pg_proc%rowtype;
  current_function pg_catalog.pg_proc%rowtype;
  definition text;
  patched text;
  anchor text:=E'    or e.occurred_at<r.requested_at\n';
begin
  select p.* into strict previous from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('private.discovery_contextual_skip_source_v1(jsonb)');
  if pg_catalog.md5(previous.prosrc)<>'acf57a4821b16cc985a6a72a0b651388'
    or (pg_catalog.length(previous.prosrc)-pg_catalog.length(pg_catalog.replace(previous.prosrc,anchor,'')))
      /pg_catalog.length(anchor)<>1 then
    raise exception 'Contextual skip source clock drift' using errcode='55000';
  end if;
  definition:=pg_catalog.pg_get_functiondef(previous.oid);
  patched:=pg_catalog.replace(previous.prosrc,anchor,'');
  if pg_catalog.strpos(definition,previous.prosrc)=0 then
    raise exception 'Contextual skip source definition drift' using errcode='55000';
  end if;
  execute pg_catalog.replace(definition,previous.prosrc,patched);
  select p.* into strict current_function from pg_catalog.pg_proc p where p.oid=previous.oid;
  if current_function.prosrc is distinct from patched
    or (pg_catalog.to_jsonb(current_function)-'prosrc') is distinct from (pg_catalog.to_jsonb(previous)-'prosrc') then
    raise exception 'Contextual skip source identity/metadata drift' using errcode='55000';
  end if;
end;
$contextual_skip_server_clock$;
