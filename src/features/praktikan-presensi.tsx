
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { usePresensi } from '../hooks/use-presensi';
import type { AppUser, Session } from '../types';

type Props = {
  user: AppUser | null;
};

export default function PraktikanPresensi({ user }: Props) {
  const {
    sessions,
    attendance,
    loading,
    submitting,
    error,
    attend,
  } = usePresensi(user);

  const [selectedSessionId, setSelectedSessionId] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) ?? null;

  const hasAttended = (sessionId: string) =>
    attendance.some((item) => item.sessionId === sessionId);

  const handleAttendance = async (session: Session) => {
    if (submitting || hasAttended(session.id)) return;

    setSuccessMessage(null);

    const successful = await attend(session);

    if (successful) {
      setSuccessMessage(
        `Presensi ${session.title} berhasil dicatat.`
      );
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
    >
      <Text style={styles.title}>Presensi Praktikum</Text>
      <Text style={styles.subtitle}>
        Daftar sesi dan riwayat kehadiran
      </Text>

      {!user && (
        <Text style={styles.notice}>
          Silakan login untuk melihat presensi.
        </Text>
      )}

      {loading && <ActivityIndicator color="#2563EB" />}

      {error && <Text style={styles.error}>{error}</Text>}

      {successMessage && (
        <Text style={styles.success}>{successMessage}</Text>
      )}

      <Text style={styles.sectionTitle}>Sesi Praktikum</Text>

      {!loading && user && sessions.length === 0 && (
        <Text>Belum ada sesi untuk kelasmu.</Text>
      )}

      {sessions.map((session) => {
        const attended = hasAttended(session.id);
        const enabled =
          !!user &&
          session.status === 'dibuka' &&
          !attended &&
          !submitting &&
          !loading;

        return (
          <View key={session.id} style={styles.card}>
            <Pressable
              onPress={() => setSelectedSessionId(session.id)}
            >
              <Text style={styles.sessionTitle}>
                {session.title}
              </Text>
              <Text style={styles.detail}>
  {session.date} | {session.startTime} - {session.endTime}
</Text>
              <Text style={styles.detail}>
                Status: {session.status}
              </Text>
            </Pressable>

            <Pressable
              disabled={!enabled}
              onPress={() => handleAttendance(session)}
              style={[
                styles.button,
                !enabled && styles.disabledButton,
              ]}
            >
              <Text style={styles.buttonText}>
                {attended
                  ? 'Sudah Presensi'
                  : submitting
                    ? 'Memproses...'
                    : session.status === 'dibuka'
                      ? 'Lakukan Presensi'
                      : 'Presensi Belum Tersedia'}
              </Text>
            </Pressable>
          </View>
        );
      })}

      {selectedSession && (
        <Text style={styles.notice}>
          Sesi dipilih: {selectedSession.title}
        </Text>
      )}

      <Text style={styles.sectionTitle}>Riwayat Presensi</Text>

      {attendance.length === 0 ? (
        <Text>Belum ada riwayat presensi.</Text>
      ) : (
        attendance.map((record) => {
          const session = sessions.find(
            (item) => item.id === record.sessionId
          );

          return (
            <View key={record.sessionId} style={styles.card}>
              <Text style={styles.sessionTitle}>
                {session?.title ?? record.sessionId}
              </Text>
              <Text style={styles.detail}>
                {record.attendedAt
                  ? record.attendedAt.toLocaleString('id-ID')
                  : 'Waktu belum tersedia'}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 20,
    paddingBottom: 50,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 24,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
  },
  detail: {
    color: '#475569',
    marginTop: 6,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 10,
    marginTop: 14,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#CBD5E1',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  notice: {
    backgroundColor: '#EFF6FF',
    color: '#1E40AF',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  error: {
    color: '#B91C1C',
    marginVertical: 12,
  },
  success: {
    color: '#166534',
    marginVertical: 12,
  },
});
