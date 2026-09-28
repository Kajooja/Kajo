#!/usr/bin/env node
// One distinct conflict-aware collection; all five predecessor ledgers stay spent.
import { execFile } from 'node:child_process';
import { appendFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { acquireConflictAwareOpenLibraryDumps } from './acquire-open-library-dumps.mjs';
import { requireValue, sha256 } from './open-library-descriptions.mjs';
import { DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_PATH,
  REQUEST_PATH, REVIEWED_PREVIOUS_DIAGNOSTIC, REVIEWED_REQUEST_PATH } from './seal-dump-acquisition.mjs';
import { WORK_PREFIX_REQUEST_PATH } from './seal-work-prefix-diagnostic.mjs';
import { FULL_CONTINUATION_PREVIOUS_PREFIX, FULL_CONTINUATION_PREVIOUS_REVIEWED,
  FULL_CONTINUATION_REQUEST_PATH, validateFullDumpContinuationPredecessors } from './seal-full-dump-continuation.mjs';
import { CONFLICT_CORE_SOURCE_HEAD, CONFLICT_POLICY_SOURCE_HEAD, CONFLICT_PREVIOUS_CONTINUATION,
  CONFLICT_REQUEST_BRANCH, CONFLICT_REQUEST_PATH, sealConflictDumpAcquisition,
  validateConflictDumpAcquisitionPredecessor, validateConflictDumpAcquisitionRequest } from './seal-conflict-dump-acquisition.mjs';

export const CONFLICT_WORKFLOW_FILE = 'catalog-book-conflict-acquisition.yml';
export const CONFLICT_ARTIFACT_FILE = 'open-library-conflicts-20260831.sealed.json';
const exec = promisify(execFile), SHA = /^[0-9a-f]{40}$/;
const gitHash = value => typeof value === 'string' && SHA.test(value);

export function validateConflictAcquisitionCommit({ sourceHead, requestHead, parents, changes, request,
  reviewedRequest, prefixRequest, originalRequest, diagnosticRequest, previousContinuation }) {
  validateConflictDumpAcquisitionRequest(request);
  requireValue(gitHash(sourceHead) && gitHash(requestHead) && request.sourceHead === sourceHead
    && parents === sourceHead, 'conflict-acquisition-unreviewed-source');
  requireValue(changes === `A\t${CONFLICT_REQUEST_PATH}\n`, 'conflict-acquisition-request-tree-mismatch');
  requireValue(originalRequest && diagnosticRequest, 'conflict-acquisition-predecessor-mismatch');
  validateConflictDumpAcquisitionPredecessor(request, previousContinuation);
  validateFullDumpContinuationPredecessors(previousContinuation, { reviewedRequest, prefixRequest, originalRequest, diagnosticRequest });
  return request;
}

export function validateConflictAcquisitionRunBudget(document, runId, requestHead) {
  requireValue(document && document.total_count === 1 && Array.isArray(document.workflow_runs)
    && document.workflow_runs.length === 1, 'conflict-acquisition-request-consumed');
  const run = document.workflow_runs[0];
  requireValue(String(run.id) === String(runId) && run.head_branch === CONFLICT_REQUEST_BRANCH
    && run.run_attempt === 1 && run.event === 'push' && gitHash(requestHead) && run.head_sha === requestHead,
  'conflict-acquisition-request-consumed');
}

async function githubBudget(env, fetcher, requestHead) {
  requireValue(typeof env.CONFLICT_ACQUISITION_GITHUB_TOKEN === 'string' && env.CONFLICT_ACQUISITION_GITHUB_TOKEN.length > 0,
    'conflict-acquisition-github-check-failed');
  const response = await fetcher(`https://api.github.com/repos/Kajooja/Kajo/actions/workflows/${CONFLICT_WORKFLOW_FILE}/runs?branch=${encodeURIComponent(CONFLICT_REQUEST_BRANCH)}&per_page=100`,
    { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.CONFLICT_ACQUISITION_GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  requireValue(response.ok && response.body, 'conflict-acquisition-github-check-failed');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    requireValue(bytes <= 2 * 1024 * 1024, 'conflict-acquisition-github-check-failed');
    chunks.push(Buffer.from(chunk));
  }
  validateConflictAcquisitionRunBudget(JSON.parse(Buffer.concat(chunks).toString('utf8')), env.GITHUB_RUN_ID, requestHead);
}

async function requireAbsentOutput(outputDirectory) {
  requireValue(typeof outputDirectory === 'string' && outputDirectory.length > 0, 'conflict-acquisition-invalid-output');
  for (let parent = dirname(resolve(outputDirectory)); parent !== dirname(parent); parent = dirname(parent)) {
    const info = await lstat(parent);
    requireValue(info.isDirectory() && !info.isSymbolicLink(), 'conflict-acquisition-unsafe-output-parent');
  }
  // Reject a file, directory or dangling symlink before even Git/GitHub network
  // access. The later exclusive mkdir also closes the race before provider I/O.
  try { await lstat(outputDirectory); }
  catch (error) { if (error?.code === 'ENOENT') return; throw error; }
  throw new Error('conflict-acquisition-output-exists');
}

export async function guardedConflictDumpAcquisition({ env = process.env, git, fetcher = fetch,
  acquire = acquireConflictAwareOpenLibraryDumps, outputDirectory }) {
  env = { ...env };
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'Kajooja/Kajo'
    && env.GITHUB_RUN_ATTEMPT === '1' && /^\d+$/.test(env.GITHUB_RUN_ID)
    && env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${CONFLICT_REQUEST_BRANCH}`,
  'conflict-acquisition-request-consumed');
  await requireAbsentOutput(outputDirectory);
  const command = git ?? (async args => (await exec('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024,
    timeout: 60000, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } })).stdout);
  const sourceHead = (await command(['rev-parse', 'HEAD'])).trim();
  requireValue(gitHash(sourceHead), 'conflict-acquisition-unreviewed-source');
  // Accepted-main ancestry does not excuse a changed local parser or workflow.
  requireValue((await command(['status', '--porcelain', '--untracked-files=all'])).trim() === '',
    'conflict-acquisition-dirty-source');
  await command(['fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main']);
  requireValue((await command(['rev-parse', 'refs/remotes/origin/main'])).trim() === sourceHead,
    'conflict-acquisition-unreviewed-source');
  try {
    for (const accepted of [CONFLICT_POLICY_SOURCE_HEAD, CONFLICT_CORE_SOURCE_HEAD])
      await command(['merge-base', '--is-ancestor', accepted, sourceHead]);
  }
  catch { throw new Error('conflict-acquisition-correction-missing'); }
  await command(['fetch', '--no-tags', 'origin', `refs/heads/${CONFLICT_REQUEST_BRANCH}`]);
  const requestHead = (await command(['rev-parse', 'FETCH_HEAD'])).trim();
  requireValue(gitHash(requestHead) && requestHead === env.GITHUB_SHA, 'conflict-acquisition-unreviewed-source');
  const parents = (await command(['show', '-s', '--format=%P', requestHead])).trim();
  const changes = await command(['diff', '--name-status', '--no-renames', sourceHead, requestHead]);
  const request = JSON.parse(await command(['show', `${requestHead}:${CONFLICT_REQUEST_PATH}`]));
  const predecessors = {};
  for (const [name, identity, path] of [
    ['previousContinuation', CONFLICT_PREVIOUS_CONTINUATION, FULL_CONTINUATION_REQUEST_PATH],
    ['reviewedRequest', FULL_CONTINUATION_PREVIOUS_REVIEWED, REVIEWED_REQUEST_PATH],
    ['prefixRequest', FULL_CONTINUATION_PREVIOUS_PREFIX, WORK_PREFIX_REQUEST_PATH],
    ['originalRequest', DIAGNOSTIC_PREVIOUS_ACQUISITION, REQUEST_PATH],
    ['diagnosticRequest', REVIEWED_PREVIOUS_DIAGNOSTIC, DIAGNOSTIC_REQUEST_PATH],
  ]) {
    await command(['fetch', '--no-tags', 'origin', identity.requestHead]);
    predecessors[name] = JSON.parse(await command(['show', `${identity.requestHead}:${path}`]));
  }
  validateConflictAcquisitionCommit({ sourceHead, requestHead, parents, changes, request, ...predecessors });
  await githubBudget(env, fetcher, requestHead);
  // Claim a brand-new, private directory before opening either source. A failed
  // claim cannot spend the provider budget or replace a previous ciphertext.
  await mkdir(outputDirectory, { mode: 0o700 });
  let collected, sealed;
  try {
    collected = await acquire(structuredClone({ release: request.release, roster: request.roster,
      sourcePins: request.sourcePins, sourceEvidence: request.sourceEvidence, limits: request.limits,
      conflictPolicy: request.conflictPolicy }));
    // The core returns an independently validated failure payload with truthful
    // accounting. An unexpected exception cannot fabricate an encrypted result.
    sealed = sealConflictDumpAcquisition(collected, request);
  } catch { throw new Error('conflict-acquisition-failed'); }
  const bytes = JSON.stringify(sealed) + '\n';
  await writeFile(join(outputDirectory, CONFLICT_ARTIFACT_FILE), bytes, { flag: 'wx', mode: 0o600 });
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'sealed=true\n');
  if (collected.status === 'failed') throw new Error('conflict-acquisition-failed');
  return { status: 'sealed', requestSha256: request.requestSha256, sourceHead, requestHead,
    artifactSha256: sha256(bytes), targets: request.roster.length, maximumMetadataRequests: 0,
    dumpFiles: 2, maximumAcceptedCompressedBytes: request.limits.totalCompressedBytes, approved: 0, databaseWrites: 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => {
    requireValue(process.argv.length === 3, 'invalid-conflict-acquisition-command');
    return guardedConflictDumpAcquisition({ outputDirectory: process.argv[2] });
  }).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'conflict-acquisition-failed' })); process.exitCode = 1;
  });
}
