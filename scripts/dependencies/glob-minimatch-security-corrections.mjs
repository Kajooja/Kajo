// Preserve the installed majors and their public matching APIs. These are the
// narrowly translated upstream fixes, not replacements with minimatch 11/glob 14.
// https://github.com/isaacs/minimatch/commit/77a0f5c4b80bdc641c3c930a1d9edf5ad2db57f8
// https://github.com/isaacs/node-glob/commit/4682e8c9babee1b385202ede36389634e12076d7
const minimatchReplacements = [
  ['    firstPhasePreProcess(globParts) {',
    '    firstPhasePreProcess(globParts) {\n        const { braceExpandMax = 100_000 } = this.options;', 1],
  ["                        p2 === '..') {", "                        p2 === '..' ||\n                        globParts.length >= braceExpandMax) {", 1],
  ['    secondPhasePreProcess(globParts) {',
    '    secondPhasePreProcess(globParts) {\n        if (globParts.length > 1000) return globParts;', 1],
];

export const minimatchSecurityCorrection = {
  name: 'minimatch', version: '10.2.6',
  auditVersions: ['10.2.6', '3.1.5'],
  advisory: 'https://github.com/advisories/GHSA-g3hv-75wg-m249',
  variants: [
    {
      version: '10.2.6',
      integrity: 'sha512-vpLQEs+VLCr1nU0BXS07maYoFwlDAH0gngQuuttxIwutDFEMHq2blX+8vpgxDdK3J1PwjCJiep77OitTZ4Ll1A==',
      files: [
        { path: 'dist/commonjs/index.js', sha256: 'd224f71f20d7c206fcc5b7e9f747324c7698345a0b2c28d717dd9cf698306783' },
        { path: 'dist/esm/index.js', sha256: '59821ec2ce0d3df968292036e5c831ad322b33e9c33a949ecbc9dfe125d165be' },
      ].map(file => ({ ...file, replacements: minimatchReplacements })),
    },
    {
      version: '3.1.5',
      integrity: 'sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==',
      evidenceKind: 'NOT_AFFECTED_VULNERABLE_OPTIMIZER_ABSENT',
      // The advisory describes first/secondPhasePreProcess at optimizationLevel 2.
      // This exact older source has neither method nor optimizationLevel support.
      // Upstream changelog dates pattern preprocessing to 7.0 and the option to
      // 7.1: https://github.com/isaacs/minimatch/blob/main/changelog.md
      // It is verified unchanged, not claimed to have received a security patch.
      files: [],
      unmodifiedFiles: [
        { path: 'minimatch.js', sha256: '746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d' },
      ],
    },
  ],
};

const walkerReplacements = [
  ['        if (this.signal?.aborted)\n            cb();',
    '        if (this.signal?.aborted)\n            return cb();', 4],
  ['    onResume(fn) {\n        if (this.signal?.aborted)\n            return;', '    onResume(fn) {', 1],
];

// Default glob exports use these bundles, while glob/raw uses walker.js.
// The bundles also contain their own minimatch: apply the optimizer fix there
// as well, rather than relying on corrections to the separate npm leaves.
const bundleReplacements = [
  ['onResume(t){this.signal?.aborted||(this.paused?this.#t.push(t):t())}',
    'onResume(t){this.paused?this.#t.push(t):t()}', 1],
  ['walkCB(t,e,s){this.signal?.aborted&&s(),this.walkCB2(',
    'walkCB(t,e,s){if(this.signal?.aborted)return s();this.walkCB2(', 1],
  ['walkCBSync(t,e,s){this.signal?.aborted&&s(),this.walkCB2Sync(',
    'walkCBSync(t,e,s){if(this.signal?.aborted)return s();this.walkCB2Sync(', 1],
  ['if(this.signal?.aborted&&i(),this.paused){',
    'if(this.signal?.aborted)return i();if(this.paused){', 2],
  ['firstPhasePreProcess(t){let e=!1;',
    'firstPhasePreProcess(t){const{braceExpandMax=100000}=this.options;let e=!1;', 1],
  ['||!l||l==="."||l==="..")continue;',
    '||!l||l==="."||l===".."||t.length>=braceExpandMax)continue;', 1],
  ['secondPhasePreProcess(t){for(',
    'secondPhasePreProcess(t){if(t.length>1000)return t;for(', 1],
];

export const globSecurityCorrection = {
  name: 'glob', version: '13.0.6',
  advisory: 'https://github.com/advisories/GHSA-3g3m-2fjr-6pw4',
  integrity: 'sha512-Wjlyrolmm8uDpm/ogGyXZXb1Z+Ca2B8NbJwqBVg0axK9GbBeoS7yGV6vjXnYdGm6X53iehEuxxbyiKp8QmN4Vw==',
  files: [
    { path: 'dist/commonjs/walker.js', sha256: '1138ced9d5429681a1740af32d13391a38184a3376d1d9d56eea64b7a43274a1', replacements: walkerReplacements },
    { path: 'dist/esm/walker.js', sha256: '3e15af549ecc74d8691982d571168fd4b0e38b494c2cbb3edcfb8f97d4036ac6', replacements: walkerReplacements },
    { path: 'dist/commonjs/index.min.js', sha256: '3178e109aa75b45d6970a51a718f01e5b5b8f87150563ee6cb4c0e75ec215617', replacements: bundleReplacements },
    { path: 'dist/esm/index.min.js', sha256: '9eff492e16fdf9ea47a5f3c3d64784f9238b607f95a278101eb5a4e882f6ea85', replacements: bundleReplacements },
  ],
};

export const globMinimatchSecurityCorrections = [minimatchSecurityCorrection, globSecurityCorrection];
