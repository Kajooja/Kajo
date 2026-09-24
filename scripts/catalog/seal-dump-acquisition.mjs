// Public workflow artifacts contain authenticated ciphertext only.
import { constants, createCipheriv, createDecipheriv, createPrivateKey, createPublicKey,
  privateDecrypt, publicEncrypt, randomBytes } from 'node:crypto';
import { ACQUISITION_CONTRACT, ACQUISITION_LIMITS, ACQUISITION_RELEASE,
  METADATA_INSPECTION_CONTRACT, inspectAcquisitionMetadataBytes, safeAcquisitionError,
  validateAcquisitionRoster } from './acquire-open-library-dumps.mjs';
import { canonicalJson, digest, requireValue, sha256 } from './open-library-descriptions.mjs';

export const REQUEST_CONTRACT = 'open-library-dump-acquisition-request-v1';
export const SEALED_CONTRACT = 'open-library-dump-acquisition-sealed-v1';
export const FAILURE_CONTRACT = 'open-library-dump-acquisition-failure-v1';
export const REQUEST_BRANCH = 'catalog-acquisition/ol-20260831';
export const REQUEST_PATH = 'scripts/catalog/requests/ol-20260831.json';
export const REQUEST_LIMITS = Object.freeze({ ...ACQUISITION_LIMITS, timeoutMs: 110 * 60 * 1000 });
export const MAX_PLAINTEXT_BYTES = 160 * 1024 * 1024;
export const DIAGNOSTIC_REQUEST_CONTRACT = 'open-library-metadata-diagnostic-request-v1';
export const DIAGNOSTIC_BRANCH = 'catalog-diagnostic/ol-20260831';
export const DIAGNOSTIC_REQUEST_PATH = 'scripts/catalog/requests/ol-20260831-metadata.json';
export const DIAGNOSTIC_LIMITS = Object.freeze({ metadataBytes: 2097152, timeoutMs: 30000, maxRedirects: 0 });
export const MAX_DIAGNOSTIC_PLAINTEXT_BYTES = 8 * 1024 * 1024;
export const DIAGNOSTIC_PREVIOUS_ACQUISITION = Object.freeze({ runId: '35995362978',
  sourceHead: 'ec17a0738702074dedecff00e60a2e529939c8fc', requestHead: '4308943cf0157ec6648017a0bf7a25e5b0876c5a',
  requestSha256: '9ac96783138824653f8e23eb9bf47c93ed30b7f7e3db658afd25b348f16b6f50', artifactId: '10805673376',
  artifactZipSha256: 'a97aed35be266b0d80c7f29364ee7c693a351e876fa28b418fefb452ba884c2f', artifactZipBytes: 2429,
  sealedArtifactSha256: '38becbaaa21ed5c8746b672bbd68aeb1f56f6e7c7105a3828bead2555a63fa8b',
  metadataSha256: 'b5613fc9b54dbd4592cfd71a71571d0e17028be76c9592eb1c7152ae7df3742b', metadataBytes: 4248 });
const hash = /^[0-9a-f]{64}$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

export function recipientFingerprint(pem) {
  requireValue(typeof pem === 'string' && pem.length <= 2048, 'invalid-acquisition-recipient');
  let key;
  try { key = createPublicKey(pem); } catch { throw new Error('invalid-acquisition-recipient'); }
  requireValue(pem.startsWith('-----BEGIN PUBLIC KEY-----\n') && key.asymmetricKeyType === 'rsa'
    && key.asymmetricKeyDetails.modulusLength >= 3072 && key.asymmetricKeyDetails.modulusLength <= 4096
    && key.asymmetricKeyDetails.publicExponent === 65537n, 'invalid-acquisition-recipient');
  requireValue(key.export({ type: 'spki', format: 'pem' }) === pem, 'invalid-acquisition-recipient');
  return sha256(key.export({ type: 'spki', format: 'der' }));
}

export function validateAcquisitionRequest(request) {
  requireValue(exactKeys(request, ['contract', 'release', 'sourceHead', 'roster', 'limits',
    'recipientPublicKey', 'recipientFingerprint', 'requestSha256'])
    && request.contract === REQUEST_CONTRACT && request.release === ACQUISITION_RELEASE
    && /^[0-9a-f]{40}$/.test(request.sourceHead), 'invalid-acquisition-request');
  const roster = validateAcquisitionRoster(request.roster);
  requireValue(canonicalJson(roster) === canonicalJson(request.roster), 'invalid-acquisition-roster-order');
  requireValue(exactKeys(request.limits, Object.keys(REQUEST_LIMITS))
    && Object.entries(request.limits).every(([key, value]) => Number.isSafeInteger(value)
      && value >= (key === 'maxRedirects' ? 0 : 1) && value <= REQUEST_LIMITS[key]), 'invalid-acquisition-limits');
  requireValue(recipientFingerprint(request.recipientPublicKey) === request.recipientFingerprint,
    'invalid-acquisition-recipient-fingerprint');
  const { requestSha256, ...body } = request;
  requireValue(hash.test(requestSha256) && digest(body) === requestSha256, 'invalid-acquisition-request-hash');
  return request;
}

