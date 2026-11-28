/**
 * Rekap Kehadiran Praktikan Realtime — Sprint 4, SRS-10 & SRS-11 (Moses).
 *
 * Menampilkan status kehadiran per praktikan menggunakan `gracePeriodMinutes` dari
 * koleksi `laboratories` (bukan hard-coded), dengan pembedaan teks + simbol:
 * - ✔ Hadir (tepat waktu)
 * - ⏱ Terlambat (+menit)
 * - ✎ Izin (excused — tetap tidak hadir dengan izin, bebas denda)
 * - ○ Belum hadir
 *
 * Pembayaran denda (`fine.status === 'paid'`) tidak mengubah status kehadiran.
 * Asprak hanya memantau field `onTime`/`lateMinutes` tanpa mengubahnya.
 */
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { useAuth } from '../context/auth-context';
import { useSessionRecap } from '../hooks/use-keterlambatan';
import {
  describeAttendanceStatus,
  formatFineStatusLabel,
  formatRupiah,
  type ResolvedAttendanceStatus,
  type SessionRecapRow,
} from '../services/keterlambatan';
import type { SessionStatus } from '../types';

type RecapFilter = 'semua' | ResolvedAttendanceStatus;

const SESSION_BADGE: Record<
  SessionStatus,
  { symbol: string; label: string; bg: string; fg: string; border: string }
> = {
  belum_dibuka: {
    symbol: '○',
    label: 'Belum dibuka',
    bg: '#F1F5F9',
    fg: '#334155',
    border: '#CBD5E1',
  },
  dibuka: {
    symbol: '●',
    label: 'Sesi dibuka',
    bg: '#ECFDF5',
    fg: '#0F766E',
    border: '#99F6E4',
  },
  ditutup: {
    symbol: '■',
    label: 'Sesi ditutup',
    bg: '#FEF2F2',
    fg: '#B91C1C',
    border: '#FECACA',
  },
};

const ROW_STYLE_META: Record<
  ResolvedAttendanceStatus,
  { accent: string; pillBg: string; pillFg: string }
> = {
  hadir: { accent: '#0F766E', pillBg: '#ECFDF5', pillFg: '#0F766E' },
  terlambat: { accent: '#B45309', pillBg: '#FFFBEB', pillFg: '#B45309' },
  izin: { accent: '#1D4ED8', pillBg: '#EFF6FF', pillFg: '#1D4ED8' },
  belum_hadir: { accent: '#64748B', pillBg: '#F1F5F9', pillFg: '#475569' },
};

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

export type RekapKehadiranContentProps = {
  sessionId: string | null;
  classLabel?: string;
  onBackToSessions?: () => void;
};

/**
 * Panel isi rekap kehadiran yang dapat dipasang langsung di dalam `/asprak-sesi`
 * maupun dirender sebagai halaman penuh pada `/rekap?sessionId=<id>`.
 */
