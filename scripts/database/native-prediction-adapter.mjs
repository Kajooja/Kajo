import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nativeCandidateRequestFixtureSql } from './native-candidate-request.mjs';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

let implementation;
async function adapter() {
  if (!implementation) {
    // Both database tests and the native CLI job run before the engine build.
    const built = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p',
      'packages/prediction-engine/tsconfig.build.json'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', timeout: 120_000,
    });
    assert.equal(built.status, 0, `Native prediction adapter build failed: ${built.stderr || built.stdout}`);
    implementation = Promise.all([
      import('../../packages/prediction-engine/dist/adapters/kajo-native-prediction.js'),
      import('../../packages/prediction-engine/dist/ranking-conformance.js'),
    ]).then(([native, generic]) => ({ ...native, ...generic }));
  }
  return implementation;
}

function nativeCasesSql(sourcesSql) {
  return `(select jsonb_agg(jsonb_build_object('name',s.name,
    'scope',jsonb_build_object('profile',case when p.profile_type='PERSONAL' then
      jsonb_build_object('id',p.id,'type',p.profile_type,'ownerUserId',p.owner_user_id) else
      jsonb_build_object('id',p.id,'type',p.profile_type,'memberUserIds',
        (select jsonb_agg(m.user_id order by m.user_id) from public.profile_members m where m.profile_id=p.id)) end,
      'user',jsonb_build_object('id',r.actor_user_id),'sessionId',coalesce(r.session_id::text,'')),
    'sourceRun',to_jsonb(r),'sourceGenome',to_jsonb(g),
    'sourceCandidates',(select coalesce(jsonb_agg(to_jsonb(c) order by c.final_rank),'[]'::jsonb) from private.prediction_candidates c where c.prediction_id=r.id),
    'evaluationReceipt',s.evaluation_receipt,
    'replay',case when r.result_count>0 then
      (select jsonb_build_object('kind','BASELINE_SHADOW_WORKER','sourcePredictionId',sr.source_prediction_id,'run',to_jsonb(sr),
        'rows',(select jsonb_agg(jsonb_build_object('itemId',c.item_id,'score',c.shadow_score,'rank',c.shadow_rank,
          'sourceRank',c.source_rank,'sourceScore',c.source_score,'productionRank',c.production_final_rank,
          'productionScore',c.production_final_score,'scenarioScore',c.scenario_score,
          'inputs',c.explanation#>'{input,productionExplanation}',
          'eligible',(c.explanation#>>'{resurfacingPolicy,eligible}')::boolean,
          'tier',private.prediction_delivery_tier_v1(c.explanation->'resurfacingPolicy'),'selected',c.hypothetical_selected)
          order by c.shadow_rank) from private.shadow_prediction_candidates c where c.shadow_prediction_id=sr.id))
        from private.shadow_prediction_runs sr where sr.source_prediction_id=r.id and sr.genome_id=r.genome_id)
      else (select jsonb_build_object('kind','FROZEN_SCORE_HELPER','sourcePredictionId',r.id,
        'rows',coalesce(jsonb_agg(jsonb_build_object('itemId',c.item_id,'score',c.score,'rank',c.rank,'eligible',c.eligible,
          'sourceRank',c.source_rank,'sourceScore',c.source_score,'productionRank',c.final_rank,
          'productionScore',c.final_score,'scenarioScore',c.scenario_score,'inputs',c.explanation,
          'tier',c.tier,'selected',false) order by c.rank),'[]'::jsonb)) from (
          select x.*,row_number() over(order by tier,score desc,item_id)::integer rank from (
            select c.*,private.prediction_candidate_score_v2(r.discovery_mode,c.explanation#>'{finalScoringInput,explanation}',
              (c.explanation#>>'{finalScoringInput,scenarioScore}')::double precision,g.config) score,
              (c.explanation#>>'{resurfacingPolicy,eligible}')::boolean eligible,
              private.prediction_delivery_tier_v1(c.explanation->'resurfacingPolicy') tier
            from private.prediction_candidates c where c.prediction_id=r.id) x) c) end
    ) order by s.name) from (${sourcesSql}) s join private.prediction_runs r on r.id=s.prediction_id
      join public.profiles p on p.id=r.profile_id join private.predictor_genomes g on g.id=r.genome_id)`;
}

function nativeReplayView(sample, actual) {
  assert.equal(sample.replay.sourcePredictionId, sample.sourceRun.id);
  assert.deepEqual(sample.replay.rows.map(r => r.itemId).sort(), actual.candidates.map(c => c.objectId).sort());
  if (sample.replay.kind === 'BASELINE_SHADOW_WORKER') {
    const run = sample.replay.run, original = sample.sourceRun;
    for (const key of ['profile_id', 'actor_user_id', 'session_id', 'genome_id', 'requested_item_type',
      'discovery_mode', 'context', 'state_snapshot', 'candidate_count']) assert.deepEqual(run[key], original[key], `Shadow run ${key}`);
    assert.equal(run.as_of, original.requested_at);
    assert.equal(run.source_model_version, original.model_version);
    assert.equal(run.source_policy_version, original.policy_version);
    assert.equal(run.hypothetical_result_count, original.result_count);
    // The replay producer was versioned forward; the immutable baseline
    // registry intentionally retains its original code/feature identifiers.
    assert.equal(run.code_version, 'shadow-replay-v2');
    assert.equal(run.feature_version, 'prediction-features-v2');
    for (const key of ['memory_version', 'outcome_version', 'reward_version']) {
      assert.equal(run[key], sample.sourceGenome[key], `Shadow artifact ${key}`);
    }
  }
  const candidates = sample.replay.rows.map(row => {
    const frozen = sample.sourceCandidates.find(c => c.item_id === row.itemId);
    for (const [replayed, stored] of [['sourceRank', 'source_rank'], ['sourceScore', 'source_score'],
      ['productionRank', 'final_rank'], ['productionScore', 'final_score'], ['scenarioScore', 'scenario_score']]) {
      assert.equal(row[replayed], frozen[stored], `Shadow candidate ${stored}`);
    }
    assert.deepEqual(row.inputs, frozen.explanation, 'Replay must retain the exact frozen production inputs');
    return { ...actual.candidates.find(c => c.objectId === row.itemId), sourceScore: row.sourceScore,
      sourceRank: row.sourceRank, score: row.score, rank: row.rank, eligible: row.eligible, tier: row.tier, selected: row.selected };
  });
  return { ...actual, candidates, constraints: { ...actual.constraints,
    allowedActionIds: candidates.filter(c => c.eligible).map(c => c.actionId) } };
}

