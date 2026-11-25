/**
 * /presensi-lokasi — Halaman Presensi Khusus Berbasis Lokasi GPS
 * Sprint 3, SRS-01, SRS-02, SRS-07 (Moses).
 *
 * Fitur:
 * - Terpisah dari detail sesi di /praktikan, menerima `?sessionId=<id>` (atau
 *   memungkinkan pemilihan sesi kelas praktikan jika dibuka tanpa parameter).
 * - Menampilkan kelas, mata praktikum, laboratorium (dari Firestore, bukan
 *   hard-coded), waktu, status sesi realtime, status presensi realtime, dan
 *   tombol aksi presensi.
 * - Meminta izin lokasi, mengambil koordinat + akurasi, menghitung jarak dan
 *   kelayakan radius sebagai umpan balik lokal UI.
 * - Pencatatan presensi memanggil `markAttendanceWithLocation` (yang meneruskan
 *   ke `verifyAndRecordAttendance` atomik milik Dewa), bukan `setDoc` langsung.
 * - Menangani izin ditolak, izin ditolak permanen (Buka Pengaturan), GPS mati,
 *   timeout, akurasi buruk, data lokasi kedaluwarsa, offline, dan cegah klik ganda.
 */
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useCurrentLocation } from '../hooks/use-lokasi';
import { useNetwork } from '../hooks/use-network';
import {
  MAX_ACCURACY_METERS,
  MAX_LOCATION_AGE_MS,
  evaluateLabProximity,
  formatCoordinates,
  formatDistanceMeters,
  openAppLocationSettings,
  type LocationErrorCode,
} from '../services/lokasi';
import {
  mapAttendanceError,
  markAttendanceWithLocation,
  subscribeLaboratoryById,
  subscribeMySessionAttendance,
  subscribeMySessions,
  subscribeSessionById,
  type AttendanceLocationResult,
} from '../services/presensi';
import type { AppUser, Attendance, Laboratory, Session, SessionStatus } from '../types';

type Props = {
  user: AppUser | null;
  initialSessionId?: string;
};

const STATUS_META: Record<SessionStatus, { symbol: string; label: string; bg: string; fg: string }> = {
  belum_dibuka: { symbol: '○', label: 'Belum Dibuka', bg: '#F1F5F9', fg: '#334155' },
  dibuka: { symbol: '●', label: 'Dibuka', bg: '#DCFCE7', fg: '#166534' },
  ditutup: { symbol: '■', label: 'Ditutup', bg: '#FEE2E2', fg: '#991B1B' },
};

function locationGuidance(code: LocationErrorCode | null): string {
  switch (code) {
    case 'permission_blocked':
      return 'Langkah: Buka Pengaturan aplikasi → Izin → Lokasi → pilih "Izinkan saat aplikasi digunakan", lalu kembali dan tekan Coba Lagi.';
    case 'permission_denied':
      return 'Langkah: Tekan "Coba Ambil Lokasi Lagi" lalu pilih Izinkan saat dialog izin lokasi muncul.';
    case 'gps_disabled':
      return 'Langkah: Aktifkan Layanan Lokasi (GPS) di pengaturan cepat atau Pengaturan perangkat, lalu tekan "Coba Ambil Lokasi Lagi".';
    case 'timeout':
      return 'Langkah: Pastikan GPS aktif dan berpindah dekat jendela/area terbuka, lalu tekan "Coba Ambil Lokasi Lagi".';
    case 'accuracy_unavailable':
      return 'Langkah: Tunggu beberapa detik hingga sinyal GPS stabil, lalu tekan "Coba Ambil Lokasi Lagi".';
    default:
      return 'Langkah: Pastikan GPS aktif dan sinyal lokasi tersedia, lalu coba ambil lokasi kembali.';
  }
}

function formatTimeRange(session: Session): string {
  return `${session.startTime}–${session.endTime}`;
}

