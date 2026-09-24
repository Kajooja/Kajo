#!/usr/bin/env node
// Local authenticated diagnosis -> exact-size public request, or private recovery.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ACQUISITION_RELEASE, REVIEWED_ACQUISITION_LIMITS, REVIEWED_SOURCE_EVIDENCE,
  REVIEWED_SOURCE_PINS, validateAcquisitionMetadata } from './acquire-open-library-dumps.mjs';
import { digest, requireValue, sha256 } from './open-library-descriptions.mjs';
import { readLocalFile } from './prepare-dump-acquisition-request.mjs';
import { DIAGNOSTIC_PREVIOUS_ACQUISITION, MAX_DIAGNOSTIC_PLAINTEXT_BYTES, MAX_PLAINTEXT_BYTES,
  REVIEWED_PREVIOUS_DIAGNOSTIC, REVIEWED_REQUEST_CONTRACT, REVIEWED_REQUEST_PURPOSE,
  unsealMetadataDiagnostic, unsealReviewedAcquisition, validateAcquisitionRequest,
  validateMetadataDiagnosticRequest, validateReviewedAcquisitionRequest } from './seal-dump-acquisition.mjs';

export function prepareReviewedAcquisitionRequest({ previousRequest, diagnosticRequest, diagnosticArtifact, privatePem, sourceHead }) {
  validateAcquisitionRequest(previousRequest);
  validateMetadataDiagnosticRequest(diagnosticRequest);
  requireValue(previousRequest.requestSha256 === DIAGNOSTIC_PREVIOUS_ACQUISITION.requestSha256
    && previousRequest.sourceHead === DIAGNOSTIC_PREVIOUS_ACQUISITION.sourceHead
    && diagnosticRequest.requestSha256 === REVIEWED_PREVIOUS_DIAGNOSTIC.requestSha256
    && diagnosticRequest.sourceHead === REVIEWED_PREVIOUS_DIAGNOSTIC.sourceHead
    && diagnosticRequest.recipientFingerprint === previousRequest.recipientFingerprint
    && diagnosticRequest.recipientPublicKey === previousRequest.recipientPublicKey,
  'reviewed-acquisition-predecessor-mismatch');
  requireValue(typeof diagnosticArtifact === 'string'
    && sha256(diagnosticArtifact) === REVIEWED_PREVIOUS_DIAGNOSTIC.sealedArtifactSha256,
  'reviewed-acquisition-diagnostic-artifact-mismatch');
  const diagnostic = unsealMetadataDiagnostic(JSON.parse(diagnosticArtifact), diagnosticRequest, privatePem);
  requireValue(diagnostic.status === 'inspected' && diagnostic.validation.valid === false
    && diagnostic.validation.code === REVIEWED_PREVIOUS_DIAGNOSTIC.validationCode
    && diagnostic.metadata.sha256 === REVIEWED_PREVIOUS_DIAGNOSTIC.metadataSha256
    && diagnostic.metadata.bytes === REVIEWED_PREVIOUS_DIAGNOSTIC.metadataBytes
    && diagnostic.retrievedAt === REVIEWED_SOURCE_EVIDENCE.diagnosticRetrievedAt,
  'reviewed-acquisition-diagnostic-evidence-mismatch');
  const document = JSON.parse(Buffer.from(diagnostic.metadata.rawBase64, 'base64').toString('utf8'));
  const sources = validateAcquisitionMetadata(document, ACQUISITION_RELEASE, REVIEWED_ACQUISITION_LIMITS);
  for (const kind of ['works', 'editions']) {
    const actual = Object.fromEntries(Object.keys(REVIEWED_SOURCE_PINS[kind]).map(key => [key, sources[kind][key]]));
    requireValue(digest(actual) === digest(REVIEWED_SOURCE_PINS[kind]), 'reviewed-acquisition-source-pin-mismatch');
  }
  const body = { contract: REVIEWED_REQUEST_CONTRACT, purpose: REVIEWED_REQUEST_PURPOSE,
    release: ACQUISITION_RELEASE, sourceHead, roster: structuredClone(previousRequest.roster),
    limits: { ...REVIEWED_ACQUISITION_LIMITS }, sourcePins: structuredClone(REVIEWED_SOURCE_PINS),
    sourceEvidence: { ...REVIEWED_SOURCE_EVIDENCE }, previousAcquisition: { ...DIAGNOSTIC_PREVIOUS_ACQUISITION },
    previousDiagnostic: { ...REVIEWED_PREVIOUS_DIAGNOSTIC },
    recipientPublicKey: previousRequest.recipientPublicKey, recipientFingerprint: previousRequest.recipientFingerprint };
  return validateReviewedAcquisitionRequest({ ...body, requestSha256: digest(body) });
}

export async function runReviewedPrepare(args = process.argv.slice(2)) {
  requireValue(!process.env.GITHUB_ACTIONS, 'reviewed-acquisition-local-only');
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options: Object.fromEntries(
    ['previous-request', 'diagnostic-request', 'diagnostic-input', 'source-head', 'request', 'key-dir', 'input', 'out']
      .map(key => [key, { type: 'string' }])) });
  const command = positionals[0];
  const required = { request: ['previous-request', 'diagnostic-request', 'diagnostic-input', 'source-head', 'key-dir', 'out'],
    unseal: ['request', 'key-dir', 'input', 'out'] }[command];
  requireValue(positionals.length === 1 && required && required.every(key => values[key])
    && Object.keys(values).every(key => required.includes(key)), 'invalid-reviewed-acquisition-command');
  const privatePem = await readLocalFile(join(values['key-dir'], 'recipient-private.pem'), 4096, true);
  let result;
  if (command === 'request') {
    const previousRequest = JSON.parse(await readLocalFile(values['previous-request'], 256 * 1024));
    const diagnosticRequest = JSON.parse(await readLocalFile(values['diagnostic-request'], 256 * 1024));
    const diagnosticArtifact = await readLocalFile(values['diagnostic-input'], 2 * MAX_DIAGNOSTIC_PLAINTEXT_BYTES);
    const request = prepareReviewedAcquisitionRequest({ previousRequest, diagnosticRequest, diagnosticArtifact,
      privatePem, sourceHead: values['source-head'] });
    await writeFile(values.out, JSON.stringify(request, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    result = { status: 'prepared', requestSha256: request.requestSha256, targets: request.roster.length,
      recipientFingerprint: request.recipientFingerprint, maximumMetadataRequests: 0,
      dumpFiles: 2, totalCompressedBytes: request.limits.totalCompressedBytes };
  } else {
    const request = JSON.parse(await readLocalFile(values.request, 256 * 1024));
    const envelope = JSON.parse(await readLocalFile(values.input, 2 * MAX_PLAINTEXT_BYTES));
    const collected = unsealReviewedAcquisition(envelope, request, privatePem);
    await mkdir(values.out, { mode: 0o700 });
    await writeFile(join(values.out, 'collected.json'), JSON.stringify(collected), { flag: 'wx', mode: 0o600 });
    result = { status: 'recovered', payloadKind: envelope.header.payloadKind, requestSha256: request.requestSha256,
      plaintextSha256: envelope.header.plaintextSha256, targets: request.roster.length,
      approved: 0, databaseWrites: 0, metadataRequests: 0,
      ...(collected.coverage ? { coverage: collected.coverage } : {}) };
  }
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReviewedPrepare().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'reviewed-acquisition-local-operation-failed' }));
    process.exitCode = 1;
  });
}
