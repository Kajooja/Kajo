import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { CONTRACT, PILOT, PILOT_ITEMS, buildDescriptionPacket, digest, inspectRecord,
  normalizeDescription, readBoundedResponse, sha256, validateAcknowledgement, verifyDescriptionReadback } from './open-library-descriptions.mjs';
import { applyDescriptionBatch, collectDescriptions } from './import-open-library-descriptions.mjs';

const text = 'A fictional traveller follows a quiet river and discovers how the choices of an earlier generation still shape the town.';
const fetchedAt = '2026-09-14T01:00:00.000Z';
const basis = 'Artificial fixture: permission reviewed only for this deterministic test, never a real provider contribution.';
function rawRecord(candidate, kind = 'edition', description = text) {
  return JSON.stringify({ key: kind === 'edition' ? `/books/${candidate.editionId}` : `/works/${candidate.workId}`,
    type: { key: `/type/${kind}` }, works: [{ key: `/works/${candidate.workId}` }], description, revision: 2 });
}
function fixture() {
  const records = {}, decisions = [], pilot = [];
  for (const candidate of PILOT_ITEMS) {
    const raw = rawRecord(candidate);
    const inspected = inspectRecord(raw, candidate, 'edition', fetchedAt);
    records[candidate.position] = { edition: { raw, fetchedAt, inspectionSha256: digest(inspected) } };
    decisions.push({ position: candidate.position, choice: 'edition', recordSha256: inspected.recordSha256,
      textSha256: inspected.description.textSha256, textLanguage: 'en', rights: 'approved-for-pilot', basis });
    pilot.push({ position: candidate.position, identity_matches: true, item_id: candidate.itemId,
      work_id: candidate.workId, edition_id: candidate.editionId, display_language: candidate.displayLanguage,
      source_id: `00000000-0000-0000-0000-${String(candidate.position).padStart(12, '0')}`,
      updated_at: fetchedAt, source_updated_at: fetchedAt, core_md5: 'a'.repeat(32), source_base_md5: 'b'.repeat(32),
      description_sha256: null, description_provenance: null, previous_enrichment: null });
  }
  return { records, decisions, baseline: { version: PILOT, checked_at: fetchedAt, pilot,
    preservation: { book_core_md5: 'a'.repeat(32), nonpilot_book_full_md5: 'a'.repeat(32), movie_full_md5: 'a'.repeat(32),
      alias_identity_md5: 'a'.repeat(32), source_identity_md5: 'a'.repeat(32), nonpilot_source_full_md5: 'a'.repeat(32), discoverable_mocks: 0 } } };
}
function reviewedState() {
  const data = fixture();
  const packet = buildDescriptionPacket(data.records, data.decisions, data.baseline);
  return { status: 'reviewed', records: data.records, attempts: [], batches: [],
    review: { decisions: data.decisions, baseline: data.baseline, packet, packetSha256: digest(packet) } };
}
function readbackFixture(state) {
  const readback = structuredClone(state.review.baseline);
  readback.checked_at = new Date().toISOString();
  const applied = state.batches.filter(batch => batch.status === 'completed').flatMap(batch => batch.itemIds);
  for (const row of readback.pilot) if (applied.includes(row.item_id)) {
    const entry = state.review.packet.entries.find(entry => entry.expectedItemId === row.item_id);
    Object.assign(row, { description_sha256: entry.provenance.textSha256,
      description_provenance: entry.provenance, previous_enrichment: entry.enrichment,
      updated_at: readback.checked_at, source_updated_at: readback.checked_at });
  }
  return readback;
}

test('strict descriptions retain paragraphs/NFC and count Unicode code points', () => {
  const normalized = normalizeDescription({ type: '/type/text', value: '  ' + text + '\r\n\r\n  cafe\u0301\t ja\u0000 tea.  ' });
  assert.equal(normalized.status, 'eligible');
  assert.equal(normalized.text, text + '\n\ncafé ja tea.');
  assert.equal(normalizeDescription('🙂'.repeat(80)).length, 80);
  assert.equal(normalizeDescription('🙂'.repeat(2000)).status, 'eligible');
  assert.equal(normalizeDescription('🙂'.repeat(2001)).status, 'too-long');
  assert.equal(normalized.textSha256, sha256(normalized.text));
});

