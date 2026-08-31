import { useLocalSearchParams } from 'expo-router';

import { ItemDetailScreen } from '@/features/discovery/ItemDetailScreen';

export default function DiscoveryItemDetailRoute() {
  const { itemId, predictionId, predictionSource } = useLocalSearchParams<{
    itemId: string;
    predictionId?: string;
    predictionSource?: string;
  }>();

  return (
    <ItemDetailScreen
      key={itemId}
      itemId={itemId}
      {...(predictionId ? { predictionId } : {})}
      {...(predictionSource === 'hosted' || predictionSource === 'fallback'
        ? { predictionSource }
        : {})}
    />
  );
}
