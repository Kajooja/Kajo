import { useLocalSearchParams } from 'expo-router';

import { ItemDetailScreen } from '@/features/discovery/ItemDetailScreen';

export default function DiscoveryItemDetailRoute() {
  const { itemId, predictionId, predictionSource, deliveryId } = useLocalSearchParams<{
    itemId: string;
    deliveryId?: string;
    predictionId?: string;
    predictionSource?: string;
  }>();

  return (
    <ItemDetailScreen
      key={`${itemId}:${deliveryId ?? "direct"}`}
      itemId={itemId}
      {...(deliveryId ? { deliveryId } : {})}
      {...(predictionId ? { predictionId } : {})}
      {...(predictionSource === 'hosted' || predictionSource === 'fallback'
        ? { predictionSource }
        : {})}
    />
  );
}
