import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyDescriptionAcceptanceSources } from './verify-description-acceptance.mjs';

const sources = [
  '../../apps/description-acceptance/App.tsx',
  '../../apps/mobile/src/domain/itemDescription.ts',
  '../../apps/mobile/src/features/discovery/DescriptionCredit.tsx',
  '../../apps/mobile/src/features/discovery/ItemDescription.tsx',
  '../../apps/mobile/src/theme/roomTheme.ts',
  '../../node_modules/react-native/index.js',
  '../../apps/description-acceptance/node_modules/react/index.js',
];

test('isolated native bundles must reuse every shared production description module', () => {
  assert.equal(verifyDescriptionAcceptanceSources(sources).sharedMobileModules.length, 4);
  assert.throws(() => verifyDescriptionAcceptanceSources(sources.filter(path => !path.endsWith('/ItemDescription.tsx'))),
    /Missing shared production module/);
  assert.throws(() => verifyDescriptionAcceptanceSources(sources.slice(1)), /isolated app/);
  assert.throws(() => verifyDescriptionAcceptanceSources([]), /nonempty/);
  assert.throws(() => verifyDescriptionAcceptanceSources([...sources, '../../node_modules/react/index.js']), /one React/);
});

test('auth, database and user-evidence modules cannot enter the acceptance bundle', () => {
  for (const path of [
    '../../node_modules/@supabase/supabase-js/dist/module/index.js',
    '../../node_modules/expo-router/entry.js',
    '../../node_modules/expo-sqlite/build/index.js',
    '../../apps/mobile/src/data/supabaseClient.ts',
    '../../apps/mobile/src/features/events/EventTrackingContext.tsx',
    '../../apps/mobile/src/features/lists/ItemListsContext.tsx',
    '../../scripts/catalog/import-open-library-descriptions.mjs',
    '../../apps/admin/data.ts',
  ]) assert.throws(() => verifyDescriptionAcceptanceSources([...sources, path]));
  assert.throws(() => verifyDescriptionAcceptanceSources([...sources,
    '..\\..\\apps\\mobile\\src\\features\\auth\\AuthContext.tsx']));
});
