/**
 * Service Praktikum (Asprak) — Sprint 2, Fitur B (Mischa).
 *
 * Berisi listener realtime, CRUD kelas/jadwal/sesi, buka/tutup sesi, dan
 * pemindahan praktikan antar kelas. Nama koleksi/field mengikuti model data PRD.
 *
 * Semua listener mengembalikan fungsi `unsubscribe`.
 * Error validasi/aturan bisnis dilempar sebagai `ValidationError` (pesan sudah
 * Bahasa Indonesia); error lain (Firebase) dipetakan UI lewat `getErrorMessage`.
 */
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import type {
  AppUser,
  Attendance,
  ClassDoc,
  PermissionRequest,
  Schedule,
  Session,
} from '@/types';

/* ------------------------------------------------------------------ */
/* Error dan validasi                                                  */
/* ------------------------------------------------------------------ */

/** Error aturan bisnis/validasi dengan pesan yang aman ditampilkan ke pengguna. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Mengembalikan pesan error, atau null bila valid. */
export function validateTimeRange(start: string, end: string): string | null {
  if (!isValidTime(start)) {
    return 'Jam mulai harus berformat HH:MM (contoh 08:00).';
  }
  if (!isValidTime(end)) {
    return 'Jam selesai harus berformat HH:MM (contoh 09:40).';
  }
  // Format sudah tervalidasi, sehingga perbandingan string sama dengan waktu.
  if (end <= start) {
    return 'Jam selesai harus lebih besar dari jam mulai.';
  }
  return null;
}

export function validateClassName(name: string): string | null {
  const value = name.trim();
  if (!value) {
    return 'Nama kelas tidak boleh kosong.';
  }
  if (value.length > 40) {
    return 'Nama kelas maksimal 40 karakter.';
  }
  if (value.includes('/')) {
    return 'Nama kelas tidak boleh mengandung karakter "/".';
  }
  if (value === '.' || value === '..') {
    return 'Nama kelas tidak valid.';
  }
  return null;
}

export type ScheduleInput = {
  classId: string;
  course: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
};

export type SessionInput = {
  classId: string;
  scheduleId: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
};

export function validateScheduleInput(input: ScheduleInput): string | null {
  if (!input.classId) {
    return 'Pilih kelas terlebih dahulu.';
  }
  if (!input.course.trim()) {
    return 'Nama praktikum tidak boleh kosong.';
  }
  if (
    !Number.isInteger(input.dayOfWeek) ||
    input.dayOfWeek < 1 ||
    input.dayOfWeek > 7
  ) {
    return 'Pilih hari antara Senin sampai Minggu.';
  }
  if (!input.room.trim()) {
    return 'Ruangan tidak boleh kosong.';
  }
  return validateTimeRange(input.startTime, input.endTime);
}

export function validateSessionInput(input: SessionInput): string | null {
  if (!input.classId) {
    return 'Pilih kelas terlebih dahulu.';
  }
  if (!input.title.trim()) {
    return 'Judul sesi tidak boleh kosong.';
  }
  if (!isValidDate(input.date)) {
    return 'Tanggal harus berformat YYYY-MM-DD (contoh 2026-11-20) dan valid.';
  }
  return validateTimeRange(input.startTime, input.endTime);
}

function fail(message: string): never {
  throw new ValidationError(message);
}

/* ------------------------------------------------------------------ */
/* Pemetaan dokumen -> tipe                                            */
/* ------------------------------------------------------------------ */

type Callback<T> = (items: T[]) => void;
type ErrorCallback = (error: unknown) => void;

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function mapClass(id: string, d: DocumentData): ClassDoc {
  return { id, name: str(d.name, id) };
}

function mapSchedule(id: string, d: DocumentData): Schedule {
  return {
    id,
    classId: str(d.classId),
    course: str(d.course),
    dayOfWeek: typeof d.dayOfWeek === 'number' ? d.dayOfWeek : 1,
    startTime: str(d.startTime),
    endTime: str(d.endTime),
    room: str(d.room),
  };
}

