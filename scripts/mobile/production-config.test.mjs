import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { resolveSupabaseConfiguration, validateProductionConfiguration } = require('../../apps/mobile/src/data/supabaseConfigPolicy.js');
const projectRoot = fileURLToPath(new URL('../../apps/mobile/', import.meta.url));
const publicConfig = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_synthetic' };
const jwt = role => [Buffer.from('{"alg":"HS256"}').toString('base64url'),
  Buffer.from(JSON.stringify({ role })).toString('base64url'), 'synthetic_signature'].join('.');

test('runtime and production configuration reject privileged/session/malformed keys with fixed errors', () => {
  for (const publishableKey of ['sb_secret_synthetic', jwt('service_role'), jwt('authenticated'), jwt(null),
    'arbitrary', 'sb_publishable_', 'sb_publishable_has space', 'a.b.c', 'x'.repeat(4097)]) {
    const environment = { ...publicConfig, publishableKey };
    assert.equal(resolveSupabaseConfiguration(environment).status, 'invalid');
    assert.throws(() => validateProductionConfiguration(environment), error => !error.message.includes(publishableKey));
  }
  assert.deepEqual(validateProductionConfiguration(publicConfig), publicConfig);
  assert.equal(validateProductionConfiguration({ ...publicConfig, publishableKey: jwt('anon') }).publishableKey, jwt('anon'));
});

test('missing and loopback/plain HTTP production configuration fails despite a demo option', () => {
  for (const environment of [{ url: undefined, publishableKey: undefined, allowDemo: true },
    ...['http://example.supabase.co', 'https://localhost', 'https://127.0.0.1', 'https://[::1]',
      'https://name:password@example.supabase.co', 'https://example.supabase.co/path'].map(url => ({ ...publicConfig, url }))])
    assert.throws(() => validateProductionConfiguration(environment));
  assert.deepEqual(resolveSupabaseConfiguration({ url: undefined, publishableKey: undefined, allowDemo: true }), { status: 'unconfigured' });
});

test('actual Expo configuration fails before a build, preserving only explicitly labelled demo fallback', () => {
  for (const [mode, url, key, succeeds] of [
    [undefined, '', '', false], ['production', '', '', false], ['demo', '', '', true], ['invalid', '', '', false],
    ['production', publicConfig.url, publicConfig.publishableKey, true], ['production', publicConfig.url, jwt('service_role'), false],
    ['demo', publicConfig.url, 'sb_secret_synthetic', false],
  ]) {
    const env = { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key };
    if (mode === undefined) delete env.KAJO_BUILD_MODE; else env.KAJO_BUILD_MODE = mode;
    const child = spawnSync(process.execPath, ['-e', `const {getConfig}=require('@expo/config');
try { const {exp}=getConfig(process.argv[1]); console.log(JSON.stringify({mode:exp.extra.kajoBuildMode, android:exp.android.package})); }
catch { console.error('build-config-rejected'); process.exitCode=1; }`, projectRoot], { env, encoding: 'utf8', timeout: 10000 });
    assert.equal(child.status, succeeds ? 0 : 1, child.stderr);
    if (succeeds) assert.deepEqual(JSON.parse(child.stdout), { mode: mode ?? 'production', android: 'app.kajo.mobile' });
    else { assert.equal(child.stdout, ''); assert.equal(child.stderr.trim(), 'build-config-rejected'); }
  }
});
