// Invented rows and gzip sources only. Historical values below are public
// request parameters; no captured header, raw provider row or key is retained.
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { collectFramedDumpStreams, FRAMED_ACQUISITION_CONTRACT, REVIEWED_SOURCE_PINS } from '../acquire-open-library-dumps.mjs';
import { TARGET_CONTRACT } from '../open-library-dump-descriptions.mjs';
import { constructEditionPrefixRequest } from '../seal-edition-prefix-diagnostic.mjs';
import { constructFramedDumpAcquisitionRequest, FRAMED_PREVIOUS_EDITION_DIAGNOSTIC } from '../seal-framed-dump-acquisition.mjs';
import { previousConflict } from './edition-prefix-fixture.mjs';

export const previousEditionDiagnostic = constructEditionPrefixRequest({ previousConflict,
  sourceHead: FRAMED_PREVIOUS_EDITION_DIAGNOSTIC.sourceHead,
  diagnosticLimits: { compressedBytes: 512 * 1024 ** 2, maxDecodedBytes: 3 * 1024 ** 3, maxRows: 2000000,
    lineBytes: previousConflict.limits.lineBytes, prefixBytes: 4096, timeoutMs: 600000 } });
export const frozenRequest = constructFramedDumpAcquisitionRequest({ previousEditionDiagnostic, sourceHead: 'a'.repeat(40) });
export const roster = [{ workId: 'OL101W', editionId: 'OL201M' }, { workId: 'OL102W', editionId: 'OL202M' }];
export const date = '2026-08-15T12:00:00.000';
export const header = (key = '/books/OL999999M') => `/type/edition\t${key}\t1\t${date}\t`;
export const oversized = (key, length = 4096, end = '\n') => header(key) + 'PRIVATE_DISCARDED '.repeat(length).slice(0, length) + end;
export function line(index, kind, changes = {}) {
  const pair = roster[index], type = kind === 'works' ? 'work' : 'edition';
  const key = type === 'work' ? `/works/${pair.workId}` : `/books/${pair.editionId}`;
  const record = { key, type: { key: `/type/${type}` }, revision: 1, last_modified: { value: date },
    description: 'A fictional traveller discovers a quiet valley where earlier choices continue to influence the lives of its inhabitants.',
    ...(type === 'edition' ? { works: [{ key: `/works/${pair.workId}` }] } : {}), ...changes };
  return [`/type/${type}`, key, 1, date, JSON.stringify(record)].join('\t') + '\n';
}
const hash = (data, algorithm) => createHash(algorithm).update(data).digest('hex');
export function streamFixture({ works = line(0, 'works', { location: '/works/OL999W' }) + line(1, 'works'),
  editions = oversized() + line(0, 'editions') + line(1, 'editions'), limits = {}, chunkSize = 17 } = {}) {
  const texts = { works, editions }, bytes = {}, sourcePins = {}, calls = [];
  for (const kind of ['works', 'editions']) {
    bytes[kind] = gzipSync(texts[kind]);
    sourcePins[kind] = { ...REVIEWED_SOURCE_PINS[kind], bytes: bytes[kind].length,
      md5: hash(bytes[kind], 'md5'), sha1: hash(bytes[kind], 'sha1') };
  }
  const request = { ...structuredClone(frozenRequest), roster: structuredClone(roster), sourcePins,
    limits: { ...frozenRequest.limits, totalCompressedBytes: bytes.works.length + bytes.editions.length,
      maxDecodedBytes: 1024 ** 2, maxRows: 100, lineBytes: 1024, retainedBytes: 65536, timeoutMs: 5000, ...limits },
    conflictPolicy: { ...frozenRequest.conflictPolicy, maxConflictedPairs: 1, maxDiagnosticBytes: 8192 } };
  const openSource = async (kind, source, _options, onRequest) => {
    onRequest(); calls.push(kind);
    return { status: 200, headers: { 'content-length': String(bytes[kind].length) }, url: source.url, redirects: [],
      body: Readable.from((function* () { for (let i = 0; i < bytes[kind].length; i += chunkSize) yield bytes[kind].subarray(i, i + chunkSize); })()) };
  };
  const run = async (options = {}, collect = collectFramedDumpStreams) => ({ contract: FRAMED_ACQUISITION_CONTRACT,
    ...await collect({ ...request, openSource, ...options }), sourceEvidence: request.sourceEvidence,
    approved: 0, databaseWrites: 0, individualProviderRequests: 0, modelAdmissions: 0, rights: 'unreviewed' });
  return { request, texts, bytes, calls, openSource, run };
}
export const snapshot = (checkedAt = '2026-09-24T10:00:00Z') => ({ contract: TARGET_CONTRACT, checkedAt,
  targets: roster.map((pair, index) => ({ ...pair, itemId: `0000000${index + 1}-1111-4111-8111-111111111111`,
    sourceId: `0000001${index + 1}-1111-4111-8111-111111111111`, displayLanguage: 'eng',
    itemUpdatedAt: '2026-09-23T10:00:00Z', sourceUpdatedAt: '2026-09-23T10:00:00Z',
    descriptionSha256: null, managedDescription: false, identityMatches: true })) });
