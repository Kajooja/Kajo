import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withPersonalRatingProspectiveFixture, literal, json, auth, answer, inspect } from './personal-rating-prospective.mjs';

/** Native PostgreSQL only: observed independent-connection blocking proves
 * serialization through the actual JS computation, not an elapsed-time guess. */
export async function verifyPersonalRatingProspectiveConcurrency(execSql, withSqlSession) {
  return withPersonalRatingProspectiveFixture(execSql, withSqlSession, async ({ f, exec, one, call, capture, command, freshSource }) => {
    const proofs = [], running = [], pendingCaptures = [];
    const hold = `do $hold$ begin begin perform pg_sleep(20);exception when query_canceled then null;end;end;$hold$;`;
    const observe = async (name, blocker = null) => {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const state = await one(`do $refresh$ begin perform pg_stat_clear_snapshot();end;$refresh$;
          select coalesce((select jsonb_build_object('pid',pid,'blockers',pg_blocking_pids(pid),
            'waitType',wait_event_type,'waitEvent',wait_event) from pg_stat_activity
            where application_name=${literal(name)} and state='active'
            ${blocker ? `and wait_event_type='Lock' and ${blocker}=any(pg_blocking_pids(pid))` : "and wait_event='PgSleep'"}),'null');`, 'observe-numeric-lock');
        if (state) { if (blocker) { assert.notEqual(state.pid, blocker);proofs.push({ name, ...state }); }return state; }
        await delay(40);
      }
      throw new Error('Numeric prospective lock not observed: ' + name);
    };
    const launch = (name, sql) => {
      const task = { name };
      task.promise = execSql(sql, { stage: name.replaceAll('_', '-'), timeoutMs: 45_000 })
        .then(rows => (task.done = { rows }), error => (task.done = { error }));
      running.push(task);return task;
    };
    const finish = async task => { const result = await task.promise;if (result.error) throw result.error;return result.rows; };
    const release = async task => {
      if (task.done) return;
      assert.ok(task.pid, 'Do not cancel an unobserved SQL backend');
      assert.equal(await one(`select coalesce((select to_jsonb(pg_cancel_backend(pid)) from pg_stat_activity
        where pid=${task.pid} and application_name=${literal(task.name)} and state='active' and wait_event='PgSleep'),'false');`,
      'release-numeric-holder'), true);
    };
    const waitName = async session => {
      await session(`set local application_name='kajo_numeric_capture';`, 'numeric-name');
      return (await session('select to_jsonb(pg_backend_pid());', 'numeric-pid'))[0];
    };
    try {
      assert.equal(await one("select to_jsonb(count(*)) from pg_stat_activity where application_name like 'kajo_numeric_%';",
        'reserved-backends'), 0);
      const forecastId = randomUUID();let waiter;
      const firstSource = await freshSource();
      const firstCommand = await command(f.targets[0], 0, { source: firstSource });
      const first = await capture(f.targets[0], { id: forecastId, source: firstSource }, {
        beforeCommit: async ({ exec: session }) => {
          const pid = await waitName(session);
          waiter = launch('kajo_numeric_answer_waiter', `begin;set local application_name='kajo_numeric_answer_waiter';
            ${auth(f.actor)}select ${answer(forecastId, firstCommand)};commit;`);
          await observe(waiter.name, pid);
        },
      });
      const measured = (await finish(waiter))[0];
      assert.equal(measured.rating, 0);assert.equal(measured.measurement.controlSquaredError, 49);
      assert.deepEqual((await call(inspect(forecastId))).preparation.forecast, first.forecast);

      // A normal app action that commits first makes target capture ineligible.
      const prior = await command(f.targets[1], 4);
      const actionSource = await freshSource();
      const holder = launch('kajo_numeric_action_holder', `begin;set local application_name='kajo_numeric_action_holder';
        ${auth(f.actor)}select public.commit_item_action_v1(${json(prior)});${hold}commit;`);
      holder.pid = (await observe(holder.name)).pid;
      let rejectedCapture;
      const pending = capture(f.targets[1], { source: actionSource }, {
        // The prepare itself waits; its session name must precede preparation.
      }).then(value => ({ value }), error => ({ error }));
      pendingCaptures.push(pending);
      // Capture connections are uniquely identifiable through their owned lock
      // wait even before a SQL application-name marker can be sent after prepare.
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const blocked = await one(`select coalesce((select jsonb_build_object('pid',pid,'blockers',pg_blocking_pids(pid),
          'waitType',wait_event_type,'waitEvent',wait_event) from pg_stat_activity where state='active'
          and wait_event_type='Lock' and ${holder.pid}=any(pg_blocking_pids(pid))
          and query like '%prepare_personal_rating_forecast_v1%'),'null');`, 'prepare-after-action-observe');
        if (blocked) { proofs.push({ name: 'CANONICAL_ANSWER_BEFORE_CAPTURE', ...blocked });rejectedCapture = blocked;break; }
        await delay(40);
      }
      assert.ok(rejectedCapture, 'Capture must wait behind the observed canonical writer');
      await release(holder);await finish(holder);
      assert.match((await pending).error?.message ?? '', /55000/, 'An already answered target must be rejected by its domain guard');

      // A raw writer bypasses the advisory lifecycle lock. The explicit Event
      // relation SHARE fence must still observe its answer before permitting TS.
      const rawSource = await freshSource();
      const raw = launch('kajo_numeric_raw_holder', `begin;set local application_name='kajo_numeric_raw_holder';
        insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at)
        values(${literal(randomUUID())},${literal(f.actor)},${literal(f.profile)},${literal(f.targets[2])},'BOOK',
          'ITEM_RATED','{"rating":10}',clock_timestamp());select to_jsonb(true);${hold}commit;`);
      raw.pid = (await observe(raw.name)).pid;
      const rawPending = capture(f.targets[2], { source: rawSource }).then(value => ({ value }), error => ({ error }));
      pendingCaptures.push(rawPending);
      let rawBlocked;
      const rawDeadline = Date.now() + 8000;
      while (Date.now() < rawDeadline) {
        rawBlocked = await one(`select coalesce((select jsonb_build_object('pid',a.pid,'blockers',pg_blocking_pids(a.pid),
          'waitType',a.wait_event_type,'waitEvent',a.wait_event) from pg_stat_activity a
          where a.state='active' and a.wait_event_type='Lock' and ${raw.pid}=any(pg_blocking_pids(a.pid))
          and exists(select 1 from pg_locks l where l.pid=a.pid and l.locktype='relation'
            and l.relation='public.events'::regclass and l.mode='ShareLock' and not l.granted)),'null');`, 'raw-event-lock-observe');
        if (rawBlocked) break;
        await delay(40);
      }
      assert.ok(rawBlocked, 'Raw Event insert must block the explicit SHARE fence');
      proofs.push({ name: 'RAW_ANSWER_BEFORE_CAPTURE', ...rawBlocked });
      await release(raw);await finish(raw);
      assert.match((await rawPending).error?.message ?? '', /55000/, 'Raw answer before capture must be rejected by its domain guard');

      const retryId = randomUUID();let retry;
      const original = await capture(f.targets[3], { id: retryId }, {
        beforeCommit: async ({ exec: session }) => {
          const pid = await waitName(session);
          retry = capture(f.targets[3], { id: retryId }).then(value => ({ value }), error => ({ error }));
          pendingCaptures.push(retry);
          const deadline = Date.now() + 8000;let blocked;
          while (Date.now() < deadline) {
            blocked = await one(`select coalesce((select jsonb_build_object('pid',pid,'blockers',pg_blocking_pids(pid),
              'waitType',wait_event_type,'waitEvent',wait_event) from pg_stat_activity where state='active'
              and wait_event_type='Lock' and ${pid}=any(pg_blocking_pids(pid))
              and query like '%prepare_personal_rating_forecast_v1%'),'null');`, 'retry-lock-observe');
            if (blocked) break;await delay(40);
          }
          assert.ok(blocked);proofs.push({ name: 'EXACT_RETRY_DURING_CAPTURE', ...blocked });
        },
      });
      const repeated = await retry;if (repeated.error) throw repeated.error;
      assert.deepEqual(repeated.value.stored, original.stored);

      let withdrawal;
      const withdrawn = await capture(f.targets[4], {}, {
        beforeCommit: async ({ exec: session }) => {
          const pid = await waitName(session);
          withdrawal = launch('kajo_numeric_withdraw_waiter', `begin;set local application_name='kajo_numeric_withdraw_waiter';
            delete from public.events where id=${literal(f.evidence[0])};select to_jsonb(true);commit;`);
          await observe(withdrawal.name, pid);
        },
      });
      await finish(withdrawal);
      assert.equal((await call(inspect(withdrawn.preparation.forecastId))).status, 'WITHDRAWN');
      assert.equal(proofs.length, 5);
      return { status: 'PASS', source: 'NATIVE_POSTGRESQL_INDEPENDENT_CONNECTIONS', independentLockProofs: proofs,
        actualComputation: 'COMPILED_TYPESCRIPT_INSIDE_HELD_NATIVE_TRANSACTION', beforeAnswer: 'BOTH_ORDERS',
        rawEventWriter: 'EXPLICIT_SHARE_FENCE', retry: 'EXACTLY_ONCE', withdrawal: 'DEPENDENT_FORECAST_REMOVED',
        qualityAdmission: 'NONE', servingActivation: 'NONE', cleanup: 'CANONICAL_ROWS_RESTORED' };
    } finally {
      for (const task of running) if (!task.done) {
        if (task.pid) await release(task);await task.promise;
      }
      await Promise.allSettled(pendingCaptures);
    }
  });
}
