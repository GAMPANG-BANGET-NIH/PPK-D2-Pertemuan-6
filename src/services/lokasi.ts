/**
 * Service Geolokasi — Sprint 3, SRS-02, SRS-04, SRS-07 (Moses).
 *
 * Kontrak antarmodul (docs/PEMBAGIAN.md):
 *   getCurrentLocation(): Promise<LocationReading>
 *   watchUserLocation(onData, onError): Unsubscribe
 *
 * Kebijakan akurasi, kesegaran data, dan risiko spoofing (SRS-02):
 * - Batas toleransi akurasi GPS: <= 500 meter (selaras dengan batas default
 *   `validateGeolocation` di `src/services/attendance-verification.ts`).
 * - Batas kesegaran pembacaan lokasi: <= 60 detik sejak timestamp pengukuran.
 * - Batas timeout pengambilan lokasi: 15 detik agar UI tidak menggantung.
 * - Perhitungan jarak di sisi klien (Haversine) HANYA bersifat umpan balik UI.
 *   Validasi akhir identitas, kelas, status sesi, radius, dan pencegahan
 *   duplikasi tetap dilakukan secara atomik melalui jalur verifikasi terpadu
 *   (`verifyAndRecordAttendance`).
 * - Risiko spoofing: koordinat GPS perangkat (termasuk mock location) tetap
 *   berpotensi dimanipulasi di sisi perangkat; GPS saja tidak menjamin
 *   anti-spoofing penuh. Nilai `mocked` (Android) diteruskan sebagai informasi
 *   pendukung bila tersedia.
 */
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

import {
  calculateHaversineDistanceMeters,
  validateGeolocation,
} from './attendance-verification';

export const MAX_ACCURACY_METERS = 500;
export const MAX_LOCATION_AGE_MS = 60_000;
export const MAX_FUTURE_DRIFT_MS = 30_000;
export const DEFAULT_LOCATION_TIMEOUT_MS = 15_000;

export type LocationErrorCode =
  | 'permission_denied'
  | 'permission_blocked'
  | 'gps_disabled'
  | 'timeout'
  | 'accuracy_unavailable'
  | 'location_unavailable';

export class LocationServiceError extends Error {
  readonly code: LocationErrorCode;
  readonly canAskAgain: boolean;

  constructor(code: LocationErrorCode, message: string, canAskAgain = true) {
    super(message);
    this.name = 'LocationServiceError';
    this.code = code;
    this.canAskAgain = canAskAgain;
  }
}

export type LocationReading = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  mocked?: boolean;
};

export type LocationFreshnessCheck = {
  valid: boolean;
  reason: 'ok' | 'stale' | 'invalid_coords' | 'invalid_accuracy' | 'accuracy_too_low';
  ageMs: number;
  message: string;
};

export type LabProximityTarget = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
};

export type LabProximityReason =
  | 'eligible'
  | 'lab_inactive'
  | 'outside_radius'
  | 'accuracy_too_low'
  | 'stale_location'
  | 'invalid_location';

export type LabProximityCheck = {
  eligible: boolean;
  withinRadius: boolean;
  accuracyValid: boolean;
  fresh: boolean;
  labActive: boolean;
  distanceMeters: number;
  overflowMeters: number;
  reason: LabProximityReason;
  message: string;
};

export type GetCurrentLocationOptions = {
  timeoutMs?: number;
  accuracy?: Location.LocationAccuracy;
};

export type WatchLocationOptions = {
  timeInterval?: number;
  distanceInterval?: number;
  accuracy?: Location.LocationAccuracy;
};

export type LocationUnsubscribe = () => void;

/* ------------------------------------------------------------------ */
/* Helper murni (mudah diuji secara unit test)                         */
/* ------------------------------------------------------------------ */

