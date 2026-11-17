
import { useEffect, useState } from 'react';

import type { PermissionRequest } from '../services/izin';
import {
    submitPermission,
    subscribeMyPermission,
} from '../services/izin';
import type { AppUser, Session } from '../types';

export function useIzin(
  user: AppUser | null,
  session: Session | null
) {
  const [permission, setPermission] =
    useState<PermissionRequest | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPermission(null);
    setError(null);

    if (!user || !session) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeMyPermission(
      session.id,
      user.uid,
      (data) => {
        setPermission(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, session?.id]);

  async function requestPermission(reason: string) {
    if (!user || !session) {
      setError('Pilih sesi dan login terlebih dahulu.');
      return false;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitPermission(user, session, reason);
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal mengajukan izin.'
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    permission,
    loading,
    submitting,
    error,
    requestPermission,
  };
}
