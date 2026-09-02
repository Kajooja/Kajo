import { useLocalSearchParams } from 'expo-router';

import { ConsumedHistoryScreen } from '@/features/lists/ConsumedHistoryScreen';

export default function ConsumedHistoryRoute() {
  const { itemType } = useLocalSearchParams<{ itemType?: string }>();
  return <ConsumedHistoryScreen itemType={itemType === 'MOVIE' ? 'MOVIE' : 'BOOK'} />;
}
