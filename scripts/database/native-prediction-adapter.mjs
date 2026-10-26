import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nativeCandidateRequestFixtureSql } from './native-candidate-request.mjs';

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

// Real current SQL produces every source, feature, score and replay below. The
// data are synthetic and the entire exercise rolls back, including replay jobs.
export async function nativePredictionAdapterFixtureSql() {
  return `begin;
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
  replay jsonb;
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
  'cases',(select jsonb_agg(jsonb_build_object('name',s.name,
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
            select c.*,private.prediction_candidate_score_v2(r.discovery_mode,c.explanation,c.scenario_score,g.config) score,
              (c.explanation#>>'{resurfacingPolicy,eligible}')::boolean eligible,
              private.prediction_delivery_tier_v1(c.explanation->'resurfacingPolicy') tier
            from private.prediction_candidates c where c.prediction_id=r.id) x) c) end
    ) order by s.name) from adapter_sources s join private.prediction_runs r on r.id=s.prediction_id
      join public.profiles p on p.id=r.profile_id join private.predictor_genomes g on g.id=r.genome_id),
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
  const replayView = (sample, actual) => {
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
  };
  assert.equal(fixture.frozenPreserved, true);
  assert.equal(fixture.cases.length, 6);
  let comparedCandidates = 0, maxAbsoluteScoreDifference = 0, scenarioCandidates = 0;
  const normalized = [];
  for (const sample of fixture.cases) {
    const actual = normalize(sample);
    const replay = replayView(sample, actual);
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
  ]) assert.throws(() => replayView(invalid, actual), assert.AssertionError);
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
  assert.throws(() => normalize({ ...sample, ...fixture.continuation }));
  return { status: 'PASS', version: 'native-prediction-adapter-conformance-v1',
    scope: 'FROZEN_SAME_POLICY_BASELINE', source: 'SYNTHETIC_FIXTURE_NATIVE_SQL',
    cases: fixture.cases.map(s => ({ name: s.name, replay: s.replay.kind,
      recomputed: s.replay.kind === 'BASELINE_SHADOW_WORKER' ? 'SCORE_RANK_ELIGIBILITY_SELECTION' : 'SCORE_RANK' })),
    comparedCandidates, scenarioCandidates, absoluteTolerance: options.absoluteTolerance, maxAbsoluteScoreDifference,
    identityEligibilityRanksSelection: 'EXACT', retainedReplayMetadataAndInputs: 'EXACT_SOURCE_BINDING',
    frozenAfterCatalogMutation: true,
    evaluationUnavailableAndNonDelivery: true, emptyPoolAndAbsentSession: true,
    negativeControls: 'SCORE_ELIGIBILITY_POOL_RANK_SELECTION_SOURCE_CLOCK_VERSION_GENOME_CONTINUATION',
    historicalReconstruction: 'UNAVAILABLE', predictiveQuality: 'NOT_EVALUATED', cleanup: 'ROLLED_BACK' };
}