export function isValidCoordinatePair(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Mengonversi `LocationObject` dari `expo-location` ke `LocationReading`
 * tervalidasi. Menolak akurasi `null`/<=0 agar tidak disalahartikan sebagai 0m.
 */
export function toLocationReading(loc: Location.LocationObject): LocationReading {
  const { latitude, longitude, accuracy } = loc.coords;

  if (!isValidCoordinatePair(latitude, longitude)) {
    throw new LocationServiceError(
      'location_unavailable',
      'Koordinat GPS yang diterima tidak valid. Silakan ambil ulang lokasi.',
    );
  }

  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy <= 0) {
    throw new LocationServiceError(
      'accuracy_unavailable',
      'Nilai akurasi GPS perangkat tidak tersedia. Pindah ke area yang lebih terbuka lalu coba lagi.',
    );
  }

  const timestamp =
    typeof loc.timestamp === 'number' && Number.isFinite(loc.timestamp) && loc.timestamp > 0
      ? loc.timestamp
      : Date.now();

  return {
    latitude,
    longitude,
    accuracy,
    timestamp,
    ...(typeof loc.mocked === 'boolean' ? { mocked: loc.mocked } : {}),
  };
}

/** Memeriksa validitas koordinat, batas akurasi, dan kesegaran timestamp. */
export function validateLocationReading(
  reading: LocationReading,
  options?: {
    maxAccuracyMeters?: number;
    maxAgeMs?: number;
    nowMs?: number;
  },
): LocationFreshnessCheck {
  const maxAccuracy = options?.maxAccuracyMeters ?? MAX_ACCURACY_METERS;
  const maxAgeMs = options?.maxAgeMs ?? MAX_LOCATION_AGE_MS;
  const nowMs = options?.nowMs ?? Date.now();

  if (!isValidCoordinatePair(reading.latitude, reading.longitude)) {
    return {
      valid: false,
      reason: 'invalid_coords',
      ageMs: 0,
      message: 'Koordinat lokasi tidak valid. Silakan ambil ulang posisi GPS.',
    };
  }

  if (!Number.isFinite(reading.accuracy) || reading.accuracy <= 0) {
    return {
      valid: false,
      reason: 'invalid_accuracy',
      ageMs: 0,
      message: 'Akurasi GPS tidak valid. Silakan ambil ulang posisi GPS.',
    };
  }

  const ageMs = nowMs - reading.timestamp;
  if (!Number.isFinite(reading.timestamp) || ageMs > maxAgeMs || ageMs < -MAX_FUTURE_DRIFT_MS) {
    return {
      valid: false,
      reason: 'stale',
      ageMs: Math.max(0, ageMs),
      message: `Data lokasi sudah lebih dari ${Math.round(maxAgeMs / 1000)} detik. Perbarui lokasi GPS terlebih dahulu.`,
    };
  }

  if (reading.accuracy > maxAccuracy) {
    return {
      valid: false,
      reason: 'accuracy_too_low',
      ageMs: Math.max(0, ageMs),
      message: `Akurasi GPS saat ini (±${Math.round(reading.accuracy)} m) terlalu rendah. Diperlukan akurasi ≤ ${maxAccuracy} m.`,
    };
  }

  return {
    valid: true,
    reason: 'ok',
    ageMs: Math.max(0, ageMs),
    message: `Sinyal GPS memadai (±${Math.round(reading.accuracy)} m).`,
  };
}

/**
 * Menghitung jarak pengguna ke laboratorium dan memeriksa kesesuaian radius
 * sebagai umpan balik UI (bukan pengganti validasi akhir saat pencatatan).
 */
