// Diagnostic baseline for an owned, disposable installation only. These are
// actual authenticated RPCs, never a replacement scorer or hosted load test.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { nativeCandidateRequestFixtureSql } from './native-candidate-request.mjs';
import { skipHistories, offCatalogueSize, expectedSkipHistoryInventory, skipHistoryFixtureSql,
  skipLedgerHashSql } from './native-skip-history-fixture.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => literal(JSON.stringify(value)) + '::jsonb';
const id = n => 'ab157000-0000-4000-8000-' + String(n).padStart(12, '0');
const actor = id(1), shared = id(900);
const operations = ['discovery-personal-movie', 'discovery-shared-movie', 'taste-personal-next'];

export function performanceProtocol({ contractTest = false, profileFunctions = false, skipHistory = false } = {}) {
  const protocol = {
    version: 'native-prediction-performance-v2',
    purpose: contractTest ? 'CONTRACT_TEST_ONLY' : profileFunctions
      ? 'SINGLE_OBSERVATION_FUNCTION_DIAGNOSTIC' : 'EXPLORATORY_NATIVE_DATABASE_BASELINE',
    catalogSizes: contractTest ? [40, 60] : [40, 1000],
    operations, requestKinds: profileFunctions ? ['fresh'] : ['fresh', 'exact-retry'],
    warmupsPerCohort: contractTest || profileFunctions ? 0 : 2,
    samplesPerCohort: contractTest || profileFunctions ? 1 : 20,
    quantile: profileFunctions ? 'NONE_SINGLE_DIAGNOSTIC_OBSERVATION' : 'NEAREST_RANK_CEILING_N_TIMES_P',
    tail: 'EXPLORATORY_NO_LATENCY_SLO',
    trackFunctions: profileFunctions ? 'all' : 'none',
    functionTiming: profileFunctions ? {
      source: 'PG_STAT_XACT_USER_FUNCTIONS_BEFORE_AUDITS_AND_VERIFICATION_RETRIES',
      schemas: ['public', 'private'], topSelfTimeLimit: 25,
      scope: 'TRACKED_NON_INLINED_FUNCTIONS_ONLY_ELAPSED_NOT_CPU_TIME',
      totalTime: 'INCLUSIVE_DO_NOT_SUM_FUNCTION_TOTALS',
      instrumentation: 'SEPARATE_FROM_BASELINE_OVERHEAD_NOT_SUBTRACTED',
    } : null,
    boundary: 'POSTGRES_EXPLAIN_ANALYZE_EXECUTION_NO_RESULT_SERIALIZATION_OR_NETWORK',
    explain: 'ANALYZE, BUFFERS, WAL, TIMING OFF, SUMMARY ON, FORMAT JSON',
    order: 'CATALOG_ASCENDING_THEN_OPERATION_THEN_REQUEST_KIND_SERIAL',
    cache: profileFunctions ? 'NO_WARMUP_OR_CACHE_FLUSH_NEW_CONNECTION_SINGLE_OBSERVATION'
      : 'WARMUP_NO_CACHE_FLUSH_EACH_TRIAL_NEW_CONNECTION_IN_NATIVE_RUNNER',
    analyzedTables: ['public.items', 'private.item_sources'],
    state: 'NEW_FIXTURE_PER_COHORT_COMMITTED_START_AND_RETRY_ORIGINAL_EACH_TRIAL_ROLLED_BACK',
    history: 'TWO_DISTINCT_PERSONAL_RATINGS_SHARED_TWO_MEMBERS_THREE_INTERACTIONS_EMPTY_TASTE_PREFIX',
    discovery: { mode: 'FOR_YOU', domain: 'MOVIE', limit: 5, cursor: null },
    exclusions: ['PHONE', 'NETWORK', 'RENDER', 'CONCURRENT_LOAD', 'COLD_CACHE', 'COMMIT_FSYNC',
      'RESULT_SERIALIZATION', 'EXPLICIT_EVALUATION', 'SHADOW_WORKER', 'PREDICTIVE_QUALITY', 'PEAK_PROCESS_MEMORY'],
    instrumentation: 'EXPLAIN_OVERHEAD_NOT_SUBTRACTED_NO_UNINSTRUMENTED_EQUIVALENCE_CLAIM',
    retention: 'SYNTHETIC_AGGREGATES_TIMINGS_FUNCTION_IDENTITIES_NO_QUERIES_PLANS_USER_ITEM_IDS_OR_RESPONSES',
  };
  return skipHistory ? { ...protocol, version: 'native-skip-history-performance-v1',
    catalogSizes: contractTest ? [40] : [1000], skipHistories,
    order: 'SKIP_HISTORY_THEN_CATALOG_OPERATION_REQUEST_SERIAL',
    analyzedTables: [...protocol.analyzedTables, 'private.contextual_skip_commands'],
    history: { base: protocol.history, catalogue: 'FOUR_EXPIRED_PER_ITEM_PLUS_BALANCED_ACTIVE_REVERSED_FUTURE_ERASED',
      offCatalogueItems: offCatalogueSize(contractTest), unrelatedProfile: 'ACTIVE_SKIP_ON_EACH_CURRENT_ITEM',
      validation: 'COMMITTED_LEDGER_INVENTORY_AND_PER_PROFILE_DECISIONS_BEFORE_WARMUPS',
      preservation: 'LEDGER_HASH_BEFORE_AND_AFTER_COHORT_RETAINED_SKIP_LINEAGE_ON_EACH_RETRY' } } : protocol;
}

