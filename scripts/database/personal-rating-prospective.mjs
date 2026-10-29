import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const literal = value => `'${String(value).replaceAll("'", "''")}'`;
export const json = value => `${literal(JSON.stringify(value))}::jsonb`;
export const auth = actor => `set local request.jwt.claim.sub=${literal(actor)};`;
export const prepare = (id, source, target, horizon = 3600, origin = 'synthetic') =>
  `private.prepare_personal_rating_forecast_v1(${literal(id)},${literal(source)},${literal(target)},${horizon},${literal(origin)})`;
export const finalize = (id, forecast) => `private.finalize_personal_rating_forecast_v1(${literal(id)},${json(forecast)})`;
export const answer = (id, request) => `private.commit_personal_rating_answer_v1(${literal(id)},${json(request)})`;
export const inspect = id => `private.inspect_personal_rating_forecast_v1(${literal(id)})`;

let corePromise;
export async function personalRatingProspectiveCore() {
  corePromise ??= (async () => {
    const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p',
      'packages/prediction-engine/tsconfig.build.json'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', timeout: 120_000,
    });
    assert.equal(build.status, 0, `Prospective rating build failed: ${build.stderr || build.stdout}`);
    const [adapter, core] = await Promise.all([
      import('../../packages/prediction-engine/dist/adapters/kajo-personal-rating-prospective.js'),
      import('../../packages/prediction-engine/dist/personal-rating.js'),
    ]);
    return { ...adapter, ...core };
  })();
  return corePromise;
}

/** Trusted server orchestration only. The dedicated connection owns one native
 * transaction through capture, actual portable computation and durable finalize.
 * An exception rolls the entire transaction back; an exact retry reads the
 * already frozen result. This is not an exposed RPC or model admission. */
export async function capturePersonalRatingForecast(withSqlSession, request, hooks = {}) {
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
  assert.ok(request && [request.actor, request.id, request.source, request.target].every(uuid), 'Invalid numeric capture UUID');
  assert.ok(Number.isInteger(request.horizon ?? 3600) && (request.horizon ?? 3600) >= 1
    && (request.horizon ?? 3600) <= 7776000, 'Invalid numeric capture horizon');
  assert.ok(['observed', 'synthetic'].includes(request.origin ?? 'observed'), 'Invalid numeric capture evidence origin');
  const { normalizeKajoPersonalRatingProspectivePrefix, forecastPersonalRatingBaseline } = await personalRatingProspectiveCore();
  return withSqlSession(async exec => {
    await exec(`begin;set local extra_float_digits=3;${auth(request.actor)}`, { stage: 'personal-rating-begin' });
    try {
      const [preparation] = await exec(`select ${prepare(request.id, request.source, request.target, request.horizon ?? 3600, request.origin ?? 'observed')};`,
        { stage: 'personal-rating-prepare' });
      const forecast = preparation.forecast ?? forecastPersonalRatingBaseline(
        normalizeKajoPersonalRatingProspectivePrefix(preparation.input));
      await hooks.beforeFinalize?.({ exec, preparation, forecast });
      const [stored] = await exec(`select ${finalize(request.id, forecast)};`, { stage: 'personal-rating-finalize' });
      await hooks.beforeCommit?.({ exec, preparation, forecast, stored });
      await exec('commit;', { stage: 'personal-rating-commit' });
      return { preparation, forecast, stored };
    } catch (error) {
      await exec('rollback;', { stage: 'personal-rating-rollback' }).catch(() => {});
      throw error;
    }
  });
}

