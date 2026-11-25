/**
 * Hook Geolokasi — Sprint 3, SRS-02, SRS-04, SRS-07 (Moses).
 *
 * - `useCurrentLocation`: pengambilan lokasi satu kali untuk halaman presensi
 *   GPS, mencegah race condition saat ketukan ulang / unmount.
 * - `useWatchLocation`: pemantauan lokasi realtime untuk halaman Maps.
 *   Otomatis berhenti saat layar tidak fokus, aplikasi pindah ke background,
 *   atau komponen dilepas (SRS-04).
 */
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  getCurrentLocation,
  normalizeLocationError,
  watchUserLocation,
  type GetCurrentLocationOptions,
  type LocationErrorCode,
  type LocationReading,
  type WatchLocationOptions,
} from '../services/lokasi';

/* ------------------------------------------------------------------ */
/* Pengambilan lokasi satu kali (untuk halaman presensi GPS)           */
/* ------------------------------------------------------------------ */

export type CurrentLocationState = {
  reading: LocationReading | null;
  loading: boolean;
  error: string | null;
  errorCode: LocationErrorCode | null;
  canAskAgain: boolean;
  lastUpdatedAt: Date | null;
  refresh: () => Promise<LocationReading | null>;
};

export function useCurrentLocation(
  options?: GetCurrentLocationOptions & { autoFetch?: boolean },
): CurrentLocationState {
  const autoFetch = options?.autoFetch ?? false;
  const timeoutMs = options?.timeoutMs;
  const accuracy = options?.accuracy;

  const [reading, setReading] = useState<LocationReading | null>(null);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<LocationErrorCode | null>(null);
  const [canAskAgain, setCanAskAgain] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<LocationReading | null> => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const next = await getCurrentLocation({ timeoutMs, accuracy });
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }
      setReading(next);
      setError(null);
      setErrorCode(null);
      setCanAskAgain(true);
      setLastUpdatedAt(new Date(next.timestamp));
      setLoading(false);
      return next;
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }
      const normalized = normalizeLocationError(err);
      setError(normalized.message);
      setErrorCode(normalized.code);
      setCanAskAgain(normalized.canAskAgain);
      setLoading(false);
      return null;
    }
  }, [timeoutMs, accuracy]);

  useEffect(() => {
    if (!autoFetch) {
      return;
    }

    let active = true;
    const requestId = ++requestIdRef.current;

    getCurrentLocation({ timeoutMs, accuracy })
      .then((next) => {
        if (!active || !mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }
        setReading(next);
        setError(null);
        setErrorCode(null);
        setCanAskAgain(true);
        setLastUpdatedAt(new Date(next.timestamp));
        setLoading(false);
      })
      .catch((err) => {
        if (!active || !mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }
        const normalized = normalizeLocationError(err);
        setError(normalized.message);
        setErrorCode(normalized.code);
        setCanAskAgain(normalized.canAskAgain);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [autoFetch, timeoutMs, accuracy]);

  return {
    reading,
    loading,
    error,
    errorCode,
    canAskAgain,
    lastUpdatedAt,
    refresh,
  };
}

/* ------------------------------------------------------------------ */
/* Pemantauan lokasi realtime (untuk halaman Maps)                     */
/* ------------------------------------------------------------------ */

export type WatchLocationState = {
  reading: LocationReading | null;
  loading: boolean;
  watching: boolean;
  error: string | null;
  errorCode: LocationErrorCode | null;
  canAskAgain: boolean;
  lastUpdatedAt: Date | null;
  retry: () => void;
};

type WatchSnapshot = {
  attempt: number;
  reading: LocationReading | null;
  error: string | null;
  errorCode: LocationErrorCode | null;
  canAskAgain: boolean;
  lastUpdatedAt: Date | null;
  settled: boolean;
};

export function useWatchLocation(
  options?: WatchLocationOptions & { enabled?: boolean },
): WatchLocationState {
  const enabled = options?.enabled ?? true;
  const timeInterval = options?.timeInterval ?? 5000;
  const distanceInterval = options?.distanceInterval ?? 5;
  const accuracy = options?.accuracy;

  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState<boolean>(AppState.currentState === 'active');
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<WatchSnapshot>({
    attempt: -1,
    reading: null,
    error: null,
    errorCode: null,
    canAskAgain: true,
    lastUpdatedAt: null,
    settled: false,
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppActive(nextState === 'active');
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const shouldWatch = enabled && isFocused && appActive;

  useEffect(() => {
    if (!shouldWatch) {
      return;
    }

    const unsubscribe = watchUserLocation(
      (nextReading) => {
        setSnapshot({
          attempt,
          reading: nextReading,
          error: null,
          errorCode: null,
          canAskAgain: true,
          lastUpdatedAt: new Date(nextReading.timestamp),
          settled: true,
        });
      },
      (locError) => {
        setSnapshot((prev) => ({
          attempt,
          reading: prev.reading,
          error: locError.message,
          errorCode: locError.code,
          canAskAgain: locError.canAskAgain,
          lastUpdatedAt: prev.lastUpdatedAt,
          settled: true,
        }));
      },
      { timeInterval, distanceInterval, accuracy },
    );

    return () => {
      unsubscribe();
    };
  }, [shouldWatch, attempt, timeInterval, distanceInterval, accuracy]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  const currentAttempt = snapshot.attempt === attempt;

  return {
    reading: snapshot.reading,
    loading: shouldWatch && (!currentAttempt || !snapshot.settled),
    watching: shouldWatch,
    error: currentAttempt ? snapshot.error : null,
    errorCode: currentAttempt ? snapshot.errorCode : null,
    canAskAgain: currentAttempt ? snapshot.canAskAgain : true,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    retry,
  };
}
