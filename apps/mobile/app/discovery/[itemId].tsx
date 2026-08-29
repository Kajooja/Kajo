import { useLocalSearchParams } from 'expo-router';

import { ItemDetailScreen } from '@/features/discovery/ItemDetailScreen';

export default function DiscoveryItemDetailRoute() {
  const { itemId, predictionId } = useLocalSearchParams<{
    itemId: string;
    predictionId?: string;
  }>();

  return (
    <ItemDetailScreen
      key={itemId}
      itemId={itemId}
      {...(predictionId ? { predictionId } : {})}
    />
  );
}
