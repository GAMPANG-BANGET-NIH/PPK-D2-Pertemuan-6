import { useEffect, useState } from 'react';

import type { AttendanceWithSession } from '../services/presensi';
import {
  markAttendance,
  subscribeMyAttendance,
  subscribeMySchedules,
  subscribeMySessions,
} from '../services/presensi';
import type { AppUser, Schedule, Session } from '../types';
import { getErrorMessage } from '../utils/errors';

function toFriendlyError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return getErrorMessage(err);
  }
  return err instanceof Error ? err.message : fallback;
}

type PresensiState = {
  key: string | null;
  sessions: Session[];
  schedules: Schedule[];
  attendance: AttendanceWithSession[];
  loadedCount: number;
  error: string | null;
};

export function usePresensi(user: AppUser | null) {
  const uid = user?.uid ?? null;
  const classId = user?.classId ?? null;
  const subscriptionKey = uid && classId ? `${uid}:${classId}` : null;

  const [state, setState] = useState<PresensiState>({
    key: null,
    sessions: [],
    schedules: [],
    attendance: [],
    loadedCount: 0,
    error: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !classId || !subscriptionKey) return;
    let active = true;
    const loaded = new Set<string>();

    const update = (patch: (prev: PresensiState) => Partial<PresensiState>) => {
      if (!active) return;
      setState((prev) => {
        const base: PresensiState =
          prev.key === subscriptionKey
            ? prev
            : {
                key: subscriptionKey,
                sessions: [],
                schedules: [],
                attendance: [],
                loadedCount: 0,
                error: null,
              };
        return { ...base, ...patch(base) };
      });
    };

    const onError = (err: Error) => {
      update(() => ({
        error: toFriendlyError(err, 'Gagal memuat data praktikum.'),
        loadedCount: 3,
      }));
    };

    const unsubscribeSessions = subscribeMySessions(
      classId,
      (data) => {
        loaded.add('sessions');
        update((prev) => ({ sessions: data, loadedCount: loaded.size, error: prev.error }));
      },
      onError
    );

    const unsubscribeSchedules = subscribeMySchedules(
      classId,
      (data) => {
        loaded.add('schedules');
        update((prev) => ({ schedules: data, loadedCount: loaded.size, error: prev.error }));
      },
      onError
    );

    const unsubscribeAttendance = subscribeMyAttendance(
      uid,
      (data) => {
        loaded.add('attendance');
        update((prev) => ({ attendance: data, loadedCount: loaded.size, error: prev.error }));
      },
      onError
    );

    return () => {
      active = false;
      unsubscribeSessions();
      unsubscribeSchedules();
      unsubscribeAttendance();
    };
  }, [uid, classId, subscriptionKey]);

  const isCurrent = subscriptionKey !== null && state.key === subscriptionKey;
  const sessions = isCurrent ? state.sessions : [];
  const schedules = isCurrent ? state.schedules : [];
  const attendance = isCurrent ? state.attendance : [];
  const loading = subscriptionKey !== null && (!isCurrent || state.loadedCount < 3);
  const error = submitError ?? (isCurrent ? state.error : null);

  const attend = async (session: Session): Promise<boolean> => {
    if (!user) {
      setSubmitError('Pengguna belum login.');
      return false;
    }

    if (submitting) {
      return false;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await markAttendance(user, session);
      return true;
    } catch (err) {
      setSubmitError(toFriendlyError(err, 'Gagal mencatat presensi.'));
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
