import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const actor = 'ab157000-0000-4000-8000-000000000001';
const other = 'ab157000-0000-4000-8000-000000000002';
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${literal(JSON.stringify(value))}::jsonb`;
const command = (s, operation, extra = {}) => ({ operation, profileId: s.profileId, sessionId: s.sessionId,
  requestId: randomUUID(), expectedRevision: s.revision, ...extra });
const rpc = request => `public.taste_session_v2(${json(request)})`;
const auth = `set local request.jwt.claim.sub='${actor}';`;

// One disposable fixture is shared by local preservation/admission checks and
// real PostgreSQL connections. Never run these mutating probes on hosted data.
async function withFixture(execSql, run) {
  const exec = (sql, stage) => execSql(sql, { stage: 'native-v4-receipt-' + stage.replaceAll('_', '-'), timeoutMs: 120_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in('public','private','auth');`, 'canonical-tables');
  const snapshotSql = 'begin read only;set local extra_float_digits=3;select jsonb_object_agg(name,value) from ('
    + tables.map(name => `select ${literal(name)} name,encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value from ${name} r`)
      .join(' union all ') + ') s;rollback;';
  const snapshot = () => one(snapshotSql, 'canonical-snapshot');
  const original = await snapshot();
  let fixture = false, failure;
  try {
    assert.deepEqual(await one(`select jsonb_build_object('users',(select count(*) from auth.users where id::text like 'ab157000-%'),
      'items',(select count(*) from public.items where id::text like 'ab157000-%'));`, 'reserved-scope'), { users: 0, items: 0 });
    fixture = true;
    await exec('begin;' + await personalTasteSessionFixtureSql() + 'commit;', 'fixture');
    const profile = await one(`select to_jsonb(id) from public.profiles where owner_user_id='${actor}' and profile_type='PERSONAL';`, 'profile');
    const call = request => one(`begin;set local extra_float_digits=3;${auth}set local role authenticated;select ${rpc(request)};commit;`, 'command');
    const start = () => call({ operation: 'START', profileId: profile, requestId: randomUUID() });
    const session = s => one(`begin read only;set local extra_float_digits=3;select to_jsonb(s) from private.sequential_taste_sessions s
      where id=${literal(s.sessionId)};rollback;`, 'session');
    const source = s => one(`begin read only;set local extra_float_digits=3;select jsonb_build_object('run',to_jsonb(r),'panel',to_jsonb(p),
      'pool',(select to_jsonb(pool) from private.sequential_taste_candidate_pools_v4 pool where pool.panel_id=p.id),
      'candidates',(select jsonb_agg(to_jsonb(c) order by c.item_id) from private.prediction_candidates c where c.prediction_id=r.id))
      from private.sequential_taste_panels p join private.prediction_runs r on r.id=p.prediction_id
      where p.id=(select (q->>'poolId')::uuid from private.sequential_taste_sessions s
        cross join lateral jsonb_array_elements(s.presentations) q where s.id=${literal(s.sessionId)} and q->>'id'=${literal(s.questionId)});rollback;`, 'source');
    return await run({ exec, one, snapshot, profile, call, start, session, source });
  } catch (error) { failure = error; throw error; }
  finally {
    if (fixture) {
      try {
        await exec(`begin;do $erase$ declare a uuid;begin for a in select id from public.users where id::text like 'ab157000-%' loop
          perform private.erase_prediction_sources_v1('ACTOR',a);end loop;end;$erase$;
          delete from auth.users where id::text like 'ab157000-%';
          delete from private.item_sources where item_id::text like 'ab157000-%';
          delete from public.items where id::text like 'ab157000-%';commit;`, 'cleanup');
        assert.deepEqual(await snapshot(), original, 'V4 receipt fixture changed canonical rows');
      } catch (error) { throw new AggregateError(failure ? [failure, error] : [error], 'V4 receipt proof and cleanup failures retained'); }
    }
  }
}

