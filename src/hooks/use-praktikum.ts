/**
 * Hook Praktikum (Asprak) — Sprint 2, Fitur B (Mischa).
 *
 * - `use*` listener: membungkus `subscribe*` dari service; selalu unsubscribe
 *   saat unmount / parameter berubah; menyediakan loading, error, dan `retry`.
 * - `useWriteAction`: membungkus aksi tulis (cegah klik ganda, tolak saat
 *   offline, petakan error ke pesan Bahasa Indonesia).
 */
import type { Unsubscribe } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNetwork } from '@/hooks/use-network';
import {
  ValidationError,
  subscribeApprovedPermissionsBySession,
  subscribeAttendance,
  subscribeClasses,
  subscribePraktikanByClass,
  subscribeSchedules,
  subscribeSessions,
} from '@/services/praktikum';
import type {
  AppUser,
  Attendance,
  ClassDoc,
  PermissionRequest,
  Schedule,
  Session,
} from '@/types';
import { getErrorMessage } from '@/utils/errors';

/** Pesan untuk error: pesan validasi kita sendiri, selain itu lewat getErrorMessage. */
export function errorText(e: unknown): string {
  return e instanceof ValidationError ? e.message : getErrorMessage(e);
}

export const OFFLINE_MESSAGE =
  'Anda sedang offline. Perubahan tidak dapat disimpan. Periksa koneksi internet lalu coba lagi.';

/* ------------------------------------------------------------------ */
/* Listener generik                                                    */
/* ------------------------------------------------------------------ */

type Subscribe<T> = (
  cb: (items: T[]) => void,
  onError: (e: unknown) => void,
) => Unsubscribe;

export type Live<T> = {
  data: T[];
  /** true sampai snapshot pertama (atau error) diterima. */
  loading: boolean;
  error: string | null;
  retry: () => void;
};

type LiveState<T> = {
  source: unknown;
  attempt: number;
  data: T[];
  error: string | null;
};

/**
 * `subscribe` WAJIB stabil (dibungkus useCallback oleh pemanggil) — ketika
 * identitasnya berubah (mis. classId berganti) listener lama di-unsubscribe
 * dan listener baru dibuat.
 */
function useLive<T>(subscribe: Subscribe<T> | null): Live<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LiveState<T>>({
    source: null,
    attempt: 0,
    data: [],
    error: null,
  });

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
  const current = !!subscribe && state.source === subscribe && state.attempt === attempt;

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

export function useClasses(): Live<ClassDoc> {
  const sub = useCallback<Subscribe<ClassDoc>>(
    (cb, onError) => subscribeClasses(cb, onError),
    [],
  );
  return useLive(sub);
}

export function useSchedules(classId: string | null): Live<Schedule> {
  const sub = useCallback<Subscribe<Schedule>>(
    (cb, onError) => subscribeSchedules(classId, cb, onError),
    [classId],
  );
  return useLive(sub);
}

export function useSessions(classId: string | null): Live<Session> {
  const sub = useCallback<Subscribe<Session>>(
    (cb, onError) => subscribeSessions(classId, cb, onError),
    [classId],
  );
  return useLive(sub);
}

/** `classId = null` → semua praktikan. `enabled = false` → tidak berlangganan. */
export function usePraktikanByClass(
  classId: string | null,
  enabled = true,
): Live<AppUser> {
  const sub = useCallback<Subscribe<AppUser>>(
    (cb, onError) => subscribePraktikanByClass(classId, cb, onError),
    [classId],
  );
  return useLive(enabled ? sub : null);
}

/** `sessionId = null` → tidak berlangganan (loading=false, data kosong). */
export function useAttendance(sessionId: string | null): Live<Attendance> {
  const sub = useCallback<Subscribe<Attendance>>(
    (cb, onError) => subscribeAttendance(sessionId as string, cb, onError),
    [sessionId],
  );
  return useLive(sessionId ? sub : null);
}

export function useApprovedPermissions(
  sessionId: string | null,
): Live<PermissionRequest> {
  const sub = useCallback<Subscribe<PermissionRequest>>(
    (cb, onError) =>
      subscribeApprovedPermissionsBySession(sessionId as string, cb, onError),
    [sessionId],
  );
  return useLive(sessionId ? sub : null);
}

/* ------------------------------------------------------------------ */
/* Aksi tulis                                                          */
/* ------------------------------------------------------------------ */

export type ActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

/**
 * Menjalankan satu aksi tulis pada satu waktu:
 * - klik ganda diabaikan (ref sinkron, bukan hanya state),
 * - offline → ditolak dengan pesan jelas tanpa memanggil Firestore,
 * - error → pesan Bahasa Indonesia (`getErrorMessage` / `ValidationError`).
 */
export function useWriteAction() {
  const { isOnline } = useNetwork();
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<ActionResult<T>> => {
      if (busyRef.current) {
        return { ok: false, message: 'Masih memproses, mohon tunggu.' };
      }
      if (!isOnline) {
        return { ok: false, message: OFFLINE_MESSAGE };
      }
      busyRef.current = true;
      setBusy(true);
      try {
        return { ok: true, value: await action() };
      } catch (e) {
        return { ok: false, message: errorText(e) };
      } finally {
        busyRef.current = false;
        if (mountedRef.current) {
          setBusy(false);
        }
      }
    },
    [isOnline],
  );

  return { busy, run, isOnline };
}
