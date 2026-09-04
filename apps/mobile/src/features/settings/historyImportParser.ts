export type HistoryImportProvider =
  | 'LETTERBOXD'
  | 'IMDB'
  | 'STORYGRAPH'
  | 'GOODREADS'
  | 'KAJO_CSV';

export type HistoryImportKind = 'MOVIE' | 'BOOK';
export type ImportEvidenceKind = 'RATED' | 'CONSUMED' | 'SAVED';

export interface NormalizedHistoryImportRow {
  sourceRowKey: string;
  itemType: HistoryImportKind;
  title: string;
  releaseYear?: number;
  creators: string[];
  externalIds: Record<string, string>;
  evidenceKind: ImportEvidenceKind;
  rating?: number;
  sourceOccurredAt?: string;
  sourceMetadata: Record<string, unknown>;
}

export interface ParsedHistoryImport {
  provider: HistoryImportProvider;
  datasetKind: string;
  fingerprint: string;
  rows: NormalizedHistoryImportRow[];
  skippedRows: number;
}

export type HistoryImportParseResult =
  | { status: 'success'; import: ParsedHistoryImport }
  | { status: 'error'; message: string };

const MAX_IMPORT_ROWS = 5000;

type CsvRecord = Record<string, string>;
type RowInput = {
  provider: HistoryImportProvider;
  datasetKind: string;
  preferredKind: HistoryImportKind;
  record: CsvRecord;
  rowNumber: number;
};