test('missing, markup, excessive, malformed and non-description fields never become display copy', () => {
  for (const field of [null, undefined, '', ' \r\n\t ']) assert.equal(normalizeDescription(field).status, 'missing');
  for (const field of [42, [], {}, { value: text }, { type: '/type/text', value: text, extra: true }])
    assert.equal(normalizeDescription(field).status, 'invalid-type');
  for (const field of ['<p>' + text + '</p>', text + ' [link](https://example.com)', '# ' + text, text + ' &amp;', text + ' **bold**'])
    assert.equal(normalizeDescription(field).status, 'markup-or-url');
  assert.equal(normalizeDescription('x'.repeat(32769)).status, 'raw-too-large');
  assert.equal(normalizeDescription('short').status, 'too-short');
  assert.equal(normalizeDescription(text + '\ud800').status, 'invalid-unicode');
  const record = JSON.parse(rawRecord(PILOT_ITEMS[0]));
  delete record.description;
  Object.assign(record, { notes: text, first_sentence: text, excerpts: [{ text }] });
  assert.equal(inspectRecord(JSON.stringify(record), PILOT_ITEMS[0], 'edition', fetchedAt).description.status, 'missing');
});

test('provider identity is exact; redirects, wrong/multiple Work links and malformed JSON stop', () => {
  for (const patch of [{ key: '/books/OL1M' }, { type: { key: '/type/redirect' } }, { location: '/books/OL1M' },
    { works: [] }, { works: [{ key: '/works/OL1W' }] }, { works: [{ key: '/works/OL17370186W' }, { key: '/works/OL1W' }] }]) {
    assert.throws(() => inspectRecord(JSON.stringify({ ...JSON.parse(rawRecord(PILOT_ITEMS[0])), ...patch }),
      PILOT_ITEMS[0], 'edition', fetchedAt), /mismatch/);
  }
  assert.throws(() => inspectRecord('{bad', PILOT_ITEMS[0], 'edition', fetchedAt), /malformed-provider-json/);
  assert.equal(inspectRecord(null, PILOT_ITEMS[0], 'edition', fetchedAt).status, 'missing');
});

test('review binds exact source/text hashes, current identities, permission and actual text language', () => {
  const data = fixture();
  const packet = buildDescriptionPacket(data.records, data.decisions, data.baseline);
  assert.equal(packet.entries.length, 10);
  assert.equal(packet.entries[0].provenance.textLanguage, 'en', 'Finnish display Edition does not imply Finnish description');
  assert.equal(packet.entries[0].provenance.sourceModifiedAt, null);
  for (const [key, value] of [['recordSha256', '0'.repeat(64)], ['textSha256', '0'.repeat(64)],
    ['textLanguage', 'unknown'], ['rights', 'unknown'], ['basis', '']]) {
    const decisions = structuredClone(data.decisions); decisions[0][key] = value;
    assert.throws(() => buildDescriptionPacket(data.records, decisions, data.baseline));
  }
  const baseline = structuredClone(data.baseline); baseline.pilot[0].source_id = null;
  assert.throws(() => buildDescriptionPacket(data.records, data.decisions, baseline), /baseline-identity/);
  const records = structuredClone(data.records); records[1].edition.raw = rawRecord(PILOT_ITEMS[0], 'edition', text + ' Changed.');
  assert.throws(() => buildDescriptionPacket(records, data.decisions, data.baseline), /preview-hash/);
  const decisions = structuredClone(data.decisions); decisions[1].position = 1;
  assert.throws(() => buildDescriptionPacket(data.records, decisions, data.baseline), /duplicate/);
});

test('Work fallback needs a hash-bound reason; skips and unknown rights are never writes', () => {
  const data = fixture();
  const raw = rawRecord(PILOT_ITEMS[0], 'work');
  const inspected = inspectRecord(raw, PILOT_ITEMS[0], 'work', fetchedAt);
  data.records[1].work = { raw, fetchedAt, inspectionSha256: digest(inspected) };
  Object.assign(data.decisions[0], { choice: 'work', recordSha256: inspected.recordSha256 });
  assert.throws(() => buildDescriptionPacket(data.records, data.decisions, data.baseline), /unreviewed-work/);
  data.records[1].fallback = { ...data.decisions[0], recordSha256: sha256(data.records[1].edition.raw), reason: 'edition-language' };
  data.decisions[1] = { position: 2, choice: 'skip', reason: 'Permission remains unknown.' };
  const packet = buildDescriptionPacket(data.records, data.decisions, data.baseline);
  assert.equal(packet.entries.length, 9);
  assert.equal(packet.skipped.length, 1);
  assert.equal(packet.entries[0].provenance.recordKey, '/works/OL17370186W');
  assert.equal(packet.entries[0].enrichment.records.length, 2);
  assert.equal(packet.entries[0].provenance.review.reason, 'edition-language');
  assert.equal(packet.entries[0].editionId, 'OL26433779M');
});

