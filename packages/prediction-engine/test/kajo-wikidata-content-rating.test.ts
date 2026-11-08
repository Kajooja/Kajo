import { expect, it } from 'vitest';
import { WIKIDATA_FILM_MAPPING, WIKIDATA_FILM_MAPPING_SHA256, WIKIDATA_FILM_MAPPING_V2, WIKIDATA_FILM_MAPPING_V2_SHA256 } from '@kajo/catalog-contracts/wikidata-film';
import { personalContentFeatureContract } from '../src/adapters/kajo-personal-content-rating.js';
import { wikidataContentFeatureContract, wikidataContentFeatureContractV2 } from '../src/adapters/kajo-wikidata-content-rating.js';

for (const [contract, mapping, hash] of [[wikidataContentFeatureContract, WIKIDATA_FILM_MAPPING, WIKIDATA_FILM_MAPPING_SHA256],
  [wikidataContentFeatureContractV2, WIKIDATA_FILM_MAPPING_V2, WIKIDATA_FILM_MAPPING_V2_SHA256]] as const)
it(`pins independent mappings and assertion semantics: ${contract.mappingVersion}`, async () => {
  const binding = [contract.mappingVersion,
    `${mapping.version}:${hash}`,
    `${personalContentFeatureContract.mappingVersion}:${personalContentFeatureContract.mappingHash}`,
    personalContentFeatureContract.transformVersion].join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(binding));
  expect(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''))
    .toBe(contract.mappingHash);
  expect(contract.concepts).toEqual(mapping.concepts);
  expect(contract.transformVersion).toBe(personalContentFeatureContract.transformVersion);
});
