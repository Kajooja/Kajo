import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { withPersonalRatingProspectiveFixture, literal } from './personal-rating-prospective.mjs';

const tables = ['personal_rating_allocations', 'personal_rating_inputs', 'personal_rating_forecasts',
  'personal_rating_event_refs', 'personal_rating_answers'];
const functions = ['guard_personal_rating_artifact_v1', 'withdraw_personal_rating_event_v1',
  'lock_personal_rating_transaction_v1', 'check_personal_rating_commit_v1',
  'prepare_personal_rating_forecast_v1', 'finalize_personal_rating_forecast_v1',
  'commit_personal_rating_answer_v1', 'inspect_personal_rating_forecast_v1',
  'personal_rating_target_has_report_v1', 'invalidate_pending_personal_rating_v1'];

// Independent approved replacement, not parsed back out of the candidate SQL.
export const personalRatingProspectiveEraserPatch = {
  signature: 'private.erase_prediction_sources_v1(text,uuid)',
  sourceMd5: 'f69c58702752ee797d92c5f649489363',
  before: '\n    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)',
  after: '\n    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)\n'
    + '    union all select 1 from private.personal_rating_allocations a where a.source_prediction_id=any(source_ids)\n'
    + '    union all select 1 from private.personal_rating_inputs i join private.personal_rating_allocations a on a.id=i.id where a.source_prediction_id=any(source_ids)\n'
    + '    union all select 1 from private.personal_rating_forecasts f join private.personal_rating_allocations a on a.id=f.id where a.source_prediction_id=any(source_ids)\n'
    + '    union all select 1 from private.personal_rating_answers r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)\n'
    + '    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)',
};

