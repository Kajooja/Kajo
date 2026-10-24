import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const owner = 'ab157000-0000-4000-8000-000000000001';
const other = 'ab157000-0000-4000-8000-000000000002';
const id = n => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const policy = 'CANONICAL_FORECAST_POOL_V4';
const table = 'private.sequential_taste_candidate_pools_v4';

test('versioned native Taste pools refresh after committed choices and preserve old evidence', async t => {
  const db = new PGlite();
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await query(sql, args))[0];
  const rpc = async (request, actor = owner, name = 'taste_session_v2') => {
    await db.exec('begin;');
    try {
      await query("select set_config('request.jwt.claim.sub',$1,true)", [actor ?? '']);
      await db.exec('set local role authenticated;');
      const result = (await one(`select public.${name}($1) value`, [request])).value;
      await db.exec('commit;'); return result;
    } catch (error) { await db.exec('rollback;'); throw error; }
  };
  const command = (s, operation, extra = {}) => ({ operation, profileId: s.profileId,
    sessionId: s.sessionId, requestId: randomUUID(), expectedRevision: s.revision, ...extra });
  const start = async actor => rpc({ operation: 'START', requestId: randomUUID(), profileId: (await one(
    "select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).id }, actor);
  const next = (s, actor) => rpc(command(s, 'NEXT'), actor);
  const answer = (s, actor, value = 10) => rpc(command(s, 'ANSWER', {
    questionId: s.questionId, answer: { kind: 'RATING', value },
  }), actor);
  const resume = (s, actor) => rpc({ operation: 'RESUME', profileId: s.profileId, sessionId: s.sessionId }, actor);
  const session = s => one('select * from private.sequential_taste_sessions where id=$1', [s.sessionId]);
  const pools = s => query(`select * from ${table} where session_id=$1 order by panel_id`, [s.sessionId]);
  const freshActor = async n => {
    const actor = id(n);
    await query(`insert into auth.users(id,email,raw_user_meta_data) values($1,$2,
      jsonb_build_object('kajo_nickname',$3::text))`, [actor, `pool-${n}@example.invalid`, `Pool owner ${n}`]);
    return actor;
  };
  const addItem = async (n, type = 'MOVIE', recognition = 1, tags = ['pool-warm', 'shared-feature']) => {
    await query(`insert into public.items(id,item_type,title,tags,metadata) values($1,$2,$3,$4,
      jsonb_build_object('coldStartRecognition',$5::double precision,'coldStartPriorSource','KAJO_CURATED_RECOGNITION'))`,
    [id(n), type, `Pool fixture ${n}`, tags, recognition]);
    await query("insert into private.item_sources(item_id,provider_key,provider_item_id) values($1,'kajo_curated',$2)", [id(n), id(n)]);
  };
  const snapshotTables = async () => {
    const tables = await query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
      and n.nspname in('auth','public','private') order by 1`);
    return Promise.all(tables.map(async ({ name }) => [name,
      await query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)]));
  };
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_versioned_taste_candidate_pools.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_taste_contextual_skip.sql')), 'Expected an additive pool successor');
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    await db.exec(await personalTasteSessionFixtureSql());

    const oldStart = await start(owner), oldNextRequest = command(oldStart, 'NEXT');
    const oldQuestion = await rpc(oldNextRequest);
    const oldAnswerRequest = command(oldQuestion, 'ANSWER', { questionId: oldQuestion.questionId, answer: { kind: 'RATING', value: 10 } });
    const oldAccepted = await rpc(oldAnswerRequest);
    const oldOther = await next(await start(other), other);
    const oldPaused = await rpc(command(oldOther, 'PAUSE'), other);
    const oldSession = await session(oldAccepted), pausedSession = await session(oldPaused);
    const beforeRows = await snapshotTables();
    const beforeFunctions = await query(`select p.oid,p.oid::regprocedure::text signature,to_jsonb(p) value
      from pg_proc p where p.pronamespace in('public'::regnamespace,'private'::regnamespace) and p.prokind='f' order by p.oid`);

    await t.test('unreviewed source or security metadata rejects the entire additive upgrade', async () => {
      const source = await one("select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid='private.taste_session_v2(jsonb)'::regprocedure");
      for (const mutation of [source.definition.replace(source.prosrc, () => source.prosrc + '\n-- unknown source'),
        'grant execute on function private.taste_session_v2(jsonb) to anon;',
        "alter function private.taste_session_v2(jsonb) set search_path='public';",
        'alter function private.taste_session_v2(jsonb) security invoker;']) {
        await db.exec('begin;' + mutation);
        await assert.rejects(db.exec(files[index].sql), /drift|security|source/i);
        await db.exec('rollback;');
        assert.equal((await one('select to_regclass($1) value', [table])).value, null);
      }
      assert.deepEqual(await snapshotTables(), beforeRows);
    });

    await t.test('populated V3 sessions, immutable measurements and exact replies survive migration unchanged', async () => {
      await db.exec(`begin;${files[index].sql}commit;`);
      for (const [name, rows] of beforeRows) assert.deepEqual(
        await query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`), rows, name);
      for (const previous of beforeFunctions) {
        const actual = (await one('select to_jsonb(p) value from pg_proc p where oid=$1', [previous.oid])).value;
        const expected = structuredClone(previous.value);
        // Body replacement is deliberate; function identity, grants, owner and
        // execution configuration may not change with that replacement.
        delete actual.prosrc; delete expected.prosrc;
        assert.deepEqual(actual, expected, previous.signature);
      }
      assert.equal((await session(oldAccepted)).policy, 'CANONICAL_FORECAST_V3');
      assert.deepEqual(await rpc(oldNextRequest), oldQuestion);
      assert.deepEqual(await rpc(oldAnswerRequest), oldAccepted);
      assert.deepEqual(await resume(oldPaused, other), oldPaused);
      assert.deepEqual(await session(oldAccepted), oldSession);
      assert.deepEqual(await session(oldPaused), pausedSession);
      const continued = await rpc(command(oldPaused, 'CONTINUE'), other);
      assert.equal(continued.questionId, oldOther.questionId);
      const advanced = await next(oldAccepted, owner);
      assert.equal(advanced.status, 'QUESTION');
      assert.deepEqual((await session(advanced)).catalog, oldSession.catalog);
      assert.deepEqual(await pools(advanced), []);
      assert.deepEqual(await pools(continued), []);
    });
    for (const file of files.slice(index + 1)) await db.exec(`begin;${file.sql}commit;`);

    await t.test('pool storage and helpers are private while the existing owner-only wire route is retained', async () => {
      assert.equal((await one('select relrowsecurity value from pg_class where oid=$1::regclass', [table])).value, true);
      const newFunctions = await query(`select oid,oid::regprocedure::text signature from pg_proc
        where pronamespace='private'::regnamespace and oid<>all($1::oid[])`, [beforeFunctions.map(f => f.oid)]);
      assert.ok(newFunctions.length > 0);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal((await one('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') allowed', [role, table])).allowed, false);
        for (const fn of newFunctions) assert.equal((await one('select has_function_privilege($1,$2,\'EXECUTE\') allowed', [role, fn.oid])).allowed, false, `${role}: ${fn.signature}`);
      }
      assert.equal((await one("select has_function_privilege('authenticated','public.taste_session_v2(jsonb)','EXECUTE') allowed")).allowed, true);
      assert.equal((await one("select has_function_privilege('anon','public.taste_session_v2(jsonb)','EXECUTE') allowed")).allowed, false);
    });

    // More real-provider-shaped Items than the retained 25/domain budget. This
    // distinguishes actual refill from merely recapturing the old START list.
    for (let n = 0; n < 70; n++) await addItem(1000 + n, n < 35 ? 'MOVIE' : 'BOOK', .9 - (n % 35) * .005,
      [`pool-${n % 4}`, 'shared-feature']);
    await t.test('fresh NEXT admits later eligible Items and excludes asked Items without rewriting prior pools', async () => {
      const actor = await freshActor(10);
      const initial = await start(actor), initialSession = await session(initial);
      assert.equal(initialSession.policy, policy);
      const firstRequest = command(initial, 'NEXT'), first = await rpc(firstRequest, actor);
      assert.equal(first.status, 'QUESTION');
      const originalPool = (await pools(first))[0];
      const originalPanel = await one('select * from private.sequential_taste_panels where id=$1', [originalPool.panel_id]);
      assert.equal(originalPool.catalog.length, 50);
      for (const type of ['MOVIE', 'BOOK']) assert.equal(originalPool.catalog.filter(c => c.itemType === type).length, 25);
      assert.ok(originalPool.catalog.some(c => c.id === first.currentItem.id));
      await addItem(2000);
      assert.deepEqual(await rpc(firstRequest, actor), first, 'New catalog contents cannot rewrite a lost NEXT acknowledgement');
      assert.deepEqual((await pools(first))[0], originalPool);
      const accepted = await answer(first, actor);
      const secondRequest = command(accepted, 'NEXT'), second = await rpc(secondRequest, actor);
      assert.equal(second.status, 'QUESTION');
      const state = await session(second), freshPoolId = state.presentations.at(-1).poolId;
      const fresh = (await pools(second)).find(p => p.panel_id === freshPoolId);
      assert.ok(fresh.catalog.some(c => c.id === id(2000)), 'A later Item absent from START must enter the refreshed pool');
      assert.deepEqual(fresh.catalog.find(c => c.id === id(2000)).tags, ['pool-warm', 'shared-feature'],
        'The next pool must retain actual newly available features, not reuse the START dictionary');
      const freshPanel = await one('select * from private.sequential_taste_panels where id=$1', [freshPoolId]);
      assert.equal(freshPanel.frozen.featurePolicyVersion, 'taste-tags-frequency-64-pool-v4');
      assert.equal(new Date(freshPanel.frozen.candidateCatalogAsOf).getTime(), fresh.catalog_as_of.getTime());
      assert.equal(freshPanel.captured_at.getTime(), fresh.catalog_as_of.getTime());
      assert.deepEqual(freshPanel.frozen.items.map(c => c.itemId).sort(), fresh.catalog.map(c => c.id).sort());
      assert.ok(!fresh.catalog.some(c => c.id === first.currentItem.id));
      assert.deepEqual(state.catalog, initialSession.catalog, 'Do not mutate the immutable START catalog');
      assert.deepEqual((await pools(second)).find(p => p.panel_id === originalPool.panel_id), originalPool);
      assert.deepEqual(await one('select * from private.sequential_taste_panels where id=$1', [originalPool.panel_id]), originalPanel);
      assert.deepEqual(await rpc(secondRequest, actor), second);
      await assert.rejects(query(`update ${table} set catalog=catalog||'[{"id":"invented"}]'::jsonb where panel_id=$1`, [freshPoolId]), /immutable|pool|check/i);
      await assert.rejects(rpc({ operation: 'RESUME', profileId: second.profileId, sessionId: second.sessionId }, other), /owner|access/i);
      // The old command belongs to the old pool, even after a newer pool exists.
      await query("update public.items set tags=array['later-mutated'] where id=$1", [id(2000)]);
      assert.deepEqual(await rpc(firstRequest, actor), first, 'An old NEXT retry must not validate against the newer pool');
      await query("update public.items set tags=array['pool-warm','shared-feature'] where id=$1", [id(2000)]);
      const nextAccepted = await answer(second, actor, 0);
      const changed = fresh.catalog.find(c => c.id !== second.currentItem.id && c.id !== first.currentItem.id);
      await query('update public.items set discoverable=false where id=$1', [changed.id]);
      const third = await next(nextAccepted, actor);
      assert.equal(third.status, 'QUESTION', 'An answered prior pool cannot freeze future candidate eligibility');
      const thirdPoolId = (await session(third)).presentations.at(-1).poolId;
      const thirdPool = (await pools(third)).find(p => p.panel_id === thirdPoolId);
      assert.ok(!thirdPool.catalog.some(c => c.id === changed.id));
      await query('update public.items set discoverable=true where id=$1', [changed.id]);
    });

    await t.test('retained inactive labels are excluded before the recognition source limit', async () => {
      const actor = await freshActor(13), initial = await start(actor);
      const job = (await one(`insert into private.profile_import_jobs(actor_user_id,profile_id,source_provider,
        dataset_kind,file_fingerprint,status,committed_at) values($1,$2,'KAJO_CSV','TEST_POOL',md5('pool-labels'),
        'COMMITTED',now()) returning id`, [actor, initial.profileId])).id;
      const known = [];
      for (let n = 4000; n < 4130; n++) { await addItem(n); known.push(id(n)); }
      await query(`insert into private.profile_bootstrap_evidence(actor_user_id,profile_id,item_id,item_type,
        source_provider,dataset_kind,source_job_id,source_row_key,evidence_kind,rating,active)
        select $1,$2,id,item_type,'KAJO_CSV','TEST_POOL',$3,id::text,'RATED',7,false
        from public.items where id=any($4::uuid[])`, [actor, initial.profileId, job, known]);
      const question = await next(initial, actor), pool = (await pools(question))[0];
      assert.equal(question.status, 'QUESTION');
      assert.equal(pool.catalog.filter(c => c.itemType === 'MOVIE').length, 25,
        'More than 128 high-recognition retained labels cannot starve eligible later candidates');
      assert.ok(!pool.catalog.some(c => known.includes(c.id)), 'Inactive labels remain known, never unseen holdouts');
      await query('update public.items set discoverable=false where id=any($1::uuid[])', [known]);
    });

    await t.test('neutral skip retries remain bound to their original question pool after refresh', async () => {
      const actor = await freshActor(12), first = await next(await start(actor), actor);
      const skip = { version: 'kajo-contextual-skip-v1', kind: 'CONTEXTUAL_SKIP', actionId: randomUUID(),
        actorUserId: actor, profileId: first.profileId, itemId: first.currentItem.id,
        occurredAt: String(BigInt(Date.now()) * 1000n), origin: first.contextualSkip.origin,
        contextRef: null, reversesActionId: null };
      const receipt = await rpc(skip, actor, 'commit_taste_contextual_skip_v1');
      await addItem(3000);
      const second = await next(await resume(first, actor), actor);
      const secondPoolId = (await session(second)).presentations.at(-1).poolId;
      const secondPool = (await pools(second)).find(p => p.panel_id === secondPoolId);
      assert.ok(secondPool.catalog.some(c => c.id === id(3000)));
      assert.ok(!secondPool.catalog.some(c => c.id === first.currentItem.id));
      await query("update public.items set tags=array['mutated-new-pool-only'] where id=$1", [id(3000)]);
      assert.deepEqual(await rpc(skip, actor, 'commit_taste_contextual_skip_v1'), receipt,
        'A saved neutral command must use origin.panelId rather than the current pool');
      await query("update public.items set tags=array['pool-warm','shared-feature'] where id=$1", [id(3000)]);
    });

    await t.test('confirmed source rejections reload into a durable stop without rewriting receipts or evidence', async () => {
      const rejected = error => error.code === 'KJ002' && /SOURCE_WITHDRAWN/.test(error.message);
      const assertOnlyStopped = async (before, stopped, original) => {
        assert.equal(stopped.status, 'STOPPED');
        assert.equal(stopped.stopReason, 'CATALOG_CHANGED_INSUFFICIENT');
        assert.equal(stopped.questionId, null);
        assert.equal(stopped.currentItem, null);
        assert.equal(stopped.contextualSkip, null);
        assert.equal(stopped.revision, original.revision);
        assert.equal(stopped.acceptedAt, original.acceptedAt);
        const expected = structuredClone(before);
        const row = expected.find(([name]) => name === 'private.sequential_taste_sessions')[1]
          .find(({ value }) => value.id === original.sessionId).value;
        row.status = 'STOPPED'; row.stop_reason = 'CATALOG_CHANGED_INSUFFICIENT';
        assert.deepEqual(await snapshotTables(), expected,
          'Recovery may change only status/reason; panels, questions, measurements, commands and receipts stay frozen');
      };
      const modes = ['ANSWER', 'CONTINUE', 'START', 'CORRECT', 'START_PAUSED'];
      for (const [index, mode] of modes.entries()) {
        const actor = await freshActor(15 + index), startsExisting = mode.startsWith('START');
        const profileId = (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).id;
        const startRequest = { operation: 'START', profileId, requestId: randomUUID() };
        const initial = await rpc(startRequest, actor), nextRequest = command(initial, 'NEXT');
        const question = await rpc(nextRequest, actor);
        let current = question;
        if (mode === 'CONTINUE' || mode === 'START_PAUSED') current = await rpc(command(question, 'PAUSE'), actor);
        if (mode === 'CORRECT') current = await answer(question, actor);
        const item = await one('select id,tags from public.items where id=$1', [question.currentItem.id]);
        await query('update public.items set tags=$2 where id=$1', [item.id, [...item.tags, 'withdrawn-pool-feature']]);
        try {
          const before = await snapshotTables();
          assert.deepEqual(await rpc(startRequest, actor), initial, 'A cached START without a question keeps its exact receipt');
          if (!startsExisting) {
            const request = mode === 'CONTINUE' ? command(current, 'CONTINUE') : command(current, mode, {
              questionId: question.questionId, answer: { kind: 'RATING', value: mode === 'CORRECT' ? 0 : 10 },
            });
            await assert.rejects(rpc(request, actor), rejected, `${mode} must reject a changed source before any write`);
            assert.deepEqual(await snapshotTables(), before);
          }
          await assert.rejects(rpc(nextRequest, actor), rejected, 'A cached NEXT cannot replay an unavailable question');
          assert.deepEqual(await snapshotTables(), before);
          if (mode === 'CORRECT') continue; // An answered question has no pending presentation to recover.
          const stopped = startsExisting ? await rpc({ ...startRequest, requestId: randomUUID() }, actor)
            : await resume(current, actor);
          await assertOnlyStopped(before, stopped, current);
          assert.deepEqual(await resume(current, actor), stopped, 'The stopped recovery is durable across reloads');
          assert.deepEqual(await rpc(startRequest, actor), initial, 'Recovery cannot rewrite a saved START acknowledgement');
          await assertOnlyStopped(before, stopped, current);
        } finally {
          await query('update public.items set tags=$2 where id=$1', [item.id, item.tags]);
        }
      }
    });

    await t.test('prediction erasure redacts candidate snapshots and defeats exact replay resurrection', async () => {
      const actor = await freshActor(11), initial = await start(actor);
      const request = command(initial, 'NEXT'), question = await rpc(request, actor);
      const before = (await pools(question))[0];
      await query("select private.erase_prediction_sources_v1('PREDICTION_RUN',$1)", [before.panel_id]);
      const retained = (await pools(question)).find(p => p.panel_id === before.panel_id);
      assert.ok(!retained || (retained.invalidated && retained.catalog.length === 0));
      assert.equal((await rpc(request, actor)).status, 'SOURCE_WITHDRAWN');
      const removed = await rpc(command(await resume(question, actor), 'REMOVE'), actor);
      assert.equal(removed.status, 'REMOVED');
      assert.deepEqual(await pools(question), []);
      assert.equal((await rpc(request, actor)).status, 'REMOVED');
    });

    await t.test('an empty START can discover later Items while respecting availability and real-provider boundaries', async () => {
      const live = (await query('select id from public.items where discoverable')).map(row => row.id);
      await query('update public.items set discoverable=false where id=any($1::uuid[])', [live]);
      try {
        const actor = await freshActor(14), initial = await start(actor);
        assert.deepEqual((await session(initial)).catalog, []);
        await addItem(5000);
        await addItem(5001, 'BOOK');
        await addItem(5002);
        await addItem(5003);
        await addItem(5004);
        await addItem(5005, 'MOVIE', 1, ['pool-cool', 'shared-feature']);
        await addItem(5006, 'BOOK', 1, ['pool-cool', 'shared-feature']);
        await query("update public.items set created_at=now()+interval '1 day' where id=$1", [id(5002)]);
        await query("update private.item_sources set created_at=now()+interval '1 day' where item_id=$1", [id(5003)]);
        await query("update private.item_sources set provider_key='kajo_mock' where item_id=$1", [id(5004)]);
        const question = await next(initial, actor);
        assert.equal(question.status, 'QUESTION', 'A fresh informative pool must supersede the empty START snapshot');
        assert.deepEqual((await pools(question))[0].catalog.map(c => c.id).sort(), [id(5000), id(5001), id(5005), id(5006)]);
        assert.deepEqual((await session(question)).catalog, [], 'Original empty snapshot stays immutable after a successful refill');
      } finally {
        await query('update public.items set discoverable=true where id=any($1::uuid[])', [live]);
      }
    });

    await t.test('acquisition optimization preserves complete frozen-reference JSON across skip and provider boundaries', async () => {
      await db.exec('create temp table taste_pool_acquisition_reference_scope(id integer);');
      await db.exec(await readFile(new URL('./personal-taste-pool-acquisition-reference.sql', import.meta.url), 'utf8'));
      const actor = await freshActor(20), initial = await start(actor);
      const live = (await query('select id from public.items where discoverable')).map(row => row.id);
      await query('update public.items set discoverable=false where id=any($1::uuid[])', [live]);
      await query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
      try {
        const otherProfile = (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [other])).id;
        const sharedProfile = (await one("insert into public.profiles(profile_type,name) values('SHARED','Pool parity shared') returning id")).id;
        // Fewer than 25/domain means every eligibility difference appears in
        // the result; the retention boundary cannot hide a bad fast path.
        for (let n = 7000; n <= 7022; n++) await addItem(n, n % 3 ? 'MOVIE' : 'BOOK', .91 - (n - 7000) / 100,
          [`parity-${n % 4}`, 'shared-feature']);
        const cutoff = (await one('select clock_timestamp()::text value')).value;
        const record = async (n, offset, patch = {}) => {
          const actionId = randomUUID();
          await query(`insert into private.contextual_skip_commands(action_id,actor_user_id,profile_id,item_id,
            surface,kind,origin_hash,origin,command,result,accepted_at,reverses_action_id)
            values($1::uuid,$2,$3,$4,'TASTE',$5,($1::uuid)::text,'{}','{}','{}',$6::timestamptz+$7::interval,$8)`,
          [actionId, patch.actor ?? actor, patch.profile ?? initial.profileId, id(n),
            patch.kind ?? 'CONTEXTUAL_SKIP', cutoff, offset, patch.reverses ?? null]);
          if (patch.erased) await query(`update private.contextual_skip_commands set erased_at=$2,item_id=null,
            origin=null,command=null,result=null,reverses_action_id=null where action_id=$1`, [actionId, cutoff]);
          return actionId;
        };
        await record(7001, '-1 hour'); // Active.
        await record(7002, '-25 hours'); // Expired.
        await record(7003, '1 hour'); // Future original.
        const withdrawn = await record(7004, '-1 hour');
        await record(7004, '-30 minutes', { kind: 'WITHDRAW_CONTEXTUAL_SKIP', reverses: withdrawn });
        await record(7005, '-1 hour', { erased: true });
        await record(7006, '-1 hour', { actor: other, profile: otherProfile });
        await record(7007, '-1 hour', { profile: sharedProfile });
        const futureWithdrawal = await record(7008, '-1 hour');
        await record(7008, '1 hour', { kind: 'WITHDRAW_CONTEXTUAL_SKIP', reverses: futureWithdrawal });
        const erasedWithdrawal = await record(7009, '-1 hour');
        await record(7009, '-30 minutes', { kind: 'WITHDRAW_CONTEXTUAL_SKIP', reverses: erasedWithdrawal, erased: true });
        await record(7010, '-2 hours');
        const partiallyWithdrawn = await record(7010, '-1 hour');
        await record(7010, '-30 minutes', { kind: 'WITHDRAW_CONTEXTUAL_SKIP', reverses: partiallyWithdrawn });
        await record(7017, '-24 hours'); // Exactly elapsed cooldown.
        await record(7018, '-24 hours 1 microsecond'); // Still suppressed.
        await record(7019, '-25 hours');
        await record(7019, '1 hour'); // Future newest cannot hide an expired prefix.
        await record(7020, '-1 hour', { kind: 'WITHDRAW_CONTEXTUAL_SKIP', reverses: randomUUID() });
        await record(7022, '0 seconds'); // Exactly-cutoff original is active.

        await query("update public.items set created_at=$2::timestamptz+interval '1 hour' where id=$1", [id(7012), cutoff]);
        await query("update private.item_sources set created_at=$2::timestamptz+interval '1 hour' where item_id=$1", [id(7013), cutoff]);
        await query("update private.item_sources set provider_key='kajo_mock' where item_id=$1", [id(7014)]);
        await query('update private.item_sources set created_at=$2 where item_id=$1', [id(7016), cutoff]);
        for (let n = 0; n < 20; n++) await query(`insert into private.item_sources(item_id,provider_key,provider_item_id,created_at)
          values($1,$2,$3,$4)`, [id(7011), `parity_${String(n).padStart(2, '0')}`, `parity-${n}`, cutoff]);
        await query(`insert into private.item_sources(item_id,provider_key,provider_item_id,created_at) values
          ($1,'kajo_mock','parity-mock',$2),($1,'a_future','parity-future',$2::timestamptz+interval '1 hour'),
          ($1,'a_infinite','parity-infinite','infinity'),($1,'a_negative_infinite','parity-negative-infinite','-infinity')`, [id(7011), cutoff]);

        const compare = async offset => {
          const result = await one(`select private.taste_candidate_catalog_v4($1,$2::timestamptz+$3::interval) actual,
            pg_temp.taste_candidate_catalog_v4_reference($1,$2::timestamptz+$3::interval) expected`,
          [initial.sessionId, cutoff, offset]);
          assert.deepEqual(result.actual, result.expected, `Complete candidate JSON at ${offset}`);
          return result.actual;
        };
        const atCutoff = await compare('0 seconds');
        const excluded = new Set([7001, 7008, 7009, 7010, 7012, 7013, 7014, 7018, 7022]);
        assert.deepEqual(atCutoff.map(c => c.id), Array.from({ length: 23 }, (_, i) => i + 7000)
          .filter(n => !excluded.has(n)).map(id));
        assert.deepEqual(atCutoff.find(c => c.id === id(7011)).providerKeys,
          ['kajo_curated', ...Array.from({ length: 15 }, (_, n) => `parity_${String(n).padStart(2, '0')}`)]);
        for (const offset of ['-1 microsecond', '1 microsecond', '1 hour', '24 hours', '25 hours']) await compare(offset);
      } finally {
        await query("select set_config('request.jwt.claim.sub','',false)");
        await query('update public.items set discoverable=true where id=any($1::uuid[])', [live]);
      }
    });
  } finally { await db.close(); }
});
