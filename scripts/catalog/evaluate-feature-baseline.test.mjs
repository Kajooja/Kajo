import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { buildBaselinePlan, compareBaselineRows, createBaselineFreeze, loadBaselineSource,
  runBaselinePlan, summarizeBaseline } from './evaluate-feature-baseline.mjs';
import { canonicalJson, MAPPING_SHA256, sha256 } from './item-features.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = '2026-09-24T11:18:16.242881+00:00';
function item(n, itemType, labels, tags = [], identityMatches = true) {
  const movie = itemType === 'MOVIE';
  return { itemId: id(n), itemType, itemUpdatedAt: at, tags,
    sources: [{ sourceId: id(n + 1000), providerKey: movie ? 'tmdb' : 'open_library',
      providerItemId: movie ? String(n) : `OL${n}W`, sourceUrl: null, sourceHash: null,
      sourceUpdatedAt: at, rowUpdatedAt: at, syncedAt: at, identityMatches,
      featurePayload: movie ? { genres: labels.map(value => ({ id: value, name: 'Fixture genre' })) } : { subject: labels } }] };
}
function snapshot(items = [
  item(1, 'BOOK', ['Science fiction', 'Fiction, Science Fiction, General'], ['unmapped']),
  item(2, 'BOOK', ['Science fiction'], ['science-fiction']),
  item(3, 'BOOK', ['Horror fiction'], ['horror-fiction']),
  item(4, 'BOOK', ['Unrecognized'], ['science-fiction']),
  item(5, 'MOVIE', [878], ['science-fiction']),
  item(6, 'MOVIE', [27], ['horror']),
  item(7, 'MOVIE', [878], ['science-fiction']),
]) { return { contract: 'catalog-feature-snapshot-v1', checkedAt: at, items }; }
async function context(data = snapshot()) {
  const source = await loadBaselineSource();
  const protocol = { ...JSON.parse(await readFile(new URL('../../research/manifests/catalog-feature-baseline-273.json', import.meta.url))),
    inputFileSha256: sha256(JSON.stringify(data)), items: data.items.length,
    functionSha256: source.functionSha256, clockSha256: source.clockSha256 };
  return { data, source, protocol, plan: buildBaselinePlan(data, protocol) };
}

test('three arms preserve legacy, separate evidence kinds, deduplicate aliases and omit unknowns', async () => {
  const { plan } = await context();
  assert.deepEqual(plan.items[0].tags, { A: ['unmapped'], B: [], C: ['provider-subject:concept:science-fiction'] });
  assert.deepEqual(plan.items[1].tags.B, ['provider-subject:concept:science-fiction']);
  assert.deepEqual(plan.items[3].tags, { A: ['science-fiction'], B: [], C: [] });
  assert.deepEqual(plan.items[4].tags.C, ['provider-genre:concept:science-fiction']);
  const mismatched = await context(snapshot([item(1, 'BOOK', ['Science fiction'], ['science-fiction'], false)]));
  assert.deepEqual(mismatched.plan.items[0].tags.C, []);
  assert.deepEqual(mismatched.plan.anchors, []);
});

test('anchor selection prefers missing BOOK concept before lexical order; samples are deterministic', async () => {
  const data = snapshot([item(1, 'BOOK', ['Horror'], ['horror']), item(3, 'BOOK', ['Horror fiction'], []),
    item(2, 'BOOK', ['Horror tales'], [])]);
  const { plan, protocol } = await context(data);
  assert.deepEqual(plan.anchors.map(row => [row.itemId, row.rating]), [[id(2), 0], [id(2), 10]]);
  assert.equal(plan.anchors[0].eligibleAnchors, 3);
  assert.equal(plan.anchors[0].preferredAnchors, 2);
  const reordered = buildBaselinePlan({ ...data, items: [...data.items].reverse() }, protocol);
  assert.deepEqual(reordered.anchors, plan.anchors);
  assert.deepEqual(reordered.items, plan.items);
  assert.notEqual(reordered.snapshotSha256, plan.snapshotSha256); // exact source array order stays hash-bound
  assert.ok(plan.anchors.length <= 24);
});

