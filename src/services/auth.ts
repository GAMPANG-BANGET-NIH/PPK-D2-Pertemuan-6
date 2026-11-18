import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { validateLogin } from '../features/auth/validation';
import { auth, db } from '../lib/firebase';
import type { AppUser } from '../types';
import { getErrorMessage } from '../utils/errors';

export const observeAuth: (next: (user: { uid: string } | null) => void) => () => void =
  (next) => onAuthStateChanged(auth, next);

export function observeProfile(uid: string, next: (user: AppUser | null) => void, onError: (message: string) => void) {
  return onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, (snapshot) => {
    // An empty cache is not proof that a server-side user document is missing.
    if (!snapshot.exists()) {
      if (!snapshot.metadata.fromCache) next(null);
      return;
    }
    const data = snapshot.data();
    if (typeof data.name !== 'string' || !data.name.trim() || typeof data.email !== 'string' || !data.email.trim() ||
        (data.role !== 'praktikan' && data.role !== 'asprak') ||
        (data.role === 'praktikan' ? typeof data.classId !== 'string' || !data.classId.trim() : data.classId !== null)) {
      onError('Data akun tidak valid. Hubungi pengelola.');
      return;
    }
    next({ uid, name: data.name, email: data.email, role: data.role, classId: data.classId });
  }, (error) => onError(getErrorMessage(error)));
}

export async function signIn(email: string, password: string): Promise<void> {
  const message = validateLogin(email, password);
  if (message) throw new Error(message);
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
