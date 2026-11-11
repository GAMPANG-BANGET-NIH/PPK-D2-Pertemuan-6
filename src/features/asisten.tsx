import { useLocalSearchParams } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ------------------------------------------------------------------ */
/* Tipe dan data dummy (salinan sendiri sesuai tabel PRD)              */
/* ------------------------------------------------------------------ */

type UserId = 'as1';
type SessionId = 's1' | 's2' | 's3';
type SessionStatus = 'belum_dibuka' | 'dibuka' | 'ditutup';
type StatusMap = Record<SessionId, SessionStatus>;

type Identity = { id: UserId; name: string };

type Session = {
  id: SessionId;
  title: string;
  className: string;
  time: string;
};

type Attendee = { name: string; attendedAt: string };

const DEFAULT_USER_ID: UserId = 'as1';
const DEFAULT_SESSION_ID: SessionId = 's1';

const IDENTITIES: Identity[] = [{ id: 'as1', name: 'Asisten Rina' }];

const SESSIONS: Session[] = [
  {
    id: 's1',
    title: 'Pemrograman Perangkat Bergerak',
    className: 'SI-5A',
    time: '08.00–09.40',
  },
  { id: 's2', title: 'Basis Data', className: 'SI-5B', time: '10.00–11.40' },
  { id: 's3', title: 'Visi Komputer', className: 'SI-5A', time: '13.00–14.40' },
];

const INITIAL_STATUSES: StatusMap = {
  s1: 'belum_dibuka',
  s2: 'dibuka',
  s3: 'ditutup',
};

// Rekap dummy: tidak bertambah otomatis ketika sesi dibuka.
const RECAP: Record<SessionId, Attendee[]> = {
  s1: [],
  s2: [{ name: 'Andi', attendedAt: '10.05' }],
  s3: [{ name: 'Budi', attendedAt: '13.03' }],
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  belum_dibuka: 'Belum dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

// Simbol tambahan agar status tidak dibedakan melalui warna saja.
const STATUS_SYMBOLS: Record<SessionStatus, string> = {
  belum_dibuka: '○',
  dibuka: '●',
  ditutup: '■',
};

// Transisi yang diizinkan: belum_dibuka → dibuka → ditutup. Ditutup final.
const NEXT_STATUS: Record<SessionStatus, SessionStatus | null> = {
  belum_dibuka: 'dibuka',
  dibuka: 'ditutup',
  ditutup: null,
};

/* ------------------------------------------------------------------ */
/* Penyimpanan state modul (hidup selama aplikasi berjalan)            */
/* ------------------------------------------------------------------ */

let statusStore: StatusMap = INITIAL_STATUSES;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): StatusMap {
  return statusStore;
}

/**
 * Validasi ulang di handler (bukan hanya menonaktifkan tombol):
 * perubahan hanya berlaku jika sesuai transisi dari status terkini.
 * Ketukan ganda pada konfirmasi menjadi no-op karena status sudah berubah.
 */
function applyTransition(sessionId: SessionId, to: SessionStatus): boolean {
  if (NEXT_STATUS[statusStore[sessionId]] !== to) {
    return false;
  }
  statusStore = { ...statusStore, [sessionId]: to };
  listeners.forEach((listener) => listener());
  return true;
}

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toUserId(value: string | undefined): UserId {
  return IDENTITIES.some((identity) => identity.id === value)
    ? (value as UserId)
    : DEFAULT_USER_ID;
}

function toSessionId(value: string | undefined): SessionId {
  return SESSIONS.some((session) => session.id === value)
    ? (value as SessionId)
    : DEFAULT_SESSION_ID;
}

type PendingChange = { sessionId: SessionId; to: SessionStatus };

