import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The approved transformations are deliberately separate from migration SQL:
// the populated verifier rejects any additional changed byte in an old body.
export const personalNativeDecayPatches = [
  {
    "signature": "private.build_profile_memory_state_v1(uuid,timestamptz)",
    "sourceMd5": "3d15d0332c523aaf0f0dfbcea59104f6",
    "replacements": [
      {
        "before": "            else exp(\n              -greatest(\n                0.0,\n                extract(epoch from (state_as_of - weighted_events.occurred_at)) / 86400.0\n              ) / 180.0\n            )",
        "after": "            else private.native_long_term_decay_v2(\n              state_as_of, weighted_events.occurred_at\n            )",
        "count": 1
      },
      {
        "before": "      and event.occurred_at <= state_as_of",
        "after": "      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= state_as_of",
        "count": 2
      },
      {
        "before": "    'version', 'memory-state-v1',",
        "after": "    'version', 'memory-state-v1',\n    'nativeDecayVersion', 'native-long-term-decay-v2',\n    'nativeEvidenceAsOf', state_as_of,",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_v0(uuid,text,text,integer,jsonb)",
    "sourceMd5": "33ec3578a917d585d657d73ccc79b223",
    "replacements": [
      {
        "before": "        * exp(\n            -least(\n              365.0,\n              greatest(\n                0.0,\n                extract(epoch from (now() - weighted_events.occurred_at))\n                  / 86400.0\n              )\n            )\n            / 180.0\n          )",
        "after": "        * private.native_long_term_decay_v2(now(), weighted_events.occurred_at)",
        "count": 1
      },
      {
        "before": "      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and event.properties ? 'reversedEventId'",
        "after": "      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.properties ? 'reversedEventId'",
        "count": 1
      },
      {
        "before": "      and event.item_id is not null\n      and event.event_type in (",
        "after": "      and event.item_id is not null\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.event_type in (",
        "count": 1
      },
      {
        "before": "        'version', 'prediction-features-v2',",
        "after": "        'version', 'prediction-features-v2',\n        'nativeDecayVersion', 'native-long-term-decay-v2',\n        'nativeEvidenceAsOf', now(),",
        "count": 1
      },
      {
        "before": "      'version', 'prediction-v0.4-bootstrap',",
        "after": "      'version', 'prediction-v0.5-native-decay',\n      'nativeDecayVersion', 'native-long-term-decay-v2',\n      'nativeEvidenceAsOf', now(),",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_catalog_base_v1(uuid[],boolean,uuid,text,text,integer,jsonb)",
    "sourceMd5": "2173e0d10a5ec02091e3b356724088cf",
    "replacements": [
      {
        "before": "        * exp(\n            -least(\n              365.0,\n              greatest(\n                0.0,\n                extract(epoch from (now() - weighted_events.occurred_at))\n                  / 86400.0\n              )\n            )\n            / 180.0\n          )",
        "after": "        * private.native_long_term_decay_v2(now(), weighted_events.occurred_at)",
        "count": 1
      },
      {
        "before": "      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and event.properties ? 'reversedEventId'",
        "after": "      and event.event_type = 'ITEM_INTERACTION_UNDONE'\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.properties ? 'reversedEventId'",
        "count": 1
      },
      {
        "before": "      and event.item_id is not null\n      and event.event_type in (",
        "after": "      and event.item_id is not null\n      and pg_catalog.isfinite(event.occurred_at)\n      and event.occurred_at <= now()\n      and event.event_type in (",
        "count": 1
      },
      {
        "before": "        'version', 'prediction-features-v2',",
        "after": "        'version', 'prediction-features-v2',\n        'nativeDecayVersion', 'native-long-term-decay-v2',\n        'nativeEvidenceAsOf', now(),",
        "count": 1
      },
      {
        "before": "      'version', 'prediction-v0.4-bootstrap',",
        "after": "      'version', 'prediction-v0.5-native-decay',\n      'nativeDecayVersion', 'native-long-term-decay-v2',\n      'nativeEvidenceAsOf', now(),",
        "count": 1
      }
    ]
  },
  {
    "signature": "private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "5ab93187a675ac86197660997bbee2e5",
    "replacements": [
      {
        "before": "'prediction-v0.4-bootstrap'",
        "after": "'prediction-v0.5-native-decay'",
        "count": 2
      }
    ]
  },
  {
    "signature": "private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)",
    "sourceMd5": "6924cd358fe60455764c3d8379162d3a",
    "replacements": [
      {
        "before": "'prediction-v0.4-bootstrap'",
        "after": "'prediction-v0.5-native-decay'",
        "count": 2
      }
    ]
  }
];
const literal = text => `$decay_text$${text}$decay_text$`;

export async function personalNativeDecayFixtureSql() {
  return readFile(new URL('personal-native-decay-fixture.sql', import.meta.url), 'utf8');
}

export async function personalNativeDecaySmokeSql() {
  return `begin;${await personalNativeDecayFixtureSql()}
    ${await readFile(new URL('personal-native-decay-smoke.sql', import.meta.url), 'utf8')}rollback;`;
}

export async function personalNativeDecayUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_personal_native_decay_parity.sql'));
  assert.equal(personalNativeDecayPatches.length,5,'Expected only the five approved live function patches');
  const patches = personalNativeDecayPatches.flatMap(functionPatch => functionPatch.replacements.map((patch,index) =>
    `(${literal(functionPatch.signature)}::regprocedure::text,${index},${literal(patch.before)},${literal(patch.after)},${patch.count})`)).join(',\n');
  return `begin;
    ${await personalNativeDecayFixtureSql()}
    do $defect$ declare f record;state jsonb;ranked record;begin
      select * into strict f from pg_temp.native_decay_fixture;
      perform set_config('request.jwt.claim.sub',f.actor::text,true);
      state := private.build_profile_memory_state_v1(f.personal,now());
      select * into strict ranked from private.rank_items_v0(f.personal,'FOR_YOU','BOOK',50,'{}') where item_id=f.book;
      perform pg_temp.decay_assert(state->'longTermNegativeTags' @> '["decay-warm"]'::jsonb
        and (ranked.explanation->>'longTerm')::double precision>0,
        'pre-forward actual memory and V0 disagree in native LT sign');
      select * into strict ranked from private.rank_items_catalog_base_v1('{}',false,f.personal,'FOR_YOU','BOOK',50,'{}')
        where item_id=f.book;
      perform pg_temp.decay_assert((ranked.explanation->>'longTerm')::double precision>0,
        'pre-forward protocol3 catalogue base has the same native clamp defect');
    end;$defect$;
    create temp table decay_upgrade_tables(oid oid primary key,identity text,properties jsonb,digest text) on commit drop;
    do $snapshot$ declare r record;digest text;begin
      for r in select c.*,format('%I.%I',n.nspname,c.relname) identity from pg_class c
        join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        insert into pg_temp.decay_upgrade_tables values(r.oid,r.identity,
          to_jsonb(r)-array['identity','relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'],digest);
      end loop;
    end;$snapshot$;
    create temp table decay_upgrade_columns on commit drop as select a.attrelid,a.attnum,to_jsonb(a) properties,
      to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_temp.decay_upgrade_tables r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table decay_upgrade_constraints on commit drop as select k.oid,to_jsonb(k) properties,
      pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_temp.decay_upgrade_tables r on r.oid=k.conrelid;
    create temp table decay_upgrade_indexes on commit drop as select i.indexrelid,to_jsonb(i) properties,
      to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] relation_properties,
      pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_temp.decay_upgrade_tables r on r.oid=i.indrelid
      join pg_class c on c.oid=i.indexrelid;
    create temp table decay_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      to_jsonb(p)-'prosrc' properties,p.prosrc body,pg_get_functiondef(p.oid) definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f';
    create temp table decay_upgrade_triggers on commit drop as select t.oid,to_jsonb(t) properties,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_temp.decay_upgrade_tables r on r.oid=t.tgrelid;
    create temp table decay_upgrade_patches(identity text,ordinal integer,before text,after text,expected_count integer) on commit drop;
    insert into pg_temp.decay_upgrade_patches values ${patches};
    alter default privileges for role postgres grant execute on functions to public;
    ${migration.sql}
    do $verify$ declare r record;p record;expected text;digest text;page record;result jsonb;begin
      for r in select * from pg_temp.decay_upgrade_tables loop
        if not exists(select 1 from pg_class c where c.oid=r.oid and
          to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is not distinct from r.properties) then
          raise exception 'Native decay forward changed an old table identity/owner/ACL/RLS: %',r.identity;end if;
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Native decay forward changed a populated old row: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.decay_upgrade_columns b left join pg_attribute a on a.attrelid=b.attrelid and a.attnum=b.attnum
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid is null
        or to_jsonb(a) is distinct from b.properties or to_jsonb(d) is distinct from b.default_properties
        or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression) then
        raise exception 'Native decay forward changed an old column/default identity or definition';end if;
      if exists(select 1 from pg_temp.decay_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or to_jsonb(k) is distinct from b.properties or pg_get_constraintdef(k.oid) is distinct from b.definition) then
        raise exception 'Native decay forward changed an old constraint';end if;
      if exists(select 1 from pg_temp.decay_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        left join pg_class c on c.oid=i.indexrelid where i.indexrelid is null or to_jsonb(i) is distinct from b.properties
        or to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is distinct from b.relation_properties
        or pg_get_indexdef(i.indexrelid) is distinct from b.definition) then raise exception 'Native decay forward changed an old index';end if;
      for r in select * from pg_temp.decay_upgrade_functions loop
        if not exists(select 1 from pg_proc f where f.oid=r.oid and to_jsonb(f)-'prosrc' is not distinct from r.properties) then
          raise exception 'Native decay forward changed an old function identity/owner/ACL/config: %',r.identity;end if;
        expected := r.body;
        for p in select * from pg_temp.decay_upgrade_patches where identity=r.identity order by ordinal loop
          if cardinality(string_to_array(expected,p.before))<>p.expected_count+1 then raise exception 'Native decay approved source anchor unavailable: %',r.identity;end if;
          expected := replace(expected,p.before,p.after);
        end loop;
        if (select prosrc from pg_proc where oid=r.oid) is distinct from expected then
          raise exception 'Native decay forward changed an old body beyond approved exact patches: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.decay_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or to_jsonb(t) is distinct from b.properties or pg_get_triggerdef(t.oid) is distinct from b.definition) then
        raise exception 'Native decay forward changed an old trigger';end if;
      for page in select * from pg_temp.native_decay_pages loop
        perform set_config('request.jwt.claim.sub',page.actor::text,true);perform set_config('role','authenticated',true);
        result := public.rank_items_page_v1(page.request);perform set_config('role','postgres',true);
        if result is distinct from page.response then raise exception 'Native decay forward changed an exact old V2/V3 page receipt';end if;
      end loop;
      for r in select * from pg_temp.decay_upgrade_tables loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Native decay receipt retry mutated old rows: %',r.identity;end if;
      end loop;
      perform pg_temp.decay_assert(not has_function_privilege('authenticated',
        'private.native_long_term_decay_v2(timestamptz,timestamptz)','EXECUTE'),'new helper overrides public default EXECUTE');
    end;$verify$;
    select jsonb_build_object('personalNativeDecayUpgrade',
      'PASS: actual old memory/V0/catalogue sign contradiction; every populated old row and object preserved; only five exact approved live patches; old V2/V3 pages and frozen shadows unchanged') snapshot;
    rollback;`;
}
