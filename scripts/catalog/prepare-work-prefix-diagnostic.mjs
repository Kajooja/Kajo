#!/usr/bin/env node
// Authenticate the already consumed reviewed failure before preparing a distinct
// bounded prefix request. A prior discarded row cannot be reconstructed locally.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { WORK_PREFIX_LIMITS, WORK_PREFIX_RANGE, WORK_PREFIX_SOURCE_PIN } from './inspect-work-dump-prefix.mjs';
import { digest, requireValue, sha256 } from './open-library-descriptions.mjs';
import { readLocalFile } from './prepare-dump-acquisition-request.mjs';
import { FAILURE_CONTRACT, unsealReviewedAcquisition, validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';
import { WORK_PREFIX_MAX_PLAINTEXT_BYTES, WORK_PREFIX_PREVIOUS_ACQUISITION, WORK_PREFIX_REQUEST_CONTRACT,
  WORK_PREFIX_REQUEST_PURPOSE, unsealWorkPrefixDiagnostic, validateWorkPrefixRequest } from './seal-work-prefix-diagnostic.mjs';

export function prepareWorkPrefixRequest({ previousRequest, previousArtifact, privatePem, sourceHead }) {
  validateReviewedAcquisitionRequest(previousRequest);
  requireValue(previousRequest.requestSha256 === WORK_PREFIX_PREVIOUS_ACQUISITION.requestSha256
    && previousRequest.sourceHead === WORK_PREFIX_PREVIOUS_ACQUISITION.sourceHead,
  'work-prefix-predecessor-mismatch');
  requireValue(typeof previousArtifact === 'string'
    && sha256(previousArtifact) === WORK_PREFIX_PREVIOUS_ACQUISITION.sealedArtifactSha256, 'work-prefix-predecessor-artifact-mismatch');
  const previous = unsealReviewedAcquisition(JSON.parse(previousArtifact), previousRequest, privatePem);
  const accounting = previous.accounting, work = accounting?.sources?.works;
  requireValue(previous.contract === FAILURE_CONTRACT && previous.status === 'failed' && previous.code === 'provider-identity-mismatch'
    && accounting.activeSource === 'works' && accounting.requests.metadata === 0 && accounting.requests.works === 2
    && accounting.requests.editions === 0 && accounting.databaseWrites === 0 && accounting.individualProviderRequests === 0
    && work?.bytes === 78731116 && work.decodedBytes === 456982528 && work.rows === 804172 && work.matchedRecords === 11
    && work.unrelatedRows === 804160 && work.complete === false && work.expectedBytes === WORK_PREFIX_SOURCE_PIN.bytes
    && accounting.retainedRecordBytes === 40567 && accounting.failureEvidence === undefined,
  'work-prefix-predecessor-evidence-mismatch');
  const body = { contract: WORK_PREFIX_REQUEST_CONTRACT, purpose: WORK_PREFIX_REQUEST_PURPOSE,
    release: previousRequest.release, sourceHead, roster: structuredClone(previousRequest.roster),
    sourcePin: { ...WORK_PREFIX_SOURCE_PIN }, range: { ...WORK_PREFIX_RANGE }, limits: { ...WORK_PREFIX_LIMITS },
    previousAcquisition: { ...WORK_PREFIX_PREVIOUS_ACQUISITION }, recipientPublicKey: previousRequest.recipientPublicKey,
    recipientFingerprint: previousRequest.recipientFingerprint };
  return validateWorkPrefixRequest({ ...body, requestSha256: digest(body) });
}

export async function runWorkPrefixPrepare(args = process.argv.slice(2)) {
  requireValue(!process.env.GITHUB_ACTIONS, 'work-prefix-local-only');
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options: Object.fromEntries(
    ['previous-request', 'previous-input', 'source-head', 'request', 'key-dir', 'input', 'out'].map(key => [key, { type: 'string' }])) });
  const command = positionals[0];
  const required = { request: ['previous-request', 'previous-input', 'source-head', 'key-dir', 'out'],
    unseal: ['request', 'key-dir', 'input', 'out'] }[command];
  requireValue(positionals.length === 1 && required && required.every(key => values[key])
    && Object.keys(values).every(key => required.includes(key)), 'invalid-work-prefix-command');
  const privatePem = await readLocalFile(join(values['key-dir'], 'recipient-private.pem'), 4096, true);
  let result;
  if (command === 'request') {
    const previousRequest = JSON.parse(await readLocalFile(values['previous-request'], 256 * 1024));
    const previousArtifact = await readLocalFile(values['previous-input'], 32 * 1024);
    const request = prepareWorkPrefixRequest({ previousRequest, previousArtifact, privatePem, sourceHead: values['source-head'] });
    await writeFile(values.out, JSON.stringify(request, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    result = { status: 'prepared', requestSha256: request.requestSha256, targets: request.roster.length,
      recipientFingerprint: request.recipientFingerprint, maximumCompressedBytes: request.limits.compressedBytes,
      maximumMetadataRequests: 0, maximumEditionRequests: 0 };
  } else {
    const request = JSON.parse(await readLocalFile(values.request, 256 * 1024));
    const envelope = JSON.parse(await readLocalFile(values.input, 2 * WORK_PREFIX_MAX_PLAINTEXT_BYTES));
    const diagnostic = unsealWorkPrefixDiagnostic(envelope, request, privatePem);
    await mkdir(values.out, { mode: 0o700 });
    await writeFile(join(values.out, 'work-prefix-diagnostic.json'), JSON.stringify(diagnostic), { flag: 'wx', mode: 0o600 });
    result = { status: 'recovered', requestSha256: request.requestSha256, plaintextSha256: envelope.header.plaintextSha256,
      diagnosticStatus: diagnostic.status, fullSourceComplete: false, candidates: 0, approved: 0, databaseWrites: 0 };
  }
  console.log(JSON.stringify(result));
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runWorkPrefixPrepare().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'work-prefix-local-operation-failed' })); process.exitCode = 1;
  });
}
