
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePresensi } from '../hooks/use-presensi';
import type { AppUser, Session } from '../types';

const statusLabels: Record<string, string> = {
  belum_dibuka: 'Belum Dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

export default function PraktikanScreen({
  user,
}: {
  user: AppUser | null;
}) {
  const {
    sessions,
    schedules,
    attendance,
    loading,
    submitting,
    error,
    attend,
  } = usePresensi(user);

  const [selectedSessionId, setSelectedSessionId] =
    useState<string | null>(null);

  const [successSession, setSuccessSession] =
    useState<Session | null>(null);

  useEffect(() => {
    if (
      selectedSessionId &&
      !sessions.some((session) => session.id === selectedSessionId)
    ) {
      setSelectedSessionId(null);
    }
  }, [sessions, selectedSessionId]);

  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ??
    null;

  const alreadyAttended = selectedSession
    ? attendance.some(
        (record) => record.sessionId === selectedSession.id
      )
    : false;

  const canAttend =
    Boolean(user && selectedSession) &&
    selectedSession?.status === 'dibuka' &&
    !alreadyAttended &&
    !loading &&
    !submitting;

  async function handleAttendance() {
    if (!user || !selectedSession || !canAttend) return;

    const success = await attend(selectedSession);

    if (success) {
      setSuccessSession(selectedSession);
    }
  }

  function formatTime(session: Session) {
    return `${session.startTime} - ${session.endTime}`;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          Presensi Praktikum
        </Text>

        <Text style={styles.subtitle}>
          Presensi praktikum terhubung dengan Firebase
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {user
              ? `Praktikan: ${user.name}`
              : 'Silakan login sebagai praktikan untuk melakukan presensi.'}
          </Text>
        </View>

        {loading && (
          <Text style={styles.feedbackText}>
            Memuat data praktikum...
          </Text>
        )}

        {error && (
          <Text style={styles.feedbackText}>
            {error}
          </Text>
        )}

        <Text style={styles.sectionTitle}>
          1. Pilih Sesi Praktikum
        </Text>

        {sessions.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHistory}>
              Belum ada sesi praktikum yang tersedia.
            </Text>
          </View>
        )}

        {sessions.map((session) => {
          const selected = selectedSessionId === session.id;

          return (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.sessionCard,
                selected && styles.selectedSessionCard,
              ]}
              onPress={() => setSelectedSessionId(session.id)}
            >
              <Text style={styles.sessionTitle}>
                {session.title}
              </Text>

              <Text style={styles.sessionInfo}>
                {session.date} | {formatTime(session)}
              </Text>

              <Text style={styles.sessionInfo}>
                Kelas: {session.classId}
              </Text>

              <Text
                style={[
                  styles.sessionStatus,
                  session.status === 'dibuka'
                    ? styles.openStatus
                    : styles.closedStatus,
                ]}
              >
                Status: {statusLabels[session.status] ?? session.status}
              </Text>

              {selected && (
                <Text style={styles.selectedLabel}>
                  Sesi dipilih
                </Text>
              )}
            </Pressable>
          );
        })}

        <Text style={styles.sectionTitle}>
          2. Detail Presensi
        </Text>

        <View style={styles.detailCard}>
          <Text style={styles.detailText}>
            Praktikan: {user?.name ?? '-'}
          </Text>

          <Text style={styles.detailText}>
            Sesi: {selectedSession?.title ?? '-'}
          </Text>

          <Text style={styles.detailText}>
            Kelas: {selectedSession?.classId ?? '-'}
          </Text>

          <Text style={styles.detailText}>
            Waktu: {selectedSession ? formatTime(selectedSession) : '-'}
          </Text>

          <Text style={styles.detailText}>
            Status: {selectedSession
              ? statusLabels[selectedSession.status] ??
                selectedSession.status
              : '-'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAttend }}
          style={[
            styles.attendanceButton,
            !canAttend && styles.disabledButton,
          ]}
          disabled={!canAttend}
          onPress={handleAttendance}
        >
          <Text style={styles.attendanceButtonText}>
            {submitting
              ? 'Menyimpan Presensi...'
              : alreadyAttended
                ? 'Sudah Presensi'
                : !selectedSession
                  ? 'Pilih Sesi Terlebih Dahulu'
                  : selectedSession.status !== 'dibuka'
                    ? 'Presensi Belum Tersedia'
                    : 'Lakukan Presensi'}
          </Text>
        </Pressable>

        {alreadyAttended && (
          <Text style={styles.feedbackText}>
            Kehadiran kamu sudah tercatat untuk sesi ini.
          </Text>
        )}

        <Text style={styles.sectionTitle}>
          3. Riwayat Presensi
        </Text>

        <Text style={styles.historyDescription}>
          Riwayat untuk {user?.name ?? 'praktikan'}
        </Text>

        {attendance.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHistory}>
              Belum ada riwayat presensi.
            </Text>
          </View>
        ) : (
          attendance.map((record) => {
            const session = sessions.find(
              (item) => item.id === record.sessionId
            );

            return (
              <View
                key={record.sessionId}
                style={styles.historyCard}
              >
                <Text style={styles.sessionTitle}>
                  {session?.title ?? record.sessionId}
                </Text>

                <Text style={styles.sessionInfo}>
                  {session
                    ? `${session.date} | ${formatTime(session)}`
                    : 'Detail sesi tidak tersedia'}
                </Text>

                <Text style={styles.historyTime}>
                  Hadir:{' '}
                  {record.attendedAt
                    ? record.attendedAt.toLocaleString('id-ID')
                    : 'Menunggu sinkronisasi'}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={successSession !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessSession(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>✓</Text>

            <Text style={styles.modalTitle}>
              Presensi Berhasil!
            </Text>

            <Text style={styles.modalDescription}>
              Kehadiran {user?.name ?? 'praktikan'} pada sesi{' '}
              {successSession?.title ?? '-'} berhasil dicatat.
            </Text>

            <Pressable
              accessibilityRole="button"
              style={styles.modalButton}
              onPress={() => setSuccessSession(null)}
            >
              <Text style={styles.modalButtonText}>
                Tutup
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
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
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  notice: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  noticeText: {
    color: '#1E40AF',
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 28,
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    gap: 12,
  },
  userButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  userButtonText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  selectedButtonText: {
    color: '#FFFFFF',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  selectedSessionCard: {
    borderColor: '#2563EB',
    borderWidth: 2,
    backgroundColor: '#FFF0F6',
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sessionInfo: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
  },
  sessionStatus: {
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
  },
  openStatus: {
    color: '#28845A',
  },
  closedStatus: {
    color: '#A63D70',
  },
  selectedLabel: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 10,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0D3E1',
    padding: 16,
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#0F172A',
  },
  demoCard: {
    backgroundColor: '#FFF0F6',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  demoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A63D70',
  },
  demoDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    marginBottom: 14,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  activeStatusButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusButtonText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  activeStatusButtonText: {
    color: '#FFFFFF',
  },
  attendanceButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 17,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 24,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#B9B9B9',
  },
  attendanceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackText: {
    fontSize: 13,
    color: '#777777',
    marginTop: 12,
    textAlign: 'center',
  },
  historyDescription: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0D3E1',
  },
  emptyHistory: {
    color: '#777777',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
    marginBottom: 12,
  },
  historyTime: {
    color: '#28845A',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 48,
    color: '#28845A',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  modalDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
  },
  modalTime: {
    fontSize: 13,
    color: '#28845A',
    marginTop: 12,
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 24,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
