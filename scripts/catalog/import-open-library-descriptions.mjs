import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CONTRACT, PILOT, PILOT_ITEMS, amendDescriptionReview, buildDescriptionPacket, digest, inspectRecord,
  readBoundedResponse, requireValue, validateAcknowledgement, validateReview, validateReviewHistory, verifyDescriptionReadback } from './open-library-descriptions.mjs';

const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
const SAFE_ERROR = /^(?:provider-http-\d{3}|provider-(?:network|timeout|identity-mismatch|work-link-mismatch)|(?:invalid|missing|malformed|unreviewed|duplicate|unknown|preview|review|baseline|description|record|response|pilot|batch|run|fallback|packet|unsupported|unsafe|unexpected|write|no)-[a-z-]+)$/;
const safeError = error => error.code === 'EEXIST' ? 'run-already-exists'
  : error.code === 'ENOENT' ? 'missing-run-or-input-file'
    : SAFE_ERROR.test(error.message) ? error.message : 'unexpected-operation-failure';

// Every started request is checkpointed before transport. No retries, redirects,
// substitute candidates or automatic continuation after an incomplete response.
export async function collectDescriptions(state, positions, kind, { fetchImpl = fetch,
  checkpoint, clock = Date.now, delay = pause, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  requireValue(state.status === 'prepared' || state.status === 'starting', 'run-not-prepared');
  state.status = 'collecting';
  await checkpoint(state);
  try {
    for (const position of positions) {
      const candidate = PILOT_ITEMS.find(item => item.position === position);
      requireValue(candidate && ['edition', 'work'].includes(kind), 'invalid-request');
      requireValue(!state.attempts.some(attempt => attempt.position === position && attempt.kind === kind), 'duplicate-provider-attempt');
      requireValue(state.attempts.length < 20, 'pilot-budget-exhausted');
      const previous = state.attempts.at(-1)?.startedAt;
      if (previous) await delay(Math.max(0, 1100 - (clock() - Date.parse(previous))));
      const startedAt = new Date(clock()).toISOString();
      const attempt = { position, kind, startedAt, status: 'started' };
      state.attempts.push(attempt);
      await checkpoint(state);
      const key = kind === 'edition' ? `/books/${candidate.editionId}` : `/works/${candidate.workId}`;
      const controller = new AbortController();
      const timer = setTimer(() => controller.abort(), 15000);
      let raw;
      try {
        const response = await fetchImpl(`https://openlibrary.org${key}.json`, {
          redirect: 'manual', signal: controller.signal,
          headers: { Accept: 'application/json', 'User-Agent': 'Kajo-description-pilot/1.0 (https://github.com/Kajooja/Kajo)' },
        });
        if (response.status === 404) { raw = null; await response.body?.cancel(); }
        else {
          if (response.status !== 200) {
            await response.body?.cancel();
            throw new Error(`provider-http-${response.status}`);
          }
          if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) {
            await response.body?.cancel();
            throw new Error('invalid-provider-content-type');
          }
          raw = await readBoundedResponse(response, 1048576);
        }
      } catch (error) {
        if (controller.signal.aborted) throw new Error('provider-timeout');
        if (error instanceof TypeError) throw new Error('provider-network');
        throw error;
      } finally { clearTimer(timer); }
      const fetchedAt = new Date(clock()).toISOString();
      const inspected = inspectRecord(raw, candidate, kind, fetchedAt);
      state.records[position] ??= {};
      state.records[position][kind] = { raw, fetchedAt, inspectionSha256: digest(inspected) };
      attempt.status = inspected.status;
      await checkpoint(state);
    }
    state.status = 'prepared';
    await checkpoint(state);
  } catch (error) {
    state.status = 'failed';
    state.failure = safeError(error);
    await checkpoint(state);
    throw new Error(state.failure);
  }
}

