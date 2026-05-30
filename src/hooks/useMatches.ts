import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Match } from '@/types';
import { useAuthStore } from '@/stores/authStore';

export function useMatches() {
  const { coupleId } = useAuthStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) {
      setMatches([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'matches'),
      where('couple_id', '==', coupleId),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Match));
        all.sort((a, b) => b.matched_at.localeCompare(a.matched_at));
        setMatches(all);
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );

    return unsub;
  }, [coupleId]);

  return { matches, isLoading };
}
