import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { answer, auth, finalize, inspect, json, literal, prepare,
  withPersonalRatingProspectiveFixture } from './personal-rating-prospective.mjs';
import { MAPPING_REGISTRY, canonicalJson } from '../catalog/item-features.mjs';
import { inspectPersonalRatingOwnerCensus } from './personal-rating-evaluation.mjs';

export const prepareContent = (id, source, target, horizon = 3600, origin = 'synthetic', featureUse = null) =>
  `private.prepare_personal_rating_forecast_v2(${literal(id)},${literal(source)},${literal(target)},${horizon},${literal(origin)},${json(featureUse)})`;
export const finalizeContent = (id, forecast) =>
  `private.finalize_personal_rating_forecast_v2(${literal(id)},${json(forecast)})`;

let corePromise;
export async function personalContentRatingCore() {
  corePromise ??= (async () => {
    const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p',
      'packages/prediction-engine/tsconfig.build.json'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', timeout: 120_000,
    });
    assert.equal(build.status, 0, `Content rating build failed: ${build.stderr || build.stdout}`);
    const [adapter, core] = await Promise.all([
      import('../../packages/prediction-engine/dist/adapters/kajo-personal-content-rating.js'),
      import('../../packages/prediction-engine/dist/personal-content-rating.js'),
    ]);
    return { ...adapter, ...core };
  })();
  return corePromise;
}

/** One trusted native transaction retains source locks while actual portable
 * computation runs. No public RPC, client forecast, collection or admission. */
export async function capturePersonalContentRatingForecast(withSqlSession, request, hooks = {}) {
  const uuid = value => typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
  assert.ok(request && [request.actor, request.id, request.source, request.target].every(uuid), 'Invalid content capture UUID');
  assert.ok(Number.isInteger(request.horizon ?? 3600) && (request.horizon ?? 3600) >= 1
    && (request.horizon ?? 3600) <= 7776000, 'Invalid content capture horizon');
  assert.ok(['observed', 'synthetic'].includes(request.origin ?? 'observed'), 'Invalid content capture evidence origin');
  const { normalizeKajoPersonalContentRatingPrefix, forecastPersonalContentRating } = await personalContentRatingCore();
  return withSqlSession(async exec => {
    await exec(`begin;set local extra_float_digits=3;${auth(request.actor)}`, { stage: 'personal-content-rating-begin' });
    try {
      await hooks.beforePrepare?.({ exec });
      const [preparation] = await exec(`select ${prepareContent(request.id, request.source, request.target,
        request.horizon ?? 3600, request.origin ?? 'observed', request.featureUse ?? null)};`,
      { stage: 'personal-content-rating-prepare' });
      const forecast = preparation.forecast ?? forecastPersonalContentRating(
        normalizeKajoPersonalContentRatingPrefix(preparation.input));
      await hooks.beforeFinalize?.({ exec, preparation, forecast });
      const [stored] = await exec(`select ${finalizeContent(request.id, forecast)};`, { stage: 'personal-content-rating-finalize' });
      await hooks.beforeCommit?.({ exec, preparation, forecast, stored });
      await exec('commit;', { stage: 'personal-content-rating-commit' });
      return { preparation, forecast, stored };
    } catch (error) {
      await exec('rollback;', { stage: 'personal-content-rating-rollback' }).catch(() => {});
      throw error;
    }
  });
}

const sourceId = n => `a4051000-0000-4000-8000-${String(1000 + n).padStart(12, '0')}`;
const concepts = ['fantasy', 'horror', 'mystery', 'romance', 'science-fiction', 'thriller'];
const genres = [14, 27, 9648, 10749, 878, 53];
const subjects = ['Fantasy', 'Horror', 'Mystery', 'Romance', 'Science fiction', 'Thriller'];
function payloadFor(source, selected) {
  return source.providerKey === 'tmdb'
    ? { id: Number(source.providerItemId), genres: selected.map(concept => ({ id: genres[concepts.indexOf(concept)] })) }
    : { key: '/works/' + source.providerItemId, subject: selected.map(concept => subjects[concepts.indexOf(concept)]) };
}

/** All provider metadata and permission assertions below are invented for a
 * disposable synthetic fixture. They establish neither actual provider rights
 * nor permission to collect an observed owner cohort. */
