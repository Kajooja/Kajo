// Proposed source-derived function supplement for the guarded empty-install probe.
// Not a migration, deployment installer or permission/history transition.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadFunctionSource } from './function-source.mjs';

const resolutions = {
  'private.stage_profile_import_rows_v1': [
    ['jsonb_array_length(input_rows) > 500', 'jsonb_array_length(input_rows) > 5000'],
    ['Import batch must contain between 1 and 500 rows', 'Import batch must contain between 1 and 5000 rows'],
  ],
  'private.resurfacing_policy_decision_v1': [
    ["is_consumed := native_consumed or bootstrap_kind in ('RATED', 'CONSUMED');",
      "is_consumed := native_consumed or coalesce(bootstrap_kind in ('RATED', 'CONSUMED'), false);"],
    ["has_rating := native_rated or bootstrap_kind = 'RATED';",
      "has_rating := native_rated or coalesce(bootstrap_kind = 'RATED', false);"],
    ["is_saved := native_saved or bootstrap_kind = 'SAVED';",
      "is_saved := native_saved or coalesce(bootstrap_kind = 'SAVED', false);"],
  ],
};

export function resolveBaselineDefinition(definition) {
  let sql = definition.sql;
  for (const [before, after] of resolutions[definition.name] ?? []) {
    assert.equal(sql.split(before).length, 2, `Expected exactly one reviewed baseline fragment in ${definition.name}`);
    sql = sql.replace(before, after);
  }
  return sql.replace(/^create(?: or replace)? function/i, 'create or replace function');
}

export async function buildBaselineFunctions() {
  const source = await loadFunctionSource(); // Rejects any changed checkpoint bytes.
  const sql = `-- EXPERIMENTAL function supplement: only inside the empty-install probe.
-- Source checkpoint: ${source.checkpoint}; cutoff: ${source.cutoff}
-- The stage limit and null-bootstrap resolutions implement the intended forward
-- changes against their original spaced source. Historical files remain intact.
-- All other final definitions use repository source; export ownership/ACL persists.
set local check_function_bodies = on;
${source.definitions.map(resolveBaselineDefinition).join('\n\n')}
-- This third final forward correction applies unchanged to canonical source.
${source.corrections.find(row => row.name === 'public.upsert_catalog_item_v1').sql}
`;
  return { sql, functionCount: source.definitions.length, sourceCheckpoint: source.checkpoint,
    cutoff: source.cutoff, resolutions: Object.keys(resolutions),
    sha256: createHash('sha256').update(sql).digest('hex') };
}
