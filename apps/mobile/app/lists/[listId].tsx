import { useLocalSearchParams } from 'expo-router';

import { ItemListScreen } from '@/features/lists/ItemListScreen';

export default function ItemListRoute() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  return <ItemListScreen listId={listId ?? ''} />;
}