export async function withPersonalContentRatingFixture(execSql, withSqlSession, run) {
  return withPersonalRatingProspectiveFixture(execSql, withSqlSession, async context => {
    const { f, exec, one, freshSource } = context;
    const targetIndex = new Map(f.targets.map((item, n) => [item, n]));
    const contentSources = f.items.map((itemId, n) => {
      const movie = n >= 26;
      const source = { id: sourceId(n), itemId, providerKey: movie ? 'tmdb' : 'open_library',
        providerItemId: movie ? String(405000 + n) : `OL${405000 + n}W`,
        namespace: movie ? 'tmdb_movie' : 'open_library_work' };
      return { ...source, payload: payloadFor(source, [concepts[(n < 2 ? n : targetIndex.get(itemId) ?? n) % 6]]) };
    });
    const clock = BigInt(await one(`select to_jsonb(floor(extract(epoch from clock_timestamp())*1000000)::text);`, 'content-clock'));
    const contentFeatureUse = { version: 'personal-content-feature-use-v1', purpose: 'PRIVATE_NATIVE_EVALUATION',
      origin: 'synthetic', reviewRef: 'synthetic-content-fixture-405',
      validFromMicros: String(clock - 86_400_000_000n), validUntilMicros: String(clock + 86_400_000_000n),
      retention: 'SOURCE_BOUND_UNTIL_WITHDRAWAL', sources: [
        { providerKey: 'open_library', evidenceKind: 'provider-subject', disposition: 'PERMITTED' },
        { providerKey: 'tmdb', evidenceKind: 'provider-genre', disposition: 'PERMITTED' },
      ] };
    try {
      await exec(`begin;
        insert into private.item_sources(id,item_id,provider_key,provider_item_id,source_url,source_hash,
          source_payload,created_at,updated_at,synced_at,source_updated_at) values ${contentSources.map(source =>
        `(${literal(source.id)},${literal(source.itemId)},${literal(source.providerKey)},${literal(source.providerItemId)},
          ${literal('https://fixture.invalid/catalog/' + source.providerItemId)},'synthetic-content-405',${json(source.payload)},
          clock_timestamp()-interval '1 minute',clock_timestamp()-interval '1 minute',
          clock_timestamp()-interval '1 minute',clock_timestamp()-interval '1 minute')`).join(',')};
        insert into private.item_external_ids(namespace,external_id,item_id,first_seen_provider,created_at,last_seen_at)
          values ${contentSources.map(source => `(${literal(source.namespace)},${literal(source.providerItemId)},
          ${literal(source.itemId)},${literal(source.providerKey)},clock_timestamp()-interval '1 minute',
          clock_timestamp()-interval '1 minute')`).join(',')};commit;`, 'content-source-fixture');
      const captures = new Map();
      const captureContent = async (target, options = {}, hooks) => {
        const id = options.id ?? randomUUID();
        const identity = options.identity ?? f;
        const domain = f.movieTargets.includes(target) ? 'MOVIE' : 'BOOK';
        const request = captures.get(id) ?? { id, actor: options.actor ?? identity.actor,
          source: options.source ?? await freshSource(identity, domain), target,
          horizon: options.horizon ?? 3600, origin: 'synthetic',
          featureUse: Object.hasOwn(options, 'featureUse') ? options.featureUse : contentFeatureUse };
        captures.set(id, request);
        return capturePersonalContentRatingForecast(withSqlSession, request, hooks);
      };
      const setContentSource = async (itemId, selected) => {
        const source = contentSources.find(row => row.itemId === itemId);
        assert.ok(source, 'Unknown content fixture Item');
        await exec(`begin;update private.item_sources set source_payload=${json(payloadFor(source, selected))},
          source_hash=${literal('synthetic-content-405-' + selected.join('-'))},synced_at=clock_timestamp()
          where id=${literal(source.id)};commit;`, 'content-source-update');
      };
      return await run({ ...context, contentFeatureUse, contentSources, captureContent, setContentSource });
    } finally {
      // Provider rows intentionally restrict Item deletion. Remove source-bound
      // derivatives through their actual lifecycle before the base fixture's
      // all-table canonical snapshot/cleanup comparison.
      await exec(`begin;delete from private.item_external_ids where item_id in(${f.items.map(literal).join(',')});
        delete from private.item_sources where item_id in(${f.items.map(literal).join(',')});commit;`, 'content-source-cleanup');
    }
  });
}

const point = (capture, objectId) => capture.forecast.forecasts.find(row => row.objectId === objectId);
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 1e-12,
  `${message}: expected ${expected}, got ${actual}`);

