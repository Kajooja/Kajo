import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withSharedPreparedFixture, literal, auth, roundCommand } from './shared-prepared-consumption.mjs';

// The same real commands/read-only reader run in disposable PGlite and native
// PostgreSQL. These are synthetic contract observations, never quality samples.
export async function verifySharedForecastOutcomes(execSql, migration) {
  return withSharedPreparedFixture(execSql, async ({ f, exec, one, call, source, snapshot }) => {
    const prediction = randomUUID();
    await call(prediction, f.consensus);
    const frozen = await source(prediction);
    const capture = async (round = f.targetRound, maturity = 0) => {
      const id = randomUUID();
      await exec(`begin;select private.capture_shared_rating_round_outcome_v1(${literal(id)},
        ${literal(f.pair)},${literal(round)},clock_timestamp(),clock_timestamp(),
        ${maturity}*interval '1 second');commit;`, 'outcome-capture');
      return id;
    };
    const reconcileSql = (id, minimum = 0, run = prediction) =>
      `select private.reconcile_shared_forecast_outcome_v1(${literal(run)},${literal(id)},${minimum});`;
    const reconcile = (id, minimum = 0, run = prediction) =>
      one(`begin read only;${reconcileSql(id, minimum, run)}rollback;`, 'outcome-reconcile');
    const answer = (actor, revision, rating, kind = 'SET_RESPONSE') => one(`begin;${auth(actor)}
      select ${roundCommand({ ...f, actor }, literal(f.targetRound), kind, revision,
    kind === 'SET_RESPONSE' ? { rating } : {})};commit;`, 'outcome-answer');
    const pending = await capture();
    let preservation;
    if (migration) {
      const inventory = `select jsonb_build_object('functions',(select jsonb_object_agg(p.oid::text,to_jsonb(p))
        from pg_proc p where p.pronamespace in('public'::regnamespace,'private'::regnamespace)),
        'defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d));`;
      const before = await snapshot(), old = await one(inventory, 'reconciliation-old-functions');
      await exec(`begin;${migration.sql}commit;`, 'reconciliation-forward');
      assert.deepEqual(await snapshot(), before, 'Reconciliation forward changed retained rows');
      const current = await one(inventory, 'reconciliation-current-functions');
      assert.deepEqual(current.defaults, old.defaults);
      for (const [oid, value] of Object.entries(old.functions)) assert.deepEqual(current.functions[oid], value);
      const added = Object.entries(current.functions).filter(([oid]) => !Object.hasOwn(old.functions, oid)).map(([, f]) => f);
      assert.equal(added.length, 1);
      assert.equal(added[0].proname, 'reconcile_shared_forecast_outcome_v1');
      assert.equal(added[0].prosecdef, false);
      assert.equal(added[0].provolatile, 's');
      preservation = { rows: 'UNCHANGED', existingFunctions: Object.keys(old.functions).length,
        existingFunctionBodiesAndMetadata: 'UNCHANGED', defaults: 'UNCHANGED', newPrivateReaders: 1 };
    }
    const initial = await reconcile(pending);
    assert.equal(initial.status, 'OUTCOME_INCOMPLETE');
    assert.equal(initial.firstResponse, null);
    assert.equal(initial.responses.length, 2);
    assert.ok(initial.responses.every(r => r.rating === null && r.firstResponse === null));
    assert.equal(initial.qualityComparable, false);
    assert.equal(initial.exposureToForecast, 'NONE_EVALUATION_ONLY');
    assert.equal(initial.policy.cohortAdmission, 'NONE');

    const first = await answer(f.actor, 1, 0);
    const partial = await capture();
    const partialResult = await reconcile(partial);
    assert.equal(partialResult.status, 'OUTCOME_INCOMPLETE');
    assert.equal(partialResult.firstResponse.commandId, first.commandId);
    assert.equal(partialResult.responses.find(r => r.actorUserId === f.actor).rating, 0);
    await answer(f.partner, 2, 10);
    const complete = await capture();
    const linked = await reconcile(complete);
    assert.equal(linked.status, 'MATURE_VECTOR_LINKED');
    assert.deepEqual(linked.responses.map(r => r.rating), [0, 10]);
    assert.ok(linked.responses.every(r => r.attribution.status === 'UNRANKED'));
    assert.equal(linked.outcome.coverage.attributedRatingCount, 0);
    assert.equal(linked.firstResponse.commandId, first.commandId);
    assert.equal(linked.qualityComparable, false);
    assert.equal(linked.groupReward, null);
    assert.equal(linked.metric, null);
    assert.equal(linked.learnable, false);
    assert.equal((await reconcile(complete, 1)).status, 'MATURITY_POLICY_MISMATCH');
    const immature = await capture(f.targetRound, 86400);
    assert.equal((await reconcile(immature, 86400)).status, 'OUTCOME_IMMATURE');

    await answer(f.actor, 3, 5);
    const corrected = await capture();
    const revised = await reconcile(corrected);
    assert.equal(revised.status, 'MATURE_VECTOR_LINKED');
    assert.deepEqual(revised.observation, linked.observation, 'A correction became a new experience');
    assert.deepEqual(revised.forecast, linked.forecast, 'An outcome correction altered the forecast');
    assert.equal(revised.firstResponse.commandId, first.commandId);
    const actor = revised.responses.find(r => r.actorUserId === f.actor);
    assert.equal(actor.rating, 5);
    assert.equal(actor.firstResponse.rating, 0);
    assert.equal(actor.firstRating.rating, 0);
    assert.equal(actor.corrected, true);
    assert.deepEqual(await reconcile(complete), linked, 'Later answers rewrote an immutable outcome interpretation');
    assert.deepEqual(await reconcile(pending), initial, 'A frozen missing answer gained later evidence');
    assert.deepEqual(await source(prediction), frozen, 'Reconciliation or correction changed the frozen source');

    await answer(f.actor, 4, null, 'CLEAR_RESPONSE');
    const cleared = await reconcile(await capture());
    assert.equal(cleared.status, 'OUTCOME_INCOMPLETE');
    assert.equal(cleared.responses.find(r => r.actorUserId === f.actor).rating, null);
    assert.equal(cleared.responses.find(r => r.actorUserId === f.actor).status, 'CLEARED');
    await answer(f.actor, 5, null);
    const unknown = await reconcile(await capture());
    assert.equal(unknown.status, 'OUTCOME_INCOMPLETE');
    assert.equal(unknown.responses.find(r => r.actorUserId === f.actor).status, 'UNKNOWN');
    assert.equal(unknown.responses.find(r => r.actorUserId === f.actor).rating, null);

    const [changed] = await exec(`begin;
      delete from public.profile_members where profile_id=${literal(f.pair)} and user_id=${literal(f.partner)};
      insert into public.profile_members(profile_id,user_id) values(${literal(f.pair)},${literal(f.partner)});
      ${reconcileSql(complete)}rollback;`, 'reconciliation-enrollment-generation');
    assert.equal(changed.status, 'CURRENT_ENROLLMENT_CHANGED');
    assert.deepEqual(changed.responses, []);
    assert.deepEqual(await reconcile(complete), linked);

    const reject = async (sql, code) => {
      const result = await one(`begin;do $reject$ begin begin ${sql}
        raise exception 'Missing reconciliation rejection' using errcode='ZX999';
        exception when sqlstate '${code}' then null;end;end;$reject$;
        select to_jsonb(true);rollback;`, 'reconciliation-reject');
      assert.equal(result, true);
    };
    const otherExperience = await capture(f.raceRounds[0]);
    await reject(`perform private.reconcile_shared_forecast_outcome_v1(${literal(prediction)},${literal(otherExperience)},0);`, '22023');
    await reject(`perform private.reconcile_shared_forecast_outcome_v1(${literal(prediction)},${literal(f.abcSource)},0);`, '22023');
    await reject(`perform private.reconcile_shared_forecast_outcome_v1(${literal(prediction)},${literal(complete)},-1);`, '22023');
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await reject(`set local role ${role};perform private.reconcile_shared_forecast_outcome_v1(${literal(prediction)},${literal(complete)},0);`, '42501');
    }
    assert.equal((await reconcile(complete, 0, randomUUID())).status, 'SOURCE_UNAVAILABLE');

    // A first UNKNOWN is still the first response; a later first numeric answer
    // must not move the prospective boundary or become an invented initial zero.
    const unknownFirstPrediction = randomUUID();
    await call(unknownFirstPrediction, f.raceInputs[0]);
    const unknownFirst = await one(`begin;${auth(f.actor)}select ${roundCommand(f,
      literal(f.raceRounds[0]), 'SET_RESPONSE', 1, { rating: null })};commit;`, 'first-unknown');
    await one(`begin;${auth(f.actor)}select ${roundCommand(f,
      literal(f.raceRounds[0]), 'SET_RESPONSE', 2, { rating: 5 })};commit;`, 'first-numeric');
    const afterUnknown = await reconcile(await capture(f.raceRounds[0]), 0, unknownFirstPrediction);
    const unknownActor = afterUnknown.responses.find(r => r.actorUserId === f.actor);
    assert.equal(afterUnknown.firstResponse.commandId, unknownFirst.commandId);
    assert.equal(unknownActor.firstResponse.status, 'UNKNOWN');
    assert.equal(unknownActor.firstResponse.rating, null);
    assert.equal(unknownActor.firstRating.rating, 5);
    assert.notEqual(unknownActor.firstRating.commandId, unknownFirst.commandId);
    const rowsBeforeReads = await snapshot();
    await reconcile(complete); await reconcile(corrected); await reconcile(pending);
    assert.deepEqual(await snapshot(), rowsBeforeReads, 'Read-only reconciliation stored a derived artifact');

    await answer(f.actor, 6, null, 'CANCEL_ROUND');
    assert.equal((await reconcile(await capture())).status, 'OUTCOME_CANCELLED');
    assert.deepEqual(await reconcile(complete), linked);
    await exec(`begin;select private.erase_shared_prepared_evidence_v1('OUTCOME_CAPTURE',${literal(corrected)});commit;`,
      'reconciliation-outcome-withdrawal');
    assert.equal((await reconcile(corrected)).status, 'SOURCE_UNAVAILABLE');
    assert.deepEqual(await reconcile(complete), linked);
    await exec(`begin;select private.erase_shared_prepared_evidence_v1('INPUT',${literal(f.consensus)});commit;`,
      'reconciliation-input-withdrawal');
    assert.equal((await reconcile(complete)).status, 'SOURCE_UNAVAILABLE');
    assert.equal(await source(prediction), undefined);
    return { status: 'PASS', preservation, cases: ['pending', 'partial', 'zero-ten', 'minimum-maturity', 'immature',
      'correction-first-answer', 'clear', 'unknown', 'unknown-before-numeric', 'cancel', 'enrollment-generation', 'scope-isolation',
      'closed-grants', 'outcome-withdrawal', 'input-withdrawal', 'read-only'],
    qualityAdmission: 'NONE', cleanup: 'CANONICAL_ROWS_RESTORED' };
  });
}
