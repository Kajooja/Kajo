import { useLocalSearchParams } from 'expo-router';

import { ProfileThreadScreen } from '@/features/messages/ProfileThreadScreen';

export default function ProfileMessageRoute() {
  const { profileId } = useLocalSearchParams<{ profileId?: string | string[] }>();
  const selectedProfileId = Array.isArray(profileId) ? profileId[0] : profileId;

  return <ProfileThreadScreen profileId={selectedProfileId ?? ''} />;
}
