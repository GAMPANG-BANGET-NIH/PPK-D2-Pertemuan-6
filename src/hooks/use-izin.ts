import { useEffect, useMemo, useState } from 'react';
import { submitPermission, subscribeMyPermissions, type PermissionRequest } from '../services/izin';
import type { AppUser, Session } from '../types';

export function useIzin(user: AppUser | null, session: Session | null) {
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = user?.uid;

  useEffect(() => {
    setPermissions([]);
    setError(null);
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    let active = true;
    const unsubscribe = subscribeMyPermissions(uid,
      (data) => { if (active) { setPermissions(data); setLoading(false); } },
      (err) => { if (active) { setError(err.message); setLoading(false); } }
    );
    return () => { active = false; unsubscribe(); };
  }, [uid]);

  const permission = useMemo(() =>
    permissions.find((item) => item.sessionId === session?.id) ?? null,
    [permissions, session?.id]
  );

  async function requestPermission(reason: string): Promise<boolean> {
    if (!user || !session) { setError('Pilih sesi dan login terlebih dahulu.'); return false; }
    if (submitting) return false;
    setSubmitting(true);
    setError(null);
    try {
      await submitPermission(user, session, reason);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengajukan izin.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { permission, permissions, loading, submitting, error, requestPermission };
}
