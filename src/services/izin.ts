
import {
    doc,
    onSnapshot,
    runTransaction,
    serverTimestamp,
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import type { AppUser, Session } from '../types';

export type PermissionStatus =
  | 'menunggu'
  | 'disetujui'
  | 'ditolak';

export type PermissionRequest = {
  id: string;
  sessionId: string;
  userId: string;
  reason: string;
  status: PermissionStatus;
};

export function subscribeMyPermission(
  sessionId: string,
  uid: string,
  onData: (permission: PermissionRequest | null) => void,
  onError: (error: Error) => void
) {
  const permissionRef = doc(
    db,
    'permissions',
    `${sessionId}_${uid}`
  );

  return onSnapshot(
    permissionRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      onData({
        ...snapshot.data(),
        id: snapshot.id,
      } as PermissionRequest);
    },
    onError
  );
}

export async function submitPermission(
  user: AppUser,
  session: Session,
  reason: string
) {
  const trimmedReason = reason.trim();

  if (
    trimmedReason.length < 10 ||
    trimmedReason.length > 300
  ) {
    throw new Error(
      'Alasan izin harus berisi 10–300 karakter.'
    );
  }

  if (user.role !== 'praktikan') {
    throw new Error(
      'Hanya praktikan yang dapat mengajukan izin.'
    );
  }

  if (user.classId !== session.classId) {
    throw new Error(
      'Sesi tidak sesuai dengan kelas praktikan.'
    );
  }

  const permissionRef = doc(
    db,
    'permissions',
    `${session.id}_${user.uid}`
  );

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(permissionRef);

    if (existing.exists()) {
      throw new Error(
        'Kamu sudah mengajukan izin untuk sesi ini.'
      );
    }

    transaction.set(permissionRef, {
      sessionId: session.id,
      userId: user.uid,
      classId: user.classId,
      reason: trimmedReason,
      status: 'menunggu',
      createdAt: serverTimestamp(),
    });
  });
}
