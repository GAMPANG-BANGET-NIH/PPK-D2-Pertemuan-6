
import { useRef, useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type UserId = 'p1' | 'p2';
type SessionId = 's1' | 's2' | 's3';
type SessionStatus = 'belum_dibuka' | 'dibuka' | 'ditutup';

type AttendanceRecord = {
  userId: UserId;
  sessionId: SessionId;
  attendedAt: string;
};

type Session = {
  id: SessionId;
  title: string;
  className: string;
  time: string;
  status: SessionStatus;
};

const users: { id: UserId; name: string }[] = [
  { id: 'p1', name: 'Andi' },
  { id: 'p2', name: 'Budi' },
];

const sessions: Session[] = [
  {
    id: 's1',
    title: 'Pemrograman Perangkat Bergerak',
    className: 'SI-5A',
    time: '08.00–09.40',
    status: 'belum_dibuka',
  },
  {
    id: 's2',
    title: 'Basis Data',
    className: 'SI-5B',
    time: '10.00–11.40',
    status: 'dibuka',
  },
  {
    id: 's3',
    title: 'Visi Komputer',
    className: 'SI-5A',
    time: '13.00–14.40',
    status: 'ditutup',
  },
];

const statusLabels: Record<SessionStatus, string> = {
  belum_dibuka: 'Belum Dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

export default function PraktikanScreen() {
  const [selectedUserId, setSelectedUserId] =
    useState<UserId>('p1');

  const [selectedSessionId, setSelectedSessionId] =
    useState<SessionId>('s2');

  const [attendanceRecords, setAttendanceRecords] =
    useState<AttendanceRecord[]>([]);

  const recordsRef = useRef<AttendanceRecord[]>([]);

  const [sessionStatuses, setSessionStatuses] = useState<
    Record<SessionId, SessionStatus>
  >({
    s1: 'belum_dibuka',
    s2: 'dibuka',
    s3: 'ditutup',
  });

  const [successRecord, setSuccessRecord] =
    useState<AttendanceRecord | null>(null);

  const selectedUser = users.find(
    (user) => user.id === selectedUserId
  );

  const selectedSession = sessions.find(
    (session) => session.id === selectedSessionId
  );

  const currentStatus = sessionStatuses[selectedSessionId];

  const alreadyAttended = attendanceRecords.some(
    (record) =>
      record.userId === selectedUserId &&
      record.sessionId === selectedSessionId
  );

  const canAttend =
    currentStatus === 'dibuka' && !alreadyAttended;

  const userAttendanceHistory = attendanceRecords.filter(
    (record) => record.userId === selectedUserId
  );

  const changeSessionStatus = (status: SessionStatus) => {
    setSessionStatuses((previous) => ({
      ...previous,
      [selectedSessionId]: status,
    }));
  };

  const handleAttendance = () => {
    // Validasi dilakukan kembali saat tombol ditekan.
    if (sessionStatuses[selectedSessionId] !== 'dibuka') {
      Alert.alert(
        'Presensi ditolak',
        'Sesi praktikum belum dibuka atau sudah ditutup.'
      );
      return;
    }

    const duplicate = recordsRef.current.some(
      (record) =>
        record.userId === selectedUserId &&
        record.sessionId === selectedSessionId
    );

    if (duplicate) {
      Alert.alert(
        'Sudah presensi',
        'Praktikan ini sudah melakukan presensi pada sesi tersebut.'
      );
      return;
    }

    const newRecord: AttendanceRecord = {
      userId: selectedUserId,
      sessionId: selectedSessionId,
      attendedAt: new Date().toISOString(),
    };

    // Ref langsung diperbarui agar ketukan cepat
    // tidak membuat dua catatan untuk kombinasi yang sama.
    recordsRef.current = [
      ...recordsRef.current,
      newRecord,
    ];

    setAttendanceRecords(recordsRef.current);
    setSuccessRecord(newRecord);
  };

  const successUser = users.find(
    (user) => user.id === successRecord?.userId
  );

  const successSession = sessions.find(
    (session) => session.id === successRecord?.sessionId
  );

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
          Data simulasi — Modul Praktikan
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Mode demonstrasi. Data hanya tersimpan
            selama aplikasi berjalan dan tidak
            tersinkronisasi dengan modul asisten.
          </Text>
        </View>

        {/* PILIH PRAKTIKAN */}
        <Text style={styles.sectionTitle}>
          1. Pilih Praktikan
        </Text>

        <View style={styles.userRow}>
          {users.map((user) => (
            <Pressable
              key={user.id}
              accessibilityRole="button"
              accessibilityState={{
                selected: selectedUserId === user.id,
              }}
              style={[
                styles.userButton,
                selectedUserId === user.id &&
                  styles.selectedButton,
              ]}
              onPress={() => setSelectedUserId(user.id)}
            >
              <Text
                style={[
                  styles.userButtonText,
                  selectedUserId === user.id &&
                    styles.selectedButtonText,
                ]}
              >
                {user.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* PILIH SESI */}
        <Text style={styles.sectionTitle}>
          2. Pilih Sesi Praktikum
        </Text>

        {sessions.map((session) => {
          const status = sessionStatuses[session.id];
          const selected =
            selectedSessionId === session.id;

          return (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.sessionCard,
                selected && styles.selectedSessionCard,
              ]}
              onPress={() =>
                setSelectedSessionId(session.id)
              }
            >
              <Text style={styles.sessionTitle}>
                {session.title}
              </Text>

              <Text style={styles.sessionInfo}>
                {session.className} | {session.time}
              </Text>

              <Text
                style={[
                  styles.sessionStatus,
                  status === 'dibuka'
                    ? styles.openStatus
                    : styles.closedStatus,
                ]}
              >
                Status: {statusLabels[status]}
              </Text>

              {selected && (
                <Text style={styles.selectedLabel}>
                  ✓ Sesi dipilih
                </Text>
              )}
            </Pressable>
          );
        })}

        {/* DETAIL SESI */}
        <Text style={styles.sectionTitle}>
          3. Detail Presensi
        </Text>

        <View style={styles.detailCard}>
          <Text style={styles.detailText}>
            Praktikan: {selectedUser?.name}
          </Text>

          <Text style={styles.detailText}>
            Sesi: {selectedSession?.title}
          </Text>

          <Text style={styles.detailText}>
            Kelas: {selectedSession?.className}
          </Text>

          <Text style={styles.detailText}>
            Waktu: {selectedSession?.time}
          </Text>

          <Text style={styles.detailText}>
            Status: {statusLabels[currentStatus]}
          </Text>
        </View>

        {/* KONTROL DEMO */}
        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>
            Kontrol Status — Data Simulasi
          </Text>

          <Text style={styles.demoDescription}>
            Ubah status sesi yang dipilih untuk
            menguji validasi presensi. Perubahan ini
            hanya berlaku di modul praktikan.
          </Text>

          <View style={styles.statusRow}>
            {(
              [
                'belum_dibuka',
                'dibuka',
                'ditutup',
              ] as SessionStatus[]
            ).map((status) => (
              <Pressable
                key={status}
                accessibilityRole="button"
                accessibilityState={{
                  selected: currentStatus === status,
                }}
                style={[
                  styles.statusButton,
                  currentStatus === status &&
                    styles.activeStatusButton,
                ]}
                onPress={() =>
                  changeSessionStatus(status)
                }
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    currentStatus === status &&
                      styles.activeStatusButtonText,
                  ]}
                >
                  {statusLabels[status]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* TOMBOL PRESENSI */}
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
            {alreadyAttended
              ? 'Sudah Presensi'
              : currentStatus !== 'dibuka'
                ? 'Presensi Belum Tersedia'
                : 'Lakukan Presensi'}
          </Text>
        </Pressable>

        {alreadyAttended && (
          <Text style={styles.feedbackText}>
            Kehadiran kamu sudah tercatat untuk
            sesi ini.
          </Text>
        )}

        {currentStatus !== 'dibuka' &&
          !alreadyAttended && (
            <Text style={styles.feedbackText}>
              Presensi hanya dapat dilakukan
              ketika status sesi Dibuka.
            </Text>
          )}

        {/* RIWAYAT */}
        <Text style={styles.sectionTitle}>
          4. Riwayat Presensi
        </Text>

        <Text style={styles.historyDescription}>
          Riwayat untuk {selectedUser?.name}
        </Text>

        {userAttendanceHistory.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHistory}>
              Belum ada riwayat presensi untuk
              praktikan ini.
            </Text>
          </View>
        ) : (
          userAttendanceHistory.map((record) => {
            const session = sessions.find(
              (item) => item.id === record.sessionId
            );

            return (
              <View
                key={`${record.userId}-${record.sessionId}`}
                style={styles.historyCard}
              >
                <Text style={styles.sessionTitle}>
                  {session?.title ?? record.sessionId}
                </Text>

                <Text style={styles.sessionInfo}>
                  {session?.className} | {session?.time}
                </Text>

                <Text style={styles.historyTime}>
                  Hadir:{' '}
                  {new Date(
                    record.attendedAt
                  ).toLocaleString('id-ID')}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* MODAL BERHASIL */}
      <Modal
        visible={successRecord !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>✓</Text>

            <Text style={styles.modalTitle}>
              Presensi Berhasil!
            </Text>

            <Text style={styles.modalDescription}>
              Kehadiran {successUser?.name} pada
              sesi {successSession?.title} berhasil
              dicatat.
            </Text>

            {successRecord && (
              <Text style={styles.modalTime}>
                {new Date(
                  successRecord.attendedAt
                ).toLocaleString('id-ID')}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              style={styles.modalButton}
              onPress={() => setSuccessRecord(null)}
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
    backgroundColor: '#FFF7FB',
  },
  container: {
    padding: 20,
    paddingBottom: 50,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#303047',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  notice: {
    backgroundColor: '#FCE8F1',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  noticeText: {
    color: '#7A4160',
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#303047',
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
    borderColor: '#E7B8CF',
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#D85A91',
    borderColor: '#D85A91',
  },
  userButtonText: {
    color: '#303047',
    fontWeight: '600',
  },
  selectedButtonText: {
    color: '#FFFFFF',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7B8CF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  selectedSessionCard: {
    borderColor: '#D85A91',
    borderWidth: 2,
    backgroundColor: '#FFF0F6',
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#303047',
  },
  sessionInfo: {
    fontSize: 13,
    color: '#666666',
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
    color: '#D85A91',
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
    color: '#303047',
  },
  demoCard: {
    backgroundColor: '#FFF0F6',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E7B8CF',
  },
  demoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A63D70',
  },
  demoDescription: {
    fontSize: 12,
    color: '#666666',
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
    borderColor: '#E7B8CF',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  activeStatusButton: {
    backgroundColor: '#D85A91',
    borderColor: '#D85A91',
  },
  statusButtonText: {
    fontSize: 12,
    color: '#303047',
    fontWeight: '600',
  },
  activeStatusButtonText: {
    color: '#FFFFFF',
  },
  attendanceButton: {
    backgroundColor: '#D85A91',
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
    color: '#666666',
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
    borderColor: '#E7B8CF',
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
    color: '#303047',
    marginTop: 10,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666666',
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
    backgroundColor: '#D85A91',
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
