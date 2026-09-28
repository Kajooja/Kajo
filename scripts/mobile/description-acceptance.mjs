import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../../apps/description-acceptance/', import.meta.url));
const require = createRequire(join(appRoot, 'package.json'));
const expoCli = join(dirname(require.resolve('expo/package.json')), 'bin/cli');
const env = { ...process.env, EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1' };

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: appRoot, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'start') {
  run(expoCli, ['start', '--go', ...args]);
} else if (mode === 'smoke' && args.length === 0) {
  for (const platform of ['ios', 'android']) {
    run(expoCli, ['export', '--platform', platform, '--output-dir', `dist/${platform}`, '--source-maps']);
  }
  run(fileURLToPath(new URL('./verify-description-acceptance.mjs', import.meta.url)), []);
} else {
  throw new Error('Usage: description-acceptance.mjs start [Expo options] | smoke');
}
