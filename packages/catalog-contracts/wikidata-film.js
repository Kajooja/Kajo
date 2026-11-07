import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const qid = value => typeof value === 'string' && /^Q[1-9][0-9]{0,15}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const clock = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(value)
  && BigInt(value) <= 253402300799999999n;
const shape = (value, keys) => object(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));
const hash = value => bytesToHex(sha256(value));
const canonical = value => JSON.stringify(value, function (_key, entry) {
  return object(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry;
});
const freeze = value => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// Direct statements only. Changing any selection rule or bound requires a new
// contract/digest; a graph traversal must not silently widen this vocabulary.
export const WIKIDATA_FILM_MAPPING = freeze({
  version: 'wikidata-film-direct-genres-v1',
  concepts: ['fantasy', 'horror', 'mystery', 'romance', 'science-fiction', 'thriller'],
  genreItems: { Q157394: 'fantasy', Q200092: 'horror', Q1200678: 'mystery',
    Q1054574: 'romance', Q471839: 'science-fiction', Q2484376: 'thriller' },
  filmTypes: ['Q11424', 'Q24869'],
  identityNamespaces: { imdb: 'imdb_title', tmdb: 'tmdb_movie', entity: 'wikidata_item' },
  rankPolicy: 'PREFERRED_BEFORE_FILTERS_ELSE_NORMAL',
  qualifiedPolicy: 'UNAVAILABLE',
  unknownPolicy: 'UNAVAILABLE_NOT_ZERO',
  transform: 'ASSERTION_PRESENCE_NOT_FACTUAL_ABSENCE',
  tmdbReferenceItems: ['Q20828898'],
  tmdbReferenceProperties: ['P4947'],
  tmdbReferenceDomains: ['themoviedb.org', 'tmdb.org'],
  properties: ['P31', 'P345', 'P4947', 'P136', 'P577', 'P57', 'P1476'],
  limits: { sourceBytes: 2 * 1024 * 1024, evidenceBytes: 256 * 1024, jsonDepth: 32,
    jsonNodes: 100000, statementsPerProperty: 128, referencesPerStatement: 16,
    snakProperties: 32, snaksPerProperty: 32, requests: 128, batchSourceBytes: 16 * 1024 * 1024,
    catalogueItems: 10000, catalogueBytes: 8 * 1024 * 1024 },
});
export const WIKIDATA_FILM_MAPPING_SHA256 = hash(canonical(WIKIDATA_FILM_MAPPING));
const limits = WIKIDATA_FILM_MAPPING.limits;
const unavailable = reason => ({ status: 'UNAVAILABLE', reason, evidence: null });

// JSON.parse alone silently discards duplicate keys, including escaped spellings
// of rank/id/redirect fields. Reject ambiguous bytes before interpreting them.
function parseSource(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  let offset = 0, nodes = 0;
  const fail = () => { throw new Error('Invalid bounded JSON'); };
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[offset] ?? '\0')) offset++; };
  function string() {
    if (text[offset] !== '"') fail();
    const start = offset++;
    while (offset < text.length) {
      const next = text[offset++];
      if (next === '\\') offset++;
      else if (next === '"') {
        const value = JSON.parse(text.slice(start, offset));
        if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) fail();
        return value;
      }
    }
    fail();
  }
  function read(depth) {
    if (depth > limits.jsonDepth || ++nodes > limits.jsonNodes) fail();
    whitespace();
    const first = text[offset];
    if (first === '"') return string();
    if (first === '{' || first === '[') {
      offset++; whitespace();
      const end = first === '{' ? '}' : ']', entries = [], keys = new Set();
      if (text[offset] !== end) for (;;) {
        whitespace();
        let key;
        if (first === '{') {
          key = string(); whitespace();
          if (keys.has(key) || text[offset++] !== ':') fail();
          keys.add(key);
        }
        const value = read(depth + 1);
        entries.push(first === '{' ? [key, value] : value);
        whitespace();
        if (text[offset] !== ',') break;
        offset++;
      }
      if (text[offset++] !== end) fail();
      return first === '{' ? Object.fromEntries(entries) : entries;
    }
    const pattern = /(?:null|true|false|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/y;
    pattern.lastIndex = offset;
    const token = pattern.exec(text);
    if (!token) fail();
    offset += token[0].length;
    const value = JSON.parse(token[0]);
    if (typeof value === 'number' && !Number.isFinite(value)) fail();
    return value;
  }
  const value = read(0); whitespace();
  if (offset !== text.length) fail();
  return value;
}

