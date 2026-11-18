
import { useEffect, useState } from 'react';

import type { AttendanceWithSession } from '../services/presensi';
import type { Schedule, Session } from '../types';

import {
    markAttendance,
    subscribeMyAttendance,
    subscribeMySchedules,
    subscribeMySessions,
} from '../services/presensi';

import type { AppUser } from '../types';

export function usePresensi(user: AppUser | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendance, setAttendance] =
  useState<AttendanceWithSession[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessions([]);
    setSchedules([]);
    setAttendance([]);
    setError(null);

    if (!user?.uid || !user.classId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let active = true;

    const onError = (err: Error) => {
      if (!active) return;
      setError(err.message);
      setLoading(false);
    };

    const loaded = new Set<string>();

const markLoaded = (source: string) => {
  if (!active) return;
  loaded.add(source);

  if (loaded.size === 3) {
    setLoading(false);
  }
};

    const unsubscribeSessions = subscribeMySessions(
      user.classId,
      (data) => {
  if (!active) return;
  setSessions(data);
  markLoaded('sessions');
},
      onError
    );

    const unsubscribeSchedules = subscribeMySchedules(
      user.classId,
      (data) => {
  if (!active) return;
  setSchedules(data);
  markLoaded('schedules');
},
      onError
    );

    const unsubscribeAttendance = subscribeMyAttendance(
      user.uid,
      (data) => {
  if (!active) return;
  setAttendance(data);
  markLoaded('attendance');
},
      onError
    );

    return () => {
      active = false;
      unsubscribeSessions();
      unsubscribeSchedules();
      unsubscribeAttendance();
    };
  }, [user?.uid, user?.classId]);

  const attend = async (session: Session): Promise<boolean> => {
  if (!user) {
    setError('Pengguna belum login.');
    return false;
  }

  if (submitting) {
    return false;
  }

  setSubmitting(true);
  setError(null);

  try {
    await markAttendance(user, session);
    return true;
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Gagal mencatat presensi.'
    );
    return false;
  } finally {
    setSubmitting(false);
  }
};

  return {
    sessions,
    schedules,
    attendance,
    loading,
    submitting,
    error,
    attend,
  };
}