export async function verifyNativeSharedPreparedCases(execSql, sourcesSql) {
  const { normalizeKajoNativePrediction, compareFrozenRankings } = await adapter();
  const [fixture] = await execSql(`begin read only;set local extra_float_digits=3;
    select jsonb_build_object('observedAt',clock_timestamp(),'cases',${nativeCasesSql(sourcesSql)});rollback;`,
  { stage: 'shared-prepared-native-adapter' });
  const normalize = sample => normalizeKajoNativePrediction({ ...sample, snapshotObservedAt: fixture.observedAt,
    source: { kind: 'generator', id: 'shared-prepared-native', version: '1', parentRefs: [] } });
  let comparedCandidates = 0, maxAbsoluteScoreDifference = 0;
  for (const sample of fixture.cases) {
    const actual = normalize(sample);
    const replay = nativeReplayView(sample, actual);
    const comparison = compareFrozenRankings(actual, replay, { absoluteTolerance: 1e-12 });
    assert.equal(comparison.conforms, true, JSON.stringify(comparison.mismatches));
    assert.equal(actual.candidates.length, 1);
    assert.equal(actual.candidates[0].selected, false);
    comparedCandidates += comparison.comparedCandidates;
    maxAbsoluteScoreDifference = Math.max(maxAbsoluteScoreDifference, comparison.maxAbsoluteScoreDifference);
    for (const mutate of [
      x => { delete x.sourceRun.state_snapshot.sharedPreparedInput; },
      x => { x.sourceRun.state_snapshot.sharedPreparedInput.inputCaptureId = randomUUID(); },
      x => { x.sourceRun.state_snapshot.finalScoringInput.sharedPreparedInput.featureInputDigest = '0'.repeat(32); },
      x => { x.sourceRun.state_snapshot.sharedPreparedInput.targetItemId = randomUUID(); },
      x => { x.sourceRun.state_snapshot.sharedPreparedInput.predictorConsumption = 'NOT_RECORDED'; },
      x => { x.scope.profile.id = randomUUID(); },
      x => { x.scope.profile.memberUserIds = [randomUUID(), randomUUID()]; },
    ]) {
      const invalid = structuredClone(sample); mutate(invalid); assert.throws(() => normalize(invalid));
    }
    const changed = structuredClone(replay); changed.candidates[0].score += 1e-6;
    assert.equal(compareFrozenRankings(actual, changed, { absoluteTolerance: 1e-12 }).conforms, false);
  }
  return { status: 'PASS', version: 'shared-prepared-native-conformance-v1', cases: fixture.cases.length,
    comparedCandidates, maxAbsoluteScoreDifference, absoluteTolerance: 1e-12,
    identityEligibilityRanksSelection: 'EXACT', predictiveQuality: 'NOT_EVALUATED' };
}

