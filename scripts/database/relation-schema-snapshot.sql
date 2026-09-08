-- Read-only definition fingerprint. No application rows leave the database.
-- Scope: ordinary/partitioned tables, columns, constraints, indexes, policies,
-- owners and direct table/column ACL. Not views, sequences, schema/default ACL,
-- role inheritance, extensions, platform objects or canonical migration parity.
begin read only;
set local search_path = pg_catalog;
with relations as (
  select c.*, n.nspname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')
), definitions as (
  select format('%I.%I', c.nspname, c.relname) as identity,
    jsonb_build_object(
      'kind', c.relkind, 'owner', pg_get_userbyid(c.relowner),
      'rls', c.relrowsecurity, 'forceRls', c.relforcerowsecurity,
      'persistence', c.relpersistence, 'replicaIdentity', c.relreplident,
      'options', (select array_agg(v order by v) from unnest(c.reloptions) v),
      'partitionKey', pg_get_partkeydef(c.oid),
      'partitionBound', pg_get_expr(c.relpartbound, c.oid),
      'parents', (select jsonb_agg(i.inhparent::regclass::text order by i.inhseqno)
        from pg_inherits i where i.inhrelid = c.oid),
      'acl', (select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),
        case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        a.privilege_type, a.is_grantable) order by pg_get_userbyid(a.grantor),
        case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        a.privilege_type, a.is_grantable)
        from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a),
      'columns', (select jsonb_agg(jsonb_build_object(
        'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
        'notNull', a.attnotnull, 'identity', a.attidentity, 'generated', a.attgenerated,
        'collation', case when a.attcollation <> 0 then a.attcollation::regcollation::text end,
        'default', pg_get_expr(d.adbin, d.adrelid),
        'acl', (select jsonb_agg(jsonb_build_array(pg_get_userbyid(g.grantor),
          case when g.grantee = 0 then 'PUBLIC' else pg_get_userbyid(g.grantee) end,
          g.privilege_type, g.is_grantable) order by pg_get_userbyid(g.grantor),
          case when g.grantee = 0 then 'PUBLIC' else pg_get_userbyid(g.grantee) end,
          g.privilege_type, g.is_grantable) from aclexplode(a.attacl) g)
        ) order by a.attnum) from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
      'constraints', (select jsonb_agg(jsonb_build_array(k.conname,
        pg_get_constraintdef(k.oid), k.convalidated, k.condeferrable, k.condeferred)
        order by k.conname) from pg_constraint k where k.conrelid = c.oid),
      'indexes', (select jsonb_agg(jsonb_build_array(i.indexrelid::regclass::text,
        pg_get_indexdef(i.indexrelid), i.indisvalid, i.indisready, i.indisreplident,
        i.indisclustered) order by i.indexrelid::regclass::text)
        from pg_index i where i.indrelid = c.oid),
      'policies', (select jsonb_agg(jsonb_build_object('name', p.polname,
        'command', p.polcmd, 'permissive', p.polpermissive,
        'roles', (select array_agg(case when r = 0 then 'PUBLIC' else pg_get_userbyid(r) end
          order by case when r = 0 then 'PUBLIC' else pg_get_userbyid(r) end)
          from unnest(p.polroles) r),
        'using', pg_get_expr(p.polqual, p.polrelid),
        'check', pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname)
        from pg_policy p where p.polrelid = c.oid)
    ) as definition from relations c
)
select jsonb_build_object('format', 'kajo-relation-schema-v1',
  'serverMajor', current_setting('server_version_num')::integer / 10000,
  'relations', coalesce(jsonb_agg(jsonb_build_object('identity', identity,
    'definitionSha256', encode(sha256(convert_to(definition::text, 'UTF8')), 'hex'))
    order by identity), '[]'::jsonb)) as snapshot from definitions;
rollback;