function mapSession(id: string, d: DocumentData): Session {
  const status = d.status;
  return {
    id,
    classId: str(d.classId),
    scheduleId: typeof d.scheduleId === 'string' ? d.scheduleId : null,
    title: str(d.title),
    date: str(d.date),
    startTime: str(d.startTime),
    endTime: str(d.endTime),
    status:
      status === 'dibuka' || status === 'ditutup' ? status : 'belum_dibuka',
    openedAt: toDate(d.openedAt),
    closedAt: toDate(d.closedAt),
  };
}

function mapUser(id: string, d: DocumentData): AppUser {
  return {
    uid: id,
    name: str(d.name),
    email: str(d.email),
    role: d.role === 'asprak' ? 'asprak' : 'praktikan',
    classId: typeof d.classId === 'string' ? d.classId : null,
  };
}

function mapAttendance(id: string, d: DocumentData): Attendance {
  return {
    uid: str(d.uid, id),
    name: str(d.name),
    classId: str(d.classId),
    attendedAt: toDate(d.attendedAt),
  };
}

function mapPermission(id: string, d: DocumentData): PermissionRequest {
  const ai = (d.aiResult ?? {}) as DocumentData;
  return {
    id,
    uid: str(d.uid),
    name: str(d.name),
    classId: str(d.classId),
    sessionId: str(d.sessionId),
    sessionTitle: str(d.sessionTitle),
    reason: str(d.reason),
    status:
      d.status === 'disetujui' || d.status === 'ditolak' ? d.status : 'menunggu',
    aiResult: {
      status:
        ai.status === 'predicted' ||
        ai.status === 'unknown_vocabulary' ||
        ai.status === 'empty_input'
          ? ai.status
          : 'gagal',
      label:
        ai.label === 'positif' || ai.label === 'netral' || ai.label === 'negatif'
          ? ai.label
          : null,
      model: str(ai.model, 'model-edom'),
      experimental: ai.experimental !== false,
    },
    decidedBy: typeof d.decidedBy === 'string' ? d.decidedBy : null,
    decidedAt: toDate(d.decidedAt),
    createdAt: toDate(d.createdAt),
  };
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'id');

/* ------------------------------------------------------------------ */
/* Listener realtime                                                   */
/* ------------------------------------------------------------------ */

export function subscribeClasses(
  cb: Callback<ClassDoc>,
  onError: ErrorCallback,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'classes'),
    (snap) => cb(snap.docs.map((d) => mapClass(d.id, d.data())).sort(byName)),
    onError,
  );
}

/** `classId = null` → semua jadwal (asprak). */
export function subscribeSchedules(
  classId: string | null,
  cb: Callback<Schedule>,
  onError: ErrorCallback,
): Unsubscribe {
  const base = collection(db, 'schedules');
  const q = classId ? query(base, where('classId', '==', classId)) : base;
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs
          .map((d) => mapSchedule(d.id, d.data()))
          // Urut di klien (hindari composite index).
          .sort(
            (a, b) =>
              a.classId.localeCompare(b.classId, 'id') ||
              a.dayOfWeek - b.dayOfWeek ||
              a.startTime.localeCompare(b.startTime),
          ),
      ),
    onError,
  );
}

/** `classId = null` → semua sesi (asprak). */
export function subscribeSessions(
  classId: string | null,
  cb: Callback<Session>,
  onError: ErrorCallback,
): Unsubscribe {
  const base = collection(db, 'sessions');
  const q = classId ? query(base, where('classId', '==', classId)) : base;
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs
          .map((d) => mapSession(d.id, d.data()))
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) ||
              a.startTime.localeCompare(b.startTime) ||
              a.title.localeCompare(b.title, 'id'),
          ),
      ),
    onError,
  );
}

