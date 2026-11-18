import NetInfo from '@react-native-community/netinfo';
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { assertReviewActor, permissionDecisionPatch, PermissionReviewError, readPermission, sortPermissions } from '@/lib/izin-review-policy';
import type { PermissionDecision } from '@/lib/izin-review-policy';
import type { PermissionRequest } from '@/types';

export function subscribeAllPermissions(
  cb: (permissions: PermissionRequest[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  let active = true;
  let unsubscribe: Unsubscribe | undefined;
  void import('@/lib/firebase').then(({ db }) => {
    if (!active) return;
    const stop = onSnapshot(collection(db, 'permissions'), snapshot => {
      if (!active) return;
      let rows: PermissionRequest[];
      try {
        rows = sortPermissions(snapshot.docs.map(item => readPermission(item.id, item.data())));
      } catch (error) {
        onError(error);
        return;
      }
      cb(rows);
    }, error => { if (active) onError(error); });
    if (active) unsubscribe = stop;
    else stop();
  }).catch(error => { if (active) onError(error); });
  return () => { if (active) { active = false; unsubscribe?.(); } };
}

export async function decidePermission(id: string, decision: PermissionDecision, asprakUid: string): Promise<void> {
  const { auth, db } = await import('@/lib/firebase');
  assertReviewActor(id, asprakUid, auth.currentUser?.uid ?? null, true);
  const network = await NetInfo.fetch();
  assertReviewActor(id, asprakUid, auth.currentUser?.uid ?? null,
    network.isConnected === true && network.isInternetReachable !== false);

  const permissionRef = doc(db, 'permissions', id);
  const actorRef = doc(db, 'users', asprakUid);
  // Transactions fail offline; unlike updateDoc this never queues a stale decision.
  await runTransaction(db, async transaction => {
    assertReviewActor(id, asprakUid, auth.currentUser?.uid ?? null, true);
    const actor = await transaction.get(actorRef);
    const permission = await transaction.get(permissionRef);
    if (!actor.exists() || actor.data().role !== 'asprak') {
      throw new PermissionReviewError('Hanya Asprak yang dapat memutuskan izin.');
    }
    if (!permission.exists()) throw new PermissionReviewError('Pengajuan izin tidak ditemukan.');
    assertReviewActor(id, asprakUid, auth.currentUser?.uid ?? null, true);
    transaction.update(permissionRef,
      permissionDecisionPatch(permission.data().status, decision, asprakUid, serverTimestamp()));
  });
}
