import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sharedRoundOutcomeCapturesFixtureSql } from './shared-round-outcome-captures.mjs';

const sharedGate = `  -- Serialize prediction-source lifecycle before existing row or receipt locks.
  perform pg_catalog.pg_advisory_xact_lock_shared(1946841873,232004);
`;
const mutationGuard = `  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Prediction lifecycle writes require READ COMMITTED' using errcode='25001';
  end if;
`;
const gateDelta = (signature, mutation, extra = []) => ({ signature,
  pairs: [['\nbegin\n', `\nbegin\n${sharedGate}${mutation ? mutationGuard : ''}`], ...extra] });
const afterReceipt = ["    return prior.result;\n  end if;\n", `    return prior.result;\n  end if;\n${mutationGuard}`];
const lifecycleDeltas = [
  gateDelta('private.process_shadow_prediction_jobs_v1(integer)', true),
  gateDelta('private.evaluate_shadow_genome_v1(uuid,uuid)', true, [
    ['  evidence_cutoff timestamptz := clock_timestamp();', '  evidence_cutoff timestamptz;'],
    [sharedGate + mutationGuard, sharedGate + mutationGuard + '  evidence_cutoff := pg_catalog.clock_timestamp();\n'],
  ]),
  gateDelta('private.manual_profile_canary_v1(uuid,uuid,uuid,text,text)', true),
  gateDelta('private.rollback_profile_canary_v1(uuid,text,text)', true),
  gateDelta('private.compare_shared_round_outcome_capture_v1(uuid,uuid,uuid,uuid)', false),
  gateDelta('private.rank_items_page_v1(jsonb)', false, [
    ['  profile_id uuid; request_id uuid; now_at timestamptz := clock_timestamp();', '  profile_id uuid; request_id uuid; now_at timestamptz;'],
    [sharedGate, sharedGate + '  now_at := pg_catalog.clock_timestamp();\n'],
  ]),
  gateDelta('private.rank_items_first_page_v1(jsonb)', false, [
    ['    return receipt.response;\n  end if;\n  prediction_id := gen_random_uuid();',
      `    return receipt.response;\n  end if;\n${mutationGuard}  prediction_id := gen_random_uuid();`],
  ]),
  gateDelta('private.rank_items_frozen_page_v2(jsonb)', false, [
    ['    return receipt.response;\n  end if;\n\n  prediction_id := gen_random_uuid();',
      `    return receipt.response;\n  end if;\n${mutationGuard}\n  prediction_id := gen_random_uuid();`],
  ]),
  gateDelta('private.rank_items_catalog_chain_v1(jsonb)', false, [
    ['    return receipt.response;\n  end if;\n  now_at := clock_timestamp();',
      `    return receipt.response;\n  end if;\n${mutationGuard}  now_at := clock_timestamp();`],
    ['  availability text; continuation_state text; now_at timestamptz := clock_timestamp();', '  availability text; continuation_state text; now_at timestamptz;'],
  ]),
  ...['private.rank_items_with_identity_v1(uuid,uuid,text,text,integer,jsonb)',
    'private.rank_items_catalog_with_identity_v1(uuid[],boolean,uuid,uuid,text,text,integer,jsonb)'].map(signature =>
    gateDelta(signature, true, [
      ['  request_time timestamptz := clock_timestamp();', '  request_time timestamptz;'],
      [sharedGate + mutationGuard, sharedGate + mutationGuard + '  request_time := pg_catalog.clock_timestamp();\n'],
    ])),
  ...['private.commit_item_action_v1(jsonb)', 'private.commit_collection_action_v1(jsonb)',
    'private.commit_shared_rating_round_v1(jsonb)'].map(signature => gateDelta(signature, false, [afterReceipt])),
  gateDelta('private.open_prediction_window_v1(uuid)', false, [
    ['  if found then return private.read_prediction_window_v1(existing_id); end if;\n',
      `  if found then return private.read_prediction_window_v1(existing_id); end if;\n${mutationGuard}`],
  ]),
];
const deltaSql = lifecycleDeltas.map(({ signature, pairs }) =>
  `('${signature}'::regprocedure,'${JSON.stringify(pairs).replaceAll("'", "''")}'::jsonb)`).join(',\n');

export async function shadowSourceErasureFixtureSql() {
  return `${await sharedRoundOutcomeCapturesFixtureSql()}\n${await readFile(new URL('shadow-source-erasure-fixture.sql', import.meta.url), 'utf8')}`;
}

export async function shadowSourceErasureSmokeSql() {
  return `begin; ${await shadowSourceErasureFixtureSql()}\n${await readFile(new URL('shadow-source-erasure-smoke.sql', import.meta.url), 'utf8')}\nrollback;`;
}

