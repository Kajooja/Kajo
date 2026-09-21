import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const allowedMobile = new Set([
  'domain/itemDescription.ts',
  'features/discovery/DescriptionCredit.tsx',
  'features/discovery/ItemDescription.tsx',
  'theme/roomTheme.ts',
]);
const allowedApp = new Set(['index.ts', 'App.tsx', 'fixtures.ts']);

export function verifyDescriptionAcceptanceSources(sources) {
  assert.ok(Array.isArray(sources) && sources.length > 0, 'A nonempty native bundle source map is required.');
  const mobile = new Set();
  for (const input of sources) {
    assert.equal(typeof input, 'string');
    const source = input.replaceAll('\\', '/');
    assert.ok(!/(?:^|\/)(?:@supabase|expo-router|expo-sqlite)\//.test(source),
      `A data/auth/router dependency entered the isolated bundle: ${source}`);
    const match = source.match(/(?:^|\/)mobile\/src\/(.+)$/);
    if (match) {
      assert.ok(allowedMobile.has(match[1]), `Unreviewed production mobile module in acceptance bundle: ${source}`);
      mobile.add(match[1]);
    }
    if (!source.includes('/node_modules/')) {
      const firstParty = source.match(/(?:^|\/)((?:apps|packages|scripts|supabase)\/.+)$/)?.[1];
      if (firstParty) {
        const app = firstParty.match(/^apps\/description-acceptance\/(.+)$/)?.[1];
        assert.ok(match || (app && allowedApp.has(app))
          || /^packages\/catalog-contracts\/(?:index\.js|fixtures\.json)$/.test(firstParty),
        `Unreviewed first-party module in acceptance bundle: ${source}`);
      }
    }
  }
  for (const required of allowedMobile) assert.ok(mobile.has(required), `Missing shared production module: ${required}`);
  assert.ok(sources.some(source => source.replaceAll('\\', '/').endsWith('/description-acceptance/App.tsx')),
    'The isolated app must be the bundle entry.');
  assert.equal(sources.filter(source => source.replaceAll('\\', '/').endsWith('/react/index.js')).length, 1,
    'The native acceptance app must have exactly one React instance.');
  return { sharedMobileModules: [...mobile].sort(), sourceCount: sources.length };
}

async function sourceMaps(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await sourceMaps(path));
    else if (entry.name.endsWith('.map')) paths.push(path);
  }
  return paths;
}

async function main() {
  const root = fileURLToPath(new URL('../../apps/description-acceptance/dist/', import.meta.url));
  for (const platform of ['ios', 'android']) {
    const maps = await sourceMaps(join(root, platform));
    assert.equal(maps.length, 1, `Expected one ${platform} entry source map.`);
    const map = JSON.parse(await readFile(maps[0], 'utf8'));
    const result = verifyDescriptionAcceptanceSources(map.sources);
    console.log(`Description acceptance ${platform}: isolated source graph PASS (${result.sourceCount} modules).`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
