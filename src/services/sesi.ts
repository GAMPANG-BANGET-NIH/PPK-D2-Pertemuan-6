/**
 * Service Pengelolaan Sesi Praktikum oleh Asprak — Sprint 4, SRS-10 & SRS-11 (Moses).
 *
 * Kontrak antarmodul (docs/PEMBAGIAN.md):
 *   subscribeAsprakSessions(asprakUid, cb, onError): Unsubscribe
 *   subscribeSessionAttendance(sessionId, cb, onError): Unsubscribe
 *   openSession(id): Promise<void>
 *   closeSession(id): Promise<void>
 *
 * Ketentuan peran Sprint 4 (docs/PRD.md):
 * - Asprak hanya melihat dan mengelola pelaksanaan praktikum (kelas, jadwal, sesi)
 *   pada laboratorium/kelas yang menjadi tanggung jawabnya.
 * - Transisi status sesi bersifat atomik dan satu arah: `belum_dibuka -> dibuka -> ditutup`.
 *   Sesi yang sudah `ditutup` bersifat final dan tidak dapat dibuka ulang.
 * - Asprak TIDAK memiliki fungsi konfigurasi laboratorium maupun pemindahan kelas/distribusi
 *   anggota pada service ini (wewenang tersebut milik peran `aslab`).
 */
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { auth, db } from '../lib/firebase';
import type {
  ClassDoc,
  PermissionRequest,
  Schedule,
  Session,
  SessionStatus,
} from '../types';
import { getErrorMessage } from '../utils/errors';
import {
  mapAttendanceWithTiming,
  mapFineSummary,
  mapLabLateConfig,
  type AttendanceTimingRecord,
  type FineRecordSummary,
  type LabLateConfig,
  type RosterMember,
} from './keterlambatan';

export class SessionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionServiceError';
  }
}

export type AsprakScopeMode =
  | 'assigned_labs'
  | 'created_by_fallback'
  | 'legacy_pre_distribution'
  | 'unassigned';

export type AsprakScopeInfo = {
  mode: AsprakScopeMode;
  assignedLabIds: string[];
  labs: LabLateConfig[];
};

export type AsprakSessionItem = Session & {
  createdBy?: string | null;
};

const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  belum_dibuka: 'Belum dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

