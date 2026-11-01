import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { answer, auth, literal, personalRatingProspectiveCore, withPersonalRatingProspectiveFixture } from './personal-rating-prospective.mjs';

/** Logically read-only trusted worker. The existing inspector requires ordinary
 * READ COMMITTED plus lifecycle/Event locks, so this is not BEGIN READ ONLY.
 * It neither discovers credentials nor grants public access. All retained owner
 * allocations are returned, including tombstones; there is no window filter. */
export async function inspectPersonalRatingOwnerCensus(withSqlSession, request) {
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
  assert.ok(request && uuid(request.actorUserId) && uuid(request.profileId), 'Invalid numeric census owner');
  return withSqlSession(async exec => {
    await exec(`begin isolation level read committed;set local extra_float_digits=3;${auth(request.actorUserId)}`,
      { stage: 'personal-rating-census-begin' });
    try {
      await exec('select to_jsonb(private.lock_personal_rating_transaction_v1());', { stage: 'personal-rating-census-lock' });
      const owner = await exec(`select to_jsonb(p.id) from public.profiles p where p.id=${literal(request.profileId)}
        and p.owner_user_id=${literal(request.actorUserId)} and p.profile_type='PERSONAL' for update;`,
      { stage: 'personal-rating-census-owner' });
      assert.deepEqual(owner, [request.profileId], 'Numeric census owner unavailable');
      // Reject excess before constructing the full inspector payload. The
      // allowance covers allocation/current-state keys beyond retained JSON.
      const [budget] = await exec(`select jsonb_build_object('count',count(*),'bytes',coalesce(sum(
        octet_length(coalesce(i.preparation::text,''))+octet_length(coalesce(f.forecast::text,''))+
        octet_length(coalesce(r.result::text,''))+8192),0))
        from private.personal_rating_allocations a left join private.personal_rating_inputs i on i.id=a.id
        left join private.personal_rating_forecasts f on f.id=a.id left join private.personal_rating_answers r on r.forecast_id=a.id
        where a.actor_user_id=${literal(request.actorUserId)} and a.profile_id=${literal(request.profileId)};`,
      { stage: 'personal-rating-census-budget' });
      assert.ok(budget.count <= 128 && budget.bytes <= 16 * 1024 * 1024, 'Numeric census budget exceeded');
      const [census] = await exec(`select jsonb_build_object('version','kajo-personal-rating-owner-census-v1',
        'actorUserId',${literal(request.actorUserId)}::uuid,'profileId',${literal(request.profileId)}::uuid,
        'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'sourcePredictionId',a.source_prediction_id,
          'actorUserId',a.actor_user_id,'profileId',a.profile_id,'requestHash',a.request_hash,
          'inspection',private.inspect_personal_rating_forecast_v1(a.id)) order by a.id)
          from private.personal_rating_allocations a where a.actor_user_id=${literal(request.actorUserId)}
            and a.profile_id=${literal(request.profileId)}),'[]'::jsonb));`, { stage: 'personal-rating-census-inspections' });
      const [observedAtMicros] = await exec(`select to_jsonb((extract(epoch from clock_timestamp())*1000000)::bigint::text);`,
        { stage: 'personal-rating-census-clock' });
      census.observedAtMicros = observedAtMicros;
      assert.ok(Buffer.byteLength(JSON.stringify(census), 'utf8') <= 16 * 1024 * 1024, 'Numeric census output exceeded');
      await exec('commit;', { stage: 'personal-rating-census-commit' });
      return census;
    } catch (error) {
      await exec('rollback;', { stage: 'personal-rating-census-rollback' }).catch(() => {});
      throw error;
    }
  });
}

