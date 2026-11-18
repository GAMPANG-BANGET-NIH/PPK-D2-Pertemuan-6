import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserHeader } from '@/components/user-header';
import { useAuth } from '@/context/auth-context';
import { useNetwork } from '@/hooks/use-network';
import { aiReviewText, filterPermissions, PermissionReviewError } from '@/lib/izin-review-policy';
import type { PermissionDecision, ReviewFilter } from '@/lib/izin-review-policy';
import { decidePermission, subscribeAllPermissions } from '@/services/izin-review';
import type { AppUser, PermissionRequest } from '@/types';
import { getErrorMessage } from '@/utils/errors';

const labels: Record<ReviewFilter, string> = {
  semua: 'Semua', menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak',
};
const message = (error: unknown) => error instanceof PermissionReviewError ? error.message : getErrorMessage(error);
const time = (date: Date | null) => date ? date.toLocaleString('id-ID') : 'Belum tersedia';

type Confirmation = { id: string; decision: PermissionDecision };

export default function IzinReviewScreen() {
  const { user, loading: authLoading } = useAuth();
  if (authLoading || !user || user.role !== 'asprak') {
    return <SafeAreaView style={styles.page}><Text>{authLoading ? 'Memuat akun...' : 'Halaman ini khusus Asprak.'}</Text></SafeAreaView>;
  }
  return <ReviewPermissions key={user.uid} user={user} />;
}

