#!/usr/bin/env node
// One new metadata-only request; it cannot resume or replay the spent dump run.
import { execFile } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { inspectOpenLibraryDumpMetadata, safeAcquisitionError } from './acquire-open-library-dumps.mjs';
import { requireValue, sha256 } from './open-library-descriptions.mjs';
import { DIAGNOSTIC_BRANCH, DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_PATH,
  FAILURE_CONTRACT, REQUEST_PATH, sealMetadataDiagnostic, validateMetadataDiagnosticRequest } from './seal-dump-acquisition.mjs';

const exec = promisify(execFile);
export const DIAGNOSTIC_WORKFLOW_FILE = 'catalog-book-metadata-diagnostic.yml';
const SHA = /^[0-9a-f]{40}$/;

export function validateDiagnosticCommit({ sourceHead, requestHead, parents, changes, request, previousRequest }) {
  validateMetadataDiagnosticRequest(request);
  requireValue(SHA.test(sourceHead) && SHA.test(requestHead) && request.sourceHead === sourceHead
    && parents === sourceHead, 'metadata-diagnostic-unreviewed-source');
  requireValue(changes === `A\t${DIAGNOSTIC_REQUEST_PATH}\n`, 'metadata-diagnostic-request-tree-mismatch');
  // This object is read from the fixed, already consumed Git commit, not from
  // the new request branch. Git's object identity binds its full original bytes.
  requireValue(previousRequest?.sourceHead === DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead
    && previousRequest.requestSha256 === DIAGNOSTIC_PREVIOUS_ACQUISITION.requestSha256
    && previousRequest.recipientFingerprint === request.recipientFingerprint
    && previousRequest.recipientPublicKey === request.recipientPublicKey,
  'metadata-diagnostic-previous-request-mismatch');
  return request;
}

export function validateDiagnosticRunBudget(document, runId) {
  requireValue(document && document.total_count === 1 && Array.isArray(document.workflow_runs)
    && document.workflow_runs.length === 1, 'metadata-diagnostic-request-consumed');
  const run = document.workflow_runs[0];
  requireValue(String(run.id) === String(runId) && run.head_branch === DIAGNOSTIC_BRANCH && run.run_attempt === 1,
    'metadata-diagnostic-request-consumed');
}

async function githubDiagnosticBudget(env, fetcher) {
  requireValue(typeof env.DIAGNOSTIC_GITHUB_TOKEN === 'string' && env.DIAGNOSTIC_GITHUB_TOKEN.length > 0,
    'metadata-diagnostic-github-check-failed');
  const response = await fetcher(`https://api.github.com/repos/Kajooja/Kajo/actions/workflows/${DIAGNOSTIC_WORKFLOW_FILE}/runs?branch=${encodeURIComponent(DIAGNOSTIC_BRANCH)}&per_page=100`,
    { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.DIAGNOSTIC_GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  requireValue(response.ok && response.body, 'metadata-diagnostic-github-check-failed');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    requireValue(bytes <= 2 * 1024 * 1024, 'metadata-diagnostic-github-check-failed');
    chunks.push(Buffer.from(chunk));
  }
  validateDiagnosticRunBudget(JSON.parse(Buffer.concat(chunks).toString('utf8')), env.GITHUB_RUN_ID);
}

export async function guardedMetadataDiagnostic({ env = process.env, git, fetcher = fetch,
  inspect = inspectOpenLibraryDumpMetadata, outputDirectory }) {
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'Kajooja/Kajo'
    && env.GITHUB_RUN_ATTEMPT === '1' && /^\d+$/.test(env.GITHUB_RUN_ID)
    && env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${DIAGNOSTIC_BRANCH}`,
  'metadata-diagnostic-request-consumed');
  const command = git ?? (async args => (await exec('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024,
    timeout: 60000 })).stdout);
  const sourceHead = (await command(['rev-parse', 'HEAD'])).trim();
  requireValue(SHA.test(sourceHead) && (await command(['rev-parse', 'refs/remotes/origin/main'])).trim() === sourceHead,
    'metadata-diagnostic-unreviewed-source');
  await command(['fetch', '--no-tags', 'origin', `refs/heads/${DIAGNOSTIC_BRANCH}`]);
  const requestHead = (await command(['rev-parse', 'FETCH_HEAD'])).trim();
  requireValue(SHA.test(requestHead) && requestHead === env.GITHUB_SHA, 'metadata-diagnostic-unreviewed-source');
  const parents = (await command(['show', '-s', '--format=%P', requestHead])).trim();
  const changes = await command(['diff', '--name-status', '--no-renames', sourceHead, requestHead]);
  const request = JSON.parse(await command(['show', `${requestHead}:${DIAGNOSTIC_REQUEST_PATH}`]));
  // The consumed request branch was never merged into main. A fresh runner
  // needs this exact public Git object before checking its recipient identity.
  await command(['fetch', '--no-tags', 'origin', DIAGNOSTIC_PREVIOUS_ACQUISITION.requestHead]);
  const previousRequest = JSON.parse(await command(['show', `${DIAGNOSTIC_PREVIOUS_ACQUISITION.requestHead}:${REQUEST_PATH}`]));
  validateDiagnosticCommit({ sourceHead, requestHead, parents, changes, request, previousRequest });
  await githubDiagnosticBudget(env, fetcher);
  let diagnostic, failed = false;
  try { diagnostic = await inspect({ release: request.release, limits: request.limits }); }
  catch (error) {
    failed = true;
    diagnostic = { contract: FAILURE_CONTRACT, status: 'failed', release: request.release,
      rosterSha256: null, limits: request.limits, code: safeAcquisitionError(error),
      accounting: error?.accounting ?? { unavailable: true } };
  }
  const sealed = sealMetadataDiagnostic(diagnostic, request);
  await mkdir(outputDirectory, { mode: 0o700 });
  const bytes = JSON.stringify(sealed) + '\n';
  await writeFile(join(outputDirectory, 'open-library-metadata-20260831.sealed.json'), bytes, { flag: 'wx', mode: 0o600 });
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'sealed=true\n');
  if (failed) throw new Error('metadata-diagnostic-failed');
  return { status: 'sealed', requestSha256: request.requestSha256, sourceHead, requestHead,
    artifactSha256: sha256(bytes), purpose: request.purpose, maximumMetadataRequests: 1, maximumDumpRequests: 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => {
    requireValue(process.argv.length === 3, 'invalid-metadata-diagnostic-command');
    return guardedMetadataDiagnostic({ outputDirectory: process.argv[2] });
  }).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'metadata-diagnostic-failed' }));
    process.exitCode = 1;
  });
}
