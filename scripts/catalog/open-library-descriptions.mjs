// Description-only policy. Provider records and operator review files stay out of Git.
import { createHash } from 'node:crypto';
import { ATTRIBUTED_DESCRIPTION, DESCRIPTION_PILOT_USE, readDescriptionAttribution } from '@kajo/catalog-contracts';

export const CONTRACT = 'open-library-description-v1';
export const PILOT = 'open-library-description-pilot-v1';
export const REVIEW_AMENDMENT = 'open-library-description-review-amendment-v1';
export const PILOT_ITEMS = Object.freeze([
  ['a7f6d2cd-e290-4bc4-97b7-cf1180ea86b9', 'OL17370186W', 'OL26433779M', 'fin'],
  ['43c6e886-0858-4f3e-b188-72cc62b6dfbc', 'OL3923952W', 'OL44944392M', 'fin'],
  ['25fa7fee-2a4d-4b8e-9c63-f9f6f367aff9', 'OL166894W', 'OL16835710M', 'fin'],
  ['6aa4020d-fdfa-4010-ad8d-2217c71f06f8', 'OL362427W', 'OL26501345M', 'fin'],
  ['9d8a5234-5565-4f42-aa77-30422e780419', 'OL1892617W', 'OL39218444M', 'fin'],
  ['ccbdb717-0a27-4099-8b56-64b3c5f9aaed', 'OL17930368W', 'OL27918581M', 'eng'],
  ['b54ebb75-2e4c-48e1-8349-5f73bf0d789b', 'OL18020194W', 'OL27213498M', 'eng'],
  ['c3548ac2-ae85-4ee6-aeeb-8101fa909fb1', 'OL17590212W', 'OL27351482M', 'eng'],
  ['4af3c2b6-7a8a-4107-b198-ac0ed0afa2c9', 'OL25312237W', 'OL33899062M', 'eng'],
  ['fad9046f-f67a-42f2-9fb8-57657035593e', 'OL82563W', 'OL59004869M', 'eng'],
].map(([itemId, workId, editionId, displayLanguage], index) =>
  Object.freeze({ position: index + 1, itemId, workId, editionId, displayLanguage })));

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const digest = value => sha256(canonicalJson(value));
export function requireValue(condition, code) {
  if (!condition) throw new Error(code);
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const PRESERVATION_FIELDS = ['book_core_md5', 'nonpilot_book_full_md5', 'movie_full_md5', 'alias_identity_md5',
  'source_identity_md5', 'nonpilot_source_full_md5'];
export const FALLBACK_REASONS = ['edition-missing', 'edition-language', 'edition-rights', 'edition-unsuitable'];
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)
  && Number.isFinite(Date.parse(value));

