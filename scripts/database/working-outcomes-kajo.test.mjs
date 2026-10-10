import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';

const uuid = number => `a9174000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const controls = ['OFF', 'STATIC', 'ORDERED'];

// Generated canonical rows exercise the actual native producers and portable
// consumers. This disposable fixture is never an observed user-quality sample.
test('actual committed native enrollment and own latest-rating capture cross both portable adapters with honest later read clocks',
  { timeout: 180_000 }, async t => {
    execFileSync('npm', ['run', 'build', '--workspace', '@kajo/prediction-engine'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)), timeout: 120_000, stdio: 'pipe',
    });
    const { normalizeKajoWorkingEvaluationPlan } = await import('../../packages/prediction-engine/dist/adapters/kajo-working-evaluation.js');
    const { normalizeKajoWorkingOutcomeCapture } = await import('../../packages/prediction-engine/dist/adapters/kajo-working-outcomes.js');
    const { freezeWorkingEvaluationPlan, evaluateWorkingPlan } = await import('../../packages/prediction-engine/dist/working-evaluation.js');
    const db = new PGlite();
    const actor = uuid(1), sessionId = uuid(2), enrollmentId = uuid(3), nativePairId = uuid(4);
    const evidence = [20, 21].map(uuid), admitted = [30, 31, 32, 33].map(uuid);
    let sequence = 100;
    const next = () => uuid(sequence++);
    const scoped = suffix => `actual-native-outcomes:${suffix}`;
    const recordAliases = new Map();
    const recordRef = id => {
      if (!recordAliases.has(id)) recordAliases.set(id, scoped(`record-${recordAliases.size}`));
      return recordAliases.get(id);
    };
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role;
        create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema public,auth to anon,authenticated,service_role;`);
      const { files } = await buildFreshInstallation();
      assert.ok(files.some(file => file.name.endsWith('_personal_working_prospective.sql')));
      for (const file of files) await db.exec(`begin;${file.sql}commit;`);
      const transaction = async operation => {
        await db.exec('begin;');
        try {
          await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
          const value = await operation();
          await db.exec('commit;');
          return value;
        } catch (error) { await db.exec('rollback;'); throw error; }
      };
      const actorCall = (name, request) => transaction(async () => {
        await db.exec('set local role authenticated;');
        return (await db.query(`select public.${name}($1::jsonb) value`, [JSON.stringify(request)])).rows[0].value;
      });
      await db.query(`insert into auth.users(id,email,raw_user_meta_data)
        values($1,$2,jsonb_build_object('kajo_nickname','Native outcomes interop'))`, [actor, `${actor}@example.invalid`]);
      const profileId = (await db.query("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).rows[0].id;
      await db.exec('update public.items set discoverable=false;');
      for (const [index, itemId] of [...evidence, ...admitted].entries()) await db.query(`insert into public.items
        (id,item_type,title,tags,discoverable) values($1,'BOOK',$2,array['native-outcome-warm'],$3)`,
      [itemId, `Native outcome interop ${index}`, admitted.includes(itemId)]);
      const startedAt = (await db.query("select (clock_timestamp()-interval '5 minutes')::text value")).rows[0].value;
      for (const [index, itemId] of evidence.entries()) await actorCall('commit_item_action_v1', {
        version: 1, actionId: next(), actorUserId: actor, profileId, itemId,
        occurredAt: new Date(Date.parse(startedAt) + 60_000 + index * 10_000).toISOString(),
        discoveryMode: 'FOR_YOU', predictionId: null,
        session: { sessionId, startedAt, context: {} }, kind: 'SET_RATING', rating: index * 10,
      });
      const page = await actorCall('rank_items_page_v1', { version: 3, requestId: next(), profileId,
        sessionId, discoveryMode: 'FOR_YOU', itemType: 'BOOK', limit: 2, context: {} });
      const sourcePredictionId = page.predictionId;
      const selected = (await db.query(`select item_id from private.prediction_candidates
        where prediction_id=$1 and selected_for_delivery order by final_rank`, [sourcePredictionId])).rows.map(row => row.item_id);
      assert.equal(selected.length, 2);
      const nativePairs = [{ pairId: nativePairId, leftItemId: selected[0], rightItemId: selected[1] }];
      const enrollment = await transaction(async () => (await db.query(
        'select private.enroll_personal_working_evaluation_v1($1,$2,$3::jsonb,1,0) value',
        [enrollmentId, sourcePredictionId, JSON.stringify(nativePairs)])).rows[0].value);
      // This is the real owner-observed read, after the declaration COMMIT.
      const snapshot = (await db.query(`select to_jsonb(r) source_run,
        (select jsonb_agg(to_jsonb(c) order by c.final_rank) from private.prediction_candidates c where c.prediction_id=r.id) source_candidates,
        (select jsonb_agg(to_jsonb(c) order by c.control) from private.personal_working_shadow_comparisons c where c.source_prediction_id=r.id) comparisons,
        extract(epoch from clock_timestamp())*1000 observed_at
        from private.prediction_runs r where r.id=$1`, [sourcePredictionId])).rows[0];
      const observedAt = Number(snapshot.observed_at);
      assert.ok(observedAt > enrollment.declaredAt, 'Postcommit retrieval must not impersonate a predeclaration read');
      const nativeWorking = snapshot.source_run.state_snapshot.workingState;
      assert.equal(nativeWorking.version, 'native-working-capture-v3');
      assert.equal(nativeWorking.status, 'ACTIVE');
      const rankedAliases = snapshot.source_candidates.map((candidate, index) => ({
        itemId: candidate.item_id, objectRef: scoped(`candidate-${index}`),
      }));
      const objectRef = id => rankedAliases.find(reference => reference.itemId === id).objectRef;
      const rawRecordIds = [...new Set(nativeWorking.rawEvents.flatMap(event => [event.id,
        ...(event.event_type === 'ITEM_INTERACTION_UNDONE' ? [event.properties.reversedEventId] : [])]))];
      const planInput = { actorUserId: actor, profile: { id: profileId, type: 'PERSONAL', ownerUserId: actor },
        sourceRun: snapshot.source_run, sourceCandidates: snapshot.source_candidates, comparisons: snapshot.comparisons,
        enrollment, snapshotObservedAt: observedAt,
        planning: { id: scoped('enrollment'), createdAt: enrollment.declaredAt, horizon: enrollment.horizon,
          pairs: [{ pairId: scoped('pair-0'), leftItemId: selected[0], rightItemId: selected[1] }] },
        references: { scopeId: 'actual-native-outcomes', subjectRef: scoped('subject'), actorRef: scoped('actor'),
          sessionRef: scoped('session'), sourcePredictionRef: scoped('source'), captureRef: scoped('working-capture'),
          controlRefs: { OFF: scoped('off'), STATIC: scoped('static'), ORDERED: scoped('ordered') }, objects: rankedAliases,
          inputObjects: nativeWorking.itemFeatures.map((item, index) => ({ itemId: item.id,
            objectRef: rankedAliases.find(reference => reference.itemId === item.id)?.objectRef ?? scoped(`input-${index}`) })),
          inputRecords: rawRecordIds.map(recordId => ({ recordId, recordRef: recordRef(recordId) })) } };
      const plan = freezeWorkingEvaluationPlan(normalizeKajoWorkingEvaluationPlan(planInput));
      assert.equal(plan.createdAt, enrollment.declaredAt);
      assert.equal(plan.sourceBinding.snapshotObservedAt, observedAt);
      assert.deepEqual(plan.sourceBinding.prospectiveDeclaration, { basis: 'STORED_PROSPECTIVE_DECLARATION',
        declarationRef: scoped('enrollment'), declaredAt: enrollment.declaredAt, commitAvailability: 'UNKNOWN' });
      assert.equal(plan.working.status, 'available');
      for (const control of controls) {
        const original = snapshot.comparisons.find(value => value.control === control);
        for (const candidate of original.result.candidates) {
          const portable = plan.controls[control].candidates.find(value => value.objectId === objectRef(candidate.itemId));
          assert.equal(portable.score, candidate.score); assert.equal(portable.rank, candidate.rank);
          assert.equal(portable.selected, candidate.selected); assert.equal(portable.tier, candidate.tier);
        }
      }
      const rawBefore = JSON.stringify(snapshot);
      const event = (itemId, eventType, properties = {}) => transaction(async () => {
        const eventId = next();
        await db.query(`insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,
          occurred_at,session_id,prediction_id,discovery_mode,properties)
          values($1,$2,$3,$4,'BOOK',$5,clock_timestamp(),$6,$7,'FOR_YOU',$8::jsonb)`,
        [eventId, actor, profileId, itemId, eventType, sessionId, sourcePredictionId, JSON.stringify(properties)]);
        return eventId;
      });
      const exposureIds = [];
      for (const itemId of selected) exposureIds.push(await event(itemId, 'ITEM_IMPRESSION'));
      const superseded = await event(selected[0], 'ITEM_RATED', { rating: 9 });
      const terminalIds = [await event(selected[0], 'ITEM_RATED', { rating: 0 }),
        await event(selected[1], 'ITEM_RATED', { rating: 10 })];
      const now = Number((await db.query('select extract(epoch from clock_timestamp())*1000 value')).rows[0].value);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, Math.ceil(enrollment.matureAt - now + 20))));
      const nativeCapture = await transaction(async () => (await db.query(
        'select private.capture_personal_working_outcomes_v1($1,$2) value', [next(), enrollmentId])).rows[0].value);
      const outcomeInput = { native: { actorUserId: actor, profileId, sessionId, sourcePredictionId },
        enrollment, capture: nativeCapture, plan,
        references: { scopeId: 'actual-native-outcomes', enrollmentRef: scoped('enrollment'), captureRef: scoped('outcomes'),
          controls: Object.fromEntries(controls.map(control => [control, {
            comparisonId: enrollment.controls.find(value => value.control === control).comparisonId,
            controlRef: plan.controls[control].id,
          }])), pairs: [{ pairId: nativePairId, pairRef: scoped('pair-0') }],
          objects: selected.map(itemId => ({ itemId, objectRef: objectRef(itemId) })),
          events: terminalIds.map(eventId => ({ eventId, recordRef: recordRef(eventId) })),
          exposures: exposureIds.map((exposureId, index) => ({ exposureId, experienceRef: scoped(`experience-${index}`) })) } };
      const capture = normalizeKajoWorkingOutcomeCapture(outcomeInput);
      const report = evaluateWorkingPlan(plan, capture, nativeCapture.capturedAt + 1);
      assert.equal(capture.complete, true); assert.equal(report.plannedPairUnits, 1);
      assert.equal(report.comparablePairUnits, 1); assert.equal(report.unscoredPairUnits, 0);
      assert.equal(report.observed.nativePairUnits, 1); assert.equal(report.pairs[0].observedOrder, 'right');
      assert.deepEqual(capture.labels.map(label => label.observation.measurement.value),
        nativeCapture.labels.map(label => label.rating));
      assert.equal(capture.labels.find(label => label.objectId === objectRef(selected[0])).observation.raw.value, 0);
      for (const key of ['historicalFeatureEligible', 'learnable', 'nativeActivated', 'qualityAdmitted']) assert.equal(report[key], false);
      assert.equal(report.pairs[0].prospectiveDeclaredEligibility, false);
      assert.equal(JSON.stringify(snapshot), rawBefore, 'Pure adapters do not mutate supplied native rows');
      const rawIds = [actor, profileId, sessionId, sourcePredictionId, enrollmentId, nativePairId, nativeCapture.captureId,
        snapshot.source_run.genome_id, nativeWorking.captureId, ...evidence, ...admitted, ...rawRecordIds,
        ...exposureIds, ...terminalIds, superseded, ...enrollment.controls.map(control => control.comparisonId)];
      for (const raw of rawIds) assert.equal(JSON.stringify([plan, capture, report]).toLowerCase().includes(raw), false);

      await t.test('scope, source, pair and declaration mismatches cannot cross the frozen adapters', () => {
        for (const [key, value] of [['actorUserId', uuid(900)], ['sourcePredictionId', uuid(901)], ['declaredAt', enrollment.declaredAt + 1]]) {
          const mismatched = structuredClone(planInput); mismatched.enrollment[key] = value;
          assert.throws(() => normalizeKajoWorkingEvaluationPlan(mismatched));
        }
        const noDeclaration = structuredClone(planInput); delete noDeclaration.enrollment;
        assert.throws(() => normalizeKajoWorkingEvaluationPlan(noDeclaration), /artifact-unavailable/);
        const wrongScope = structuredClone(outcomeInput); wrongScope.native.profileId = uuid(902);
        assert.throws(() => normalizeKajoWorkingOutcomeCapture(wrongScope));
        const wrongPlan = structuredClone(outcomeInput); wrongPlan.references.enrollmentRef = scoped('other-enrollment');
        assert.throws(() => normalizeKajoWorkingOutcomeCapture(wrongPlan));
        const wrongEnrollment = structuredClone(outcomeInput); wrongEnrollment.capture.enrollmentId = uuid(903);
        assert.throws(() => normalizeKajoWorkingOutcomeCapture(wrongEnrollment));
      });

      await t.test('source withdrawal removes whole native captures and requires fresh authorization despite retained pure values', async () => {
        await db.query('delete from public.events where id=$1', [superseded]);
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_outcome_captures where id=$1',
          [nativeCapture.captureId])).rows[0].value, 0);
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_outcome_event_refs where capture_id=$1',
          [nativeCapture.captureId])).rows[0].value, 0);
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_enrollments where id=$1',
          [enrollmentId])).rows[0].value, 1);
        assert.equal(capture.labels.find(label => label.objectId === objectRef(selected[0])).observation.raw.value, 0,
          'Retained pure values carry no fresh native authorization');
        await transaction(() => db.query("select private.erase_prediction_sources_v1('PREDICTION_RUN',$1)", [sourcePredictionId]));
        assert.equal((await db.query('select count(*)::integer value from private.personal_working_enrollments where id=$1',
          [enrollmentId])).rows[0].value, 0);
        await assert.rejects(transaction(() => db.query('select private.capture_personal_working_outcomes_v1($1,$2)',
          [nativeCapture.captureId, enrollmentId])), /access denied/i);
        await assert.rejects(transaction(() => db.query('select private.enroll_personal_working_evaluation_v1($1,$2,$3::jsonb,1,0)',
          [enrollmentId, sourcePredictionId, JSON.stringify(nativePairs)])), /access denied/i);
      });
    } finally { await db.close(); }
  });
