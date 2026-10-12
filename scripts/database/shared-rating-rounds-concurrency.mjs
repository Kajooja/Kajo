import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// Native-only, inside the existing newly owned disposable CLI stack. Committed
// fixture rows are visible to independent sessions; real blocker relationships,
// rather than elapsed execution time, prove each race reached its lock boundary.
export async function verifySharedRatingRoundsConcurrency(exec) {
  const actors = [1, 2, 3].map(n => `a2320000-0000-4000-8000-${String(n).padStart(12, '0')}`);
  let sequence = 100;
  const id = () => `a2320000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`;
  const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const profiles = [id(), id(), id()];
  const items = [id(), id(), id()];
  await exec(`begin;
    insert into auth.users(id,email,raw_user_meta_data)
      select actor,actor::text||'@example.invalid',jsonb_build_object('kajo_nickname','Native round '||right(actor::text,6))
      from unnest(array[${actors.map(actor => `'${actor}'::uuid`).join(',')}]) fixture(actor);
    insert into public.profiles(id,profile_type,name) values
      ('${profiles[0]}','SHARED','Native round retry'),('${profiles[1]}','SHARED','Native round pair'),
      ('${profiles[2]}','SHARED','Native round group');
    insert into public.profile_members(profile_id,user_id) values
      ('${profiles[0]}','${actors[0]}'),('${profiles[0]}','${actors[1]}'),
      ('${profiles[1]}','${actors[0]}'),('${profiles[1]}','${actors[1]}'),
      ('${profiles[2]}','${actors[0]}'),('${profiles[2]}','${actors[1]}'),('${profiles[2]}','${actors[2]}');
    insert into public.items(id,item_type,title,discoverable) values
      ('${items[0]}','BOOK','Native round retry',true),('${items[1]}','MOVIE','Native round pair',true),
      ('${items[2]}','BOOK','Native round group',true);
    commit;`, { stage: 'shared-round-concurrency-fixture' });

  const evidence = async () => (await exec(`select jsonb_build_object(
    'events',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) from public.events r),
    'interactions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex')) from public.item_interactions r));`,
  { stage: 'shared-round-concurrency-evidence' }))[0];
  const evidenceBefore = await evidence();

  const command = (profileId, roundId, actorUserId, kind, expectedRevision, extra = {}) => ({
    version: 1, commandId: id(), actorUserId, profileId, roundId, kind, expectedRevision, ...extra,
  });
  const transaction = (request, name, hold = false) => `begin;
    set local application_name='${name}'; set local request.jwt.claim.sub='${request.actorUserId}';
    set local role authenticated;
    do $command$ declare response jsonb;
    begin
      begin
        response := public.commit_shared_rating_round_v1(${literal(request)});
        perform set_config('kajo.shared_round_concurrency_result',jsonb_build_object('status','success','result',response)::text,true);
      exception when others then
        perform set_config('kajo.shared_round_concurrency_result',jsonb_build_object('status','error','sqlstate',sqlstate)::text,true);
      end;
    end; $command$;
    select current_setting('kajo.shared_round_concurrency_result')::jsonb;
    ${hold ? 'do $hold$ begin perform pg_sleep(3); end; $hold$;' : ''}
    commit;`;
  const invoke = async (request, stage) => (await exec(transaction(request, `kajo_${stage.replaceAll('-', '_')}`),
    { stage, timeoutMs: 30_000 }))[0];
  const accepted = reply => {
    assert.equal(reply?.status, 'success', `Shared round command failed with SQLSTATE ${reply?.sqlstate}`);
    assert.equal(reply.result.version, 1);
    assert.equal(reply.result.round.groupReward, null);
    assert.equal(reply.result.round.learnable, false);
    return reply.result;
  };
  const counts = async roundId => (await exec(`select jsonb_build_object(
    'rounds',(select count(*) from private.shared_rating_rounds where id='${roundId}'),
    'responses',(select count(*) from private.shared_rating_round_responses where round_id='${roundId}'),
    'receipts',(select count(*) from private.shared_rating_round_receipts where round_id='${roundId}'));`,
  { stage: 'shared-round-concurrency-counts' }))[0];
  const assertCompletedOnce = async roundId => {
    const [completion] = await exec(`select jsonb_build_object(
      'state',(select current_state from private.shared_rating_rounds where id='${roundId}'),
      'completedReceipts',(select count(*) from private.shared_rating_round_receipts where round_id='${roundId}'
        and result#>>'{round,state}'='COMPLETED'));`, { stage: 'shared-round-concurrency-completion' });
    assert.deepEqual(completion, { state: 'COMPLETED', completedReceipts: 1 }, 'Joint source completion was not committed exactly once');
  };

  async function waitForHolder(name) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const [holder] = await exec(`select coalesce((select to_jsonb(a.pid) from pg_stat_activity a
        where a.application_name='${name}' and a.state='active' and a.wait_event='PgSleep'), 'null'::jsonb);`,
      { stage: 'shared-round-concurrency-observe-holder' });
      if (holder !== null) return holder;
      await delay(40);
    }
    throw new Error('Shared round race did not observe the holder after its command');
  }
  async function waitForWaiter(name, holderPid) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const [blocked] = await exec(`select to_jsonb(exists(select 1 from pg_stat_activity a
        where a.application_name='${name}' and a.wait_event_type='Lock'
          and ${holderPid}=any(pg_blocking_pids(a.pid))));`,
      { stage: 'shared-round-concurrency-observe-waiter' });
      if (blocked) return;
      await delay(40);
    }
    throw new Error('Shared round race did not observe the waiter blocked by the actual holder');
  }
  async function race(holderSql, waiterRequest) {
    const holderName = 'kajo_shared_round_holder', waiterName = 'kajo_shared_round_waiter';
    const settle = promise => promise.then(value => ({ value }), error => ({ error }));
    const first = settle(exec(holderSql(holderName), { stage: 'shared-round-concurrency-holder', timeoutMs: 30_000 }));
    let second;
    try {
      const holderPid = await waitForHolder(holderName);
      assert.ok(Number.isSafeInteger(holderPid) && holderPid > 0, 'Invalid native holder process identity');
      second = settle(exec(transaction(waiterRequest, waiterName),
        { stage: 'shared-round-concurrency-waiter', timeoutMs: 30_000 }));
      await waitForWaiter(waiterName, holderPid);
      const [a, b] = await Promise.all([first, second]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      return [a.value, b.value];
    } finally { await Promise.all([first, second]); }
  }

  const retryRound = id();
  accepted(await invoke(command(profiles[0], retryRound, actors[0], 'OPEN_ROUND', 0,
    { itemId: items[0], experienceId: id() }), 'shared-round-concurrency-open-retry'));
  accepted(await invoke(command(profiles[0], retryRound, actors[0], 'SET_RESPONSE', 1,
    { rating: 0, origin: null }), 'shared-round-concurrency-first-retry'));
  const finalCommand = command(profiles[0], retryRound, actors[1], 'SET_RESPONSE', 2, { rating: 9, origin: null });
  const beforeRetry = await counts(retryRound);
  const [firstFinal, repeatedFinal] = await race(name => transaction(finalCommand, name, true), finalCommand);
  const finalReceipt = accepted(firstFinal[0]);
  assert.equal(finalReceipt.commandId, finalCommand.commandId);
  assert.deepEqual(accepted(repeatedFinal[0]), finalReceipt, 'Concurrent final-answer retry changed its exact receipt');
  assert.equal(finalReceipt.round.revision, 3);
  assert.equal(finalReceipt.round.state, 'COMPLETED');
  assert.deepEqual(finalReceipt.round.responses.map(response => [response.actorUserId, response.status, response.rating])
    .sort((x, y) => x[0].localeCompare(y[0])), [[actors[0], 'RATED', 0], [actors[1], 'RATED', 9]]);
  assert.deepEqual(await counts(retryRound), { ...beforeRetry, responses: beforeRetry.responses + 1,
    receipts: beforeRetry.receipts + 1 });
  await assertCompletedOnce(retryRound);

  // Distinct concurrent answers share a revision. The losing command must have
  // no receipt/effect; a new command against the accepted revision completes once.
  for (const memberCount of [2, 3]) {
    const profileId = profiles[memberCount - 1], roundId = id();
    accepted(await invoke(command(profileId, roundId, actors[0], 'OPEN_ROUND', 0,
      { itemId: items[memberCount - 1], experienceId: id() }), 'shared-round-concurrency-open-distinct'));
    let revision = 1;
    if (memberCount === 3) {
      accepted(await invoke(command(profileId, roundId, actors[0], 'SET_RESPONSE', revision++, { rating: 0, origin: null }),
        'shared-round-concurrency-seed-group'));
    }
    const firstActor = actors[memberCount - 2], lastActor = actors[memberCount - 1];
    const first = command(profileId, roundId, firstActor, 'SET_RESPONSE', revision, { rating: 4, origin: null });
    const second = command(profileId, roundId, lastActor, 'SET_RESPONSE', revision, { rating: 10, origin: null });
    const before = await counts(roundId);
    const [a, b] = await race(name => transaction(first, name, true), second);
    const winning = accepted(a[0]);
    assert.equal(winning.commandId, first.commandId);
    assert.equal(winning.round.revision, revision + 1);
    assert.equal(winning.round.state, 'PENDING', 'One response silently completed the remaining participant set');
    assert.deepEqual(b[0], { status: 'error', sqlstate: '22023' }, 'Competing stale revision was not rejected');
    assert.deepEqual(await counts(roundId), { ...before, responses: before.responses + 1, receipts: before.receipts + 1 });
    const [loserExists] = await exec(`select to_jsonb(exists(select 1 from private.shared_rating_round_receipts
      where command_id='${second.commandId}'));`, { stage: 'shared-round-concurrency-loser-receipt' });
    assert.equal(loserExists, false, 'Failed competing response retained a receipt');
    const corrected = command(profileId, roundId, lastActor, 'SET_RESPONSE', revision + 1, { rating: 10, origin: null });
    const complete = accepted(await invoke(corrected, 'shared-round-concurrency-final-distinct'));
    assert.equal(complete.commandId, corrected.commandId);
    assert.equal(complete.round.revision, revision + 2);
    assert.equal(complete.round.state, 'COMPLETED');
    assert.deepEqual(complete.round.responses.map(response => [response.actorUserId, response.status, response.rating])
      .sort((x, y) => x[0].localeCompare(y[0])), actors.slice(0, memberCount).map((actor, index) =>
      [actor, 'RATED', index === memberCount - 1 ? 10 : memberCount === 3 && index === 0 ? 0 : 4]));
    assert.deepEqual(await counts(roundId), { rounds: 1, responses: memberCount, receipts: memberCount + 1 });
    assert.deepEqual(accepted(await invoke(corrected, 'shared-round-concurrency-repeat-distinct')), complete);
    assert.deepEqual(await counts(roundId), { rounds: 1, responses: memberCount, receipts: memberCount + 1 });
    await assertCompletedOnce(roundId);
  }

  // Membership removal is committed before an old receipt can be replayed. The
  // retry must acquire current membership authorization, wait, then fail closed.
  const beforeRevocation = await counts(retryRound);
  const [removed, denied] = await race(name => `begin; set local application_name='${name}';
    with removed as (delete from public.profile_members
      where profile_id='${profiles[0]}' and user_id='${actors[1]}' returning user_id)
    select jsonb_build_object('removed',count(*)=1) from removed;
    do $hold$ begin perform pg_sleep(3); end; $hold$; commit;`, finalCommand);
  assert.deepEqual(removed[0], { removed: true });
  assert.deepEqual(denied[0], { status: 'error', sqlstate: '42501' }, 'Old receipt bypassed membership revocation');
  assert.deepEqual(await counts(retryRound), beforeRevocation);
  const [storedReceipt] = await exec(`select result from private.shared_rating_round_receipts
    where command_id='${finalCommand.commandId}';`, { stage: 'shared-round-concurrency-stored-receipt' });
  assert.deepEqual(storedReceipt, finalReceipt, 'Membership revocation rewrote the immutable original receipt');
  assert.deepEqual(await evidence(), evidenceBefore, 'Source-only round races changed canonical Events or interactions');
  return { status: 'PASS', cases: ['observed blocker: identical final-answer retry',
    'observed blocker: pair and three-member competing answers with revision recovery',
    'observed blocker: membership removal denies old receipt retry'],
  groupReward: null, learnable: false, canonicalEvidence: 'UNCHANGED' };
}