export function parseHistoryImportCsv(input: {
  fileName: string;
  text: string;
  preferredKind: HistoryImportKind;
  preferredProvider?: HistoryImportProvider;
}): HistoryImportParseResult {
  const table = parseCsv(input.text);
  const headerRow = table[0];
  if (!headerRow || table.length < 2) {
    return { status: 'error', message: 'CSV-tiedostossa ei ole tuotavia rivejä.' };
  }

  const headers = headerRow.map(normalizeHeader);
  const records = table
    .slice(1)
    .filter((row) => row.some((value) => value.trim() !== ''));
  if (records.length > MAX_IMPORT_ROWS) {
    return {
      status: 'error',
      message: `Yksi tuonti voi sisältää enintään ${MAX_IMPORT_ROWS} riviä.`,
    };
  }

  const provider =
    input.preferredProvider ??
    inferProvider(headers, input.fileName, input.preferredKind);
  const datasetKind = inferDatasetKind(provider, input.fileName, headers);
  const rows: NormalizedHistoryImportRow[] = [];
  let skippedRows = 0;

  records.forEach((values, index) => {
    const normalized = normalizeProviderRow({
      provider,
      datasetKind,
      preferredKind: input.preferredKind,
      record: recordFromRow(headers, values),
      rowNumber: index + 2,
    });
    if (normalized) rows.push(normalized);
    else skippedRows += 1;
  });

  if (rows.length === 0) {
    return {
      status: 'error',
      message:
        'Tiedostosta ei löytynyt Kajoon sopivaa katselu- tai lukuhistoriaa.',
    };
  }

  return {
    status: 'success',
    import: {
      provider,
      datasetKind,
      fingerprint: createFileFingerprint(input.fileName, input.text),
      rows,
      skippedRows,
    },
  };
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);
    if (quoted) {
      if (character === '"' && source.charAt(index + 1) === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function normalizeProviderRow(input: RowInput): NormalizedHistoryImportRow | null {
  switch (input.provider) {
    case 'LETTERBOXD':
      return normalizeLetterboxd(input.record, input.datasetKind, input.rowNumber);
    case 'IMDB':
      return normalizeImdb(input.record, input.datasetKind, input.rowNumber);
    case 'GOODREADS':
      return normalizeGoodreads(input.record, input.rowNumber);
    case 'STORYGRAPH':
      return normalizeStoryGraph(input.record, input.rowNumber);
    case 'KAJO_CSV':
      return normalizeKajoCsv(
        input.record,
        input.preferredKind,
        input.rowNumber,
      );
    default:
      return null;
  }
}

function normalizeLetterboxd(
  record: CsvRecord,
  datasetKind: string,
  rowNumber: number,
): NormalizedHistoryImportRow | null {
  const title = read(record, 'name', 'title');
  if (!title) return null;
  const stars = parseNumber(read(record, 'rating'));
  const rating = stars === null ? null : clampRating(Math.round(stars * 2));
  const evidenceKind: ImportEvidenceKind =
    rating !== null
      ? 'RATED'
      : datasetKind.includes('WATCHLIST')
        ? 'SAVED'
        : 'CONSUMED';

  return makeRow({
    rowNumber,
    itemType: 'MOVIE',
    title,
    releaseYear: parseYear(read(record, 'year')),
    evidenceKind,
    rating,
    sourceOccurredAt: normalizeDate(
      read(record, 'watched date', 'date rated', 'date'),
    ),
    externalIds: {},
    creators: [],
    sourceMetadata: compact({
      letterboxdUri: read(record, 'letterboxd uri', 'uri'),
      rewatch: read(record, 'rewatch'),
      tags: read(record, 'tags'),
    }),
  });
}

function normalizeImdb(
  record: CsvRecord,
  datasetKind: string,
  rowNumber: number,
): NormalizedHistoryImportRow | null {
  const title = read(record, 'title', 'name');
  if (!title) return null;
  const ratingValue = parseNumber(read(record, 'your rating', 'rating'));
  const rating =
    ratingValue === null ? null : clampRating(Math.round(ratingValue));
  const savedDataset =
    datasetKind.includes('WATCHLIST') || datasetKind.includes('LIST');
  const evidenceKind: ImportEvidenceKind =
    rating !== null
      ? 'RATED'
      : datasetKind.includes('CHECKIN')
        ? 'CONSUMED'
        : savedDataset
          ? 'SAVED'
          : 'CONSUMED';
  const imdbId = normalizeImdbId(
    read(record, 'const', 'imdb id', 'imdb title'),
  );

  return makeRow({
    rowNumber,
    itemType: 'MOVIE',
    title,
    releaseYear: parseYear(read(record, 'year')),
    evidenceKind,
    rating,
    sourceOccurredAt: normalizeDate(
      read(record, 'date rated', 'created', 'date'),
    ),
    externalIds: imdbId ? { imdb_title: imdbId } : {},
    creators: splitPeople(read(record, 'directors', 'director')),
    sourceMetadata: compact({
      imdbUrl: read(record, 'url'),
      titleType: read(record, 'title type'),
      genres: read(record, 'genres'),
    }),
  });
}

function normalizeGoodreads(
  record: CsvRecord,
  rowNumber: number,
): NormalizedHistoryImportRow | null {
  const title = read(record, 'title');
  if (!title) return null;
  const shelf = read(record, 'exclusive shelf', 'bookshelves').toLowerCase();
  const rawRating = parseNumber(read(record, 'my rating', 'rating'));
  const rating =
    rawRating !== null && rawRating > 0
      ? clampRating(Math.round(rawRating * 2))
      : null;
  const evidenceKind: ImportEvidenceKind =
    rating !== null
      ? 'RATED'
      : shelf.includes('to-read') || shelf.includes('want-to-read')
        ? 'SAVED'
        : 'CONSUMED';

  return makeRow({
    rowNumber,
    itemType: 'BOOK',
    title,
    releaseYear: parseYear(
      read(record, 'original publication year', 'year published'),
    ),
    evidenceKind,
    rating,
    sourceOccurredAt: normalizeDate(read(record, 'date read', 'date added')),
    externalIds: compactStrings({
      isbn13: normalizeIsbn(read(record, 'isbn13')),
      isbn10: normalizeIsbn(read(record, 'isbn')),
    }),
    creators: splitPeople(read(record, 'author', 'authors')),
    sourceMetadata: compact({ shelf }),
  });
}

function normalizeStoryGraph(
  record: CsvRecord,
  rowNumber: number,
): NormalizedHistoryImportRow | null {
  const title = read(record, 'title');
  if (!title) return null;
  const status = read(record, 'read status', 'status').toLowerCase();
  const rawRating = parseNumber(read(record, 'star rating', 'rating'));
  const rating =
    rawRating !== null && rawRating > 0
      ? clampRating(Math.round(rawRating * 2))
      : null;
  const evidenceKind: ImportEvidenceKind =
    rating !== null
      ? 'RATED'
      : status.includes('to read') ||
          status.includes('to-read') ||
          status.includes('want')
        ? 'SAVED'
        : 'CONSUMED';
  const isbn = normalizeIsbn(read(record, 'isbn/uid', 'isbn13', 'isbn'));

  return makeRow({
    rowNumber,
    itemType: 'BOOK',
    title,
    releaseYear: parseYear(read(record, 'publication year', 'year')),
    evidenceKind,
    rating,
    sourceOccurredAt: normalizeDate(
      read(record, 'last date read', 'date read', 'date added'),
    ),
    externalIds: isbn
      ? isbn.length === 13
        ? { isbn13: isbn }
        : { isbn10: isbn }
      : {},
    creators: splitPeople(read(record, 'authors', 'author')),
    sourceMetadata: compact({ status, format: read(record, 'format') }),
  });
}

function normalizeKajoCsv(
  record: CsvRecord,
  preferredKind: HistoryImportKind,
  rowNumber: number,
): NormalizedHistoryImportRow | null {
  const title = read(record, 'title', 'name');
  if (!title) return null;
  const typeText = read(record, 'item type', 'item_type', 'type').toUpperCase();
  const itemType: HistoryImportKind =
    typeText === 'BOOK' || typeText === 'MOVIE' ? typeText : preferredKind;
  const rawRating = parseNumber(read(record, 'rating'));
  const rating = rawRating === null ? null : clampRating(Math.round(rawRating));
  const consumed = isTruthy(read(record, 'consumed', 'watched', 'read'));
  const saved = isTruthy(read(record, 'saved', 'watchlist', 'to read'));
  const evidenceKind: ImportEvidenceKind =
    rating !== null ? 'RATED' : consumed ? 'CONSUMED' : saved ? 'SAVED' : 'CONSUMED';

  return makeRow({
    rowNumber,
    itemType,
    title,
    releaseYear: parseYear(
      read(record, 'release year', 'release_year', 'year'),
    ),
    evidenceKind,
    rating,
    sourceOccurredAt: normalizeDate(
      read(record, 'source occurred at', 'date', 'date read', 'date watched'),
    ),
    externalIds: compactStrings({
      imdb_title: normalizeImdbId(
        read(record, 'imdb title', 'imdb_title', 'imdb id'),
      ),
      tmdb_movie: cleanIdentifier(
        read(record, 'tmdb movie', 'tmdb_movie', 'tmdb id'),
      ),
      isbn13: normalizeIsbn(read(record, 'isbn13')),
      isbn10: normalizeIsbn(read(record, 'isbn10', 'isbn')),
      open_library_work: cleanIdentifier(
        read(record, 'open library work', 'open_library_work'),
      ),
      open_library_edition: cleanIdentifier(
        read(record, 'open library edition', 'open_library_edition'),
      ),
    }),
    creators: splitPeople(read(record, 'creators', 'authors', 'director')),
    sourceMetadata: {},
  });
}

function makeRow(input: {
  rowNumber: number;
  itemType: HistoryImportKind;
  title: string;
  releaseYear: number | null;
  evidenceKind: ImportEvidenceKind;
  rating: number | null;
  sourceOccurredAt: string | null;
  externalIds: Record<string, string>;
  creators: string[];
  sourceMetadata: Record<string, unknown>;
}): NormalizedHistoryImportRow {
  const identity = `${input.itemType}|${input.title}|${input.releaseYear ?? ''}|${JSON.stringify(input.externalIds)}`;
  return {
    sourceRowKey: `${input.rowNumber}:${hash32(identity).toString(16).padStart(8, '0')}`,
    itemType: input.itemType,
    title: input.title.trim(),
    ...(input.releaseYear !== null ? { releaseYear: input.releaseYear } : {}),
    creators: input.creators,
    externalIds: input.externalIds,
    evidenceKind: input.evidenceKind,
    ...(input.rating !== null ? { rating: input.rating } : {}),
    ...(input.sourceOccurredAt
      ? { sourceOccurredAt: input.sourceOccurredAt }
      : {}),
    sourceMetadata: input.sourceMetadata,
  };
}

function inferProvider(
  headers: string[],
  fileName: string,
  kind: HistoryImportKind,
): HistoryImportProvider {
  const names = new Set(headers);
  const name = fileName.toLowerCase();
  if (kind === 'MOVIE') {
    if (names.has('letterboxd uri') || name.includes('letterboxd')) {
      return 'LETTERBOXD';
    }
    if (
      names.has('const') ||
      names.has('your rating') ||
      names.has('title type') ||
      name.includes('imdb')
    ) {
      return 'IMDB';
    }
    return 'KAJO_CSV';
  }
  if (names.has('exclusive shelf') || names.has('book id')) return 'GOODREADS';
  if (
    names.has('read status') ||
    names.has('star rating') ||
    names.has('isbn/uid')
  ) {
    return 'STORYGRAPH';
  }
  return 'KAJO_CSV';
}

function inferDatasetKind(
  provider: HistoryImportProvider,
  fileName: string,
  headers: string[],
): string {
  const name = fileName.toLowerCase();
  if (provider === 'LETTERBOXD') {
    if (name.includes('watchlist')) return 'WATCHLIST';
    if (name.includes('ratings')) return 'RATINGS';
    if (name.includes('diary')) return 'DIARY';
    if (name.includes('watched')) return 'WATCHED';
    if (headers.includes('rewatch')) return 'DIARY';
    return headers.includes('rating') ? 'RATINGS' : 'WATCHED';
  }
  if (provider === 'IMDB') {
    if (name.includes('rating')) return 'RATINGS';
    if (name.includes('check')) return 'CHECKINS';
    if (name.includes('watchlist')) return 'WATCHLIST';
    return headers.includes('your rating') ? 'RATINGS' : 'LIST';
  }
  return provider === 'KAJO_CSV' ? 'HISTORY' : 'LIBRARY';
}

function parseYear(value: string): number | null {
  const yearText = value.match(/\b(1[4-9]\d{2}|20\d{2}|21\d{2})\b/)?.[1];
  if (!yearText) return null;
  const year = Number(yearText);
  return year >= 1400 && year <= new Date().getUTCFullYear() + 2 ? year : null;
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function normalizeIsbn(value: string): string | null {
  const normalized = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  return normalized.length === 10 || normalized.length === 13 ? normalized : null;
}

function normalizeImdbId(value: string): string | null {
  return value.trim().match(/tt\d{5,12}/i)?.[0]?.toLowerCase() ?? null;
}

function cleanIdentifier(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function splitPeople(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[;|]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(10, value));
}

function isTruthy(value: string): boolean {
  return ['1', 'true', 'yes', 'y', 'kyllä', 'read', 'watched'].includes(
    value.trim().toLowerCase(),
  );
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function recordFromRow(headers: string[], values: string[]): CsvRecord {
  return Object.fromEntries(
    headers.map((header, index) => [header, values[index]?.trim() ?? '']),
  );
}

function read(record: CsvRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[normalizeHeader(key)];
    if (value?.trim()) return value.trim();
  }
  return '';
}

function compact(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== '' && entry !== null && entry !== undefined,
    ),
  );
}

function compactStrings(
  value: Record<string, string | null>,
): Record<string, string> {
  const entries: [string, string][] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (entry) entries.push([key, entry]);
  }
  return Object.fromEntries(entries);
}

function createFileFingerprint(fileName: string, text: string): string {
  const left = hash32(`${fileName}|${text}`);
  const right = hash32(`${text.length}|${text}|${fileName}`);
  return `csv_${left.toString(16).padStart(8, '0')}${right
    .toString(16)
    .padStart(8, '0')}`;
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
