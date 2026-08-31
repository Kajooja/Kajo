import { describe, expect, it } from 'vitest';

import {
  createLatestRequestGate,
  getInteractionEvidenceKey,
} from './predictionRefresh';

describe('Prediction refresh coordination', () => {
  it('accepts only the latest response token', () => {
    const gate = createLatestRequestGate();
    const first = gate.start();
    const second = gate.start();

    expect(gate.isLatest(first)).toBe(false);
    expect(gate.isLatest(second)).toBe(true);
  });

  it('creates a stable key independent of interaction insertion order', () => {
    const first = getInteractionEvidenceKey({
      'item-b': { interest: null, saved: true, consumed: false },
      'item-a': { interest: 'LIKED', saved: false, consumed: false },
    });
    const second = getInteractionEvidenceKey({
      'item-a': { interest: 'LIKED', saved: false, consumed: false },
      'item-b': { interest: null, saved: true, consumed: false },
    });

    expect(first).toBe(second);
    expect(
      getInteractionEvidenceKey({
        'item-a': { interest: 'DISLIKED', saved: false, consumed: false },
        'item-b': { interest: null, saved: true, consumed: false },
      }),
    ).not.toBe(first);
  });
});
