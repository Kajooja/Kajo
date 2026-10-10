import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';

const uuid = n => `a9151000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const controls = ['OFF', 'STATIC', 'ORDERED'];

// Disposable generated actors exercise the real unchanged native producers.
// Later labels are explicitly synthetic fixtures, never observed native quality.
test('actual v1/v2 native frozen Working controls cross the pure evaluation adapter without native outcome claims',
  { timeout: 180_000 }, async () => {
    execFileSync('npm', ['run', 'build', '--workspace', '@kajo/prediction-engine'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)), timeout: 120_000, stdio: 'pipe',
    });
    const { normalizeKajoWorkingEvaluationPlan } = await import('../../packages/prediction-engine/dist/adapters/kajo-working-evaluation.js');
    const { freezeWorkingEvaluationPlan, evaluateWorkingPlan, evaluateWorkingBatch } = await import('../../packages/prediction-engine/dist/working-evaluation.js');
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;
        create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      const { files } = await buildFreshInstallation();
      const resetIndex = files.findIndex(file => file.name.endsWith('_personal_working_reset.sql'));
      assert.ok(resetIndex > files.findIndex(file => file.name.endsWith('_personal_working_bridge.sql')));
      for (const file of files.slice(0, resetIndex)) await db.exec(`begin;${file.sql}commit;`);
      const actor = uuid(1), sessionId = uuid(3), evidence = [20, 21].map(uuid), admitted = [40, 41, 42, 43, 44, 45].map(uuid);
      await db.exec('begin;');
      await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,$2,jsonb_build_object('kajo_nickname','Working evaluation'))`,
        [actor, `${actor}@example.invalid`]);
      const profileId = (await db.query("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).rows[0].id;
      await db.exec('update public.items set discoverable=false;');
      for (const [index, itemId] of [...evidence, ...admitted].entries()) await db.query(`insert into public.items
        (id,item_type,title,tags,discoverable) values($1,'BOOK',$2,$3,$4)`,
      [itemId, `Working evaluation fixture ${index}`, index % 2 ? ['working-cold'] : ['working-warm'], admitted.includes(itemId)]);
      const baseClock = Number((await db.query('select extract(epoch from clock_timestamp())*1000 value')).rows[0].value);
      let action = 100, request = 200;
      const actorCall = async (name, payload) => {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
        await db.exec('set local role authenticated;');
        try { return (await db.query(`select public.${name}($1::jsonb) value`, [JSON.stringify(payload)])).rows[0].value; }
        finally { await db.exec('reset role;'); }
      };
      const rate = async (itemId, rating, occurredAt) => actorCall('commit_item_action_v1', {
        version: 1, actionId: uuid(action++), actorUserId: actor, profileId, itemId,
        occurredAt: new Date(occurredAt).toISOString(), discoveryMode: 'FOR_YOU', predictionId: null,
        session: { sessionId, startedAt: new Date(baseClock - 300_000).toISOString(), context: {} }, kind: 'SET_RATING', rating,
      });
      await rate(evidence[0], 0, baseClock - 240_000);
      await rate(evidence[1], 10, baseClock - 180_000);
      const produce = async () => {
        const page = await actorCall('rank_items_page_v1', { version: 3, requestId: uuid(request++), profileId,
          sessionId, discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 2, context: {} });
        for (const control of controls) await db.query('select private.record_personal_working_shadow_v1($1,$2)', [page.predictionId, control]);
        return page.predictionId;
      };
      const read = async predictionId => (await db.query(`select
        to_jsonb(r) source_run,
        (select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c where c.prediction_id=r.id) source_candidates,
        (select jsonb_agg(to_jsonb(c) order by c.control) from private.personal_working_shadow_comparisons c where c.source_prediction_id=r.id) comparisons,
        extract(epoch from clock_timestamp())*1000 observed_at
        from private.prediction_runs r where r.id=$1`, [predictionId])).rows[0];
      const sourceV1 = await produce(); const frozenV1 = await read(sourceV1);
      assert.equal(frozenV1.source_run.state_snapshot.workingState.version, 'native-working-capture-v1');
      await db.exec('commit;');
      for (const file of files.slice(resetIndex)) await db.exec(`begin;${file.sql}commit;`);
      await db.exec('begin;');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
      const receipt = (await db.query('select private.commit_personal_working_reset_v1($1,$2,$3,$4) value',
        [uuid(300), actor, profileId, sessionId])).rows[0].value;
      const sourceV2 = await produce(); const frozenV2 = await read(sourceV2);
      assert.equal(frozenV2.source_run.state_snapshot.workingState.version, 'native-working-capture-v2');
      assert.equal(frozenV2.source_run.state_snapshot.workingState.resetSourceRefs[0].recordId, receipt.resetId);
      // Actual catalog, not a guessed clock guarantee. Source rows use now();
      // comparison rows use clock_timestamp(); both remain stored proxies.
      const defaultClock = (await db.query(`select pg_get_expr(d.adbin,d.adrelid) value
        from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
        where d.adrelid='private.personal_working_shadow_comparisons'::regclass and a.attname='created_at'`)).rows[0].value;
      assert.match(defaultClock, /clock_timestamp\(\)/);
      assert.ok(new Date(frozenV1.source_run.created_at).getTime() <= Number(frozenV1.source_run.state_snapshot.workingState.asOf));
      const plans = [];
      for (const [index, snapshot] of [frozenV1, frozenV2].entries()) {
        const scope = `actual-sql-v${index + 1}`, observedAt = Number(snapshot.observed_at), plannedAt = observedAt + 1;
        const selected = snapshot.source_candidates.filter(candidate => candidate.selected_for_delivery);
        assert.equal(selected.length, 2);
        const closureItems = new Set(snapshot.source_run.state_snapshot.workingState.itemFeatures.map(item => item.itemId));
        assert.ok(snapshot.source_candidates.every(candidate => !closureItems.has(candidate.item_id)),
          'native frozen input-closure features are not the admitted candidate features');
        assert.ok(snapshot.source_candidates.every(candidate => !Object.hasOwn(candidate.explanation.workingIntent, 'features')
          && !Object.hasOwn(candidate.explanation.workingIntent, 'tags')),
        'real native producer freezes component adjustments, not complete candidate features');
        const input = { actorUserId: actor, profile: { id: profileId, type: 'PERSONAL', ownerUserId: actor },
          sourceRun: snapshot.source_run, sourceCandidates: snapshot.source_candidates, comparisons: snapshot.comparisons,
          snapshotObservedAt: observedAt, planning: { id: `${scope}:plan`, createdAt: plannedAt,
            horizon: { startAt: plannedAt, endAt: plannedAt + 100 }, pairs: [{ pairId: `${scope}:pair`,
              leftItemId: selected[0].item_id, rightItemId: selected[1].item_id }] },
          references: { scopeId: scope, subjectRef: `${scope}:subject`, actorRef: `${scope}:actor`, sessionRef: `${scope}:session`,
            sourcePredictionRef: `${scope}:prediction`, captureRef: `${scope}:capture`,
            controlRefs: { OFF: `${scope}:off`, STATIC: `${scope}:static`, ORDERED: `${scope}:ordered` },
            objects: snapshot.source_candidates.map((candidate, i) => ({ itemId: candidate.item_id, objectRef: `${scope}:item-${50 - i}` })) } };
        const immutableBefore = JSON.stringify(snapshot);
        const normalized = normalizeKajoWorkingEvaluationPlan(input), plan = freezeWorkingEvaluationPlan(normalized); plans.push(plan);
        assert.equal(plan.support, null); assert.equal(plan.working.reason, 'FROZEN_CANDIDATE_FEATURES_UNAVAILABLE');
        assert.equal(plan.sourceBinding.commitAvailability, 'UNKNOWN');
        assert.equal(plan.sourceBinding.captureRef, `${scope}:capture`);
        for (const control of controls) {
          const native = snapshot.comparisons.find(comparison => comparison.control === control);
          const portable = normalized.controls[control];
          assert.equal(portable.version, `personal-working-shadow-v${index + 1}`);
          assert.equal(portable.availabilityBasis, 'STORED_CREATED_TIME');
          assert.notEqual(portable.createdAt, plan.sourceCutoff, 'control artifact clock must not be result.asOf');
          for (const candidate of native.result.candidates) {
            const alias = input.references.objects.find(reference => reference.itemId === candidate.itemId).objectRef;
            const frozen = portable.candidates.find(row => row.objectId === alias);
            assert.equal(frozen.score, candidate.score); assert.equal(frozen.rank, candidate.rank);
            assert.equal(frozen.selected, candidate.selected); assert.equal(frozen.tier, candidate.tier);
          }
        }
        const late = structuredClone(input); late.comparisons[0].created_at = plannedAt + 1;
        assert.throws(() => normalizeKajoWorkingEvaluationPlan(late), /artifact-unavailable/);
        const missingClock = structuredClone(input); delete missingClock.comparisons[0].created_at;
        assert.throws(() => normalizeKajoWorkingEvaluationPlan(missingClock), /snapshot rejected/);
        const mismatched = structuredClone(input); mismatched.comparisons[0].result.captureId = uuid(999);
        assert.throws(() => normalizeKajoWorkingEvaluationPlan(mismatched), /incompatible-snapshots/);
        const capture = { id: `${scope}:labels`, sourcePredictionId: plan.sourcePredictionId, subjectId: plan.scope.subject.id,
          actingIdentityRef: plan.scope.actingIdentityRef, sessionRef: plan.scope.sessionRef,
          revision: 1, createdAt: plannedAt + 110, availableAt: plannedAt + 110, matureAt: plan.horizon.endAt,
          availabilityBasis: 'SYNTHETIC_CLOCK', complete: true, resolutionVersion: 'GENERATED_FIXTURE_NOT_NATIVE_RECONCILIATION', labels: [] };
        const missingReport = evaluateWorkingPlan(plan, capture, plannedAt + 120);
        assert.equal(missingReport.observed.nativePairUnits, 0); assert.equal(missingReport.comparablePairUnits, 0);
        assert.ok(missingReport.pairs[0].reasons.includes('missing-label'));
        // A separate fixture policy admits generated terminal labels, including
        // genuine numeric zero. It cannot relabel them into native observations.
        const fixturePlan = freezeWorkingEvaluationPlan({ ...normalized, availabilityBasis: 'SYNTHETIC_CLOCK',
          scope: { ...normalized.scope, evidence: { ...normalized.scope.evidence, sourceIds: ['working-evaluation-generator'], synthetic: 'fixture-only' } } });
        capture.labels = [fixturePlan.pairs[0].leftObjectId, fixturePlan.pairs[0].rightObjectId].map((objectId, i) => ({
          objectId, experienceId: `${scope}:fixture-experience-${i}`, exposedAt: plannedAt + 10, status: 'observed', observation: {
            subjectId: fixturePlan.scope.subject.id, actingIdentityRef: fixturePlan.scope.actingIdentityRef,
            objectId, actionId: null, predictionId: fixturePlan.sourcePredictionId, targetId: fixturePlan.target.id,
            targetVersion: fixturePlan.target.version, measurement: { status: 'observed', value: i * 10 },
            raw: { value: i * 10, scale: { min: 0, max: 10 } }, occurredAt: plannedAt + 20, availableAt: plannedAt + 20,
            exposure: 'verified', access: { kind: 'subject', subjectId: fixturePlan.scope.subject.id },
            provenance: { origin: 'synthetic', source: { kind: 'generator', id: 'working-evaluation-generator', version: '1', parentRefs: [] },
              recordId: `${scope}:generated-label-${i}`, revision: 1 },
          },
        }));
        const report = evaluateWorkingPlan(fixturePlan, capture, plannedAt + 120);
        assert.equal(report.synthetic.pairUnits, 1); assert.equal(report.observed.nativePairUnits, 0);
        assert.equal(report.observed.externalPairUnits, 0); assert.equal(report.pairs[0].prospectiveDeclaredEligibility, false);
        assert.equal(report.descriptiveOnly, true); assert.equal(report.qualityAdmitted, false); assert.equal(report.learnable, false);
        assert.equal(report.nativeActivated, false); assert.equal(report.historicalFeatureEligible, false);
        assert.equal(evaluateWorkingBatch([{ plan: fixturePlan, capture, evaluationAsOf: plannedAt + 120 }]).observedNativePairUnits, 0);
        assert.equal(JSON.stringify(snapshot), immutableBefore);
        for (const raw of [actor, profileId, sessionId, snapshot.source_run.id,
          snapshot.source_run.genome_id, snapshot.source_run.state_snapshot.workingState.captureId,
          ...snapshot.source_candidates.map(candidate => candidate.item_id)]) assert.equal(JSON.stringify([plan, report]).toLowerCase().includes(raw), false);
      }
      // Current catalogue changes and control retries cannot reinterpret frozen
      // scores or fill the explicit candidate-feature gap.
      await db.exec("update public.items set tags=array['later-catalogue'],discoverable=false;");
      for (const source of [sourceV1, sourceV2]) for (const control of controls) await db.query(
        'select private.record_personal_working_shadow_v1($1,$2)', [source, control]);
      for (const [source, previous] of [[sourceV1, frozenV1], [sourceV2, frozenV2]]) {
        const after = await read(source);
        assert.deepEqual(after.source_run, previous.source_run); assert.deepEqual(after.source_candidates, previous.source_candidates);
        assert.deepEqual(after.comparisons, previous.comparisons);
      }
      assert.equal(plans.length, 2);
      await db.exec('rollback;');
    } finally { await db.close(); }
  });
