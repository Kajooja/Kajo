// Disposable native-stack observations. Instrumentation and fixed-clock replays
// are deliberately separate from the original public-RPC measurements.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { summarizeFunctionTiming } from './native-prediction-performance.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => literal(JSON.stringify(value)) + '::jsonb';
const acquisition = 'private.acquire_native_candidates_v1(jsonb)';
const skip = 'private.contextual_skip_decision_v1(uuid,uuid,timestamptz,boolean)';
const chain = 'private.rank_items_catalog_chain_v1(jsonb)';
const baselineBodyMd5 = '6e0aba591a90c194c5bae49f0361084f';

export function skipCallDiagnosticProtocol({ contractTest = false } = {}) {
  return {
    version: 'native-skip-call-diagnostics-v1', purpose: contractTest ? 'CONTRACT_TEST_ONLY' : 'DIAGNOSIS_ONLY_NO_PERFORMANCE_ADMISSION',
    target: { skipHistory: 'CATALOGUE_HISTORY', catalogSize: contractTest ? 40 : 1000, operation: 'discovery-personal-movie', requestKind: 'fresh' },
    repetitions: 3, order: 'THREE_UNINSTRUMENTED_CONTROLS_THEN_THREE_SEPARATE_TRACED_RPCS',
    prelude: 'ORIGINAL_EMPTY_PERFORMANCE_EMPTY_FUNCTIONS_HISTORY_PERFORMANCE_FIRST_HISTORY_FUNCTION_OBSERVATION',
    controls: 'THREE_SAME_VARIANT_STACKS_PLUS_THREE_ROLLED_BACK_ROOT_REPETITIONS_PER_STACK',
    clocks: 'ACTUAL_ROOT_ARGUMENTS_RECORDED_SAME_TRANSACTION_FIXED_INPUT_PRIVATE_REPLAY',
    acquisitionParity: 'EXACT_BASELINE_AND_CANDIDATE_ROWS_AT_IDENTICAL_CAPTURED_INPUT',
    acquisitionPlans: 'EXACT_QUERY_BODY_IN_CLOSED_VOLATILE_EXPLAIN_COPIES_SAME_TRANSACTION_NOT_ORIGINAL_NESTED_PLANS',
    availabilityPlan: 'EXTRACTED_QUERY_REPLAY_WITH_CAPTURED_BOUNDARY_INPUT_AND_EXPLICIT_SINGLE_CLOCK_NOT_ORIGINAL_NESTED_PLAN',
    instrumentation: 'TRANSACTION_LOCAL_GUC_TRACE_ORIGINAL_FUNCTION_METADATA_RESTORED_BY_ROLLBACK',
    timing: 'FUNCTION_STATISTICS_DIAGNOSTIC_ONLY_NO_V1_RECLASSIFICATION',
    physicalState: 'LOGICAL_ROLLBACK_DOES_NOT_RESTORE_HEAP_CACHE_OR_DEAD_TUPLES',
    retention: 'SYNTHETIC_INPUTS_CALL_CLOCKS_CANDIDATE_DIGESTS_BOUNDARY_QUERY_PLANS_NO_REAL_USER_DATA',
  };
}

function replaceOnce(value, before, after, label) {
  assert.equal(value.split(before).length - 1, 1, 'Diagnostic source anchor drift: ' + label);
  return value.replace(before, () => after);
}

const functionStats = `select coalesce(jsonb_agg(jsonb_build_object(
  'schema',s.schemaname,'name',s.funcname,'arguments',oidvectortypes(p.proargtypes),
  'calls',s.calls,'totalMs',s.total_time,'selfMs',s.self_time)),'[]'::jsonb)
  from pg_stat_xact_user_functions s join pg_proc p on p.oid=s.funcid
  where s.calls>0 and s.schemaname in('public','private');`;
const functionsHash = `select to_jsonb(encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(p)
  order by p.oid),'[]')::text,'UTF8')),'hex')) from pg_proc p
  where pronamespace in('public'::regnamespace,'private'::regnamespace);`;
