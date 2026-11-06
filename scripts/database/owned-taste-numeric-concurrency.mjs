import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { withOwnedTasteNumericFixture } from './owned-taste-numeric-verification.mjs';
import { captureOwnedTasteNumericForecast } from './owned-taste-numeric-capture.mjs';
import { literal, inspect } from './personal-rating-prospective.mjs';

/** Independent native backends only. Observe actual conflicting relation locks;
 * elapsed time alone is not a serialization witness. Every writer is joined. */
export async function verifyOwnedTasteNumericConcurrency(exec, withSession) {
  return withOwnedTasteNumericFixture(exec, withSession, async ({ one, call, request, questions, f }) => {
    const proofs = [], writes = [];
    const run = (sql, stage) => exec(sql, { stage: 'owned-taste-' + stage, timeoutMs: 30_000 });
    const mutation = `update private.profile_bootstrap_evidence set source_metadata=source_metadata||
      jsonb_build_object('syntheticMutation',gen_random_uuid()) where profile_id=${literal(f.profile)}
      and item_id=${literal(questions[0].itemId)};`;
    const relations = ['private.profile_bootstrap_evidence', 'private.profile_import_jobs', 'private.sequential_taste_sessions',
      'private.sequential_taste_commands', 'private.sequential_taste_panels'];
    try {
      for (const [index, relation] of relations.entries()) {
        const name = 'kajo_owned_taste_' + index;
        let writer;
        const selected = await request();
        const captured = await captureOwnedTasteNumericForecast(withSession, selected, {
          beforeFinalize: async ({ exec: connection }) => {
            const [pid] = await connection('select to_jsonb(pg_backend_pid());', { stage: 'owned-taste-capture-pid' });
            writer = run(`begin;set local application_name=${literal(name)};lock table ${relation} in row exclusive mode;
              ${mutation}commit;`, 'writer-' + index).then(value => ({ value }), error => ({ error }));
            writes.push(writer);
            const deadline = Date.now() + 8000;let witness;
            do {
              witness = await one(`do $$begin perform pg_stat_clear_snapshot();end;$$;
                select coalesce((select jsonb_build_object('writer',a.pid,'capture',${pid},'relation',${literal(relation)})
                  from pg_stat_activity a where a.application_name=${literal(name)} and a.state='active'
                    and ${pid}=any(pg_blocking_pids(a.pid)) and exists(select 1 from pg_locks l
                      where l.pid=a.pid and l.relation=${literal(relation)}::regclass and l.mode='RowExclusiveLock' and not l.granted)), 'null');`,
              'owned-lock-witness');
              if (!witness) await delay(40);
            } while (!witness && Date.now() < deadline);
            assert.ok(witness, 'Actual source writer must block behind held capture fence');
            assert.notEqual(witness.writer, pid);proofs.push({ ...witness, order: 'CAPTURE_FIRST' });
          },
        });
        const done = await writer;if (done.error) throw done.error;
        assert.equal(captured.forecast.prefix.support, 2);
        assert.equal((await call(inspect(selected.id))).status, 'WITHDRAWN');

        const pending = await request();
        await withSession(async connection => {
          await connection('begin;', { stage: 'owned-taste-writer-begin' });
          try {
            await connection(`lock table ${relation} in row exclusive mode;`, { stage: 'owned-taste-writer-lock' });
            const [writerPid] = await connection('select to_jsonb(pg_backend_pid());', { stage: 'owned-taste-writer-pid' });
            let capturePid;
            await assert.rejects(captureOwnedTasteNumericForecast(withSession, pending, {
              beforePrepare: async ({ exec: capture }) => {
                [capturePid] = await capture('select to_jsonb(pg_backend_pid());', { stage: 'owned-taste-contended-pid' });
                await capture("set local lock_timeout=0;set local statement_timeout='8s';", { stage: 'owned-taste-contention-bound' });
              },
            }), error => /55P03/.test(String(error.code ?? '') + ' ' + error.message));
            assert.notEqual(writerPid, capturePid);
            assert.equal(await one(`select count(*)::integer from private.personal_rating_allocations where id=${literal(pending.id)};`,
              'owned-no-partial-allocation'), 0);
            proofs.push({ writer: writerPid, capture: capturePid, relation, order: 'WRITER_LOCK_FIRST', sqlstate: '55P03' });
            await connection(mutation + 'commit;', { stage: 'owned-taste-writer-commit' });
          } catch (error) { await connection('rollback;', { stage: 'owned-taste-writer-rollback' }).catch(() => {});throw error; }
        });
        const retry = await captureOwnedTasteNumericForecast(withSession, pending);
        assert.equal(retry.forecast.prefix.support, 2);
        await run('begin;' + mutation + 'commit;', 'retire-retry');
      }
      return { status: 'PASS', proofs, count: proofs.length, captureFailure: 'ATOMIC_NO_ALLOCATION',
        retry: 'EXPLICIT_AFTER_WRITER_COMMIT', qualityAdmission: 'NONE', servingActivation: 'NONE' };
    } finally {
      const results = await Promise.all(writes);
      const failures = results.filter(row => row.error).map(row => row.error);
      if (failures.length) throw new AggregateError(failures, 'Owned Taste source writer failure retained');
    }
  });
}
