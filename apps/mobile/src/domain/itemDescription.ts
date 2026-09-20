import { ATTRIBUTED_DESCRIPTION, descriptionTextHash, readDescriptionAttribution } from '@kajo/catalog-contracts';
import type { Item } from './contracts';

type DescriptionFields = Pick<Item, 'description' | 'descriptionStatus' | 'descriptionAttribution'>;
const unverified: DescriptionFields = { descriptionStatus: 'unverified' };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Only a canonical metadata projection can distinguish legacy from managed
// content. A text-only RPC result is not evidence that attribution is optional.
export function readCatalogDescription(text: unknown, metadata: unknown): DescriptionFields {
  if (typeof text !== 'string' || !text) return {};
  if (!isRecord(metadata)) return unverified;
  if (!Object.hasOwn(metadata, 'descriptionProvenance')) {
    return { description: text, descriptionStatus: 'legacy' };
  }
  const provenance = metadata.descriptionProvenance;
  if (!isRecord(provenance) || provenance.contract !== ATTRIBUTED_DESCRIPTION
    || text.length > 4000 || [...text].length > 2000
    || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) return unverified;
  try {
    if (provenance.textSha256 !== descriptionTextHash(text)) return unverified;
    const attribution = readDescriptionAttribution(provenance.attribution,
      provenance.textSha256, provenance.recordSha256);
    return attribution ? { description: text, descriptionStatus: 'attributed',
      descriptionAttribution: attribution } : unverified;
  } catch { return unverified; }
}

// Recheck cached values at the presentation boundary. Dropped/edited credit or
// text cannot turn an attributed Item into a legacy unannotated paragraph.
export function visibleItemDescription(item: Item): DescriptionFields {
  if (!item.description) return {};
  if (item.descriptionStatus === 'legacy' && !item.descriptionAttribution)
    return { description: item.description, descriptionStatus: 'legacy' };
  if (item.descriptionStatus !== 'attributed') return unverified;
  return readCatalogDescription(item.description, { descriptionProvenance: {
    contract: ATTRIBUTED_DESCRIPTION, textSha256: item.descriptionAttribution?.textSha256,
    recordSha256: item.descriptionAttribution?.recordSha256, attribution: item.descriptionAttribution,
  } });
}