/* ------------------------------------------------------------------ */
/* Pemetaan dokumen Firestore                                          */
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

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function optStr(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function toSessionStatus(value: unknown): SessionStatus {
  return value === 'dibuka' || value === 'ditutup' ? value : 'belum_dibuka';
}

export function mapSessionDoc(id: string, d: DocumentData): AsprakSessionItem {
  const labId = optStr(d.labId);
  return {
    id,
    classId: str(d.classId),
    scheduleId: typeof d.scheduleId === 'string' && d.scheduleId.trim() ? d.scheduleId : null,
    title: str(d.title, id),
    date: str(d.date),
    startTime: str(d.startTime),
    endTime: str(d.endTime),
    status: toSessionStatus(d.status),
    openedAt: toDate(d.openedAt),
    closedAt: toDate(d.closedAt),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : null,
    ...(labId ? { labId } : {}),
  };
}

export function mapScheduleDoc(id: string, d: DocumentData): Schedule {
  const labId = optStr(d.labId);
  return {
    id,
    classId: str(d.classId),
    course: str(d.course, id),
    dayOfWeek: typeof d.dayOfWeek === 'number' ? d.dayOfWeek : 1,
    startTime: str(d.startTime),
    endTime: str(d.endTime),
    room: str(d.room),
    ...(labId ? { labId } : {}),
  };
}

function mapClassDoc(id: string, d: DocumentData): ClassDoc {
  return {
    id,
    name: str(d.name, id),
  };
}

function mapPermissionDoc(id: string, d: DocumentData): PermissionRequest {
  const ai = (d.aiResult ?? {}) as DocumentData;
  return {
    id,
    uid: str(d.uid),
    name: str(d.name),
    classId: str(d.classId),
    sessionId: str(d.sessionId),
    sessionTitle: str(d.sessionTitle),
    reason: str(d.reason),
    status: d.status === 'disetujui' || d.status === 'ditolak' ? d.status : 'menunggu',
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

function isPermissionDeniedError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'permission-denied',
  );
}

/**
 * Memetakan error validasi maupun Firebase menjadi pesan Bahasa Indonesia ramah pengguna.
 */
export function mapSessionError(error: unknown): string {
  if (error instanceof SessionServiceError && error.message.trim()) {
    return error.message;
  }
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null;
  if (code === 'permission-denied') {
    return 'Aksi ditolak sistem keamanan. Pastikan Anda login sebagai Asprak pada laboratorium tanggung jawab Anda.';
  }
  if (code) {
    return getErrorMessage(error);
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Terjadi kendala saat memproses sesi praktikum. Silakan coba lagi.';
}

/* ------------------------------------------------------------------ */
/* Penentuan cakupan laboratorium tanggung jawab Asprak (murni + live) */
/* ------------------------------------------------------------------ */

export type LabMembershipProbe = {
  labId: string;
  isMember: boolean;
  /** `true` bila pembacaan subkoleksi `laboratories/{id}/asprak/{uid}` diizinkan rules. */
  subcollectionReadable: boolean;
};

/**
 * Menentukan sesi mana yang masuk tanggung jawab seorang Asprak:
 * 1. Jika ada keanggotaan eksplisit pada `laboratories/{labId}/asprak/{asprakUid}` ->
 *    hanya sesi dengan `labId` pada daftar tersebut (`mode: 'assigned_labs'`).
 * 2. Jika rules subkoleksi Sprint 4 sudah aktif (`anyReadable === true`) tetapi Asprak
 *    belum ditempatkan pada lab mana pun -> cek sesi yang `createdBy === asprakUid`;
 *    bila tidak ada, hasil kosong (`mode: 'unassigned'`).
 * 3. Jika subkoleksi belum dapat dibaca karena rules Sprint 4 (Fase 0) belum di-deploy
 *    (`anyReadable === false`) -> gunakan sesi `createdBy === asprakUid` bila tersedia,
 *    atau fallback pra-distribusi agar pengujian lokal tetap berjalan sebelum merge Fase 0.
 */
export function filterSessionsForAsprak(params: {
  asprakUid: string;
  allSessions: readonly AsprakSessionItem[];
  probes: readonly LabMembershipProbe[];
}): { sessions: AsprakSessionItem[]; mode: AsprakScopeMode; assignedLabIds: string[] } {
  const { asprakUid, allSessions, probes } = params;
  const assignedLabIds = probes.filter((p) => p.isMember).map((p) => p.labId);
  const assignedSet = new Set(assignedLabIds);

  const sortSessions = (list: AsprakSessionItem[]) =>
    [...list].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime) ||
        a.title.localeCompare(b.title, 'id'),
    );

  if (assignedSet.size > 0) {
    return {
      sessions: sortSessions(
        allSessions.filter((s) => Boolean(s.labId && assignedSet.has(s.labId))),
      ),
      mode: 'assigned_labs',
      assignedLabIds,
    };
  }

  const anySubcollectionReadable = probes.some((p) => p.subcollectionReadable);
  const ownCreated = allSessions.filter((s) => s.createdBy === asprakUid);

  if (anySubcollectionReadable) {
    if (ownCreated.length > 0) {
      const ownLabIds = Array.from(
        new Set(ownCreated.map((s) => s.labId).filter((id): id is string => Boolean(id))),
      );
      return {
        sessions: sortSessions(ownCreated),
        mode: 'created_by_fallback',
        assignedLabIds: ownLabIds,
      };
    }
    return {
      sessions: [],
      mode: 'unassigned',
      assignedLabIds: [],
    };
  }

  if (ownCreated.length > 0) {
    const ownLabIds = Array.from(
      new Set(ownCreated.map((s) => s.labId).filter((id): id is string => Boolean(id))),
    );
    return {
      sessions: sortSessions(ownCreated),
      mode: 'created_by_fallback',
      assignedLabIds: ownLabIds,
    };
  }

  const fallbackLabIds = Array.from(
    new Set(allSessions.map((s) => s.labId).filter((id): id is string => Boolean(id))),
  );
  return {
    sessions: sortSessions([...allSessions]),
    mode: 'legacy_pre_distribution',
    assignedLabIds: fallbackLabIds,
  };
}

/**
 * Listener terpadu cakupan laboratorium milik Asprak (`laboratories` + `laboratories/{id}/asprak/{uid}`).
 */
