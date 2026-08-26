import { useLocalSearchParams } from 'expo-router';

import { ItemDetailScreen } from '@/features/discovery/ItemDetailScreen';

export default function DiscoveryItemDetailRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();

  return <ItemDetailScreen key={itemId} itemId={itemId} />;
}