function snakMap(value) {
  return object(value) && Object.keys(value).length <= limits.snakProperties
    && Object.entries(value).every(([property, snaks]) => /^P[1-9][0-9]*$/.test(property)
      && Array.isArray(snaks) && snaks.length >= 1 && snaks.length <= limits.snaksPerProperty
      && snaks.every(snak => object(snak) && snak.property === property
        && ['value', 'somevalue', 'novalue'].includes(snak.snaktype)));
}
function orderedKeys(value, keys) {
  return value === undefined || Array.isArray(value) && value.length === keys.length
    && new Set(value).size === value.length && value.every(key => keys.includes(key));
}
function referencesValid(statement) {
  return statement.references === undefined || Array.isArray(statement.references)
    && statement.references.length <= limits.referencesPerStatement
    && statement.references.every(ref => object(ref) && typeof ref.hash === 'string'
      && /^[0-9a-f]{40}$/.test(ref.hash) && snakMap(ref.snaks)
      && orderedKeys(ref['snaks-order'], Object.keys(ref.snaks)));
}
function tmdbReference(value) {
  if (typeof value === 'string') {
    if (WIKIDATA_FILM_MAPPING.tmdbReferenceItems.includes(value.toUpperCase())) return true;
    // Conservative marker check also catches URL-encoded paths/query values.
    let decoded = value;
    try { decoded = decodeURIComponent(value); } catch { /* Keep literal marker inspection. */ }
    try {
      const hostname = new URL(decoded.startsWith('//') ? 'https:' + decoded : decoded).hostname.toLowerCase().replace(/\.$/, '');
      if (WIKIDATA_FILM_MAPPING.tmdbReferenceDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) return true;
    } catch { /* Plain reference strings still receive conservative inspection. */ }
    return /(?:^|[^a-z0-9-])(?:themoviedb|tmdb)\.org(?:$|[^a-z0-9.-])/i.test(decoded);
  }
  if (Array.isArray(value)) return value.some(tmdbReference);
  return object(value) && (WIKIDATA_FILM_MAPPING.tmdbReferenceProperties.some(property => Object.hasOwn(value, property) || value.property === property)
    || WIKIDATA_FILM_MAPPING.tmdbReferenceItems.includes('Q' + value['numeric-id']) || Object.values(value).some(tmdbReference));
}
function statementValue(statement, property, entityId) {
  if (!object(statement) || statement.type !== 'statement' || typeof statement.id !== 'string'
    || !new RegExp(`^${entityId}\\$[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`).test(statement.id)
    || !object(statement.mainsnak) || statement.mainsnak.property !== property || !referencesValid(statement)
    || statement.qualifiers !== undefined && !snakMap(statement.qualifiers)
    || !orderedKeys(statement['qualifiers-order'], Object.keys(statement.qualifiers ?? {}))) return { reason: 'MALFORMED_STATEMENT' };
  if (Object.keys(statement.qualifiers ?? {}).length > 0) return { reason: 'QUALIFIED_STATEMENT' };
  if (statement.mainsnak.snaktype !== 'value') return { reason: 'NON_VALUE_STATEMENT' };
  if (property === 'P136' && tmdbReference(statement.references)) return { reason: 'TMDB_ORIGIN_REFERENCE' };
  const snak = statement.mainsnak, data = snak.datavalue;
  if (!object(data)) return { reason: 'MALFORMED_STATEMENT' };
  if (property === 'P345' || property === 'P4947') {
    if (snak.datatype !== 'external-id' || data.type !== 'string' || typeof data.value !== 'string'
      || !(property === 'P345' ? /^tt[0-9]{7,12}$/ : /^[1-9][0-9]{0,15}$/).test(data.value)) return { reason: 'MALFORMED_STATEMENT' };
    return { value: data.value, reason: null };
  }
  const value = data.value;
  if (snak.datatype !== 'wikibase-item' || data.type !== 'wikibase-entityid' || !object(value)
    || value['entity-type'] !== 'item' || !qid(value.id)
    || value['numeric-id'] !== undefined && (!Number.isSafeInteger(value['numeric-id'])
      || String(value['numeric-id']) !== value.id.slice(1))) return { reason: 'MALFORMED_STATEMENT' };
  return { value: value.id, reason: null };
}
function selectedStatements(statements, property, entityId) {
  const rank = statements.some(s => s?.rank === 'preferred') ? 'preferred' : 'normal';
  return statements.map((statement, index) => ({ index, statementId: typeof statement.id === 'string' ? statement.id : null,
    ...(statement.rank === rank ? statementValue(statement, property, entityId)
      : { reason: statement.rank === 'deprecated' ? 'DEPRECATED_STATEMENT' : 'SUPPRESSED_NORMAL_RANK' }) }));
}

