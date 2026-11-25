/**
 * Service Presensi Praktikan — Sprint 2 + Sprint 3 (dialihkan ke Moses).
 *
 * Menangani:
 * - Listener realtime jadwal, sesi (termasuk relasi `labId`), sesi tunggal,
 *   laboratorium tunggal, status presensi sesi, dan riwayat presensi praktikan.
 * - Pencatatan presensi berbasis lokasi (`markAttendanceWithLocation`) yang
 *   wajib melalui jalur verifikasi atomik (`verifyAndRecordAttendance` milik Dewa),
 *   bukan `setDoc` langsung dari UI.
 *
 * Kontrak: docs/PRD.md dan docs/PEMBAGIAN.md (Sprint 2 & Sprint 3).
 */
import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import type {
  AppUser,
  Attendance,
  Laboratory,
  Schedule,
  Session,
  SessionStatus,
} from '../types';
import { getErrorMessage } from '../utils/errors';
import { verifyAndRecordAttendance } from './attendance-verification';
import {
  validateLocationReading,
  type LocationReading,
} from './lokasi';

export type AttendanceWithSession = Attendance & {
  sessionId: string;
};

export type AttendanceLocationResult = {
  success: boolean;
  distanceMeters: number;
  message: string;
};

export type MarkAttendanceLocationOptions = {
  isOnline?: boolean;
  maxAccuracyMeters?: number;
  maxAgeMs?: number;
};

/* ------------------------------------------------------------------ */
/* Pemetaan dokumen Firestore -> tipe aplikasi                         */
/* ------------------------------------------------------------------ */

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function toSessionStatus(value: unknown): SessionStatus {
  return value === 'dibuka' || value === 'ditutup' ? value : 'belum_dibuka';
}

function mapSession(id: string, data: DocumentData): Session {
  const labId = toOptionalString(data.labId);
  return {
    id,
    classId: typeof data.classId === 'string' ? data.classId : '',
    scheduleId: typeof data.scheduleId === 'string' ? data.scheduleId : null,
    title: typeof data.title === 'string' ? data.title : id,
    date: typeof data.date === 'string' ? data.date : '',
    startTime: typeof data.startTime === 'string' ? data.startTime : '',
    endTime: typeof data.endTime === 'string' ? data.endTime : '',
    status: toSessionStatus(data.status),
    openedAt: toDate(data.openedAt),
    closedAt: toDate(data.closedAt),
    ...(labId ? { labId } : {}),
  };
}

function mapSchedule(id: string, data: DocumentData): Schedule {
  const labId = toOptionalString(data.labId);
  return {
    id,
    classId: typeof data.classId === 'string' ? data.classId : '',
    course: typeof data.course === 'string' ? data.course : id,
    dayOfWeek: typeof data.dayOfWeek === 'number' ? data.dayOfWeek : 1,
    startTime: typeof data.startTime === 'string' ? data.startTime : '',
    endTime: typeof data.endTime === 'string' ? data.endTime : '',
    room: typeof data.room === 'string' ? data.room : '',
    ...(labId ? { labId } : {}),
  };
}

function mapAttendance(data: DocumentData): Attendance {
  const method =
    data.verificationMethod === 'geolocation' || data.verificationMethod === 'manual'
      ? data.verificationMethod
      : undefined;
  const distanceMeters =
    typeof data.distanceMeters === 'number' && Number.isFinite(data.distanceMeters)
      ? data.distanceMeters
      : undefined;
  const validatedAt = toDate(data.validatedAt);

  return {
    uid: typeof data.uid === 'string' ? data.uid : '',
    name: typeof data.name === 'string' ? data.name : '',
    classId: typeof data.classId === 'string' ? data.classId : '',
    attendedAt: toDate(data.attendedAt),
    ...(method ? { verificationMethod: method } : {}),
    ...(distanceMeters !== undefined ? { distanceMeters } : {}),
    ...(validatedAt !== null ? { validatedAt } : {}),
  };
}

