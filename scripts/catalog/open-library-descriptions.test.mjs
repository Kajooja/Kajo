import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { CONTRACT, PILOT, PILOT_ITEMS, REVIEW_AMENDMENT, amendDescriptionReview, buildDescriptionPacket, digest, inspectRecord,
  normalizeDescription, readBoundedResponse, sha256, validateAcknowledgement, validateReviewHistory, verifyDescriptionReadback } from './open-library-descriptions.mjs';
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

function amendmentFixture() {
  const state = reviewedState();
  Object.assign(state, { pilot: PILOT, manifestSha256: digest(PILOT_ITEMS) });
  for (const kind of ['edition', 'work']) for (const candidate of PILOT_ITEMS) {
    const time = new Date(Date.parse(fetchedAt) + state.attempts.length * 1100).toISOString();
    const raw = rawRecord(candidate, kind);
    const inspection = inspectRecord(raw, candidate, kind, time);
    state.records[candidate.position][kind] = { raw, fetchedAt: time, inspectionSha256: digest(inspection) };
    state.attempts.push({ position: candidate.position, kind, startedAt: time, status: 'found' });
    if (kind === 'work') state.records[candidate.position].fallback = {
      recordSha256: sha256(state.records[candidate.position].edition.raw),
      textSha256: sha256(text), reason: 'edition-rights' };
  }
  state.review.decisions = PILOT_ITEMS.map(({ position }) => ({ position, choice: 'skip', reason: 'Original permission hold.' }));
  state.review.packet = buildDescriptionPacket(state.records, state.review.decisions, state.review.baseline);
  state.review.packetSha256 = digest(state.review.packet);
  state.review.reviewedAt = '2026-09-14T02:00:00.000Z';
  const amendment = { contract: REVIEW_AMENDMENT, expectedReviewSha256: digest(state.review),
    reason: 'Record the source investigation without granting display permission.',
    decisions: structuredClone(state.review.decisions) };
  amendment.decisions[0].reason = 'Source located; required attribution is not yet supported.';
  return { state, amendment, baseline: structuredClone(state.review.baseline) };
}

test('review amendment retains all twenty cached attempts and exact prior review without mutating its input', () => {
  const { state, amendment, baseline } = amendmentFixture();
  const before = structuredClone(state);
  const next = amendDescriptionReview(state, amendment, baseline, '2026-09-19T01:00:00.000Z');
  assert.deepEqual(state, before);
  for (const key of ['records', 'attempts', 'batches', 'pilot', 'manifestSha256', 'status']) assert.deepEqual(next[key], state[key]);
  assert.equal(next.attempts.length, 20);
  assert.deepEqual(next.reviewHistory, [state.review]);
  assert.equal(next.review.amendment.previousReviewSha256, digest(state.review));
  assert.equal(next.review.packet.entries.length, 0);
  assert.equal(next.review.packet.skipped.length, 10);
  validateReviewHistory(next);
  assert.throws(() => amendDescriptionReview(next, amendment, baseline), /review-parent-mismatch/);
  amendment.decisions[0].reason = 'Later caller mutation must not rewrite accepted history.';
  assert.notEqual(next.review.decisions[0].reason, amendment.decisions[0].reason);
  const second = { ...amendment, expectedReviewSha256: digest(next.review) };
  const latest = amendDescriptionReview(next, second, baseline, '2026-09-19T02:00:00.000Z');
  assert.deepEqual(latest.reviewHistory, [state.review, next.review]);
  validateReviewHistory(latest);
});

test('amendment rejects failed runs, attempted writes, stale parents and unchanged reviews before mutation', () => {
  for (const mutate of [
    data => { data.state.status = 'failed'; },
    data => { data.state.failure = 'unknown-write-outcome'; },
    data => { data.state.batches.push({ batch: 1, status: 'unknown-write-outcome' }); },
    data => { data.state.batches.push({ batch: 1, status: 'completed' }); },
    data => { data.amendment.expectedReviewSha256 = '0'.repeat(64); },
    data => { data.amendment.decisions = structuredClone(data.state.review.decisions); },
    data => { data.baseline.checked_at = '2020-01-01T00:00:00.000Z'; },
    data => { data.amendment.contract = 'unknown'; },
    data => { data.amendment.reason = 'short'; },
  ]) {
    const data = amendmentFixture(); mutate(data);
    const before = structuredClone(data.state);
    assert.throws(() => amendDescriptionReview(data.state, data.amendment, data.baseline));
    assert.deepEqual(data.state, before);
  }
  const data = amendmentFixture();
  assert.throws(() => amendDescriptionReview(data.state, data.amendment, data.baseline, fetchedAt), /invalid-review-time/);
});

