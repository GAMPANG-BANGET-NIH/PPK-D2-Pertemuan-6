import { useEffect, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { AppUser } from '../types';
import { getDeviceId } from '../lib/notifications';
import {
  requestNotificationPermission,
  getPushToken,
  registerPushToken,
} from '../services/notifications';

export function useNotifications(user: AppUser | null) {
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [canAskAgain, setCanAskAgain] = useState<boolean>(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);

  const performRegistration = useCallback(async (currentUser: AppUser) => {
    try {
      const devId = await getDeviceId();
      setDeviceId(devId);

      const permResult = await requestNotificationPermission();
      setPermissionGranted(permResult.granted);
      setCanAskAgain(permResult.canAskAgain);

      if (permResult.granted) {
        const token = await getPushToken();
        if (token) {
          setPushToken(token);
          await registerPushToken(currentUser.uid, token, devId);
        }
      }
    } catch (error) {
      console.warn('Terjadi kesalahan pada siklus notifikasi:', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (user) {
      void (async () => {
        try {
          const devId = await getDeviceId();
          if (!isMounted) return;
          setDeviceId(devId);

          const permResult = await requestNotificationPermission();
          if (!isMounted) return;
          setPermissionGranted(permResult.granted);
          setCanAskAgain(permResult.canAskAgain);

          if (permResult.granted) {
            const token = await getPushToken();
            if (!isMounted) return;
            if (token) {
              setPushToken(token);
              await registerPushToken(user.uid, token, devId);
            }
          }
        } catch (error) {
          console.warn('Terjadi kesalahan saat sinkronisasi notifikasi:', error);
        }
      })();
    }

    const notifSub = Notifications.addNotificationReceivedListener((notification) => {
      setLastNotification(notification);
    });

    const respSub = Notifications.addNotificationResponseReceivedListener((response) => {
      console.info('Notifikasi dibuka oleh pengguna:', response.notification.request.content);
    });

    return () => {
      isMounted = false;
      notifSub.remove();
      respSub.remove();
    };
  }, [user]);

  const requestPermission = useCallback(async () => {
    if (!user) return;
    await performRegistration(user);
  }, [user, performRegistration]);

  return {
    permissionGranted,
    canAskAgain,
    pushToken,
    deviceId,
    lastNotification,
    requestPermission,
  };
}
