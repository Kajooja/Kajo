-- Read-only platform metadata for the pinned installation probe. No application
-- rows, function bodies, role passwords, connection strings or API keys.
begin read only;
set local search_path = pg_catalog;
select jsonb_build_object(
  'format', 'kajo-platform-schema-v1',
  'serverVersion', current_setting('server_version'),
  'schemas', (select jsonb_agg(jsonb_build_object('name',n.nspname,
    'owner',pg_get_userbyid(n.nspowner),'acl',(select jsonb_agg(jsonb_build_array(
      pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
      a.privilege_type,a.is_grantable) order by pg_get_userbyid(a.grantor),
      case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
      from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a)) order by n.nspname)
    from pg_namespace n where n.nspname in ('public','private','auth','storage','extensions')),
  'creatorDefaults', (select jsonb_agg(jsonb_build_object('creator',pg_get_userbyid(d.defaclrole),
    'schema',case when d.defaclnamespace=0 then '*' else n.nspname end,'kind',d.defaclobjtype,
    'acl',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),
      case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable)
      order by pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
      a.privilege_type,a.is_grantable) from aclexplode(d.defaclacl) a))
    order by pg_get_userbyid(d.defaclrole),coalesce(n.nspname,'*'),d.defaclobjtype)
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
    where pg_get_userbyid(d.defaclrole) in ('postgres','supabase_admin','supabase_auth_admin','supabase_storage_admin')),
  'eventTriggers', (select jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,
    'enabled',e.evtenabled,'tags',(select array_agg(t order by t) from unnest(e.evttags)t),
    'owner',pg_get_userbyid(e.evtowner),'function',e.evtfoid::regprocedure::text,
    'functionOwner',pg_get_userbyid(p.proowner),
    'functionSha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
    'extension',(select x.extname from pg_depend d join pg_extension x on x.oid=d.refobjid
      where d.classid='pg_event_trigger'::regclass and d.objid=e.oid
        and d.refclassid='pg_extension'::regclass and d.deptype='e')) order by e.evtname)
    from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid),
  'roles', (select jsonb_agg(jsonb_build_object('name',rolname,'inherit',rolinherit,
    'superuser',rolsuper,'bypassRls',rolbypassrls) order by rolname) from pg_roles
    where rolname in ('postgres','anon','authenticated','service_role','authenticator',
      'supabase_admin','supabase_auth_admin','supabase_storage_admin')),
  'memberships', (select jsonb_agg(jsonb_build_object('member',pg_get_userbyid(m.member),
    'role',pg_get_userbyid(m.roleid),'inherit',m.inherit_option,'set',m.set_option)
    order by pg_get_userbyid(m.member),pg_get_userbyid(m.roleid)) from pg_auth_members m
    where pg_get_userbyid(m.member) in ('postgres','anon','authenticated','service_role','authenticator'))
) as snapshot;
rollback;