test('preview has an exact sequential budget and persists attempts before transport', async () => {
  const state = { status: 'starting', attempts: [], records: {}, batches: [] };
  let time = Date.parse(fetchedAt), active = 0;
  const starts = [], checkpoints = [];
  await collectDescriptions(state, [1, 2, 3], 'edition', { clock: () => time,
    delay: async ms => { time += ms; }, checkpoint: async value => checkpoints.push(structuredClone(value)),
    fetchImpl: async (url, options) => {
      assert.equal(++active, 1); starts.push(time);
      assert.equal(checkpoints.at(-1).attempts.at(-1).status, 'started');
      assert.equal(options.redirect, 'manual');
      const candidate = PILOT_ITEMS.find(row => url.includes(row.editionId));
      active--;
      return candidate.position === 2 ? new Response(null, { status: 404 })
        : Response.json(JSON.parse(rawRecord(candidate)));
    } });
  assert.equal(state.attempts.length, 3);
  assert.deepEqual(starts.map(t => t - starts[0]), [0, 1100, 2200]);
  assert.equal(state.attempts[1].status, 'missing');
  assert.equal(state.status, 'prepared');
  assert.equal(state.records[2].edition.raw, null);
  await assert.rejects(collectDescriptions(state, [1], 'edition', { checkpoint: async () => {} }), /duplicate-provider/);
  assert.equal(state.attempts.length, 3);
});

test('429, 5xx, redirects, invalid JSON and network errors stop without retry or next candidate', async () => {
  for (const response of [() => new Response('private provider failure', { status: 429 }),
    () => new Response('secret body', { status: 503 }), () => new Response(null, { status: 302 }),
    () => new Response('{bad', { headers: { 'content-type': 'application/json' } }),
    () => { throw new TypeError('https://secret.invalid/token'); }]) {
    const state = { status: 'starting', attempts: [], records: {}, batches: [] };
    let calls = 0;
    await assert.rejects(collectDescriptions(state, [1, 2], 'edition', { checkpoint: async () => {}, fetchImpl: async () => {
      calls++; return response();
    } }), error => !/secret|private/.test(error.message));
    assert.equal(calls, 1); assert.equal(state.status, 'failed'); assert.equal(state.attempts.length, 1);
    await assert.rejects(collectDescriptions(state, [2], 'edition', { checkpoint: async () => {} }), /run-not-prepared/);
  }
});

test('decoded response bytes and UTF-8 are bounded before JSON parsing', async () => {
  await assert.rejects(readBoundedResponse(new Response('x'.repeat(20)), 10), /response-too-large/);
  await assert.rejects(readBoundedResponse(new Response(new Uint8Array([0xc3, 0x28])), 10), /invalid-response-encoding/);
  assert.equal(await readBoundedResponse(new Response('café'), 5), 'café');
});

test('provider timeout aborts at 15 seconds and the twentieth attempt exhausts the frozen budget', async () => {
  let expire, cleared = false;
  const state = { status: 'starting', attempts: [], records: {}, batches: [] };
  await assert.rejects(collectDescriptions(state, [1, 2], 'edition', { checkpoint: async () => {},
    setTimer: (callback, ms) => { assert.equal(ms, 15000); expire = callback; return 42; },
    clearTimer: handle => { assert.equal(handle, 42); cleared = true; },
    fetchImpl: async (_url, options) => {
      assert.equal(options.signal.aborted, false); expire(); assert.equal(options.signal.aborted, true);
      throw new Error('Private transport details must not escape');
    } }), /provider-timeout/);
  assert.equal(cleared, true); assert.equal(state.attempts.length, 1); assert.equal(state.status, 'failed');
  const exhausted = { status: 'prepared', records: {}, batches: [],
    attempts: Array.from({ length: 20 }, (_, position) => ({ position, kind: 'work', startedAt: fetchedAt })) };
  let calls = 0;
  await assert.rejects(collectDescriptions(exhausted, [1], 'edition', { checkpoint: async () => {},
    fetchImpl: async () => { calls++; } }), /pilot-budget-exhausted/);
  assert.equal(calls, 0); assert.equal(exhausted.attempts.length, 20);
});

