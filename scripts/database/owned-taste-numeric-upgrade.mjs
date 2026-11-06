import assert from 'node:assert/strict';
import { withOwnedTasteNumericFixture } from './owned-taste-numeric-verification.mjs';
import { prepareContent } from './personal-content-rating.mjs';
import { auth, prepare, literal } from './personal-rating-prospective.mjs';

/** Rehearse the append-only forward on committed predecessor Taste and both
 * numeric generations. The DDL and all copied-state inspections roll back. */
export async function verifyOwnedTasteNumericUpgrade(exec, withSession, migration) {
  return withOwnedTasteNumericFixture(exec, withSession, async ({ f, one, capture, captureContent, contentFeatureUse }) => {
    const v1 = await capture(f.targets[0]), v2 = await captureContent(f.targets[1]);
    const tables = await one(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','private','auth');`, 'owned-upgrade-tables');
    const rows = `select jsonb_object_agg(name,value) from (${tables.map(name =>
      `select ${literal(name)} name,md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text) value from ${name} r`).join(' union all ')}) snapshot;`;
    const functions = `select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p
      where pronamespace in('public'::regnamespace,'private'::regnamespace);`;
    return withSession(async connection => {
      const query = async sql => (await connection(sql, { stage: 'owned-taste-upgrade', timeoutMs: 180_000 }))[0];
      await connection(`begin;set local extra_float_digits=3;${auth(f.actor)}`, { stage: 'owned-taste-upgrade-begin' });
      try {
        const before = await query(rows), oldFunctions = await query(functions);
        await connection(migration.sql, { stage: 'owned-taste-upgrade-migration', timeoutMs: 180_000 });
        assert.deepEqual(await query(rows), before, 'Owned Taste forward changed predecessor rows');
        const after = await query(functions);
        const patches = {
          check_personal_rating_content_withdrawal_budget_v1: [
            '    union all select 1 from private.personal_rating_event_refs r where r.forecast_id=any(forecast_ids)',
            '\n    union all select 1 from private.personal_rating_bootstrap_refs r where r.forecast_id=any(forecast_ids)\n    union all select 1 from private.personal_rating_taste_lineage_refs r where r.forecast_id=any(forecast_ids)',
          ],
          erase_prediction_sources_v1: [
            '    union all select 1 from private.personal_rating_event_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)',
            '\n    union all select 1 from private.personal_rating_bootstrap_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)\n    union all select 1 from private.personal_rating_taste_lineage_refs r join private.personal_rating_allocations a on a.id=r.forecast_id where a.source_prediction_id=any(source_ids)',
          ],
        };
        for (const old of oldFunctions) {
          const patch = patches[old.proname];
          assert.deepEqual(after.find(row => row.oid === old.oid), patch
            ? { ...old, prosrc: old.prosrc.replace(patch[0], patch[0] + patch[1]) } : old,
          'Owned Taste forward changed an unreviewed function property: ' + old.proname);
        }
        const newFunctions = after.filter(row => !oldFunctions.some(old => old.oid === row.oid));
        assert.deepEqual(newFunctions.map(row => row.proname).sort(), ['finalize_personal_rating_forecast_v3',
          'personal_rating_training_sources_v2', 'prepare_personal_rating_forecast_v3', 'withdraw_personal_rating_training_source_v2'].sort());
        for (const fn of newFunctions) {
          assert.equal(fn.prosecdef, fn.proname === 'withdraw_personal_rating_training_source_v2');
          assert.deepEqual(fn.proconfig, ['search_path=""']);
          assert.equal(await query(`select exists(select 1 from unnest(array['anon','authenticated','service_role']) role
            where has_function_privilege(role,${fn.oid},'EXECUTE'));`), false, 'New helper EXECUTE must remain closed');
        }
        for (const table of ['private.personal_rating_bootstrap_refs', 'private.personal_rating_taste_lineage_refs']) {
          assert.equal(await query(`select relrowsecurity from pg_class where oid=${literal(table)}::regclass;`), true, 'New source refs require RLS');
          assert.equal(await query(`select exists(select 1 from unnest(array['anon','authenticated','service_role']) role
            where has_table_privilege(role,${literal(table)},'SELECT,INSERT,UPDATE,DELETE'));`), false, 'New source refs permission must remain closed');
        }
        assert.deepEqual(await query('select ' + prepare(v1.preparation.forecastId, v1.preparation.sourcePredictionId,
          v1.preparation.targetItemId) + ';'), v1.stored, 'V1 exact retry changed');
        assert.deepEqual(await query('select ' + prepareContent(v2.preparation.forecastId, v2.preparation.sourcePredictionId,
          v2.preparation.targetItemId, 3600, 'synthetic', contentFeatureUse) + ';'), v2.stored, 'V2 exact retry changed');
        assert.deepEqual(await query(rows), before, 'Upgrade retry changed predecessor rows');
        await connection('rollback;', { stage: 'owned-taste-upgrade-rollback' });
        assert.deepEqual(await query(functions), oldFunctions, 'Rollback did not restore predecessor functions');
        assert.deepEqual(await query(rows), before, 'Rollback did not restore predecessor rows');
        return { status: 'PASS', retainedCaptures: 2, retainedTasteAnswers: 2, newPrivateTables: 2, newPrivateFunctions: 4,
          v1AndV2Retries: 'EXACT', migration: 'ROLLED_BACK', qualityAdmission: 'NONE', servingActivation: 'NONE' };
      } catch (error) {
        await connection('rollback;', { stage: 'owned-taste-upgrade-rollback' }).catch(() => {});throw error;
      }
    });
  });
}