const metrics = {
  planningMs: ['Planning Time'], executionMs: ['Execution Time'],
  sharedHitBlocks: ['Plan', 'Shared Hit Blocks'], sharedReadBlocks: ['Plan', 'Shared Read Blocks'],
  sharedDirtiedBlocks: ['Plan', 'Shared Dirtied Blocks'], sharedWrittenBlocks: ['Plan', 'Shared Written Blocks'],
  tempReadBlocks: ['Plan', 'Temp Read Blocks'], tempWrittenBlocks: ['Plan', 'Temp Written Blocks'],
  walRecords: ['Plan', 'WAL Records'], walFullPageImages: ['Plan', 'WAL FPI'], walBytes: ['Plan', 'WAL Bytes'],
};

export function explainMetrics(explain) {
  assert.equal(explain?.length, 1, 'Expected one EXPLAIN statement');
  const result = {};
  for (const [name, path] of Object.entries(metrics)) {
    const value = path.reduce((node, key) => node?.[key], explain[0]);
    assert.ok(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'Missing/invalid EXPLAIN metric: ' + name);
    if (!name.endsWith('Ms')) assert.ok(Number.isInteger(value), 'Resource counter must be integral');
    result[name] = value;
  }
  return result; // Root counters already include children: never sum the plan tree.
}

export function summarizePerformance(samples, planned, attempted, failures, { quantiles = true } = {}) {
  assert.ok(Number.isInteger(planned) && planned > 0);
  assert.ok(Number.isInteger(attempted) && samples.length + failures.length === attempted && attempted <= planned);
  const summary = { planned, attempted, succeeded: samples.length,
    failed: failures.filter(value => value === 'ERROR').length,
    cancelled: failures.filter(value => value === 'TIMEOUT').length, missing: planned - attempted };
  assert.equal(summary.failed + summary.cancelled, failures.length);
  if (!quantiles) return summary;
  summary.metrics = {};
  for (const name of Object.keys(metrics)) {
    const values = samples.map(sample => sample[name]).sort((a, b) => a - b);
    assert.ok(values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0));
    summary.metrics[name] = values.length ? {
      min: values[0], p50: values[Math.ceil(values.length * 0.5) - 1],
      p95: values[Math.ceil(values.length * 0.95) - 1], max: values.at(-1),
    } : null;
  }
  return summary;
}

export function summarizeFunctionTiming(rows, rootName) {
  assert.ok(Array.isArray(rows) && rows.length > 0, 'Missing transaction function timings');
  const identities = new Set();
  for (const row of rows) {
    assert.ok(['public', 'private'].includes(row.schema));
    assert.ok(typeof row.name === 'string' && row.name.length > 0 && typeof row.arguments === 'string');
    const identity = JSON.stringify([row.schema, row.name, row.arguments]);
    assert.ok(!identities.has(identity), 'Duplicate function identity'); identities.add(identity);
    assert.ok(Number.isInteger(row.calls) && row.calls > 0);
    for (const key of ['totalMs', 'selfMs']) assert.ok(Number.isFinite(row[key]) && row[key] >= 0);
  }
  const root = rows.find(row => row.schema === 'public' && row.name === rootName && row.arguments === 'jsonb');
  assert.equal(root?.calls, 1, 'Diagnostic must contain exactly one measured root RPC call');
  const sorted = [...rows].sort((a, b) => b.selfMs - a.selfMs
    || JSON.stringify([a.schema, a.name, a.arguments]).localeCompare(JSON.stringify([b.schema, b.name, b.arguments])));
  const limit = performanceProtocol({ profileFunctions: true }).functionTiming.topSelfTimeLimit;
  const skipDecision = rows.find(row => row.schema === 'private' && row.name === 'contextual_skip_decision_v1'
    && row.arguments === 'uuid, uuid, timestamp with time zone, boolean') ?? null;
  return { trackedFunctions: rows.length, omittedFunctions: Math.max(0, rows.length - limit),
    root, skipDecision, topSelfTime: sorted.slice(0, limit) };
}