export function evaluateLabProximity(
  reading: LocationReading,
  lab: LabProximityTarget,
  options?: {
    maxAccuracyMeters?: number;
    maxAgeMs?: number;
    nowMs?: number;
  },
): LabProximityCheck {
  const maxAccuracy = options?.maxAccuracyMeters ?? MAX_ACCURACY_METERS;
  const freshness = validateLocationReading(reading, options);

  const hasValidCoords =
    isValidCoordinatePair(reading.latitude, reading.longitude) &&
    isValidCoordinatePair(lab.latitude, lab.longitude);

  const distanceMeters = hasValidCoords
    ? calculateHaversineDistanceMeters(
        reading.latitude,
        reading.longitude,
        lab.latitude,
        lab.longitude,
      )
    : -1;

  const withinRadius =
    hasValidCoords &&
    Number.isFinite(lab.radiusMeters) &&
    lab.radiusMeters > 0 &&
    distanceMeters <= lab.radiusMeters;

  const overflowMeters =
    hasValidCoords && Number.isFinite(lab.radiusMeters) && distanceMeters > lab.radiusMeters
      ? Math.round((distanceMeters - lab.radiusMeters) * 10) / 10
      : 0;

  if (freshness.reason === 'invalid_coords' || freshness.reason === 'invalid_accuracy') {
    return {
      eligible: false,
      withinRadius: false,
      accuracyValid: false,
      fresh: false,
      labActive: lab.active,
      distanceMeters,
      overflowMeters,
      reason: 'invalid_location',
      message: freshness.message,
    };
  }

  if (freshness.reason === 'stale') {
    return {
      eligible: false,
      withinRadius,
      accuracyValid: reading.accuracy <= maxAccuracy,
      fresh: false,
      labActive: lab.active,
      distanceMeters,
      overflowMeters,
      reason: 'stale_location',
      message: freshness.message,
    };
  }

  if (!lab.active) {
    return {
      eligible: false,
      withinRadius,
      accuracyValid: freshness.valid,
      fresh: true,
      labActive: false,
      distanceMeters,
      overflowMeters,
      reason: 'lab_inactive',
      message: 'Laboratorium saat ini sedang nonaktif sehingga presensi lokasi tidak tersedia.',
    };
  }

  const geoValidation = validateGeolocation({
    userLat: reading.latitude,
    userLon: reading.longitude,
    userAccuracy: reading.accuracy,
    labLat: lab.latitude,
    labLon: lab.longitude,
    labRadiusMeters: lab.radiusMeters,
    maxAccuracyThresholdMeters: maxAccuracy,
  });

  if (!geoValidation.valid) {
    if (geoValidation.reason === 'accuracy_too_low') {
      return {
        eligible: false,
        withinRadius,
        accuracyValid: false,
        fresh: true,
        labActive: true,
        distanceMeters,
        overflowMeters,
        reason: 'accuracy_too_low',
        message: geoValidation.message,
      };
    }

    return {
      eligible: false,
      withinRadius: false,
      accuracyValid: true,
      fresh: true,
      labActive: true,
      distanceMeters: geoValidation.distanceMeters,
      overflowMeters,
      reason: 'outside_radius',
      message: geoValidation.message,
    };
  }

  return {
    eligible: true,
    withinRadius: true,
    accuracyValid: true,
    fresh: true,
    labActive: true,
    distanceMeters: geoValidation.distanceMeters,
    overflowMeters: 0,
    reason: 'eligible',
    message: geoValidation.message,
  };
}