export function validateMetadataDiagnosticRequest(request) {
  requireValue(exactKeys(request, ['contract', 'purpose', 'release', 'sourceHead', 'limits',
    'recipientPublicKey', 'recipientFingerprint', 'previousAcquisition', 'requestSha256'])
    && request.contract === DIAGNOSTIC_REQUEST_CONTRACT && request.purpose === 'metadata-only-failure-diagnosis'
    && request.release === ACQUISITION_RELEASE && /^[0-9a-f]{40}$/.test(request.sourceHead)
    && digest(request.limits) === digest(DIAGNOSTIC_LIMITS)
    && digest(request.previousAcquisition) === digest(DIAGNOSTIC_PREVIOUS_ACQUISITION), 'invalid-metadata-diagnostic-request');
  requireValue(recipientFingerprint(request.recipientPublicKey) === request.recipientFingerprint,
    'invalid-acquisition-recipient-fingerprint');
  const { requestSha256, ...body } = request;
  requireValue(hash.test(requestSha256) && digest(body) === requestSha256, 'invalid-acquisition-request-hash');
  return request;
}

function validateMetadataDiagnostic(result, request) {
  const limits = { ...ACQUISITION_LIMITS, ...request.limits };
  if (result?.contract === FAILURE_CONTRACT) {
    requireValue(exactKeys(result, ['contract', 'status', 'release', 'rosterSha256', 'limits', 'code', 'accounting'])
      && result.status === 'failed' && result.release === request.release && result.rosterSha256 === null
      && digest(result.limits) === digest(request.limits) && typeof result.code === 'string'
      && safeAcquisitionError(new Error(result.code)) === result.code && object(result.accounting), 'invalid-metadata-diagnostic-failure');
  } else {
    requireValue(object(result) && result.contract === METADATA_INSPECTION_CONTRACT && result.status === 'inspected'
      && result.release === request.release && digest(result.limits) === digest(limits)
      && result.dumpRequests === 0 && result.approved === 0 && result.databaseWrites === 0
      && result.individualProviderRequests === 0 && object(result.metadata)
      && result.metadata.complete === true && Number.isSafeInteger(result.metadata.bytes)
      && result.metadata.bytes >= 0 && result.metadata.bytes <= request.limits.metadataBytes
      && hash.test(result.metadata.sha256)
      && result.metadata.url === `https://archive.org/metadata/ol_dump_${request.release}`
      && result.metadata.finalUrl === result.metadata.url
      && Array.isArray(result.metadata.redirects) && result.metadata.redirects.length === 0,
    'invalid-metadata-diagnostic-result');
    const raw = base64(result.metadata.rawBase64, result.metadata.bytes);
    requireValue(sha256(raw) === result.metadata.sha256
      && digest(inspectAcquisitionMetadataBytes(raw, request.release, limits).validation) === digest(result.validation)
      && digest(result.metadata) === digest(result.accounting?.metadata), 'invalid-metadata-diagnostic-evidence');
    if (Object.hasOwn(result, 'bodyMatchesPrevious')) requireValue(result.bodyMatchesPrevious
      === (result.metadata.sha256 === request.previousAcquisition.metadataSha256), 'invalid-metadata-diagnostic-evidence');
  }
  const accounting = result.accounting;
  requireValue(Number.isSafeInteger(accounting.requests?.metadata)
    && accounting.requests.metadata >= 0 && accounting.requests.metadata <= 1
    && (result.status !== 'inspected' || accounting.requests.metadata === 1)
    && accounting.requests.works === 0 && accounting.requests.editions === 0
    && exactKeys(accounting.sources, []) && accounting.retainedRecordBytes === 0
    && accounting.individualProviderRequests === 0 && accounting.databaseWrites === 0, 'invalid-metadata-diagnostic-accounting');
}

const rosterHash = request => request.contract === DIAGNOSTIC_REQUEST_CONTRACT ? null : digest(request.roster);
const payloadKind = result => result.status === 'failed' ? 'failure'
  : result.contract === METADATA_INSPECTION_CONTRACT ? 'metadata-inspection' : 'collected';

function validateCollected(collected, request) {
  if (collected?.contract === FAILURE_CONTRACT) {
    requireValue(exactKeys(collected, ['contract', 'status', 'release', 'rosterSha256', 'limits', 'code', 'accounting'])
      && collected.status === 'failed' && collected.release === request.release
      && collected.rosterSha256 === digest(request.roster) && digest(collected.limits) === digest(request.limits)
      && /^[a-z-]{1,100}$/.test(collected.code) && object(collected.accounting), 'invalid-acquisition-failure');
    return;
  }
  requireValue(object(collected) && collected.contract === ACQUISITION_CONTRACT
    && collected.status === 'collected' && collected.release === request.release
    && collected.rosterSha256 === digest(request.roster)
    && digest(collected.limits) === digest(request.limits)
    && collected.approved === 0 && collected.databaseWrites === 0
    && collected.individualProviderRequests === 0 && collected.rights === 'unreviewed'
    && Array.isArray(collected.records) && collected.records.length === request.roster.length
    && collected.records.every((row, index) => row.workId === request.roster[index].workId
      && row.editionId === request.roster[index].editionId)
    && ['works', 'editions'].every(kind => collected.sources?.[kind]?.complete === true
      && collected.sources[kind].publisherChecksumsVerified === true), 'invalid-acquisition-collected');
}

