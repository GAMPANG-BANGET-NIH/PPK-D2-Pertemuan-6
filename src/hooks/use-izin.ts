import { useEffect, useMemo, useState } from 'react';
import { submitPermission, subscribeMyPermissions, type PermissionRequest } from '../services/izin';
import type { AppUser, Session } from '../types';
import { getErrorMessage } from '../utils/errors';

function toFriendlyError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return getErrorMessage(err);
  }
  return err instanceof Error ? err.message : fallback;
}

export function useIzin(user: AppUser | null, session: Session | null) {
  const uid = user?.uid ?? null;
  const [live, setLive] = useState<{
    uid: string | null;
    permissions: PermissionRequest[];
    error: string | null;
    loaded: boolean;
  }>({ uid: null, permissions: [], error: null, loaded: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    const unsubscribe = subscribeMyPermissions(
      uid,
      (data) => {
        if (active) setLive({ uid, permissions: data, error: null, loaded: true });
      },
      (err) => {
        console.error('[useIzin error]', err);
        if (active) {
          setLive((prev) => ({
            uid,
            permissions: prev.uid === uid ? prev.permissions : [],
            error: toFriendlyError(err, 'Gagal memuat data izin.'),
            loaded: true,
          }));
        }
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid]);

  const isCurrent = uid !== null && live.uid === uid;
  const permissions = useMemo(
    () => (isCurrent ? live.permissions : []),
    [isCurrent, live.permissions]
  );
  const loading = uid !== null && (!isCurrent || !live.loaded);
  const error = submitError ?? (isCurrent ? live.error : null);

  const permission = useMemo(
    () => permissions.find((item) => item.sessionId === session?.id) ?? null,
    [permissions, session?.id]
  );

  async function requestPermission(reason: string): Promise<boolean> {
    if (!user || !session) {
      setSubmitError('Pilih sesi dan login terlebih dahulu.');
      return false;
    }
    if (submitting) return false;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitPermission(user, session, reason);
      return true;
    } catch (err) {
      setSubmitError(toFriendlyError(err, 'Gagal mengajukan izin.'));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { permission, permissions, loading, submitting, error, requestPermission };
}
