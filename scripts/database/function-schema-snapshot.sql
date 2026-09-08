-- Read-only function parity diagnostic, NOT an installable schema export.
-- No application rows, function bodies or migration statement payloads leave DB.
begin read only;
set local search_path = pg_catalog;
select jsonb_build_object(
  'format', 'kajo-function-schema-v1',
  'serverMajor', current_setting('server_version_num')::integer / 10000,
  'functions', coalesce(jsonb_agg(entry order by identity), '[]'::jsonb)
) as snapshot
from (
  select format('%I.%I(%s)', n.nspname, p.proname,
    pg_get_function_identity_arguments(p.oid)) as identity,
    jsonb_build_object(
      'identity', format('%I.%I(%s)', n.nspname, p.proname,
        pg_get_function_identity_arguments(p.oid)),
      'definitionSha256', encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex'),
      'owner', pg_get_userbyid(p.proowner),
      'acl', (select coalesce(jsonb_agg(jsonb_build_object(
        'grantor', pg_get_userbyid(a.grantor),
        'grantee', case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        'privilege', a.privilege_type,
        'grantable', a.is_grantable
      ) order by a.grantor::regrole::text, a.grantee::regrole::text, a.privilege_type, a.is_grantable), '[]'::jsonb)
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a)
    ) as entry
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prokind in ('f', 'p')
) functions;
rollback;
