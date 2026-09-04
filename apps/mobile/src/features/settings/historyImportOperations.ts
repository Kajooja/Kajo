import type { ParsedHistoryImport } from './historyImportParser';

export const HISTORY_IMPORT_RPC = {
  create: 'create_profile_import_job_v1',
  stage: 'stage_profile_import_rows_v1',
  resolve: 'resolve_profile_import_row_v1',
  commit: 'commit_profile_import_job_v1',
  remove: 'remove_profile_import_job_v1',
  get: 'get_profile_import_job_v1',
} as const;

interface RpcResponse {
  data: unknown;
  error: { message: string } | null;
}

export type HistoryImportRpc = (
  functionName: string,
  arguments_?: Record<string, unknown>,
) => PromiseLike<RpcResponse>;

export interface HistoryImportJobRow {
  rowId: string;
  sourceRowKey: string;
  itemType: 'BOOK' | 'MOVIE';
  title: string;
  releaseYear: number | null;
  creators: string[];
  evidenceKind: 'RATED' | 'CONSUMED' | 'SAVED';
  rating: number | null;
  sourceOccurredAt: string | null;
  matchStatus: 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED' | 'SKIPPED';
  matchResolution: string | null;
  matchedItemId: string | null;
  candidateItemIds: string[];
}

export interface HistoryImportJob {
  jobId: string;
  profileId: string;
  sourceProvider: string;
  datasetKind: string;
  fileName: string | null;
  fileFingerprint: string;
  status: 'CREATED' | 'STAGED' | 'COMMITTED' | 'REMOVED';
  totalRows: number;
  matchedRows: number;
  ambiguousRows: number;
  unmatchedRows: number;
  skippedRows: number;
  committedAt: string | null;
  rows: HistoryImportJobRow[];
}

export type HistoryImportJobResult =
  | { status: 'success'; job: HistoryImportJob }
  | { status: 'error'; message: string };

const IMPORT_ERROR = 'Historian tuonti epäonnistui. Yritä uudelleen.';

export async function stageHistoryImport(
  rpc: HistoryImportRpc,
  profileId: string,
  fileName: string,
  parsed: ParsedHistoryImport,
): Promise<HistoryImportJobResult> {
  try {
    const created = await rpc(HISTORY_IMPORT_RPC.create, {
      target_profile_id: profileId,
      source_provider: parsed.provider,
      dataset_kind: parsed.datasetKind,
      file_name: fileName,
      file_fingerprint: parsed.fingerprint,
    });
    if (created.error || typeof created.data !== 'string') {
      return { status: 'error', message: IMPORT_ERROR };
    }

    const staged = await rpc(HISTORY_IMPORT_RPC.stage, {
      target_job_id: created.data,
      import_rows: parsed.rows,
    });
    if (staged.error) return { status: 'error', message: IMPORT_ERROR };
    return mapJobResult(staged.data);
  } catch {
    return { status: 'error', message: IMPORT_ERROR };
  }
}

export async function resolveHistoryImportRow(
  rpc: HistoryImportRpc,
  rowId: string,
  itemId: string | null,
): Promise<HistoryImportJobResult> {
  try {
    const response = await rpc(HISTORY_IMPORT_RPC.resolve, {
      target_row_id: rowId,
      chosen_item_id: itemId,
      skip_row: itemId === null,
    });
    if (response.error) return { status: 'error', message: IMPORT_ERROR };
    return mapJobResult(response.data);
  } catch {
    return { status: 'error', message: IMPORT_ERROR };
  }
}

export async function commitHistoryImport(
  rpc: HistoryImportRpc,
  jobId: string,
): Promise<HistoryImportJobResult> {
  try {
    const response = await rpc(HISTORY_IMPORT_RPC.commit, {
      target_job_id: jobId,
    });
    if (response.error) return { status: 'error', message: IMPORT_ERROR };
    return mapJobResult(response.data);
  } catch {
    return { status: 'error', message: IMPORT_ERROR };
  }
}

