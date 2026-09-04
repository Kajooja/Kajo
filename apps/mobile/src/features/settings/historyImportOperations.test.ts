import { describe, expect, it } from 'vitest';

import { mapHistoryImportJob } from './historyImportOperations';

describe('historyImportOperations', () => {
  it('maps a staged import summary and unresolved rows', () => {
    const job = mapHistoryImportJob({
      jobId: 'job-1',
      profileId: 'profile-1',
      sourceProvider: 'IMDB',
      datasetKind: 'RATINGS',
      fileName: 'ratings.csv',
      fileFingerprint: 'csv_1234567890abcdef',
      status: 'STAGED',
      totalRows: 3,
      matchedRows: 1,
      ambiguousRows: 1,
      unmatchedRows: 1,
      skippedRows: 0,
      committedAt: null,
      rows: [
        {
          rowId: 'row-1',
          sourceRowKey: '2:abc',
          itemType: 'MOVIE',
          title: 'Arrival',
          releaseYear: 2016,
          creators: ['Denis Villeneuve'],
          evidenceKind: 'RATED',
          rating: 9,
          sourceOccurredAt: '2026-01-01T00:00:00.000Z',
          matchStatus: 'AMBIGUOUS',
          matchResolution: 'TITLE_COLLISION',
          matchedItemId: null,
          candidateItemIds: ['item-1', 'item-2'],
        },
      ],
    });

    expect(job).not.toBeNull();
    expect(job?.ambiguousRows).toBe(1);
    expect(job?.rows[0]).toMatchObject({
      title: 'Arrival',
      evidenceKind: 'RATED',
      rating: 9,
      candidateItemIds: ['item-1', 'item-2'],
    });
  });

  it('fails closed on malformed job payloads', () => {
    expect(mapHistoryImportJob({ status: 'STAGED' })).toBeNull();
  });
});
