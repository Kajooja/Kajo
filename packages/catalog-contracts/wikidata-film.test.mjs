import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { extractWikidataFilmEvidence, inspectWikidataFilmBatch,
  WIKIDATA_FILM_MAPPING, WIKIDATA_FILM_MAPPING_SHA256 } from '@kajo/catalog-contracts/wikidata-film';

// Invented identities and statements: no observed source, user history or rights.
const entityId = 'Q900000001';
const context = { entityId, retrievedAtMicros: '1794096000000000', cutoffMicros: '1794096000000001',
  identity: { imdbId: 'tt9000001', tmdbMovieId: '9000001' } };
const bytes = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const sha = value => createHash('sha256').update(value).digest('hex');
function statement(property, value, number = 1, extra = {}) {
  const external = ['P345', 'P4947'].includes(property);
  return { id: `${entityId}$00000000-0000-4000-8000-${String(number).padStart(12, '0')}`, type: 'statement', rank: 'normal',
    mainsnak: { snaktype: 'value', property, datatype: external ? 'external-id' : 'wikibase-item',
      datavalue: { type: external ? 'string' : 'wikibase-entityid', value: external ? value
        : { 'entity-type': 'item', 'numeric-id': Number(value.slice(1)), id: value } } }, ...extra };
}
function source(genres = [statement('P136', 'Q471839', 4)]) {
  return { entities: { [entityId]: { type: 'item', id: entityId, lastrevid: 100,
    modified: '2026-11-01T12:00:00Z', labels: { en: { value: 'SYNTHETIC NOT A REAL FILM' } },
    descriptions: { en: { value: 'Must never enter the evidence projection' } },
    claims: { P31: [statement('P31', 'Q11424', 1)], P345: [statement('P345', 'tt9000001', 2)],
      P4947: [statement('P4947', '9000001', 3)], P136: genres } } } };
}
function extract(value = source(), changes = {}) {
  return extractWikidataFilmEvidence(bytes(value), { ...structuredClone(context), ...changes });
}
const reference = snak => ({ hash: 'a'.repeat(40), snaks: { [snak.property]: [snak] }, 'snaks-order': [snak.property] });
const refValue = (property, value, type = 'string') => ({ property, snaktype: 'value', datavalue: { type, value } });
const id = n => `f4360000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function item(n = 1) {
  return { itemId: id(n), itemType: 'MOVIE', aliases: [
    { namespace: 'imdb_title', externalId: 'tt9000001' }, { namespace: 'tmdb_movie', externalId: '9000001' }], sources: [] };
}
const catalogue = items => ({ version: 'wikidata-film-catalogue-review-v1', complete: true,
  cutoffMicros: context.cutoffMicros, items });
const request = (n = 1) => ({ itemId: id(n), entityId, retrievedAtMicros: context.retrievedAtMicros, bytes: bytes(source()) });

test('the reviewed six mappings and canonical mapping digest are fixed independently', async t => {
  const expected = [['Q157394', 0], ['Q200092', 1], ['Q1200678', 2], ['Q1054574', 3], ['Q471839', 4], ['Q2484376', 5]];
  for (const [genre, index] of expected) await t.test(genre, () => {
    const result = extract(source([statement('P136', genre, 4)]));
    assert.deepEqual(result.evidence.values, Array.from({ length: 6 }, (_, n) => n === index ? 1 : 0));
  });
  const sort = value => Array.isArray(value) ? value.map(sort) : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
  assert.equal(WIKIDATA_FILM_MAPPING_SHA256, sha(JSON.stringify(sort(WIKIDATA_FILM_MAPPING))));
  assert.equal(WIKIDATA_FILM_MAPPING_SHA256, '22f5e0ec0682e44d803d2c68fb69ba7bf0709b59ba14c44f118f00ba0ce3b9e8');
});

test('direct finite mapping binds exact bytes, revision, clock and unresolved origin', () => {
  const s = source(Object.keys(WIKIDATA_FILM_MAPPING.genreItems).map((genre, i) => statement('P136', genre, i + 4)));
  const result = extract(s), e = result.evidence;
  assert.equal(result.status, 'CANDIDATE'); assert.equal(result.reason, null);
  assert.deepEqual(e.values, [1, 1, 1, 1, 1, 1]); assert.deepEqual(e.assertions, e.values);
  assert.equal(e.sourceSha256, sha(bytes(s))); assert.equal(e.revisionId, 100);
  assert.equal(e.retrievedAtMicros, context.retrievedAtMicros);
  assert.equal(e.sourceModifiedAt, '2026-11-01T12:00:00Z');
  assert.match(e.sourceUrl, /Q900000001\.json\?revision=100$/);
  assert.equal(e.mappingSha256, WIKIDATA_FILM_MAPPING_SHA256);
  assert.equal(e.originAssessment, 'UNRESOLVED_REQUIRES_SOURCE_USE_REVIEW'); assert.equal(e.admission, 'NONE');
  assert.deepEqual(e.claims.P136, s.entities[entityId].claims.P136);
  assert.equal(JSON.stringify(e).includes('Must never'), false);
  assert.equal(JSON.stringify(e).includes('SYNTHETIC NOT'), false);
  assert.ok(Object.isFrozen(e.claims.P136[0].mainsnak));
  assert.throws(() => { e.values[0] = 0; }, TypeError);
  assert.deepEqual(extract(s), result);
  assert.deepEqual(extract(s, { cutoffMicros: '1794096000000002' }), result, 'Cutoff cannot rewrite actual retrieval time');
  assert.notEqual(extract(JSON.stringify(s, null, 2)).evidence.sourceSha256, e.sourceSha256, 'Hash binds exact source bytes');
  const changed = structuredClone(s); changed.entities[entityId].lastrevid++;
  assert.notEqual(extract(changed).evidence.evidenceSha256, e.evidenceSha256);
  const ordered = JSON.parse(JSON.stringify(s), (key, value) => value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).reverse()) : value);
  const reordered = extract(ordered);
  assert.deepEqual(reordered.evidence.values, e.values);
  assert.notEqual(reordered.evidence.sourceSha256, e.sourceSha256);
});

test('assertion-not-present is distinct from missing whole-source support', () => {
  assert.deepEqual(extract().evidence.assertions, [null, null, null, null, 1, null]);
  assert.deepEqual(extract().evidence.values, [0, 0, 0, 0, 1, 0]);
  for (const genres of [[], [statement('P136', 'Q188473', 4)]]) {
    const result = extract(source(genres));
    assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.reason, 'NO_MAPPED_ASSERTION');
    assert.equal(result.evidence.values, null); assert.deepEqual(result.evidence.assertions, Array(6).fill(null));
  }
});

test('rank is chosen before semantic filters with no suppressed-normal fallback', async t => {
  const normal = statement('P136', 'Q471839', 4);
  const cases = [
    ['unmapped', statement('P136', 'Q188473', 5), 'UNMAPPED_GENRE'],
    ['qualified', statement('P136', 'Q200092', 5, { qualifiers: { P580: [refValue('P580', 'unknown')] } }), 'QUALIFIED_STATEMENT'],
    ['novalue', statement('P136', 'Q200092', 5, { mainsnak: { property: 'P136', snaktype: 'novalue' } }), 'NON_VALUE_STATEMENT'],
    ['somevalue', statement('P136', 'Q200092', 5, { mainsnak: { property: 'P136', snaktype: 'somevalue' } }), 'NON_VALUE_STATEMENT'],
    ['malformed', statement('P136', 'Q200092', 5, { mainsnak: {} }), 'MALFORMED_STATEMENT'],
    ['TMDB reference', statement('P136', 'Q200092', 5, { references: [reference(refValue('P854', 'https://www.themoviedb.org/movie/1'))] }), 'TMDB_ORIGIN_REFERENCE'],
  ];
  for (const [name, preferred, reason] of cases) await t.test(name, () => {
    preferred.rank = 'preferred';
    const result = extract(source([normal, preferred]));
    assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.evidence.values, null);
    assert.deepEqual(result.evidence.diagnostics.map(row => row.reason), ['SUPPRESSED_NORMAL_RANK', reason]);
  });
  const preferred = statement('P136', 'Q200092', 5, { rank: 'preferred' });
  const result = extract(source([normal, preferred]));
  assert.deepEqual(result.evidence.values, [0, 1, 0, 0, 0, 0]);
  assert.deepEqual(extract(source([normal, { ...preferred, rank: 'deprecated' }])).evidence.values, [0, 0, 0, 0, 1, 0]);
});

test('known TMDB-origin references are quarantined without fetching their URLs', async t => {
  for (const marker of [refValue('P248', { id: 'Q20828898', 'entity-type': 'item', 'numeric-id': 20828898 }, 'wikibase-entityid'),
    refValue('P143', { 'entity-type': 'item', 'numeric-id': 20828898 }, 'wikibase-entityid'),
    refValue('P4947', '123'), refValue('P854', 'https://api.themoviedb.org/3/movie/123'),
    refValue('P854', 'https://www.tmdb.org/movie/123'), refValue('P854', 'https%3A%2F%2Fwww.themoviedb.org%2Fmovie%2F123'),
    refValue('P854', 'https://THEMOVIEDB.ORG.:443/movie/123'), refValue('P854', '//tmdb.org/movie/123'),
    refValue('P248', { 'entity-type': 'item', 'numeric-id': '20828898' }, 'wikibase-entityid')]) {
    await t.test(JSON.stringify(marker), () => {
      const s = source([statement('P136', 'Q471839', 4, { references: [reference(marker)] })]);
      const result = extract(s);
      assert.equal(result.reason, 'NO_MAPPED_ASSERTION');
      assert.equal(result.evidence.diagnostics[0].reason, 'TMDB_ORIGIN_REFERENCE');
      assert.deepEqual(result.evidence.claims.P136[0].references, s.entities[entityId].claims.P136[0].references);
    });
  }
  for (const refs of [undefined, [], [reference(refValue('P854', 'https://example.org/film'))]]) {
    const e = extract(source([statement('P136', 'Q471839', 4, refs === undefined ? {} : { references: refs })])).evidence;
    assert.deepEqual(e.values, [0, 0, 0, 0, 1, 0]); assert.equal(e.originAssessment, 'UNRESOLVED_REQUIRES_SOURCE_USE_REVIEW');
  }
});

test('exact entity, both external identities and direct film type fail closed', async t => {
  const cases = [
    ['redirect envelope', s => { s.redirects = []; }, 'ENTITY_OR_REDIRECT_MISMATCH'],
    ['merged id', s => { s.entities[entityId].id = 'Q900000002'; }, 'ENTITY_OR_REDIRECT_MISMATCH'],
    ['missing', s => { s.entities[entityId].missing = ''; }, 'ENTITY_OR_REDIRECT_MISMATCH'],
    ['second entity', s => { s.entities.Q900000002 = {}; }, 'ENTITY_OR_REDIRECT_MISMATCH'],
    ['foreign IMDb', s => { s.entities[entityId].claims.P345[0].mainsnak.datavalue.value = 'tt9000002'; }, 'EXTERNAL_IDENTITY_MISMATCH'],
    ['IMDb absent', s => { delete s.entities[entityId].claims.P345; }, 'EXTERNAL_IDENTITY_MISMATCH'],
    ['foreign TMDB', s => { s.entities[entityId].claims.P4947[0].mainsnak.datavalue.value = '9000002'; }, 'EXTERNAL_IDENTITY_MISMATCH'],
    ['ambiguous IMDb', s => { s.entities[entityId].claims.P345.push(statement('P345', 'tt9000002', 8)); }, 'EXTERNAL_IDENTITY_MISMATCH'],
    ['qualified identity', s => { s.entities[entityId].claims.P345[0].qualifiers = { P580: [refValue('P580', 'unknown')] }; }, 'EXTERNAL_IDENTITY_MISMATCH'],
    ['unsupported film subtype', s => { s.entities[entityId].claims.P31 = [statement('P31', 'Q99999', 1)]; }, 'UNSUPPORTED_FILM_TYPE'],
    ['missing type', s => { s.entities[entityId].claims.P31 = []; }, 'UNSUPPORTED_FILM_TYPE'],
  ];
  for (const [name, change, reason] of cases) await t.test(name, () => {
    const s = source(); change(s); assert.deepEqual(extract(s), { status: 'UNAVAILABLE', reason, evidence: null });
  });
  const feature = source(); feature.entities[entityId].claims.P31 = [statement('P31', 'Q24869', 1)];
  assert.equal(extract(feature).status, 'CANDIDATE');
});

test('malformed or duplicate source JSON, clocks, revisions and budgets never produce a candidate', async t => {
  const cases = [
    ['rank unknown', s => { s.entities[entityId].claims.P136[0].rank = 'best'; }, 'INVALID_RANK'],
    ['duplicate statement', s => { s.entities[entityId].claims.P136.push(s.entities[entityId].claims.P136[0]); }, 'DUPLICATE_STATEMENT'],
    ['invalid date', s => { s.entities[entityId].modified = '2026-02-30T12:00:00Z'; }, 'INVALID_REVISION'],
    ['future source time', s => { s.entities[entityId].modified = '2027-01-01T00:00:00Z'; }, 'INVALID_REVISION'],
    ['revision unsafe', s => { s.entities[entityId].lastrevid = 9007199254740992; }, 'INVALID_REVISION'],
    ['revision string', s => { s.entities[entityId].lastrevid = '100'; }, 'INVALID_REVISION'],
    ['too many statements', s => { s.entities[entityId].claims.P136 = Array(129).fill({}); }, 'CLAIM_BUDGET'],
    ['too many references', s => { s.entities[entityId].claims.P136[0].references = Array(17).fill({}); }, 'REFERENCE_BUDGET'],
    ['unknown statement payload', s => { s.entities[entityId].claims.P136[0].description = 'unexpected'; }, 'INVALID_CLAIMS'],
  ];
  for (const [name, change, reason] of cases) await t.test(name, () => {
    const s = source(); change(s); assert.equal(extract(s).reason, reason);
  });
  assert.equal(extract(source(), { retrievedAtMicros: '1794096000000002' }).reason, 'SOURCE_NOT_AVAILABLE');
  assert.equal(extract(source(), { retrievedAtMicros: '01794096000000000' }).reason, 'INVALID_CONTEXT');
  assert.equal(extract(source(), { identity: { imdbId: 'tt9000001', tmdbMovieId: 9000001 } }).reason, 'INVALID_CONTEXT');
  const text = JSON.stringify(source());
  for (const bad of [text.replace('"rank":"normal"', '"rank":"preferred","rank":"normal"'),
    text.replace('"rank":"normal"', '"rank":"preferred","r\\u0061nk":"normal"'),
    text + '{}', text.replace('100,', '1e999,'), text.replace('"normal"', '"\\ud800"'),
    '{"entities":{},}', '['.repeat(34) + '0' + ']'.repeat(34)]) {
    assert.equal(extract(bad).reason, 'INVALID_SOURCE_JSON');
  }
  assert.equal(extractWikidataFilmEvidence(new Uint8Array([0xff]), context).reason, 'INVALID_SOURCE_JSON');
  assert.equal(extractWikidataFilmEvidence(new Uint8Array(2 * 1024 * 1024 + 1), context).reason, 'SOURCE_SIZE');
  const oversized = source(); oversized.entities[entityId].claims.P136[0].references = [reference(refValue('P854', 'x'.repeat(256 * 1024)))];
  assert.equal(extract(oversized).reason, 'EVIDENCE_BUDGET');
});

test('malformed genre details cannot hide behind a plausible Q identifier', () => {
  for (const change of [s => { s.id = 'wrong-guid'; }, s => { s.mainsnak.property = 'P31'; },
    s => { s.mainsnak.datavalue.value['numeric-id'] = 1; }, s => { s.mainsnak.datavalue.type = 'string'; },
    s => { s.mainsnak.datatype = 'string'; }, s => { s.references = null; },
    s => { s.qualifiers = null; }, s => { s['qualifiers-order'] = ['P580']; },
    s => { s.references = [reference(refValue('P854', 'https://example.org'))]; s.references[0]['snaks-order'] = ['P248']; }]) {
    const s = statement('P136', 'Q471839', 4); change(s);
    const result = extract(source([s]));
    assert.equal(result.status, 'UNAVAILABLE'); assert.equal(result.evidence.diagnostics[0].reason, 'MALFORMED_STATEMENT');
  }
});

test('batch checks full catalogue and request collisions before any candidate is returned', async t => {
  const good = inspectWikidataFilmBatch([request()], catalogue([item()]));
  assert.equal(good[0].status, 'CANDIDATE'); assert.match(good[0].catalogueSha256, /^[a-f0-9]{64}$/);
  const cases = [
    ['foreign alias anywhere', items => { items.push(item(2)); }, 'CATALOGUE_ALIAS_COLLISION'],
    ['two own aliases', items => { items[0].aliases.push({ namespace: 'imdb_title', externalId: 'tt9000002' }); }, 'CATALOGUE_ALIAS_COLLISION'],
    ['missing exact alias', items => { items[0].aliases.pop(); }, 'CATALOGUE_ALIAS_COLLISION'],
    ['Q alias reassigned', items => { items.push({ ...item(2), aliases: [{ namespace: 'wikidata_item', externalId: entityId }] }); }, 'CATALOGUE_ENTITY_COLLISION'],
    ['Q source reassigned', items => { items.push({ ...item(2), aliases: [], sources: [{ providerKey: 'wikidata', providerItemId: entityId }] }); }, 'CATALOGUE_ENTITY_COLLISION'],
    ['old entity replaced', items => { items[0].sources = [{ providerKey: 'wikidata', providerItemId: 'Q900000002' }]; }, 'CATALOGUE_ENTITY_COLLISION'],
    ['book target', items => { items[0].itemType = 'BOOK'; }, 'CATALOGUE_ITEM_UNAVAILABLE'],
  ];
  for (const [name, change, reason] of cases) await t.test(name, () => {
    const items = [item()]; change(items);
    assert.equal(inspectWikidataFilmBatch([request()], catalogue(items))[0].reason, reason);
  });
  const second = { ...item(2), aliases: [{ namespace: 'imdb_title', externalId: 'tt9000002' }, { namespace: 'tmdb_movie', externalId: '9000002' }] };
  const collision = inspectWikidataFilmBatch([request(), request(2)], catalogue([item(), second]));
  assert.deepEqual(collision.map(row => row.reason), ['CATALOGUE_ENTITY_COLLISION', 'CATALOGUE_ENTITY_COLLISION']);
  assert.throws(() => inspectWikidataFilmBatch([request(), request()], catalogue([item()])), /duplicate/);
  assert.throws(() => inspectWikidataFilmBatch([request()], { ...catalogue([item()]), complete: false }), /catalogue review/);
  assert.throws(() => inspectWikidataFilmBatch(Array(129).fill(request()), catalogue([item()])), /catalogue review/);
  assert.throws(() => inspectWikidataFilmBatch([request()], catalogue([item(), item()])), /catalogue Item/);
  assert.throws(() => inspectWikidataFilmBatch([request()], catalogue([{ ...item(), rating: 9 }])), /catalogue Item/);
  assert.throws(() => inspectWikidataFilmBatch([request()], catalogue([{ ...item(), aliases: [{ namespace: 12, externalId: 'x' }] }])), /catalogue alias/);
  const huge = new Uint8Array(2 * 1024 * 1024);
  assert.throws(() => inspectWikidataFilmBatch(Array.from({ length: 9 }, (_, n) => ({ ...request(n + 1), bytes: huge })), catalogue([item()])), /batch source byte budget/);
});