/** Same actual SQL producer/census/portable path on disposable PGlite/Postgres. */
export async function verifyPersonalRatingEvaluation(execSql, withSqlSession) {
  await personalRatingProspectiveCore();
  const { normalizeKajoPersonalRatingEvaluationInventory: normalize } = await import('../../packages/prediction-engine/dist/adapters/kajo-personal-rating-evaluation.js');
  const { buildPersonalRatingEvaluationReport: report } = await import('../../packages/prediction-engine/dist/personal-rating-evaluation.js');
  return withPersonalRatingProspectiveFixture(execSql, withSqlSession, async ({ f, one, exec, capture, command, call, publicAction, freshSource }) => {
    const captureFirst = async identity => {
      const source = await freshSource(identity, 'BOOK');
      const target = await one(`select to_jsonb(item_id) from private.prediction_candidates where prediction_id=${literal(source)}
        and selected_for_delivery order by final_rank,item_id limit 1;`, 'evaluation-first-target');
      return capture(target, { source, actor: identity.actor });
    };
    const first = await captureFirst(f), cold = await captureFirst(f.cold);
    const firstCommand = await command(first.preparation.targetItemId, 0, { source: first.preparation.sourcePredictionId });
    await call(answer(first.preparation.forecastId, firstCommand));
    await call(answer(cold.preparation.forecastId, await command(cold.preparation.targetItemId, 10, {
      actor: f.cold.actor, profile: f.cold.profile, session: f.cold.session, startedAt: f.cold.startedAt,
      source: cold.preparation.sourcePredictionId })), f.cold.actor);
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
    // Different owners may receive the same Item; assign stable Item aliases.
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
    const inventory = normalize(binding, await census());
    const start = BigInt(first.preparation.cutoffMicros) - 1n, end = start + 7200000000n;
    const cut = inventory.observedThroughMicros;
    const declaration = { version: 'personal-rating-evaluation-declaration-v1', cohortId: 'native:cohort',
      createdAtMicros: (start - 1n).toString(), origin: 'synthetic', roster: binding.roster.map(row => row.subjectId), domains: ['BOOK', 'MOVIE'],
      target: 'FIRST_REPORTED_RATING_EXPERIENCE_TIME_UNKNOWN', scale: { min: 0, max: 10 }, sourceVersions: binding.sourceVersions,
      targetSelection: 'FIRST_DELIVERED_ITEM', captureWindow: { startMicros: start.toString(), endMicros: (end + 18000000000n).toString() },
      horizonSeconds: 3600, cohortCap: 4096,
      windows: { DEVELOPMENT: { startMicros: start.toString(), endMicros: end.toString() },
        SELECTION: { startMicros: (end + 3600000000n).toString(), endMicros: (end + 7200000000n).toString() },
        FINAL: { startMicros: (end + 10800000000n).toString(), endMicros: (end + 14400000000n).toString() } },
      dataRole: 'DEVELOPMENT', checkpointsMicros: [first.preparation.cutoffMicros, cut], requirements: null };
    const evaluate = (value, checkpoint = cut) => {
      const { reconciliation, ...portable } = value; return { result: report(declaration, portable, checkpoint), reconciliation };
    };
    const historical = evaluate(inventory, first.preparation.cutoffMicros).result;
    assert.equal(historical.counts.firstAnswers, 0); assert.equal(historical.counts.pendingFirstReports, 1);
    const measured = evaluate(inventory).result;
    assert.equal(measured.status, 'DESCRIPTIVE_ONLY'); assert.equal(measured.counts.declaredProfiles, 3);
    assert.equal(measured.counts.participatingProfiles, 2); assert.equal(measured.counts.firstAnswers, 2);
    assert.equal(measured.counts.candidateForecastUnavailable, 1); assert.equal(measured.macro.candidate.mse, 49);
    assert.equal(measured.macro.candidate.mae, 7); assert.equal(measured.macro.candidate.bias, 7);
    assert.equal(measured.macro.paired.deltaMse, 0); assert.equal(measured.counts.currentRatingDifferentOrAbsent, 1);
    assert.equal(measured.byProfile.find(row => row.subjectId === 'native:zero').opportunities, 0);
    // Construct a fractional personal mean through the canonical public writer:
    // retained grades 8,6,9,0,0 give 4.6, whose decimal squared error at 3 is 2.56.
    const fractionalSource = await freshSource(f, 'BOOK');
    const fractionalTargets = await one(`select jsonb_agg(item_id order by final_rank,item_id) from
      (select item_id,final_rank from private.prediction_candidates where prediction_id=${literal(fractionalSource)}
        and selected_for_delivery order by final_rank,item_id limit 2) targets;`, 'evaluation-fractional-prefix');
    for (const target of fractionalTargets) await publicAction(await command(target, 0, { source: fractionalSource }));
    const extra = await captureFirst(f);
    await call(answer(extra.preparation.forecastId, await command(extra.preparation.targetItemId, 3,
      { source: extra.preparation.sourcePredictionId })));
    const extraCensus = await census();
    const fractionalBinding = { ...binding, opportunities: [...binding.opportunities, {
      ...binding.opportunities[0], opportunityId: 'native:fractional',
      sourcePredictionId: extra.preparation.sourcePredictionId, forecastId: extra.preparation.forecastId,
      targetItemId: extra.preparation.targetItemId, objectId: 'native:fractional-item',
      attemptedAtMicros: extra.preparation.cutoffMicros }] };
    const fractional = normalize(fractionalBinding, extraCensus);
    const fractionalAllocation = extraCensus.owners[0].allocations.find(row => row.id === extra.preparation.forecastId);
    const nativeSquared = fractionalAllocation.inspection.firstAnswer.measurement.candidateSquaredError;
    const retainedPoint = extra.forecast.forecasts[0].candidate.value;
    assert.notEqual(nativeSquared, (retainedPoint - 3) ** 2, 'Fixture must exercise SQL decimal versus JS double precision');
    assert.equal(fractional.complete, true); assert.equal(fractional.opportunities[2].firstAnswer.rating, 3);
    assert.deepEqual(normalize(fractionalBinding, extraCensus), fractional, 'Retained fractional replay must be stable');
    const changedMeasurement = structuredClone(extraCensus);
    changedMeasurement.owners[0].allocations.find(row => row.id === extra.preparation.forecastId)
      .inspection.firstAnswer.measurement.candidateSquaredError += 1e-6;
    assert.throws(() => normalize(fractionalBinding, changedMeasurement), /frozen measurement/);
    const extraInventory = normalize(binding, extraCensus);
    assert.equal(extraInventory.reconciliation.undeclaredAllocations, 1);
    assert.equal(evaluate(extraInventory).result.status, 'INCOMPLETE_INVENTORY');
    await exec(`begin;do $$begin perform private.erase_prediction_sources_v1('PREDICTION_RUN',
      ${literal(extra.preparation.sourcePredictionId)});end;$$;commit;`, 'evaluation-extra-erase');
    await exec(`begin;delete from public.events where id=${literal(firstCommand.actionId)};commit;`, 'evaluation-first-answer-withdrawal');
    const withdrawn = evaluate(normalize(binding, await census())).result;
    assert.equal(withdrawn.status, 'INVALIDATED_SOURCE_WITHDRAWAL'); assert.equal(withdrawn.macro.candidate.mse, null);
    assert.equal(withdrawn.counts.captureStatuses.SOURCE_WITHDRAWN_OR_OUTSIDE_PATH_REPORT, 1);
    await exec(`begin;do $$begin perform private.erase_prediction_sources_v1('PREDICTION_RUN',
      ${literal(first.preparation.sourcePredictionId)});end;$$;commit;`, 'evaluation-source-erase');
    const erased = normalize(binding, await census());
    assert.equal(erased.reconciliation.missingExpectedCaptures, 1); assert.equal(evaluate(erased).result.status, 'INCOMPLETE_INVENTORY');
    await assert.rejects(inspectPersonalRatingOwnerCensus(withSqlSession,
      { actorUserId: f.foreign.actor, profileId: f.profile }), /Numeric census owner unavailable/);
    assert.equal((await inspectPersonalRatingOwnerCensus(withSqlSession, binding.roster[1])).allocations.length, 1);
    const paths = ['scripts/database/personal-rating-evaluation.mjs', 'packages/prediction-engine/src/adapters/kajo-personal-rating-evaluation.ts',
      'packages/prediction-engine/src/personal-rating-evaluation.ts'];
    const sources = await Promise.all(paths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(new URL('../../' + path, import.meta.url))).digest('hex') })));
    return { status: 'PASS', version: 'native-personal-rating-evaluation-v1', origin: 'SYNTHETIC_DISPOSABLE_FIXTURE',
      retainedFirstGrade: 0, currentCorrectedGrade: 9, profileMacroMse: 49, profileMacroMae: 7, profileMacroBias: 7,
      pairedDeltaMse: 0, zeroOpportunityProfiles: 1, coldAnsweredWithoutForecast: 1, historicalFirstAnswers: 0,
      fractionalNativeMeasurement: 'SQL_DECIMAL_TOLERATED_REPLAYED_PERTURBATION_REJECTED',
      undeclaredInventory: 'INCOMPLETE', withdrawnSource: 'INVALIDATED', erasedExpectedCapture: 'MISSING_UNRESOLVED',
      ownerScope: 'ISOLATED_EMPTY_ROSTER_VALIDATED', sources, qualityAdmission: 'NONE', servingActivation: 'NONE', cleanup: 'CANONICAL_ROWS_RESTORED' };
  });
}