const functionTimingSql = `select coalesce(jsonb_agg(jsonb_build_object(
  'schema',s.schemaname,'name',s.funcname,'arguments',oidvectortypes(p.proargtypes),
  'calls',s.calls,'totalMs',s.total_time,'selfMs',s.self_time)), '[]'::jsonb)
  from pg_stat_xact_user_functions s join pg_proc p on p.oid=s.funcid
  where s.calls>0 and s.schemaname in('public','private');`;

const sourceAudit = (skipHistory = false) => `select jsonb_build_object(
  'runs',(select count(*) from private.prediction_runs),
  'finalRuns',(select count(*) from private.prediction_runs where state_snapshot#>>'{finalScoringInput,computation}'='FRESH_FINAL'),
  'candidates',(select count(*) from private.prediction_candidates),
  'sourceHash',(select encode(sha256(convert_to(jsonb_build_object(
    'runs',(select jsonb_agg(to_jsonb(r) order by id) from private.prediction_runs r),
    'candidates',(select jsonb_agg(to_jsonb(c) order by prediction_id,item_id) from private.prediction_candidates c),
    'sessions',(select jsonb_agg(to_jsonb(s) order by id) from private.sequential_taste_sessions s)
    ${skipHistory ? ",'skipSources',(select jsonb_agg(to_jsonb(s) order by prediction_id,action_id) from private.prediction_contextual_skip_sources s)" : ''}
  )::text,'UTF8')),'hex')));`;

