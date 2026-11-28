/**
 * Hook Pengelolaan Sesi Asprak — Sprint 4, SRS-10 (Moses).
 *
 * - `useAsprakWorkspace`: mendengarkan sesi, jadwal, kelas, dan laboratorium
 *   yang menjadi tanggung jawab Asprak secara realtime, lengkap dengan cleanup
 *   listener otomatis saat unmount/logout.
 * - `useSessionTransition`: menjalankan aksi `openSession` / `closeSession`
 *   dengan proteksi klik ganda, pemeriksaan jaringan (`useNetwork`), dan pesan
 *   error Bahasa Indonesia.
 */
import { useCallback, useRef, useState, useEffect } from 'react';

import {
  closeSession,
  mapSessionError,
  openSession,
  subscribeAsprakSessions,
  subscribeAsprakWorkspace,
  type AsprakScopeMode,
  type AsprakSessionItem,
  type AsprakWorkspaceSnapshot,
} from '../services/sesi';
import type { LabLateConfig } from '../services/keterlambatan';
import type { AppUser, ClassDoc, Schedule, Session } from '../types';
import { useNetwork } from './use-network';

export type AsprakWorkspaceState = {
  sessions: AsprakSessionItem[];
  schedules: Schedule[];
  classes: ClassDoc[];
  labs: LabLateConfig[];
  responsibleLabs: LabLateConfig[];
  scopeMode: AsprakScopeMode;
  loading: boolean;
  error: string | null;
  retry: () => void;
};

type InternalWorkspaceState = {
  key: string | null;
  snapshot: AsprakWorkspaceSnapshot | null;
  error: string | null;
  ready: boolean;
};

const EMPTY_WORKSPACE: AsprakWorkspaceSnapshot = {
  sessions: [],
  schedules: [],
  classes: [],
  labs: [],
  responsibleLabs: [],
  scopeMode: 'unassigned',
};

export function useAsprakWorkspace(user: AppUser | null): AsprakWorkspaceState {
  const [attempt, setAttempt] = useState(0);
  const subKey =
    user && user.role === 'asprak' && user.uid ? `${user.uid}:${attempt}` : null;

  const [state, setState] = useState<InternalWorkspaceState>({
    key: null,
    snapshot: null,
    error: null,
    ready: false,
  });

  useEffect(() => {
    if (!subKey || !user?.uid || user.role !== 'asprak') {
      return;
    }

    const unsubscribe = subscribeAsprakWorkspace(
      user.uid,
      (snapshot) => {
        setState({
          key: subKey,
          snapshot,
          error: null,
          ready: true,
        });
      },
      (err) => {
        setState({
          key: subKey,
          snapshot: null,
          error: mapSessionError(err),
          ready: true,
        });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [subKey, user?.uid, user?.role]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  const isCurrent = subKey !== null && state.key === subKey;
  const activeSnapshot = isCurrent && state.snapshot ? state.snapshot : EMPTY_WORKSPACE;

  return {
    sessions: activeSnapshot.sessions,
    schedules: activeSnapshot.schedules,
    classes: activeSnapshot.classes,
    labs: activeSnapshot.labs,
    responsibleLabs: activeSnapshot.responsibleLabs,
    scopeMode: activeSnapshot.scopeMode,
    loading: subKey !== null && (!isCurrent || !state.ready),
    error: isCurrent ? state.error : null,
    retry,
  };
}

/**
 * Hook ringan khusus daftar sesi tanggung jawab Asprak (pembungkus langsung
 * `subscribeAsprakSessions` sesuai kontrak modul).
 */
export function useAsprakSessions(asprakUid: string | null | undefined): {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const trimmedUid = asprakUid?.trim() || null;
  const subKey = trimmedUid ? `${trimmedUid}:${attempt}` : null;

  const [state, setState] = useState<{
    key: string | null;
    sessions: Session[];
    error: string | null;
    ready: boolean;
  }>({
    key: null,
    sessions: [],
    error: null,
    ready: false,
  });

  useEffect(() => {
    if (!subKey || !trimmedUid) {
      return;
    }
    const unsubscribe = subscribeAsprakSessions(
      trimmedUid,
      (sessions) => {
        setState({ key: subKey, sessions, error: null, ready: true });
      },
      (err) => {
        setState({
          key: subKey,
          sessions: [],
          error: mapSessionError(err),
          ready: true,
        });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [subKey, trimmedUid]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  const isCurrent = subKey !== null && state.key === subKey;

  return {
    sessions: isCurrent ? state.sessions : [],
    loading: subKey !== null && (!isCurrent || !state.ready),
    error: isCurrent ? state.error : null,
    retry,
  };
}

export type SessionActionResult =
  | { ok: true }
  | { ok: false; message: string };

export function useSessionTransition() {
  const { isOnline } = useNetwork();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const execute = useCallback(
    async (
      sessionId: string,
      action: 'dibuka' | 'ditutup',
    ): Promise<SessionActionResult> => {
      if (busyRef.current) {
        return { ok: false, message: 'Perubahan status sedang diproses. Mohon tunggu.' };
      }
      if (!isOnline) {
        return {
          ok: false,
          message:
            'Perangkat sedang offline. Buka atau tutup sesi membutuhkan koneksi internet agar tersinkron ke praktikan.',
        };
      }

      busyRef.current = true;
      setBusy(true);
      try {
        if (action === 'dibuka') {
          await openSession(sessionId);
        } else {
          await closeSession(sessionId);
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, message: mapSessionError(err) };
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [isOnline],
  );

  return {
    busy,
    isOnline,
    open: useCallback((sessionId: string) => execute(sessionId, 'dibuka'), [execute]),
    close: useCallback((sessionId: string) => execute(sessionId, 'ditutup'), [execute]),
  };
}
