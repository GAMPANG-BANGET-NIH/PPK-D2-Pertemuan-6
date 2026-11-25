import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { NotificationPayload } from '../types/notifications';

export interface PermissionStatusResult {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
}

/**
 * Memeriksa dan meminta izin push notification dari sistem operasi.
 */
export async function requestNotificationPermission(): Promise<PermissionStatusResult> {
  try {
    const existingStatus = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus.status !== Notifications.PermissionStatus.GRANTED) {
      finalStatus = await Notifications.requestPermissionsAsync();
    }

    return {
      granted: finalStatus.status === Notifications.PermissionStatus.GRANTED,
      canAskAgain: finalStatus.canAskAgain,
      status: finalStatus.status,
    };
  } catch (error) {
    console.warn('Gagal meminta izin notifikasi:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: Notifications.PermissionStatus.DENIED,
    };
  }
}

/**
 * Mengambil Expo Push Token untuk perangkat fisik.
 * Melewati proses secara anggun pada simulator / web tanpa token.
 */
export async function getPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.info('Push notification native memerlukan perangkat fisik. Simulator dilewati.');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    return tokenData.data;
  } catch (error) {
    console.warn('Gagal mendapatkan push token:', error);
    return null;
  }
}

/**
 * Menyimpan token push ke Firestore di bawah path users/{uid}/pushTokens/{deviceId}.
 */
export async function registerPushToken(
  uid: string,
  token: string,
  deviceId: string,
  platform: 'android' | 'ios' | 'web' = Platform.OS as 'android' | 'ios' | 'web'
): Promise<void> {
  if (!uid || !token || !deviceId) return;

  const tokenDocRef = doc(db, 'users', uid, 'pushTokens', deviceId);
  await setDoc(tokenDocRef, {
    token,
    platform,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Menghapus token push saat pengguna logout atau beralih akun.
 */
export async function unregisterPushToken(uid: string, deviceId: string): Promise<void> {
  if (!uid || !deviceId) return;

  try {
    const tokenDocRef = doc(db, 'users', uid, 'pushTokens', deviceId);
    await deleteDoc(tokenDocRef);
  } catch (error) {
    console.warn('Gagal menghapus token push saat logout:', error);
  }
}

/**
 * Menyiapkan payload pesan yang ramah dalam Bahasa Indonesia untuk peristiwa praktikum.
 */
export function formatTargetedNotification(
  event:
    | { type: 'session_opened'; sessionTitle: string; classId: string; labName?: string }
    | { type: 'schedule_changed'; course: string; classId: string }
    | { type: 'permission_decided'; sessionTitle: string; status: 'disetujui' | 'ditolak' }
): NotificationPayload {
  switch (event.type) {
    case 'session_opened':
      return {
        title: `Sesi Praktikum Dibuka: ${event.sessionTitle}`,
        body: `Sesi ${event.sessionTitle} kelas ${event.classId} telah dibuka${event.labName ? ` di ${event.labName}` : ''}. Silakan lakukan presensi di lab!`,
        data: { type: event.type, classId: event.classId },
      };

    case 'schedule_changed':
      return {
        title: 'Perubahan Jadwal Praktikum',
        body: `Terdapat perubahan pada jadwal mata praktikum ${event.course} kelas ${event.classId}.`,
        data: { type: event.type, classId: event.classId },
      };

    case 'permission_decided':
      return {
        title: `Pengajuan Izin: ${event.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}`,
        body: `Pengajuan izin Anda untuk sesi ${event.sessionTitle} telah ${event.status}.`,
        data: { type: event.type, status: event.status },
      };
  }
}

/**
 * Mengirim pesan push melalui layanan Expo Push API (dipakai oleh backend tepercaya atau simulasi).
 */
export async function sendExpoPushNotification(
  pushTokens: string[],
  payload: NotificationPayload
): Promise<void> {
  if (!pushTokens || pushTokens.length === 0) return;

  const validTokens = pushTokens.filter(
    (token) => typeof token === 'string' && (token.startsWith('ExponentPushToken') || token.length > 20)
  );
  if (validTokens.length === 0) return;

  const messages = validTokens.map((to) => ({
    to,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data,
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.warn('Gagal mengirim push notifications:', await response.text());
    }
  } catch (error) {
    console.warn('Error saat menghubungi Expo Push API:', error);
  }
}
