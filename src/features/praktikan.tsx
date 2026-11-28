/**
 * /praktikan — Beranda Praktikan (Sprint 2 + Sprint 3 GPS/Maps + Sprint 4 SRS-11 Status & Tagihan).
 *
 * - Menampilkan daftar sesi dan jadwal kelas praktikan secara realtime beserta
 *   informasi laboratorium dan batas toleransi keterlambatan (`gracePeriodMinutes`).
 * - Menampilkan status kehadiran per sesi secara spesifik:
 *   `✔ Hadir`, `⏱ Terlambat X menit`, `✎ Izin (Disetujui)`, atau `○ Belum Presensi`.
 * - Pembayaran denda (`fine.status === 'paid'`) tidak mengubah status `Terlambat`.
 * - Menampilkan ringkasan tagihan denda dan tautan langsung ke `/tagihan` bila
 *   praktikan memiliki catatan tagihan keterlambatan.
 */
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserHeader } from '../components/user-header';
import { usePraktikanAttendanceStanding } from '../hooks/use-keterlambatan';
import { usePresensi } from '../hooks/use-presensi';
import {
  formatFineStatusLabel,
  formatRupiah,
  type ResolvedAttendanceStatus,
} from '../services/keterlambatan';
import { formatDistanceMeters } from '../services/lokasi';
import type { AppUser, Session, SessionStatus } from '../types';

const SESSION_STATUS_META: Record<
  SessionStatus,
  { symbol: string; label: string; bg: string; fg: string }
> = {
  belum_dibuka: { symbol: '○', label: 'Belum dibuka', bg: '#F1F5F9', fg: '#334155' },
  dibuka: { symbol: '●', label: 'Dibuka', bg: '#ECFDF5', fg: '#0F766E' },
  ditutup: { symbol: '■', label: 'Ditutup', bg: '#FEF2F2', fg: '#B91C1C' },
};

const STANDING_BADGE_STYLE: Record<
  ResolvedAttendanceStatus,
  { bg: string; fg: string }
> = {
  hadir: { bg: '#ECFDF5', fg: '#0F766E' },
  terlambat: { bg: '#FFFBEB', fg: '#B45309' },
  izin: { bg: '#EFF6FF', fg: '#1D4ED8' },
  belum_hadir: { bg: '#F1F5F9', fg: '#475569' },
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

function dayLabel(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek - 1] ?? `Hari ke-${dayOfWeek}`;
}

function formatTime(session: Session): string {
  return `${session.startTime}–${session.endTime}`;
}

