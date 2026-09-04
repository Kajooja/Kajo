-- Sprint 014A/14B integration fix.
-- A missing bootstrap row must mean "no imported evidence", not SQL NULL
-- propagating through boolean OR and causing an ordinary Item to fall through
-- into the SAVED_SUPPRESSED path.
do $$
declare
  function_oid oid;
  function_definition text;
  expected_fragment text :=
    'is_consumed:=native_consumed or bootstrap_kind in(''RATED'',''CONSUMED''); has_rating:=native_rated or bootstrap_kind=''RATED''; is_not_interested:=native_not_interested; is_saved:=native_saved or bootstrap_kind=''SAVED'';';
  replacement_fragment text :=
    'is_consumed:=native_consumed or coalesce(bootstrap_kind in(''RATED'',''CONSUMED''),false); has_rating:=native_rated or coalesce(bootstrap_kind=''RATED'',false); is_not_interested:=native_not_interested; is_saved:=native_saved or coalesce(bootstrap_kind=''SAVED'',false);';
begin
  select p.oid
  into function_oid
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'resurfacing_policy_decision_v1'
    and pg_get_function_identity_arguments(p.oid) =
      'target_profile_id uuid, target_item_id uuid, candidate_explanation jsonb, decision_time timestamp with time zone';

  if function_oid is null then
    raise exception 'Expected resurfacing_policy_decision_v1 signature was not found';
  end if;

  function_definition := pg_get_functiondef(function_oid);
  if position(expected_fragment in function_definition) = 0 then
    raise exception 'Expected bootstrap boolean fragment was not found';
  end if;

  execute replace(function_definition, expected_fragment, replacement_fragment);
end;
$$;