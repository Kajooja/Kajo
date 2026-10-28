import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { nativeCandidateRequestFixtureSql } from './native-candidate-request.mjs';
import { skipHistoryFixtureSql, skipLedgerHashSql } from './native-skip-history-fixture.mjs';
import { summarizeFunctionTiming } from './native-prediction-performance.mjs';
import { collectSkipCallDiagnostics, skipCallDiagnosticProtocol } from './native-skip-call-diagnostics.mjs';

test('native skip diagnostics isolate real root calls and exact-clock private parity without retaining instrumentation', async () => {
  let db = new PGlite();
  const actor = 'ab157000-0000-4000-8000-000000000001';
  const session = 'ab157000-0000-4000-8000-000000000810';
  const json = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
  const stages = [];
  let injectFailure;
  const exec = async (sql, { stage }) => {
    stages.push(stage);
    if (/^skip-call-(control|trace)-/.test(stage)) {
      // Native probes use a new psql backend. Preserve the physical database
      // bytes while resetting PGlite's session-local function statistics.
      const persisted = await db.dumpDataDir();
      await db.close(); db = new PGlite({ loadDataDir: persisted });
    }
    if (stage === injectFailure) {
      // Fail after the real root and installed trace instrumentation, ensuring
      // the failure path restores actual transactional changes.
      sql = sql.replace('create temp table diagnostic_trace', 'select 1/0;create temp table diagnostic_trace');
      if (stage.includes('control')) sql = sql.replace('reset role;', 'reset role;select 1/0;');
    }
    try { return (await db.exec(sql)).flatMap(result => result.rows.map(row => Object.values(row)[0])); }
    catch (error) { await db.exec('rollback;'); throw error; }
  };
  const one = async sql => (await exec(sql, { stage: 'test' }))[0];
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const files = (await buildFreshInstallation()).files;
    for (const file of files.slice(0, -1)) await db.exec(`begin;${file.sql}commit;`);
    const baselineDefinition = await one("select to_jsonb(pg_get_functiondef('private.acquire_native_candidates_v1(jsonb)'::regprocedure));");
    await db.exec('begin;' + await nativeCandidateRequestFixtureSql() + 'commit;');
    const profileId = await one(`select to_jsonb(id) from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL';`);
    await db.exec(`insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
      values('${session}','${actor}','${profileId}',now(),'{}');
      begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;
      select public.taste_session_v2(${json({ operation: 'START', profileId, requestId: 'ab157000-0000-4000-8000-000000000980' })});commit;
      analyze public.items;analyze private.item_sources;`);
    await db.exec(skipHistoryFixtureSql(profileId, 'CATALOGUE_HISTORY', 40, true));
    const request = { version: 3, requestId: 'ab157000-0000-4000-8000-000000000990', profileId,
      sessionId: session, discoveryMode: 'FOR_YOU', itemType: 'MOVIE', limit: 5, context: {}, cursor: null, replacesChainId: null };
    const call = `select public.rank_items_feed_v1(${json(request)});`;
    const auditSql = `select jsonb_build_object('runs',(select count(*) from private.prediction_runs),
      'finalRuns',(select count(*) from private.prediction_runs where state_snapshot#>>'{finalScoringInput,computation}'='FRESH_FINAL'),
      'candidates',(select count(*) from private.prediction_candidates),
      'sourceHash',(select encode(sha256(convert_to(jsonb_build_object(
        'runs',(select jsonb_agg(to_jsonb(r) order by id) from private.prediction_runs r),
        'candidates',(select jsonb_agg(to_jsonb(c) order by prediction_id,item_id) from private.prediction_candidates c),
        'sessions',(select jsonb_agg(to_jsonb(s) order by id) from private.sequential_taste_sessions s),
        'skipSources',(select jsonb_agg(to_jsonb(s) order by prediction_id,action_id) from private.prediction_contextual_skip_sources s)
      )::text,'UTF8')),'hex')));`;
    const observeSql = `begin;set local track_functions='all';set local request.jwt.claim.sub='${actor}';
      set local role authenticated;${call}reset role;
      select jsonb_agg(jsonb_build_object('schema',s.schemaname,'name',s.funcname,'arguments',oidvectortypes(p.proargtypes),
        'calls',s.calls,'totalMs',s.total_time,'selfMs',s.self_time)) from pg_stat_xact_user_functions s join pg_proc p on p.oid=s.funcid
        where s.calls>0 and s.schemaname in('public','private');rollback;`;
    const observed = await exec(observeSql, { stage: 'test' });
    const auditBefore = await one(auditSql);
    const ledgerBefore = await one(skipLedgerHashSql);
    const context = { actor, profileId, request, call, auditSql, catalogSize: 40,
      originalSample: { functionTiming: summarizeFunctionTiming(observed[1], 'rank_items_feed_v1') },
      baselineDefinition, migration: files.at(-1) };
    const report = await collectSkipCallDiagnostics(exec, context);
    assert.equal(report.status, 'PASS', JSON.stringify(report.failure ?? report.restorationFailure)); assert.equal(report.functionsRestored, true);
    assert.deepEqual(report.protocol, skipCallDiagnosticProtocol({ contractTest: true }));
    assert.equal(report.protocol.purpose, 'CONTRACT_TEST_ONLY');
    assert.equal(report.protocol.target.catalogSize, 40);
    assert.equal(skipCallDiagnosticProtocol().target.catalogSize, 1000);
    assert.equal(report.repetitions.length, 3);
    assert.ok(stages.indexOf('skip-call-control-3') < stages.indexOf('skip-call-trace-1'));
    for (const repetition of report.repetitions) {
      assert.equal(repetition.traced.acquisitionCalls, 20);
      assert.ok(repetition.traced.availabilityCalls > 0);
      assert.equal(repetition.replay.rows, 20);
      assert.equal(repetition.replay.exactRowsEqual, true);
      assert.equal(repetition.replay.invalidClockRejections, 2);
      assert.equal(repetition.replay.availabilityReplayResult, true);
      assert.ok(repetition.replay.availabilityReplayPlan[0].Plan);
      assert.ok(repetition.replay.baselineAcquisitionPlan[0].Plan);
      assert.ok(repetition.replay.candidateAcquisitionPlan[0].Plan);
      assert.equal(repetition.control.exactRetries, 2);
      assert.equal(repetition.control.selectedItemIds.length, 5);
    }
    assert.equal(await one("select to_jsonb(pg_get_functiondef('private.acquire_native_candidates_v1(jsonb)'::regprocedure));"), baselineDefinition);
    await db.exec('begin;' + files.at(-1).sql + 'commit;');
    const candidateDefinition = await one("select to_jsonb(pg_get_functiondef('private.acquire_native_candidates_v1(jsonb)'::regprocedure));");
    assert.notEqual(candidateDefinition, baselineDefinition);
    const candidateOriginal = await exec(observeSql, { stage: 'skip-call-control-original' });
    context.originalSample = { functionTiming: summarizeFunctionTiming(candidateOriginal[1], 'rank_items_feed_v1') };
    const candidate = await collectSkipCallDiagnostics(exec, context);
    assert.equal(candidate.status, 'PASS', JSON.stringify(candidate.failure));
    assert.equal(candidate.functionsRestored, true);
    assert.equal(candidate.repetitions.length, 3);
    assert.ok(candidate.repetitions.every(value => value.replay.exactRowsEqual && value.traced.acquisitionCalls === 20));
    assert.equal(await one("select to_jsonb(pg_get_functiondef('private.acquire_native_candidates_v1(jsonb)'::regprocedure));"), candidateDefinition);

    injectFailure = 'skip-call-trace-2';
    const traceFailure = await collectSkipCallDiagnostics(exec, context);
    assert.equal(traceFailure.status, 'FAIL'); assert.equal(traceFailure.functionsRestored, true);
    assert.equal(traceFailure.completedControls, 3); assert.equal(traceFailure.completedTraces, 1);
    assert.equal(traceFailure.missingControls, 0); assert.equal(traceFailure.missingTraces, 2);
    assert.equal(traceFailure.attempts.at(-1).status, 'FAIL');
    assert.equal(traceFailure.failure.stage, 'trace-2');
    injectFailure = 'skip-call-control-2';
    const controlFailure = await collectSkipCallDiagnostics(exec, context);
    assert.equal(controlFailure.status, 'FAIL'); assert.equal(controlFailure.functionsRestored, true);
    assert.equal(controlFailure.completedControls, 1); assert.equal(controlFailure.completedTraces, 0);
    assert.equal(controlFailure.missingControls, 2); assert.equal(controlFailure.missingTraces, 3);
    assert.equal(controlFailure.failure.stage, 'control-2');
    assert.equal(await one("select to_jsonb(pg_get_functiondef('private.acquire_native_candidates_v1(jsonb)'::regprocedure));"), candidateDefinition);
    assert.deepEqual(await one(auditSql), auditBefore);
    assert.equal(await one(skipLedgerHashSql), ledgerBefore);
    await assert.rejects(collectSkipCallDiagnostics(exec, { ...context, actor: 'not-a-fixture' }));
  } finally { await db.close(); }
});
