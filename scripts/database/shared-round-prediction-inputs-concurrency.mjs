import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Native-only proof in the newly owned CLI stack. Each call uses a separate
// psql session; observed blockers, rather than elapsed sleeps, establish order.
const uuid = n => `a232f100-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actors = [uuid(1), uuid(2), uuid(3)];
const profiles = [uuid(10), uuid(11)], itemId = uuid(20), priorRound = uuid(100);
const rounds = Array.from({ length: 10 }, (_, n) => uuid(101 + n));
const inputs = Array.from({ length: 11 }, (_, n) => uuid(201 + n));
const sources = [uuid(301), uuid(302), uuid(303)];
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const ids = values => values.map(value => `'${value}'::uuid`).join(',');
const command = (roundId, profileId, actor, kind, revision, extra = {}) => ({
  version: 1, commandId: uuid(1000 + Number(roundId.slice(-3)) * 10 + revision),
  actorUserId: actor, profileId, roundId, kind, expectedRevision: revision, ...extra,
});
const commandCall = request => `public.commit_shared_rating_round_v1(${literal(request)})`;
const captureCall = (index, sourceIds = [], revision = 1, captureId = inputs[index]) => `private.capture_shared_round_prediction_input_v1(
  '${captureId}'::uuid,'${profiles[index < 8 ? 0 : 1]}'::uuid,'${rounds[index]}'::uuid,
  ${revision},array[${ids(sourceIds)}]::uuid[])`;
const getCall = index => `private.get_shared_round_prediction_input_v1('${inputs[index]}'::uuid)`;

// Exported SQL also runs through the source/PGlite gate, without claiming that
// its single connection can establish native PostgreSQL concurrency.
export function sharedRoundPredictionInputsNativeFixtureSql() {
  const open = command(priorRound, profiles[0], actors[0], 'OPEN_ROUND', 0,
    { itemId, experienceId: uuid(400) });
  const zero = command(priorRound, profiles[0], actors[0], 'SET_RESPONSE', 1, { rating: 0 });
  const ten = command(priorRound, profiles[0], actors[1], 'SET_RESPONSE', 2, { rating: 10 });
  return `begin;
    insert into auth.users(id,email,raw_user_meta_data)
      select actor,actor::text||'@example.invalid',jsonb_build_object('kajo_nickname','Input native '||right(actor::text,4))
      from unnest(array[${ids(actors)}]) fixture(actor);
    insert into public.profiles(id,profile_type,name) values
      ('${profiles[0]}','SHARED','Native input pair'),('${profiles[1]}','SHARED','Native input enrollment');
    insert into public.profile_members(profile_id,user_id) values
      ('${profiles[0]}','${actors[0]}'),('${profiles[0]}','${actors[1]}'),
      ('${profiles[1]}','${actors[0]}'),('${profiles[1]}','${actors[2]}');
    insert into public.items(id,item_type,title,tags,discoverable)
      values('${itemId}','BOOK','Native input book',array['native-input'],true);
    set local request.jwt.claim.sub='${actors[0]}'; set local role authenticated;
    select ${commandCall(open)}; select ${commandCall(zero)};
    set local request.jwt.claim.sub='${actors[1]}'; select ${commandCall(ten)};
    commit;`;
}

export function sharedRoundPredictionInputsNativeSourcesSql() {
  return `begin; set local request.jwt.claim.sub='${actors[0]}';
    ${sources.map(source => `select private.capture_shared_rating_round_outcome_v1(
      '${source}'::uuid,'${profiles[0]}'::uuid,'${priorRound}'::uuid,
      statement_timestamp(),statement_timestamp(),interval '0 seconds');`).join('\n')}
    commit;`;
}

export function sharedRoundPredictionInputsNativeOpenSql() {
  return `begin; set local request.jwt.claim.sub='${actors[0]}'; set local role authenticated;
    ${rounds.map((round, index) => `select ${commandCall(command(round, profiles[index < 8 ? 0 : 1], actors[0],
      'OPEN_ROUND', 0, { itemId, experienceId: uuid(401 + index) }))};`).join('\n')}
    commit;`;
}

export const sharedRoundPredictionInputsNativeProbeSql = Object.freeze({
  capture: captureCall,
  get: getCall,
  membershipChange: `do $membership$ begin
    perform 1 from public.profiles where id='${profiles[1]}' for update;
    delete from public.profile_members where profile_id='${profiles[1]}' and user_id='${actors[2]}';
    insert into public.profile_members(profile_id,user_id) values('${profiles[1]}','${actors[2]}');
  end; $membership$;`,
});

// The two lifecycle checkpoints deliberately hash every canonical row. The
// initialized checkpoint includes owned Auth/Profile system-list creation; the
// original checkpoint remains the full restoration contract after cleanup.
export function sharedRoundPredictionInputsCanonicalEvidenceSql() {
  return `select jsonb_object_agg(identity,snapshot) from (
    ${['public.events', 'public.event_sessions', 'public.item_interactions', 'public.item_lists',
      'public.item_list_entries', 'public.shared_item_endorsements', 'public.shared_item_consensus',
      'private.prediction_runs', 'private.prediction_candidates', 'private.shadow_prediction_jobs',
      'private.shadow_prediction_runs', 'private.shadow_prediction_candidates', 'private.genome_evaluations',
      'private.evaluation_windows', 'private.predictor_genomes', 'private.promotion_decisions',
      'private.policy_assignments'].map(relation => `select '${relation}' identity,
        jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
          coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) snapshot
        from ${relation} r`).join(' union all ')}
    ) snapshots;`;
}

export function sharedRoundPredictionInputsNativeCleanupSql() {
  return `begin;
          do $cleanup$ declare actor uuid; begin foreach actor in array array[${ids(actors)}] loop
            if exists(select 1 from public.users where id=actor) then
              perform private.erase_prediction_sources_v1('ACTOR',actor); end if;
          end loop; end; $cleanup$;
          delete from public.profiles where id=any(array[${ids(profiles)}]);
          delete from auth.users where id=any(array[${ids(actors)}]);
          delete from public.items where id='${itemId}';
          select jsonb_build_object('users',(select count(*) from auth.users where id=any(array[${ids(actors)}]))
              +(select count(*) from public.users where id=any(array[${ids(actors)}])),
            'profiles',(select count(*) from public.profiles where id=any(array[${ids(profiles)}]) or owner_user_id=any(array[${ids(actors)}])),
            'items',(select count(*) from public.items where id='${itemId}'),
            'rounds',(select count(*) from private.shared_rating_rounds where id=any(array[${ids([priorRound, ...rounds])}])),
            'inputs',(select count(*) from private.shared_round_prediction_inputs where id=any(array[${ids(inputs)}])),
            'sources',(select count(*) from private.shared_round_outcome_captures where id=any(array[${ids(sources)}])),
            'edges',(select count(*) from private.shared_round_prediction_input_sources where input_id=any(array[${ids(inputs)}])));
          commit;`;
}

export async function verifySharedRoundPredictionInputsConcurrency(execConcurrentSql) {
  const exec = (sql, stage, timeoutMs = 30_000) => execConcurrentSql(sql, { stage, timeoutMs });
  const running = [], proofs = [];
  let fixtureAttempted = false, original, initialized, failure, result;
  const sleep = `do $hold$ begin
    begin perform pg_sleep(45); exception when query_canceled then null; end;
  end; $hold$;`;
  const transaction = (name, call, { actor = actors[0], authenticated = false,
    hold = false, rollback = false, reject = null, isolation = 'read committed' } = {}) => `begin isolation level ${isolation};
    set local application_name='${name}'; set local request.jwt.claim.sub='${actor}';
    ${authenticated ? 'set local role authenticated;' : ''}
    ${reject ? `do $reject$ declare value jsonb; rejected text; begin
      begin value:=${call}; exception when sqlstate '${reject}' then rejected:=sqlstate; end;
      if rejected is distinct from '${reject}' then raise exception 'Native input expected rejection'; end if;
      perform set_config('kajo.input_native_result',jsonb_build_object('pid',pg_backend_pid(),'sqlstate',rejected)::text,true);
    end; $reject$; select current_setting('kajo.input_native_result')::jsonb;`
      : `with response as materialized(select ${call} value)
        select jsonb_build_object('pid',pg_backend_pid(),'value',value,
          'utf8',encode(convert_to(value::text,'UTF8'),'hex'),
          'sha256',encode(sha256(convert_to(value::text,'UTF8')),'hex')) from response;`}
    ${hold ? sleep : ''} ${rollback ? 'rollback' : 'commit'};`;
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
  async function observe(session, holder = null) {
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const [observed] = await exec(`do $refresh$ begin perform pg_stat_clear_snapshot(); end; $refresh$;
        select coalesce((select jsonb_build_object('pid',a.pid,'waitEvent',a.wait_event,
          'waitEventType',a.wait_event_type,'blockers',to_jsonb(pg_blocking_pids(a.pid)))
          from pg_stat_activity a where a.application_name='${session.name}' and a.state='active'
          ${holder ? `and a.wait_event_type='Lock' and ${holder.pid}=any(pg_blocking_pids(a.pid))`
            : "and a.wait_event='PgSleep'"}), 'null'::jsonb);`, 'shared-input-observe-owned-lock-boundary', 10_000);
      if (observed !== null) {
        assert.ok(Number.isSafeInteger(observed.pid) && observed.pid > 0);
        if (holder) assert.notEqual(observed.pid, holder.pid, 'Native proof reused the holder connection');
        session.pid = observed.pid;
        return observed;
      }
      if (session.state?.error) throw session.state.error;
      assert.equal(session.state, undefined, 'Native session completed before the lock boundary was observed');
      await delay(40);
    }
    throw new Error('Native input proof did not observe its owned lock boundary');
  }
  async function release(session) {
    if (session.state) return;
    assert.ok(Number.isSafeInteger(session.pid) && session.pid > 0, 'Refusing to cancel an unobserved backend');
    const [released] = await exec(`select coalesce((select to_jsonb(pg_cancel_backend(a.pid))
      from pg_stat_activity a where a.pid=${session.pid} and a.application_name='${session.name}'
        and a.state='active' and a.wait_event='PgSleep'), 'false'::jsonb);`, 'shared-input-release-owned-post-call-holder');
    assert.equal(released, true, 'Could not release the observed owned post-call sleep');
  }
  const read = async (index, stage) => (await exec(transaction('kajo_shared_input_read', getCall(index)), stage))[0];
  const evidence = async stage => (await exec(sharedRoundPredictionInputsCanonicalEvidenceSql(), stage))[0];
  const sourceDigest = async stage => (await exec(`select jsonb_build_object(
    'captures',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb)
      from private.shared_round_outcome_captures r where id=any(array[${ids(sources)}])),
    'inputs',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb)
      from private.shared_round_prediction_inputs r where id=any(array[${ids(inputs)}])),
    'edges',(select coalesce(jsonb_agg(to_jsonb(r) order by input_id,source_capture_id),'[]'::jsonb)
      from private.shared_round_prediction_input_sources r where input_id=any(array[${ids(inputs)}])));`, stage))[0];
  const assertInput = (entry, index, sourceCount = 0) => {
    const value = entry.value;
    assert.equal(value.contractVersion, 'shared-round-prediction-input-v1');
    assert.equal(value.sourceBasis, 'SERVER_VISIBLE_PRE_RESPONSE_CONTEXT');
    assert.equal(value.selectionBasis, 'CALLER_DECLARED_SOURCE_CAPTURE_IDS');
    assert.equal(value.usage, 'INPUT_CAPTURE_ONLY');
    assert.equal(value.predictorConsumption, 'NOT_RECORDED');
    assert.equal(value.consumerPredictionId, null);
    assert.equal(value.membershipValidity, 'CURRENT_FULL_ENROLLMENT_AT_CAPTURE');
    assert.equal(value.commitVisibility, 'OWN_TRANSACTION_MVCC_VISIBLE_NOT_COMMIT_TIME');
    assert.equal(value.capturedByActorUserId, actors[0]);
    assert.equal(value.historicalFeatureEligible, false);
    assert.equal(value.learnable, false);
    assert.equal(value.groupReward, null);
    assert.equal(value.target.round.roundId, rounds[index]);
    assert.equal(value.target.round.revision, 1);
    assert.deepEqual(value.target.round.participants.map(member => member.actorUserId),
      [actors[0], actors[index < 8 ? 1 : 2]]);
    for (const member of value.target.round.participants) assert.match(member.membershipGeneration, /^[0-9a-f-]{36}$/);
    assert.equal(value.sources.length, sourceCount);
    for (const source of value.sources) assert.deepEqual(source.outcome.round.participants, value.target.round.participants);
    assert.match(value.inputDigest, /^[0-9a-f]{32}$/);
    assert.match(value.target.prefixDigest, /^[0-9a-f]{32}$/);
    assert.equal(value.target.round.responses.filter(response => response.status !== 'UNANSWERED').length, 0);
    return value;
  };
  const response = index => command(rounds[index], profiles[0], actors[1], 'SET_RESPONSE', 1, { rating: null });
  const pair = async (order, holder, waiter, assertion, beforeCommit = async () => {}) => {
    const holderLock = await observe(holder);
    const waitingSession = waiter();
    const waiterLock = await observe(waitingSession, holder);
    await beforeCommit();
    await release(holder);
    const holderRows = await finish(holder);
    const waiterRows = await finish(waitingSession);
    await assertion(holderRows[0], waiterRows[0]);
    proofs.push({ order, holder: holderLock, waiter: waiterLock });
  };

  try {
    const [acl] = await exec(`select jsonb_build_object('functions',count(*),'ownerOnlyInvoker',bool_and(
      not p.prosecdef and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))
        where grantee=0 and privilege_type='EXECUTE'))) from pg_proc p where p.oid=any(array[
      'private.capture_shared_round_prediction_input_v1(uuid,uuid,uuid,integer,uuid[])'::regprocedure,
      'private.get_shared_round_prediction_input_v1(uuid)'::regprocedure]);`, 'shared-input-owner-only-acls');
    assert.deepEqual(acl, { functions: 2, ownerOnlyInvoker: true });
    const [reserved] = await exec(`select jsonb_build_object(
      'users',(select count(*) from auth.users where id=any(array[${ids(actors)}]))
        +(select count(*) from public.users where id=any(array[${ids(actors)}])),
      'profiles',(select count(*) from public.profiles where id=any(array[${ids(profiles)}]) or owner_user_id=any(array[${ids(actors)}])),
      'items',(select count(*) from public.items where id='${itemId}'),
      'rounds',(select count(*) from private.shared_rating_rounds where id=any(array[${ids([priorRound, ...rounds])}])),
      'inputs',(select count(*) from private.shared_round_prediction_inputs where id=any(array[${ids(inputs)}])),
      'sources',(select count(*) from private.shared_round_outcome_captures where id=any(array[${ids(sources)}])),
      'backends',(select count(*) from pg_stat_activity where application_name like 'kajo_shared_input_%'));`,
    'shared-input-reserved-fixture-guard');
    assert.deepEqual(reserved, { users: 0, profiles: 0, items: 0, rounds: 0, inputs: 0, sources: 0, backends: 0 },
      'Native input namespace is occupied; cleanup ownership was not claimed');
    original = await evidence('shared-input-original-canonical-state');
    fixtureAttempted = true;
    await exec(sharedRoundPredictionInputsNativeFixtureSql(), 'shared-input-owned-fixture');
    initialized = await evidence('shared-input-initialized-canonical-state');
    await exec(sharedRoundPredictionInputsNativeSourcesSql(), 'shared-input-prior-visible-source-captures');
    await exec(sharedRoundPredictionInputsNativeOpenSql(), 'shared-input-unresponded-target-rounds');

    let holder = launch('kajo_shared_input_response_first', transaction('kajo_shared_input_response_first',
      commandCall(response(0)), { actor: actors[1], authenticated: true, hold: true }), 'shared-input-response-first-holder', true);
    await pair('RESPONSE_COMMIT_THEN_CAPTURE', holder,
      () => launch('kajo_shared_input_response_capture_waiter', transaction('kajo_shared_input_response_capture_waiter',
        captureCall(0), { reject: '55000' }), 'shared-input-capture-waits-for-committed-unknown'),
      async (accepted, rejected) => {
        assert.equal(accepted.value.round.responses.find(row => row.actorUserId === actors[1]).status, 'UNKNOWN');
        assert.equal(rejected.sqlstate, '55000');
        assert.equal((await read(0, 'shared-input-rejected-response-first-absent')).value, null);
      });

    holder = launch('kajo_shared_input_capture_first', transaction('kajo_shared_input_capture_first',
      captureCall(1), { hold: true }), 'shared-input-capture-first-holder', true);
    let frozen;
    await pair('CAPTURE_COMMIT_THEN_RESPONSE', holder,
      () => launch('kajo_shared_input_response_waiter', transaction('kajo_shared_input_response_waiter',
        commandCall(response(1)), { actor: actors[1], authenticated: true }), 'shared-input-response-waits-for-capture'),
      async (captured, accepted) => {
        assertInput(captured, 1); frozen = captured;
        assert.equal(accepted.value.round.revision, 2);
        const replayed = await read(1, 'shared-input-replay-after-first-response');
        assert.deepEqual(replayed.value, frozen.value);
        assert.equal(replayed.utf8, frozen.utf8);
        assert.equal(replayed.sha256, frozen.sha256);
        const [retried] = await exec(transaction('kajo_shared_input_after_response_exact_retry', captureCall(1)),
          'shared-input-exact-retry-after-first-response');
        assert.deepEqual(retried.value, frozen.value);
        assert.equal(retried.utf8, frozen.utf8);
      }, async () => {
        assert.equal((await read(1, 'shared-input-uncommitted-capture-invisible')).value, null);
      });

    holder = launch('kajo_shared_input_response_rollback', transaction('kajo_shared_input_response_rollback',
      commandCall(response(2)), { actor: actors[1], authenticated: true, hold: true, rollback: true }),
    'shared-input-response-rollback-holder', true);
    await pair('RESPONSE_ROLLBACK_THEN_CAPTURE', holder,
      () => launch('kajo_shared_input_rollback_capture_waiter', transaction('kajo_shared_input_rollback_capture_waiter', captureCall(2)),
        'shared-input-capture-after-response-rollback'),
      async (_rolledBack, captured) => { assertInput(captured, 2); });

    const deleteSource = source => `do $delete$ begin
      delete from private.shared_round_outcome_captures where id='${source}';
    end; $delete$;`;
    const deleteTransaction = (name, source, hold = false) => `begin; set local application_name='${name}';
      ${deleteSource(source)} select jsonb_build_object('pid',pg_backend_pid(),'deleted',true);
      ${hold ? sleep : ''} commit;`;
    holder = launch('kajo_shared_input_source_delete_first', deleteTransaction('kajo_shared_input_source_delete_first', sources[0], true),
      'shared-input-source-delete-first-holder', true);
    await pair('SOURCE_DELETE_COMMIT_THEN_CAPTURE', holder,
      () => launch('kajo_shared_input_deleted_source_waiter', transaction('kajo_shared_input_deleted_source_waiter',
        captureCall(3, [sources[0]]), { reject: '55000' }), 'shared-input-allocation-waits-for-source-delete'),
      async (_deleted, rejected) => {
        assert.equal(rejected.sqlstate, '55000');
        assert.equal((await read(3, 'shared-input-deleted-source-allocation-absent')).value, null);
      });
    holder = launch('kajo_shared_input_source_capture_first', transaction('kajo_shared_input_source_capture_first',
      captureCall(4, [sources[1]]), { hold: true }), 'shared-input-source-key-share-holder', true);
    await pair('CAPTURE_COMMIT_THEN_SOURCE_DELETE', holder,
      () => launch('kajo_shared_input_source_delete_waiter', deleteTransaction('kajo_shared_input_source_delete_waiter', sources[1]),
        'shared-input-source-delete-waits-for-allocation'),
      async (captured, _deleted) => {
        assertInput(captured, 4, 1);
        assert.equal((await read(4, 'shared-input-source-delete-invalidates-whole-parent')).value, null);
        const [edges] = await exec(`select to_jsonb(count(*)) from private.shared_round_prediction_input_sources
          where input_id='${inputs[4]}';`, 'shared-input-source-delete-no-orphan-edges');
        assert.equal(edges, 0);
      });

    const [erasureInput] = await exec(transaction('kajo_shared_input_noncreator', captureCall(7, [sources[2]])),
      'shared-input-noncreator-actor-lineage');
    assertInput(erasureInput, 7, 1);
    for (const [offset, isolation] of ['repeatable read', 'serializable'].entries()) {
      const beforeIsolation = await sourceDigest('shared-input-before-isolation-refusals');
      const [rejected] = await exec(transaction('kajo_shared_input_isolation', captureCall(5 + offset),
        { reject: '25001', isolation }), 'shared-input-higher-isolation-new-allocation-denied');
      assert.equal(rejected.sqlstate, '25001');
      const [retry] = await exec(transaction('kajo_shared_input_isolation_retry', captureCall(7, [sources[2]]), { isolation }),
        'shared-input-higher-isolation-exact-retry');
      assert.deepEqual(retry.value, erasureInput.value);
      const [denied] = await exec(`begin isolation level ${isolation};
        do $deny$ declare rejected text; begin
          begin delete from private.shared_round_outcome_captures where id='${sources[2]}';
          exception when sqlstate '25001' then rejected:=sqlstate; end;
          if rejected is distinct from '25001' then raise exception 'Native source delete isolation refusal missing'; end if;
          perform set_config('kajo.input_native_delete_state',rejected,true);
        end; $deny$; select to_jsonb(current_setting('kajo.input_native_delete_state')); commit;`,
      'shared-input-higher-isolation-source-delete-atomic-denial');
      assert.equal(denied, '25001');
      assert.deepEqual(await sourceDigest('shared-input-isolation-source-and-input-preservation'), beforeIsolation,
        'Rejected higher-isolation allocation/deletion changed source/input/edge rows');
      const index = 5 + offset;
      const heldName = `kajo_shared_input_${offset}_allocation_holder`;
      const deleteName = `kajo_shared_input_${offset}_stale_delete_waiter`;
      holder = launch(heldName, transaction(heldName, captureCall(index, [sources[2]]), { hold: true }),
        'shared-input-read-committed-allocation-before-stale-delete', true);
      await pair(`CAPTURE_COMMIT_THEN_${isolation.toUpperCase().replaceAll(' ', '_')}_SOURCE_DELETE`, holder,
        () => launch(deleteName, `begin isolation level ${isolation}; set local application_name='${deleteName}';
          do $stale$ declare rejected text; begin
            -- This independent higher-isolation snapshot is fixed while the
            -- new input is uncommitted, before DELETE reaches its row wait.
            perform count(*) from private.shared_round_prediction_inputs;
            begin delete from private.shared_round_outcome_captures where id='${sources[2]}';
            exception when sqlstate '25001' then rejected:=sqlstate; end;
            if rejected is distinct from '25001' then raise exception 'Stale source delete was not rejected'; end if;
            perform set_config('kajo.input_native_stale_delete',jsonb_build_object('pid',pg_backend_pid(),'sqlstate',rejected)::text,true);
          end; $stale$; select current_setting('kajo.input_native_stale_delete')::jsonb; commit;`,
        'shared-input-observed-stale-source-delete-refusal'),
        async (captured, rejectedDelete) => {
          assertInput(captured, index, 1);
          assert.equal(rejectedDelete.sqlstate, '25001');
          const replayed = await read(index, 'shared-input-stale-delete-preserves-committed-parent');
          assert.deepEqual(replayed.value, captured.value);
          assert.equal(replayed.utf8, captured.utf8);
          const [preserved] = await exec(`select jsonb_build_object(
            'source',(select count(*) from private.shared_round_outcome_captures where id='${sources[2]}'),
            'edge',(select count(*) from private.shared_round_prediction_input_sources
              where input_id='${inputs[index]}' and source_capture_id='${sources[2]}'));`,
          'shared-input-stale-delete-preserves-source-and-binding');
          assert.deepEqual(preserved, { source: 1, edge: 1 });
        });
    }

    const [control] = await exec(transaction('kajo_shared_input_survival_control', captureCall(9)),
      'shared-input-independent-frozen-member-control');
    assertInput(control, 9);
    const [oldGeneration] = await exec(`select to_jsonb(generation_id) from private.shared_round_membership_generations
      where profile_id='${profiles[1]}' and user_id='${actors[2]}';`, 'shared-input-before-leave-generation');
    holder = launch('kajo_shared_input_member_rejoin', `begin; set local application_name='kajo_shared_input_member_rejoin';
      ${sharedRoundPredictionInputsNativeProbeSql.membershipChange}
      select jsonb_build_object('pid',pg_backend_pid(),'generation',generation_id)
      from private.shared_round_membership_generations where profile_id='${profiles[1]}' and user_id='${actors[2]}';
      ${sleep} commit;`, 'shared-input-member-delete-reinsert-holder', true);
    await pair('MEMBER_REJOIN_COMMIT_THEN_CAPTURE', holder,
      () => launch('kajo_shared_input_membership_waiter', transaction('kajo_shared_input_membership_waiter',
        captureCall(8), { reject: '55000' }), 'shared-input-capture-waits-for-membership-generation'),
      async (changed, rejected) => {
        assert.notEqual(changed.generation, oldGeneration, 'Same-user same-transaction rejoin reused old generation');
        assert.equal(rejected.sqlstate, '55000');
        assert.equal((await read(8, 'shared-input-old-generation-allocation-absent')).value, null);
      });

    holder = launch('kajo_shared_input_before_actor_prepare', transaction('kajo_shared_input_before_actor_prepare',
      captureCall(7, [sources[2]], 1, inputs[10]), { hold: true }), 'shared-input-new-allocation-before-actor-prepare', true);
    await pair('INPUT_ALLOCATION_COMMIT_THEN_NONCREATOR_ACTOR_PREPARE', holder,
      () => launch('kajo_shared_input_actor_prepare_waiter', transaction('kajo_shared_input_actor_prepare_waiter',
        `private.erase_prediction_sources_v1('ACTOR','${actors[1]}'::uuid)`),
      'shared-input-actor-prepare-waits-for-input-lifecycle-gate'),
      async (captured, prepared) => {
        assertInput(captured, 7, 1);
        assert.ok(prepared.value && typeof prepared.value === 'object');
      });
    assert.match(proofs.at(-1).waiter.waitEvent, /advisory/i,
      'ACTOR preparation waited after parent locks instead of at the first lifecycle gate');
    const [prepared] = await exec(`select jsonb_build_object('actorRetained',exists(select 1 from public.users where id='${actors[1]}'),
        'profileRetained',exists(select 1 from public.profiles where id='${profiles[0]}'),
        'inputs',(select count(*) from private.shared_round_prediction_inputs where profile_id='${profiles[0]}'),
        'edges',(select count(*) from private.shared_round_prediction_input_sources edge
          where edge.input_id=any(array[${ids([...inputs.slice(0, 8), inputs[10]])}])));`,
    'shared-input-actor-prepare-noncreator-whole-lineage');
    assert.deepEqual(prepared, { actorRetained: true, profileRetained: true, inputs: 0, edges: 0 });
    assert.equal((await read(7, 'shared-input-erased-noncreator-replay-null')).value, null);
    assert.equal((await read(10, 'shared-input-erased-new-allocation-replay-null')).value, null);
    const controlAfter = await read(9, 'shared-input-unrelated-actor-input-preserved');
    assert.deepEqual(controlAfter.value, control.value);
    assert.equal(controlAfter.utf8, control.utf8);
    assert.deepEqual(await evidence('shared-input-canonical-state-unchanged'), initialized);
    result = { status: 'PASS', proofs,
      cases: ['committed UNKNOWN response excludes capture; capture commits before blocked first response',
        'rolled-back first response leaves an eligible unresponded target',
        'source deletion and input allocation serialize in both orders; whole parent and edges disappear',
        'REPEATABLE READ/SERIALIZABLE allocation and source DELETE reject atomically; exact retry remains stored',
        'same-user membership rejoin changes generation under Profile lock and rejects the old target vector',
        'ACTOR preparation removes a noncreator frozen participant input while independent input bytes survive'],
      predictorConsumption: 'NOT_RECORDED', historicalFeatureEligible: false, learnable: false,
      canonicalEvidence: 'UNCHANGED' };
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
        const [remaining] = await exec(sharedRoundPredictionInputsNativeCleanupSql(), 'shared-input-cleanup-only-owned-fixture', 60_000);
        assert.deepEqual(remaining, { users: 0, profiles: 0, items: 0, rounds: 0, inputs: 0, sources: 0, edges: 0 });
        if (original) assert.deepEqual(await evidence('shared-input-unrelated-state-after-owned-cleanup'), original);
      } catch (error) { cleanupFailures.push(error); }
    }
    if (cleanupFailures.length) throw new AggregateError(failure ? [failure, ...cleanupFailures] : cleanupFailures,
      'Native input proof failed; original, owned-session and fixture-cleanup errors are retained');
  }
  if (failure) throw failure;
  return result;
}