export function subscribeAsprakLabScope(
  asprakUid: string,
  cb: (result: { labs: LabLateConfig[]; probes: LabMembershipProbe[] }) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const trimmedUid = asprakUid.trim();
  if (!trimmedUid) {
    cb({ labs: [], probes: [] });
    return () => {};
  }

  let disposed = false;
  let currentLabs: LabLateConfig[] = [];
  const probeUnsubs = new Map<string, Unsubscribe>();
  const probeStates = new Map<string, LabMembershipProbe>();

  const emitIfReady = () => {
    if (disposed) return;
    if (currentLabs.length === 0) {
      cb({ labs: [], probes: [] });
      return;
    }
    if (probeStates.size < currentLabs.length) {
      return;
    }
    const probes = currentLabs
      .map((lab) => probeStates.get(lab.id))
      .filter((p): p is LabMembershipProbe => Boolean(p));
    cb({ labs: currentLabs, probes });
  };

  const stopLabs = onSnapshot(
    collection(db, 'laboratories'),
    (snap) => {
      if (disposed) return;
      currentLabs = snap.docs
        .map((d) => mapLabLateConfig(d.id, d.data()))
        .sort((a, b) => a.name.localeCompare(b.name, 'id'));

      const nextIds = new Set(currentLabs.map((l) => l.id));

      for (const [existingId, unsub] of probeUnsubs.entries()) {
        if (!nextIds.has(existingId)) {
          unsub();
          probeUnsubs.delete(existingId);
          probeStates.delete(existingId);
        }
      }

      if (currentLabs.length === 0) {
        emitIfReady();
        return;
      }

      for (const lab of currentLabs) {
        if (probeUnsubs.has(lab.id)) {
          continue;
        }
        const memberDocRef = doc(db, 'laboratories', lab.id, 'asprak', trimmedUid);
        const unsubMember = onSnapshot(
          memberDocRef,
          (memberSnap) => {
            if (disposed) return;
            probeStates.set(lab.id, {
              labId: lab.id,
              isMember: memberSnap.exists(),
              subcollectionReadable: true,
            });
            emitIfReady();
          },
          (err) => {
            if (disposed) return;
            if (isPermissionDeniedError(err)) {
              probeStates.set(lab.id, {
                labId: lab.id,
                isMember: false,
                subcollectionReadable: false,
              });
              emitIfReady();
              return;
            }
            onError(err);
          },
        );
        probeUnsubs.set(lab.id, unsubMember);
      }

      emitIfReady();
    },
    (err) => {
      if (!disposed) {
        onError(err);
      }
    },
  );

  return () => {
    disposed = true;
    stopLabs();
    for (const unsub of probeUnsubs.values()) {
      unsub();
    }
    probeUnsubs.clear();
    probeStates.clear();
  };
}

/**
 * Kontrak utama Sprint 4 (`src/services/sesi.ts`):
 * Mendengarkan daftar sesi praktikum yang menjadi tanggung jawab `asprakUid` secara realtime.
 */
