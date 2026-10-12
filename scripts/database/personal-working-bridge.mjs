import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { personalNativeDecayFixtureSql } from './personal-native-decay.mjs';

// Reviewed old-body transforms, separate from the forward SQL for preservation checks.
const rankerReplacements = [
  { before: '  current_state jsonb;', after: '  current_state jsonb;\n  current_working_state jsonb;', count: 1 },
  { before: '  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);',
    after: `  current_state := private.build_profile_memory_state_v1(target_profile_id, request_time);
  current_working_state := private.capture_personal_working_state_v1(
    current_actor_user_id,target_profile_id,requested_session_id,request_time);
  if current_working_state is not null then
    current_state := current_state || jsonb_build_object('workingState',current_working_state);
  end if;`, count: 1 },
  { before: "  end || '+frozen-replay-v2+eligibility-first-v1';",
    after: `  end || '+frozen-replay-v2+eligibility-first-v1';
  if current_working_state is not null then
    current_policy_version := current_policy_version || '+personal-working-off-v1';
  end if;`, count: 1 },
  { before: `      private.prediction_candidate_score_v2(
        requested_mode,
        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit),
        scenario_enriched.scenario_score,
        serving_genome_config
      ) as final_score,`,
    after: `      private.prediction_candidate_score_working_v1(
        requested_mode,
        scenario_enriched.explanation || jsonb_build_object('sharedCommonFit', scenario_enriched.shared_common_fit)
          || private.personal_working_explanation_v1(current_working_state,scenario_enriched.tags),
        scenario_enriched.scenario_score,
        serving_genome_config,'OFF'
      ) as final_score,`, count: 1 },
  { before: "          'sharedCommonFit', rescored.shared_common_fit\n        )",
    after: "          'sharedCommonFit', rescored.shared_common_fit\n        ) || private.personal_working_explanation_v1(current_working_state,rescored.tags)", count: 1 },
];

export const personalWorkingBridgePatches = [
  { signature: 'private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)',
    sourceMd5: 'd4853d50c3bb2da1ad9f807c4548010b', replacements: rankerReplacements },
  { signature: 'private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)',
    sourceMd5: 'f57dada80dfafd3630624f7e6ac9e9b5', replacements: rankerReplacements.map(patch =>
      patch.before.includes("  end || '+frozen-replay-v2+eligibility-first-v1';")
        ? { ...patch, before: patch.before.replace('eligibility-first-v1','eligibility-first-v1+catalog-chain-v1'),
          after: patch.after.replace('eligibility-first-v1','eligibility-first-v1+catalog-chain-v1') } : patch) },
  { signature: 'private.erase_prediction_sources_v1(text,uuid)',
    sourceMd5: '9c5f87a2f535b72d70e048a5dd46bc68', replacements: [{
      before: '    union all select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)\n    limit 250001) bounded;',
      after: '    union all select 1 from private.shared_round_vector_comparisons c where c.id=any(comparison_ids)\n    union all select 1 from private.personal_working_shadow_comparisons c where c.source_prediction_id=any(source_ids)\n    limit 250001) bounded;', count: 1,
    }] },
  { signature: 'private.open_prediction_window_v1(uuid)',
    sourceMd5: '0735bf53841890557764031cb897cc1a', replacements: [{
      before: "    or run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1' then",
      after: "    or (run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1'\n      and run.policy_version not like '%+frozen-replay-v2+eligibility-first-v1+personal-working-off-v1') then", count: 1,
    }] },
];

export async function personalWorkingBridgeSmokeSql() {
  const fixture = await readFile(new URL('personal-working-bridge-fixture.sql', import.meta.url), 'utf8');
  return `begin;${fixture}\nrollback;`;
}

