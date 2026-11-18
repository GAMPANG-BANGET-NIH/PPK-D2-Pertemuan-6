
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useAuth } from '../context/auth-context';
import IzinPraktikan from '../features/izin-praktikan';
import { usePresensi } from '../hooks/use-presensi';

export default function IzinPage() {
  const { sessionId } = useLocalSearchParams<{
    sessionId?: string;
  }>();

  const { user, loading: authLoading } = useAuth();

  const {
    sessions,
    loading: sessionsLoading,
    error,
  } = usePresensi(user);

  const selectedSession =
    sessions.find((session) => session.id === sessionId) ?? null;

  if (authLoading || (user && sessionsLoading)) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Memuat sesi praktikum...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Silakan login untuk mengajukan izin.</Text>
      </View>
    );
  }

  if (user.role !== 'praktikan') {
    return (
      <View style={{ padding: 20 }}>
        <Text>Halaman ini hanya tersedia untuk praktikan.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ padding: 20 }}>
        <Text>{error}</Text>
      </View>
    );
  }

  if (!selectedSession) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Sesi praktikum tidak ditemukan.</Text>
      </View>
    );
  }

  return (
    <IzinPraktikan
      user={user}
      session={selectedSession}
    />
  );
}
