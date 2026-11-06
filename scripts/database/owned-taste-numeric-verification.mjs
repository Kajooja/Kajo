import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withPersonalContentRatingFixture } from './personal-content-rating.mjs';
import { captureOwnedTasteNumericForecast, finalizeOwnedTaste } from './owned-taste-numeric-capture.mjs';
import { auth, json, literal, inspect, answer } from './personal-rating-prospective.mjs';

/** Disposable committed fixtures only; source-shaped provider metadata is synthetic. */
export async function withOwnedTasteNumericFixture(exec, withSession, run) {
  return withPersonalContentRatingFixture(exec, withSession, async context => {
      const { f, one, call, freshSource, contentFeatureUse } = context;
      await exec(`update public.items set metadata=jsonb_build_object('coldStartRecognition',0.8,
        'coldStartPriorSource','KAJO_CURATED_RECOGNITION'),
        tags=array['owned-rating-'||(right(id::text,3)::integer%4)::text,'shared-feature']
        where id in(${f.items.map(literal).join(',')});`);
      const rpc = request => one(`begin;${auth(f.actor)}set local role authenticated;
        select public.taste_session_v2(${json(request)});commit;`, 'owned-taste-rpc');
      const cmd = (s, operation, extra = {}) => ({ operation, profileId: f.profile, sessionId: s.sessionId,
        requestId: randomUUID(), expectedRevision: s.revision, ...extra });
      let state = await rpc({ operation: 'START', profileId: f.profile, requestId: randomUUID() });
      try {
      const questions = [];
      for (const rating of [0, 10]) {
        await exec('do $$begin perform pg_sleep(0.002);end;$$;');
        state = await rpc(cmd(state, 'NEXT'));
        assert.equal(state.status, 'QUESTION', JSON.stringify(state));assert.equal(state.currentItem.itemType, 'MOVIE');
        questions.push({ questionId: state.questionId, itemId: state.currentItem.id });
        await exec('do $$begin perform pg_sleep(0.002);end;$$;');
        state = await rpc(cmd(state, 'ANSWER', { questionId: state.questionId, answer: { kind: 'RATING', value: rating } }));
      }
      const request = async (domain = 'MOVIE', target) => {
        const source = await freshSource(f, domain);
        target ??= await one(`select to_jsonb(item_id) from private.prediction_candidates where prediction_id=${literal(source)}
          and selected_for_delivery order by final_rank limit 1;`, 'owned-target');
        return { id: randomUUID(), actor: f.actor, source, target, origin: 'synthetic', featureUse: contentFeatureUse };
      };
      return await run({ ...context, state, questions, rpc, cmd, request });
      } finally {
        await call(`private.remove_sequential_taste_v2(${literal(state.sessionId)})`);
        await exec(`delete from private.sequential_taste_sessions where id=${literal(state.sessionId)};`);
      }
    });
}

export async function verifyOwnedTasteNumericCapture(exec, withSession) {
  return withOwnedTasteNumericFixture(exec, withSession, async ({ f, one, call, command, captureContent, state, questions, rpc, cmd, request }) => {
    const old = await captureContent(f.targets[0]);
      const movieRequest = await request();
      const captured = await captureOwnedTasteNumericForecast(withSession, movieRequest);
      assert.equal(captured.preparation.version, 'kajo-personal-content-rating-preparation-v2');
      assert.equal(captured.forecast.prefix.sourceId, 'kajo-owned-native-and-taste-ratings');
      assert.equal(captured.forecast.prefix.support, 2);
      assert.equal(captured.forecast.location.personalMean, 5);
      assert.equal(captured.forecast.contentFit.status, 'FITTED');
      assert.deepEqual(captured.preparation.input.labels.map(row => row.bootstrap.rating).sort((a, b) => a - b), [0, 10]);
      assert.ok(captured.forecast.prefix.ratings.every(row => row.sourceEventId.startsWith('taste:')));
      assert.equal(captured.forecast.servingActivation, 'NONE');
      assert.deepEqual((await captureOwnedTasteNumericForecast(withSession, movieRequest)).stored, captured.stored);

      const bookRequest = await request('BOOK', f.targets[1]);
      const unrelated = await captureOwnedTasteNumericForecast(withSession, bookRequest);
      assert.equal(unrelated.forecast.prefix.support, 2);
      assert.ok(unrelated.preparation.input.labels.every(row => row.sourceStatus === 'NATIVE_RATING'));
      const malformed = await request('MOVIE');
      // This target is already retained, so choose the other delivered target.
      malformed.target = await one(`select to_jsonb(item_id) from private.prediction_candidates where prediction_id=${literal(malformed.source)}
        and selected_for_delivery and item_id<>${literal(movieRequest.target)} order by final_rank limit 1;`, 'owned-second-target');
      assert.ok(malformed.target);
      await assert.rejects(captureOwnedTasteNumericForecast(withSession, malformed, {
        beforeFinalize: async ({ exec: connection, forecast }) => {
          const tampered = structuredClone(forecast);tampered.prefix.ratings[0].value = 6;
          await connection(`select ${finalizeOwnedTaste(malformed.id, tampered)};`);
        },
      }), /differs from native input binding/);
      assert.equal(await one(`select count(*)::integer from private.personal_rating_allocations where id=${literal(malformed.id)};`, 'owned-rollback'), 0);
      const answeredCapture = await captureOwnedTasteNumericForecast(withSession, malformed);
      const firstCommand = await command(malformed.target, 6, { source: malformed.source });
      const firstAnswer = await call(answer(malformed.id, firstCommand));
      assert.equal(firstAnswer.coverage, 'MEASURED_FIRST_RATING');
      assert.equal(firstAnswer.rating, 6);
      assert.equal(firstAnswer.measurement.controlSquaredError, (answeredCapture.forecast.location.personalMean - 6) ** 2);
      assert.deepEqual(await call(answer(malformed.id, firstCommand)), firstAnswer, 'First-answer retry must be exact');

      // A correction is a real committed owner command, not a fabricated Event.
      state = await rpc(cmd(state, 'CORRECT', { questionId: questions[0].questionId, answer: { kind: 'RATING', value: 4 } }));
      assert.equal((await call(inspect(movieRequest.id))).status, 'WITHDRAWN');
      assert.equal((await call(inspect(malformed.id))).firstAnswer, null, 'Source withdrawal must retire dependent first-answer copies');
      await assert.rejects(captureOwnedTasteNumericForecast(withSession, movieRequest), /withdrawn/);
      assert.deepEqual((await captureOwnedTasteNumericForecast(withSession, bookRequest)).stored, unrelated.stored);
      assert.deepEqual((await captureContent(f.targets[0], { id: old.preparation.forecastId })).stored, old.stored);
      return { status: 'PASS', actualTasteRatings: [0, 10], actualForecastMean: 5, oldGenerationRetry: 'EXACT',
        correction: 'DEPENDENT_NEW_CAPTURE_RETIRED', unrelatedDomain: 'PRESERVED', qualityAdmission: 'NONE', servingActivation: 'NONE' };

  });
}