// Runs over the actual populated pre-bridge source, including real Personal and
// Shared BOOK/MOVIE V2/V3 forecasts and their already recorded native shadows.
// The SQL receipt proves source preservation; it makes no concurrency claim.
export async function personalWorkingBridgeUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_personal_working_bridge.sql'), 'Expected one new bounded Personal Working forward');
  assert.equal(personalWorkingBridgePatches.length, 4, 'Only four reviewed installed bodies may change');
  const literal = value => `$working_upgrade_text$${value}$working_upgrade_text$`;
  const patches = personalWorkingBridgePatches.flatMap(patch => patch.replacements.map((replacement, ordinal) =>
    `(${literal(patch.signature)}::regprocedure::text,${ordinal},${literal(replacement.before)},${literal(replacement.after)},${replacement.count})`)).join(',\n');
  return `begin;
    ${await personalNativeDecayFixtureSql()}
    create temp table working_upgrade_tables(oid oid primary key,identity text,properties jsonb,digest text) on commit drop;
    do $snapshot$ declare r record;digest text;begin
      for r in select c.*,format('%I.%I',n.nspname,c.relname) identity from pg_class c
        join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        insert into pg_temp.working_upgrade_tables values(r.oid,r.identity,
          to_jsonb(r)-array['identity','relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'],digest);
      end loop;
    end;$snapshot$;
    create temp table working_upgrade_columns on commit drop as select a.attrelid,a.attnum,to_jsonb(a) properties,
      to_jsonb(d) default_properties,pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_temp.working_upgrade_tables r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table working_upgrade_constraints on commit drop as select k.oid,to_jsonb(k) properties,
      pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_temp.working_upgrade_tables r on r.oid=k.conrelid;
    create temp table working_upgrade_indexes on commit drop as select i.indexrelid,to_jsonb(i) properties,
      to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] relation_properties,
      pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_temp.working_upgrade_tables r on r.oid=i.indrelid
      join pg_class c on c.oid=i.indexrelid;
    create temp table working_upgrade_functions on commit drop as select p.oid,p.oid::regprocedure::text identity,
      to_jsonb(p)-'prosrc' properties,p.prosrc body,pg_get_functiondef(p.oid) definition
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f';
    create temp table working_upgrade_triggers on commit drop as select t.oid,to_jsonb(t) properties,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_temp.working_upgrade_tables r on r.oid=t.tgrelid;
    create temp table working_upgrade_patches(identity text,ordinal integer,before text,after text,expected_count integer) on commit drop;
    insert into pg_temp.working_upgrade_patches values ${patches};
    -- Challenge explicit new-object revokes under broad default permissions.
    alter default privileges for role postgres grant execute on functions to public;
    alter default privileges for role postgres grant select,insert,update,delete on tables to public;
    ${migration.sql}
    do $verify$ declare r record;p record;expected text;digest text;page record;result jsonb;role_name text;signature text;begin
      for r in select * from pg_temp.working_upgrade_tables loop
        if not exists(select 1 from pg_class c where c.oid=r.oid and
          to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is not distinct from r.properties) then
          raise exception 'Personal working forward changed an old table identity/owner/ACL/RLS: %',r.identity;end if;
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Personal working forward changed a populated old row: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.working_upgrade_columns b left join pg_attribute a on a.attrelid=b.attrelid and a.attnum=b.attnum
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid is null
        or to_jsonb(a) is distinct from b.properties or to_jsonb(d) is distinct from b.default_properties
        or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression) then
        raise exception 'Personal working forward changed an old column/default identity or definition';end if;
      if exists(select 1 from pg_temp.working_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or to_jsonb(k) is distinct from b.properties or pg_get_constraintdef(k.oid) is distinct from b.definition) then
        raise exception 'Personal working forward changed an old constraint';end if;
      if exists(select 1 from pg_temp.working_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        left join pg_class c on c.oid=i.indexrelid where i.indexrelid is null or to_jsonb(i) is distinct from b.properties
        or to_jsonb(c)-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] is distinct from b.relation_properties
        or pg_get_indexdef(i.indexrelid) is distinct from b.definition) then raise exception 'Personal working forward changed an old index';end if;
      for r in select * from pg_temp.working_upgrade_functions loop
        if not exists(select 1 from pg_proc f where f.oid=r.oid and to_jsonb(f)-'prosrc' is not distinct from r.properties) then
          raise exception 'Personal working forward changed an old function identity/owner/ACL/config: %',r.identity;end if;
        expected := r.body;
        for p in select * from pg_temp.working_upgrade_patches where identity=r.identity order by ordinal loop
          if cardinality(string_to_array(expected,p.before))<>p.expected_count+1 then
            raise exception 'Personal working approved source anchor unavailable: %',r.identity;end if;
          expected := replace(expected,p.before,p.after);
        end loop;
        if (select prosrc from pg_proc where oid=r.oid) is distinct from expected then
          raise exception 'Personal working forward changed an old body beyond approved exact patches: %',r.identity;end if;
      end loop;
      if exists(select 1 from pg_temp.working_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or to_jsonb(t) is distinct from b.properties or pg_get_triggerdef(t.oid) is distinct from b.definition) then
        raise exception 'Personal working forward changed an old trigger';end if;
      for page in select * from pg_temp.native_decay_pages loop
        perform set_config('request.jwt.claim.sub',page.actor::text,true);perform set_config('role','authenticated',true);
        result := public.rank_items_page_v1(page.request);perform set_config('role','postgres',true);
        if result is distinct from page.response then raise exception 'Personal working forward changed an exact old V2/V3 page receipt';end if;
      end loop;
      for r in select * from pg_temp.working_upgrade_tables loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',r.identity) into digest;
        if digest is distinct from r.digest then raise exception 'Personal working receipt retry mutated old rows: %',r.identity;end if;
      end loop;
      foreach role_name in array array['anon','authenticated','service_role'] loop
        foreach signature in array array[
          'private.capture_personal_working_state_v1(uuid,uuid,uuid,timestamptz)',
          'private.personal_working_adjustment_v1(jsonb,text[],text)',
          'private.personal_working_explanation_v1(jsonb,text[])',
          'private.prediction_candidate_score_working_v1(text,jsonb,double precision,jsonb,text)',
          'private.guard_personal_working_comparison_v1()',
          'private.record_personal_working_shadow_v1(uuid,text)'] loop
          if has_function_privilege(role_name,signature,'EXECUTE') then
            raise exception 'Personal working helper retained broad default EXECUTE: %/%',role_name,signature;end if;
        end loop;
        if has_table_privilege(role_name,'private.personal_working_shadow_comparisons','SELECT,INSERT,UPDATE,DELETE') then
          raise exception 'Personal working comparison retained broad default table permission: %',role_name;end if;
      end loop;
    end;$verify$;
    select jsonb_build_object('personalWorkingBridgeUpgrade',
      'PASS: every populated old application/Auth row and existing object preserved; only four reviewed installed bodies change; old V2/V3 receipts and native shadows remain exact; new private ACL overrides broad defaults') snapshot;
    rollback;`;
}
