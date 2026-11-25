import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { observeAuthSession, type AuthState } from './auth-session';

// Keep the shared useAuth contract exact; notices have a separate hook.
type AuthContextValue = AuthState & {
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const AuthNoticeContext = createContext<string | null>(null);
const configurationMessage = 'Konfigurasi Firebase belum lengkap. Isi .env.local lalu mulai ulang aplikasi.';

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let stop: (() => void) | undefined;
    // No placeholder Firebase config: missing config leaves login visible with a setup notice.
    void import('../services/auth').then((source) => {
      if (active) stop = observeAuthSession(source, setState, setNotice);
    }).catch(() => {
      if (active) {
        setState({ user: null, loading: false });
        setNotice(configurationMessage);
      }
    });
    return () => { active = false; stop?.(); };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setNotice(null);
    let source: typeof import('../services/auth');
    try { source = await import('../services/auth'); }
    catch { throw new Error(configurationMessage); }
    await source.signIn(email, password);
  }, []);
  const signOut = useCallback(async () => {
    let source: typeof import('../services/auth');
    try { source = await import('../services/auth'); }
    catch { throw new Error(configurationMessage); }
    if (state.user) {
      try {
        const { getDeviceId } = await import('../lib/notifications');
        const { unregisterPushToken } = await import('../services/notifications');
        const devId = await getDeviceId();
        await unregisterPushToken(state.user.uid, devId);
      } catch (err) {
        console.warn('Gagal menghapus token notifikasi saat logout:', err);
      }
    }
    await source.signOut();
  }, [state.user]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      <AuthNoticeContext.Provider value={notice}>{children}</AuthNoticeContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return context;
}

export function useAuthNotice(): string | null {
  return useContext(AuthNoticeContext);
}
