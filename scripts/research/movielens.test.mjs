import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { convertToEngineObservations } from './normalize-movielens.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');

for (const source of ['32m', 'small']) test(`artificial ${source} ZIP passes the actual Python intake and built TypeScript adapter, with verified replay`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-ml-fixture-'));
  try {
    const script = 'import sys; from pathlib import Path; sys.path.insert(0,"scripts/research"); '
      + 'from test_movielens import fixture; from movielens import normalize_archive; '
      + `root=Path(sys.argv[1]); archive,plan=fixture(root,source="${source}"); path,_,_=normalize_archive(archive,root/"normalized",plan); print(path)`;
    const result = spawnSync('python3', ['-c', script, directory], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const normalized = result.stdout.trim();
    const converted = await convertToEngineObservations(normalized);
    assert.equal(converted.count, 6);
    assert.deepEqual(converted.evidence, { native: 0, external: 6, synthetic: 0 });
    assert.equal(converted.contractProbe.equalTimestampLabelsExcluded, true);
    assert.ok(converted.contractProbe.externalPrefixRecords > 0);
    const observations = (await readFile(join(converted.path, 'observations.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.ok(observations.every(o => o.provenance.source.kind === 'external' && o.actionId === null && o.exposure === 'unknown'));
    const repeated = await convertToEngineObservations(normalized);
    assert.equal(repeated.outputSha256, converted.outputSha256);
    assert.equal(repeated.reused, true);
    await writeFile(join(converted.path, 'observations.jsonl'), 'corrupted');
    await assert.rejects(convertToEngineObservations(normalized), /integrity/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('conversion refuses changed source bytes, invalid values, missing rows and reversed chronological order', async () => {
  for (const kind of ['hash', 'invalid', 'count', 'order']) {
    const directory = await mkdtemp(join(tmpdir(), 'kajo-ml-invalid-'));
    try {
      const rows = [{ userId: '1', movieId: '1', rating: 1, timestamp: 100 }, { userId: '1', movieId: '2', rating: 2, timestamp: 110 }];
      if (kind === 'invalid') rows[0].rating = 0;
      if (kind === 'order') rows.reverse();
      const input = rows.map(JSON.stringify).join('\n') + '\n';
      await writeFile(join(directory, 'ratings.jsonl'), input);
      await writeFile(join(directory, 'manifest.json'), JSON.stringify({ source: { datasetId: 'movielens', releaseId: 'ml-32m',
        purpose: 'NONCOMMERCIAL_RESEARCH_ONLY', archiveSha256: 'a'.repeat(64) }, cohort: { ratings: kind === 'count' ? 3 : 2 },
        outputFiles: { 'ratings.jsonl': { sha256: kind === 'hash' ? 'b'.repeat(64) : hash(input) } } }));
      await assert.rejects(convertToEngineObservations(directory));
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});

test('the real-prefix probe waits past a large timestamp batch and reports unsupported all-tied history', async () => {
  for (const laterGroup of [true, false]) {
    const directory = await mkdtemp(join(tmpdir(), 'kajo-ml-time-group-'));
    try {
      const rows = Array.from({ length: 21 }, (_, index) => ({ userId: '1', movieId: String(index + 1), rating: 3, timestamp: 100 }));
      if (laterGroup) rows.push({ userId: '1', movieId: '22', rating: 4, timestamp: 200 });
      const input = rows.map(JSON.stringify).join('\n') + '\n';
      await writeFile(join(directory, 'ratings.jsonl'), input);
      await writeFile(join(directory, 'manifest.json'), JSON.stringify({ source: { datasetId: 'movielens', releaseId: 'ml-latest-small-2018-kaggle-v2',
        purpose: 'NONCOMMERCIAL_RESEARCH_ONLY', archiveSha256: 'a'.repeat(64) }, cohort: { ratings: rows.length },
        outputFiles: { 'ratings.jsonl': { sha256: hash(input) } } }));
      const result = await convertToEngineObservations(directory);
      assert.equal(result.contractProbe.externalPrefixRecords, laterGroup ? 20 : 0);
      assert.equal(result.contractProbe.status, laterGroup ? 'passed' : 'insufficient-distinct-time-groups');
      assert.equal(result.contractProbe.equalTimestampLabelsExcluded, laterGroup ? true : null);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});