export async function removeHistoryImport(
  rpc: HistoryImportRpc,
  jobId: string,
): Promise<HistoryImportJobResult> {
  try {
    const response = await rpc(HISTORY_IMPORT_RPC.remove, {
      target_job_id: jobId,
    });
    if (response.error) return { status: 'error', message: IMPORT_ERROR };
    return mapJobResult(response.data);
  } catch {
    return { status: 'error', message: IMPORT_ERROR };
  }
}

export function mapHistoryImportJob(data: unknown): HistoryImportJob | null {
  if (!isRecord(data)) return null;
  const rows = Array.isArray(data.rows)
    ? data.rows.map(mapRow).filter((row): row is HistoryImportJobRow => row !== null)
    : [];

  if (
    typeof data.jobId !== 'string' ||
    typeof data.profileId !== 'string' ||
    typeof data.sourceProvider !== 'string' ||
    typeof data.datasetKind !== 'string' ||
    typeof data.fileFingerprint !== 'string' ||
    !isJobStatus(data.status) ||
    !isInteger(data.totalRows) ||
    !isInteger(data.matchedRows) ||
    !isInteger(data.ambiguousRows) ||
    !isInteger(data.unmatchedRows) ||
    !isInteger(data.skippedRows)
  ) return null;

  return {
    jobId: data.jobId,
    profileId: data.profileId,
    sourceProvider: data.sourceProvider,
    datasetKind: data.datasetKind,
    fileName: typeof data.fileName === 'string' ? data.fileName : null,
    fileFingerprint: data.fileFingerprint,
    status: data.status,
    totalRows: data.totalRows,
    matchedRows: data.matchedRows,
    ambiguousRows: data.ambiguousRows,
    unmatchedRows: data.unmatchedRows,
    skippedRows: data.skippedRows,
    committedAt: typeof data.committedAt === 'string' ? data.committedAt : null,
    rows,
  };
}

function mapJobResult(data: unknown): HistoryImportJobResult {
  const job = mapHistoryImportJob(data);
  return job ? { status: 'success', job } : { status: 'error', message: IMPORT_ERROR };
}

function mapRow(value: unknown): HistoryImportJobRow | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.rowId !== 'string' ||
    typeof value.sourceRowKey !== 'string' ||
    (value.itemType !== 'BOOK' && value.itemType !== 'MOVIE') ||
    typeof value.title !== 'string' ||
    !isEvidenceKind(value.evidenceKind) ||
    !isMatchStatus(value.matchStatus)
  ) return null;

  return {
    rowId: value.rowId,
    sourceRowKey: value.sourceRowKey,
    itemType: value.itemType,
    title: value.title,
    releaseYear: isInteger(value.releaseYear) ? value.releaseYear : null,
    creators: stringArray(value.creators),
    evidenceKind: value.evidenceKind,
    rating: isInteger(value.rating) ? value.rating : null,
    sourceOccurredAt: typeof value.sourceOccurredAt === 'string' ? value.sourceOccurredAt : null,
    matchStatus: value.matchStatus,
    matchResolution: typeof value.matchResolution === 'string' ? value.matchResolution : null,
    matchedItemId: typeof value.matchedItemId === 'string' ? value.matchedItemId : null,
    candidateItemIds: stringArray(value.candidateItemIds),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isJobStatus(value: unknown): value is HistoryImportJob['status'] {
  return value === 'CREATED' || value === 'STAGED' || value === 'COMMITTED' || value === 'REMOVED';
}

function isEvidenceKind(value: unknown): value is HistoryImportJobRow['evidenceKind'] {
  return value === 'RATED' || value === 'CONSUMED' || value === 'SAVED';
}

function isMatchStatus(value: unknown): value is HistoryImportJobRow['matchStatus'] {
  return value === 'MATCHED' || value === 'AMBIGUOUS' || value === 'UNMATCHED' || value === 'SKIPPED';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}