export function RekapKehadiranContent({
  sessionId,
  classLabel,
  onBackToSessions,
}: RekapKehadiranContentProps) {
  const recap = useSessionRecap(sessionId, Boolean(sessionId));
  const [statusFilter, setStatusFilter] = useState<RecapFilter>('semua');

  const filteredRows = useMemo(() => {
    if (statusFilter === 'semua') {
      return recap.rows;
    }
    return recap.rows.filter((row) => row.status === statusFilter);
  }, [recap.rows, statusFilter]);

  if (!sessionId) {
    return (
      <View style={styles.emptyPanel}>
        <Text style={styles.emptyTitle}>Pilih sesi untuk dipantau</Text>
        <Text style={styles.emptyBody}>
          Pilih salah satu sesi praktikum pada tab daftar sesi untuk memantau kehadiran,
          keterlambatan, dan status izin secara langsung.
        </Text>
        {onBackToSessions && (
          <Pressable
            accessibilityRole="button"
            style={styles.outlineButton}
            onPress={onBackToSessions}
          >
            <Text style={styles.outlineButtonText}>Pilih dari daftar sesi</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (recap.loading) {
    return (
      <View style={styles.loadingPanel}>
        <ActivityIndicator size="small" color="#1D4ED8" />
        <Text style={styles.loadingText}>Memuat buku rekap kehadiran sesi...</Text>
      </View>
    );
  }

  if (recap.error) {
    return (
      <View style={styles.errorPanel} accessibilityRole="alert">
        <Text style={styles.errorTitle}>Gagal memuat rekap kehadiran</Text>
        <Text style={styles.errorBody}>{recap.error}</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.outlineButton}
          onPress={recap.retry}
        >
          <Text style={styles.outlineButtonText}>Muat ulang rekap</Text>
        </Pressable>
      </View>
    );
  }

  if (!recap.session) {
    return (
      <View style={styles.emptyPanel}>
        <Text style={styles.emptyTitle}>Sesi tidak ditemukan</Text>
        <Text style={styles.emptyBody}>
          Data sesi praktikum ini tidak tersedia atau telah dihapus dari sistem.
        </Text>
        {onBackToSessions && (
          <Pressable
            accessibilityRole="button"
            style={styles.outlineButton}
            onPress={onBackToSessions}
          >
            <Text style={styles.outlineButtonText}>Kembali ke daftar sesi</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const { session, lab, summary } = recap;
  const sessionBadge = SESSION_BADGE[session.status];
  const resolvedClassLabel = classLabel || session.classId || '-';

  const filterItems: { value: RecapFilter; label: string }[] = [
    { value: 'semua', label: `Semua (${summary.total})` },
    { value: 'hadir', label: `✔ Hadir (${summary.hadir})` },
    { value: 'terlambat', label: `⏱ Terlambat (${summary.terlambat})` },
    { value: 'izin', label: `✎ Izin (${summary.izin})` },
    { value: 'belum_hadir', label: `○ Belum (${summary.belumHadir})` },
  ];

  return (
    <View style={styles.recapRoot}>
      {onBackToSessions && (
        <Pressable
          accessibilityRole="button"
          style={styles.backStrip}
          onPress={onBackToSessions}
        >
          <Text style={styles.backStripText}>‹ Kembali ke daftar sesi</Text>
        </Pressable>
      )}

      {/* Header Identitas Sesi & Kebijakan Toleransi Lab */}
      <View style={[styles.sessionLedgerHeader, { borderLeftColor: ROW_STYLE_META.izin.accent }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.sessionTitle}>{session.title}</Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: sessionBadge.bg,
                borderColor: sessionBadge.border,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: sessionBadge.fg }]}>
              {sessionBadge.symbol} {sessionBadge.label}
            </Text>
          </View>
        </View>

        <Text style={styles.sessionMeta}>
          Kelas {resolvedClassLabel} · {session.date} · {session.startTime}–{session.endTime}
        </Text>
        <Text style={styles.sessionMeta}>
          Laboratorium:{' '}
          {lab
            ? `${lab.name}${lab.mataKuliah ? ` (${lab.mataKuliah})` : ''}`
            : session.labId ?? 'Belum ditautkan'}
        </Text>

        <View style={styles.policyStrip}>
          <Text style={styles.policyHeading}>Aturan keterlambatan laboratorium</Text>
          <Text style={styles.policyText}>
            Batas toleransi (grace period):{' '}
            {recap.gracePeriodMinutes !== null
              ? `${recap.gracePeriodMinutes} menit sejak jam mulai (${session.startTime})`
              : 'Belum ditetapkan Aslab (toleransi 0 menit)'}
          </Text>
          <Text style={styles.policyText}>
            Nominal denda keterlambatan:{' '}
            {recap.lateFineAmount !== null
              ? formatRupiah(recap.lateFineAmount)
              : 'Belum ditetapkan Aslab'}
          </Text>
          <Text style={styles.policyNote}>
            Izin disetujui dicatat sebagai tidak hadir dengan izin (bebas denda, tidak menjadi
            hadir). Pembayaran denda tidak mengubah catatan keterlambatan.
          </Text>
        </View>
      </View>

      {/* Pita Ringkasan 4 Status Kehadiran */}
      <View style={styles.summaryGrid} accessibilityLabel="Ringkasan status kehadiran">
        <SummaryCell
          symbol="✔"
          label="Hadir"
          sub="Tepat waktu"
          count={summary.hadir}
          accent="#0F766E"
          bg="#ECFDF5"
        />
        <SummaryCell
          symbol="⏱"
          label="Terlambat"
          sub="Melewati toleransi"
          count={summary.terlambat}
          accent="#B45309"
          bg="#FFFBEB"
        />
        <SummaryCell
          symbol="✎"
          label="Izin"
          sub="Excused / bebas denda"
          count={summary.izin}
          accent="#1D4ED8"
          bg="#EFF6FF"
        />
        <SummaryCell
          symbol="○"
          label="Belum hadir"
          sub="Belum tercatat"
          count={summary.belumHadir}
          accent="#475569"
          bg="#F1F5F9"
        />
      </View>

      {/* Filter Status */}
      <View style={styles.filterWrap}>
        {filterItems.map((item) => {
          const active = statusFilter === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatusFilter(item.value)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Daftar Peserta */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeading}>
          Daftar praktikan ({filteredRows.length} dari {summary.total})
        </Text>
        <Text style={styles.rosterHint}>
          {recap.rosterSource === 'lab_members'
            ? 'Sumber: distribusi lab Aslab'
            : 'Sumber: daftar praktikan kelas'}
        </Text>
      </View>

      {summary.total === 0 ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>Belum ada peserta terdaftar</Text>
          <Text style={styles.emptyBody}>
            Belum ada praktikan yang ditempatkan pada laboratorium atau kelas sesi ini.
          </Text>
        </View>
      ) : filteredRows.length === 0 ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>Tidak ada praktikan pada filter ini</Text>
          <Text style={styles.emptyBody}>
            Pilih filter status lain untuk melihat seluruh catatan kehadiran sesi.
          </Text>
        </View>
      ) : (
        <View style={styles.ledgerList}>
          {filteredRows.map((row) => (
            <RecapStudentRow key={row.uid} row={row} />
          ))}
        </View>
      )}
    </View>
  );
}

function SummaryCell({
  symbol,
  label,
  sub,
  count,
  accent,
  bg,
}: {
  symbol: string;
  label: string;
  sub: string;
  count: number;
  accent: string;
  bg: string;
}) {
  return (
    <View style={[styles.summaryCell, { backgroundColor: bg, borderColor: '#DCE3EC' }]}>
      <Text style={[styles.summaryCount, { color: accent }]}>{count}</Text>
      <Text style={[styles.summaryLabel, { color: accent }]}>
        {symbol} {label}
      </Text>
      <Text style={styles.summarySub}>{sub}</Text>
    </View>
  );
}

function RecapStudentRow({ row }: { row: SessionRecapRow }) {
  const presentation = describeAttendanceStatus(row.status, row.lateMinutes);
  const styleMeta = ROW_STYLE_META[row.status];

  return (
    <View style={[styles.studentRow, { borderLeftColor: styleMeta.accent }]}>
      <View style={styles.studentTop}>
        <View style={styles.studentNameWrap}>
          <Text style={styles.studentName}>{row.name}</Text>
          {row.classId ? <Text style={styles.studentClass}>Kelas {row.classId}</Text> : null}
        </View>
        <View style={[styles.rowStatusPill, { backgroundColor: styleMeta.pillBg }]}>
          <Text style={[styles.rowStatusText, { color: styleMeta.pillFg }]}>
            {presentation.recapLabel}
          </Text>
        </View>
      </View>

      {row.status === 'hadir' && (
        <Text style={styles.studentDetail}>
          Waktu presensi: pukul {formatClock(row.attendedAt)}
          {typeof row.distanceMeters === 'number'
            ? ` · Jarak GPS ${Math.round(row.distanceMeters)} m`
            : ''}
        </Text>
      )}

      {row.status === 'terlambat' && (
        <View style={styles.detailStack}>
          <Text style={styles.studentDetail}>
            Waktu presensi: pukul {formatClock(row.attendedAt)} (melewati batas toleransi +
            {row.lateMinutes} menit)
            {typeof row.distanceMeters === 'number'
              ? ` · Jarak GPS ${Math.round(row.distanceMeters)} m`
              : ''}
          </Text>
          {row.fine ? (
            <Text style={styles.fineMeta}>
              Tagihan denda: {formatRupiah(row.fine.amount)} ·{' '}
              {formatFineStatusLabel(row.fine.status)}
            </Text>
          ) : (
            <Text style={styles.fineMetaMuted}>
              Status presensi terlambat tercatat di server (data tidak diubah oleh Asprak).
            </Text>
          )}
        </View>
      )}

      {row.status === 'izin' && (
        <View style={styles.detailStack}>
          <Text style={styles.studentDetail}>
            Tidak hadir dengan izin disetujui — dibebaskan dari denda keterlambatan.
          </Text>
          {row.permissionReason ? (
            <Text style={styles.reasonQuote}>Alasan: &quot;{row.permissionReason}&quot;</Text>
          ) : null}
        </View>
      )}

      {row.status === 'belum_hadir' && (
        <Text style={styles.studentDetailMuted}>
          Belum tercatat presensi maupun izin disetujui pada sesi ini.
        </Text>
      )}
    </View>
  );
}

/**
 * Layar penuh `/rekap?sessionId=<id>` untuk Asprak.
 */
export default function RekapKehadiranScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = firstParam(params.sessionId);

  if (!user) {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <View style={styles.guardBox}>
          <Text style={styles.emptyTitle}>Silakan login terlebih dahulu</Text>
          <Text style={styles.emptyBody}>
            Halaman rekap kehadiran praktikum memerlukan akun Asprak yang aktif.
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
            Rekap kehadiran per sesi hanya dapat dibuka oleh Asprak penanggung jawab.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <UserHeader />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.pageTitle}>Rekap Kehadiran Praktikum</Text>
        <Text style={styles.pageSubtitle}>
          Pemantauan kehadiran tepat waktu, keterlambatan, dan izin praktikan secara langsung.
        </Text>
        <RekapKehadiranContent sessionId={sessionId} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  guardBox: {
    padding: 20,
    gap: 8,
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
  recapRoot: {
    gap: 12,
  },
  backStrip: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  backStripText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  sessionLedgerHeader: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  sessionMeta: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  policyStrip: {
    marginTop: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
  },
  policyHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  policyText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  policyNote: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCell: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 145,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  summarySub: {
    fontSize: 11,
    color: '#64748B',
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  listHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  rosterHint: {
    fontSize: 12,
    color: '#64748B',
  },
  ledgerList: {
    gap: 8,
  },
  studentRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 12,
    gap: 5,
  },
  studentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  studentNameWrap: {
    flexShrink: 1,
    gap: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentClass: {
    fontSize: 12,
    color: '#64748B',
  },
  rowStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rowStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailStack: {
    gap: 3,
  },
  studentDetail: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  studentDetailMuted: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  fineMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 17,
  },
  fineMetaMuted: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  reasonQuote: {
    fontSize: 12,
    color: '#1E3A8A',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    lineHeight: 17,
  },
  loadingPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#334155',
  },
  emptyPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    padding: 16,
    gap: 8,
    alignItems: 'flex-start',
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
  errorPanel: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
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
});