test('future/unmatched representation and snapshot identity fail before SQL execution', async () => {
  const { data, protocol } = await context();
  assert.throws(() => buildBaselinePlan(data, { ...protocol, asOf: '2026-09-23T00:00:00Z' }), /unavailable/);
  assert.throws(() => buildBaselinePlan(data, { ...protocol, asOf: '2026-09-24T11:18:16.242001+00:00' }), /fixed-observation-clock/);
  assert.throws(() => buildBaselinePlan(data, { ...protocol, mappingSha256: '0'.repeat(64) }), /mapping/);
  assert.throws(() => buildBaselinePlan(data, { ...protocol, items: 1 }), /catalog-size/);
});

test('freeze binds exact input, protocol, selected anchors, all SQL/code and runtime', async () => {
  const { plan, source, protocol } = await context();
  const freeze = createBaselineFreeze(plan, protocol, source, protocol.inputFileSha256);
  assert.equal(freeze.protocolSha256, sha256(canonicalJson(protocol)));
  assert.equal(freeze.anchorSha256, sha256(canonicalJson(plan.anchors)));
  assert.equal(Object.keys(freeze.functionSha256).length, 7);
  assert.throws(() => createBaselineFreeze(plan, protocol, source, 'bad'), /input-file/);
  assert.throws(() => createBaselineFreeze(plan, protocol, { ...source, clockSha256: 'bad' }, protocol.inputFileSha256), /clock/);
  assert.throws(() => createBaselineFreeze(plan, protocol, { ...source, functionSha256: {} }, protocol.inputFileSha256), /sql/);
});

test('checked-in protocol pins the unmodified canonical functions and fixed clock', async () => {
  const source = await loadBaselineSource();
  const protocol = JSON.parse(await readFile(new URL('../../research/manifests/catalog-feature-baseline-273.json', import.meta.url)));
  assert.deepEqual(source.functionSha256, protocol.functionSha256);
  assert.equal(source.clockSha256, protocol.clockSha256);
  assert.equal(source.runtime.pglite, '0.3.14');
});

test('comparisons report disjoint entry/exit and conditional common deltas without imputation', () => {
  const row = (n, score, rank) => ({ item_id: id(n), score, rank, explanation: { bootstrapLongTerm: score } });
  const result = compareBaselineRows([row(1, 2, 1), row(2, 1, 2)], [row(2, 3, 1), row(3, 1, 2)]);
  assert.equal(result.unionItems, 3);
  assert.equal(result.commonItems, 1);
  assert.equal(result.entered, 1);
  assert.equal(result.exited, 1);
  assert.equal(result.commonRankChanged, 1);
  assert.equal(result.commonScoreDelta, 2);
  assert.equal(result.commonAbsoluteRankChange, 1);
});