export async function applyDescriptionBatch(state, batch, { fetchImpl = fetch, checkpoint, environment = process.env } = {}) {
  requireValue(state.status === 'reviewed' && [1, 2].includes(batch), 'run-not-reviewed');
  if (state.reviewHistory !== undefined || state.review?.amendment) validateReviewHistory(state);
  requireValue(!state.batches.some(row => row.batch === batch)
    && (batch === 1 || state.batches.some(row => row.batch === 1 && row.status === 'completed' && row.verification)), 'invalid-batch-order');
  const packet = buildDescriptionPacket(state.records, state.review.decisions, state.review.baseline);
  requireValue(digest(packet) === state.review.packetSha256, 'packet-hash-mismatch');
  const entries = packet.entries.filter(entry => Math.ceil(entry.position / 5) === batch)
    .map(({ position: _position, ...entry }) => entry);
  let url;
  try { url = new URL(environment.SUPABASE_URL); } catch { throw new Error('invalid-database-url'); }
  requireValue(url.protocol === 'https:' && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname)
    && url.pathname === '/' && !url.username && !url.password && !url.port && !url.search && !url.hash, 'unsafe-database-url');
  const key = environment.SUPABASE_SERVICE_ROLE_KEY;
  requireValue(typeof key === 'string' && key.length > 20, 'missing-database-credential');
  const attempt = { batch, status: 'started', packetSha256: state.review.packetSha256,
    itemIds: entries.map(entry => entry.expectedItemId), startedAt: new Date().toISOString() };
  state.batches.push(attempt);
  await checkpoint(state);
  try {
    if (entries.length) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetchImpl(new URL('/rest/v1/rpc/upsert_catalog_batch_v1', url), {
          method: 'POST', redirect: 'manual', signal: controller.signal,
          headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          // The top-level second argument is mandatory. Older servers reject it.
          body: JSON.stringify({ entries, refresh_mode: CONTRACT }),
        });
        if (response.status !== 200) { await response.body?.cancel(); throw new Error('unknown-write-outcome'); }
        const raw = await readBoundedResponse(response, 16384);
        const acknowledged = validateAcknowledgement(JSON.parse(raw), entries);
        Object.assign(attempt, acknowledged);
      } finally { clearTimeout(timer); }
    } else Object.assign(attempt, { updated: 0, unchanged: 0 });
    attempt.status = 'completed';
    attempt.completedAt = new Date().toISOString();
    await checkpoint(state);
  } catch {
    // Even a failed local acknowledgement checkpoint can follow a committed RPC.
    // Keep the attempt consumed and require exact ID/hash/version readback.
    attempt.status = 'unknown-write-outcome';
    state.status = 'failed';
    state.failure = 'unknown-write-outcome';
    await checkpoint(state);
    throw new Error('unknown-write-outcome');
  }
}

function summaries(state) {
  return { pilot: PILOT, status: state.status, providerAttempts: state.attempts.length,
    records: Object.entries(state.records).map(([position, records]) => ({ position: Number(position),
      ...Object.fromEntries(['edition', 'work'].filter(kind => records[kind]).map(kind => [kind,
        inspectRecord(records[kind].raw, PILOT_ITEMS[Number(position) - 1], kind, records[kind].fetchedAt)])) })),
    accepted: state.review?.packet.entries.length ?? 0, skipped: state.review?.packet.skipped.length ?? 0,
    batches: state.batches };
}

