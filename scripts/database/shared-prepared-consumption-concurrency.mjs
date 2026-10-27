import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withSharedPreparedFixture, literal, auth, consume, roundCommand } from './shared-prepared-consumption.mjs';

// Native CLI only: every execution uses its own psql connection. An observed
// blocker establishes order; elapsed time alone never counts as a race proof.
export async function verifySharedPreparedConcurrency(execSql) {
  return withSharedPreparedFixture(execSql, async ({ f, exec, one, call }) => {
    const running = [], proofs = [];
    const launch = (name, { expression, statement, hold = false, reject }) => {
      const task = { name: 'kajo_shared_prepared_' + name };running.push(task);
      const action = reject ? `do $reject$ declare code text;begin begin perform ${expression};
        exception when sqlstate '${reject}' then code:=sqlstate;end;
        if code is distinct from '${reject}' then raise exception 'Missing native Shared consumption rejection';end if;
        end;$reject$;select jsonb_build_object('sqlstate','${reject}');`
        : expression ? `select ${expression};` : statement;
      task.promise = exec(`begin;set local application_name=${literal(task.name)};${auth(f.actor)}
        ${action}${hold ? `do $hold$ begin begin perform pg_sleep(20);exception when query_canceled then null;end;end;$hold$;` : ''}
        commit;`, name).then(rows => (task.done = { rows }), error => (task.done = { error }));
      return task;
    };
    const observe = async (task, holder) => {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const observed = await one(`select coalesce((select jsonb_build_object('pid',pid,'blockers',pg_blocking_pids(pid),
          'waitType',wait_event_type,'waitEvent',wait_event) from pg_stat_activity where application_name=${literal(task.name)}
          and state='active' ${holder ? `and wait_event_type='Lock' and ${holder.pid}=any(pg_blocking_pids(pid))`
            : "and wait_event='PgSleep'"}),'null');`, 'observe');
        if (observed) {
          task.pid = observed.pid;
          if (holder) { assert.notEqual(task.pid, holder.pid);proofs.push({ case: task.name, ...observed }); }
          return;
        }
        if (task.done?.error) throw task.done.error;
        assert.equal(task.done, undefined, 'Native task finished before its blocker was observed');
        await delay(40);
      }
      throw new Error('Shared prepared blocker not observed: ' + task.name);
    };
    const release = async task => {
      if (task.done) return;
      assert.ok(task.pid, 'Refusing to cancel an unobserved backend');
      assert.equal(await one(`select coalesce((select to_jsonb(pg_cancel_backend(pid)) from pg_stat_activity
        where pid=${task.pid} and application_name=${literal(task.name)} and wait_event='PgSleep'),'false');`, 'release'), true);
    };
    const finish = async task => { const done = await task.promise;if (done.error) throw done.error;return done.rows.at(-1); };
    const race = async (name, first, second) => {
      const holder = launch(name + '_holder', { ...first, hold: true });await observe(holder);
      const waiter = launch(name + '_waiter', second);await observe(waiter, holder);
      await release(holder);return [await finish(holder), await finish(waiter)];
    };
    const erased = source => `do $erase$ begin perform private.erase_shared_prepared_evidence_v1('OUTCOME_CAPTURE',${literal(source)});
      end;$erase$;select jsonb_build_object('erased',true);`;
    try {
      assert.equal(await one("select to_jsonb(count(*)) from pg_stat_activity where application_name like 'kajo_shared_prepared_%';", 'reserved-backends'), 0);
      const beforeAnswer = randomUUID();
      const [forecast, answer] = await race('consumer_before_answer',
        { expression: consume(beforeAnswer, f.raceInputs[0]) },
        { expression: roundCommand(f, literal(f.raceRounds[0]), 'SET_RESPONSE', 1, { rating: 0 }) });
      assert.equal(forecast.input.targetRevision, 1);assert.equal(answer.round.revision, 2);
      assert.deepEqual(await call(beforeAnswer, f.raceInputs[0]), forecast);
      const afterAnswer = randomUUID();
      const [, refused] = await race('answer_before_consumer',
        { expression: roundCommand(f, literal(f.raceRounds[1]), 'SET_RESPONSE', 1, { rating: null }) },
        { expression: consume(afterAnswer, f.raceInputs[1]), reject: '40001' });
      assert.deepEqual(refused, { sqlstate: '40001' });
      const corrected = randomUUID();
      await race('correction_before_consumer',
        { expression: roundCommand(f, `(select round_id from private.shared_round_outcome_captures where id=${literal(f.low)})`,
          'SET_RESPONSE', 3, { rating: 10 }) },
        { expression: consume(corrected, f.consensus), reject: '40001' });
      const withdrawn = randomUUID();
      await race('withdrawal_before_consumer', { statement: erased(f.originalSource) },
        { expression: consume(withdrawn, f.mixed), reject: '42501' });
      const beforeWithdrawal = randomUUID();
      await race('consumer_before_withdrawal', { expression: consume(beforeWithdrawal, f.flat) },
        { statement: erased(f.flatSource) });
      const retry = randomUUID();
      const [original, repeated] = await race('same_request_retry',
        { expression: consume(retry, f.raceInputs[2]) }, { expression: consume(retry, f.raceInputs[2]) });
      assert.deepEqual(repeated, original);
      const changedEnrollment = randomUUID();
      await race('enrollment_before_consumer', { statement: `do $membership$ begin
        perform 1 from public.profiles where id=${literal(f.pair)} for update;
        delete from public.profile_members where profile_id=${literal(f.pair)} and user_id=${literal(f.partner)};
        insert into public.profile_members(profile_id,user_id) values(${literal(f.pair)},${literal(f.partner)});
        end;$membership$;select true;` },
      { expression: consume(changedEnrollment, f.raceInputs[3]), reject: '42501' });
      const absence = await one(`select jsonb_build_object('rejectedRuns',(select count(*) from private.prediction_runs where id=any(
        array[${[afterAnswer, corrected, withdrawn, beforeWithdrawal, changedEnrollment].map(literal).join(',')}]::uuid[])),
        'retainedRuns',(select count(*) from private.prediction_runs where id in(${literal(beforeAnswer)},${literal(retry)})),
        'withdrawnBinding',exists(select 1 from private.shared_round_prediction_consumptions where prediction_id=${literal(beforeWithdrawal)}));`, 'race-closure');
      assert.deepEqual(absence, { rejectedRuns: 0, retainedRuns: 2, withdrawnBinding: false });
      assert.equal(proofs.length, 7);
      return { status: 'PASS', source: 'NATIVE_POSTGRESQL_INDEPENDENT_CONNECTIONS', independentLockProofs: proofs,
        neverAnsweredBoundary: 'BOTH_ORDERS', sourceCorrection: 'STALE_INPUT_REJECTED', withdrawal: 'BOTH_ORDERS',
        enrollment: 'REJOIN_GENERATION_REJECTED', retry: 'EXACTLY_ONCE', orphanForecasts: 0,
        cleanup: 'CANONICAL_ROWS_RESTORED' };
    } finally {
      for (const task of running) if (!task.done) {
        if (task.pid) await release(task);await task.promise;
      }
    }
  });
}