/** Offline extraction only. Context clocks/identities are trusted caller
 * assertions, not a network receipt, rights grant, or transaction certificate.
 * Retain the original bytes privately: sourceSha256 binds them without copying
 * labels, descriptions, links or unrelated claims into the feature envelope. */
export function extractWikidataFilmEvidence(bytes, context) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 1 || bytes.length > limits.sourceBytes) return unavailable('SOURCE_SIZE');
  if (!object(context) || !qid(context.entityId) || !clock(context.retrievedAtMicros)
    || !clock(context.cutoffMicros) || !object(context.identity)
    || typeof context.identity.imdbId !== 'string' || typeof context.identity.tmdbMovieId !== 'string'
    || !/^tt[0-9]{7,12}$/.test(context.identity.imdbId)
    || !/^[1-9][0-9]{0,15}$/.test(context.identity.tmdbMovieId)) return unavailable('INVALID_CONTEXT');
  if (BigInt(context.retrievedAtMicros) > BigInt(context.cutoffMicros)) return unavailable('SOURCE_NOT_AVAILABLE');
  let source;
  try { source = parseSource(bytes); } catch { return unavailable('INVALID_SOURCE_JSON'); }
  if (!object(source) || Object.keys(source).length !== 1 || !object(source.entities)
    || Object.keys(source.entities).length !== 1 || !Object.hasOwn(source.entities, context.entityId)) return unavailable('ENTITY_OR_REDIRECT_MISMATCH');
  const entity = source.entities[context.entityId];
  if (!object(entity) || entity.id !== context.entityId || entity.type !== 'item'
    || ['redirect', 'redirects', 'missing', 'deleted'].some(key => Object.hasOwn(entity, key))) return unavailable('ENTITY_OR_REDIRECT_MISMATCH');
  if (!Number.isSafeInteger(entity.lastrevid) || entity.lastrevid < 1 || typeof entity.modified !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(entity.modified)
    || !Number.isFinite(Date.parse(entity.modified))
    || new Date(entity.modified).toISOString() !== entity.modified.replace('Z', '.000Z')
    || Date.parse(entity.modified) < 0 || BigInt(Date.parse(entity.modified)) * 1000n > BigInt(context.retrievedAtMicros)) return unavailable('INVALID_REVISION');
  if (!object(entity.claims)) return unavailable('INVALID_CLAIMS');
  const claims = Object.fromEntries(WIKIDATA_FILM_MAPPING.properties.map(property => [property, entity.claims[property] ?? []]));
  const ids = new Set();
  for (const statements of Object.values(claims)) {
    if (!Array.isArray(statements) || statements.length > limits.statementsPerProperty) return unavailable('CLAIM_BUDGET');
    for (const statement of statements) {
      if (!object(statement) || !['preferred', 'normal', 'deprecated'].includes(statement.rank)) return unavailable('INVALID_RANK');
      if (Object.keys(statement).some(key => !['id', 'type', 'rank', 'mainsnak', 'qualifiers', 'qualifiers-order', 'references'].includes(key))) return unavailable('INVALID_CLAIMS');
      if (typeof statement.id === 'string') {
        const id = statement.id.toLowerCase();
        if (ids.has(id)) return unavailable('DUPLICATE_STATEMENT');
        ids.add(id);
      }
      if (Array.isArray(statement.references)
        && statement.references.length > limits.referencesPerStatement) return unavailable('REFERENCE_BUDGET');
    }
  }
  const selected = Object.fromEntries(['P31', 'P345', 'P4947', 'P136'].map(property =>
    [property, selectedStatements(claims[property], property, entity.id)]));
  const current = property => selected[property].filter(row => !['DEPRECATED_STATEMENT', 'SUPPRESSED_NORMAL_RANK'].includes(row.reason));
  for (const [property, expected] of [['P345', context.identity.imdbId], ['P4947', context.identity.tmdbMovieId]]) {
    const values = current(property);
    if (!values.length || values.some(row => row.reason !== null || row.value !== expected)) return unavailable('EXTERNAL_IDENTITY_MISMATCH');
  }
  const types = current('P31');
  if (!types.length || types.some(row => row.reason !== null || !WIKIDATA_FILM_MAPPING.filmTypes.includes(row.value))) return unavailable('UNSUPPORTED_FILM_TYPE');
  const diagnostics = selected.P136.map(row => ({ ...row,
    reason: row.reason ?? (Object.hasOwn(WIKIDATA_FILM_MAPPING.genreItems, row.value) ? 'MAPPED' : 'UNMAPPED_GENRE') }));
  const concepts = new Set(diagnostics.filter(row => row.reason === 'MAPPED').map(row => WIKIDATA_FILM_MAPPING.genreItems[row.value]));
  const evidence = {
    version: 'wikidata-film-evidence-v1', providerKey: 'wikidata', evidenceKind: 'wikidata-direct-film-genre',
    entityId: entity.id, revisionId: entity.lastrevid, sourceModifiedAt: entity.modified,
    sourceUrl: `https://www.wikidata.org/wiki/Special:EntityData/${entity.id}.json?revision=${entity.lastrevid}`,
    sourceSha256: hash(bytes), retrievedAtMicros: context.retrievedAtMicros,
    mappingVersion: WIKIDATA_FILM_MAPPING.version, mappingSha256: WIKIDATA_FILM_MAPPING_SHA256,
    identity: { imdbId: context.identity.imdbId, tmdbMovieId: context.identity.tmdbMovieId },
    claims, diagnostics, originAssessment: 'UNRESOLVED_REQUIRES_SOURCE_USE_REVIEW',
    assertions: WIKIDATA_FILM_MAPPING.concepts.map(concept => concepts.has(concept) ? 1 : null),
    values: concepts.size ? WIKIDATA_FILM_MAPPING.concepts.map(concept => concepts.has(concept) ? 1 : 0) : null,
    admission: 'NONE',
  };
  const serialized = canonical(evidence);
  if (new TextEncoder().encode(serialized).length > limits.evidenceBytes) return unavailable('EVIDENCE_BUDGET');
  return { status: concepts.size ? 'CANDIDATE' : 'UNAVAILABLE', reason: concepts.size ? null : 'NO_MAPPED_ASSERTION',
    evidence: freeze({ ...evidence, evidenceSha256: hash(serialized) }) };
}

