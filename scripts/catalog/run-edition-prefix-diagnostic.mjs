#!/usr/bin/env node
// One distinct Edition diagnosis; all six predecessor ledgers stay spent.
import { execFile } from 'node:child_process';
import { appendFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { acquireEditionPrefixDiagnostic } from './acquire-edition-prefix-diagnostic.mjs';
import { requireValue, sha256 } from './open-library-descriptions.mjs';
import { DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_PATH,
  REQUEST_PATH, REVIEWED_PREVIOUS_DIAGNOSTIC, REVIEWED_REQUEST_PATH } from './seal-dump-acquisition.mjs';
import { WORK_PREFIX_REQUEST_PATH } from './seal-work-prefix-diagnostic.mjs';
import { FULL_CONTINUATION_PREVIOUS_PREFIX, FULL_CONTINUATION_PREVIOUS_REVIEWED,
  FULL_CONTINUATION_REQUEST_PATH } from './seal-full-dump-continuation.mjs';
import { CONFLICT_PREVIOUS_CONTINUATION, CONFLICT_REQUEST_PATH } from './seal-conflict-dump-acquisition.mjs';
import { validateConflictAcquisitionCommit } from './run-conflict-dump-acquisition.mjs';
import { EDITION_PREFIX_CORE_HEAD, EDITION_PREVIOUS_CONFLICT, EDITION_PREFIX_BRANCH, EDITION_PREFIX_REQUEST_PATH,
  EDITION_PREFIX_WORKFLOW, EDITION_PREFIX_ARTIFACT, sealEditionPrefixDiagnostic,
  validateEditionPrefixPredecessor } from './seal-edition-prefix-diagnostic.mjs';

export const EDITION_PREFIX_PREDECESSORS = Object.freeze([
  ['previousConflict', EDITION_PREVIOUS_CONFLICT, CONFLICT_REQUEST_PATH],
  ['previousContinuation', CONFLICT_PREVIOUS_CONTINUATION, FULL_CONTINUATION_REQUEST_PATH],
  ['reviewedRequest', FULL_CONTINUATION_PREVIOUS_REVIEWED, REVIEWED_REQUEST_PATH],
  ['prefixRequest', FULL_CONTINUATION_PREVIOUS_PREFIX, WORK_PREFIX_REQUEST_PATH],
  ['originalRequest', DIAGNOSTIC_PREVIOUS_ACQUISITION, REQUEST_PATH],
  ['diagnosticRequest', REVIEWED_PREVIOUS_DIAGNOSTIC, DIAGNOSTIC_REQUEST_PATH],
].map(row => Object.freeze(row)));
const exec = promisify(execFile), SHA = /^[0-9a-f]{40}$/;
const gitHash = value => typeof value === 'string' && SHA.test(value);

export function validateEditionPrefixCommit({ sourceHead, requestHead, parents, changes, request,
  previousConflict, ...predecessors }) {
  validateEditionPrefixPredecessor(request, previousConflict);
  requireValue(gitHash(sourceHead) && gitHash(requestHead) && request.sourceHead === sourceHead
    && parents === sourceHead, 'edition-prefix-unreviewed-source');
  requireValue(changes === `A\t${EDITION_PREFIX_REQUEST_PATH}\n`, 'edition-prefix-request-tree-mismatch');
  validateConflictAcquisitionCommit({ sourceHead: EDITION_PREVIOUS_CONFLICT.sourceHead,
    requestHead: EDITION_PREVIOUS_CONFLICT.requestHead, parents: EDITION_PREVIOUS_CONFLICT.sourceHead,
    changes: `A\t${CONFLICT_REQUEST_PATH}\n`, request: previousConflict, ...predecessors });
  return request;
}

export function validateEditionPrefixRunBudget(document, runId, requestHead) {
  requireValue(document && document.total_count === 1 && Array.isArray(document.workflow_runs)
    && document.workflow_runs.length === 1, 'edition-prefix-request-consumed');
  const run = document.workflow_runs[0];
  requireValue(String(run.id) === String(runId) && run.head_branch === EDITION_PREFIX_BRANCH
    && run.run_attempt === 1 && run.event === 'push' && gitHash(requestHead) && run.head_sha === requestHead,
  'edition-prefix-request-consumed');
}

async function githubBudget(env, fetcher, requestHead) {
  requireValue(typeof env.EDITION_PREFIX_GITHUB_TOKEN === 'string' && env.EDITION_PREFIX_GITHUB_TOKEN.length > 0,
    'edition-prefix-github-check-failed');
  const response = await fetcher(`https://api.github.com/repos/Kajooja/Kajo/actions/workflows/${EDITION_PREFIX_WORKFLOW}/runs?branch=${encodeURIComponent(EDITION_PREFIX_BRANCH)}&per_page=100`,
    { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.EDITION_PREFIX_GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  requireValue(response.ok && response.body, 'edition-prefix-github-check-failed');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    requireValue(bytes <= 2 * 1024 * 1024, 'edition-prefix-github-check-failed');
    chunks.push(Buffer.from(chunk));
  }
  validateEditionPrefixRunBudget(JSON.parse(Buffer.concat(chunks).toString('utf8')), env.GITHUB_RUN_ID, requestHead);
}

async function requireAbsentOutput(outputDirectory) {
  requireValue(typeof outputDirectory === 'string' && outputDirectory.length > 0, 'edition-prefix-invalid-output');
  for (let parent = dirname(resolve(outputDirectory)); parent !== dirname(parent); parent = dirname(parent)) {
    const info = await lstat(parent);
    requireValue(info.isDirectory() && !info.isSymbolicLink(), 'edition-prefix-unsafe-output-parent');
  }
  // Reject a file, directory or dangling symlink before even Git/GitHub network
  // access. The later exclusive mkdir also closes the race before provider I/O.
  try { await lstat(outputDirectory); }
  catch (error) { if (error?.code === 'ENOENT') return; throw error; }
  throw new Error('edition-prefix-output-exists');
}

export async function guardedEditionPrefixDiagnostic({ env = process.env, git, fetcher = fetch,
  acquire = acquireEditionPrefixDiagnostic, outputDirectory }) {
  env = { ...env };
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'Kajooja/Kajo'
    && env.GITHUB_RUN_ATTEMPT === '1' && /^\d+$/.test(env.GITHUB_RUN_ID)
    && env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${EDITION_PREFIX_BRANCH}`,
  'edition-prefix-request-consumed');
  await requireAbsentOutput(outputDirectory);
  const command = git ?? (async args => (await exec('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024,
    timeout: 60000, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } })).stdout);
  const sourceHead = (await command(['rev-parse', 'HEAD'])).trim();
  requireValue(gitHash(sourceHead), 'edition-prefix-unreviewed-source');
  // Accepted-main ancestry does not excuse a changed local parser or workflow.
  requireValue((await command(['status', '--porcelain', '--untracked-files=all'])).trim() === '',
    'edition-prefix-dirty-source');
  await command(['fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main']);
  requireValue((await command(['rev-parse', 'refs/remotes/origin/main'])).trim() === sourceHead,
    'edition-prefix-unreviewed-source');
  try {
    for (const accepted of [EDITION_PREFIX_CORE_HEAD])
      await command(['merge-base', '--is-ancestor', accepted, sourceHead]);
  }
  catch { throw new Error('edition-prefix-correction-missing'); }
  await command(['fetch', '--no-tags', 'origin', `refs/heads/${EDITION_PREFIX_BRANCH}`]);
  const requestHead = (await command(['rev-parse', 'FETCH_HEAD'])).trim();
  requireValue(gitHash(requestHead) && requestHead === env.GITHUB_SHA, 'edition-prefix-unreviewed-source');
  const parents = (await command(['show', '-s', '--format=%P', requestHead])).trim();
  const changes = await command(['diff', '--name-status', '--no-renames', sourceHead, requestHead]);
  const request = JSON.parse(await command(['show', `${requestHead}:${EDITION_PREFIX_REQUEST_PATH}`]));
  const predecessors = {};
  for (const [name, identity, path] of EDITION_PREFIX_PREDECESSORS) {
    await command(['fetch', '--no-tags', 'origin', identity.requestHead]);
    predecessors[name] = JSON.parse(await command(['show', `${identity.requestHead}:${path}`]));
  }
  validateEditionPrefixCommit({ sourceHead, requestHead, parents, changes, request, ...predecessors });
  await githubBudget(env, fetcher, requestHead);
  // Claim a brand-new, private directory before opening the Edition range. A failed
  // claim cannot spend the provider budget or replace a previous ciphertext.
  await mkdir(outputDirectory, { mode: 0o700 });
  let collected, sealed;
  try {
    collected = await acquire(structuredClone(request));
    sealed = sealEditionPrefixDiagnostic(collected, request);
  } catch { throw new Error('edition-prefix-failed'); }
  const bytes = JSON.stringify(sealed) + '\n';
  await writeFile(join(outputDirectory, EDITION_PREFIX_ARTIFACT), bytes, { flag: 'wx', mode: 0o600 });
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'sealed=true\n');
  if (collected.status === 'failed') throw new Error('edition-prefix-failed');
  return { status: 'sealed', requestSha256: request.requestSha256, sourceHead, requestHead,
    artifactSha256: sha256(bytes), maximumMetadataRequests: 0, maximumWorkRequests: 0,
    candidates: 0, approved: 0, databaseWrites: 0, modelAdmissions: 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => {
    requireValue(process.argv.length === 3, 'invalid-edition-prefix-command');
    return guardedEditionPrefixDiagnostic({ outputDirectory: process.argv[2] });
  }).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'edition-prefix-failed' })); process.exitCode = 1;
  });
}