export async function verifyPersonalContentRating(execSql, withSqlSession) {
  const conformance = await withPersonalContentRatingFixture(execSql, withSqlSession, async context => {
    const { f, exec, one, call, capture, command, publicAction, rejected, freshSource,
      contentFeatureUse, contentSources, captureContent, setContentSource } = context;
    const cases = [];
    const rejectTamperedForecast = async (target, options, mutate, label) => {
      const id = randomUUID();
      let reachedFinalize = false;
      await assert.rejects(captureContent(target, { ...options, id }, {
        beforeFinalize: async ({ exec: connection, forecast }) => {
          const changed = structuredClone(forecast);
          mutate(changed);
          reachedFinalize = true;
          await connection(`select ${finalizeContent(id, changed)};`);
        },
      }));
      assert.equal(reachedFinalize, true, 'Tamper assertion must exercise the actual native finalizer');
      assert.equal(await one(`select count(*)::integer from private.personal_rating_allocations where id=${literal(id)};`,
        'content-rollback-allocation'), 0);
      cases.push({ name: label });
    };
    const { normalizeKajoPersonalContentRatingPrefix, forecastPersonalContentRating } = await personalContentRatingCore();
    const registry = await one('select private.personal_rating_content_mapping_v1();', 'content-registry');
    assert.deepEqual(registry, MAPPING_REGISTRY, 'Native projection must use the exact reviewed catalogue registry');
    const mappingHash = createHash('sha256').update(canonicalJson(registry)).digest('hex');
    for (const [index, change] of [[16, "synced_at=clock_timestamp()+interval '1 day'"],
      [17, `source_payload=jsonb_set(source_payload,'{subject}',${json(Array(129).fill('Fantasy'))})`],
      [18, `source_payload=jsonb_set(source_payload,'{subject}',${json(['Unreviewed synthetic subject'])})`]]) {
      await exec(`begin;update private.item_sources set ${change} where item_id=${literal(f.targets[index])};commit;`,
        'content-unavailable-source-fixture');
    }
    const missingSource = contentSources.find(row => row.itemId === f.targets[4]);
    await exec(`begin;delete from private.item_external_ids where namespace=${literal(missingSource.namespace)}
      and external_id=${literal(missingSource.providerItemId)};commit;`, 'content-unverified-identity');
    const first = await captureContent(f.targets[0]);
    const firstId = first.preparation.forecastId;
    assert.equal(first.forecast.version, 'personal-content-rating-v1');
    assert.equal(first.forecast.prior, null);
    assert.equal(first.forecast.location.personalMean, 7);
    assert.equal(first.forecast.prefix.support, 2);
    assert.equal(first.preparation.input.contentFeatures.mappingHash, mappingHash);
    assert.equal(first.forecast.contentFit.featureDimensions, 6);
    // Independent closed-form oracle: two one-hot labels (8,6), centered
    // covariance [[.5,-.5],[-.5,.5]], ridge 2 => beta=(1/3,-1/3).
    near(point(first, f.targets[0]).candidate.value, 7 + 1 / 3, 'Native content ridge oracle');
    near(point(first, f.targets[1]).candidate.value, 7 - 1 / 3, 'Independent opposite-content oracle');
    assert.equal(point(first, f.targets[0]).control.value, 7);
    assert.deepEqual(point(first, f.targets[0]), { ...point(first, f.targets[6]), objectId: f.targets[0] },
      'Identical supported content retains ties');
    assert.equal(point(first, f.targets[4]).candidate.value, 7, 'Unseen-only concepts retain the mean');
    const frozen = await call(inspect(firstId));
    assert.equal(frozen.firstAnswer, null);
    assert.equal(frozen.coverage, 'PENDING_FIRST_REPORT');
    cases.push({ name: 'actual-native-content-differentiation-independent-ridge-oracle',
      expectedFantasy: 7 + 1 / 3, expectedHorror: 7 - 1 / 3, control: 7,
      frozenSyntheticForecast: { origin: 'SYNTHETIC_DISPOSABLE_FIXTURE', input: first.preparation.input, forecast: first.forecast } });

    await rejected(prepare(firstId, first.preparation.sourcePredictionId, f.targets[0]), ['22023', '55000']);
    await rejected(finalize(firstId, first.forecast), ['22023', '55000']);
    await rejected(prepareContent(firstId, first.preparation.sourcePredictionId, f.targets[0], 3600, 'synthetic',
      { ...contentFeatureUse, reviewRef: 'changed-synthetic-review' }), ['22023']);
    const old = await capture(f.targets[23]);
    await rejected(prepareContent(old.preparation.forecastId, old.preparation.sourcePredictionId,
      f.targets[23], 3600, 'synthetic', contentFeatureUse), ['22023', '55000']);
    await rejected(finalizeContent(old.preparation.forecastId, old.forecast), ['22023', '55000']);
    assert.deepEqual((await capture(f.targets[23], { id: old.preparation.forecastId })).stored, old.stored);
    cases.push({ name: 'mixed-v1-v2-retries-retain-own-version-and-reject-reinterpretation' });

    await setContentSource(f.items[0], ['horror']);
    const later = await captureContent(f.targets[1]);
    assert.equal(point(later, f.targets[1]).candidate.value, 7, 'Identical training features cannot differentiate');
    assert.deepEqual(await call(inspect(firstId)), frozen, 'Later catalogue updates cannot rewrite frozen inputs');
    assert.deepEqual((await captureContent(f.targets[0], { id: firstId })).stored, first.stored);
    await setContentSource(f.items[0], ['fantasy']);
    cases.push({ name: 'later-feature-change-affects-future-capture-preserves-old-inputs' });

    const noPermission = await captureContent(f.targets[2], { featureUse: null });
    assert.ok(noPermission.forecast.forecasts.every(row => row.candidate.value === 7));
    const noMatchingPermission = await captureContent(f.targets[3], { featureUse: { ...contentFeatureUse,
      reviewRef: 'synthetic-content-fixture-unrelated-kind', sources: [contentFeatureUse.sources[1]] } });
    assert.ok(noMatchingPermission.forecast.forecasts.every(row => row.candidate.value === 7));
    cases.push({ name: 'null-and-unmatched-feature-permission-fall-back-to-mean' });

    const missing = await captureContent(f.targets[4]);
    assert.equal(point(missing, f.targets[4]).candidate.value, 7);
    cases.push({ name: 'missing-canonical-alias-fails-closed-without-dropping-target' });

    const unallocatedSource = await freshSource();
    for (const invalid of [{ ...contentFeatureUse, origin: 'observed' },
      { ...contentFeatureUse, reviewRef: 'x'.repeat(257) },
      { ...contentFeatureUse, validUntilMicros: contentFeatureUse.validFromMicros },
      { ...contentFeatureUse, sources: [{ ...contentFeatureUse.sources[0], disposition: 'UNKNOWN' }] }]) {
      await rejected(prepareContent(randomUUID(), unallocatedSource, f.targets[19], 3600, 'synthetic', invalid), ['22023']);
    }
    cases.push({ name: 'malformed-expired-or-unknown-explicit-rights-assertion-rejected' });

    for (const table of ['source', 'alias']) {
      const id = randomUUID(), source = await freshSource();
      const training = contentSources.find(row => row.itemId === f.items[0]);
      const update = table === 'source'
        ? `update private.item_sources set source_hash='same-transaction-fixture' where id=${literal(training.id)};`
        : `update private.item_external_ids set last_seen_at=clock_timestamp() where namespace=${literal(training.namespace)}
          and external_id=${literal(training.providerItemId)};`;
      const preparation = await one(`begin;${auth(f.actor)}${update}select ${prepareContent(id, source, f.targets[19],
        3600, 'synthetic', contentFeatureUse)};rollback;`, 'content-same-transaction-' + table);
      const trainingFeature = preparation.input.contentFeatures.objects.find(row => row.objectId === f.items[0]);
      assert.equal(trainingFeature.status, 'UNAVAILABLE', 'Uncommitted source input cannot enter a frozen feature prefix');
      assert.equal(trainingFeature.provenance, null);
    }
    cases.push({ name: 'same-transaction-source-and-alias-writes-are-not-committed-feature-evidence' });

    await rejectTamperedForecast(f.targets[19], {}, changed => { changed.forecasts[0].candidate.value += 0.125; },
      'native-finalizer-refuses-altered-point-and-worker-rolls-back-allocation');
    await rejectTamperedForecast(f.targets[19], {}, changed => { changed.contentFit.featureCoverage = 0.123; },
      'native-finalizer-refuses-altered-feature-coverage');
    await rejectTamperedForecast(f.targets[19], { featureUse: null }, changed => { changed.contentFit.featureMeans[0] = 0.125; },
      'native-finalizer-refuses-nonzero-means-without-feature-support');

    const firstCommand = await command(f.targets[0], 0, { source: first.preparation.sourcePredictionId });
    const measured = await call(answer(firstId, firstCommand));
    assert.equal(measured.rating, 0);
    near(measured.measurement.candidateSquaredError, (7 + 1 / 3) ** 2, 'First zero content error');
    assert.equal(measured.measurement.controlSquaredError, 49);
    assert.deepEqual(await call(answer(firstId, firstCommand)), measured);
    await publicAction(await command(f.targets[0], 9, { source: first.preparation.sourcePredictionId }));
    const corrected = await call(inspect(firstId));
    assert.deepEqual(corrected.preparation.forecast, frozen.preparation.forecast);
    assert.deepEqual(corrected.firstAnswer, measured);
    assert.equal(corrected.currentCanonicalState.rating, 9);
    cases.push({ name: 'first-zero-answer-correction-and-exact-retry-preserve-measurement' });

    for (let grade = 0; grade <= 10; grade++) {
      const target = f.targets[5 + grade];
      const result = await captureContent(target);
      assert.deepEqual(forecastPersonalContentRating(normalizeKajoPersonalContentRatingPrefix(result.preparation.input)), result.forecast,
        'Full replay must match the actual sequential capture before its new label');
      assert.ok(result.forecast.forecasts.every(row => row.candidate.value === null
        || (Number.isFinite(row.candidate.value) && row.candidate.value >= 0 && row.candidate.value <= 10)));
      const receipt = await call(answer(result.preparation.forecastId,
        await command(target, grade, { source: result.preparation.sourcePredictionId })));
      assert.equal(receipt.rating, grade);
      near(receipt.measurement.candidateSquaredError, (point(result, target).candidate.value - grade) ** 2,
        'Same held-out first answer is measured against the frozen content point');
      cases.push({ name: `grade-${grade}`, rating: receipt.rating, forecast: point(result, target).candidate.value });
    }

    const cold = await captureContent(f.coldTargets[0], { identity: f.cold });
    assert.equal(cold.forecast.prefix.support, 0);
    assert.equal(point(cold, f.coldTargets[0]).candidate.value, null);
    const coldAnswer = async (result, target) => call(answer(result.preparation.forecastId,
      await command(target, 5, { ...f.cold, source: result.preparation.sourcePredictionId })), f.cold.actor);
    await coldAnswer(cold, f.coldTargets[0]);
    const sparse = await captureContent(f.coldTargets[1], { identity: f.cold });
    assert.equal(sparse.forecast.prefix.support, 1);
    assert.ok(sparse.forecast.forecasts.every(row => row.candidate.value === 5));
    await coldAnswer(sparse, f.coldTargets[1]);
    const constant = await captureContent(f.coldTargets[2], { identity: f.cold });
    assert.equal(constant.forecast.prefix.support, 2);
    assert.ok(constant.forecast.forecasts.every(row => row.candidate.value === 5));
    cases.push({ name: 'cold-single-label-and-constant-grade-fallbacks' });
    await rejectTamperedForecast(f.coldTargets[3], { identity: f.cold }, changed => {
      assert.equal(changed.contentFit.status, 'CONSTANT_FEATURED_RATINGS');
      changed.contentFit.coefficients[0] = 0.125;
    }, 'native-finalizer-refuses-nonzero-constant-rating-coefficients');

    for (const [index, name] of [[16, 'future-source-clock'], [17, 'oversized-provider-array'], [18, 'unmapped-subject']]) {
      const result = await captureContent(f.targets[index]);
      const selected = point(result, f.targets[index]);
      assert.equal(selected.candidate.value, selected.control.value);
      assert.equal(result.preparation.input.contentFeatures.objects.find(row => row.objectId === f.targets[index]).status, 'UNAVAILABLE');
      cases.push({ name: `${name}-excluded-from-feature-evidence-with-mean-fallback` });
    }

    const movie = await captureContent(f.movieTargets[0]);
    assert.equal(movie.forecast.domainId, 'MOVIE');
    assert.equal(movie.forecast.prefix.support, 0, 'BOOK labels must not train a MOVIE target');
    cases.push({ name: 'canonical-tmdb-genre-source-and-domain-isolation' });

    await exec(`begin;delete from private.item_sources where item_id=${literal(f.items[0])};commit;`, 'content-source-withdrawal');
    const sourceWithdrawn = await call(inspect(firstId));
    assert.equal(sourceWithdrawn.status, 'WITHDRAWN');
    assert.equal(sourceWithdrawn.firstAnswer, null);
    assert.equal(sourceWithdrawn.preparation, null);
    assert.equal((await call(inspect(old.preparation.forecastId))).status, 'AVAILABLE', 'v1 does not acquire v2 feature dependencies');
    await rejected(prepareContent(firstId, first.preparation.sourcePredictionId, f.targets[0], 3600, 'synthetic', contentFeatureUse), ['55000']);
    const movieAlias = contentSources.find(row => row.itemId === f.movieTargets[0]);
    await exec(`begin;delete from private.item_external_ids where namespace=${literal(movieAlias.namespace)}
      and external_id=${literal(movieAlias.providerItemId)};commit;`, 'content-alias-withdrawal');
    assert.equal((await call(inspect(movie.preparation.forecastId))).status, 'WITHDRAWN');
    const reviewCapture = await captureContent(f.targets[20]);
    await call(`private.withdraw_personal_rating_content_review_v1(${literal(contentFeatureUse.reviewRef)})`, f.foreign.actor);
    assert.equal((await call(inspect(reviewCapture.preparation.forecastId))).status, 'AVAILABLE', 'Review withdrawal is owner-scoped');
    const revocation = await call(`private.withdraw_personal_rating_content_review_v1(${literal(contentFeatureUse.reviewRef)})`);
    assert.ok(revocation.retired >= 1);
    assert.equal((await call(inspect(reviewCapture.preparation.forecastId))).status, 'WITHDRAWN');
    await rejected(prepareContent(randomUUID(), await freshSource(), f.targets[21], 3600, 'synthetic', contentFeatureUse), ['55000']);
    assert.equal((await call(inspect(noPermission.preparation.forecastId))).status, 'AVAILABLE',
      'A capture with no content-use manifest has no review dependency');
    cases.push({ name: 'source-alias-and-owner-review-withdrawal-retire-copied-evidence-without-resurrection' });

    const budgetSource = await freshSource();
    const budget = await one(`begin;${auth(f.actor)}
      insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at)
        select gen_random_uuid(),${literal(f.actor)},${literal(f.profile)},${literal(f.items[0])},'BOOK','ITEM_RATED',
          '{"rating":5}',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour'
        from generate_series(1,8193);
      do $budget$ declare rejected text;begin
        begin perform ${prepareContent(randomUUID(), budgetSource, f.targets[21], 3600, 'synthetic', null)};
        exception when others then rejected:=sqlstate;end;
        if rejected is distinct from '54000' then raise exception 'Expected bounded native dependency rejection, got %',rejected;end if;
        perform set_config('kajo.content_budget_rejected',rejected,true);end;$budget$;
      select to_jsonb(current_setting('kajo.content_budget_rejected'));rollback;`, 'content-dependency-budget');
    assert.equal(budget, '54000', 'Oversized complete dependency history must reject before preparing or fitting');
    cases.push({ name: '8193-raw-dependencies-reject-before-feature-copy-or-fit' });

    const sourcePaths = ['packages/prediction-engine/src/personal-content-rating.ts',
      'packages/prediction-engine/src/adapters/kajo-personal-content-rating.ts',
      'scripts/database/personal-content-rating.mjs', 'scripts/database/personal-rating-evaluation.mjs',
      'packages/prediction-engine/src/adapters/kajo-personal-rating-evaluation.ts',
      'packages/prediction-engine/src/personal-rating-evaluation.ts'];
    const sources = await Promise.all(sourcePaths.map(async path => ({ path,
      sha256: createHash('sha256').update(await readFile(new URL('../../' + path, import.meta.url))).digest('hex') })));
    return { status: 'PASS', version: 'native-personal-content-rating-conformance-v1',
      origin: 'SYNTHETIC_DISPOSABLE_FIXTURE', cases, caseCount: cases.length, sources,
      actualForecast: 'COMPILED_TYPESCRIPT_COMMITTED_BEFORE_FIRST_ANSWER',
      qualityAdmission: 'NONE', servingActivation: 'NONE', cleanup: 'CANONICAL_ROWS_RESTORED' };
  });
  const evaluation = await verifyPersonalContentRatingEvaluation(execSql, withSqlSession);
  const serviceRole = await verifyPersonalContentRatingServiceRole(execSql, withSqlSession);
  const cases = [...conformance.cases, { name: 'actual-content-census-profile-macro-report-and-global-withdrawal', ...evaluation }, ...serviceRole];
  const result = { ...conformance, cases, caseCount: cases.length };
  assert.ok(Buffer.byteLength(JSON.stringify(result), 'utf8') <= 1024 * 1024,
    'Complete synthetic conformance/report receipts must remain within one MiB');
  return result;
}