export default function PraktikanScreen({ user }: { user: AppUser | null }) {
  const router = useRouter();
  const { sessions, schedules, loading: presensiLoading, error: presensiError } = usePresensi(user);
  const standing = usePraktikanAttendanceStanding(user, sessions);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? null;

  const selectedLab = selectedSession?.labId
    ? standing.labsById.get(selectedSession.labId) ?? null
    : null;

  const selectedStanding = selectedSession
    ? standing.standingBySession.get(selectedSession.id) ?? null
    : null;

  const loading = presensiLoading || standing.loading;
  const error = presensiError ?? standing.error;

  function openPresensiScreen(sessionId: string) {
    router.push({
      pathname: '/presensi-lokasi',
      params: { sessionId },
    } as Href);
  }

  function openMapsScreen(labId?: string) {
    router.push(
      (labId ? { pathname: '/maps', params: { labId } } : '/maps') as Href,
    );
  }

  function openTagihanScreen() {
    router.push('/tagihan' as Href);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <UserHeader />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Beranda Praktikan</Text>
        <Text style={styles.subtitle}>
          Jadwal kelas, presensi berbasis lokasi GPS, status keterlambatan, izin, dan tagihan denda
        </Text>

        <View style={styles.identityStrip}>
          <Text style={styles.identityText}>
            {user
              ? `Praktikan: ${user.name} · Kelas: ${user.classId ?? 'Belum terdaftar'}`
              : 'Silakan login sebagai praktikan untuk melihat sesi praktikum.'}
          </Text>
        </View>

        {/* Pita Tagihan Denda Keterlambatan (Tampil bila ada tagihan denda — SRS-11 / Fitur C) */}
        {user?.role === 'praktikan' && standing.unpaidFines.length > 0 && (
          <View style={styles.fineAlertCard} accessibilityRole="alert">
            <View style={styles.fineAlertHeader}>
              <Text style={styles.fineAlertTitle}>
                ⏱ Anda memiliki {standing.unpaidFines.length} tagihan denda keterlambatan
              </Text>
              <Text style={styles.fineAlertAmount}>
                {formatRupiah(standing.totalUnpaidAmount)}
              </Text>
            </View>
            <Text style={styles.fineAlertBody}>
              Selesaikan pembayaran denda keterlambatan melalui halaman tagihan. Pembayaran denda
              tidak mengubah catatan status keterlambatan pada riwayat presensi.
            </Text>
            <View style={styles.fineActionRow}>
              <Pressable
                accessibilityRole="button"
                style={styles.finePrimaryBtn}
                onPress={openTagihanScreen}
              >
                <Text style={styles.finePrimaryBtnText}>Lihat tagihan denda</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.fineSecondaryBtn}
                onPress={() => router.push('/riwayat-pembayaran' as Href)}
              >
                <Text style={styles.fineSecondaryBtnText}>Riwayat pembayaran</Text>
              </Pressable>
            </View>
          </View>
        )}

        {user?.role === 'praktikan' &&
          standing.unpaidFines.length === 0 &&
          standing.fines.length > 0 && (
            <View style={styles.fineResolvedCard}>
              <View style={styles.fineAlertHeader}>
                <Text style={styles.fineResolvedTitle}>
                  ✔ Tidak ada tagihan denda yang tertunggak
                </Text>
                <Text style={styles.fineResolvedMeta}>
                  {standing.fines.length} catatan tagihan
                </Text>
              </View>
              <Text style={styles.fineResolvedBody}>
                Seluruh tagihan denda Anda berstatus lunas atau dibatalkan. Status kehadiran
                sesi tetap sesuai catatan presensi/izin.
              </Text>
              <View style={styles.fineActionRow}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.outlineButton}
                  onPress={openTagihanScreen}
                >
                  <Text style={styles.outlineButtonText}>Lihat daftar tagihan</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.outlineButton}
                  onPress={() => router.push('/riwayat-pembayaran' as Href)}
                >
                  <Text style={styles.outlineButtonText}>Riwayat pembayaran</Text>
                </Pressable>
              </View>
            </View>
          )}

        {/* Pintasan Navigasi Utama */}
        {user?.role === 'praktikan' && (
          <View style={styles.quickActionRow}>
            <Pressable
              accessibilityRole="button"
              style={styles.quickPrimary}
              onPress={() => openMapsScreen()}
            >
              <Text style={styles.quickPrimaryText}>Peta & aktivitas lab</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.quickSecondary}
              onPress={() => router.push('/presensi-lokasi' as Href)}
            >
              <Text style={styles.quickSecondaryText}>Presensi lokasi GPS</Text>
            </Pressable>
          </View>
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#1D4ED8" />
            <Text style={styles.feedbackText}>Memuat sesi dan status kehadiran...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Sesi praktikum kelas Anda</Text>

        {sessions.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHistory}>
              Belum ada sesi praktikum yang tersedia untuk kelas Anda.
            </Text>
          </View>
        )}

        {sessions.map((session) => {
          const selected = selectedSessionId === session.id;
          const statusMeta = SESSION_STATUS_META[session.status];
          const sessionStanding = standing.standingBySession.get(session.id) ?? null;
          const standingKey: ResolvedAttendanceStatus = sessionStanding?.status ?? 'belum_hadir';
          const standingColors = STANDING_BADGE_STYLE[standingKey];
          const standingLabel = sessionStanding
            ? sessionStanding.presentation.praktikanLabel
            : '○ Belum Presensi';

          const sessionLab = session.labId
            ? standing.labsById.get(session.labId) ?? null
            : null;
          const hasRecordedAttendance =
            standingKey === 'hadir' || standingKey === 'terlambat';

          return (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.sessionCard, selected && styles.selectedSessionCard]}
              onPress={() => setSelectedSessionId(session.id)}
            >
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.sessionInfo}>
                {session.date} · {formatTime(session)} · Kelas {session.classId}
              </Text>
              <Text style={styles.sessionInfo}>
                Lab:{' '}
                {sessionLab
                  ? `${sessionLab.name}${
                      sessionLab.radiusMeters !== null
                        ? ` (radius ${sessionLab.radiusMeters} m)`
                        : ''
                    }${
                      sessionLab.gracePeriodMinutes !== null
                        ? ` · Toleransi ${sessionLab.gracePeriodMinutes} mnt`
                        : ''
                    }${sessionLab.active ? '' : ' · Nonaktif'}`
                  : session.labId
                    ? session.labId
                    : 'Belum ditautkan ke laboratorium'}
              </Text>

              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: statusMeta.bg }]}>
                  <Text style={[styles.badgeText, { color: statusMeta.fg }]}>
                    {statusMeta.symbol} {statusMeta.label}
                  </Text>
                </View>

                <View style={[styles.badge, { backgroundColor: standingColors.bg }]}>
                  <Text style={[styles.badgeText, { color: standingColors.fg }]}>
                    {standingLabel}
                  </Text>
                </View>

                {standingKey === 'belum_hadir' &&
                  sessionStanding?.permissionStatus === 'menunggu' && (
                    <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.badgeText, { color: '#92400E' }]}>
                        ⏳ Izin menunggu review
                      </Text>
                    </View>
                  )}

                {standingKey === 'belum_hadir' &&
                  sessionStanding?.permissionStatus === 'ditolak' && (
                    <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                      <Text style={[styles.badgeText, { color: '#991B1B' }]}>
                        ✕ Izin ditolak
                      </Text>
                    </View>
                  )}
              </View>

              {standingKey === 'izin' && (
                <Text style={styles.excusedHint}>
                  Tidak hadir dengan izin disetujui — dibebaskan dari denda keterlambatan.
                </Text>
              )}

              {sessionStanding?.fine && (
                <View style={styles.sessionFineStrip}>
                  <Text style={styles.sessionFineText}>
                    Denda {formatRupiah(sessionStanding.fine.amount)} ·{' '}
                    {formatFineStatusLabel(sessionStanding.fine.status)}
                  </Text>
                </View>
              )}

              <View style={styles.cardActionRow}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.cardPrimaryAction}
                  onPress={() => openPresensiScreen(session.id)}
                >
                  <Text style={styles.cardPrimaryActionText}>
                    {hasRecordedAttendance
                      ? 'Lihat detail presensi'
                      : session.status === 'dibuka'
                        ? 'Buka presensi lokasi'
                        : 'Detail sesi presensi'}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  style={styles.cardSecondaryAction}
                  onPress={() =>
                    router.push({
                      pathname: '/izin',
                      params: { sessionId: session.id },
                    } as Href)
                  }
                >
                  <Text style={styles.cardSecondaryActionText}>
                    {sessionStanding?.permissionStatus ? 'Status izin' : 'Ajukan izin'}
                  </Text>
                </Pressable>

                {sessionStanding?.fine && (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.cardFineAction}
                    onPress={openTagihanScreen}
                  >
                    <Text style={styles.cardFineActionText}>Lihat tagihan</Text>
                  </Pressable>
                )}
              </View>

              {selected && <Text style={styles.selectedLabel}>Sesi sedang dipilih</Text>}
            </Pressable>
          );
        })}

        <Text style={styles.sectionTitle}>Detail sesi terpilih</Text>

        <View style={styles.detailCard}>
          <Text style={styles.detailText}>Praktikan: {user?.name ?? '-'}</Text>
          <Text style={styles.detailText}>
            Sesi: {selectedSession?.title ?? 'Belum dipilih'}
          </Text>
          <Text style={styles.detailText}>Kelas: {selectedSession?.classId ?? '-'}</Text>
          <Text style={styles.detailText}>
            Laboratorium:{' '}
            {selectedLab
              ? `${selectedLab.name}${
                  selectedLab.radiusMeters !== null
                    ? ` (radius ${selectedLab.radiusMeters} m)`
                    : ''
                }${
                  selectedLab.gracePeriodMinutes !== null
                    ? ` · Toleransi ${selectedLab.gracePeriodMinutes} menit`
                    : ''
                }`
              : selectedSession?.labId ?? '-'}
          </Text>
          <Text style={styles.detailText}>
            Waktu:{' '}
            {selectedSession
              ? `${selectedSession.date} · ${formatTime(selectedSession)}`
              : '-'}
          </Text>
          <Text style={styles.detailText}>
            Status sesi:{' '}
            {selectedSession
              ? `${SESSION_STATUS_META[selectedSession.status].symbol} ${
                  SESSION_STATUS_META[selectedSession.status].label
                }`
              : '-'}
          </Text>
          <Text style={styles.detailText}>
            Status kehadiran:{' '}
            {selectedSession
              ? selectedStanding
                ? selectedStanding.presentation.praktikanLabel
                : '○ Belum Presensi'
              : '-'}
          </Text>
          {selectedStanding?.fine && (
            <Text style={styles.detailFineText}>
              Tagihan denda: {formatRupiah(selectedStanding.fine.amount)} (
              {formatFineStatusLabel(selectedStanding.fine.status)})
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !selectedSession || !user }}
          disabled={!selectedSession || !user}
          style={[
            styles.attendanceButton,
            (!selectedSession || !user) && styles.disabledButton,
          ]}
          onPress={() => {
            if (selectedSession) {
              openPresensiScreen(selectedSession.id);
            }
          }}
        >
          <Text style={styles.attendanceButtonText}>
            {!selectedSession
              ? 'Pilih sesi untuk membuka presensi'
              : selectedStanding?.status === 'hadir' ||
                  selectedStanding?.status === 'terlambat'
                ? 'Lihat detail presensi sesi ini'
                : 'Buka halaman presensi lokasi'}
          </Text>
        </Pressable>

        {selectedSession && (
          <View style={styles.detailSecondaryRow}>
            <Pressable
              accessibilityRole="button"
              disabled={!user}
              style={[styles.outlineButton, !user && styles.disabledOutline]}
              onPress={() =>
                router.push({
                  pathname: '/izin',
                  params: { sessionId: selectedSession.id },
                } as Href)
              }
            >
              <Text style={styles.outlineButtonText}>Pengajuan izin</Text>
            </Pressable>

            {selectedSession.labId && (
              <Pressable
                accessibilityRole="button"
                style={styles.outlineButton}
                onPress={() => openMapsScreen(selectedSession.labId)}
              >
                <Text style={styles.outlineButtonText}>Lihat lab di peta</Text>
              </Pressable>
            )}

            {selectedStanding?.fine && (
              <Pressable
                accessibilityRole="button"
                style={styles.outlineButton}
                onPress={openTagihanScreen}
              >
                <Text style={styles.outlineButtonText}>Buka tagihan denda</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Jadwal mingguan kelas</Text>

        {schedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHistory}>
              {loading ? 'Memuat jadwal...' : 'Belum ada jadwal praktikum tersedia.'}
            </Text>
          </View>
        ) : (
          schedules.map((schedule) => {
            const schedLab = schedule.labId
              ? standing.labsById.get(schedule.labId) ?? null
              : null;
            return (
              <View key={schedule.id} style={styles.historyCard}>
                <Text style={styles.sessionTitle}>{schedule.course}</Text>
                <Text style={styles.sessionInfo}>
                  {dayLabel(schedule.dayOfWeek)} · {schedule.startTime}–{schedule.endTime}
                </Text>
                <Text style={styles.sessionInfo}>
                  Ruang: {schedule.room || '-'}
                  {schedLab ? ` · Lab: ${schedLab.name}` : ''}
                </Text>
              </View>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Riwayat presensi</Text>

        <Text style={styles.historyDescription}>
          Catatan presensi milik {user?.name ?? 'praktikan'} (pembayaran denda tidak mengubah
          status keterlambatan)
        </Text>

        {standing.attendanceHistory.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHistory}>Belum ada riwayat presensi tercatat.</Text>
          </View>
        ) : (
          standing.attendanceHistory.map((record, index) => {
            const session = record.sessionId
              ? sessions.find((item) => item.id === record.sessionId)
              : undefined;
            const statusColor =
              record.resolvedStatus === 'terlambat'
                ? '#B45309'
                : record.resolvedStatus === 'izin'
                  ? '#1D4ED8'
                  : '#0F766E';

            return (
              <View
                key={record.sessionId || `${record.uid}-${index}`}
                style={styles.historyCard}
              >
                <Text style={styles.sessionTitle}>
                  {session?.title ?? record.sessionId ?? 'Sesi praktikum'}
                </Text>
                <Text style={styles.sessionInfo}>
                  {session
                    ? `${session.date} · ${formatTime(session)}`
                    : 'Detail jadwal sesi tidak tersedia'}
                </Text>
                <Text style={[styles.historyStatusText, { color: statusColor }]}>
                  {record.presentation.praktikanLabel}
                  {record.attendedAt && record.resolvedStatus !== 'izin'
                    ? ` · ${record.attendedAt.toLocaleString('id-ID')}`
                    : ''}
                </Text>

                {record.verificationMethod === 'geolocation' && (
                  <Text style={styles.sessionInfo}>
                    Verifikasi GPS
                    {typeof record.distanceMeters === 'number'
                      ? ` · Jarak ${formatDistanceMeters(record.distanceMeters)}`
                      : ''}
                  </Text>
                )}

                {record.fine && (
                  <View style={styles.historyFineRow}>
                    <Text style={styles.sessionFineText}>
                      Tagihan: {formatRupiah(record.fine.amount)} ·{' '}
                      {formatFineStatusLabel(record.fine.status)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.historyFineLink}
                      onPress={openTagihanScreen}
                    >
                      <Text style={styles.historyFineLinkText}>Lihat tagihan</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
    paddingBottom: 48,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 19,
  },
  identityStrip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    marginTop: 14,
  },
  identityText: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  fineAlertCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderLeftWidth: 4,
    borderLeftColor: '#B45309',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 6,
  },
  fineAlertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
  },
  fineAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    flexShrink: 1,
  },
  fineAlertAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B45309',
  },
  fineAlertBody: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  fineActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  finePrimaryBtn: {
    backgroundColor: '#B45309',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  finePrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fineSecondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  fineSecondaryBtnText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
  },
  fineResolvedCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    gap: 6,
  },
  fineResolvedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F766E',
    flexShrink: 1,
  },
  fineResolvedMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  fineResolvedBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  quickPrimary: {
    flexGrow: 1,
    flexBasis: 145,
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  quickPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  quickSecondary: {
    flexGrow: 1,
    flexBasis: 145,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  quickSecondaryText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  feedbackText: {
    color: '#334155',
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 22,
    marginBottom: 10,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  selectedSessionCard: {
    borderColor: '#1D4ED8',
    borderWidth: 2,
    backgroundColor: '#F8FAFF',
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sessionInfo: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  excusedHint: {
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 17,
  },
  sessionFineStrip: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sessionFineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  cardActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  cardPrimaryAction: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  cardPrimaryActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardSecondaryAction: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  cardSecondaryActionText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
  },
  cardFineAction: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  cardFineActionText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  detailFineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
    lineHeight: 19,
  },
  attendanceButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
  },
  attendanceButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  detailSecondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  outlineButton: {
    flexGrow: 1,
    minWidth: 135,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  disabledOutline: {
    opacity: 0.5,
  },
  outlineButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  historyDescription: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  emptyHistory: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  historyStatusText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  historyFineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyFineLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  historyFineLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
});