/** Praktikan (role praktikan) pada satu kelas, atau semua bila `null`. Asprak saja. */
export function subscribePraktikanByClass(
  classId: string | null,
  cb: Callback<AppUser>,
  onError: ErrorCallback,
): Unsubscribe {
  const base = collection(db, 'users');
  const q = classId
    ? query(base, where('role', '==', 'praktikan'), where('classId', '==', classId))
    : query(base, where('role', '==', 'praktikan'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => mapUser(d.id, d.data())).sort(byName)),
    onError,
  );
}

export function subscribeAttendance(
  sessionId: string,
  cb: Callback<Attendance>,
  onError: ErrorCallback,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'sessions', sessionId, 'attendance'),
    (snap) => cb(snap.docs.map((d) => mapAttendance(d.id, d.data()))),
    onError,
  );
}

export function subscribeApprovedPermissionsBySession(
  sessionId: string,
  cb: Callback<PermissionRequest>,
  onError: ErrorCallback,
): Unsubscribe {
  const q = query(
    collection(db, 'permissions'),
    where('sessionId', '==', sessionId),
    where('status', '==', 'disetujui'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => mapPermission(d.id, d.data()))),
    onError,
  );
}

/* ------------------------------------------------------------------ */
/* Helper cek data terkait                                             */
/* ------------------------------------------------------------------ */

async function classExists(classId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'classes', classId));
  return snap.exists();
}

async function hasAny(q: Query): Promise<boolean> {
  const snap = await getDocs(query(q, limit(1)));
  return !snap.empty;
}

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    fail('Anda belum login. Silakan login kembali.');
  }
  return uid;
}

/* ------------------------------------------------------------------ */
/* CRUD kelas                                                          */
/* ------------------------------------------------------------------ */

async function assertClassNameUnique(name: string, exceptId?: string) {
  const snap = await getDocs(collection(db, 'classes'));
  const target = name.trim().toLocaleLowerCase('id');
  const clash = snap.docs.some(
    (d) =>
      d.id !== exceptId &&
      (str(d.data().name, d.id).trim().toLocaleLowerCase('id') === target ||
        d.id.toLocaleLowerCase('id') === target),
  );
  if (clash) {
    fail(`Kelas dengan nama "${name.trim()}" sudah ada.`);
  }
}

/** ID dokumen = nama kelas (sesuai contoh PRD: id "SI-5A"). */
export async function createClass(name: string): Promise<void> {
  const error = validateClassName(name);
  if (error) {
    fail(error);
  }
  const value = name.trim();
  await assertClassNameUnique(value);
  await setDoc(doc(db, 'classes', value), {
    name: value,
    createdAt: serverTimestamp(),
  });
}

/** Hanya mengubah `name`; ID dokumen tetap agar referensi `classId` tidak putus. */
export async function updateClass(id: string, name: string): Promise<void> {
  const error = validateClassName(name);
  if (error) {
    fail(error);
  }
  if (!(await classExists(id))) {
    fail('Kelas tidak ditemukan. Mungkin sudah dihapus.');
  }
  await assertClassNameUnique(name, id);
  await updateDoc(doc(db, 'classes', id), { name: name.trim() });
}

export async function deleteClass(id: string): Promise<void> {
  if (!(await classExists(id))) {
    fail('Kelas tidak ditemukan. Mungkin sudah dihapus.');
  }
  const [hasUsers, hasSessions, hasSchedules] = await Promise.all([
    hasAny(query(collection(db, 'users'), where('classId', '==', id))),
    hasAny(query(collection(db, 'sessions'), where('classId', '==', id))),
    hasAny(query(collection(db, 'schedules'), where('classId', '==', id))),
  ]);
  const reasons: string[] = [];
  if (hasUsers) reasons.push('praktikan');
  if (hasSchedules) reasons.push('jadwal');
  if (hasSessions) reasons.push('sesi');
  if (reasons.length > 0) {
    fail(
      `Kelas tidak dapat dihapus karena masih memiliki ${reasons.join(', ')}. ` +
        'Pindahkan atau hapus data tersebut terlebih dahulu.',
    );
  }
  await deleteDoc(doc(db, 'classes', id));
}

