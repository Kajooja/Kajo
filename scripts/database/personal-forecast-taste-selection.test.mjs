import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

const owner = 'ab157000-0000-4000-8000-000000000001';
const other = 'ab157000-0000-4000-8000-000000000002';
const id = n => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const policy = 'CANONICAL_FORECAST_V3';
const candidate = (n, tags, recognition = .8, itemType = 'MOVIE') => ({
  id: id(n), title: `Forecast fixture ${n}`, itemType, tags,
  recognitionPrior: recognition, priorBasis: 'CURATED_RECOGNITION',
});
const panel = (catalog, scores, extra = {}) => ({ predictionId: id(900), items: catalog.map((c, n) => ({
  itemId: c.id, status: scores[n] === null ? 'UNAVAILABLE' : 'AVAILABLE',
  reason: scores[n] === null ? 'NO_CANONICAL_SUPPORT' : null,
  labelSeen: false, score: scores[n], ...extra[c.id],
})) });
const history = (n, itemType = 'MOVIE', answer = { kind: 'RATING', value: 10 }) => ({
  id: id(n + 1000), objectId: id(n), itemType, tags: ['warm'], invalidated: false,
  responses: [{ id: id(n + 2000), answer }],
});

test('canonical-forecast Taste successor consumes actual frozen forecasts and preserves old owned sessions', async t => {
  const db = new PGlite();
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await query(sql, args))[0];
  const rpc = async (request, actor = owner) => {
    await db.exec('begin;');
    try {
      await query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
      await db.exec('set local role authenticated;');
      const result = (await one('select public.taste_session_v2($1) value', [request])).value;
      await db.exec('commit;'); return result;
    } catch (error) { await db.exec('rollback;'); throw error; }
  };
  const command = (s, operation, extra = {}) => ({ operation, profileId: s.profileId, sessionId: s.sessionId,
    requestId: randomUUID(), expectedRevision: s.revision, ...extra });
  const start = async actor => {
    const profileId = (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).id;
    return rpc({ operation: 'START', profileId, requestId: randomUUID() }, actor);
  };
  const next = (s, actor = owner) => rpc(command(s, 'NEXT'), actor);
  const answer = (s, value, actor = owner) => rpc(command(s, 'ANSWER', {
    questionId: s.questionId, answer: { kind: 'RATING', value },
  }), actor);
  const session = async s => one('select * from private.sequential_taste_sessions where id=$1', [s.sessionId]);
  const select = async (catalog, ledger, frozen, control = policy, version = 3) =>
    (await one(`select private.select_sequential_taste_v${version}($1,$2,$3,$4) value`, [catalog, ledger, frozen, control])).value;
  const snapshotRows = async () => {
    const tables = await query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('auth','public','private') order by 1`);
    return Promise.all(tables.map(async ({ name }) => [name,
      await query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)]));
  };
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_forecast_aware_taste_selection.sql'));
    assert.ok(index > files.findIndex(file => file.name.endsWith('_durable_sequential_taste.sql')), 'Expected additive selector successor');
    // Exercise this historical upgrade in isolation even when newer additive
    // migrations exist. Current-schema behavior is covered by successor suites.
    assert.equal(files[index].name, '20261016073549_forecast_aware_taste_selection.sql');
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    await db.exec(await personalTasteSessionFixtureSql());

    const legacyStart = await start(owner), oldNextRequest = command(legacyStart, 'NEXT');
    let legacyAnswered = await rpc(oldNextRequest);
    const initialLegacyPanel = await one('select frozen from private.sequential_taste_panels where id=$1',
      [(await session(legacyAnswered)).presentations[0].poolId]);
    const oldAnswerRequest = command(legacyAnswered, 'ANSWER', { questionId: legacyAnswered.questionId,
      answer: { kind: 'RATING', value: 10 } });
    const oldQuestion = structuredClone(legacyAnswered);
    legacyAnswered = await rpc(oldAnswerRequest);
    const legacyQuestion = await next(await start(other), other);
    const pausedActor = id(3);
    await query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'legacy-paused@example.invalid',
      '{"kajo_nickname":"Legacy paused owner"}')`, [pausedActor]);
    const pauseQuestion = await next(await start(pausedActor), pausedActor);
    const legacyPaused = await rpc(command(pauseQuestion, 'PAUSE'), pausedActor);
    const beforeRows = await snapshotRows();
    const beforeFunctions = await query(`select p.oid,p.proname,p.oid::regprocedure::text signature,to_jsonb(p) value from pg_proc p
      where p.pronamespace in('public'::regnamespace,'private'::regnamespace) and p.prokind='f' order by p.oid`);

    await t.test('unknown old source and security drift abort the successor without partial schema or data changes', async () => {
      const source = await one(`select pg_get_functiondef(oid) definition,prosrc from pg_proc
        where oid='private.taste_session_v2(jsonb)'::regprocedure`);
      for (const mutation of [
        source.definition.replace(source.prosrc, () => source.prosrc + '\n-- unreviewed source'),
        'grant execute on function private.taste_session_v2(jsonb) to anon;',
        "alter function private.taste_session_v2(jsonb) set search_path='public';",
        'alter function private.taste_session_v2(jsonb) security invoker;',
      ]) {
        await db.exec('begin;'+mutation);
        await assert.rejects(db.exec(files[index].sql), /source\/security drift/);
        await db.exec('rollback;');
        assert.equal((await one("select to_regprocedure('private.select_sequential_taste_v3(jsonb,jsonb,jsonb,text)') value")).value, null);
      }
      assert.deepEqual(await snapshotRows(), beforeRows);
      assert.equal((await one(`select column_default value from information_schema.columns
        where table_schema='private' and table_name='sequential_taste_sessions' and column_name='policy'`)).value, "'ADAPTIVE'::text");
    });

    await t.test('additive migration preserves populated old policy, first measurements, panels, receipts and function metadata', async () => {
      await db.exec(`begin;${files[index].sql}commit;`);
      assert.deepEqual(await snapshotRows(), beforeRows, 'No retained old row may be rewritten to the new selector policy');
      const patches = JSON.parse(files[index].sql.match(/\$patches\$([\s\S]*?)\$patches\$/)[1]);
      for (const old of beforeFunctions) {
        const actual = (await one('select to_jsonb(p) value from pg_proc p where p.oid=$1', [old.oid])).value;
        const expected = structuredClone(old.value);
        const patch = patches.find(p => p.signature === old.signature);
        for (const [before, after] of patch?.replacements ?? []) {
          assert.equal(expected.prosrc.split(before).length - 1, 1, 'Exactly one approved old source anchor');
          expected.prosrc = expected.prosrc.replace(before, after);
        }
        assert.deepEqual(actual, expected, `Preserve old function identity/security: ${old.proname}`);
      }
      assert.equal((await session(legacyAnswered)).policy, 'ADAPTIVE');
      assert.deepEqual(await rpc(oldNextRequest), oldQuestion, 'Lost old NEXT acknowledgement keeps its exact old question');
      assert.deepEqual(await rpc(oldAnswerRequest), legacyAnswered, 'Lost old ANSWER acknowledgement remains exactly retryable');
      assert.deepEqual(await rpc({ operation:'RESUME',profileId:legacyQuestion.profileId,sessionId:legacyQuestion.sessionId }, other), legacyQuestion);
      assert.deepEqual(await rpc({ operation:'RESUME',profileId:legacyPaused.profileId,sessionId:legacyPaused.sessionId }, pausedActor), legacyPaused);
      const continued = await rpc(command(legacyPaused, 'CONTINUE'), pausedActor);
      assert.equal(continued.questionId, pauseQuestion.questionId, 'Old paused sessions continue the original question');
      assert.equal((await session(continued)).policy, 'ADAPTIVE');
      const oldLedger = (await session(legacyAnswered)).presentations;
      const advanced = await next(legacyAnswered);
      const current = await session(advanced), q = current.presentations.at(-1);
      const frozen = (await one('select frozen from private.sequential_taste_panels where id=$1', [q.poolId])).frozen;
      const oldSelection = await select(current.catalog, oldLedger, frozen, 'ADAPTIVE', 2);
      assert.equal(advanced.currentItem.id, oldSelection.item.id, 'Retained old sessions keep the original next-question policy');
      assert.equal(q.selectionTrace, undefined);
      assert.deepEqual((await one('select frozen from private.sequential_taste_panels where id=$1',
        [oldLedger[0].poolId])).frozen, initialLegacyPanel.frozen);
      assert.equal(current.presentations[0].responses[0].answer.value, 10);
      assert.equal(oldQuestion.currentItem.id, current.presentations[0].objectId);
      await answer(legacyQuestion, 0, other);
      assert.equal((await one("select source_metadata->>'questionPolicyVersion' policy from private.profile_bootstrap_evidence where profile_id=$1", [legacyQuestion.profileId])).policy,
        'sequential-taste-numeric-v2', 'Later old-session evidence retains the old question policy identity');
    });

    await t.test('canonical score inversion changes the choice even when the old local similarity proxy prefers the opposite Item', async () => {
      const catalog = [candidate(301, ['warm']), candidate(302, ['dark'])], ledger = [history(300)];
      const ordinary = panel(catalog, [10, 0]), reversed = panel(catalog, [0, 10]);
      assert.equal((await select(catalog, ledger, ordinary, 'ADAPTIVE', 2)).item.id, id(301));
      assert.equal((await select(catalog, ledger, reversed, 'ADAPTIVE', 2)).item.id, id(301));
      const a = await select(catalog, ledger, ordinary), b = await select(catalog, ledger, reversed);
      assert.equal(a.item.id, id(301)); assert.equal(b.item.id, id(302));
      assert.equal(a.components.preference, 1); assert.equal(b.components.preference, 1);
      const shifted = await select(catalog, ledger, panel(catalog, [1000, -50]));
      assert.deepEqual(shifted, a, 'A positive affine score transform is the same ordinal forecast, never a 0–10 grade');
      const wide = await select(catalog, ledger, panel(catalog, [1e308, -1e308]));
      assert.deepEqual(wide, a, 'Wide finite scores retain ordinal meaning without overflowing a score subtraction');
      assert.deepEqual(b.trace, { version:'canonical-ordinal-v3',scoreBasis:'WITHIN_DOMAIN_CURRENT_PANEL_TIED_MIDRANK',
        poolId:reversed.predictionId,preference:1,candidateCount:2,coverageIntervention:false,
        minimumPresented:1,maximumPresented:1,maximumDomainLead:2 });
      assert.deepEqual(ordinary.items.map(i => i.score), [10, 0], 'Input panels remain unchanged');
    });

    await t.test('utility can retain the answered domain before bounded coverage deliberately rotates it', async () => {
      const catalog = [candidate(401, ['x'], 1), candidate(402, ['y'], 1),
        candidate(403, ['book-x'], 0, 'BOOK'), candidate(404, ['book-y'], 0, 'BOOK')];
      const frozen = panel(catalog, [10, 0, 10, 0]);
      const first = await select(catalog, [history(410)], frozen);
      assert.equal(first.item.itemType, 'MOVIE', 'One prior MOVIE answer cannot unconditionally force BOOK');
      assert.equal(first.trace.coverageIntervention, false);
      const guarded = await select(catalog, [history(410), history(411)], frozen);
      assert.equal(guarded.item.itemType, 'BOOK'); assert.equal(guarded.trace.coverageIntervention, true);
      assert.equal(guarded.trace.minimumPresented, 0); assert.equal(guarded.trace.maximumPresented, 2);
      const unavailableBooks = panel(catalog, [10, 0, null, null]);
      const supported = await select(catalog, [history(410), history(411)], unavailableBooks);
      assert.equal(supported.item.itemType, 'MOVIE'); assert.equal(supported.trace.coverageIntervention, false);
    });

    await t.test('tied and missing forecasts retain ordinal honesty and cannot manufacture support', async () => {
      const catalog = [candidate(501, ['warm']), candidate(502, ['dark'])];
      const tied = await select(catalog, [], panel(catalog, [42, 42]));
      assert.equal(tied.item.id, id(501)); assert.equal(tied.components.preference, .5);
      assert.equal(tied.trace.candidateCount, 2);
      assert.equal(await select(catalog, [], panel(catalog, [null, null])), null);
      assert.equal(await select(catalog, [], panel(catalog, [2, null])), null, 'One supported pattern cannot supply an informative pair');
      const three = [candidate(503, ['a'], 1), candidate(504, ['b'], 0), candidate(505, ['c'], 0)];
      const nearTie = await select(three, [], panel(three, [1, 1 + .5e-9, 1 + 2e-9]));
      assert.equal(nearTie.item.id, id(503)); assert.equal(nearTie.components.preference, .25);
      const excluded = [candidate(506, ['missing'], 1), candidate(507, ['known'], 1), ...catalog];
      const selected = await select(excluded, [], panel(excluded, [null, 999, 1, 0], { [id(507)]:{labelSeen:true} }));
      assert.equal(selected.item.id, id(501)); assert.equal(selected.trace.candidateCount, 2);
      assert.equal(Object.hasOwn(selected.trace, 'accuracyPercent'), false);
    });

    await t.test('recognition-only control ignores changed forecasts while retaining the declared coverage guard', async () => {
      const catalog = [candidate(601, ['warm'], .9), candidate(602, ['dark'], .8)], ledger = [history(600)];
      const first = await select(catalog, ledger, panel(catalog, [10, 0]), 'PRIOR_ONLY');
      const inverse = await select(catalog, ledger, panel(catalog, [0, 10]), 'PRIOR_ONLY');
      assert.equal(first.item.id, id(601)); assert.equal(inverse.item.id, first.item.id);
      assert.equal(first.components.utility, .9); assert.equal(inverse.components.utility, .9);
      const guardedCatalog = [...catalog, candidate(603, ['a'], .1, 'BOOK'), candidate(604, ['b'], 0, 'BOOK')];
      const guarded = await select(guardedCatalog, [history(610), history(611)], panel(guardedCatalog, [10, 0, 10, 0]), 'PRIOR_ONLY');
      assert.equal(guarded.item.itemType, 'BOOK'); assert.equal(guarded.trace.coverageIntervention, true);
    });

    await t.test('the new helper remains private and the existing owned public route retains its role boundary', async () => {
      for (const role of ['anon','authenticated','service_role']) assert.equal((await one(
        "select has_function_privilege($1,'private.select_sequential_taste_v3(jsonb,jsonb,jsonb,text)','EXECUTE') allowed", [role])).allowed, false);
      assert.equal((await one("select has_function_privilege('authenticated','public.taste_session_v2(jsonb)','EXECUTE') allowed")).allowed, true);
      assert.equal((await one("select has_function_privilege('anon','public.taste_session_v2(jsonb)','EXECUTE') allowed")).allowed, false);
    });

    await t.test('fresh first 10, 0 and 5 prefixes drive the next committed canonical choice and keep first measurements frozen', async () => {
      // Only these five real-provider-shaped candidates participate. BOOK has
      // distinct features but no overlap with the first MOVIE, so its unchanged
      // domain coverage cannot mask the supported opposite-answer MOVIE choice.
      await db.exec("update public.items set discoverable=false where id::text like 'ab157000-%';");
      const rows = [[100,'MOVIE',['warm'],1],[101,'MOVIE',['warm'],.7],[102,'MOVIE',['dark'],.7],
        [120,'BOOK',['book-warm'],.7],[121,'BOOK',['book-dark'],.7]];
      for (const [n, type, tags, recognition] of rows) await query(`update public.items set discoverable=true,
        item_type=$2,tags=$3,metadata=jsonb_build_object('coldStartRecognition',$4::double precision,
        'coldStartPriorSource','KAJO_CURATED_RECOGNITION') where id=$1`, [id(n),type,tags,recognition]);
      const observations = [];
      for (const [n, rating] of [[10,10],[11,0],[12,5]]) {
        const actor = id(n);
        await query(`insert into auth.users(id,email,raw_user_meta_data) values($1,$2,jsonb_build_object('kajo_nickname',$3::text))`,
          [actor, `forecast-${n}@example.invalid`, `Forecast owner ${n}`]);
        let s = await start(actor); assert.equal((await session(s)).policy, policy);
        const offer = command(s, 'NEXT'); s = await rpc(offer, actor);
        assert.equal(s.status, 'QUESTION'); assert.equal(s.currentItem.id, id(100));
        const first = (await session(s)).presentations[0];
        const original = (await one('select frozen from private.sequential_taste_panels where id=$1', [first.poolId])).frozen;
        assert.deepEqual(await rpc(offer, actor), s, 'Lost NEXT acknowledgement returns the exact issued question');
        assert.equal((await one('select count(*)::int n from private.sequential_taste_panels where session_id=$1', [s.sessionId])).n, 1);
        s = await answer(s, rating, actor);
        const accepted = structuredClone(s), fresh = await rpc({ operation:'RESUME',profileId:s.profileId,sessionId:s.sessionId }, actor);
        assert.equal(fresh.status, 'NEEDS_NEXT');
        assert.equal((await rpc(offer, actor)).questionId, first.id, 'An exact cached reply is never silently rebased');
        const nextRequest = command(fresh, 'NEXT'); s = await rpc(nextRequest, actor);
        const retained = await session(s), second = retained.presentations[1];
        const actualPanel = await one('select * from private.sequential_taste_panels where id=$1', [second.poolId]);
        assert.equal(actualPanel.frozen.requiredReceiptRevision, accepted.revision);
        assert.equal((await one('select $1::timestamptz>$2::timestamptz later',
          [actualPanel.frozen.evidenceCutoff,accepted.acceptedAt])).later, true, 'Full-precision capture cutoff follows the committed answer');
        assert.equal(second.selectionTrace.version, 'canonical-ordinal-v3');
        assert.equal(second.selectionTrace.poolId, actualPanel.frozen.predictionId);
        const firstFrozen = (await one('select frozen from private.sequential_taste_panels where id=$1', [first.poolId])).frozen;
        assert.deepEqual(firstFrozen, original);
        assert.equal(retained.presentations[0].responses[0].answer.value, rating);
        assert.equal(retained.presentations[0].responses[0].measurement.firstMeasurement, true);
        const evidence = await one(`select evidence_kind,rating,source_metadata->>'questionPolicyVersion' policy
          from private.profile_bootstrap_evidence where profile_id=$1`, [s.profileId]);
        assert.deepEqual(evidence, { evidence_kind:'RATED',rating,policy:'canonical-ordinal-v3' });
        assert.deepEqual(await rpc(nextRequest, actor), s);
        assert.equal((await one('select count(*)::int n from private.sequential_taste_panels where session_id=$1', [s.sessionId])).n, 2);
        assert.equal(s.readiness.status, 'INSUFFICIENT'); assert.equal(s.readiness.qualityAdmitted, false);
        assert.doesNotMatch(JSON.stringify(s), /"score"|"selectionTrace"|"selectionComponents"|"frozen"/);
        const matching = actualPanel.frozen.items.find(i => i.itemId === id(101));
        const explanation = (await one('select explanation from private.prediction_candidates where prediction_id=$1 and item_id=$2',
          [actualPanel.prediction_id, matching.itemId])).explanation;
        observations.push({ rating, next:s.currentItem.id, domain:s.currentItem.itemType, bootstrap:explanation.bootstrapLongTerm,
          frozen:actualPanel.frozen, components:second.selectionComponents });
      }
      assert.equal(observations[0].next, id(101), 'A first 10 can retain the same domain and select the supported similar Item');
      assert.equal(observations[1].next, id(102), 'A first 0 selects the supported contrasting Item');
      assert.equal(observations[2].next, id(120), 'A neutral first 5 retains the declared tied-forecast/domain fallback');
      assert.equal(observations[2].components.preference, .5, 'The neutral panel does not masquerade as positive or negative ordinal preference');
      assert.notEqual(observations[0].next, observations[1].next);
      assert.ok(observations[0].bootstrap > 0); assert.ok(observations[1].bootstrap < 0); assert.equal(observations[2].bootstrap, 0);
      assert.equal((await one('select count(*)::int n from public.events where actor_user_id=any($1::uuid[])', [[id(10),id(11),id(12)]])).n, 0);
      assert.equal((await one(`select count(*)::int n from private.prediction_candidates c join private.sequential_taste_panels p
        on p.prediction_id=c.prediction_id where c.selected_for_delivery and p.session_id in(
          select id from private.sequential_taste_sessions where actor_user_id=any($1::uuid[]))`, [[id(10),id(11),id(12)]])).n, 0);
    });
  } catch (error) { delete error.query; throw error; } finally { await db.close(); }
});
