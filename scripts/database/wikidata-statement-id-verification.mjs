import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractWikidataFilmEvidence, extractWikidataFilmEvidenceV2 } from '@kajo/catalog-contracts/wikidata-film';
import { wikidataFixture, verifyWikidataProjection, withWikidataContentFixture } from './wikidata-content-verification.mjs';
import { captureOwnedTasteNumericForecast, prepareOwnedTaste } from './owned-taste-numeric-capture.mjs';
import { captureWikidataContentNumericForecast, prepareWikidataContent } from './wikidata-content-capture.mjs';
import { prepareContent } from './personal-content-rating.mjs';
import { auth, prepare, literal } from './personal-rating-prospective.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const context = { entityId: 'Q900000001', retrievedAtMicros: '1794096000000000', cutoffMicros: '1794096000000001',
  identity: { imdbId: 'tt9000001', tmdbMovieId: '9000001' } };

/** Compare both generations on the same untouched bytes, then independently
 * re-extract each frozen native projection. Run on PGlite and native PostgreSQL. */
export async function verifyWikidataStatementIds(exec) {
  const inherited = await verifyWikidataProjection(exec, { successor: true }), cases = [];
  async function check(name, mutate, available) {
    const source = wikidataFixture(context), entity = source.entities[context.entityId];mutate(entity);
    const raw = JSON.stringify(source, null, 2), bytes = new TextEncoder().encode(raw);
    for (const [version, extract] of [[1, extractWikidataFilmEvidence], [2, extractWikidataFilmEvidenceV2]]) {
      const result = extract(bytes, context);
      const [projected] = await exec(`select coalesce(private.project_wikidata_film_v${version}(${literal(raw)},${literal(context.entityId)},
        ${literal(context.identity.imdbId)},${literal(context.identity.tmdbMovieId)},${literal(context.retrievedAtMicros)},${literal(context.cutoffMicros)}),'null'::jsonb);`);
      assert.equal(result.status === 'CANDIDATE', available[version - 1], `${name}/v${version}`);
      if (result.evidence === null) assert.equal(projected, null, name);
      else {
        assert.ok(projected, name);
        assert.deepEqual(projected.values, result.evidence.values, name);
        assert.deepEqual(projected.assertions, result.evidence.assertions, name);
        assert.equal(projected.sourceHash, sha(raw));assert.equal(projected.projectionHash, sha(projected.projectionText));
        const again = extract(new TextEncoder().encode(projected.projectionText), context);
        assert.deepEqual(again.evidence.claims, result.evidence.claims, name);
        assert.deepEqual(again.evidence.values, result.evidence.values, name);
        for (const [property, statements] of Object.entries(entity.claims))
          assert.deepEqual(again.evidence.claims[property], statements, 'Original statement IDs and claims retained');
      }
    }
    cases.push(name);
  }
  await check('uppercase unchanged', () => {}, [true, true]);
  for (const property of ['P31', 'P345', 'P4947', 'P136']) {
    await check(property + ' lowercase prefix', e => { e.claims[property][0].id = e.claims[property][0].id.replace(/^Q/, 'q'); }, [false, true]);
    await check(property + ' mixed GUID hex', e => { e.claims[property][0].id = context.entityId.toLowerCase() + '$aBcDeF12-abCD-abcd-ABCD-123456abcdef'; }, [false, true]);
    for (const prefix of ['q900000002', 'Q900000002', 'q0900000001', 'qq900000001', 'Ｑ900000001', 'ℚ900000001', 'q900000001 '])
      await check(property + ' wrong prefix ' + prefix, e => { e.claims[property][0].id = prefix + '$00000000-0000-4000-8000-000000000099'; }, [false, false]);
    for (const suffix of ['00000000-0000-4000-8000-00000000000g', '00000000-0000-4000-8000-00000000000', '00000000-0000-4000-8000-000000000099$'])
      await check(property + ' malformed GUID ' + suffix, e => { e.claims[property][0].id = context.entityId.toLowerCase() + '$' + suffix; }, [false, false]);
  }
  const lowerAll = e => { for (const rows of Object.values(e.claims)) for (const row of rows) row.id = row.id.replace(/^Q/, 'q'); };
  await check('all lowercase', lowerAll, [false, true]);
  await check('case-equivalent duplicate', e => { const row = e.claims.P136[0];e.claims.P136.push({ ...row, id: row.id.replace(/^Q/, 'q') }); }, [false, false]);
  await check('entity ID remains uppercase', e => { lowerAll(e);e.id = e.id.toLowerCase(); }, [false, false]);
  await check('value ID remains uppercase', e => { lowerAll(e);e.claims.P136[0].mainsnak.datavalue.value.id = 'q471839'; }, [false, false]);
  await check('external identity remains exact', e => { lowerAll(e);e.claims.P345[0].mainsnak.datavalue.value = 'TT9000001'; }, [false, false]);
  await check('qualified identity excluded', e => { lowerAll(e);e.claims.P345[0].qualifiers = { P1810: [{ property: 'P1810', snaktype: 'somevalue' }] }; }, [false, false]);
  await check('unsupported film type excluded', e => { lowerAll(e);e.claims.P31[0].mainsnak.datavalue.value = { 'entity-type': 'item', id: 'Q202866' }; }, [false, false]);
  await check('unknown genre unavailable', e => { lowerAll(e);e.claims.P136 = []; }, [false, false]);
  await check('preferred invalid suppresses normal', e => { const row = structuredClone(e.claims.P136[0]);row.id = 'q900000002$00000000-0000-4000-8000-000000000009';row.rank = 'preferred';e.claims.P136.push(row); }, [false, false]);
  return { status: 'PASS', inheritedCases: inherited.count, cases, count: cases.length,
    originalBytes: 'UNCHANGED', bothGenerations: 'INDEPENDENT_NATIVE_PARITY', qualityAdmission: 'NONE' };
}

