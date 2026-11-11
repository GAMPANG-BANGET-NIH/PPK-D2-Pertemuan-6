import { type Href, router } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Role = 'asisten' | 'praktikan';
type UserId = 'as1' | 'p1' | 'p2';
type SessionId = 's1' | 's2' | 's3';
type SessionStatus = 'belum_dibuka' | 'dibuka' | 'ditutup';
type StatusFilter = 'semua' | SessionStatus;
type ClassFilter = 'semua' | 'SI-5A' | 'SI-5B';

type UserIdentity = {
  id: UserId;
  name: string;
  role: Role;
  roleLabel: string;
};

type PracticalSession = {
  sessionId: SessionId;
  title: string;
  className: 'SI-5A' | 'SI-5B';
  timeRange: string;
  initialStatus: SessionStatus;
};

const IDENTITIES: UserIdentity[] = [
  {
    id: 'as1',
    name: 'Asisten Rina',
    role: 'asisten',
    roleLabel: 'Asisten Praktikum',
  },
  {
    id: 'p1',
    name: 'Andi',
    role: 'praktikan',
    roleLabel: 'Praktikan',
  },
  {
    id: 'p2',
    name: 'Budi',
    role: 'praktikan',
    roleLabel: 'Praktikan',
  },
];

const INITIAL_SESSIONS: PracticalSession[] = [
  {
    sessionId: 's1',
    title: 'Pemrograman Perangkat Bergerak',
    className: 'SI-5A',
    timeRange: '08.00–09.40',
    initialStatus: 'belum_dibuka',
  },
  {
    sessionId: 's2',
    title: 'Basis Data',
    className: 'SI-5B',
    timeRange: '10.00–11.40',
    initialStatus: 'dibuka',
  },
  {
    sessionId: 's3',
    title: 'Visi Komputer',
    className: 'SI-5A',
    timeRange: '13.00–14.40',
    initialStatus: 'ditutup',
  },
];

const STATUS_META: Record<
  SessionStatus,
  {
    label: string;
    symbol: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    description: string;
  }
> = {
  belum_dibuka: {
    label: 'Belum dibuka',
    symbol: '○',
    badgeBg: '#FEF3C7',
    badgeBorder: '#F59E0B',
    badgeText: '#92400E',
    description: 'Sesi dijadwalkan dan menunggu dibuka oleh Asisten.',
  },
  dibuka: {
    label: 'Dibuka',
    symbol: '●',
    badgeBg: '#DCFCE7',
    badgeBorder: '#16A34A',
    badgeText: '#166534',
    description: 'Sesi sedang berlangsung dan terbuka untuk presensi.',
  },
  ditutup: {
    label: 'Ditutup',
    symbol: '■',
    badgeBg: '#F1F5F9',
    badgeBorder: '#64748B',
    badgeText: '#334155',
    description: 'Sesi telah berakhir dan presensi ditutup.',
  },
};

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'semua', label: 'Semua Status' },
  { value: 'belum_dibuka', label: '○ Belum dibuka' },
  { value: 'dibuka', label: '● Dibuka' },
  { value: 'ditutup', label: '■ Ditutup' },
];

const CLASS_FILTER_OPTIONS: { value: ClassFilter; label: string }[] = [
  { value: 'semua', label: 'Semua Kelas' },
  { value: 'SI-5A', label: 'Kelas SI-5A' },
  { value: 'SI-5B', label: 'Kelas SI-5B' },
];

function isValidRoleIdentityPair(
  role: Role | null,
  userId: UserId | null
): boolean {
  if (!role || !userId) {
    return false;
  }
  const found = IDENTITIES.find((item) => item.id === userId);
  return Boolean(found && found.role === role);
}