async function main() {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    run: { type: 'string' }, review: { type: 'string' }, baseline: { type: 'string' }, batch: { type: 'string' },
    amendment: { type: 'string' },
  } });
  requireValue(positionals.length === 1, 'invalid-command');
  const command = positionals[0];
  const allowed = { plan: [], preview: ['run'], fallback: ['run', 'review'], review: ['run', 'review', 'baseline'],
    'amend-review': ['run', 'amendment', 'baseline'], apply: ['run', 'batch'], verify: ['run', 'baseline'] };
  requireValue(Object.hasOwn(allowed, command) && Object.keys(values).every(key => allowed[command].includes(key))
    && allowed[command].every(key => values[key]), 'invalid-command-options');
  if (command === 'plan') {
    console.log(JSON.stringify({ contract: CONTRACT, pilot: PILOT, candidates: PILOT_ITEMS,
      limits: { providerAttempts: 20, concurrency: 1, spacingMs: 1100, timeoutMs: 15000, decodedRecordBytes: 1048576,
        retries: 0, redirects: 0, batches: 2, entriesPerBatch: 5, maximumWrites: 10 },
      order: ['preview exact Editions', 'review fallback selections, then fetch only their Works',
        'review actual text language/permission and fresh SQL baseline', 'apply batch 1, read back, then apply batch 2'] }, null, 2));
    return;
  }
  process.umask(0o077);
  const root = fileURLToPath(new URL('../../dist/catalog-enrichment/', import.meta.url));
  const directory = resolve(values.run);
  requireValue(directory.startsWith(root.endsWith(sep) ? root : root + sep), 'unsafe-run-directory');
  if (command === 'preview') {
    await mkdir(dirname(directory), { recursive: true, mode: 0o700 });
    // One frozen pilot, including concurrent starts in different run directories.
    // A failed/crashed attempt never automatically refunds this claim or budget.
    await writeFile(resolve(root, PILOT + '.json'), JSON.stringify({ directory, manifestSha256: digest(PILOT_ITEMS) }), { flag: 'wx', mode: 0o600 });
    await mkdir(directory, { mode: 0o700 });
  }
  const lock = resolve(directory, 'operation.lock');
  const handle = await open(lock, 'wx', 0o600);
  await handle.close();
  const statePath = resolve(directory, 'state.json');
  const checkpoint = async state => {
    const temporary = resolve(directory, 'state.next.json');
    await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    await rename(temporary, statePath);
  };
  try {
    const state = command === 'preview' ? { pilot: PILOT, manifestSha256: digest(PILOT_ITEMS), status: 'starting',
      records: {}, attempts: [], batches: [] } : JSON.parse(await readFile(statePath, 'utf8'));
    requireValue(state.pilot === PILOT && state.manifestSha256 === digest(PILOT_ITEMS), 'invalid-run-manifest');
    if (command === 'preview') await collectDescriptions(state, PILOT_ITEMS.map(item => item.position), 'edition', { checkpoint });
    if (command === 'fallback') {
      requireValue(state.status === 'prepared', 'run-not-prepared');
      const decisions = JSON.parse(await readFile(values.review, 'utf8'));
      requireValue(Array.isArray(decisions) && decisions.length > 0 && decisions.length <= 10
        && new Set(decisions.map(row => row.position)).size === decisions.length, 'invalid-fallback-list');
      for (const decision of decisions) {
        const candidate = PILOT_ITEMS.find(item => item.position === decision.position);
        const saved = state.records[decision.position];
        requireValue(candidate && saved?.edition && !saved.work && !saved.fallback, 'duplicate-or-invalid-fallback');
        const inspected = inspectRecord(saved.edition.raw, candidate, 'edition', saved.edition.fetchedAt);
        requireValue(digest(inspected) === saved.edition.inspectionSha256, 'preview-hash-mismatch');
        validateReview(decision, inspected, { fallback: true });
        saved.fallback = decision;
      }
      await collectDescriptions(state, decisions.map(row => row.position).sort((a, b) => a - b), 'work', { checkpoint });
    }
    if (command === 'review') {
      requireValue(state.status === 'prepared', 'run-not-prepared');
      const decisions = JSON.parse(await readFile(values.review, 'utf8'));
      const baseline = JSON.parse(await readFile(values.baseline, 'utf8'));
      const packet = buildDescriptionPacket(state.records, decisions, baseline);
      state.review = { decisions, baseline, packet, packetSha256: digest(packet), reviewedAt: new Date().toISOString() };
      state.status = 'reviewed';
      await checkpoint(state);
    }
    if (command === 'amend-review') {
      const amendment = JSON.parse(await readFile(values.amendment, 'utf8'));
      const baseline = JSON.parse(await readFile(values.baseline, 'utf8'));
      Object.assign(state, amendDescriptionReview(state, amendment, baseline));
      await checkpoint(state);
    }
    if (command === 'apply') await applyDescriptionBatch(state, Number(values.batch), { checkpoint });
    if (command === 'verify') {
      const readback = JSON.parse(await readFile(values.baseline, 'utf8'));
      try { verifyDescriptionReadback(state, readback); }
      catch (error) { state.status = 'failed'; state.failure = safeError(error); await checkpoint(state); throw error; }
      await checkpoint(state);
    }
    // Text previews are private artifacts; terminal output contains counts only.
    const summary = summaries(state);
    await writeFile(resolve(directory, 'preview.json'), JSON.stringify(summary, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ status: state.status, providerAttempts: state.attempts.length,
      accepted: summary.accepted, skipped: summary.skipped, batches: state.batches }));
  } finally { await unlink(lock); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(JSON.stringify({ status: 'error', code: safeError(error) })); process.exitCode = 1; });
}
