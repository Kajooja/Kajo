import { describe, expect, it } from 'vitest';

import { getBootstrapEvidenceRevision } from '../discovery/predictionRefresh';

import {
  appendProfileCalibrationCandidates,
  commitProfileCalibration,
  mapProfileBootstrapStatus,
  mapProfileCalibrationCandidates,
  shouldOfferProfileCalibration,
} from './profileCalibrationOperations';

describe('profileCalibrationOperations', () => {
  it('maps the bounded cold-start status and offers profiling only when needed', () => {
    const status = mapProfileBootstrapStatus({
      profileId: 'profile-1',
      minimumStrongEvidence: 6,
      initialCandidateCount: 12,
      maximumCandidateCount: 24,
      strongEvidenceCount: 2,
      importedStrongCount: 1,
      calibrationRatingCount: 0,
      nativeStrongCount: 1,
      needsCalibration: true,
      realMovieCount: 30,
      realBookCount: 30,
      calibrationAvailable: true,
      priorVersion: 'cold-start-prior-v1',
      version: 'cold-start-v1',
    });

    expect(status).toMatchObject({
      profileId: 'profile-1',
      minimumStrongEvidence: 6,
      initialCandidateCount: 12,
      maximumCandidateCount: 24,
      needsCalibration: true,
      calibrationAvailable: true,
      priorVersion: 'cold-start-prior-v1',
    });
    expect(status && shouldOfferProfileCalibration(status)).toBe(true);
    expect(
      status &&
        shouldOfferProfileCalibration({ ...status, calibrationAvailable: false }),
    ).toBe(false);
    expect(
      status && shouldOfferProfileCalibration({ ...status, needsCalibration: false }),
    ).toBe(false);
  });

  it('accepts real catalog candidates without requiring an image', () => {
    const items = mapProfileCalibrationCandidates([
      {
        itemId: 'item-1',
        itemType: 'MOVIE',
        title: 'Arrival',
        description: null,
        tags: ['science-fiction'],
        creators: ['Denis Villeneuve'],
        releaseYear: 2016,
        imageUrl: null,
        originalLanguage: 'en',
        priorScore: 0.82,
      },
    ]);

    expect(items).toEqual([
      {
        id: 'item-1',
        itemType: 'MOVIE',
        title: 'Arrival',
        tags: ['science-fiction'],
        creators: ['Denis Villeneuve'],
        releaseYear: 2016,
        originalLanguage: 'en',
      },
    ]);
  });

  it('keeps optional image metadata when available', () => {
    const items = mapProfileCalibrationCandidates([
      {
        itemId: 'item-2',
        itemType: 'BOOK',
        title: 'Dune',
        description: 'A desert epic.',
        tags: ['science-fiction'],
        creators: ['Frank Herbert'],
        releaseYear: 1965,
        imageUrl: 'https://example.com/dune.jpg',
        originalLanguage: 'en',
      },
    ]);

    expect(items?.[0]).toMatchObject({
      id: 'item-2',
      imageUrl: 'https://example.com/dune.jpg',
      description: 'A desert epic.',
    });
  });

  it('fails closed on malformed payloads', () => {
    expect(mapProfileBootstrapStatus({ needsCalibration: true })).toBeNull();
    expect(
      mapProfileCalibrationCandidates([{ itemId: 'x', itemType: 'GAME' }]),
    ).toBeNull();
  });

  it('preserves presented identity/order and appends only bounded new candidates', () => {
    const presented = mapProfileCalibrationCandidates([
      { itemId: 'a', itemType: 'MOVIE', title: 'Presented A', tags: [], creators: [] },
      { itemId: 'b', itemType: 'BOOK', title: 'Presented B', tags: [], creators: [] },
    ])!;
    const candidates = mapProfileCalibrationCandidates([
      { itemId: 'b', itemType: 'BOOK', title: 'Changed B', tags: [], creators: [] },
      { itemId: 'c', itemType: 'MOVIE', title: 'New C', tags: [], creators: [] },
      { itemId: 'a', itemType: 'MOVIE', title: 'Changed A', tags: [], creators: [] },
      { itemId: 'c', itemType: 'MOVIE', title: 'Duplicate C', tags: [], creators: [] },
      { itemId: 'd', itemType: 'BOOK', title: 'New D', tags: [], creators: [] },
    ])!;
    const result = appendProfileCalibrationCandidates(presented, candidates, 3);
    expect(result.map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(result[0]).toBe(presented[0]);
    expect(result[1]).toBe(presented[1]);
    expect(result[2]?.title).toBe('New C');
    expect(presented).toHaveLength(2);
    expect(appendProfileCalibrationCandidates([], candidates, 4).map(item => item.id))
      .toEqual(['b', 'c', 'a', 'd']);
  });
});


it('refreshes bootstrap evidence only after a successful calibration commit', async () => {
  const before = getBootstrapEvidenceRevision();
  const responses = Array.from({ length: 6 }, (_, index) => ({ itemId: `item-${index}`, rating: 8 }));
  await commitProfileCalibration(async () => ({ data: { ratingCount: 6, version: 'cold-start-v1' }, error: null }), 'profile-1', responses, 6);
  expect(getBootstrapEvidenceRevision()).toBe(before + 1);
  await commitProfileCalibration(async () => ({ data: null, error: { message: 'denied' } }), 'profile-1', responses, 6);
  expect(getBootstrapEvidenceRevision()).toBe(before + 1);
});