const id = n => `a4001000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actorIds = [1, 2, 3].map(id);
const fixtureItems = Array.from({ length: 30 }, (_, n) => id(100 + n));

/** Committed synthetic fixtures on an empty disposable installation only. */
export async function withPersonalRatingProspectiveFixture(execSql, withSqlSession, run) {
  const exec = (sql, stage) => execSql(sql, { stage: 'personal-rating-' + stage, timeoutMs: 180_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in('public','private','auth');`, 'tables');
  const snapshotSql = `begin read only;set local extra_float_digits=3;select jsonb_object_agg(name,value) from (${tables.map(name =>
    `select ${literal(name)} name,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),
      '[]')::text,'UTF8')),'hex') value from ${name} r`).join(' union all ')}) s;rollback;`;
  const snapshot = () => one(snapshotSql, 'canonical-snapshot');
  const original = await snapshot();
  let setup = false, failure;
  try {
    assert.deepEqual(await one(`select jsonb_build_object('users',(select count(*) from auth.users),
      'items',(select count(*) from public.items));`, 'empty-state'), { users: 0, items: 0 });
    setup = true;
    const identities = await one(`begin;
      insert into auth.users(id,email,raw_user_meta_data) values ${actorIds.map((actor, n) =>
      `(${literal(actor)},${literal(actor + '@example.invalid')},jsonb_build_object('kajo_nickname',${literal('Numeric prospective ' + n)}))`).join(',')};
      insert into public.items(id,item_type,title,tags,discoverable,created_at) values ${fixtureItems.map((item, n) =>
      `(${literal(item)},'${n >= 26 ? 'MOVIE' : 'BOOK'}',${literal('Numeric prospective ' + n)},array['numeric-prospective'],${n >= 2},clock_timestamp()-interval '1 day')`).join(',')};
      insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
        select ${literal(id(10))},${literal(actorIds[0])},id,clock_timestamp()-interval '1 day','{}' from public.profiles
        where owner_user_id=${literal(actorIds[0])} and profile_type='PERSONAL';
      insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
        select ${literal(id(11))},${literal(actorIds[1])},id,clock_timestamp()-interval '1 day','{}' from public.profiles
        where owner_user_id=${literal(actorIds[1])} and profile_type='PERSONAL';
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at)
        select ${literal(id(20))},${literal(actorIds[0])},id,${literal(fixtureItems[0])},'BOOK','ITEM_RATED','{"rating":8}',
          clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour' from public.profiles
        where owner_user_id=${literal(actorIds[0])} and profile_type='PERSONAL';
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at)
        select ${literal(id(21))},${literal(actorIds[0])},id,${literal(fixtureItems[1])},'BOOK','ITEM_RATED','{"rating":6}',
          clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour' from public.profiles
        where owner_user_id=${literal(actorIds[0])} and profile_type='PERSONAL';
      select jsonb_agg(jsonb_build_object('actor',p.owner_user_id,'profile',p.id,'session',s.id,'startedAt',s.started_at::text)
        order by p.owner_user_id) from public.profiles p left join public.event_sessions s on s.profile_id=p.id
        where p.owner_user_id in(${actorIds.map(literal).join(',')}) and p.profile_type='PERSONAL';commit;`, 'fixture');
    const f = { ...identities[0], cold: identities[1], foreign: identities[2], items: fixtureItems,
      evidence: [id(20), id(21)], source: null, movieSource: null, coldSource: null };
    const page = async (identity, domain, version = 1) => one(`begin;${auth(identity.actor)}set local role authenticated;
      select public.rank_items_page_v1(${json({ version, requestId: randomUUID(), profileId: identity.profile,
      sessionId: identity.session, discoveryMode: 'FOR_YOU', itemType: domain, limit: 50, context: {} })});commit;`, 'source-page');
    f.source = (await page(f, 'BOOK', 3)).predictionId;
    f.movieSource = (await page(f, 'MOVIE', 3)).predictionId;
    f.coldSource = (await page(f.cold, 'BOOK', 3)).predictionId;
    const targets = async source => one(`select jsonb_agg(item_id order by final_rank) from private.prediction_candidates
      where prediction_id=${literal(source)} and selected_for_delivery;`, 'selected-targets');
    f.targets = await targets(f.source);f.movieTargets = await targets(f.movieSource);f.coldTargets = await targets(f.coldSource);
    assert.ok(f.targets.length >= 20 && f.movieTargets.length >= 2 && f.coldTargets.length >= 20);
    const command = async (target, rating, options = {}) => ({ version: 1, actionId: options.actionId ?? randomUUID(),
      actorUserId: options.actor ?? f.actor, profileId: options.profile ?? f.profile, itemId: target,
      occurredAt: options.occurredAt ?? await one('select to_jsonb(clock_timestamp()::text);', 'action-clock'),
      session: { sessionId: options.session ?? f.session, startedAt: options.startedAt ?? f.startedAt, context: {} },
      discoveryMode: 'FOR_YOU', predictionId: options.source ?? f.source, kind: options.kind ?? 'SET_RATING',
      ...(rating === undefined ? {} : { rating }), ...(options.extra ?? {}) });
    const call = (expression, actor = f.actor) => one(`begin;set local extra_float_digits=3;${auth(actor)}
      select ${expression};commit;`, 'private-call');
    const publicAction = (request, collection = false) => one(`begin;${auth(request.actorUserId)}set local role authenticated;
      select public.${collection ? 'commit_collection_action_v1' : 'commit_item_action_v1'}(${json(request)});commit;`, 'canonical-action');
    const captureRequests = new Map();
    const freshSource = async (identity = f, domain = 'BOOK') => {
      const result = (await page(identity, domain)).predictionId;
      // PGlite clocks can share milliseconds across committed transactions.
      // Advance its clock for native guards; transaction order is proven by
      // separate COMMITs and the actual held-connection orchestration.
      await exec('do $$begin perform pg_sleep(0.002);end;$$;', 'committed-source-clock');
      return result;
    };
    const capture = async (target, options = {}, hooks) => {
      const forecastId = options.id ?? randomUUID();
      const request = captureRequests.get(forecastId) ?? { id: forecastId,
        source: options.source ?? await freshSource(), target,
        actor: options.actor ?? f.actor, horizon: options.horizon ?? 3600, origin: 'synthetic' };
      captureRequests.set(forecastId, request);
      return capturePersonalRatingForecast(withSqlSession, request, hooks);
    };
    const rejected = async (expression, codes, actor = f.actor) => {
      const result = await one(`begin;${auth(actor)}do $reject$ declare rejected text;begin
        begin perform ${expression};exception when others then rejected:=sqlstate;end;
        if rejected is null then raise exception 'Expected rejected numeric operation';end if;
        perform set_config('kajo.numeric_rejected',rejected,true);end;$reject$;
        select to_jsonb(current_setting('kajo.numeric_rejected'));rollback;`, 'expected-rejection');
      assert.ok(codes.includes(result), `Unexpected rejection ${result}; expected ${codes}`);
      return result;
    };
    return await run({ f, exec, one, call, capture, command, publicAction, rejected, snapshot, withSqlSession, freshSource });
  } catch (error) { failure = error;throw error; }
  finally {
    if (setup) {
      try {
        await exec(`begin;do $cleanup$ declare actor uuid;begin
          foreach actor in array array[${actorIds.map(literal).join(',')}]::uuid[] loop
            if exists(select 1 from public.users where id=actor) then perform private.erase_prediction_sources_v1('ACTOR',actor);end if;
          end loop;end;$cleanup$;
          delete from public.item_interactions where actor_user_id in(${actorIds.map(literal).join(',')});
          delete from auth.users where id in(${actorIds.map(literal).join(',')});
          delete from public.items where id in(${fixtureItems.map(literal).join(',')});commit;`, 'fixture-cleanup');
        assert.deepEqual(await snapshot(), original, 'Numeric prospective fixture changed canonical rows');
      } catch (cleanupError) { throw new AggregateError(failure ? [failure, cleanupError] : [cleanupError],
        'Numeric prospective proof/cleanup failed'); }
    }
  }
}

