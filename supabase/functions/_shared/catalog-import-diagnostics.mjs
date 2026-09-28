// Shared by the Edge handler and admin CLI. Only fixed codes and bounded
// progress belong in diagnostics; never serialize an upstream Error or body.
export const CATALOG_DIAGNOSTICS_VERSION = 'catalog-import-diagnostics-v1';

/** @typedef {'tmdb-discover'|'tmdb-find'|'tmdb-detail'|'tmdb-fallback'|'normalize'|'catalog-upsert'|'import'} FailureStage */
/** @typedef {'http-error'|'timeout'|'network-error'|'invalid-json'|'invalid-response'|'identity-mismatch'|'ineligible-metadata'|'unexpected-error'} FailureReason */
const STAGES = ['tmdb-discover', 'tmdb-find', 'tmdb-detail', 'tmdb-fallback', 'normalize', 'catalog-upsert', 'import'];
const REASONS = ['http-error', 'timeout', 'network-error', 'invalid-json', 'invalid-response', 'identity-mismatch', 'ineligible-metadata', 'unexpected-error'];

export class CatalogImportFailure extends Error {
  /** @param {FailureStage} stage @param {FailureReason} reason @param {number|null} httpStatus */
  constructor(stage, reason, httpStatus = null) {
    super('provider-import-failed');
    this.stage = stage;
    this.reason = reason;
    this.httpStatus = httpStatus;
  }
}

/**
 * @param {unknown} error
 * @param {{ completedPages: number[], failedPage: number|null, confirmedImportedCount: number,
 * confirmedSkippedCount: number, writeOutcome: 'not-started'|'unknown' }} progress
 */
export function createImportFailureDiagnostics(error, progress) {
  const known = error instanceof CatalogImportFailure;
  return {
    version: CATALOG_DIAGNOSTICS_VERSION,
    stage: known ? error.stage : 'import',
    reason: known ? error.reason : 'unexpected-error',
    httpStatus: known ? error.httpStatus : null,
    completedPages: [...progress.completedPages],
    failedPage: progress.failedPage,
    confirmedImportedCount: progress.confirmedImportedCount,
    confirmedSkippedCount: progress.confirmedSkippedCount,
    writeOutcome: progress.writeOutcome,
  };
}

// Validate against the request before presenting server-supplied progress.
// Project only known fields so extra reflected strings never reach CLI logs.
export function readImportFailureDiagnostics(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    value.version !== CATALOG_DIAGNOSTICS_VERSION || !STAGES.includes(value.stage) ||
    !REASONS.includes(value.reason) ||
    !(value.httpStatus === null || (Number.isInteger(value.httpStatus) && value.httpStatus >= 100 && value.httpStatus <= 599)) ||
    !Array.isArray(value.completedPages) || value.completedPages.length > 3 ||
    !['not-started', 'unknown'].includes(value.writeOutcome) ||
    !Number.isInteger(value.confirmedImportedCount) || value.confirmedImportedCount < 0 ||
    !Number.isInteger(value.confirmedSkippedCount) || value.confirmedSkippedCount < 0) return null;

  if (expected.action === 'tmdb-movies-by-imdb-v1') {
    if (value.failedPage !== null || value.completedPages.length ||
      value.confirmedImportedCount || value.confirmedSkippedCount) return null;
  } else {
    const start = expected.startPage ?? 1;
    const pages = expected.pages ?? 1;
    if (value.completedPages.length >= pages ||
      value.completedPages.some((page, index) => page !== start + index) ||
      value.failedPage !== start + value.completedPages.length) return null;
  }
  if (value.confirmedImportedCount + value.confirmedSkippedCount > value.completedPages.length * 20 ||
    (value.stage === 'catalog-upsert' && value.writeOutcome !== 'unknown') ||
    (value.writeOutcome === 'unknown' && !['catalog-upsert', 'import'].includes(value.stage))) return null;

  return {
    version: value.version, stage: value.stage, reason: value.reason, httpStatus: value.httpStatus,
    completedPages: [...value.completedPages], failedPage: value.failedPage,
    confirmedImportedCount: value.confirmedImportedCount,
    confirmedSkippedCount: value.confirmedSkippedCount, writeOutcome: value.writeOutcome,
  };
}
