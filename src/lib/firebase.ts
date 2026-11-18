import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigurationMessage = 'Konfigurasi Firebase belum lengkap. Isi .env.local lalu mulai ulang aplikasi.';
if (Object.values(config).some((value) => !value?.trim())) throw new Error(firebaseConfigurationMessage);

export const app = getApps().length ? getApp() : initializeApp(config);
function initializePersistentAuth() {
  // Firebase 12 exposes this in its React Native runtime, but not its public types.
  const nativeAuth = FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence(storage: typeof AsyncStorage): FirebaseAuth.Persistence;
  };
  try {
    return FirebaseAuth.initializeAuth(app, {
      persistence: Platform.OS === 'web'
        ? FirebaseAuth.browserLocalPersistence
        : nativeAuth.getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/already-initialized') {
      return FirebaseAuth.getAuth(app);
    }
    throw error;
  }
}
export const auth = initializePersistentAuth();
export const db = getFirestore(app);