export async function verifyPersonalRatingProspective(execSql, withSqlSession) {
  return withPersonalRatingProspectiveFixture(execSql, withSqlSession, async ({ f, exec, one, call, capture, command, publicAction, rejected, freshSource }) => {
    const cases = [];
    const first = await capture(f.targets[0], { source: f.source });
    const firstId = first.preparation.forecastId;
    assert.equal(first.forecast.location.personalMean, 7);
    assert.equal(first.forecast.prefix.support, 2);
    assert.equal(first.forecast.prefix.provenance.origin, 'synthetic');
    assert.equal(first.forecast.prior, null);
    const frozen = await call(inspect(firstId));
    assert.equal(frozen.firstAnswer, null, 'Actual persisted TS forecast must precede the answer');
    assert.equal(frozen.coverage, 'PENDING_FIRST_REPORT');
    assert.equal(first.preparation.cohort, 'FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN');
    const firstCommand = await command(f.targets[0], 0, { source: first.preparation.sourcePredictionId });
    const measured = await call(answer(firstId, firstCommand));
    assert.equal(measured.rating, 0);
    assert.equal(measured.actionId, firstCommand.actionId);
    assert.equal(measured.measurement.controlSquaredError, 49);
    assert.equal(measured.measurement.candidateSquaredError, 49);
    assert.deepEqual(await call(answer(firstId, firstCommand)), measured, 'First-answer retry must be exact');
    const after = await call(inspect(firstId));
    assert.deepEqual(after.preparation.forecast, frozen.preparation.forecast);
    assert.deepEqual(after.firstAnswer, measured);
    assert.equal(after.coverage, 'MEASURED_FIRST_RATING');
    assert.deepEqual((await capture(f.targets[0], { id: firstId })).stored, first.stored, 'Forecast retry must retain original bytes');
    cases.push({ name: 'actual-typescript-before-first-zero', forecast: first.forecast, firstAnswer: measured });
    const correction = await command(f.targets[0], 9);
    await publicAction(correction);
    const corrected = await call(inspect(firstId));
    assert.deepEqual(corrected.preparation.forecast, frozen.preparation.forecast);
    assert.deepEqual(corrected.firstAnswer, measured);
    assert.equal(corrected.currentCanonicalState.rating, 9);
    assert.equal(corrected.currentCanonicalState.sourceEventId, correction.actionId);
    const next = await capture(f.targets[1]);
    assert.equal(next.forecast.location.personalMean, 23 / 3);
    assert.equal(next.forecast.prefix.support, 3);
    cases.push({ name: 'correction-only-updates-future-prefix', mean: next.forecast.location.personalMean });
    const pendingBefore = await call(inspect(next.preparation.forecastId));
    const duplicateId = randomUUID(), duplicateSource = await freshSource();
    await rejected(prepare(duplicateId, duplicateSource, f.targets[1]), ['55000']);
    assert.deepEqual(await call(inspect(next.preparation.forecastId)), pendingBefore,
      'Refusing a second same-target source cannot change the original opportunity');
    assert.equal(await one(`select to_jsonb(count(*)) from private.personal_rating_allocations where id=${literal(duplicateId)};`,
      'duplicate-target-no-allocation'), 0);
    const foreignStarted = await one("select to_jsonb((clock_timestamp()-interval '1 minute')::text);", 'foreign-action-clock');
    const foreignCommand = await command(f.targets[1], 8, { actor: f.foreign.actor, profile: f.foreign.profile,
      session: randomUUID(), startedAt: foreignStarted, extra: { predictionId: null } });
    await publicAction(foreignCommand);
    assert.deepEqual(await call(inspect(next.preparation.forecastId)), pendingBefore,
      'An unrelated owner rating the same Item cannot retire another Profile opportunity');
    cases.push({ name: 'one-pending-target-across-sources-and-owner-isolation',
      originalForecastId: next.preparation.forecastId, duplicateRejected: '55000', foreignWrite: 'UNAFFECTED' });
    const undo = await command(f.targets[0], undefined, { kind: 'UNDO', extra: { reversesActionId: correction.actionId } });
    await publicAction(undo);
    const undone = await call(inspect(firstId));
    assert.deepEqual(undone.preparation.forecast, frozen.preparation.forecast);assert.deepEqual(undone.firstAnswer, measured);
    assert.equal(undone.currentCanonicalState.rating, 0);
    assert.equal(undone.currentCanonicalState.sourceEventId, firstCommand.actionId);
    const clear = await command(f.targets[0], undefined, { kind: 'CLEAR_HISTORY', extra: { source: 'LISTS', predictionId: null, discoveryMode: null } });
    await publicAction(clear, true);
    const cleared = await call(inspect(firstId));
    assert.deepEqual(cleared.preparation.forecast, frozen.preparation.forecast);assert.deepEqual(cleared.firstAnswer, measured);
    assert.equal(cleared.currentCanonicalState?.rating ?? null, null);
    cases.push({ name: 'correction-undo-clear-retain-first-measurement',
      corrected: corrected.currentCanonicalState, undone: undone.currentCanonicalState, cleared: cleared.currentCanonicalState,
      firstAnswer: measured });

    for (let rating = 0; rating <= 10; rating++) {
      const target = f.targets[rating + 2], captured = await capture(target), forecastId = captured.preparation.forecastId;
      const request = await command(target, rating, { source: captured.preparation.sourcePredictionId });
      const response = await call(answer(forecastId, request));
      assert.equal(response.rating, rating);
      const value = captured.forecast.forecasts.find(row => row.objectId === target).control.value;
      assert.ok(Math.abs(response.measurement.controlSquaredError - (rating - value) ** 2) <= 1e-12);
      assert.equal(captured.forecast.prefix.ratings.some(row => row.objectId === target), false);
      assert.deepEqual((await call(inspect(forecastId))).firstAnswer, response);
      cases.push({ name: 'grade-' + rating, rating, value, measured: response.measurement });
    }
    await rejected(prepare(firstId, f.source, f.targets[1]), ['22023', '23505']);
    await rejected(inspect(firstId), ['42501'], f.foreign.actor);
    await rejected(answer(firstId, await command(f.targets[0], 10)), ['22023', '23505', '55000']);
    await rejected(prepare(randomUUID(), await freshSource(), f.movieTargets[0]), ['22023', '55000']);
    const cold = await capture(f.coldTargets[0], { actor: f.cold.actor, source: f.coldSource });
    assert.equal(cold.forecast.capability, 'NUMERIC_POINT_UNAVAILABLE_V1');
    assert.equal(cold.forecast.location.personalMean, null);
    assert.equal((await call(inspect(cold.preparation.forecastId), f.cold.actor)).firstAnswer, null);
    const coldAnswer = await call(answer(cold.preparation.forecastId, await command(f.coldTargets[0], 10,
      { actor: f.cold.actor, profile: f.cold.profile, session: f.cold.session, startedAt: f.cold.startedAt,
        source: f.coldSource })), f.cold.actor);
    assert.equal(coldAnswer.measurement.controlSquaredError, null);
    assert.equal(coldAnswer.measurement.candidateSquaredError, null);
    assert.equal((await call(inspect(cold.preparation.forecastId), f.cold.actor)).coverage, 'NO_NUMERIC_FORECAST');
    const movie = await capture(f.movieTargets[0], { source: f.movieSource });
    assert.equal(movie.forecast.domainId, 'MOVIE');assert.equal(movie.forecast.prefix.support, 0);
    cases.push({ name: 'cold-and-domain-isolation', cold: cold.forecast.capability, movie: movie.forecast.capability,
      unavailableMeasurement: coldAnswer.measurement, coverage: coldAnswer.coverage });

    const signatures = ['private.prepare_personal_rating_forecast_v1(uuid,uuid,uuid,integer,text)',
      'private.finalize_personal_rating_forecast_v1(uuid,jsonb)', 'private.commit_personal_rating_answer_v1(uuid,jsonb)',
      'private.inspect_personal_rating_forecast_v1(uuid)'];
    const acl = await one(`select jsonb_agg(jsonb_build_object('role',role,'signature',signature,
      'allowed',has_function_privilege(role,signature,'EXECUTE'))) from unnest(array['anon','authenticated','service_role']) role
      cross join unnest(array[${signatures.map(literal).join(',')}]) signature;`, 'private-acl');
    assert.ok(acl.every(row => row.allowed === false));
    cases.push({ name: 'closed-private-access-and-retry-conflicts' });

    const incompleteId = randomUUID(), incompleteSource = await freshSource();
    await assert.rejects(withSqlSession(async session => {
      try { await session(`begin;${auth(f.actor)}select ${prepare(incompleteId, incompleteSource, f.targets[13])};commit;`,
        'incomplete-preparation'); }
      finally { await session('rollback;', 'incomplete-rollback').catch(() => {}); }
    }), /Finalize|55000/);
    assert.equal(await one(`select to_jsonb(count(*)) from private.personal_rating_allocations where id=${literal(incompleteId)};`,
      'incomplete-not-retained'), 0);
    await assert.rejects(capture(f.targets[14], {}, { beforeCommit: async ({ exec: session, preparation }) => {
      const request = await command(f.targets[14], 5, { source: preparation.sourcePredictionId });
      await session(`select ${answer(preparation.forecastId, request)};`, 'same-transaction-answer');
    } }), /transaction|commit|25001|55000/i);
    await assert.rejects(capture(f.targets[15], {}, { beforeCommit: async ({ exec: session }) => {
      await session(`savepoint child;
        insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at)
          values(${literal(randomUUID())},${literal(f.actor)},${literal(f.profile)},${literal(f.targets[15])},'BOOK',
            'ITEM_RATED','{"rating":4}',clock_timestamp());release child;`, 'same-transaction-child-answer');
    } }), /transaction|commit|25001|55000/i);
    cases.push({ name: 'incomplete-and-same-transaction-savepoint-refused' });

    const outside = await capture(f.targets[16]);
    const outsideCommand = await command(f.targets[16], 3, { source: outside.preparation.sourcePredictionId });
    await publicAction(outsideCommand);
    assert.equal((await call(inspect(outside.preparation.forecastId))).status, 'WITHDRAWN');
    assert.equal((await call(inspect(outside.preparation.forecastId))).coverage, 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT');
    await exec(`begin;delete from public.events where id=${literal(outsideCommand.actionId)};commit;`, 'outside-answer-delete');
    assert.equal((await call(inspect(outside.preparation.forecastId))).status, 'WITHDRAWN');
    await rejected(answer(outside.preparation.forecastId, await command(f.targets[16], 8,
      { source: outside.preparation.sourcePredictionId })), ['42501', '55000']);
    cases.push({ name: 'outside-answer-delete-cannot-create-replacement-first-label' });

    const expired = await capture(f.targets[17], { horizon: 1 });
    await exec('do $$begin perform pg_sleep(1.1);end;$$;', 'mature-expired-window');
    await rejected(answer(expired.preparation.forecastId, await command(f.targets[17], 8,
      { source: expired.preparation.sourcePredictionId })), ['55000']);
    const expiredState = await call(inspect(expired.preparation.forecastId));
    assert.equal(expiredState.firstAnswer, null);
    assert.equal(expiredState.coverage, 'UNANSWERED_EXPIRED');
    cases.push({ name: 'expired-window-remains-missing-coverage', coverage: expiredState.coverage, firstAnswer: expiredState.firstAnswer });

    // Legacy v1 challenge grades intentionally produce no Event/bootstrap row.
    // Such a previously reported target is still ineligible as a new first answer.
    const challengeSource = await freshSource(), tasteSession = randomUUID();
    await exec(`begin;insert into private.taste_sessions(id,profile_id,actor_user_id,catalog_as_of,catalog,
        existing_completed,status,created_at,updated_at) values(${literal(tasteSession)},${literal(f.profile)},
        ${literal(f.actor)},clock_timestamp(),'[]',false,'STOPPED',clock_timestamp(),clock_timestamp());
      insert into private.taste_challenges(session_id,profile_id,actor_user_id,prediction_id,status,revision,frozen,
        items,answers,created_at,updated_at) values(${literal(tasteSession)},${literal(f.profile)},${literal(f.actor)},
        ${literal(challengeSource)},'ACTIVE',1,'{}',${json([{ id: f.targets[18] }, { id: f.targets[20] }])},
        ${json([{ itemId: f.targets[18], answer: { kind: 'RATING', value: 7 }, receivedAt: new Date().toISOString() }])},
        clock_timestamp(),clock_timestamp());commit;`, 'legacy-challenge-answer');
    await rejected(prepare(randomUUID(), challengeSource, f.targets[18]), ['55000']);
    cases.push({ name: 'legacy-evaluation-only-answer-is-not-never-answered' });

    const challengePending = await capture(f.targets[20]);
    assert.equal((await call(inspect(challengePending.preparation.forecastId))).coverage, 'PENDING_FIRST_REPORT');
    await exec(`begin;update private.taste_challenges set answers=answers||${json([{ itemId: f.targets[20],
      answer: { kind: 'RATING', value: 6 }, receivedAt: new Date().toISOString() }])},revision=2,status='COMPLETE',
      updated_at=clock_timestamp() where session_id=${literal(tasteSession)};commit;`, 'retained-challenge-outside-answer');
    const challengeWithdrawn = await call(inspect(challengePending.preparation.forecastId));
    assert.equal(challengeWithdrawn.status, 'WITHDRAWN');
    assert.equal(challengeWithdrawn.firstAnswer, null);
    assert.equal(challengeWithdrawn.coverage, 'SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT');
    await exec(`begin;update private.taste_challenges set status='REMOVED',updated_at=clock_timestamp()
      where session_id=${literal(tasteSession)};commit;`, 'retained-challenge-answer-clear');
    assert.deepEqual(await call(inspect(challengePending.preparation.forecastId)), challengeWithdrawn,
      'Clearing the outside challenge answer cannot restore a first-answer opportunity');
    await rejected(prepare(challengePending.preparation.forecastId, challengePending.preparation.sourcePredictionId,
      f.targets[20]), ['55000']);
    await rejected(answer(challengePending.preparation.forecastId, await command(f.targets[20], 8,
      { source: challengePending.preparation.sourcePredictionId })), ['55000']);
    cases.push({ name: 'pending-legacy-challenge-answer-then-clear-stays-withdrawn',
      status: challengeWithdrawn.status, coverage: challengeWithdrawn.coverage, firstAnswer: challengeWithdrawn.firstAnswer });

    const erased = await capture(f.targets[19]);
    await exec(`begin;do $$begin perform private.erase_prediction_sources_v1('PREDICTION_RUN',
      ${literal(erased.preparation.sourcePredictionId)});end;$$;commit;`, 'canonical-source-erasure');
    await rejected(inspect(erased.preparation.forecastId), ['42501', '55000']);
    cases.push({ name: 'canonical-prediction-erasure-removes-numeric-derivatives' });

    // Original first-label erasure removes copied measurements and dependent
    // forecasts; it cannot silently turn a correction into a new first answer.
    await exec(`begin;delete from public.events where id=${literal(firstCommand.actionId)};commit;`, 'withdraw-first-answer');
    assert.equal((await call(inspect(firstId))).status, 'WITHDRAWN');
    await rejected(prepare(firstId, first.preparation.sourcePredictionId, f.targets[0]), ['55000']);
    cases.push({ name: 'first-answer-withdrawal-and-no-id-resurrection' });

    const sourcePaths = ['packages/prediction-engine/src/personal-rating.ts', 'packages/prediction-engine/src/rating-location.ts',
      'packages/prediction-engine/src/adapters/kajo-personal-rating-prospective.ts',
      'scripts/database/personal-rating-prospective.mjs'];
    const sources = await Promise.all(sourcePaths.map(async path => ({ path,
      sha256: createHash('sha256').update(await readFile(new URL('../../' + path, import.meta.url))).digest('hex') })));
    return { status: 'PASS', version: 'native-personal-rating-prospective-conformance-v1', origin: 'SYNTHETIC_DISPOSABLE_FIXTURE',
      cases, caseCount: cases.length, sources, actualForecast: 'COMPILED_TYPESCRIPT_COMMITTED_BEFORE_FIRST_ANSWER',
      firstAnswer: 'EXPLICIT_CLOSED_COMMAND_NOT_TIMESTAMP_INFERENCE', qualityAdmission: 'NONE', servingActivation: 'NONE',
      cleanup: 'CANONICAL_ROWS_RESTORED' };
  });
}
