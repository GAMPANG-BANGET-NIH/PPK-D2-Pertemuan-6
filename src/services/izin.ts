import {
    collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AiResult, AppUser, PermissionStatus, Session } from '../types';
import { classifyReason } from './ai';

export type PermissionRequest = {
  id: string;
  uid: string;
  name: string;
  classId: string;
  sessionId: string;
  sessionTitle: string;
  reason: string;
  status: PermissionStatus;
  aiResult: AiResult;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date | null;
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value &&
      typeof value.toDate === 'function') return value.toDate() as Date;
  return null;
}

export function subscribeMyPermissions(
  uid: string,
  onData: (permissions: PermissionRequest[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'permissions'), where('uid', '==', uid));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        ...data,
        id: item.id,
        decidedAt: asDate(data.decidedAt),
        createdAt: asDate(data.createdAt),
      } as PermissionRequest;
    });
    items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    onData(items);
  }, onError);
}

export async function submitPermission(
  user: AppUser,
  session: Session,
  reason: string
): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length < 10 || trimmed.length > 300) {
    throw new Error('Alasan izin harus berisi 10–300 karakter.');
  }
  if (!user.uid || !user.classId || !user.name) {
    throw new Error('Identitas atau kelas praktikan belum tersedia.');
  }
  if (user.role !== 'praktikan') {
    throw new Error('Hanya praktikan yang dapat mengajukan izin.');
  }
  if (!session.id || user.classId !== session.classId) {
    throw new Error('Sesi tidak sesuai dengan kelas praktikan.');
  }
  if (session.status === 'ditutup') {
    throw new Error('Sesi sudah ditutup. Pengajuan izin tidak tersedia.');
  }

  // Model lokal tidak boleh menghalangi pengajuan bila gagal mengenali teks.
  let aiResult: AiResult;
  try {
    aiResult = classifyReason(trimmed);
  } catch {
    aiResult = { status: 'gagal', label: null, model: 'model-edom', experimental: true };
  }
  if (!aiResult || !['predicted', 'unknown_vocabulary', 'empty_input', 'gagal'].includes(aiResult.status)) {
    aiResult = { status: 'gagal', label: null, model: 'model-edom', experimental: true };
  }
  if (aiResult.status !== 'predicted') {
    aiResult = { ...aiResult, label: null };
  }

  if (
  aiResult.status === 'predicted' &&
  !['positif', 'netral', 'negatif'].includes(
    aiResult.label ?? ''
  )
) {
  aiResult = {
    status: 'gagal',
    label: null,
    model: 'model-edom',
    experimental: true,
  };
}

  const sessionRef = doc(db, 'sessions', session.id);
  const permissionRef = doc(db, 'permissions', `${session.id}_${user.uid}`);

  await runTransaction(db, async (transaction) => {
    // Seluruh read sebelum write; kondisi sesi diperiksa ulang secara atomik.
    const currentSession = await transaction.get(sessionRef);
    const existing = await transaction.get(permissionRef);
    if (!currentSession.exists()) throw new Error('Sesi praktikum tidak ditemukan.');
    if (currentSession.data().classId !== user.classId) {
      throw new Error('Kelas praktikan tidak sesuai dengan sesi.');
    }
    if (currentSession.data().status === 'ditutup') {
      throw new Error('Sesi sudah ditutup. Pengajuan izin tidak tersedia.');
    }
    if (existing.exists()) throw new Error('Kamu sudah mengajukan izin untuk sesi ini.');

    transaction.set(permissionRef, {
      uid: user.uid,
      name: user.name,
      classId: user.classId,
      sessionId: session.id,
      sessionTitle: currentSession.data().title,
      reason: trimmed,
      status: 'menunggu',
      aiResult,
      decidedBy: null,
      decidedAt: null,
      createdAt: serverTimestamp(),
    });
  });
}
