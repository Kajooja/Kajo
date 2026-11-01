import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { withPersonalRatingProspectiveFixture, answer, inspect, json, literal } from './personal-rating-prospective.mjs';

const tables = ['personal_rating_content_source_refs', 'personal_rating_content_alias_refs',
  'personal_rating_content_review_revocations'];
const functions = ['guard_personal_rating_content_artifact_v1', 'withdraw_personal_rating_content_source_v1',
  'check_personal_rating_content_withdrawal_budget_v1',
  'retire_personal_rating_content_review_v1', 'withdraw_personal_rating_content_review_v1',
  'validate_personal_rating_feature_use_v1', 'personal_rating_content_mapping_v1',
  'capture_personal_rating_content_v1', 'prepare_personal_rating_forecast_v2', 'finalize_personal_rating_forecast_v2'];

// Independent reviewed replacements, never parsed from the candidate forward.
// All metadata and every other existing function body must remain identical.
export const personalContentRatingUpgradePatches = [{
  signature: 'private.prepare_personal_rating_forecast_v1(uuid,uuid,uuid,integer,text)',
  sourceMd5: '25446e05b218298a957f283bdc666c57',
  before: "    return prepared||jsonb_build_object('forecast',stored);",
  after: "    if prepared->>'version' is distinct from 'kajo-personal-rating-preparation-v1' then\n"
    + "      raise exception 'Numeric preparation generation mismatch' using errcode='22023';end if;\n"
    + "    return prepared||jsonb_build_object('forecast',stored);",
}, {
  signature: 'private.finalize_personal_rating_forecast_v1(uuid,jsonb)',
  sourceMd5: 'a9296700aaf6353e6d652849a1bf2412',
  before: '  select f.forecast into prior from private.personal_rating_forecasts f where f.id=forecast_id;',
  after: "  if i.preparation->>'version' is distinct from 'kajo-personal-rating-preparation-v1' then\n"
    + "    raise exception 'Numeric preparation generation mismatch' using errcode='22023';end if;\n"
    + '  select f.forecast into prior from private.personal_rating_forecasts f where f.id=forecast_id;',
}, {
  signature: 'private.erase_prediction_sources_v1(text,uuid)',
  sourceMd5: '9c8f602da5c13bb870f693b2e21eea3c',
  before: '    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)',
  after: '    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)\n'
    + '    union all select 1 from private.personal_rating_content_source_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)\n'
    + '    union all select 1 from private.personal_rating_content_alias_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)',
}];

const newColumns = {
  personal_rating_content_source_refs: [['forecast_id', 'uuid', true], ['source_id', 'uuid', true]],
  personal_rating_content_alias_refs: [['forecast_id', 'uuid', true], ['namespace', 'text', true], ['external_id', 'text', true]],
  personal_rating_content_review_revocations: [['actor_user_id', 'uuid', true], ['review_ref', 'text', true]],
};
const newTriggers = [
  'private.item_external_ids:personal_rating_content_alias_withdrawal:withdraw_personal_rating_content_source_v1',
  'private.item_sources:personal_rating_content_source_withdrawal:withdraw_personal_rating_content_source_v1',
  'private.personal_rating_content_alias_refs:personal_rating_content_alias_immutable:guard_personal_rating_content_artifact_v1',
  'private.personal_rating_content_review_revocations:personal_rating_content_review_immutable:guard_personal_rating_content_artifact_v1',
  'private.personal_rating_content_review_revocations:personal_rating_content_review_withdrawal:retire_personal_rating_content_review_v1',
  'private.personal_rating_content_source_refs:personal_rating_content_source_immutable:guard_personal_rating_content_artifact_v1',
];

