/**
 * /asisten — daftar sesi realtime (Firestore), filter kelas/status, detail,
 * buka/tutup sesi dengan modal konfirmasi, dan tautan ke Rekap/Kelola/
 * Pindah Kelas/Review Izin. Fitur B Sprint 2 (Mischa).
 */
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmModal,
  EmptyBox,
  ErrorBox,
  LoadingBox,
  Notice,
  STATUS_LABELS,
  Screen,
  Section,
  StatusBadge,
  firstParam,
  formatClock,
  formatRange,
  navigate,
  styles as ui,
} from '@/features/asisten-ui';
import {
  useClasses,
  useSessions,
  useWriteAction,
} from '@/hooks/use-praktikum';
import { closeSession, openSession } from '@/services/praktikum';
import type { Session, SessionStatus } from '@/types';

type StatusFilter = 'semua' | SessionStatus;
type Pending = { session: Session; to: 'dibuka' | 'ditutup' };

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'semua', label: 'Semua status' },
  { value: 'belum_dibuka', label: STATUS_LABELS.belum_dibuka },
  { value: 'dibuka', label: STATUS_LABELS.dibuka },
  { value: 'ditutup', label: STATUS_LABELS.ditutup },
];

// Transisi yang diizinkan: belum_dibuka → dibuka → ditutup. Ditutup final.
const NEXT_STATUS: Record<SessionStatus, 'dibuka' | 'ditutup' | null> = {
  belum_dibuka: 'dibuka',
  dibuka: 'ditutup',
  ditutup: null,
};

