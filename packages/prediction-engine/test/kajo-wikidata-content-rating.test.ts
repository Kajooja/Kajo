import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { WIKIDATA_FILM_MAPPING, WIKIDATA_FILM_MAPPING_SHA256 } from '@kajo/catalog-contracts/wikidata-film';
import { personalContentFeatureContract } from '../src/adapters/kajo-personal-content-rating.js';
import { wikidataContentFeatureContract } from '../src/adapters/kajo-wikidata-content-rating.js';

it('pins the two independent provider mappings and common assertion semantics', () => {
  const binding = [wikidataContentFeatureContract.mappingVersion,
    `${WIKIDATA_FILM_MAPPING.version}:${WIKIDATA_FILM_MAPPING_SHA256}`,
    `${personalContentFeatureContract.mappingVersion}:${personalContentFeatureContract.mappingHash}`,
    personalContentFeatureContract.transformVersion].join('\n');
  expect(createHash('sha256').update(binding).digest('hex')).toBe(wikidataContentFeatureContract.mappingHash);
  expect(wikidataContentFeatureContract.concepts).toEqual(WIKIDATA_FILM_MAPPING.concepts);
  expect(wikidataContentFeatureContract.transformVersion).toBe(personalContentFeatureContract.transformVersion);
});