export function subscribeAsprakSessions(
  asprakUid: string,
  cb: (sessions: Session[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return subscribeAsprakWorkspace(
    asprakUid,
    (workspace) => {
      cb(workspace.sessions);
    },
    onError,
  );
}

export type AsprakWorkspaceSnapshot = {
  sessions: AsprakSessionItem[];
  schedules: Schedule[];
  classes: ClassDoc[];
  labs: LabLateConfig[];
  responsibleLabs: LabLateConfig[];
  scopeMode: AsprakScopeMode;
};

/**
 * Listener lengkap ruang kerja Asprak: menggabungkan sesi, jadwal, kelas, dan
 * laboratorium yang relevan dengan tanggung jawab Asprak tanpa duplikasi sumber data.
 */
export function subscribeAsprakWorkspace(
  asprakUid: string,
  cb: (snapshot: AsprakWorkspaceSnapshot) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const trimmedUid = asprakUid.trim();
  if (!trimmedUid) {
    cb({
      sessions: [],
      schedules: [],
      classes: [],
      labs: [],
      responsibleLabs: [],
      scopeMode: 'unassigned',
    });
    return () => {};
  }

  let disposed = false;
  let scopeReady = false;
  let sessionsReady = false;
  let schedulesReady = false;
  let classesReady = false;

  let allLabs: LabLateConfig[] = [];
  let probes: LabMembershipProbe[] = [];
  let allSessions: AsprakSessionItem[] = [];
  let allSchedules: Schedule[] = [];
  let allClasses: ClassDoc[] = [];

  const emit = () => {
    if (disposed || !scopeReady || !sessionsReady || !schedulesReady || !classesReady) {
      return;
    }

    const filtered = filterSessionsForAsprak({
      asprakUid: trimmedUid,
      allSessions,
      probes,
    });

    const labIdSet = new Set(filtered.assignedLabIds);
    const sessionClassIds = new Set(filtered.sessions.map((s) => s.classId).filter(Boolean));

    const schedules = allSchedules
      .filter((sch) => {
        if (filtered.mode === 'assigned_labs') {
          return Boolean(sch.labId && labIdSet.has(sch.labId));
        }
        if (filtered.mode === 'unassigned') {
          return false;
        }
        if (filtered.mode === 'created_by_fallback') {
          return Boolean((sch.labId && labIdSet.has(sch.labId)) || sessionClassIds.has(sch.classId));
        }
        return true;
      })
      .sort(
        (a, b) =>
          a.dayOfWeek - b.dayOfWeek ||
          a.startTime.localeCompare(b.startTime) ||
          a.course.localeCompare(b.course, 'id'),
      );

    for (const sch of schedules) {
      if (sch.classId) {
        sessionClassIds.add(sch.classId);
      }
    }

    const responsibleLabs =
      filtered.mode === 'legacy_pre_distribution' && labIdSet.size === 0
        ? allLabs
        : allLabs.filter((l) => labIdSet.has(l.id));

    const classes = allClasses
      .filter((c) =>
        filtered.mode === 'legacy_pre_distribution' ? true : sessionClassIds.has(c.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

    cb({
      sessions: filtered.sessions,
      schedules,
      classes,
      labs: allLabs,
      responsibleLabs,
      scopeMode: filtered.mode,
    });
  };

  const stopScope = subscribeAsprakLabScope(
    trimmedUid,
    (res) => {
      allLabs = res.labs;
      probes = res.probes;
      scopeReady = true;
      emit();
    },
    onError,
  );

  const stopSessions = onSnapshot(
    collection(db, 'sessions'),
    (snap) => {
      allSessions = snap.docs.map((d) => mapSessionDoc(d.id, d.data()));
      sessionsReady = true;
      emit();
    },
    onError,
  );

  const stopSchedules = onSnapshot(
    collection(db, 'schedules'),
    (snap) => {
      allSchedules = snap.docs.map((d) => mapScheduleDoc(d.id, d.data()));
      schedulesReady = true;
      emit();
    },
    onError,
  );

  const stopClasses = onSnapshot(
    collection(db, 'classes'),
    (snap) => {
      allClasses = snap.docs.map((d) => mapClassDoc(d.id, d.data()));
      classesReady = true;
      emit();
    },
    onError,
  );

  return () => {
    disposed = true;
    stopScope();
    stopSessions();
    stopSchedules();
    stopClasses();
  };
}

/* ------------------------------------------------------------------ */
/* Listener rekap kehadiran per sesi (SRS-10 & SRS-11)                 */
/* ------------------------------------------------------------------ */

/**
 * Kontrak utama Sprint 4 (`src/services/sesi.ts`):
 * Mendengarkan dokumen presensi (`sessions/{sessionId}/attendance`) lengkap dengan
 * field `onTime`, `lateMinutes`, `distanceMeters`, dan `verificationMethod`.
 */
export function subscribeSessionAttendance(
  sessionId: string,
  cb: (attendance: AttendanceTimingRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const trimmedId = sessionId.trim();
  if (!trimmedId) {
    cb([]);
    return () => {};
  }

  return onSnapshot(
    collection(db, 'sessions', trimmedId, 'attendance'),
    (snap) => {
      const items = snap.docs
        .map((d) => mapAttendanceWithTiming(d.id, d.data(), trimmedId))
        .sort((a, b) => a.name.localeCompare(b.name, 'id'));
      cb(items);
    },
    onError,
  );
}

export function subscribeSessionDetail(
  sessionId: string,
  cb: (session: AsprakSessionItem | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const trimmedId = sessionId.trim();
  if (!trimmedId) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'sessions', trimmedId),
    (snap) => {
      cb(snap.exists() ? mapSessionDoc(snap.id, snap.data()) : null);
    },
    onError,
  );
}

export function subscribeSessionApprovedPermissions(
  sessionId: string,
  cb: (permissions: PermissionRequest[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const trimmedId = sessionId.trim();
  if (!trimmedId) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, 'permissions'),
    where('sessionId', '==', trimmedId),
    where('status', '==', 'disetujui'),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => mapPermissionDoc(d.id, d.data())));
    },
    onError,
  );
}

/**
 * Mendengarkan daftar peserta praktikan untuk sesi terkait:
 * - Utama (Sprint 4): subkoleksi `laboratories/{labId}/praktikan` (difilter `classId` bila diset).
 * - Fallback kompatibilitas: `users` ber-peran `praktikan` pada `session.classId` bila
 *   subkoleksi lab belum memiliki distribusi anggota atau rules Fase 0 belum aktif.
 */
export function subscribeSessionRoster(
  session: Pick<Session, 'classId' | 'labId'>,
  cb: (roster: RosterMember[], source: 'lab_members' | 'class_users') => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  let disposed = false;
  let labMembers: RosterMember[] | null = null;
  let classUsers: RosterMember[] | null = null;
  let stopLabMembers: Unsubscribe | null = null;
  let stopClassUsers: Unsubscribe | null = null;

  const emit = () => {
    if (disposed) return;
    if (labMembers !== null && labMembers.length > 0) {
      const scoped = session.classId
        ? labMembers.filter((m) => !m.classId || m.classId === session.classId)
        : labMembers;
      cb(scoped.length > 0 ? scoped : labMembers, 'lab_members');
      return;
    }
    if (classUsers !== null) {
      cb(classUsers, 'class_users');
    }
  };

  if (session.labId) {
    stopLabMembers = onSnapshot(
      collection(db, 'laboratories', session.labId, 'praktikan'),
      (snap) => {
        if (disposed) return;
        labMembers = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              uid: str(data.uid, d.id),
              name: str(data.name, d.id),
              classId: typeof data.classId === 'string' && data.classId ? data.classId : null,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'id'));
        emit();
      },
      (err) => {
        if (disposed) return;
        if (isPermissionDeniedError(err)) {
          labMembers = [];
          emit();
          return;
        }
        onError(err);
      },
    );
  } else {
    labMembers = [];
  }

  if (session.classId) {
    const usersQ = query(
      collection(db, 'users'),
      where('role', '==', 'praktikan'),
      where('classId', '==', session.classId),
    );
    stopClassUsers = onSnapshot(
      usersQ,
      (snap) => {
        if (disposed) return;
        classUsers = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              name: str(data.name, d.id),
              classId: typeof data.classId === 'string' ? data.classId : null,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'id'));
        emit();
      },
      (err) => {
        if (disposed) return;
        if (isPermissionDeniedError(err) && labMembers && labMembers.length > 0) {
          classUsers = [];
          emit();
          return;
        }
        onError(err);
      },
    );
  } else {
    classUsers = [];
    emit();
  }

  return () => {
    disposed = true;
    if (stopLabMembers) stopLabMembers();
    if (stopClassUsers) stopClassUsers();
  };
}

