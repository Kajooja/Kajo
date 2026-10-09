// Ephemeral owner audit only: no providers, database access or model admission.
import { constants } from 'node:fs';
import { lstat, open, realpath, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_PAIRS = 256;
const SELECTION = 'OWNER_DECLARED_NONOVERLAPPING_PAIRS';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export class OrdinalReportError extends Error {
  constructor(code) { super(`ORDINAL_REPORT_${code}`); this.code = code; }
}
const reject = code => { throw new OrdinalReportError(code); };

// POSIX permissions/no-follow flags are required for private owner audit files.
// The portable evaluator itself does not depend on this filesystem boundary.
export function assertOrdinalReportPlatform(platform = process.platform) {
  if (!['linux', 'darwin'].includes(platform) || !Number.isInteger(constants.O_NOFOLLOW)
    || constants.O_NOFOLLOW <= 0 || !Number.isInteger(constants.O_NONBLOCK) || constants.O_NONBLOCK <= 0) reject('PLATFORM');
}

async function readManifest(path) {
  let handle;
  try {
    handle = await open(resolve(path), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile()) reject('INPUT_FILE');
    if (stat.size > MAX_INPUT_BYTES) reject('INPUT_TOO_LARGE');
    const bytes = Buffer.alloc(MAX_INPUT_BYTES + 1);
    let length = 0;
    while (true) {
      if (length > MAX_INPUT_BYTES) reject('INPUT_TOO_LARGE');
      const read = await handle.read(bytes, length, Math.min(64 * 1024, bytes.length - length), null);
      if (read.bytesRead === 0) break;
      length += read.bytesRead;
    }
    let manifest;
    try { manifest = JSON.parse(bytes.subarray(0, length).toString('utf8')); }
    catch { reject('MANIFEST_INVALID'); }
    return manifest;
  } catch (error) {
    if (error instanceof OrdinalReportError) throw error;
    reject('INPUT_FILE');
  } finally { await handle?.close().catch(() => {}); }
}

function validateManifest(value) {
  const keys = ['contractVersion', 'selectionBasis', 'evaluationAsOf', 'pairs'];
  if (!record(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || value.contractVersion !== 'kajo-shared-ordinal-manifest-v1' || value.selectionBasis !== SELECTION
    || typeof value.evaluationAsOf !== 'number' || !Number.isFinite(value.evaluationAsOf)
    || value.evaluationAsOf < 0 || value.evaluationAsOf > Number.MAX_SAFE_INTEGER
    || !Array.isArray(value.pairs) || value.pairs.length > MAX_PAIRS) reject('MANIFEST_INVALID');
  const required = ['pairId', 'leftComparison', 'rightComparison', 'anchor', 'references'];
  const pairIds = new Set();
  for (const pair of value.pairs) {
    if (!record(pair) || required.some(key => !Object.hasOwn(pair, key))
      || Object.keys(pair).some(key => !required.includes(key) && key !== 'evaluationAsOf')
      || typeof pair.pairId !== 'string' || pair.pairId.length === 0 || pair.pairId.length > 128
      || (Object.hasOwn(pair, 'evaluationAsOf') && pair.evaluationAsOf !== value.evaluationAsOf)) reject('MANIFEST_INVALID');
    if (pairIds.has(pair.pairId)) reject('PAIRS_OVERLAP');
    pairIds.add(pair.pairId);
  }
}

async function reportPath(path) {
  // Real parent traversal also catches symlink aliases into a repository and
  // .git files used by worktrees. Parent directories must already exist.
  const requested = resolve(path);
  let parent;
  try {
    parent = await realpath(dirname(requested));
    let ancestor = parent;
    while (true) {
      try { await lstat(join(ancestor, '.git')); reject('OUTPUT_LOCATION'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      // Bare repositories have HEAD/objects/refs at their root, without .git.
      // Reject present markers conservatively, including shared/symlink layouts.
      try {
        await lstat(join(ancestor, 'HEAD'));
        await lstat(join(ancestor, 'objects'));
        await lstat(join(ancestor, 'refs'));
        reject('OUTPUT_LOCATION');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const next = dirname(ancestor);
      if (next === ancestor) break;
      ancestor = next;
    }
  } catch (error) {
    if (error instanceof OrdinalReportError) throw error;
    reject('OUTPUT_LOCATION');
  }
  return join(parent, basename(requested));
}

async function writeReport(path, report) {
  let handle, identity, created = false;
  try {
    handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    created = true;
    identity = await handle.stat();
    await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
  } catch (error) {
    // An initial fstat failure may recover. Without an fd identity, never unlink
    // a possibly replaced pathname; report cleanup uncertainty explicitly. No
    // report bytes are written before this identity is established.
    if (created && !identity) {
      try { identity = await handle.stat(); } catch { /* fail closed below */ }
    }
    await handle?.close().catch(() => {});
    if (created) {
      if (!identity) reject('OUTPUT_CLEANUP');
      // Never unlink a preexisting output or a replacement with another inode.
      try {
        const current = await lstat(path);
        if (current.dev !== identity.dev || current.ino !== identity.ino) reject('OUTPUT_CLEANUP');
        await unlink(path);
      } catch (cleanupError) { if (cleanupError.code !== 'ENOENT') reject('OUTPUT_CLEANUP'); }
    }
    reject(error.code === 'EEXIST' && !created ? 'OUTPUT_EXISTS' : 'OUTPUT_WRITE');
  }
}

export async function runOrdinalReport(inputPath, outputPath) {
  assertOrdinalReportPlatform();
  if (typeof inputPath !== 'string' || !inputPath || typeof outputPath !== 'string' || !outputPath) reject('ARGUMENTS');
  const destination = await reportPath(outputPath);
  const manifest = await readManifest(inputPath);
  validateManifest(manifest);
  let normalizeKajoOrdinalPair, evaluateOrdinalBatch;
  try {
    ({ normalizeKajoOrdinalPair } = await import('@kajo/prediction-engine/adapters/kajo-ordinal'));
    ({ evaluateOrdinalBatch } = await import('@kajo/prediction-engine/ordinal'));
  } catch { reject('ENGINE_UNAVAILABLE'); }
  let pairs;
  try { pairs = manifest.pairs.map(pair => normalizeKajoOrdinalPair({ ...pair, evaluationAsOf: manifest.evaluationAsOf })); }
  catch { reject('SNAPSHOT_REJECTED'); }
  // Scoped aliases cannot disguise repeated native object pairs in one Profile.
  const nativePairs = new Set();
  for (const pair of manifest.pairs) {
    const left = pair.leftComparison.capturedOutcome.round;
    const right = pair.rightComparison.capturedOutcome.round;
    const key = JSON.stringify([left.profileId, ...[left.itemId, right.itemId].sort()]);
    if (nativePairs.has(key)) reject('PAIRS_OVERLAP');
    nativePairs.add(key);
  }
  let result;
  try { result = evaluateOrdinalBatch(pairs); }
  catch { reject('PAIRS_OVERLAP'); }
  const report = { contractVersion: 'kajo-shared-ordinal-report-v1', selectionBasis: SELECTION,
    sampleInterpretation: 'CONDITIONAL_ON_PRODUCTION_EXPOSURE', selectionWasProspective: 'NOT_ESTABLISHED',
    evaluationAsOf: manifest.evaluationAsOf, result };
  await writeReport(destination, report);
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.argv.length !== 4) reject('ARGUMENTS');
    await runOrdinalReport(process.argv[2], process.argv[3]);
    process.stdout.write('ORDINAL_REPORT_CREATED\n');
  } catch (error) {
    process.stderr.write(`${error instanceof OrdinalReportError ? error.message : 'ORDINAL_REPORT_FAILED'}\n`);
    process.exitCode = 1;
  }
}
