#!/usr/bin/env node
// One distinct full collection; all seven predecessor ledgers stay spent.
import { execFile } from 'node:child_process';
import { appendFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { acquireFramedOpenLibraryDumps } from './acquire-open-library-dumps.mjs';
import { requireValue, sha256 } from './open-library-descriptions.mjs';
import { EDITION_PREFIX_REQUEST_PATH } from './seal-edition-prefix-diagnostic.mjs';
import { EDITION_PREFIX_PREDECESSORS, validateEditionPrefixCommit } from './run-edition-prefix-diagnostic.mjs';
import { FRAMED_COLLECTION_SOURCE_HEAD, FRAMED_PREVIOUS_EDITION_DIAGNOSTIC, FRAMED_REQUEST_BRANCH,
  FRAMED_REQUEST_PATH, FRAMED_WORKFLOW, FRAMED_ARTIFACT, sealFramedDumpAcquisition,
  validateFramedDumpAcquisitionPredecessor } from './seal-framed-dump-acquisition.mjs';

export const FRAMED_PREDECESSORS = Object.freeze([
  Object.freeze(['previousEditionDiagnostic', FRAMED_PREVIOUS_EDITION_DIAGNOSTIC, EDITION_PREFIX_REQUEST_PATH]),
  ...EDITION_PREFIX_PREDECESSORS,
]);
const exec = promisify(execFile), SHA = /^[0-9a-f]{40}$/;
const gitHash = value => typeof value === 'string' && SHA.test(value);

export function validateFramedAcquisitionCommit({ sourceHead, requestHead, parents, changes, request,
  previousEditionDiagnostic, ...predecessors }) {
  validateFramedDumpAcquisitionPredecessor(request, previousEditionDiagnostic);
  requireValue(gitHash(sourceHead) && gitHash(requestHead) && request.sourceHead === sourceHead
    && parents === sourceHead, 'framed-acquisition-unreviewed-source');
  requireValue(changes === `A\t${FRAMED_REQUEST_PATH}\n`, 'framed-acquisition-request-tree-mismatch');
  const previous = FRAMED_PREVIOUS_EDITION_DIAGNOSTIC;
  validateEditionPrefixCommit({ sourceHead: previous.sourceHead, requestHead: previous.requestHead,
    parents: previous.sourceHead, changes: `A\t${EDITION_PREFIX_REQUEST_PATH}\n`,
    request: previousEditionDiagnostic, ...predecessors });
  return request;
}

export function validateFramedAcquisitionRunBudget(document, runId, requestHead) {
  requireValue(document && document.total_count === 1 && Array.isArray(document.workflow_runs)
    && document.workflow_runs.length === 1, 'framed-acquisition-request-consumed');
  const run = document.workflow_runs[0];
  requireValue(String(run.id) === String(runId) && run.head_branch === FRAMED_REQUEST_BRANCH
    && run.run_attempt === 1 && run.event === 'push' && gitHash(requestHead) && run.head_sha === requestHead,
  'framed-acquisition-request-consumed');
}

async function githubBudget(env, fetcher, requestHead) {
  requireValue(typeof env.FRAMED_ACQUISITION_GITHUB_TOKEN === 'string' && env.FRAMED_ACQUISITION_GITHUB_TOKEN.length > 0,
    'framed-acquisition-github-check-failed');
  const response = await fetcher(`https://api.github.com/repos/Kajooja/Kajo/actions/workflows/${FRAMED_WORKFLOW}/runs?branch=${encodeURIComponent(FRAMED_REQUEST_BRANCH)}&per_page=100`,
    { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.FRAMED_ACQUISITION_GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  requireValue(response.ok && response.body, 'framed-acquisition-github-check-failed');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    requireValue(bytes <= 2 * 1024 * 1024, 'framed-acquisition-github-check-failed');
    chunks.push(Buffer.from(chunk));
  }
  validateFramedAcquisitionRunBudget(JSON.parse(Buffer.concat(chunks).toString('utf8')), env.GITHUB_RUN_ID, requestHead);
}

async function requireAbsentOutput(outputDirectory) {
  requireValue(typeof outputDirectory === 'string' && outputDirectory.length > 0, 'framed-acquisition-invalid-output');
  for (let parent = dirname(resolve(outputDirectory)); parent !== dirname(parent); parent = dirname(parent)) {
    const info = await lstat(parent);
    requireValue(info.isDirectory() && !info.isSymbolicLink(), 'framed-acquisition-unsafe-output-parent');
  }
  // Reject a file, directory or dangling symlink before even Git/GitHub network
  // access. The later exclusive mkdir also closes the race before provider I/O.
  try { await lstat(outputDirectory); }
  catch (error) { if (error?.code === 'ENOENT') return; throw error; }
  throw new Error('framed-acquisition-output-exists');
}

export async function guardedFramedDumpAcquisition({ env = process.env, git, fetcher = fetch,
  acquire = acquireFramedOpenLibraryDumps, outputDirectory }) {
  env = { ...env };
  requireValue(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'Kajooja/Kajo'
    && env.GITHUB_RUN_ATTEMPT === '1' && /^\d+$/.test(env.GITHUB_RUN_ID)
    && env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === `refs/heads/${FRAMED_REQUEST_BRANCH}`,
  'framed-acquisition-request-consumed');
  await requireAbsentOutput(outputDirectory);
  const command = git ?? (async args => (await exec('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024,
    timeout: 60000, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } })).stdout);
  const sourceHead = (await command(['rev-parse', 'HEAD'])).trim();
  requireValue(gitHash(sourceHead), 'framed-acquisition-unreviewed-source');
  // Accepted-main ancestry does not excuse a changed local parser or workflow.
  requireValue((await command(['status', '--porcelain', '--untracked-files=all'])).trim() === '',
    'framed-acquisition-dirty-source');
  await command(['fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main']);
  requireValue((await command(['rev-parse', 'refs/remotes/origin/main'])).trim() === sourceHead,
    'framed-acquisition-unreviewed-source');
  try {
    for (const accepted of [FRAMED_COLLECTION_SOURCE_HEAD])
      await command(['merge-base', '--is-ancestor', accepted, sourceHead]);
  }
  catch { throw new Error('framed-acquisition-correction-missing'); }
  await command(['fetch', '--no-tags', 'origin', `refs/heads/${FRAMED_REQUEST_BRANCH}`]);
  const requestHead = (await command(['rev-parse', 'FETCH_HEAD'])).trim();
  requireValue(gitHash(requestHead) && requestHead === env.GITHUB_SHA, 'framed-acquisition-unreviewed-source');
  const parents = (await command(['show', '-s', '--format=%P', requestHead])).trim();
  const changes = await command(['diff', '--name-status', '--no-renames', sourceHead, requestHead]);
  const request = JSON.parse(await command(['show', `${requestHead}:${FRAMED_REQUEST_PATH}`]));
  const predecessors = {};
  for (const [name, identity, path] of FRAMED_PREDECESSORS) {
    await command(['fetch', '--no-tags', 'origin', identity.requestHead]);
    predecessors[name] = JSON.parse(await command(['show', `${identity.requestHead}:${path}`]));
  }
  validateFramedAcquisitionCommit({ sourceHead, requestHead, parents, changes, request, ...predecessors });
  await githubBudget(env, fetcher, requestHead);
  // Claim a brand-new, private directory before opening either pinned source. A failed
  // claim cannot spend the provider budget or replace a previous ciphertext.
  await mkdir(outputDirectory, { mode: 0o700 });
  let collected, sealed;
  try {
    collected = await acquire(structuredClone(request));
    sealed = sealFramedDumpAcquisition(collected, request);
  } catch { throw new Error('framed-acquisition-failed'); }
  const bytes = JSON.stringify(sealed) + '\n';
  await writeFile(join(outputDirectory, FRAMED_ARTIFACT), bytes, { flag: 'wx', mode: 0o600 });
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'sealed=true\n');
  if (collected.status === 'failed') throw new Error('framed-acquisition-failed');
  return { status: 'sealed', requestSha256: request.requestSha256, sourceHead, requestHead,
    artifactSha256: sha256(bytes), maximumMetadataRequests: 0, individualProviderRequests: 0,
    approved: 0, databaseWrites: 0, modelAdmissions: 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => {
    requireValue(process.argv.length === 3, 'invalid-framed-acquisition-command');
    return guardedFramedDumpAcquisition({ outputDirectory: process.argv[2] });
  }).then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'framed-acquisition-failed' })); process.exitCode = 1;
  });
}