// Real current SQL produces every source, feature, score and replay below. The
// data are synthetic and the entire exercise rolls back, including replay jobs.
export async function nativePredictionAdapterFixtureSql() {
  return `begin;
-- Match precision-preserving page owners; rounded legacy captures are rejected.
-- Scope this to the rollback-only fixture and restore the caller on exit.
set local extra_float_digits=3;
${await nativeCandidateRequestFixtureSql()}
create temp table adapter_sources(name text primary key, prediction_id uuid, evaluation_receipt jsonb) on commit drop;
create temp table adapter_preserved(body jsonb) on commit drop;
create temp table adapter_continuation(prediction_id uuid) on commit drop;
do $native_adapter$
declare actor uuid:='ab157000-0000-4000-8000-000000000001'; personal uuid;
  shared uuid:='ab157000-0000-4000-8000-000000000900';
  session uuid:='ab157000-0000-4000-8000-000000000810';
  shared_session uuid:='ab157000-0000-4000-8000-000000000811';
  origin uuid:=gen_random_uuid(); prediction uuid; receipt jsonb; page jsonb; request jsonb;
  replay jsonb; invalid_item uuid; invalid_case integer;
begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select id into strict personal from public.profiles where owner_user_id=actor and profile_type='PERSONAL';
  insert into public.event_sessions(id,actor_user_id,profile_id,started_at,created_at,context) values
    (session,actor,personal,now()-interval '5 minutes',now()-interval '5 minutes','{}'),
    (shared_session,actor,shared,now()-interval '5 minutes',now()-interval '5 minutes','{}');
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at,session_id)
    values(gen_random_uuid(),actor,personal,'ab157000-0000-4000-8000-000000000101','MOVIE','ITEM_RATED','{"rating":4}',
      now()-interval '2 minutes',now()-interval '2 minutes',session);
  perform * from private.rank_items_with_identity_v1(origin,personal,'FOR_YOU','MOVIE',50,jsonb_build_object('sessionId',session));
  if not exists(select 1 from private.prediction_candidates where prediction_id=origin
    and item_id='ab157000-0000-4000-8000-000000000106' and selected_for_delivery) then
    raise exception 'Native adapter Scenario fixture lacks actual delivered origin';end if;
  update private.prediction_runs set requested_at=now()-interval '3 hours',created_at=now()-interval '3 hours' where id=origin;
  -- This disposable origin is deliberately backdated to seed Scenario history.
  -- Keep its new marker consistent with that fixture clock; measured sources
  -- below are never rewritten after capture.
  update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,requestedAt}',to_jsonb(requested_at))
    where id=origin and state_snapshot ? 'finalScoringInput';
  insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,properties,occurred_at,created_at,prediction_id)
    select gen_random_uuid(),actor,personal,'ab157000-0000-4000-8000-000000000106','MOVIE',kind,body,
      now()-interval '2 hours',now()-interval '2 hours',origin
    from (values('ITEM_IMPRESSION','{}'::jsonb),('ITEM_RATED','{"rating":9}'::jsonb)) e(kind,body);
  prediction:=gen_random_uuid();
  perform * from private.rank_items_with_identity_v1(prediction,personal,'FOR_YOU','MOVIE',20,jsonb_build_object('sessionId',session));
  insert into adapter_sources values('personal-legacy',prediction,null);
  prediction:=gen_random_uuid();
  perform * from private.rank_items_catalog_with_identity_v1(array['ab157000-0000-4000-8000-000000000100']::uuid[],true,
    prediction,personal,'RISK','MOVIE',5,jsonb_build_object('sessionId',session));
  insert into adapter_sources values('personal-catalogue',prediction,null);
  prediction:=gen_random_uuid();
  receipt:=private.capture_personal_evaluation_v1(prediction,personal,
    array['ab157000-0000-4000-8000-000000000101','ab157000-0000-4000-8000-000000000121',
      'ab157000-0000-4000-8000-000000000102','ab157000-0000-4000-8000-000000000104',
      'ab157000-0000-4000-8000-000000000999']::uuid[],now()-interval '1 second',jsonb_build_object('sessionId',session));
  insert into adapter_sources values('personal-explicit',prediction,receipt);
  prediction:=gen_random_uuid();
  receipt:=private.capture_personal_evaluation_v1(prediction,personal,
    array['ab157000-0000-4000-8000-000000000999']::uuid[],now()-interval '1 second','{}');
  insert into adapter_sources values('personal-empty-no-session',prediction,receipt);
  prediction:=gen_random_uuid();
  perform * from private.rank_items_with_identity_v1(prediction,shared,'SURPRISE','MOVIE',5,jsonb_build_object('sessionId',shared_session));
  insert into adapter_sources values('shared-legacy',prediction,null);
  prediction:=gen_random_uuid();
  perform * from private.rank_items_catalog_with_identity_v1(array['ab157000-0000-4000-8000-000000000120']::uuid[],false,
    prediction,shared,'FOR_YOU','BOOK',5,jsonb_build_object('sessionId',shared_session));
  insert into adapter_sources values('shared-catalogue',prediction,null);
  if not exists(select 1 from private.prediction_candidates c join adapter_sources s on s.prediction_id=c.prediction_id
    where c.scenario_support>0 and c.scenario_score<>0) then
    raise exception 'Native adapter fixture did not exercise a nonzero Scenario contribution';end if;
  -- Retained protocol-2 pages are an unsupported generation, not fresh inputs.
  request:=jsonb_build_object('version',2,'requestId',gen_random_uuid(),'profileId',personal,'sessionId',session,
    'discoveryMode','FOR_YOU','itemType','MOVIE','limit',5,'context','{}'::jsonb);
  page:=public.rank_items_page_v1(request);
  if page->>'nextCursor' is null then raise exception 'Native adapter continuation fixture is exhausted';end if;
  page:=public.rank_items_page_v1(request||jsonb_build_object('requestId',gen_random_uuid(),'cursor',page->'nextCursor'));
  insert into adapter_continuation values((page->>'predictionId')::uuid);
  for prediction in select prediction_id from adapter_sources union all select prediction_id from adapter_continuation loop
    if not private.validate_native_final_source_v1(prediction) then
      raise exception 'Native adapter source lacks the new FINAL input'; end if;
  end loop;
  -- Native PostgreSQL executes these same rollback-only invalid-source controls.
  -- Include an unselected candidate: a valid delivered subset is insufficient.
  select prediction_id into strict prediction from adapter_sources where name='personal-legacy';
  select item_id into strict invalid_item from private.prediction_candidates
    where prediction_id=prediction and not selected_for_delivery order by final_rank desc limit 1;
  for invalid_case in 1..4 loop
    begin
      if invalid_case=1 then
        update private.prediction_runs set state_snapshot=state_snapshot-'finalScoringInput' where id=prediction;
      elsif invalid_case=2 then
        update private.prediction_candidates set explanation=explanation-'finalScoringInput'
          where prediction_id=prediction and item_id=invalid_item;
      elsif invalid_case=3 then
        update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,sourceGenome,config}','{}')
          where id=prediction;
      else
        update private.prediction_candidates set explanation=jsonb_set(explanation,'{finalScoringInput,extra}',to_jsonb(repeat('x',2097153)))
          where prediction_id=prediction and item_id=invalid_item;
      end if;
      begin
        perform private.validate_native_final_source_v1(prediction);
        raise exception 'Native FINAL input accepted invalid control %',invalid_case;
      exception when invalid_parameter_value then null; end;
      raise exception 'Rollback deliberate invalid source' using errcode='Z0001';
    exception when sqlstate 'Z0001' then null; end;
  end loop;
  insert into adapter_preserved select jsonb_build_object('runs',
    (select jsonb_agg(to_jsonb(r) order by r.id) from private.prediction_runs r join adapter_sources s on s.prediction_id=r.id),
    'candidates',(select jsonb_agg(to_jsonb(c) order by c.prediction_id,c.item_id)
      from private.prediction_candidates c join adapter_sources s on s.prediction_id=c.prediction_id));
  insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
    select r.id,r.genome_id from private.prediction_runs r join adapter_sources s on s.prediction_id=r.id
    where r.result_count>0 on conflict do nothing;
  update public.items set tags=array['later-catalogue'],discoverable=false where id::text like 'ab157000-%';
  replay:=private.process_shadow_prediction_jobs_v1(250);
  if (replay->>'failed')::integer<>0 or (replay->>'processed')::integer<4 then
    raise exception 'Native adapter frozen baseline replay failed: %',replay;end if;
  if (select body from adapter_preserved) is distinct from jsonb_build_object('runs',
    (select jsonb_agg(to_jsonb(r) order by r.id) from private.prediction_runs r join adapter_sources s on s.prediction_id=r.id),
    'candidates',(select jsonb_agg(to_jsonb(c) order by c.prediction_id,c.item_id)
      from private.prediction_candidates c join adapter_sources s on s.prediction_id=c.prediction_id)) then
    raise exception 'Native adapter replay changed frozen source records';end if;
end;$native_adapter$;
select jsonb_build_object('observedAt',clock_timestamp(),'frozenPreserved',true,
  'finalInputValidation',jsonb_build_object('version','native-final-scoring-input-v1','sources',7,'rejectionControls',4),
  'floatSerializationDigits',current_setting('extra_float_digits')::integer,
  'cases',${nativeCasesSql('select * from adapter_sources')},
  'continuation',(select jsonb_build_object('sourceRun',to_jsonb(r),
    'sourceGenome',(select to_jsonb(g) from private.predictor_genomes g where g.id=r.genome_id),
    'sourceCandidates',(select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c where c.prediction_id=r.id))
    from private.prediction_runs r join adapter_continuation a on a.prediction_id=r.id)) snapshot;
rollback;`;
}

