-- Sprint 014B / #185
-- Real Letterboxd/IMDb/book histories commonly exceed 500 rows. Keep one
-- idempotent dataset snapshot but allow a bounded 5k-row stage payload for MVP.
-- The already-hosted foundation migration is immutable; patch the deployed
-- function definition forward and fail if the expected guard has drifted.

do $$
declare
  function_oid oid;
  definition text;
  old_guard text := 'jsonb_array_length(input_rows)<1 or jsonb_array_length(input_rows)>500';
  new_guard text := 'jsonb_array_length(input_rows)<1 or jsonb_array_length(input_rows)>5000';
  old_message text := 'Import batch must contain between 1 and 500 rows';
  new_message text := 'Import batch must contain between 1 and 5000 rows';
begin
  select p.oid into function_oid
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'stage_profile_import_rows_v1'
    and pg_get_function_identity_arguments(p.oid) = 'target_job_id uuid, input_rows jsonb';

  if function_oid is null then
    raise exception 'Expected private.stage_profile_import_rows_v1 signature was not found';
  end if;

  definition := pg_get_functiondef(function_oid);
  if position(old_guard in definition) = 0 or position(old_message in definition) = 0 then
    raise exception 'Expected profile import stage limit guard was not found';
  end if;

  execute replace(replace(definition, old_guard, new_guard), old_message, new_message);
end;
$$;