function ReviewPermissions({ user }: { user: AppUser }) {
  const { isOnline } = useNetwork();
  const [rows, setRows] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [filter, setFilter] = useState<ReviewFilter>('semua');
  const [retry, setRetry] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const writing = useRef(false);
  const latest = useRef({ user, isOnline, rows, confirmation });
  const mounted = useRef(false);
  useEffect(() => { latest.current = { user, isOnline, rows, confirmation }; });
  const uid = user.uid;

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const failed = (error: unknown) => {
      if (active) { setLoadError(message(error)); setLoading(false); }
    };
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeAllPermissions(permissions => {
        if (active) { setRows(permissions); setLoading(false); setLoadError(''); }
      }, failed);
    } catch (error) { failed(error); }
    return () => { active = false; mounted.current = false; unsubscribe?.(); };
  }, [uid, retry]);

  const requestDecision = (row: PermissionRequest, decision: PermissionDecision) => {
    if (writing.current || row.status !== 'menunggu') return;
    setFeedback('');
    if (!latest.current.isOnline) { setFeedback('Anda sedang offline. Hubungkan internet sebelum memutuskan izin.'); return; }
    setConfirmation({ id: row.id, decision });
  };
  const cancel = () => { if (!writing.current) setConfirmation(null); };
  const confirm = async () => {
    if (writing.current) return;
    const current = latest.current;
    const choice = current.confirmation;
    const row = current.rows.find(item => item.id === choice?.id);
    if (!choice || !current.user || current.user.role !== 'asprak') return;
    if (!current.isOnline) { setFeedback('Anda sedang offline. Hubungkan internet sebelum memutuskan izin.'); return; }
    if (!row || row.status !== 'menunggu') {
      setConfirmation(null); setFeedback('Izin sudah diputuskan atau tidak lagi tersedia.'); return;
    }
    writing.current = true;
    setSubmitting(true);
    setFeedback('');
    try {
      await decidePermission(row.id, choice.decision, current.user.uid);
      if (!mounted.current || latest.current.user.uid !== current.user.uid) return;
      // Successful transaction acknowledgement, not an optimistic backend claim.
      setRows(previous => previous.map(item => item.id === row.id ? {
        ...item, status: choice.decision, decidedBy: current.user.uid,
      } : item));
      setConfirmation(null);
      setFeedback('Keputusan izin tersimpan.');
    } catch (error) {
      if (mounted.current && latest.current.user.uid === current.user.uid) setFeedback(message(error));
    } finally { writing.current = false; if (mounted.current) setSubmitting(false); }
  };

  const visible = filterPermissions(rows, filter);
  const selected = rows.find(row => row.id === confirmation?.id);
  const canConfirm = !!selected && selected.status === 'menunggu' && isOnline && !submitting;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <UserHeader />
        <Text accessibilityRole="header" style={styles.title}>Review izin</Text>
        <View style={styles.filters}>
          {(Object.keys(labels) as ReviewFilter[]).map(status => (
            <View key={status} style={styles.filter}>
              <Button title={labels[status]} accessibilityLabel={`Filter ${labels[status]}${filter === status ? ', dipilih' : ''}`}
                onPress={() => setFilter(status)} disabled={filter === status} />
            </View>
          ))}
        </View>
        <Text>Filter: {labels[filter]}</Text>
        <Text>Model sentimen EDOM: info pendukung, bukan penentu keputusan.</Text>
        {!isOnline && <Text accessibilityLiveRegion="polite">Offline: menampilkan data terakhir. Keputusan tidak dapat disimpan.</Text>}
        {!!feedback && <Text accessibilityLiveRegion="polite">{feedback}</Text>}
        {loading ? <View style={styles.block}><ActivityIndicator /><Text>Memuat izin...</Text></View>
          : loadError ? <View style={styles.block}><Text accessibilityRole="alert">{loadError}</Text><Button title="Coba lagi" onPress={() => { setLoading(true); setLoadError(''); setRetry(value => value + 1); }} /></View>
          : visible.length === 0 ? <Text>Belum ada pengajuan izin untuk filter {labels[filter]}.</Text>
          : visible.map(row => (
            <View key={row.id} style={styles.record}>
              <Text style={styles.name}>{row.name}</Text>
              <Text>Kelas: {row.classId}</Text>
              <Text>Sesi: {row.sessionTitle} ({row.sessionId})</Text>
              <Text selectable>Alasan: {row.reason}</Text>
              <Text>{aiReviewText(row.aiResult)}</Text>
              <Text>Model: {row.aiResult.model}{row.aiResult.experimental ? ' (eksperimental)' : ''}</Text>
              <Text>Status: {labels[row.status]}</Text>
              <Text>Diajukan: {time(row.createdAt)}</Text>
              {row.status === 'menunggu' ? <View style={styles.block}>
                <Button title="Setujui" accessibilityLabel={`Setujui izin ${row.name}, ${row.sessionTitle}`}
                  disabled={submitting || !isOnline} onPress={() => requestDecision(row, 'disetujui')} />
                <Button title="Tolak" accessibilityLabel={`Tolak izin ${row.name}, ${row.sessionTitle}`}
                  disabled={submitting || !isOnline} onPress={() => requestDecision(row, 'ditolak')} />
              </View> : <View style={styles.block}>
                <Text>Keputusan terkunci.</Text>
                <Text>Diputuskan oleh: {row.decidedBy ?? 'Belum tersedia'}</Text>
                <Text>Waktu keputusan: {time(row.decidedAt)}</Text>
              </View>}
            </View>
          ))}
      </ScrollView>
      <Modal visible={confirmation !== null} onRequestClose={cancel} animationType="slide">
        <SafeAreaView style={styles.page}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>Konfirmasi keputusan</Text>
            <Text>{confirmation?.decision === 'disetujui' ? 'Setujui' : 'Tolak'} izin {selected?.name ?? ''} untuk {selected?.sessionTitle ?? ''}?</Text>
            <Text>Keputusan final tidak dapat diubah.</Text>
            {selected && <Text selectable>Alasan: {selected.reason}</Text>}
            {selected?.status !== 'menunggu' && <Text>Izin sudah diputuskan atau tidak lagi tersedia.</Text>}
            {!isOnline && <Text>Anda sedang offline. Hubungkan internet untuk menyimpan.</Text>}
            {!!feedback && <Text accessibilityLiveRegion="polite">{feedback}</Text>}
            {submitting && <View style={styles.block}><ActivityIndicator /><Text>Menyimpan keputusan...</Text></View>}
            <Button title={confirmation?.decision === 'disetujui' ? 'Ya, setujui' : 'Ya, tolak'} disabled={!canConfirm} onPress={confirm} />
            <Button title="Batal" disabled={submitting} onPress={cancel} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#171717' },
  name: { fontSize: 18, fontWeight: '600' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { width: '47%', minHeight: 44, justifyContent: 'center' },
  block: { gap: 8 },
  record: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#ccc', gap: 8 },
});
