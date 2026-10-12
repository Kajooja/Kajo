import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Actual independently connected sessions in the owned disposable CLI stack.
// The fixture exports also execute on PGlite, which cannot prove concurrency.
const uuid = n => `a9147200-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actors = [uuid(1), uuid(2)], items = [uuid(20), uuid(21)];
const sessions = Array.from({ length: 5 }, (_, n) => uuid(30 + n));
const requests = [uuid(50), uuid(51), uuid(52)];
const resetIds = Array.from({ length: 8 }, (_, n) => uuid(100 + n));
const ids = values => values.map(value => `'${value}'::uuid`).join(',');
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const profile = actorIndex => `(select id from public.profiles where owner_user_id='${actors[actorIndex]}' and profile_type='PERSONAL')`;
const call = (reset, sessionIndex, actorIndex = 0) => `private.commit_personal_working_reset_v1(
  '${reset}'::uuid,'${actors[actorIndex]}'::uuid,${profile(actorIndex)},'${sessions[sessionIndex]}'::uuid)`;
const relations = ['auth.users', 'public.users', 'public.profiles', 'public.profile_members', 'public.items',
  'public.events', 'public.event_sessions', 'public.item_interactions', 'public.item_lists',
  'public.item_list_entries', 'public.shared_item_endorsements', 'public.shared_item_consensus',
  'private.prediction_runs', 'private.prediction_candidates', 'private.prediction_page_receipts',
  'private.prediction_continuation_windows', 'private.prediction_page_contexts',
  'private.shadow_prediction_jobs', 'private.shadow_prediction_runs', 'private.shadow_prediction_candidates',
  'private.genome_evaluations', 'private.predictor_genomes', 'private.evaluation_windows',
  'private.promotion_decisions', 'private.policy_assignments', 'private.prediction_source_erasure_permissions',
  'private.personal_working_shadow_comparisons', 'private.personal_working_resets'];

export function personalWorkingResetCanonicalEvidenceSql() {
  return `select jsonb_object_agg(identity,snapshot) from (${relations.map(relation => `select '${relation}' identity,
    jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) snapshot
    from ${relation} r`).join(' union all ')}) snapshots;`;
}

export function personalWorkingResetNativeFixtureSql() {
  return `begin;
    insert into auth.users(id,email,raw_user_meta_data)
      select actor,actor::text||'@example.invalid',jsonb_build_object('kajo_nickname','Reset native '||right(actor::text,4))
      from unnest(array[${ids(actors)}]) fixture(actor);
    insert into public.items(id,item_type,title,tags,discoverable)
      select item,'BOOK','Native reset book '||right(item::text,4),array['native-reset'],true
      from unnest(array[${ids(items)}]) fixture(item);
    insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
      select session,actor,p.id,date_trunc('milliseconds',clock_timestamp())-interval '5 minutes','{}'::jsonb
      from (values ${sessions.map((session, index) => `('${session}'::uuid,'${actors[index === 4 ? 1 : 0]}'::uuid)`).join(',')}) fixture(session,actor)
      join public.profiles p on p.owner_user_id=actor and p.profile_type='PERSONAL';
    commit;`;
}

// Genuine existing prediction sources exercise the canonical owner eraser.
export function personalWorkingResetNativeSourcesSql() {
  return requests.map((requestId, index) => {
    const actorIndex = index === 2 ? 1 : 0, sessionIndex = actorIndex === 1 ? 4 : 3;
    return `begin; set local request.jwt.claim.sub='${actors[actorIndex]}'; set local role authenticated;
      with scope as materialized(select jsonb_build_object('version',3,'requestId','${requestId}',
        'profileId',${profile(actorIndex)},'sessionId','${sessions[sessionIndex]}',
        'discoveryMode','FOR_YOU','itemType','BOOK','limit',2,'context',${literal({})}) request)
      select public.rank_items_page_v1(request) from scope; commit;`;
  }).join('\n');
}

export const personalWorkingResetNativeProbeSql = Object.freeze({
  same: call(resetIds[0], 0), distinctFirst: call(resetIds[1], 1), distinctSecond: call(resetIds[2], 1),
  quotaFirst: call(resetIds[3], 2), quotaSecond: call(resetIds[4], 2),
  lifecycleFirst: call(resetIds[5], 3), lifecycleSecond: call(resetIds[6], 3),
  independent: call(resetIds[7], 4, 1),
  quotaFill: `begin; set local request.jwt.claim.sub='${actors[0]}';
    do $fill$ declare n integer; begin for n in 1..127 loop
      perform private.commit_personal_working_reset_v1(
        ('a9147200-0000-4000-8000-'||lpad((1000+n)::text,12,'0'))::uuid,
        '${actors[0]}'::uuid,${profile(0)},'${sessions[2]}'::uuid);
    end loop; end; $fill$; commit;`,
});

export function personalWorkingResetNativeCleanupSql() {
  return `begin;
    do $cleanup$ declare actor uuid; begin foreach actor in array array[${ids(actors)}] loop
      if exists(select 1 from public.users where id=actor) then
        perform private.erase_prediction_sources_v1('ACTOR',actor); end if;
    end loop; end; $cleanup$;
    delete from auth.users where id=any(array[${ids(actors)}]);
    delete from public.items where id=any(array[${ids(items)}]);
    select jsonb_build_object('users',(select count(*) from auth.users where id=any(array[${ids(actors)}]))
      +(select count(*) from public.users where id=any(array[${ids(actors)}])),
      'profiles',(select count(*) from public.profiles where owner_user_id=any(array[${ids(actors)}])),
      'items',(select count(*) from public.items where id=any(array[${ids(items)}])),
      'sessions',(select count(*) from public.event_sessions where id=any(array[${ids(sessions)}])),
      'resets',(select count(*) from private.personal_working_resets where actor_user_id=any(array[${ids(actors)}])),
      'sources',(select count(*) from private.prediction_runs where actor_user_id=any(array[${ids(actors)}])));
    commit;`;
}

export function personalWorkingResetNativeReservedSql() {
  return `select jsonb_build_object(
    'users',(select count(*) from auth.users where id=any(array[${ids(actors)}]))
      +(select count(*) from public.users where id=any(array[${ids(actors)}])),
    'items',(select count(*) from public.items where id=any(array[${ids(items)}])),
    'sessions',(select count(*) from public.event_sessions where id=any(array[${ids(sessions)}])),
    'resets',(select count(*) from private.personal_working_resets where actor_user_id=any(array[${ids(actors)}])
      or id::text like 'a9147200-%'),
    'requests',(select count(*) from private.prediction_page_receipts where request_id=any(array[${ids(requests)}])),
    'backends',(select count(*) from pg_stat_activity where application_name like 'kajo_working_reset_%'));`;
}

export async function verifyPersonalWorkingResetConcurrency(execConcurrentSql) {
  const exec = (sql, stage, timeoutMs = 30_000) => execConcurrentSql(sql, { stage, timeoutMs });
  const running = [], proofs = [];
  let fixtureAttempted = false, original, sourceBaseline, failure, result;
  const sleep = `do $hold$ begin
    begin perform pg_sleep(45); exception when query_canceled then null; end;
  end; $hold$;`;
  const transaction = (name, expression, { actorIndex = 0, hold = false, reject = null } = {}) => `begin;
    set local application_name='${name}'; set local request.jwt.claim.sub='${actors[actorIndex]}';
    ${reject ? `do $reject$ declare rejected text; value jsonb; begin
      begin value:=${expression}; exception when sqlstate '${reject}' then rejected:=sqlstate; end;
      if rejected is distinct from '${reject}' then raise exception 'Native reset expected rejection'; end if;
      perform set_config('kajo.reset_native_result',jsonb_build_object('pid',pg_backend_pid(),'sqlstate',rejected)::text,true);
    end; $reject$; select current_setting('kajo.reset_native_result')::jsonb;`
    : `with response as materialized(select ${expression} value)
      select jsonb_build_object('pid',pg_backend_pid(),'value',value,
        'utf8',encode(convert_to(value::text,'UTF8'),'hex'),
        'sha256',encode(sha256(convert_to(value::text,'UTF8')),'hex')) from response;`}
    ${hold ? sleep : ''} commit;`;
  function launch(name, sql, stage, holds = false) {
    const session = { name, holds };
    running.push(session);
    session.promise = exec(sql, stage, 60_000).then(
      value => (session.state = { value }), error => (session.state = { error }));
    return session;
  }
  async function finish(session) {
    const state = await session.promise;
    if (state.error) throw state.error;
    return state.value;
  }
  async function observe(session, holder = null, lifecycleMode = null) {
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const [observed] = await exec(`do $refresh$ begin perform pg_stat_clear_snapshot(); end; $refresh$;
        select coalesce((select jsonb_build_object('pid',a.pid,'waitEvent',a.wait_event,
          'waitEventType',a.wait_event_type,'blockers',to_jsonb(pg_blocking_pids(a.pid)))
          from pg_stat_activity a where a.application_name='${session.name}' and a.state='active'
          ${holder ? `and a.wait_event_type='Lock' and ${holder.pid}=any(pg_blocking_pids(a.pid))`
          : "and a.wait_event='PgSleep'"}
          ${lifecycleMode ? `and exists(select 1 from pg_locks l where l.pid=a.pid
            and l.locktype='advisory' and l.classid=1946841873::oid and l.objid=232004::oid
            and l.objsubid=2 and l.mode='${lifecycleMode}' and l.granted=${!holder})` : ''}),
          'null'::jsonb);`, 'working-reset-observe-owned-lock-boundary', 10_000);
      if (observed !== null) {
        assert.ok(Number.isSafeInteger(observed.pid) && observed.pid > 0, 'Invalid backend identity');
        if (holder) assert.notEqual(observed.pid, holder.pid, 'Concurrency proof reused the holder connection');
        session.pid = observed.pid;
        return observed;
      }
      if (session.state?.error) throw session.state.error;
      assert.equal(session.state, undefined, 'Session finished before its actual lock boundary was observed');
      await delay(40);
    }
    throw new Error(`Native reset proof did not observe ${session.name} at its lock boundary`);
  }
  async function release(session) {
    if (session.state) return;
    assert.ok(Number.isSafeInteger(session.pid) && session.pid > 0, 'Refusing to cancel an unobserved backend');
    const [released] = await exec(`select coalesce((select to_jsonb(pg_cancel_backend(a.pid))
      from pg_stat_activity a where a.pid=${session.pid} and a.application_name='${session.name}'
        and a.state='active' and a.wait_event='PgSleep'), 'false'::jsonb);`, 'working-reset-release-observed-owned-holder');
    assert.equal(released, true, 'Could not release the owned post-call sleep');
  }
  const evidence = async stage => (await exec(personalWorkingResetCanonicalEvidenceSql(), stage))[0];
  const resetCount = async index => (await exec(`select to_jsonb(count(*)) from private.personal_working_resets
    where session_id='${sessions[index]}';`, 'working-reset-count-owned-scope'))[0];
  const resetRows = async () => (await exec(`select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb)
    from private.personal_working_resets r where actor_user_id=any(array[${ids(actors)}]);`, 'working-reset-frozen-owned-controls'))[0];
  const assertReceipt = entry => {
    assert.ok(entry.value && typeof entry.value === 'object', 'Reset did not return its stored receipt');
    assert.equal(entry.value.version, 'personal-working-reset-v1');
    assert.equal(entry.value.affects, 'WORKING_STATE_ONLY');
    assert.equal(entry.value.createdAt, entry.value.resetAt);
    assert.match(entry.value.resetId, /^[0-9a-f-]{36}$/);
    assert.match(entry.utf8, /^[0-9a-f]+$/);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
  };
  const pair = async (order, holder, waiter, assertion, { lifecycle = null, beforeCommit = async () => {} } = {}) => {
    const holderLock = await observe(holder, null, lifecycle?.holder);
    const waiting = waiter();
    const waiterLock = await observe(waiting, holder, lifecycle?.waiter);
    await beforeCommit();
    await release(holder);
    const heldRows = await finish(holder), waitedRows = await finish(waiting);
    await assertion(heldRows[0], waitedRows[0]);
    proofs.push({ order, holder: holderLock, waiter: waiterLock });
  };
  const erasure = source => `private.erase_prediction_sources_v1('PREDICTION_RUN','${source}'::uuid)`;
  const sourceSnapshot = async source => (await exec(`select jsonb_build_object(
    'source',(select to_jsonb(r) from private.prediction_runs r where id='${source}'),
    'candidates',(select coalesce(jsonb_agg(to_jsonb(r) order by item_id),'[]'::jsonb)
      from private.prediction_candidates r where prediction_id='${source}'),
    'comparisons',(select coalesce(jsonb_agg(to_jsonb(r) order by control),'[]'::jsonb)
      from private.personal_working_shadow_comparisons r where source_prediction_id='${source}'));`,
  'working-reset-independent-frozen-source'))[0];

  try {
    const [acl] = await exec(`select jsonb_build_object('functions',count(*),'ownerOnlyInvoker',bool_and(
      not p.prosecdef and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))
        where grantee=0 and privilege_type='EXECUTE'))) from pg_proc p where p.oid=
      'private.commit_personal_working_reset_v1(uuid,uuid,uuid,uuid)'::regprocedure;`, 'working-reset-owner-only-acl');
    assert.deepEqual(acl, { functions: 1, ownerOnlyInvoker: true });
    const [reserved] = await exec(personalWorkingResetNativeReservedSql(), 'working-reset-reserved-fixture-guard');
    assert.deepEqual(reserved, { users: 0, items: 0, sessions: 0, resets: 0, requests: 0, backends: 0 },
      'Native reset namespace is occupied; fixture ownership was not claimed');
    original = await evidence('working-reset-original-canonical-state');
    fixtureAttempted = true;
    await exec(personalWorkingResetNativeFixtureSql(), 'working-reset-owned-fixture');
    const pages = await exec(personalWorkingResetNativeSourcesSql(), 'working-reset-real-source-fixtures');
    assert.equal(pages.length, 3);
    const sourceIds = pages.map(page => page.predictionId);
    for (const source of sourceIds) assert.match(source, /^[0-9a-f-]{36}$/);
    const independentSource = await sourceSnapshot(sourceIds[2]);
    sourceBaseline = await evidence('working-reset-initialized-source-baseline');

    let holder = launch('kajo_working_reset_same_holder', transaction('kajo_working_reset_same_holder',
      personalWorkingResetNativeProbeSql.same, { hold: true }), 'working-reset-identical-id-holder', true);
    let sameReceipt;
    await pair('SAME_RESET_ID_EXACTLY_ONCE', holder,
      () => launch('kajo_working_reset_same_waiter', transaction('kajo_working_reset_same_waiter',
        personalWorkingResetNativeProbeSql.same), 'working-reset-identical-id-waiter'),
      async (first, second) => {
        assertReceipt(first); assertReceipt(second); sameReceipt = first;
        assert.deepEqual(second.value, first.value);
        assert.equal(second.utf8, first.utf8); assert.equal(second.sha256, first.sha256);
        assert.equal(await resetCount(0), 1, 'Concurrent retry allocated two controls');
      }, { beforeCommit: async () => assert.equal(await resetCount(0), 0, 'Uncommitted control became visible') });
    assert.match(proofs.at(-1).waiter.waitEvent, /advisory/i, 'Identical ID did not serialize at its advisory lock');

    let blockedServerTime;
    holder = launch('kajo_working_reset_distinct_holder', transaction('kajo_working_reset_distinct_holder',
      personalWorkingResetNativeProbeSql.distinctFirst, { hold: true }), 'working-reset-distinct-id-holder', true);
    await pair('DISTINCT_IDS_SAME_SCOPE_SERIALIZE', holder,
      () => launch('kajo_working_reset_distinct_waiter', transaction('kajo_working_reset_distinct_waiter',
        personalWorkingResetNativeProbeSql.distinctSecond), 'working-reset-distinct-id-profile-waiter'),
      async (first, second) => {
        assertReceipt(first); assertReceipt(second);
        assert.notDeepEqual(second.value, first.value, 'Distinct reset IDs reused one receipt');
        assert.equal(await resetCount(1), 2);
        const [freshCutoff] = await exec(`select to_jsonb(reset_at>='${blockedServerTime}'::timestamptz)
          from private.personal_working_resets where id='${resetIds[2]}';`, 'working-reset-clock-after-observed-profile-wait');
        assert.equal(freshCutoff, true, 'Waiter froze its cutoff before obtaining the Profile lock');
      }, { beforeCommit: async () => {
        assert.equal(await resetCount(1), 0);
        [blockedServerTime] = await exec('select to_jsonb(clock_timestamp());', 'working-reset-server-time-while-waiting');
        assert.equal(typeof blockedServerTime, 'string');
      } });
    assert.match(proofs.at(-1).waiter.waitEvent, /transactionid|tuple/i, 'Distinct ID did not reach the Profile row gate');

    await exec(personalWorkingResetNativeProbeSql.quotaFill, 'working-reset-fill-127-real-controls', 60_000);
    assert.equal(await resetCount(2), 127);
    holder = launch('kajo_working_reset_quota_holder', transaction('kajo_working_reset_quota_holder',
      personalWorkingResetNativeProbeSql.quotaFirst, { hold: true }), 'working-reset-128th-holder', true);
    await pair('ONE_REMAINING_QUOTA_SLOT_EXACTLY_ONCE', holder,
      () => launch('kajo_working_reset_quota_waiter', transaction('kajo_working_reset_quota_waiter',
        personalWorkingResetNativeProbeSql.quotaSecond, { reject: '54000' }), 'working-reset-129th-profile-waiter'),
      async (accepted, rejected) => {
        assertReceipt(accepted); assert.equal(rejected.sqlstate, '54000');
        assert.equal(await resetCount(2), 128, 'Quota race exceeded the complete retained control budget');
        const [retry] = await exec(transaction('kajo_working_reset_full_quota_retry',
          personalWorkingResetNativeProbeSql.quotaFirst), 'working-reset-cached-retry-before-quota');
        assert.deepEqual(retry.value, accepted.value); assert.equal(retry.utf8, accepted.utf8);
      }, { beforeCommit: async () => assert.equal(await resetCount(2), 127) });
    assert.match(proofs.at(-1).waiter.waitEvent, /transactionid|tuple/i);
    const [independent] = await exec(transaction('kajo_working_reset_independent',
      personalWorkingResetNativeProbeSql.independent, { actorIndex: 1 }), 'working-reset-independent-owned-control');
    assertReceipt(independent);
    const afterResets = await evidence('working-reset-only-control-effect');
    assert.equal(afterResets['private.personal_working_resets'].count,
      sourceBaseline['private.personal_working_resets'].count + 132);
    delete afterResets['private.personal_working_resets'];
    delete sourceBaseline['private.personal_working_resets'];
    assert.deepEqual(afterResets, sourceBaseline, 'Reset controller changed canonical evidence or frozen source bytes');

    holder = launch('kajo_working_reset_before_erase', transaction('kajo_working_reset_before_erase',
      personalWorkingResetNativeProbeSql.lifecycleFirst, { hold: true }), 'working-reset-before-source-erasure-holder', true);
    await pair('RESET_COMMIT_THEN_SOURCE_ERASURE', holder,
      () => launch('kajo_working_reset_erase_waiter', transaction('kajo_working_reset_erase_waiter',
        erasure(sourceIds[0])), 'working-reset-source-erasure-exclusive-waiter'),
      async (reset, erased) => {
        assertReceipt(reset); assert.ok(erased.value && typeof erased.value === 'object');
        assert.equal((await sourceSnapshot(sourceIds[0])).source, null);
        assert.equal(await resetCount(3), 1, 'Prediction-source erasure removed raw scope controls');
        const [retry] = await exec(transaction('kajo_working_reset_after_erase_retry',
          personalWorkingResetNativeProbeSql.lifecycleFirst), 'working-reset-after-erasure-frozen-retry');
        assert.deepEqual(retry.value, reset.value); assert.equal(retry.utf8, reset.utf8);
      }, { lifecycle: { holder: 'ShareLock', waiter: 'ExclusiveLock' } });
    assert.match(proofs.at(-1).waiter.waitEvent, /advisory/i);
    const controlsBefore = await resetRows();
    holder = launch('kajo_working_reset_erase_first', transaction('kajo_working_reset_erase_first',
      erasure(sourceIds[1]), { hold: true }), 'working-reset-source-erasure-first-holder', true);
    await pair('SOURCE_ERASURE_COMMIT_THEN_RESET', holder,
      () => launch('kajo_working_reset_after_erase', transaction('kajo_working_reset_after_erase',
        personalWorkingResetNativeProbeSql.lifecycleSecond), 'working-reset-shared-lifecycle-waiter'),
      async (erased, reset) => {
        assert.ok(erased.value && typeof erased.value === 'object'); assertReceipt(reset);
        assert.equal((await sourceSnapshot(sourceIds[1])).source, null);
        assert.equal(await resetCount(3), 2);
        const after = await resetRows();
        for (const prior of controlsBefore) assert.deepEqual(after.find(row => row.id === prior.id), prior,
          'Source erasure or a subsequent control mutated a raw reset');
      }, { lifecycle: { holder: 'ExclusiveLock', waiter: 'ShareLock' } });
    assert.match(proofs.at(-1).waiter.waitEvent, /advisory/i);
    assert.deepEqual(await sourceSnapshot(sourceIds[2]), independentSource,
      'Owned source erasure changed the independent actor source/candidate/comparison bytes');
    const [sameRetry] = await exec(transaction('kajo_working_reset_final_exact_retry',
      personalWorkingResetNativeProbeSql.same), 'working-reset-all-races-frozen-retry');
    assert.deepEqual(sameRetry.value, sameReceipt.value); assert.equal(sameRetry.utf8, sameReceipt.utf8);
    result = { status: 'PASS', proofs, cases: ['identical reset ID returns one byte-exact frozen receipt',
      'distinct reset IDs serialize at the Profile row before quota and server cutoff',
      '127 retained controls admit one of two competing new IDs; exact retry remains valid at 128',
      'reset and real source erasure serialize in both lifecycle orders; raw controls survive',
      'independent frozen source and complete unrelated canonical state survive exact owned cleanup'],
    servingControl: 'OFF', qualityAdmission: false, nativeActivated: false };
  } catch (error) { failure = error; }
  finally {
    const cleanupFailures = [];
    for (const session of running.filter(session => session.holds && !session.pid && !session.state)) {
      try { await observe(session); } catch (error) { cleanupFailures.push(error); }
    }
    for (const session of running.filter(session => session.holds && session.pid && !session.state)) {
      try { await release(session); } catch (error) { cleanupFailures.push(error); }
    }
    for (const session of running) {
      const settled = await session.promise;
      if (settled.error && settled.error !== failure) cleanupFailures.push(settled.error);
    }
    if (fixtureAttempted) {
      try {
        const [remaining] = await exec(personalWorkingResetNativeCleanupSql(), 'working-reset-cleanup-only-owned-fixture', 60_000);
        assert.deepEqual(remaining, { users: 0, profiles: 0, items: 0, sessions: 0, resets: 0, sources: 0 });
        if (original) assert.deepEqual(await evidence('working-reset-unrelated-state-after-cleanup'), original);
      } catch (error) { cleanupFailures.push(error); }
    }
    if (cleanupFailures.length) throw new AggregateError(failure ? [failure, ...cleanupFailures] : cleanupFailures,
      'Native reset proof failed; original, owned-session and fixture-cleanup errors are retained');
  }
  if (failure) throw failure;
  return result;
}