/** Label-blind binding against a caller-supplied complete catalogue snapshot.
 * Completeness is asserted by the caller; native capture must independently
 * recheck aliases/source identity under its transaction fences. No fuzzy match,
 * automatic merge, catalogue mutation, permission or model admission occurs. */
export function inspectWikidataFilmBatch(requests, catalogue) {
  if (!Array.isArray(requests) || requests.length < 1 || requests.length > limits.requests
    || !shape(catalogue, ['version', 'complete', 'cutoffMicros', 'items']) || catalogue.version !== 'wikidata-film-catalogue-review-v1'
    || catalogue.complete !== true || !clock(catalogue.cutoffMicros) || !Array.isArray(catalogue.items)
    || catalogue.items.length > limits.catalogueItems) throw new Error('Invalid Wikidata catalogue review');
  const items = new Map(), aliases = new Map(), entities = new Map(), requested = new Set();
  let catalogueBytes = 0, sourceBytes = 0;
  const add = (map, key, itemId) => {
    const owners = map.get(key) ?? new Set(); owners.add(itemId); map.set(key, owners);
  };
  for (const item of catalogue.items) {
    if (!shape(item, ['itemId', 'itemType', 'aliases', 'sources']) || !uuid(item.itemId) || items.has(item.itemId) || !['MOVIE', 'BOOK'].includes(item.itemType)
      || !Array.isArray(item.aliases) || item.aliases.length > 32 || !Array.isArray(item.sources)
      || item.sources.length > 32) throw new Error('Invalid Wikidata catalogue Item');
    items.set(item.itemId, item);
    for (const alias of item.aliases) {
      if (!shape(alias, ['namespace', 'externalId']) || typeof alias.namespace !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(alias.namespace)
        || typeof alias.externalId !== 'string' || alias.externalId.length < 1 || alias.externalId.length > 512) throw new Error('Invalid Wikidata catalogue alias');
      add(aliases, `${alias.namespace}:${alias.externalId}`, item.itemId);
      if (alias.namespace === WIKIDATA_FILM_MAPPING.identityNamespaces.entity) add(entities, alias.externalId, item.itemId);
    }
    for (const source of item.sources) {
      if (!shape(source, ['providerKey', 'providerItemId']) || typeof source.providerKey !== 'string' || typeof source.providerItemId !== 'string'
        || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(source.providerKey) || source.providerItemId.length < 1 || source.providerItemId.length > 512) throw new Error('Invalid Wikidata catalogue source');
      if (source.providerKey === 'wikidata') add(entities, source.providerItemId, item.itemId);
    }
    catalogueBytes += new TextEncoder().encode(JSON.stringify(item)).length;
    if (catalogueBytes > limits.catalogueBytes) throw new Error('Wikidata catalogue byte budget exceeded');
  }
  for (const request of requests) {
    if (!object(request) || !uuid(request.itemId) || !qid(request.entityId) || requested.has(request.itemId)) throw new Error('Invalid or duplicate Wikidata request');
    requested.add(request.itemId); add(entities, request.entityId, request.itemId);
    if (request.bytes instanceof Uint8Array) sourceBytes += request.bytes.length;
    if (sourceBytes > limits.batchSourceBytes) throw new Error('Wikidata batch source byte budget exceeded');
  }
  const catalogueSha256 = hash(canonical(catalogue));
  return requests.map(request => {
    const result = (() => {
      const item = items.get(request.itemId);
      if (!item || item.itemType !== 'MOVIE') return unavailable('CATALOGUE_ITEM_UNAVAILABLE');
      const identity = {};
      for (const [namespace, field] of [[WIKIDATA_FILM_MAPPING.identityNamespaces.imdb, 'imdbId'],
        [WIKIDATA_FILM_MAPPING.identityNamespaces.tmdb, 'tmdbMovieId']]) {
        const matching = item.aliases.filter(alias => alias.namespace === namespace);
        if (matching.length !== 1 || aliases.get(`${namespace}:${matching[0].externalId}`).size !== 1) return unavailable('CATALOGUE_ALIAS_COLLISION');
        identity[field] = matching[0].externalId;
      }
      const priorIds = [...item.aliases.filter(alias => alias.namespace === WIKIDATA_FILM_MAPPING.identityNamespaces.entity).map(alias => alias.externalId),
        ...item.sources.filter(source => source.providerKey === 'wikidata').map(source => source.providerItemId)];
      if (entities.get(request.entityId).size !== 1 || priorIds.some(id => id !== request.entityId)
        || item.aliases.filter(alias => alias.namespace === WIKIDATA_FILM_MAPPING.identityNamespaces.entity).length > 1
        || item.sources.filter(source => source.providerKey === 'wikidata').length > 1) return unavailable('CATALOGUE_ENTITY_COLLISION');
      return extractWikidataFilmEvidence(request.bytes, { entityId: request.entityId, identity,
        retrievedAtMicros: request.retrievedAtMicros, cutoffMicros: catalogue.cutoffMicros });
    })();
    return { itemId: request.itemId, entityId: request.entityId, catalogueSha256, cutoffMicros: catalogue.cutoffMicros, ...result };
  });
}