export function personalContentRatingUpgradeSql(migration, retained) {
  assert.ok(migration.name.endsWith('_personal_content_rating.sql'), 'Expected the content rating forward');
  assert.equal(retained.length, 3, 'Populated upgrade requires measured, pending and unavailable V1 captures');
  return `begin;set local extra_float_digits=3;
    create temp table content_upgrade_tables(oid oid primary key,identity text,properties jsonb,digest text) on commit drop;
    do $snapshot$ declare r record;digest text;begin
      for r in select c.*,format('%I.%I',n.nspname,c.relname) identity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        insert into pg_temp.content_upgrade_tables values(r.oid,r.identity,
          to_jsonb(r)-array['identity','relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'],digest);
      end loop;
    end;$snapshot$;
    create temp table content_upgrade_columns on commit drop as select a.attrelid,a.attnum,to_jsonb(a) properties,
      to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_temp.content_upgrade_tables r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table content_upgrade_constraints on commit drop as select k.oid,to_jsonb(k) properties,pg_get_constraintdef(k.oid) definition
      from pg_constraint k join pg_temp.content_upgrade_tables r on r.oid=k.conrelid;
    create temp table content_upgrade_indexes on commit drop as select i.indexrelid,to_jsonb(i) properties,
      to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] relation_properties,
      pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_temp.content_upgrade_tables r on r.oid=i.indrelid
      join pg_class c on c.oid=i.indexrelid;
    create temp table content_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      to_jsonb(p)-'prosrc' properties,p.prosrc body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private','auth') and p.prokind='f';
    create temp table content_upgrade_triggers on commit drop as select t.oid,to_jsonb(t) properties,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_temp.content_upgrade_tables r on r.oid=t.tgrelid;
    create temp table content_upgrade_policies on commit drop as select p.oid,to_jsonb(p) properties
      from pg_policy p join pg_temp.content_upgrade_tables r on r.oid=p.polrelid;
    create temp table content_upgrade_schemas on commit drop as select oid,to_jsonb(n) properties from pg_namespace n
      where nspname in('public','private','auth');
    do $predecessor$ declare patch jsonb;begin
      for patch in select value from jsonb_array_elements(${json(personalContentRatingUpgradePatches)}) loop
        if (select md5(body) from pg_temp.content_upgrade_functions where oid=(patch->>'signature')::regprocedure)
          is distinct from patch->>'sourceMd5' then raise exception 'Unexpected content upgrade predecessor: %',patch->>'signature';end if;
      end loop;
      if (select count(*) from private.personal_rating_inputs)<>3 or (select count(*) from private.personal_rating_forecasts)<>3
        or (select count(*) from private.personal_rating_answers)<>1
        or (select count(*) from private.personal_rating_event_refs)<2 then
        raise exception 'Content upgrade requires populated actual V1 captures and first answer';end if;
    end;$predecessor$;
    alter default privileges for role postgres grant execute on functions to public;
    alter default privileges for role postgres grant select,insert,update,delete on tables to public;
    create temp table content_upgrade_defaults on commit drop as select * from pg_default_acl;
    ${migration.sql}
    do $verify$ declare r record;digest text;expected text;role_name text;object_name text;response jsonb;
      patch jsonb;capture jsonb;expected_columns jsonb;begin
      if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in('public','private','auth'))<>(select count(*)+3 from pg_temp.content_upgrade_tables) then
        raise exception 'Content forward changed table set beyond three reviewed relations';end if;
      if (select array_agg(n.nspname||'.'||c.relname order by n.nspname,c.relname)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
        and n.nspname in('public','private','auth') and not exists(select 1 from pg_temp.content_upgrade_tables b where b.oid=c.oid))
        is distinct from array[${tables.map(name => 'private.' + name).sort().map(literal).join(',')}] then
        raise exception 'Content forward changed reviewed new table identities';end if;
      for r in select * from pg_temp.content_upgrade_tables loop
        if not exists(select 1 from pg_class c where c.oid=r.oid and
          to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is not distinct from r.properties) then
          raise exception 'Content forward changed old table metadata: %',r.identity;end if;
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Content forward changed populated row bytes: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.content_upgrade_columns b left join pg_attribute a on a.attrelid=b.attrelid and a.attnum=b.attnum
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid is null
        or to_jsonb(a) is distinct from b.properties or to_jsonb(d) is distinct from b.default_properties
        or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression)
        or (select count(*) from pg_attribute a join pg_temp.content_upgrade_tables b on b.oid=a.attrelid
          where a.attnum>0 and not a.attisdropped)<>(select count(*) from pg_temp.content_upgrade_columns) then
        raise exception 'Content forward changed old columns or defaults';end if;
      if exists(select 1 from pg_temp.content_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or to_jsonb(k) is distinct from b.properties or pg_get_constraintdef(k.oid) is distinct from b.definition)
        or (select count(*) from pg_constraint k join pg_temp.content_upgrade_tables b on b.oid=k.conrelid)
          <>(select count(*) from pg_temp.content_upgrade_constraints) then raise exception 'Content forward changed old constraints';end if;
      if exists(select 1 from pg_temp.content_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        left join pg_class c on c.oid=i.indexrelid where i.indexrelid is null or to_jsonb(i) is distinct from b.properties
        or to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is distinct from b.relation_properties
        or pg_get_indexdef(i.indexrelid) is distinct from b.definition)
        or (select count(*) from pg_index i join pg_temp.content_upgrade_tables b on b.oid=i.indrelid)
          <>(select count(*) from pg_temp.content_upgrade_indexes) then raise exception 'Content forward changed old indexes';end if;
      if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in('public','private','auth') and p.prokind='f')<>(select count(*)+${functions.length} from pg_temp.content_upgrade_functions) then
        raise exception 'Content forward changed installed function set';end if;
      if (select array_agg(n.nspname||'.'||p.proname order by n.nspname,p.proname)
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f'
        and n.nspname in('public','private','auth') and not exists(select 1 from pg_temp.content_upgrade_functions b where b.oid=p.oid))
        is distinct from array[${functions.map(name => 'private.' + name).sort().map(literal).join(',')}] then
        raise exception 'Content forward changed reviewed new function identities';end if;
      for r in select * from pg_temp.content_upgrade_functions loop
        if not exists(select 1 from pg_proc p where p.oid=r.oid and to_jsonb(p)-'prosrc' is not distinct from r.properties) then
          raise exception 'Content forward changed old function metadata: %',r.identity;end if;
        expected:=r.body;
        for patch in select value from jsonb_array_elements(${json(personalContentRatingUpgradePatches)}) loop
          if r.oid=(patch->>'signature')::regprocedure then
            if cardinality(string_to_array(expected,patch->>'before'))<>2 then raise exception 'Content approved patch anchor unavailable';end if;
            expected:=replace(expected,patch->>'before',patch->>'after');
          end if;
        end loop;
        if (select prosrc from pg_proc where oid=r.oid) is distinct from expected then
          raise exception 'Content forward changed old body beyond approved generation/eraser patch: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.content_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or to_jsonb(t) is distinct from b.properties or pg_get_triggerdef(t.oid) is distinct from b.definition) then
        raise exception 'Content forward changed old trigger metadata';end if;
      if (select array_agg(n.nspname||'.'||c.relname||':'||t.tgname||':'||p.proname order by n.nspname,c.relname,t.tgname)
        from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
        join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and n.nspname in('public','private','auth')
          and not exists(select 1 from pg_temp.content_upgrade_triggers b where b.oid=t.oid))
        is distinct from array[${newTriggers.sort().map(literal).join(',')}] then raise exception 'Content forward changed reviewed new triggers';end if;
      if exists(select 1 from pg_temp.content_upgrade_policies b left join pg_policy p on p.oid=b.oid
        where p.oid is null or to_jsonb(p) is distinct from b.properties)
        or (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
          where n.nspname in('public','private','auth'))<>(select count(*) from pg_temp.content_upgrade_policies) then
        raise exception 'Content forward changed RLS policies';end if;
      if exists(select 1 from pg_temp.content_upgrade_schemas b left join pg_namespace n on n.oid=b.oid
        where n.oid is null or to_jsonb(n) is distinct from b.properties) then raise exception 'Content forward changed schema metadata/ACL';end if;
      if (select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d)
        is distinct from (select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_temp.content_upgrade_defaults d) then
        raise exception 'Content forward changed default privileges';end if;
      for object_name,expected_columns in select key,value from jsonb_each(${json(newColumns)}) loop
        if (select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum)
          from pg_attribute a where a.attrelid=('private.'||object_name)::regclass and a.attnum>0 and not a.attisdropped)
          is distinct from expected_columns
          or exists(select 1 from pg_attribute a where a.attrelid=('private.'||object_name)::regclass and a.attnum>0
            and (a.atthasdef or a.attidentity<>'' or a.attgenerated<>'')) then
          raise exception 'Content new table columns changed: %',object_name;end if;
        execute format('select count(*) from private.%I',object_name) into digest;
        if digest<>'0' then raise exception 'Content new table must start empty: %',object_name;end if;
      end loop;
      foreach role_name in array array['anon','authenticated','service_role'] loop
        foreach object_name in array array[${tables.map(name => literal('private.' + name)).join(',')}] loop
          if has_table_privilege(role_name,object_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
            raise exception 'Content new table permission leaked: %/%',role_name,object_name;end if;
          if not exists(select 1 from pg_class c where c.oid=object_name::regclass and c.relrowsecurity
            and c.relowner='postgres'::regrole and c.relkind='r') then
            raise exception 'Content new private table lacks expected RLS/owner: %',object_name;end if;
        end loop;
        for r in select p.* from pg_proc p where p.pronamespace='private'::regnamespace
          and p.proname=any(array[${functions.map(literal).join(',')}]) loop
          if has_function_privilege(role_name,r.oid,'EXECUTE') then
            raise exception 'Content new function EXECUTE leaked: %/%',role_name,r.proname;end if;
          if r.prosecdef is distinct from (r.proname='withdraw_personal_rating_content_source_v1')
            or r.proowner<>'postgres'::regrole or r.proconfig is distinct from array['search_path=""']::text[] then
            raise exception 'Content new function security metadata changed: %',r.proname;end if;
        end loop;
      end loop;
      for capture in select value from jsonb_array_elements(${json(retained)}) loop
        perform set_config('request.jwt.claim.sub',capture->>'actor',true);
        response:=private.prepare_personal_rating_forecast_v1((capture->>'id')::uuid,(capture->>'source')::uuid,
          (capture->>'target')::uuid,3600,'synthetic');
        if response is distinct from capture->'stored' then raise exception 'Content forward changed old V1 preparation retry';end if;
        response:=private.finalize_personal_rating_forecast_v1((capture->>'id')::uuid,capture#>'{stored,forecast}');
        if response is distinct from capture->'stored' then raise exception 'Content forward changed old V1 finalize retry';end if;
        if capture->'command'<>'null'::jsonb then
          response:=private.commit_personal_rating_answer_v1((capture->>'id')::uuid,capture->'command');
          if response is distinct from capture->'firstAnswer' then raise exception 'Content forward changed old V1 first-answer retry';end if;
        end if;
        response:=private.inspect_personal_rating_forecast_v1((capture->>'id')::uuid);
        if response is distinct from capture->'inspection' then raise exception 'Content forward changed old V1 inspection';end if;
      end loop;
      for r in select * from private.prediction_page_receipts order by request_id loop
        perform set_config('request.jwt.claim.sub',r.actor_user_id::text,true);
        perform set_config('role','authenticated',true);response:=public.rank_items_page_v1(r.request);
        perform set_config('role','postgres',true);
        if response is distinct from r.response then raise exception 'Content forward changed old page exact retry';end if;
      end loop;
      for r in select * from pg_temp.content_upgrade_tables loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Content upgrade retry changed retained row bytes: %',r.identity;end if;
      end loop;
    end;$verify$;
    select jsonb_build_object('status','PASS','version','native-personal-content-rating-upgrade-v1',
      'existingTables',(select count(*) from pg_temp.content_upgrade_tables),
      'existingFunctions',(select count(*) from pg_temp.content_upgrade_functions),
      'retainedPageRetries',(select count(*) from private.prediction_page_receipts),
      'retainedV1Captures',3,'retainedV1FirstAnswers',1,'newPrivateTables',3,'newPrivateFunctions',${functions.length},
      'changedOldBodies',3,'oldRowsAndMetadata','UNCHANGED_EXCEPT_REVIEWED_BODY_PATCHES',
      'v1CaptureAndFirstAnswerRetries','EXACT','newPrivateACL','CLOSED_UNDER_BROAD_DEFAULTS',
      'newTables','EMPTY_RLS_CLOSED','qualityAdmission','NONE','servingActivation','NONE');
    rollback;`;
}

