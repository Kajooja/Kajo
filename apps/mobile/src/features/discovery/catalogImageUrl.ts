const OPEN_LIBRARY_LARGE_COVER = /^(https:\/\/covers\.openlibrary\.org\/b\/id\/\d+)-L(\.jpg(?:\?.*)?)$/i;

const IMAGE_LOOK_BEHIND = 2;
const IMAGE_MOUNT_AHEAD = 6;
const IMAGE_PREFETCH_AHEAD = 14;

export interface DiscoveryImagePlan {
  mount: {
    first: number;
    last: number;
  };
  prefetch: {
    first: number;
    lastExclusive: number;
  };
}

export function getDiscoveryImageUrl(imageUrl: string): string {
  return imageUrl.replace(OPEN_LIBRARY_LARGE_COVER, '$1-M$2');
}

export function getDiscoveryImagePlan(
  visibleIndexes: readonly number[],
  itemCount: number,
): DiscoveryImagePlan | null {
  if (visibleIndexes.length === 0 || itemCount <= 0) return null;

  const firstVisible = Math.max(0, Math.min(...visibleIndexes));
  const lastVisible = Math.min(itemCount - 1, Math.max(...visibleIndexes));

  return {
    mount: {
      first: Math.max(0, firstVisible - IMAGE_LOOK_BEHIND),
      last: Math.min(itemCount - 1, lastVisible + IMAGE_MOUNT_AHEAD),
    },
    prefetch: {
      first: Math.min(itemCount, lastVisible + 1),
      lastExclusive: Math.min(
        itemCount,
        lastVisible + 1 + IMAGE_PREFETCH_AHEAD,
      ),
    },
  };
}
