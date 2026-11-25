/**
 * Service Laboratorium & Aktivitas Lab — Sprint 3, SRS-03 + SRS-05 (Mischa).
 *
 * - CRUD `laboratories/{labId}`: nama, latitude, longitude, radiusMeters, active.
 * - Listener realtime `laboratories` dan aktivitas per lab (berlangsung/berikutnya).
 * - Aktivitas lab bersumber dari koleksi `sessions` yang sudah ada (field `labId`
 *   relasi Sprint 3) — tidak membuat sumber data baru.
 *
 * Kontrak antarmodul (dipakai Moses untuk Maps):
 *   subscribeLaboratories(onData, onError): Unsubscribe
 *   subscribeLabActivity(labId, onData, onError): Unsubscribe
 *   createLaboratory(input) / updateLaboratory(id, input) / deactivateLaboratory(id)
 *
 * Semua listener mengembalikan fungsi `unsubscribe`. Error aturan bisnis
 * dilempar sebagai `ValidationError` (pesan Bahasa Indonesia).
 *
 * Definisi aktivitas yang disepakati (zona waktu Asia/Jakarta):
 * - "Berlangsung"  : sesi ber-status `dibuka` pada lab tersebut.
 * - "Berikutnya"   : sesi ber-status `belum_dibuka` dengan tanggal terdekat
 *   (tanggal >= hari ini, zona Asia/Jakarta). Sesi `ditutup` tidak termasuk.
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
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { ValidationError } from '@/services/praktikum';
import type { SessionStatus } from '@/types';

/* ------------------------------------------------------------------ */
/* Konstanta (keputusan operasional — lihat PRD 5C, masih terbuka PM)   */
/* ------------------------------------------------------------------ */

/** Zona waktu penentuan "hari ini" untuk sesi berikutnya. */
export const LAB_TIMEZONE = 'Asia/Jakarta';

/**
 * Batas radius maksimum (meter). Angka contoh PRD tidak dipakai; nilai ini
 * adalah usulan awal dan wajib dikonfirmasi PM sebelum rilis.
 */
export const MAX_RADIUS_METERS = 500;

const MAX_NAME_LENGTH = 60;

/* ------------------------------------------------------------------ */
/* Tipe                                                                */
/* ------------------------------------------------------------------ */

export type Laboratorium = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type LaboratoriumInput = {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

/** Sesi dengan relasi lab (pemetaan lokal; `Session` milik Sprint 2 tidak diubah). */
export type SessionLabInfo = {
  id: string;
  classId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  labId: string | null;
};

/** Jadwal dengan relasi lab. */
export type ScheduleLabInfo = {
  id: string;
  classId: string;
  course: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  labId: string | null;
};

/** Satu item aktivitas lab: kelas, praktikum, waktu, status. */
export type LabActivitySession = {
  id: string;
  classId: string;
  className: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
};

export type LabActivity = {
  labId: string;
  /** Sesi ber-status `dibuka` pada lab ini. */
  berlangsung: LabActivitySession[];
  /** Sesi `belum_dibuka` terdekat, atau null. */
  berikutnya: LabActivitySession | null;
};

type Callback<T> = (items: T[]) => void;
type ErrorCallback = (error: unknown) => void;

/* ------------------------------------------------------------------ */
/* Validasi                                                            */
/* ------------------------------------------------------------------ */

function fail(message: string): never {
  throw new ValidationError(message);
}

/** Mengembalikan pesan error, atau null bila valid. */
export function validateLaboratoriumInput(input: LaboratoriumInput): string | null {
  const name = input.name.trim();
  if (!name) {
    return 'Nama laboratorium tidak boleh kosong.';
  }
  if (name.length > MAX_NAME_LENGTH) {
    return `Nama laboratorium maksimal ${MAX_NAME_LENGTH} karakter.`;
  }
  if (!Number.isFinite(input.latitude)) {
    return 'Latitude harus berupa angka.';
  }
  if (input.latitude < -90 || input.latitude > 90) {
    return 'Latitude harus di antara -90 dan 90.';
  }
  if (!Number.isFinite(input.longitude)) {
    return 'Longitude harus berupa angka.';
  }
  if (input.longitude < -180 || input.longitude > 180) {
    return 'Longitude harus di antara -180 dan 180.';
  }
  if (!Number.isFinite(input.radiusMeters)) {
    return 'Radius harus berupa angka.';
  }
  if (input.radiusMeters <= 0) {
    return 'Radius harus lebih besar dari 0 meter.';
  }
  if (input.radiusMeters > MAX_RADIUS_METERS) {
    return `Radius maksimum ${MAX_RADIUS_METERS} meter (batas operasional sementara).`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Pemetaan dokumen -> tipe                                            */
/* ------------------------------------------------------------------ */

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function mapLaboratorium(id: string, d: DocumentData): Laboratorium {
  return {
    id,
    name: str(d.name, id),
    latitude: num(d.latitude),
    longitude: num(d.longitude),
    radiusMeters: num(d.radiusMeters),
    active: d.active !== false,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

function mapSessionLab(id: string, d: DocumentData): SessionLabInfo {
  const status = d.status;
  return {
    id,
    classId: str(d.classId),
    title: str(d.title),
    date: str(d.date),
    startTime: str(d.startTime),
    endTime: str(d.endTime),
    status:
      status === 'dibuka' || status === 'ditutup' ? status : 'belum_dibuka',
    labId: typeof d.labId === 'string' ? d.labId : null,
  };
}

function mapScheduleLab(id: string, d: DocumentData): ScheduleLabInfo {
  return {
    id,
    classId: str(d.classId),
    course: str(d.course),
    dayOfWeek: typeof d.dayOfWeek === 'number' ? d.dayOfWeek : 1,
    startTime: str(d.startTime),
    endTime: str(d.endTime),
    room: str(d.room),
    labId: typeof d.labId === 'string' ? d.labId : null,
  };
}

/* ------------------------------------------------------------------ */
/* Definisi "hari ini" (zona Asia/Jakarta)                             */
/* ------------------------------------------------------------------ */

/** "YYYY-MM-DD" tanggal hari ini menurut zona waktu lab. */
export function todayInLabTimezone(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: LAB_TIMEZONE });
}

const byDateTime = (a: { date: string; startTime: string }, b: { date: string; startTime: string }) =>
  a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);

/* ------------------------------------------------------------------ */
/* Listener realtime — laboratorium                                   */
/* ------------------------------------------------------------------ */

/** Semua lab (termasuk nonaktif; pemanggil menyaring sendiri bila perlu). */
export function subscribeLaboratories(
  onData: Callback<Laboratorium>,
  onError: ErrorCallback,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'laboratories'),
    (snap) =>
      onData(
        snap.docs
          .map((d) => mapLaboratorium(d.id, d.data()))
          .sort((a, b) => a.name.localeCompare(b.name, 'id')),
      ),
    onError,
  );
}

