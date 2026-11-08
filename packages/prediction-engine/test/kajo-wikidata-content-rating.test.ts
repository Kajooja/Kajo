import { expect, it } from 'vitest';
import { WIKIDATA_FILM_MAPPING, WIKIDATA_FILM_MAPPING_SHA256 } from '@kajo/catalog-contracts/wikidata-film';
import { personalContentFeatureContract } from '../src/adapters/kajo-personal-content-rating.js';
import { wikidataContentFeatureContract } from '../src/adapters/kajo-wikidata-content-rating.js';

it('pins the two independent provider mappings and common assertion semantics', async () => {
  const binding = [wikidataContentFeatureContract.mappingVersion,
    `${WIKIDATA_FILM_MAPPING.version}:${WIKIDATA_FILM_MAPPING_SHA256}`,
    `${personalContentFeatureContract.mappingVersion}:${personalContentFeatureContract.mappingHash}`,
    personalContentFeatureContract.transformVersion].join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(binding));
  expect(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''))
    .toBe(wikidataContentFeatureContract.mappingHash);
  expect(wikidataContentFeatureContract.concepts).toEqual(WIKIDATA_FILM_MAPPING.concepts);
  expect(wikidataContentFeatureContract.transformVersion).toBe(personalContentFeatureContract.transformVersion);
});
