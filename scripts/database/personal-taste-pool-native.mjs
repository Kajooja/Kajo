import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const owner = 'ab157000-0000-4000-8000-000000000001';
const legacyOwner = 'ab157000-0000-4000-8000-000000000002';
const lateItem = 'ab157000-0000-4000-8000-000000000999';
const policy = 'CANONICAL_FORECAST_POOL_V4';
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

// Rehearse the additive forward against a genuinely populated predecessor,
// before the CLI harness resets to the complete current migration chain.
export async function verifyPersonalTastePoolUpgrade(execConcurrentSql, migration) {
  const exec = (sql, stage) => execConcurrentSql(sql, { stage: `taste-pool-upgrade-${stage}`, timeoutMs: 30_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  let fixture = false, snapshots, original;
  try {
    assert.match(migration.name, /_versioned_taste_candidate_pools\.sql$/);
    assert.deepEqual(await one(`select jsonb_build_object('users',(select count(*) from auth.users where id::text like 'ab157000-%'),
      'items',(select count(*) from public.items where id::text like 'ab157000-%'),
      'newTable',to_regclass('private.sequential_taste_candidate_pools_v4'));`, 'predecessor'), { users: 0, items: 0, newTable: null });
    const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth');`, 'tables');
    snapshots = `select jsonb_object_agg(name,value) from (${tables.map(name => `select '${name}' name,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value
      from ${name} r`).join(' union all ')}) s;`;
    original = await one(snapshots, 'original');
    fixture = true;
    await exec(`begin;${await personalTasteSessionFixtureSql()}commit;`, 'fixture');
    const profileId = await one(`select to_jsonb(id) from public.profiles where owner_user_id='${owner}' and profile_type='PERSONAL';`, 'profile');
    const call = request => one(`begin;set local request.jwt.claim.sub='${owner}';set local role authenticated;
      select public.taste_session_v2(${literal(request)});commit;`, 'command');
    const started = await call({ operation: 'START', profileId, requestId: randomUUID() });
    const next = { operation: 'NEXT', profileId, sessionId: started.sessionId, expectedRevision: started.revision, requestId: randomUUID() };
    const question = await call(next);
    assert.equal(question.status, 'QUESTION');
    const answer = { operation: 'ANSWER', profileId, sessionId: started.sessionId, expectedRevision: question.revision,
      requestId: randomUUID(), questionId: question.questionId, answer: { kind: 'RATING', value: 10 } };
    const accepted = await call(answer);
    assert.equal(await one(`select to_jsonb(policy) from private.sequential_taste_sessions where id='${started.sessionId}';`, 'old-policy'), 'CANONICAL_FORECAST_V3');
    const populated = await one(snapshots, 'populated-before');
    await exec(`begin;${migration.sql}commit;`, 'forward');
    assert.deepEqual(await one(snapshots, 'populated-after'), populated, 'Migration changed retained predecessor rows');
    assert.deepEqual(await call(next), question, 'Populated predecessor lost NEXT reply must remain exact');
    assert.deepEqual(await call(answer), accepted, 'Populated predecessor lost ANSWER reply must remain exact');
    assert.equal(await one(`select to_jsonb(policy) from private.sequential_taste_sessions where id='${started.sessionId}';`, 'retained-policy'), 'CANONICAL_FORECAST_V3');
    assert.equal(await one(`select to_jsonb(count(*)) from private.sequential_taste_candidate_pools_v4;`, 'no-retroactive-pools'), 0);
    return { status: 'PASS', populatedPredecessor: 'ALL_CANONICAL_ROWS_UNCHANGED',
      firstMeasurement: 'RETAINED', exactLostReplies: 'NEXT_AND_ANSWER', policy: 'V3_RETAINED' };
  } finally {
    if (fixture) {
      await exec(`begin;delete from auth.users where id::text like 'ab157000-%';
        delete from private.item_sources where item_id::text like 'ab157000-%';
        delete from public.items where id::text like 'ab157000-%';commit;`, 'cleanup');
      assert.deepEqual(await one(snapshots, 'original-after'), original);
    }
  }
}

// Run only on the disposable CLI CI stack. Each call gets a real separately
// committed PostgreSQL transaction; never wrap this verifier in one transaction.
export async function verifyPersonalTastePools(execConcurrentSql) {
  const exec = (sql, stage) => execConcurrentSql(sql, { stage: `taste-pool-${stage}`, timeoutMs: 30_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  const call = (request, actor = owner) => one(`begin;
    set local request.jwt.claim.sub='${actor}'; set local role authenticated;
    select public.taste_session_v2(${literal(request)}); commit;`, 'committed-command');
  const command = (s, operation, extra = {}) => ({ operation, profileId: s.profileId,
    sessionId: s.sessionId, requestId: randomUUID(), expectedRevision: s.revision, ...extra });
  const session = s => one(`select to_jsonb(s) from private.sequential_taste_sessions s
    where id='${s.sessionId}';`, 'session');
  const pools = s => one(`select coalesce(jsonb_agg(to_jsonb(p) order by p.panel_id),'[]')
    from private.sequential_taste_candidate_pools_v4 p where session_id='${s.sessionId}';`, 'pools');
  let fixture = false, before, snapshots;
  try {
    assert.deepEqual(await one(`select jsonb_build_object(
      'users',(select count(*) from auth.users where id::text like 'ab157000-%'),
      'items',(select count(*) from public.items where id::text like 'ab157000-%'));`, 'reserved-scope'), { users: 0, items: 0 });
    const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and n.nspname in('public','private','auth');`, 'canonical-tables');
    snapshots = `select jsonb_object_agg(name,value) from (${tables.map(name => `select '${name}' name,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value
      from ${name} r`).join(' union all ')}) s;`;
    before = await one(snapshots, 'canonical-before');
    assert.deepEqual(await one(`select jsonb_build_object('rls',c.relrowsecurity,
      'anon',has_table_privilege('anon',c.oid,'SELECT'),
      'authenticated',has_table_privilege('authenticated',c.oid,'SELECT'),
      'service',has_table_privilege('service_role',c.oid,'SELECT'))
      from pg_class c where c.oid='private.sequential_taste_candidate_pools_v4'::regclass;`, 'closed-storage'),
    { rls: true, anon: false, authenticated: false, service: false });
    fixture = true;
    await exec(`begin;${await personalTasteSessionFixtureSql()}commit;`, 'fixture');
    const profile = actor => one(`select to_jsonb(id) from public.profiles
      where owner_user_id='${actor}' and profile_type='PERSONAL';`, 'profile');
    const current = await call({ operation: 'START', profileId: await profile(owner), requestId: randomUUID() });
    assert.equal((await session(current)).policy, policy);
    const initialCatalog = (await session(current)).catalog;
    const offer = command(current, 'NEXT');
    const question = await call(offer);
    assert.equal(question.status, 'QUESTION');
    const frozenPools = await pools(question);
    assert.equal(frozenPools.length, 1);
    assert.ok(frozenPools[0].catalog.length > 0 && frozenPools[0].catalog.length <= 50);
    assert.ok(!frozenPools[0].catalog.some(item => item.id === lateItem));

    // Construct a retained V3 control using its original server default, inside
    // one transaction that restores V4 before commit. No existing session policy
    // is rewritten; its later public commands exercise the legacy dispatch.
    const defaultBefore = await one(`select to_jsonb(column_default) from information_schema.columns
      where table_schema='private' and table_name='sequential_taste_sessions' and column_name='policy';`, 'default');
    assert.equal(defaultBefore, `'${policy}'::text`);
    const legacy = await one(`begin;
      alter table private.sequential_taste_sessions alter column policy set default 'CANONICAL_FORECAST_V3';
      set local request.jwt.claim.sub='${legacyOwner}'; set local role authenticated;
      select public.taste_session_v2(${literal({ operation: 'START', profileId: await profile(legacyOwner), requestId: randomUUID() })});
      reset role; alter table private.sequential_taste_sessions alter column policy set default '${policy}'; commit;`, 'legacy-start');
    const legacyQuestion = await call(command(legacy, 'NEXT'), legacyOwner);
    const legacyCatalog = (await session(legacyQuestion)).catalog;
    assert.equal((await session(legacyQuestion)).policy, 'CANONICAL_FORECAST_V3');
    assert.deepEqual(await pools(legacyQuestion), []);

    await exec(`begin;
      insert into public.items(id,item_type,title,tags,metadata) values('${lateItem}','MOVIE','Later Taste candidate',
        array['shared-feature'], '{"coldStartRecognition":1,"coldStartPriorSource":"KAJO_CURATED_RECOGNITION"}');
      insert into private.item_sources(item_id,provider_key,provider_item_id) values('${lateItem}','kajo_curated','${lateItem}');
      commit;`, 'later-catalog');
    assert.deepEqual(await call(offer), question, 'A lost NEXT reply never refreshes its retained pool');
    assert.deepEqual(await pools(question), frozenPools);
    const answer = command(question, 'ANSWER', { questionId: question.questionId, answer: { kind: 'RATING', value: 10 } });
    const accepted = await call(answer);
    const refreshedOffer = command(accepted, 'NEXT');
    const refreshed = await call(refreshedOffer);
    assert.equal(refreshed.status, 'QUESTION');
    const refreshedState = await session(refreshed), freshPools = await pools(refreshed);
    const freshPoolId = refreshedState.presentations.at(-1).poolId;
    const fresh = freshPools.find(pool => pool.panel_id === freshPoolId);
    assert.ok(fresh, 'Question must bind the exact newly committed candidate pool');
    assert.ok(fresh.catalog.some(item => item.id === lateItem), 'Fresh NEXT admits an eligible Item absent at START');
    assert.ok(!fresh.catalog.some(item => item.id === question.currentItem.id), 'Already asked Items cannot re-enter a fresh pool');
    assert.deepEqual(freshPools.find(pool => pool.panel_id === frozenPools[0].panel_id), frozenPools[0]);
    assert.deepEqual(refreshedState.catalog, initialCatalog, 'The original session catalog stays immutable');
    const legacyAccepted = await call(command(legacyQuestion, 'ANSWER', {
      questionId: legacyQuestion.questionId, answer: { kind: 'RATING', value: 10 } }), legacyOwner);
    const legacyNext = await call(command(legacyAccepted, 'NEXT'), legacyOwner);
    assert.equal(legacyNext.status, 'QUESTION');
    assert.deepEqual((await session(legacyNext)).catalog, legacyCatalog);
    assert.deepEqual(await pools(legacyNext), [], 'V3 sessions do not acquire V4 pools');

    await exec(`begin;update public.items set title=title||' edited'
      where id::text like 'ab157000-%';commit;`, 'catalog-edit');
    assert.deepEqual(await call(refreshedOffer), refreshed, 'Catalog edits cannot change an exact cached NEXT reply');
    assert.deepEqual(await pools(refreshed), freshPools);
    const secondAccepted = await call(command(refreshed, 'ANSWER', {
      questionId: refreshed.questionId, answer: { kind: 'RATING', value: 5 } }));
    const changed = fresh.catalog.find(item => item.id !== refreshed.currentItem.id && item.id !== lateItem);
    assert.ok(changed);
    await exec(`begin;update public.items set tags=array['changed-native-pool-feature'] where id='${changed.id}';commit;`, 'old-pool-tag-change');
    const third = await call(command(secondAccepted, 'NEXT'));
    assert.equal(third.status, 'QUESTION', 'A changed nonselected old candidate cannot stop a fresh V4 NEXT');
    const thirdState = await session(third), thirdPools = await pools(third);
    const thirdPool = thirdPools.find(pool => pool.panel_id === thirdState.presentations.at(-1).poolId);
    assert.deepEqual(thirdPool.catalog.find(item => item.id === changed.id)?.rawTags, ['changed-native-pool-feature']);
    for (const old of freshPools) assert.deepEqual(thirdPools.find(pool => pool.panel_id === old.panel_id), old);

    // A rejected stale answer must commit no evidence or receipt. Recovery is a
    // separate authenticated transaction and may change only status and reason.
    await exec(`begin;update public.items set tags=tags||array['withdrawn-native-pool-feature']
      where id='${third.currentItem.id}';commit;`, 'current-pool-tag-change');
    const beforeRejected = await one(snapshots, 'before-stale-answer');
    const staleAnswer = command(third, 'ANSWER', {
      questionId: third.questionId, answer: { kind: 'RATING', value: 10 } });
    assert.deepEqual(await one(`begin;set local request.jwt.claim.sub='${owner}';set local role authenticated;
      do $reject$ declare code text;message text;begin
        begin perform public.taste_session_v2(${literal(staleAnswer)});
        exception when sqlstate 'KJ002' then code:=sqlstate;message:=sqlerrm;end;
        if code is distinct from 'KJ002' or message not like '%SOURCE_WITHDRAWN%' then
          raise exception 'Expected stale Taste source rejection';end if;
      end;$reject$;
      select jsonb_build_object('sqlstate','KJ002');commit;`, 'stale-answer-rejected'), { sqlstate: 'KJ002' });
    assert.deepEqual(await one(snapshots, 'after-stale-answer'), beforeRejected,
      'A rejected stale answer must leave every canonical row unchanged');
    const expectedStopped = { ...beforeRejected,
      'private.sequential_taste_sessions': await one(`select to_jsonb(encode(sha256(convert_to(
        coalesce(jsonb_agg(value order by value::text),'[]')::text,'UTF8')),'hex')) from (
        select case when r.id='${third.sessionId}' then to_jsonb(r)||
          '{"status":"STOPPED","stop_reason":"CATALOG_CHANGED_INSUFFICIENT"}'::jsonb
          else to_jsonb(r) end value from private.sequential_taste_sessions r) s;`, 'expected-stopped-digest') };
    const resume = { operation: 'RESUME', profileId: third.profileId, sessionId: third.sessionId };
    const stopped = await call(resume);
    assert.equal(stopped.status, 'STOPPED');
    assert.equal(stopped.stopReason, 'CATALOG_CHANGED_INSUFFICIENT');
    assert.equal(stopped.questionId, null);
    assert.equal(stopped.currentItem, null);
    assert.equal(stopped.contextualSkip, null);
    assert.equal(stopped.revision, third.revision);
    assert.equal(stopped.acceptedAt, third.acceptedAt);
    assert.deepEqual(await session(stopped), { ...thirdState, status: 'STOPPED', stop_reason: 'CATALOG_CHANGED_INSUFFICIENT' });
    assert.deepEqual(await pools(stopped), thirdPools);
    assert.deepEqual(await call(resume), stopped, 'Recovery remains stopped across separately committed reloads');
    assert.deepEqual(await one(snapshots, 'after-stopped-recovery'), expectedStopped,
      'Recovery changes only session status/reason, preserving all questions, panels, evidence and receipts');

    const removed = await one(`begin;set local request.jwt.claim.sub='${owner}';set local role authenticated;
      select public.remove_profile_import_job_v1('${refreshedState.source_job_id}'::uuid);commit;`, 'source-removal');
    assert.equal(removed.status, 'REMOVED');
    assert.equal((await call(answer)).status, 'REMOVED', 'Erased sources cannot return an old private answer receipt');
    assert.deepEqual(await pools(refreshed), [], 'Source erasure removes all linked candidate pools');
    assert.equal(await one(`select to_jsonb(column_default) from information_schema.columns where table_schema='private'
      and table_name='sequential_taste_sessions' and column_name='policy';`, 'default-after'), defaultBefore);
    return { status: 'PASS', policy, transactions: 'SEPARATE_COMMITTED_RPC',
      lateCandidate: 'ADMITTED_AFTER_START', originalCatalogAndPools: 'IMMUTABLE',
      exactRetry: 'RETAINS_QUESTION_POOL', retainedV3: 'FIXED_CATALOG',
      staleSourceRecovery: 'KJ002_NO_WRITES_THEN_DURABLE_STOP', sourceErasure: 'NO_POOL_OR_REPLY_RESURRECTION' };
  } finally {
    if (fixture) {
      await exec(`begin;delete from auth.users where id::text like 'ab157000-%';
        delete from private.item_sources where item_id::text like 'ab157000-%';
        delete from public.items where id::text like 'ab157000-%';commit;`, 'cleanup');
      assert.deepEqual(await one(snapshots, 'canonical-after'), before, 'Native pool fixture changed retained canonical rows');
    }
  }
}
