import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/auth-context';

export function UserHeader() {
  const { user, signOut } = useAuth();
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const logout = async () => {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try { await signOut(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Gagal keluar. Silakan coba lagi.'); }
    finally { busy.current = false; setSubmitting(false); }
  };
  return (
    <View style={styles.header}>
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.text}>Peran: {user.role === 'asprak' ? 'Asprak' : 'Praktikan'}</Text>
      <Button title={submitting ? 'Keluar...' : 'Logout'} disabled={submitting} onPress={() => { void logout(); }} />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  header: { gap: 8, padding: 16, backgroundColor: '#ffffff' },
  name: { fontSize: 18, fontWeight: '600', color: '#111827' },
  text: { color: '#111827' },
  error: { color: '#a01818' },
});
