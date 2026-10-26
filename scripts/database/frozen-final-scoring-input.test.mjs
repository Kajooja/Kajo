import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { buildFreshInstallation } from './fresh-installation.mjs';
import { nativeCandidateRequestFixtureSql } from './native-candidate-request.mjs';

const actor = 'ab157000-0000-4000-8000-000000000001';
const shared = 'ab157000-0000-4000-8000-000000000900';
const item = n => `ab157000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const changed = ['rank_items_request_with_identity_v1', 'process_shadow_prediction_jobs_v1',
  'record_personal_working_shadow_v1', 'rank_items_frozen_page_v2'];
const added = ['native_final_candidate_input_v1', 'native_final_run_input_v1', 'validate_native_final_source_v1'];
// Only the newly added input and legitimately fresh Working capture references
// differ. Keep all old request/clock/features, identities and numeric bytes.
function comparable(value) {
  const captures = new Set();
  const collect = x => {
    if (!x || typeof x !== 'object') return;
    if (typeof x.captureId === 'string') captures.add(x.captureId);
    Object.values(x).forEach(collect);
  };
  collect(value);
  const visit = x => {
    if (typeof x === 'string') {
      for (const id of captures) if (x === `native-working:${id}` || x.startsWith(`native-working:${id}:`)) {
        return x.replace(id, 'fresh-capture');
      }
      return x;
    }
    if (Array.isArray(x)) return x.map(visit);
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x)
      .filter(([key]) => key !== 'finalScoringInput').sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, key === 'captureId' ? 'fresh-capture' : visit(value)]));
    return x;
  };
  return visit(value);
}
const digest = value => createHash('sha256').update(JSON.stringify(comparable(value))).digest('hex');

test('FINAL input preserves populated predecessors and binds every marked source before replay', async t => {
  const db = new PGlite();
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const one = async (sql, args = []) => (await query(sql, args))[0];
  const functions = () => query(`select oid,proname,oid::regprocedure::text signature,pg_get_functiondef(oid) definition,
    prosrc,to_jsonb(p)-'prosrc' metadata from pg_proc p where pronamespace in('public'::regnamespace,'private'::regnamespace)
    and prokind='f' order by oid`);
  const rows = async () => {
    const tables = await query(`select format('%I.%I',n.nspname,c.relname) name from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth') order by 1`);
    return Promise.all(tables.map(async ({ name }) => [name, await query(`select to_jsonb(r) value from ${name} r order by to_jsonb(r)::text`)]));
  };
  const fixture = async () => {
    await db.exec(await nativeCandidateRequestFixtureSql());
    await query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
    return (await one("select id from public.profiles where owner_user_id=$1 and profile_type='PERSONAL'", [actor])).id;
  };
  const sub = (name, run) => t.test(name, async () => {
    await db.exec('begin;set local extra_float_digits=3;');
    try { await run(); } finally { await db.exec('rollback;'); }
  });
  const isolated = async run => {
    await db.exec('savepoint isolated;');
    try { return await run(); } finally { await db.exec('rollback to isolated;release isolated;'); }
  };
  const reject = (run, pattern = /native FINAL/i) => isolated(() => assert.rejects(run, pattern));
  const core = async (profile, prediction = randomUUID(), context = {}) => {
    await query("select * from private.rank_items_with_identity_v1($1,$2,'FOR_YOU','MOVIE',5,$3)", [prediction, profile, context]);
    return prediction;
  };
  const validate = prediction => one('select private.validate_native_final_source_v1($1) valid', [prediction]);
  const working = (prediction, control = 'OFF') => one('select private.record_personal_working_shadow_v1($1,$2) value', [prediction, control]);
  const page = async request => (await one('select public.rank_items_page_v1($1) value', [request])).value;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    const { files } = await buildFreshInstallation();
    const index = files.findIndex(file => file.name.endsWith('_frozen_final_scoring_input.sql'));
    assert.ok(index > 0);
    for (const file of files.slice(0, index)) await db.exec(`begin;${file.sql}commit;`);
    const forward = files[index].sql;

    await sub('54 actual Personal/Shared mode/domain/acquisition cases preserve complete old traces and float8 bytes', async () => {
      const personal = await fixture();
      const request = { version: 2, requestId: randomUUID(), profileId: personal, sessionId: randomUUID(),
        discoveryMode: 'FOR_YOU', itemType: 'MOVIE', limit: 5, context: {} };
      const oldPage = await page(request), oldWorking = await working(oldPage.predictionId);
      assert.ok(oldPage.nextCursor);
      const cases = [];
      for (const profile of [personal, shared]) for (const mode of ['FOR_YOU', 'SURPRISE', 'RISK']) {
        for (const domain of [null, 'BOOK', 'MOVIE']) for (const branch of ['LEGACY', 'CATALOG_EMPTY', 'CATALOG_SEEN']) {
          cases.push({ profile, mode, domain, branch, prediction: randomUUID() });
        }
      }
      const explicit = randomUUID();
      const run = () => isolated(async () => {
        for (const name of ['rank_items_request_base_v1', 'rank_items_request_scalar_v1', 'rank_items_request_with_identity_v1']) {
          const f = (await functions()).find(row => row.proname === name);
          assert.equal(f.prosrc.split('clock_timestamp()').length - 1, 1, name);
          await db.exec(f.definition.replace(f.prosrc, () => f.prosrc.replace('clock_timestamp()', 'transaction_timestamp()')));
        }
        const results = [];
        for (const c of cases) {
          await db.exec('savepoint parity;');
          try {
            const catalogue = c.branch !== 'LEGACY';
            const args = catalogue ? [c.branch === 'CATALOG_SEEN' ? [item(100), item(120)] : [],
              c.branch === 'CATALOG_SEEN', c.prediction, c.profile, c.mode, c.domain] : [c.prediction, c.profile, c.mode, c.domain];
            const output = await query(`select r.*,encode(float8send(r.score),'hex') score_bits,
              encode(float8send(r.confidence),'hex') confidence_bits from private.${catalogue ? 'rank_items_catalog_with_identity_v1' : 'rank_items_with_identity_v1'}(
              ${args.map((_, n) => `$${n + 1}`).join(',')},20,'{}') r order by r.rank`, args);
            const source = await one('select to_jsonb(r) value from private.prediction_runs r where id=$1', [c.prediction]);
            const candidates = await query(`select to_jsonb(c) value,encode(float8send(final_score),'hex') score_bits,
              encode(float8send(scenario_score),'hex') scenario_bits from private.prediction_candidates c where prediction_id=$1 order by item_id`, [c.prediction]);
            assert.ok(candidates.length > 0);
            const comparison = c.profile === personal ? await working(c.prediction) : null;
            results.push(digest({ output, source, candidates, comparison }));
          } finally { await db.exec('rollback to parity;release parity;'); }
        }
        const evaluation = await one('select private.capture_personal_evaluation_v1($1,$2,$3,$4,$5) value',
          [explicit, personal, [item(101), item(121), item(102), item(999)], '2000-01-01', {}]);
        const source = await one('select to_jsonb(r) value from private.prediction_runs r where id=$1', [explicit]);
        const candidates = await query('select to_jsonb(c) value from private.prediction_candidates c where prediction_id=$1 order by item_id', [explicit]);
        return { results, evaluation: digest({ evaluation, source, candidates }) };
      });
      const before = await run(), retained = await rows(), originalFunctions = await functions();
      await db.exec(forward);
      assert.deepEqual(await rows(), retained, 'Upgrade must not backfill or mutate any historical row');
      const installed = await functions();
      assert.deepEqual(installed.filter(f => !originalFunctions.some(old => old.oid === f.oid)).map(f => f.proname).sort(), [...added].sort());
      for (const old of originalFunctions) {
        const current = installed.find(f => f.oid === old.oid);
        assert.deepEqual(current.metadata, old.metadata, old.signature);
        if (!changed.includes(old.proname)) assert.equal(current.prosrc, old.prosrc, old.signature);
      }
      assert.deepEqual(await run(), before, 'Every complete old trace, comparison and numeric byte must remain equal');
      assert.deepEqual(await page(request), oldPage);
      assert.deepEqual(await working(oldPage.predictionId), oldWorking);
      assert.deepEqual(await rows(), retained, 'Historical exact retries may not recapture or rewrite');
      assert.equal((await validate(oldPage.predictionId)).valid, false);
      const continued = await page({ ...request, requestId: randomUUID(), cursor: oldPage.nextCursor });
      assert.equal((await validate(continued.predictionId)).valid, false, 'Old windows stay unmarked');
      await query(`insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
        select id,genome_id from private.prediction_runs where id=$1 on conflict do nothing`, [oldPage.predictionId]);
      const replay = (await one('select private.process_shadow_prediction_jobs_v1(250) value')).value;
      assert.equal(replay.failed, 0, 'Unmarked historical replay must remain supported');
    });

    await sub('all four body/security guards, target collisions and inherited helper grants reject atomically', async () => {
      for (const f of (await functions()).filter(row => changed.includes(row.proname))) {
        for (const mutation of [f.definition.replace(f.prosrc, () => `${f.prosrc}\n-- drift`),
          `grant execute on function ${f.signature} to authenticated;`, `alter function ${f.signature} set search_path='public';`]) {
          await isolated(async () => {
            await db.exec(mutation);
            const original = await functions();
            await reject(() => db.exec(forward));
            assert.deepEqual(await functions(), original);
          });
        }
      }
      await isolated(async () => {
        await db.exec(`create role final_input_unexpected_reader;alter default privileges for role postgres in schema private
          grant execute on functions to final_input_unexpected_reader;`);
        const original = await functions();
        await reject(() => db.exec(forward), /helper access drift/);
        assert.deepEqual(await functions(), original, 'Late ACL failure must restore all four bodies');
      });
      await db.exec('create function private.native_final_run_input_v1(integer) returns integer language sql as $$select $1$$;');
      await reject(() => db.exec(forward), /target collision/);
    });

    for (const file of files.slice(index)) await db.exec(`begin;${file.sql}commit;`);
    await sub('complete marker binds empty pools and context cannot inject scoring input', async () => {
      const personal = await fixture();
      const prediction = await core(personal, randomUUID(), { finalScoringInput: { version: 'injected' }, candidateRequest: { intent: 'EVALUATION' } });
      assert.equal((await validate(prediction)).valid, true);
      const source = await one('select state_snapshot,candidate_count,result_count from private.prediction_runs where id=$1', [prediction]);
      assert.equal(source.state_snapshot.finalScoringInput.computation, 'FRESH_FINAL');
      assert.equal(source.state_snapshot.finalScoringInput.candidateIds.length, source.candidate_count);
      assert.ok(source.result_count > 0);
      for (const zone of ['Europe/Helsinki', 'America/New_York']) {
        await query("select set_config('TimeZone',$1,true)", [zone]);
        assert.equal((await validate(prediction)).valid, true, 'Run binding must compare instants across caller time zones');
      }
      const empty = randomUUID();
      await one('select private.capture_personal_evaluation_v1($1,$2,$3,$4,$5)', [empty, personal, [item(999)], '2000-01-01', {}]);
      assert.equal((await validate(empty)).valid, true);
      const marker = (await one("select state_snapshot->'finalScoringInput' value from private.prediction_runs where id=$1", [empty])).value;
      assert.deepEqual(marker.candidateIds, []);
      assert.equal(marker.candidateCount, 0);
      await query("update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,candidateIds}',$2) where id=$1", [empty, [item(999)]]);
      await reject(() => validate(empty));
    });

    await sub('missing, mixed, extra, contradictory and oversized inputs fail before cached Working or shadow consumption', async () => {
      const personal = await fixture(), prediction = await core(personal);
      await working(prediction); // A cached receipt must not bypass the new admission.
      const suppressed = (await one(`select item_id from private.prediction_candidates where prediction_id=$1
        and not selected_for_delivery order by final_rank desc limit 1`, [prediction])).item_id;
      const original = await rows();
      const mutations = [
        "update private.prediction_runs set state_snapshot=state_snapshot-'finalScoringInput' where id=$1",
        "update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,version}','\"future\"') where id=$1",
        "update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,actorUserId}','\"other\"') where id=$1",
        "update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,predictionInput,commitVisibility}','\"CERTIFIED\"') where id=$1",
        "update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,sourceGenome,config}','{}') where id=$1",
        "update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,candidateIds}','[]') where id=$1",
        "update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,policyVersion}','\"future\"') where id=$1",
        "update private.prediction_runs set state_snapshot=jsonb_set(state_snapshot,'{finalScoringInput,extra}','true') where id=$1",
        "update private.prediction_runs set requested_at=requested_at+interval '1 second' where id=$1",
        "update private.prediction_candidates set explanation=explanation-'finalScoringInput' where prediction_id=$1 and item_id=$2",
        "update private.prediction_candidates set explanation=jsonb_set(explanation,'{finalScoringInput,version}','\"future\"') where prediction_id=$1 and item_id=$2",
        "update private.prediction_candidates set explanation=jsonb_set(explanation,'{finalScoringInput,itemId}','\"other\"') where prediction_id=$1 and item_id=$2",
        "update private.prediction_candidates set explanation=jsonb_set(explanation,'{finalScoringInput,scenarioScore}','42') where prediction_id=$1 and item_id=$2",
        "update private.prediction_candidates set explanation=jsonb_set(explanation,'{finalScoringInput,explanation,scoringFeatures,longTerm}','42') where prediction_id=$1 and item_id=$2",
        "update private.prediction_candidates set explanation=jsonb_set(explanation,'{finalScoringInput,explanation,resurfacingPolicy,eligible}',to_jsonb(not (explanation#>>'{resurfacingPolicy,eligible}')::boolean)) where prediction_id=$1 and item_id=$2",
        "update private.prediction_candidates set explanation=jsonb_set(explanation,'{finalScoringInput,extra}',to_jsonb(repeat('x',2097153))) where prediction_id=$1 and item_id=$2",
        "delete from private.prediction_candidates where prediction_id=$1 and item_id=$2",
      ];
      for (const mutation of mutations) await isolated(async () => {
        await query(mutation, mutation.includes('$2') ? [prediction, suppressed] : [prediction]);
        try { await reject(() => validate(prediction)); } catch (error) { throw new Error(mutation, { cause: error }); }
        await reject(() => working(prediction));
        await db.exec('delete from private.shadow_prediction_jobs;');
        await query(`insert into private.shadow_prediction_jobs(source_prediction_id,genome_id)
          select id,genome_id from private.prediction_runs where id=$1`, [prediction]);
        const result = (await one('select private.process_shadow_prediction_jobs_v1(1) value')).value;
        assert.equal(result.failed, 1, mutation);
        assert.equal(result.processed, 0);
        assert.equal((await one('select count(*)::int n from private.shadow_prediction_runs where source_prediction_id=$1', [prediction])).n, 0);
      });
      assert.deepEqual(await rows(), original);
    });

    await sub('candidate construction rejects missing or nonfinite consumed numeric fields', async () => {
      const personal = await fixture(), prediction = await core(personal);
      const source = await one(`select c.item_id,c.explanation,c.scenario_score,r.genome_id from private.prediction_candidates c
        join private.prediction_runs r on r.id=c.prediction_id where r.id=$1 order by c.final_rank limit 1`, [prediction]);
      const build = (explanation, scenario = source.scenario_score) => one(
        'select private.native_final_candidate_input_v1($1,$2,$3,$4,$5) value',
        [prediction, source.item_id, source.genome_id, explanation, scenario]);
      assert.deepEqual((await build(source.explanation)).value, source.explanation.finalScoringInput);
      for (const field of ['direct', 'longTerm', 'shortTerm', 'novelty', 'exploration', 'reactionQueuePenalty', 'impressionCooldownPenalty']) {
        for (const value of [null, 'NaN', {}, false]) {
          const invalid = structuredClone(source.explanation); invalid.scoringFeatures[field] = value;
          await reject(() => build(invalid));
        }
      }
      for (const scenario of [null, 'NaN', 'Infinity', '-Infinity']) await reject(() => build(source.explanation, scenario));
      for (const mutate of [x => { delete x.scoringFeatures; }, x => { x.scoringFeatures.version = 'future'; },
        x => { x.sharedCommonFit.contribution = 'NaN'; }, x => { x.resurfacingInput.eligible = null; },
        x => { x.workingIntent = null; }]) {
        const invalid = structuredClone(source.explanation); mutate(invalid); await reject(() => build(invalid));
      }
    });

    await sub('protocol-2 pages rebind frozen inputs, refresh eligibility and retain source scores and exact retries', async () => {
      const personal = await fixture();
      const request = { version: 2, requestId: randomUUID(), profileId: personal, sessionId: randomUUID(),
        discoveryMode: 'FOR_YOU', itemType: 'MOVIE', limit: 5, context: {} };
      const first = await page(request);
      const retained = await query('select to_jsonb(c) value from private.prediction_candidates c where prediction_id=$1 order by item_id', [first.predictionId]);
      await db.exec("update public.items set tags=array['later-catalogue'];");
      const nextRequest = { ...request, requestId: randomUUID(), cursor: first.nextCursor };
      const next = await page(nextRequest);
      assert.equal((await validate(next.predictionId)).valid, true);
      const marker = (await one("select state_snapshot->'finalScoringInput' value from private.prediction_runs where id=$1", [next.predictionId])).value;
      assert.equal(marker.computation, 'FROZEN_PAGE_REUSE');
      assert.equal(marker.featureSourcePredictionId, first.predictionId);
      const copied = await query('select * from private.prediction_candidates where prediction_id=$1', [next.predictionId]);
      assert.ok(copied.length > 0);
      for (const c of copied) {
        const source = retained.find(x => x.value.item_id === c.item_id).value;
        assert.equal(c.final_score, source.final_score);
        assert.deepEqual(c.explanation.finalScoringInput.explanation.scoringFeatures, source.explanation.scoringFeatures);
        assert.equal(c.explanation.finalScoringInput.predictionId, next.predictionId);
      }
      assert.deepEqual(await page(nextRequest), next);
      assert.deepEqual(await query('select to_jsonb(c) value from private.prediction_candidates c where prediction_id=$1 order by item_id', [first.predictionId]), retained);
      await working(next.predictionId);
      const result = (await one('select private.process_shadow_prediction_jobs_v1(250) value')).value;
      assert.equal(result.failed, 0);
    });
  } finally { await db.close(); }
});