// The forward deliberately changes only immutable erasure guards and writer
// entry locking. Preserve every old row and every unrelated definition exactly.
export async function shadowSourceErasureUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_shadow_source_erasure.sql'), 'Expected the guarded source erasure forward');
  return `begin;
    ${await shadowSourceErasureFixtureSql()}
    create temp table erasure_upgrade_rows on commit drop as select c.oid,c.relowner,c.relacl,c.relrowsecurity,
      format('%I.%I',n.nspname,c.relname) identity from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and (n.nspname in ('public','private') or (n.nspname='auth' and c.relname='users'));
    create temp table erasure_upgrade_columns on commit drop as select a.attrelid,a.attnum,to_jsonb(a) definition,
      pg_get_expr(d.adbin,d.adrelid) default_expression from pg_attribute a join pg_temp.erasure_upgrade_rows r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table erasure_upgrade_constraints on commit drop as select k.oid,pg_get_constraintdef(k.oid) definition,
      k.convalidated,k.condeferrable,k.condeferred from pg_constraint k join pg_temp.erasure_upgrade_rows r on r.oid=k.conrelid;
    create temp table erasure_upgrade_indexes on commit drop as select i.indexrelid,pg_get_indexdef(i.indexrelid) definition,
      i.indisvalid,i.indisready,i.indisreplident,i.indisclustered from pg_index i join pg_temp.erasure_upgrade_rows r on r.oid=i.indrelid;
    create temp table erasure_upgrade_deltas(oid oid primary key,pairs jsonb) on commit drop;
    insert into pg_temp.erasure_upgrade_deltas values ${deltaSql};
    create temp table erasure_upgrade_functions on commit drop as select p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig,
      p.prosrc body,exists(select 1 from pg_temp.erasure_upgrade_deltas d where d.oid=p.oid) approved_entry,
      p.oid='private.reject_immutable_prediction_artifact_change_v1()'::regprocedure approved_guard,
      pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private') and p.prokind='f';
    create temp table erasure_upgrade_triggers on commit drop as select t.oid,t.tgrelid,t.tgfoid,t.tgenabled,
      pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and not t.tgisinternal;
    create temp table erasure_upgrade_snapshot on commit drop as select pg_temp.erasure_snapshot() value;
    alter default privileges for role postgres grant execute on functions to public;
    ${migration.sql}
    do $verify$ declare before jsonb; after jsonb; checkpoint record; f record; changed record; edit jsonb; restored text;
    begin
      select value into strict before from pg_temp.erasure_upgrade_snapshot; after := pg_temp.erasure_snapshot();
      if exists(select 1 from jsonb_each_text(before) b where after->>b.key is distinct from b.value) then
        raise exception 'Erasure forward changed a populated application/Auth row'; end if;
      if exists(select 1 from pg_temp.erasure_upgrade_rows b left join pg_class c on c.oid=b.oid
        where c.oid is null or c.relowner<>b.relowner or c.relacl is distinct from b.relacl or c.relrowsecurity<>b.relrowsecurity) then
        raise exception 'Erasure forward changed an old table identity/owner/ACL/RLS'; end if;
      if exists(select 1 from pg_temp.erasure_upgrade_columns b left join pg_attribute a
          on a.attrelid=b.attrelid and a.attnum=b.attnum left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid is null or to_jsonb(a) is distinct from b.definition
          or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression) then
        raise exception 'Erasure forward changed an existing column/default/ACL'; end if;
      if exists(select 1 from pg_temp.erasure_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or pg_get_constraintdef(k.oid) is distinct from b.definition
          or k.convalidated<>b.convalidated or k.condeferrable<>b.condeferrable or k.condeferred<>b.condeferred) then
        raise exception 'Erasure forward changed an existing constraint identity/definition'; end if;
      if exists(select 1 from pg_temp.erasure_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        where i.indexrelid is null or pg_get_indexdef(i.indexrelid) is distinct from b.definition or i.indisvalid<>b.indisvalid
          or i.indisready<>b.indisready or i.indisreplident<>b.indisreplident or i.indisclustered<>b.indisclustered) then
        raise exception 'Erasure forward changed an existing index identity/definition'; end if;
      if exists(select 1 from pg_temp.erasure_upgrade_functions b left join pg_proc p on p.oid=b.oid
        where p.oid is null or p.proowner<>b.proowner or p.proacl is distinct from b.proacl or p.prosecdef<>b.prosecdef
          or p.proconfig is distinct from b.proconfig) then raise exception 'Erasure forward changed an old function identity/owner/ACL/config'; end if;
      if exists(select 1 from pg_temp.erasure_upgrade_functions b join pg_proc p on p.oid=b.oid
        where b.definition<>pg_get_functiondef(p.oid) and not b.approved_entry and not b.approved_guard) then
        raise exception 'Erasure forward changed an unrelated function definition'; end if;
      for changed in select b.oid,b.body,p.prosrc,d.pairs from pg_temp.erasure_upgrade_functions b
        join pg_proc p on p.oid=b.oid join pg_temp.erasure_upgrade_deltas d on d.oid=b.oid loop
        restored := changed.prosrc;
        for edit in select value from jsonb_array_elements(changed.pairs) with ordinality edits(value,position) order by position desc loop
          if cardinality(string_to_array(restored,edit->>1))<>2 then
            raise exception 'Lifecycle forward lacks an exact approved gate anchor: %',changed.oid::regprocedure; end if;
          restored := replace(restored,edit->>1,edit->>0);
        end loop;
        if restored is distinct from changed.body then
          raise exception 'Lifecycle forward changed behavior beyond approved lock/isolation/time anchors: %',changed.oid::regprocedure; end if;
      end loop;
      if exists(select 1 from pg_temp.erasure_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or t.tgrelid<>b.tgrelid or t.tgfoid<>b.tgfoid or t.tgenabled<>b.tgenabled
          or pg_get_triggerdef(t.oid)<>b.definition) then raise exception 'Erasure forward changed an existing trigger'; end if;
      for checkpoint in select * from pg_temp.outcome_receipts loop
        if pg_temp.outcome_commit((checkpoint.command->>'actorUserId')::uuid,checkpoint.command) is distinct from checkpoint.result then
          raise exception 'Erasure forward changed an exact old Shared round receipt'; end if;
      end loop;
      select * into strict f from pg_temp.erasure_fixture;
      if private.get_shared_round_vector_comparison_v1(f.comparison_id) is null then
        raise exception 'Erasure forward removed a frozen observed comparison'; end if;
    end; $verify$;
    select jsonb_build_object('shadowSourceErasureUpgrade',
      'PASS: every populated row and existing identity/owner/ACL/config/trigger preserved; only declared guard/entry-lock bodies change') snapshot;
    rollback;`;
}
