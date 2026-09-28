import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import fixture from '../../packages/catalog-contracts/fixtures.json' with { type: 'json' };
import { catalogDescriptionFixtureSql } from './catalog-descriptions.mjs';
const literal = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
export const ATTRIBUTION_MODE = 'open-library-description-v2';

export function catalogAttributionFixtureSql() {
  const attribution = `(${literal(fixture.attribution)} || jsonb_build_object(
    'textSha256',entry #> '{provenance,textSha256}','recordSha256',entry #> '{provenance,recordSha256}'))`;
  return `${catalogDescriptionFixtureSql()}
    update description_entries set entry = jsonb_set(jsonb_set(entry,
      '{provenance}',(entry->'provenance') || jsonb_build_object('contract','${ATTRIBUTION_MODE}','attribution',${attribution})),
      '{enrichment}',(entry->'enrichment') || jsonb_build_object('contract','${ATTRIBUTION_MODE}',
        'permission',${literal(fixture.permission)} || jsonb_build_object('attribution',${attribution},
          'textSha256',entry #> '{provenance,textSha256}','recordSha256',entry #> '{provenance,recordSha256}')));
  `;
}

export async function catalogAttributionSmokeSql() {
  return `begin; ${catalogAttributionFixtureSql()}
    ${await readFile(new URL('catalog-attribution-smoke.sql', import.meta.url), 'utf8')} rollback;`;
}

export function catalogAttributionUpgradeSql(migration) {
  assert.ok(migration.name.endsWith('_description_attribution.sql'));
  return `begin; ${catalogDescriptionFixtureSql()}
    do $seed$ begin
      perform public.upsert_catalog_item_v1((select entry from description_entries where position=1),'open-library-description-v1');
    end $seed$;
    create temporary table attribution_upgrade_before as select pg_temp.description_snapshot() as value;
    ${migration.sql}
    do $check$ begin
      if (select value from attribution_upgrade_before) is distinct from pg_temp.description_snapshot() then
        raise exception 'Attribution migration changed existing descriptions or catalog';
      end if;
    end $check$;
    select jsonb_build_object('catalogAttributionUpgrade','PASS: unchanged populated v1 and legacy catalog') as snapshot;
    rollback;`;
}
