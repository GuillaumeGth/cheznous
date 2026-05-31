import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot, getDoc, doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserSearchResult } from '@/types';
import { useAuthStore } from '@/stores/authStore';

/**
 * Liste réactive des utilisateurs suivis par l'utilisateur courant.
 * Subscribe une fois sur `follows where follower_id == uid` (dep primitive),
 * puis résout les profils correspondants.
 */
export function useFollowing(): { following: UserSearchResult[]; loading: boolean } {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [following, setFollowing] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setFollowing([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const q = query(collection(db, 'follows'), where('follower_id', '==', uid));
    const unsub = onSnapshot(q, async (snap) => {
      const ids = snap.docs.map((d) => d.data().following_id as string);
      const profiles = await Promise.all(
        ids.map(async (id) => {
          const s = await getDoc(doc(db, 'users', id));
          if (!s.exists()) return null;
          const d = s.data();
          return {
            uid: s.id,
            display_name: d.display_name as string,
            email: d.email as string,
            photo_url: (d.photo_url as string | null) ?? null,
          } as UserSearchResult;
        }),
      );
      setFollowing(profiles.filter(Boolean) as UserSearchResult[]);
      setLoading(false);
    });

    return unsub;
  }, [uid]);

  return { following, loading };
}
