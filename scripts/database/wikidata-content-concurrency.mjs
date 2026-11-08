import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { withWikidataContentFixture } from './wikidata-content-verification.mjs';
import { captureWikidataContentNumericForecast } from './wikidata-content-capture.mjs';
import { literal, inspect } from './personal-rating-prospective.mjs';

/** Independent native backends only. Observe actual conflicting relation locks;
 * elapsed time alone is not a serialization witness. Every writer is joined. */
export async function verifyWikidataContentConcurrency(exec, withSession) {
  return withWikidataContentFixture(exec, withSession, async ({ one, call, request, questions }) => {
    const proofs = [], writes = [];
    const run = (sql, stage) => exec(sql, { stage: 'wikidata-content-' + stage, timeoutMs: 30_000 });
    const mutation = `update private.item_sources set synced_at=clock_timestamp()
      where provider_key='wikidata' and item_id=${literal(questions[0].itemId)};`;
    const relations = ['public.items', 'private.item_sources', 'private.item_external_ids'];
    try {
      for (const [index, relation] of relations.entries()) {
        const name = 'kajo_wikidata_content_' + index;
        let writer;
        const selected = await request();
        const captured = await captureWikidataContentNumericForecast(withSession, selected, {
          beforeFinalize: async ({ exec: connection }) => {
            const [pid] = await connection('select to_jsonb(pg_backend_pid());', { stage: 'wikidata-content-capture-pid' });
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
          await connection('begin;', { stage: 'wikidata-content-writer-begin' });
          try {
            await connection(`lock table ${relation} in row exclusive mode;`, { stage: 'wikidata-content-writer-lock' });
            const [writerPid] = await connection('select to_jsonb(pg_backend_pid());', { stage: 'wikidata-content-writer-pid' });
            let capturePid;
            await assert.rejects(captureWikidataContentNumericForecast(withSession, pending, {
              beforePrepare: async ({ exec: capture }) => {
                [capturePid] = await capture('select to_jsonb(pg_backend_pid());', { stage: 'wikidata-content-contended-pid' });
                await capture("set local lock_timeout=0;set local statement_timeout='8s';", { stage: 'wikidata-content-contention-bound' });
              },
            }), error => /55P03/.test(String(error.code ?? '') + ' ' + error.message));
            assert.notEqual(writerPid, capturePid);
            assert.equal(await one(`select count(*)::integer from private.personal_rating_allocations where id=${literal(pending.id)};`,
              'owned-no-partial-allocation'), 0);
            proofs.push({ writer: writerPid, capture: capturePid, relation, order: 'WRITER_LOCK_FIRST', sqlstate: '55P03' });
            await connection(mutation + 'commit;', { stage: 'wikidata-content-writer-commit' });
          } catch (error) { await connection('rollback;', { stage: 'wikidata-content-writer-rollback' }).catch(() => {});throw error; }
        });
        const retry = await captureWikidataContentNumericForecast(withSession, pending);
        assert.equal(retry.forecast.prefix.support, 2);
        await run('begin;' + mutation + 'commit;', 'retire-retry');
      }
      return { status: 'PASS', proofs, count: proofs.length, captureFailure: 'ATOMIC_NO_ALLOCATION',
        retry: 'EXPLICIT_AFTER_WRITER_COMMIT', qualityAdmission: 'NONE', servingActivation: 'NONE' };
    } finally {
      const results = await Promise.all(writes);
      const failures = results.filter(row => row.error).map(row => row.error);
      if (failures.length) throw new AggregateError(failures, 'Wikidata source writer failure retained');
    }
  });
}
