import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '../context/auth-context';
import PresensiLokasiScreen from '../features/presensi-lokasi';

export default function PresensiLokasiPage() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const initialSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const { user } = useAuth();

  return <PresensiLokasiScreen user={user} initialSessionId={initialSessionId} />;
}
