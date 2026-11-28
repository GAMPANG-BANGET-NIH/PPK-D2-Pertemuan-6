/**
 * Pengelolaan Sesi Praktikum oleh Asprak — Sprint 4, SRS-10 & SRS-11 (Moses).
 *
 * Cakupan wewenang Asprak pada Sprint 4:
 * - Melihat daftar laboratorium/kelas, jadwal mingguan, dan sesi praktikum yang
 *   menjadi tanggung jawabnya secara realtime dari Firestore.
 * - Membuka sesi saat praktikum dimulai dan menutup sesi setelah selesai melalui
 *   modal konfirmasi (`belum_dibuka -> dibuka -> ditutup`, satu arah & atomik).
 * - Memantau rekap kehadiran praktikan realtime (Hadir tepat waktu, Terlambat,
 *   Izin/excused, Belum hadir) sesuai `gracePeriodMinutes` laboratorium.
 * - TIDAK memiliki fitur konfigurasi laboratorium maupun distribusi/pemindahan
 *   anggota praktikan/asprak (wewenang tersebut berada pada peran `aslab`).
 */
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserHeader } from '../components/user-header';
import { useAuth } from '../context/auth-context';
import { useAsprakWorkspace, useSessionTransition } from '../hooks/use-sesi';
import { formatRupiah } from '../services/keterlambatan';
import type { AsprakSessionItem } from '../services/sesi';
import type { AppUser, SessionStatus } from '../types';
import { RekapKehadiranContent } from './rekap-kehadiran';

type WorkspaceTab = 'sesi' | 'jadwal' | 'rekap';
type SessionStatusFilter = 'semua' | SessionStatus;

type PendingTransition = {
  session: AsprakSessionItem;
  target: 'dibuka' | 'ditutup';
};

const NEXT_TRANSITION: Record<SessionStatus, 'dibuka' | 'ditutup' | null> = {
  belum_dibuka: 'dibuka',
  dibuka: 'ditutup',
  ditutup: null,
};

const STATUS_STYLE: Record<
  SessionStatus,
  { symbol: string; label: string; bg: string; fg: string; accent: string }
> = {
  belum_dibuka: {
    symbol: '○',
    label: 'Belum dibuka',
    bg: '#F1F5F9',
    fg: '#334155',
    accent: '#64748B',
  },
  dibuka: {
    symbol: '●',
    label: 'Dibuka',
    bg: '#ECFDF5',
    fg: '#0F766E',
    accent: '#0F766E',
  },
  ditutup: {
    symbol: '■',
    label: 'Ditutup',
    bg: '#FEF2F2',
    fg: '#B91C1C',
    accent: '#B91C1C',
  },
};

const DAY_NAMES = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
] as const;

function formatDay(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek - 1] ?? `Hari ke-${dayOfWeek}`;
}

function formatClock(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }
  return value?.trim() || null;
}

export type AsprakSesiScreenProps = {
  user?: AppUser | null;
  initialSessionId?: string | null;
  initialTab?: WorkspaceTab;
};

