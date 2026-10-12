import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Native-only, in the existing disposable CLI stack. A server acceptance time
// precedes commit visibility: an unchanged timestamp predicate can include a
// newly committed receipt. This probe deliberately does not claim historical
// feature eligibility or byte-stable reads across that visibility boundary.
export async function verifySharedRoundOutcomesVisibility(execConcurrentSql) {
  const exec = (sql, stage) => execConcurrentSql(sql, { stage, timeoutMs: 120_000 });
  const uuid = n => `a232b100-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const actors = [uuid(1), uuid(2)], profileId = uuid(3), itemId = uuid(4), roundId = uuid(5);
  const holderName = 'kajo_shared_outcome_visibility_holder';
  let holder, holderState, holderPid, before, evidenceBefore, result, failure;
  let fixtureAttempted = false;
  const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const timestamp = value => `'${value.replaceAll("'", "''")}'::timestamptz`;
  const command = (commandId, actorUserId, kind, expectedRevision, extra = {}) => ({
    version: 1, commandId, actorUserId, profileId, roundId, kind, expectedRevision, ...extra,
  });
  const accepted = (result, request) => {
    assert.equal(result.version, 1);
    assert.equal(result.commandId, request.commandId);
    assert.equal(result.round.groupReward, null);
    assert.equal(result.round.learnable, false);
    return result;
  };
  const transaction = (request, name, hold = false, captureCutoff = false) => `begin;
    set local application_name='${name}'; set local request.jwt.claim.sub='${request.actorUserId}';
    set local role authenticated;
    select public.commit_shared_rating_round_v1(${literal(request)});
    ${captureCutoff ? "select jsonb_build_object('cutoff',clock_timestamp());" : ''}
    ${hold ? `do $hold$ begin
      -- The independent reader explicitly releases only this post-RPC sleep.
      -- Its bounded fallback fits inside this session's 120-second deadline.
      begin perform pg_sleep(110); exception when query_canceled then null; end;
    end; $hold$;` : ''}
    commit;`;
  const read = cutoff => `private.shared_rating_round_outcome_v1(
    '${profileId}'::uuid,'${roundId}'::uuid,${cutoff},${cutoff},interval '0 seconds')`;
  const assertSourceOnly = outcome => {
    assert.equal(outcome.contractVersion, 'shared-round-outcome-v1');
    assert.equal(outcome.sourceBasis, 'COMMAND_RECEIPT_PREFIX');
    assert.equal(outcome.availabilityBasis, 'SERVER_COMMAND_ACCEPTED_AT');
    assert.equal(outcome.historicalFeatureEligible, false);
    assert.equal(outcome.membershipValidity, 'HISTORICAL_MEMBERSHIP_UNKNOWN');
    assert.equal(outcome.commitVisibility, 'UNKNOWN');
    assert.equal(outcome.groupReward, null);
    assert.equal(outcome.learnable, false);
    assert.equal(outcome.round.groupReward, null);
    assert.equal(outcome.round.learnable, false);
  };
  const evidence = async () => (await exec(`select jsonb_build_object(
    'events',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) from public.events r),
    'interactions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) from public.item_interactions r));`,
  'shared-round-outcomes-visibility-canonical-evidence'))[0];
  const releaseHolder = async () => (await exec(`select coalesce((select to_jsonb(pg_cancel_backend(a.pid))
    from pg_stat_activity a where a.application_name='${holderName}'
      ${Number.isSafeInteger(holderPid) ? `and a.pid=${holderPid}` : ''}
      and a.state='active' and a.wait_event='PgSleep'),'false'::jsonb);`,
  'shared-round-outcomes-visibility-release-owned-holder'))[0];

  try {
    const [acl] = await exec(`select jsonb_build_object('securityDefiner',p.prosecdef,
      'publicExecute',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))
        where grantee=0 and privilege_type='EXECUTE'),
      'apiExecute',jsonb_build_object('anon',has_function_privilege('anon',p.oid,'EXECUTE'),
        'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
        'service_role',has_function_privilege('service_role',p.oid,'EXECUTE')))
      from pg_proc p where p.oid='private.shared_rating_round_outcome_v1(uuid,uuid,timestamptz,timestamptz,interval)'::regprocedure;`,
    'shared-round-outcomes-visibility-reader-acl');
    assert.deepEqual(acl, { securityDefiner: false, publicExecute: false,
      apiExecute: { anon: false, authenticated: false, service_role: false } }, 'Outcome reader is not owner-only invoker');

    // Claim cleanup ownership only after proving this probe's entire reserved
    // namespace is absent. Setup failure must never erase an existing fixture.
    const [reserved] = await exec(`select jsonb_build_object(
      'users',(select count(*) from auth.users where id in ('${actors[0]}','${actors[1]}'))
        +(select count(*) from public.users where id in ('${actors[0]}','${actors[1]}')),
      'profiles',(select count(*) from public.profiles where id='${profileId}' or owner_user_id in ('${actors[0]}','${actors[1]}')),
      'items',(select count(*) from public.items where id='${itemId}'),
      'rounds',(select count(*) from private.shared_rating_rounds where id='${roundId}'),
      'commands',(select count(*) from private.shared_rating_round_receipts where command_id in ('${uuid(7)}','${uuid(8)}','${uuid(9)}')));`,
    'shared-round-outcomes-visibility-reserved-fixture-guard');
    assert.deepEqual(reserved, { users: 0, profiles: 0, items: 0, rounds: 0, commands: 0 },
      'Visibility fixture namespace is already occupied; no cleanup ownership was claimed');
    fixtureAttempted = true;
    await exec(`begin;
      insert into auth.users(id,email,raw_user_meta_data) values
        ('${actors[0]}','shared-visibility-a@example.invalid','{"kajo_nickname":"Visibility A"}'),
        ('${actors[1]}','shared-visibility-b@example.invalid','{"kajo_nickname":"Visibility B"}');
      insert into public.profiles(id,profile_type,name) values ('${profileId}','SHARED','Native outcome visibility');
      insert into public.profile_members(profile_id,user_id) values ('${profileId}','${actors[0]}'),('${profileId}','${actors[1]}');
      insert into public.items(id,item_type,title,discoverable) values ('${itemId}','BOOK','Native outcome visibility',true);
      commit;`, 'shared-round-outcomes-visibility-fixture');
    evidenceBefore = await evidence();
    const open = command(uuid(7), actors[0], 'OPEN_ROUND', 0, { itemId, experienceId: uuid(6) });
    accepted((await exec(transaction(open, 'kajo_shared_outcome_open'), 'shared-round-outcomes-visibility-open'))[0], open);
    const firstAnswer = command(uuid(8), actors[0], 'SET_RESPONSE', 1, { rating: 0, origin: null });
    const [firstReceipt, early] = await exec(transaction(firstAnswer, 'kajo_shared_outcome_first', false, true),
      'shared-round-outcomes-visibility-first-response');
    accepted(firstReceipt, firstAnswer);
    assert.equal(firstReceipt.round.revision, 2);
    assert.equal(firstReceipt.round.state, 'PENDING');

    const finalAnswer = command(uuid(9), actors[1], 'SET_RESPONSE', 2, { rating: 9, origin: null });
    // Attach a rejection handler immediately and always drain this native session.
    holder = exec(transaction(finalAnswer, holderName, true), 'shared-round-outcomes-visibility-uncommitted-holder')
      .then(value => (holderState = { value }), error => (holderState = { error }));
    for (let attempt = 0; attempt < 80; attempt++) {
      const [observed] = await exec(`select coalesce((select to_jsonb(a.pid) from pg_stat_activity a
        where a.application_name='${holderName}' and a.state='active' and a.wait_event='PgSleep'),'null'::jsonb);`,
      'shared-round-outcomes-visibility-observe-holder');
      if (observed !== null) { holderPid = observed; break; }
      if (holderState?.error) throw holderState.error;
      await delay(50);
    }
    assert.ok(Number.isSafeInteger(holderPid) && holderPid > 0, 'Did not observe the actual post-command holder PID');
    const [prefix, proof] = await exec(`begin; set local application_name='kajo_shared_outcome_visibility_reader';
      with cutoffs as materialized(select clock_timestamp() cutoff)
      select jsonb_build_object('cutoff',cutoff,'readerPid',pg_backend_pid(),'outcome',${read('cutoff')}) from cutoffs;
      do $refresh$ begin perform pg_stat_clear_snapshot(); end; $refresh$;
      select jsonb_build_object('readerPid',pg_backend_pid(),'holderStillOpen',exists(select 1 from pg_stat_activity a
        where a.pid=${holderPid} and a.application_name='${holderName}' and a.state='active' and a.wait_event='PgSleep'));
      commit;`, 'shared-round-outcomes-visibility-independent-prefix-reader');
    assert.notEqual(prefix.readerPid, holderPid, 'Visibility reader reused the holder connection');
    assert.equal(proof.readerPid, prefix.readerPid);
    assert.equal(proof.holderStillOpen, true, 'Holder committed before the independent prefix read completed');
    before = prefix;
    assertSourceOnly(before.outcome);
    assert.equal(before.outcome.source.commandId, firstAnswer.commandId);
    assert.equal(before.outcome.source.revision, 2);
    assert.equal(before.outcome.round.revision, 2);
    assert.equal(before.outcome.round.state, 'PENDING');
    assert.equal(before.outcome.vectorStatus, 'INCOMPLETE');
    assert.deepEqual(before.outcome.round, firstReceipt.round, 'Uncommitted final answer leaked into the visible receipt prefix');
    assert.equal(await releaseHolder(), true, 'Could not release the observed post-command holder sleep');
    const finished = await holder;
    if (finished.error) throw finished.error;
    const finalReceipt = accepted(finished.value[0], finalAnswer);
    assert.equal(finalReceipt.round.revision, 3);
    assert.equal(finalReceipt.round.state, 'COMPLETED');

    const [after] = await exec(`select jsonb_build_object('readerPid',pg_backend_pid(),
      'sameCutoffOutcome',${read(timestamp(before.cutoff))},'earlierCutoffOutcome',${read(timestamp(early.cutoff))},
      'finalAcceptedBySameCutoffs',(select created_at<=${timestamp(before.cutoff)}
        from private.shared_rating_round_receipts where command_id='${finalAnswer.commandId}'),
      'finalExcludedByEarlierCutoffs',(select created_at>${timestamp(early.cutoff)}
        from private.shared_rating_round_receipts where command_id='${finalAnswer.commandId}'));`,
    'shared-round-outcomes-visibility-committed-prefix-reader');
    assert.notEqual(after.readerPid, holderPid, 'Committed prefix reader reused the holder connection');
    assert.equal(after.finalAcceptedBySameCutoffs, true);
    assert.equal(after.finalExcludedByEarlierCutoffs, true);
    assertSourceOnly(after.sameCutoffOutcome);
    assertSourceOnly(after.earlierCutoffOutcome);
    assert.equal(after.sameCutoffOutcome.source.commandId, finalAnswer.commandId);
    assert.equal(after.sameCutoffOutcome.source.revision, 3);
    assert.equal(after.sameCutoffOutcome.round.revision, 3);
    assert.equal(after.sameCutoffOutcome.round.state, 'COMPLETED');
    assert.equal(after.sameCutoffOutcome.vectorStatus, 'READY_FOR_VECTOR_REVIEW');
    assert.equal(after.sameCutoffOutcome.maturity.intervalSeconds, 0);
    assert.equal(after.sameCutoffOutcome.maturity.isMature, true);
    assert.deepEqual(after.sameCutoffOutcome.round, finalReceipt.round, 'Visible source is not the exact final command receipt');
    assert.deepEqual(after.sameCutoffOutcome.round.responses.map(response => [response.actorUserId,response.status,response.rating])
      .sort((a, b) => a[0].localeCompare(b[0])), [[actors[0], 'RATED', 0], [actors[1], 'RATED', 9]]);
    assert.equal(after.earlierCutoffOutcome.source.commandId, firstAnswer.commandId);
    assert.equal(after.earlierCutoffOutcome.round.revision, 2);
    assert.equal(after.earlierCutoffOutcome.round.state, 'PENDING');
    assert.equal(after.earlierCutoffOutcome.vectorStatus, 'INCOMPLETE');

    assert.deepEqual(await evidence(), evidenceBefore, 'Source-only outcome visibility changed canonical Events or interactions');
    result = { status: 'PASS', cases: ['observed post-command holder PID; independent reader excludes uncommitted receipt',
      'same past timestamp cutoffs include final receipt after commit', 'earlier cutoff continues to exclude final receipt'],
    visibilityProof: { holderPid, readerPid: before.readerPid, cutoff: before.cutoff, beforeRevision: 2, afterRevision: 3 },
    sourceBasis: 'COMMAND_RECEIPT_PREFIX', availabilityBasis: 'SERVER_COMMAND_ACCEPTED_AT',
    historicalFeatureEligible: false, commitVisibility: 'UNKNOWN', groupReward: null, learnable: false,
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
            'rounds',(select count(*) from private.shared_rating_rounds where id='${roundId}'));
          commit;`, 'shared-round-outcomes-visibility-cleanup-owned-fixture');
        assert.deepEqual(remaining, { users: 0, profiles: 0, items: 0, rounds: 0 }, 'Owned visibility fixture was not fully removed');
        if (evidenceBefore) assert.deepEqual(await evidence(), evidenceBefore, 'Visibility fixture cleanup changed canonical Events or interactions');
      } catch (error) { cleanupFailures.push(error); }
    }
    if (cleanupFailures.length) throw new AggregateError(failure ? [failure, ...cleanupFailures] : cleanupFailures,
      'Shared outcome visibility failed; holder and reserved-fixture cleanup errors are retained');
  }
  if (failure) throw failure;
  return result;
}
