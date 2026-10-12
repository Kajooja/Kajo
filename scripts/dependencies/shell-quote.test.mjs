import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const devtoolsRequire = createRequire(require.resolve('react-devtools-core/package.json'));
const { parse, quote } = devtoolsRequire('shell-quote');
const lineTerminators = ['\n', '\r', '\u2028', '\u2029'];

test('React DevTools shell quoting preserves ordinary literal argument boundaries', () => {
  const args = ['echo', '', 'two words', "single'quote", 'double"quote', '#literal',
    '$value', '$(fixture)', ';', 'two\nlines', 'C:\\kajo\\input', '~/fixture'];
  assert.deepEqual(parse(quote(args)), args);
});

test('shell quoting rejects every line terminator anywhere after a comment', () => {
  // GHSA-pqg4-j6r4-53mv: rejection must happen before a command reaches a shell.
  // These inert payloads are never executed, including when the old leaf fails.
  for (const terminator of lineTerminators) {
    for (const comment of ['', 'fixture']) {
      const payload = `ordinary${terminator}kajo-fixture;#`;
      assert.throws(() => quote(['echo', { comment }, payload]), TypeError);
      assert.throws(() => quote(['echo', { comment }, 'safe', { op: '|' }, payload]), TypeError);
    }
  }
});

test('parsed mid-word comments cannot introduce an appended shell line', () => {
  const tokens = parse('echo http://example.invalid/#fragment');
  assert.deepEqual(tokens, ['echo', 'http://example.invalid/', { comment: 'fragment' }]);
  for (const terminator of lineTerminators) {
    assert.throws(() => quote(tokens.concat('safe', `ordinary${terminator}kajo-fixture;#`)), TypeError);
  }
});

test('shell quoting preserves safe comment tails and line terminators before comments', () => {
  assert.equal(quote(['echo', { comment: 'fixture' }, 'tail']), 'echo #fixture tail');
  for (const terminator of lineTerminators) {
    const value = `first${terminator}second`;
    const command = quote(['echo', value, { comment: 'fixture' }]);
    assert.deepEqual(parse(command), ['echo', value, { comment: 'fixture' }]);
  }
});
