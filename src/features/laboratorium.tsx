/**
 * /laboratorium — pengelolaan laboratorium oleh asprak (Sprint 3, SRS-03,
 * Mischa) + detail aktivitas lab realtime (SRS-05) + panel relasi lab
 * ke jadwal/sesi yang sudah ada.
 *
 * - CRUD lab: nama, latitude, longitude, radius (meter), status aktif.
 *   Validasi di UI (umpan balik cepat) dan diulang di service.
 * - Nonaktifkan lab lebih aman daripada hapus; hapus ditolak bila masih
 *   dirujuk jadwal/sesi.
 * - Detail lab menampilkan aktivitas (berlangsung/berikutnya) realtime.
 * - Panel relasi: hubungkan/lepas lab pada sesi dan jadwal.
 */
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmModal,
  EmptyBox,
  ErrorBox,
  Field,
  FormError,
  LoadingBox,
  Notice,
  Screen,
  Section,
  StatusBadge,
  Tag,
  dayName,
  formatRange,
  styles as ui,
} from '@/features/asisten-ui';
import { ACTIVITY_DEFINITION_NOTE, LabAktivitas } from '@/features/aktivitas-lab';
import { useAuth } from '@/context/auth-context';
import {
  useLaboratories,
  useSchedulesWithLab,
  useSessionsWithLab,
  useWriteAction,
} from '@/hooks/use-laboratorium';
import { useClasses } from '@/hooks/use-praktikum';
import {
  activateLaboratory,
  createLaboratory,
  deactivateLaboratory,
  deleteLaboratory,
  setScheduleLab,
  setSessionLab,
  updateLaboratory,
} from '@/services/laboratorium';
import type { Laboratorium } from '@/services/laboratorium';

type Filter = 'semua' | 'aktif' | 'nonaktif';
type ConfirmTarget = { lab: Laboratorium; action: 'nonaktifkan' | 'aktifkan' | 'hapus' };

function formatCoord(value: number): string {
  return String(Number(value.toFixed(6)));
}

