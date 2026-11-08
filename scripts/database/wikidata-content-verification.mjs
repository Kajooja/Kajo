import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractWikidataFilmEvidence, WIKIDATA_FILM_MAPPING } from '@kajo/catalog-contracts/wikidata-film';
import { withOwnedTasteNumericFixture } from './owned-taste-numeric-verification.mjs';
import { captureWikidataContentNumericForecast, finalizeWikidataContent } from './wikidata-content-capture.mjs';
import { json, literal, inspect, answer } from './personal-rating-prospective.mjs';
import { inspectPersonalRatingOwnerCensus } from './personal-rating-evaluation.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
// Native psql intentionally withholds server exception text. Require the same
// SQLSTATE from the local driver or the isolated transport's bounded diagnostic.
const sqlstate = expected => error => error.code === expected
  || new RegExp(`\\(SQLSTATE ${expected}\\)`).test(error.message);
const context = { entityId: 'Q900000001', retrievedAtMicros: '1794096000000000', cutoffMicros: '1794096000000001',
  identity: { imdbId: 'tt9000001', tmdbMovieId: '9000001' } };
export function wikidataFixture(context, genres = ['Q471839']) {
  let counter = 0;
  const statement = (property, value) => {
    const external = ['P345', 'P4947'].includes(property);
    return { id: `${context.entityId}$00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
      type: 'statement', rank: 'normal', mainsnak: { property, snaktype: 'value', datatype: external ? 'external-id' : 'wikibase-item',
        datavalue: { type: external ? 'string' : 'wikibase-entityid', value: external ? value
          : { 'entity-type': 'item', id: value, 'numeric-id': Number(value.slice(1)) } } } };
  };
  return { entities: { [context.entityId]: { id: context.entityId, type: 'item', lastrevid: 100, modified: '2026-11-01T12:00:00Z',
    labels: { en: { value: 'SYNTHETIC: do not retain this prose' } }, claims: { P31: [statement('P31', 'Q11424')],
      P345: [statement('P345', context.identity.imdbId)], P4947: [statement('P4947', context.identity.tmdbMovieId)],
      P136: genres.map(genre => statement('P136', genre)) } } } };
}

/** Independent SQL/JS extraction from identical bytes, reusable on native PG. */
export async function verifyWikidataProjection(exec) {
  const cases = [];
  const check = async (name, mutate = () => {}, changes = {}, raw) => {
    const c = { ...context, ...changes }, source = wikidataFixture(c);mutate(source.entities[c.entityId], source);
    const text = raw ?? JSON.stringify(source);
    const js = extractWikidataFilmEvidence(new TextEncoder().encode(text), c);
    const [sql] = await exec(`select coalesce(private.project_wikidata_film_v1(${literal(text)},${literal(c.entityId)},
      ${literal(c.identity.imdbId)},${literal(c.identity.tmdbMovieId)},${literal(c.retrievedAtMicros)},${literal(c.cutoffMicros)}),'null'::jsonb);`);
    if (js.evidence === null) assert.equal(sql, null, name);
    else {
      assert.ok(sql, name);assert.deepEqual(sql.assertions, js.evidence.assertions, name);assert.deepEqual(sql.values, js.evidence.values, name);
      assert.equal(sql.sourceHash, sha(text), name);assert.equal(sql.projectionHash, sha(sql.projectionText));
      const projected = extractWikidataFilmEvidence(new TextEncoder().encode(sql.projectionText), c);
      assert.deepEqual(projected.evidence?.claims, js.evidence.claims, name);
      assert.deepEqual(projected.evidence?.values, js.evidence.values, name);
      assert.equal(sql.projectionText.includes('do not retain'), false);
    }
    cases.push(name);
  };
  await check('direct mapping');
  for (const qid of Object.keys(WIKIDATA_FILM_MAPPING.genreItems)) await check(qid, e => {
    e.claims.P136[0].mainsnak.datavalue.value = { 'entity-type': 'item', id: qid, 'numeric-id': Number(qid.slice(1)) };
  });
  await check('unmapped not six zeroes', e => { e.claims.P136[0].mainsnak.datavalue.value = { 'entity-type': 'item', id: 'Q999999' }; });
  await check('no genres', e => { e.claims.P136 = []; });
  for (const rank of ['preferred', 'deprecated', 'unknown', null]) await check('rank ' + rank, e => { e.claims.P136[0].rank = rank; });
  await check('unsupported preferred suppresses normal', e => { const s = structuredClone(e.claims.P136[0]);s.id = s.id.replace('000004', '000005');
    s.rank = 'preferred';s.mainsnak.snaktype = 'novalue';e.claims.P136.push(s); });
  for (const mutate of [s => { s.mainsnak.snaktype = 'somevalue'; }, s => { s.qualifiers = null; },
    s => { s.qualifiers = { P580: [{ property: 'P580', snaktype: 'somevalue' }] }; },
    s => { s.references = [{}]; }, s => { s.references = null; }, s => { s.mainsnak.datavalue.value['numeric-id'] = '471839'; },
    s => { s.mainsnak.datavalue.value['numeric-id'] = 1; }, s => { s['qualifiers-order'] = ['P580']; },
    s => { s.id = 'wrong'; }, s => { s.type = 'claim'; }]) await check('ineligible statement ' + cases.length, e => mutate(e.claims.P136[0]));
  for (const marker of ['Q20828898', 'q20828898', '//api.themoviedb.org./film', 'https://TMDB.ORG/a',
    'https%3A%2F%2Fapi.themoviedb.org%2Ffilm', 'https://tmdb.org../film',
    { 'numeric-id': '20828898' }, { 'numeric-id': [['20828898']] }, { P4947: [] }]) await check('TMDB marker ' + cases.length, e => {
    e.claims.P136[0].references = [{ hash: 'a'.repeat(40), snaks: { P854: [{ property: 'P854', snaktype: 'value', datavalue: { type: 'string', value: marker } }] } }];
  });
  // Native SQL deliberately has a narrower URL envelope than the standalone
  // WHATWG extractor. Unsupported authority/repair encodings make the whole
  // native source unavailable, never a mismatched vector or a worker exception.
  for (const marker of ['https://ｔｍｄｂ.org/film', 'https://tmdb。org/film', 'https://tm\tdb.org/film',
    'https://t\u00admdb.org/film', 'https://xn--tmdb-.org/film', 'https://%2574mdb.org/film',
    'https:\\\\tmdb.org/film', 'https:tmdb.org./film', ' https://example.org/film', '\u0001https://ｔｍｄｂ.org/film']) {
    const source = wikidataFixture(context);
    source.entities[context.entityId].claims.P136[0].references = [{ hash: 'a'.repeat(40), snaks: {
      P854: [{ property: 'P854', snaktype: 'value', datavalue: { type: 'string', value: marker } }],
    } }];
    const raw = JSON.stringify(source);
    assert.ok(extractWikidataFilmEvidence(new TextEncoder().encode(raw), context).evidence,
      'Standalone extraction retains its accepted URL contract');
    const [native] = await exec(`select coalesce(private.project_wikidata_film_v1(${literal(raw)},${literal(context.entityId)},
      ${literal(context.identity.imdbId)},${literal(context.identity.tmdbMovieId)},${literal(context.retrievedAtMicros)},${literal(context.cutoffMicros)}),'null'::jsonb);`);
    assert.equal(native, null, marker);cases.push('native unsupported reference URL ' + cases.length);
  }
  await check('Unicode reference prose remains eligible', e => {
    e.claims.P136[0].references = [{ hash: 'a'.repeat(40), snaks: {
      P1476: [{ property: 'P1476', snaktype: 'value', datavalue: { type: 'string', value: 'Elokuvan lähde — cinéma' } }],
    } }];
  });
  for (const kind of ['genre', 'reference']) {
    const source = wikidataFixture(context);
    if (kind === 'reference') source.entities[context.entityId].claims.P136[0].references = [{ hash: 'a'.repeat(40), snaks: {
      P248: [{ property: 'P248', snaktype: 'value', datavalue: { type: 'wikibase-entityid', value: { 'numeric-id': 20828898 } } }],
    } }];
    const number = kind === 'genre' ? '471839' : '20828898';
    const raw = JSON.stringify(source).replace('"numeric-id":' + number, '"numeric-id":' + number + '.00000000000001');
    assert.ok(extractWikidataFilmEvidence(new TextEncoder().encode(raw), context).evidence);
    const [native] = await exec(`select coalesce(private.project_wikidata_film_v1(${literal(raw)},${literal(context.entityId)},
      ${literal(context.identity.imdbId)},${literal(context.identity.tmdbMovieId)},${literal(context.retrievedAtMicros)},${literal(context.cutoffMicros)}),'null'::jsonb);`);
    assert.equal(native, null, 'Rounded ' + kind + ' identifier must not freeze a conflicting vector');
    cases.push('native rounded ' + kind + ' identifier');
  }
  await check('ordinary finite fraction remains eligible', e => { e.extra = { number: 1.5 }; });
  for (const property of ['P31', 'P345', 'P4947']) await check('identity ' + property, e => { e.claims[property][0].mainsnak.snaktype = 'novalue'; });
  for (const mutate of [e => { e.redirect = null; }, e => { e.lastrevid = 1.5; }, e => { e.modified = '2026-02-30T12:00:00Z'; },
    e => { e.modified = '2026-11-09T12:00:00Z'; }, e => { e.claims.P136 = null; }, e => { e.claims.P31 = []; },
    e => { e.claims.P136.push(e.claims.P136[0]); }, e => { e.claims.P136[0].unknown = true; },
    e => { e.claims.P136 = Array(129).fill(e.claims.P136[0]); }]) await check('closed source ' + cases.length, mutate);
  await check('future receipt', () => {}, { retrievedAtMicros: '1794096000000002' });
  const text = JSON.stringify(wikidataFixture(context));
  for (const [name, raw] of [['duplicate key', text.replace('"rank":"normal"', '"rank":"normal","rank":"preferred"')],
    ['escaped duplicate', text.replace('"rank":"normal"', '"rank":"normal","r\\u0061nk":"preferred"')],
    ['nonfinite JSON number', text.replace('"lastrevid":100', '"lastrevid":1e999')],
    ['integral revision decimal', text.replace('"lastrevid":100', '"lastrevid":100.0')], ['oversize', ' '.repeat(2097152) + text]]) await check(name, () => {}, {}, raw);
  await check('depth limit', e => { let v = {};for (let n = 0; n < 34; n++) v = { v };e.extra = v; });
  await check('node limit', e => { e.extra = Array(100001).fill(null); });
  await check('reference limit', e => { e.claims.P136[0].references = Array(17).fill({}); });
  // Native projection has a stricter 64 KiB limit, leaving room for the reused
  // extractor's diagnostics inside its immutable 256 KiB evidence contract.
  const large = wikidataFixture(context);large.entities[context.entityId].claims.P1476 = [{ type: 'statement', rank: 'normal', mainsnak: { text: 'x'.repeat(65536) } }];
  const [bounded] = await exec(`select coalesce(private.project_wikidata_film_v1(${literal(JSON.stringify(large))},${literal(context.entityId)},
    ${literal(context.identity.imdbId)},${literal(context.identity.tmdbMovieId)},${literal(context.retrievedAtMicros)},${literal(context.cutoffMicros)}),'null'::jsonb);`);
  assert.equal(bounded, null);cases.push('native projection budget');
  return { status: 'PASS', cases, count: cases.length, qualityAdmission: 'NONE' };
}

export async function withWikidataContentFixture(exec, withSession, run) {
  return withOwnedTasteNumericFixture(exec, withSession, async ctx => {
    const { f, one, contentSources, questions } = ctx;
    const retrievedAtMicros = String(BigInt(await one('select to_jsonb((extract(epoch from clock_timestamp())*1000000)::bigint::text);')) - 2_000_000n);
    const movieSources = contentSources.filter(s => s.providerKey === 'tmdb').map((s, n) => {
      const context = { entityId: 'Q' + (900000001 + n), identity: { imdbId: 'tt' + (9000001 + n), tmdbMovieId: s.providerItemId } };
      const index = questions.findIndex(q => q.itemId === s.itemId);
      const sourceText = JSON.stringify(wikidataFixture(context, [Object.keys(WIKIDATA_FILM_MAPPING.genreItems)[(index < 0 ? n : index) % 6]]));
      return { ...s, context, sourceText };
    });
    await exec(`begin;${movieSources.map(s => `insert into private.item_sources(item_id,provider_key,provider_item_id,source_payload,source_hash,
      source_url,source_updated_at,synced_at) values(${literal(s.itemId)},'wikidata',${literal(s.context.entityId)},
      ${json({ version: 'wikidata-entitydata-source-v1', sourceText: s.sourceText, retrievedAtMicros })},${literal(sha(s.sourceText))},
      ${literal('https://www.wikidata.org/wiki/Special:EntityData/' + s.context.entityId + '.json?revision=100')},'2026-11-01T12:00:00Z',clock_timestamp());
      insert into private.item_external_ids(namespace,external_id,item_id) values
      ('imdb_title',${literal(s.context.identity.imdbId)},${literal(s.itemId)}),('wikidata_item',${literal(s.context.entityId)},${literal(s.itemId)});`).join('\n')}commit;`);
    const featureUse = { ...ctx.contentFeatureUse, version: 'personal-content-feature-use-v2', reviewRef: 'synthetic-wikidata-438', sources: [
      { providerKey: 'wikidata', evidenceKind: 'wikidata-direct-film-genre', disposition: 'PERMITTED' },
      { providerKey: 'open_library', evidenceKind: 'provider-subject', disposition: 'PERMITTED' },
    ] };
    const request = async (...args) => ({ ...await ctx.request(...args), featureUse });
    return run({ ...ctx, request, featureUse, movieSources });
  });
}

export async function verifyWikidataContentCapture(exec, withSession) {
  return withWikidataContentFixture(exec, withSession, async ({ f, call, one, request, movieSources, featureUse, command }) => {
    const subtransaction = async captured => {
      const input = captured.preparation.input, object = input.contentFeatures.objects.find(o => o.status === 'AVAILABLE');
      assert.ok(object);
      for (const kind of ['source', 'alias']) {
        const table = kind === 'source' ? 'private.item_sources' : 'private.item_external_ids';
        const predicate = kind === 'source' ? `id=${literal(object.sourceId)}`
          : `namespace=${literal(object.provenance.alias.namespace)} and external_id=${literal(object.provenance.alias.externalId)}`;
        const column = kind === 'source' ? 'synced_at' : 'last_seen_at';
        const result = await one(`begin;savepoint source_write;update ${table} set ${column}=clock_timestamp() where ${predicate};
          release savepoint source_write;lock table public.items,private.item_sources,private.item_external_ids in share mode nowait;
          select jsonb_build_object('child',(select xmin::text from ${table} where ${predicate}),'parent',pg_current_xact_id()::text,
            'features',private.capture_personal_rating_content_v2(${json(input)}||jsonb_build_object('cutoffMicros',
              (extract(epoch from clock_timestamp())*1000000)::bigint::text),${json(featureUse)}));rollback;`);
        assert.notEqual(result.child, result.parent, 'Exercise actual released subtransaction xmin');
        assert.equal(result.features.objects.find(o => o.objectId === object.objectId).provenance, null, input.itemType + '/' + kind);
        assert.equal((await call(inspect(captured.preparation.forecastId))).status, 'AVAILABLE', 'Rollback restores retained capture');
      }
    };
    const selected = await request();
    await assert.rejects(captureWikidataContentNumericForecast(withSession, { ...selected, featureUse: {
      ...featureUse, validUntilMicros: String(BigInt(featureUse.validFromMicros) + 1n) } }), sqlstate('22023'));
    const captured = await captureWikidataContentNumericForecast(withSession, selected);
    assert.equal(captured.preparation.version, 'kajo-personal-content-rating-preparation-v3');
    assert.equal(captured.forecast.contentFit.status, 'FITTED');assert.equal(captured.forecast.prefix.support, 2);
    assert.equal(captured.forecast.location.personalMean, 5);assert.equal(captured.forecast.servingActivation, 'NONE');
    assert.equal(captured.preparation.input.contentFeatures.objects.some(o => o.provenance?.providerKey === 'tmdb'), false);
    assert.deepEqual((await captureWikidataContentNumericForecast(withSession, selected)).stored, captured.stored);
    await subtransaction(captured);
    const { normalizeKajoPersonalRatingEvaluationInventory } = await import('../../packages/prediction-engine/dist/adapters/kajo-personal-rating-evaluation.js');
    const member = { actorUserId: f.actor, profileId: f.profile, subjectId: 'native:wikidata-subject' };
    const owner = await inspectPersonalRatingOwnerCensus(withSession, member);
    const binding = { origin: 'synthetic', horizonSeconds: 3600, roster: [member],
      sourceVersions: { source: captured.forecast.prefix.sourceVersion, model: captured.forecast.version, control: 'personal-domain-mean-v1:PERSONAL_MEAN' },
      opportunities: [{ opportunityId: 'native:wikidata-opportunity', actorUserId: f.actor, profileId: f.profile,
        sourcePredictionId: selected.source, forecastId: selected.id, targetItemId: selected.target, objectId: 'native:wikidata-target',
        domainId: 'MOVIE', attemptedAtMicros: captured.preparation.cutoffMicros, captureStatus: 'CAPTURED' }] };
    const census = { version: 'kajo-personal-rating-census-v1', observedAtMicros: owner.observedAtMicros, owners: [owner] };
    normalizeKajoPersonalRatingEvaluationInventory(binding, census);
    assert.throws(() => normalizeKajoPersonalRatingEvaluationInventory({ ...binding,
      sourceVersions: { ...binding.sourceVersions, source: binding.sourceVersions.source.replace('owned-rating-source-v3:', 'owned-rating-source-v2:') } }, census));
    const { normalizeKajoWikidataContentRatingPrefix } = await import('../../packages/prediction-engine/dist/adapters/kajo-wikidata-content-rating.js');
    for (const mutate of [p => { p.contentFeatures.objects[0].values[0] = 9; },
      p => { p.contentFeatures.objects[0].provenance.projectionHash = 'a'.repeat(64); },
      p => { p.contentFeatures.objects[0].provenance.aliases[0].externalId = 'tt9999999'; },
      p => { p.contentFeatures.featureUse.sources[0].providerKey = 'tmdb'; }, p => { p.version = 'kajo-personal-content-rating-prefix-v2'; }]) {
      const changed = structuredClone(captured.preparation.input);mutate(changed);assert.throws(() => normalizeKajoWikidataContentRatingPrefix(changed));
    }
    const source = movieSources.find(s => s.itemId === captured.preparation.input.labels[0].itemId);
    assert.ok(source);
    // Payload-only correction leaves old identity keys unchanged, but must retire v4.
    await exec(`update private.item_sources set source_payload=source_payload||'{"correction":true}' where provider_key='wikidata' and item_id=${literal(source.itemId)};`);
    assert.equal((await call(inspect(selected.id))).status, 'WITHDRAWN');
    await assert.rejects(captureWikidataContentNumericForecast(withSession, selected), sqlstate('55000'));
    await exec(`update private.item_sources set source_payload=source_payload-'correction' where provider_key='wikidata' and item_id=${literal(source.itemId)};`);
    const readFeatures = () => one(`begin;lock table public.items,private.item_sources,private.item_external_ids in share mode nowait;
      select private.capture_personal_rating_content_v2(${json(captured.preparation.input)}||jsonb_build_object('cutoffMicros',
        (extract(epoch from clock_timestamp())*1000000)::bigint::text),${json(featureUse)});rollback;`);
    const original = await one(`select to_jsonb(s) from private.item_sources s where provider_key='wikidata' and item_id=${literal(source.itemId)};`);
    const unsupported = JSON.parse(source.sourceText);
    unsupported.entities[source.context.entityId].claims.P136[0].references = [{ hash: 'a'.repeat(40), snaks: {
      P854: [{ property: 'P854', snaktype: 'value', datavalue: { type: 'string', value: 'https://ｔｍｄｂ.org/film' } }],
    } }];
    const genreId = unsupported.entities[source.context.entityId].claims.P136[0].mainsnak.datavalue.value['numeric-id'];
    const unsupportedSources = [JSON.stringify(unsupported), source.sourceText.replace('"numeric-id":' + genreId,
      '"numeric-id":' + genreId + '.00000000000001')];
    for (const unsupportedText of unsupportedSources) {
      await exec(`update private.item_sources set source_hash=${literal(sha(unsupportedText))},
        source_payload=jsonb_set(source_payload,'{sourceText}',${json(unsupportedText)}) where id=${literal(original.id)};`);
      const unavailableCapture = await captureWikidataContentNumericForecast(withSession, await request());
      assert.equal(unavailableCapture.preparation.input.contentFeatures.objects.find(o => o.objectId === source.itemId).provenance, null);
      assert.equal(unavailableCapture.forecast.prefix.support, 2, 'Unsupported source keeps committed numeric labels');
    }
    await exec(`update private.item_sources set source_hash=${literal(original.source_hash)},source_payload=${json(original.source_payload)}
      where id=${literal(original.id)};`);
    for (const mutation of ["source_hash='mismatch'", "source_url='https://fixture.invalid/wrong-revision'",
      "source_updated_at='2026-11-02T12:00:00Z'", "provider_item_id='Q999999999999'",
      "source_payload=jsonb_set(source_payload,'{retrievedAtMicros}','\"253402300799999999\"')",
      `source_payload=jsonb_set(source_payload,'{sourceText}',${json(source.sourceText.replace('"rank":"normal"', '"rank":"normal","rank":"preferred"'))})`]) {
      await exec(`update private.item_sources set ${mutation} where id=${literal(original.id)};`);
      assert.equal((await readFeatures()).objects.find(o => o.objectId === source.itemId).provenance, null, mutation);
      await exec(`update private.item_sources set source_hash=${literal(original.source_hash)},source_url=${literal(original.source_url)},
        source_updated_at=${literal(original.source_updated_at)},provider_item_id=${literal(original.provider_item_id)},
        source_payload=${json(original.source_payload)} where id=${literal(original.id)};`);
    }
    assert.equal((await readFeatures()).objects.find(o => o.objectId === source.itemId).status, 'AVAILABLE');
    for (const [name, mutation, cleanup] of [
      ['alias insertion', `insert into private.item_external_ids(namespace,external_id,item_id) values('imdb_title','tt9999999999',${literal(source.itemId)})`, "delete from private.item_external_ids where namespace='imdb_title' and external_id='tt9999999999'"],
      ['alias removal', `delete from private.item_external_ids where namespace='imdb_title' and item_id=${literal(source.itemId)}`, `insert into private.item_external_ids(namespace,external_id,item_id) values('imdb_title',${literal(source.context.identity.imdbId)},${literal(source.itemId)})`],
    ]) {
      const r = await request();await captureWikidataContentNumericForecast(withSession, r);await exec(mutation + ';');
      assert.equal((await call(inspect(r.id))).status, 'WITHDRAWN', name);await exec(cleanup + ';');
    }
    const fallbackRequest = { ...await request(), featureUse: null };
    const fallback = await captureWikidataContentNumericForecast(withSession, fallbackRequest);
    assert.equal(fallback.forecast.contentFit.status, 'INSUFFICIENT_FEATURE_SUPPORT');
    assert.ok(fallback.preparation.input.contentFeatures.objects.every(o => o.values === null));
    await exec(`update private.item_sources set synced_at=clock_timestamp() where provider_key='wikidata' and item_id=${literal(source.itemId)};`);
    assert.equal((await call(inspect(fallbackRequest.id))).status, 'WITHDRAWN', 'unavailable source union is still frozen');
    const bookRequest = await request('BOOK', f.targets[1]);
    const book = await captureWikidataContentNumericForecast(withSession, bookRequest);
    assert.equal(book.forecast.contentFit.status, 'FITTED');
    await subtransaction(book);
    const tamper = await request();
    await assert.rejects(captureWikidataContentNumericForecast(withSession, tamper, { beforeFinalize: async ({ exec: connection, forecast }) => {
      const changed = structuredClone(forecast);changed.content.objects[0].values[0] = 9;
      await connection(`select ${finalizeWikidataContent(tamper.id, changed)};`);
    } }), sqlstate('22023'));
    assert.equal(await one(`select count(*)::integer from private.personal_rating_allocations where id=${literal(tamper.id)};`), 0);
    const final = await captureWikidataContentNumericForecast(withSession, tamper);
    const first = await command(tamper.target, 6, { source: tamper.source });
    assert.equal((await call(answer(tamper.id, first))).coverage, 'MEASURED_FIRST_RATING');
    await call(`private.withdraw_personal_rating_content_review_v1(${literal(featureUse.reviewRef)})`);
    assert.equal((await call(inspect(tamper.id))).firstAnswer, null);
    assert.equal((await call(inspect(bookRequest.id))).status, 'WITHDRAWN');
    assert.equal(final.forecast.qualityAdmission, 'NONE');
    return { status: 'PASS', ownedTasteLabels: 2, domains: ['MOVIE', 'BOOK'], exactRetry: 'PASS', subtransactionWrites: 'INELIGIBLE_4_CASES',
      unsupportedReferenceUrl: 'UNAVAILABLE_WITH_NUMERIC_LABELS_RETAINED',
      roundedNumbers: 'UNAVAILABLE_WITH_NUMERIC_LABELS_RETAINED',
      sourceCorrection: 'RETIRED', aliasChanges: 'RETIRED', permissionWithdrawal: 'RETIRED', qualityAdmission: 'NONE', servingActivation: 'NONE' };
  });
}
