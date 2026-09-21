/* global __dirname */
const { execFileSync } = require('node:child_process');

const git = (...args) => execFileSync('git', args, { cwd: __dirname, encoding: 'utf8' }).trim();
const sourceCommit = git('rev-parse', 'HEAD');
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('A Git checkout is required for acceptance build identity.');

module.exports = {
  expo: {
    name: 'Kajo lähdetietotesti',
    slug: 'kajo-description-acceptance',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    backgroundColor: '#171716',
    ios: { supportsTablet: true, bundleIdentifier: 'app.kajo.descriptionacceptance' },
    android: { package: 'app.kajo.descriptionacceptance', edgeToEdgeEnabled: true },
    extra: {
      descriptionAcceptance: {
        contract: 'description-native-acceptance-v1',
        sourceCommit,
        sourceDirty: git('status', '--porcelain', '--untracked-files=normal') !== '',
      },
    },
  },
};
