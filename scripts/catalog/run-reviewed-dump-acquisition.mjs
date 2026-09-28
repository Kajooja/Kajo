#!/usr/bin/env node
// A new, exact-size request; the earlier acquisition and diagnosis remain spent.
import { execFile } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { acquireReviewedOpenLibraryDumps, safeAcquisitionError } from './acquire-open-library-dumps.mjs';
import { digest, requireValue, sha256 } from './open-library-descriptions.mjs';
import { DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_PATH, FAILURE_CONTRACT, REQUEST_PATH,
  REVIEWED_PREVIOUS_DIAGNOSTIC, REVIEWED_REQUEST_BRANCH, REVIEWED_REQUEST_PATH,
  sealReviewedAcquisition, validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';

const exec = promisify(execFile);
export const REVIEWED_WORKFLOW_FILE = 'catalog-book-reviewed-acquisition.yml';
const SHA = /^[0-9a-f]{40}$/;

export function validateReviewedCommit({ sourceHead, requestHead, parents, changes, request, previousRequest, diagnosticRequest }) {
  validateReviewedAcquisitionRequest(request);
  requireValue(SHA.test(sourceHead) && SHA.test(requestHead) && request.sourceHead === sourceHead
    && parents === sourceHead, 'reviewed-acquisition-unreviewed-source');
  requireValue(changes === `A\t${REVIEWED_REQUEST_PATH}\n`, 'reviewed-acquisition-request-tree-mismatch');
  // The two predecessor objects come from fixed public Git commits, never from
  // the new request's tree. Their identities bind the existing roster/key.
  requireValue(previousRequest?.sourceHead === DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead
    && previousRequest.requestSha256 === DIAGNOSTIC_PREVIOUS_ACQUISITION.requestSha256
    && diagnosticRequest?.sourceHead === REVIEWED_PREVIOUS_DIAGNOSTIC.sourceHead
    && diagnosticRequest.requestSha256 === REVIEWED_PREVIOUS_DIAGNOSTIC.requestSha256
    && digest(previousRequest.roster) === digest(request.roster)
    && [previousRequest, diagnosticRequest].every(previous => previous.recipientFingerprint === request.recipientFingerprint
      && previous.recipientPublicKey === request.recipientPublicKey), 'reviewed-acquisition-predecessor-mismatch');
  return request;
}

export function validateReviewedRunBudget(document, runId) {
  requireValue(document && document.total_count === 1 && Array.isArray(document.workflow_runs)
    && document.workflow_runs.length === 1, 'reviewed-acquisition-request-consumed');
  const run = document.workflow_runs[0];
  requireValue(String(run.id) === String(runId) && run.head_branch === REVIEWED_REQUEST_BRANCH && run.run_attempt === 1,
    'reviewed-acquisition-request-consumed');
}

async function githubReviewedBudget(env, fetcher) {
  requireValue(typeof env.REVIEWED_GITHUB_TOKEN === 'string' && env.REVIEWED_GITHUB_TOKEN.length > 0,
    'reviewed-acquisition-github-check-failed');
  const response = await fetcher(`https://api.github.com/repos/Kajooja/Kajo/actions/workflows/${REVIEWED_WORKFLOW_FILE}/runs?branch=${encodeURIComponent(REVIEWED_REQUEST_BRANCH)}&per_page=100`,
    { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.REVIEWED_GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  requireValue(response.ok && response.body, 'reviewed-acquisition-github-check-failed');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    requireValue(bytes <= 2 * 1024 * 1024, 'reviewed-acquisition-github-check-failed');
    chunks.push(Buffer.from(chunk));
  }
  validateReviewedRunBudget(JSON.parse(Buffer.concat(chunks).toString('utf8')), env.GITHUB_RUN_ID);
}

export async function guardedReviewedAcquisition({ env = process.env, git, fetcher = fetch,
  acquire = acquireReviewedOpenLibraryDumps, outputDirectory }) {
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'Kajooja/Kajo'
    && env.GITHUB_RUN_ATTEMPT === '1' && /^\d+$/.test(env.GITHUB_RUN_ID)
    && env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${REVIEWED_REQUEST_BRANCH}`,
  'reviewed-acquisition-request-consumed');
  const command = git ?? (async args => (await exec('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024,
    timeout: 60000 })).stdout);
  const sourceHead = (await command(['rev-parse', 'HEAD'])).trim();
  requireValue(SHA.test(sourceHead) && (await command(['rev-parse', 'refs/remotes/origin/main'])).trim() === sourceHead,
    'reviewed-acquisition-unreviewed-source');
  await command(['fetch', '--no-tags', 'origin', `refs/heads/${REVIEWED_REQUEST_BRANCH}`]);
  const requestHead = (await command(['rev-parse', 'FETCH_HEAD'])).trim();
  requireValue(SHA.test(requestHead) && requestHead === env.GITHUB_SHA, 'reviewed-acquisition-unreviewed-source');
  const parents = (await command(['show', '-s', '--format=%P', requestHead])).trim();
  const changes = await command(['diff', '--name-status', '--no-renames', sourceHead, requestHead]);
  const request = JSON.parse(await command(['show', `${requestHead}:${REVIEWED_REQUEST_PATH}`]));
  await command(['fetch', '--no-tags', 'origin', DIAGNOSTIC_PREVIOUS_ACQUISITION.requestHead]);
  const previousRequest = JSON.parse(await command(['show', `${DIAGNOSTIC_PREVIOUS_ACQUISITION.requestHead}:${REQUEST_PATH}`]));
  await command(['fetch', '--no-tags', 'origin', REVIEWED_PREVIOUS_DIAGNOSTIC.requestHead]);
  const diagnosticRequest = JSON.parse(await command(['show', `${REVIEWED_PREVIOUS_DIAGNOSTIC.requestHead}:${DIAGNOSTIC_REQUEST_PATH}`]));
  validateReviewedCommit({ sourceHead, requestHead, parents, changes, request, previousRequest, diagnosticRequest });
  await githubReviewedBudget(env, fetcher);
  let collected, failed = false;
  try {
    collected = await acquire({ release: request.release, roster: request.roster,
      sourcePins: request.sourcePins, sourceEvidence: request.sourceEvidence, limits: request.limits });
  } catch (error) {
    failed = true;
    collected = { contract: FAILURE_CONTRACT, status: 'failed', release: request.release,
      rosterSha256: digest(request.roster), limits: request.limits, code: safeAcquisitionError(error),
      accounting: error?.accounting ?? { unavailable: true } };
  }
  const sealed = sealReviewedAcquisition(collected, request);
  await mkdir(outputDirectory, { mode: 0o700 });
  const bytes = JSON.stringify(sealed) + '\n';
  await writeFile(join(outputDirectory, 'open-library-reviewed-20260831.sealed.json'), bytes, { flag: 'wx', mode: 0o600 });
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'sealed=true\n');
  if (failed) throw new Error('reviewed-acquisition-failed');
  return { status: 'sealed', requestSha256: request.requestSha256, sourceHead, requestHead,
    artifactSha256: sha256(bytes), targets: request.roster.length, maximumMetadataRequests: 0,
    dumpFiles: 2, totalCompressedBytes: request.limits.totalCompressedBytes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => {
    requireValue(process.argv.length === 3, 'invalid-reviewed-acquisition-command');
    return guardedReviewedAcquisition({ outputDirectory: process.argv[2] });
  }).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'reviewed-acquisition-failed' }));
    process.exitCode = 1;
  });
}