function mapLaboratory(id: string, data: DocumentData): Laboratory {
  return {
    id,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : id,
    latitude: typeof data.latitude === 'number' && Number.isFinite(data.latitude) ? data.latitude : 0,
    longitude: typeof data.longitude === 'number' && Number.isFinite(data.longitude) ? data.longitude : 0,
    radiusMeters:
      typeof data.radiusMeters === 'number' && Number.isFinite(data.radiusMeters)
        ? data.radiusMeters
        : 0,
    active: data.active !== false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

/**
 * Memetakan error Firebase maupun error aturan bisnis menjadi pesan Bahasa
 * Indonesia yang aman ditampilkan di UI (tidak membocorkan error mentah).
 */
export function mapAttendanceError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null;

  if (code === 'permission-denied') {
    return 'Presensi ditolak sistem. Pastikan sesi masih dibuka, Anda terdaftar pada kelas tersebut, dan Anda belum presensi.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return 'Koneksi ke server bermasalah. Periksa jaringan Anda lalu coba lagi.';
  }
  if (code === 'aborted' || code === 'failed-precondition') {
    return 'Terjadi perubahan data sesi secara bersamaan. Muat ulang lalu coba lagi.';
  }
  if (code) {
    return getErrorMessage(error);
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Gagal mencatat presensi. Silakan coba lagi.';
}

/* ------------------------------------------------------------------ */
/* Listener realtime praktikan                                         */
/* ------------------------------------------------------------------ */

export function subscribeMySessions(
  classId: string,
  cb: (sessions: Session[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const sessionsQuery = query(
    collection(db, 'sessions'),
    where('classId', '==', classId),
  );

  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      const sessions: Session[] = snapshot.docs
        .map((sessionDoc) => mapSession(sessionDoc.id, sessionDoc.data()))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

      cb(sessions);
    },
    (error) => onError(error),
  );
}

export function subscribeMySchedules(
  classId: string,
  cb: (schedules: Schedule[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const schedulesQuery = query(
    collection(db, 'schedules'),
    where('classId', '==', classId),
  );

  return onSnapshot(
    schedulesQuery,
    (snapshot) => {
      const schedules: Schedule[] = snapshot.docs
        .map((scheduleDoc) => mapSchedule(scheduleDoc.id, scheduleDoc.data()))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

      cb(schedules);
    },
    (error) => onError(error),
  );
}

export function subscribeMyAttendance(
  uid: string,
  cb: (attendance: AttendanceWithSession[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const attendanceQuery = query(
    collectionGroup(db, 'attendance'),
    where('uid', '==', uid),
  );

  return onSnapshot(
    attendanceQuery,
    (snapshot) => {
      const attendance: AttendanceWithSession[] = snapshot.docs.map((attendanceDoc) => ({
        sessionId: attendanceDoc.ref.parent.parent?.id ?? '',
        ...mapAttendance(attendanceDoc.data()),
      }));

      attendance.sort(
        (a, b) => (b.attendedAt?.getTime() ?? 0) - (a.attendedAt?.getTime() ?? 0),
      );

      cb(attendance);
    },
    (error) => onError(error),
  );
}

/** Listener satu sesi realtime untuk halaman presensi khusus (`/presensi-lokasi`). */
export function subscribeSessionById(
  sessionId: string,
  cb: (session: Session | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'sessions', sessionId),
    (snapshot) => {
      cb(snapshot.exists() ? mapSession(snapshot.id, snapshot.data()) : null);
    },
    (error) => onError(error),
  );
}

/** Listener satu laboratorium realtime (koordinat, radius, status aktif). */
export function subscribeLaboratoryById(
  labId: string,
  cb: (lab: Laboratory | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'laboratories', labId),
    (snapshot) => {
      cb(snapshot.exists() ? mapLaboratory(snapshot.id, snapshot.data()) : null);
    },
    (error) => onError(error),
  );
}

/** Listener status kehadiran pengguna sendiri pada satu sesi secara realtime. */
export function subscribeMySessionAttendance(
  sessionId: string,
  uid: string,
  cb: (attendance: Attendance | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'sessions', sessionId, 'attendance', uid),
    (snapshot) => {
      cb(snapshot.exists() ? mapAttendance(snapshot.data()) : null);
    },
    (error) => onError(error),
  );
}

/* ------------------------------------------------------------------ */
/* Pencatatan presensi berbasis lokasi (Sprint 3 — SRS-02)             */
/* ------------------------------------------------------------------ */

/**
 * Mencatat presensi berbasis lokasi dengan memvalidasi kondisi jaringan,
 * peran, akurasi/kesegaran GPS, lalu memanggil jalur verifikasi atomik
 * (`verifyAndRecordAttendance`) milik Dewa — tidak melakukan `setDoc` langsung.
 */
export async function markAttendanceWithLocation(
  user: AppUser,
  sessionId: string,
  reading: LocationReading,
  options?: MarkAttendanceLocationOptions,
): Promise<AttendanceLocationResult> {
  if (options?.isOnline === false) {
    throw new Error(
      'Perangkat sedang offline. Presensi lokasi memerlukan koneksi internet untuk verifikasi server.',
    );
  }

  if (user.role !== 'praktikan') {
    throw new Error('Hanya praktikan yang dapat melakukan presensi.');
  }

  if (!user.classId) {
    throw new Error('Kelas praktikan belum tersedia di akun Anda.');
  }

  const trimmedSessionId = sessionId.trim();
  if (!trimmedSessionId) {
    throw new Error('Sesi praktikum tidak valid.');
  }

  const readingCheck = validateLocationReading(reading, {
    maxAccuracyMeters: options?.maxAccuracyMeters,
    maxAgeMs: options?.maxAgeMs,
  });
  if (!readingCheck.valid) {
    throw new Error(readingCheck.message);
  }

  try {
    return await verifyAndRecordAttendance(user, trimmedSessionId, {
      latitude: reading.latitude,
      longitude: reading.longitude,
      accuracy: reading.accuracy,
    });
  } catch (error) {
    throw new Error(mapAttendanceError(error));
  }
}

/* ------------------------------------------------------------------ */
/* Kompatibilitas mundur Sprint 2 (dipakai `use-presensi.ts` lama)     */
/* ------------------------------------------------------------------ */

export async function markAttendance(
  user: AppUser,
  session: Session,
): Promise<void> {
  if (!user.classId) {
    throw new Error('Kelas praktikan belum tersedia.');
  }

  if (user.role !== 'praktikan') {
    throw new Error('Hanya praktikan yang dapat melakukan presensi.');
  }

  if (user.classId !== session.classId) {
    throw new Error('Sesi ini bukan untuk kelasmu.');
  }

  const sessionRef = doc(db, 'sessions', session.id);
  const attendanceRef = doc(db, 'sessions', session.id, 'attendance', user.uid);

  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(sessionRef);
    const attendanceSnapshot = await transaction.get(attendanceRef);

    if (!sessionSnapshot.exists()) {
      throw new Error('Sesi praktikum tidak ditemukan.');
    }

    const sessionData = sessionSnapshot.data();

    if (sessionData.classId !== user.classId) {
      throw new Error('Kelas praktikan tidak sesuai.');
    }

    if (sessionData.status !== 'dibuka') {
      throw new Error('Presensi hanya tersedia saat sesi dibuka.');
    }

    if (attendanceSnapshot.exists()) {
      throw new Error('Kamu sudah melakukan presensi pada sesi ini.');
    }

    transaction.set(attendanceRef, {
      uid: user.uid,
      name: user.name,
      classId: user.classId,
      attendedAt: serverTimestamp(),
    });
  });
}
