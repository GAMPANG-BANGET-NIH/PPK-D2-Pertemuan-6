import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '../context/auth-context';
import MapsScreen from '../features/maps';

export default function MapsPage() {
  const { labId } = useLocalSearchParams<{ labId?: string | string[] }>();
  const initialLabId = Array.isArray(labId) ? labId[0] : labId;
  const { user } = useAuth();

  return <MapsScreen user={user} initialLabId={initialLabId} />;
}
