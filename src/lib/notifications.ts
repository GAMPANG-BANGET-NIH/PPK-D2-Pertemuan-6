import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_STORAGE_KEY = '@praktikum_device_id';

// Konfigurasi handler notifikasi default untuk foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Mendapatkan ID unik perangkat yang stabil dan persisten.
 */
export async function getDeviceId(): Promise<string> {
  try {
    const cachedId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (cachedId) {
      return cachedId;
    }

    let generatedId: string | null = null;
    if (Platform.OS === 'android') {
      generatedId = Application.getAndroidId();
    } else if (Platform.OS === 'ios') {
      generatedId = await Application.getIosIdForVendorAsync();
    }

    if (!generatedId) {
      generatedId = `dev_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, generatedId);
    return generatedId;
  } catch {
    // Fallback darurat bila AsyncStorage bermasalah
    return `fallback_${Platform.OS}_${Date.now()}`;
  }
}
