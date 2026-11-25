import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppUser } from '../types';

export interface GeolocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GeolocationValidationInput {
  userLat: number;
  userLon: number;
  userAccuracy: number;
  labLat: number;
  labLon: number;
  labRadiusMeters: number;
  maxAccuracyThresholdMeters?: number;
}

export interface GeolocationValidationResult {
  valid: boolean;
  distanceMeters: number;
  reason: 'within_radius' | 'outside_radius' | 'accuracy_too_low';
  message: string;
}

/**
 * Menghitung jarak antara dua koordinat koordinat bumi menggunakan formula Haversine (dalam meter).
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10;
}

/**
 * Memvalidasi apakah posisi pengguna berada di dalam radius laboratorium dan memiliki akurasi GPS yang memadai.
 */
export function validateGeolocation(input: GeolocationValidationInput): GeolocationValidationResult {
  const maxAccuracy = input.maxAccuracyThresholdMeters ?? 50;

  if (input.userAccuracy > maxAccuracy) {
    return {
      valid: false,
      distanceMeters: -1,
      reason: 'accuracy_too_low',
      message: `Akurasi sinyal GPS perangkat Anda (${Math.round(input.userAccuracy)}m) terlalu rendah. Diperlukan akurasi ≤ ${maxAccuracy}m.`,
    };
  }

  const distance = calculateHaversineDistanceMeters(
    input.userLat,
    input.userLon,
    input.labLat,
    input.labLon
  );

  if (distance > input.labRadiusMeters) {
    return {
      valid: false,
      distanceMeters: distance,
      reason: 'outside_radius',
      message: `Anda berada di luar area laboratorium (${Math.round(distance)}m dari lab, batas maksimal ${input.labRadiusMeters}m).`,
    };
  }

  return {
    valid: true,
    distanceMeters: distance,
    reason: 'within_radius',
    message: `Posisi valid (${Math.round(distance)}m dari titik pusat lab).`,
  };
}

/**
 * Endpoint verifikasi dan pencatatan presensi GPS secara atomik menggunakan Firestore Transaction.
 */
export async function verifyAndRecordAttendance(
  user: AppUser,
  sessionId: string,
  userLocation: GeolocationCoords
): Promise<{ success: boolean; distanceMeters: number; message: string }> {
  if (user.role !== 'praktikan') {
    throw new Error('Hanya praktikan yang dapat melakukan presensi.');
  }

  if (!user.classId) {
    throw new Error('Pengguna belum terdaftar di kelas praktikum manapun.');
  }

  return await runTransaction(db, async (transaction) => {
    // 1. Baca sesi
    const sessionDocRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await transaction.get(sessionDocRef);

    if (!sessionSnap.exists()) {
      throw new Error('Sesi praktikum tidak ditemukan.');
    }

    const sessionData = sessionSnap.data();

    if (sessionData.status !== 'dibuka') {
      throw new Error('Sesi praktikum belum dibuka atau sudah ditutup.');
    }

    if (sessionData.classId !== user.classId) {
      throw new Error('Sesi ini bukan untuk kelas praktikum Anda.');
    }

    const labId = sessionData.labId;
    if (!labId) {
      throw new Error('Sesi praktikum belum memiliki data laboratorium yang valid.');
    }

    // 2. Baca laboratorium
    const labDocRef = doc(db, 'laboratories', labId);
    const labSnap = await transaction.get(labDocRef);

    if (!labSnap.exists()) {
      throw new Error('Data laboratorium tidak ditemukan di sistem.');
    }

    const labData = labSnap.data();
    if (!labData.active) {
      throw new Error('Laboratorium saat ini sedang nonaktif.');
    }

    // 3. Validasi Geolocation & Akurasi
    const validation = validateGeolocation({
      userLat: userLocation.latitude,
      userLon: userLocation.longitude,
      userAccuracy: userLocation.accuracy,
      labLat: labData.latitude,
      labLon: labData.longitude,
      labRadiusMeters: labData.radiusMeters,
    });

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // 4. Periksa apakah sudah pernah presensi
    const attendanceDocRef = doc(db, 'sessions', sessionId, 'attendance', user.uid);
    const attendanceSnap = await transaction.get(attendanceDocRef);

    if (attendanceSnap.exists()) {
      throw new Error('Anda sudah melakukan presensi pada sesi ini.');
    }

    // 5. Tulis presensi secara atomik
    transaction.set(attendanceDocRef, {
      uid: user.uid,
      name: user.name,
      classId: user.classId,
      attendedAt: serverTimestamp(),
      verificationMethod: 'geolocation',
      distanceMeters: Math.round(validation.distanceMeters),
      validatedAt: serverTimestamp(),
    });

    return {
      success: true,
      distanceMeters: validation.distanceMeters,
      message: 'Presensi berbasis lokasi berhasil dicatat.',
    };
  });
}
