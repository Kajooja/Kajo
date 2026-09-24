#!/usr/bin/env node
// Runs only accepted-main code. The request branch may add one public data file.
import { execFile } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { acquireOpenLibraryDumps, safeAcquisitionError } from './acquire-open-library-dumps.mjs';
import { digest, requireValue, sha256 } from './open-library-descriptions.mjs';
import { FAILURE_CONTRACT, REQUEST_BRANCH, REQUEST_PATH, sealAcquisition, validateAcquisitionRequest } from './seal-dump-acquisition.mjs';

const exec = promisify(execFile);
export const WORKFLOW_FILE = 'catalog-book-dump-acquisition.yml';
const SHA = /^[0-9a-f]{40}$/;
const CODES = new Set(['acquisition-request-already-consumed', 'acquisition-unreviewed-source',
  'acquisition-request-tree-mismatch', 'acquisition-github-check-failed', 'acquisition-metadata-timeout',
  'acquisition-aborted', 'acquisition-transport-failed', 'acquisition-invalid-response',
  'dump-checksum-mismatch', 'dump-file-size-mismatch', 'dump-line-limit', 'dump-staging-limit']);
export const safePublicAcquisitionError = error => CODES.has(error?.message) ? error.message : 'acquisition-failed';

export function validateRequestCommit({ sourceHead, requestHead, parents, changes, request }) {
  validateAcquisitionRequest(request);
  requireValue(SHA.test(sourceHead) && SHA.test(requestHead) && request.sourceHead === sourceHead
    && parents === sourceHead, 'acquisition-unreviewed-source');
  requireValue(changes === `A\t${REQUEST_PATH}\n`, 'acquisition-request-tree-mismatch');
  return request;
}

export function validateRunBudget(document, runId) {
  requireValue(document && Number.isSafeInteger(document.total_count) && document.total_count >= 1
    && document.total_count <= 100 && Array.isArray(document.workflow_runs)
    && document.workflow_runs.length === document.total_count, 'acquisition-github-check-failed');
  requireValue(document.workflow_runs.every(run => String(run.id) === String(runId)
    && run.head_branch === REQUEST_BRANCH && run.run_attempt === 1), 'acquisition-request-already-consumed');
}

async function githubRunBudget(env, fetcher) {
  requireValue(typeof env.ACQUISITION_GITHUB_TOKEN === 'string' && env.ACQUISITION_GITHUB_TOKEN.length > 0,
    'acquisition-github-check-failed');
  const response = await fetcher(`https://api.github.com/repos/Kajooja/Kajo/actions/workflows/${WORKFLOW_FILE}/runs?branch=${encodeURIComponent(REQUEST_BRANCH)}&per_page=100`,
    { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.ACQUISITION_GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  requireValue(response.ok, 'acquisition-github-check-failed');
  const text = await response.text();
  requireValue(Buffer.byteLength(text) <= 2 * 1024 * 1024, 'acquisition-github-check-failed');
  validateRunBudget(JSON.parse(text), env.GITHUB_RUN_ID);
}

export async function guardedAcquisition({ env = process.env, git, fetcher = fetch,
  acquire = acquireOpenLibraryDumps, outputDirectory }) {
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'Kajooja/Kajo'
    && env.GITHUB_RUN_ATTEMPT === '1' && /^\d+$/.test(env.GITHUB_RUN_ID)
    && env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${REQUEST_BRANCH}`,
  'acquisition-request-already-consumed');
  const command = git ?? (async args => (await exec('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024,
    timeout: 60000 })).stdout);
  const sourceHead = (await command(['rev-parse', 'HEAD'])).trim();
  requireValue(SHA.test(sourceHead) && (await command(['rev-parse', 'refs/remotes/origin/main'])).trim() === sourceHead,
    'acquisition-unreviewed-source');
  await command(['fetch', '--no-tags', 'origin', `refs/heads/${REQUEST_BRANCH}`]);
  const requestHead = (await command(['rev-parse', 'FETCH_HEAD'])).trim();
  requireValue(SHA.test(requestHead) && requestHead === env.GITHUB_SHA,
    'acquisition-unreviewed-source');
  const parents = (await command(['show', '-s', '--format=%P', requestHead])).trim();
  const changes = await command(['diff', '--name-status', '--no-renames', sourceHead, requestHead]);
  const request = JSON.parse(await command(['show', `${requestHead}:${REQUEST_PATH}`]));
  validateRequestCommit({ sourceHead, requestHead, parents, changes, request });
  await githubRunBudget(env, fetcher);
  // The sole network source operation happens only after every source/budget gate.
  let collected, failure;
  try { collected = await acquire({ release: request.release, roster: request.roster, limits: request.limits }); }
  catch (error) {
    failure = safePublicAcquisitionError(error);
    collected = { contract: FAILURE_CONTRACT, status: 'failed', release: request.release,
      rosterSha256: digest(request.roster), limits: request.limits, code: safeAcquisitionError(error),
      accounting: error?.accounting ?? { unavailable: true } };
  }
  const sealed = sealAcquisition(collected, request);
  await mkdir(outputDirectory, { mode: 0o700 });
  const bytes = JSON.stringify(sealed) + '\n';
  await writeFile(join(outputDirectory, 'open-library-20260831.sealed.json'), bytes, { flag: 'wx', mode: 0o600 });
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'sealed=true\n');
  if (failure) throw new Error(failure);
  return { status: 'sealed', requestSha256: request.requestSha256, recipientFingerprint: request.recipientFingerprint,
    sourceHead, requestHead, artifactSha256: sha256(bytes), targets: request.roster.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputDirectory = process.argv[2];
  Promise.resolve().then(() => {
    requireValue(process.argv.length === 3 && typeof outputDirectory === 'string', 'invalid-acquisition-command');
    return guardedAcquisition({ outputDirectory });
  }).then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(JSON.stringify({ status: 'failed', code: safePublicAcquisitionError(error) }));
    process.exitCode = 1;
  });
}
