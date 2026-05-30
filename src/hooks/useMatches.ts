import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Match } from '@/types';
import { useAuthStore } from '@/stores/authStore';

export function useMatches() {
  const groupId = useAuthStore((s) => s.groupId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setMatches([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'matches'),
      where('couple_id', '==', groupId),
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
  }, [groupId]);

  return { matches, isLoading };
}