export function formatDistanceMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '-';
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  if (!isValidCoordinatePair(latitude, longitude)) {
    return '-';
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/** Normalisasi error mentah dari expo-location/OS menjadi pesan Bahasa Indonesia. */
export function normalizeLocationError(error: unknown): LocationServiceError {
  if (error instanceof LocationServiceError) {
    return error;
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const lower = rawMessage.toLowerCase();

  if (lower.includes('permission') || lower.includes('denied') || lower.includes('not authorized')) {
    return new LocationServiceError(
      'permission_denied',
      'Izin lokasi ditolak. Izinkan akses lokasi pada perangkat agar posisi Anda dapat dibaca.',
      true,
    );
  }

  if (
    lower.includes('disabled') ||
    lower.includes('location services') ||
    lower.includes('provider') ||
    lower.includes('gps')
  ) {
    return new LocationServiceError(
      'gps_disabled',
      'Layanan lokasi (GPS) perangkat sedang mati. Aktifkan GPS lalu coba lagi.',
      true,
    );
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return new LocationServiceError(
      'timeout',
      'Waktu pencarian sinyal GPS habis. Pastikan GPS aktif dan coba lagi di area terbuka.',
      true,
    );
  }

  return new LocationServiceError(
    'location_unavailable',
    'Lokasi perangkat belum dapat diperoleh. Pastikan GPS aktif lalu coba lagi.',
    true,
  );
}

/* ------------------------------------------------------------------ */
/* Akses perangkat (izin, GPS, baca sekali, pantau realtime)           */
/* ------------------------------------------------------------------ */

export async function ensureLocationAccess(): Promise<void> {
  if (Platform.OS !== 'web') {
    let servicesEnabled = true;
    try {
      servicesEnabled = await Location.hasServicesEnabledAsync();
    } catch {
      servicesEnabled = true;
    }

    if (!servicesEnabled) {
      throw new LocationServiceError(
        'gps_disabled',
        'Layanan lokasi (GPS) perangkat sedang mati. Aktifkan GPS di pengaturan perangkat lalu coba lagi.',
        true,
      );
    }
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== 'granted') {
    if (!permission.canAskAgain) {
      throw new LocationServiceError(
        'permission_blocked',
        'Izin lokasi ditolak permanen. Buka Pengaturan aplikasi lalu aktifkan izin Lokasi.',
        false,
      );
    }
    throw new LocationServiceError(
      'permission_denied',
      'Izin lokasi ditolak. Aplikasi memerlukan izin lokasi untuk verifikasi presensi dan peta laboratorium.',
      true,
    );
  }
}

/**
 * Mengambil lokasi perangkat saat ini satu kali dengan timeout terkelola.
 * Memeriksa GPS aktif & izin lokasi sebelum membaca sensor.
 */
export async function getCurrentLocation(
  options?: GetCurrentLocationOptions,
): Promise<LocationReading> {
  await ensureLocationAccess();

  const timeoutMs = options?.timeoutMs ?? DEFAULT_LOCATION_TIMEOUT_MS;
  const accuracy = options?.accuracy ?? Location.Accuracy.High;

  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const locationPromise = Location.getCurrentPositionAsync({ accuracy });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new LocationServiceError(
            'timeout',
            'Waktu pencarian sinyal GPS habis. Pastikan GPS aktif dan coba lagi di area yang lebih terbuka.',
          ),
        );
      }, timeoutMs);
    });

    const loc = await Promise.race([locationPromise, timeoutPromise]);
    return toLocationReading(loc);
  } catch (error) {
    throw normalizeLocationError(error);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

/**
 * Memantau perubahan posisi pengguna secara realtime.
 * Mengembalikan fungsi `unsubscribe` sinkron yang aman dipanggil kapan saja
 * (termasuk sebelum `watchPositionAsync` selesai inisialisasi).
 */
export function watchUserLocation(
  onData: (reading: LocationReading) => void,
  onError: (error: LocationServiceError) => void,
  options?: WatchLocationOptions,
): LocationUnsubscribe {
  let cancelled = false;
  let subscription: Location.LocationSubscription | null = null;

  const start = async () => {
    try {
      await ensureLocationAccess();
      if (cancelled) return;

      const sub = await Location.watchPositionAsync(
        {
          accuracy: options?.accuracy ?? Location.Accuracy.High,
          timeInterval: options?.timeInterval ?? 5000,
          distanceInterval: options?.distanceInterval ?? 5,
        },
        (loc) => {
          if (cancelled) return;
          try {
            onData(toLocationReading(loc));
          } catch (conversionError) {
            onError(normalizeLocationError(conversionError));
          }
        },
        (reason) => {
          if (cancelled) return;
          onError(normalizeLocationError(reason));
        },
      );

      if (cancelled) {
        sub.remove();
        return;
      }

      subscription = sub;
    } catch (error) {
      if (!cancelled) {
        onError(normalizeLocationError(error));
      }
    }
  };

  void start();

  return () => {
    cancelled = true;
    if (subscription) {
      subscription.remove();
      subscription = null;
    }
  };
}

export async function openAppLocationSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
