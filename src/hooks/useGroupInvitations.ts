import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GroupInvitation } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { alog } from '@/lib/adminLogger';

export function useGroupInvitations(): GroupInvitation[] {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, 'group_invitations'),
      where('invitee_id', '==', uid),
      where('status', '==', 'pending'),
    );

    const unsub = onSnapshot(q, (snap) => {
      alog('Firestore:onSnapshot group_invitations', { uid, count: snap.docs.length });
      setInvitations(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupInvitation)),
      );
    });

    return unsub;
  }, [uid]);

  return invitations;
}
