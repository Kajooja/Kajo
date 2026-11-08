import assert from 'node:assert/strict';
import { withOwnedTasteNumericFixture } from './owned-taste-numeric-verification.mjs';
import { captureOwnedTasteNumericForecast, prepareOwnedTaste } from './owned-taste-numeric-capture.mjs';
import { prepareContent } from './personal-content-rating.mjs';
import { auth, prepare, literal } from './personal-rating-prospective.mjs';

/** Rehearse the append-only forward on committed predecessor Taste and both
 * numeric generations. The DDL and all copied-state inspections roll back. */
export async function verifyWikidataContentUpgrade(exec, withSession, migration) {
  return withOwnedTasteNumericFixture(exec, withSession, async ({ f, one, capture, captureContent, contentFeatureUse, request }) => {
    const v1 = await capture(f.targets[0]), v2 = await captureContent(f.targets[1]);
    const v3Request = await request(), v3 = await captureOwnedTasteNumericForecast(withSession, v3Request);
    const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth');`, 'owned-upgrade-tables');
    const rows = `select jsonb_object_agg(name,value) from (${tables.map(name =>
      `select ${literal(name)} name,md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text) value from ${name} r`).join(' union all ')}) snapshot;`;
    const functions = `select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p
      where pronamespace in('public'::regnamespace,'private'::regnamespace);`;
    return withSession(async connection => {
      const query = async sql => (await connection(sql, { stage: 'wikidata-upgrade', timeoutMs: 180_000 }))[0];
      await connection(`begin;set local extra_float_digits=3;${auth(f.actor)}`, { stage: 'wikidata-upgrade-begin' });
      try {
        const before = await query(rows), oldFunctions = await query(functions);
        await connection(migration.sql, { stage: 'wikidata-upgrade-migration', timeoutMs: 180_000 });
        assert.deepEqual(await query(rows), before, 'Wikidata forward changed predecessor rows');
        const after = await query(functions);
        const patches = {
          check_personal_rating_content_withdrawal_budget_v1: [
            '    union all select 1 from private.personal_rating_event_refs r where r.forecast_id=any(forecast_ids)',
            '\n    union all select 1 from private.personal_rating_catalog_item_refs r where r.forecast_id=any(forecast_ids)',
          ],
          erase_prediction_sources_v1: [
            '    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)',
            '\n    union all select 1 from private.personal_rating_catalog_item_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)',
          ],
        };
        for (const old of oldFunctions) {
          const patch = patches[old.proname];
          const training = old.proname === 'withdraw_personal_rating_training_source_v2';
          assert.deepEqual(after.find(row => row.oid === old.oid), patch
            ? { ...old, prosrc: old.prosrc.replace(patch[0], patch[0] + patch[1]) } : training ? { ...old, prosrc: old.prosrc.replace(
              "i.preparation->>'version'='kajo-personal-content-rating-preparation-v2'",
              "i.preparation->>'version' in('kajo-personal-content-rating-preparation-v2','kajo-personal-content-rating-preparation-v3')") } : old,
          'Wikidata forward changed an unreviewed function property: ' + old.proname);
        }
        const newFunctions = after.filter(row => !oldFunctions.some(old => old.oid === row.oid));
        assert.deepEqual(newFunctions.map(row => row.proname).sort(), ['wikidata_bounded_json_v1', 'wikidata_snak_map_v1', 'wikidata_key_order_v1', 'wikidata_tmdb_reference_v1',
          'wikidata_statement_value_v1', 'project_wikidata_film_v1', 'validate_personal_rating_feature_use_v2',
          'personal_rating_source_committed_v1', 'capture_personal_rating_content_v2', 'withdraw_personal_rating_catalog_v2', 'prepare_personal_rating_forecast_v4',
          'finalize_personal_rating_forecast_v4'].sort());
        for (const fn of newFunctions) {
          assert.equal(fn.prosecdef, fn.proname === 'withdraw_personal_rating_catalog_v2');
          assert.deepEqual(fn.proconfig, ['search_path=""']);
          assert.equal(await query(`select to_jsonb(exists(select 1 from unnest(array['anon','authenticated','service_role']) role
            where has_function_privilege(role,${fn.oid},'EXECUTE')));`), false, 'New helper EXECUTE must remain closed');
        }
        for (const table of ['private.personal_rating_catalog_item_refs']) {
          assert.equal(await query(`select to_jsonb(relrowsecurity) from pg_class where oid=${literal(table)}::regclass;`), true, 'New source refs require RLS');
          assert.equal(await query(`select to_jsonb(exists(select 1 from unnest(array['anon','authenticated','service_role']) role
            where has_table_privilege(role,${literal(table)},'SELECT,INSERT,UPDATE,DELETE')));`), false, 'New source refs permission must remain closed');
        }
        assert.deepEqual(await query('select ' + prepare(v1.preparation.forecastId, v1.preparation.sourcePredictionId,
          v1.preparation.targetItemId) + ';'), v1.stored, 'V1 exact retry changed');
        assert.deepEqual(await query('select ' + prepareContent(v2.preparation.forecastId, v2.preparation.sourcePredictionId,
          v2.preparation.targetItemId, 3600, 'synthetic', contentFeatureUse) + ';'), v2.stored, 'V2 exact retry changed');
        assert.deepEqual(await query('select ' + prepareOwnedTaste(v3Request) + ';'), v3.stored, 'V3 exact retry changed');
        assert.deepEqual(await query(rows), before, 'Upgrade retry changed predecessor rows');
        await connection('rollback;', { stage: 'wikidata-upgrade-rollback' });
        // ROLLBACK also restores the caller's float serialization settings.
        // Read the restored rows at the same precision as the before snapshot.
        await connection('begin read only;set local extra_float_digits=3;', { stage: 'wikidata-upgrade-readback' });
        assert.deepEqual(await query(functions), oldFunctions, 'Rollback did not restore predecessor functions');
        assert.deepEqual(await query(rows), before, 'Rollback did not restore predecessor rows');
        await connection('rollback;', { stage: 'wikidata-upgrade-readback-rollback' });
        return { status: 'PASS', retainedCaptures: 3, retainedTasteAnswers: 2, newPrivateTables: 1, newPrivateFunctions: 12,
          v1V2V3Retries: 'EXACT', migration: 'ROLLED_BACK', qualityAdmission: 'NONE', servingActivation: 'NONE' };
      } catch (error) {
        await connection('rollback;', { stage: 'wikidata-upgrade-rollback' }).catch(() => {});throw error;
      }
    });
  });
}
