export const ATTRIBUTED_DESCRIPTION: 'open-library-description-v2';
export const DESCRIPTION_ATTRIBUTION: 'description-attribution-v1';
export const DESCRIPTION_PILOT_USE: 'kajo-internal-pilot';
export interface DescriptionAttribution {
  readonly contract: typeof DESCRIPTION_ATTRIBUTION;
  readonly sourceTitle: string;
  readonly sourceUrl: string;
  readonly sourceRevision: string | null;
  readonly credit: string;
  readonly licenseName: string;
  readonly licenseUrl: string;
  readonly changes: string;
  readonly textSha256: string;
  readonly recordSha256: string;
}
export function isAttributionText(value: unknown, maximum: number): value is string;
export function isAttributionUrl(value: unknown): value is string;
export function readDescriptionAttribution(value: unknown, textSha256: unknown, recordSha256: unknown): DescriptionAttribution | null;
export function descriptionTextHash(text: string): string;
