import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const prefix = 'ab158000-';
const id = n => `${prefix}0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), other = id(2), fresh = id(3);
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const command = (s, operation, extra = {}) => ({ operation, profileId: s.profileId,
  sessionId: s.sessionId, requestId: randomUUID(), expectedRevision: s.revision, ...extra });

// Disposable database only. Every RPC commits independently, including the
// failed ANSWER/retry across a populated migration. No native user data is used.
export async function verifyPersonalTasteRecovery(execConcurrentSql, migration) {
  const exec = (sql, stage) => execConcurrentSql(sql, { stage: `taste-recovery-${stage}`, timeoutMs: 60_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  const rpc = (request, actor = owner) => one(`begin;set local request.jwt.claim.sub='${actor}';
    set local role authenticated;select public.taste_session_v2(${literal(request)});commit;`, 'command');
  const profile = actor => one(`select to_jsonb(id) from public.profiles
    where owner_user_id='${actor}' and profile_type='PERSONAL';`, 'profile');
  const start = async actor => rpc({ operation: 'START', profileId: await profile(actor), requestId: randomUUID() }, actor);
  const resume = (s, actor = owner) => rpc({ operation: 'RESUME', profileId: s.profileId, sessionId: s.sessionId }, actor);
  const session = s => one(`select to_jsonb(s) from private.sequential_taste_sessions s where id='${s.sessionId}';`, 'session');
  const answer = (s, value) => command(s, 'ANSWER', { questionId: s.questionId, answer: { kind: 'RATING', value } });
  let snapshots, before, fixture = false, failure;
  try {
    assert.equal(await one(`select to_jsonb(count(*)) from auth.users where id::text like '${prefix}%';`, 'scope'), 0);
    const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
      and n.nspname in('auth','public','private');`, 'tables');
    snapshots = `select jsonb_object_agg(name,value) from (${tables.map(name => `select '${name}' name,
      md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text) value from ${name} r`).join(' union all ')}) s;`;
    before = await one(snapshots, 'before');
    fixture = true;
    await exec(`begin;
      insert into auth.users(id,email,raw_user_meta_data) values
        ('${owner}','recovery-owner@example.invalid','{"kajo_nickname":"Recovery owner"}'),
        ('${other}','recovery-other@example.invalid','{"kajo_nickname":"Recovery other"}'),
        ('${fresh}','recovery-fresh@example.invalid','{"kajo_nickname":"Recovery fresh"}');
      insert into public.items(id,item_type,title,tags,metadata)
      select ('${prefix}0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
        case when n<160 then 'MOVIE' else 'BOOK' end,'Recovery fixture '||n||repeat(' Ä',80),
        array['feature-'||(n%4)::text,'shared-feature'],
        jsonb_build_object('coldStartRecognition',.95-(n%60)*.001,'coldStartPriorSource','KAJO_CURATED_RECOGNITION')
      from generate_series(100,219) n;
      insert into private.item_sources(item_id,provider_key,provider_item_id)
        select id,'kajo_curated',id::text from public.items where id::text like '${prefix}%';commit;`, 'fixture');

    let failedAt = null, retainedReplies = [], upgradedCount = null;
    if (migration) {
      assert.match(migration.name, /_taste_reply_capacity_and_movie_first\.sql$/);
      // Keep another owner's pending question across the upgrade as well.
      const otherStart = await start(other), otherRequest = command(otherStart, 'NEXT');
      const otherQuestion = await rpc(otherRequest, other);
      retainedReplies.push([otherRequest, otherQuestion, other]);
      let state = await start(owner), failedRequest;
      for (let n = 0; n < 48; n++) {
        const nextRequest = command(state, 'NEXT');
        state = await rpc(nextRequest);
        assert.equal(state.status, 'QUESTION');
        if (n === 0) retainedReplies.push([nextRequest, state, owner]);
        const request = answer(state, n % 11);
        const pendingRows = await one(snapshots, 'before-answer');
        try { state = await rpc(request); }
        catch (error) {
          assert.match(String(error), /sequential_taste_commands_result_check/);
          assert.deepEqual(await one(snapshots, 'failed-answer-rollback'), pendingRows);
          failedAt = n + 1; failedRequest = request; break;
        }
      }
      assert.ok(failedAt > 10 && failedAt < 48, 'Predecessor must reproduce premature receipt overflow');
      const pending = await resume(state), populated = await one(snapshots, 'populated');
      assert.equal(pending.status, 'QUESTION');
      const functionsBefore = await one(`select jsonb_object_agg(oid::regprocedure::text,to_jsonb(p))
        from pg_proc p where pronamespace in('public'::regnamespace,'private'::regnamespace);`, 'functions-before');
      await exec(`begin;${migration.sql}commit;`, 'migration');
      assert.deepEqual(await one(snapshots, 'preserved'), populated, 'Upgrade must leave every retained row intact');
      const functionsAfter = await one(`select jsonb_object_agg(oid::regprocedure::text,to_jsonb(p))
        from pg_proc p where pronamespace in('public'::regnamespace,'private'::regnamespace);`, 'functions-after');
      for (const [name, old] of Object.entries(functionsBefore)) {
        const current = functionsAfter[name];
        assert.ok(current, name);
        if (name === 'private.taste_session_v2(jsonb)') assert.notEqual(current.prosrc, old.prosrc);
        assert.deepEqual({ ...current, prosrc: old.prosrc }, old, `Unexpected function/privilege change: ${name}`);
      }
      assert.deepEqual(await resume(pending), pending, 'Pending identity/pool cannot change during upgrade');
      for (const [request, result, actor] of retainedReplies) assert.deepEqual(await rpc(request, actor), result);
      state = await rpc(failedRequest);
      assert.equal(state.answered, failedAt);
      assert.deepEqual(await rpc(failedRequest), state, 'The formerly failing exact command commits once');
      // Finish the mixed predecessor without reclassifying old BOOK exposures.
      let booksStarted = false;
      while (state.presented < 48) {
        state = await rpc(command(state, 'NEXT'));
        assert.equal(state.status, 'QUESTION');
        const current = await session(state), q = current.presentations.at(-1);
        assert.equal(q.selectionTrace.domainProgression.version, 'movie-first-v1');
        if (booksStarted) assert.equal(state.currentItem.itemType, 'BOOK');
        booksStarted ||= state.currentItem.itemType === 'BOOK';
        state = await rpc(answer(state, state.presented % 11));
      }
      state = await rpc(command(state, 'NEXT'));
      assert.equal(state.status, 'STOPPED'); assert.equal(state.answered, 48);
      assert.equal(state.stopReason, 'OPPORTUNITY_BUDGET_INSUFFICIENT');
      upgradedCount = state.answered;
      assert.equal((await rpc(answer(otherQuestion, 0), other)).answered, 1);
      for (const [request, result, actor] of retainedReplies) assert.deepEqual(await rpc(request, actor), result);
    }

    // Full fresh run: the two phases cannot be accidentally balanced/interleaved.
    let state = await start(fresh), largestReplyBytes = 0;
    const seen = new Set(), grades = new Set();
    for (let n = 0; n < 48; n++) {
      state = await rpc(command(state, 'NEXT'), fresh);
      assert.equal(state.status, 'QUESTION');
      assert.equal(state.currentItem.itemType, n < 24 ? 'MOVIE' : 'BOOK');
      assert.ok(!seen.has(state.currentItem.id)); seen.add(state.currentItem.id);
      if (n === 5 || n === 24) {
        const paused = await rpc(command(state, 'PAUSE'), fresh);
        assert.equal((await resume(paused, fresh)).status, 'PAUSED');
        state = await rpc(command(paused, 'CONTINUE'), fresh);
        assert.equal(state.currentItem.id, [...seen].at(-1));
      }
      const value = n % 11; grades.add(value);
      const request = answer(state, value);
      state = await rpc(request, fresh);
      assert.deepEqual(await rpc(request, fresh), state);
      assert.deepEqual(await resume(state, fresh), state);
      assert.equal(state.answered, n + 1);
      assert.equal(state.readiness.status, 'INSUFFICIENT');
      assert.equal(state.readiness.qualityAdmitted, false);
      const bytes = await one(`select to_jsonb(octet_length(result::text)) from private.sequential_taste_commands
        where session_id='${state.sessionId}' and request_id='${request.requestId}';`, 'reply-size');
      largestReplyBytes = Math.max(bytes, largestReplyBytes);
    }
    assert.equal(grades.size, 11, 'Every integer grade including zero must commit');
    state = await rpc(command(state, 'NEXT'), fresh);
    assert.equal(state.status, 'STOPPED'); assert.equal(state.answered, 48);
    assert.equal(state.stopReason, 'OPPORTUNITY_BUDGET_INSUFFICIENT');
    assert.equal(state.evaluation.pairs.length, 552);
    assert.ok(largestReplyBytes > 32768 && largestReplyBytes < 524288);
    await assert.rejects(resume(state, other), /owner|access|authorization/i);
    await assert.rejects(rpc(command(state, 'CONTINUE', { expectedRevision: 0 }), fresh), /revision|conflict/i);
    for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await one(`select to_jsonb(
      has_function_privilege('${role}','private.select_movie_first_taste_v1(jsonb,jsonb,jsonb,text)','EXECUTE'));`, 'private-helper'), false);
    assert.equal(await one(`select to_jsonb(count(*)) from private.profile_bootstrap_evidence
      where profile_id='${state.profileId}' and rating is not null;`, 'projection-count'), 48);
    assert.equal(await one(`select to_jsonb(count(*)) from public.events where profile_id='${state.profileId}';`, 'no-events'), 0);

    // Maximum possible cardinality remains 1,128 even when no MOVIE is available.
    // Exercise the actual response column with a pessimistic complete pair matrix
    // and a long Unicode title; no pair is dropped to fit the response budget.
    const maximum = await one(`select to_jsonb(octet_length((jsonb_build_object('currentItem',jsonb_build_object('title',repeat('映',500)))||
      jsonb_build_object('evaluation',jsonb_build_object('pairs',(select jsonb_agg(jsonb_build_object(
        'leftObjectId',gen_random_uuid(),'rightObjectId',gen_random_uuid(),'domain','MOVIE','poolId',gen_random_uuid(),
        'status','NO_COMMON_UNSEEN_POOL','agreement','DISCORDANT')) from generate_series(1,1128)))) )::text));`, 'maximum-reply');
    assert.ok(maximum > largestReplyBytes && maximum < 524288);
    await assert.rejects(exec(`begin;update private.sequential_taste_commands set result=jsonb_build_object('oversized',repeat('x',524288))
      where session_id='${state.sessionId}';commit;`, 'oversized-rejection'), /sequential_taste_commands_result_check/);
    return { status: 'PASS', predecessorFailureAt: failedAt, upgradedAccepted: upgradedCount,
      freshAccepted: state.answered, order: '24_MOVIE_THEN_24_BOOK_SAFETY_BOUND', largestReplyBytes,
      completePairCount: state.evaluation.pairs.length, maximumPairReplyBytes: maximum,
      preservedRows: migration ? 'ALL_CANONICAL_TABLES' : 'NOT_APPLICABLE', qualityAdmitted: false };
  } catch (error) { failure = error; throw error; }
  finally {
    if (fixture) {
      try {
        await exec(`begin;do $$ declare actor uuid;begin for actor in select id from public.users where id::text like '${prefix}%' loop
          perform private.erase_prediction_sources_v1('ACTOR',actor);end loop;end;$$;
          delete from auth.users where id::text like '${prefix}%';
          delete from private.item_sources where item_id::text like '${prefix}%';
          delete from public.items where id::text like '${prefix}%';commit;`, 'cleanup');
        assert.deepEqual(await one(snapshots, 'restored'), before, 'Synthetic verifier left data behind');
      } catch (error) { throw new AggregateError(failure ? [failure, error] : [error], 'Taste recovery proof and cleanup failures'); }
    }
  }
}
