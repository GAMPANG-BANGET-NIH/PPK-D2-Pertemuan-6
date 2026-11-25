/**
 * /maps — Peta Interaktif Laboratorium & Aktivitas Realtime
 * Sprint 3, SRS-04, konsumsi SRS-05, SRS-07 (Moses).
 *
 * Fitur:
 * - Menampilkan marker laboratorium secara realtime dari Firestore melalui
 *   kontrak Mischa (`subscribeLaboratories`) + lingkaran radius (`Circle`)
 *   sebagai visualisasi area (bukan otorisasi presensi).
 * - Memantau posisi pengguna realtime selama layar aktif (`useWatchLocation`)
 *   dan menghentikan watcher otomatis saat layar blur, aplikasi background,
 *   atau komponen dilepas.
 * - Saat marker lab dipilih, menampilkan detail lab (nama, status, koordinat,
 *   radius, jarak dari posisi pengguna) serta aktivitas praktikum yang sedang
 *   berlangsung dan sesi berikutnya dari kontrak Mischa (`subscribeLabActivity`),
 *   dengan fallback aman ke sesi kelas praktikan bila Security Rules membatasi
 *   query lintas kelas.
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
import { useWatchLocation } from '../hooks/use-lokasi';
import { useNetwork } from '../hooks/use-network';
import {
  subscribeLabActivity,
  subscribeLaboratories,
  todayInLabTimezone,
  type LabActivity,
  type LabActivitySession,
  type Laboratorium,
} from '../services/laboratorium';
import {
  MAX_ACCURACY_METERS,
  MAX_LOCATION_AGE_MS,
  evaluateLabProximity,
  formatCoordinates,
  formatDistanceMeters,
  openAppLocationSettings,
} from '../services/lokasi';
import { subscribeMySessions } from '../services/presensi';
import type { AppUser, Session, SessionStatus } from '../types';
import { getErrorMessage } from '../utils/errors';
import { MapsCanvas, type MapFocusTarget } from './maps-canvas';

type Props = {
  user: AppUser | null;
  initialLabId?: string;
};

type LabFilter = 'semua' | 'aktif' | 'nonaktif';

const STATUS_META: Record<SessionStatus, { symbol: string; label: string; bg: string; fg: string }> = {
  belum_dibuka: { symbol: '○', label: 'Belum Dibuka', bg: '#F1F5F9', fg: '#334155' },
  dibuka: { symbol: '●', label: 'Dibuka', bg: '#DCFCE7', fg: '#166534' },
  ditutup: { symbol: '■', label: 'Ditutup', bg: '#FEE2E2', fg: '#991B1B' },
};

function friendlyError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return getErrorMessage(err);
  }
  return err instanceof Error && err.message.trim() ? err.message : fallback;
}

/**
 * Fallback komputasi aktivitas lab khusus kelas praktikan mengikuti definisi
 * Mischa (zona waktu Asia/Jakarta) jika query semua kelas ditolak rules.
 */
function buildClassScopedActivity(labId: string, sessions: Session[]): LabActivity {
  const labSessions = sessions.filter((s) => s.labId === labId);
  const byDateTime = (a: Session, b: Session) =>
    a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);

  const toItem = (s: Session): LabActivitySession => ({
    id: s.id,
    classId: s.classId,
    className: s.classId,
    title: s.title,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
  });

  const berlangsung = labSessions
    .filter((s) => s.status === 'dibuka')
    .sort(byDateTime)
    .map(toItem);

  const today = todayInLabTimezone();
  const upcoming = labSessions
    .filter((s) => s.status === 'belum_dibuka' && s.date >= today)
    .sort(byDateTime);

  return {
    labId,
    berlangsung,
    berikutnya: upcoming.length > 0 ? toItem(upcoming[0]) : null,
  };
}