test('canonical SQL responds to missing concepts, stays long-only/neutral and repeats exactly', async () => {
  const { plan, source } = await context();
  const result = await runBaselinePlan(plan, source);
  assert.deepEqual(await runBaselinePlan(plan, source), result);
  const positive = plan.anchors.find(row => row.itemType === 'BOOK' && row.concept === 'science-fiction' && row.rating === 10);
  const query = (arm, type = 'BOOK') => result.results.find(row => row.arm === arm
    && row.profileId === positive.profileId && row.targetType === type);
  assert.equal(query('B').rows.find(row => row.item_id === id(2)).explanation.bootstrapLongTerm, 0);
  assert.ok(query('C').rows.find(row => row.item_id === id(2)).explanation.bootstrapLongTerm > 0);
  assert.equal(query('C').rows.find(row => row.item_id === id(4)).explanation.bootstrapLongTerm, 0);
  assert.deepEqual(query('C').memory.longTermPositiveTags, ['provider-subject:concept:science-fiction']);
  assert.deepEqual(query('C').memory.shortTermPositiveTags, []);
  assert.equal(query('C').memory.nativeEvidenceCount, 0);
  assert.equal(query('C').memory.bootstrapEvidenceCount, 1);
  assert.equal(result.events, 0);
  assert.equal(result.observedOutcomes, 0);
  assert.ok(query('C', 'MOVIE').rows.every(row => row.explanation.bootstrapLongTerm === 0 && row.confidence === 0));
  assert.equal(query('C').rows.some(row => row.item_id === positive.itemId), false);
  const negative = plan.anchors.find(row => row.itemType === 'BOOK' && row.concept === 'science-fiction' && row.rating === 0);
  const opposite = result.results.find(row => row.arm === 'C' && row.profileId === negative.profileId && row.targetType === 'BOOK');
  assert.ok(opposite.rows.find(row => row.item_id === id(2)).explanation.bootstrapLongTerm < 0);
  assert.equal(query('C').memory.asOf, at); // microseconds survive SQL clock, no JS Date rounding
  const report = summarizeBaseline(plan, result);
  const encoded = JSON.stringify(report);
  assert.ok(!encoded.includes(positive.itemId));
  assert.ok(!encoded.includes(positive.profileId));
  assert.ok(!encoded.includes('Unrecognized'));
  assert.equal(report.counts.observedOutcomes, 0);
  assert.equal(MAPPING_SHA256.length, 64);
});

test('SQL top-50 coverage counts unreturned eligible Items and excludes only the anchor', async () => {
  const items = Array.from({ length: 53 }, (_, n) => item(n + 1, 'BOOK', ['Horror'], ['horror']));
  const { plan, source } = await context(snapshot(items));
  const result = await runBaselinePlan(plan, source);
  for (const row of result.results.filter(row => row.targetType === 'BOOK')) {
    assert.equal(row.eligible, 52);
    assert.equal(row.returned, 50);
    assert.equal(row.outsideReturnedTop50, 2);
    assert.equal(row.excludedAnchors, 1);
    assert.deepEqual(row.rows.map(item => item.rank), Array.from({ length: 50 }, (_, n) => n + 1));
  }
});

test('source-kind isolation bounds bootstrap, while existing novelty still reacts to metadata availability', async () => {
  const { plan, source } = await context(snapshot([
    item(1, 'BOOK', ['Unrecognized'], []), item(2, 'BOOK', ['Horror fiction'], []),
    item(3, 'MOVIE', [878], ['science-fiction']),
  ]));
  const result = await runBaselinePlan(plan, source);
  const anchor = plan.anchors.find(row => row.itemType === 'MOVIE' && row.rating === 10);
  const rows = arm => result.results.find(row => row.arm === arm && row.profileId === anchor.profileId && row.targetType === 'BOOK').rows;
  assert.deepEqual(rows('B').map(row => row.item_id), [id(1), id(2)]);
  assert.deepEqual(rows('C').map(row => row.item_id), [id(2), id(1)]);
  assert.ok(rows('C').every(row => row.explanation.bootstrapLongTerm === 0));
  assert.equal(rows('C')[0].score, 0.1);
  assert.equal(rows('C')[0].explanation.novelty, 1);
  assert.equal(rows('C')[1].score, 0);
});

test('CLI failures redact private parser payload and paths before creating output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-baseline-private-'));
  try {
    const input = join(directory, 'DO_NOT_LOG_PRIVATE_FILENAME.json');
    await writeFile(input, '{"private":"DO_NOT_LOG_PRIVATE_PAYLOAD"');
    await assert.rejects(promisify(execFile)(process.execPath,
      [new URL('./evaluate-feature-baseline.mjs', import.meta.url).pathname,
        '--snapshot', input, '--prepare', '--out', join(directory, 'output')]), error => {
      assert.equal(error.stdout, '');
      assert.deepEqual(JSON.parse(error.stderr), { status: 'error', code: 'feature-baseline-failed' });
      return true;
    });
    await assert.rejects(readFile(join(directory, 'output', 'freeze.json')), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