export async function verifyNativeV4ReceiptUpgrade(execSql, migration) {
  return withFixture(execSql, async ({ exec, one, snapshot, call, start, source }) => {
    const s = await start(), next = command(s, 'NEXT'), question = await call(next), retained = await source(question);
    assert.equal(retained.run.state_snapshot.nativeV4Receipt, undefined);
    const before = await snapshot();
    const inventorySql = `select jsonb_build_object('functions',(select jsonb_agg(jsonb_build_object(
      'oid',p.oid,'signature',p.oid::regprocedure::text,'body',p.prosrc,'metadata',to_jsonb(p)-'prosrc') order by p.oid)
      from pg_proc p where p.pronamespace in('public'::regnamespace,'private'::regnamespace) and p.prokind='f'),
      'defaults',(select jsonb_agg(to_jsonb(d) order by d.oid) from pg_default_acl d));`;
    const old = await one(inventorySql, 'before-functions');
    await exec('begin;' + migration.sql + 'commit;', 'apply-forward');
    assert.deepEqual(await snapshot(), before, 'Receipt forward rewrote existing rows');
    const after = await one(inventorySql, 'after-functions');
    assert.deepEqual(after.defaults, old.defaults);
    const changed = ['private.taste_session_v2(', 'private.rank_items_request_with_identity_v1(',
      'private.native_final_run_input_v1(', 'private.validate_native_final_source_v1('];
    const beforeIds = new Set(old.functions.map(f => f.oid));
    assert.equal(after.functions.length, old.functions.length + 2);
    let rewritten = 0;
    for (const f of old.functions) {
      const current = after.functions.find(x => x.oid === f.oid);
      assert.ok(current); assert.deepEqual(current.metadata, f.metadata);
      if (changed.some(prefix => f.signature.startsWith(prefix))) { assert.notEqual(current.body, f.body); rewritten++; }
      else assert.equal(current.body, f.body);
    }
    assert.equal(rewritten, 4);
    assert.deepEqual(after.functions.filter(f => !beforeIds.has(f.oid)).map(f => f.metadata.proname).sort(),
      ['capture_native_v4_receipt_v1', 'validate_native_v4_receipt_v1']);
    assert.deepEqual(await source(question), retained);
    assert.deepEqual(await call(next), question, 'Old NEXT retry changed at the forward');
    assert.deepEqual(await one(`select jsonb_build_object('final',private.validate_native_final_source_v1('${retained.run.id}'),
      'receipt',private.validate_native_v4_receipt_v1(to_jsonb(r))) from private.prediction_runs r where id='${retained.run.id}';`,
    'historical-admission'), { final: true, receipt: false });
    const answered = await call(command(question, 'ANSWER', { questionId: question.questionId, answer: { kind: 'RATING', value: 0 } }));
    const fresh = await source(await call(command(answered, 'NEXT')));
    assert.equal(fresh.run.state_snapshot.nativeV4Receipt.receiptRevision, answered.revision);
    assert.deepEqual(await source(question), retained, 'New marked source changed its unmarked predecessor');
    return { status: 'PASS', existingFunctionsPreserved: old.functions.length, rewrittenBodies: rewritten,
      newPrivateOwners: 2, rowsAndDefaults: 'UNCHANGED', oldRetry: 'EXACT', historicalReplay: 'UNMARKED_PRESERVED',
      freshReceipt: 'BOUND_TO_ACKNOWLEDGED_REVISION', cleanup: 'CANONICAL_ROWS_RESTORED' };
  });
}