export async function verifyNativePredictionAdapter(exec) {
  const { normalizeKajoNativePrediction, compareFrozenRankings } = await adapter();
  let fixture;
  try { [fixture] = await exec(await nativePredictionAdapterFixtureSql(), {
    stage: 'native-prediction-adapter-frozen-baseline-conformance', timeoutMs: 120_000,
  }); } catch (error) {
    await exec('rollback;', { stage: 'native-prediction-adapter-cleanup' }).catch(() => {});
    throw error;
  }
  const source = { kind: 'generator', id: 'native-prediction-adapter-fixture', version: '1', parentRefs: [] };
  const options = { absoluteTolerance: 1e-12 };
  const normalize = sample => normalizeKajoNativePrediction({ ...sample, source, snapshotObservedAt: fixture.observedAt });

  assert.equal(fixture.frozenPreserved, true);
  assert.deepEqual(fixture.finalInputValidation, { version: 'native-final-scoring-input-v1', sources: 7, rejectionControls: 4 });
  assert.equal(fixture.cases.length, 6);
  let comparedCandidates = 0, maxAbsoluteScoreDifference = 0, scenarioCandidates = 0;
  const normalized = [];
  for (const sample of fixture.cases) {
    let actual;
    try { actual = normalize(sample); }
    catch (error) { throw new Error(`Native adapter fixture ${sample.name}: ${error.stack ?? error}`, { cause: error }); }
    const replay = nativeReplayView(sample, actual);
    const comparison = compareFrozenRankings(actual, replay, options);
    assert.equal(comparison.conforms, true, `${sample.name}: ${JSON.stringify(comparison.mismatches)}`);
    comparedCandidates += comparison.comparedCandidates;
    maxAbsoluteScoreDifference = Math.max(maxAbsoluteScoreDifference, comparison.maxAbsoluteScoreDifference);
    scenarioCandidates += sample.sourceCandidates.filter(c => c.scenario_support > 0 && c.scenario_score !== 0).length;
    if (sample.evaluationReceipt) {
      assert.deepEqual(sample.evaluationReceipt.items.map(i => i.itemId), actual.acquisition.requestedObjectIds);
      assert.ok(sample.evaluationReceipt.items.some(i => i.status === 'UNAVAILABLE'));
      if (sample.name === 'personal-empty-no-session') {
        assert.deepEqual(actual.candidates, []);
        assert.equal(actual.sessionBinding, null);
      } else assert.ok(actual.candidates.some(c => c.eligible));
      assert.ok(actual.candidates.every(c => !c.selected));
      for (const item of sample.evaluationReceipt.items) {
        const candidate = actual.candidates.find(c => c.objectId === item.itemId);
        assert.equal(item.status === 'AVAILABLE', candidate?.eligible === true);
        if (item.status === 'AVAILABLE') assert.equal(item.score, candidate.score);
        else assert.equal(item.score, null);
      }
    }
    normalized.push({ sample, actual, replay });
  }
  assert.ok(scenarioCandidates > 0);
  const { sample, actual, replay } = normalized.find(row => row.sample.name === 'personal-legacy');
  assert.ok(actual.candidates.some(c => c.eligible && c.tier === 1), 'Actual source must retain its saved reminder tier');
  assert.ok(actual.candidates.some(c => !c.eligible && c.tier === 2), 'Actual source must retain suppressed candidates');
  const changedScore = structuredClone(replay); changedScore.candidates[0].score += 1e-6;
  assert.equal(compareFrozenRankings(actual, changedScore, options).conforms, false);
  for (const key of ['context', 'state_snapshot']) {
    const changedInput = structuredClone(replay); changedInput.inputSnapshot[key].unreviewed = true;
    assert.equal(compareFrozenRankings(actual, changedInput, options).conforms, false);
  }
  const rejectsComparison = value => {
    let result;
    try { result = compareFrozenRankings(actual, value, options); }
    catch (error) { assert.equal(error.name, 'RankingConformanceError'); return; }
    assert.equal(result.conforms, false);
  };
  const changedEligibility = structuredClone(replay); changedEligibility.candidates[0].eligible = !changedEligibility.candidates[0].eligible;
  rejectsComparison(changedEligibility);
  const missing = structuredClone(replay); missing.candidates.pop();
  rejectsComparison(missing);
  const mutated = callback => { const copy = structuredClone(sample); callback(copy); return copy; };
  for (const invalid of [
    mutated(x => { x.replay.run.source_policy_version = 'different-policy'; }),
    mutated(x => { x.replay.run.profile_id = 'ab157000-0000-4000-8000-000000000999'; }),
    mutated(x => { x.replay.rows[0].sourceScore += 1; }),
    mutated(x => { x.replay.rows[0].inputs.scoringFeatures.longTerm += 1; }),
  ]) assert.throws(() => nativeReplayView(invalid, actual), assert.AssertionError);
  for (const invalid of [
    mutated(x => { x.sourceCandidates[0].prediction_id = 'ab157000-0000-4000-8000-000000000999'; }),
    mutated(x => { x.sourceCandidates[0].final_score = Infinity; }),
    mutated(x => { x.sourceRun.candidate_count += 1; }),
    mutated(x => { x.sourceCandidates[0].final_rank = 2; }),
    mutated(x => { x.sourceCandidates[0].selected_for_delivery = false; }),
    mutated(x => { x.sourceCandidates[0].explanation.scalarGenome.genomeId = 'ab157000-0000-4000-8000-000000000999'; }),
    mutated(x => { x.sourceCandidates[0].explanation.scoringFeatures.version = 'future-features'; }),
    mutated(x => { x.sourceCandidates[0].explanation.scoringFeatures.nativeEvidenceAsOf = '2000-01-01T00:00:00Z'; }),
    mutated(x => { x.sourceCandidates[0].explanation.candidatePool.version = 'future-pool'; }),
    mutated(x => { x.sourceCandidates[0].explanation.candidatePool.eligibilityAt = '2999-01-01T00:00:00Z'; }),
    mutated(x => { x.sourceRun.state_snapshot.candidateRequest.version = 'future-request'; }),
    mutated(x => { x.sourceRun.state_snapshot.predictionInput.commitVisibility = 'CERTIFIED'; }),
    mutated(x => { x.sourceRun.state_snapshot.predictionInput.nativeEvidenceAsOf = '2999-01-01T00:00:00Z'; }),
    mutated(x => { x.sourceRun.state_snapshot.predictionInput.requestAsOf = '2000-01-01T00:00:00Z'; }),
    mutated(x => { x.sourceGenome.id = 'ab157000-0000-4000-8000-000000000999'; }),
  ]) assert.throws(() => normalize(invalid));
  assert.match(fixture.continuation.sourceRun.policy_version, /frozen-page-v1/);
  assert.equal(fixture.continuation.sourceRun.state_snapshot.finalScoringInput.computation, 'FROZEN_PAGE_REUSE');
  assert.throws(() => normalize({ ...sample, ...fixture.continuation }));
  assert.equal(fixture.floatSerializationDigits, 3);
  return { status: 'PASS', version: 'native-prediction-adapter-conformance-v1',
    scope: 'FROZEN_SAME_POLICY_BASELINE', source: 'SYNTHETIC_FIXTURE_NATIVE_SQL',
    floatSerializationDigits: fixture.floatSerializationDigits, clockAdmission: 'EXACT_STORED_CLOCKS',
    finalInputValidation: fixture.finalInputValidation,
    cases: fixture.cases.map(s => ({ name: s.name, replay: s.replay.kind,
      recomputed: s.replay.kind === 'BASELINE_SHADOW_WORKER' ? 'SCORE_RANK_ELIGIBILITY_SELECTION' : 'SCORE_RANK' })),
    comparedCandidates, scenarioCandidates, absoluteTolerance: options.absoluteTolerance, maxAbsoluteScoreDifference,
    identityEligibilityRanksSelection: 'EXACT', retainedReplayMetadataAndInputs: 'EXACT_SOURCE_BINDING',
    frozenAfterCatalogMutation: true,
    evaluationUnavailableAndNonDelivery: true, emptyPoolAndAbsentSession: true,
    negativeControls: 'SCORE_ELIGIBILITY_POOL_RANK_SELECTION_SOURCE_CLOCK_VERSION_GENOME_CONTINUATION',
    historicalReconstruction: 'UNAVAILABLE', predictiveQuality: 'NOT_EVALUATED', cleanup: 'ROLLED_BACK' };
}