test('amendment checks skipped Work hashes, complete attempt accounting and unchanged approval rules', () => {
  for (const mutate of [
    data => { data.state.records[1].work.raw = rawRecord(PILOT_ITEMS[0], 'work', text + ' Changed.'); },
    data => { data.state.attempts.pop(); },
    data => { data.state.attempts[19] = { ...data.state.attempts[18] }; },
    data => { data.state.attempts[0].status = 'started'; },
    data => { delete data.state.records[1].fallback; },
    data => { data.state.review.packet.skipped[0].reason = 'Tampered packet.'; },
    data => { data.amendment.decisions[0] = { ...fixture().decisions[0], rights: 'unknown' }; },
    data => { data.baseline.pilot[0].work_id = 'OL1W'; },
  ]) {
    const data = amendmentFixture(); mutate(data);
    assert.throws(() => amendDescriptionReview(data.state, data.amendment, data.baseline));
  }
});

test('amended synthetic approvals use existing guarded apply and readback; history tampering stops transport', async () => {
  const { state, amendment, baseline } = amendmentFixture();
  amendment.decisions[0] = fixture().decisions[0];
  baseline.checked_at = baseline.pilot[0].updated_at = '2026-09-19T00:00:00.000Z';
  const next = amendDescriptionReview(state, amendment, baseline);
  assert.equal(next.review.packet.entries.length, 1);
  assert.equal(next.review.packet.entries[0].expectedItemUpdatedAt, baseline.checked_at);
  assert.equal(next.reviewHistory[0].baseline.pilot[0].updated_at, fetchedAt);
  const options = { checkpoint: async () => {},
    environment: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'artificial-service-key-for-fixtures' },
    fetchImpl: async (_url, request) => {
      const payload = JSON.parse(request.body);
      assert.equal(payload.refresh_mode, CONTRACT);
      assert.equal(payload.entries.length, 1);
      return Response.json([{ input_index: 1, item_id: PILOT_ITEMS[0].itemId, outcome: 'updated' }]);
    } };
  await applyDescriptionBatch(next, 1, options);
  verifyDescriptionReadback(next, readbackFixture(next));
  assert.ok(next.batches[0].verification);
  assert.throws(() => amendDescriptionReview(next, { ...amendment, expectedReviewSha256: digest(next.review) }, baseline), /review-after-write/);
  for (const mutate of [value => { value.reviewHistory[0].decisions[0].reason += ' Changed.'; },
    value => { value.reviewHistory = []; }, value => { value.review.amendment.previousReviewSha256 = '0'.repeat(64); }]) {
    const damaged = amendDescriptionReview(state, amendment, baseline); mutate(damaged);
    let calls = 0;
    await assert.rejects(applyDescriptionBatch(damaged, 1, { ...options, fetchImpl: async () => { calls++; } }));
    assert.equal(calls, 0); assert.equal(damaged.batches.length, 0);
  }
});

test('amend-review CLI is offline, keeps the global claim and rejects locked or replayed proposals without rewriting state', async () => {
  const root = fileURLToPath(new URL('../../dist/catalog-enrichment/', import.meta.url));
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(root + 'amend-test-');
  const claimPath = root + PILOT + '.json';
  const claim = await readFile(claimPath).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  try {
    const { state, amendment, baseline } = amendmentFixture();
    const statePath = directory + '/state.json';
    await writeFile(statePath, JSON.stringify(state));
    await writeFile(directory + '/amendment.json', JSON.stringify(amendment));
    await writeFile(directory + '/baseline.json', JSON.stringify(baseline));
    await writeFile(directory + '/no-network.mjs', "globalThis.fetch = () => { throw new Error('Network must not be called'); };\n");
    const args = ['--import', directory + '/no-network.mjs', 'scripts/catalog/import-open-library-descriptions.mjs',
      'amend-review', '--run', directory, '--amendment', directory + '/amendment.json', '--baseline', directory + '/baseline.json'];
    const run = () => spawnSync(process.execPath, args, { cwd: fileURLToPath(new URL('../../', import.meta.url)),
      encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 5000 });
    await writeFile(directory + '/operation.lock', 'Artificial lock');
    assert.equal(run().status, 1);
    assert.equal(await readFile(statePath, 'utf8'), JSON.stringify(state));
    await rm(directory + '/operation.lock');
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).providerAttempts, 20);
    assert.equal(JSON.parse(result.stdout).accepted, 0);
    assert.ok(!result.stdout.includes('Source located'));
    const accepted = await readFile(statePath, 'utf8');
    assert.equal(JSON.parse(accepted).reviewHistory.length, 1);
    const replay = run();
    assert.equal(replay.status, 1);
    assert.match(replay.stderr, /review-parent-mismatch/);
    assert.equal(await readFile(statePath, 'utf8'), accepted);
    const afterClaim = await readFile(claimPath).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    assert.deepEqual(afterClaim, claim);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
