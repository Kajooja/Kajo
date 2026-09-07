import { describe, expect, it } from 'vitest';

import {
  createLatestRequestGate,
  getBootstrapEvidenceRevision,
  subscribeToBootstrapEvidence,
  notifyBootstrapEvidenceChanged,
  getInteractionEvidenceKey,
  getPredictionRefreshDelay,
} from './predictionRefresh';

describe('Prediction refresh coordination', () => {
  it('notifies mounted slates and preserves the revision for later subscribers', () => {
    const before = getBootstrapEvidenceRevision();
    let notified = 0;
    const unsubscribe = subscribeToBootstrapEvidence(() => { notified += 1; });
    notifyBootstrapEvidenceChanged();
    expect(notified).toBe(1);
    expect(getBootstrapEvidenceRevision()).toBe(before + 1);
    unsubscribe();
    notifyBootstrapEvidenceChanged();
    expect(notified).toBe(1);
    expect(getBootstrapEvidenceRevision()).toBe(before + 2);
  });
  it('accepts only the latest response token', () => {
    const gate = createLatestRequestGate();
    const first = gate.start();
    const second = gate.start();

    expect(gate.isLatest(first)).toBe(false);
    expect(gate.isLatest(second)).toBe(true);
  });

  it('loads the first hosted slate immediately and only debounces later reranks', () => {
    expect(getPredictionRefreshDelay(false, 600)).toBe(0);
    expect(getPredictionRefreshDelay(true, 600)).toBe(600);
  });

  it('creates a stable key independent of interaction insertion order', () => {
    const first = getInteractionEvidenceKey({
      'item-b': {
        interest: null,
        saved: true,
        consumed: false,
        rating: null,
        notInterested: false,
      },
      'item-a': {
        interest: 'LIKED',
        saved: false,
        consumed: false,
        rating: null,
        notInterested: false,
      },
    });
    const second = getInteractionEvidenceKey({
      'item-a': {
        interest: 'LIKED',
        saved: false,
        consumed: false,
        rating: null,
        notInterested: false,
      },
      'item-b': {
        interest: null,
        saved: true,
        consumed: false,
        rating: null,
        notInterested: false,
      },
    });

    expect(first).toBe(second);
    expect(
      getInteractionEvidenceKey({
        'item-a': {
          interest: 'DISLIKED',
          saved: false,
          consumed: false,
          rating: null,
          notInterested: false,
        },
        'item-b': {
          interest: null,
          saved: true,
          consumed: false,
          rating: null,
          notInterested: false,
        },
      }),
    ).not.toBe(first);
  });
});
