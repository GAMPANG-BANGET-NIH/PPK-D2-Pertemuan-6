/**
 * Service Keterlambatan, Rekap Status Kehadiran & Konteks Tagihan — Sprint 4, SRS-11 (Moses).
 *
 * Kontrak antarmodul (docs/PEMBAGIAN.md):
 *   resolveAttendanceStatus(attendance, permissionsApproved, gracePeriodMinutes):
 *     'hadir' | 'terlambat' | 'izin' | 'belum_hadir'
 *
 * Aturan bisnis wajib (docs/PRD.md SRS-11):
 * 1. Keterlambatan ditentukan dari waktu presensi praktikan dibanding waktu mulai sesi,
 *    menggunakan `gracePeriodMinutes` dari dokumen `laboratories/{labId}` (bukan hard-coded).
 *    Presensi sebelum atau tepat pada akhir masa toleransi = tepat waktu ('hadir');
 *    setelahnya = 'terlambat'.
 * 2. Bila dokumen presensi (`sessions/{id}/attendance/{uid}`) sudah memiliki field
 *    `onTime` / `lateMinutes` yang ditulis backend tepercaya, nilai tersebut menjadi rujukan
 *    utama dan tidak pernah diubah dari sisi klien/asprak.
 * 3. Praktikan dengan izin berstatus `disetujui` dicatat sebagai `izin` (excused absence):
 *    tetap tidak hadir dengan izin, bebas denda keterlambatan, dan TIDAK PERNAH diubah
 *    menjadi `hadir`.
 * 4. Pembayaran denda (`fines.status === 'paid'`) TIDAK mengubah status kehadiran praktikan.
 */
import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import type { Attendance, PermissionRequest, PermissionStatus, Session } from '../types';

export type ResolvedAttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'belum_hadir';

export type FineStatusLocal = 'pending' | 'paid' | 'failed' | 'dibatalkan';