export function normalizeDescription(field) {
  if (field == null) return { status: 'missing' };
  let raw;
  if (typeof field === 'string') raw = field;
  else if (object(field) && Object.keys(field).sort().join(',') === 'type,value'
    && field.type === '/type/text' && typeof field.value === 'string') raw = field.value;
  else return { status: 'invalid-type' };
  if (Buffer.byteLength(raw, 'utf8') > 32768) return { status: 'raw-too-large' };
  // Reject malformed UTF-16 instead of hashing a replacement character silently.
  if (!raw.isWellFormed()) return { status: 'invalid-unicode' };
  const text = raw.normalize('NFC').replace(/\r\n?/g, '\n')
    .replace(/[\p{Cc}\p{Cf}]/gu, c => c === '\n' ? '\n' : ' ')
    .split('\n').map(line => line.replace(/[^\S\n]+/gu, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return { status: 'missing' };
  // Display plain text only: HTML/entities, Markdown links/headings/lists/emphasis,
  // and bare URLs require a separate editorial policy, never silent stripping.
  if (/<[^>]*>|&(?:#\d+|#x[\da-f]+|[a-z]+);|https?:\/\/|www\.|\[[^\]]*\]\(|(^|\n)\s*(?:#{1,6}\s|[-*+]\s|>\s)|[*_`]/im.test(text))
    return { status: 'markup-or-url' };
  const length = [...text].length;
  if (length < 80) return { status: 'too-short' };
  if (length > 2000) return { status: 'too-long' };
  return { status: 'eligible', text, textSha256: sha256(text), length };
}

// Ordered implementation-owned reasons stay private; the existing rejection
// code and exact identity policy remain unchanged for every caller.
export function providerIdentityFailure(record, candidate, kind) {
  if (!object(record)) return 'record-not-object';
  const key = kind === 'edition' ? `/books/${candidate.editionId}` : `/works/${candidate.workId}`;
  if (record.key !== key) return 'record-key-mismatch';
  if (record.type?.key !== `/type/${kind}`) return 'record-type-mismatch';
  if (Object.hasOwn(record, 'location')) return 'record-location-present';
  return null;
}

export function inspectRecord(raw, candidate, kind, fetchedAt) {
  requireValue(['edition', 'work'].includes(kind) && timestamp(fetchedAt), 'invalid-record-context');
  const key = kind === 'edition' ? `/books/${candidate.editionId}` : `/works/${candidate.workId}`;
  const base = { key, fetchedAt };
  if (raw === null) return { ...base, status: 'missing', recordSha256: null,
    sourceRevision: null, sourceModifiedAt: null, description: { status: 'missing' } };
  requireValue(typeof raw === 'string' && Buffer.byteLength(raw) <= 1048576, 'record-too-large');
  let record;
  try { record = JSON.parse(raw); } catch { throw new Error('malformed-provider-json'); }
  const predicate = providerIdentityFailure(record, candidate, kind);
  if (predicate) {
    const error = new Error('provider-identity-mismatch');
    Object.defineProperty(error, 'identityPredicate', { value: predicate });
    throw error;
  }
  if (kind === 'edition') requireValue(Array.isArray(record.works) && record.works.length === 1
    && record.works[0]?.key === `/works/${candidate.workId}`, 'provider-work-link-mismatch');
  const revision = record.revision ?? null;
  requireValue(revision === null || Number.isSafeInteger(revision) && revision >= 1, 'invalid-provider-revision');
  requireValue(record.last_modified == null || object(record.last_modified)
    && typeof record.last_modified.value === 'string', 'invalid-provider-modified-time');
  const modified = record.last_modified?.value ?? null;
  requireValue(modified === null || timestamp(modified), 'invalid-provider-modified-time');
  return { ...base, status: 'found', recordSha256: sha256(raw), sourceRevision: revision,
    sourceModifiedAt: modified, description: normalizeDescription(record.description) };
}

export function validateReview(decision, inspected, { fallback = false } = {}) {
  requireValue(object(decision) && decision.recordSha256 === inspected.recordSha256
    && decision.textSha256 === (inspected.description.textSha256 ?? null), 'review-hash-mismatch');
  if (fallback) {
    requireValue(FALLBACK_REASONS.includes(decision.reason), 'invalid-fallback-reason');
    requireValue(decision.reason !== 'edition-missing' || inspected.description.status === 'missing', 'invalid-missing-review');
    return;
  }
  requireValue(inspected.description.status === 'eligible', 'description-not-eligible');
  requireValue(['fi', 'en'].includes(decision.textLanguage), 'unverified-text-language');
  requireValue(decision.rights === 'approved-for-pilot' && typeof decision.basis === 'string'
    && decision.basis.trim().length >= 20 && decision.basis.length <= 1000, 'unreviewed-rights');
}

// The raw records are re-inspected whenever a packet is rebuilt. Only these
// normalized fields can reach the RPC; extra input properties are never copied.
export function buildDescriptionPacket(records, decisions, baseline) {
  requireValue(Array.isArray(decisions) && decisions.length === 10
    && baseline?.version === PILOT && Array.isArray(baseline.pilot) && baseline.pilot.length === 10,
  'invalid-pilot-review');
  requireValue(timestamp(baseline.checked_at) && baseline.preservation?.discoverable_mocks === 0
    && PRESERVATION_FIELDS.every(key => /^[0-9a-f]{32}$/.test(baseline.preservation[key])), 'invalid-preservation-baseline');
  const entries = [];
  const skipped = [];
  // Legacy checkpoints reconstruct byte-for-byte. Supplying attribution or
  // permission evidence opts the entire approved packet into the new RPC mode.
  const contract = decisions.some(row => row.choice !== 'skip'
    && (Object.hasOwn(row, 'attribution') || Object.hasOwn(row, 'permission')))
    ? ATTRIBUTED_DESCRIPTION : CONTRACT;
  for (const candidate of PILOT_ITEMS) {
    const decision = decisions.filter(row => row.position === candidate.position);
    const before = baseline.pilot.filter(row => row.position === candidate.position);
    requireValue(decision.length === 1 && before.length === 1, 'duplicate-or-missing-position');
    const review = decision[0];
    const row = before[0];
    requireValue(row.identity_matches === true && row.item_id === candidate.itemId && row.work_id === candidate.workId
      && row.edition_id === candidate.editionId && row.display_language === candidate.displayLanguage
      && UUID.test(row.source_id) && timestamp(row.updated_at) && timestamp(row.source_updated_at)
      && /^[0-9a-f]{32}$/.test(row.core_md5) && /^[0-9a-f]{32}$/.test(row.source_base_md5)
      && (row.description_sha256 === null || HASH.test(row.description_sha256)), 'baseline-identity-mismatch');
    const saved = records[candidate.position];
    requireValue(saved?.edition, 'missing-edition-preview');
    const edition = inspectRecord(saved.edition.raw, candidate, 'edition', saved.edition.fetchedAt);
    requireValue(digest(edition) === saved.edition.inspectionSha256, 'preview-hash-mismatch');
    if (review.choice === 'skip') {
      requireValue(typeof review.reason === 'string' && review.reason.trim().length > 0
        && review.reason.length <= 200, 'missing-skip-reason');
      skipped.push({ position: candidate.position, reason: review.reason });
      continue;
    }
    requireValue(['edition', 'work'].includes(review.choice), 'invalid-review-choice');
    const inspected = [edition];
    let chosen = edition;
    let reason = 'edition-description';
    if (review.choice === 'work') {
      requireValue(saved.work && saved.fallback, 'unreviewed-work-fallback');
      validateReview(saved.fallback, edition, { fallback: true });
      reason = saved.fallback.reason;
      chosen = inspectRecord(saved.work.raw, candidate, 'work', saved.work.fetchedAt);
      requireValue(digest(chosen) === saved.work.inspectionSha256, 'preview-hash-mismatch');
      inspected.push(chosen);
    }
    validateReview(review, chosen);
    const policyReview = { policy: PILOT, rights: 'approved-for-pilot', reason, basisSha256: sha256(review.basis.trim()) };
    const provenance = { contract, provider: 'open_library', workKey: `/works/${candidate.workId}`,
      recordKey: chosen.key, field: 'description', sourceUrl: `https://openlibrary.org${chosen.key}`,
      sourceRevision: chosen.sourceRevision, sourceModifiedAt: chosen.sourceModifiedAt,
      fetchedAt: chosen.fetchedAt, recordSha256: chosen.recordSha256, textSha256: chosen.description.textSha256,
      textLanguage: review.textLanguage, review: policyReview };
    requireValue(HASH.test(provenance.recordSha256), 'invalid-record-hash');
    let permission;
    if (contract === ATTRIBUTED_DESCRIPTION) {
      const attribution = readDescriptionAttribution(review.attribution, provenance.textSha256, provenance.recordSha256);
      requireValue(attribution, 'invalid-description-attribution');
      requireValue(object(review.permission)
        && Object.keys(review.permission).sort().join(',') === 'evidenceSha256,intendedUse'
        && typeof review.permission.evidenceSha256 === 'string'
        && HASH.test(review.permission.evidenceSha256)
        && review.permission.intendedUse === DESCRIPTION_PILOT_USE, 'unreviewed-description-permission');
      provenance.attribution = attribution;
      permission = { ...review.permission, recordSha256: provenance.recordSha256,
        textSha256: provenance.textSha256, attribution };
    }
    entries.push({ position: candidate.position, expectedItemId: candidate.itemId, expectedSourceId: row.source_id,
      expectedItemUpdatedAt: row.updated_at, expectedSourceUpdatedAt: row.source_updated_at,
      workId: candidate.workId, editionId: candidate.editionId, description: chosen.description.text, provenance,
      enrichment: { contract, records: inspected.map(({ description: _description, ...ref }) => ref),
        review: { ...policyReview, basis: review.basis.trim() }, ...(permission ? { permission } : {}) } });
  }
  return { contract, pilot: PILOT, baselineSha256: digest(baseline), entries, skipped };
}

// Amend only a completed local review, never a provider run or an attempted write.
// Old decisions/baselines remain intact and each successor binds its exact parent.
export function validateReviewHistory(state) {
  const history = state.reviewHistory === undefined ? [] : state.reviewHistory;
  requireValue(Array.isArray(history) && object(state.review), 'invalid-review-history');
  let previous;
  for (const review of [...history, state.review]) {
    requireValue(object(review), 'invalid-review-history');
    const packet = buildDescriptionPacket(state.records, review.decisions, review.baseline);
    requireValue(digest(packet) === review.packetSha256
      && digest(review.packet) === review.packetSha256, 'packet-hash-mismatch');
    if (previous) {
      requireValue(review.amendment?.contract === REVIEW_AMENDMENT
        && review.amendment.previousReviewSha256 === digest(previous)
        && typeof review.amendment.reason === 'string'
        && review.amendment.reason.trim().length >= 20 && review.amendment.reason.length <= 1000
        && timestamp(previous.reviewedAt) && timestamp(review.reviewedAt)
        && Date.parse(review.reviewedAt) >= Date.parse(previous.reviewedAt), 'invalid-review-history');
    } else requireValue(!Object.hasOwn(review, 'amendment'), 'invalid-review-history');
    previous = review;
  }
}

export function amendDescriptionReview(state, amendment, baseline, reviewedAt = new Date().toISOString()) {
  requireValue(state?.pilot === PILOT && state.manifestSha256 === digest(PILOT_ITEMS), 'invalid-run-manifest');
  requireValue(state.status === 'reviewed' && !Object.hasOwn(state, 'failure'), 'run-not-reviewed');
  requireValue(Array.isArray(state.batches) && state.batches.length === 0, 'review-after-write-attempt');
  requireValue(object(amendment) && Object.keys(amendment).sort().join(',')
    === 'contract,decisions,expectedReviewSha256,reason'
    && amendment.contract === REVIEW_AMENDMENT && HASH.test(amendment.expectedReviewSha256)
    && typeof amendment.reason === 'string' && amendment.reason.trim().length >= 20
    && amendment.reason.length <= 1000, 'invalid-review-amendment');
  validateReviewHistory(state);
  requireValue(digest(state.review) === amendment.expectedReviewSha256, 'review-parent-mismatch');
  requireValue(timestamp(reviewedAt) && timestamp(state.review.reviewedAt)
    && Date.parse(reviewedAt) >= Date.parse(state.review.reviewedAt), 'invalid-review-time');
  requireValue(timestamp(baseline?.checked_at)
    && Date.parse(baseline.checked_at) >= Date.parse(state.review.baseline.checked_at), 'invalid-baseline-time');

  // Inspect every saved record, including Work records excluded by a skip.
  // The attempt ledger must still account for every record without refunds.
  requireValue(object(state.records) && Object.keys(state.records).length === PILOT_ITEMS.length
    && Array.isArray(state.attempts) && state.attempts.length <= 20, 'invalid-preview-ledger');
  let recordCount = 0;
  for (const candidate of PILOT_ITEMS) {
    const saved = state.records[candidate.position];
    requireValue(object(saved) && saved.edition
      && Object.keys(saved).every(key => ['edition', 'work', 'fallback'].includes(key)), 'invalid-preview-ledger');
    for (const kind of ['edition', 'work']) if (saved[kind]) {
      const record = saved[kind];
      const inspected = inspectRecord(record.raw, candidate, kind, record.fetchedAt);
      requireValue(digest(inspected) === record.inspectionSha256, 'preview-hash-mismatch');
      const attempts = state.attempts.filter(row => row.position === candidate.position && row.kind === kind);
      requireValue(attempts.length === 1 && attempts[0].status === inspected.status
        && timestamp(attempts[0].startedAt)
        && Date.parse(attempts[0].startedAt) <= Date.parse(record.fetchedAt), 'invalid-preview-ledger');
      recordCount++;
    }
    if (saved.work || saved.fallback) {
      requireValue(saved.work && saved.fallback, 'unreviewed-work-fallback');
      validateReview(saved.fallback, inspectRecord(saved.edition.raw, candidate, 'edition', saved.edition.fetchedAt), { fallback: true });
    }
  }
  requireValue(recordCount === state.attempts.length, 'invalid-preview-ledger');
  const packet = buildDescriptionPacket(state.records, amendment.decisions, baseline);
  requireValue(digest(amendment.decisions) !== digest(state.review.decisions)
    || digest(baseline) !== digest(state.review.baseline), 'review-unchanged');
  return { ...structuredClone(state), reviewHistory: [...structuredClone(state.reviewHistory ?? []), structuredClone(state.review)],
    review: { decisions: structuredClone(amendment.decisions), baseline: structuredClone(baseline), packet,
      packetSha256: digest(packet), reviewedAt, amendment: { contract: REVIEW_AMENDMENT,
        previousReviewSha256: amendment.expectedReviewSha256, reason: amendment.reason.trim() } } };
}

export function verifyDescriptionReadback(state, readback) {
  const batch = state.batches.at(-1);
  requireValue(state.status === 'reviewed' && batch?.status === 'completed', 'run-not-verifiable');
  if (state.reviewHistory !== undefined || state.review?.amendment) validateReviewHistory(state);
  const before = state.review.baseline;
  const packet = buildDescriptionPacket(state.records, state.review.decisions, before);
  requireValue(digest(packet) === state.review.packetSha256, 'packet-hash-mismatch');
  requireValue(readback?.version === PILOT && Array.isArray(readback.pilot) && readback.pilot.length === 10
    && timestamp(readback.checked_at) && Date.parse(readback.checked_at) >= Date.parse(batch.startedAt), 'invalid-readback-checkpoint');
  requireValue(digest(readback.preservation) === digest(before.preservation), 'unexpected-catalog-drift');
  const applied = new Set(state.batches.filter(row => row.status === 'completed').flatMap(row => row.itemIds));
  for (const old of before.pilot) {
    const matches = readback.pilot.filter(row => row.position === old.position);
    requireValue(matches.length === 1, 'invalid-readback-position');
    const current = matches[0];
    requireValue(current.identity_matches === true && ['item_id', 'source_id', 'work_id', 'edition_id', 'display_language',
      'core_md5', 'source_base_md5'].every(key => current[key] === old[key])
      && timestamp(current.updated_at) && timestamp(current.source_updated_at), 'unexpected-pilot-drift');
    if (applied.has(current.item_id)) {
      const expected = packet.entries.find(entry => entry.expectedItemId === current.item_id);
      const identity = value => {
        requireValue(object(value), 'missing-readback-provenance');
        const { fetchedAt: _fetchedAt, recordSha256: _recordSha256, ...rest } = value;
        return rest;
      };
      requireValue(expected && current.description_sha256 === expected.provenance.textSha256
        && digest(identity(current.description_provenance)) === digest(identity(expected.provenance))
        && current.previous_enrichment?.contract === packet.contract
        && digest(current.previous_enrichment.review) === digest(expected.enrichment.review)
        && (packet.contract !== ATTRIBUTED_DESCRIPTION
          || object(current.previous_enrichment.permission)
            && digest(current.previous_enrichment.permission) === digest(expected.enrichment.permission)), 'unexpected-description-readback');
    } else requireValue(['description_sha256', 'description_provenance', 'previous_enrichment', 'updated_at', 'source_updated_at']
      .every(key => digest(current[key]) === digest(old[key])), 'unexpected-unapplied-pilot-change');
  }
  batch.verification = { readbackSha256: digest(readback), checkedAt: readback.checked_at };
  if (batch.batch === 2) state.status = 'completed';
}

export async function readBoundedResponse(response, maximum) {
  requireValue(response.body?.getReader, 'missing-response-body');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      requireValue(length <= maximum, 'response-too-large');
      chunks.push(value);
    }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { throw new Error('invalid-response-encoding'); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function validateAcknowledgement(value, entries) {
  requireValue(Array.isArray(value) && value.length === entries.length, 'unknown-write-outcome');
  for (const [index, entry] of entries.entries()) {
    const rows = value.filter(row => row?.input_index === index + 1);
    requireValue(rows.length === 1 && rows[0].item_id === entry.expectedItemId
      && ['updated', 'unchanged'].includes(rows[0].outcome), 'unknown-write-outcome');
  }
  return { updated: value.filter(row => row.outcome === 'updated').length,
    unchanged: value.filter(row => row.outcome === 'unchanged').length };
}
