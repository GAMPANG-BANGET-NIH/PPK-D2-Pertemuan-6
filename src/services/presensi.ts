
/**
 * Service Presensi Praktikan — Sprint 2
 *
 * Menangani pembacaan jadwal, sesi, riwayat,
 * dan pencatatan presensi melalui Cloud Firestore.
 *
 * Kontrak: docs/PRD.md dan docs/PEMBAGIAN.md
 * Firebase dan tipe data disediakan oleh Dewa.
 */

// TODO: subscribeMySessions(classId, cb, onError)
// TODO: subscribeMySchedules(classId, cb, onError)
// TODO: subscribeMyAttendance(uid, cb, onError)
// TODO: markAttendance(user, session)



import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe
} from 'firebase/firestore';

import { db } from '../lib/firebase';
import type {
  AppUser,
  Attendance,
  Schedule,
  Session,
} from '../types';

export type AttendanceWithSession = Attendance & {
  sessionId: string;
};

export function subscribeMySessions(
  classId: string,
  cb: (sessions: Session[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const sessionsQuery = query(
    collection(db, 'sessions'),
    where('classId', '==', classId)
  );

  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      const sessions: Session[] = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          classId: data.classId,
          scheduleId: data.scheduleId ?? null,
          title: data.title,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          status: data.status,
          openedAt: data.openedAt?.toDate() ?? null,
          closedAt: data.closedAt?.toDate() ?? null,
        };
      });

      cb(sessions);
    },
    (error) => onError(error)
  );
}

export function subscribeMySchedules(
  classId: string,
  cb: (schedules: Schedule[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const schedulesQuery = query(
    collection(db, 'schedules'),
    where('classId', '==', classId)
  );

  return onSnapshot(
    schedulesQuery,
    (snapshot) => {
      const schedules: Schedule[] = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          classId: data.classId,
          course: data.course,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          room: data.room,
        };
      });

      schedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek);

      cb(schedules);
    },
    (error) => onError(error)
  );
}
export function subscribeMyAttendance(
  uid: string,
  cb: (attendance: AttendanceWithSession[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const attendanceQuery = query(
    collectionGroup(db, 'attendance'),
    where('uid', '==', uid)
  );

  return onSnapshot(
    attendanceQuery,
    (snapshot) => {
      const attendance: AttendanceWithSession[] =
        snapshot.docs.map((attendanceDoc) => {
          const data = attendanceDoc.data();

          return {
            sessionId:
              attendanceDoc.ref.parent.parent?.id ?? '',
            uid: data.uid,
            name: data.name,
            classId: data.classId,
            attendedAt: data.attendedAt?.toDate() ?? null,
          };
        });

      attendance.sort(
        (a, b) =>
          (b.attendedAt?.getTime() ?? 0) -
          (a.attendedAt?.getTime() ?? 0)
      );

      cb(attendance);
    },
    (error) => onError(error)
  );
}

export async function markAttendance(
  user: AppUser,
  session: Session
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

  const attendanceRef = doc(
    db,
    'sessions',
    session.id,
    'attendance',
    user.uid
  );

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