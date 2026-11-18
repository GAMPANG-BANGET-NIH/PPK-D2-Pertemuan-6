import type { AiResult, PermissionRequest, PermissionStatus } from '@/types';

export type PermissionDecision = Exclude<PermissionStatus, 'menunggu'>;

export class PermissionReviewError extends Error {}

export type ReviewFilter = 'semua' | PermissionStatus;

export function permissionDate(value: unknown): Date | null {
  try {
    const date = value instanceof Date ? value
      : value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
        ? value.toDate() : null;
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

export function readPermission(id: string, data: Record<string, unknown>): PermissionRequest {
  const text = (field: string) => {
    if (typeof data[field] !== 'string') throw new PermissionReviewError('Data izin tidak valid. Hubungi pengelola.');
    return data[field] as string;
  };
  if (!['menunggu', 'disetujui', 'ditolak'].includes(text('status'))) {
    throw new PermissionReviewError('Status izin tidak valid. Hubungi pengelola.');
  }
  const ai = data.aiResult as Partial<AiResult> | null;
  if (!ai || !['predicted', 'unknown_vocabulary', 'empty_input', 'gagal'].includes(ai.status ?? '')
    || typeof ai.model !== 'string' || typeof ai.experimental !== 'boolean'
    || (ai.label !== null && !['positif', 'netral', 'negatif'].includes(ai.label ?? ''))) {
    throw new PermissionReviewError('Data AI pada izin tidak valid. Hubungi pengelola.');
  }
  return {
    id, uid: text('uid'), name: text('name'), classId: text('classId'),
    sessionId: text('sessionId'), sessionTitle: text('sessionTitle'), reason: text('reason'),
    status: data.status as PermissionStatus,
    aiResult: { status: ai.status!, label: ai.status === 'predicted' ? ai.label! : null, model: ai.model, experimental: ai.experimental },
    decidedBy: typeof data.decidedBy === 'string' ? data.decidedBy : null,
    decidedAt: permissionDate(data.decidedAt), createdAt: permissionDate(data.createdAt),
  };
}

export function sortPermissions(rows: PermissionRequest[]): PermissionRequest[] {
  return [...rows].sort((a, b) => (b.createdAt?.getTime() ?? -Infinity) - (a.createdAt?.getTime() ?? -Infinity)
    || a.id.localeCompare(b.id));
}

export function filterPermissions(rows: PermissionRequest[], status: ReviewFilter): PermissionRequest[] {
  return status === 'semua' ? rows : rows.filter(row => row.status === status);
}

export function aiReviewText(ai: AiResult): string {
  return ai.status === 'predicted' && ai.label !== null
    ? `Sentimen AI: ${ai.label} (info pendukung)` : 'Klasifikasi tidak tersedia';
}

export function assertReviewActor(id: string, asprakUid: string, currentUid: string | null, isOnline: boolean) {
  for (const value of [id, asprakUid]) {
    if (typeof value !== 'string' || !value || value !== value.trim() || value.includes('/') || value === '.' || value === '..') {
      throw new PermissionReviewError('ID izin atau akun tidak valid.');
    }
  }
  if (!currentUid || currentUid !== asprakUid) {
    throw new PermissionReviewError('Akun berubah. Silakan login ulang sebelum memutuskan izin.');
  }
  if (!isOnline) {
    throw new PermissionReviewError('Anda sedang offline. Hubungkan internet sebelum memutuskan izin.');
  }
}

export function permissionDecisionPatch<T>(
  status: unknown,
  decision: PermissionDecision,
  asprakUid: string,
  decidedAt: T,
) {
  if (status !== 'menunggu') {
    throw new PermissionReviewError('Izin sudah diputuskan atau statusnya tidak valid. Muat ulang daftar.');
  }
  if (decision !== 'disetujui' && decision !== 'ditolak') {
    throw new PermissionReviewError('Keputusan izin tidak valid.');
  }
  return { status: decision, decidedBy: asprakUid, decidedAt };
}
