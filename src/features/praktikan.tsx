/**
 * /praktikan — Beranda Praktikan (Sprint 2 + Sprint 3 SRS-01 navigasi Moses).
 *
 * - Menampilkan daftar sesi dan jadwal kelas praktikan secara realtime (termasuk
 *   nama laboratorium terkait dari Firestore).
 * - Menyediakan navigasi ke halaman presensi GPS khusus (`/presensi-lokasi`),
 *   peta laboratorium interaktif (`/maps`), dan pengajuan izin (`/izin`).
 * - Pencatatan presensi tidak lagi dilakukan langsung tanpa GPS di layar ini,
 *   melainkan diarahkan ke `/presensi-lokasi?sessionId=<id>` (SRS-01 & SRS-02).
 */
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { usePresensi } from '../hooks/use-presensi';
import { subscribeLaboratories, type Laboratorium } from '../services/laboratorium';
import { formatDistanceMeters } from '../services/lokasi';
import type { AppUser, Session, SessionStatus } from '../types';

const STATUS_META: Record<SessionStatus, { symbol: string; label: string; bg: string; fg: string }> = {
  belum_dibuka: { symbol: '○', label: 'Belum Dibuka', bg: '#F1F5F9', fg: '#334155' },
  dibuka: { symbol: '●', label: 'Dibuka', bg: '#DCFCE7', fg: '#166534' },
  ditutup: { symbol: '■', label: 'Ditutup', bg: '#FEE2E2', fg: '#991B1B' },
};

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;

function dayLabel(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek - 1] ?? `Hari ke-${dayOfWeek}`;
}

function formatTime(session: Session): string {
  return `${session.startTime}–${session.endTime}`;
}

