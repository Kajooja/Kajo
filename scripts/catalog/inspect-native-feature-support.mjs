import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inspectItemFeatures, MAX_SNAPSHOT_BYTES } from './item-features.mjs';

/** Structural upper bound only: no permission, capture clocks, label support or fit. */
export function inspectNativeFeatureSupport(snapshot) {
  const { artifact, report } = inspectItemFeatures(snapshot);
  const coverage = { BOOK: {}, MOVIE: {} };
  for (const item of artifact.features) {
    const provider = item.itemType === 'BOOK' ? 'open_library' : 'tmdb';
    const source = item.sources.find(s => s.providerKey === provider);
    let status = 'NO_SUPPORTED_SOURCE';
    if (source) {
      const labels = Object.values(source.featurePayload)[0];
      if (!source.identityMatches) status = 'IDENTITY_MISMATCH';
      else if (!Array.isArray(labels)) status = 'LABELS_UNAVAILABLE';
      else if (labels.length > 128 || (provider === 'open_library'
        && labels.some(label => [...label].length > 256))) status = 'NATIVE_LABEL_BUDGET_EXCEEDED';
      else if (!item.assertions.length) status = 'NO_MAPPED_CONCEPT';
      else status = 'WITHIN_LABEL_BUDGET_WITH_ASSERTIONS';
    }
    coverage[item.itemType][status] = (coverage[item.itemType][status] ?? 0) + 1;
  }
  return { version: 'native-content-structural-support-v1', checkedAt: report.checkedAt,
    snapshotSha256: report.snapshotSha256, mappingSha256: report.mappingSha256,
    coverage, broadInspectorCoverage: report.coverage,
    semantics: 'STRUCTURAL_UPPER_BOUND_NOT_PERMISSION_OR_NATIVE_CAPTURE_ACCEPTANCE',
    missing: 'UNAVAILABLE_NOT_NEGATIVE', featurePermission: 'NOT_GRANTED_BY_AUDIT',
    qualityAdmission: 'NONE', servingActivation: 'NONE' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = await readFile(process.argv[2]);
  if (bytes.length > MAX_SNAPSHOT_BYTES) throw new Error('Snapshot size');
  console.log(JSON.stringify(inspectNativeFeatureSupport(JSON.parse(bytes)), null, 2));
}
