/**
 * /laboratorium → bagian "Aktivitas Lab" — Sprint 3, SRS-05 (Mischa).
 *
 * Menampilkan praktikum yang sedang berlangsung dan sesi berikutnya pada
 * satu laboratorium, secara realtime dari Firestore (sesi/jadwal yang
 * sudah ada — tidak ada sumber data baru). Definisi yang disepakati:
 * - Berlangsung  : sesi ber-status `dibuka` pada lab ini.
 * - Berikutnya   : sesi `belum_dibuka` dengan tanggal terdekat
 *   (>= hari ini, zona Asia/Jakarta). Sesi `ditutup` tidak termasuk.
 *
 * Komponen ini memakai `useLabActivity` (hook Mischa). Pemakaian lintas
 * modul (Maps milik Moses) memakai `subscribeLabActivity` di
 * `src/services/laboratorium.ts`.
 */
import { Card, EmptyBox, ErrorBox, LoadingBox, Section, StatusBadge, formatRange, styles as ui } from '@/features/asisten-ui';
import { useLabActivity } from '@/hooks/use-laboratorium';
import type { LabActivitySession } from '@/services/laboratorium';
import { Text, View } from 'react-native';

/** Kartu satu item aktivitas (kelas, praktikum, waktu, status). */
function ActivityItem({ item }: { item: LabActivitySession }) {
  return (
    <Card>
      <Text style={ui.cardTitle}>{item.title}</Text>
      <Text style={ui.line}>Kelas: {item.className}</Text>
      <Text style={ui.line}>
        Tanggal: {item.date} · {formatRange(item.startTime, item.endTime)}
      </Text>
      <StatusBadge status={item.status} />
    </Card>
  );
}

export function LabAktivitas({ labId }: { labId: string | null }) {
  const { activity, loading, error, retry } = useLabActivity(labId);

  if (!labId) {
    return null;
  }

  if (loading) {
    return (
      <Section title="Aktivitas laboratorium">
        <LoadingBox text="Memuat aktivitas lab…" />
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Aktivitas laboratorium">
        <ErrorBox message={error} onRetry={retry} />
      </Section>
    );
  }

  return (
    <>
      <Section title={`Sedang berlangsung (${activity?.berlangsung.length ?? 0})`}>
        {activity && activity.berlangsung.length > 0 ? (
          <View style={{ gap: 8 }}>
            {activity.berlangsung.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </View>
        ) : (
          <EmptyBox text="Tidak ada praktikum yang sedang berlangsung di lab ini." />
        )}
      </Section>

      <Section title="Sesi berikutnya">
        {activity?.berikutnya ? (
          <ActivityItem item={activity.berikutnya} />
        ) : (
          <EmptyBox text='Belum ada sesi berikutnya di lab ini (tidak ada sesi "Belum dibuka" dengan tanggal hari ini atau setelahnya).' />
        )}
      </Section>
    </>
  );
}

/** Label definisi untuk ditampilkan di layar (transparansi definisi). */
export const ACTIVITY_DEFINITION_NOTE =
  'Berlangsung = sesi ber-status "Dibuka". Berikutnya = sesi terdekat ber-status "Belum dibuka" (zona waktu Asia/Jakarta).';