export default function AsprakSesiScreen(props: AsprakSesiScreenProps = {}) {
  const { user: authUser } = useAuth();
  const user = props.user !== undefined ? props.user : authUser;
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
    tab?: string | string[];
  }>();

  const paramSessionId = props.initialSessionId ?? firstParam(params.sessionId);
  const rawTab = props.initialTab ?? firstParam(params.tab);
  const defaultTab: WorkspaceTab =
    rawTab === 'jadwal' || rawTab === 'rekap' ? rawTab : 'sesi';

  const workspace = useAsprakWorkspace(user);
  const transition = useSessionTransition();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [selectedLabFilter, setSelectedLabFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>('semua');
  const [manualSessionId, setManualSessionId] = useState<string | null>(
    paramSessionId ?? null,
  );
  const [pending, setPending] = useState<PendingTransition | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const classMap = useMemo(
    () => new Map(workspace.classes.map((c) => [c.id, c.name])),
    [workspace.classes],
  );
  const labMap = useMemo(
    () => new Map(workspace.labs.map((l) => [l.id, l])),
    [workspace.labs],
  );

  const resolveClassName = (classId: string) => classMap.get(classId) ?? (classId || '-');

  const filteredSessions = useMemo(
    () =>
      workspace.sessions.filter(
        (s) =>
          (selectedLabFilter === null || s.labId === selectedLabFilter) &&
          (statusFilter === 'semua' || s.status === statusFilter),
      ),
    [workspace.sessions, selectedLabFilter, statusFilter],
  );

  const selectedSession = useMemo<AsprakSessionItem | null>(() => {
    if (manualSessionId) {
      const explicit = workspace.sessions.find((s) => s.id === manualSessionId);
      if (explicit) return explicit;
    }
    const openFirst = filteredSessions.find((s) => s.status === 'dibuka');
    if (openFirst) return openFirst;
    const upcoming = filteredSessions.find((s) => s.status === 'belum_dibuka');
    return upcoming ?? filteredSessions[0] ?? workspace.sessions[0] ?? null;
  }, [manualSessionId, workspace.sessions, filteredSessions]);

  const pendingLiveSession = useMemo(() => {
    if (!pending) return null;
    return workspace.sessions.find((s) => s.id === pending.session.id) ?? null;
  }, [pending, workspace.sessions]);

  const openCount = useMemo(
    () => workspace.sessions.filter((s) => s.status === 'dibuka').length,
    [workspace.sessions],
  );

  function requestSessionTransition(session: AsprakSessionItem) {
    const next = NEXT_TRANSITION[session.status];
    if (!next) return;
    setFeedbackBanner(null);
    setModalError(null);
    setPending({ session, target: next });
  }

  function cancelTransitionModal() {
    if (transition.busy) return;
    setPending(null);
    setModalError(null);
  }

  async function confirmSessionTransition() {
    if (!pending) return;
    const { session, target } = pending;

    if (pendingLiveSession && pendingLiveSession.status !== session.status) {
      setModalError(
        `Status sesi telah berubah menjadi "${STATUS_STYLE[pendingLiveSession.status].label}". Tutup dialog ini dan periksa status terbaru.`,
      );
      return;
    }

    const res =
      target === 'dibuka'
        ? await transition.open(session.id)
        : await transition.close(session.id);

    if (!res.ok) {
      setModalError(res.message);
      return;
    }

    setPending(null);
    setModalError(null);
    setManualSessionId(session.id);
    setFeedbackBanner(
      target === 'dibuka'
        ? `Sesi "${session.title}" (${resolveClassName(session.classId)}) berhasil dibuka. Status tersinkron langsung ke aplikasi praktikan.`
        : `Sesi "${session.title}" (${resolveClassName(session.classId)}) berhasil ditutup permanen.`,
    );
  }

  function openInlineRecap(sessionId: string) {
    setManualSessionId(sessionId);
    setActiveTab('rekap');
  }

  /* Guard peran pengguna */
  if (!user) {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <View style={styles.guardBox}>
          <Text style={styles.emptyTitle}>Belum login</Text>
          <Text style={styles.emptyBody}>
            Silakan login menggunakan akun Asprak untuk mengelola pelaksanaan sesi praktikum.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (user.role !== 'asprak') {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <UserHeader />
        <View style={styles.guardBox}>
          <Text style={styles.emptyTitle}>Halaman khusus Asprak</Text>
          <Text style={styles.emptyBody}>
            Pengelolaan buka/tutup sesi praktikum hanya tersedia bagi peran Asprak. Konfigurasi
            laboratorium dan distribusi anggota dikelola oleh Aslab.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedLab = selectedSession?.labId ? labMap.get(selectedSession.labId) ?? null : null;
  const selectedStatusMeta = selectedSession ? STATUS_STYLE[selectedSession.status] : null;
  const nextStatusForSelected = selectedSession
    ? NEXT_TRANSITION[selectedSession.status]
    : null;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <UserHeader />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Kepala Halaman & Akses Review Izin */}
        <View style={styles.heroHeader}>
          <View style={styles.heroTextCol}>
            <Text style={styles.pageTitle}>Pelaksanaan Sesi Praktikum</Text>
            <Text style={styles.pageSubtitle}>
              Kelola pembukaan sesi, penutupan sesi, dan pantau rekap keterlambatan pada
              laboratorium tanggung jawab Anda.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            style={styles.reviewIzinButton}
            onPress={() => router.push('/asisten-izin' as Href)}
          >
            <Text style={styles.reviewIzinButtonText}>Periksa pengajuan izin</Text>
          </Pressable>
        </View>

        {/* Info Cakupan Tanggung Jawab Asprak */}
        <View style={styles.scopeBar}>
          <Text style={styles.scopeBarText}>
            Cakupan:{' '}
            {workspace.responsibleLabs.length > 0
              ? `${workspace.responsibleLabs.length} laboratorium (${workspace.responsibleLabs
                  .map((l) => l.name)
                  .join(', ')})`
              : workspace.scopeMode === 'unassigned'
                ? 'Belum ditempatkan ke laboratorium oleh Aslab'
                : 'Sesi praktikum tanggung jawab Anda'}{' '}
            · {openCount} sesi aktif dibuka
          </Text>
        </View>

        {!transition.isOnline && (
          <View style={styles.offlineCard} accessibilityRole="alert">
            <Text style={styles.offlineTitle}>✕ Perangkat sedang offline</Text>
            <Text style={styles.offlineBody}>
              Perubahan status buka/tutup sesi dinonaktifkan sementara hingga koneksi internet
              pulih.
            </Text>
          </View>
        )}

        {feedbackBanner && (
          <View style={styles.feedbackCard} accessibilityLiveRegion="polite">
            <Text style={styles.feedbackText}>{feedbackBanner}</Text>
          </View>
        )}

        {/* Navigasi Segmen Ruang Kerja Asprak */}
        <View style={styles.tabBar} accessibilityRole="tablist">
          {(
            [
              { key: 'sesi', label: `Sesi (${workspace.sessions.length})` },
              { key: 'jadwal', label: `Jadwal & Kelas (${workspace.schedules.length})` },
              { key: 'rekap', label: 'Pantau Kehadiran' },
            ] as { key: WorkspaceTab; label: string }[]
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabItemText, active && styles.tabItemTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Keadaan Loading / Error Utama */}
        {workspace.loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#1D4ED8" />
            <Text style={styles.loadingText}>
              Memuat kelas, jadwal, dan sesi tanggung jawab Anda...
            </Text>
          </View>
        ) : workspace.error ? (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorTitle}>Gagal memuat data pelaksanaan praktikum</Text>
            <Text style={styles.errorBody}>{workspace.error}</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.outlineButton}
              onPress={workspace.retry}
            >
              <Text style={styles.outlineButtonText}>Muat ulang data</Text>
            </Pressable>
          </View>
        ) : activeTab === 'rekap' ? (
          <RekapKehadiranContent
            sessionId={selectedSession?.id ?? null}
            classLabel={
              selectedSession ? resolveClassName(selectedSession.classId) : undefined
            }
            onBackToSessions={() => setActiveTab('sesi')}
          />
        ) : activeTab === 'jadwal' ? (
          <View style={styles.sectionStack}>
            {/* Daftar Kelas & Laboratorium Tanggung Jawab (Read-Only, Tanpa Aksi Konfigurasi) */}
            <Text style={styles.sectionHeading}>
              Laboratorium & kelas tanggung jawab ({workspace.responsibleLabs.length})
            </Text>
            {workspace.responsibleLabs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Belum ada penugasan laboratorium</Text>
                <Text style={styles.emptyBody}>
                  Hubungi Aslab mata kuliah apabila akun Anda belum dimasukkan ke distribusi
                  laboratorium.
                </Text>
              </View>
            ) : (
              workspace.responsibleLabs.map((lab) => (
                <View key={lab.id} style={styles.labInfoCard}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle}>{lab.name}</Text>
                    <Text
                      style={[
                        styles.labStateTag,
                        { color: lab.active ? '#0F766E' : '#B91C1C' },
                      ]}
                    >
                      {lab.active ? '● Lab aktif' : '■ Lab nonaktif'}
                    </Text>
                  </View>
                  {lab.mataKuliah ? (
                    <Text style={styles.metaLine}>Mata kuliah: {lab.mataKuliah}</Text>
                  ) : null}
                  <Text style={styles.metaLine}>
                    Radius GPS: {lab.radiusMeters !== null ? `${lab.radiusMeters} m` : 'Belum diatur'} ·
                    Toleransi terlambat:{' '}
                    {lab.gracePeriodMinutes !== null
                      ? `${lab.gracePeriodMinutes} menit`
                      : '0 menit (default)'}
                  </Text>
                  <Text style={styles.metaLine}>
                    Nominal denda terlambat:{' '}
                    {lab.lateFineAmount !== null
                      ? formatRupiah(lab.lateFineAmount)
                      : 'Belum diatur Aslab'}
                  </Text>
                </View>
              ))
            )}

            <Text style={styles.sectionHeading}>
              Kelas terdaftar ({workspace.classes.length})
            </Text>
            {workspace.classes.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyBody}>
                  Belum ada kelas yang terkait dengan jadwal atau sesi tanggung jawab Anda.
                </Text>
              </View>
            ) : (
              <View style={styles.chipWrap}>
                {workspace.classes.map((cls) => (
                  <View key={cls.id} style={styles.staticClassPill}>
                    <Text style={styles.staticClassPillText}>{cls.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Daftar Jadwal Praktikum Mingguan */}
            <Text style={styles.sectionHeading}>
              Jadwal mingguan praktikum ({workspace.schedules.length})
            </Text>
            {workspace.schedules.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Belum ada jadwal praktikum</Text>
                <Text style={styles.emptyBody}>
                  Jadwal praktikum pada laboratorium tanggung jawab Anda akan tampil otomatis di
                  sini.
                </Text>
              </View>
            ) : (
              workspace.schedules.map((sch) => {
                const schLab = sch.labId ? labMap.get(sch.labId) ?? null : null;
                return (
                  <View key={sch.id} style={styles.scheduleCard}>
                    <Text style={styles.cardTitle}>{sch.course}</Text>
                    <Text style={styles.metaLine}>
                      {formatDay(sch.dayOfWeek)} · {sch.startTime}–{sch.endTime} · Kelas{' '}
                      {resolveClassName(sch.classId)}
                    </Text>
                    <Text style={styles.metaLine}>
                      Ruang: {sch.room || '-'}
                      {schLab ? ` · Lab: ${schLab.name}` : ''}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.sectionStack}>
            {/* Konsol Sesi Terpilih (Elemen Fokus Utama Operasi Sesi) */}
            {selectedSession && selectedStatusMeta ? (
              <View
                style={[
                  styles.consoleSlip,
                  { borderLeftColor: selectedStatusMeta.accent },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.consoleEyebrow}>Sesi terpilih</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: selectedStatusMeta.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: selectedStatusMeta.fg },
                      ]}
                    >
                      {selectedStatusMeta.symbol} {selectedStatusMeta.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.consoleTitle}>{selectedSession.title}</Text>
                <Text style={styles.consoleMeta}>
                  Kelas {resolveClassName(selectedSession.classId)} · {selectedSession.date} ·{' '}
                  {selectedSession.startTime}–{selectedSession.endTime}
                </Text>
                <Text style={styles.consoleMeta}>
                  Laboratorium:{' '}
                  {selectedLab
                    ? `${selectedLab.name} (toleransi ${
                        selectedLab.gracePeriodMinutes ?? 0
                      } menit)`
                    : selectedSession.labId ?? 'Belum ditautkan'}
                </Text>

                {selectedSession.openedAt ? (
                  <Text style={styles.timestampMeta}>
                    Dibuka pukul {formatClock(selectedSession.openedAt)}
                    {selectedSession.closedAt
                      ? ` · Ditutup pukul ${formatClock(selectedSession.closedAt)}`
                      : ''}
                  </Text>
                ) : null}

                <View style={styles.consoleActions}>
                  {nextStatusForSelected ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: transition.busy || !transition.isOnline,
                      }}
                      disabled={transition.busy || !transition.isOnline}
                      style={[
                        styles.primaryControlBtn,
                        nextStatusForSelected === 'ditutup' && styles.closeControlBtn,
                        (transition.busy || !transition.isOnline) && styles.disabledBtn,
                      ]}
                      onPress={() => requestSessionTransition(selectedSession)}
                    >
                      <Text style={styles.primaryControlBtnText}>
                        {nextStatusForSelected === 'dibuka'
                          ? 'Buka sesi praktikum'
                          : 'Tutup sesi praktikum'}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.closedSealBox}>
                      <Text style={styles.closedSealText}>
                        ■ Sesi ini telah ditutup permanen dan tidak dapat dibuka kembali.
                      </Text>
                    </View>
                  )}

                  <View style={styles.secondaryActionRow}>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.outlineActionBtn}
                      onPress={() => openInlineRecap(selectedSession.id)}
                    >
                      <Text style={styles.outlineActionBtnText}>Pantau kehadiran</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.outlineActionBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/rekap',
                          params: { sessionId: selectedSession.id },
                        } as Href)
                      }
                    >
                      <Text style={styles.outlineActionBtnText}>Buka layar rekap penuh</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Filter Laboratorium & Status Sesi */}
            {workspace.responsibleLabs.length > 1 && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Filter laboratorium</Text>
                <View style={styles.chipWrap}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedLabFilter === null }}
                    style={[
                      styles.chip,
                      selectedLabFilter === null && styles.chipActive,
                    ]}
                    onPress={() => setSelectedLabFilter(null)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedLabFilter === null && styles.chipTextActive,
                      ]}
                    >
                      Semua lab
                    </Text>
                  </Pressable>
                  {workspace.responsibleLabs.map((lab) => {
                    const selected = selectedLabFilter === lab.id;
                    return (
                      <Pressable
                        key={lab.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[styles.chip, selected && styles.chipActive]}
                        onPress={() => setSelectedLabFilter(lab.id)}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                          {lab.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status sesi</Text>
              <View style={styles.chipWrap}>
                {(
                  [
                    { value: 'semua', label: 'Semua' },
                    { value: 'dibuka', label: '● Dibuka' },
                    { value: 'belum_dibuka', label: '○ Belum dibuka' },
                    { value: 'ditutup', label: '■ Ditutup' },
                  ] as { value: SessionStatusFilter; label: string }[]
                ).map((item) => {
                  const active = statusFilter === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setStatusFilter(item.value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Daftar Sesi Praktikum */}
            <Text style={styles.sectionHeading}>
              Daftar sesi tanggung jawab Anda ({filteredSessions.length})
            </Text>

            {workspace.sessions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {workspace.scopeMode === 'unassigned'
                    ? 'Anda belum ditugaskan pada laboratorium'
                    : 'Belum ada sesi praktikum'}
                </Text>
                <Text style={styles.emptyBody}>
                  {workspace.scopeMode === 'unassigned'
                    ? 'Minta Aslab menambahkan akun Anda ke laboratorium mata kuliah terkait agar sesi praktikum tampil di halaman ini.'
                    : 'Belum ada sesi praktikum yang dijadwalkan pada laboratorium tanggung jawab Anda.'}
                </Text>
              </View>
            ) : filteredSessions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Tidak ada sesi pada filter ini</Text>
                <Text style={styles.emptyBody}>
                  Ubah pilihan laboratorium atau status sesi untuk menampilkan sesi lainnya.
                </Text>
              </View>
            ) : (
              filteredSessions.map((item) => {
                const isSelected = selectedSession?.id === item.id;
                const st = STATUS_STYLE[item.status];
                const lab = item.labId ? labMap.get(item.labId) ?? null : null;

                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.sessionItemCard,
                      isSelected && styles.sessionItemCardSelected,
                    ]}
                    onPress={() => {
                      setManualSessionId(item.id);
                      setFeedbackBanner(null);
                    }}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: st.fg }]}>
                          {st.symbol} {st.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.metaLine}>
                      Kelas {resolveClassName(item.classId)} · {item.date} · {item.startTime}–
                      {item.endTime}
                    </Text>
                    <Text style={styles.metaLine}>
                      Lab: {lab ? lab.name : item.labId ?? 'Belum ditautkan'}
                      {lab?.gracePeriodMinutes !== null && lab?.gracePeriodMinutes !== undefined
                        ? ` · Toleransi ${lab.gracePeriodMinutes} mnt`
                        : ''}
                    </Text>

                    <View style={styles.itemQuickRow}>
                      {NEXT_TRANSITION[item.status] ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={transition.busy || !transition.isOnline}
                          style={[
                            styles.inlineActionBtn,
                            item.status === 'dibuka' && styles.inlineCloseBtn,
                            (transition.busy || !transition.isOnline) && styles.disabledBtn,
                          ]}
                          onPress={() => requestSessionTransition(item)}
                        >
                          <Text style={styles.inlineActionBtnText}>
                            {item.status === 'belum_dibuka' ? 'Buka sesi' : 'Tutup sesi'}
                          </Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        style={styles.inlineSecondaryBtn}
                        onPress={() => openInlineRecap(item.id)}
                      >
                        <Text style={styles.inlineSecondaryBtnText}>Pantau kehadiran</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal Konfirmasi Buka / Tutup Sesi */}
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={cancelTransitionModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {pending?.target === 'dibuka'
                ? 'Konfirmasi buka sesi praktikum'
                : 'Konfirmasi tutup sesi praktikum'}
            </Text>

            {pending && (
              <Text style={styles.modalMessage}>
                {pending.target === 'dibuka'
                  ? `Sesi "${pending.session.title}" untuk kelas ${resolveClassName(
                      pending.session.classId,
                    )} akan dibuka sekarang. Praktikan dapat melakukan presensi GPS dan menerima notifikasi pembukaan sesi.`
                  : `Sesi "${pending.session.title}" untuk kelas ${resolveClassName(
                      pending.session.classId,
                    )} akan ditutup. Sesi yang sudah ditutup tidak dapat dibuka kembali.`}
              </Text>
            )}

            {(modalError ||
              (pending &&
                pendingLiveSession &&
                pendingLiveSession.status !== pending.session.status)) && (
              <View style={styles.modalErrorBox} accessibilityRole="alert">
                <Text style={styles.modalErrorText}>
                  {modalError ??
                    `Status sesi di server sudah berubah menjadi "${
                      pendingLiveSession ? STATUS_STYLE[pendingLiveSession.status].label : '-'
                    }".`}
                </Text>
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <Pressable
                accessibilityRole="button"
                disabled={transition.busy}
                style={[styles.modalCancelBtn, transition.busy && styles.disabledBtn]}
                onPress={cancelTransitionModal}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={
                  transition.busy ||
                  Boolean(
                    pending &&
                      pendingLiveSession &&
                      pendingLiveSession.status !== pending.session.status,
                  )
                }
                style={[
                  styles.modalConfirmBtn,
                  pending?.target === 'ditutup' && styles.closeControlBtn,
                  (transition.busy ||
                    Boolean(
                      pending &&
                        pendingLiveSession &&
                        pendingLiveSession.status !== pending.session.status,
                    )) &&
                    styles.disabledBtn,
                ]}
                onPress={() => {
                  void confirmSessionTransition();
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {transition.busy
                    ? 'Memproses...'
                    : pending?.target === 'dibuka'
                      ? 'Ya, buka sesi'
                      : 'Ya, tutup sesi'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  container: {
    padding: 16,
    paddingBottom: 44,
    gap: 12,
  },
  guardBox: {
    padding: 20,
    gap: 8,
  },
  heroHeader: {
    gap: 10,
  },
  heroTextCol: {
    gap: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  reviewIzinButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    backgroundColor: '#FFFFFF',
  },
  reviewIzinButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  scopeBar: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scopeBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
    lineHeight: 18,
  },
  offlineCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  offlineBody: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 18,
  },
  feedbackCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 10,
    padding: 12,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F766E',
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flexGrow: 1,
    flexBasis: 96,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  tabItemTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  sectionStack: {
    gap: 12,
  },
  consoleSlip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 15,
    gap: 6,
  },
  consoleEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  consoleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  consoleMeta: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  timestampMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  consoleActions: {
    marginTop: 8,
    gap: 8,
  },
  primaryControlBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  closeControlBtn: {
    backgroundColor: '#B91C1C',
  },
  disabledBtn: {
    opacity: 0.55,
  },
  primaryControlBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  closedSealBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
  },
  closedSealText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  secondaryActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  outlineActionBtn: {
    flexGrow: 1,
    flexBasis: 140,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  outlineActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  sessionItemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 12,
    padding: 14,
    gap: 5,
  },
  sessionItemCardSelected: {
    borderColor: '#1D4ED8',
    borderWidth: 2,
    backgroundColor: '#F8FAFF',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  metaLine: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  inlineActionBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineCloseBtn: {
    backgroundColor: '#B91C1C',
  },
  inlineActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inlineSecondaryBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  labInfoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  labStateTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  staticClassPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  staticClassPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#334155',
    flexShrink: 1,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
  },
  errorBody: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  outlineButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalMessage: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  modalErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
  },
  modalErrorText: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  modalConfirmBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
