import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { interpretBookGenomeRating, bookGenomeRatingsSha256, bookGenomeStaticSpec } from '@kajo/prediction-engine/adapters/book-genome';
import { fitStaticRatings } from '@kajo/prediction-engine/research-static';
import { partitionBooks, scoreBooks, freezeBooks, runBooks } from './evaluate-books.mjs';

const hash = x => createHash('sha256').update(x).digest('hex');
const stable = value => JSON.stringify(value, (_, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const protocol = JSON.parse(await readFile('research/manifests/book-genome-static-v1.json', 'utf8'));
const artificial = Array.from({ length: 500 * 20 }, (_, n) => {
  const user = Math.floor(n / 20), item = n % 20;
  return { user, item, value: interpretBookGenomeRating({ user_id: user, item_id: item,
    rating: (user + item) % 5 + 1 }, bookGenomeRatingsSha256) };
});

test('static membership is label-blind, complete and disjoint across all five partitions', () => {
  const original = partitionBooks(artificial, protocol);
  const changed = partitionBooks(artificial.map(r => ({ ...r, value: { ...r.value, value: 12 - r.value.value } })), protocol);
  const membership = p => Object.fromEntries(Object.entries(p).map(([k, rows]) => [k, rows.map(r => [r.user, r.item])]));
  assert.deepEqual(membership(original), membership(changed));
  assert.equal(original.train.length, 5600);
  assert.equal(original.validation.length, 1200);
  assert.equal(original.test.length, 1200);
  assert.equal(original.coldVisible.length, 1600);
  assert.equal(original.coldTargets.length, 400);
  assert.throws(() => partitionBooks([...artificial.slice(0, -1), artificial[0]], protocol), /overlap/);
});

test('changing withheld labels cannot change fitted estimates, and cold masks keep target identities fixed', () => {
  const p = partitionBooks(artificial, protocol), model = fitStaticRatings(p.train.map(r => r.value), bookGenomeStaticSpec);
  const baseline = scoreBooks(model, p.test, p.train);
  const changed = scoreBooks(model, p.test.map(r => ({ ...r, value: { ...r.value, value: 2 } })), p.train);
  assert.deepEqual(baseline.journal.map(r => r.prediction), changed.journal.map(r => r.prediction));
  const expected = p.coldTargets.map(r => `${r.user}:${r.item}`);
  for (const budget of protocol.coldEvidenceBudgets) {
    const n = new Map(), visible = p.coldVisible.filter(r => { n.set(r.user, (n.get(r.user) ?? 0) + 1); return n.get(r.user) <= budget; });
    const result = scoreBooks(model, p.coldTargets, visible);
    assert.deepEqual(result.journal.map(r => `${r.user}:${r.item}`), expected);
    assert.ok(result.journal.every(r => r.prediction.visibleSupport === Math.min(16, budget)));
  }
});

test('built runner freezes, reproduces and protects artificial research stages without a dataset download', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kajo-book-static-'));
  try {
    const source = JSON.parse(await readFile('research/manifests/book-genome-2021.json', 'utf8'));
    const bytes = Buffer.from(artificial.map((r, i) => JSON.stringify({ sourceRecordLine: i + 1,
      record: { user_id: r.user, item_id: r.item, rating: r.value.original.value } })).join('\n') + '\n');
    const receipt = { schema: 'book-genome-normalized-v1', source, sourceCounts: source.expectedCounts,
      lineage: { codeSha256: hash(await readFile('scripts/research/book_genome.py')),
        planSha256: hash(stable(source)), compressedSha256: source.member.compressedSha256 },
      cohort: { subjects: 500, ratings: 10000 }, cohortSha256: hash(bytes), cohortBytes: bytes.length,
      quarantine: { scope: 'ARTIFICIAL_TEST_FIXTURE', identicalDuplicates: 0, conflictingPairs: 0 } };
    const input = join(dir, 'input'); await mkdir(input);
    await writeFile(join(input, 'ratings.jsonl'), bytes);
    await writeFile(join(input, 'manifest.json'), JSON.stringify(receipt));
    const frozen = join(dir, 'frozen'), output = join(dir, 'run');
    const freeze = await freezeBooks(input, frozen);
    assert.equal(freeze.role, 'EXPOSED_DEVELOPMENT_REPLAY');
    const result = await runBooks(frozen, output);
    const repeat = await runBooks(frozen, join(dir, 'run2'));
    assert.deepEqual(result, repeat);
    assert.equal(result.qualityAdmission, 'NONE');
    assert.equal(result.nativeRowsWritten, 0);
    assert.equal(result.test['profile-offset'].rows, 1200);
    assert.equal(JSON.parse(await readFile(join(output, 'selection-before-test.json'))).testLabelsUsedForFitOrSelection, false);
    await assert.rejects(runBooks(frozen, output), /exist/);
    await assert.rejects(freezeBooks(input, frozen), /exist/);
    const frozenBytes = await readFile(join(frozen, 'freeze.json'));
    const badFreeze = JSON.parse(frozenBytes); badFreeze.lineage.node = 'changed';
    await writeFile(join(frozen, 'freeze.json'), JSON.stringify(badFreeze));
    await assert.rejects(runBooks(frozen, join(dir, 'bad')), /changed/);
    await writeFile(join(frozen, 'freeze.json'), frozenBytes);
    await writeFile(join(frozen, 'ratings.jsonl'), 'corrupt');
    await assert.rejects(runBooks(frozen, join(dir, 'bad')), /integrity/);
    await writeFile(join(input, 'ratings.jsonl'), 'corrupt');
    await assert.rejects(freezeBooks(input, join(dir, 'bad-freeze')), /integrity/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
