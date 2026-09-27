#!/usr/bin/env node
// Accepted source + one new public request; all older requests remain consumed.
import { execFile } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { inspectWorkDumpPrefix } from './inspect-work-dump-prefix.mjs';
import { digest, requireValue, sha256 } from './open-library-descriptions.mjs';
import { REVIEWED_REQUEST_PATH, validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';
import { WORK_PREFIX_BRANCH, WORK_PREFIX_PREVIOUS_ACQUISITION, WORK_PREFIX_REQUEST_PATH,
  sealWorkPrefixDiagnostic, validateWorkPrefixRequest } from './seal-work-prefix-diagnostic.mjs';

export const WORK_PREFIX_WORKFLOW_FILE = 'catalog-book-work-prefix-diagnostic.yml';
export const WORK_PREFIX_ARTIFACT_FILE = 'open-library-work-prefix-20260831.sealed.json';
const exec = promisify(execFile), SHA = /^[0-9a-f]{40}$/;

export function validateWorkPrefixCommit({ sourceHead, requestHead, parents, changes, request, previousRequest }) {
  validateWorkPrefixRequest(request);
  validateReviewedAcquisitionRequest(previousRequest);
  requireValue(SHA.test(sourceHead) && SHA.test(requestHead) && request.sourceHead === sourceHead
    && parents === sourceHead, 'work-prefix-unreviewed-source');
  requireValue(changes === `A\t${WORK_PREFIX_REQUEST_PATH}\n`, 'work-prefix-request-tree-mismatch');
  requireValue(previousRequest.sourceHead === WORK_PREFIX_PREVIOUS_ACQUISITION.sourceHead
    && previousRequest.requestSha256 === WORK_PREFIX_PREVIOUS_ACQUISITION.requestSha256
    && digest(previousRequest.roster) === digest(request.roster)
    && previousRequest.recipientPublicKey === request.recipientPublicKey
    && previousRequest.recipientFingerprint === request.recipientFingerprint, 'work-prefix-predecessor-mismatch');
  return request;
}

export function validateWorkPrefixRunBudget(document, runId) {
  requireValue(document && document.total_count === 1 && Array.isArray(document.workflow_runs)
    && document.workflow_runs.length === 1, 'work-prefix-request-consumed');
  const run = document.workflow_runs[0];
  requireValue(String(run.id) === String(runId) && run.head_branch === WORK_PREFIX_BRANCH && run.run_attempt === 1,
    'work-prefix-request-consumed');
}

async function githubBudget(env, fetcher) {
  requireValue(typeof env.WORK_PREFIX_GITHUB_TOKEN === 'string' && env.WORK_PREFIX_GITHUB_TOKEN.length > 0,
    'work-prefix-github-check-failed');
  const response = await fetcher(`https://api.github.com/repos/Kajooja/Kajo/actions/workflows/${WORK_PREFIX_WORKFLOW_FILE}/runs?branch=${encodeURIComponent(WORK_PREFIX_BRANCH)}&per_page=100`,
    { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.WORK_PREFIX_GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  requireValue(response.ok && response.body, 'work-prefix-github-check-failed');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    requireValue(bytes <= 2 * 1024 * 1024, 'work-prefix-github-check-failed');
    chunks.push(Buffer.from(chunk));
  }
  validateWorkPrefixRunBudget(JSON.parse(Buffer.concat(chunks).toString('utf8')), env.GITHUB_RUN_ID);
}

export async function guardedWorkPrefixDiagnostic({ env = process.env, git, fetcher = fetch,
  inspect = inspectWorkDumpPrefix, outputDirectory }) {
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'Kajooja/Kajo'
    && env.GITHUB_RUN_ATTEMPT === '1' && /^\d+$/.test(env.GITHUB_RUN_ID)
    && env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${WORK_PREFIX_BRANCH}`,
  'work-prefix-request-consumed');
  const command = git ?? (async args => (await exec('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024, timeout: 60000 })).stdout);
  const sourceHead = (await command(['rev-parse', 'HEAD'])).trim();
  requireValue(SHA.test(sourceHead) && (await command(['rev-parse', 'refs/remotes/origin/main'])).trim() === sourceHead,
    'work-prefix-unreviewed-source');
  await command(['fetch', '--no-tags', 'origin', `refs/heads/${WORK_PREFIX_BRANCH}`]);
  const requestHead = (await command(['rev-parse', 'FETCH_HEAD'])).trim();
  requireValue(SHA.test(requestHead) && requestHead === env.GITHUB_SHA, 'work-prefix-unreviewed-source');
  const parents = (await command(['show', '-s', '--format=%P', requestHead])).trim();
  const changes = await command(['diff', '--name-status', '--no-renames', sourceHead, requestHead]);
  const request = JSON.parse(await command(['show', `${requestHead}:${WORK_PREFIX_REQUEST_PATH}`]));
  await command(['fetch', '--no-tags', 'origin', WORK_PREFIX_PREVIOUS_ACQUISITION.requestHead]);
  const previousRequest = JSON.parse(await command(['show', `${WORK_PREFIX_PREVIOUS_ACQUISITION.requestHead}:${REVIEWED_REQUEST_PATH}`]));
  validateWorkPrefixCommit({ sourceHead, requestHead, parents, changes, request, previousRequest });
  await githubBudget(env, fetcher);
  // Claim output before source access; no existing encrypted result is replaced.
  await mkdir(outputDirectory, { mode: 0o700 });
  let result;
  try { result = await inspect({ release: request.release, roster: request.roster, sourcePin: request.sourcePin,
    range: request.range, limits: request.limits }); }
  catch { throw new Error('work-prefix-diagnostic-failed'); }
  const sealed = sealWorkPrefixDiagnostic(result, request);
  const bytes = JSON.stringify(sealed) + '\n';
  await writeFile(join(outputDirectory, WORK_PREFIX_ARTIFACT_FILE), bytes, { flag: 'wx', mode: 0o600 });
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'sealed=true\n');
  if (result.status === 'failed') throw new Error('work-prefix-diagnostic-failed');
  return { status: 'sealed', requestSha256: request.requestSha256, sourceHead, requestHead,
    artifactSha256: sha256(bytes), maximumCompressedBytes: request.limits.compressedBytes,
    maximumMetadataRequests: 0, maximumEditionRequests: 0, candidates: 0, databaseWrites: 0 };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => {
    requireValue(process.argv.length === 3, 'invalid-work-prefix-command');
    return guardedWorkPrefixDiagnostic({ outputDirectory: process.argv[2] });
  }).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'work-prefix-diagnostic-failed' })); process.exitCode = 1;
  });
}
