import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const consumers = ['minimatch', '@expo/fingerprint', '@typescript-eslint/typescript-estree', 'glob'];

for (const consumer of consumers) {
  const consumerRequire = createRequire(require.resolve(`${consumer}/package.json`));
  const minimatchPath = consumer === 'minimatch' ? require.resolve('minimatch') : consumerRequire.resolve('minimatch');

  test(`${consumer} preserves ordinary brace expansion and file matching`, () => {
    const minimatch = require(minimatchPath);
    assert.deepEqual(minimatch.braceExpand('movie/{action,drama}{1..2}'), [
      'movie/action1', 'movie/action2', 'movie/drama1', 'movie/drama2',
    ]);
    const matcher = new minimatch.Minimatch('src/**/*.{ts,tsx}');
    assert.equal(matcher.match('src/features/detail.tsx'), true);
    assert.equal(matcher.match('src/features/detail.js'), false);
  });

  test(`${consumer} completes nested, comma-list and rewrite attack inputs within a bounded child`, () => {
    // Exercise each installed leaf through its actual minimatch parent. The
    // larger comma-array case calls the leaf because modern minimatch rejects
    // that pattern before brace parsing. A killed or crashed child fails CI.
    const child = spawnSync(process.execPath, ['--input-type=commonjs', '-e', `
      const assert = require('node:assert/strict');
      const { createRequire } = require('node:module');
      const minimatchPath = ${JSON.stringify(minimatchPath)};
      const minimatch = require(minimatchPath);
      const leaf = createRequire(minimatchPath)('brace-expansion');
      const expand = typeof leaf === 'function' ? leaf : leaf.expand;
      for (const pattern of [
        '{' + '{a},'.repeat(16000) + 'b}',
        '{'.repeat(4000) + 'a,b' + '}'.repeat(4000),
        '{a}' + '}'.repeat(32000) + ',z}',
      ]) {
        const results = minimatch.braceExpand(pattern);
        assert.ok(Array.isArray(results) && results.length > 0);
      }
      const largeCommaList = expand('{{x},' + 'a,'.repeat(130000) + 'b}');
      assert.ok(Array.isArray(largeCommaList) && largeCommaList.length > 0);
    `], { timeout: 10000, encoding: 'utf8', maxBuffer: 4096 });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
  });
}
