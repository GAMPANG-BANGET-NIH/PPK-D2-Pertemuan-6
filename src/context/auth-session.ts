import type { AppUser } from '../types';

export type AuthState = { user: AppUser | null; loading: boolean };
type Unsubscribe = () => void;
type SessionSource = {
  observeAuth(next: (user: { uid: string } | null) => void): Unsubscribe;
  observeProfile(uid: string, next: (user: AppUser | null) => void, onError: (message: string) => void): Unsubscribe;
  signOut(): Promise<void>;
};

export function observeAuthSession(source: SessionSource, onState: (state: AuthState) => void, onError: (message: string) => void): Unsubscribe {
  let active = true;
  let revision = 0;
  let stopProfile: Unsubscribe | undefined;
  const clearProfile = () => { stopProfile?.(); stopProfile = undefined; };
  const stopAuth = source.observeAuth((identity) => {
    if (!active) return;
    const current = ++revision;
    clearProfile();
    onState({ user: null, loading: !!identity });
    if (!identity) return;
    const fail = (message: string) => {
      if (!active || current !== revision) return;
      revision++;
      clearProfile();
      onState({ user: null, loading: true });
      onError(message);
      void source.signOut().then(() => {
        if (active && revision === current + 1) onState({ user: null, loading: false });
      }, () => {
        if (active && revision === current + 1) {
          onState({ user: null, loading: false });
          onError(`${message}. Gagal keluar. Silakan coba lagi.`);
        }
      });
    };
    const unsubscribe = source.observeProfile(identity.uid, (profile) => {
      if (!active || current !== revision) return;
      if (!profile) { fail('Akun belum terdaftar di sistem'); return; }
      onState({ user: profile, loading: false });
    }, fail);
    if (active && current === revision) stopProfile = unsubscribe;
    else unsubscribe();
  });
  return () => {
    active = false;
    revision++;
    clearProfile();
    stopAuth();
  };
}