/** Semua sesi beserta relasi `labId`-nya (untuk panel relasi & aktivitas). */
export function subscribeSessionsWithLab(
  onData: Callback<SessionLabInfo>,
  onError: ErrorCallback,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'sessions'),
    (snap) =>
      onData(snap.docs.map((d) => mapSessionLab(d.id, d.data())).sort(byDateTime)),
    onError,
  );
}

/** Semua jadwal beserta relasi `labId`-nya. */
export function subscribeSchedulesWithLab(
  onData: Callback<ScheduleLabInfo>,
  onError: ErrorCallback,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'schedules'),
    (snap) =>
      onData(
        snap.docs
          .map((d) => mapScheduleLab(d.id, d.data()))
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

/* ------------------------------------------------------------------ */
/* Listener aktivitas lab (SRS-05)                                     */
/* ------------------------------------------------------------------ */

function computeLabActivity(
  labId: string,
  sessions: SessionLabInfo[],
  classNames: Map<string, string>,
): LabActivity {
  const toActivity = (s: SessionLabInfo): LabActivitySession => ({
    id: s.id,
    classId: s.classId,
    className: classNames.get(s.classId) ?? s.classId,
    title: s.title,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
  });

  const berlangsung = sessions
    .filter((s) => s.status === 'dibuka')
    .sort(byDateTime)
    .map(toActivity);

  const today = todayInLabTimezone();
  const upcoming = sessions
    .filter((s) => s.status === 'belum_dibuka' && s.date >= today)
    .sort(byDateTime);

  return {
    labId,
    berlangsung,
    berikutnya: upcoming.length > 0 ? toActivity(upcoming[0]) : null,
  };
}

/**
 * Aktivitas satu lab secara realtime: menggabungkan listener sesi lab
 * (`sessions` ber-`labId` terkait) dan listener kelas (nama kelas).
 * Kedua listener dihentikan oleh `unsubscribe` yang dikembalikan.
 */
export function subscribeLabActivity(
  labId: string,
  onData: (activity: LabActivity) => void,
  onError: ErrorCallback,
): Unsubscribe {
  let sessions: SessionLabInfo[] = [];
  let classNames = new Map<string, string>();

  const emit = () => onData(computeLabActivity(labId, sessions, classNames));

  const stopSessions = onSnapshot(
    query(collection(db, 'sessions'), where('labId', '==', labId)),
    (snap) => {
      sessions = snap.docs.map((d) => mapSessionLab(d.id, d.data()));
      emit();
    },
    onError,
  );
  const stopClasses = onSnapshot(
    collection(db, 'classes'),
    (snap) => {
      classNames = new Map(
        snap.docs.map((d) => [d.id, str(d.data().name, d.id)]),
      );
      emit();
    },
    onError,
  );

  return () => {
    stopSessions();
    stopClasses();
  };
}

/* ------------------------------------------------------------------ */
/* CRUD laboratorium (SRS-03)                                          */
/* ------------------------------------------------------------------ */

async function assertLabNameUnique(name: string, exceptId?: string) {
  const snap = await getDocs(collection(db, 'laboratories'));
  const target = name.trim().toLocaleLowerCase('id');
  const clash = snap.docs.some(
    (d) => d.id !== exceptId && str(d.data().name, d.id).trim().toLocaleLowerCase('id') === target,
  );
  if (clash) {
    fail(`Laboratorium dengan nama "${name.trim()}" sudah ada.`);
  }
}

async function labExists(labId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'laboratories', labId));
  return snap.exists();
}

