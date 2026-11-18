/**
 * /pindah-kelas — Asprak memindahkan praktikan ke kelas lain
 * (menulis users/{uid}.classId). Fitur B Sprint 2 (Mischa).
 * Praktikan melihat jadwal/sesi kelas barunya lewat listener realtime miliknya.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  Button,
  Card,
  Chip,
  ChipRow,
  ConfirmModal,
  EmptyBox,
  ErrorBox,
  FormError,
  LoadingBox,
  Notice,
  Screen,
  Section,
  styles as ui,
} from '@/features/asisten-ui';
import {
  useClasses,
  usePraktikanByClass,
  useWriteAction,
} from '@/hooks/use-praktikum';
import { movePraktikanToClass } from '@/services/praktikum';

export default function PindahKelasScreen() {
  const praktikan = usePraktikanByClass(null);
  const classes = useClasses();
  const { busy, run } = useWriteAction();

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const classNames = useMemo(
    () => new Map(classes.data.map((c) => [c.id, c.name])),
    [classes.data],
  );
  const nameOf = (id: string | null) =>
    id ? (classNames.get(id) ?? id) : 'Belum ada kelas';

  const selected = praktikan.data.find((p) => p.uid === selectedUid) ?? null;
  const target = classes.data.find((c) => c.id === targetId) ?? null;

  const requestMove = () => {
    setNotice(null);
    if (!selected) {
      setFormError('Pilih praktikan terlebih dahulu.');
      return;
    }
    if (!target) {
      setFormError('Pilih kelas tujuan terlebih dahulu.');
      return;
    }
    if (selected.classId === target.id) {
      setFormError('Kelas tujuan sama dengan kelas saat ini. Pilih kelas lain.');
      return;
    }
    setFormError(null);
    setModalError(null);
    setConfirming(true);
  };

  const cancel = () => {
    // Batal tidak mengubah data.
    setConfirming(false);
    setModalError(null);
  };

  const confirm = async () => {
    if (!selected || !target) {
      return;
    }
    const result = await run(() => movePraktikanToClass(selected.uid, target.id));
    if (!result.ok) {
      setModalError(result.message);
      return;
    }
    setNotice(`${selected.name} dipindahkan ke kelas ${target.name}.`);
    setConfirming(false);
    setModalError(null);
    setSelectedUid(null);
    setTargetId(null);
  };

  const loading = praktikan.loading || classes.loading;
  const error = praktikan.error ?? classes.error;
  const retry = () => {
    praktikan.retry();
    classes.retry();
  };

  return (
    <Screen
      title="Pindah Kelas"
      subtitle="Pilih praktikan, pilih kelas tujuan, lalu konfirmasi.">
      <Notice message={notice} />

      {loading ? (
        <LoadingBox />
      ) : error ? (
        <ErrorBox message={error} onRetry={retry} />
      ) : praktikan.data.length === 0 ? (
        <EmptyBox text="Belum ada praktikan terdaftar." />
      ) : (
        <>
          <Section title={`Praktikan (${praktikan.data.length})`}>
            {praktikan.data.map((p) => (
              <Pressable
                key={p.uid}
                accessibilityRole="button"
                accessibilityLabel={`Pilih ${p.name}, kelas saat ini ${nameOf(p.classId)}`}
                accessibilityState={{ selected: p.uid === selectedUid }}
                onPress={() => {
                  setSelectedUid(p.uid);
                  setFormError(null);
                  setNotice(null);
                }}
                style={[local.option, p.uid === selectedUid && local.optionSelected]}>
                <Text style={ui.cardTitle}>
                  {p.uid === selectedUid ? '✓ ' : ''}
                  {p.name}
                </Text>
                <Text style={ui.meta}>Kelas saat ini: {nameOf(p.classId)}</Text>
              </Pressable>
            ))}
          </Section>

          <Section title="Kelas tujuan">
            {classes.data.length === 0 ? (
              <EmptyBox text="Belum ada kelas. Tambahkan kelas di menu Kelola." />
            ) : (
              <ChipRow>
                {classes.data.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={targetId === c.id}
                    onPress={() => {
                      setTargetId(c.id);
                      setFormError(null);
                    }}
                  />
                ))}
              </ChipRow>
            )}
          </Section>

          <Card>
            <Text style={ui.line}>
              {selected ? selected.name : 'Belum memilih praktikan'} →{' '}
              {target ? target.name : 'belum memilih kelas tujuan'}
            </Text>
            <FormError message={formError} />
            <Button label="Pindahkan" onPress={requestMove} />
          </Card>
        </>
      )}

      <ConfirmModal
        visible={confirming}
        title="Pindahkan praktikan?"
        message={
          selected && target
            ? `${selected.name} akan dipindahkan dari ${nameOf(selected.classId)} ke ${target.name}. Jadwal dan sesi yang ia lihat akan ikut berubah.`
            : ''
        }
        confirmLabel="Ya, pindahkan"
        busy={busy}
        error={modalError}
        onConfirm={confirm}
        onCancel={cancel}
      />
    </Screen>
  );
}

const local = StyleSheet.create({
  option: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8BFC7',
    backgroundColor: '#FFFFFF',
    gap: 2,
    minHeight: 48,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: '#1F4FD8',
    backgroundColor: '#E8EEFF',
  },
});
