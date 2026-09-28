import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import fixture from './fixtures.json' with { type: 'json' };
import { descriptionTextHash, isAttributionUrl, readDescriptionAttribution } from './index.js';

test('display hashes agree with the independent Node implementation for UTF-8 and block boundaries', () => {
  for (const text of ['', 'abc', fixture.description, 'Ää ö € 漢字 🐈', 'a'.repeat(55), 'a'.repeat(56),
    'b'.repeat(64), 'c'.repeat(65), '🙂'.repeat(2000), 'e\u0301\nsecond paragraph']) {
    assert.equal(descriptionTextHash(text), createHash('sha256').update(text).digest('hex'));
  }
});

test('public attribution is complete, plain, exact-bound and contains no private review properties', () => {
  const read = value => readDescriptionAttribution(value, fixture.attribution.textSha256, fixture.attribution.recordSha256);
  assert.deepEqual(read(fixture.attribution), fixture.attribution);
  assert.notEqual(read(fixture.attribution), fixture.attribution);
  for (const patch of [{ contract: 'future' }, { textSha256: '0'.repeat(64) }, { recordSha256: '0'.repeat(64) },
    { credit: '' }, { credit: 'x'.repeat(501) }, { credit: ' <b>Author</b>' }, { changes: '\u202eHidden' },
    { sourceRevision: '' }, { credit: '\ud800' }, { reviewer: 'Private reviewer' }, { sourceTitle: ' Leading' },
    { licenseName: ' trailing\u00a0' }, { sourceUrl: 'https://user:password@example.invalid/' }]) {
    assert.equal(read({ ...fixture.attribution, ...patch }), null);
  }
  for (const key of Object.keys(fixture.attribution)) {
    const value = { ...fixture.attribution }; delete value[key]; assert.equal(read(value), null);
  }
  assert.ok(read({ ...fixture.attribution, sourceRevision: null }));
});

test('only bounded explicit HTTPS URLs without credentials, controls or URL repair are accepted', () => {
  for (const url of ['https://example.invalid/a?oldid=7#section', 'https://example.invalid/%C3%A4']) assert.equal(isAttributionUrl(url), true);
  for (const url of ['http://example.invalid/', 'javascript:alert(1)', '//example.invalid',
    'https://user@example.invalid', 'https://example.invalid:443/', 'https://example.invalid\\evil',
    'https://exa%6dple.invalid/', 'https://example..invalid/', 'https://-example.invalid/',
    'https://example.invalid/%0A', 'https://example.invalid/%zz', 'https://example.invalid/%',
    'https://example.invalid/<script>', 'https://example.invalid/ space', 'https://localhost/',
    'https://example.invalid/'+ 'x'.repeat(2048)]) assert.equal(isAttributionUrl(url), false, url);
});
