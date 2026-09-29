import { useCallback, useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot, getDocsFromServer, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Match } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { alog } from '@/lib/adminLogger';

const matchesQuery = (groupId: string) =>
  query(collection(db, 'matches'), where('couple_id', '==', groupId));

function toSortedMatches(docs: QueryDocumentSnapshot[]): Match[] {
  const all = docs.map((d) => ({ id: d.id, ...d.data() } as Match));
  all.sort((a, b) => b.matched_at.localeCompare(a.matched_at));
  return all;
}

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

    const unsub = onSnapshot(
      matchesQuery(groupId),
      (snap) => {
        alog('Firestore:onSnapshot matches', { groupId, count: snap.docs.length });
        setMatches(toSortedMatches(snap.docs));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );

    return unsub;
  }, [groupId]);

  // Pull-to-refresh: re-read from the server, bypassing the local cache.
  const refresh = useCallback(async () => {
    const { groupId: gid } = useAuthStore.getState();
    if (!gid) return;
    alog('Firestore:getDocsFromServer matches (refresh)', { groupId: gid });
    const snap = await getDocsFromServer(matchesQuery(gid));
    setMatches(toSortedMatches(snap.docs));
  }, []);

  return { matches, isLoading, refresh };
}
