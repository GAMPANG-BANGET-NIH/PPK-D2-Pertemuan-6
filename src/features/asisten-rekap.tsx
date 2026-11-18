/**
 * /rekap?sessionId= — rekap presensi realtime per sesi.
 * Menggabungkan: attendance sesi + praktikan kelas sesi + izin disetujui.
 * Fitur B Sprint 2 (Mischa).
 */
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Card,
  EmptyBox,
  ErrorBox,
  LoadingBox,
  Screen,
  Section,
  StatusBadge,
  firstParam,
  formatClock,
  formatRange,
  styles as ui,
} from '@/features/asisten-ui';
import {
  useApprovedPermissions,
  useAttendance,
  useClasses,
  usePraktikanByClass,
  useSessions,
} from '@/hooks/use-praktikum';

type RecapStatus = 'hadir' | 'izin' | 'belum';
type RecapRow = { uid: string; name: string; status: RecapStatus; time: string | null };

const STATUS_TEXT: Record<RecapStatus, string> = {
  hadir: '✔ Hadir',
  izin: '✎ Izin',
  belum: '✖ Belum hadir',
};

export default function RekapScreen() {
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = firstParam(params.sessionId)?.trim() || null;

  const sessions = useSessions(null);
  const classes = useClasses();
  const session = sessions.data.find((s) => s.id === sessionId) ?? null;
  const classId = session?.classId ?? null;

  // Hanya berlangganan data sesi setelah sesinya ditemukan.
  const attendance = useAttendance(session ? session.id : null);
  const permissions = useApprovedPermissions(session ? session.id : null);
  const praktikan = usePraktikanByClass(classId, !!session);

  const className = classes.data.find((c) => c.id === classId)?.name ?? classId ?? '-';

  const rows = useMemo<RecapRow[]>(() => {
    const attMap = new Map(attendance.data.map((a) => [a.uid, a]));
    const izinUids = new Set(permissions.data.map((p) => p.uid));
    return praktikan.data.map((p) => {
      const att = attMap.get(p.uid);
      if (att) {
        return { uid: p.uid, name: p.name, status: 'hadir', time: formatClock(att.attendedAt) };
      }
      if (izinUids.has(p.uid)) {
        return { uid: p.uid, name: p.name, status: 'izin', time: null };
      }
      return { uid: p.uid, name: p.name, status: 'belum', time: null };
    });
  }, [attendance.data, permissions.data, praktikan.data]);

  const count = (s: RecapStatus) => rows.filter((r) => r.status === s).length;

  const loading =
    sessions.loading ||
    classes.loading ||
    (!!session && (attendance.loading || permissions.loading || praktikan.loading));
  const error =
    sessions.error ?? classes.error ?? attendance.error ?? permissions.error ?? praktikan.error;
  const retry = () => {
    sessions.retry();
    classes.retry();
    attendance.retry();
    permissions.retry();
    praktikan.retry();
  };

  let body;
  if (!sessionId) {
    body = <EmptyBox text="Sesi belum dipilih. Buka rekap dari daftar sesi di halaman Asisten." />;
  } else if (loading) {
    body = <LoadingBox text="Memuat rekap…" />;
  } else if (error) {
    body = <ErrorBox message={error} onRetry={retry} />;
  } else if (!session) {
    body = <EmptyBox text="Sesi tidak ditemukan. Mungkin sudah dihapus." />;
  } else {
    body = (
      <>
        <Card>
          <Text style={ui.cardTitle}>{session.title}</Text>
          <Text style={ui.line}>
            {className} · {session.date} · {formatRange(session.startTime, session.endTime)}
          </Text>
          <View style={ui.row}>
            <Text style={ui.line}>Status:</Text>
            <StatusBadge status={session.status} />
          </View>
        </Card>

        <Section title="Ringkasan">
          <View style={local.summary} accessibilityLabel="Ringkasan rekap">
            <SummaryBox label="Hadir" value={count('hadir')} />
            <SummaryBox label="Izin" value={count('izin')} />
            <SummaryBox label="Belum hadir" value={count('belum')} />
            <SummaryBox label="Total" value={rows.length} />
          </View>
        </Section>

        <Section title="Daftar praktikan">
          {rows.length === 0 ? (
            <EmptyBox text="Belum ada praktikan di kelas ini." />
          ) : (
            rows.map((r) => (
              <View key={r.uid} style={local.row}>
                <Text style={ui.cardTitle}>{r.name}</Text>
                <Text style={ui.line}>
                  {STATUS_TEXT[r.status]}
                  {r.status === 'hadir' ? ` · pukul ${r.time}` : ''}
                </Text>
              </View>
            ))
          )}
        </Section>
      </>
    );
  }

  return (
    <Screen
      title="Rekap Presensi"
      subtitle="Berubah otomatis saat praktikan presensi atau izin disetujui.">
      {body}
    </Screen>
  );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={local.summaryBox}>
      <Text style={local.summaryValue}>{value}</Text>
      <Text style={ui.meta}>{label}</Text>
    </View>
  );
}

const local = StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryBox: {
    flexGrow: 1,
    flexBasis: 70,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5DAE0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  summaryValue: { fontSize: 22, fontWeight: '700', color: '#1B1F24' },
  row: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DAE0',
    gap: 2,
  },
});
