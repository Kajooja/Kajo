import { useRouter } from 'expo-router';

import { RoomScreen } from '@/features/room/RoomScreen';

export default function IndexScreen() {
  const router = useRouter();

  return (
    <RoomScreen
      onOpenBooks={() => router.push('/discovery/books')}
      onOpenMovies={() => router.push('/discovery/movies')}
    />
  );
}