const sqlLiteral = value => "'" + String(value).replaceAll("'", "''") + "'";
const jsonLiteral = value => sqlLiteral(JSON.stringify(value)) + '::jsonb';

// Independent captures have distinct IDs. Rebind only validated self-references
// for comparison, never scope, clocks, state, inputs, ranks or scores. The
// persisted records and both original normalized captures remain untouched.
function bindCaptureIdentity(ranking, reference) {
  const predictionId = reference.predictionId;
  const result = structuredClone(ranking), original = result.predictionId;
  assert.notEqual(original, predictionId);
  assert.equal(result.provenance.record.recordId, original);
  assert.equal(result.inputSnapshot.id, original);
  const marker = result.inputSnapshot.state_snapshot.finalScoringInput;
  assert.equal(marker.computation, 'FRESH_FINAL');
  assert.equal(marker.predictionId, original);
  assert.equal(marker.featureSourcePredictionId, original);
  result.predictionId = result.provenance.record.recordId = result.inputSnapshot.id = predictionId;
  marker.predictionId = marker.featureSourcePredictionId = predictionId;
  const working = result.inputSnapshot.state_snapshot.workingState;
  const targetWorking = reference.inputSnapshot.state_snapshot.workingState;
  const captureId = working.captureId;
  for (const capture of [working, targetWorking]) {
    assert.deepEqual(capture.refs, {
      scopeId: 'native-working:' + capture.captureId, subjectRef: 'native-working:' + capture.captureId + ':subject',
      actorRef: 'native-working:' + capture.captureId + ':actor', sessionRef: 'native-working:' + capture.captureId + ':session',
    }, 'Working aliases must belong to their own validated capture');
  }
  working.captureId = targetWorking.captureId;
  working.refs = structuredClone(targetWorking.refs);
  for (const candidate of result.candidates) {
    assert.equal(candidate.inputs.sourcePredictionId, original);
    assert.equal(candidate.inputs.explanation.finalScoringInput.predictionId, original);
    candidate.inputs.sourcePredictionId = candidate.inputs.explanation.finalScoringInput.predictionId = predictionId;
    for (const explanation of [candidate.inputs.explanation, candidate.inputs.explanation.finalScoringInput.explanation]) {
      assert.equal(explanation.workingIntent.captureId, captureId);
      assert.equal(explanation.workingIntent.candidateFeatures.captureId, captureId);
      explanation.workingIntent.captureId = explanation.workingIntent.candidateFeatures.captureId = targetWorking.captureId;
    }
  }
  return result;
}

// Both original captures must pass native receipt admission first. Keep the
// complete comparison result: independently observed global snapshots need not
// be equal even when the same exact receipt is visible in both. Do not rebind
// either witness, or label that pair as full-input conformance. Every other
// contract field, computation input, candidate and score must still match.
function receiptComparisonBoundary(comparison) {
  if (comparison.conforms) return 'EXACT_INPUT';
  assert.deepEqual(comparison.mismatches, [
    { kind: 'contract', path: '$.inputSnapshot.state_snapshot.finalScoringInput.nativeV4Receipt.entrySnapshot' },
    { kind: 'contract', path: '$.inputSnapshot.state_snapshot.nativeV4Receipt.entrySnapshot' },
  ], 'Independent evaluation may differ only in its two validated receipt witnesses');
  return 'SCORING_INPUTS_MATCH_RECEIPT_WITNESSES_DIFFER';
}