export default function PresensiLokasiScreen({ user, initialSessionId }: Props) {
  const router = useRouter();
  const { isOnline } = useNetwork();

  const trimmedInitialId = initialSessionId?.trim() || null;
  const [pickedSessionId, setPickedSessionId] = useState<string | null>(null);
  const activeSessionId = trimmedInitialId ?? pickedSessionId;

  /* ---- Daftar sesi kelas (hanya aktif saat dibuka tanpa ?sessionId) ---- */
  const [pickerAttempt, setPickerAttempt] = useState(0);
  const [pickerState, setPickerState] = useState<{
    key: string | null;
    sessions: Session[];
    error: string | null;
    ready: boolean;
  }>({ key: null, sessions: [], error: null, ready: false });

  const pickerKey =
    !activeSessionId && user?.role === 'praktikan' && user.classId
      ? `${user.classId}:${pickerAttempt}`
      : null;

  useEffect(() => {
    if (!pickerKey || !user?.classId) {
      return;
    }
    const unsubscribe = subscribeMySessions(
      user.classId,
      (items) => {
        setPickerState({ key: pickerKey, sessions: items, error: null, ready: true });
      },
      (err) => {
        setPickerState({
          key: pickerKey,
          sessions: [],
          error: mapAttendanceError(err),
          ready: true,
        });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [pickerKey, user?.classId]);

  const pickerCurrent = pickerKey !== null && pickerState.key === pickerKey;
  const pickerSessions = pickerCurrent ? pickerState.sessions : [];
  const pickerLoading = pickerKey !== null && (!pickerCurrent || !pickerState.ready);
  const pickerError = pickerCurrent ? pickerState.error : null;

  /* ---- Listener sesi aktif (realtime) ---- */
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const sessionSubKey =
    activeSessionId && user?.role === 'praktikan'
      ? `${activeSessionId}:${user.uid}:${sessionAttempt}`
      : null;

  const [sessionState, setSessionState] = useState<{
    key: string | null;
    session: Session | null;
    error: string | null;
    ready: boolean;
  }>({ key: null, session: null, error: null, ready: false });

  useEffect(() => {
    if (!sessionSubKey || !activeSessionId) {
      return;
    }
    const unsubscribe = subscribeSessionById(
      activeSessionId,
      (nextSession) => {
        setSessionState({ key: sessionSubKey, session: nextSession, error: null, ready: true });
      },
      (err) => {
        const code =
          err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
            ? err.code
            : null;
        const message =
          code === 'permission-denied'
            ? 'Sesi ini tidak dapat diakses atau bukan milik kelas praktikum Anda.'
            : mapAttendanceError(err);
        setSessionState({ key: sessionSubKey, session: null, error: message, ready: true });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [sessionSubKey, activeSessionId]);

  const sessionCurrent = sessionSubKey !== null && sessionState.key === sessionSubKey;
  const session = sessionCurrent ? sessionState.session : null;
  const sessionLoading = sessionSubKey !== null && (!sessionCurrent || !sessionState.ready);
  const sessionError = sessionCurrent ? sessionState.error : null;

  /* ---- Listener laboratorium sesi (realtime dari Firestore) ---- */
  const labId = session?.labId ?? null;
  const [labAttempt, setLabAttempt] = useState(0);
  const labSubKey = labId ? `${labId}:${labAttempt}` : null;

  const [labState, setLabState] = useState<{
    key: string | null;
    lab: Laboratory | null;
    error: string | null;
    ready: boolean;
  }>({ key: null, lab: null, error: null, ready: false });

  useEffect(() => {
    if (!labSubKey || !labId) {
      return;
    }
    const unsubscribe = subscribeLaboratoryById(
      labId,
      (nextLab) => {
        setLabState({ key: labSubKey, lab: nextLab, error: null, ready: true });
      },
      (err) => {
        setLabState({ key: labSubKey, lab: null, error: mapAttendanceError(err), ready: true });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [labSubKey, labId]);

  const labCurrent = labSubKey !== null && labState.key === labSubKey;
  const lab = labCurrent ? labState.lab : null;
  const labLoading = labSubKey !== null && (!labCurrent || !labState.ready);
  const labError = labCurrent ? labState.error : null;

  /* ---- Listener status presensi pengguna sendiri pada sesi ini ---- */
  const attendanceSubKey =
    activeSessionId && user?.role === 'praktikan' ? `${activeSessionId}:${user.uid}` : null;

  const [attendanceState, setAttendanceState] = useState<{
    key: string | null;
    record: Attendance | null;
    error: string | null;
    ready: boolean;
  }>({ key: null, record: null, error: null, ready: false });

  useEffect(() => {
    if (!attendanceSubKey || !activeSessionId || !user?.uid) {
      return;
    }
    const unsubscribe = subscribeMySessionAttendance(
      activeSessionId,
      user.uid,
      (record) => {
        setAttendanceState({ key: attendanceSubKey, record, error: null, ready: true });
      },
      (err) => {
        setAttendanceState({
          key: attendanceSubKey,
          record: null,
          error: mapAttendanceError(err),
          ready: true,
        });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [attendanceSubKey, activeSessionId, user?.uid]);

  const attendanceCurrent = attendanceSubKey !== null && attendanceState.key === attendanceSubKey;
  const attendanceRecord = attendanceCurrent ? attendanceState.record : null;
  const attendanceLoading = attendanceSubKey !== null && (!attendanceCurrent || !attendanceState.ready);
  const attendanceError = attendanceCurrent ? attendanceState.error : null;

  /* ---- Lokasi GPS perangkat ---- */
  const {
    reading,
    loading: locLoading,
    error: locError,
    errorCode: locErrorCode,
    lastUpdatedAt,
    refresh: refreshLocation,
  } = useCurrentLocation({
    autoFetch: Boolean(user?.role === 'praktikan' && activeSessionId),
  });

  /* ---- Ticker ringan agar status kedaluwarsa lokasi tetap akurat di UI ---- */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!reading) {
      return;
    }
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 10_000);
    return () => {
      clearInterval(timer);
    };
  }, [reading]);

  const proximity = useMemo(() => {
    if (!reading || !lab) {
      return null;
    }
    return evaluateLabProximity(reading, lab, {
      maxAccuracyMeters: MAX_ACCURACY_METERS,
      maxAgeMs: MAX_LOCATION_AGE_MS,
      nowMs,
    });
  }, [reading, lab, nowMs]);

  /* ---- Aksi kirim presensi terverifikasi (cegah klik ganda dengan ref + state) ---- */
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<AttendanceLocationResult | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  const isPraktikan = user?.role === 'praktikan';
  const classMatches = Boolean(user?.classId && session && session.classId === user.classId);
  const alreadyAttended = attendanceRecord !== null;
  const sessionOpen = session?.status === 'dibuka';

  const blockReason = useMemo<string | null>(() => {
    if (!user) return 'Silakan login terlebih dahulu.';
    if (!isPraktikan) return 'Hanya praktikan yang dapat melakukan presensi.';
    if (!user.classId) return 'Akun Anda belum terdaftar pada kelas praktikum.';
    if (!session) return 'Data sesi praktikum tidak tersedia.';
    if (!classMatches) return 'Sesi ini bukan untuk kelas praktikum Anda.';
    if (alreadyAttended) return 'Kehadiran Anda sudah tercatat pada sesi ini.';
    if (!sessionOpen) {
      return session.status === 'ditutup'
        ? 'Sesi praktikum sudah ditutup. Presensi tidak dapat dilakukan.'
        : 'Sesi praktikum belum dibuka oleh Asprak.';
    }
    if (!session.labId) {
      return 'Sesi ini belum terhubung ke laboratorium. Hubungi Asprak.';
    }
    if (labLoading) return 'Memuat konfigurasi laboratorium...';
    if (!lab) return 'Data laboratorium tidak ditemukan di sistem.';
    if (!lab.active) return 'Laboratorium sedang nonaktif.';
    if (!isOnline) {
      return 'Perangkat sedang offline. Presensi membutuhkan koneksi internet untuk verifikasi server.';
    }
    if (locLoading) return 'Sedang mengambil sinyal GPS...';
    if (!reading) return 'Ambil lokasi GPS terlebih dahulu sebelum mencatat presensi.';
    if (!proximity?.eligible) return proximity?.message ?? 'Lokasi belum memenuhi syarat presensi.';
    return null;
  }, [
    user,
    isPraktikan,
    session,
    classMatches,
    alreadyAttended,
    sessionOpen,
    labLoading,
    lab,
    isOnline,
    locLoading,
    reading,
    proximity,
  ]);

  const canSubmit = blockReason === null && !sessionLoading && !attendanceLoading && !submitting;

  async function handleOpenSettings() {
    setSettingsNotice(null);
    const opened = await openAppLocationSettings();
    if (!opened) {
      setSettingsNotice('Tidak dapat membuka Pengaturan otomatis. Buka Pengaturan perangkat secara manual.');
    }
  }

  async function handleRefreshLocation() {
    setSubmitError(null);
    setSettingsNotice(null);
    const next = await refreshLocation();
    if (next) {
      setNowMs(Date.now());
    }
  }

  async function handleSubmitAttendance() {
    if (submittingRef.current) {
      return;
    }

    setSubmitError(null);

    if (!user || user.role !== 'praktikan' || !user.classId) {
      setSubmitError('Hanya praktikan terdaftar yang dapat melakukan presensi.');
      return;
    }
    if (!isOnline) {
      setSubmitError(
        'Perangkat sedang offline. Presensi lokasi tidak dapat dikirim sebelum terhubung ke internet.',
      );
      return;
    }
    if (!session) {
      setSubmitError('Sesi praktikum tidak ditemukan.');
      return;
    }
    if (session.classId !== user.classId) {
      setSubmitError('Sesi ini bukan untuk kelas praktikum Anda.');
      return;
    }
    if (session.status !== 'dibuka') {
      setSubmitError('Presensi ditolak karena sesi belum dibuka atau sudah ditutup.');
      return;
    }
    if (alreadyAttended) {
      setSubmitError('Anda sudah melakukan presensi pada sesi ini.');
      return;
    }
    if (!lab || !lab.active) {
      setSubmitError('Laboratorium sesi tidak tersedia atau sedang nonaktif.');
      return;
    }
    if (!reading) {
      setSubmitError('Lokasi GPS belum tersedia. Silakan ambil lokasi terlebih dahulu.');
      return;
    }

    // Re-evaluasi kesegaran & jarak saat tombol ditekan (bukan hanya state render sebelumnya)
    const liveCheck = evaluateLabProximity(reading, lab, {
      maxAccuracyMeters: MAX_ACCURACY_METERS,
      maxAgeMs: MAX_LOCATION_AGE_MS,
      nowMs: Date.now(),
    });
    if (!liveCheck.eligible) {
      setSubmitError(liveCheck.message);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await markAttendanceWithLocation(user, session.id, reading, {
        isOnline,
        maxAccuracyMeters: MAX_ACCURACY_METERS,
        maxAgeMs: MAX_LOCATION_AGE_MS,
      });
      setSuccessResult(result);
    } catch (err) {
      setSubmitError(mapAttendanceError(err));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  /* ---- Tampilan guard bila belum login / bukan praktikan ---- */
  if (!user) {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>Belum Login</Text>
          <Text style={styles.bodyText}>Silakan login sebagai praktikan untuk melakukan presensi lokasi.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (user.role !== 'praktikan') {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <UserHeader />
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>Akses Terbatas</Text>
          <Text style={styles.bodyText}>Halaman presensi lokasi khusus untuk peran Praktikan.</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ---- Tampilan pemilihan sesi bila dibuka tanpa ?sessionId ---- */
  if (!activeSessionId) {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <UserHeader />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Pilih Sesi Presensi</Text>
          <Text style={styles.subtitle}>
            Pilih sesi kelas {user.classId ?? '-'} untuk melanjutkan verifikasi lokasi GPS.
          </Text>

          {pickerLoading && (
            <View style={styles.infoCard}>
              <ActivityIndicator color="#2563EB" />
              <Text style={styles.bodyText}>Memuat daftar sesi praktikum...</Text>
            </View>
          )}

          {pickerError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Gagal Memuat Sesi</Text>
              <Text style={styles.errorText}>{pickerError}</Text>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => setPickerAttempt((n) => n + 1)}
              >
                <Text style={styles.secondaryButtonText}>Coba Lagi</Text>
              </Pressable>
            </View>
          )}

          {!pickerLoading && !pickerError && pickerSessions.length === 0 && (
            <View style={styles.infoCard}>
              <Text style={styles.emptyTitle}>Belum Ada Sesi</Text>
              <Text style={styles.bodyText}>
                Belum ada sesi praktikum yang tersedia untuk kelas Anda saat ini.
              </Text>
            </View>
          )}

          {pickerSessions.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                style={styles.card}
                onPress={() => setPickedSessionId(item.id)}
              >
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.metaText}>
                  Kelas {item.classId} · {item.date} · {formatTimeRange(item)}
                </Text>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.fg }]}>
                    {meta.symbol} {meta.label}
                  </Text>
                </View>
                <Text style={styles.linkHint}>Ketuk untuk buka presensi lokasi →</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ---- Tampilan utama halaman presensi GPS ---- */
  const statusMeta = session ? STATUS_META[session.status] : null;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <UserHeader />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Presensi Berbasis Lokasi</Text>
            <Text style={styles.subtitle}>
              Verifikasi kehadiran GPS di radius laboratorium
            </Text>
          </View>
          {!trimmedInitialId && (
            <Pressable
              accessibilityRole="button"
              style={styles.smallOutlineButton}
              onPress={() => {
                setPickedSessionId(null);
                setSubmitError(null);
              }}
            >
              <Text style={styles.smallOutlineButtonText}>Ganti Sesi</Text>
            </Pressable>
          )}
        </View>

        {!isOnline && (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorTitle}>✕ Perangkat Sedang Offline</Text>
            <Text style={styles.errorText}>
              Koneksi internet diperlukan untuk verifikasi dan pencatatan presensi ke server.
              Presensi tidak akan dinyatakan berhasil sebelum server mengonfirmasi.
            </Text>
          </View>
        )}

        {/* Loading / Error / Not Found untuk Sesi */}
        {sessionLoading && (
          <View style={styles.infoCard}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.bodyText}>Memuat detail sesi praktikum...</Text>
          </View>
        )}

        {sessionError && !sessionLoading && (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorTitle}>Tidak Dapat Memuat Sesi</Text>
            <Text style={styles.errorText}>{sessionError}</Text>
            <View style={styles.buttonRow}>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => setSessionAttempt((n) => n + 1)}
              >
                <Text style={styles.secondaryButtonText}>Muat Ulang</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => router.replace('/praktikan' as Href)}
              >
                <Text style={styles.secondaryButtonText}>Kembali ke Beranda</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!sessionLoading && !sessionError && !session && (
          <View style={styles.infoCard}>
            <Text style={styles.emptyTitle}>Data Sesi Tidak Ditemukan</Text>
            <Text style={styles.bodyText}>
              Sesi praktikum yang diminta tidak tersedia atau sudah dihapus oleh Asprak.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={() => router.replace('/praktikan' as Href)}
            >
              <Text style={styles.secondaryButtonText}>Kembali ke Daftar Sesi</Text>
            </Pressable>
          </View>
        )}

        {session && (
          <>
            {/* Card 1: Informasi Sesi, Lab, Status Sesi, Status Presensi (SRS-01) */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>1. Informasi Sesi & Laboratorium</Text>
              <Text style={styles.cardTitle}>{session.title}</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Kelas</Text>
                <Text style={styles.detailVal}>{session.classId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Tanggal</Text>
                <Text style={styles.detailVal}>{session.date || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Waktu</Text>
                <Text style={styles.detailVal}>{formatTimeRange(session)}</Text>
              </View>

              <View style={styles.badgeRow}>
                {statusMeta && (
                  <View style={[styles.badge, { backgroundColor: statusMeta.bg }]}>
                    <Text style={[styles.badgeText, { color: statusMeta.fg }]}>
                      Sesi: {statusMeta.symbol} {statusMeta.label}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.badge,
                    { backgroundColor: alreadyAttended ? '#DCFCE7' : '#FEF3C7' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: alreadyAttended ? '#166534' : '#92400E' },
                    ]}
                  >
                    Presensi:{' '}
                    {attendanceLoading
                      ? 'Memeriksa...'
                      : alreadyAttended
                        ? '✓ Sudah Presensi'
                        : '○ Belum Presensi'}
                  </Text>
                </View>
              </View>

              {attendanceError && (
                <Text style={styles.inlineWarning}>{attendanceError}</Text>
              )}

              {attendanceRecord && (
                <View style={styles.successBox}>
                  <Text style={styles.successBoxTitle}>✓ Kehadiran Sudah Tercatat</Text>
                  <Text style={styles.successBoxText}>
                    Waktu:{' '}
                    {attendanceRecord.attendedAt
                      ? attendanceRecord.attendedAt.toLocaleString('id-ID')
                      : 'Tercatat di server'}
                  </Text>
                  {typeof attendanceRecord.distanceMeters === 'number' && (
                    <Text style={styles.successBoxText}>
                      Jarak terverifikasi: {formatDistanceMeters(attendanceRecord.distanceMeters)}
                    </Text>
                  )}
                </View>
              )}

              {/* Informasi Laboratorium dari Firestore */}
              <View style={styles.divider} />
              <Text style={styles.subSectionTitle}>Laboratorium Sesi</Text>

              {!session.labId ? (
                <Text style={styles.inlineWarning}>
                  ⚠ Sesi ini belum memiliki data laboratorium. Minta Asprak menautkan lab terlebih dahulu.
                </Text>
              ) : labLoading ? (
                <View style={styles.inlineRow}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.bodyText}>Memuat koordinat & radius laboratorium...</Text>
                </View>
              ) : labError ? (
                <View style={styles.inlineBlock}>
                  <Text style={styles.errorText}>{labError}</Text>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.smallOutlineButton}
                    onPress={() => setLabAttempt((n) => n + 1)}
                  >
                    <Text style={styles.smallOutlineButtonText}>Muat Ulang Lab</Text>
                  </Pressable>
                </View>
              ) : !lab ? (
                <Text style={styles.inlineWarning}>
                  ⚠ Data laboratorium ({session.labId}) tidak ditemukan di Firestore.
                </Text>
              ) : (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Nama Lab</Text>
                    <Text style={styles.detailVal}>{lab.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Status Lab</Text>
                    <Text
                      style={[
                        styles.detailVal,
                        { color: lab.active ? '#166534' : '#991B1B', fontWeight: '600' },
                      ]}
                    >
                      {lab.active ? '● Aktif' : '■ Nonaktif'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Radius Presensi</Text>
                    <Text style={styles.detailVal}>{lab.radiusMeters} meter</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Koordinat Lab</Text>
                    <Text style={styles.detailVal}>
                      {formatCoordinates(lab.latitude, lab.longitude)}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    style={styles.mapShortcutButton}
                    onPress={() =>
                      router.push({
                        pathname: '/maps',
                        params: { labId: lab.id },
                      } as Href)
                    }
                  >
                    <Text style={styles.mapShortcutText}>Lihat Lab Ini di Peta →</Text>
                  </Pressable>
                </>
              )}
            </View>

            {/* Card 2: Verifikasi Lokasi GPS (SRS-02 & SRS-07) */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionLabel}>2. Lokasi Perangkat (GPS)</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: locLoading }}
                  disabled={locLoading}
                  style={[styles.smallOutlineButton, locLoading && styles.disabledOutline]}
                  onPress={() => {
                    void handleRefreshLocation();
                  }}
                >
                  <Text style={styles.smallOutlineButtonText}>
                    {locLoading ? 'Memindai...' : reading ? 'Perbarui GPS' : 'Ambil GPS'}
                  </Text>
                </Pressable>
              </View>

              {locLoading && (
                <View style={styles.inlineRow}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.bodyText}>Mengambil koordinat & akurasi GPS perangkat...</Text>
                </View>
              )}

              {locError && (
                <View style={styles.errorCard} accessibilityRole="alert">
                  <Text style={styles.errorTitle}>⚠ Lokasi Belum Tersedia</Text>
                  <Text style={styles.errorText}>{locError}</Text>
                  <Text style={styles.guidanceText}>{locationGuidance(locErrorCode)}</Text>
                  {settingsNotice && <Text style={styles.inlineWarning}>{settingsNotice}</Text>}
                  <View style={styles.buttonRow}>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.secondaryButton}
                      onPress={() => {
                        void handleRefreshLocation();
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Coba Ambil Lokasi Lagi</Text>
                    </Pressable>
                    {(locErrorCode === 'permission_blocked' || locErrorCode === 'gps_disabled') && (
                      <Pressable
                        accessibilityRole="button"
                        style={styles.secondaryButton}
                        onPress={() => {
                          void handleOpenSettings();
                        }}
                      >
                        <Text style={styles.secondaryButtonText}>Buka Pengaturan</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {reading && (
                <View style={styles.gpsDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Koordinat Anda</Text>
                    <Text style={styles.detailVal}>
                      {formatCoordinates(reading.latitude, reading.longitude)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Akurasi GPS</Text>
                    <Text
                      style={[
                        styles.detailVal,
                        {
                          color:
                            reading.accuracy <= MAX_ACCURACY_METERS ? '#166534' : '#991B1B',
                          fontWeight: '600',
                        },
                      ]}
                    >
                      ±{Math.round(reading.accuracy)} m (batas ≤ {MAX_ACCURACY_METERS} m)
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Diperbarui</Text>
                    <Text style={styles.detailVal}>
                      {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('id-ID') : '-'}
                    </Text>
                  </View>

                  {reading.mocked && (
                    <Text style={styles.inlineWarning}>
                      ⚠ Perangkat melaporkan koordinat dari lokasi simulasi (mock location).
                    </Text>
                  )}

                  {lab && proximity && (
                    <View
                      style={[
                        styles.proximityBox,
                        proximity.eligible ? styles.proximityOk : styles.proximityWarn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.proximityTitle,
                          { color: proximity.eligible ? '#166534' : '#991B1B' },
                        ]}
                      >
                        {proximity.eligible
                          ? '✓ Dalam Radius Laboratorium'
                          : proximity.reason === 'outside_radius'
                            ? `✕ Di Luar Radius (+${formatDistanceMeters(proximity.overflowMeters)})`
                            : proximity.reason === 'accuracy_too_low'
                              ? '⚠ Akurasi GPS Terlalu Rendah'
                              : proximity.reason === 'stale_location'
                                ? '⚠ Data Lokasi Kedaluwarsa'
                                : '■ Lokasi Belum Memenuhi Syarat'}
                      </Text>
                      <Text style={styles.proximityDistance}>
                        Jarak ke {lab.name}: {formatDistanceMeters(proximity.distanceMeters)} / batas{' '}
                        {lab.radiusMeters} m
                      </Text>
                      <Text style={styles.proximityMessage}>{proximity.message}</Text>
                    </View>
                  )}
                </View>
              )}

              {!reading && !locLoading && !locError && (
                <Text style={styles.bodyText}>
                  Belum ada data lokasi. Tekan &quot;Ambil GPS&quot; untuk memeriksa jarak Anda ke laboratorium.
                </Text>
              )}

              <Text style={styles.policyNote}>
                Catatan: Hasil perhitungan jarak di layar hanya umpan balik lokal. Verifikasi akhir
                radius, status sesi, dan keanggotaan dilakukan secara atomik saat pengiriman. GPS
                perangkat tidak menjamin anti-spoofing penuh.
              </Text>
            </View>

            {/* Error kirim presensi */}
            {submitError && (
              <View style={styles.errorCard} accessibilityRole="alert">
                <Text style={styles.errorTitle}>✕ Presensi Gagal Dicatat</Text>
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}

            {/* Alasan tombol nonaktif (informatif, bukan warna saja) */}
            {blockReason && !alreadyAttended && (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>Info: {blockReason}</Text>
              </View>
            )}

            {/* Tombol Utama Presensi */}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
              onPress={() => {
                void handleSubmitAttendance();
              }}
            >
              <Text style={styles.primaryButtonText}>
                {submitting
                  ? 'Memverifikasi & Menyimpan Presensi...'
                  : alreadyAttended
                    ? '✓ Presensi Sudah Tercatat'
                    : 'Catat Presensi Sekarang'}
              </Text>
            </Pressable>

            {/* Navigasi pendukung */}
            <View style={styles.footerActions}>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() =>
                  router.push({
                    pathname: '/izin',
                    params: { sessionId: session.id },
                  } as Href)
                }
              >
                <Text style={styles.secondaryButtonText}>Ajukan Izin Sesi Ini</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() =>
                  router.push(
                    (lab
                      ? { pathname: '/maps', params: { labId: lab.id } }
                      : '/maps') as Href,
                  )
                }
              >
                <Text style={styles.secondaryButtonText}>Buka Peta Lab</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal Konfirmasi Berhasil */}
      <Modal
        visible={successResult !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>✓</Text>
            <Text style={styles.modalTitle}>Presensi Berhasil Dicatat</Text>
            <Text style={styles.modalDesc}>
              {successResult?.message ?? 'Presensi berbasis lokasi berhasil disimpan.'}
            </Text>
            {session && (
              <Text style={styles.modalMeta}>
                Sesi: {session.title} ({session.classId})
              </Text>
            )}
            {lab && (
              <Text style={styles.modalMeta}>Laboratorium: {lab.name}</Text>
            )}
            {successResult && (
              <Text style={styles.modalMeta}>
                Jarak terverifikasi: {formatDistanceMeters(successResult.distanceMeters)}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              style={styles.modalButton}
              onPress={() => setSuccessResult(null)}
            >
              <Text style={styles.modalButtonText}>Tutup</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  centerBox: {
    padding: 20,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 16,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaText: {
    fontSize: 13,
    color: '#475569',
  },
  bodyText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailKey: {
    fontSize: 13,
    color: '#64748B',
    minWidth: 105,
  },
  detailVal: {
    fontSize: 13,
    color: '#0F172A',
    flex: 1,
    textAlign: 'right',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 16,
    gap: 8,
    alignItems: 'flex-start',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 14,
    gap: 6,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 19,
  },
  guidanceText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  inlineWarning: {
    fontSize: 13,
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    lineHeight: 18,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineBlock: {
    gap: 8,
  },
  successBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginTop: 4,
  },
  successBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  successBoxText: {
    fontSize: 13,
    color: '#166534',
  },
  gpsDetails: {
    gap: 8,
  },
  proximityBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    marginTop: 4,
  },
  proximityOk: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  proximityWarn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  proximityTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  proximityDistance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  proximityMessage: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  policyNote: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginTop: 4,
  },
  noticeBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 12,
  },
  noticeText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 19,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  smallOutlineButton: {
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#EFF6FF',
  },
  disabledOutline: {
    opacity: 0.5,
  },
  smallOutlineButtonText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
  },
  mapShortcutButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginTop: 2,
  },
  mapShortcutText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  linkHint: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 8,
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 34,
    fontWeight: '700',
    color: '#16A34A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalMeta: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
  modalButton: {
    marginTop: 8,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
