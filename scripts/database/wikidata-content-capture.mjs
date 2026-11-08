import assert from 'node:assert/strict';
import { personalContentRatingCore } from './personal-content-rating.mjs';
import { auth, json, literal } from './personal-rating-prospective.mjs';

export const prepareWikidataContent = request => `private.prepare_personal_rating_forecast_v4(${literal(request.id)},
  ${literal(request.source)},${literal(request.target)},${request.horizon ?? 3600},
  ${literal(request.origin ?? 'observed')},${json(request.featureUse ?? null)})`;
export const finalizeWikidataContent = (id, forecast) => `private.finalize_personal_rating_forecast_v4(${literal(id)},${json(forecast)})`;

/** New opt-in private generation. Never route an old capture through this
 * worker or refill a withdrawn declaration. The caller retains permission,
 * development-window and target selection evidence before opening a capture. */
export async function captureWikidataContentNumericForecast(withSqlSession, request, hooks = {}) {
  const uuid = value => typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
  assert.ok(request && [request.actor, request.id, request.source, request.target].every(uuid), 'Invalid Wikidata content capture UUID');
  assert.ok(Number.isInteger(request.horizon ?? 3600) && (request.horizon ?? 3600) >= 1
    && (request.horizon ?? 3600) <= 7776000, 'Invalid Wikidata content capture horizon');
  assert.ok(['observed', 'synthetic'].includes(request.origin ?? 'observed'), 'Invalid Wikidata content capture origin');
  const { forecastPersonalContentRating } = await personalContentRatingCore();
  const { normalizeKajoWikidataContentRatingPrefix } = await import('../../packages/prediction-engine/dist/adapters/kajo-wikidata-content-rating.js');
  return withSqlSession(async exec => {
    await exec(`begin;set local extra_float_digits=3;${auth(request.actor)}`, { stage: 'wikidata-content-begin' });
    try {
      await hooks.beforePrepare?.({ exec });
      const [preparation] = await exec(`select ${prepareWikidataContent(request)};`, { stage: 'wikidata-content-prepare' });
      const forecast = preparation.forecast ?? forecastPersonalContentRating(normalizeKajoWikidataContentRatingPrefix(preparation.input));
      await hooks.beforeFinalize?.({ exec, preparation, forecast });
      const [stored] = await exec(`select ${finalizeWikidataContent(request.id, forecast)};`, { stage: 'wikidata-content-finalize' });
      await hooks.beforeCommit?.({ exec, preparation, forecast, stored });
      await exec('commit;', { stage: 'wikidata-content-commit' });
      return { preparation, forecast, stored };
    } catch (error) {
      await exec('rollback;', { stage: 'wikidata-content-rollback' }).catch(() => {});
      throw error;
    }
  });
}