export async function verifyNativeV4Receipt(execSql) {
  return withFixture(execSql, async ({ exec, one, call, start, session, source }) => {
    const s = await start(), next = command(s, 'NEXT'), q = await call(next), retained = await source(q);
    const r = retained.run, receipt = r.state_snapshot.nativeV4Receipt;
    assert.equal(receipt.receiptRevision, s.revision);
    assert.equal(receipt.sessionId, s.sessionId);
    assert.equal(receipt.forecastTransaction, retained.panel.captured_transaction);
    assert.deepEqual(r.state_snapshot.finalScoringInput.nativeV4Receipt, receipt);
    assert.deepEqual(await call(next), q);
    const [controls] = await exec(`begin;${auth}
      do $controls$ declare s private.sequential_taste_sessions; valid jsonb; bad jsonb; before_count bigint; rejected integer:=0;
      begin
        perform pg_current_xact_id();select * into s from private.sequential_taste_sessions where id='${s.sessionId}';
        valid:=private.capture_native_v4_receipt_v1(s.id,pg_current_snapshot());
        select count(*) into before_count from private.prediction_runs;
        foreach bad in array array[
          valid-'receiptAt', valid||'{}'::jsonb||jsonb_build_object('future',true),
          jsonb_set(valid,'{version}','"future"'),jsonb_set(valid,'{receiptRevision}','999'),
          jsonb_set(valid,'{profileId}',to_jsonb(gen_random_uuid())),jsonb_set(valid,'{actorUserId}',to_jsonb('${other}'::text)),
          jsonb_set(valid,'{sessionId}',to_jsonb(gen_random_uuid())),jsonb_set(valid,'{receiptTransaction}','"1"'),
          jsonb_set(valid,'{receiptAt}','"2000-01-01T00:00:00Z"'),jsonb_set(valid,'{forecastTransaction}','"1"'),
          jsonb_set(valid,'{forecastAsOf}','"2000-01-01T00:00:00Z"'),jsonb_set(valid,'{entrySnapshot}','"broken"'),
          jsonb_set(valid,'{entrySnapshot}',to_jsonb(s.receipt_transaction||':'||s.receipt_transaction||':'))
        ] loop
          begin
            perform private.capture_personal_evaluation_v1(gen_random_uuid(),s.profile_id,array['ab157000-0000-4000-8000-000000000101'::uuid],
              s.receipt_at,jsonb_build_object('sessionId',s.id,'nativeV4Receipt',bad));
            raise exception 'Bad V4 receipt was accepted';
          exception when invalid_parameter_value or serialization_failure then rejected:=rejected+1;end;
        end loop;
        if (select count(*) from private.prediction_runs)<>before_count then raise exception 'Invalid receipt wrote a forecast';end if;
        perform set_config('kajo.receipt_rejections',rejected::text,true);
      end;$controls$;
      select jsonb_build_object('prewriteRejections',current_setting('kajo.receipt_rejections')::integer,
        'closedAccess',not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          where p.pronamespace='private'::regnamespace and p.proname in('capture_native_v4_receipt_v1','validate_native_v4_receipt_v1')
            and (a.grantor<>p.proowner or a.grantee<>p.proowner)));rollback;`, 'prewrite-controls');
    assert.deepEqual(controls, { prewriteRejections: 13, closedAccess: true });
    // Corruption checks change the FINAL copy too: the independent frozen
    // validator must reject impossible receipt visibility, not just unequal JSON.
    const [frozenControls] = await exec(`begin read only;
      do $frozen$ declare original jsonb; src jsonb; bad jsonb; rejected integer:=0;
      begin
        select to_jsonb(r) into original from private.prediction_runs r where id='${r.id}';
        foreach bad in array array[
          (original#>'{state_snapshot,nativeV4Receipt}')-'receiptAt',
          jsonb_set(original#>'{state_snapshot,nativeV4Receipt}','{version}','"future"'),
          jsonb_set(original#>'{state_snapshot,nativeV4Receipt}','{receiptRevision}','256'),
          jsonb_set(original#>'{state_snapshot,nativeV4Receipt}','{receiptTransaction}',original#>'{state_snapshot,nativeV4Receipt,forecastTransaction}'),
          jsonb_set(original#>'{state_snapshot,nativeV4Receipt}','{entrySnapshot}','"1:1:"'),
          jsonb_set(original#>'{state_snapshot,nativeV4Receipt}','{actorUserId}',to_jsonb('${other}'::text)),
          jsonb_set(original#>'{state_snapshot,nativeV4Receipt}','{receiptAt}','"2000-01-01T00:00:00Z"')
        ] loop
          src:=jsonb_set(jsonb_set(original,'{state_snapshot,nativeV4Receipt}',bad),'{state_snapshot,finalScoringInput,nativeV4Receipt}',bad);
          begin perform private.validate_native_v4_receipt_v1(src);raise exception 'Bad frozen receipt accepted';
          exception when invalid_parameter_value then rejected:=rejected+1;end;
        end loop;
        perform set_config('kajo.frozen_receipt_rejections',rejected::text,true);
      end;$frozen$;
      select jsonb_build_object('frozenRejections',current_setting('kajo.frozen_receipt_rejections')::integer,
        'sourceValid',private.validate_native_final_source_v1('${r.id}'));rollback;`, 'frozen-controls');
    assert.deepEqual(frozenControls, { frozenRejections: 7, sourceValid: true });
    const answer = command(q, 'ANSWER', { questionId: q.questionId, answer: { kind: 'RATING', value: 0 } });
    const accepted = await call(answer), q2 = await call(command(accepted, 'NEXT')), second = await source(q2);
    assert.equal(second.run.state_snapshot.nativeV4Receipt.receiptRevision, accepted.revision);
    assert.deepEqual(await call(answer), accepted);
    const corrected = await call(command(q2, 'CORRECT', { questionId: q.questionId, answer: { kind: 'RATING', value: 10 } }));
    assert.deepEqual(await source(q), retained);
    assert.deepEqual(await source(q2), second, 'Correction rewrote a frozen receipt');
    assert.equal(await one(`select to_jsonb(private.validate_native_final_source_v1('${second.run.id}'));`, 'replay-after-correction'), true);
    const current = await session(corrected);
    assert.notEqual(current.receipt_transaction, second.run.state_snapshot.nativeV4Receipt.receiptTransaction);
    await call(command(corrected, 'CORRECT', { questionId: q.questionId, answer: { kind: 'WITHDRAWN' } }));
    assert.equal(await source(q2), undefined, 'Withdrawn prefix retained a dependent forecast');
    const pool = await one(`select jsonb_build_object('invalidated',invalidated,'empty',catalog='[]'::jsonb)
      from private.sequential_taste_candidate_pools_v4 where panel_id='${second.panel.id}';`, 'withdrawal');
    assert.deepEqual(pool, { invalidated: true, empty: true });
    return { status: 'PASS', receiptBinding: 'native-v4-receipt-v1', ...controls, ...frozenControls,
      retries: 'EXACT', correction: 'FROZEN_SOURCE_PRESERVED', withdrawal: 'DEPENDENT_SOURCE_ERASED',
      historicalReconstruction: 'UNAVAILABLE', cleanup: 'CANONICAL_ROWS_RESTORED' };
  });
}