export function sealAcquisition(collected, request) {
  validateAcquisitionRequest(request);
  return sealPayload(collected, request, validateCollected, MAX_PLAINTEXT_BYTES);
}

export function sealMetadataDiagnostic(result, request) {
  validateMetadataDiagnosticRequest(request);
  return sealPayload(result, request, validateMetadataDiagnostic, MAX_DIAGNOSTIC_PLAINTEXT_BYTES);
}

function sealPayload(collected, request, validate, maximum) {
  validate(collected, request);
  const plaintext = Buffer.from(JSON.stringify(collected));
  requireValue(plaintext.length <= maximum, 'acquisition-plaintext-limit');
  const header = { contract: SEALED_CONTRACT, algorithm: 'RSA-OAEP-SHA256+AES-256-GCM',
    payloadKind: payloadKind(collected),
    requestSha256: request.requestSha256, recipientFingerprint: request.recipientFingerprint,
    release: request.release, sourceHead: request.sourceHead, rosterSha256: rosterHash(request),
    plaintextSha256: sha256(plaintext), plaintextBytes: plaintext.length };
  const key = randomBytes(32), iv = randomBytes(12);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(canonicalJson(header)));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { header, wrappedKey: publicEncrypt({ key: request.recipientPublicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key).toString('base64'),
    iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  } finally { key.fill(0); plaintext.fill(0); }
}

function base64(value, length) {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(value), 'invalid-acquisition-envelope');
  const buffer = Buffer.from(value, 'base64');
  requireValue(buffer.toString('base64') === value && (length === undefined || buffer.length === length),
    'invalid-acquisition-envelope');
  return buffer;
}

export function unsealAcquisition(envelope, request, privatePem) {
  validateAcquisitionRequest(request);
  return unsealPayload(envelope, request, privatePem, validateCollected, MAX_PLAINTEXT_BYTES, ['failure', 'collected']);
}

export function unsealMetadataDiagnostic(envelope, request, privatePem) {
  validateMetadataDiagnosticRequest(request);
  return unsealPayload(envelope, request, privatePem, validateMetadataDiagnostic,
    MAX_DIAGNOSTIC_PLAINTEXT_BYTES, ['failure', 'metadata-inspection']);
}

function unsealPayload(envelope, request, privatePem, validate, maximum, kinds) {
  requireValue(exactKeys(envelope, ['header', 'wrappedKey', 'iv', 'tag', 'ciphertext'])
    && exactKeys(envelope.header, ['contract', 'algorithm', 'payloadKind', 'requestSha256', 'recipientFingerprint',
      'release', 'sourceHead', 'rosterSha256', 'plaintextSha256', 'plaintextBytes']), 'invalid-acquisition-envelope');
  const header = envelope.header;
  requireValue(header.contract === SEALED_CONTRACT && header.algorithm === 'RSA-OAEP-SHA256+AES-256-GCM'
    && kinds.includes(header.payloadKind)
    && header.requestSha256 === request.requestSha256 && header.recipientFingerprint === request.recipientFingerprint
    && header.release === request.release && header.sourceHead === request.sourceHead
    && header.rosterSha256 === rosterHash(request) && hash.test(header.plaintextSha256)
    && Number.isSafeInteger(header.plaintextBytes) && header.plaintextBytes > 0
    && header.plaintextBytes <= maximum, 'invalid-acquisition-envelope-binding');
  let key, plaintext;
  try {
    const privateKey = createPrivateKey(privatePem);
    requireValue(recipientFingerprint(createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }))
      === request.recipientFingerprint, 'invalid-acquisition-private-key');
    key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      base64(envelope.wrappedKey, privateKey.asymmetricKeyDetails.modulusLength / 8));
    requireValue(key.length === 32, 'invalid-acquisition-envelope');
    const ciphertext = base64(envelope.ciphertext, header.plaintextBytes);
    const decipher = createDecipheriv('aes-256-gcm', key, base64(envelope.iv, 12));
    decipher.setAAD(Buffer.from(canonicalJson(header)));
    decipher.setAuthTag(base64(envelope.tag, 16));
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    requireValue(sha256(plaintext) === header.plaintextSha256, 'invalid-acquisition-plaintext-hash');
    const collected = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
    validate(collected, request);
    requireValue(payloadKind(collected) === header.payloadKind,
      'invalid-acquisition-envelope-binding');
    return collected;
  } catch { throw new Error('acquisition-unseal-failed'); }
  finally { key?.fill(0); plaintext?.fill(0); }
}
