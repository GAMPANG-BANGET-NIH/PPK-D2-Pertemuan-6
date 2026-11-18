/**
 * /kelola — CRUD kelas, jadwal, dan sesi (segmen dalam satu layar).
 * Fitur B Sprint 2 (Mischa). Validasi ada di UI (umpan balik cepat) dan
 * diulang di service (sumber kebenaran sebelum menulis).
 */
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmModal,
  DAY_NAMES,
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
import {
  useClasses,
  useSchedules,
  useSessions,
  useWriteAction,
} from '@/hooks/use-praktikum';
import {
  createClass,
  createSchedule,
  createSession,
  deleteClass,
  deleteSchedule,
  deleteSession,
  updateClass,
  updateSchedule,
  updateSession,
  validateClassName,
  validateScheduleInput,
  validateSessionInput,
} from '@/services/praktikum';
import type { ClassDoc, Schedule, Session } from '@/types';

type Tab = 'kelas' | 'jadwal' | 'sesi';
type DeleteTarget = { id: string; label: string };

/* ------------------------------------------------------------------ */
/* Layar                                                               */
/* ------------------------------------------------------------------ */

export default function KelolaScreen() {
  const [tab, setTab] = useState<Tab>('kelas');
  const classes = useClasses();
  const schedules = useSchedules(null);
  const sessions = useSessions(null);

  const loading = classes.loading || schedules.loading || sessions.loading;
  const error = classes.error ?? schedules.error ?? sessions.error;
  const retry = () => {
    classes.retry();
    schedules.retry();
    sessions.retry();
  };

  return (
    <Screen
      title="Kelola Praktikum"
      subtitle="Tambah, ubah, atau hapus kelas, jadwal, dan sesi.">
      <ChipRow>
        <Chip label="Kelas" selected={tab === 'kelas'} onPress={() => setTab('kelas')} />
        <Chip label="Jadwal" selected={tab === 'jadwal'} onPress={() => setTab('jadwal')} />
        <Chip label="Sesi" selected={tab === 'sesi'} onPress={() => setTab('sesi')} />
      </ChipRow>

      {loading ? (
        <LoadingBox />
      ) : error ? (
        <ErrorBox message={error} onRetry={retry} />
      ) : tab === 'kelas' ? (
        <ClassPanel classes={classes.data} />
      ) : tab === 'jadwal' ? (
        <SchedulePanel classes={classes.data} schedules={schedules.data} />
      ) : (
        <SessionPanel
          classes={classes.data}
          schedules={schedules.data}
          sessions={sessions.data}
        />
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Hapus dengan konfirmasi (dipakai tiga panel)                        */
/* ------------------------------------------------------------------ */

function useDeleteFlow(
  noun: string,
  remove: (id: string) => Promise<void>,
  onDone: (id: string) => void,
) {
  const { busy, run } = useWriteAction();
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const confirm = async () => {
    if (!target) {
      return;
    }
    const result = await run(() => remove(target.id));
    if (!result.ok) {
      // Alasan penolakan (mis. masih punya data / presensi) tampil di dialog.
      setError(result.message);
      return;
    }
    onDone(target.id);
    setNotice(`${noun} "${target.label}" dihapus.`);
    setTarget(null);
    setError(null);
  };

  const modal = (
    <ConfirmModal
      visible={target !== null}
      title={`Hapus ${noun.toLowerCase()}?`}
      message={`${noun} "${target?.label ?? ''}" akan dihapus permanen.`}
      confirmLabel="Ya, hapus"
      danger
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => {
        setTarget(null);
        setError(null);
      }}
    />
  );

  return {
    modal,
    notice,
    clearNotice: () => setNotice(null),
    ask: (t: DeleteTarget) => {
      setNotice(null);
      setError(null);
      setTarget(t);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Panel kelas                                                         */
/* ------------------------------------------------------------------ */

function ClassPanel({ classes }: { classes: ClassDoc[] }) {
  const { busy, run } = useWriteAction();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const del = useDeleteFlow('Kelas', deleteClass, (id) => {
    if (id === editingId) {
      reset();
    }
  });

  function reset() {
    setName('');
    setEditingId(null);
    setError(null);
  }

  const submit = async () => {
    setNotice(null);
    const invalid = validateClassName(name);
    if (invalid) {
      setError(invalid);
      return;
    }
    const lower = name.trim().toLocaleLowerCase('id');
    if (classes.some((c) => c.id !== editingId && c.name.toLocaleLowerCase('id') === lower)) {
      setError(`Kelas dengan nama "${name.trim()}" sudah ada.`);
      return;
    }
    setError(null);
    const result = await run(() =>
      editingId ? updateClass(editingId, name) : createClass(name),
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(editingId ? 'Kelas diperbarui.' : 'Kelas ditambahkan.');
    reset();
  };

  return (
    <>
      <Section title={editingId ? 'Ubah kelas' : 'Tambah kelas'}>
        <Card>
          <Field
            label="Nama kelas"
            value={name}
            onChangeText={setName}
            placeholder="Contoh: SI-5C"
            maxLength={40}
          />
          <FormError message={error} />
          <Button
            label={editingId ? 'Simpan perubahan' : 'Tambah kelas'}
            loading={busy}
            onPress={submit}
          />
          {editingId ? (
            <Button label="Batal ubah" variant="secondary" disabled={busy} onPress={reset} />
          ) : null}
        </Card>
      </Section>

      <Notice message={notice ?? del.notice} />

      <Section title={`Daftar kelas (${classes.length})`}>
        {classes.length === 0 ? (
          <EmptyBox text="Belum ada kelas. Tambahkan kelas pertama di atas." />
        ) : (
          classes.map((c) => (
            <Card key={c.id}>
              <Text style={ui.cardTitle}>{c.name}</Text>
              <View style={ui.row}>
                <Button
                  label="Ubah"
                  variant="secondary"
                  accessibilityLabel={`Ubah kelas ${c.name}`}
                  onPress={() => {
                    setEditingId(c.id);
                    setName(c.name);
                    setError(null);
                    setNotice(null);
                    del.clearNotice();
                  }}
                />
                <Button
                  label="Hapus"
                  variant="danger"
                  accessibilityLabel={`Hapus kelas ${c.name}`}
                  onPress={() => del.ask({ id: c.id, label: c.name })}
                />
              </View>
            </Card>
          ))
        )}
      </Section>
      {del.modal}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Panel jadwal                                                        */
/* ------------------------------------------------------------------ */

function SchedulePanel({
  classes,
  schedules,
}: {
  classes: ClassDoc[];
  schedules: Schedule[];
}) {
  const { busy, run } = useWriteAction();
  const [classId, setClassId] = useState('');
  const [course, setCourse] = useState('');
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [room, setRoom] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const classNames = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  function reset() {
    setClassId('');
    setCourse('');
    setDay(1);
    setStart('');
    setEnd('');
    setRoom('');
    setEditingId(null);
    setError(null);
  }

  const del = useDeleteFlow('Jadwal', deleteSchedule, (id) => {
    if (id === editingId) {
      reset();
    }
  });

  const submit = async () => {
    setNotice(null);
    const input = {
      classId,
      course,
      dayOfWeek: day,
      startTime: start.trim(),
      endTime: end.trim(),
      room,
    };
    const invalid = validateScheduleInput(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!classNames.has(classId)) {
      setError('Kelas yang dipilih tidak ada.');
      return;
    }
    setError(null);
    const result = await run(() =>
      editingId ? updateSchedule(editingId, input) : createSchedule(input),
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(editingId ? 'Jadwal diperbarui.' : 'Jadwal ditambahkan.');
    reset();
  };

  return (
    <>
      <Section title={editingId ? 'Ubah jadwal' : 'Tambah jadwal'}>
        <Card>
          <Text style={ui.fieldLabel}>Kelas</Text>
          {classes.length === 0 ? (
            <Text style={ui.meta}>Belum ada kelas. Tambahkan kelas terlebih dahulu.</Text>
          ) : (
            <ChipRow>
              {classes.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={classId === c.id}
                  onPress={() => setClassId(c.id)}
                />
              ))}
            </ChipRow>
          )}
          <Field label="Nama praktikum" value={course} onChangeText={setCourse} />
          <Text style={ui.fieldLabel}>Hari</Text>
          <ChipRow>
            {DAY_NAMES.map((n, i) => (
              <Chip key={n} label={n} selected={day === i + 1} onPress={() => setDay(i + 1)} />
            ))}
          </ChipRow>
          <Field
            label="Jam mulai"
            value={start}
            onChangeText={setStart}
            placeholder="08:00"
            hint="Format HH:MM"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Field
            label="Jam selesai"
            value={end}
            onChangeText={setEnd}
            placeholder="09:40"
            hint="Format HH:MM, harus lebih besar dari jam mulai"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Field label="Ruangan" value={room} onChangeText={setRoom} />
          <FormError message={error} />
          <Button
            label={editingId ? 'Simpan perubahan' : 'Tambah jadwal'}
            loading={busy}
            onPress={submit}
          />
          {editingId ? (
            <Button label="Batal ubah" variant="secondary" disabled={busy} onPress={reset} />
          ) : null}
        </Card>
      </Section>

      <Notice message={notice ?? del.notice} />

      <Section title={`Daftar jadwal (${schedules.length})`}>
        {schedules.length === 0 ? (
          <EmptyBox text="Belum ada jadwal." />
        ) : (
          schedules.map((s) => (
            <Card key={s.id}>
              <Text style={ui.cardTitle}>{s.course}</Text>
              <Text style={ui.line}>
                {classNames.get(s.classId) ?? s.classId} · {dayName(s.dayOfWeek)} ·{' '}
                {formatRange(s.startTime, s.endTime)}
              </Text>
              <Text style={ui.meta}>Ruangan: {s.room}</Text>
              <View style={ui.row}>
                <Button
                  label="Ubah"
                  variant="secondary"
                  accessibilityLabel={`Ubah jadwal ${s.course}`}
                  onPress={() => {
                    setEditingId(s.id);
                    setClassId(s.classId);
                    setCourse(s.course);
                    setDay(s.dayOfWeek);
                    setStart(s.startTime);
                    setEnd(s.endTime);
                    setRoom(s.room);
                    setError(null);
                    setNotice(null);
                    del.clearNotice();
                  }}
                />
                <Button
                  label="Hapus"
                  variant="danger"
                  accessibilityLabel={`Hapus jadwal ${s.course}`}
                  onPress={() => del.ask({ id: s.id, label: s.course })}
                />
              </View>
            </Card>
          ))
        )}
      </Section>
      {del.modal}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Panel sesi                                                          */
/* ------------------------------------------------------------------ */

function SessionPanel({
  classes,
  schedules,
  sessions,
}: {
  classes: ClassDoc[];
  schedules: Schedule[];
  sessions: Session[];
}) {
  const { busy, run } = useWriteAction();
  const [classId, setClassId] = useState('');
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const classNames = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const classSchedules = schedules.filter((s) => s.classId === classId);

  function reset() {
    setClassId('');
    setScheduleId(null);
    setTitle('');
    setDate('');
    setStart('');
    setEnd('');
    setEditingId(null);
    setError(null);
  }

  const del = useDeleteFlow('Sesi', deleteSession, (id) => {
    if (id === editingId) {
      reset();
    }
  });

  const submit = async () => {
    setNotice(null);
    const input = {
      classId,
      scheduleId,
      title,
      date: date.trim(),
      startTime: start.trim(),
      endTime: end.trim(),
    };
    const invalid = validateSessionInput(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!classNames.has(classId)) {
      setError('Kelas yang dipilih tidak ada.');
      return;
    }
    setError(null);
    const result = await run(() =>
      editingId ? updateSession(editingId, input) : createSession(input),
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(editingId ? 'Sesi diperbarui.' : 'Sesi ditambahkan (status: Belum dibuka).');
    reset();
  };

  return (
    <>
      <Section title={editingId ? 'Ubah sesi' : 'Tambah sesi'}>
        <Card>
          <Text style={ui.fieldLabel}>Kelas</Text>
          {classes.length === 0 ? (
            <Text style={ui.meta}>Belum ada kelas. Tambahkan kelas terlebih dahulu.</Text>
          ) : (
            <ChipRow>
              {classes.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={classId === c.id}
                  onPress={() => {
                    setClassId(c.id);
                    // Jadwal harus milik kelas yang dipilih.
                    setScheduleId(null);
                  }}
                />
              ))}
            </ChipRow>
          )}
          {classId ? (
            <>
              <Text style={ui.fieldLabel}>Jadwal (opsional)</Text>
              <ChipRow>
                <Chip
                  label="Tanpa jadwal"
                  selected={scheduleId === null}
                  onPress={() => setScheduleId(null)}
                />
                {classSchedules.map((s) => (
                  <Chip
                    key={s.id}
                    label={`${s.course} (${dayName(s.dayOfWeek)})`}
                    selected={scheduleId === s.id}
                    onPress={() => setScheduleId(s.id)}
                  />
                ))}
              </ChipRow>
            </>
          ) : null}
          <Field label="Judul sesi" value={title} onChangeText={setTitle} />
          <Field
            label="Tanggal"
            value={date}
            onChangeText={setDate}
            placeholder="2026-11-20"
            hint="Format YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <Field
            label="Jam mulai"
            value={start}
            onChangeText={setStart}
            placeholder="08:00"
            hint="Format HH:MM"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Field
            label="Jam selesai"
            value={end}
            onChangeText={setEnd}
            placeholder="09:40"
            hint="Format HH:MM, harus lebih besar dari jam mulai"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <FormError message={error} />
          <Button
            label={editingId ? 'Simpan perubahan' : 'Tambah sesi'}
            loading={busy}
            onPress={submit}
          />
          {editingId ? (
            <Button label="Batal ubah" variant="secondary" disabled={busy} onPress={reset} />
          ) : null}
        </Card>
      </Section>

      <Notice message={notice ?? del.notice} />

      <Section title={`Daftar sesi (${sessions.length})`}>
        {sessions.length === 0 ? (
          <EmptyBox text="Belum ada sesi." />
        ) : (
          sessions.map((s) => (
            <Card key={s.id}>
              <Text style={ui.cardTitle}>{s.title}</Text>
              <Text style={ui.line}>
                {classNames.get(s.classId) ?? s.classId} · {s.date} ·{' '}
                {formatRange(s.startTime, s.endTime)}
              </Text>
              <View style={ui.row}>
                <StatusBadge status={s.status} />
                {s.scheduleId ? <Tag text="Terhubung jadwal" /> : null}
              </View>
              <View style={ui.row}>
                <Button
                  label="Ubah"
                  variant="secondary"
                  accessibilityLabel={`Ubah sesi ${s.title}`}
                  onPress={() => {
                    setEditingId(s.id);
                    setClassId(s.classId);
                    setScheduleId(s.scheduleId);
                    setTitle(s.title);
                    setDate(s.date);
                    setStart(s.startTime);
                    setEnd(s.endTime);
                    setError(null);
                    setNotice(null);
                    del.clearNotice();
                  }}
                />
                <Button
                  label="Hapus"
                  variant="danger"
                  accessibilityLabel={`Hapus sesi ${s.title}`}
                  onPress={() => del.ask({ id: s.id, label: s.title })}
                />
              </View>
            </Card>
          ))
        )}
      </Section>
      {del.modal}
    </>
  );
}