/** Lab valid untuk dihubungkan: ada dan aktif. */
async function assertLabUsable(labId: string | null | undefined) {
  if (!labId) {
    return;
  }
  const snap = await getDoc(doc(db, 'laboratories', labId));
  if (!snap.exists()) {
    fail('Laboratorium yang dipilih tidak ada. Mungkin sudah dihapus.');
  }
  if (snap.data().active === false) {
    fail('Laboratorium yang dipilih sedang nonaktif. Aktifkan lab terlebih dahulu.');
  }
}

export async function createLaboratory(input: LaboratoriumInput): Promise<void> {
  const error = validateLaboratoriumInput(input);
  if (error) {
    fail(error);
  }
  await assertLabNameUnique(input.name);
  await setDoc(doc(collection(db, 'laboratories')), {
    name: input.name.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMeters: input.radiusMeters,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateLaboratory(
  id: string,
  input: LaboratoriumInput,
): Promise<void> {
  const error = validateLaboratoriumInput(input);
  if (error) {
    fail(error);
  }
  if (!(await labExists(id))) {
    fail('Laboratorium tidak ditemukan. Mungkin sudah dihapus.');
  }
  await assertLabNameUnique(input.name, id);
  await updateDoc(doc(db, 'laboratories', id), {
    name: input.name.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMeters: input.radiusMeters,
    updatedAt: serverTimestamp(),
  });
}

/** Nonaktifkan lab (bukan hapus): marker Maps tinggal menandai nonaktif. */
export async function deactivateLaboratory(id: string): Promise<void> {
  if (!(await labExists(id))) {
    fail('Laboratorium tidak ditemukan. Mungkin sudah dihapus.');
  }
  await updateDoc(doc(db, 'laboratories', id), {
    active: false,
    updatedAt: serverTimestamp(),
  });
}

export async function activateLaboratory(id: string): Promise<void> {
  if (!(await labExists(id))) {
    fail('Laboratorium tidak ditemukan. Mungkin sudah dihapus.');
  }
  await updateDoc(doc(db, 'laboratories', id), {
    active: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Hapus lab permanen. DITOLAK bila masih dirujuk jadwal/sesi mana pun
 * (kebijakan Sprint 3: relasi tidak boleh menggantung). Gunakan
 * `deactivateLaboratory` untuk "menutup" lab yang masih dipakai.
 */
export async function deleteLaboratory(id: string): Promise<void> {
  if (!(await labExists(id))) {
    fail('Laboratorium tidak ditemukan. Mungkin sudah dihapus.');
  }
  const [usedBySchedules, usedBySessions] = await Promise.all([
    getDocs(query(collection(db, 'schedules'), where('labId', '==', id), limit(1))),
    getDocs(query(collection(db, 'sessions'), where('labId', '==', id), limit(1))),
  ]);
  const reasons: string[] = [];
  if (!usedBySchedules.empty) reasons.push('jadwal');
  if (!usedBySessions.empty) reasons.push('sesi');
  if (reasons.length > 0) {
    fail(
      `Laboratorium tidak dapat dihapus karena masih dipakai oleh ${reasons.join(' dan ')}. ` +
        'Lepas relasi tersebut atau nonaktifkan lab.',
    );
  }
  await deleteDoc(doc(db, 'laboratories', id));
}

/* ------------------------------------------------------------------ */
/* Relasi lab <-> jadwal/sesi (kontrak untuk UI Mischa & Moses)         */
/* ------------------------------------------------------------------ */

/** Menghubungkan/ melepas lab pada satu jadwal. `labId = null` = lepas. */
export async function setScheduleLab(
  scheduleId: string,
  labId: string | null,
): Promise<void> {
  const ref = doc(db, 'schedules', scheduleId);
  if (!(await getDoc(ref)).exists()) {
    fail('Jadwal tidak ditemukan. Mungkin sudah dihapus.');
  }
  await assertLabUsable(labId);
  await updateDoc(ref, { labId });
}

/** Menghubungkan/ melepas lab pada satu sesi. `labId = null` = lepas. */
export async function setSessionLab(
  sessionId: string,
  labId: string | null,
): Promise<void> {
  const ref = doc(db, 'sessions', sessionId);
  if (!(await getDoc(ref)).exists()) {
    fail('Sesi tidak ditemukan. Mungkin sudah dihapus.');
  }
  await assertLabUsable(labId);
  await updateDoc(ref, { labId });
}
