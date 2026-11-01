import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withPersonalContentRatingFixture } from './personal-content-rating.mjs';
import { literal, json, inspect } from './personal-rating-prospective.mjs';

// Native one-shot executors use stricter diagnostic labels than PostgreSQL
// application_name or persistent-session stages. Keep SQL identities intact.
export const executePersonalContentRatingProbe = (execSql, sql, stage) =>
  execSql(sql, { stage: stage.replaceAll('_', '-'), timeoutMs: 45_000 });

/** These Items are created after source-page capture and never discoverable.
 * Provider-row removal alone cannot free a delivered Item's retained FK refs. */
export async function withPersonalContentRatingDeletionItems(execSql, run) {
  const ids = [randomUUID(), randomUUID()];
  const exec = (sql, stage) => executePersonalContentRatingProbe(execSql, sql, stage);
  await exec(`begin;insert into public.items(id,item_type,title,tags,discoverable) values
    ${ids.map(id => `(${literal(id)},'MOVIE','Synthetic content deletion proof','{}',false)`).join(',')};commit;`,
  'content-item-deletion-setup');
  try { return await run(ids); }
  finally {
    await exec(`begin;delete from public.items where id in(${ids.map(literal).join(',')});commit;`,
      'content-item-deletion-cleanup');
  }
}

/** Native PostgreSQL only. Each witness identifies two different backends and
 * the actual conflicting relation lock; computation remains inside the capture
 * transaction. Timing alone is never accepted as a serialization proof. */
