#!/usr/bin/env node
// Local preparation/recovery for a distinct one-GET metadata diagnosis.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ACQUISITION_RELEASE } from './acquire-open-library-dumps.mjs';
import { digest, requireValue } from './open-library-descriptions.mjs';
import { readLocalFile } from './prepare-dump-acquisition-request.mjs';
import { DIAGNOSTIC_LIMITS, DIAGNOSTIC_PREVIOUS_ACQUISITION, DIAGNOSTIC_REQUEST_CONTRACT,
  MAX_DIAGNOSTIC_PLAINTEXT_BYTES, unsealMetadataDiagnostic, validateAcquisitionRequest,
  validateMetadataDiagnosticRequest } from './seal-dump-acquisition.mjs';

export function prepareMetadataDiagnosticRequest(previousRequest, sourceHead) {
  validateAcquisitionRequest(previousRequest);
  requireValue(previousRequest.requestSha256 === DIAGNOSTIC_PREVIOUS_ACQUISITION.requestSha256
    && previousRequest.sourceHead === DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead,
  'metadata-diagnostic-previous-request-mismatch');
  const body = { contract: DIAGNOSTIC_REQUEST_CONTRACT, purpose: 'metadata-only-failure-diagnosis',
    release: ACQUISITION_RELEASE, sourceHead, limits: { ...DIAGNOSTIC_LIMITS },
    recipientPublicKey: previousRequest.recipientPublicKey, recipientFingerprint: previousRequest.recipientFingerprint,
    previousAcquisition: { ...DIAGNOSTIC_PREVIOUS_ACQUISITION } };
  return validateMetadataDiagnosticRequest({ ...body, requestSha256: digest(body) });
}

export async function runMetadataDiagnosticPrepare(args = process.argv.slice(2)) {
  requireValue(!process.env.GITHUB_ACTIONS, 'metadata-diagnostic-local-only');
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options: Object.fromEntries(
    ['previous-request', 'source-head', 'request', 'key-dir', 'input', 'out'].map(key => [key, { type: 'string' }])) });
  const command = positionals[0];
  const required = { request: ['previous-request', 'source-head', 'out'],
    unseal: ['request', 'key-dir', 'input', 'out'] }[command];
  requireValue(positionals.length === 1 && required && required.every(key => values[key])
    && Object.keys(values).every(key => required.includes(key)), 'invalid-metadata-diagnostic-command');
  let result;
  if (command === 'request') {
    const previous = JSON.parse(await readLocalFile(values['previous-request'], 256 * 1024));
    const request = prepareMetadataDiagnosticRequest(previous, values['source-head']);
    await writeFile(values.out, JSON.stringify(request, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    result = { status: 'prepared', requestSha256: request.requestSha256,
      recipientFingerprint: request.recipientFingerprint, purpose: request.purpose,
      previousRunId: request.previousAcquisition.runId, maximumMetadataRequests: 1, maximumDumpRequests: 0 };
  } else {
    const request = JSON.parse(await readLocalFile(values.request, 256 * 1024));
    const envelope = JSON.parse(await readLocalFile(values.input, 2 * MAX_DIAGNOSTIC_PLAINTEXT_BYTES));
    const privatePem = await readLocalFile(join(values['key-dir'], 'recipient-private.pem'), 4096, true);
    const diagnostic = unsealMetadataDiagnostic(envelope, request, privatePem);
    await mkdir(values.out, { mode: 0o700 });
    await writeFile(join(values.out, 'metadata-diagnostic.json'), JSON.stringify(diagnostic), { flag: 'wx', mode: 0o600 });
    const metadata = diagnostic.metadata ?? diagnostic.accounting?.metadata;
    result = { status: 'recovered', requestSha256: request.requestSha256,
      diagnosticStatus: diagnostic.status, metadataBytes: metadata?.bytes ?? 0,
      metadataSha256: metadata?.complete ? metadata.sha256 : null,
      bodyMatchesPrevious: metadata?.complete === true ? metadata.sha256 === request.previousAcquisition.metadataSha256 : null,
      approved: 0, databaseWrites: 0, dumpRequests: 0 };
  }
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMetadataDiagnosticPrepare().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'metadata-diagnostic-local-operation-failed' }));
    process.exitCode = 1;
  });
}