export default function PraktikanScreen({ user }: { user: AppUser | null }) {
  const router = useRouter();
  const { sessions, schedules, attendance, loading, error } = usePresensi(user);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [labs, setLabs] = useState<Laboratorium[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const unsubscribe = subscribeLaboratories(
      (items) => setLabs(items),
      () => {
        // Kegagalan baca nama lab tidak memblokir beranda praktikan.
      },
    );
    return () => {
      unsubscribe();
    };
  }, [user]);

  const labMap = useMemo(() => new Map(labs.map((l) => [l.id, l])), [labs]);

  const attendanceBySession = useMemo(
    () => new Map(attendance.map((record) => [record.sessionId, record])),
    [attendance],
  );

  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? null;

  const selectedLab = selectedSession?.labId
    ? labMap.get(selectedSession.labId) ?? null
    : null;

  const selectedAttendance = selectedSession
    ? attendanceBySession.get(selectedSession.id) ?? null
    : null;

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

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <UserHeader />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Beranda Praktikan</Text>
        <Text style={styles.subtitle}>
          Jadwal kelas, presensi berbasis lokasi GPS, peta lab, dan izin praktikum
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {user
              ? `Praktikan: ${user.name} · Kelas: ${user.classId ?? 'Belum terdaftar'}`
              : 'Silakan login sebagai praktikan untuk melihat sesi praktikum.'}
          </Text>
        </View>

        {/* Akses cepat Sprint 3: Peta Lab & Halaman Presensi Lokasi */}
        {user?.role === 'praktikan' && (
          <View style={styles.quickActionRow}>
            <Pressable
              accessibilityRole="button"
              style={styles.quickPrimary}
              onPress={() => openMapsScreen()}
            >
              <Text style={styles.quickPrimaryText}>Peta & Aktivitas Lab</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.quickSecondary}
              onPress={() => router.push('/presensi-lokasi' as Href)}
            >
              <Text style={styles.quickSecondaryText}>Presensi GPS</Text>
            </Pressable>
          </View>
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.feedbackText}>Memuat data praktikum...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>1. Sesi Praktikum Kelas Anda</Text>

        {sessions.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHistory}>
              Belum ada sesi praktikum yang tersedia untuk kelas Anda.
            </Text>
          </View>
        )}

        {sessions.map((session) => {
          const selected = selectedSessionId === session.id;
          const statusMeta = STATUS_META[session.status];
          const attendedRecord = attendanceBySession.get(session.id) ?? null;
          const sessionLab = session.labId ? labMap.get(session.labId) ?? null : null;

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
                  ? `${sessionLab.name} (radius ${sessionLab.radiusMeters} m${sessionLab.active ? '' : ' · Nonaktif'})`
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

                {attendedRecord ? (
                  <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.badgeText, { color: '#166534' }]}>
                      ✓ Sudah Presensi
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.badgeText, { color: '#92400E' }]}>
                      ○ Belum Presensi
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardActionRow}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.cardPrimaryAction}
                  onPress={() => openPresensiScreen(session.id)}
                >
                  <Text style={styles.cardPrimaryActionText}>
                    {attendedRecord
                      ? 'Lihat Status Presensi'
                      : session.status === 'dibuka'
                        ? 'Buka Presensi Lokasi'
                        : 'Detail Presensi'}
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
                  <Text style={styles.cardSecondaryActionText}>Ajukan Izin</Text>
                </Pressable>
              </View>

              {selected && <Text style={styles.selectedLabel}>Sesi dipilih</Text>}
            </Pressable>
          );
        })}

        <Text style={styles.sectionTitle}>2. Detail Sesi Terpilih</Text>

        <View style={styles.detailCard}>
          <Text style={styles.detailText}>Praktikan: {user?.name ?? '-'}</Text>
          <Text style={styles.detailText}>Sesi: {selectedSession?.title ?? 'Belum dipilih'}</Text>
          <Text style={styles.detailText}>Kelas: {selectedSession?.classId ?? '-'}</Text>
          <Text style={styles.detailText}>
            Laboratorium:{' '}
            {selectedLab
              ? `${selectedLab.name} (radius ${selectedLab.radiusMeters} m)`
              : selectedSession?.labId ?? '-'}
          </Text>
          <Text style={styles.detailText}>
            Waktu: {selectedSession ? `${selectedSession.date} · ${formatTime(selectedSession)}` : '-'}
          </Text>
          <Text style={styles.detailText}>
            Status Sesi:{' '}
            {selectedSession
              ? `${STATUS_META[selectedSession.status].symbol} ${STATUS_META[selectedSession.status].label}`
              : '-'}
          </Text>
          <Text style={styles.detailText}>
            Status Presensi:{' '}
            {selectedSession
              ? selectedAttendance
                ? '✓ Sudah Presensi'
                : '○ Belum Presensi'
              : '-'}
          </Text>
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
              ? 'Pilih Sesi untuk Membuka Presensi'
              : selectedAttendance
                ? 'Lihat Detail Presensi Sesi Ini'
                : 'Buka Halaman Presensi Lokasi'}
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
              <Text style={styles.outlineButtonText}>Ajukan Izin</Text>
            </Pressable>

            {selectedSession.labId && (
              <Pressable
                accessibilityRole="button"
                style={styles.outlineButton}
                onPress={() => openMapsScreen(selectedSession.labId)}
              >
                <Text style={styles.outlineButtonText}>Lihat Lab di Peta</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>3. Jadwal Praktikum</Text>

        {schedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHistory}>
              {loading ? 'Memuat jadwal...' : 'Belum ada jadwal tersedia.'}
            </Text>
          </View>
        ) : (
          schedules.map((schedule) => {
            const schedLab = schedule.labId ? labMap.get(schedule.labId) ?? null : null;
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

        <Text style={styles.sectionTitle}>4. Riwayat Presensi</Text>

        <Text style={styles.historyDescription}>
          Riwayat kehadiran milik {user?.name ?? 'praktikan'}
        </Text>

        {attendance.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyHistory}>Belum ada riwayat presensi.</Text>
          </View>
        ) : (
          attendance.map((record) => {
            const session = sessions.find((item) => item.id === record.sessionId);

            return (
              <View key={record.sessionId} style={styles.historyCard}>
                <Text style={styles.sessionTitle}>
                  {session?.title ?? record.sessionId}
                </Text>
                <Text style={styles.sessionInfo}>
                  {session
                    ? `${session.date} · ${formatTime(session)}`
                    : 'Detail sesi tidak tersedia'}
                </Text>
                <Text style={styles.historyTime}>
                  ✓ Hadir:{' '}
                  {record.attendedAt
                    ? record.attendedAt.toLocaleString('id-ID')
                    : 'Menunggu sinkronisasi'}
                </Text>
                {record.verificationMethod === 'geolocation' && (
                  <Text style={styles.sessionInfo}>
                    Verifikasi GPS
                    {typeof record.distanceMeters === 'number'
                      ? ` · Jarak ${formatDistanceMeters(record.distanceMeters)}`
                      : ''}
                  </Text>
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
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 16,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 19,
  },
  notice: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    marginTop: 14,
  },
  noticeText: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  quickPrimary: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
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
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 12,
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
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  selectedSessionCard: {
    borderColor: '#2563EB',
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
  cardActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  cardPrimaryAction: {
    backgroundColor: '#2563EB',
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
  selectedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  attendanceButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
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
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 11,
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
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  historyTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
    marginTop: 2,
  },
});
