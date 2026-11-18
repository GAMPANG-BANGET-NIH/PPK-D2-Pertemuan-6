import { useState } from 'react';
import {
    ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useIzin } from '../hooks/use-izin';
import type { AppUser, Session } from '../types';

type Props = { user: AppUser | null; session: Session | null };
const BLUE = '#2563EB';
const statusText = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };

export default function IzinPraktikan({ user, session }: Props) {
  const [reason, setReason] = useState('');
  const { permission, permissions, loading, submitting, error, requestPermission } = useIzin(user, session);
  const length = reason.trim().length;
  const valid = length >= 10 && length <= 300;
  const canSubmit =
  Boolean(
    user?.uid &&
    user?.role === 'praktikan' &&
    user?.classId &&
    session?.id &&
    session.classId === user.classId &&
    session.status !== 'ditutup'
  ) &&
  valid &&
  !permission &&
  !loading &&
  !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    if (await requestPermission(reason)) setReason('');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Pengajuan Izin</Text>
      <Text style={styles.subtitle}>Ajukan izin dan pantau keputusan asprak secara realtime.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Sesi Praktikum</Text>
        <Text style={styles.sessionName}>{session?.title ?? 'Belum ada sesi dipilih'}</Text>
        {!user && <Text style={styles.info}>Silakan login sebagai praktikan.</Text>}
        {session?.status === 'ditutup' && <Text style={styles.error}>Sesi sudah ditutup.</Text>}
        <Text style={styles.label}>Alasan Izin</Text>
        <TextInput style={styles.input} multiline maxLength={300}
          placeholder="Tuliskan alasan izin..." placeholderTextColor="#94A3B8"
          value={reason} onChangeText={setReason} editable={!submitting && !permission}
          textAlignVertical="top" />
        <Text style={styles.counter}>{length}/300 karakter (minimal 10)</Text>
        {loading && <ActivityIndicator color={BLUE} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {permission && <Text style={styles.info}>Status sesi ini: {statusText[permission.status]}</Text>}
        <Pressable style={[styles.button, !canSubmit && styles.disabledButton]}
          disabled={!canSubmit} onPress={handleSubmit}>
          <Text style={styles.buttonText}>{submitting ? 'Mengirim...' : permission ? 'Izin Sudah Diajukan' : 'Ajukan Izin'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Riwayat Pengajuan Izin</Text>
      {!loading && permissions.length === 0 && <Text style={styles.info}>Belum ada riwayat pengajuan izin.</Text>}
      {permissions.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.sessionName}>{item.sessionTitle}</Text>
          <Text style={styles.detail}>Alasan: {item.reason}</Text>
          <Text style={styles.detail}>Status: {statusText[item.status]}</Text>
          <Text style={styles.detail}>Sentimen AI: {item.aiResult?.status === 'predicted' && item.aiResult.label != null
            ? `${item.aiResult.label} (info pendukung)` : 'Klasifikasi tidak tersedia'}</Text>
          <Text style={styles.detail}>Diajukan: {item.createdAt ? item.createdAt.toLocaleString('id-ID') : 'Menunggu sinkronisasi'}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#1E3A8A' },
  subtitle: { marginTop: 8, marginBottom: 20, color: '#64748B', lineHeight: 21 },
  card: { padding: 18, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 12 },
  label: { marginTop: 12, marginBottom: 8, fontWeight: '600', color: '#334155' },
  sessionName: { fontSize: 16, fontWeight: '600', color: BLUE },
  info: { color: '#64748B', marginTop: 8 },
  detail: { color: '#334155', marginTop: 8, lineHeight: 20 },
  input: { height: 120, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, padding: 12, backgroundColor: '#EFF6FF', color: '#0F172A' },
  counter: { textAlign: 'right', marginTop: 8, color: '#64748B', fontSize: 12 },
  error: { color: '#DC2626', marginTop: 10 },
  button: { marginTop: 20, backgroundColor: BLUE, borderRadius: 12, padding: 15, alignItems: 'center' },
  disabledButton: { backgroundColor: '#94A3B8' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: '#1E3A8A', marginVertical: 14 },
});
