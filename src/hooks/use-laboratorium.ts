/**
 * Hook Laboratorium — Sprint 3, SRS-03 + SRS-05 (Mischa).
 *
 * - `useLaboratories` / `useSessionsWithLab` / `useSchedulesWithLab`:
 *   listener realtime dengan loading / error / `retry`; selalu unsubscribe
 *   saat unmount. Aksi tulis memakai `useWriteAction` (cegah klik ganda,
 *   tolak saat offline) dari hook Sprint 2 milik modul sendiri.
 * - `useLabActivity`: aktivitas lab (berlangsung / berikutnya) realtime.
 */
import type { Unsubscribe } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { errorText, useWriteAction, type Live } from '@/hooks/use-praktikum';
import {
  subscribeLabActivity,
  subscribeLaboratories,
  subscribeSchedulesWithLab,
  subscribeSessionsWithLab,
} from '@/services/laboratorium';
import type {
  LabActivity,
  Laboratorium,
  ScheduleLabInfo,
  SessionLabInfo,
} from '@/services/laboratorium';

/* ------------------------------------------------------------------ */
/* Listener generik (pola yang sama dengan use-praktikum)              */
/* ------------------------------------------------------------------ */

type Subscribe<T> = (
  onData: (items: T[]) => void,
  onError: (e: unknown) => void,
) => Unsubscribe;

function useLive<T>(subscribe: Subscribe<T> | null): Live<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    source: unknown;
    attempt: number;
    data: T[];
    error: string | null;
  }>({ source: null, attempt: 0, data: [], error: null });

  useEffect(() => {
    if (!subscribe) {
      return;
    }
    const unsubscribe = subscribe(
      (items) =>
        setState({ source: subscribe, attempt, data: items, error: null }),
      (e) =>
        setState((prev) => ({
          source: subscribe,
          attempt,
          data: prev.source === subscribe ? prev.data : [],
          error: errorText(e),
        })),
    );
    return () => {
      unsubscribe();
    };
  }, [subscribe, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current =
    !!subscribe && state.source === subscribe && state.attempt === attempt;

  return {
    data: current ? state.data : [],
    loading: !!subscribe && !current,
    error: current ? state.error : null,
    retry,
  };
}

/* ------------------------------------------------------------------ */
/* Hook per data                                                       */
/* ------------------------------------------------------------------ */

export function useLaboratories(): Live<Laboratorium> {
  const sub = useCallback<Subscribe<Laboratorium>>(
    (onData, onError) => subscribeLaboratories(onData, onError),
    [],
  );
  return useLive(sub);
}

export function useSessionsWithLab(): Live<SessionLabInfo> {
  const sub = useCallback<Subscribe<SessionLabInfo>>(
    (onData, onError) => subscribeSessionsWithLab(onData, onError),
    [],
  );
  return useLive(sub);
}

export function useSchedulesWithLab(): Live<ScheduleLabInfo> {
  const sub = useCallback<Subscribe<ScheduleLabInfo>>(
    (onData, onError) => subscribeSchedulesWithLab(onData, onError),
    [],
  );
  return useLive(sub);
}

/* ------------------------------------------------------------------ */
/* Aktivitas lab                                                       */
/* ------------------------------------------------------------------ */

export type LabActivityLive = {
  labId: string;
  activity: LabActivity | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
};

/** `labId = null` → tidak berlangganan (idle). */
export function useLabActivity(labId: string | null): LabActivityLive {
  const [attempt, setAttempt] = useState(0);
  // Snapshot dikunci pada labId yang menghasilkannya; bila labId berganti,
  // snapshot lama diabaikan (bukan di-reset lewat setState di dalam effect).
  const [snapshot, setSnapshot] = useState<{
    labId: string;
    activity: LabActivity | null;
    error: string | null;
    ready: boolean;
  } | null>(null);

  useEffect(() => {
    if (!labId) {
      return;
    }
    const unsubscribe = subscribeLabActivity(
      labId,
      (activity) => {
        setSnapshot({ labId, activity, error: null, ready: true });
      },
      (e) => {
        setSnapshot({ labId, activity: null, error: errorText(e), ready: true });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [labId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = snapshot !== null && snapshot.labId === labId;

  return {
    labId: labId ?? '',
    activity: current ? snapshot.activity : null,
    loading: !!labId && !current,
    error: current ? snapshot.error : null,
    retry,
  };
}

/* ------------------------------------------------------------------ */
/* Aksi tulis                                                          */
/* ------------------------------------------------------------------ */

/**
 * Aksi tulis untuk CRUD lab / relasi lab. Di-reexport dari hook
 * `use-praktikum` (modul Sprint 2 milik sendiri) agar perilaku konsisten:
 * klik ganda diabaikan, offline ditolak dengan pesan jelas.
 */
export { useWriteAction, errorText };
