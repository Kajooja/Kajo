import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sharedRoundOutcomeCapturesFixtureSql } from './shared-round-outcome-captures.mjs';

const erasureAnchor = `  -- All guards precede writes. No permission ever authorizes a genome, window,
  -- decision, assignment or UPDATE, and all permitted row keys are exact.
`;
const erasureInsertion = `  -- #232F input erasure begin: all existing influence/resource guards passed.
  declare
    input_ids uuid[];
    input_edge_count integer;
  begin
    -- Typed closure metadata must remain the exact immutable copied identities,
    -- including old target-prefix members and every copied source trace/claim.
    begin
      if exists(select 1 from private.shared_round_prediction_inputs i where
        i.result->>'contractVersion' is distinct from 'shared-round-prediction-input-v1'
        or i.result->>'captureId' is distinct from i.id::text
        or i.result->>'capturedByActorUserId' is distinct from i.actor_user_id::text
        or i.result#>>'{target,round,profileId}' is distinct from i.profile_id::text
        or i.result#>>'{target,round,roundId}' is distinct from i.round_id::text
        or i.result#>>'{target,sourceCommandId}' is distinct from i.target_source_command_id::text
        or i.result#>>'{target,sourceRevision}' is distinct from i.target_revision::text
        or i.result->>'inputDigest' is distinct from md5((i.result-'inputDigest')::text)
        or i.result#>>'{target,prefixDigest}' is distinct from md5((i.result#>'{target,visibleCommands}')::text)
        or i.copied_actor_ids is distinct from (select array_agg(distinct a.id order by a.id) from (
          select (i.result->>'capturedByActorUserId')::uuid id
          union all select (c.value->>'actorUserId')::uuid from jsonb_array_elements(i.result#>'{target,visibleCommands}') c
          union all select (p.value->>'actorUserId')::uuid from jsonb_array_elements(i.result#>'{target,visibleCommands}') c
            cross join lateral jsonb_array_elements(c.value#>'{result,round,participants}') p
          union all select (p.value->>'actorUserId')::uuid from jsonb_array_elements(i.result->'sources') c
            cross join lateral jsonb_array_elements(c.value#>'{outcome,round,participants}') p) a)
        or i.origin_prediction_ids is distinct from (select coalesce(array_agg(distinct a.id order by a.id),'{}'::uuid[]) from (
          select ref.value::uuid id from jsonb_array_elements(i.result->'sources') c
            cross join lateral jsonb_array_elements(c.value#>'{outcome,responses}') p
            cross join lateral (values (p.value#>>'{origin,predictionId}'),(p.value#>>'{origin,claimedPredictionId}'),
              (p.value#>>'{attribution,predictionId}')) ref(value)
            where ref.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          union all select ref.value::uuid id from jsonb_array_elements(i.result->'sources') c
            cross join lateral jsonb_array_elements(c.value#>'{outcome,round,responses}') p
            cross join lateral (values (p.value#>>'{origin,predictionId}'),(p.value#>>'{origin,claimedPredictionId}')) ref(value)
            where ref.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') a)) then
        raise exception 'Shared prediction input erasure metadata unavailable' using errcode='55000'; end if;
    exception when invalid_text_representation or invalid_parameter_value then
      raise exception 'Shared prediction input erasure metadata malformed' using errcode='55000';
    end;
    select coalesce(array_agg(bounded.id order by bounded.id),'{}'::uuid[]) into input_ids from (
      select i.id from private.shared_round_prediction_inputs i where
        (target_scope='PROFILE' and i.profile_id=target_id)
        or (target_scope='ACTOR' and (i.copied_actor_ids @> array[target_id] or i.profile_id=any(owned_profile_ids)))
        or i.origin_prediction_ids && source_ids
      limit 250001) bounded;
    select count(*) into input_edge_count from (
      select 1 from private.shared_round_prediction_input_sources s where s.input_id=any(input_ids) limit 250001) bounded;
    if cardinality(input_ids)>250000 or input_edge_count>250000
      or dependent_count+cardinality(input_ids)+input_edge_count>250000 then
      raise exception 'Prediction source erasure dependent row limit exceeded' using errcode='54000'; end if;
    perform i.id from private.shared_round_prediction_inputs i where i.id=any(input_ids) order by i.id for update;
    delete from private.shared_round_prediction_inputs i where i.id=any(input_ids);
  end;
  -- #232F input erasure end.

`;