export type LabLateConfig = {
  id: string;
  name: string;
  mataKuliah: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  /** Batas toleransi keterlambatan dalam menit dari `laboratories` (null jika belum diatur Aslab). */
  gracePeriodMinutes: number | null;
  /** Nominal denda tetap per kejadian keterlambatan dari `laboratories` (null jika belum diatur). */
  lateFineAmount: number | null;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type AttendanceTimingRecord = Attendance & {
  sessionId?: string;
  onTime?: boolean;
  lateMinutes?: number;
  /** Konteks waktu sesi opsional untuk evaluasi ketika field backend belum tersedia. */
  sessionDate?: string;
  sessionStartTime?: string;
  sessionStartAt?: Date | number | null;
};

export type FineRecordSummary = {
  id: string;
  uid: string;
  name: string;
  sessionId: string;
  sessionTitle: string;
  attendancePath: string;
  amount: number;
  status: FineStatusLocal;
  canceledReason: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type PermissionApprovalInput =
  | boolean
  | Set<string>
  | readonly string[]
  | readonly { uid: string; status?: PermissionStatus | string }[]
  | { uid?: string; status?: PermissionStatus | string }
  | null
  | undefined;

export type LatenessEvaluation = {
  onTime: boolean;
  lateMinutes: number;
  source: 'backend' | 'computed' | 'fallback';
};

export type RosterMember = {
  uid: string;
  name: string;
  classId: string | null;
};

export type SessionRecapRow = {
  uid: string;
  name: string;
  classId: string | null;
  status: ResolvedAttendanceStatus;
  attendedAt: Date | null;
  lateMinutes: number;
  distanceMeters?: number;
  verificationMethod?: 'geolocation' | 'manual';
  permissionReason: string | null;
  fine: FineRecordSummary | null;
};

export type SessionRecapSummary = {
  hadir: number;
  terlambat: number;
  izin: number;
  belumHadir: number;
  total: number;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Offset zona waktu operasional laboratorium (`Asia/Jakarta`, UTC+07:00 tanpa DST). */
const JAKARTA_UTC_OFFSET = '+07:00';

/* ------------------------------------------------------------------ */
/* Helper konversi dokumen Firestore                                   */
/* ------------------------------------------------------------------ */

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    const converted = (value as { toDate: () => Date }).toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }
  return null;
}

function toFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toNonNegativeNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function mapLabLateConfig(id: string, data: DocumentData): LabLateConfig {
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : id;
  const mataKuliah = typeof data.mataKuliah === 'string' ? data.mataKuliah.trim() : '';
  return {
    id,
    name,
    mataKuliah,
    latitude: toFiniteNumberOrNull(data.latitude),
    longitude: toFiniteNumberOrNull(data.longitude),
    radiusMeters: toNonNegativeNumberOrNull(data.radiusMeters),
    gracePeriodMinutes: toNonNegativeNumberOrNull(data.gracePeriodMinutes),
    lateFineAmount: toNonNegativeNumberOrNull(data.lateFineAmount),
    active: data.active !== false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function mapAttendanceWithTiming(
  fallbackUid: string,
  data: DocumentData,
  sessionId?: string,
): AttendanceTimingRecord {
  const method =
    data.verificationMethod === 'geolocation' || data.verificationMethod === 'manual'
      ? data.verificationMethod
      : undefined;
  const distanceMeters = toFiniteNumberOrNull(data.distanceMeters);
  const validatedAt = toDate(data.validatedAt);
  const onTime = typeof data.onTime === 'boolean' ? data.onTime : undefined;
  const lateMinutesRaw = toNonNegativeNumberOrNull(data.lateMinutes);

  return {
    uid: typeof data.uid === 'string' && data.uid.trim() ? data.uid : fallbackUid,
    name: typeof data.name === 'string' ? data.name : '',
    classId: typeof data.classId === 'string' ? data.classId : '',
    attendedAt: toDate(data.attendedAt),
    ...(sessionId ? { sessionId } : {}),
    ...(method ? { verificationMethod: method } : {}),
    ...(distanceMeters !== null ? { distanceMeters } : {}),
    ...(validatedAt !== null ? { validatedAt } : {}),
    ...(onTime !== undefined ? { onTime } : {}),
    ...(lateMinutesRaw !== null ? { lateMinutes: Math.round(lateMinutesRaw) } : {}),
  };
}

export function mapFineSummary(id: string, data: DocumentData): FineRecordSummary {
  const rawStatus = data.status;
  const status: FineStatusLocal =
    rawStatus === 'paid' || rawStatus === 'failed' || rawStatus === 'dibatalkan'
      ? rawStatus
      : 'pending';

  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : '',
    name: typeof data.name === 'string' ? data.name : '',
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
    sessionTitle: typeof data.sessionTitle === 'string' ? data.sessionTitle : '',
    attendancePath: typeof data.attendancePath === 'string' ? data.attendancePath : '',
    amount: toNonNegativeNumberOrNull(data.amount) ?? 0,
    status,
    canceledReason: typeof data.canceledReason === 'string' ? data.canceledReason : null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

/* ------------------------------------------------------------------ */
/* Perhitungan murni waktu sesi, grace period, dan status kehadiran    */
/* ------------------------------------------------------------------ */

/**
 * Mengubah pasangan tanggal `"YYYY-MM-DD"` dan jam mulai `"HH:MM"` (zona waktu
 * laboratorium `Asia/Jakarta`, UTC+07:00) menjadi epoch milidetik yang deterministik.
 */
export function parseSessionStartTimestamp(
  date: string | null | undefined,
  startTime: string | null | undefined,
): number | null {
  if (typeof date !== 'string' || typeof startTime !== 'string') {
    return null;
  }
  const trimmedDate = date.trim();
  const trimmedTime = startTime.trim();
  const dateMatch = DATE_RE.exec(trimmedDate);
  const timeMatch = TIME_RE.exec(trimmedTime);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  const parsed = Date.parse(`${trimmedDate}T${trimmedTime}:00${JAKARTA_UTC_OFFSET}`);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGraceMinutes(gracePeriodMinutes: number | null | undefined): number {
  if (
    typeof gracePeriodMinutes !== 'number' ||
    !Number.isFinite(gracePeriodMinutes) ||
    gracePeriodMinutes < 0
  ) {
    return 0;
  }
  return gracePeriodMinutes;
}

function resolveSessionStartMs(attendance: AttendanceTimingRecord): number | null {
  if (attendance.sessionStartAt instanceof Date) {
    const ms = attendance.sessionStartAt.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof attendance.sessionStartAt === 'number' && Number.isFinite(attendance.sessionStartAt)) {
    return attendance.sessionStartAt;
  }
  return parseSessionStartTimestamp(attendance.sessionDate, attendance.sessionStartTime);
}

/**
 * Mengevaluasi ketepatan waktu dan selisih menit keterlambatan.
 * - Prioritas 1: field `onTime` & `lateMinutes` yang ditulis backend pada dokumen presensi.
 * - Prioritas 2: perbandingan `attendedAt` terhadap `waktuMulaiSesi + gracePeriodMinutes`
 *   dari konfigurasi `laboratories` (presensi <= akhir grace period = tepat waktu).
 */
export function evaluateAttendanceLateness(
  attendance: AttendanceTimingRecord,
  gracePeriodMinutes: number | null | undefined,
): LatenessEvaluation {
  const grace = normalizeGraceMinutes(gracePeriodMinutes);
  const startMs = resolveSessionStartMs(attendance);
  const attendedMs =
    attendance.attendedAt instanceof Date && !Number.isNaN(attendance.attendedAt.getTime())
      ? attendance.attendedAt.getTime()
      : null;

  const computeMinutesLate = (): number => {
    if (startMs !== null && attendedMs !== null && attendedMs > startMs) {
      return Math.max(1, Math.ceil((attendedMs - startMs) / 60_000));
    }
    if (
      typeof attendance.lateMinutes === 'number' &&
      Number.isFinite(attendance.lateMinutes) &&
      attendance.lateMinutes > 0
    ) {
      return Math.round(attendance.lateMinutes);
    }
    return 1;
  };

  if (typeof attendance.onTime === 'boolean') {
    if (attendance.onTime) {
      return { onTime: true, lateMinutes: 0, source: 'backend' };
    }
    const backendLate =
      typeof attendance.lateMinutes === 'number' &&
      Number.isFinite(attendance.lateMinutes) &&
      attendance.lateMinutes > 0
        ? Math.round(attendance.lateMinutes)
        : computeMinutesLate();
    return { onTime: false, lateMinutes: backendLate, source: 'backend' };
  }

  if (startMs !== null && attendedMs !== null) {
    const graceDeadlineMs = startMs + grace * 60_000;
    if (attendedMs <= graceDeadlineMs) {
      return { onTime: true, lateMinutes: 0, source: 'computed' };
    }
    const lateMinutes = Math.max(1, Math.ceil((attendedMs - startMs) / 60_000));
    return { onTime: false, lateMinutes, source: 'computed' };
  }

  if (
    typeof attendance.lateMinutes === 'number' &&
    Number.isFinite(attendance.lateMinutes) &&
    attendance.lateMinutes > 0
  ) {
    if (attendance.lateMinutes <= grace) {
      return { onTime: true, lateMinutes: 0, source: 'computed' };
    }
    return { onTime: false, lateMinutes: Math.round(attendance.lateMinutes), source: 'computed' };
  }

  return { onTime: true, lateMinutes: 0, source: 'fallback' };
}

function isApprovedForAttendance(
  permissionsApproved: PermissionApprovalInput,
  targetUid?: string,
): boolean {
  if (typeof permissionsApproved === 'boolean') {
    return permissionsApproved;
  }
  if (!permissionsApproved) {
    return false;
  }
  if (permissionsApproved instanceof Set) {
    return targetUid ? permissionsApproved.has(targetUid) : permissionsApproved.size > 0;
  }
  if (Array.isArray(permissionsApproved)) {
    if (permissionsApproved.length === 0) {
      return false;
    }
    return permissionsApproved.some((entry) => {
      if (typeof entry === 'string') {
        return targetUid ? entry === targetUid : entry.length > 0;
      }
      if (entry && typeof entry === 'object' && 'uid' in entry) {
        const statusOk = !('status' in entry) || !entry.status || entry.status === 'disetujui';
        if (!statusOk) return false;
        return targetUid ? entry.uid === targetUid : Boolean(entry.uid);
      }
      return false;
    });
  }
  if (typeof permissionsApproved === 'object') {
    const status = 'status' in permissionsApproved ? permissionsApproved.status : 'disetujui';
    if (status !== 'disetujui') {
      return false;
    }
    if ('uid' in permissionsApproved && permissionsApproved.uid && targetUid) {
      return permissionsApproved.uid === targetUid;
    }
    return true;
  }
  return false;
}

/**
 * Kontrak utama Sprint 4 (`src/services/keterlambatan.ts`):
 * Menentukan status kehadiran seorang praktikan berdasarkan catatan presensi,
 * status izin yang disetujui, dan konfigurasi `gracePeriodMinutes` laboratorium.
 *
 * - Izin disetujui SELALU menghasilkan `'izin'` (excused absence, bebas denda,
 *   tidak pernah diubah menjadi `'hadir'`).
 * - Tanpa izin disetujui & tanpa presensi -> `'belum_hadir'`.
 * - Presensi tepat waktu (<= akhir grace period / `onTime === true`) -> `'hadir'`.
 * - Presensi melewati grace period (`onTime === false`) -> `'terlambat'`.
 */
export function resolveAttendanceStatus(
  attendance: AttendanceTimingRecord | null | undefined,
  permissionsApproved: PermissionApprovalInput,
  gracePeriodMinutes: number | null | undefined,
): ResolvedAttendanceStatus {
  const uid = attendance?.uid;
  if (isApprovedForAttendance(permissionsApproved, uid)) {
    return 'izin';
  }
  if (!attendance) {
    return 'belum_hadir';
  }
  const evaluation = evaluateAttendanceLateness(attendance, gracePeriodMinutes);
  return evaluation.onTime ? 'hadir' : 'terlambat';
}

/* ------------------------------------------------------------------ */
/* Label & agregasi tampilan (tidak bergantung pada warna saja)        */
/* ------------------------------------------------------------------ */

export type AttendanceStatusPresentation = {
  status: ResolvedAttendanceStatus;
  symbol: string;
  /** Label lengkap untuk tabel rekap Asprak (SRS-11). */
  recapLabel: string;
  /** Label ringkas untuk kartu & riwayat Praktikan (`PEMBAGIAN.md` Fitur C). */
  praktikanLabel: string;
};

export function describeAttendanceStatus(
  status: ResolvedAttendanceStatus,
  lateMinutes = 0,
): AttendanceStatusPresentation {
  const mins = Math.max(1, Math.round(lateMinutes || 1));
  switch (status) {
    case 'hadir':
      return {
        status: 'hadir',
        symbol: '✔',
        recapLabel: '✔ Hadir (tepat waktu)',
        praktikanLabel: '✔ Hadir',
      };
    case 'terlambat':
      return {
        status: 'terlambat',
        symbol: '⏱',
        recapLabel: `⏱ Terlambat (+${mins} menit)`,
        praktikanLabel: `⏱ Terlambat ${mins} menit`,
      };
    case 'izin':
      return {
        status: 'izin',
        symbol: '✎',
        recapLabel: '✎ Izin (excused)',
        praktikanLabel: '✎ Izin (Disetujui)',
      };
    case 'belum_hadir':
      return {
        status: 'belum_hadir',
        symbol: '○',
        recapLabel: '○ Belum hadir',
        praktikanLabel: '○ Belum Presensi',
      };
  }
}

export function formatRupiah(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    return '-';
  }
  const rounded = Math.round(amount);
  const formatted = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
}

export function formatFineStatusLabel(status: FineStatusLocal): string {
  switch (status) {
    case 'pending':
      return '● Menunggu Pembayaran';
    case 'paid':
      return '✔ Lunas';
    case 'failed':
      return '✕ Pembayaran Gagal (Perlu Ulang)';
    case 'dibatalkan':
      return '— Dibatalkan (Bebas Denda)';
  }
}

/**
 * Menyusun baris rekap kehadiran sesi beserta ringkasan jumlah keempat status.
 * Pembayaran denda (`fine.status === 'paid'`) tidak mengubah status `'terlambat'`.
 */
export function buildSessionRecap(params: {
  roster: readonly RosterMember[];
  attendanceList: readonly AttendanceTimingRecord[];
  approvedPermissions: readonly Pick<PermissionRequest, 'uid' | 'name' | 'classId' | 'reason' | 'status'>[];
  fines?: readonly FineRecordSummary[];
  session: Pick<Session, 'date' | 'startTime'>;
  gracePeriodMinutes: number | null | undefined;
}): { rows: SessionRecapRow[]; summary: SessionRecapSummary } {
  const {
    roster,
    attendanceList,
    approvedPermissions,
    fines = [],
    session,
    gracePeriodMinutes,
  } = params;

  const memberMap = new Map<string, RosterMember>();
  for (const member of roster) {
    if (member.uid) {
      memberMap.set(member.uid, member);
    }
  }
  // Pastikan praktikan yang sudah tercatat presensi atau izin disetujui pada sesi ini
  // tetap tampil meskipun baru dipindahkan antar-lab setelah sesi berlangsung.
  for (const att of attendanceList) {
    if (att.uid && !memberMap.has(att.uid)) {
      memberMap.set(att.uid, {
        uid: att.uid,
        name: att.name || att.uid,
        classId: att.classId || null,
      });
    }
  }
  for (const perm of approvedPermissions) {
    if (perm.uid && perm.status === 'disetujui' && !memberMap.has(perm.uid)) {
      memberMap.set(perm.uid, {
        uid: perm.uid,
        name: perm.name || perm.uid,
        classId: perm.classId || null,
      });
    }
  }

  const attendanceMap = new Map<string, AttendanceTimingRecord>();
  for (const att of attendanceList) {
    if (att.uid) {
      attendanceMap.set(att.uid, att);
    }
  }

  const approvedPermMap = new Map<string, { reason: string }>();
  for (const perm of approvedPermissions) {
    if (perm.uid && perm.status === 'disetujui') {
      approvedPermMap.set(perm.uid, { reason: perm.reason });
    }
  }

  const fineMap = new Map<string, FineRecordSummary>();
  for (const fine of fines) {
    if (fine.uid) {
      fineMap.set(fine.uid, fine);
    }
  }

  const members = Array.from(memberMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'id'),
  );

  const summary: SessionRecapSummary = {
    hadir: 0,
    terlambat: 0,
    izin: 0,
    belumHadir: 0,
    total: members.length,
  };

  const rows: SessionRecapRow[] = members.map((member) => {
    const rawAtt = attendanceMap.get(member.uid) ?? null;
    const enrichedAtt: AttendanceTimingRecord | null = rawAtt
      ? {
          ...rawAtt,
          sessionDate: rawAtt.sessionDate ?? session.date,
          sessionStartTime: rawAtt.sessionStartTime ?? session.startTime,
        }
      : null;

    const approvedPerm = approvedPermMap.get(member.uid) ?? null;
    const status = resolveAttendanceStatus(
      enrichedAtt,
      approvedPerm !== null,
      gracePeriodMinutes,
    );

    const lateness =
      status === 'terlambat' && enrichedAtt
        ? evaluateAttendanceLateness(enrichedAtt, gracePeriodMinutes)
        : { onTime: true, lateMinutes: 0, source: 'fallback' as const };

    if (status === 'hadir') summary.hadir += 1;
    else if (status === 'terlambat') summary.terlambat += 1;
    else if (status === 'izin') summary.izin += 1;
    else summary.belumHadir += 1;

    return {
      uid: member.uid,
      name: member.name || member.uid,
      classId: member.classId,
      status,
      attendedAt: status === 'izin' ? null : (enrichedAtt?.attendedAt ?? null),
      lateMinutes: status === 'terlambat' ? lateness.lateMinutes : 0,
      ...(enrichedAtt?.distanceMeters !== undefined
        ? { distanceMeters: enrichedAtt.distanceMeters }
        : {}),
      ...(enrichedAtt?.verificationMethod
        ? { verificationMethod: enrichedAtt.verificationMethod }
        : {}),
      permissionReason: approvedPerm?.reason ?? null,
      fine: fineMap.get(member.uid) ?? null,
    };
  });

  return { rows, summary };
}

/* ------------------------------------------------------------------ */
/* Listener Firestore untuk konfigurasi lab, presensi, izin, & denda   */
/* ------------------------------------------------------------------ */

export function subscribeLabConfigs(
  cb: (labs: LabLateConfig[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'laboratories'),
    (snap) => {
      const items = snap.docs
        .map((d) => mapLabLateConfig(d.id, d.data()))
        .sort((a, b) => a.name.localeCompare(b.name, 'id'));
      cb(items);
    },
    onError,
  );
}

export function subscribeLabConfigById(
  labId: string,
  cb: (lab: LabLateConfig | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'laboratories', labId),
    (snap) => {
      cb(snap.exists() ? mapLabLateConfig(snap.id, snap.data()) : null);
    },
    onError,
  );
}

export function subscribeMyAttendanceWithTiming(
  uid: string,
  cb: (records: AttendanceTimingRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const q = query(collectionGroup(db, 'attendance'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map((attDoc) =>
        mapAttendanceWithTiming(uid, attDoc.data(), attDoc.ref.parent.parent?.id ?? ''),
      );
      records.sort((a, b) => (b.attendedAt?.getTime() ?? 0) - (a.attendedAt?.getTime() ?? 0));
      cb(records);
    },
    onError,
  );
}

export function subscribeMyPermissionsMap(
  uid: string,
  cb: (items: { id: string; sessionId: string; status: PermissionStatus; reason: string }[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, 'permissions'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((permDoc) => {
        const d = permDoc.data();
        const status: PermissionStatus =
          d.status === 'disetujui' || d.status === 'ditolak' ? d.status : 'menunggu';
        return {
          id: permDoc.id,
          sessionId: typeof d.sessionId === 'string' ? d.sessionId : '',
          status,
          reason: typeof d.reason === 'string' ? d.reason : '',
        };
      });
      cb(items);
    },
    onError,
  );
}

/**
 * Mendengarkan daftar tagihan denda milik praktikan sendiri (`fines` where `uid == uid`).
 * Bila Security Rules Fase 0 belum di-deploy sehingga koleksi `fines` masih mengembalikan
 * `permission-denied`, kembalikan daftar kosong secara aman agar layar praktikan tidak rusak.
 */
export function subscribeMyFinesSummary(
  uid: string,
  cb: (fines: FineRecordSummary[], meta: { rulesReady: boolean }) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, 'fines'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((fineDoc) => mapFineSummary(fineDoc.id, fineDoc.data()))
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      cb(items, { rulesReady: true });
    },
    (err) => {
      const code =
        err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
          ? err.code
          : null;
      if (code === 'permission-denied') {
        cb([], { rulesReady: false });
        return;
      }
      onError(err);
    },
  );
}