// PGlite and the disposable native CLI stack execute the same verifier. START,
// NEXT and ANSWER commit separately; no backdated receipts or clock overrides
// can stand in for the current public V4 command path.
export async function verifyNativeTasteConsumer(execSql) {
  const { normalizeKajoNativePrediction, compareFrozenRankings } = await adapter();
  const exec = (sql, stage) => execSql(sql, { stage: 'native-taste-consumer-' + stage, timeoutMs: 120_000 });
  const one = async (sql, stage) => (await exec(sql, stage))[0];
  const id = n => 'ab157000-0000-4000-8000-' + String(n).padStart(12, '0');
  const actors = [id(1), id(2), id(3)], controlActor = id(4);
  const source = { kind: 'generator', id: 'native-taste-consumer-fixture', version: '1', parentRefs: [] };
  const tolerance = { absoluteTolerance: 1e-12 };
  const command = (s, operation, extra = {}) => ({ operation, profileId: s.profileId, sessionId: s.sessionId,
    requestId: randomUUID(), expectedRevision: s.revision, ...extra });
  const call = (actor, request) => one('begin;set local extra_float_digits=3;'
    + 'set local request.jwt.claim.sub=' + sqlLiteral(actor) + ';set local role authenticated;'
    + 'select public.taste_session_v2(' + jsonLiteral(request) + ');commit;', 'committed-command');
  const session = state => one('select to_jsonb(s) from private.sequential_taste_sessions s where id='
    + sqlLiteral(state.sessionId) + ';', 'session');
  const frozen = predictionId => one("begin read only;set local extra_float_digits=3;select jsonb_build_object('run',to_jsonb(r),'candidates',"
    + "(select jsonb_agg(to_jsonb(c) order by c.item_id) from private.prediction_candidates c where c.prediction_id=r.id),"
    + "'panel',(select to_jsonb(p) from private.sequential_taste_panels p where p.id=r.id),"
    + "'pool',(select to_jsonb(p) from private.sequential_taste_candidate_pools_v4 p where p.panel_id=r.id))"
    + ' from private.prediction_runs r where r.id=' + sqlLiteral(predictionId) + ';rollback;', 'retained-source');
  let fixture = false, snapshots, original, failure;
  const observations = [], comparisons = [], boundaries = [], receiptComparisons = [];
  const capture = async (actor, state, label) => {
    const parent = await session(state), next = command(state, 'NEXT');
    const feed = { version: 3, requestId: randomUUID(), profileId: state.profileId, sessionId: state.sessionId,
      discoveryMode: 'FOR_YOU', itemType: 'MOVIE', limit: 5, context: {}, cursor: null, replacesChainId: null };
    const output = await exec('begin;set local extra_float_digits=3;set local request.jwt.claim.sub=' + sqlLiteral(actor)
      + ';do $assign$ begin perform pg_current_xact_id();end;$assign$;'
      // Independent fresh capture precedes NEXT, while the exact parent receipt
      // is still current. Both consume their own command-entry visibility input.
      + `select private.capture_personal_evaluation_v1(gen_random_uuid(),` + sqlLiteral(state.profileId) + `,
          array(select (c->>'id')::uuid from jsonb_array_elements(private.taste_candidate_catalog_v4(`
      + sqlLiteral(state.sessionId) + `,now())) c order by c->>'id'),`
      + sqlLiteral(parent.receipt_at) + `::timestamptz,
          jsonb_build_object('sessionId',` + sqlLiteral(state.sessionId) + `::uuid,
            'nativeV4Receipt',private.capture_native_v4_receipt_v1(` + sqlLiteral(state.sessionId) + `,pg_current_snapshot())));`
      + 'set local role authenticated;select public.taste_session_v2(' + jsonLiteral(next) + ');reset role;'
      + 'set local role authenticated;select public.rank_items_feed_v1(' + jsonLiteral(feed) + ');reset role;'
      + `select jsonb_build_object('predictionId',p.prediction_id,
          'receiptMatches',(r.state_snapshot#>>'{candidateRequest,requiredAfter}')::timestamptz=`
      + sqlLiteral(parent.receipt_at) + `::timestamptz,
          'separateTransaction',p.captured_transaction<>` + sqlLiteral(parent.receipt_transaction) + `::text,
          'afterReceipt',p.captured_at>` + sqlLiteral(parent.receipt_at) + `::timestamptz)
        from private.sequential_taste_sessions s join private.sequential_taste_panels p
          on p.id=(s.presentations#>>'{-1,poolId}')::uuid
        join private.prediction_runs r on r.id=p.prediction_id where s.id=` + sqlLiteral(state.sessionId) + ';commit;',
    label + '-next-and-controls');
    assert.equal(output.length, 4);
    const [evaluation, question, discovery, binding] = output;
    assert.equal(question.status, 'QUESTION');
    assert.deepEqual(binding, { predictionId: binding.predictionId,
      receiptMatches: true, separateTransaction: true, afterReceipt: true });
    const refs = [['taste', binding.predictionId], ['evaluation', evaluation.predictionId], ['discovery', discovery.predictionId]];
    assert.equal(new Set(refs.map(([, predictionId]) => predictionId)).size, 3);
    const rows = refs.map(([name, predictionId]) => 'select ' + sqlLiteral(name) + ' name,'
      + sqlLiteral(predictionId) + '::uuid prediction_id,null::jsonb evaluation_receipt').join(' union all ');
    const replayed = await exec(`begin;set local extra_float_digits=3;
      insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
        select id,genome_id from private.prediction_runs where id=` + sqlLiteral(discovery.predictionId) + ` on conflict do nothing;
      select private.process_shadow_prediction_jobs_v1(250);
      select jsonb_build_object('observedAt',clock_timestamp(),'cases',` + nativeCasesSql(rows) + ');commit;',
    label + '-frozen-replay');
    assert.equal(replayed[0].failed, 0);
    const snapshot = replayed[1];
    assert.equal(snapshot.cases.length, 3);
    const samples = Object.fromEntries(snapshot.cases.map(sample => {
      const actual = normalizeKajoNativePrediction({ ...sample, source, snapshotObservedAt: snapshot.observedAt });
      const comparison = compareFrozenRankings(actual, nativeReplayView(sample, actual), tolerance);
      assert.equal(comparison.conforms, true, label + '/' + sample.name + ': ' + JSON.stringify(comparison.mismatches));
      comparisons.push(comparison);
      return [sample.name, { sample, actual }];
    }));
    const { actual: taste } = samples.taste, { actual: explicit } = samples.evaluation, { actual: delivery } = samples.discovery;
    const comparison = compareFrozenRankings(taste, bindCaptureIdentity(explicit, taste), tolerance);
    const boundary = receiptComparisonBoundary(comparison);
    receiptComparisons.push({ label, boundary, fullInputConforms: comparison.conforms,
      tasteEntrySnapshot: taste.inputSnapshot.state_snapshot.nativeV4Receipt.entrySnapshot,
      evaluationEntrySnapshot: explicit.inputSnapshot.state_snapshot.nativeV4Receipt.entrySnapshot,
      mismatches: comparison.mismatches });
    comparisons.push(comparison);
    // Rebinding self-references must not hide a different scope, clock or input.
    for (const mutate of [
      value => { value.clocks.evidenceAsOf += 1; },
      value => { value.scope.actingIdentityRef = id(999); },
      value => { value.candidates[0].score += 1e-6; },
      value => { value.candidates[0].inputs.explanation.scoringFeatures.longTerm += 1; },
      value => { value.inputSnapshot.state_snapshot.nativeV4Receipt.receiptRevision += 1; },
    ]) {
      const invalid = bindCaptureIdentity(explicit, taste); mutate(invalid);
      assert.throws(() => receiptComparisonBoundary(compareFrozenRankings(taste, invalid, tolerance)),
        /only in its two validated receipt witnesses/u);
    }
    // Deterministic synthetic COPY controls exercise this boundary even when a
    // quiet PGlite/native run happens to produce identical original snapshots.
    // These copies never count as observations, forecasts or native witnesses.
    const witnessCopy = structuredClone(samples.evaluation.sample);
    const copiedState = witnessCopy.sourceRun.state_snapshot;
    let cutoff = BigInt(copiedState.nativeV4Receipt.receiptTransaction) + 1n;
    if (`${cutoff}:${cutoff}:` === taste.inputSnapshot.state_snapshot.nativeV4Receipt.entrySnapshot) cutoff++;
    const compareWitnessCopy = witness => {
      copiedState.nativeV4Receipt.entrySnapshot = copiedState.finalScoringInput.nativeV4Receipt.entrySnapshot = witness;
      const admitted = normalizeKajoNativePrediction({ ...witnessCopy, source, snapshotObservedAt: snapshot.observedAt });
      return compareFrozenRankings(taste, bindCaptureIdentity(admitted, taste), tolerance);
    };
    const differentWitness = compareWitnessCopy(`${cutoff}:${cutoff}:`);
    assert.equal(differentWitness.conforms, false);
    assert.equal(receiptComparisonBoundary(differentWitness), 'SCORING_INPUTS_MATCH_RECEIPT_WITNESSES_DIFFER');
    assert.throws(() => compareWitnessCopy('1:1:'), /incompatible-snapshots/u);
    const retained = await frozen(taste.predictionId);
    assert.equal(retained.panel.session_id, state.sessionId);
    assert.equal(retained.panel.prefix_revision, state.revision);
    const receiptInput = retained.run.state_snapshot.nativeV4Receipt;
    assert.equal(receiptInput.version, 'native-v4-receipt-v1');
    assert.equal(receiptInput.profileId, state.profileId);
    assert.equal(receiptInput.actorUserId, actor);
    assert.equal(receiptInput.sessionId, state.sessionId);
    assert.equal(receiptInput.receiptRevision, state.revision);
    assert.equal(receiptInput.receiptTransaction, parent.receipt_transaction);
    assert.equal(Date.parse(receiptInput.receiptAt), Date.parse(parent.receipt_at));
    assert.equal(receiptInput.forecastTransaction, retained.panel.captured_transaction);
    assert.deepEqual(retained.run.state_snapshot.finalScoringInput.nativeV4Receipt, receiptInput);
    assert.equal(retained.panel.frozen.requiredReceiptRevision, state.revision);
    assert.equal(String(retained.panel.frozen.requiredReceiptTransaction), String(parent.receipt_transaction));
    assert.deepEqual(retained.pool.catalog.map(item => item.id).sort(), [...taste.acquisition.requestedObjectIds].sort());
    assert.equal(retained.pool.invalidated, false);
    assert.equal(retained.panel.invalidated, false);
    const currentSession = await session(question);
    assert.equal(currentSession.policy, 'CANONICAL_FORECAST_POOL_V4');
    assert.ok(taste.candidates.some(candidate => candidate.objectId === question.currentItem.id));
    assert.ok(taste.candidates.every(candidate => !candidate.selected));
    for (const item of retained.panel.frozen.items) {
      const candidate = taste.candidates.find(value => value.objectId === item.itemId);
      assert.equal(item.status === 'AVAILABLE', candidate?.eligible === true);
      if (item.status === 'AVAILABLE') {
        assert.equal(item.score, candidate.score);
        assert.equal(item.rank, candidate.rank);
      }
    }
    assert.equal(taste.intent, 'EVALUATION');
    assert.equal(delivery.intent, 'DELIVERY');
    assert.equal(taste.acquisition.policy, 'EXPLICIT_CANONICAL');
    assert.equal(delivery.acquisition.policy, 'CATALOG_CHAIN');
    assert.equal(taste.clocks.eligibilityClock, 'TRANSACTION_START');
    assert.equal(delivery.clocks.eligibilityClock, 'CURRENT_WALL_TIME');
    assert.equal(taste.itemType, null);
    assert.equal(delivery.itemType, 'MOVIE');
    assert.equal(delivery.clocks.evidenceAsOf, taste.clocks.evidenceAsOf);
    assert.deepEqual(delivery.scope, taste.scope);
    assert.deepEqual(delivery.scoringArtifact, taste.scoringArtifact);
    assert.equal(compareFrozenRankings(taste, delivery, tolerance).conforms, false);
    const tasteMovies = retained.pool.catalog.filter(item => item.itemType === 'MOVIE').map(item => item.id);
    const discoveryOnly = delivery.candidates.filter(candidate => !tasteMovies.includes(candidate.objectId));
    assert.equal(tasteMovies.length, 25);
    assert.ok(!tasteMovies.includes(id(99)), 'Low-recognition Item must fall outside the retained V4 recognition pool');
    assert.ok(discoveryOnly.some(candidate => candidate.objectId === id(99)), 'Actual Discovery must expose the acquisition gap');
    boundaries.push({ case: label, status: 'NOT_COMPARABLE_AS_SAME_INPUT',
      differences: ['ACQUISITION', 'CANDIDATE_POOL', 'DOMAIN_SCOPE', 'INTENT_SELECTION', 'ELIGIBILITY_CLOCK', 'POLICY_VERSION'],
      tasteMovieCandidates: tasteMovies.length, discoveryCandidates: delivery.candidates.length,
      discoveryOutsideTastePool: discoveryOnly.length });
    assert.deepEqual(await call(actor, next), question, 'Lost NEXT reply changed its committed question');
    const result = { actor, label, question, parent, samples, retained, currentSession };
    observations.push(result);
    return result;
  };
  try {
    assert.deepEqual(await one(`select jsonb_build_object(
      'users',(select count(*) from auth.users where id::text like 'ab157000-%'),
      'items',(select count(*) from public.items where id::text like 'ab157000-%'));`, 'reserved-scope'), { users: 0, items: 0 });
    const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and n.nspname in('public','private','auth');`, 'canonical-tables');
    snapshots = 'begin read only;set local extra_float_digits=3;select jsonb_object_agg(name,value) from (' + tables.map(name => 'select ' + sqlLiteral(name)
      + ` name,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') value
        from ` + name + ' r').join(' union all ') + ') s;rollback;';
    original = await one(snapshots, 'canonical-before');
    fixture = true;
    await exec('begin;' + await personalTasteSessionFixtureSql() + `
      insert into auth.users(id,email,raw_user_meta_data) values
        ('${id(3)}','taste-native-high@example.invalid','{"kajo_nickname":"Native high"}'),
        ('${id(4)}','taste-native-control@example.invalid','{"kajo_nickname":"Native control"}');
      update public.items set tags=array['shared-feature','taste-'||right(id::text,1)]
        where id::text like 'ab157000-%';
      insert into public.items(id,item_type,title,tags,metadata)
        select ('ab157000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'MOVIE','Consumer fixture '||n,
          array['shared-feature','additional-feature'],
          jsonb_build_object('coldStartRecognition',case when n=99 then 0 else 0.1 end,
            'coldStartPriorSource','KAJO_CURATED_RECOGNITION')
        from generate_series(99,219) n where n=99 or n>=200;
      insert into private.item_sources(item_id,provider_key,provider_item_id)
        select id,'kajo_curated',id::text from public.items where title like 'Consumer fixture %';commit;`, 'fixture');
    const starters = [];
    for (const actor of [...actors, controlActor]) {
      const profileId = await one('select to_jsonb(id) from public.profiles where owner_user_id='
        + sqlLiteral(actor) + " and profile_type='PERSONAL';", 'profile');
      starters.push(await call(actor, { operation: 'START', profileId, requestId: randomUUID() }));
    }
    const initial = [];
    for (const [index, actor] of [...actors, controlActor].entries()) {
      initial.push(await capture(actor, starters[index], 'before-' + index));
    }
    assert.equal(new Set(initial.map(value => value.question.currentItem.id)).size, 1, 'Counterfactuals need the same first Item');
    const ratings = [0, 5, 10], after = [];
    for (const [index, actor] of actors.entries()) {
      const prior = initial[index];
      const answer = command(prior.question, 'ANSWER', {
        questionId: prior.question.questionId, answer: { kind: 'RATING', value: ratings[index] } });
      const accepted = await call(actor, answer);
      assert.deepEqual(await call(actor, answer), accepted, 'Duplicate ANSWER must be an exact retry');
      after.push(await capture(actor, accepted, 'after-rating-' + ratings[index]));
      assert.deepEqual(await frozen(prior.samples.taste.actual.predictionId), prior.retained, 'Answer rewrote its own forecast or pool');
      const prefix = after[index].retained.panel.prefix;
      assert.equal(prefix.length, 1);
      assert.equal(prefix[0].questionId, prior.question.questionId);
      const projection = await one(`select jsonb_build_object('rows',count(*),'rating',min(rating))
        from private.profile_bootstrap_evidence where profile_id=` + sqlLiteral(accepted.profileId)
        + ' and item_id=' + sqlLiteral(prior.question.currentItem.id) + ';', 'numeric-projection');
      assert.deepEqual(projection, { rows: 1, rating: ratings[index] });
    }
    const control = initial.at(-1);
    assert.deepEqual(await frozen(control.samples.taste.actual.predictionId), control.retained, 'Other Profile forecast changed');
    assert.deepEqual(await session(control.question), control.currentSession, 'Other Profile session changed');
    const controlReceipt = await one('begin;set local extra_float_digits=3;set local request.jwt.claim.sub='
      + sqlLiteral(controlActor) + `;select private.capture_personal_evaluation_v1(gen_random_uuid(),r.profile_id,
        array(select value::uuid from jsonb_array_elements_text(r.state_snapshot#>'{candidateRequest,itemIds}')),
        (r.state_snapshot#>>'{candidateRequest,requiredAfter}')::timestamptz,jsonb_build_object('sessionId',r.session_id))
        from private.prediction_runs r where r.id=` + sqlLiteral(control.samples.taste.actual.predictionId) + ';commit;',
    'fresh-other-profile');
    const controlSnapshot = await one("begin read only;set local extra_float_digits=3;select jsonb_build_object('observedAt',clock_timestamp(),'cases',"
      + nativeCasesSql("select 'control' name," + sqlLiteral(controlReceipt.predictionId)
        + '::uuid prediction_id,null::jsonb evaluation_receipt') + ');rollback;', 'fresh-other-profile-snapshot');
    const controlSample = controlSnapshot.cases[0];
    const freshControl = normalizeKajoNativePrediction({ ...controlSample, source, snapshotObservedAt: controlSnapshot.observedAt });
    const controlComparison = compareFrozenRankings(freshControl, nativeReplayView(controlSample, freshControl), tolerance);
    assert.equal(controlComparison.conforms, true);
    comparisons.push(controlComparison);
    const numeric = ranking => ranking.candidates.map(candidate => ({ id: candidate.objectId,
      score: candidate.score, sourceScore: candidate.sourceScore, rank: candidate.rank,
      eligible: candidate.eligible, tier: candidate.tier, selected: candidate.selected,
      longTerm: candidate.inputs.explanation.scoringFeatures.longTerm }));
    assert.deepEqual(numeric(freshControl), numeric(control.samples.taste.actual),
      'Other Profiles answers leaked into a fresh unmodified Profile forecast');
    const sensitivity = {};
    for (const consumer of ['taste', 'discovery']) {
      for (const value of initial.slice(1)) assert.deepEqual(numeric(value.samples[consumer].actual),
        numeric(initial[0].samples[consumer].actual), 'Unequal cold-start ' + consumer + ' controls');
      const common = after[0].samples[consumer].actual.candidates.filter(candidate => after.every(value =>
        value.samples[consumer].actual.candidates.some(other => other.objectId === candidate.objectId)));
      let sensitive = 0;
      for (const candidate of common) {
        const values = after.map(value => value.samples[consumer].actual.candidates.find(other => other.objectId === candidate.objectId));
        if (values[2].score - values[0].score > 1e-6) {
          assert.ok(values[0].score < values[1].score && values[1].score < values[2].score);
          sensitive++;
        }
      }
      assert.ok(sensitive > 0, 'Real committed 0/5/10 answers must distinguish supported subsequent ' + consumer + ' scores');
      sensitivity[consumer] = { commonCandidates: common.length, numericallySensitiveCandidates: sensitive };
    }
    let preservedSources = 0;
    for (const observation of observations) {
      for (const [name, { sample }] of Object.entries(observation.samples)) {
        assert.deepEqual(await frozen(sample.sourceRun.id), {
          run: sample.sourceRun, candidates: [...sample.sourceCandidates].sort((a, b) => a.item_id.localeCompare(b.item_id)),
          panel: name === 'taste' ? observation.retained.panel : null,
          pool: name === 'taste' ? observation.retained.pool : null,
        }, 'Later consumer changed a retained ' + name + ' source');
        preservedSources++;
      }
    }
    return { status: 'PASS', version: 'native-taste-consumer-conformance-v2', source: 'SYNTHETIC_FIXTURE_NATIVE_SQL',
      policy: 'CANONICAL_FORECAST_POOL_V4', transactions: 'SEPARATE_COMMITTED_START_NEXT_ANSWER_NEXT',
      consumers: ['TASTE_V4_RPC', 'EXPLICIT_CANONICAL_CAPTURE', 'DISCOVERY_FEED_RPC', 'FROZEN_BASELINE_REPLAY'],
      captures: observations.length, independentSameInputEvaluations: receiptComparisons.filter(x => x.fullInputConforms).length,
      independentReceiptAlignedEvaluations: observations.length, independentReceiptComparisons: receiptComparisons,
      receiptWitnessControls: 'SYNTHETIC_COPY_ONLY_DIFFERENT_VALID_WITNESS_NOT_FULL_PARITY_INVISIBLE_WITNESS_REJECTED',
      independentCaptureBinding: 'ONLY_VALIDATED_PREDICTION_AND_WORKING_CAPTURE_SELF_REFERENCES_REBOUND',
      comparedCandidates: comparisons.reduce((sum, value) => sum + value.comparedCandidates, 0),
      absoluteTolerance: tolerance.absoluteTolerance,
      maxAbsoluteScoreDifference: Math.max(...comparisons.map(value => value.maxAbsoluteScoreDifference)),
      committedRatings: ratings, sensitivity, preservedSources,
      immutableOldForecasts: true, exactCommandRetries: true, otherProfileIsolation: 'RETAINED_AND_FRESH_FORECAST',
      nonComparableConsumers: boundaries,
      acquisitionOwner: 'native-candidate-acquisition-v1', receiptBinding: 'native-v4-receipt-v1',
      remainingDependency: 'GUIDED_RECOGNITION_AND_DELIVERY_SELECTION_POLICY_ALIGNMENT',
      historicalReconstruction: 'UNAVAILABLE', predictiveQuality: 'NOT_EVALUATED', cleanup: 'CANONICAL_ROWS_RESTORED' };
  } catch (error) { failure = error; throw error; }
  finally {
    if (fixture) {
      try {
        await exec(`begin;
          do $cleanup$ declare actor uuid;begin
            for actor in select id from public.users where id::text like 'ab157000-%' loop
              perform private.erase_prediction_sources_v1('ACTOR',actor);
            end loop;
          end;$cleanup$;
          delete from auth.users where id::text like 'ab157000-%';
          delete from private.item_sources where item_id::text like 'ab157000-%';
          delete from public.items where id::text like 'ab157000-%';commit;`, 'cleanup');
        assert.deepEqual(await one(snapshots, 'canonical-after'), original, 'Native Taste fixture leaked canonical rows');
      } catch (error) {
        throw new AggregateError(failure ? [failure, error] : [error], 'Native Taste proof and cleanup failures are retained');
      }
    }
  }
}
