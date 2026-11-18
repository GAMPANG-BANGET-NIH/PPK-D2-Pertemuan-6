import { useRef, useState } from 'react';
import { Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth, useAuthNotice } from '@/context/auth-context';
import { useNetwork } from '@/hooks/use-network';
import { validateLogin } from './validation';

export default function LoginScreen() {
  const { signIn, loading } = useAuth();
  const notice = useAuthNotice();
  const { isOnline } = useNetwork();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const passwordInput = useRef<TextInput>(null);
  const submit = async () => {
    if (busy.current || loading) return;
    const validation = validateLogin(email, password);
    if (validation) { setError(validation); return; }
    if (!isOnline) { setError('Anda sedang offline. Periksa koneksi internet.'); return; }
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try { await signIn(email, password); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Login gagal. Silakan coba lagi.'); }
    finally { busy.current = false; setSubmitting(false); }
  };
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} accessibilityRole="header">Login Presensi Praktikum</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} accessibilityLabel="Email" value={email} onChangeText={setEmail}
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
            textContentType="emailAddress" returnKeyType="next" editable={!submitting && !loading}
            onSubmitEditing={() => passwordInput.current?.focus()} />
          <Text style={styles.label}>Password</Text>
          <TextInput ref={passwordInput} style={styles.input} accessibilityLabel="Password" value={password}
            onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false}
            autoComplete="current-password" textContentType="password" returnKeyType="go"
            editable={!submitting && !loading} onSubmitEditing={() => { void submit(); }} />
          {error || notice ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error || notice}</Text> : null}
          <Button title={submitting || loading ? 'Memuat...' : 'Login'} disabled={submitting || loading}
            onPress={() => { void submit(); }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', color: '#111827', marginBottom: 12 },
  label: { color: '#111827', fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#6b7280', borderRadius: 3, padding: 12, color: '#111827', backgroundColor: '#ffffff' },
  error: { color: '#a01818' },
});
