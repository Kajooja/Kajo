import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

// Shared presentation contract for the offline reviewer and native/web readers.
export const ATTRIBUTED_DESCRIPTION = 'open-library-description-v2';
export const DESCRIPTION_ATTRIBUTION = 'description-attribution-v1';
export const DESCRIPTION_PILOT_USE = 'kajo-internal-pilot';
const HASH = /^[0-9a-f]{64}$/;
const fields = ['contract', 'sourceTitle', 'sourceUrl', 'sourceRevision', 'credit',
  'licenseName', 'licenseUrl', 'changes', 'textSha256', 'recordSha256'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function isAttributionText(value, maximum) {
  return typeof value === 'string' && value.length > 0 && [...value].length <= maximum
    && value === value.trim() && !/[\p{Cc}\p{Cf}<>]/u.test(value)
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
}

// Bounded ASCII HTTPS links. No credentials, ports, escapes in the authority,
// executable schemes, backslashes, control characters or implicit URL repair.
export function isAttributionUrl(value) {
  if (typeof value !== 'string' || value.length > 2048
    || !/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:[/?#][A-Za-z0-9._~!$&'()*+,;=:@/?#%\-]*)?$/.test(value)
    || /%(?![0-9A-Fa-f]{2})|%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return false;
  const authority = value.slice(8).split(/[/?#]/)[0];
  return authority.includes('.') && authority.split('.').every(label =>
    label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

export function readDescriptionAttribution(value, textSha256, recordSha256) {
  if (!record(value) || Object.keys(value).length !== fields.length
    || !fields.every(key => Object.hasOwn(value, key))
    || value.contract !== DESCRIPTION_ATTRIBUTION
    || typeof value.textSha256 !== 'string' || !HASH.test(value.textSha256) || value.textSha256 !== textSha256
    || typeof value.recordSha256 !== 'string' || !HASH.test(value.recordSha256) || value.recordSha256 !== recordSha256
    || !isAttributionText(value.sourceTitle, 200) || !isAttributionUrl(value.sourceUrl)
    || !(value.sourceRevision === null || isAttributionText(value.sourceRevision, 200))
    || !isAttributionText(value.credit, 500) || !isAttributionText(value.licenseName, 100)
    || !isAttributionUrl(value.licenseUrl) || !isAttributionText(value.changes, 500)) return null;
  return Object.fromEntries(fields.map(key => [key, value[key]]));
}

// Bind native/web display text to the same UTF-8 SHA-256 checked by Postgres.
export function descriptionTextHash(text) {
  return bytesToHex(sha256(text));
}
