/**
 * Hook Keterlambatan, Rekap Sesi & Status Kehadiran Praktikan — Sprint 4, SRS-11 (Moses).
 *
 * - `useSessionRecap`: menggabungkan listener sesi, konfigurasi `gracePeriodMinutes`
 *   & `lateFineAmount` dari `laboratories`, daftar anggota praktikan, presensi
 *   realtime (`subscribeSessionAttendance`), izin `disetujui`, serta status tagihan
 *   denda pada sesi tersebut.
 * - `usePraktikanAttendanceStanding`: menyediakan status kehadiran per sesi
 *   (`Hadir` / `Terlambat X menit` / `Izin (Disetujui)` / `Belum Presensi`)
 *   dan ringkasan tagihan denda aktif untuk beranda Praktikan (`/praktikan`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildSessionRecap,
  describeAttendanceStatus,
  evaluateAttendanceLateness,
  resolveAttendanceStatus,
  subscribeLabConfigById,
  subscribeLabConfigs,
  subscribeMyAttendanceWithTiming,
  subscribeMyFinesSummary,
  subscribeMyPermissionsMap,
  type AttendanceStatusPresentation,
  type AttendanceTimingRecord,
  type FineRecordSummary,
  type LabLateConfig,
  type ResolvedAttendanceStatus,
  type RosterMember,
  type SessionRecapRow,
  type SessionRecapSummary,
} from '../services/keterlambatan';
import {
  mapSessionError,
  subscribeSessionApprovedPermissions,
  subscribeSessionAttendance,
  subscribeSessionDetail,
  subscribeSessionFines,
  subscribeSessionRoster,
  type AsprakSessionItem,
} from '../services/sesi';
import type { AppUser, PermissionRequest, PermissionStatus, Session } from '../types';
import { getErrorMessage } from '../utils/errors';

/* ------------------------------------------------------------------ */
/* Hook 1: Rekap Kehadiran Realtime per Sesi (Asprak)                  */
/* ------------------------------------------------------------------ */

export type SessionRecapState = {
  session: AsprakSessionItem | null;
  lab: LabLateConfig | null;
  rows: SessionRecapRow[];
  summary: SessionRecapSummary;
  rosterSource: 'lab_members' | 'class_users';
  gracePeriodMinutes: number | null;
  lateFineAmount: number | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
};

const EMPTY_SUMMARY: SessionRecapSummary = {
  hadir: 0,
  terlambat: 0,
  izin: 0,
  belumHadir: 0,
  total: 0,
};

