// Offline intake only. No provider/database client, rights approval or pilot replay.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { digest, inspectRecord, requireValue, sha256, UUID } from './open-library-descriptions.mjs';

export const TARGET_CONTRACT = 'open-library-description-dump-targets-v1';
export const SOURCE_CONTRACT = 'open-library-description-dump-source-v1';
export const INTAKE_CONTRACT = 'open-library-description-dump-intake-v1';
export const LIMITS = Object.freeze({ targets: 385, lineBytes: 1049600, stagedRecordBytes: 64 * 1024 * 1024,
  fileBytes: 64 * 1024 ** 3, decodedBytes: 512 * 1024 ** 3, rows: 200000000 });
export const DEFAULT_STAGING_ROOT = fileURLToPath(new URL('../../dist/catalog-enrichment/', import.meta.url));
const HASH = /^[0-9a-f]{64}$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const boundedInteger = (value, maximum) => Number.isSafeInteger(value) && value > 0 && value <= maximum;
// Open Library also supplies timestamps without a timezone; they denote UTC.
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)
  && Number.isFinite(Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z'));
const timeValue = value => Date.parse(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');

export function validateDumpTargets(snapshot) {
  requireValue(exactKeys(snapshot, ['contract', 'checkedAt', 'targets']) && snapshot.contract === TARGET_CONTRACT
    && timestamp(snapshot.checkedAt) && Array.isArray(snapshot.targets)
    && snapshot.targets.length > 0 && snapshot.targets.length <= LIMITS.targets, 'invalid-dump-target-snapshot');
  const identities = ['itemId', 'sourceId', 'workId', 'editionId'].map(() => new Set());
  const fields = ['itemId', 'sourceId', 'workId', 'editionId', 'displayLanguage', 'itemUpdatedAt',
    'sourceUpdatedAt', 'descriptionSha256', 'managedDescription', 'identityMatches'];
  for (const row of snapshot.targets) {
    requireValue(exactKeys(row, fields) && UUID.test(row.itemId) && UUID.test(row.sourceId)
      && /^OL\d+W$/.test(row.workId) && /^OL\d+M$/.test(row.editionId)
      && (row.displayLanguage === null || /^[a-z]{2,3}$/.test(row.displayLanguage))
      && timestamp(row.itemUpdatedAt) && timestamp(row.sourceUpdatedAt)
      && timeValue(row.itemUpdatedAt) <= timeValue(snapshot.checkedAt)
      && timeValue(row.sourceUpdatedAt) <= timeValue(snapshot.checkedAt)
      && (row.descriptionSha256 === null || HASH.test(row.descriptionSha256))
      && typeof row.managedDescription === 'boolean' && row.identityMatches === true, 'invalid-dump-target-identity');
    ['itemId', 'sourceId', 'workId', 'editionId'].forEach((field, index) => {
      requireValue(!identities[index].has(row[field]), 'duplicate-dump-target-identity');
      identities[index].add(row[field]);
    });
  }
  return snapshot.targets.filter(row => row.descriptionSha256 === null && !row.managedDescription)
    .toSorted((a, b) => a.itemId.localeCompare(b.itemId));
}

export function validateDumpSources(manifest) {
  requireValue(exactKeys(manifest, ['contract', 'release', 'retrievedAt', 'sources'])
    && manifest.contract === SOURCE_CONTRACT && /^\d{4}-\d\d-\d\d$/.test(manifest.release)
    && !Number.isNaN(Date.parse(manifest.release))
    && new Date(manifest.release).toISOString().slice(0, 10) === manifest.release && timestamp(manifest.retrievedAt)
    && timeValue(manifest.retrievedAt) >= Date.parse(manifest.release)
    && exactKeys(manifest.sources, ['works', 'editions']), 'invalid-dump-source-manifest');
  for (const kind of ['works', 'editions']) {
    const source = manifest.sources[kind];
    requireValue(exactKeys(source, ['url', 'sha256', 'bytes', 'compression', 'maxDecodedBytes', 'maxRows'])
      && HASH.test(source.sha256) && boundedInteger(source.bytes, LIMITS.fileBytes)
      && ['gzip', 'none'].includes(source.compression)
      && boundedInteger(source.maxDecodedBytes, LIMITS.decodedBytes)
      && boundedInteger(source.maxRows, LIMITS.rows), 'invalid-dump-source-bounds');
    let url;
    try { url = new URL(source.url); } catch { throw new Error('invalid-dump-source-url'); }
    const filename = `ol_dump_${kind}_${manifest.release}.txt${source.compression === 'gzip' ? '.gz' : ''}`;
    const sourcePath = url.hostname === 'archive.org' ? `/download/ol_dump_${manifest.release}/${filename}`
      : `/data/${filename}`;
    requireValue(url.protocol === 'https:' && ['archive.org', 'openlibrary.org'].includes(url.hostname)
      && !url.username && !url.password && !url.port && !url.search && !url.hash
      && url.pathname === sourcePath, 'invalid-dump-source-url');
  }
  return manifest;
}

export function planDumpDescriptions(snapshot, manifest) {
  const selected = validateDumpTargets(snapshot);
  if (manifest !== undefined) validateDumpSources(manifest);
  return { contract: INTAKE_CONTRACT, status: 'planned', targetSnapshotSha256: digest(snapshot),
    sourceManifestSha256: manifest === undefined ? null : digest(manifest),
    catalogTargets: snapshot.targets.length, selectedTargets: selected.length,
    excludedExistingOrManaged: snapshot.targets.length - selected.length,
    expectedRecords: selected.length * 2, limits: LIMITS, providerRequests: 0, databaseWrites: 0, approved: 0 };
}

export function safeDumpError(error) {
  if (error.code === 'EEXIST') return 'dump-output-already-exists';
  if (error.code === 'ENOENT') return 'missing-dump-input';
  return /^(?:invalid|duplicate|missing|unsafe|unexpected|dump|record|provider|malformed)-[a-z-]+$/.test(error.message)
    ? error.message : 'dump-operation-failed';
}

// A newly created direct child is an exclusive, persistent run claim. No resume
// command or automatic replacement of a failed run is implied by this intake.
async function claimOutput(root, output) {
  const stagingRoot = resolve(root);
  const directory = resolve(output);
  requireValue(dirname(directory) === stagingRoot && directory !== stagingRoot, 'unsafe-dump-output');
  const parents = [];
  for (let path = stagingRoot; path !== dirname(path); path = dirname(path)) parents.unshift(path);
  for (const path of parents) {
    try { await mkdir(path, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const info = await lstat(path);
    requireValue(info.isDirectory() && !info.isSymbolicLink(), 'unsafe-dump-output-parent');
  }
  await mkdir(directory, { mode: 0o700 });
  return directory;
}

async function jsonFile(path, value) {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  return sha256(bytes);
}

async function scanDump(path, source, kind, selected, fetchedAt, budget) {
  const type = kind === 'works' ? 'work' : 'edition';
  const targets = new Map(selected.map(row => [type === 'work' ? `/works/${row.workId}` : `/books/${row.editionId}`, row]));
  const records = new Map();
  const stats = { bytes: 0, decodedBytes: 0, rows: 0, matchedRecords: 0, unrelatedRows: 0, malformedUnrelatedRows: 0 };
  const hash = createHash('sha256');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const sourceInfo = await lstat(path);
  requireValue(sourceInfo.isFile() && !sourceInfo.isSymbolicLink(), 'unsafe-dump-input');
  requireValue(sourceInfo.size === source.bytes, 'dump-file-size-mismatch');
  let pending = Buffer.alloc(0);
  function line(bytes) {
    stats.rows += 1;
    requireValue(stats.rows <= source.maxRows, 'dump-row-limit');
    if (bytes.at(-1) === 13) bytes = bytes.subarray(0, -1);
    requireValue(bytes.length <= LIMITS.lineBytes, 'dump-line-limit');
    let decoded;
    try { decoded = decoder.decode(bytes); }
    catch { throw new Error('invalid-dump-encoding'); }
    const boundaries = [];
    let start = 0;
    for (let index = 0; index < 4; index++) {
      const next = decoded.indexOf('\t', start);
      if (next === -1) break;
      boundaries.push(next);
      start = next + 1;
    }
    const key = boundaries.length ? decoded.slice(boundaries[0] + 1, boundaries[1] ?? decoded.length) : null;
    const target = targets.get(key);
    if (!target) {
      stats.unrelatedRows += 1;
      if (boundaries.length !== 4) stats.malformedUnrelatedRows += 1;
      return;
    }
    requireValue(boundaries.length === 4, 'malformed-dump-target-row');
    requireValue(!records.has(target.itemId), 'duplicate-dump-target-record');
    const recordType = decoded.slice(0, boundaries[0]);
    const revision = decoded.slice(boundaries[1] + 1, boundaries[2]);
    const modifiedAt = decoded.slice(boundaries[2] + 1, boundaries[3]);
    const raw = decoded.slice(boundaries[3] + 1);
    requireValue(recordType === `/type/${type}` && /^[1-9]\d*$/.test(revision)
      && Number.isSafeInteger(Number(revision)) && timestamp(modifiedAt), 'invalid-dump-target-envelope');
    const inspection = inspectRecord(raw, target, type, fetchedAt);
    requireValue((inspection.sourceRevision === null || inspection.sourceRevision === Number(revision))
      && (inspection.sourceModifiedAt === null || timeValue(inspection.sourceModifiedAt) === timeValue(modifiedAt)),
    'invalid-dump-target-envelope');
    budget.bytes += Buffer.byteLength(raw);
    requireValue(budget.bytes <= LIMITS.stagedRecordBytes, 'dump-staging-limit');
    records.set(target.itemId, { raw, inspection, inspectionSha256: digest(inspection),
      dump: { row: stats.rows, revision: Number(revision), modifiedAt } });
    stats.matchedRecords += 1;
  }
  const meter = new Transform({ transform(chunk, _encoding, callback) {
    try {
      stats.bytes += chunk.length;
      requireValue(stats.bytes <= source.bytes, 'dump-file-size-mismatch');
      hash.update(chunk);
      callback(null, chunk);
    } catch (error) { callback(error); }
  } });
  const sink = new Writable({ write(chunk, _encoding, callback) {
    try {
      stats.decodedBytes += chunk.length;
      requireValue(stats.decodedBytes <= source.maxDecodedBytes, 'dump-decoded-byte-limit');
      let start = 0;
      for (let end = chunk.indexOf(10); end !== -1; end = chunk.indexOf(10, start)) {
        const part = chunk.subarray(start, end);
        requireValue(pending.length + part.length <= LIMITS.lineBytes, 'dump-line-limit');
        line(pending.length ? Buffer.concat([pending, part]) : part);
        pending = Buffer.alloc(0);
        start = end + 1;
      }
      const tail = chunk.subarray(start);
      requireValue(pending.length + tail.length <= LIMITS.lineBytes, 'dump-line-limit');
      pending = pending.length ? Buffer.concat([pending, tail]) : Buffer.from(tail);
      callback();
    } catch (error) { callback(error); }
  } });
  const streams = [createReadStream(path), meter];
  if (source.compression === 'gzip') streams.push(createGunzip());
  streams.push(sink);
  // Always consume to EOF, including after every target was found: digest and
  // gzip footer integrity cover the whole file, and a later duplicate must fail.
  await pipeline(...streams);
  if (pending.length) line(pending);
  requireValue(stats.bytes === source.bytes, 'dump-file-size-mismatch');
  const fileSha256 = hash.digest('hex');
  requireValue(fileSha256 === source.sha256, 'dump-checksum-mismatch');
  return { records, stats: { ...stats, sha256: fileSha256, complete: true } };
}

export async function stageDumpDescriptions({ snapshot, manifest, worksPath, editionsPath,
  outputDirectory, stagingRoot = DEFAULT_STAGING_ROOT }) {
  const plan = planDumpDescriptions(snapshot, manifest);
  requireValue(manifest !== undefined && typeof worksPath === 'string' && typeof editionsPath === 'string'
    && resolve(worksPath) !== resolve(editionsPath), 'invalid-dump-input-paths');
  const selected = validateDumpTargets(snapshot);
  requireValue(selected.length > 0, 'missing-dump-targets');
  const directory = await claimOutput(stagingRoot, outputDirectory);
  const state = { ...plan, status: 'collecting', sources: {}, startedAt: new Date().toISOString() };
  const checkpoint = async () => {
    await jsonFile(join(directory, 'state.next.json'), state);
    await rename(join(directory, 'state.next.json'), join(directory, 'state.json'));
  };
  try {
    await checkpoint();
    await jsonFile(join(directory, 'targets.json'), snapshot);
    await jsonFile(join(directory, 'sources.json'), manifest);
    const budget = { bytes: 0 };
    const works = await scanDump(worksPath, manifest.sources.works, 'works', selected, manifest.retrievedAt, budget);
    state.sources.works = works.stats;
    await checkpoint();
    const editions = await scanDump(editionsPath, manifest.sources.editions, 'editions', selected, manifest.retrievedAt, budget);
    state.sources.editions = editions.stats;
    const records = selected.map(target => ({ itemId: target.itemId,
      work: works.records.get(target.itemId) ?? null, edition: editions.records.get(target.itemId) ?? null }));
    const coverage = { recordsFound: 0, recordsMissing: 0, eligibleTexts: 0, targetWithEligibleText: 0,
      descriptionStatuses: {} };
    const review = records.map(row => {
      const options = {};
      let eligible = false;
      for (const kind of ['edition', 'work']) {
        const record = row[kind];
        if (record) coverage.recordsFound += 1;
        else coverage.recordsMissing += 1;
        const status = record?.inspection.description.status ?? 'record-missing';
        coverage.descriptionStatuses[status] = (coverage.descriptionStatuses[status] ?? 0) + 1;
        if (status === 'eligible') { coverage.eligibleTexts += 1; eligible = true; }
        options[kind] = record ? { ...record.inspection, dump: record.dump,
          inspectionSha256: record.inspectionSha256 } : null;
      }
      if (eligible) coverage.targetWithEligibleText += 1;
      return { itemId: row.itemId, options, decision: { status: 'unreviewed', choice: null,
        textLanguage: null, rights: 'unreviewed', basis: null, attribution: null, permission: null } };
    });
    state.recordsFileSha256 = await jsonFile(join(directory, 'records.json'), { contract: INTAKE_CONTRACT, records });
    state.reviewFileSha256 = await jsonFile(join(directory, 'review.json'), { contract: INTAKE_CONTRACT,
      targetSnapshotSha256: plan.targetSnapshotSha256, sourceManifestSha256: plan.sourceManifestSha256,
      note: 'Technical candidates only; language, fallback choice and source-specific rights require review. This is not an apply packet.',
      candidates: review });
    Object.assign(state, { status: 'staged', coverage, stagedRecordBytes: budget.bytes,
      completedAt: new Date().toISOString() });
    await checkpoint();
    return { ...plan, status: 'staged', coverage, sources: state.sources,
      recordsFileSha256: state.recordsFileSha256, reviewFileSha256: state.reviewFileSha256 };
  } catch (error) {
    state.status = 'failed';
    state.failure = safeDumpError(error);
    await checkpoint();
    throw new Error(state.failure);
  }
}