/* ------------------------------------------------------------------ */
/* CRUD jadwal                                                         */
/* ------------------------------------------------------------------ */

async function assertScheduleUnique(input: ScheduleInput, exceptId?: string) {
  const snap = await getDocs(
    query(collection(db, 'schedules'), where('classId', '==', input.classId)),
  );
  const course = input.course.trim().toLocaleLowerCase('id');
  const clash = snap.docs.some((d) => {
    const s = d.data();
    return (
      d.id !== exceptId &&
      str(s.course).trim().toLocaleLowerCase('id') === course &&
      s.dayOfWeek === input.dayOfWeek &&
      s.startTime === input.startTime
    );
  });
  if (clash) {
    fail('Jadwal yang sama (praktikum, hari, dan jam mulai) sudah ada di kelas ini.');
  }
}

export async function createSchedule(input: ScheduleInput): Promise<void> {
  const error = validateScheduleInput(input);
  if (error) {
    fail(error);
  }
  if (!(await classExists(input.classId))) {
    fail('Kelas yang dipilih tidak ada.');
  }
  await assertScheduleUnique(input);
  await setDoc(doc(collection(db, 'schedules')), {
    classId: input.classId,
    course: input.course.trim(),
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function updateSchedule(
  id: string,
  input: ScheduleInput,
): Promise<void> {
  const error = validateScheduleInput(input);
  if (error) {
    fail(error);
  }
  if (!(await getDoc(doc(db, 'schedules', id))).exists()) {
    fail('Jadwal tidak ditemukan. Mungkin sudah dihapus.');
  }
  if (!(await classExists(input.classId))) {
    fail('Kelas yang dipilih tidak ada.');
  }
  await assertScheduleUnique(input, id);
  await updateDoc(doc(db, 'schedules', id), {
    classId: input.classId,
    course: input.course.trim(),
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room.trim(),
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  if (!(await getDoc(doc(db, 'schedules', id))).exists()) {
    fail('Jadwal tidak ditemukan. Mungkin sudah dihapus.');
  }
  await deleteDoc(doc(db, 'schedules', id));
}

/* ------------------------------------------------------------------ */
/* CRUD sesi                                                           */
/* ------------------------------------------------------------------ */

async function assertScheduleBelongsToClass(
  scheduleId: string | null,
  classId: string,
) {
  if (!scheduleId) {
    return;
  }
  const snap = await getDoc(doc(db, 'schedules', scheduleId));
  if (!snap.exists()) {
    fail('Jadwal yang dipilih tidak ada.');
  }
  if (str(snap.data().classId) !== classId) {
    fail('Jadwal yang dipilih bukan milik kelas ini.');
  }
}

async function assertSessionUnique(input: SessionInput, exceptId?: string) {
  const snap = await getDocs(
    query(collection(db, 'sessions'), where('classId', '==', input.classId)),
  );
  const title = input.title.trim().toLocaleLowerCase('id');
  const clash = snap.docs.some((d) => {
    const s = d.data();
    return (
      d.id !== exceptId &&
      str(s.title).trim().toLocaleLowerCase('id') === title &&
      s.date === input.date
    );
  });
  if (clash) {
    fail('Sesi dengan judul dan tanggal yang sama sudah ada di kelas ini.');
  }
}

export async function createSession(input: SessionInput): Promise<void> {
  const error = validateSessionInput(input);
  if (error) {
    fail(error);
  }
  const uid = currentUid();
  if (!(await classExists(input.classId))) {
    fail('Kelas yang dipilih tidak ada.');
  }
  await assertScheduleBelongsToClass(input.scheduleId, input.classId);
  await assertSessionUnique(input);
  await setDoc(doc(collection(db, 'sessions')), {
    classId: input.classId,
    scheduleId: input.scheduleId,
    title: input.title.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    status: 'belum_dibuka',
    openedAt: null,
    closedAt: null,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}

/** Status TIDAK diubah di sini; gunakan `openSession`/`closeSession`. */
export async function updateSession(
  id: string,
  input: SessionInput,
): Promise<void> {
  const error = validateSessionInput(input);
  if (error) {
    fail(error);
  }
  const ref = doc(db, 'sessions', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    fail('Sesi tidak ditemukan. Mungkin sudah dihapus.');
  }
  if (!(await classExists(input.classId))) {
    fail('Kelas yang dipilih tidak ada.');
  }
  if (str(snap.data().classId) !== input.classId) {
    const hasAttendance = await hasAny(
      collection(db, 'sessions', id, 'attendance'),
    );
    if (hasAttendance) {
      fail('Kelas sesi tidak dapat diubah karena sesi sudah memiliki presensi.');
    }
  }
  await assertScheduleBelongsToClass(input.scheduleId, input.classId);
  await assertSessionUnique(input, id);
  await updateDoc(ref, {
    classId: input.classId,
    scheduleId: input.scheduleId,
    title: input.title.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
  });
}

export async function deleteSession(id: string): Promise<void> {
  if (!(await getDoc(doc(db, 'sessions', id))).exists()) {
    fail('Sesi tidak ditemukan. Mungkin sudah dihapus.');
  }
  if (await hasAny(collection(db, 'sessions', id, 'attendance'))) {
    fail('Sesi tidak dapat dihapus karena sudah memiliki presensi.');
  }
  await deleteDoc(doc(db, 'sessions', id));
}

/* ------------------------------------------------------------------ */
/* Buka / tutup sesi                                                   */
/* ------------------------------------------------------------------ */

const STATUS_LABEL = {
  belum_dibuka: 'Belum dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
} as const;

/**
 * Transisi hanya belum_dibuka → dibuka → ditutup. Memakai transaksi agar
 * validasi memakai status terkini di server (mis. sudah diubah perangkat lain
 * atau ketukan ganda).
 */
async function transition(
  id: string,
  from: 'belum_dibuka' | 'dibuka',
  to: 'dibuka' | 'ditutup',
): Promise<void> {
  const ref = doc(db, 'sessions', id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      fail('Sesi tidak ditemukan. Mungkin sudah dihapus.');
    }
    const current = mapSession(snap.id, snap.data()).status;
    if (current !== from) {
      fail(
        `Sesi tidak dapat ${to === 'dibuka' ? 'dibuka' : 'ditutup'} karena statusnya sekarang "${STATUS_LABEL[current]}".`,
      );
    }
    tx.update(
      ref,
      to === 'dibuka'
        ? { status: 'dibuka', openedAt: serverTimestamp() }
        : { status: 'ditutup', closedAt: serverTimestamp() },
    );
  });
}

export function openSession(id: string): Promise<void> {
  return transition(id, 'belum_dibuka', 'dibuka');
}

export function closeSession(id: string): Promise<void> {
  return transition(id, 'dibuka', 'ditutup');
}

/* ------------------------------------------------------------------ */
/* Pindah kelas                                                        */
/* ------------------------------------------------------------------ */

/** Hanya menulis `users/{uid}.classId` (sesuai Security Rules). */
export async function movePraktikanToClass(
  uid: string,
  newClassId: string,
): Promise<void> {
  if (!newClassId) {
    fail('Pilih kelas tujuan terlebih dahulu.');
  }
  const userRef = doc(db, 'users', uid);
  const classRef = doc(db, 'classes', newClassId);
  await runTransaction(db, async (tx) => {
    const [userSnap, classSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(classRef),
    ]);
    if (!userSnap.exists() || userSnap.data().role !== 'praktikan') {
      fail('Praktikan tidak ditemukan.');
    }
    if (!classSnap.exists()) {
      fail('Kelas tujuan tidak ada.');
    }
    if (userSnap.data().classId === newClassId) {
      fail('Kelas tujuan sama dengan kelas saat ini.');
    }
    tx.update(userRef, { classId: newClassId });
  });
}