export default function LaboratoriumScreen() {
  const { user } = useAuth();
  const labs = useLaboratories();
  const classes = useClasses();

  const [filter, setFilter] = useState<Filter>('semua');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Laboratorium | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const filtered = useMemo(
    () =>
      labs.data.filter((lab) =>
        filter === 'semua'
          ? true
          : filter === 'aktif'
            ? lab.active
            : !lab.active,
      ),
    [labs.data, filter],
  );

  const labNames = useMemo(
    () => new Map(labs.data.map((l) => [l.id, l.name])),
    [labs.data],
  );
  const classNames = useMemo(
    () => new Map(classes.data.map((c) => [c.id, c.name])),
    [classes.data],
  );

  // Penjaga tambahan di sisi layar (setelah semua hook terpasang);
  // penegakan utama tetap Security Rules.
  if (user && user.role !== 'asprak') {
    return (
      <Screen
        title="Laboratorium"
        subtitle="Pengelolaan laboratorium hanya untuk asisten praktikum.">
        <EmptyBox text="Halaman ini khusus asprak. Gunakan menu praktikan untuk fitur Anda." />
      </Screen>
    );
  }

  const selected = labs.data.find((l) => l.id === selectedId) ?? null;

  const loading = labs.loading;
  const error = labs.error;
  const retry = () => labs.retry();

  const askConfirm = (lab: Laboratorium, action: ConfirmTarget['action']) => {
    setNotice(null);
    setConfirmTarget({ lab, action });
  };

  return (
    <Screen
      title="Laboratorium"
      subtitle="Kelola lokasi dan radius laboratorium untuk presensi berbasis lokasi.">
      <Section title="Filter">
        <ChipRow>
          <Chip label="Semua" selected={filter === 'semua'} onPress={() => setFilter('semua')} />
          <Chip label="Aktif" selected={filter === 'aktif'} onPress={() => setFilter('aktif')} />
          <Chip label="Nonaktif" selected={filter === 'nonaktif'} onPress={() => setFilter('nonaktif')} />
        </ChipRow>
      </Section>

      <LabForm
        key={editing?.id ?? 'baru'}
        initial={editing}
        onDone={(message) => {
          setNotice(message);
          setEditing(null);
        }}
      />

      <Notice message={notice} />

      <Section title={`Daftar laboratorium (${filtered.length})`}>
        {loading ? (
          <LoadingBox text="Memuat laboratorium…" />
        ) : error ? (
          <ErrorBox message={error} onRetry={retry} />
        ) : labs.data.length === 0 ? (
          <EmptyBox text="Belum ada laboratorium. Tambahkan lab pertama pada formulir di atas." />
        ) : filtered.length === 0 ? (
          <EmptyBox text="Tidak ada lab yang cocok dengan filter." />
        ) : (
          filtered.map((lab) => (
            <Card key={lab.id}>
              <View style={ui.rowBetween}>
                <Text style={ui.cardTitle}>{lab.name}</Text>
                <Tag text={lab.active ? 'Aktif' : 'Nonaktif'} />
              </View>
              <Text style={ui.line}>
                Koordinat: {formatCoord(lab.latitude)}, {formatCoord(lab.longitude)}
              </Text>
              <Text style={ui.line}>Radius: {lab.radiusMeters} meter</Text>
              <View style={ui.row}>
                <Button
                  label={selectedId === lab.id ? 'Tutup detail' : 'Detail'}
                  variant="secondary"
                  accessibilityLabel={`Lihat detail laboratorium ${lab.name}`}
                  onPress={() => {
                    setSelectedId(selectedId === lab.id ? null : lab.id);
                    setNotice(null);
                  }}
                />
                <Button
                  label="Ubah"
                  variant="secondary"
                  accessibilityLabel={`Ubah laboratorium ${lab.name}`}
                  onPress={() => {
                    setEditing(lab);
                    setSelectedId(null);
                    setNotice(null);
                  }}
                />
                <Button
                  label={lab.active ? 'Nonaktifkan' : 'Aktifkan'}
                  variant="secondary"
                  accessibilityLabel={`${lab.active ? 'Nonaktifkan' : 'Aktifkan'} laboratorium ${lab.name}`}
                  onPress={() =>
                    askConfirm(lab, lab.active ? 'nonaktifkan' : 'aktifkan')
                  }
                />
                <Button
                  label="Hapus"
                  variant="danger"
                  accessibilityLabel={`Hapus laboratorium ${lab.name}`}
                  onPress={() => askConfirm(lab, 'hapus')}
                />
              </View>
            </Card>
          ))
        )}
      </Section>

      {selected ? (
        <Section title="Detail laboratorium">
          <Card>
            <Text style={ui.cardTitle}>{selected.name}</Text>
            <Text style={ui.line}>
              Koordinat: {formatCoord(selected.latitude)}, {formatCoord(selected.longitude)}
            </Text>
            <Text style={ui.line}>Radius: {selected.radiusMeters} meter</Text>
            <View style={ui.row}>
              <Text style={ui.line}>Status:</Text>
              <Tag text={selected.active ? 'Aktif' : 'Nonaktif'} />
            </View>
            <Text style={ui.meta}>{ACTIVITY_DEFINITION_NOTE}</Text>
          </Card>
        </Section>
      ) : null}

      {selected ? <LabAktivitas labId={selected.id} /> : null}

      {selected ? (
        <LabRelationPanel lab={selected} labNames={labNames} classNames={classNames} />
      ) : null}

      <ConfirmFlow
        target={confirmTarget}
        onDone={(message) => {
          setNotice(message);
          setConfirmTarget(null);
        }}
      />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Formulir tambah/ubah lab                                            */
/* ------------------------------------------------------------------ */

function LabForm({
  initial,
  onDone,
}: {
  initial: Laboratorium | null;
  onDone: (message: string) => void;
}) {
  const { busy, run } = useWriteAction();
  const [name, setName] = useState(initial?.name ?? '');
  const [latitude, setLatitude] = useState(
    initial ? formatCoord(initial.latitude) : '',
  );
  const [longitude, setLongitude] = useState(
    initial ? formatCoord(initial.longitude) : '',
  );
  const [radius, setRadius] = useState(initial ? String(initial.radiusMeters) : '');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsedLat = Number(latitude.trim().replace(',', '.'));
    const parsedLon = Number(longitude.trim().replace(',', '.'));
    const parsedRadius = Number(radius.trim().replace(',', '.'));
    const input = {
      name,
      latitude: parsedLat,
      longitude: parsedLon,
      radiusMeters: parsedRadius,
    };

    // Validasi format angka sebelum masuk service.
    if (!/^[+-]?\d+([.,]\d+)?$/.test(latitude.trim())) {
      setError('Latitude harus berupa angka (contoh: -6.89155).');
      return;
    }
    if (!/^[+-]?\d+([.,]\d+)?$/.test(longitude.trim())) {
      setError('Longitude harus berupa angka (contoh: 107.6103).');
      return;
    }
    if (!/^[+-]?\d+([.,]\d+)?$/.test(radius.trim())) {
      setError('Radius harus berupa angka dalam meter (contoh: 50).');
      return;
    }

    const result = await run(() =>
      initial
        ? updateLaboratory(initial.id, input)
        : createLaboratory(input),
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onDone(
      initial
        ? `Laboratorium "${input.name.trim()}" diperbarui.`
        : `Laboratorium "${input.name.trim()}" ditambahkan.`,
    );
    setName('');
    setLatitude('');
    setLongitude('');
    setRadius('');
  };

  return (
    <Section title={initial ? `Ubah laboratorium "${initial.name}"` : 'Tambah laboratorium'}>
      <Card>
        <Field
          label="Nama laboratorium"
          value={name}
          onChangeText={setName}
          placeholder="Contoh: Lab Pemrograman 1"
          maxLength={60}
        />
        <Field
          label="Latitude"
          value={latitude}
          onChangeText={setLatitude}
          placeholder="Contoh: -6.89155"
          hint="Angka antara -90 dan 90"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Longitude"
          value={longitude}
          onChangeText={setLongitude}
          placeholder="Contoh: 107.6103"
          hint="Angka antara -180 dan 180"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Radius (meter)"
          value={radius}
          onChangeText={setRadius}
          placeholder="Contoh: 50"
          hint="Angka lebih dari 0 meter, maksimum 500 meter"
          keyboardType="numbers-and-punctuation"
        />
        <FormError message={error} />
        <Button
          label={initial ? 'Simpan perubahan' : 'Tambah laboratorium'}
          loading={busy}
          onPress={submit}
        />
      </Card>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Konfirmasi nonaktifkan / aktifkan / hapus                            */
/* ------------------------------------------------------------------ */

function ConfirmFlow({
  target,
  onDone,
}: {
  target: ConfirmTarget | null;
  onDone: (message: string) => void;
}) {
  const { busy, run } = useWriteAction();
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!target) {
      return;
    }
    const { lab, action } = target;
    const result = await run(() => {
      if (action === 'nonaktifkan') return deactivateLaboratory(lab.id);
      if (action === 'aktifkan') return activateLaboratory(lab.id);
      return deleteLaboratory(lab.id);
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onDone(
      action === 'hapus'
        ? `Laboratorium "${lab.name}" dihapus.`
        : action === 'nonaktifkan'
          ? `Laboratorium "${lab.name}" dinonaktifkan (data tidak dihapus).`
          : `Laboratorium "${lab.name}" diaktifkan kembali.`,
    );
  };

  const isDelete = target?.action === 'hapus';
  const isDeactivate = target?.action === 'nonaktifkan';

  return (
    <ConfirmModal
      visible={target !== null}
      title={
        isDelete
          ? 'Hapus laboratorium?'
          : isDeactivate
            ? 'Nonaktifkan laboratorium?'
            : 'Aktifkan laboratorium?'
      }
      message={
        target
          ? isDelete
            ? `Laboratorium "${target.lab.name}" akan dihapus permanen. Penghapusan ditolak bila masih dipakai jadwal atau sesi.`
            : isDeactivate
              ? `Laboratorium "${target.lab.name}" akan ditandai nonaktif. Data tidak dihapus; sesi/jadwal tetap terhubung dan bisa diaktifkan kembali.`
              : `Laboratorium "${target.lab.name}" akan digunakan kembali untuk presensi berbasis lokasi.`
          : ''
      }
      confirmLabel={
        isDelete ? 'Ya, hapus' : isDeactivate ? 'Ya, nonaktifkan' : 'Ya, aktifkan'
      }
      danger={isDelete}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => {
        // Batal tidak mengubah data.
        setError(null);
        onDone(''); // menutup target
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Panel relasi lab <-> sesi / jadwal                                  */
/* ------------------------------------------------------------------ */

function LabRelationPanel({
  lab,
  labNames,
  classNames,
}: {
  lab: Laboratorium;
  labNames: Map<string, string>;
  classNames: Map<string, string>;
}) {
  const [tab, setTab] = useState<'sesi' | 'jadwal'>('sesi');
  const sessions = useSessionsWithLab();
  const schedules = useSchedulesWithLab();
  const { busy, run } = useWriteAction();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const labTag = (labId: string | null): string => {
    if (labId === null) return 'Tanpa lab';
    if (labId === lab.id) return 'Lab ini';
    return `Lab: ${labNames.get(labId) ?? labId}`;
  };

  const linkSession = async (sessionId: string, target: string | null) => {
    const result = await run(() => setSessionLab(sessionId, target));
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setNotice(
      target === null
        ? 'Sesi dilepas dari laboratorium ini.'
        : 'Sesi dihubungkan ke laboratorium ini.',
    );
  };

  const linkSchedule = async (scheduleId: string, target: string | null) => {
    const result = await run(() => setScheduleLab(scheduleId, target));
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setNotice(
      target === null
        ? 'Jadwal dilepas dari laboratorium ini.'
        : 'Jadwal dihubungkan ke laboratorium ini.',
    );
  };

  const loading = sessions.loading || schedules.loading;
  const listError = sessions.error ?? schedules.error;

  return (
    <Section title={`Relasi lab "${lab.name}" dengan jadwal & sesi`}>
      <ChipRow>
        <Chip label="Sesi" selected={tab === 'sesi'} onPress={() => setTab('sesi')} />
        <Chip label="Jadwal" selected={tab === 'jadwal'} onPress={() => setTab('jadwal')} />
      </ChipRow>
      <Notice message={notice} />
      <FormError message={error} />

      {loading ? (
        <LoadingBox text="Memuat data relasi…" />
      ) : listError ? (
        <ErrorBox
          message={listError}
          onRetry={() => {
            sessions.retry();
            schedules.retry();
          }}
        />
      ) : tab === 'sesi' ? (
        sessions.data.length === 0 ? (
          <EmptyBox text="Belum ada sesi. Buat sesi di menu Kelola." />
        ) : (
          <View style={{ gap: 8 }}>
            {sessions.data.map((s) => (
              <Card key={s.id}>
                <Text style={ui.cardTitle}>{s.title}</Text>
                <Text style={ui.line}>
                  {classNames.get(s.classId) ?? s.classId} · {s.date} ·{' '}
                  {formatRange(s.startTime, s.endTime)}
                </Text>
                <View style={ui.row}>
                  <StatusBadge status={s.status} />
                  <Tag text={labTag(s.labId)} />
                </View>
                <View style={ui.row}>
                  {s.labId === lab.id ? (
                    <Button
                      label="Lepas dari lab ini"
                      variant="secondary"
                      disabled={busy}
                      accessibilityLabel={`Lepas sesi ${s.title} dari laboratorium ${lab.name}`}
                      onPress={() => linkSession(s.id, null)}
                    />
                  ) : (
                    <Button
                      label="Hubungkan ke lab ini"
                      disabled={busy}
                      accessibilityLabel={`Hubungkan sesi ${s.title} ke laboratorium ${lab.name}`}
                      onPress={() => linkSession(s.id, lab.id)}
                    />
                  )}
                </View>
              </Card>
            ))}
          </View>
        )
      ) : schedules.data.length === 0 ? (
        <EmptyBox text="Belum ada jadwal. Buat jadwal di menu Kelola." />
      ) : (
        <View style={{ gap: 8 }}>
          {schedules.data.map((s) => (
            <Card key={s.id}>
              <Text style={ui.cardTitle}>{s.course}</Text>
              <Text style={ui.line}>
                {classNames.get(s.classId) ?? s.classId} · {dayName(s.dayOfWeek)} ·{' '}
                {formatRange(s.startTime, s.endTime)}
              </Text>
              <Text style={ui.meta}>Ruangan: {s.room}</Text>
              <Tag text={labTag(s.labId)} />
              <View style={ui.row}>
                {s.labId === lab.id ? (
                  <Button
                    label="Lepas dari lab ini"
                    variant="secondary"
                    disabled={busy}
                    accessibilityLabel={`Lepas jadwal ${s.course} dari laboratorium ${lab.name}`}
                    onPress={() => linkSchedule(s.id, null)}
                  />
                ) : (
                  <Button
                    label="Hubungkan ke lab ini"
                    disabled={busy}
                    accessibilityLabel={`Hubungkan jadwal ${s.course} ke laboratorium ${lab.name}`}
                    onPress={() => linkSchedule(s.id, lab.id)}
                  />
                )}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Section>
  );
}