export async function collectNativePredictionPerformance(execSql, { contractTest = false, profileFunctions = false, skipHistory = false } = {}) {
  const protocol = performanceProtocol({ contractTest, profileFunctions, skipHistory });
  const auditSql = sourceAudit(skipHistory);
  const exec = (sql, stage) => execSql(sql, { stage: 'native-perf-' + stage, timeoutMs: 120_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  // This refusal is in addition to the runner's CI-only owned-stack boundary.
  assert.deepEqual(await one(`select jsonb_build_object('users',(select count(*) from auth.users),
    'items',(select count(*) from public.items),'runs',(select count(*) from private.prediction_runs));`, 'empty'),
  { users: 0, items: 0, runs: 0 }, 'Performance fixtures require an empty disposable installation');
  const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in('public','private','auth');`, 'tables');
  const snapshotSql = 'begin read only;set local extra_float_digits=3;select jsonb_object_agg(name,value) from ('
    + tables.map(name => 'select ' + literal(name) + ` name,encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value from ` + name + ' r').join(' union all ')
    + ') s;rollback;';
  const before = await one(snapshotSql, 'before');
  const report = { status: 'COLLECTING', protocol, protocolSha256: hash(JSON.stringify(protocol)),
    sourceSha256: hash(await readFile(new URL('native-prediction-performance.mjs', import.meta.url))),
    fixtureSha256: hash(await nativeCandidateRequestFixtureSql()),
    ...(skipHistory ? { historyFixtureSha256: hash(await readFile(new URL('native-skip-history-fixture.mjs', import.meta.url))) } : {}),
    cohorts: [], cleanup: 'NOT_VERIFIED' };
  for (const history of protocol.skipHistories ?? [null]) for (const catalogSize of protocol.catalogSizes)
    for (const operation of operations) for (const requestKind of protocol.requestKinds) {
    report.cohorts.push({ ...(history ? { skipHistory: history } : {}), catalogSize, operation, requestKind,
      warmupsCompleted: 0, attempted: 0, samples: [], failures: [] });
  }
  let fixture = false, primaryError;
  const cleanup = async () => {
    await exec(`rollback;begin;
      do $erase$ declare a uuid;begin for a in select id from public.users where id::text like 'ab157000-%' loop
        perform private.erase_prediction_sources_v1('ACTOR',a);end loop;end;$erase$;
      delete from private.sequential_taste_sessions where actor_user_id::text like 'ab157000-%';
      delete from public.item_interactions where actor_user_id::text like 'ab157000-%';
      delete from public.profiles where id='${shared}';
      delete from auth.users where id::text like 'ab157000-%';
      delete from private.item_sources where item_id::text like 'ab157000-%';
      delete from public.items where id::text like 'ab157000-%';commit;`, 'cleanup');
    assert.deepEqual(await one(snapshotSql, 'after'), before, 'Performance fixture changed canonical rows');
    fixture = false;
    report.cleanup = 'ALL_CANONICAL_ROWS_RESTORED';
    report.canonicalTablesVerified = tables.length;
  };
  try {
    report.environment = await one(`select jsonb_build_object('observedAt',clock_timestamp(),
      'serverVersion',current_setting('server_version'),'blockSize',current_setting('block_size'),
      'sharedBuffers',current_setting('shared_buffers'),'workMem',current_setting('work_mem'),
      'jit',current_setting('jit'),'trackIoTiming',current_setting('track_io_timing'),
      'defaultTrackFunctions',current_setting('track_functions'));`, 'environment');
    outer: for (const cohort of report.cohorts) {
      fixture = true;
      report.cleanup = 'NOT_VERIFIED';
      await exec('begin;' + await nativeCandidateRequestFixtureSql() + `
      insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
        select '${id(810)}','${actor}',id,now(),'{}' from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL';
      insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context) values('${id(811)}','${actor}','${shared}',now(),'{}');commit;`, 'fixture');
      const profileId = await one(`select to_jsonb(id) from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL';`, 'profile');
      const start = await one(`begin;set local request.jwt.claim.sub='${actor}';set local role authenticated;
      select public.taste_session_v2(${json({ operation: 'START', profileId, requestId: randomUUID() })});commit;`, 'start');
      assert.equal(start.status, 'NEEDS_NEXT');
      if (cohort.catalogSize > 40) {
        await exec(`begin;insert into public.items(id,item_type,title,tags,metadata)
          select ('ab157000-0000-4000-8000-'||lpad((100000+n)::text,12,'0'))::uuid,
            case when n%2=0 then 'MOVIE' else 'BOOK' end,'Performance fixture '||n,
            case when n%5=0 then '{}'::text[] else array['taste-'||(n%4)::text,'shared-feature'] end,
            jsonb_build_object('coldStartRecognition',0.1,'coldStartPriorSource','KAJO_CURATED_RECOGNITION')
          from generate_series(0,${cohort.catalogSize - 41}) n;
          insert into private.item_sources(item_id,provider_key,provider_item_id)
            select id,'kajo_curated',id::text from public.items where title like 'Performance fixture %'
            on conflict do nothing;commit;`, 'expand');
      }
      await exec('analyze public.items;analyze private.item_sources;', 'analyze');
      assert.equal(await one('select to_jsonb(count(*)) from public.items;', 'catalog-size'), cohort.catalogSize);
      let ledgerHash;
      if (skipHistory) {
        cohort.historyInventory = await one(skipHistoryFixtureSql(profileId, cohort.skipHistory, cohort.catalogSize, contractTest), 'history-fixture');
        assert.deepEqual(cohort.historyInventory, expectedSkipHistoryInventory(cohort.skipHistory, cohort.catalogSize, contractTest));
        ledgerHash = await one(skipLedgerHashSql, 'history-before');
      }
      const taste = cohort.operation === 'taste-personal-next';
      const retry = cohort.requestKind === 'exact-retry';
      const makeRequest = () => taste
        ? { operation: 'NEXT', profileId, sessionId: start.sessionId, requestId: randomUUID(), expectedRevision: start.revision }
        : { version: 3, requestId: randomUUID(), profileId: cohort.operation.includes('shared') ? shared : profileId,
          sessionId: cohort.operation.includes('shared') ? id(811) : id(810), discoveryMode: 'FOR_YOU',
          itemType: 'MOVIE', limit: 5, context: {}, cursor: null, replacesChainId: null };
      const rpc = request => `select public.${taste ? 'taste_session_v2' : 'rank_items_feed_v1'}(${json(request)});`;
      const committedRequest = retry ? makeRequest() : null;
      const committed = retry ? await exec(`begin;set local extra_float_digits=3;set local request.jwt.claim.sub='${actor}';`
        + 'set local role authenticated;' + rpc(committedRequest) + 'reset role;' + auditSql + 'commit;', 'original') : null;
      for (let index = -protocol.warmupsPerCohort; index < protocol.samplesPerCohort; index++) {
        if (index >= 0) cohort.attempted++;
        try {
          const request = committedRequest ?? makeRequest(), call = rpc(request);
          // Raw EXPLAIN JSON is pretty-printed across lines. Keep its execution
          // boundary, but emit compact jsonb for the native psql line protocol.
          const output = await exec(`begin;set local extra_float_digits=3;set local request.jwt.claim.sub='${actor}';
            set local track_functions='${protocol.trackFunctions}';
            create temp table perf_plan(value jsonb) on commit drop;
            grant insert,select on perf_plan to authenticated;set local role authenticated;
            do $measure$ declare plan jsonb;begin execute ` + literal('explain (' + protocol.explain + ') ' + call)
            + ` into plan;insert into pg_temp.perf_plan values(plan);end;$measure$;
            reset role;select value from pg_temp.perf_plan;` + (profileFunctions ? functionTimingSql : '') + auditSql
            + 'set local role authenticated;' + call + call + 'reset role;' + auditSql + 'rollback;', 'sample');
          assert.equal(output.length, profileFunctions ? 6 : 5);
          const functionTiming = profileFunctions
            ? summarizeFunctionTiming(output.splice(1, 1)[0], taste ? 'taste_session_v2' : 'rank_items_feed_v1') : null;
          const [plan, audit, response, second, afterRetry] = output;
          const sample = explainMetrics(plan);
          assert.deepEqual(afterRetry, audit, 'Exact retry changed its retained source');
          assert.deepEqual(response, second, 'Exact retry changed its response');
          if (retry) {
            assert.deepEqual(committed[0], response, 'Measured retry changed its committed response');
            assert.deepEqual(committed[1], audit, 'Measured retry changed its committed source');
          }
          assert.equal(audit.runs, 1);
          assert.equal(audit.finalRuns, 1);
          assert.ok(audit.candidates > 0);
          assert.equal(response.profileId, request.profileId);
          assert.equal(response.sessionId, request.sessionId);
          if (taste) assert.equal(response.status, 'QUESTION');
          else assert.equal(response.items.length, 5);
          sample.candidates = audit.candidates;
          if (profileFunctions) sample.functionTiming = functionTiming;
          if (index < 0) cohort.warmupsCompleted++;
          else cohort.samples.push(sample);
        } catch (error) {
          const failure = /timeout|timed out|canceling statement/i.test(error.message) ? 'TIMEOUT' : 'ERROR';
          if (index >= 0) cohort.failures.push(failure);
          else cohort.warmupFailure = failure;
          // Preserve every denominator and the failed cohort; do not turn a
          // cancellation into a fast sample or continue a broken contract.
          report.failure = { ...(skipHistory ? { skipHistory: cohort.skipHistory } : {}), operation: cohort.operation, requestKind: cohort.requestKind, catalogSize: cohort.catalogSize,
            phase: index < 0 ? 'WARMUP' : 'MEASUREMENT', kind: failure };
          report.status = 'FAIL';
          console.error('Native performance sample failed:', error.message);
          break outer;
        }
      }
      if (skipHistory) {
        assert.equal(await one(skipLedgerHashSql, 'history-after'), ledgerHash, 'Measured RPC changed skip history');
        cohort.historyPreserved = true;
      }
      await cleanup();
    }
    for (const cohort of report.cohorts) {
      cohort.summary = summarizePerformance(cohort.samples, protocol.samplesPerCohort, cohort.attempted, cohort.failures,
        { quantiles: !profileFunctions });
    }
    if (report.status === 'COLLECTING') report.status = 'PASS';
    return report;
  } catch (error) { primaryError = error; throw error; }
  finally {
    if (fixture) {
      try {
        await cleanup();
      } catch (error) { throw new AggregateError(primaryError ? [primaryError, error] : [error], 'Performance collection/cleanup failed'); }
    }
  }
}
