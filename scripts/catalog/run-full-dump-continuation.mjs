#!/usr/bin/env node
// One new full collection after the accepted guard correction. Older ledgers stay spent.
import { execFile } from 'node:child_process';
import { appendFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { acquireReviewedOpenLibraryDumps, safeAcquisitionError } from './acquire-open-library-dumps.mjs';
import { digest, requireValue, sha256 } from './open-library-descriptions.mjs';
import { DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_PATH, FAILURE_CONTRACT,
  REQUEST_PATH, REVIEWED_PREVIOUS_DIAGNOSTIC, REVIEWED_REQUEST_PATH } from './seal-dump-acquisition.mjs';
import { WORK_PREFIX_REQUEST_PATH } from './seal-work-prefix-diagnostic.mjs';
import { FULL_CONTINUATION_CORRECTION_HEAD, FULL_CONTINUATION_PREVIOUS_PREFIX,
  FULL_CONTINUATION_PREVIOUS_REVIEWED, FULL_CONTINUATION_REQUEST_BRANCH, FULL_CONTINUATION_REQUEST_PATH,
  sealFullDumpContinuation, validateFullDumpContinuationPredecessors,
  validateFullDumpContinuationRequest } from './seal-full-dump-continuation.mjs';

export const FULL_CONTINUATION_WORKFLOW_FILE = 'catalog-book-full-continuation.yml';
export const FULL_CONTINUATION_ARTIFACT_FILE = 'open-library-continuation-20260831.sealed.json';
const exec = promisify(execFile), SHA = /^[0-9a-f]{40}$/;

export function validateFullContinuationCommit({ sourceHead, requestHead, parents, changes, request,
  reviewedRequest, prefixRequest, originalRequest, diagnosticRequest }) {
  validateFullDumpContinuationRequest(request);
  requireValue(SHA.test(sourceHead) && SHA.test(requestHead) && request.sourceHead === sourceHead
    && parents === sourceHead, 'full-continuation-unreviewed-source');
  requireValue(changes === `A\t${FULL_CONTINUATION_REQUEST_PATH}\n`, 'full-continuation-request-tree-mismatch');
  requireValue(originalRequest && diagnosticRequest, 'full-continuation-predecessor-mismatch');
  validateFullDumpContinuationPredecessors(request, { reviewedRequest, prefixRequest, originalRequest, diagnosticRequest });
  return request;
}

export function validateFullContinuationRunBudget(document, runId, requestHead) {
  requireValue(document && document.total_count === 1 && Array.isArray(document.workflow_runs)
    && document.workflow_runs.length === 1, 'full-continuation-request-consumed');
  const run = document.workflow_runs[0];
  requireValue(String(run.id) === String(runId) && run.head_branch === FULL_CONTINUATION_REQUEST_BRANCH
    && run.run_attempt === 1 && run.event === 'push' && SHA.test(requestHead) && run.head_sha === requestHead,
  'full-continuation-request-consumed');
}

async function githubBudget(env, fetcher, requestHead) {
  requireValue(typeof env.FULL_CONTINUATION_GITHUB_TOKEN === 'string' && env.FULL_CONTINUATION_GITHUB_TOKEN.length > 0,
    'full-continuation-github-check-failed');
  const response = await fetcher(`https://api.github.com/repos/Kajooja/Kajo/actions/workflows/${FULL_CONTINUATION_WORKFLOW_FILE}/runs?branch=${encodeURIComponent(FULL_CONTINUATION_REQUEST_BRANCH)}&per_page=100`,
    { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.FULL_CONTINUATION_GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  requireValue(response.ok && response.body, 'full-continuation-github-check-failed');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    requireValue(bytes <= 2 * 1024 * 1024, 'full-continuation-github-check-failed');
    chunks.push(Buffer.from(chunk));
  }
  validateFullContinuationRunBudget(JSON.parse(Buffer.concat(chunks).toString('utf8')), env.GITHUB_RUN_ID, requestHead);
}

async function requireAbsentOutput(outputDirectory) {
  requireValue(typeof outputDirectory === 'string' && outputDirectory.length > 0, 'full-continuation-invalid-output');
  // Reject a file, directory or dangling symlink before even Git/GitHub network
  // access. The later exclusive mkdir also closes the race before provider I/O.
  try { await lstat(outputDirectory); }
  catch (error) { if (error?.code === 'ENOENT') return; throw error; }
  throw new Error('full-continuation-output-exists');
}

export async function guardedFullDumpContinuation({ env = process.env, git, fetcher = fetch,
  acquire = acquireReviewedOpenLibraryDumps, outputDirectory }) {
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'Kajooja/Kajo'
    && env.GITHUB_RUN_ATTEMPT === '1' && /^\d+$/.test(env.GITHUB_RUN_ID)
    && env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${FULL_CONTINUATION_REQUEST_BRANCH}`,
  'full-continuation-request-consumed');
  await requireAbsentOutput(outputDirectory);
  const command = git ?? (async args => (await exec('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024,
    timeout: 60000 })).stdout);
  const sourceHead = (await command(['rev-parse', 'HEAD'])).trim();
  requireValue(SHA.test(sourceHead), 'full-continuation-unreviewed-source');
  // Accepted-main ancestry does not excuse a changed local parser or workflow.
  requireValue((await command(['status', '--porcelain', '--untracked-files=all'])).trim() === '',
    'full-continuation-dirty-source');
  await command(['fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main']);
  requireValue((await command(['rev-parse', 'refs/remotes/origin/main'])).trim() === sourceHead,
    'full-continuation-unreviewed-source');
  try { await command(['merge-base', '--is-ancestor', FULL_CONTINUATION_CORRECTION_HEAD, sourceHead]); }
  catch { throw new Error('full-continuation-correction-missing'); }
  await command(['fetch', '--no-tags', 'origin', `refs/heads/${FULL_CONTINUATION_REQUEST_BRANCH}`]);
  const requestHead = (await command(['rev-parse', 'FETCH_HEAD'])).trim();
  requireValue(SHA.test(requestHead) && requestHead === env.GITHUB_SHA, 'full-continuation-unreviewed-source');
  const parents = (await command(['show', '-s', '--format=%P', requestHead])).trim();
  const changes = await command(['diff', '--name-status', '--no-renames', sourceHead, requestHead]);
  const request = JSON.parse(await command(['show', `${requestHead}:${FULL_CONTINUATION_REQUEST_PATH}`]));
  const predecessors = {};
  for (const [name, identity, path] of [
    ['reviewedRequest', FULL_CONTINUATION_PREVIOUS_REVIEWED, REVIEWED_REQUEST_PATH],
    ['prefixRequest', FULL_CONTINUATION_PREVIOUS_PREFIX, WORK_PREFIX_REQUEST_PATH],
    ['originalRequest', DIAGNOSTIC_PREVIOUS_ACQUISITION, REQUEST_PATH],
    ['diagnosticRequest', REVIEWED_PREVIOUS_DIAGNOSTIC, DIAGNOSTIC_REQUEST_PATH],
  ]) {
    await command(['fetch', '--no-tags', 'origin', identity.requestHead]);
    predecessors[name] = JSON.parse(await command(['show', `${identity.requestHead}:${path}`]));
  }
  validateFullContinuationCommit({ sourceHead, requestHead, parents, changes, request, ...predecessors });
  await githubBudget(env, fetcher, requestHead);
  // Claim a brand-new, private directory before opening either source. A failed
  // claim cannot spend the provider budget or replace a previous ciphertext.
  await mkdir(outputDirectory, { mode: 0o700 });
  let collected, failed = false;
  try {
    collected = await acquire({ release: request.release, roster: request.roster, sourcePins: request.sourcePins,
      sourceEvidence: request.sourceEvidence, limits: request.limits });
  } catch (error) {
    failed = true;
    collected = { contract: FAILURE_CONTRACT, status: 'failed', release: request.release,
      rosterSha256: digest(request.roster), limits: request.limits, code: safeAcquisitionError(error),
      accounting: error?.accounting ?? { unavailable: true } };
  }
  // Invalid or missing accounting fails sealed validation; never fabricate zero
  // network use. All public errors below deliberately omit provider diagnostics.
  let sealed;
  try { sealed = sealFullDumpContinuation(collected, request); }
  catch { throw new Error('full-continuation-failed'); }
  const bytes = JSON.stringify(sealed) + '\n';
  await writeFile(join(outputDirectory, FULL_CONTINUATION_ARTIFACT_FILE), bytes, { flag: 'wx', mode: 0o600 });
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'sealed=true\n');
  if (failed || collected.status === 'failed') throw new Error('full-continuation-failed');
  return { status: 'sealed', requestSha256: request.requestSha256, sourceHead, requestHead,
    artifactSha256: sha256(bytes), targets: request.roster.length, maximumMetadataRequests: 0,
    dumpFiles: 2, maximumAcceptedCompressedBytes: request.limits.totalCompressedBytes, approved: 0, databaseWrites: 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => {
    requireValue(process.argv.length === 3, 'invalid-full-continuation-command');
    return guardedFullDumpContinuation({ outputDirectory: process.argv[2] });
  }).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'full-continuation-failed' })); process.exitCode = 1;
  });
}