export async function verifyNativeV4ReceiptConcurrency(execSql) {
  return withFixture(execSql, async ({ exec, one, call, start, source }) => {
    const running = [];
    const launch = (name, request, hold = false, reject = false) => {
      const task = { name }; running.push(task);
      const action = reject ? `do $reject$ declare code text; message text;begin begin perform ${rpc(request)};
        exception when serialization_failure then code:=sqlstate;get stacked diagnostics message=message_text;end;
        if code is distinct from '40001' or message not like '%before command entry%' then
          raise exception 'Expected command-entry visibility rejection, got % / %',code,message;end if;end;$reject$;
        select jsonb_build_object('sqlstate','40001','boundary','COMMAND_ENTRY');` : `select ${rpc(request)};`;
      task.promise = exec(`begin;set local application_name='${name}';${auth}set local role authenticated;
        ${action}${hold ? `do $hold$ begin begin perform pg_sleep(20);exception when query_canceled then null;end;end;$hold$;` : ''}commit;`, name)
        .then(rows => (task.done = { rows }), error => (task.done = { error }));
      return task;
    };
    const observe = async (task, holder = null) => {
      const deadline = Date.now() + 7000;
      while (Date.now() < deadline) {
        const observed = await one(`select coalesce((select jsonb_build_object('pid',pid,'blockers',pg_blocking_pids(pid),
          'xactStart',xact_start,'wait',wait_event_type) from pg_stat_activity where application_name='${task.name}' and state='active'
          ${holder ? `and wait_event_type='Lock' and ${holder.pid}=any(pg_blocking_pids(pid))` : "and wait_event='PgSleep'"}),'null');`, 'observe-lock');
        if (observed) { task.pid = observed.pid; return observed; }
        if (task.done?.error) throw task.done.error;
        assert.equal(task.done, undefined, 'Connection finished before the observed lock'); await delay(40);
      }
      throw new Error('V4 receipt lock not observed: ' + task.name);
    };
    const release = async task => {
      if (!task.pid || task.done) return;
      assert.equal(await one(`select coalesce((select to_jsonb(pg_cancel_backend(pid)) from pg_stat_activity
        where pid=${task.pid} and application_name='${task.name}' and wait_event='PgSleep'),'false');`, 'release-owned-holder'), true);
    };
    const finish = async task => { const r = await task.promise; if (r.error) throw r.error; return r.rows[0]; };
    try {
      assert.equal(await one("select to_jsonb(count(*)) from pg_stat_activity where application_name like 'kajo_v4_receipt_%';", 'reserved-backends'), 0);
      const s = await start(), q = await call(command(s, 'NEXT')), original = await source(q);
      const answer = command(q, 'ANSWER', { questionId: q.questionId, answer: { kind: 'RATING', value: 0 } });
      const holder = launch('kajo_v4_receipt_answer', answer, true); await observe(holder);
      const next = command({ ...q, revision: q.revision + 1 }, 'NEXT');
      const waiter = launch('kajo_v4_receipt_next', next, false, true), wait = await observe(waiter, holder);
      assert.notEqual(holder.pid, waiter.pid); await release(holder);
      const accepted = await finish(holder); assert.deepEqual(await finish(waiter), { sqlstate: '40001', boundary: 'COMMAND_ENTRY' });
      assert.equal(await one(`select to_jsonb(receipt_at<${literal(wait.xactStart)}::timestamptz)
        from private.sequential_taste_sessions where id='${s.sessionId}';`, 'older-receipt-clock'), true);
      assert.equal(await one(`select to_jsonb(count(*)) from private.prediction_runs where profile_id='${s.profileId}';`, 'no-waiter-forecast'), 1);
      assert.deepEqual(await source(q), original);
      const fresh = await call(next), freshSource = await source(fresh);
      assert.equal(freshSource.run.state_snapshot.nativeV4Receipt.receiptRevision, accepted.revision);
      const accepted2 = await call(command(fresh, 'ANSWER', { questionId: fresh.questionId, answer: { kind: 'RATING', value: 5 } }));
      const sameNext = command(accepted2, 'NEXT'), first = launch('kajo_v4_receipt_retry_holder', sameNext, true);
      await observe(first); const duplicate = launch('kajo_v4_receipt_retry_waiter', sameNext), retryWait = await observe(duplicate, first);
      await release(first); const result = await finish(first); assert.deepEqual(await finish(duplicate), result);
      assert.equal(await one(`select to_jsonb(count(*)) from private.prediction_runs where profile_id='${s.profileId}';`, 'one-duplicate-forecast'), 3);
      return { status: 'PASS', source: 'NATIVE_POSTGRESQL_INDEPENDENT_CONNECTIONS',
        lateCommit: 'OLDER_RECEIPT_TIMESTAMP_BUT_NOT_VISIBLE_AT_COMMAND_ENTRY_REJECTED',
        rejection: '40001_WITHOUT_FORECAST', freshRetry: 'ACKNOWLEDGED_RECEIPT_BOUND', duplicateNext: 'EXACTLY_ONCE',
        independentLockProofs: [wait, retryWait], cleanup: 'CANONICAL_ROWS_RESTORED' };
    } finally { for (const task of running) if (!task.done) { await release(task); await task.promise; } }
  });
}
