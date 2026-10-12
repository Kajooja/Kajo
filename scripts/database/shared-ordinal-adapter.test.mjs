import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';

// Synthetic actors are not product-quality evidence. Real existing SQL RPCs
// produce every envelope below; no hand-built JSON is presented as a native run.
test('actual SQL-produced Shared comparisons cross the strict ordinal adapter and preserve corrections', async () => {
  execFileSync('npm', ['run', 'build', '--workspace', '@kajo/prediction-engine'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), timeout: 120_000, stdio: 'pipe',
  });
  const { normalizeKajoOrdinalPair } = await import('../../packages/prediction-engine/dist/adapters/kajo-ordinal.js');
  const { evaluateOrdinalPair, evaluateOrdinalBatch } = await import('../../packages/prediction-engine/dist/ordinal.js');
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    for (const file of files) await db.exec(`begin;${file.sql}commit;`);
    await db.exec(`begin;
      ${await readFile(new URL('shared-round-outcomes-fixture.sql', import.meta.url), 'utf8')}
      insert into public.items(id,item_type,title,tags,discoverable) values
        ('a232f000-0000-4000-8000-000000000025','BOOK','Ordinal bridge book',array['outcome'],true);
      ${await readFile(new URL('shared-round-outcome-captures-fixture.sql', import.meta.url), 'utf8')}
      create temp table ordinal_bridge(left_comparison jsonb,right_comparison jsonb,anchor uuid,actor uuid,
        right_round uuid,window_id uuid,left_capture uuid,right_capture uuid) on commit drop;
      do $bridge$ declare f record; c record; actor uuid; session uuid; delivery jsonb; origin jsonb; response jsonb;
        right_item uuid := 'a232f000-0000-4000-8000-000000000025';
        right_round uuid := 'a232f000-0000-4000-8000-000000000030';
        window_id uuid := 'a232f000-0000-4000-8000-000000000040';
        origins jsonb[] := '{}'; sources uuid[] := '{}'; input_at timestamptz; cutoff timestamptz;
        left_capture uuid := gen_random_uuid(); right_capture uuid := gen_random_uuid();
        left_comparison jsonb; right_comparison jsonb; worker jsonb;
      begin
        select * into strict f from pg_temp.outcome_fixture;
        select * into strict c from pg_temp.capture_fixture;
        foreach actor in array array[f.actor,f.partner] loop
          session := gen_random_uuid();
          perform set_config('request.jwt.claim.sub',actor::text,true);
          perform set_config('role','authenticated',true);
          delivery := public.rank_items_page_v1(jsonb_build_object('version',3,'requestId',gen_random_uuid(),
            'profileId',f.pair,'sessionId',session,'discoveryMode','FOR_YOU','itemType','BOOK','limit',10,'context','{}'::jsonb));
          perform set_config('role','postgres',true);
          if not exists(select 1 from jsonb_array_elements(delivery->'items') item where item->>'item_id'=right_item::text) then
            raise exception 'Right bridge Item was not actually delivered'; end if;
          sources := array_append(sources,(delivery->>'predictionId')::uuid);
          origins := array_append(origins,jsonb_build_object('predictionId',delivery->'predictionId',
            'sessionId',session,'discoveryMode','FOR_YOU'));
          insert into public.event_sessions(id,actor_user_id,profile_id,started_at,context)
            values(session,actor,f.pair,(delivery#>>'{source,featureAt}')::timestamptz,'{}');
          insert into public.events(id,actor_user_id,profile_id,item_id,item_type,event_type,occurred_at,
            session_id,prediction_id,discovery_mode,created_at)
            values(gen_random_uuid(),actor,f.pair,right_item,'BOOK','ITEM_IMPRESSION',clock_timestamp(),
              session,(delivery->>'predictionId')::uuid,'FOR_YOU',clock_timestamp());
        end loop;
        input_at := clock_timestamp();
        response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,right_round,'OPEN_ROUND',0,
          jsonb_build_object('itemId',right_item,'experienceId',gen_random_uuid())));
        response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,right_round,'SET_RESPONSE',1,
          jsonb_build_object('rating',0,'origin',origins[1])));
        response := pg_temp.outcome_commit(f.partner,pg_temp.outcome_command(f.partner,f.pair,right_round,'SET_RESPONSE',2,
          jsonb_build_object('rating',9,'origin',origins[2])));
        cutoff := clock_timestamp();
        insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
          select source,c.genome_id from unnest(sources) source on conflict do nothing;
        worker := private.process_shadow_prediction_jobs_v1(250);
        if worker->>'failed' is distinct from '0' then raise exception 'Bridge shadow worker failed'; end if;
        insert into private.evaluation_windows(id,window_key,prediction_from,prediction_until,input_cutoff,outcome_cutoff,created_by)
          select window_id,'ordinal-bridge-'||window_id,w.prediction_from,input_at,input_at,cutoff,'ORDINAL_SQL_BRIDGE'
          from private.evaluation_windows w where w.id=c.window_id;
        perform private.capture_shared_rating_round_outcome_v1(left_capture,f.pair,c.round_id,cutoff,cutoff,interval '0 seconds');
        perform private.capture_shared_rating_round_outcome_v1(right_capture,f.pair,right_round,cutoff,cutoff,interval '0 seconds');
        left_comparison := private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),left_capture,c.genome_id,window_id);
        right_comparison := private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),right_capture,c.genome_id,window_id);
        if left_comparison->>'supportStatus'<>'COMPLETE_VECTOR_SUPPORTED' or right_comparison->>'supportStatus'<>'COMPLETE_VECTOR_SUPPORTED' then
          raise exception 'Bridge lacks complete actual per-actor support'; end if;
        insert into pg_temp.ordinal_bridge values(left_comparison,right_comparison,c.source_a,f.actor,
          right_round,window_id,left_capture,right_capture);
      end; $bridge$;`);
    const produced = (await db.query(`select left_comparison,right_comparison,anchor::text,actor::text,
      extract(epoch from clock_timestamp())::double precision*1000 as as_of,
      (select c.result->>'outcomeDigest'=md5((c.result->'outcome')::text)
        from private.shared_round_outcome_captures c where c.id=b.left_capture) left_digest_verified,
      (select c.result->>'outcomeDigest'=md5((c.result->'outcome')::text)
        from private.shared_round_outcome_captures c where c.id=b.right_capture) right_digest_verified
      from pg_temp.ordinal_bridge b`)).rows[0];
    assert.equal(produced.left_digest_verified, true);
    assert.equal(produced.right_digest_verified, true);
    const input = { pairId: 'actual-sql-bridge', leftComparison: produced.left_comparison,
      rightComparison: produced.right_comparison, anchor: { sourcePredictionId: produced.anchor, actorUserId: produced.actor },
      evaluationAsOf: produced.as_of, references: { scopeId: 'sql-bridge', subjectRef: 'sql-bridge:subject',
        members: produced.left_comparison.capturedOutcome.round.participants.map((p, i) => ({
          actorUserId: p.actorUserId, membershipGeneration: p.membershipGeneration,
          memberRef: `sql-bridge:member-${i}`, enrollmentRef: `sql-bridge:enrollment-${i}`,
        })) } };
    const normalized = normalizeKajoOrdinalPair(input);
    const report = evaluateOrdinalPair(normalized);
    assert.equal(report.status, 'comparable');
    assert.equal(report.observedOrder, 'left-dominates');
    assert.equal(normalized.left.responses[0].observation.raw.value, 0);
    assert.notEqual(normalized.left.responses[0].observation.predictionId, normalized.right.responses[0].observation.predictionId);
    assert.equal(report.learnable, false);
    assert.equal(report.groupReward, null);
    assert.equal(report.uncertainty, 'unavailable');
    assert.equal(report.integrityBasis, 'TRUSTED_OWNER_SNAPSHOT_DECLARED_DIGEST_BINDINGS');
    const portable = JSON.stringify([normalized, report]);
    for (const raw of [produced.left_comparison.capturedOutcome.round.profileId,
      ...input.references.members.flatMap(p => [p.actorUserId, p.membershipGeneration])]) {
      assert.equal(portable.includes(raw), false, 'raw Profile/User/enrollment identity escaped scoped adapter');
    }
    const auditDirectory = await mkdtemp(join(tmpdir(), 'kajo-ordinal-sql-'));
    try {
      const manifestPath = join(auditDirectory, 'manifest.json'); const reportPath = join(auditDirectory, 'report.json');
      await writeFile(manifestPath, JSON.stringify({ contractVersion: 'kajo-shared-ordinal-manifest-v1',
        selectionBasis: 'OWNER_DECLARED_NONOVERLAPPING_PAIRS', evaluationAsOf: input.evaluationAsOf, pairs: [input] }),
      { mode: 0o600, flag: 'wx' });
      execFileSync(process.execPath, [fileURLToPath(new URL('../../packages/prediction-engine/scripts/ordinal-report.mjs', import.meta.url)),
        manifestPath, reportPath], { timeout: 30_000, stdio: 'pipe' });
      const audited = JSON.parse(await readFile(reportPath, 'utf8'));
      assert.equal(audited.contractVersion, 'kajo-shared-ordinal-report-v1');
      assert.equal(audited.selectionWasProspective, 'NOT_ESTABLISHED');
      assert.equal(audited.sampleInterpretation, 'CONDITIONAL_ON_PRODUCTION_EXPOSURE');
      assert.deepEqual(audited.result, evaluateOrdinalBatch([normalized]));
      assert.equal((await stat(reportPath)).mode & 0o777, 0o600);
      for (const raw of [produced.left_comparison.capturedOutcome.round.profileId,
        ...input.references.members.flatMap(p => [p.actorUserId, p.membershipGeneration])]) assert.equal(JSON.stringify(audited).includes(raw), false);
      const overlapManifest = join(auditDirectory, 'overlap.json'); const overlapReport = join(auditDirectory, 'overlap-report.json');
      await writeFile(overlapManifest, JSON.stringify({ contractVersion: 'kajo-shared-ordinal-manifest-v1',
        selectionBasis: 'OWNER_DECLARED_NONOVERLAPPING_PAIRS', evaluationAsOf: input.evaluationAsOf,
        pairs: [input, { ...input, pairId: 'duplicated-observed-experiences' }] }), { mode: 0o600, flag: 'wx' });
      assert.throws(() => execFileSync(process.execPath,
        [fileURLToPath(new URL('../../packages/prediction-engine/scripts/ordinal-report.mjs', import.meta.url)), overlapManifest, overlapReport],
        { timeout: 30_000, stdio: 'pipe' }), /ORDINAL_REPORT_PAIRS_OVERLAP/);
      await assert.rejects(stat(overlapReport), error => error.code === 'ENOENT');
    } finally { await rm(auditDirectory, { recursive: true, force: true }); }
    const immutableBefore = JSON.stringify(produced.left_comparison);
    await db.exec(`do $correct$ declare f record; c record; origin jsonb; response jsonb; begin
      select * into strict f from pg_temp.outcome_fixture; select * into strict c from pg_temp.capture_fixture;
      select jsonb_build_object('predictionId',r.id,'sessionId',r.session_id,'discoveryMode',r.discovery_mode)
        into origin from private.prediction_runs r where r.id=c.source_a;
      response := pg_temp.outcome_commit(f.actor,pg_temp.outcome_command(f.actor,f.pair,c.round_id,'SET_RESPONSE',3,
        jsonb_build_object('rating',10,'origin',origin)));
    end; $correct$;`);
    const replay = (await db.query(`select private.get_shared_round_vector_comparison_v1(
      (left_comparison->>'comparisonId')::uuid) value from pg_temp.ordinal_bridge`)).rows[0].value;
    assert.equal(JSON.stringify(replay), immutableBefore);
    assert.deepEqual(evaluateOrdinalPair(normalizeKajoOrdinalPair({ ...input, leftComparison: replay })), report);
    await db.exec(`create temp table ordinal_corrected(left_comparison jsonb,right_comparison jsonb) on commit drop;
      do $new_capture$ declare f record; c record; b record; w record; cutoff timestamptz := clock_timestamp();
        window_id uuid := gen_random_uuid(); left_capture uuid := gen_random_uuid(); right_capture uuid := gen_random_uuid();
      begin
        select * into strict f from pg_temp.outcome_fixture; select * into strict c from pg_temp.capture_fixture;
        select * into strict b from pg_temp.ordinal_bridge;
        select * into strict w from private.evaluation_windows where id=b.window_id;
        insert into private.evaluation_windows(id,window_key,prediction_from,prediction_until,input_cutoff,outcome_cutoff,created_by)
          values(window_id,'ordinal-corrected-'||window_id,w.prediction_from,w.prediction_until,w.input_cutoff,cutoff,'ORDINAL_CORRECTION_BRIDGE');
        perform private.capture_shared_rating_round_outcome_v1(left_capture,f.pair,c.round_id,cutoff,cutoff,interval '0 seconds');
        perform private.capture_shared_rating_round_outcome_v1(right_capture,f.pair,b.right_round,cutoff,cutoff,interval '0 seconds');
        insert into pg_temp.ordinal_corrected values(
          private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),left_capture,c.genome_id,window_id),
          private.compare_shared_round_outcome_capture_v1(gen_random_uuid(),right_capture,c.genome_id,window_id));
      end; $new_capture$;`);
    const corrected = (await db.query(`select left_comparison,right_comparison,
      extract(epoch from clock_timestamp())::double precision*1000 as as_of from pg_temp.ordinal_corrected`)).rows[0];
    const correctedInput = { ...input, pairId: 'actual-sql-corrected', leftComparison: corrected.left_comparison,
      rightComparison: corrected.right_comparison, evaluationAsOf: corrected.as_of };
    const correctedNormalized = normalizeKajoOrdinalPair(correctedInput);
    const correctedReport = evaluateOrdinalPair(correctedNormalized);
    assert.equal(correctedReport.status, 'comparable');
    assert.equal(normalized.left.capture.revision, 3);
    assert.equal(correctedNormalized.left.capture.revision, 4);
    assert.notEqual(correctedNormalized.left.capture.id, normalized.left.capture.id);
    assert.equal(report.actors[0].direction, 'tie');
    assert.equal(correctedReport.actors[0].direction, 'left');
    assert.equal(correctedNormalized.left.responses[0].observation.provenance.revision, 4);
    assert.equal(correctedNormalized.left.responses[0].observation.raw.value, 10);
    assert.deepEqual(evaluateOrdinalPair(normalizeKajoOrdinalPair(input)), report);
    assert.throws(() => evaluateOrdinalBatch([normalized, correctedNormalized]), /reuses a round/);
    const missingOwnExposure = structuredClone(produced.right_comparison);
    missingOwnExposure.capturedOutcome.responses[1].attribution.predictionId = produced.anchor;
    assert.throws(() => normalizeKajoOrdinalPair({ ...input, rightComparison: missingOwnExposure }), /snapshot rejected/);
    const badBinding = structuredClone(produced.left_comparison);
    badBinding.production.outcomeDigest = '0'.repeat(32);
    assert.throws(() => normalizeKajoOrdinalPair({ ...input, leftComparison: badBinding }), /snapshot rejected/);
    await db.exec('rollback;');
    assert.equal((await db.query('select count(*)::integer n from auth.users')).rows[0].n, 0);
  } finally { await db.close(); }
});