/** Independent second fixture: the declared report admits only the first
 * actually delivered target for each owner. Numerical/lifecycle test captures
 * above deliberately do not masquerade as an eligible evaluation cohort. */
export async function verifyPersonalContentRatingEvaluation(execSql, withSqlSession) {
  await personalContentRatingCore();
  const { normalizeKajoPersonalRatingEvaluationInventory: normalize } = await import('../../packages/prediction-engine/dist/adapters/kajo-personal-rating-evaluation.js');
  const { buildPersonalRatingEvaluationReport: report } = await import('../../packages/prediction-engine/dist/personal-rating-evaluation.js');
  return withPersonalContentRatingFixture(execSql, withSqlSession, async context => {
    const { f, exec, one, call, command, publicAction, freshSource, captureContent, setContentSource } = context;
    const captureFirst = async identity => {
      const source = await freshSource(identity);
      const target = await one(`select to_jsonb(item_id) from private.prediction_candidates where prediction_id=${literal(source)}
        and selected_for_delivery order by final_rank,item_id limit 1;`, 'content-evaluation-first-target');
      return captureContent(target, { source, identity });
    };
    const first = await captureFirst(f), cold = await captureFirst(f.cold);
    assert.equal(first.preparation.targetItemId, f.targets[0]);
    const firstCommand = await command(first.preparation.targetItemId, 0, { source: first.preparation.sourcePredictionId });
    await call(answer(first.preparation.forecastId, firstCommand));
    await call(answer(cold.preparation.forecastId, await command(cold.preparation.targetItemId, 10,
      { ...f.cold, source: cold.preparation.sourcePredictionId })), f.cold.actor);
    await publicAction(await command(first.preparation.targetItemId, 9, { source: first.preparation.sourcePredictionId }));
    const binding = { origin: 'synthetic', horizonSeconds: 3600,
      sourceVersions: { source: first.forecast.prefix.sourceVersion, model: first.forecast.version,
        control: 'personal-domain-mean-v1:PERSONAL_MEAN' },
      roster: [{ actorUserId: f.actor, profileId: f.profile, subjectId: 'native:subject' },
        { actorUserId: f.cold.actor, profileId: f.cold.profile, subjectId: 'native:cold' },
        { actorUserId: f.foreign.actor, profileId: f.foreign.profile, subjectId: 'native:zero' }],
      opportunities: [first, cold].map((captured, index) => ({ opportunityId: `native:opportunity-${index}`,
        actorUserId: captured.preparation.input.actorUserId, profileId: captured.preparation.input.profile.id,
        sourcePredictionId: captured.preparation.sourcePredictionId, forecastId: captured.preparation.forecastId,
        targetItemId: captured.preparation.targetItemId, objectId: 'native:target', domainId: 'BOOK',
        attemptedAtMicros: captured.preparation.cutoffMicros, captureStatus: 'CAPTURED' })) };
    const itemAliases = new Map();
    for (const opportunity of binding.opportunities) {
      if (!itemAliases.has(opportunity.targetItemId)) itemAliases.set(opportunity.targetItemId, `native:item-${itemAliases.size}`);
      opportunity.objectId = itemAliases.get(opportunity.targetItemId);
    }
    const census = async () => {
      const owners = [];
      for (const member of binding.roster) owners.push(await inspectPersonalRatingOwnerCensus(withSqlSession, member));
      return { version: 'kajo-personal-rating-census-v1', observedAtMicros: owners.at(-1).observedAtMicros, owners };
    };
    const measuredCensus = await census();
    const inventory = normalize(binding, measuredCensus);
    const start = BigInt(first.preparation.cutoffMicros) - 1n, end = start + 7_200_000_000n;
    const cut = inventory.observedThroughMicros;
    const declaration = { version: 'personal-rating-evaluation-declaration-v1', cohortId: 'native:content-cohort',
      createdAtMicros: String(start - 1n), origin: 'synthetic', roster: binding.roster.map(row => row.subjectId), domains: ['BOOK', 'MOVIE'],
      target: 'FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN', scale: { min: 0, max: 10 }, sourceVersions: binding.sourceVersions,
      targetSelection: 'FIRST_DELIVERED_ITEM', captureWindow: { startMicros: String(start), endMicros: String(end + 18_000_000_000n) },
      horizonSeconds: 3600, cohortCap: 4096,
      windows: { DEVELOPMENT: { startMicros: String(start), endMicros: String(end) },
        SELECTION: { startMicros: String(end + 3_600_000_000n), endMicros: String(end + 7_200_000_000n) },
        FINAL: { startMicros: String(end + 10_800_000_000n), endMicros: String(end + 14_400_000_000n) } },
      dataRole: 'DEVELOPMENT', checkpointsMicros: [first.preparation.cutoffMicros, cut], requirements: null };
    const evaluate = (value, checkpoint = cut) => {
      const { reconciliation, ...portable } = value;
      return report(declaration, portable, checkpoint);
    };
    const historical = evaluate(inventory, first.preparation.cutoffMicros);
    assert.equal(historical.counts.firstAnswers, 0);
    const measured = evaluate(inventory);
    assert.equal(measured.status, 'DESCRIPTIVE_ONLY');
    assert.equal(measured.counts.firstAnswers, 2);
    assert.equal(measured.counts.currentRatingDifferentOrAbsent, 1);
    assert.equal(measured.counts.candidateForecastUnavailable, 1);
    assert.equal(measured.byProfile.find(row => row.subjectId === 'native:zero').opportunities, 0);
    near(measured.macro.candidate.mse, (7 + 1 / 3) ** 2, 'Independent content Profile-macro MSE');
    near(measured.macro.candidate.mae, 7 + 1 / 3, 'Independent content Profile-macro MAE');
    near(measured.macro.candidate.bias, 7 + 1 / 3, 'Independent content Profile-macro bias');
    assert.equal(measured.macro.control.mse, 49);
    near(measured.macro.paired.deltaMse, (7 + 1 / 3) ** 2 - 49, 'Preserved losing fixture comparison');
    await setContentSource(f.items[0], ['horror']);
    const updated = evaluate(normalize(binding, await census()));
    assert.deepEqual(updated.macro, measured.macro, 'Evaluation reads retained forecasts and never rescores mutable catalogue metadata');
    await exec(`begin;delete from private.item_sources where item_id=${literal(f.items[0])};commit;`, 'content-evaluation-withdrawal');
    const withdrawn = evaluate(normalize(binding, await census()));
    assert.equal(withdrawn.status, 'INVALIDATED_SOURCE_WITHDRAWAL');
    assert.equal(withdrawn.macro.candidate.mse, null);
    assert.equal(withdrawn.macro.control.mse, null);
    assert.equal(withdrawn.macro.paired.deltaMse, null);
    await exec(`begin;do $$begin perform private.erase_prediction_sources_v1('PREDICTION_RUN',
      ${literal(first.preparation.sourcePredictionId)});end;$$;commit;`, 'content-evaluation-source-erasure');
    const erased = normalize(binding, await census());
    assert.equal(erased.reconciliation.missingExpectedCaptures, 1);
    assert.equal(evaluate(erased).status, 'INCOMPLETE_INVENTORY');
    return { status: 'PASS', profileMacroMse: measured.macro.candidate.mse,
      profileMacroMae: measured.macro.candidate.mae, profileMacroBias: measured.macro.candidate.bias,
      controlMse: 49, pairedDeltaMse: measured.macro.paired.deltaMse,
      withdrawnReport: withdrawn.status, erasedReport: 'INCOMPLETE_INVENTORY',
      frozenSyntheticEvaluation: { origin: 'SYNTHETIC_DISPOSABLE_FIXTURE', binding, declaration,
        census: measuredCensus, inventory, report: measured },
      qualityAdmission: 'NONE', servingActivation: 'NONE' };
  });
}

