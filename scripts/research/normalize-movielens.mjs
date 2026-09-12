import { spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, mkdtemp, rename, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { interpretMovieLensRating, movieLensTarget } from '@kajo/prediction-engine/adapters/movielens';
import { represent } from '@kajo/prediction-engine';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Final adapter stage; only atomically published, verified output is reusable. */
export async function convertToEngineObservations(directory) {
  const manifestPath = join(directory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const sourcePath = join(directory, 'ratings.jsonl');
  const inputSha256 = await sha256(sourcePath);
  if (inputSha256 !== manifest.outputFiles['ratings.jsonl'].sha256) throw new Error('Normalized input hash mismatch');
  const codeSha256 = await sha256(fileURLToPath(import.meta.url));
  const adapterSha256 = await sha256(fileURLToPath(import.meta.resolve('@kajo/prediction-engine/adapters/movielens')));
  const identity = { inputSha256, codeSha256, adapterSha256, source: manifest.source };
  const conversionId = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  const completed = join(directory, `engine-${conversionId}`);
  try {
    const checkpoint = JSON.parse(await readFile(join(completed, 'manifest.json'), 'utf8'));
    if (checkpoint.conversionId !== conversionId || await sha256(join(completed, 'observations.jsonl')) !== checkpoint.outputSha256) {
      throw new Error('Existing engine observations failed integrity check');
    }
    return { ...checkpoint, path: completed, reused: true };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // An incomplete existing final directory is never silently replaced.
    try { await stat(completed); throw new Error('Incomplete engine output requires inspection'); }
    catch (entryError) { if (entryError.code !== 'ENOENT') throw entryError; }
  }
  const work = await mkdtemp(join(directory, '.engine-'));
  const targetPath = join(work, 'observations.jsonl');
  const writer = createWriteStream(targetPath, { encoding: 'utf8', flags: 'wx' });
  // Observe write errors immediately, including between backpressure waits.
  let writeError;
  writer.on('error', error => { writeError = error; });
  const sample = [];
  let probeTarget;
  let count = 0;
  let previous;
  try {
    const lines = createInterface({ input: createReadStream(sourcePath, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of lines) {
      if (line.length > 4096) throw new Error('Normalized row exceeds budget');
      const row = JSON.parse(line);
      const observation = interpretMovieLensRating(row, manifest.source);
      const order = [row.timestamp, Number(row.userId), Number(row.movieId)];
      if (previous && (order[0] < previous[0] || (order[0] === previous[0]
        && (order[1] < previous[1] || (order[1] === previous[1] && order[2] <= previous[2]))))) {
        throw new Error('Normalized observation order or uniqueness changed');
      }
      previous = order;
      count++;
      if (count > manifest.cohort.ratings) throw new Error('Cohort row count exceeded');
      if (!sample.length) sample.push(observation);
      else if (!probeTarget && sample[0].subjectId === observation.subjectId) {
        if (observation.occurredAt > sample[0].occurredAt) probeTarget = observation;
        else if (sample.length < 20) sample.push(observation);
      }
      if (writeError) throw writeError;
      if (!writer.write(JSON.stringify(observation) + '\n')) await once(writer, 'drain');
    }
    if (writeError) throw writeError;
    const finished = once(writer, 'finish');
    writer.end();
    await finished;
    if (writeError) throw writeError;
    if (count !== manifest.cohort.ratings || count === 0 || await sha256(sourcePath) !== inputSha256) {
      throw new Error('Cohort count or input bytes changed');
    }
    const cutoff = Math.max(0, (probeTarget ?? sample[0]).occurredAt - 1);
    const scope = { subject: { id: sample[0].subjectId, kind: 'individual' }, actingIdentityRef: null,
      sessionRef: 'offline-contract-probe', evidence: { sourceIds: [`${manifest.source.datasetId}:${manifest.source.releaseId}`], cohortIds: [], synthetic: 'exclude' } };
    const state = represent({ scope, observations: probeTarget ? sample.filter(o => o.occurredAt <= cutoff) : [], target: movieLensTarget,
      asOf: cutoff, artifact: { id: 'untrained-raw-rating-prefix', version: '1', representationVersion: 'raw-rating-v1',
        availableAt: 0, trainedThrough: null, sourceRefs: [], use: 'research-only' } });
    const checkpoint = { conversionId, ...identity, outputSha256: await sha256(targetPath), count,
      evidence: { native: 0, external: count, synthetic: 0 },
      contractProbe: { status: probeTarget ? 'passed' : 'insufficient-distinct-time-groups',
        externalPrefixRecords: state.prefix.length, unknownActingIdentity: state.scope.actingIdentityRef === null,
        equalTimestampLabelsExcluded: probeTarget ? state.prefix.every(o => o.occurredAt < probeTarget.occurredAt) : null },
      nodeVersion: process.versions.node };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(work, 'manifest.json'), JSON.stringify(checkpoint, null, 2) + '\n', { flag: 'wx' });
    await rename(work, completed);
    return { ...checkpoint, path: completed, reused: false };
  } finally {
    if (!writer.closed) { writer.destroy(); await once(writer, 'close').catch(() => {}); }
    await rm(work, { recursive: true, force: true });
  }
}

export async function normalizeMovieLens(args = []) {
  const result = spawnSync('python3', [join(repository, 'scripts/research/movielens.py'), 'normalize', ...args],
    { encoding: 'utf8', maxBuffer: 1024 * 1024, cwd: repository });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Source normalization failed');
  const normalized = JSON.parse(result.stdout);
  const converted = await convertToEngineObservations(normalized.path);
  return { source: normalized.manifest.source, sourceCounts: normalized.manifest.sourceCounts,
    cohort: normalized.manifest.cohort, quarantine: normalized.manifest.quarantine,
    normalizedPath: normalized.path, normalizedReused: normalized.reused, engine: converted };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await normalizeMovieLens(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(`MovieLens normalization stopped: ${error.message}`); process.exitCode = 1; }
}
