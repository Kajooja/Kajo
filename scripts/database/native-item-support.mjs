import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Independent approved-body manifest. Support changes never alter scoring
// weights/features, eligibility, pool order or historical prediction records.
const replacements = [
  {
    before: '      count(*)::integer as evidence_count\n    from weighted_events',
    after: '      count(*)::integer as evidence_count,\n      array_agg(distinct weighted_events.item_id) as native_support_item_ids\n    from weighted_events',
    count: 1,
  },
  {
    before: '      coalesce(native.evidence_count, 0) as evidence_count,',
    after: "      coalesce(native.evidence_count, 0) as evidence_count,\n      coalesce(native.native_support_item_ids, '{}'::uuid[]) as native_support_item_ids,",
    count: 1,
  },
  {
    before: '    from policy_candidates\n  )\n  select',
    after: `    from policy_candidates
  ),
  -- Count support only once per retained candidate (at most result_limit=50).
  -- The complete scoring/admission pool above remains unchanged.
  native_supported as materialized (
    select ranked.*,
      private.native_item_support_count_v1(array(
        select unnest(matched.native_support_item_ids)
        from tag_evidence as matched
        where matched.tag = any(ranked.tags)
      )) as native_item_support_count
    from ranked
    where ranked.result_rank <= result_limit
  )
  select`,
    count: 1,
  },
  {
    before: '  from ranked\n  cross join prediction',
    after: '  from native_supported as ranked\n  cross join prediction',
    count: 1,
  },
  {
    before: '    least(1.0, ranked.evidence_count::double precision / 8.0),',
    after: '    least(1.0, ranked.native_item_support_count::double precision / 8.0),',
    count: 1,
  },
  {
    before: "      'evidenceCount', ranked.evidence_count,",
    after: `      'evidenceCount', ranked.evidence_count,
      'nativeItemSupportCount', ranked.native_item_support_count,
      'nativeSupportVersion', 'native-item-support-v1',
      'nativeSupportBasis', 'DISTINCT_MATCHING_NATIVE_ITEMS',
      'nativeSupportCalibration', 'uncalibrated',`,
    count: 1,
  },
];

export const nativeItemSupportPatches = [
  { signature: 'private.rank_items_v0(uuid,text,text,integer,jsonb)',
    sourceMd5: '478a0d8a1554dce3a274de3aaf5d0f98', replacements },
  { signature: 'private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)',
    sourceMd5: 'd30e2000ec99cdbf315152454aada8fe', replacements },
];

const literal = value => `'${value.replaceAll("'", "''")}'`;
const read = name => readFile(new URL(name, import.meta.url), 'utf8');
export const nativeItemSupportFixtureSql = () => read('native-item-support-fixture.sql');
export async function nativeItemSupportSmokeSql() {
  return `begin;\n${await nativeItemSupportFixtureSql()}\n${await read('native-item-support-smoke.sql')}\nrollback;`;
}