export function useSessionRecap(
  sessionId: string | null | undefined,
  enabled = true,
): SessionRecapState {
  const [attempt, setAttempt] = useState(0);
  const trimmedSessionId = enabled && sessionId?.trim() ? sessionId.trim() : null;
  const sessionKey = trimmedSessionId ? `${trimmedSessionId}:${attempt}` : null;

  /* 1. Detail Sesi */
  const [sessionState, setSessionState] = useState<{
    key: string | null;
    session: AsprakSessionItem | null;
    error: string | null;
    ready: boolean;
  }>({ key: null, session: null, error: null, ready: false });

  useEffect(() => {
    if (!sessionKey || !trimmedSessionId) {
      return;
    }
    const unsubscribe = subscribeSessionDetail(
      trimmedSessionId,
      (session) => {
        setSessionState({ key: sessionKey, session, error: null, ready: true });
      },
      (err) => {
        setSessionState({
          key: sessionKey,
          session: null,
          error: mapSessionError(err),
          ready: true,
        });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [sessionKey, trimmedSessionId]);

  const sessionCurrent = sessionKey !== null && sessionState.key === sessionKey;
  const session = sessionCurrent ? sessionState.session : null;
  const sessionLoading = sessionKey !== null && (!sessionCurrent || !sessionState.ready);
  const sessionError = sessionCurrent ? sessionState.error : null;

  /* 2. Konfigurasi Laboratorium (gracePeriodMinutes & lateFineAmount) */
  const labId = session?.labId ?? null;
  const labKey = session && labId ? `${labId}:${attempt}` : null;

  const [labState, setLabState] = useState<{
    key: string | null;
    lab: LabLateConfig | null;
    error: string | null;
    ready: boolean;
  }>({ key: null, lab: null, error: null, ready: false });

  useEffect(() => {
    if (!labKey || !labId) {
      return;
    }
    const unsubscribe = subscribeLabConfigById(
      labId,
      (lab) => {
        setLabState({ key: labKey, lab, error: null, ready: true });
      },
      (err) => {
        setLabState({
          key: labKey,
          lab: null,
          error: mapSessionError(err),
          ready: true,
        });
      },
    );
    return () => {
      unsubscribe();
    };
  }, [labKey, labId]);

  const labCurrent = labKey !== null && labState.key === labKey;
  const lab = labCurrent ? labState.lab : null;
  const labLoading = labKey !== null && (!labCurrent || !labState.ready);

  /* 3. Presensi, Izin Disetujui, Daftar Anggota, dan Tagihan Sesi */
  const dataKey =
    session && trimmedSessionId
      ? `${trimmedSessionId}:${session.classId}:${session.labId ?? '-'}:${attempt}`
      : null;

  const [dataState, setDataState] = useState<{
    key: string | null;
    attendance: AttendanceTimingRecord[];
    permissions: PermissionRequest[];
    roster: RosterMember[];
    rosterSource: 'lab_members' | 'class_users';
    fines: FineRecordSummary[];
    error: string | null;
    readyMask: number;
  }>({
    key: null,
    attendance: [],
    permissions: [],
    roster: [],
    rosterSource: 'class_users',
    fines: [],
    error: null,
    readyMask: 0,
  });

  useEffect(() => {
    if (!dataKey || !trimmedSessionId || !session) {
      return;
    }

    let disposed = false;
    let attendance: AttendanceTimingRecord[] = [];
    let permissions: PermissionRequest[] = [];
    let roster: RosterMember[] = [];
    let rosterSource: 'lab_members' | 'class_users' = 'class_users';
    let fines: FineRecordSummary[] = [];
    let mask = 0;

    const pushUpdate = (bit: number) => {
      if (disposed) return;
      mask |= bit;
      setDataState({
        key: dataKey,
        attendance,
        permissions,
        roster,
        rosterSource,
        fines,
        error: null,
        readyMask: mask,
      });
    };

    const handleError = (err: unknown) => {
      if (disposed) return;
      setDataState((prev) => ({
        key: dataKey,
        attendance: prev.key === dataKey ? prev.attendance : [],
        permissions: prev.key === dataKey ? prev.permissions : [],
        roster: prev.key === dataKey ? prev.roster : [],
        rosterSource: prev.key === dataKey ? prev.rosterSource : 'class_users',
        fines: prev.key === dataKey ? prev.fines : [],
        error: mapSessionError(err),
        readyMask: 0b1111,
      }));
    };

    const stopAttendance = subscribeSessionAttendance(
      trimmedSessionId,
      (items) => {
        attendance = items;
        pushUpdate(0b0001);
      },
      handleError,
    );

    const stopPermissions = subscribeSessionApprovedPermissions(
      trimmedSessionId,
      (items) => {
        permissions = items;
        pushUpdate(0b0010);
      },
      handleError,
    );

    const stopRoster = subscribeSessionRoster(
      { classId: session.classId, labId: session.labId },
      (items, source) => {
        roster = items;
        rosterSource = source;
        pushUpdate(0b0100);
      },
      handleError,
    );

    const stopFines = subscribeSessionFines(
      trimmedSessionId,
      (items) => {
        fines = items;
        pushUpdate(0b1000);
      },
      handleError,
    );

    return () => {
      disposed = true;
      stopAttendance();
      stopPermissions();
      stopRoster();
      stopFines();
    };
  }, [dataKey, trimmedSessionId, session]);

  const dataCurrent = dataKey !== null && dataState.key === dataKey;
  const dataLoading = dataKey !== null && (!dataCurrent || dataState.readyMask !== 0b1111);
  const dataError = dataCurrent ? dataState.error : null;

  const gracePeriodMinutes = lab?.gracePeriodMinutes ?? null;
  const lateFineAmount = lab?.lateFineAmount ?? null;

  const computed = useMemo(() => {
    if (!session || !dataCurrent) {
      return { rows: [] as SessionRecapRow[], summary: EMPTY_SUMMARY };
    }
    return buildSessionRecap({
      roster: dataState.roster,
      attendanceList: dataState.attendance,
      approvedPermissions: dataState.permissions,
      fines: dataState.fines,
      session,
      gracePeriodMinutes,
    });
  }, [session, dataCurrent, dataState, gracePeriodMinutes]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return {
    session,
    lab,
    rows: computed.rows,
    summary: computed.summary,
    rosterSource: dataCurrent ? dataState.rosterSource : 'class_users',
    gracePeriodMinutes,
    lateFineAmount,
    loading: sessionLoading || labLoading || dataLoading,
    error: sessionError ?? (labCurrent ? labState.error : null) ?? dataError,
    retry,
  };
}

/* ------------------------------------------------------------------ */
/* Hook 2: Status Kehadiran & Tagihan Denda Sisi Praktikan             */
/* ------------------------------------------------------------------ */

export type PraktikanSessionStanding = {
  sessionId: string;
  status: ResolvedAttendanceStatus;
  lateMinutes: number;
  attendedAt: Date | null;
  distanceMeters?: number;
  verificationMethod?: 'geolocation' | 'manual';
  permissionStatus: PermissionStatus | null;
  permissionReason: string | null;
  presentation: AttendanceStatusPresentation;
  fine: FineRecordSummary | null;
  gracePeriodMinutes: number | null;
};

export type PraktikanStandingState = {
  labsById: Map<string, LabLateConfig>;
  standingBySession: Map<string, PraktikanSessionStanding>;
  attendanceHistory: (AttendanceTimingRecord & {
    resolvedStatus: ResolvedAttendanceStatus;
    resolvedLateMinutes: number;
    presentation: AttendanceStatusPresentation;
    fine: FineRecordSummary | null;
  })[];
  fines: FineRecordSummary[];
  unpaidFines: FineRecordSummary[];
  totalUnpaidAmount: number;
  loading: boolean;
  error: string | null;
};

function friendlyLoadError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return getErrorMessage(error);
  }
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Gagal memuat status kehadiran dan tagihan.';
}

export function usePraktikanAttendanceStanding(
  user: AppUser | null,
  sessions: readonly Session[],
): PraktikanStandingState {
  const subKey =
    user && user.role === 'praktikan' && user.uid ? user.uid : null;

  const [state, setState] = useState<{
    key: string | null;
    labs: LabLateConfig[];
    attendance: AttendanceTimingRecord[];
    permissions: { id: string; sessionId: string; status: PermissionStatus; reason: string }[];
    fines: FineRecordSummary[];
    readyMask: number;
    error: string | null;
  }>({
    key: null,
    labs: [],
    attendance: [],
    permissions: [],
    fines: [],
    readyMask: 0,
    error: null,
  });

  useEffect(() => {
    if (!subKey) {
      return;
    }

    let disposed = false;
    let labs: LabLateConfig[] = [];
    let attendance: AttendanceTimingRecord[] = [];
    let permissions: { id: string; sessionId: string; status: PermissionStatus; reason: string }[] =
      [];
    let fines: FineRecordSummary[] = [];
    let mask = 0;

    const push = (bit: number) => {
      if (disposed) return;
      mask |= bit;
      setState({
        key: subKey,
        labs,
        attendance,
        permissions,
        fines,
        readyMask: mask,
        error: null,
      });
    };

    const onErr = (err: unknown) => {
      if (disposed) return;
      setState((prev) => ({
        key: subKey,
        labs: prev.key === subKey ? prev.labs : [],
        attendance: prev.key === subKey ? prev.attendance : [],
        permissions: prev.key === subKey ? prev.permissions : [],
        fines: prev.key === subKey ? prev.fines : [],
        readyMask: 0b1111,
        error: friendlyLoadError(err),
      }));
    };

    const stopLabs = subscribeLabConfigs(
      (items) => {
        labs = items;
        push(0b0001);
      },
      () => {
        // Kegagalan baca lab tidak boleh memblokir riwayat praktikan.
        push(0b0001);
      },
    );

    const stopAttendance = subscribeMyAttendanceWithTiming(
      subKey,
      (items) => {
        attendance = items;
        push(0b0010);
      },
      onErr,
    );

    const stopPermissions = subscribeMyPermissionsMap(
      subKey,
      (items) => {
        permissions = items;
        push(0b0100);
      },
      () => {
        push(0b0100);
      },
    );

    const stopFines = subscribeMyFinesSummary(
      subKey,
      (items) => {
        fines = items;
        push(0b1000);
      },
      () => {
        push(0b1000);
      },
    );

    return () => {
      disposed = true;
      stopLabs();
      stopAttendance();
      stopPermissions();
      stopFines();
    };
  }, [subKey]);

  const isCurrent = subKey !== null && state.key === subKey;
  const labs = useMemo(() => (isCurrent ? state.labs : []), [isCurrent, state.labs]);
  const attendance = useMemo(
    () => (isCurrent ? state.attendance : []),
    [isCurrent, state.attendance],
  );
  const permissions = useMemo(
    () => (isCurrent ? state.permissions : []),
    [isCurrent, state.permissions],
  );
  const fines = useMemo(() => (isCurrent ? state.fines : []), [isCurrent, state.fines]);

  const labsById = useMemo(() => new Map(labs.map((l) => [l.id, l])), [labs]);

  const computed = useMemo(() => {
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const attBySession = new Map<string, AttendanceTimingRecord>();
    for (const rec of attendance) {
      if (rec.sessionId) {
        attBySession.set(rec.sessionId, rec);
      }
    }

    const permBySession = new Map<
      string,
      { status: PermissionStatus; reason: string }
    >();
    for (const perm of permissions) {
      if (perm.sessionId) {
        permBySession.set(perm.sessionId, {
          status: perm.status,
          reason: perm.reason,
        });
      }
    }

    const fineBySession = new Map<string, FineRecordSummary>();
    for (const fine of fines) {
      if (fine.sessionId && !fineBySession.has(fine.sessionId)) {
        fineBySession.set(fine.sessionId, fine);
      }
    }

    const standingBySession = new Map<string, PraktikanSessionStanding>();

    for (const session of sessions) {
      const lab = session.labId ? labsById.get(session.labId) ?? null : null;
      const gracePeriodMinutes = lab?.gracePeriodMinutes ?? null;
      const rawAtt = attBySession.get(session.id) ?? null;
      const enrichedAtt: AttendanceTimingRecord | null = rawAtt
        ? {
            ...rawAtt,
            sessionDate: session.date,
            sessionStartTime: session.startTime,
          }
        : null;
      const perm = permBySession.get(session.id) ?? null;
      const approved = perm?.status === 'disetujui';

      const status = resolveAttendanceStatus(
        enrichedAtt,
        approved,
        gracePeriodMinutes,
      );
      const lateness =
        status === 'terlambat' && enrichedAtt
          ? evaluateAttendanceLateness(enrichedAtt, gracePeriodMinutes)
          : { onTime: true, lateMinutes: 0, source: 'fallback' as const };

      standingBySession.set(session.id, {
        sessionId: session.id,
        status,
        lateMinutes: status === 'terlambat' ? lateness.lateMinutes : 0,
        attendedAt: status === 'izin' ? null : (enrichedAtt?.attendedAt ?? null),
        ...(enrichedAtt?.distanceMeters !== undefined
          ? { distanceMeters: enrichedAtt.distanceMeters }
          : {}),
        ...(enrichedAtt?.verificationMethod
          ? { verificationMethod: enrichedAtt.verificationMethod }
          : {}),
        permissionStatus: perm?.status ?? null,
        permissionReason: perm?.reason ?? null,
        presentation: describeAttendanceStatus(status, lateness.lateMinutes),
        fine: fineBySession.get(session.id) ?? null,
        gracePeriodMinutes,
      });
    }

    const attendanceHistory = attendance.map((rec) => {
      const sessionId = rec.sessionId ?? '';
      const session = sessionId ? sessionById.get(sessionId) ?? null : null;
      const lab = session?.labId ? labsById.get(session.labId) ?? null : null;
      const gracePeriodMinutes = lab?.gracePeriodMinutes ?? null;
      const perm = sessionId ? permBySession.get(sessionId) ?? null : null;
      const approved = perm?.status === 'disetujui';

      const enriched: AttendanceTimingRecord = session
        ? { ...rec, sessionDate: session.date, sessionStartTime: session.startTime }
        : rec;

      const resolvedStatus = resolveAttendanceStatus(
        enriched,
        approved,
        gracePeriodMinutes,
      );
      const lateness =
        resolvedStatus === 'terlambat'
          ? evaluateAttendanceLateness(enriched, gracePeriodMinutes)
          : { onTime: true, lateMinutes: 0, source: 'fallback' as const };

      return {
        ...rec,
        resolvedStatus,
        resolvedLateMinutes: resolvedStatus === 'terlambat' ? lateness.lateMinutes : 0,
        presentation: describeAttendanceStatus(resolvedStatus, lateness.lateMinutes),
        fine: sessionId ? fineBySession.get(sessionId) ?? null : null,
      };
    });

    const unpaidFines = fines.filter(
      (f) => f.status === 'pending' || f.status === 'failed',
    );
    const totalUnpaidAmount = unpaidFines.reduce((sum, f) => sum + f.amount, 0);

    return {
      standingBySession,
      attendanceHistory,
      unpaidFines,
      totalUnpaidAmount,
    };
  }, [sessions, attendance, permissions, fines, labsById]);

  return {
    labsById,
    standingBySession: computed.standingBySession,
    attendanceHistory: computed.attendanceHistory,
    fines,
    unpaidFines: computed.unpaidFines,
    totalUnpaidAmount: computed.totalUnpaidAmount,
    loading: subKey !== null && (!isCurrent || state.readyMask !== 0b1111),
    error: isCurrent ? state.error : null,
  };
}
