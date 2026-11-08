export interface WikidataFilmContext {
  readonly entityId: string;
  readonly retrievedAtMicros: string;
  readonly cutoffMicros: string;
  readonly identity: Readonly<{ imdbId: string; tmdbMovieId: string }>;
}
export interface WikidataFilmEvidence {
  readonly version: 'wikidata-film-evidence-v1';
  readonly providerKey: 'wikidata';
  readonly evidenceKind: 'wikidata-direct-film-genre';
  readonly entityId: string;
  readonly revisionId: number;
  readonly sourceModifiedAt: string;
  readonly sourceUrl: string;
  readonly sourceSha256: string;
  readonly retrievedAtMicros: string;
  readonly mappingVersion: string;
  readonly mappingSha256: string;
  readonly identity: WikidataFilmContext['identity'];
  readonly claims: Readonly<Record<string, readonly unknown[]>>;
  readonly diagnostics: readonly Readonly<{ index: number; statementId: string | null; value?: string; reason: string }>[];
  readonly originAssessment: 'UNRESOLVED_REQUIRES_SOURCE_USE_REVIEW';
  readonly assertions: readonly (1 | null)[];
  readonly values: readonly (0 | 1)[] | null;
  readonly admission: 'NONE';
  readonly evidenceSha256: string;
}
export type WikidataFilmResult = Readonly<{
  status: 'CANDIDATE' | 'UNAVAILABLE'; reason: string | null; evidence: WikidataFilmEvidence | null;
}>;
export const WIKIDATA_FILM_MAPPING: Readonly<{
  version: 'wikidata-film-direct-genres-v1'; concepts: readonly string[];
  genreItems: Readonly<Record<string, string>>; filmTypes: readonly string[];
  identityNamespaces: Readonly<{ imdb: 'imdb_title'; tmdb: 'tmdb_movie'; entity: 'wikidata_item' }>;
  rankPolicy: string; qualifiedPolicy: string; unknownPolicy: string; transform: string;
  tmdbReferenceItems: readonly string[]; tmdbReferenceProperties: readonly string[];
  tmdbReferenceDomains: readonly string[]; properties: readonly string[];
  limits: Readonly<Record<'sourceBytes' | 'evidenceBytes' | 'jsonDepth' | 'jsonNodes' |
    'statementsPerProperty' | 'referencesPerStatement' | 'snakProperties' | 'snaksPerProperty' |
    'requests' | 'batchSourceBytes' | 'catalogueItems' | 'catalogueBytes', number>>;
}>;
export const WIKIDATA_FILM_MAPPING_SHA256: string;
export function extractWikidataFilmEvidence(bytes: Uint8Array, context: WikidataFilmContext): WikidataFilmResult;
export interface WikidataFilmCatalogueReview {
  readonly version: 'wikidata-film-catalogue-review-v1'; readonly complete: true; readonly cutoffMicros: string;
  readonly items: readonly Readonly<{
    itemId: string; itemType: 'BOOK' | 'MOVIE';
    aliases: readonly Readonly<{ namespace: string; externalId: string }>[];
    sources: readonly Readonly<{ providerKey: string; providerItemId: string }>[];
  }>[];
}
export function inspectWikidataFilmBatch(requests: readonly Readonly<{
  itemId: string; entityId: string; bytes: Uint8Array; retrievedAtMicros: string;
}>[], catalogue: WikidataFilmCatalogueReview): readonly (WikidataFilmResult & Readonly<{
  itemId: string; entityId: string; catalogueSha256: string; cutoffMicros: string;
}>)[];
