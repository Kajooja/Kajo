-- Disposable conformance oracle only. Not an application migration or serving reader.
-- The caller supplies the complete authorized committed prefix after source erasure.
create function pg_temp.contextual_skip_reference_v1(input jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare
  cutoff numeric; deadline numeric; sources jsonb; r jsonb; accepted numeric; withdrawn numeric;
  seen text[] := '{}'; candidate numeric;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or jsonb_typeof(input->'otherwiseEligible') is distinct from 'boolean'
    or jsonb_typeof(input->'records') is distinct from 'array'
    or jsonb_array_length(input->'records') > 256
    or jsonb_typeof(input->'subjectId') is distinct from 'string'
    or jsonb_typeof(input->'objectId') is distinct from 'string'
    or length(input->>'subjectId') not between 1 and 256
    or length(input->>'objectId') not between 1 and 256
    or input->>'subjectId' !~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$'
    or input->>'objectId' !~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$'
    or jsonb_typeof(input->'asOf') is distinct from 'string'
    or input->>'asOf' !~ '^(0|[1-9][0-9]{0,17})$' then
    raise exception 'Invalid skip decision input';
  end if;
  cutoff := (input->>'asOf')::numeric;
  if cutoff > 253402300799999999 then raise exception 'Invalid skip clock'; end if;
  for r in select value from jsonb_array_elements(input->'records') loop
    if jsonb_typeof(r) is distinct from 'object'
      or jsonb_typeof(r->'id') is distinct from 'string'
      or r->>'id' !~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$'
      or r->>'id'=any(seen)
      or jsonb_typeof(r->'subjectId') is distinct from 'string'
      or jsonb_typeof(r->'objectId') is distinct from 'string'
      or length(r->>'subjectId') not between 1 and 256 or length(r->>'objectId') not between 1 and 256
      or r->>'subjectId' !~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$'
      or r->>'objectId' !~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$'
      or jsonb_typeof(r->'acceptedAt') is distinct from 'string'
      or r->>'acceptedAt' !~ '^(0|[1-9][0-9]{0,17})$'
      or (r->'withdrawnAt' is distinct from 'null'::jsonb and (
        jsonb_typeof(r->'withdrawnAt') is distinct from 'string'
        or r->>'withdrawnAt' !~ '^(0|[1-9][0-9]{0,17})$')) then
      raise exception 'Invalid or duplicate skip source';
    end if;
    accepted := (r->>'acceptedAt')::numeric;
    withdrawn := (r->>'withdrawnAt')::numeric;
    if accepted > 253402300799999999 or withdrawn > 253402300799999999 or withdrawn < accepted then
      raise exception 'Invalid skip source clock';
    end if;
    seen := array_append(seen,r->>'id');
    if r->>'subjectId'<>input->>'subjectId' or r->>'objectId'<>input->>'objectId'
      or accepted>cutoff or withdrawn<=cutoff then continue; end if;
    candidate := accepted+86400000000;
    if deadline is null or candidate>deadline then deadline:=candidate;sources:=jsonb_build_array(r->>'id');
    elsif candidate=deadline then sources:=sources||jsonb_build_array(r->>'id');end if;
  end loop;
  select coalesce(jsonb_agg(value order by value collate "C"),'[]') into sources
    from jsonb_array_elements_text(coalesce(sources,'[]'));
  return jsonb_build_object('version','contextual-skip-cooldown-v1','contextChangePolicy','NO_TRUSTED_CONTEXT_CHANGE_V1',
    'eligible',(input->>'otherwiseEligible')::boolean and (deadline is null or cutoff>=deadline),
    'reason',case when not(input->>'otherwiseEligible')::boolean then 'OTHER_POLICY_SUPPRESSED'
      when deadline is null then 'NO_ACTIVE_SKIP' when cutoff<deadline then 'SKIP_COOLDOWN' else 'SKIP_COOLDOWN_ELAPSED' end,
    'sourceIds',sources,'reconsiderAt',deadline::text);
end;
$$;