/** Populated v1-v4 forward and rollback. The v4 frozen prefix deliberately has
 * unavailable lowercase sources: installing v5 must never refill that history. */
export async function verifyWikidataStatementIdUpgrade(exec, withSession, migration) {
  return withWikidataContentFixture(exec, withSession, async ({ f, one, capture, captureContent, contentFeatureUse, request }) => {
    const v1 = await capture(f.targets[0]), v2 = await captureContent(f.targets[1]);
    const v3Request = await request(), v3 = await captureOwnedTasteNumericForecast(withSession, { ...v3Request, featureUse: contentFeatureUse });
    const v4Request = await request();
    v4Request.target = await one(`select to_jsonb(c.item_id) from private.prediction_candidates c
      where c.prediction_id=${literal(v4Request.source)} and c.selected_for_delivery
        and not exists(select 1 from private.personal_rating_inputs i where i.target_item_id=c.item_id)
      order by c.final_rank limit 1;`);
    assert.ok(v4Request.target, 'A distinct retained v4 target is required');
    const v4 = await captureWikidataContentNumericForecast(withSession, v4Request);
    assert.ok(v4.preparation.input.contentFeatures.objects.every(o => o.provenance === null));
    assert.equal(v4.forecast.contentFit.status, 'INSUFFICIENT_FEATURE_SUPPORT');
    const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth');`);
    const rows = `select jsonb_object_agg(name,value) from (${tables.map(name =>
      `select ${literal(name)} name,md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text) value from ${name} r`).join(' union all ')}) snapshot;`;
    const functions = `select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p where pronamespace in('public'::regnamespace,'private'::regnamespace);`;
    const security = `select jsonb_build_object('relations',(select jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.oid)
      from pg_class c where c.relnamespace in('public'::regnamespace,'private'::regnamespace,'auth'::regnamespace)),
      'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p),
      'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t where not t.tgisinternal));`;
    return withSession(async connection => {
      const query = async sql => (await connection(sql, { stage: 'statement-id-upgrade', timeoutMs: 180_000 }))[0];
      await connection(`begin;set local extra_float_digits=3;${auth(f.actor)}`, { stage: 'statement-id-upgrade-begin' });
      try {
        const before = await query(rows), oldFunctions = await query(functions), oldSecurity = await query(security);
        await connection(migration.sql, { stage: 'statement-id-upgrade-migration', timeoutMs: 180_000 });
        assert.deepEqual(await query(rows), before, 'Statement-ID forward changed predecessor rows');
        assert.deepEqual(await query(security), oldSecurity, 'Statement-ID forward changed relation security or triggers');
        const after = await query(functions);
        for (const old of oldFunctions) {
          const expected = old.proname === 'withdraw_personal_rating_training_source_v2' ? { ...old, prosrc: old.prosrc.replace(
            "i.preparation->>'version' in('kajo-personal-content-rating-preparation-v2','kajo-personal-content-rating-preparation-v3')",
            "i.preparation->>'version' in('kajo-personal-content-rating-preparation-v2','kajo-personal-content-rating-preparation-v3','kajo-personal-content-rating-preparation-v4')") } : old;
          assert.deepEqual(after.find(row => row.oid === old.oid), expected, 'Statement-ID forward changed unreviewed function: ' + old.proname);
        }
        const added = after.filter(row => !oldFunctions.some(old => old.oid === row.oid));
        assert.deepEqual(added.map(row => row.proname).sort(), ['wikidata_statement_value_v2', 'project_wikidata_film_v2',
          'capture_personal_rating_content_v3', 'prepare_personal_rating_forecast_v5', 'finalize_personal_rating_forecast_v5'].sort());
        for (const fn of added) {
          assert.equal(fn.prosecdef, false);assert.deepEqual(fn.proconfig, ['search_path=""']);
          assert.equal(await query(`select to_jsonb(exists(select 1 from unnest(array['anon','authenticated','service_role']) role
            where has_function_privilege(role,${fn.oid},'EXECUTE')));`), false, 'New helper EXECUTE must remain closed');
        }
        for (const [sql, expected] of [[prepare(v1.preparation.forecastId, v1.preparation.sourcePredictionId, v1.preparation.targetItemId), v1.stored],
          [prepareContent(v2.preparation.forecastId, v2.preparation.sourcePredictionId, v2.preparation.targetItemId, 3600, 'synthetic', contentFeatureUse), v2.stored],
          [prepareOwnedTaste({ ...v3Request, featureUse: contentFeatureUse }), v3.stored], [prepareWikidataContent(v4Request), v4.stored]])
          assert.deepEqual(await query('select ' + sql + ';'), expected, 'Retained generation exact retry changed');
        assert.deepEqual(await query(rows), before, 'Upgrade retry changed predecessor rows');
        await connection('rollback;begin read only;set local extra_float_digits=3;', { stage: 'statement-id-upgrade-readback' });
        assert.deepEqual(await query(functions), oldFunctions, 'Rollback did not restore predecessor functions');
        assert.deepEqual(await query(security), oldSecurity, 'Rollback did not restore predecessor security');
        assert.deepEqual(await query(rows), before, 'Rollback did not restore predecessor rows');
        await connection('rollback;', { stage: 'statement-id-upgrade-readback-rollback' });
        return { status: 'PASS', retainedCaptures: 4, retainedTasteAnswers: 2, newPrivateFunctions: 5,
          v1V2V3V4Retries: 'EXACT', unavailableV4: 'NOT_REINTERPRETED', migration: 'ROLLED_BACK', qualityAdmission: 'NONE', servingActivation: 'NONE' };
      } catch (error) { await connection('rollback;', { stage: 'statement-id-upgrade-rollback' }).catch(() => {});throw error; }
    });
  }, { lowercase: true });
}
