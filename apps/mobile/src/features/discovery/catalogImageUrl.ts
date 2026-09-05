const OPEN_LIBRARY_LARGE_COVER = /^(https:\/\/covers\.openlibrary\.org\/b\/id\/\d+)-L(\.jpg(?:\?.*)?)$/i;

export function getDiscoveryImageUrl(imageUrl: string): string {
  return imageUrl.replace(OPEN_LIBRARY_LARGE_COVER, '$1-M$2');
}
