

import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import IzinPraktikan from '../features/izin-praktikan';
import { usePresensi } from '../hooks/use-presensi';
import type { AppUser } from '../types';

export default function IzinPage() {
  const { sessionId } = useLocalSearchParams<{
    sessionId?: string;
  }>();

  // Sementara menunggu integrasi autentikasi Dewa.
  const user: AppUser | null = null;

  const { sessions, loading, error } = usePresensi(user);

  const selectedSession =
    sessions.find((session) => session.id === sessionId) ??
    null;

  if (loading) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Memuat sesi praktikum...</Text>
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

  return (
    <IzinPraktikan
      user={user}
      session={selectedSession}
    />
  );
}
