import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Native-only prospective visibility proof in the existing disposable CLI stack.
// Frozen capture bytes describe an actually observed prefix; they never establish
// historical prediction inputs, joint reward or scalar learning admission.
export async function verifySharedRoundOutcomeCapturesConcurrency(execConcurrentSql) {
  const exec = (sql, stage) => execConcurrentSql(sql, { stage, timeoutMs: 120_000 });
  const uuid = n => `a232c100-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const actors = [uuid(1), uuid(2)], profileId = uuid(3), itemId = uuid(4), roundId = uuid(5);
  const captures = [uuid(10), uuid(11), uuid(12)];
  const isolationCaptures = [uuid(14), uuid(15)];
  const holderName = 'kajo_shared_round_capture_holder';
  const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const timestamp = value => `'${value.replaceAll("'", "''")}'::timestamptz`;
  let holder, holderState, holderPid, evidenceBefore, result, failure;
  let fixtureAttempted = false;
  const command = (commandId, actorUserId, kind, expectedRevision, extra = {}) => ({
    version: 1, commandId, actorUserId, profileId, roundId, kind, expectedRevision, ...extra,
  });
  const transaction = (request, name, hold = false, captureCutoff = false) => `begin;
    set local application_name='${name}'; set local request.jwt.claim.sub='${request.actorUserId}';
    set local role authenticated;
    select public.commit_shared_rating_round_v1(${literal(request)});
    ${captureCutoff ? "select jsonb_build_object('cutoff',clock_timestamp());" : ''}
    ${hold ? `do $hold$ begin
      begin perform pg_sleep(110); exception when query_canceled then null; end;
    end; $hold$;` : ''}
    commit;`;
  const accepted = (receipt, request) => {
    assert.equal(receipt.version, 1);
    assert.equal(receipt.commandId, request.commandId);
    assert.equal(receipt.round.groupReward, null);
    assert.equal(receipt.round.learnable, false);
    return receipt;
  };
  const sourceOnly = outcome => {
    assert.equal(outcome.contractVersion, 'shared-round-outcome-v1');
    assert.equal(outcome.sourceBasis, 'COMMAND_RECEIPT_PREFIX');
    assert.equal(outcome.availabilityBasis, 'SERVER_COMMAND_ACCEPTED_AT');
    assert.equal(outcome.historicalFeatureEligible, false);
    assert.equal(outcome.commitVisibility, 'UNKNOWN');
    assert.equal(outcome.membershipValidity, 'HISTORICAL_MEMBERSHIP_UNKNOWN');
    assert.equal(outcome.groupReward, null);
    assert.equal(outcome.learnable, false);
  };
  const assertCapture = (capture, captureId, revision, commandIds) => {
    assert.equal(capture.contractVersion, 'shared-round-capture-v1');
    assert.equal(capture.captureId, captureId);
    assert.equal(capture.sourceBasis, 'SERVER_VISIBLE_COMMAND_RECEIPT_PREFIX');
    assert.equal(capture.usage, 'OUTCOME_EVIDENCE_ONLY');
    assert.equal(capture.interpretationVersion, 'shared-round-outcome-v1');
    assert.equal(capture.maturityVersion, 'explicit-elapsed-seconds-v1');
    assert.equal(capture.historicalFeatureEligible, false);
    assert.equal(capture.groupReward, null);
    assert.equal(capture.learnable, false);
    assert.equal(capture.sourceRevision, revision);
    assert.deepEqual(capture.visibleCommandIds, commandIds);
    assert.match(capture.outcomeDigest, /^[0-9a-f]{32}$/);
    sourceOnly(capture.outcome);
    assert.equal(capture.outcome.round.revision, revision);
  };
  const live = cutoff => `private.shared_rating_round_outcome_v1(
    '${profileId}'::uuid,'${roundId}'::uuid,${cutoff},${cutoff},interval '0 seconds')`;
  const captureCall = (captureId, cutoff) => `private.capture_shared_rating_round_outcome_v1(
    '${captureId}'::uuid,'${profileId}'::uuid,'${roundId}'::uuid,${timestamp(cutoff)},${timestamp(cutoff)},interval '0 seconds')`;
  const getCapture = captureId => `private.get_shared_round_outcome_capture_v1('${captureId}'::uuid)`;
  const frozenRead = (call, stage, name) => exec(`begin; set local application_name='${name}';
    with frozen as materialized(select ${call} value)
    select jsonb_build_object('readerPid',pg_backend_pid(),'value',value,
      'utf8',encode(convert_to(value::text,'UTF8'),'hex'),
      'sha256',encode(sha256(convert_to(value::text,'UTF8')),'hex'),
      'outcomeMd5',case when value ? 'outcome' then md5((value->'outcome')::text) else null end,
      'observedAtFinitePast',coalesce(isfinite((value->>'observedAt')::timestamptz)
        and (value->>'observedAt')::timestamptz<=clock_timestamp(),false))
      from frozen;
    commit;`, stage).then(rows => {
    assert.equal(rows[0]?.observedAtFinitePast, true, 'Capture lacks a finite observed read time at or before this server read');
    return rows[0];
  });
  const capture = (captureId, cutoff, stage) => frozenRead(captureCall(captureId, cutoff), stage, 'kajo_shared_round_capture_writer');
  const replay = (captureId, stage) => frozenRead(getCapture(captureId), stage, 'kajo_shared_round_capture_reader');
  const sameBytes = (replayed, original) => {
    assert.deepEqual(replayed.value, original.value, 'Frozen capture JSON changed');
    assert.equal(replayed.utf8, original.utf8, 'Frozen capture canonical UTF-8 bytes changed');
    assert.equal(replayed.sha256, original.sha256, 'Frozen capture SHA-256 changed');
  };
  const releaseHolder = async () => (await exec(`select coalesce((select to_jsonb(pg_cancel_backend(a.pid))
    from pg_stat_activity a where a.application_name='${holderName}'
      ${Number.isSafeInteger(holderPid) ? `and a.pid=${holderPid}` : ''}
      and a.state='active' and a.wait_event='PgSleep'),'false'::jsonb);`,
  'shared-round-captures-release-owned-holder'))[0];
  const holderOpen = async stage => (await exec(`do $refresh$ begin perform pg_stat_clear_snapshot(); end; $refresh$;
    select to_jsonb(exists(select 1 from pg_stat_activity a where a.pid=${holderPid}
      and a.application_name='${holderName}' and a.state='active' and a.wait_event='PgSleep'));`, stage))[0];
  const evidence = async () => (await exec(`select jsonb_build_object(
    'events',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) from public.events r),
    'interactions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) from public.item_interactions r));`,
  'shared-round-captures-canonical-evidence'))[0];

  try {
    const [acl] = await exec(`select jsonb_build_object('functions',count(*),'ownerOnlyInvoker',bool_and(
      not p.prosecdef and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))
        where grantee=0 and privilege_type='EXECUTE')))
      from pg_proc p where p.oid=any(array[
        'private.capture_shared_rating_round_outcome_v1(uuid,uuid,uuid,timestamptz,timestamptz,interval)'::regprocedure,
        'private.get_shared_round_outcome_capture_v1(uuid)'::regprocedure]);`, 'shared-round-captures-reader-acls');
    assert.deepEqual(acl, { functions: 2, ownerOnlyInvoker: true }, 'Capture boundary is not owner-only invoker');
    const [reserved] = await exec(`select jsonb_build_object(
      'users',(select count(*) from auth.users where id in ('${actors[0]}','${actors[1]}'))
        +(select count(*) from public.users where id in ('${actors[0]}','${actors[1]}')),
      'profiles',(select count(*) from public.profiles where id='${profileId}' or owner_user_id in ('${actors[0]}','${actors[1]}')),
      'items',(select count(*) from public.items where id='${itemId}'),
      'rounds',(select count(*) from private.shared_rating_rounds where id='${roundId}'),
      'commands',(select count(*) from private.shared_rating_round_receipts where command_id in ('${uuid(7)}','${uuid(8)}','${uuid(9)}','${uuid(13)}')),
      'captures',(select count(*) from private.shared_round_outcome_captures where id in (
        '${captures[0]}','${captures[1]}','${captures[2]}','${isolationCaptures[0]}','${isolationCaptures[1]}')));`,
    'shared-round-captures-reserved-fixture-guard');
    assert.deepEqual(reserved, { users: 0, profiles: 0, items: 0, rounds: 0, commands: 0, captures: 0 },
      'Capture fixture namespace is occupied; no cleanup ownership was claimed');
    fixtureAttempted = true;
    await exec(`begin;
      insert into auth.users(id,email,raw_user_meta_data) values
        ('${actors[0]}','shared-capture-a@example.invalid','{"kajo_nickname":"Capture A"}'),
        ('${actors[1]}','shared-capture-b@example.invalid','{"kajo_nickname":"Capture B"}');
      insert into public.profiles(id,profile_type,name) values ('${profileId}','SHARED','Native frozen capture');
      insert into public.profile_members(profile_id,user_id) values ('${profileId}','${actors[0]}'),('${profileId}','${actors[1]}');
      insert into public.items(id,item_type,title,discoverable) values ('${itemId}','BOOK','Native frozen capture',true);
      commit;`, 'shared-round-captures-fixture');
    evidenceBefore = await evidence();
    const open = command(uuid(7), actors[0], 'OPEN_ROUND', 0, { itemId, experienceId: uuid(6) });
    accepted((await exec(transaction(open, 'kajo_capture_open'), 'shared-round-captures-open'))[0], open);
    const firstAnswer = command(uuid(8), actors[0], 'SET_RESPONSE', 1, { rating: 0, origin: null });
    const firstReceipt = accepted((await exec(transaction(firstAnswer, 'kajo_capture_first'), 'shared-round-captures-first-response'))[0], firstAnswer);
    const finalAnswer = command(uuid(9), actors[1], 'SET_RESPONSE', 2, { rating: 9, origin: null });
    holder = exec(transaction(finalAnswer, holderName, true), 'shared-round-captures-uncommitted-holder')
      .then(value => (holderState = { value }), error => (holderState = { error }));
    for (let attempt = 0; attempt < 80; attempt++) {
      const [observed] = await exec(`select coalesce((select to_jsonb(a.pid) from pg_stat_activity a
        where a.application_name='${holderName}' and a.state='active' and a.wait_event='PgSleep'),'null'::jsonb);`,
      'shared-round-captures-observe-holder');
      if (observed !== null) { holderPid = observed; break; }
      if (holderState?.error) throw holderState.error;
      await delay(50);
    }
    assert.ok(Number.isSafeInteger(holderPid) && holderPid > 0, 'Did not observe the actual final-response holder PID');
    const [clock] = await exec(`with clock as materialized(select clock_timestamp() cutoff)
      select jsonb_build_object('cutoff',cutoff,'outcome',${live('cutoff')}) from clock;`, 'shared-round-captures-visible-prefix-cutoffs');
    const cutoff = clock.cutoff;
    sourceOnly(clock.outcome);
    assert.deepEqual(clock.outcome.round, firstReceipt.round, 'Uncommitted final response entered the visible live prefix');
    const firstCapture = await capture(captures[0], cutoff, 'shared-round-captures-create-before-commit');
    assert.ok(Number.isSafeInteger(firstCapture.readerPid) && firstCapture.readerPid > 0, 'Invalid native capture writer PID');
    assert.notEqual(firstCapture.readerPid, holderPid, 'Capture used the holder connection');
    assertCapture(firstCapture.value, captures[0], 2, [open.commandId, firstAnswer.commandId]);
    assert.equal(firstCapture.value.outcomeDigest, firstCapture.outcomeMd5, 'Capture digest does not bind its frozen outcome');
    assert.deepEqual(firstCapture.value.outcome, clock.outcome);
    const independentReplay = await replay(captures[0], 'shared-round-captures-third-session-replay-before-commit');
    assert.ok(Number.isSafeInteger(independentReplay.readerPid) && independentReplay.readerPid > 0, 'Invalid native replay reader PID');
    assert.notEqual(independentReplay.readerPid, holderPid, 'Precommit replay used the holder connection');
    assert.notEqual(independentReplay.readerPid, firstCapture.readerPid, 'Precommit replay reused the capture writer connection');
    sameBytes(independentReplay, firstCapture);
    assert.equal(await holderOpen('shared-round-captures-prove-holder-after-stored-replay'), true,
      'Final response committed before the independent committed-capture replay completed');
    assert.equal(await releaseHolder(), true, 'Could not release the observed post-command holder sleep');
    const finished = await holder;
    if (finished.error) throw finished.error;
    const finalReceipt = accepted(finished.value[0], finalAnswer);
    assert.equal(finalReceipt.round.revision, 3);
    assert.equal(finalReceipt.round.state, 'COMPLETED');
    const [committed] = await exec(`select jsonb_build_object('outcome',${live(timestamp(cutoff))},
      'finalAcceptedByFixedCutoffs',(select created_at<=${timestamp(cutoff)}
        from private.shared_rating_round_receipts where command_id='${finalAnswer.commandId}'));`, 'shared-round-captures-live-after-commit');
    assert.equal(committed.finalAcceptedByFixedCutoffs, true);
    assert.equal(committed.outcome.round.revision, 3);
    assert.deepEqual(committed.outcome.round, finalReceipt.round);
    sameBytes(await replay(captures[0], 'shared-round-captures-first-replay-after-commit'), firstCapture);
    sameBytes(await capture(captures[0], cutoff, 'shared-round-captures-exact-retry-after-commit'), firstCapture);
    const completeCapture = await capture(captures[1], cutoff, 'shared-round-captures-new-id-after-commit');
    assertCapture(completeCapture.value, captures[1], 3, [open.commandId, firstAnswer.commandId, finalAnswer.commandId]);
    assert.equal(completeCapture.value.outcomeDigest, completeCapture.outcomeMd5);
    assert.deepEqual(completeCapture.value.outcome, committed.outcome);

    const correction = command(uuid(13), actors[1], 'SET_RESPONSE', 3, { rating: 1, origin: null });
    const [correctedReceipt, later] = await exec(transaction(correction, 'kajo_capture_correction', false, true), 'shared-round-captures-correction');
    accepted(correctedReceipt, correction);
    const correctedCapture = await capture(captures[2], later.cutoff, 'shared-round-captures-new-cutoffs-after-correction');
    assertCapture(correctedCapture.value, captures[2], 4, [open.commandId, firstAnswer.commandId, finalAnswer.commandId, correction.commandId]);
    assert.equal(correctedCapture.value.outcomeDigest, correctedCapture.outcomeMd5);
    assert.deepEqual(correctedCapture.value.outcome.round, correctedReceipt.round);
    assert.deepEqual(correctedCapture.value.outcome.round.responses.map(response => [response.actorUserId,response.status,response.rating])
      .sort((a, b) => a[0].localeCompare(b[0])), [[actors[0], 'RATED', 0], [actors[1], 'RATED', 1]]);
    sameBytes(await replay(captures[0], 'shared-round-captures-first-replay-after-correction'), firstCapture);
    sameBytes(await replay(captures[1], 'shared-round-captures-complete-replay-after-correction'), completeCapture);
    const [oldCutoffs] = await exec(`select ${live(timestamp(cutoff))};`, 'shared-round-captures-live-old-cutoffs-after-correction');
    assert.equal(oldCutoffs.round.revision, 3);
    for (const [index, isolation] of ['REPEATABLE READ', 'SERIALIZABLE'].entries()) {
      const [replayed, guard] = await exec(`begin isolation level ${isolation};
        with stored as materialized(select ${getCapture(captures[1])} value),
          retried as materialized(select ${captureCall(captures[1], cutoff)} value)
        select jsonb_build_object('stored',jsonb_build_object('value',stored.value,
            'utf8',encode(convert_to(stored.value::text,'UTF8'),'hex'),
            'sha256',encode(sha256(convert_to(stored.value::text,'UTF8')),'hex')),
          'retried',jsonb_build_object('value',retried.value,
            'utf8',encode(convert_to(retried.value::text,'UTF8'),'hex'),
            'sha256',encode(sha256(convert_to(retried.value::text,'UTF8')),'hex')))
          from stored cross join retried;
        do $allocation$ declare rejected text;
        begin
          begin perform ${captureCall(isolationCaptures[index], cutoff)};
          exception when sqlstate '25001' then rejected:=sqlstate; end;
          if rejected is distinct from '25001' then
            raise exception 'Fresh capture allocation accepted a stale transaction snapshot' using errcode='22023';
          end if;
          perform set_config('kajo.capture_native_rejection',rejected,true);
        end; $allocation$;
        select jsonb_build_object('sqlstate',current_setting('kajo.capture_native_rejection'),
          'captures',(select count(*) from private.shared_round_outcome_captures where round_id='${roundId}'));
        rollback;`, `shared-round-captures-${isolation.replaceAll(' ', '-').toLowerCase()}-allocation-guard`);
      sameBytes(replayed.stored, completeCapture);
      sameBytes(replayed.retried, completeCapture);
      assert.deepEqual(guard, { sqlstate: '25001', captures: 3 }, 'Stale isolation failed to preserve reads/retries and reject new allocation');
    }
    const [captureCount] = await exec(`select to_jsonb(count(*)) from private.shared_round_outcome_captures c
      join private.shared_rating_round_receipts r on r.command_id=c.source_command_id where r.round_id='${roundId}';`,
    'shared-round-captures-exact-retry-count');
    assert.equal(captureCount, 3, 'Exact capture retry allocated an additional frozen observation');
    assert.deepEqual(await evidence(), evidenceBefore, 'Frozen capture operations wrote canonical evidence before participant erasure');

    const [removed, erased] = await exec(`begin;
      with removed as(delete from auth.users where id='${actors[1]}' returning id) select to_jsonb(count(*)=1) from removed;
      select jsonb_build_object('rounds',(select count(*) from private.shared_rating_rounds where id='${roundId}'),
        'responses',(select count(*) from private.shared_rating_round_responses where round_id='${roundId}'),
        'receipts',(select count(*) from private.shared_rating_round_receipts where round_id='${roundId}'),
        'captures',(select count(*) from private.shared_round_outcome_captures where id in ('${captures[0]}','${captures[1]}','${captures[2]}')));
      commit;`, 'shared-round-captures-actor-erasure');
    assert.equal(removed, true, 'Owned participant erasure did not execute');
    assert.deepEqual(erased, { rounds: 0, responses: 0, receipts: 0, captures: 0 }, 'Participant erasure left frozen evidence lineage');
    const [missing] = await exec(`select jsonb_build_object('first',${getCapture(captures[0])},
      'completed',${getCapture(captures[1])},'corrected',${getCapture(captures[2])});`, 'shared-round-captures-replay-after-erasure');
    assert.deepEqual(missing, { first: null, completed: null, corrected: null }, 'Replay resurrected erased frozen outcome evidence');

    assert.deepEqual(await evidence(), evidenceBefore, 'Frozen capture operations changed canonical Events or interactions');
    result = { status: 'PASS', cases: ['observed final-response holder; independent capture and third-session replay commit first',
      'same fixed-cutoff live read advances while frozen UTF-8 replay and exact retry remain identical',
      'new capture includes completion; later correction has its own capture and preserves earlier bytes',
      'REPEATABLE READ and SERIALIZABLE retain stored replay/retry and reject fresh allocations with 25001',
      'actor erasure removes source receipts and captures; replay returns null'],
    visibilityProof: { holderPid, capturePid: firstCapture.readerPid, replayPid: independentReplay.readerPid, cutoff },
    capturedRevisions: [2, 3, 4], historicalFeatureEligible: false, groupReward: null, learnable: false,
    canonicalEvidence: 'UNCHANGED' };
  } catch (error) { failure = error; }
  finally {
    const cleanupFailures = [];
    if (holder) {
      if (!holderState) {
        try { await releaseHolder(); } catch (error) { cleanupFailures.push(error); }
      }
      const finished = await holder;
      if (finished.error && finished.error !== failure) cleanupFailures.push(finished.error);
    }
    if (fixtureAttempted) {
      try {
        const [remaining] = await exec(`begin;
          delete from public.profiles where id='${profileId}';
          delete from public.items where id='${itemId}';
          delete from auth.users where id in ('${actors[0]}','${actors[1]}');
          select jsonb_build_object('users',(select count(*) from auth.users where id in ('${actors[0]}','${actors[1]}')),
            'profiles',(select count(*) from public.profiles where id='${profileId}' or owner_user_id in ('${actors[0]}','${actors[1]}')),
            'items',(select count(*) from public.items where id='${itemId}'),
            'rounds',(select count(*) from private.shared_rating_rounds where id='${roundId}'),
            'captures',(select count(*) from private.shared_round_outcome_captures where id in (
              '${captures[0]}','${captures[1]}','${captures[2]}','${isolationCaptures[0]}','${isolationCaptures[1]}')));
          commit;`, 'shared-round-captures-cleanup-owned-fixture');
        assert.deepEqual(remaining, { users: 0, profiles: 0, items: 0, rounds: 0, captures: 0 },
          'Owned frozen-capture fixture was not fully removed');
        if (evidenceBefore) assert.deepEqual(await evidence(), evidenceBefore, 'Frozen-capture fixture cleanup changed canonical evidence');
      } catch (error) { cleanupFailures.push(error); }
    }
    if (cleanupFailures.length) throw new AggregateError(failure ? [failure, ...cleanupFailures] : cleanupFailures,
      'Shared capture concurrency failed; holder and reserved-fixture cleanup errors are retained');
  }
  if (failure) throw failure;
  return result;
}
