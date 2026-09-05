-- Sprint 014C / #177
-- Forward fix for the hosted shared-common-fit-v1.1 patch.
--
-- The guarded pg_get_functiondef replacement in the prior migration replaced
-- the PersonalProfile fallback policy literal inside the newly-injected CASE,
-- leaving `else current_policy_version` and therefore NULL on Personal runs.
-- Shared runs were unaffected. Preserve the Shared v1.1 branch and restore the
-- original Personal policy version explicitly.

do $$
declare
  definition text;
  patched text;
  broken_assignment text := E'current_policy_version := case\n    when coalesce((shared_common_context ->> ''applicable'')::boolean, false)\n      then ''scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1''\n    else current_policy_version\n  end;';
  fixed_assignment text := E'current_policy_version := case\n    when coalesce((shared_common_context ->> ''applicable'')::boolean, false)\n      then ''scenario-memory-v1+resurfacing-v1+shared-common-fit-v1.1''\n    else ''scenario-memory-v1+resurfacing-v1''\n  end;';
begin
  definition := pg_get_functiondef(
    'private.rank_items_v1_internal(uuid,text,text,integer,jsonb)'::regprocedure
  );

  if position(broken_assignment in definition) = 0 then
    raise exception 'shared-common-fit Personal policy fix guard failed';
  end if;

  patched := replace(definition, broken_assignment, fixed_assignment);
  execute patched;
end;
$$;

revoke all on function private.rank_items_v1_internal(uuid, text, text, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.rank_items_v1_internal(uuid, text, text, integer, jsonb)
  to authenticated;
