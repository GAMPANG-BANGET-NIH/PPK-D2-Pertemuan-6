
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useIzin } from '../hooks/use-izin';
import type { AppUser, Session } from '../types';

type Props = {
  user: AppUser | null;
  session: Session | null;
};

const BLUE = '#2563EB';

export default function IzinPraktikan({
  user,
  session,
}: Props) {
  const [reason, setReason] = useState('');

  const {
    permission,
    loading,
    submitting,
    error,
    requestPermission,
  } = useIzin(user, session);

  const length = reason.trim().length;
  const valid = length >= 10 && length <= 300;

  const canSubmit =
    Boolean(user && session) &&
    valid &&
    !permission &&
    !loading &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    const success = await requestPermission(reason);

    if (success) {
      setReason('');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pengajuan Izin</Text>

      <Text style={styles.subtitle}>
        Ajukan izin untuk sesi praktikum yang
        tidak dapat kamu hadiri.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Sesi Praktikum</Text>

        <Text style={styles.sessionName}>
          {session?.title ?? 'Belum ada sesi dipilih'}
        </Text>

        {!user && (
          <Text style={styles.info}>
            Silakan login sebagai praktikan.
          </Text>
        )}

        <Text style={styles.label}>Alasan Izin</Text>

        <TextInput
          style={styles.input}
          multiline
          maxLength={300}
          placeholder="Tuliskan alasan izin..."
          placeholderTextColor="#94A3B8"
          value={reason}
          onChangeText={setReason}
          editable={!submitting && !permission}
          textAlignVertical="top"
        />

        <Text style={styles.counter}>
          {length}/300 karakter (minimal 10)
        </Text>

        {loading && (
          <ActivityIndicator color={BLUE} />
        )}

        {error && (
          <Text style={styles.error}>{error}</Text>
        )}

        {permission && (
          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>
              Status Pengajuan
            </Text>

            <Text style={styles.statusText}>
              {permission.status === 'menunggu'
                ? 'Menunggu persetujuan'
                : permission.status === 'disetujui'
                  ? 'Disetujui'
                  : 'Ditolak'}
            </Text>
          </View>
        )}

        <Pressable
          style={[
            styles.button,
            !canSubmit && styles.disabledButton,
          ]}
          disabled={!canSubmit}
          onPress={handleSubmit}
        >
          <Text style={styles.buttonText}>
            {submitting
              ? 'Mengirim...'
              : permission
                ? 'Izin Sudah Diajukan'
                : 'Ajukan Izin'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: '#64748B',
    lineHeight: 21,
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '600',
    color: '#334155',
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: BLUE,
  },
  info: {
    color: '#64748B',
    marginTop: 8,
  },
  input: {
    height: 120,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#EFF6FF',
    color: '#0F172A',
  },
  counter: {
    textAlign: 'right',
    marginTop: 8,
    color: '#64748B',
    fontSize: 12,
  },
  error: {
    color: '#DC2626',
    marginTop: 10,
  },
  statusBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  statusTitle: {
    fontWeight: '700',
    color: '#1E40AF',
  },
  statusText: {
    marginTop: 6,
    color: '#334155',
  },
  button: {
    marginTop: 20,
    backgroundColor: BLUE,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#94A3B8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
