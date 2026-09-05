import { describe, expect, it } from 'vitest';

import {
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
});