test('apply uses only the top-level guarded overload, exact ACKs and two separate batches', async () => {
  const state = reviewedState(), calls = [];
  const environment = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'artificial-service-key-for-fixtures' };
  const options = { environment, checkpoint: async () => {}, fetchImpl: async (url, request) => {
    calls.push(JSON.parse(request.body));
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/upsert_catalog_batch_v1');
    assert.equal(state.batches.at(-1).status, 'started');
    const payload = calls.at(-1);
    assert.equal(payload.refresh_mode, CONTRACT); assert.equal(payload.entries.length, 5);
    assert.ok(payload.entries.every(entry => !Object.hasOwn(entry, 'position') && !Object.hasOwn(entry, 'title')));
    return Response.json(payload.entries.map((entry, index) => ({ input_index: index + 1, item_id: entry.expectedItemId, outcome: 'updated' })));
  } };
  await assert.rejects(applyDescriptionBatch(state, 2, options), /invalid-batch-order/);
  await applyDescriptionBatch(state, 1, options);
  assert.equal(calls.length, 1); assert.equal(state.status, 'reviewed');
  await assert.rejects(applyDescriptionBatch(state, 1, options), /invalid-batch-order/);
  await assert.rejects(applyDescriptionBatch(state, 2, options), /invalid-batch-order/);
  verifyDescriptionReadback(state, readbackFixture(state));
  await applyDescriptionBatch(state, 2, options);
  verifyDescriptionReadback(state, readbackFixture(state));
  assert.equal(state.status, 'completed'); assert.equal(calls.length, 2);
});

test('readback detects core/nonpilot drift, wrong text/provenance and unrequested pilot changes', () => {
  const state = reviewedState();
  state.batches.push({ batch: 1, status: 'completed', startedAt: fetchedAt,
    itemIds: state.review.packet.entries.slice(0, 5).map(entry => entry.expectedItemId) });
  for (const mutate of [value => { value.preservation.movie_full_md5 = 'b'.repeat(32); },
    value => { value.pilot[0].core_md5 = 'c'.repeat(32); },
    value => { value.pilot[0].description_sha256 = 'c'.repeat(64); },
    value => { value.pilot[0].description_provenance = null; },
    value => { value.pilot[9].updated_at = value.checked_at; }]) {
    const readback = structuredClone(readbackFixture(state)); mutate(readback);
    assert.throws(() => verifyDescriptionReadback(state, readback));
    assert.equal(state.batches[0].verification, undefined);
  }
  const readback = readbackFixture(state);
  readback.preservation = Object.fromEntries(Object.entries(readback.preservation).reverse());
  verifyDescriptionReadback(state, readback);
  assert.ok(state.batches[0].verification, 'JSON key ordering is not catalog drift');
});

test('ambiguous ACK is a consumed unknown write; malformed/duplicate/cross-ID ACKs fail', async () => {
  const state = reviewedState();
  await assert.rejects(applyDescriptionBatch(state, 1, { checkpoint: async () => {},
    environment: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'artificial-service-key-for-fixtures' },
    fetchImpl: async () => Response.json({ importedCount: 5 }) }), /unknown-write-outcome/);
  assert.equal(state.status, 'failed'); assert.equal(state.batches.length, 1);
  await assert.rejects(applyDescriptionBatch(state, 1, { checkpoint: async () => {} }), /run-not-reviewed/);
  const entries = state.review.packet.entries.slice(0, 2);
  for (const value of [null, [], [{ input_index: 1, item_id: entries[0].expectedItemId, outcome: 'updated' },
    { input_index: 1, item_id: entries[1].expectedItemId, outcome: 'updated' }]])
    assert.throws(() => validateAcknowledgement(value, entries), /unknown-write-outcome/);
});

test('apply revalidates records and review packet before touching transport', async () => {
  const state = reviewedState(); state.review.decisions[0].basis += ' Changed.';
  let calls = 0;
  await assert.rejects(applyDescriptionBatch(state, 1, { checkpoint: async () => {},
    fetchImpl: async () => { calls++; } }), /packet-hash-mismatch/);
  assert.equal(calls, 0); assert.equal(state.batches.length, 0);
});

test('plan needs no credentials, does no fetch, and fixed identities agree with the read-only SQL', async () => {
  const result = spawnSync(process.execPath, ['scripts/catalog/import-open-library-descriptions.mjs', 'plan'],
    { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).candidates, PILOT_ITEMS);
  const sql = await readFile(new URL('book-description-coverage.sql', import.meta.url), 'utf8');
  for (const row of PILOT_ITEMS) assert.ok(sql.includes(`(${row.position}, '${row.itemId}'::uuid, '${row.workId}', '${row.editionId}', '${row.displayLanguage}')`));
});