export async function verifyPersonalContentRatingUpgrade(execSql, withSqlSession, migration) {
  return withPersonalRatingProspectiveFixture(execSql, withSqlSession, async ({ f, exec, call, capture, command, snapshot }) => {
    const measured = await capture(f.targets[0]);
    const firstCommand = await command(f.targets[0], 0, { source: measured.preparation.sourcePredictionId });
    const firstAnswer = await call(answer(measured.preparation.forecastId, firstCommand));
    const pending = await capture(f.targets[1]);
    const unavailable = await capture(f.coldTargets[2], { actor: f.cold.actor, source: f.coldSource });
    const retained = [];
    for (const [captured, actor, target, measuredCommand, measuredAnswer] of [
      [measured, f.actor, f.targets[0], firstCommand, firstAnswer],
      [pending, f.actor, f.targets[1], null, null],
      [unavailable, f.cold.actor, f.coldTargets[2], null, null],
    ]) retained.push({ actor, target, id: captured.preparation.forecastId, source: captured.preparation.sourcePredictionId,
      stored: captured.stored, inspection: await call(inspect(captured.preparation.forecastId), actor),
      command: measuredCommand, firstAnswer: measuredAnswer });
    assert.equal(firstAnswer.rating, 0);
    assert.equal(retained[0].inspection.coverage, 'MEASURED_FIRST_RATING');
    assert.equal(retained[1].inspection.coverage, 'PENDING_FIRST_REPORT');
    assert.equal(unavailable.forecast.location.personalMean, null);
    const before = await snapshot();let result;
    try { [result] = await exec(personalContentRatingUpgradeSql(migration, retained), 'content-populated-upgrade'); }
    catch (error) { await exec('rollback;', 'content-upgrade-rollback').catch(() => {});throw error; }
    assert.equal(result?.status, 'PASS');
    assert.deepEqual(await snapshot(), before, 'Content upgrade rollback changed populated predecessor rows');
    return { ...result, migration: migration.name, migrationSha256: createHash('sha256').update(migration.sql).digest('hex'),
      actualForecast: 'COMPILED_V1_TYPESCRIPT_BEFORE_UPGRADE_AND_FIRST_ANSWER', cleanup: 'CANONICAL_PREDECESSOR_RESTORED' };
  });
}
