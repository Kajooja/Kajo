-- Sprint 013B hosted smoke exposed a PL/pgSQL name collision between the
-- table column prediction_id and the rank_items_v1_internal OUT parameter.
-- Keep the original deployed migration immutable and patch the existing
-- function definition forward so fresh and already-hosted databases converge.

do $$
declare
  function_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure
  ) into function_definition;

  if position('returning prediction_id' in function_definition) = 0 then
    raise exception 'Expected ambiguous RETURNING prediction_id was not found';
  end if;

  corrected_definition := replace(
    function_definition,
    'returning prediction_id',
    'returning private.prediction_candidates.prediction_id'
  );

  if corrected_definition = function_definition then
    raise exception 'Prediction V1 function definition was not changed';
  end if;

  execute corrected_definition;
end;
$$;