export function personalRatingProspectiveUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_personal_rating_prospective.sql'), 'Expected one numeric prospective forward');
  const patch = personalRatingProspectiveEraserPatch;
  return `begin;set local extra_float_digits=3;
    create temp table numeric_upgrade_tables(oid oid primary key,identity text,properties jsonb,digest text) on commit drop;
    do $snapshot$ declare r record;digest text;begin
      for r in select c.*,format('%I.%I',n.nspname,c.relname) identity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        insert into pg_temp.numeric_upgrade_tables values(r.oid,r.identity,
          to_jsonb(r)-array['identity','relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'],digest);
      end loop;
    end;$snapshot$;
    create temp table numeric_upgrade_columns on commit drop as select a.attrelid,a.attnum,to_jsonb(a) properties,
      to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_temp.numeric_upgrade_tables r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table numeric_upgrade_constraints on commit drop as select k.oid,to_jsonb(k) properties,pg_get_constraintdef(k.oid) definition
      from pg_constraint k join pg_temp.numeric_upgrade_tables r on r.oid=k.conrelid;
    create temp table numeric_upgrade_indexes on commit drop as select i.indexrelid,to_jsonb(i) properties,
      to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] relation_properties,
      pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_temp.numeric_upgrade_tables r on r.oid=i.indrelid
      join pg_class c on c.oid=i.indexrelid;
    create temp table numeric_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      to_jsonb(p)-'prosrc' properties,p.prosrc body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private','auth') and p.prokind='f';
    create temp table numeric_upgrade_triggers on commit drop as select t.oid,to_jsonb(t) properties,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_temp.numeric_upgrade_tables r on r.oid=t.tgrelid;
    do $predecessor$ begin
      if (select md5(body) from pg_temp.numeric_upgrade_functions where oid=${literal(patch.signature)}::regprocedure)
        is distinct from ${literal(patch.sourceMd5)} then raise exception 'Unexpected numeric upgrade eraser predecessor';end if;
      if (select count(*) from public.events)<2 or (select count(*) from private.prediction_page_receipts)<3
        or (select count(*) from private.prediction_candidates)=0 then raise exception 'Numeric upgrade requires populated real native sources';end if;
    end;$predecessor$;
    alter default privileges for role postgres grant execute on functions to public;
    alter default privileges for role postgres grant select,insert,update,delete on tables to public;
    create temp table numeric_upgrade_defaults on commit drop as select * from pg_default_acl;
    ${migration.sql}
    do $verify$ declare r record;digest text;expected text;role_name text;object_name text;response jsonb;begin
      if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in('public','private','auth'))<>(select count(*)+5 from pg_temp.numeric_upgrade_tables) then
        raise exception 'Numeric forward changed table set beyond five reviewed relations';end if;
      if (select array_agg(n.nspname||'.'||c.relname order by n.nspname,c.relname)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
        and n.nspname in('public','private','auth') and not exists(select 1 from pg_temp.numeric_upgrade_tables b where b.oid=c.oid))
        is distinct from array[${tables.map(name => 'private.' + name).sort().map(literal).join(',')}] then
        raise exception 'Numeric forward changed the reviewed new table identities';end if;
      for r in select * from pg_temp.numeric_upgrade_tables loop
        if not exists(select 1 from pg_class c where c.oid=r.oid and
          to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is not distinct from r.properties) then
          raise exception 'Numeric forward changed old table metadata: %',r.identity;end if;
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Numeric forward changed populated row bytes: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.numeric_upgrade_columns b left join pg_attribute a on a.attrelid=b.attrelid and a.attnum=b.attnum
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid is null
        or to_jsonb(a) is distinct from b.properties or to_jsonb(d) is distinct from b.default_properties
        or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression) then
        raise exception 'Numeric forward changed old columns or defaults';end if;
      if exists(select 1 from pg_temp.numeric_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or to_jsonb(k) is distinct from b.properties or pg_get_constraintdef(k.oid) is distinct from b.definition) then
        raise exception 'Numeric forward changed old constraints';end if;
      if exists(select 1 from pg_temp.numeric_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        left join pg_class c on c.oid=i.indexrelid where i.indexrelid is null or to_jsonb(i) is distinct from b.properties
        or to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is distinct from b.relation_properties
        or pg_get_indexdef(i.indexrelid) is distinct from b.definition) then raise exception 'Numeric forward changed old indexes';end if;
      if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in('public','private','auth') and p.prokind='f')<>(select count(*)+${functions.length} from pg_temp.numeric_upgrade_functions) then
        raise exception 'Numeric forward changed installed function set';end if;
      if (select array_agg(n.nspname||'.'||p.proname order by n.nspname,p.proname)
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f'
        and n.nspname in('public','private','auth') and not exists(select 1 from pg_temp.numeric_upgrade_functions b where b.oid=p.oid))
        is distinct from array[${functions.map(name => 'private.' + name).sort().map(literal).join(',')}] then
        raise exception 'Numeric forward changed the reviewed new function identities';end if;
      for r in select * from pg_temp.numeric_upgrade_functions loop
        if not exists(select 1 from pg_proc p where p.oid=r.oid and to_jsonb(p)-'prosrc' is not distinct from r.properties) then
          raise exception 'Numeric forward changed old function metadata: %',r.identity;end if;
        expected:=r.body;
        if r.oid=${literal(patch.signature)}::regprocedure then
          if cardinality(string_to_array(expected,${literal(patch.before)}))<>2 then raise exception 'Numeric approved eraser anchor unavailable';end if;
          expected:=replace(expected,${literal(patch.before)},${literal(patch.after)});
        end if;
        if (select prosrc from pg_proc where oid=r.oid) is distinct from expected then
          raise exception 'Numeric forward changed old function body beyond approved eraser expansion: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.numeric_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or to_jsonb(t) is distinct from b.properties or pg_get_triggerdef(t.oid) is distinct from b.definition) then
        raise exception 'Numeric forward changed old trigger metadata';end if;
      if (select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d)
        is distinct from (select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_temp.numeric_upgrade_defaults d) then
        raise exception 'Numeric forward changed default privileges';end if;
      foreach role_name in array array['anon','authenticated','service_role'] loop
        foreach object_name in array array[${tables.map(name => literal('private.' + name)).join(',')}] loop
          if has_table_privilege(role_name,object_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
            raise exception 'Numeric new table permission leaked: %/%',role_name,object_name;end if;
          if not exists(select 1 from pg_class c where c.oid=object_name::regclass and c.relrowsecurity) then
            raise exception 'Numeric new private table lacks RLS: %',object_name;end if;
        end loop;
        for r in select p.oid,p.oid::regprocedure::text identity from pg_proc p
          where p.pronamespace='private'::regnamespace and p.proname=any(array[${functions.map(literal).join(',')}]) loop
          if has_function_privilege(role_name,r.oid,'EXECUTE') then
            raise exception 'Numeric new function EXECUTE leaked: %/%',role_name,r.identity;end if;
        end loop;
      end loop;
      for r in select * from private.prediction_page_receipts order by request_id loop
        perform set_config('request.jwt.claim.sub',r.actor_user_id::text,true);
        perform set_config('role','authenticated',true);response:=public.rank_items_page_v1(r.request);
        perform set_config('role','postgres',true);
        if response is distinct from r.response then raise exception 'Numeric forward changed old page exact retry';end if;
      end loop;
      for r in select * from pg_temp.numeric_upgrade_tables loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Numeric source retry changed retained row bytes: %',r.identity;end if;
      end loop;
    end;$verify$;
    select jsonb_build_object('status','PASS','version','native-personal-rating-prospective-upgrade-v1',
      'existingTables',(select count(*) from pg_temp.numeric_upgrade_tables),
      'existingFunctions',(select count(*) from pg_temp.numeric_upgrade_functions),
      'existingEvents',(select count(*) from public.events),'retainedPageRetries',(select count(*) from private.prediction_page_receipts),
      'newPrivateTables',5,'newPrivateFunctions',${functions.length},'changedOldBodies',1,
      'oldRowsAndMetadata','UNCHANGED','newPrivateACL','CLOSED_UNDER_BROAD_DEFAULTS','qualityAdmission','NONE','servingActivation','NONE');
    rollback;`;
}

export async function verifyPersonalRatingProspectiveUpgrade(execSql, migration) {
  return withPersonalRatingProspectiveFixture(execSql, null, async ({ exec, snapshot }) => {
    const before = await snapshot();
    let result;
    try { [result] = await exec(personalRatingProspectiveUpgradeSql(migration), 'populated-upgrade'); }
    catch (error) { await exec('rollback;', 'upgrade-rollback').catch(() => {});throw error; }
    assert.equal(result?.status, 'PASS');
    assert.deepEqual(await snapshot(), before, 'Numeric upgrade rollback changed canonical predecessor rows');
    return { ...result, migration: migration.name, migrationSha256: createHash('sha256').update(migration.sql).digest('hex'),
      cleanup: 'CANONICAL_PREDECESSOR_RESTORED' };
  });
}