export default function AsistenScreen() {
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const classes = useClasses();
  const sessions = useSessions(null);
  const { busy, run } = useWriteAction();

  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua');
  // Parameter hanya pilihan awal.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => firstParam(params.sessionId) ?? null,
  );
  const [pending, setPending] = useState<Pending | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const classNames = useMemo(
    () => new Map(classes.data.map((c) => [c.id, c.name])),
    [classes.data],
  );
  const className = (id: string) => classNames.get(id) ?? id;

  const filtered = useMemo(
    () =>
      sessions.data.filter(
        (s) =>
          (classFilter === null || s.classId === classFilter) &&
          (statusFilter === 'semua' || s.status === statusFilter),
      ),
    [sessions.data, classFilter, statusFilter],
  );

  const selected = filtered.find((s) => s.id === selectedId) ?? null;
  // Sesi terpilih selalu mengikuti data realtime terbaru.
  const pendingLive = pending
    ? (sessions.data.find((s) => s.id === pending.session.id) ?? null)
    : null;

  const requestChange = (session: Session) => {
    const to = NEXT_STATUS[session.status];
    if (!to) {
      return;
    }
    setNotice(null);
    setModalError(null);
    setPending({ session, to });
  };

  const cancelChange = () => {
    // Batal tidak mengubah data.
    setPending(null);
    setModalError(null);
  };

  const confirmChange = async () => {
    if (!pending) {
      return;
    }
    const { session, to } = pending;
    const result = await run(() =>
      to === 'dibuka' ? openSession(session.id) : closeSession(session.id),
    );
    if (!result.ok) {
      setModalError(result.message);
      return;
    }
    setPending(null);
    setModalError(null);
    setNotice(
      `Sesi "${session.title}" (${className(session.classId)}) sekarang ${STATUS_LABELS[to]}.`,
    );
  };

  const loading = sessions.loading || classes.loading;
  const loadError = sessions.error ?? classes.error;
  const retry = () => {
    sessions.retry();
    classes.retry();
  };

  return (
    <Screen
      title="Pengelolaan Sesi"
      subtitle="Data sesi tersinkron realtime dari Firestore.">
      <Section title="Menu Asprak">
        <View style={ui.chipRow}>
          <View style={local.menuItem}>
            <Button label="Kelola" onPress={() => navigate('/kelola')} />
          </View>
          <View style={local.menuItem}>
            <Button label="Pindah Kelas" onPress={() => navigate('/pindah-kelas')} />
          </View>
          <View style={local.menuItem}>
            <Button label="Review Izin" onPress={() => navigate('/asisten-izin')} />
          </View>
        </View>
      </Section>

      <Notice message={notice} />

      <Section title="Filter">
        <Text style={ui.meta}>Kelas</Text>
        <ChipRow>
          <Chip
            label="Semua kelas"
            selected={classFilter === null}
            onPress={() => setClassFilter(null)}
          />
          {classes.data.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={classFilter === c.id}
              onPress={() => setClassFilter(c.id)}
            />
          ))}
        </ChipRow>
        <Text style={ui.meta}>Status</Text>
        <ChipRow>
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              selected={statusFilter === f.value}
              onPress={() => setStatusFilter(f.value)}
            />
          ))}
        </ChipRow>
      </Section>

      <Section title={`Daftar sesi (${filtered.length})`}>
        {loading ? (
          <LoadingBox text="Memuat sesi…" />
        ) : loadError ? (
          <ErrorBox message={loadError} onRetry={retry} />
        ) : sessions.data.length === 0 ? (
          <EmptyBox text="Belum ada sesi. Buat sesi baru di menu Kelola." />
        ) : filtered.length === 0 ? (
          <EmptyBox text="Tidak ada sesi yang cocok dengan filter. Ubah filter kelas atau status." />
        ) : (
          filtered.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`Pilih sesi ${s.title}, kelas ${className(s.classId)}, ${STATUS_LABELS[s.status]}`}
              accessibilityState={{ selected: s.id === selectedId }}
              onPress={() => {
                setSelectedId(s.id);
                setNotice(null);
              }}
              style={[local.option, s.id === selectedId && local.optionSelected]}>
              <Text style={ui.cardTitle}>{s.title}</Text>
              <Text style={ui.meta}>
                {className(s.classId)} · {s.date} · {formatRange(s.startTime, s.endTime)}
              </Text>
              <StatusBadge status={s.status} />
            </Pressable>
          ))
        )}
      </Section>

      {!loading && !loadError && sessions.data.length > 0 ? (
        <Section title="Detail sesi">
          {selected ? (
            <Card>
              <Text style={ui.cardTitle}>{selected.title}</Text>
              <Text style={ui.line}>Kelas: {className(selected.classId)}</Text>
              <Text style={ui.line}>Tanggal: {selected.date}</Text>
              <Text style={ui.line}>
                Waktu: {formatRange(selected.startTime, selected.endTime)}
              </Text>
              <View style={ui.row}>
                <Text style={ui.line}>Status:</Text>
                <StatusBadge status={selected.status} />
              </View>
              {selected.openedAt ? (
                <Text style={ui.meta}>
                  Dibuka pukul {formatClock(selected.openedAt)}
                </Text>
              ) : null}
              {selected.closedAt ? (
                <Text style={ui.meta}>
                  Ditutup pukul {formatClock(selected.closedAt)}
                </Text>
              ) : null}

              {NEXT_STATUS[selected.status] ? (
                <Button
                  label={
                    selected.status === 'belum_dibuka' ? 'Buka sesi' : 'Tutup sesi'
                  }
                  variant={selected.status === 'dibuka' ? 'danger' : 'primary'}
                  onPress={() => requestChange(selected)}
                />
              ) : (
                <Text style={ui.meta}>
                  Sesi sudah ditutup dan tidak dapat dibuka kembali.
                </Text>
              )}
              <Button
                label="Lihat rekap"
                variant="secondary"
                onPress={() => navigate(`/rekap?sessionId=${selected.id}`)}
              />
            </Card>
          ) : (
            <EmptyBox text="Pilih sesi dari daftar untuk melihat detail." />
          )}
        </Section>
      ) : null}

      <ConfirmModal
        visible={pending !== null}
        title={pending?.to === 'dibuka' ? 'Buka sesi?' : 'Tutup sesi?'}
        message={
          pending
            ? pending.to === 'dibuka'
              ? `Sesi "${pending.session.title}" (${className(pending.session.classId)}) akan dibuka. Praktikan kelas tersebut dapat melakukan presensi.`
              : `Sesi "${pending.session.title}" (${className(pending.session.classId)}) akan ditutup dan tidak dapat dibuka kembali.`
            : ''
        }
        confirmLabel={pending?.to === 'dibuka' ? 'Ya, buka sesi' : 'Ya, tutup sesi'}
        danger={pending?.to === 'ditutup'}
        busy={busy}
        error={
          modalError ??
          (pending && pendingLive && pendingLive.status !== pending.session.status
            ? `Status sesi sudah berubah menjadi "${STATUS_LABELS[pendingLive.status]}". Tutup dialog ini dan periksa kembali.`
            : null)
        }
        onConfirm={confirmChange}
        onCancel={cancelChange}
      />
    </Screen>
  );
}

const local = StyleSheet.create({
  menuItem: { flexGrow: 1, flexBasis: 140 },
  option: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8BFC7',
    backgroundColor: '#FFFFFF',
    gap: 4,
    minHeight: 48,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: '#1F4FD8',
    backgroundColor: '#E8EEFF',
  },
});