export async function nativeItemSupportUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_native_item_support.sql'));
  assert.equal(nativeItemSupportPatches.length, 2);
  const patches = nativeItemSupportPatches.flatMap(functionPatch => functionPatch.replacements.map((patch, index) =>
    `(${literal(functionPatch.signature)}::regprocedure::text,${index},${literal(patch.before)},${literal(patch.after)},${patch.count})`)).join(',\n');
  return `begin;
    ${await nativeItemSupportFixtureSql()}
    do $defect$ declare f record;r record;begin
      select * into strict f from pg_temp.item_support_fixture;
      perform set_config('request.jwt.claim.sub',f.actor::text,true);
      select * into strict r from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
      perform pg_temp.item_support_assert(r.confidence=1 and r.explanation->>'evidenceCount'='8',
        'old one-Item/eight-tag confidence defect reproduced');
      select * into strict r from private.rank_items_catalog_base_v1('{}',false,f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
      perform pg_temp.item_support_assert(r.confidence=1 and r.explanation->>'evidenceCount'='8',
        'old catalogue clone has the same support defect');
    end;$defect$;
    create temp table item_support_upgrade_tables(oid oid primary key,identity text,properties jsonb,digest text) on commit drop;
    do $snapshot$ declare r record;digest text;begin
      for r in select c.*,format('%I.%I',n.nspname,c.relname) identity from pg_class c
        join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        insert into pg_temp.item_support_upgrade_tables values(r.oid,r.identity,
          to_jsonb(r)-array['identity','relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'],digest);
      end loop;
    end;$snapshot$;
    create temp table item_support_upgrade_columns on commit drop as select a.attrelid,a.attnum,to_jsonb(a) properties,
      to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_temp.item_support_upgrade_tables r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table item_support_upgrade_constraints on commit drop as select k.oid,to_jsonb(k) properties,
      pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_temp.item_support_upgrade_tables r on r.oid=k.conrelid;
    create temp table item_support_upgrade_indexes on commit drop as select i.indexrelid,to_jsonb(i) properties,
      to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] relation_properties,
      pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_temp.item_support_upgrade_tables r on r.oid=i.indrelid
      join pg_class c on c.oid=i.indexrelid;
    create temp table item_support_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      to_jsonb(p)-'prosrc' properties,p.prosrc body,pg_get_functiondef(p.oid) definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f';
    create temp table item_support_upgrade_triggers on commit drop as select t.oid,to_jsonb(t) properties,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_temp.item_support_upgrade_tables r on r.oid=t.tgrelid;
    create temp table item_support_upgrade_patches(identity text,ordinal integer,before text,after text,expected_count integer) on commit drop;
    insert into pg_temp.item_support_upgrade_patches values ${patches};
    alter default privileges for role postgres grant execute on functions to public;
    ${migration.sql}
    do $verify$ declare r record;p record;expected text;digest text;page record;result jsonb;after_live jsonb;begin
      for r in select * from pg_temp.item_support_upgrade_tables loop
        if not exists(select 1 from pg_class c where c.oid=r.oid and
          to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is not distinct from r.properties) then
          raise exception 'Native Item support forward changed an old table identity/owner/ACL/RLS: %',r.identity;end if;
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Native Item support forward changed a populated old row: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.item_support_upgrade_columns b left join pg_attribute a on a.attrelid=b.attrelid and a.attnum=b.attnum
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid is null
        or to_jsonb(a) is distinct from b.properties or to_jsonb(d) is distinct from b.default_properties
        or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression) then
        raise exception 'Native Item support forward changed an old column/default identity or definition';end if;
      if exists(select 1 from pg_temp.item_support_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or to_jsonb(k) is distinct from b.properties or pg_get_constraintdef(k.oid) is distinct from b.definition) then
        raise exception 'Native Item support forward changed an old constraint';end if;
      if exists(select 1 from pg_temp.item_support_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        left join pg_class c on c.oid=i.indexrelid where i.indexrelid is null or to_jsonb(i) is distinct from b.properties
        or to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is distinct from b.relation_properties
        or pg_get_indexdef(i.indexrelid) is distinct from b.definition) then raise exception 'Native Item support forward changed an old index';end if;
      for r in select * from pg_temp.item_support_upgrade_functions loop
        if not exists(select 1 from pg_proc f where f.oid=r.oid and to_jsonb(f)-'prosrc' is not distinct from r.properties) then
          raise exception 'Native Item support forward changed an old function identity/owner/ACL/config: %',r.identity;end if;
        expected := r.body;
        for p in select * from pg_temp.item_support_upgrade_patches where identity=r.identity order by ordinal loop
          if cardinality(string_to_array(expected,p.before))<>p.expected_count+1 then raise exception 'Native Item support approved source anchor unavailable: %',r.identity;end if;
          expected := replace(expected,p.before,p.after);
        end loop;
        if (select prosrc from pg_proc where oid=r.oid) is distinct from expected then
          raise exception 'Native Item support forward changed an old body beyond approved exact patches: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.item_support_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or to_jsonb(t) is distinct from b.properties or pg_get_triggerdef(t.oid) is distinct from b.definition) then
        raise exception 'Native Item support forward changed an old trigger';end if;
      for page in select * from pg_temp.item_support_pages loop
        perform set_config('request.jwt.claim.sub',page.actor::text,true);perform set_config('role','authenticated',true);
        result := public.rank_items_page_v1(page.request);perform set_config('role','postgres',true);
        if result is distinct from page.response then raise exception 'Native Item support forward changed an exact old V2/V3 page receipt';end if;
      end loop;
      for r in select * from pg_temp.item_support_upgrade_tables loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Native Item support receipt retry mutated old rows: %',r.identity;end if;
      end loop;
      for r in select * from pg_temp.item_support_live loop
        if r.kernel='v0' then
          select jsonb_agg(pg_temp.item_support_comparable(to_jsonb(k)) order by k.rank)
            into after_live from private.rank_items_v0(r.profile,'FOR_YOU',r.domain,50,'{}') k;
        else
          select jsonb_agg(pg_temp.item_support_comparable(to_jsonb(k)) order by k.rank)
            into after_live from private.rank_items_catalog_base_v1('{}',false,r.profile,'FOR_YOU',r.domain,50,'{}') k;
        end if;
        perform pg_temp.item_support_assert(after_live=r.body,'live score/features/rank/legacy trace retained exactly');
      end loop;
      perform pg_temp.item_support_assert(not has_function_privilege('authenticated',
        'private.native_item_support_count_v1(uuid[])','EXECUTE') and not has_function_privilege('anon',
        'private.native_item_support_count_v1(uuid[])','EXECUTE') and not has_function_privilege('service_role',
        'private.native_item_support_count_v1(uuid[])','EXECUTE'),'new helper denies public API roles despite default grants');
    end;$verify$;
    select jsonb_build_object('nativeItemSupportUpgrade',
      'PASS: old one-Item/eight-tag defect; every populated row/object and frozen V2/V3 receipt retained; only two approved live support patches; scores/features/ranks unchanged') snapshot;
    rollback;`;
}