/**
 * Mendengarkan tagihan denda pada satu sesi untuk informasi rekap Asprak.
 * Bila koleksi `fines` belum diizinkan rules (sebelum Fase 0), kembalikan array kosong.
 */
export function subscribeSessionFines(
  sessionId: string,
  cb: (fines: FineRecordSummary[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const trimmedId = sessionId.trim();
  if (!trimmedId) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, 'fines'), where('sessionId', '==', trimmedId));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => mapFineSummary(d.id, d.data())));
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        cb([]);
        return;
      }
      onError(err);
    },
  );
}

/* ------------------------------------------------------------------ */
/* Transisi atomik buka & tutup sesi (SRS-10)                          */
/* ------------------------------------------------------------------ */

async function transitionSessionStatus(
  id: string,
  expectedFrom: 'belum_dibuka' | 'dibuka',
  targetStatus: 'dibuka' | 'ditutup',
): Promise<void> {
  const trimmedId = id.trim();
  if (!trimmedId) {
    throw new SessionServiceError('Identitas sesi praktikum tidak valid.');
  }
  if (!auth.currentUser?.uid) {
    throw new SessionServiceError('Sesi login tidak ditemukan. Silakan login kembali.');
  }

  const sessionRef = doc(db, 'sessions', trimmedId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists()) {
        throw new SessionServiceError(
          'Sesi praktikum tidak ditemukan atau sudah dihapus.',
        );
      }

      const current = mapSessionDoc(snap.id, snap.data());
      if (current.status !== expectedFrom) {
        if (current.status === 'ditutup') {
          throw new SessionServiceError(
            'Sesi sudah ditutup secara permanen dan tidak dapat dibuka kembali.',
          );
        }
        throw new SessionServiceError(
          `Transisi ditolak karena status sesi saat ini adalah "${SESSION_STATUS_LABELS[current.status]}".`,
        );
      }

      tx.update(
        sessionRef,
        targetStatus === 'dibuka'
          ? { status: 'dibuka', openedAt: serverTimestamp() }
          : { status: 'ditutup', closedAt: serverTimestamp() },
      );
    });
  } catch (error) {
    throw new SessionServiceError(mapSessionError(error));
  }
}

/** Membuka sesi praktikum (`belum_dibuka -> dibuka`) secara atomik. */
export function openSession(id: string): Promise<void> {
  return transitionSessionStatus(id, 'belum_dibuka', 'dibuka');
}

/** Menutup sesi praktikum (`dibuka -> ditutup`) secara atomik. */
export function closeSession(id: string): Promise<void> {
  return transitionSessionStatus(id, 'dibuka', 'ditutup');
}