function ActivitySessionCard({
  item,
  canOpenPresensi,
  onOpenPresensi,
}: {
  item: LabActivitySession;
  canOpenPresensi: boolean;
  onOpenPresensi: () => void;
}) {
  const meta = STATUS_META[item.status];
  return (
    <View style={styles.activityCard}>
      <Text style={styles.activityTitle}>{item.title}</Text>
      <Text style={styles.activityMeta}>Kelas: {item.className}</Text>
      <Text style={styles.activityMeta}>
        Jadwal: {item.date} · {item.startTime}–{item.endTime}
      </Text>
      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
        <Text style={[styles.badgeText, { color: meta.fg }]}>
          {meta.symbol} {meta.label}
        </Text>
      </View>
      {canOpenPresensi && (
        <Pressable
          accessibilityRole="button"
          style={styles.presensiShortcut}
          onPress={onOpenPresensi}
        >
          <Text style={styles.presensiShortcutText}>Buka Presensi Sesi Ini →</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function MapsScreen({ user, initialLabId }: Props) {
  const router = useRouter();
  const { isOnline } = useNetwork();

  /* ---- Pemantauan lokasi pengguna realtime (berhenti saat blur/unmount) ---- */
  const {
    reading: userLocation,
    loading: locLoading,
    watching,
    error: locError,
    errorCode: locErrorCode,
    lastUpdatedAt,
    retry: retryLocation,
  } = useWatchLocation({ enabled: Boolean(user) });

  /* ---- Listener realtime daftar laboratorium (kontrak Mischa) ---- */
  const [labsAttempt, setLabsAttempt] = useState(0);
  const labsSubKey = user ? `${user.uid}:${labsAttempt}` : null;
  const [labsState, setLabsState] = useState<{
    key: string | null;
    items: Laboratorium[];
    error: string | null;
    ready: boolean;
  }>({ key: null, items: [], error: null, ready: false });

  useEffect(() => {
    if (!labsSubKey) {
      return;
    }
    const unsubscribe = subscribeLaboratories(
      (items) => {
        setLabsState({ key: labsSubKey, items, error: null, ready: true });
      },
      (err) => {
        setLabsState({
          key: labsSubKey,
          items: [],
          error: friendlyError(err, 'Gagal memuat data laboratorium.'),
          ready: true,
        });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [labsSubKey]);

  const labsCurrent = labsSubKey !== null && labsState.key === labsSubKey;
  const allLabs = useMemo(
    () => (labsCurrent ? labsState.items : []),
    [labsCurrent, labsState.items],
  );
  const labsLoading = labsSubKey !== null && (!labsCurrent || !labsState.ready);
  const labsError = labsCurrent ? labsState.error : null;

  /* ---- Filter & pilihan marker lab ---- */
  const [filter, setFilter] = useState<LabFilter>('semua');
  const [manualLabId, setManualLabId] = useState<string | null>(
    () => initialLabId?.trim() || null,
  );
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  const visibleLabs = useMemo(
    () =>
      allLabs.filter((lab) =>
        filter === 'semua' ? true : filter === 'aktif' ? lab.active : !lab.active,
      ),
    [allLabs, filter],
  );

  const selectedLab = useMemo<Laboratorium | null>(() => {
    if (manualLabId) {
      const matched = allLabs.find((lab) => lab.id === manualLabId);
      if (matched) {
        return matched;
      }
    }
    return visibleLabs.find((lab) => lab.active) ?? visibleLabs[0] ?? allLabs[0] ?? null;
  }, [manualLabId, allLabs, visibleLabs]);

  const selectedLabId = selectedLab?.id ?? null;

  /* ---- Listener aktivitas lab realtime (kontrak Mischa + fallback rules) ---- */
  const [activityAttempt, setActivityAttempt] = useState(0);
  const activitySubKey =
    user && selectedLabId ? `${selectedLabId}:${user.uid}:${activityAttempt}` : null;

  const [activityState, setActivityState] = useState<{
    key: string | null;
    activity: LabActivity | null;
    classScoped: boolean;
    error: string | null;
    ready: boolean;
  }>({ key: null, activity: null, classScoped: false, error: null, ready: false });

  useEffect(() => {
    if (!activitySubKey || !selectedLabId || !user) {
      return;
    }

    let disposed = false;
    let fallbackUnsub: (() => void) | null = null;
    let primaryUnsub: (() => void) | null = null;

    const startClassFallback = () => {
      if (disposed || !user.classId) {
        setActivityState({
          key: activitySubKey,
          activity: { labId: selectedLabId, berlangsung: [], berikutnya: null },
          classScoped: true,
          error: null,
          ready: true,
        });
        return;
      }

      fallbackUnsub = subscribeMySessions(
        user.classId,
        (sessions) => {
          if (disposed) return;
          setActivityState({
            key: activitySubKey,
            activity: buildClassScopedActivity(selectedLabId, sessions),
            classScoped: true,
            error: null,
            ready: true,
          });
        },
        (fallbackErr) => {
          if (disposed) return;
          setActivityState({
            key: activitySubKey,
            activity: null,
            classScoped: true,
            error: friendlyError(fallbackErr, 'Gagal memuat aktivitas laboratorium.'),
            ready: true,
          });
        },
      );
    };

    primaryUnsub = subscribeLabActivity(
      selectedLabId,
      (activity) => {
        if (disposed) return;
        setActivityState({
          key: activitySubKey,
          activity,
          classScoped: false,
          error: null,
          ready: true,
        });
      },
      (err) => {
        if (disposed) return;
        const code =
          err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
            ? err.code
            : null;

        if (code === 'permission-denied' && user.role === 'praktikan') {
          if (primaryUnsub) {
            primaryUnsub();
            primaryUnsub = null;
          }
          startClassFallback();
          return;
        }

        setActivityState({
          key: activitySubKey,
          activity: null,
          classScoped: false,
          error: friendlyError(err, 'Gagal memuat aktivitas laboratorium.'),
          ready: true,
        });
      },
    );

    return () => {
      disposed = true;
      if (primaryUnsub) {
        primaryUnsub();
      }
      if (fallbackUnsub) {
        fallbackUnsub();
      }
    };
  }, [activitySubKey, selectedLabId, user]);

  const activityCurrent = activitySubKey !== null && activityState.key === activitySubKey;
  const activity = activityCurrent ? activityState.activity : null;
  const activityClassScoped = activityCurrent ? activityState.classScoped : false;
  const activityLoading = activitySubKey !== null && (!activityCurrent || !activityState.ready);
  const activityError = activityCurrent ? activityState.error : null;

  /* ---- Perhitungan jarak ke lab terpilih ---- */
  const selectedProximity = useMemo(() => {
    if (!userLocation || !selectedLab) {
      return null;
    }
    return evaluateLabProximity(userLocation, selectedLab, {
      maxAccuracyMeters: MAX_ACCURACY_METERS,
      maxAgeMs: MAX_LOCATION_AGE_MS,
      nowMs: userLocation.timestamp,
    });
  }, [userLocation, selectedLab]);

  function handleSelectLab(labId: string) {
    setManualLabId(labId);
    const target = allLabs.find((lab) => lab.id === labId);
    if (target) {
      setFocusTarget({
        latitude: target.latitude,
        longitude: target.longitude,
        nonce: Date.now(),
      });
    }
  }

  function handleFocusUser() {
    if (!userLocation) {
      return;
    }
    setFocusTarget({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      nonce: Date.now(),
    });
  }

  function handleFocusSelectedLab() {
    if (!selectedLab) {
      return;
    }
    setFocusTarget({
      latitude: selectedLab.latitude,
      longitude: selectedLab.longitude,
      nonce: Date.now(),
    });
  }

  async function handleOpenSettings() {
    setSettingsNotice(null);
    const opened = await openAppLocationSettings();
    if (!opened) {
      setSettingsNotice('Buka Pengaturan perangkat secara manual untuk mengaktifkan izin Lokasi.');
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>Belum Login</Text>
          <Text style={styles.bodyText}>Silakan login untuk melihat peta laboratorium.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <UserHeader />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Peta & Aktivitas Laboratorium</Text>
        <Text style={styles.subtitle}>
          Pilih marker laboratorium untuk melihat detail koordinat, radius, serta praktikum yang
          sedang berlangsung dan sesi berikutnya secara realtime.
        </Text>

        {!isOnline && (
          <View style={styles.warnCard} accessibilityRole="alert">
            <Text style={styles.warnTitle}>⚠ Mode Offline</Text>
            <Text style={styles.warnText}>
              Pembaruan peta dan aktivitas laboratorium realtime tertunda sampai koneksi internet
              kembali aktif.
            </Text>
          </View>
        )}

        {/* Status pemantauan lokasi perangkat */}
        <View style={styles.statusStrip}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusTitle}>
              {watching && userLocation
                ? '● Pemantauan lokasi aktif'
                : locLoading
                  ? '○ Mencari posisi GPS...'
                  : watching
                    ? '○ Menunggu sinyal GPS'
                    : '■ Pemantauan lokasi jeda'}
            </Text>
            <Text style={styles.statusSub}>
              {userLocation
                ? `${formatCoordinates(userLocation.latitude, userLocation.longitude)} · Akurasi ±${Math.round(userLocation.accuracy)} m${lastUpdatedAt ? ` · ${lastUpdatedAt.toLocaleTimeString('id-ID')}` : ''}`
                : 'Posisi perangkat akan tampil setelah izin lokasi diberikan.'}
            </Text>
          </View>
        </View>

        {locError && (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorTitle}>⚠ Lokasi Perangkat Tidak Tersedia</Text>
            <Text style={styles.errorText}>{locError}</Text>
            {settingsNotice && <Text style={styles.warnText}>{settingsNotice}</Text>}
            <View style={styles.buttonRow}>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={retryLocation}
              >
                <Text style={styles.secondaryButtonText}>Coba Lagi</Text>
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

        {/* Filter status lab */}
        <View style={styles.chipRow}>
          {(
            [
              { value: 'semua', label: `Semua (${allLabs.length})` },
              { value: 'aktif', label: `Aktif (${allLabs.filter((l) => l.active).length})` },
              { value: 'nonaktif', label: `Nonaktif (${allLabs.filter((l) => !l.active).length})` },
            ] as { value: LabFilter; label: string }[]
          ).map((item) => {
            const active = filter === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(item.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Kanvas peta */}
        {labsLoading ? (
          <View style={styles.infoCard}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.bodyText}>Memuat marker laboratorium dari Firestore...</Text>
          </View>
        ) : labsError ? (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorTitle}>Gagal Memuat Laboratorium</Text>
            <Text style={styles.errorText}>{labsError}</Text>
            <Pressable
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={() => setLabsAttempt((n) => n + 1)}
            >
              <Text style={styles.secondaryButtonText}>Muat Ulang</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <MapsCanvas
              labs={visibleLabs}
              selectedLabId={selectedLabId}
              userLocation={userLocation}
              onSelectLab={handleSelectLab}
              focusTarget={focusTarget}
            />

            <View style={styles.mapActionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !userLocation }}
                disabled={!userLocation}
                style={[styles.secondaryButton, !userLocation && styles.disabledButton]}
                onPress={handleFocusUser}
              >
                <Text style={styles.secondaryButtonText}>Pusatkan ke Posisi Saya</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !selectedLab }}
                disabled={!selectedLab}
                style={[styles.secondaryButton, !selectedLab && styles.disabledButton]}
                onPress={handleFocusSelectedLab}
              >
                <Text style={styles.secondaryButtonText}>Pusatkan ke Lab</Text>
              </Pressable>
            </View>

            <Text style={styles.captionNote}>
              Lingkaran radius pada peta hanya visualisasi area laboratorium, bukan mekanisme
              otorisasi presensi.
            </Text>
          </>
        )}

        {/* Daftar cepat marker lab (memudahkan pemilihan pada layar kecil 360px) */}
        {!labsLoading && !labsError && visibleLabs.length === 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.emptyTitle}>Tidak Ada Laboratorium</Text>
            <Text style={styles.bodyText}>
              Belum ada data laboratorium yang cocok dengan filter saat ini.
            </Text>
          </View>
        )}

        {visibleLabs.length > 0 && (
          <View style={styles.selectorSection}>
            <Text style={styles.sectionHeading}>Daftar Marker Laboratorium</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.labChipRow}
            >
              {visibleLabs.map((lab) => {
                const selected = lab.id === selectedLabId;
                return (
                  <Pressable
                    key={lab.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.labChip, selected && styles.labChipSelected]}
                    onPress={() => handleSelectLab(lab.id)}
                  >
                    <Text style={[styles.labChipTitle, selected && styles.labChipTitleSelected]}>
                      {lab.active ? '● ' : '■ '}
                      {lab.name}
                    </Text>
                    <Text style={[styles.labChipSub, selected && styles.labChipSubSelected]}>
                      Radius {lab.radiusMeters} m
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Panel detail lab terpilih + aktivitas realtime (SRS-04 + SRS-05) */}
        {selectedLab && (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{selectedLab.name}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: selectedLab.active ? '#DCFCE7' : '#F1F5F9' },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: selectedLab.active ? '#166534' : '#475569' },
                  ]}
                >
                  {selectedLab.active ? '● Aktif' : '■ Nonaktif'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Koordinat</Text>
              <Text style={styles.detailVal}>
                {formatCoordinates(selectedLab.latitude, selectedLab.longitude)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Radius Lab</Text>
              <Text style={styles.detailVal}>{selectedLab.radiusMeters} meter</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Jarak Anda</Text>
              <Text style={styles.detailVal}>
                {selectedProximity
                  ? formatDistanceMeters(selectedProximity.distanceMeters)
                  : 'Lokasi perangkat belum tersedia'}
              </Text>
            </View>

            {selectedProximity && (
              <View
                style={[
                  styles.proximityPill,
                  selectedProximity.withinRadius && selectedLab.active
                    ? styles.proximityInside
                    : styles.proximityOutside,
                ]}
              >
                <Text
                  style={[
                    styles.proximityText,
                    {
                      color:
                        selectedProximity.withinRadius && selectedLab.active
                          ? '#166534'
                          : '#991B1B',
                    },
                  ]}
                >
                  {!selectedLab.active
                    ? '■ Laboratorium sedang nonaktif'
                    : selectedProximity.withinRadius
                      ? '✓ Posisi Anda berada di dalam radius lab (umpan balik lokal)'
                      : `✕ Posisi Anda di luar radius lab (+${formatDistanceMeters(selectedProximity.overflowMeters)})`}
                </Text>
              </View>
            )}

            <View style={styles.divider} />
            <Text style={styles.sectionHeading}>Aktivitas Laboratorium (Realtime)</Text>

            {activityClassScoped && (
              <Text style={styles.scopeNote}>
                Info: Menampilkan aktivitas kelas Anda ({user.classId ?? '-'}) di lab ini sesuai
                aturan akses praktikan pada Firestore.
              </Text>
            )}

            {activityLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.bodyText}>Memuat aktivitas laboratorium...</Text>
              </View>
            ) : activityError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{activityError}</Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  onPress={() => setActivityAttempt((n) => n + 1)}
                >
                  <Text style={styles.secondaryButtonText}>Coba Lagi</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.subHeading}>
                  Sedang Berlangsung ({activity?.berlangsung.length ?? 0})
                </Text>
                {activity && activity.berlangsung.length > 0 ? (
                  <View style={styles.activityList}>
                    {activity.berlangsung.map((item) => (
                      <ActivitySessionCard
                        key={item.id}
                        item={item}
                        canOpenPresensi={
                          user.role === 'praktikan' && user.classId === item.classId
                        }
                        onOpenPresensi={() =>
                          router.push({
                            pathname: '/presensi-lokasi',
                            params: { sessionId: item.id },
                          } as Href)
                        }
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyActivityBox}>
                    <Text style={styles.emptyActivityText}>
                      Tidak ada praktikum yang sedang berlangsung di lab ini.
                    </Text>
                  </View>
                )}

                <Text style={styles.subHeading}>Sesi Berikutnya</Text>
                {activity?.berikutnya ? (
                  <ActivitySessionCard
                    item={activity.berikutnya}
                    canOpenPresensi={false}
                    onOpenPresensi={() => {}}
                  />
                ) : (
                  <View style={styles.emptyActivityBox}>
                    <Text style={styles.emptyActivityText}>
                      Belum ada sesi berikutnya terjadwal di lab ini.
                    </Text>
                  </View>
                )}
              </>
            )}

            <Text style={styles.captionNote}>
              Definisi: Berlangsung = sesi ber-status &quot;Dibuka&quot;. Berikutnya = sesi terdekat
              ber-status &quot;Belum dibuka&quot; (zona waktu Asia/Jakarta).
            </Text>
          </View>
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
    paddingBottom: 44,
    gap: 12,
  },
  centerBox: {
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  statusStrip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusLeft: {
    flex: 1,
    gap: 3,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusSub: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  warnCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    gap: 4,
  },
  warnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  warnText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
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
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  bodyText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  mapActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  captionNote: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  selectorSection: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  labChipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  labChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 130,
    gap: 2,
  },
  labChipSelected: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  labChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  labChipTitleSelected: {
    color: '#FFFFFF',
  },
  labChipSub: {
    fontSize: 11,
    color: '#64748B',
  },
  labChipSubSelected: {
    color: '#DBEAFE',
  },
  detailPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 16,
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailKey: {
    fontSize: 13,
    color: '#64748B',
    minWidth: 90,
  },
  detailVal: {
    fontSize: 13,
    color: '#0F172A',
    flex: 1,
    textAlign: 'right',
  },
  proximityPill: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 2,
  },
  proximityInside: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  proximityOutside: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  proximityText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  scopeNote: {
    fontSize: 12,
    color: '#1E40AF',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 9,
    lineHeight: 17,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  activityList: {
    gap: 8,
  },
  activityCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    gap: 4,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  activityMeta: {
    fontSize: 12,
    color: '#475569',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  presensiShortcut: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presensiShortcutText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyActivityBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  emptyActivityText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
});
