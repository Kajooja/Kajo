import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const actor = 'ab157000-0000-4000-8000-000000000001';
const legacyActor = 'ab157000-0000-4000-8000-000000000002';
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const version = 'kajo-contextual-skip-v1';
const policyVersion = 'contextual-skip-cooldown-v1';

// Genuine independent connections to the disposable native CI stack only.
// The holder commits only after pg_blocking_pids proves that the second caller
// is waiting on it. PGlite or a serialized transaction cannot supply this proof.
export async function verifyContextualSkipConcurrency(execConcurrentSql) {
  const exec = (sql, stage) => execConcurrentSql(sql, { stage: `contextual-skip-${stage}`, timeoutMs: 30_000 });
  const runId = randomUUID().replaceAll('-', '').slice(0, 8);
  const running = [];
  let fixture = false;
  let snapshots;
  let original;

  const launch = (name, expression, { hold = false, reject = null, actorUserId = actor } = {}) => {
    const connection = { name: `kajo_skip_${runId}_${name}` };
    running.push(connection);
    const call = reject ? `do $reject$ declare observed text; begin
      begin perform ${expression}; exception when sqlstate '${reject}' then observed := sqlstate; end;
      if observed is distinct from '${reject}' then raise exception 'Expected contextual skip SQLSTATE ${reject}'; end if;
      end; $reject$; select jsonb_build_object('sqlstate','${reject}');` : `select ${expression};`;
    // Cancel only this owned PgSleep after observing the waiter. Catching the
    // cancellation inside its subtransaction preserves the command and its locks.
    const barrier = hold ? `do $hold$ begin
      begin perform pg_sleep(20); exception when query_canceled then null; end;
      end; $hold$;` : '';
    connection.promise = exec(`begin; set local application_name='${connection.name}';
      set local request.jwt.claim.sub='${actorUserId}'; set local role authenticated;
      ${call} ${barrier} commit;`, name.replaceAll('_', '-'))
      .then(rows => (connection.done = { rows }), error => (connection.done = { error }));
    return connection;
  };
  const observe = async (connection, holder = null) => {
    const deadline = Date.now() + 7_000;
    while (Date.now() < deadline) {
      const [proof] = await exec(`select coalesce((select jsonb_build_object(
        'pid',pid,'blockers',pg_blocking_pids(pid),'wait',wait_event_type)
        from pg_stat_activity where application_name='${connection.name}' and state='active'
          ${holder ? `and wait_event_type='Lock' and ${holder.pid}=any(pg_blocking_pids(pid))` : "and wait_event='PgSleep'"}), 'null');`,
      'observe-owned-lock');
      if (proof) {
        connection.pid = proof.pid;
        return proof;
      }
      if (connection.done?.error) throw connection.done.error;
      assert.equal(connection.done, undefined, 'Contextual skip connection ended before its lock boundary');
      await delay(40);
    }
    throw new Error(`Contextual skip lock boundary was not observed: ${connection.name}`);
  };
  const release = async connection => {
    const [released] = await exec(`select coalesce((select to_jsonb(pg_cancel_backend(pid))
      from pg_stat_activity where pid=${connection.pid} and application_name='${connection.name}'
        and wait_event='PgSleep'), 'false');`, 'release-owned-holder');
    assert.equal(released, true, 'Owned contextual skip holder ended before its waiter was observed');
  };
  const finish = async connection => {
    const result = await connection.promise;
    if (result.error) throw result.error;
    return result.rows[0];
  };
  const pair = async (name, first, second, reject = null) => {
    const holder = launch(`${name}_holder`, first, { hold: true });
    await observe(holder);
    const waiter = launch(`${name}_waiter`, second, { reject });
    const proof = await observe(waiter, holder);
    assert.notEqual(holder.pid, waiter.pid, 'Concurrent commands need distinct database backends');
    await release(holder);
    return [await finish(holder), await finish(waiter), proof];
  };
  const gateBeforeRows = async (name, nativeCommand, legacyCommand, rowProbes) => {
    const stage = name.replaceAll('_', '-');
    const holder = launch(`${name}_holder`, nativeCommand, { hold: true });
    await observe(holder);
    const waiter = launch(`${name}_waiter`, legacyCommand, { actorUserId: legacyActor });
    const proof = await observe(waiter, holder);
    assert.notEqual(holder.pid, waiter.pid);
    const [lifecycleWait] = await exec(`select to_jsonb(exists(select 1 from pg_locks
      where pid=${waiter.pid} and locktype='advisory' and classid=1946841873::oid
        and objid=232004::oid and mode='ExclusiveLock' and not granted));`, `${stage}-lifecycle-wait`);
    assert.equal(lifecycleWait, true, 'Preserved writer must wait for the exclusive lifecycle gate');
    // A third independent connection must still be able to lock the waiter's
    // Profile and source rows. The former row-first entry fails with 55P03 here;
    // simply observing two serialized completed commands would miss inversion.
    const rows = await exec(`begin; ${rowProbes.join('\n')} rollback;`, `${stage}-rows-still-unlocked`);
    assert.equal(rows.length, rowProbes.length, 'Every preserved source row must exist and remain unlocked');
    await release(holder);
    return [await finish(holder), await finish(waiter), proof];
  };
  const call = async (expression, stage = 'committed-command', actorUserId = actor) => (await exec(`begin;
    set local request.jwt.claim.sub='${actorUserId}'; set local role authenticated;
    select ${expression}; commit;`, stage))[0];
  const taste = request => `public.taste_session_v2(${literal(request)})`;
  const skip = request => `public.commit_taste_contextual_skip_v1(${literal(request)})`;
  const assertReceipt = (receipt, command) => {
    assert.match(receipt.acceptedAt, /^(0|[1-9][0-9]*)$/);
    assert.deepEqual(receipt, {
      version, actionId: command.actionId, actorUserId: actor, profileId: command.profileId,
      itemId: command.itemId, acceptedAt: receipt.acceptedAt, policyVersion,
      evidence: 'PRIVATE_TASTE_RESPONSE', semantic: command.kind, reversesActionId: command.reversesActionId,
    });
  };

  try {
    const [reserved] = await exec(`select jsonb_build_object(
      'users',(select count(*) from auth.users where id::text like 'ab157000-%'),
      'items',(select count(*) from public.items where id::text like 'ab157000-%'),
      'backends',(select count(*) from pg_stat_activity where application_name like 'kajo_skip_%'));`, 'reserved-scope');
    assert.deepEqual(reserved, { users: 0, items: 0, backends: 0 });
    const [tables] = await exec(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and n.nspname in ('public','private','auth');`, 'canonical-tables');
    snapshots = `select jsonb_object_agg(name,value) from (${tables.map(name => `select '${name}' name,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value
      from ${name} r`).join(' union all ')}) s;`;
    [original] = await exec(snapshots, 'canonical-before');
    fixture = true;
    await exec(`begin; ${await personalTasteSessionFixtureSql()} commit;`, 'fixture');
    const [profileId] = await exec(`select to_jsonb(id) from public.profiles
      where owner_user_id='${actor}' and profile_type='PERSONAL';`, 'profile');
    const start = await call(taste({ operation: 'START', profileId, requestId: randomUUID() }));
    assert.equal(start.status, 'NEEDS_NEXT');
    const sessionId = start.sessionId;
    const resume = () => call(taste({ operation: 'RESUME', profileId, sessionId }), 'fresh-connection-resume');
    const command = (snapshot, operation) => ({ operation, profileId, sessionId,
      requestId: randomUUID(), expectedRevision: snapshot.revision });
    const advance = async operation => call(taste(command(await resume(), operation)));
    const skipCommand = async question => {
      assert.equal(question.status, 'QUESTION');
      assert.equal(question.contextualSkip.version, version);
      assert.equal(question.contextualSkip.policyVersion, policyVersion);
      assert.equal(question.contextualSkip.contextRef, null);
      assert.equal(question.contextualSkip.origin.surface, 'TASTE');
      assert.equal(question.contextualSkip.origin.questionId, question.questionId);
      const [occurredAt] = await exec(`select to_jsonb((extract(epoch from clock_timestamp())*1000000)::bigint::text);`, 'occurrence-clock');
      return { version, kind: 'CONTEXTUAL_SKIP', actionId: randomUUID(), actorUserId: actor,
        profileId, itemId: question.currentItem.id, occurredAt, origin: question.contextualSkip.origin,
        contextRef: null, reversesActionId: null };
    };
    const withdraw = source => ({ ...source, kind: 'WITHDRAW_CONTEXTUAL_SKIP', actionId: randomUUID(),
      reversesActionId: source.actionId });
    const decision = async itemId => (await exec(`select private.contextual_skip_decision_v1(
      '${profileId}'::uuid,'${itemId}'::uuid,clock_timestamp(),true);`, 'confirmed-union-reader'))[0];

    // START, NEXT and the first skip are genuinely separate committed RPCs.
    const q1 = await advance('NEXT');
    const c1 = await skipCommand(q1);
    const [r1, retry1, retryLock] = await pair('retry', skip(c1), skip(c1));
    assertReceipt(r1, c1);
    assert.deepEqual(retry1, r1, 'Concurrent retry must retain the exact first receipt and server clock');
    const paused = await advance('PAUSE');
    assert.equal(paused.status, 'PAUSED');
    const suppressed = await decision(c1.itemId);
    assert.deepEqual(suppressed, { version: policyVersion, contextChangePolicy: 'NO_TRUSTED_CONTEXT_CHANGE_V1',
      eligible: false, reason: 'SKIP_COOLDOWN', sourceIds: [c1.actionId],
      reconsiderAt: (BigInt(r1.acceptedAt) + 86_400_000_000n).toString() });
    assert.equal((await resume()).status, 'PAUSED');
    assert.deepEqual(await call(skip(c1), 'retry-after-reconnect'), r1);
    assert.deepEqual(await decision(c1.itemId), suppressed, 'Pause/reconnect must not shorten cross-surface suppression');

    // The fresh Discovery page uses the same Profile after PAUSE, and another
    // Event session must still consult confirmed Taste suppression at admission.
    const discoveryRuns = [];
    for (let session = 0; session < 2; session += 1) {
      const page = await call(`public.rank_items_page_v1(${literal({ version: 3, requestId: randomUUID(),
        profileId, sessionId: randomUUID(), discoveryMode: 'FOR_YOU', itemType: q1.currentItem.itemType,
        limit: 50, context: {} })})`, 'pause-to-discovery');
      assert.equal(page.version, 3);
      assert.ok(page.items.length > 0, 'The suppression probe needs other eligible Discovery Items');
      assert.ok(page.items.every(item => item.item_id !== c1.itemId));
      discoveryRuns.push(page.predictionId);
      const [retained] = await exec(`select coalesce((select jsonb_build_object(
        'selected',selected_for_delivery,'policy',explanation->'resurfacingPolicy')
        from private.prediction_candidates where prediction_id='${page.predictionId}' and item_id='${c1.itemId}'), 'null');`,
      'discovery-base-admission');
      // Eligibility-first ranking can retain a diagnostic suppressed tail when
      // this small catalogue has fewer eligible Items than the candidate budget.
      // Such a trace must stay ineligible and never become a delivered candidate.
      if (retained) {
        assert.equal(retained.selected, false);
        assert.equal(retained.policy.eligible, false);
        assert.deepEqual(retained.policy.contextualSkip, suppressed);
      }
    }
    assert.notEqual(discoveryRuns[0], discoveryRuns[1]);
    await advance('CONTINUE');

    const w1 = withdraw(c1);
    const [wr1, withdrawalRetry, withdrawalLock] = await pair('withdraw_retry', skip(w1), skip(w1));
    assertReceipt(wr1, w1);
    assert.deepEqual(withdrawalRetry, wr1);
    assert.equal((await decision(c1.itemId)).eligible, true);

    const c2 = await skipCommand(await advance('NEXT'));
    const changed = { ...c2, occurredAt: (BigInt(c2.occurredAt) - 1n).toString() };
    const [r2, identityConflict, conflictLock] = await pair('changed_body', skip(c2), skip(changed), '22023');
    assertReceipt(r2, c2);
    assert.deepEqual(identityConflict, { sqlstate: '22023' });
    const w2 = withdraw(c2);
    const competingWithdrawal = withdraw(c2);
    const [wr2, withdrawalConflict, competingLock] = await pair('withdraw_race', skip(w2), skip(competingWithdrawal), 'KJ003');
    assertReceipt(wr2, w2);
    assert.deepEqual(withdrawalConflict, { sqlstate: 'KJ003' });

    const c3 = await skipCommand(await advance('NEXT'));

    // Preserve a separate genuine v1 account/session: v1 and v2 never coexist
    // on one Profile. Its ordinary REMOVE delegates to import-source erasure,
    // so it must take the lifecycle gate before locking Profile/session/job.
    const [legacyProfile] = await exec(`select to_jsonb(id) from public.profiles
      where owner_user_id='${legacyActor}' and profile_type='PERSONAL';`, 'legacy-profile');
    const legacyTaste = request => `public.taste_session_v1(${literal(request)})`;
    const legacyStartRequest = { operation: 'START', profileId: legacyProfile, requestId: randomUUID() };
    const legacyStart = await call(legacyTaste(legacyStartRequest), 'legacy-v1-start', legacyActor);
    assert.equal(legacyStart.selection.decision.kind, 'QUESTION');
    const legacyRated = await call(legacyTaste({ operation: 'ANSWER', profileId: legacyProfile,
      sessionId: legacyStart.sessionId, requestId: randomUUID(), expectedRevision: legacyStart.revision,
      questionIndex: 0, answer: { kind: 'RATING', value: 0 } }), 'legacy-v1-answer', legacyActor);
    const [legacyJob] = await exec(`select to_jsonb(source_job_id) from private.taste_sessions
      where id='${legacyStart.sessionId}';`, 'legacy-v1-source-job');
    assert.match(legacyJob, /^[0-9a-f-]{36}$/);
    const legacyRemoval = { operation: 'REMOVE', profileId: legacyProfile, sessionId: legacyStart.sessionId,
      requestId: randomUUID(), expectedRevision: legacyRated.revision };
    const [r3, legacyRemoved, legacyRemoveLock] = await gateBeforeRows('v1_remove', skip(c3), legacyTaste(legacyRemoval), [
      `select to_jsonb(id) from public.profiles where id='${legacyProfile}' for update nowait;`,
      `select to_jsonb(id) from private.taste_sessions where id='${legacyStart.sessionId}' for update nowait;`,
      `select to_jsonb(id) from private.profile_import_jobs where id='${legacyJob}' for update nowait;`,
    ]);
    assertReceipt(r3, c3);
    assert.equal(legacyRemoved.status, 'REMOVED');
    const [legacyErased] = await exec(`select jsonb_build_object(
      'account',exists(select 1 from auth.users where id='${legacyActor}'),
      'profile',exists(select 1 from public.profiles where id='${legacyProfile}'),
      'active',(select count(*) from private.profile_bootstrap_evidence where source_job_id='${legacyJob}' and active),
      'commands',(select count(*) from private.taste_session_commands where session_id='${legacyStart.sessionId}'),
      'catalog',(select catalog from private.taste_sessions where id='${legacyStart.sessionId}'));`, 'legacy-v1-removal-state');
    assert.deepEqual(legacyErased, { account: true, profile: true, active: 0, commands: 0, catalog: [] });
    assert.equal((await call(legacyTaste(legacyStartRequest), 'legacy-v1-retry-after-removal', legacyActor)).status, 'REMOVED');

    // Existing Item UNDO can erase dependent Taste forecasts too. Its exclusive
    // lifecycle acquisition must precede the Profile and interaction locks,
    // even though the prior positive command legitimately used a shared gate.
    const [startedAt] = await exec('select to_jsonb(clock_timestamp());', 'legacy-action-clock');
    const rating = { version: 1, kind: 'SET_RATING', actionId: randomUUID(), actorUserId: legacyActor,
      profileId: legacyProfile, itemId: 'ab157000-0000-4000-8000-000000000139', occurredAt: startedAt,
      session: { sessionId: randomUUID(), startedAt, context: {} }, discoveryMode: null, predictionId: null, rating: 10 };
    const itemAction = request => `public.commit_item_action_v1(${literal(request)})`;
    assert.equal((await call(itemAction(rating), 'legacy-item-rating', legacyActor)).interaction.rating, 10);
    const undo = { ...rating, kind: 'UNDO', actionId: randomUUID(), reversesActionId: rating.actionId };
    delete undo.rating;
    const [sameR3, undone, legacyUndoLock] = await gateBeforeRows('item_undo', skip(c3), itemAction(undo), [
      `select to_jsonb(id) from public.profiles where id='${legacyProfile}' for update nowait;`,
      `select to_jsonb(item_id) from public.item_interactions where profile_id='${legacyProfile}'
        and item_id='${rating.itemId}' for update nowait;`,
      `select to_jsonb(id) from private.item_action_receipts where id='${rating.actionId}' for update nowait;`,
    ]);
    assert.deepEqual(sameR3, r3);
    assert.equal(undone.interaction.rating, null);
    assert.equal(undone.interaction.consumed, false);
    assert.equal(undone.interaction.notInterested, false);
    assert.deepEqual(await call(itemAction(undo), 'legacy-item-undo-retry', legacyActor), undone);
    const [neutral] = await exec(`select jsonb_build_object(
      'receipts',(select count(*) from private.contextual_skip_commands where profile_id='${profileId}' and erased_at is null),
      'events',(select count(*) from public.events where profile_id='${profileId}'),
      'interactions',(select count(*) from public.item_interactions where profile_id='${profileId}'),
      'bootstrap',(select count(*) from private.profile_bootstrap_evidence where profile_id='${profileId}' and active),
      'tasteDelivery',(select count(*) from private.prediction_candidates c join private.sequential_taste_panels p
        on p.prediction_id=c.prediction_id where p.session_id='${sessionId}' and c.selected_for_delivery));`, 'neutral-evidence');
    assert.deepEqual(neutral, { receipts: 5, events: 0, interactions: 0, bootstrap: 0, tasteDelivery: 0 });

    const removal = command(await resume(), 'REMOVE');
    const [removed, erasedRetry, erasureLock] = await pair('erase_replay', taste(removal), skip(c3), 'KJ002');
    assert.equal(removed.status, 'REMOVED');
    assert.deepEqual(erasedRetry, { sqlstate: 'KJ002' });
    const [erased] = await exec(`select jsonb_build_object(
      'tombstones',(select count(*) from private.contextual_skip_commands where profile_id='${profileId}' and erased_at is not null),
      'payloads',(select count(*) from private.contextual_skip_commands where profile_id='${profileId}'
        and (command is not null or result is not null or origin is not null or item_id is not null
          or source_prediction_id is not null or source_impression_id is not null)),
      'panels',(select count(*) from private.sequential_taste_panels where session_id='${sessionId}'),
      'commands',(select count(*) from private.sequential_taste_commands where session_id='${sessionId}'));
      `, 'source-tombstones');
    assert.deepEqual(erased, { tombstones: 5, payloads: 0, panels: 0, commands: 0 });
    const resurrection = launch('resurrection', skip({ ...c3, actionId: randomUUID() }), { reject: 'KJ002' });
    assert.deepEqual(await finish(resurrection), { sqlstate: 'KJ002' });
    assert.equal((await decision(c3.itemId)).reason, 'NO_ACTIVE_SKIP');

    return { status: 'PASS', origin: 'SEPARATE_COMMITTED_TASTE_QUESTION', concurrentRetry: 'EXACTLY_ONCE',
      changedBody: '22023', withdrawalRetry: 'EXACTLY_ONCE', competingWithdrawal: 'KJ003',
      sourceRemoval: 'KJ002_NO_REPLAY_OR_RESURRECTION', copiedPayloads: 'ERASED',
      pauseToDiscovery: 'SAME_PROFILE_SUPPRESSION_ACROSS_EVENT_SESSIONS', neutralTasteEvidence: true,
      legacyV1Removal: 'LIFECYCLE_BEFORE_PROFILE_SESSION_JOB_ACCOUNT_PRESERVED',
      legacyItemUndo: 'LIFECYCLE_BEFORE_PROFILE_INTERACTION_RECEIPT_EXACT_RETRY',
      independentLockProofs: [retryLock, withdrawalLock, conflictLock, competingLock, legacyRemoveLock, legacyUndoLock, erasureLock] };
  } finally {
    for (const connection of running) if (!connection.done && connection.pid) {
      await exec(`select to_jsonb(pg_cancel_backend(pid)) from pg_stat_activity
        where pid=${connection.pid} and application_name='${connection.name}' and state='active';`, 'cancel-owned-fixture-connection');
    }
    await Promise.all(running.map(connection => connection.promise));
    if (fixture) {
      await exec(`begin;
        delete from public.item_interactions where actor_user_id::text like 'ab157000-%';
        delete from auth.users where id::text like 'ab157000-%';
        delete from private.item_sources where item_id::text like 'ab157000-%';
        delete from public.items where id::text like 'ab157000-%'; commit;`, 'cleanup');
      assert.deepEqual((await exec(snapshots, 'canonical-after'))[0], original,
        'Contextual skip fixture changed retained canonical state');
    }
  }
}
