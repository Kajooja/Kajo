import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectNativeFeatureSupport } from './inspect-native-feature-support.mjs';

const at = '2026-11-05T00:00:00Z';
function book(labels, source = true) {
  return { contract: 'catalog-feature-snapshot-v1', checkedAt: at, items: [{
    itemId: 'book', itemType: 'BOOK', itemUpdatedAt: at, tags: [], sources: source ? [{
      sourceId: 'source', providerKey: 'open_library', providerItemId: 'OL1W',
      sourceUrl: null, sourceHash: null, sourceUpdatedAt: null, rowUpdatedAt: at,
      syncedAt: at, identityMatches: true, featurePayload: { subject: labels },
    }] : [],
  }] };
}

test('native structural bound preserves broad assertions but never truncates oversized sources', () => {
  const input = book(['Fantasy', ...Array(128).fill('unmapped')]);
  const before = JSON.stringify(input);
  const report = inspectNativeFeatureSupport(input);
  assert.equal(report.broadInspectorCoverage.BOOK.itemsWithAssertions, 1);
  assert.deepEqual(report.coverage.BOOK, { NATIVE_LABEL_BUDGET_EXCEEDED: 1 });
  assert.equal(JSON.stringify(input), before);
  assert.equal(inspectNativeFeatureSupport(book(['Fantasy', 'x'.repeat(257)]))
    .coverage.BOOK.NATIVE_LABEL_BUDGET_EXCEEDED, 1);
});

test('supported, unmapped and absent sources stay distinct and never grant feature use', () => {
  assert.deepEqual(inspectNativeFeatureSupport(book(['Fantasy'])).coverage.BOOK,
    { WITHIN_LABEL_BUDGET_WITH_ASSERTIONS: 1 });
  assert.deepEqual(inspectNativeFeatureSupport(book(['Biography'])).coverage.BOOK,
    { NO_MAPPED_CONCEPT: 1 });
  const absent = inspectNativeFeatureSupport(book([], false));
  assert.deepEqual(absent.coverage.BOOK, { NO_SUPPORTED_SOURCE: 1 });
  assert.equal(absent.featurePermission, 'NOT_GRANTED_BY_AUDIT');
  assert.equal(absent.servingActivation, 'NONE');
});