export async function sharedRoundPredictionInputsFixtureSql() {
  return `${await sharedRoundOutcomeCapturesFixtureSql()}\n${await readFile(new URL('shared-round-prediction-inputs-fixture.sql', import.meta.url), 'utf8')}`;
}

export async function sharedRoundPredictionInputsSmokeSql() {
  return `begin; ${await sharedRoundPredictionInputsFixtureSql()}\n${await readFile(new URL('shared-round-prediction-inputs-smoke.sql', import.meta.url), 'utf8')}\nrollback;`;
}

// This forward adds a pre-response observation store. Old rows and schema
// objects remain exact; only the declared eraser insertion may alter an old
// function body. Its reversal is checked against the actual old prosrc.
export async function sharedRoundPredictionInputsUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_shared_round_prediction_inputs.sql'), 'Expected the pre-response input capture forward');
  return `begin;
    ${await sharedRoundPredictionInputsFixtureSql()}
    create temp table prediction_input_upgrade_rows(
      oid oid primary key,identity text,namespace oid,name name,owner oid,acl aclitem[],
      rls boolean,force_rls boolean,options text[],replica_identity "char",digest text
    ) on commit drop;
    do $snapshot$ declare relation record; digest text; begin
      for relation in select c.*,format('%I.%I',n.nspname,c.relname) identity
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where c.relkind='r' and n.nspname in ('public','private','auth') loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        insert into pg_temp.prediction_input_upgrade_rows values(relation.oid,relation.identity,
          relation.relnamespace,relation.relname,relation.relowner,relation.relacl,relation.relrowsecurity,
          relation.relforcerowsecurity,relation.reloptions,relation.relreplident,digest);
      end loop;
    end; $snapshot$;
    create temp table prediction_input_upgrade_columns on commit drop as
      select a.attrelid,a.attnum,to_jsonb(a) definition,to_jsonb(d) default_properties,
        pg_get_expr(d.adbin,d.adrelid) default_expression
      from pg_attribute a join pg_temp.prediction_input_upgrade_rows r on r.oid=a.attrelid
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped;
    create temp table prediction_input_upgrade_constraints on commit drop as
      select k.oid,to_jsonb(k) properties,pg_get_constraintdef(k.oid) definition
      from pg_constraint k join pg_temp.prediction_input_upgrade_rows r on r.oid=k.conrelid;
    create temp table prediction_input_upgrade_indexes on commit drop as
      select i.indexrelid,to_jsonb(i) properties,c.relowner,c.relacl,c.relnamespace,c.relname,
        pg_get_indexdef(i.indexrelid) definition from pg_index i
      join pg_temp.prediction_input_upgrade_rows r on r.oid=i.indrelid join pg_class c on c.oid=i.indexrelid;
    create temp table prediction_input_upgrade_functions on commit drop as
      select p.oid,to_jsonb(p)-'prosrc' properties,p.prosrc body,pg_get_functiondef(p.oid) definition,
        p.oid='private.erase_prediction_sources_v1(text,uuid)'::regprocedure approved_eraser
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private','auth') and p.prokind='f';
    create temp table prediction_input_upgrade_triggers on commit drop as
      select t.oid,to_jsonb(t) properties,pg_get_triggerdef(t.oid) definition
      from pg_trigger t join pg_temp.prediction_input_upgrade_rows r on r.oid=t.tgrelid where not t.tgisinternal;
    create temp table prediction_input_upgrade_round_receipts on commit drop as
      select actor_user_id,command,result from private.shared_rating_round_receipts;
    create temp table prediction_input_upgrade_page_receipts on commit drop as
      select actor_user_id,request,response from private.prediction_page_receipts;
    create temp table prediction_input_upgrade_item_receipts on commit drop as
      select actor_user_id,command,result from private.item_action_receipts;
    create temp table prediction_input_upgrade_captures on commit drop as
      select id,profile_id,round_id,request,result from private.shared_round_outcome_captures;
    create temp table prediction_input_upgrade_comparisons on commit drop as
      select id,capture_id,genome_id,window_id,result from private.shared_round_vector_comparisons;
    alter default privileges for role postgres grant execute on functions to public;
    ${migration.sql}
    do $verify$ declare relation record; digest text; checkpoint record; replayed jsonb; changed record; restored text;
    begin
      for relation in select * from pg_temp.prediction_input_upgrade_rows loop
        if not exists(select 1 from pg_class c where c.oid=relation.oid
          and c.relnamespace=relation.namespace and c.relname=relation.name and c.relowner=relation.owner
          and c.relacl is not distinct from relation.acl and c.relrowsecurity=relation.rls
          and c.relforcerowsecurity=relation.force_rls and c.reloptions is not distinct from relation.options
          and c.relreplident=relation.replica_identity and c.relkind='r') then
          raise exception 'Prediction input forward changed an old table identity/owner/ACL/RLS: %',relation.identity; end if;
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        if digest is distinct from relation.digest then
          raise exception 'Prediction input forward changed a populated application/Auth row: %',relation.identity; end if;
      end loop;
      if exists(select 1 from pg_temp.prediction_input_upgrade_columns b left join pg_attribute a
          on a.attrelid=b.attrelid and a.attnum=b.attnum left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid is null or to_jsonb(a) is distinct from b.definition
          or to_jsonb(d) is distinct from b.default_properties
          or pg_get_expr(d.adbin,d.adrelid) is distinct from b.default_expression) then
        raise exception 'Prediction input forward changed an old column/default/ACL'; end if;
      if exists(select 1 from pg_temp.prediction_input_upgrade_constraints b left join pg_constraint k on k.oid=b.oid
        where k.oid is null or to_jsonb(k) is distinct from b.properties
          or pg_get_constraintdef(k.oid) is distinct from b.definition) then
        raise exception 'Prediction input forward changed an old constraint identity/definition'; end if;
      if exists(select 1 from pg_temp.prediction_input_upgrade_indexes b left join pg_index i on i.indexrelid=b.indexrelid
        left join pg_class c on c.oid=i.indexrelid where i.indexrelid is null
          or to_jsonb(i) is distinct from b.properties or pg_get_indexdef(i.indexrelid) is distinct from b.definition
          or c.relowner<>b.relowner or c.relacl is distinct from b.relacl
          or c.relnamespace<>b.relnamespace or c.relname<>b.relname) then
        raise exception 'Prediction input forward changed an old index identity/owner/ACL/definition'; end if;
      if exists(select 1 from pg_temp.prediction_input_upgrade_functions b left join pg_proc p on p.oid=b.oid
        where p.oid is null or to_jsonb(p)-'prosrc' is distinct from b.properties) then
        raise exception 'Prediction input forward changed an old function identity/owner/ACL/config'; end if;
      if exists(select 1 from pg_temp.prediction_input_upgrade_functions b join pg_proc p on p.oid=b.oid
        where not b.approved_eraser and pg_get_functiondef(p.oid) is distinct from b.definition) then
        raise exception 'Prediction input forward changed an unrelated old function definition'; end if;
      select b.body,p.prosrc into strict changed from pg_temp.prediction_input_upgrade_functions b
        join pg_proc p on p.oid=b.oid where b.approved_eraser;
      restored := changed.prosrc;
      if cardinality(string_to_array(changed.body,$eraser_anchor$${erasureAnchor}$eraser_anchor$))<>2
        or cardinality(string_to_array(restored,$eraser_insertion$${erasureInsertion}${erasureAnchor}$eraser_insertion$))<>2 then
        raise exception 'Prediction input forward lacks the exact approved eraser insertion anchor'; end if;
      restored := replace(restored,$eraser_insertion$${erasureInsertion}${erasureAnchor}$eraser_insertion$,
        $eraser_anchor$${erasureAnchor}$eraser_anchor$);
      if restored is distinct from changed.body then
        raise exception 'Prediction input forward changed erasure behavior beyond its approved insertion'; end if;
      if exists(select 1 from pg_temp.prediction_input_upgrade_triggers b left join pg_trigger t on t.oid=b.oid
        where t.oid is null or to_jsonb(t) is distinct from b.properties
          or pg_get_triggerdef(t.oid) is distinct from b.definition) then
        raise exception 'Prediction input forward changed an old trigger identity/definition'; end if;
      if exists(select 1 from private.shared_round_prediction_inputs)
        or exists(select 1 from private.shared_round_prediction_input_sources) then
        raise exception 'Prediction input forward backfilled historical captures'; end if;
      if not exists(select 1 from pg_temp.prediction_input_upgrade_round_receipts)
        or not exists(select 1 from pg_temp.prediction_input_upgrade_page_receipts)
        or not exists(select 1 from pg_temp.prediction_input_upgrade_item_receipts)
        or not exists(select 1 from pg_temp.prediction_input_upgrade_captures)
        or not exists(select 1 from pg_temp.prediction_input_upgrade_comparisons) then
        raise exception 'Prediction input upgrade fixture lacks real old receipt/capture/comparison replay'; end if;
      for checkpoint in select * from pg_temp.prediction_input_upgrade_round_receipts loop
        if pg_temp.outcome_commit(checkpoint.actor_user_id,checkpoint.command) is distinct from checkpoint.result then
          raise exception 'Prediction input forward changed an exact old Shared round receipt'; end if;
      end loop;
      for checkpoint in select * from pg_temp.prediction_input_upgrade_page_receipts loop
        perform set_config('request.jwt.claim.sub',checkpoint.actor_user_id::text,true);
        perform set_config('role','authenticated',true);
        replayed := public.rank_items_page_v1(checkpoint.request);
        perform set_config('role','postgres',true);
        if replayed is distinct from checkpoint.response then
          raise exception 'Prediction input forward changed an exact old serving/page receipt'; end if;
      end loop;
      for checkpoint in select * from pg_temp.prediction_input_upgrade_item_receipts loop
        perform set_config('request.jwt.claim.sub',checkpoint.actor_user_id::text,true);
        perform set_config('role','authenticated',true);
        replayed := public.commit_item_action_v1(checkpoint.command);
        perform set_config('role','postgres',true);
        if replayed is distinct from checkpoint.result then
          raise exception 'Prediction input forward changed an exact old Item action receipt'; end if;
      end loop;
      for checkpoint in select * from pg_temp.prediction_input_upgrade_captures loop
        if private.get_shared_round_outcome_capture_v1(checkpoint.id) is distinct from checkpoint.result
          or private.capture_shared_rating_round_outcome_v1(checkpoint.id,checkpoint.profile_id,checkpoint.round_id,
            (checkpoint.request->>'outcomeCutoff')::timestamptz,(checkpoint.request->>'evidenceCutoff')::timestamptz,
            (checkpoint.request->>'maturitySeconds')::double precision*interval '1 second') is distinct from checkpoint.result then
          raise exception 'Prediction input forward changed an exact old outcome capture replay/retry'; end if;
      end loop;
      for checkpoint in select * from pg_temp.prediction_input_upgrade_comparisons loop
        if private.get_shared_round_vector_comparison_v1(checkpoint.id) is distinct from checkpoint.result
          or private.compare_shared_round_outcome_capture_v1(checkpoint.id,checkpoint.capture_id,checkpoint.genome_id,checkpoint.window_id)
            is distinct from checkpoint.result then
          raise exception 'Prediction input forward changed an exact old comparison replay/retry'; end if;
      end loop;
      for relation in select * from pg_temp.prediction_input_upgrade_rows loop
        execute format('select md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb)::text) from %s r',relation.identity) into digest;
        if digest is distinct from relation.digest then
          raise exception 'Prediction input forward old replay changed application/Auth rows: %',relation.identity; end if;
      end loop;
      if exists(select 1 from private.shared_round_prediction_inputs)
        or exists(select 1 from private.shared_round_prediction_input_sources) then
        raise exception 'Old receipt replay silently created prediction input captures'; end if;
    end; $verify$;
    select jsonb_build_object('sharedRoundPredictionInputsUpgrade',
      'PASS: every populated row and existing table/column/default/constraint/index/function/trigger identity preserved; only declared eraser body insertion changes; old round/page/Item/capture/comparison replays exact; no historical backfill') snapshot;
    rollback;`;
}