export default function JadwalPraktikumScreen() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<UserId | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua');
  const [classFilter, setClassFilter] = useState<ClassFilter>('semua');
  const [detailSessionId, setDetailSessionId] = useState<SessionId | null>(null);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);

  const availableIdentities = selectedRole
    ? IDENTITIES.filter((item) => item.role === selectedRole)
    : [];

  const isAccessValid = isValidRoleIdentityPair(selectedRole, selectedUserId);

  const selectedIdentity = IDENTITIES.find(
    (item) => item.id === selectedUserId && item.role === selectedRole
  );

  const filteredSessions = INITIAL_SESSIONS.filter((session) => {
    const matchesStatus =
      statusFilter === 'semua' || session.initialStatus === statusFilter;
    const matchesClass =
      classFilter === 'semua' || session.className === classFilter;
    return matchesStatus && matchesClass;
  });

  const detailSession =
    INITIAL_SESSIONS.find((item) => item.sessionId === detailSessionId) ?? null;

  function handleSelectRole(nextRole: Role) {
    if (selectedRole !== nextRole) {
      setSelectedRole(nextRole);
      setSelectedUserId(null);
      setValidationNotice(
        `Peran diubah ke ${
          nextRole === 'asisten' ? 'Asisten' : 'Praktikan'
        }. Silakan pilih identitas yang sesuai.`
      );
      return;
    }
    setValidationNotice(null);
  }

  function handleSelectIdentity(nextUserId: UserId) {
    if (!selectedRole) {
      setValidationNotice('Pilih peran terlebih dahulu sebelum memilih identitas.');
      return;
    }
    const matchingIdentity = IDENTITIES.find(
      (item) => item.id === nextUserId && item.role === selectedRole
    );
    if (!matchingIdentity) {
      setValidationNotice('Identitas tidak sesuai dengan peran yang dipilih.');
      return;
    }
    setSelectedUserId(nextUserId);
    setValidationNotice(null);
  }

  function handleResetAccessForm() {
    setSelectedRole(null);
    setSelectedUserId(null);
    setValidationNotice('Pilihan peran dan identitas telah direset.');
  }

  function navigateToRoleModule(targetSessionId: SessionId) {
    if (!isValidRoleIdentityPair(selectedRole, selectedUserId) || !selectedRole || !selectedUserId) {
      setValidationNotice(
        'Akses ditolak: pilih peran dan identitas yang valid terlebih dahulu.'
      );
      return;
    }

    const isKnownSession = INITIAL_SESSIONS.some(
      (item) => item.sessionId === targetSessionId
    );
    if (!isKnownSession) {
      setValidationNotice('Sesi praktikum tidak valid.');
      return;
    }

    setValidationNotice(null);
    setDetailSessionId(null);

    const routePath = selectedRole === 'asisten' ? '/asisten' : '/praktikan';
    const targetHref =
      `${routePath}?userId=${encodeURIComponent(selectedUserId)}&sessionId=${encodeURIComponent(
        targetSessionId
      )}` as Href;

    router.push(targetHref);
  }

  function handleQuickContinue() {
    if (!isValidRoleIdentityPair(selectedRole, selectedUserId) || !selectedRole) {
      setValidationNotice(
        'Akses ditolak: lengkapi pilihan peran dan identitas sebelum melanjutkan.'
      );
      return;
    }
    const defaultSessionId: SessionId = selectedRole === 'asisten' ? 's1' : 's2';
    navigateToRoleModule(defaultSessionId);
  }

  function handleOpenDetailModal(sessionId: SessionId) {
    setDetailSessionId(sessionId);
  }

  function handleCloseDetailModal() {
    setDetailSessionId(null);
  }

  function handleResetFilters() {
    setStatusFilter('semua');
    setClassFilter('semua');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {/* Banner Informasi Simulasi */}
        <View style={styles.simulationBanner}>
          <View style={styles.simulationBadgeRow}>
            <View style={styles.simulationBadge}>
              <Text style={styles.simulationBadgeText}>DATA SIMULASI</Text>
            </View>
            <View style={styles.simulationSubBadge}>
              <Text style={styles.simulationSubBadgeText}>
                Status awal simulasi
              </Text>
            </View>
          </View>
          <Text style={styles.simulationTitle}>
            Portal Jadwal & Akses Presensi Praktikum
          </Text>
          <Text style={styles.simulationDescription}>
            Pilih peran dan identitas pengguna, lalu pilih sesi jadwal praktikum
            untuk melihat detail atau masuk ke modul sesuai peran.
          </Text>
        </View>

        {/* Bagian 1: Form Pilihan Peran & Identitas */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>1. Akses Pengguna</Text>
            {(selectedRole !== null || selectedUserId !== null) && (
              <Pressable
                onPress={handleResetAccessForm}
                style={({ pressed }) => [
                  styles.resetInlineButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Reset pilihan peran dan identitas">
                <Text style={styles.resetInlineButtonText}>Reset Pilihan</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.fieldLabel}>Pilih Peran Pengguna</Text>
          <View style={styles.optionRow}>
            <Pressable
              onPress={() => handleSelectRole('asisten')}
              style={({ pressed }) => [
                styles.optionButton,
                selectedRole === 'asisten' && styles.optionButtonActive,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedRole === 'asisten' }}>
              <Text
                style={[
                  styles.optionButtonTitle,
                  selectedRole === 'asisten' && styles.optionButtonTitleActive,
                ]}>
                {selectedRole === 'asisten' ? '✓ ' : ''}Asisten
              </Text>
              <Text
                style={[
                  styles.optionButtonSub,
                  selectedRole === 'asisten' && styles.optionButtonSubActive,
                ]}>
                Kelola & rekap sesi
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleSelectRole('praktikan')}
              style={({ pressed }) => [
                styles.optionButton,
                selectedRole === 'praktikan' && styles.optionButtonActive,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedRole === 'praktikan' }}>
              <Text
                style={[
                  styles.optionButtonTitle,
                  selectedRole === 'praktikan' && styles.optionButtonTitleActive,
                ]}>
                {selectedRole === 'praktikan' ? '✓ ' : ''}Praktikan
              </Text>
              <Text
                style={[
                  styles.optionButtonSub,
                  selectedRole === 'praktikan' && styles.optionButtonSubActive,
                ]}>
                Presensi & riwayat hadir
              </Text>
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>Pilih Identitas</Text>
          {selectedRole === null ? (
            <View style={styles.emptyIdentityBox}>
              <Text style={styles.emptyIdentityText}>
                Pilih peran (Asisten atau Praktikan) terlebih dahulu untuk
                menampilkan pilihan identitas.
              </Text>
            </View>
          ) : (
            <View style={styles.optionRow}>
              {availableIdentities.map((identity) => {
                const isSelected = selectedUserId === identity.id;
                return (
                  <Pressable
                    key={identity.id}
                    onPress={() => handleSelectIdentity(identity.id)}
                    style={({ pressed }) => [
                      styles.optionButton,
                      isSelected && styles.optionButtonActive,
                      pressed && styles.buttonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}>
                    <Text
                      style={[
                        styles.optionButtonTitle,
                        isSelected && styles.optionButtonTitleActive,
                      ]}>
                      {isSelected ? '✓ ' : ''}
                      {identity.name}
                    </Text>
                    <Text
                      style={[
                        styles.optionButtonSub,
                        isSelected && styles.optionButtonSubActive,
                      ]}>
                      ID: {identity.id} ({identity.roleLabel})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Ringkasan status pilihan akses */}
          <View
            style={[
              styles.selectionStatusBox,
              isAccessValid
                ? styles.selectionStatusValid
                : styles.selectionStatusIncomplete,
            ]}>
            <Text
              style={[
                styles.selectionStatusTitle,
                isAccessValid
                  ? styles.selectionStatusTitleValid
                  : styles.selectionStatusTitleIncomplete,
              ]}>
              {isAccessValid && selectedIdentity
                ? `✓ Siap masuk sebagai ${selectedIdentity.name} (${selectedIdentity.id}) — Peran: ${
                    selectedRole === 'asisten' ? 'Asisten' : 'Praktikan'
                  }`
                : '× Pilihan belum lengkap: wajib memilih Peran dan Identitas'}
            </Text>
            {validationNotice && (
              <Text style={styles.validationNoticeText}>{validationNotice}</Text>
            )}
          </View>

          <Pressable
            disabled={!isAccessValid}
            onPress={handleQuickContinue}
            style={({ pressed }) => [
              styles.primaryButton,
              !isAccessValid && styles.primaryButtonDisabled,
              pressed && isAccessValid && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isAccessValid }}>
            <Text
              style={[
                styles.primaryButtonText,
                !isAccessValid && styles.primaryButtonTextDisabled,
              ]}>
              {isAccessValid && selectedRole
                ? `Lanjut ke Modul ${
                    selectedRole === 'asisten' ? 'Asisten' : 'Praktikan'
                  } (Sesi Default ${selectedRole === 'asisten' ? 's1' : 's2'})`
                : 'Lanjut ke Modul (Pilih Peran & Identitas Dulu)'}
            </Text>
          </Pressable>
        </View>

        {/* Bagian 2: Filter & Daftar Jadwal Praktikum */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.sectionTitle}>2. Jadwal Praktikum</Text>
              <Text style={styles.sectionSubtitle}>
                Status awal simulasi ({filteredSessions.length} dari{' '}
                {INITIAL_SESSIONS.length} sesi ditampilkan)
              </Text>
            </View>
            {(statusFilter !== 'semua' || classFilter !== 'semua') && (
              <Pressable
                onPress={handleResetFilters}
                style={({ pressed }) => [
                  styles.resetInlineButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button">
                <Text style={styles.resetInlineButtonText}>Reset Filter</Text>
              </Pressable>
            )}
          </View>

          {/* Filter Status */}
          <Text style={styles.filterGroupLabel}>Filter Status Awal:</Text>
          <View style={styles.filterChipsContainer}>
            {STATUS_FILTER_OPTIONS.map((option) => {
              const isSelected = statusFilter === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setStatusFilter(option.value)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    isSelected && styles.filterChipActive,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Filter Kelas */}
          <Text style={styles.filterGroupLabel}>Filter Kelas:</Text>
          <View style={styles.filterChipsContainer}>
            {CLASS_FILTER_OPTIONS.map((option) => {
              const isSelected = classFilter === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setClassFilter(option.value)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    isSelected && styles.filterChipActive,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}>
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Daftar Sesi atau Kondisi Kosong */}
          {filteredSessions.length === 0 ? (
            <View style={styles.emptyScheduleBox}>
              <Text style={styles.emptyScheduleTitle}>
                Tidak Ada Jadwal yang Cocok
              </Text>
              <Text style={styles.emptyScheduleDescription}>
                Tidak ditemukan sesi praktikum untuk kombinasi filter Status &ldquo;
                {
                  STATUS_FILTER_OPTIONS.find((item) => item.value === statusFilter)
                    ?.label
                }
                &rdquo; dan &ldquo;
                {
                  CLASS_FILTER_OPTIONS.find((item) => item.value === classFilter)
                    ?.label
                }
                &rdquo;.
              </Text>
              <Pressable
                onPress={handleResetFilters}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>
                  Tampilkan Semua Jadwal
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.sessionList}>
              {filteredSessions.map((session) => {
                const statusInfo = STATUS_META[session.initialStatus];
                return (
                  <View key={session.sessionId} style={styles.sessionCard}>
                    <View style={styles.sessionCardTopRow}>
                      <View style={styles.sessionCodeBadge}>
                        <Text style={styles.sessionCodeText}>
                          Sesi {session.sessionId.toUpperCase()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: statusInfo.badgeBg,
                            borderColor: statusInfo.badgeBorder,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: statusInfo.badgeText },
                          ]}>
                          {statusInfo.symbol} Status awal: {statusInfo.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.sessionTitle}>{session.title}</Text>

                    <View style={styles.sessionMetaGrid}>
                      <View style={styles.sessionMetaItem}>
                        <Text style={styles.sessionMetaLabel}>Kelas</Text>
                        <Text style={styles.sessionMetaValue}>
                          {session.className}
                        </Text>
                      </View>
                      <View style={styles.sessionMetaItem}>
                        <Text style={styles.sessionMetaLabel}>Waktu Lokal</Text>
                        <Text style={styles.sessionMetaValue}>
                          {session.timeRange} WIB
                        </Text>
                      </View>
                    </View>

                    <View style={styles.sessionActionsRow}>
                      <Pressable
                        onPress={() => handleOpenDetailModal(session.sessionId)}
                        style={({ pressed }) => [
                          styles.detailButton,
                          pressed && styles.buttonPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Lihat detail sesi ${session.title}`}>
                        <Text style={styles.detailButtonText}>
                          Lihat Detail Sesi
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal Detail Sesi */}
      <Modal
        visible={detailSession !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDetailModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}>
              {detailSession && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalHeaderBadge}>
                      DETAIL SESI PRAKTIKUM (DATA SIMULASI)
                    </Text>
                    <Text style={styles.modalTitle}>{detailSession.title}</Text>
                  </View>

                  <View style={styles.modalInfoTable}>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>ID Sesi</Text>
                      <Text style={styles.modalInfoValue}>
                        {detailSession.sessionId}
                      </Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>Kelas</Text>
                      <Text style={styles.modalInfoValue}>
                        {detailSession.className}
                      </Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>Waktu Lokal</Text>
                      <Text style={styles.modalInfoValue}>
                        {detailSession.timeRange} WIB
                      </Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>
                        Status Awal Simulasi
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              STATUS_META[detailSession.initialStatus].badgeBg,
                            borderColor:
                              STATUS_META[detailSession.initialStatus]
                                .badgeBorder,
                          },
                        ]}>
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color:
                                STATUS_META[detailSession.initialStatus]
                                  .badgeText,
                            },
                          ]}>
                          {STATUS_META[detailSession.initialStatus].symbol}{' '}
                          {STATUS_META[detailSession.initialStatus].label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.modalStatusDescription}>
                    {STATUS_META[detailSession.initialStatus].description}{' '}
                    Jadwal di beranda menampilkan status awal simulasi.
                  </Text>

                  {/* Informasi kesiapan akses pengguna */}
                  <View
                    style={[
                      styles.modalAccessBox,
                      isAccessValid
                        ? styles.modalAccessBoxValid
                        : styles.modalAccessBoxInvalid,
                    ]}>
                    <Text style={styles.modalAccessTitle}>
                      Akses Modul Tujuan
                    </Text>
                    {isAccessValid && selectedIdentity && selectedRole ? (
                      <>
                        <Text style={styles.modalAccessText}>
                          Peran:{' '}
                          <Text style={styles.modalAccessBold}>
                            {selectedRole === 'asisten' ? 'Asisten' : 'Praktikan'}
                          </Text>{' '}
                          | Identitas:{' '}
                          <Text style={styles.modalAccessBold}>
                            {selectedIdentity.name} ({selectedIdentity.id})
                          </Text>
                        </Text>
                        <Text style={styles.modalRoutePreview}>
                          Tujuan: /{selectedRole}?userId={selectedIdentity.id}
                          &sessionId={detailSession.sessionId}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.modalAccessWarningText}>
                        Peran dan identitas belum dipilih secara lengkap. Tutup
                        modal ini lalu pilih Peran dan Identitas pada bagian 1 di
                        Beranda untuk melanjutkan ke modul.
                      </Text>
                    )}
                  </View>

                  <View style={styles.modalButtonColumn}>
                    <Pressable
                      disabled={!isAccessValid}
                      onPress={() =>
                        navigateToRoleModule(detailSession.sessionId)
                      }
                      style={({ pressed }) => [
                        styles.primaryButton,
                        !isAccessValid && styles.primaryButtonDisabled,
                        pressed && isAccessValid && styles.buttonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !isAccessValid }}>
                      <Text
                        style={[
                          styles.primaryButtonText,
                          !isAccessValid && styles.primaryButtonTextDisabled,
                        ]}>
                        {isAccessValid && selectedRole
                          ? `Lanjut ke Modul ${
                              selectedRole === 'asisten' ? 'Asisten' : 'Praktikan'
                            } (${detailSession.sessionId})`
                          : 'Pilih Peran & Identitas Dulu untuk Lanjut'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={handleCloseDetailModal}
                      style={({ pressed }) => [
                        styles.cancelModalButton,
                        pressed && styles.buttonPressed,
                      ]}
                      accessibilityRole="button">
                      <Text style={styles.cancelModalButtonText}>
                        Batal / Tutup Detail
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  simulationBanner: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  simulationBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  simulationBadge: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  simulationBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  simulationSubBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  simulationSubBadgeText: {
    color: '#1E40AF',
    fontSize: 11,
    fontWeight: '600',
  },
  simulationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  simulationDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 180,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  resetInlineButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  resetInlineButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    minWidth: 135,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  optionButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  optionButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionButtonTitleActive: {
    color: '#1D4ED8',
  },
  optionButtonSub: {
    fontSize: 12,
    color: '#64748B',
  },
  optionButtonSubActive: {
    color: '#1E40AF',
  },
  emptyIdentityBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIdentityText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  selectionStatusBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  selectionStatusValid: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  selectionStatusIncomplete: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  selectionStatusTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  selectionStatusTitleValid: {
    color: '#166534',
  },
  selectionStatusTitleIncomplete: {
    color: '#92400E',
  },
  validationNoticeText: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButtonTextDisabled: {
    color: '#64748B',
  },
  filterGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  filterChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  emptyScheduleBox: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  emptyScheduleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptyScheduleDescription: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
  },
  secondaryButton: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  secondaryButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  sessionList: {
    gap: 12,
    marginTop: 4,
  },
  sessionCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  sessionCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionCodeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sessionCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sessionMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sessionMetaItem: {
    minWidth: 120,
    gap: 2,
  },
  sessionMetaLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  sessionMetaValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  sessionActionsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  detailButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  detailButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalScrollContent: {
    gap: 14,
  },
  modalHeader: {
    gap: 4,
  },
  modalHeaderBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalInfoTable: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalInfoLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  modalInfoValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  modalStatusDescription: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  modalAccessBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  modalAccessBoxValid: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  modalAccessBoxInvalid: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  modalAccessTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalAccessText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  modalAccessBold: {
    fontWeight: '700',
  },
  modalRoutePreview: {
    fontSize: 12,
    color: '#15803D',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  modalAccessWarningText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  modalButtonColumn: {
    gap: 10,
    marginTop: 2,
  },
  cancelModalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
});