/* ------------------------------------------------------------------ */
/* Komponen kecil                                                      */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <View style={[styles.badge, badgeStyles[status]]}>
      <Text style={styles.badgeText}>
        {STATUS_SYMBOLS[status]} {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Layar                                                               */
/* ------------------------------------------------------------------ */

export default function AsistenScreen() {
  const params = useLocalSearchParams<{
    userId?: string | string[];
    sessionId?: string | string[];
  }>();

  // Parameter hanya pilihan awal; nilai tidak valid memakai as1/s1.
  const [userId, setUserId] = useState<UserId>(() =>
    toUserId(firstParam(params.userId)),
  );
  const [sessionId, setSessionId] = useState<SessionId>(() =>
    toSessionId(firstParam(params.sessionId)),
  );
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const statuses = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const identity =
    IDENTITIES.find((item) => item.id === userId) ?? IDENTITIES[0];
  const session = SESSIONS.find((item) => item.id === sessionId) ?? SESSIONS[0];
  const status = statuses[session.id];
  const nextStatus = NEXT_STATUS[status];
  const attendees = RECAP[session.id];

  const actionLabel =
    nextStatus === 'dibuka'
      ? 'Buka sesi'
      : nextStatus === 'ditutup'
        ? 'Tutup sesi'
        : 'Sesi sudah ditutup';

  const handleSelectSession = (id: SessionId) => {
    setSessionId(id);
    setNotice(null);
  };

  const handleRequestChange = () => {
    const to = NEXT_STATUS[statuses[session.id]];
    if (!to) {
      return;
    }
    setPending({ sessionId: session.id, to });
  };

  const handleCancel = () => {
    // Batal tidak mengubah data.
    setPending(null);
  };

  const handleConfirm = () => {
    if (!pending) {
      return;
    }
    const target = SESSIONS.find((item) => item.id === pending.sessionId);
    const changed = applyTransition(pending.sessionId, pending.to);
    setPending(null);
    if (changed && target) {
      setNotice(
        `Status ${target.title} (${target.className}) sekarang: ${STATUS_LABELS[pending.to]}.`,
      );
    }
  };

  const pendingSession = pending
    ? SESSIONS.find((item) => item.id === pending.sessionId)
    : undefined;
  const pendingVerb = pending?.to === 'dibuka' ? 'membuka' : 'menutup';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          Pengelolaan Sesi Asisten
        </Text>
        <Text style={styles.simulation}>Data simulasi</Text>

        {/* Identitas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identitas</Text>
          <View style={styles.optionColumn}>
            {IDENTITIES.map((item) => {
              const selected = item.id === userId;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`Identitas ${item.name}`}
                  accessibilityState={{ selected }}
                  onPress={() => setUserId(item.id)}
                  style={[styles.option, selected && styles.optionSelected]}>
                  <Text
                    style={[
                      styles.optionTitle,
                      selected && styles.optionTitleSelected,
                    ]}>
                    {selected ? '✓ ' : ''}
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.optionMeta,
                      selected && styles.optionMetaSelected,
                    ]}>
                    Peran: Asisten
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Pilihan sesi + status di semua sesi */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pilih sesi</Text>
          <View style={styles.optionColumn}>
            {SESSIONS.map((item) => {
              const selected = item.id === sessionId;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`Sesi ${item.title}, kelas ${item.className}, status ${STATUS_LABELS[statuses[item.id]]}`}
                  accessibilityState={{ selected }}
                  onPress={() => handleSelectSession(item.id)}
                  style={[styles.option, selected && styles.optionSelected]}>
                  <Text
                    style={[
                      styles.optionTitle,
                      selected && styles.optionTitleSelected,
                    ]}>
                    {selected ? '✓ ' : ''}
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.optionMeta,
                      selected && styles.optionMetaSelected,
                    ]}>
                    {item.className} · {item.time}
                  </Text>
                  <View style={styles.optionBadgeRow}>
                    <StatusBadge status={statuses[item.id]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Detail sesi */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Detail sesi</Text>
          <Text style={styles.detailTitle}>{session.title}</Text>
          <Text style={styles.detailLine}>Kelas: {session.className}</Text>
          <Text style={styles.detailLine}>Waktu: {session.time}</Text>
          <Text style={styles.detailLine}>Asisten: {identity.name}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.detailLine}>Status:</Text>
            <StatusBadge status={status} />
          </View>

          {notice ? (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ disabled: !nextStatus }}
            disabled={!nextStatus}
            onPress={handleRequestChange}
            style={[
              styles.actionButton,
              !nextStatus && styles.actionButtonDisabled,
            ]}>
            <Text
              style={[
                styles.actionButtonText,
                !nextStatus && styles.actionButtonTextDisabled,
              ]}>
              {actionLabel}
            </Text>
          </Pressable>
          {!nextStatus ? (
            <Text style={styles.hint}>
              Sesi yang sudah ditutup tidak dapat dibuka kembali.
            </Text>
          ) : null}
        </View>

        {/* Rekap */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rekap kehadiran</Text>
          <Text style={styles.simulation}>
            Rekap dummy · Data simulasi, bukan hasil presensi Praktikan
          </Text>
          <Text style={styles.detailLine}>
            {session.title} ({session.className}) · {attendees.length} peserta
            hadir
          </Text>

          {attendees.length === 0 ? (
            <Text style={styles.empty}>
              Belum ada peserta yang hadir pada sesi ini. Membuka sesi tidak
              menambah peserta secara otomatis.
            </Text>
          ) : (
            <View style={styles.recapList}>
              {attendees.map((attendee) => (
                <View key={attendee.name} style={styles.recapRow}>
                  <Text style={styles.recapName}>{attendee.name}</Text>
                  <Text style={styles.recapTime}>
                    Hadir pukul {attendee.attendedAt}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal konfirmasi */}
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.modalTitle} accessibilityRole="header">
              Konfirmasi {pending?.to === 'dibuka' ? 'buka' : 'tutup'} sesi
            </Text>
            <Text style={styles.modalMessage}>
              Anda akan {pendingVerb} sesi {pendingSession?.title} (
              {pendingSession?.className}).
              {pending?.to === 'ditutup'
                ? ' Sesi yang sudah ditutup tidak dapat dibuka kembali.'
                : ''}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Batal"
                onPress={handleCancel}
                style={[styles.modalButton, styles.modalCancel]}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  pending?.to === 'dibuka' ? 'Ya, buka sesi' : 'Ya, tutup sesi'
                }
                onPress={handleConfirm}
                style={[styles.modalButton, styles.modalConfirm]}>
                <Text style={styles.modalConfirmText}>
                  {pending?.to === 'dibuka' ? 'Ya, buka sesi' : 'Ya, tutup sesi'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Style lokal                                                         */
/* ------------------------------------------------------------------ */

const badgeStyles = StyleSheet.create({
  belum_dibuka: { backgroundColor: '#F1F3F5', borderColor: '#5C6670' },
  dibuka: { backgroundColor: '#E6F4EA', borderColor: '#1E6B3A' },
  ditutup: { backgroundColor: '#FDECEA', borderColor: '#9B2C2C' },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1F24',
  },
  simulation: {
    fontSize: 13,
    color: '#4A5159',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1B1F24',
  },
  optionColumn: {
    gap: 8,
  },
  option: {
    minHeight: 48,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8BFC7',
    backgroundColor: '#FFFFFF',
    gap: 2,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: '#1F4FD8',
    backgroundColor: '#E8EEFF',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1F24',
  },
  optionTitleSelected: {
    color: '#12308C',
  },
  optionMeta: {
    fontSize: 14,
    color: '#4A5159',
  },
  optionMetaSelected: {
    color: '#243B7A',
  },
  optionBadgeRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1B1F24',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DAE0',
    gap: 8,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1F24',
  },
  detailLine: {
    fontSize: 15,
    color: '#2B3037',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  notice: {
    fontSize: 14,
    color: '#12308C',
    backgroundColor: '#E8EEFF',
    padding: 10,
    borderRadius: 8,
  },
  actionButton: {
    minHeight: 48,
    marginTop: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#1F4FD8',
  },
  actionButtonDisabled: {
    backgroundColor: '#E3E6EA',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionButtonTextDisabled: {
    color: '#4A5159',
  },
  hint: {
    fontSize: 13,
    color: '#4A5159',
  },
  empty: {
    fontSize: 14,
    color: '#4A5159',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#B8BFC7',
  },
  recapList: {
    gap: 8,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F1F3F5',
  },
  recapName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B1F24',
  },
  recapTime: {
    fontSize: 14,
    color: '#2B3037',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1F24',
  },
  modalMessage: {
    fontSize: 15,
    color: '#2B3037',
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalButton: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalCancel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#5C6670',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1F24',
  },
  modalConfirm: {
    backgroundColor: '#1F4FD8',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