/** Provider ingest already writes as service_role. Keeping private evidence
 * tables closed must not revoke that existing source lifecycle permission. */
async function verifyPersonalContentRatingServiceRole(execSql, withSqlSession) {
  return withPersonalContentRatingFixture(execSql, withSqlSession, async context => {
    const { f, exec, one, call, contentSources, captureContent } = context;
    assert.equal(await one(`select to_jsonb(rolbypassrls) from pg_roles where rolname='service_role';`, 'content-service-role'), true);
    const permissions = await one(`select jsonb_build_object(
      'sources',has_table_privilege('service_role','private.personal_rating_content_source_refs','SELECT'),
      'aliases',has_table_privilege('service_role','private.personal_rating_content_alias_refs','SELECT'),
      'reviews',has_table_privilege('service_role','private.personal_rating_content_review_revocations','SELECT'),
      'trigger',has_function_privilege('service_role','private.withdraw_personal_rating_content_source_v1()','EXECUTE'));`,
    'content-service-private-permissions');
    assert.deepEqual(permissions, { sources: false, aliases: false, reviews: false, trigger: false });
    const cases = [];
    for (const referenced of [false, true]) for (const kind of ['source', 'alias']) for (const operation of ['delete', 'reassign']) {
      const capture = await captureContent(f.targets[cases.length]);
      const fixtureSource = contentSources.find(row => row.itemId === (referenced ? f.items[0] : f.movieTargets[0]));
      const table = kind === 'source' ? 'private.item_sources' : 'private.item_external_ids';
      const predicate = kind === 'source' ? `id=${literal(fixtureSource.id)}`
        : `namespace=${literal(fixtureSource.namespace)} and external_id=${literal(fixtureSource.providerItemId)}`;
      const original = await one(`select to_jsonb(r) from ${table} r where ${predicate};`, 'content-provider-original');
      const destination = referenced ? f.items[1] : f.movieTargets[1];
      const mutation = operation === 'delete' ? `delete from ${table} where ${predicate};`
        : `update ${table} set item_id=${literal(destination)} where ${predicate};`;
      await exec(`begin;set local role service_role;${mutation}commit;`, 'content-service-' + kind + '-' + operation);
      const after = await call(inspect(capture.preparation.forecastId));
      assert.equal(after.status, referenced ? 'WITHDRAWN' : 'AVAILABLE');
      if (referenced) {
        assert.equal(after.preparation, null);
        assert.equal(after.firstAnswer, null);
      }
      await exec(`begin;set local role service_role;${operation === 'delete'
        ? `insert into ${table} select * from jsonb_populate_record(null::${table},${json(original)});`
        : `update ${table} set item_id=${literal(original.item_id)} where ${predicate};`}commit;`,
      'content-service-source-restoration');
      assert.equal((await call(inspect(capture.preparation.forecastId))).status, referenced ? 'WITHDRAWN' : 'AVAILABLE',
        'Restoring catalogue identity cannot resurrect a retired frozen copy');
      cases.push({ name: `service-role-${referenced ? 'referenced' : 'unreferenced'}-${kind}-${operation}`,
        evidenceTablesReadable: false, status: after.status });
    }
    return cases;
  });
}
