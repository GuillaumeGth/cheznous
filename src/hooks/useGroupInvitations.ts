import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GroupInvitation } from '@/types';
import { useAuthStore } from '@/stores/authStore';

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
      setInvitations(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupInvitation)),
      );
    });

    return unsub;
  }, [uid]);

  return invitations;
}
