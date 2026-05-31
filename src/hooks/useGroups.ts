import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Group } from '@/types';
import { useAuthStore } from '@/stores/authStore';

/**
 * Liste réactive de tous les groupes dont l'utilisateur courant est membre.
 * Subscribe une fois sur `groups where member_ids array-contains uid`
 * (dep primitive `[uid]`, conforme à la règle state-stability).
 */
export function useGroups(): { groups: Group[]; loading: boolean } {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const q = query(
      collection(db, 'groups'),
      where('member_ids', 'array-contains', uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
      setLoading(false);
    });

    return unsub;
  }, [uid]);

  return { groups, loading };
}