export async function verifyPersonalContentRatingConcurrency(execSql, withSqlSession) {
  return withPersonalContentRatingFixture(execSql, withSqlSession, async ({ f, one, call,
    contentSources, captureContent, freshSource }) => {
    const proofs = [], contention = [], pending = [];
    const source = contentSources.find(row => row.itemId === f.items[0]);
    const aliasSource = contentSources.find(row => row.itemId === f.items[1]);
    const lateAlias = contentSources.find(row => row.itemId === f.targets[12]);
    assert.ok(source && aliasSource && lateAlias);
    const run = (sql, stage) => executePersonalContentRatingProbe(execSql, sql, stage);
    const track = promise => {
      const task = promise.then(value => ({ value }), error => ({ error }));
      pending.push(task);return task;
    };
    const result = async task => { const outcome = await task;if (outcome.error) throw outcome.error;return outcome.value; };
    const observe = async (name, blocker, relation, mode, capture = false) => {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        const witness = await one(`do $refresh$ begin perform pg_stat_clear_snapshot();end;$refresh$;
          select coalesce((select jsonb_build_object('pid',a.pid,'blocker',${blocker},
            'blockers',pg_blocking_pids(a.pid),'waitType',a.wait_event_type,'waitEvent',a.wait_event,
            'relation',${literal(relation)},'mode',${literal(mode)}) from pg_stat_activity a
            where a.state='active' and a.wait_event_type='Lock' and ${blocker}=any(pg_blocking_pids(a.pid))
            and ${capture ? "a.query like '%prepare_personal_rating_forecast_v2%'" : `a.application_name=${literal(name)}`}
            and exists(select 1 from pg_locks l where l.pid=a.pid and l.locktype='relation'
              and l.relation=${literal(relation)}::regclass and l.mode=${literal(mode)} and not l.granted)), 'null');`,
        'content-lock-observe');
        if (witness) {
          assert.notEqual(witness.pid, blocker);proofs.push({ name, ...witness });return witness;
        }
        await delay(40);
      }
      throw new Error(`Content capture lock not observed: ${name}/${relation}/${mode}`);
    };
    const backend = async (session, name) => {
      await session(`set local application_name=${literal(name)};`, { stage: 'content-session-name' });
      return (await session('select to_jsonb(pg_backend_pid());', { stage: 'content-session-pid' }))[0];
    };
    const object = (captured, item = source.itemId) => {
      const input = captured.preparation.input;
      for (const row of input.contentFeatures.objects) {
        assert.ok(BigInt(row.availableAtMicros) <= BigInt(input.cutoffMicros), 'No future feature input');
        if (row.provenance) {
          assert.ok(BigInt(row.provenance.rowUpdatedAtMicros) <= BigInt(input.cutoffMicros));
          assert.ok(BigInt(row.provenance.syncedAtMicros) <= BigInt(input.cutoffMicros));
        }
      }
      const row = input.contentFeatures.objects.find(entry => entry.objectId === item);
      assert.ok(row, 'Training and candidate feature union must be complete');return row;
    };
    const subjects = (captured, expected) => {
      const row = object(captured);assert.equal(row.status, 'AVAILABLE');
      assert.deepEqual(row.provenance.featurePayload, { subject: expected });
      return row;
    };
    const payload = subject => ({ ...source.payload, subject });
    const rawSource = subjects => `update private.item_sources set source_payload=${json(payload(subjects))},
      synced_at=clock_timestamp() where id=${literal(source.id)};`;
    const upsert = (subjects, entry = source) => `select to_jsonb(public.upsert_catalog_item_v1(
      provider_key=>${literal(entry.providerKey)},provider_item_id=>${literal(entry.providerItemId)},
      item_type=>'BOOK',title=>'Numeric prospective 0',tags=>array['future-catalogue-tags'],
      metadata=>'{}'::jsonb,external_ids=>${json({ [entry.namespace]: entry.providerItemId })},
      source_payload=>${json({ ...entry.payload, subject: subjects })},discoverable=>false));`;
    const captureFirst = async (name, target, sql, relation, role = 'service_role') => {
      let writer;
      const captured = await captureContent(target, {}, {
        beforeFinalize: async ({ exec: session }) => {
          const pid = await backend(session, 'kajo_content_capture');
          writer = track(run(`begin;set local application_name=${literal(name)};set local role ${role};${sql}commit;`, name));
          await observe(name, pid, relation, 'RowExclusiveLock');
        },
      });
      await result(writer);return captured;
    };
    const writerFirst = async (name, target, initialSql, finalSql, relation, role = 'service_role') => {
      const sourceId = await freshSource(), id = randomUUID();let capturePid;
      await withSqlSession(async writer => {
        await writer('begin;', { stage: name + '-begin' });
        try {
          const pid = await backend(writer, name);
          await writer(`set local role ${role};`, { stage: name + '-writer-role' });
          await writer(initialSql, { stage: name + '-initial-mutation' });
          const heldLock = await one(`select coalesce((select jsonb_build_object('pid',pid,
            'relation',${literal(relation)},'mode',mode,'granted',granted) from pg_locks
            where pid=${pid} and locktype='relation' and relation=${literal(relation)}::regclass
              and mode='RowExclusiveLock' and granted),'null');`, 'content-writer-held-lock');
          assert.ok(heldLock, 'Writer must own the actual conflicting catalogue relation lock');
          const attempt = await track(captureContent(target, { id, source: sourceId }, {
            beforePrepare: async ({ exec: session }) => {
              capturePid = await backend(session, 'kajo_content_contended_capture');
              // A blocking implementation fails with 57014, never a counterfeit
              // NOWAIT success caused by a session lock_timeout setting.
              await session("set local lock_timeout=0;set local statement_timeout='8s';", { stage: 'content-nowait-bound' });
            },
          }));
          assert.ok(attempt.error, 'A pre-existing catalogue writer must reject the capture atomically');
          assert.match(String(attempt.error.code ?? '') + ' ' + attempt.error.message, /55P03/,
            'Catalogue contention must fail with lock_not_available, never wait into a lock-order cycle');
          assert.notEqual(capturePid, pid);
          assert.equal(await one(`select to_jsonb(count(*)) from private.personal_rating_allocations where id=${literal(id)};`,
            'content-contended-no-allocation'), 0, 'Failed capture must retain no partial allocation or input');
          contention.push({ name, writerPid: pid, capturePid, heldLock, sqlstate: '55P03', retainedAllocations: 0,
            retry: 'EXPLICIT_AFTER_WRITER_COMMIT' });
          // Complete the existing writer while the failed capture owns no locks.
          // The same request retries only after this transaction commits.
          if (finalSql) await writer(finalSql, { stage: name + '-complete-mutation' });
          await writer('commit;', { stage: name + '-commit' });
        } catch (error) {
          await writer('rollback;', { stage: name + '-rollback' }).catch(() => {});throw error;
        }
      });
      return captureContent(target, { id, source: sourceId });
    };
    try {
      assert.equal(await one("select to_jsonb(count(*)) from pg_stat_activity where application_name like 'kajo_content_%';",
        'content-reserved-backends'), 0);
      await run(`begin;set local role service_role;delete from private.item_external_ids
        where namespace=${literal(lateAlias.namespace)} and external_id=${literal(lateAlias.providerItemId)};commit;`,
      'content-absent-canonical-alias');

      const first = await captureFirst('kajo_content_upsert_waiter', f.targets[0], upsert(['horror']), 'public.items');
      subjects(first, ['Fantasy']);
      assert.deepEqual((await captureContent(f.targets[0], { id: first.preparation.forecastId })).stored, first.stored,
        'Later catalogue metadata must not reconstruct or contaminate an existing snapshot');
      const afterUpsert = await captureContent(f.targets[1]);subjects(afterUpsert, ['horror']);

      const writer = await writerFirst('kajo_content_upsert_holder', f.targets[2],
        `update public.items set title='Uncommitted catalogue header' where id=${literal(source.itemId)};`,
        upsert(['romance']), 'public.items');
      subjects(writer, ['romance']);
      assert.equal(await one(`select to_jsonb(title) from public.items where id=${literal(source.itemId)};`,
        'content-complete-upsert'), 'Numeric prospective 0');

      const rawAfter = await captureFirst('kajo_content_source_waiter', f.targets[3], rawSource(['mystery']), 'private.item_sources');
      subjects(rawAfter, ['romance']);
      assert.deepEqual((await call(inspect(rawAfter.preparation.forecastId))).preparation, rawAfter.stored,
        'Ordinary source metadata mutation preserves the complete frozen preparation');
      const rawBefore = await writerFirst('kajo_content_source_holder', f.targets[4], rawSource(['thriller']), '', 'private.item_sources');
      subjects(rawBefore, ['thriller']);

      // The existing batch uses repeated actual catalogue upserts in one
      // transaction. Holding a first Item/source write cannot deadlock a second
      // upsert of an Item the contended capture would otherwise row-lock.
      const batch = await writerFirst('kajo_content_batch_holder', f.targets[15],
        upsert(['Horror'], aliasSource), upsert(['thriller']), 'public.items');
      subjects(batch, ['thriller']);

      // An absent alias row has no row lock to acquire. This INSERT therefore
      // proves that the catalogue fence also excludes late phantom aliases.
      const insertion = await captureFirst('kajo_content_alias_insert_waiter', f.targets[5],
        `insert into private.item_external_ids(namespace,external_id,item_id,first_seen_provider)
          values(${literal(lateAlias.namespace)},${literal(lateAlias.providerItemId)},${literal(lateAlias.itemId)},
            ${literal(lateAlias.providerKey)});`, 'private.item_external_ids');
      subjects(insertion, ['thriller']);
      assert.equal(object(insertion, lateAlias.itemId).status, 'UNAVAILABLE', 'Late canonical alias cannot contaminate capture');
      assert.deepEqual((await captureContent(f.targets[5], { id: insertion.preparation.forecastId })).stored, insertion.stored);
      const aliasBefore = await writerFirst('kajo_content_alias_holder', f.targets[6],
        `update private.item_external_ids set last_seen_at=clock_timestamp() where namespace=${literal(source.namespace)}
          and external_id=${literal(source.providerItemId)};`, '', 'private.item_external_ids');
      subjects(aliasBefore, ['thriller']);
      assert.equal(object(aliasBefore, lateAlias.itemId).status, 'AVAILABLE', 'Committed canonical alias can support later captures');

      const erased = await captureFirst('kajo_content_source_eraser', f.targets[7],
        `delete from private.item_sources where id=${literal(source.id)};`, 'private.item_sources');
      subjects(erased, ['thriller']);
      assert.equal((await call(inspect(erased.preparation.forecastId))).status, 'WITHDRAWN');
      assert.equal(await one(`select to_jsonb(count(*)) from private.personal_rating_inputs
        where id=${literal(erased.preparation.forecastId)};`, 'content-erased-input'), 0);
      assert.equal(await one(`select to_jsonb(count(*)) from private.personal_rating_content_source_refs
        where forecast_id=${literal(erased.preparation.forecastId)};`, 'content-erased-references'), 0);

      const reassigned = await captureFirst('kajo_content_alias_reassignment', f.targets[8],
        `update private.item_external_ids set item_id=${literal(f.items[2])}
          where namespace=${literal(aliasSource.namespace)} and external_id=${literal(aliasSource.providerItemId)};`,
        'private.item_external_ids');
      assert.equal(object(reassigned, aliasSource.itemId).status, 'AVAILABLE');
      assert.equal((await call(inspect(reassigned.preparation.forecastId))).status, 'WITHDRAWN');
      const unavailable = await captureContent(f.targets[9]);
      assert.equal(object(unavailable).status, 'UNAVAILABLE');
      assert.equal(object(unavailable, aliasSource.itemId).status, 'UNAVAILABLE');
      assert.equal(object(unavailable).provenance, null);
      assert.equal(object(unavailable, aliasSource.itemId).provenance, null);

      // Item DELETE takes its relation write lock before its lifecycle trigger.
      // Reproduce that exact dangerous interval, then execute a real deletion.
      // Fresh non-discoverable MOVIE Items have no retained source-page FKs.
      await withPersonalContentRatingDeletionItems(execSql, async erasedItems => {
        const beforeDelete = await writerFirst('kajo_content_item_delete_holder', f.targets[16],
          'lock table public.items in row exclusive mode;',
          `delete from public.items where id=${literal(erasedItems[0])};`, 'public.items', 'postgres');
        assert.equal(object(beforeDelete).status, 'UNAVAILABLE');
        const afterDelete = await captureFirst('kajo_content_item_delete_waiter', f.targets[17],
          `delete from public.items where id=${literal(erasedItems[1])};`, 'public.items', 'postgres');
        assert.equal(object(afterDelete).status, 'UNAVAILABLE');
        assert.equal(await one(`select to_jsonb(count(*)) from public.items where id in(${erasedItems.map(literal).join(',')});`,
          'content-item-deletions-complete'), 0);
      });

      assert.equal(proofs.length, 6);assert.equal(contention.length, 5);
      return { status: 'PASS', version: 'native-personal-content-rating-concurrency-v1',
        source: 'NATIVE_POSTGRESQL_INDEPENDENT_CONNECTIONS', independentLockProofs: proofs,
        independentContentionProofs: contention, catalogueWriterRole: 'service_role', itemEraserRole: 'postgres',
        actualComputation: 'COMPILED_TYPESCRIPT_INSIDE_HELD_NATIVE_TRANSACTION',
        catalogueUpsert: 'CAPTURE_FIRST_BLOCKS_WRITER_WRITER_FIRST_55P03_EXPLICIT_RETRY',
        multiItemBatch: 'TWO_ACTUAL_UPSERTS_IN_ONE_TRANSACTION_NO_PARTIAL_CAPTURE',
        itemDeletion: 'BOTH_ORDERS_NO_LIFECYCLE_LOCK_CYCLE', rawSourceWriter: 'BOTH_ORDERS',
        rawAliasWriter: 'INSERT_AND_UPDATE_BOTH_ORDERS', snapshot: 'FROZEN_BEFORE_FUTURE_METADATA_AND_LATE_ALIAS',
        sourceErasure: 'WAITS_FOR_CAPTURE_COMMIT_THEN_REMOVES_COPY', aliasReassignment: 'REMOVES_COPY',
        qualityAdmission: 'NONE', servingActivation: 'NONE', cleanup: 'CANONICAL_ROWS_RESTORED' };
    } finally {
      await Promise.allSettled(pending);
    }
  });
}
