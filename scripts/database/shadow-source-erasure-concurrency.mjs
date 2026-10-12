import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Actual independent sessions in the newly owned CLI stack. Only the worker
// boundary is exercised natively here; evaluator/canary behavior has separate
// transactional smoke coverage. No committed immutable fixture window is made.
export async function verifyShadowSourceErasureConcurrency(execConcurrentSql) {
  const exec = (sql, stage, timeoutMs = 30_000) => execConcurrentSql(sql, { stage, timeoutMs });
  const uuid = n => `a232e400-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const actors = [uuid(1), uuid(2)], items = [uuid(3), uuid(4)];
  const sessions = [uuid(10), uuid(11), uuid(12)], requests = [uuid(20), uuid(21), uuid(22)];
  const backendNames = ['kajo_shadow_erasure_unrelated_queue_guard', 'kajo_shadow_erasure_worker_first',
    'kajo_shadow_erasure_erase_waiter', 'kajo_shadow_erasure_erase_first', 'kajo_shadow_erasure_worker_waiter'];
  const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const ids = values => values.map(value => `'${value}'::uuid`).join(',');
  const actorIds = ids(actors), itemIds = ids(items), sessionIds = ids(sessions);
  const lock = `l.locktype='advisory' and l.classid=1946841873::oid
    and l.objid=232004::oid and l.objsubid=2`;
  const sleep = `do $hold$ begin
    begin perform pg_sleep(45); exception when query_canceled then null; end;
  end; $hold$;`;
  const owned = [], proofs = [], running = [];
  let fixtureAttempted = false, original, profiles, guard, failure, result;

  const evidence = async stage => (await exec(`select jsonb_object_agg(identity,snapshot) from (
    ${['public.events', 'public.event_sessions', 'public.item_interactions', 'public.item_lists',
      'public.item_list_entries', 'public.shared_item_endorsements', 'public.shared_item_consensus',
      'private.prediction_runs', 'private.prediction_candidates', 'private.shadow_prediction_jobs',
      'private.shadow_prediction_runs', 'private.shadow_prediction_candidates', 'private.genome_evaluations',
      'private.predictor_genomes', 'private.evaluation_windows', 'private.promotion_decisions',
      'private.policy_assignments', 'private.prediction_source_erasure_permissions'].map(relation => `select '${relation}' identity,
        jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
          coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) snapshot
        from ${relation} r`).join(' union all ')}
    ) snapshots;`, stage))[0];
  const counts = async (source, stage) => (await exec(`select jsonb_build_object(
    'sources',(select count(*) from private.prediction_runs where id='${source}'),
    'candidates',(select count(*) from private.prediction_candidates where prediction_id='${source}'),
    'jobs',(select count(*) from private.shadow_prediction_jobs where source_prediction_id='${source}'),
    'queued',(select count(*) from private.shadow_prediction_jobs where source_prediction_id='${source}' and status='QUEUED'),
    'shadows',(select count(*) from private.shadow_prediction_runs where source_prediction_id='${source}'),
    'shadowCandidates',(select count(*) from private.shadow_prediction_candidates c join private.shadow_prediction_runs r
      on r.id=c.shadow_prediction_id where r.source_prediction_id='${source}'));`, stage))[0];
  const absent = counts => assert.deepEqual(counts,
    { sources: 0, candidates: 0, jobs: 0, queued: 0, shadows: 0, shadowCandidates: 0 },
    'Erasure left a production source, queued work or immutable shadow artifact');
  const frozenControl = async source => (await exec(`select jsonb_build_object(
    'source',(select to_jsonb(r) from private.prediction_runs r where r.id='${source}'),
    'jobs',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb)
      from private.shadow_prediction_jobs r where r.source_prediction_id='${source}'),
    'shadows',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb)
      from private.shadow_prediction_runs r where r.source_prediction_id='${source}'),
    'candidates',(select coalesce(jsonb_agg(to_jsonb(c) order by c.shadow_prediction_id,c.item_id),'[]'::jsonb)
      from private.shadow_prediction_candidates c join private.shadow_prediction_runs r
      on r.id=c.shadow_prediction_id where r.source_prediction_id='${source}'));`,
  'shadow-erasure-unrelated-owned-control'))[0];

  async function observe(name, mode, granted, holderPid) {
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const [observed] = await exec(`do $refresh$ begin perform pg_stat_clear_snapshot(); end; $refresh$;
        select coalesce((select jsonb_build_object('pid',a.pid,'waitEvent',a.wait_event,
          'waitEventType',a.wait_event_type,'gateMode',l.mode,'granted',l.granted)
          from pg_stat_activity a join pg_locks l on l.pid=a.pid where a.application_name='${name}'
          and a.state='active' and ${lock} and l.mode='${mode}' and l.granted=${granted}
          ${granted ? "and a.wait_event='PgSleep'" : `and a.wait_event_type='Lock'
            and ${holderPid}=any(pg_blocking_pids(a.pid))`}), 'null'::jsonb);`,
      'shadow-erasure-observe-owned-lifecycle-gate', 10_000);
      if (observed !== null) {
        assert.ok(Number.isSafeInteger(observed.pid) && observed.pid > 0, 'Invalid native backend identity');
        if (!granted) assert.match(observed.waitEvent, /advisory/i, 'Waiter did not reach the lifecycle advisory gate');
        return observed;
      }
      const completed = running.find(session => session.name === name)?.state;
      if (completed?.error) throw completed.error;
      assert.equal(completed, undefined, 'Session finished before its actual lock boundary was observed');
      await delay(40);
    }
    throw new Error(`Native erasure proof did not observe ${name} at its lifecycle gate`);
  }
  function launch(name, sql, stage, timeoutMs = 60_000, holds = false) {
    const session = { name, holds };
    running.push(session);
    session.promise = exec(sql, stage, timeoutMs).then(
      value => (session.state = { value }), error => (session.state = { error }));
    return session;
  }
  async function finish(session) {
    const completed = await session.promise;
    if (completed.error) throw completed.error;
    return completed.value;
  }
  async function release(session) {
    if (session.state) return;
    assert.ok(Number.isSafeInteger(session.pid) && session.pid > 0, 'Refusing to cancel an unobserved backend');
    const [released] = await exec(`select coalesce((select to_jsonb(pg_cancel_backend(a.pid))
      from pg_stat_activity a where a.pid=${session.pid} and a.application_name='${session.name}'
        and a.state='active' and a.wait_event='PgSleep'), 'false'::jsonb);`,
    'shadow-erasure-release-observed-owned-holder');
    assert.equal(released, true, 'Could not release the observed owned post-call sleep');
  }
  const erasure = source => `private.erase_prediction_sources_v1('PREDICTION_RUN','${source}'::uuid)`;
  const transaction = (name, call, hold = false) => `begin;
    set local application_name='${name}';
    with response as materialized(select ${call} value)
    select jsonb_build_object('pid',pg_backend_pid(),'response',value) from response;
    ${hold ? sleep : ''} commit;`;
  async function rank(actorIndex, requestIndex) {
    const request = { version: 3, requestId: requests[requestIndex], profileId: profiles[actorIndex],
      sessionId: sessions[requestIndex], discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 10, context: {} };
    const [delivery] = await exec(`begin; set local request.jwt.claim.sub='${actors[actorIndex]}';
      set local role authenticated;
      with delivery as materialized(select public.rank_items_page_v1(${literal(request)}) value)
      select jsonb_build_object('sourceId',value->'predictionId','resultCount',jsonb_array_length(value->'items')) from delivery;
      commit;`, 'shadow-erasure-real-serving-source');
    assert.match(delivery.sourceId, /^[0-9a-f-]{36}$/, 'Serving did not produce a real source identity');
    assert.ok(delivery.resultCount > 0, 'Serving source lacks selected candidates');
    owned.push(delivery.sourceId);
    const queued = await counts(delivery.sourceId, 'shadow-erasure-real-source-queued');
    assert.equal(queued.sources, 1);
    assert.ok(queued.candidates > 0 && queued.queued > 0, 'Real serving did not queue actual prospective shadows');
    assert.equal(queued.shadows, 0);
    return delivery.sourceId;
  }

  try {
    const [acl] = await exec(`select jsonb_build_object('invoker',not p.prosecdef,'apiDenied',
      not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))
        where grantee=0 and privilege_type='EXECUTE')) from pg_proc p
      where p.oid='private.erase_prediction_sources_v1(text,uuid)'::regprocedure;`,
    'shadow-erasure-owner-only-acl');
    assert.deepEqual(acl, { invoker: true, apiDenied: true }, 'Erasure boundary is not owner-only invoker');
    const [reserved] = await exec(`select jsonb_build_object(
      'users',(select count(*) from auth.users where id in (${actorIds}))
        +(select count(*) from public.users where id in (${actorIds})),
      'profiles',(select count(*) from public.profiles where owner_user_id in (${actorIds})),
      'items',(select count(*) from public.items where id in (${itemIds})),
      'sessions',(select count(*) from public.event_sessions where id in (${sessionIds})),
      'backends',(select count(*) from pg_stat_activity where application_name in (
        ${backendNames.map(name => `'${name}'`).join(',')})),
      'sources',(select count(*) from private.prediction_runs where session_id in (${sessionIds}) or actor_user_id in (${actorIds})));`,
    'shadow-erasure-reserved-fixture-guard');
    assert.deepEqual(reserved, { users: 0, profiles: 0, items: 0, sessions: 0, backends: 0, sources: 0 },
      'Erasure fixture namespace is occupied; no cleanup ownership was claimed');
    original = await evidence('shadow-erasure-original-canonical-state');
    fixtureAttempted = true;
    const [fixture] = await exec(`begin;
      insert into auth.users(id,email,raw_user_meta_data)
        select actor,actor::text||'@example.invalid',jsonb_build_object('kajo_nickname','Native erasure '||right(actor::text,6))
        from unnest(array[${actorIds}]) fixture(actor);
      insert into public.items(id,item_type,title,tags,discoverable)
        select item,'BOOK','Native erasure '||right(item::text,6),array['native-erasure'],true
        from unnest(array[${itemIds}]) fixture(item);
      select jsonb_agg(id order by owner_user_id) from public.profiles
        where owner_user_id in (${actorIds}) and profile_type='PERSONAL';
      commit;`, 'shadow-erasure-owned-fixture');
    assert.equal(fixture.length, 2, 'Synthetic actors lack their actual Personal Profiles');
    profiles = fixture;
    const first = await rank(0, 0), control = await rank(1, 2);

    // Existing CI fixtures may have queued jobs. Hold their operational queue
    // rows without changing them; the real SKIP LOCKED worker sees only this
    // probe's newly owned sources. This is never a production worker filter.
    const guardName = 'kajo_shadow_erasure_unrelated_queue_guard';
    guard = launch(guardName, `begin; set local application_name='${guardName}';
      do $guard$ begin
        perform job.id from private.shadow_prediction_jobs job
          join private.prediction_runs source on source.id=job.source_prediction_id
          where job.status='QUEUED' and source.actor_user_id not in (${actorIds})
          order by job.id for update of job;
        begin perform pg_sleep(90); exception when query_canceled then null; end;
      end; $guard$; commit;`, 'shadow-erasure-lock-unrelated-queue-without-writes', 120_000, true);
    const guardDeadline = Date.now() + 8_000;
    while (Date.now() < guardDeadline) {
      const [pid] = await exec(`select coalesce((select to_jsonb(a.pid) from pg_stat_activity a
        where a.application_name='${guardName}' and a.state='active' and a.wait_event='PgSleep'
          and exists(select 1 from pg_locks l where l.pid=a.pid and l.granted
            and l.relation='private.shadow_prediction_jobs'::regclass and l.mode='RowShareLock')), 'null'::jsonb);`,
      'shadow-erasure-observe-unrelated-queue-guard', 10_000);
      if (pid !== null) { guard.pid = pid; break; }
      if (guard.state?.error) throw guard.state.error;
      assert.equal(guard.state, undefined, 'Unrelated queue guard finished before observation');
      await delay(40);
    }
    assert.ok(Number.isSafeInteger(guard.pid) && guard.pid > 0, 'Did not observe the unrelated queue guard');
    const queuedBefore = (await counts(first, 'shadow-erasure-first-queued')).queued
      + (await counts(control, 'shadow-erasure-control-queued')).queued;

    const workerFirst = launch('kajo_shadow_erasure_worker_first', transaction('kajo_shadow_erasure_worker_first',
      'private.process_shadow_prediction_jobs_v1(250)', true), 'shadow-erasure-worker-first-holder', 60_000, true);
    const workerLock = await observe(workerFirst.name, 'ShareLock', true);
    workerFirst.pid = workerLock.pid;
    const eraseWaiter = launch('kajo_shadow_erasure_erase_waiter', transaction('kajo_shadow_erasure_erase_waiter', erasure(first)),
      'shadow-erasure-erase-waits-for-worker');
    const eraseLock = await observe(eraseWaiter.name, 'ExclusiveLock', false, workerFirst.pid);
    eraseWaiter.pid = eraseLock.pid;
    assert.notEqual(eraseWaiter.pid, workerFirst.pid, 'Worker/eraser used one connection');
    assert.equal((await counts(first, 'shadow-erasure-worker-uncommitted-visibility')).shadows, 0,
      'Independent observer saw uncommitted worker artifacts');
    await release(workerFirst);
    const [workerReply] = await finish(workerFirst), [eraseReply] = await finish(eraseWaiter);
    assert.deepEqual(workerReply.response, { processed: queuedBefore, failed: 0 }, 'Real worker processed unrelated queued work or failed');
    assert.ok(eraseReply.response && typeof eraseReply.response === 'object', 'Owner eraser did not return its actual result');
    absent(await counts(first, 'shadow-erasure-worker-first-complete-closure'));
    const controlBefore = await frozenControl(control);
    assert.ok(controlBefore.source && controlBefore.shadows.length > 0 && controlBefore.candidates.length > 0,
      'Real worker did not leave an independent owned survival control');
    proofs.push({ order: 'WORKER_THEN_ERASE', holder: workerLock, waiter: eraseLock,
      queuedJobs: queuedBefore, sourceAndShadowClosure: 'ABSENT_AFTER_COMMIT' });

    const [denied] = await exec(`begin;
      do $deny$ declare rejected text; result jsonb:='{}'::jsonb; api_role text;
      begin
        foreach api_role in array array['anon','authenticated','service_role'] loop
          rejected:=null;
          begin perform set_config('role',api_role,true); perform ${erasure(control)};
          exception when sqlstate '42501' then rejected:=sqlstate; end;
          perform set_config('role','postgres',true);
          if rejected is distinct from '42501' then raise exception 'API role accepted owner erasure'; end if;
          result:=result||jsonb_build_object(api_role,rejected);
        end loop;
        rejected:=null;
        begin delete from private.shadow_prediction_runs where source_prediction_id='${control}';
        exception when sqlstate '55000' then rejected:=sqlstate; end;
        if rejected is distinct from '55000' then raise exception 'Ordinary owner DELETE bypassed immutable shadow guard'; end if;
        result:=result||jsonb_build_object('ordinaryShadowDelete',rejected);
        rejected:=null;
        begin update private.shadow_prediction_candidates set shadow_score=shadow_score
          where shadow_prediction_id in(select id from private.shadow_prediction_runs where source_prediction_id='${control}');
        exception when sqlstate '55000' then rejected:=sqlstate; end;
        if rejected is distinct from '55000' then raise exception 'Ordinary owner UPDATE bypassed immutable candidate guard'; end if;
        result:=result||jsonb_build_object('ordinaryCandidateUpdate',rejected);
        rejected:=null;
        begin delete from private.prediction_runs where id='${control}';
        exception when sqlstate '23503' then rejected:=sqlstate; end;
        if rejected is distinct from '23503' then raise exception 'Ordinary source DELETE bypassed processed-shadow dependency'; end if;
        perform set_config('kajo.erasure_native_denials',(result||jsonb_build_object('ordinarySourceDelete',rejected))::text,true);
      end; $deny$;
      select current_setting('kajo.erasure_native_denials')::jsonb; rollback;`,
    'shadow-erasure-api-and-ordinary-owner-denials');
    assert.deepEqual(denied, { anon: '42501', authenticated: '42501', service_role: '42501',
      ordinaryShadowDelete: '55000', ordinaryCandidateUpdate: '55000', ordinarySourceDelete: '23503' });
    assert.deepEqual(await frozenControl(control), controlBefore, 'Rejected ordinary operations changed the survival control');

    const second = await rank(0, 1);
    const eraseFirst = launch('kajo_shadow_erasure_erase_first', transaction('kajo_shadow_erasure_erase_first', erasure(second), true),
      'shadow-erasure-erase-first-holder', 60_000, true);
    const eraseFirstLock = await observe(eraseFirst.name, 'ExclusiveLock', true);
    eraseFirst.pid = eraseFirstLock.pid;
    const workerWaiter = launch('kajo_shadow_erasure_worker_waiter', transaction('kajo_shadow_erasure_worker_waiter',
      'private.process_shadow_prediction_jobs_v1(250)'), 'shadow-erasure-worker-waits-for-erasure');
    const workerWaitLock = await observe(workerWaiter.name, 'ShareLock', false, eraseFirst.pid);
    workerWaiter.pid = workerWaitLock.pid;
    assert.notEqual(workerWaiter.pid, eraseFirst.pid, 'Eraser/worker used one connection');
    const beforeEraseCommit = await counts(second, 'shadow-erasure-eraser-uncommitted-visibility');
    assert.equal(beforeEraseCommit.sources, 1, 'Observer saw uncommitted source deletion');
    assert.ok(beforeEraseCommit.queued > 0, 'Erase-first source lacked real queued work before eraser commit');
    await release(eraseFirst);
    const [eraseFirstReply] = await finish(eraseFirst), [waitingWorkerReply] = await finish(workerWaiter);
    assert.ok(eraseFirstReply.response && typeof eraseFirstReply.response === 'object');
    assert.deepEqual(waitingWorkerReply.response, { processed: 0, failed: 0 },
      'Worker resumed from a stale source snapshot or processed unrelated guarded work');
    absent(await counts(second, 'shadow-erasure-erase-first-complete-closure'));
    assert.deepEqual(await frozenControl(control), controlBefore, 'Source erasure changed an unrelated owned source/shadow');
    proofs.push({ order: 'ERASE_THEN_WORKER', holder: eraseFirstLock, waiter: workerWaitLock,
      queuedBeforeCommit: beforeEraseCommit.queued, workerAfterCommit: waitingWorkerReply.response,
      sourceAndShadowClosure: 'ABSENT_AFTER_COMMIT' });
    await release(guard);
    await finish(guard);
    result = { status: 'PASS', cases: ['actual worker holds shared lifecycle gate; eraser waits and removes committed artifacts',
      'actual eraser holds exclusive lifecycle gate; worker waits and cannot recreate the erased queued source',
      'API erasure and ordinary owner shadow DELETE/candidate UPDATE/source DELETE remain denied',
      'unrelated queued jobs, immutable source/shadow control, canonical Events and state remain unchanged'],
    nativeCoverage: 'WORKER_AND_OWNER_ERASER_ONLY', proofs, canonicalEvidence: 'UNCHANGED' };
  } catch (error) { failure = error; }
  finally {
    const cleanupFailures = [];
    // Release only observed own post-call sleeps. Settle every native session
    // before deleting fixture parents; preserve the original and cleanup errors.
    for (const session of running.filter(session => session.holds && !session.pid && !session.state)) {
      try {
        const [pid] = await exec(`select coalesce((select to_jsonb(a.pid) from pg_stat_activity a
          where a.application_name='${session.name}' and a.state='active' and a.wait_event='PgSleep'), 'null'::jsonb);`,
        'shadow-erasure-find-owned-post-call-sleep-for-cleanup');
        if (Number.isSafeInteger(pid) && pid > 0) session.pid = pid;
      } catch (error) { cleanupFailures.push(error); }
    }
    for (const session of running.filter(session => session.holds && session.pid && !session.state)) {
      try { await release(session); } catch (error) { cleanupFailures.push(error); }
    }
    for (const session of running) {
      const completed = await session.promise;
      if (completed.error && completed.error !== failure) cleanupFailures.push(completed.error);
    }
    if (fixtureAttempted) {
      try {
        const [remaining] = await exec(`begin;
          do $cleanup$ declare actor uuid; begin
            foreach actor in array array[${actorIds}] loop
              if exists(select 1 from public.users where id=actor) then
                perform private.erase_prediction_sources_v1('ACTOR',actor);
              end if;
            end loop;
          end; $cleanup$;
          delete from auth.users where id in (${actorIds});
          delete from public.items where id in (${itemIds});
          select jsonb_build_object('users',(select count(*) from auth.users where id in (${actorIds}))
              +(select count(*) from public.users where id in (${actorIds})),
            'profiles',(select count(*) from public.profiles where owner_user_id in (${actorIds})),
            'items',(select count(*) from public.items where id in (${itemIds})),
            'sources',(select count(*) from private.prediction_runs where actor_user_id in (${actorIds}) or session_id in (${sessionIds})),
            'shadows',(select count(*) from private.shadow_prediction_runs where actor_user_id in (${actorIds})),
            'sessions',(select count(*) from public.event_sessions where id in (${sessionIds})));
          commit;`, 'shadow-erasure-cleanup-only-owned-fixture', 60_000);
        assert.deepEqual(remaining, { users: 0, profiles: 0, items: 0, sources: 0, shadows: 0, sessions: 0 },
          'Native erasure fixture cleanup left owned source/parent data');
        if (original) assert.deepEqual(await evidence('shadow-erasure-unchanged-canonical-state-after-owned-cleanup'), original,
          'Native source erasure changed unrelated canonical Events, state, source/shadow jobs or immutable policy/evaluation data');
      } catch (error) { cleanupFailures.push(error); }
    }
    if (cleanupFailures.length) throw new AggregateError(failure ? [failure, ...cleanupFailures] : cleanupFailures,
      'Native source erasure failed; original, owned-session and fixture-cleanup errors are retained');
  }
  if (failure) throw failure;
  return result;
}
