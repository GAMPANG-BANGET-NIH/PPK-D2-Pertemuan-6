import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/auth-context';
import IzinPraktikan from '../features/izin-praktikan';
import { usePresensi } from '../hooks/use-presensi';

const statusLabels: Record<string, string> = {
  belum_dibuka: 'Belum Dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

export default function IzinPage() {
  const { sessionId } = useLocalSearchParams<{
    sessionId?: string;
  }>();
  const [pickedSessionId, setPickedSessionId] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();

  const {
    sessions,
    loading: sessionsLoading,
    error,
  } = usePresensi(user);

  const activeSessionId = sessionId || pickedSessionId;
  const selectedSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  if (authLoading || (user && sessionsLoading)) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>Memuat sesi praktikum...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>Silakan login untuk mengajukan izin.</Text>
      </View>
    );
  }

  if (user.role !== 'praktikan') {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>Halaman ini hanya tersedia untuk praktikan.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!selectedSession) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Pilih Sesi Praktikum</Text>
        <Text style={styles.subtitle}>
          {sessionId
            ? 'Sesi praktikum yang dipilih tidak ditemukan. Pilih sesi kelas Anda di bawah ini.'
            : 'Pilih sesi praktikum yang ingin Anda ajukan izinnya.'}
        </Text>

        {sessions.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.stateText}>Belum ada sesi praktikum untuk kelas Anda.</Text>
          </View>
        ) : (
          sessions.map((session) => (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              style={styles.card}
              onPress={() => setPickedSessionId(session.id)}
            >
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.metaText}>
                {session.date} | {session.startTime} - {session.endTime}
              </Text>
              <Text style={styles.metaText}>
                Status: {statusLabels[session.status] ?? session.status}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      {!sessionId && (
        <View style={styles.pickerBar}>
          <Pressable
            accessibilityRole="button"
            style={styles.changeSessionButton}
            onPress={() => setPickedSessionId(null)}
          >
            <Text style={styles.changeSessionText}>← Ganti Sesi</Text>
          </Pressable>
        </View>
      )}
      <IzinPraktikan
        user={user}
        session={selectedSession}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 20, paddingBottom: 48 },
  stateContainer: { padding: 20 },
  stateText: { color: '#334155', fontSize: 15 },
  errorText: { color: '#DC2626', fontSize: 15 },
  title: { fontSize: 22, fontWeight: '700', color: '#1E3A8A' },
  subtitle: { marginTop: 6, marginBottom: 16, color: '#64748B', lineHeight: 20 },
  card: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 12,
  },
  sessionTitle: { fontSize: 16, fontWeight: '600', color: '#2563EB' },
  metaText: { marginTop: 6, color: '#475569', fontSize: 14 },
  pickerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#F8FAFC',
  },
  changeSessionButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10 },
  changeSessionText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
});