const tableState = `select jsonb_build_object('items',pg_relation_size('public.items'),
  'skipCommands',pg_relation_size('private.contextual_skip_commands'),
  'settings',jsonb_build_object('synchronizeSeqscans',current_setting('synchronize_seqscans'),
    'sharedBuffers',current_setting('shared_buffers'),'blockSize',current_setting('block_size'),
    'enableSeqscan',current_setting('enable_seqscan'),'enableIndexscan',current_setting('enable_indexscan'),
    'enableBitmapscan',current_setting('enable_bitmapscan'),'planCacheMode',current_setting('plan_cache_mode'),
    'seqPageCost',current_setting('seq_page_cost'),'randomPageCost',current_setting('random_page_cost')),
  'statistics',(select jsonb_agg(jsonb_build_object('schema',schemaname,'table',relname,
    'liveEstimate',n_live_tup,'deadEstimate',n_dead_tup,'lastAnalyze',last_analyze,
    'lastAutoAnalyze',last_autoanalyze,'lastAutoVacuum',last_autovacuum) order by schemaname,relname)
    from pg_stat_all_tables where (schemaname,relname) in (('public','items'),
      ('public','item_interactions'),('private','contextual_skip_commands'))));`;

export async function collectSkipCallDiagnostics(execSql, context) {
  const { actor, profileId, request, call, auditSql, catalogSize, originalSample, baselineDefinition, migration } = context;
  assert.equal(actor, 'ab157000-0000-4000-8000-000000000001');
  assert.match(profileId, /^[a-f0-9-]{36}$/);
  assert.ok([40, 1000].includes(catalogSize));
  assert.equal(request.profileId, profileId);
  assert.equal(request.itemType, 'MOVIE'); assert.equal(request.limit, 5);
  assert.equal(request.cursor, null); assert.equal(request.discoveryMode, 'FOR_YOU');
  assert.equal(call, `select public.rank_items_feed_v1(${json(request)});`);
  assert.equal(originalSample.functionTiming.root.calls, 1);
  assert.ok(originalSample.functionTiming.skipDecision.calls > 0);
  assert.equal(migration.name, '20261028081350_native_skip_acquisition_prefilter.sql');
  assert.equal(typeof baselineDefinition, 'string');
  assert.ok(auditSql.startsWith('select jsonb_build_object('));
  const protocol = skipCallDiagnosticProtocol({ contractTest: catalogSize === 40 });
  let activeStage;
  const exec = (sql, stage) => { activeStage = stage; return execSql(sql, { stage: 'skip-call-' + stage, timeoutMs: 120_000 }); };
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  const installedHash = await one(functionsHash, 'functions-before');
  const definitions = await one(`select jsonb_object_agg(signature,jsonb_build_object('definition',pg_get_functiondef(oid),'body',prosrc))
    from (select p.*,v.signature from (values (${literal(acquisition)}),(${literal(skip)}),(${literal(chain)})) v(signature)
      join pg_proc p on p.oid=v.signature::regprocedure) p;`, 'definitions');
  const originalAcquisition = definitions[acquisition];
  const originalSkip = definitions[skip];
  const originalChain = definitions[chain];
  const baselineClone = replaceOnce(baselineDefinition, 'FUNCTION private.acquire_native_candidates_v1(',
    'FUNCTION pg_temp.skip_baseline(', 'baseline clone');

  const acquisitionBody = replaceOnce(originalAcquisition.body, 'begin\n  if acquisition_request is null',
    `begin\n  perform set_config('kajo.diag_acquisition_count',(current_setting('kajo.diag_acquisition_count')::integer+1)::text,true);
  perform set_config('kajo.diag_acquisition_input',acquisition_request::text,true);
  if acquisition_request is null`, 'acquisition entry');
  let skipBody = replaceOnce(originalSkip.body, 'declare latest timestamptz;',
    'declare diagnostic_context text;latest timestamptz;', 'skip declaration');
  skipBody = replaceOnce(skipBody, 'begin\n  if profile is null', `begin
  get diagnostics diagnostic_context=PG_CONTEXT;
  if jsonb_array_length(current_setting('kajo.diag_calls')::jsonb)>=${catalogSize + 10} then
    raise exception 'Skip diagnostic exceeded bounded call inventory';end if;
  perform set_config('kajo.diag_calls',(current_setting('kajo.diag_calls')::jsonb||jsonb_build_array(jsonb_build_object(
    'scope',case when diagnostic_context ~ 'PL/pgSQL function (private[.])?acquire_native_candidates_v1[(]' then 'ACQUISITION'
      when current_setting('kajo.diag_availability_active')='true'
        and diagnostic_context ~ 'PL/pgSQL function (private[.])?rank_items_catalog_chain_v1[(]' then 'AVAILABILITY' else 'OTHER' end,
    'profileId',profile,'itemId',item,'cutoff',cutoff,'otherwiseEligible',otherwise_eligible)))::text,true);
  if profile is null`, 'skip entry');
  const availabilityStart = '  select exists(\n    select 1 from public.items i left join public.item_interactions s';
  const availabilityEnd = '  ) into remaining;';
  assert.equal(originalChain.body.split(availabilityStart).length - 1, 1);
  assert.equal(originalChain.body.split(availabilityEnd).length - 1, 1);
  const start = originalChain.body.indexOf(availabilityStart);
  const end = originalChain.body.indexOf(availabilityEnd, start) + availabilityEnd.length;
  const availabilityQuery = originalChain.body.slice(start, end);
  let replayQuery = replaceOnce(availabilityQuery, '  ) into remaining;', '  );', 'availability result');
  for (const [before, after] of [
    ['chain_request.profile_id', '$1'], ['clock_timestamp()', '$6'],
    ['i.item_type=domain', 'i.item_type=$2'], ['any(seen_after)', 'any($3)'],
    ['(reminder_spent or selected_reminder)', '($4 or $5)'],
  ]) {
    const count = before === 'chain_request.profile_id' ? 2 : 1;
    assert.equal(replayQuery.split(before).length - 1, count, 'Availability parameter anchor drift');
    replayQuery = replayQuery.replaceAll(before, after);
  }
  const chainBody = replaceOnce(originalChain.body, availabilityQuery, `  perform set_config('kajo.diag_availability_input',jsonb_build_object(
    'profileId',chain_request.profile_id,'domain',domain,'seenAfter',seen_after,
    'reminderSpent',reminder_spent,'selectedReminder',selected_reminder,'before',clock_timestamp())::text,true);
  perform set_config('kajo.diag_availability_active','true',true);
${availabilityQuery}
  perform set_config('kajo.diag_availability_active','false',true);
  perform set_config('kajo.diag_availability_result',jsonb_build_object('remaining',remaining,'after',clock_timestamp())::text,true);`,
  'availability capture');
  const instrumented = [
    replaceOnce(originalAcquisition.definition, originalAcquisition.body, acquisitionBody, 'acquisition body'),
    replaceOnce(originalSkip.definition, originalSkip.body, skipBody, 'skip body'),
    replaceOnce(originalChain.definition, originalChain.body, chainBody, 'chain body'),
  ].join(';\n') + ';';
  const prefix = `begin;set local extra_float_digits=3;set local request.jwt.claim.sub=${literal(actor)};
    set local track_functions='all';create temp table diagnostic_response(value jsonb) on commit drop;
    grant insert,select on diagnostic_response to authenticated;`;
  const root = `set local role authenticated;insert into pg_temp.diagnostic_response ${call}reset role;`;
  const response = 'select value from pg_temp.diagnostic_response;';
  const retries = `set local role authenticated;${call}${call}reset role;${auditSql}`;
  const report = { status: 'COLLECTING', protocol, protocolSha256: hash(JSON.stringify(protocol)),
    sourceSha256: hash(await readFile(new URL(import.meta.url))),
    baselineDefinitionSha256: hash(baselineDefinition), installedDefinitionSha256: hash(originalAcquisition.definition),
    forwardSha256: hash(migration.sql), originalSample, physicalBefore: await one(tableState, 'physical-before'),
    controls: [], repetitions: [], attempts: [] };
  const checkRoot = output => {
    assert.equal(output.length, 6);
    const [statistics, audit, observedResponse, retryOne, retryTwo, afterRetry] = output;
    assert.deepEqual(retryOne, observedResponse, 'First exact diagnostic retry changed response');
    assert.deepEqual(retryTwo, observedResponse, 'Second exact diagnostic retry changed response');
    assert.deepEqual(afterRetry, audit, 'Diagnostic retry changed frozen prediction lineage');
    assert.equal(observedResponse.items.length, 5);
    assert.equal(audit.runs, 1); assert.equal(audit.finalRuns, 1); assert.ok(audit.candidates > 0);
    return { functionTiming: summarizeFunctionTiming(statistics, 'rank_items_feed_v1'),
      exactRetries: 2, frozenSourceSha256: audit.sourceHash, candidates: audit.candidates,
      selectedItemIds: observedResponse.items.map(item => { assert.match(item.item_id, /^[a-f0-9-]{36}$/); return item.item_id; }),
      selectedScores: observedResponse.items.map(item => {
        assert.ok(Number.isFinite(item.score)); return { itemId: item.item_id, score: item.score };
      }), availability: observedResponse.availability,
      continuationState: observedResponse.source.continuationState };
  };
  try {
    for (let repetition = 1; repetition <= protocol.repetitions; repetition++) {
      const attempt = { phase: 'CONTROL', repetition, status: 'ATTEMPTED' }; report.attempts.push(attempt);
      report.controls.push(checkRoot(await exec(prefix + root + functionStats + auditSql + response + retries + 'rollback;',
        'control-' + repetition)));
      attempt.status = 'PASS';
    }
    for (let repetition = 1; repetition <= protocol.repetitions; repetition++) {
      const control = report.controls[repetition - 1];
      const attempt = { phase: 'TRACE', repetition, status: 'ATTEMPTED' }; report.attempts.push(attempt);
      const tracedOutput = await exec(prefix + `
        ${baselineClone};
        revoke all on function pg_temp.skip_baseline(jsonb) from public,anon,authenticated,service_role;
        do $references$ declare definition text;original_body text;candidate_body text;begin
          if (select md5(prosrc) from pg_proc where oid='pg_temp.skip_baseline(jsonb)'::regprocedure)<>${literal(baselineBodyMd5)} then
            raise exception 'Diagnostic predecessor body drift';end if;
          select prosrc into strict original_body from pg_proc where oid=${literal(acquisition)}::regprocedure;
          execute ${literal(baselineDefinition)};
          execute ${literal(migration.sql)};
          select prosrc into strict candidate_body from pg_proc where oid=${literal(acquisition)}::regprocedure;
          if md5(original_body)<>${literal(baselineBodyMd5)} and original_body<>candidate_body then
            raise exception 'Diagnostic installed candidate body drift';end if;
          select pg_get_functiondef(${literal(acquisition)}::regprocedure) into definition;
          execute replace(definition,'FUNCTION private.acquire_native_candidates_v1(','FUNCTION pg_temp.skip_candidate(');
          revoke all on function pg_temp.skip_candidate(jsonb) from public,anon,authenticated,service_role;
          execute ${literal(originalAcquisition.definition)};
        end;$references$;
        ${instrumented}
        do $initialize$ begin
          perform set_config('kajo.diag_calls','[]',true);
          perform set_config('kajo.diag_acquisition_count','0',true);
          perform set_config('kajo.diag_availability_active','false',true);
        end;$initialize$;` + root + functionStats + auditSql + response + retries + `
        create temp table diagnostic_trace as select current_setting('kajo.diag_acquisition_input')::jsonb acquisition_input,
          current_setting('kajo.diag_calls')::jsonb calls,current_setting('kajo.diag_acquisition_count')::integer acquisition_count,
          current_setting('kajo.diag_availability_input')::jsonb availability_input,
          current_setting('kajo.diag_availability_result')::jsonb availability_result;
        ${originalAcquisition.definition};
        ${originalSkip.definition};
        ${originalChain.definition};
        do $plan_copies$ declare source_name text;definition text;body text;rewritten text;patch record;begin
          foreach source_name in array array['skip_baseline','skip_candidate'] loop
            select pg_get_functiondef(p.oid),prosrc into strict definition,body from pg_proc p
              where p.oid=('pg_temp.'||source_name||'(jsonb)')::regprocedure;
            if (select count(*) from regexp_matches(definition,${literal('RETURNS TABLE\\([^\n]+\\)')},'g'))<>1 then
              raise exception 'Diagnostic acquisition plan return type drift';end if;
            definition:=regexp_replace(definition,${literal('RETURNS TABLE\\([^\n]+\\)')},'RETURNS jsonb');
            -- PostgreSQL rejects EXPLAIN inside STABLE functions. Only the
            -- closed plan copies are VOLATILE; the serving and parity copies
            -- retain their original volatility and there are no concurrent writers.
            if (length(definition)-length(replace(definition,${literal('\n STABLE\n')},'')))/length(${literal('\n STABLE\n')})<>1 then
              raise exception 'Diagnostic acquisition plan volatility drift';end if;
            definition:=replace(definition,${literal('\n STABLE\n')},${literal('\n VOLATILE\n')});
            if position('FUNCTION pg_temp.'||source_name||'(' in definition)=0 then raise exception 'Diagnostic temporary function identity drift';end if;
            definition:=replace(definition,'FUNCTION pg_temp.'||source_name||'(','FUNCTION pg_temp.'||source_name||'_plan(');
            rewritten:=body;
            for patch in select * from (values
              (${literal('declare\n')},${literal('declare\n  diagnostic_plan jsonb;\n')}),
              (${literal('  return query\n  with')},${literal('  for diagnostic_plan in explain (analyze,buffers,wal,timing off,summary on,format json)\n  with')}),
              (${literal('order by n.id;\nend;')},${literal('order by n.id loop return diagnostic_plan;end loop;\nend;')})
            ) changes(before,after) loop
              if (length(rewritten)-length(replace(rewritten,patch.before,'')))/length(patch.before)<>1 then
                raise exception 'Diagnostic acquisition plan statement drift';end if;
              rewritten:=replace(rewritten,patch.before,patch.after);
            end loop;
            execute replace(definition,body,rewritten);
            execute 'revoke all on function pg_temp.'||source_name||'_plan(jsonb) from public,anon,authenticated,service_role';
          end loop;
        end;$plan_copies$;
        create temp table diagnostic_replay(value jsonb);
        do $replay$ declare witness record;baseline_rows jsonb;candidate_rows jsonb;invalid jsonb;errors integer:=0;
          plan jsonb;baseline_plan jsonb;candidate_plan jsonb;remaining boolean;cutoff timestamptz;seen uuid[];
        begin
          select * into strict witness from diagnostic_trace;
          if witness.acquisition_count<>1 then raise exception 'Expected one captured acquisition';end if;
          if (witness.acquisition_input->>'nativeEvidenceAsOf')::timestamptz<>now() then
            raise exception 'Diagnostic acquisition clock escaped transaction';end if;
          if exists(select 1 from jsonb_array_elements(witness.calls) c where c->>'scope'='ACQUISITION'
            and (c->>'cutoff')::timestamptz is distinct from (witness.acquisition_input->>'eligibilityAt')::timestamptz) then
            raise exception 'Acquisition skip call cutoff differs at native microsecond precision';end if;
          if exists(select 1 from jsonb_array_elements(witness.calls) c where c->>'scope'='AVAILABILITY'
            and ((c->>'profileId')::uuid is distinct from (witness.availability_input->>'profileId')::uuid
              or (c->>'cutoff')::timestamptz not between (witness.availability_input->>'before')::timestamptz
                and (witness.availability_result->>'after')::timestamptz)) then
            raise exception 'Availability call witness escaped the exact query boundary';end if;
          select jsonb_agg(to_jsonb(r) order by r.id) into baseline_rows from pg_temp.skip_baseline(witness.acquisition_input) r;
          select jsonb_agg(to_jsonb(r) order by r.id) into candidate_rows from pg_temp.skip_candidate(witness.acquisition_input) r;
          if baseline_rows is null or baseline_rows is distinct from candidate_rows then
            raise exception 'Diagnostic exact-input acquisition parity failed';end if;
          invalid:=witness.acquisition_input||jsonb_build_object('eligibilityAt','1969-12-31T23:59:59Z');
          begin perform * from pg_temp.skip_baseline(invalid);exception when invalid_parameter_value then errors:=errors+1;end;
          begin perform * from pg_temp.skip_candidate(invalid);exception when invalid_parameter_value then errors:=errors+1;end;
          if errors<>2 then raise exception 'Diagnostic invalid clock rejection changed';end if;
          baseline_plan:=pg_temp.skip_baseline_plan(witness.acquisition_input);
          candidate_plan:=pg_temp.skip_candidate_plan(witness.acquisition_input);
          cutoff:=(witness.availability_input->>'before')::timestamptz;
          seen:=array(select value::uuid from jsonb_array_elements_text(witness.availability_input->'seenAfter'));
          execute ${literal('explain (analyze,buffers,wal,timing off,summary on,format json) ' + replayQuery)} into plan
            using (witness.availability_input->>'profileId')::uuid,witness.availability_input->>'domain',seen,
              (witness.availability_input->>'reminderSpent')::boolean,(witness.availability_input->>'selectedReminder')::boolean,cutoff;
          execute ${literal(replayQuery)} into remaining
            using (witness.availability_input->>'profileId')::uuid,witness.availability_input->>'domain',seen,
              (witness.availability_input->>'reminderSpent')::boolean,(witness.availability_input->>'selectedReminder')::boolean,cutoff;
          if remaining is distinct from (witness.availability_result->>'remaining')::boolean then
            raise exception 'Availability fixed-clock replay changed result';end if;
          insert into diagnostic_replay values(jsonb_build_object('input',witness.acquisition_input,
            'exactRowsEqual',true,'rows',jsonb_array_length(baseline_rows),
            'clockWitnessPrecision','POSTGRES_TIMESTAMP_MICROSECONDS',
            'rowsSha256',encode(sha256(convert_to(baseline_rows::text,'UTF8')),'hex'),'invalidClockRejections',errors,
            'baselineAcquisitionPlan',baseline_plan,'candidateAcquisitionPlan',candidate_plan,
            'availabilityInput',witness.availability_input,'availabilityObserved',witness.availability_result,
            'availabilityReplayClock',cutoff,'availabilityReplayResult',remaining,'availabilityReplayPlan',plan,
            'calls',witness.calls));
        end;$replay$;
        select value from diagnostic_replay;rollback;`, 'trace-' + repetition);
      assert.equal(tracedOutput.length, 7);
      const replay = tracedOutput.pop();
      const traced = checkRoot(tracedOutput);
      assert.equal(replay.rows, catalogSize / 2);
      const acquisitionCalls = replay.calls.filter(value => value.scope === 'ACQUISITION');
      const availabilityCalls = replay.calls.filter(value => value.scope === 'AVAILABILITY');
      assert.equal(acquisitionCalls.length, catalogSize / 2);
      assert.ok(availabilityCalls.length > 0);
      assert.equal(acquisitionCalls.length + availabilityCalls.length, replay.calls.length);
      assert.equal(traced.functionTiming.skipDecision.calls, replay.calls.length,
        'Scope trace must account for every measured contextual skip invocation');
      assert.equal(replay.clockWitnessPrecision, 'POSTGRES_TIMESTAMP_MICROSECONDS');
      assert.ok(acquisitionCalls.every(value => value.profileId === profileId));
      assert.deepEqual(control.selectedItemIds, traced.selectedItemIds);
      assert.equal(control.availability, traced.availability);
      assert.equal(control.continuationState, traced.continuationState);
      report.repetitions.push({ repetition, control, traced: { ...traced, acquisitionCalls: acquisitionCalls.length,
        availabilityCalls: availabilityCalls.length }, replay });
      assert.equal(await one(functionsHash, 'functions-restored-' + repetition), installedHash,
        'Diagnostic rollback did not restore every original function body and metadata');
      attempt.status = 'PASS';
    }
    report.physicalAfter = await one(tableState, 'physical-after');
    report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL';
    report.failure = { stage: activeStage, kind: /timeout|timed out|canceling statement/i.test(error.message) ? 'TIMEOUT' : 'ERROR',
      message: error.message.slice(0, 512) };
    if (report.attempts.at(-1)?.status === 'ATTEMPTED') report.attempts.at(-1).status = 'FAIL';
  } finally {
    try {
      await exec('rollback;', 'rollback');
      assert.equal(await one(functionsHash, 'functions-final'), installedHash,
        'Diagnostic failure changed installed functions');
      report.functionsRestored = true;
    } catch (error) {
      report.status = 'FAIL'; report.functionsRestored = false;
      report.restorationFailure = { stage: activeStage, message: error.message.slice(0, 512) };
    }
  }
  report.completedControls = report.controls.length;
  report.completedTraces = report.repetitions.length;
  report.missingControls = protocol.repetitions - report.completedControls;
  report.missingTraces = protocol.repetitions - report.completedTraces;
  return report;
}
