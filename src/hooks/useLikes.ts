import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection, query, where, onSnapshot, getDocsFromServer, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/firebase';
import { queryClient } from '@/lib/queryClient';
import { Listing } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { fetchListingsByIds } from '@/services/listingsCache';
import { alog } from '@/lib/adminLogger';

export type Like = {
  id: string;
  listing_id: string;
  listing: Listing | null;
  liked_at: string;
};

type RawSwipe = {
  user_id: string;
  listing_id: string;
  search_list_id?: string;
  created_at: string;
};

const swipesQuery = (uid: string) => query(collection(db, 'swipes'), where('user_id', '==', uid));

const toRightSwipes = (docs: QueryDocumentSnapshot[]): RawSwipe[] =>
  docs
    .map((d) => d.data() as RawSwipe & { direction: string })
    .filter((s) => s.direction === 'right');

export function useLikes() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [swipes, setSwipes] = useState<RawSwipe[]>([]);
  const [swipesLoading, setSwipesLoading] = useState(true);

  // Realtime layer: which listings the user has right-swiped. This stays a live
  // onSnapshot subscription (likes change as the user swipes), but it no longer
  // fetches listing docs itself — that's the cached query below.
  useEffect(() => {
    if (!uid) {
      setSwipes([]);
      setSwipesLoading(false);
      return;
    }

    const unsub = onSnapshot(
      swipesQuery(uid),
      (snap) => {
        const rightSwipes = toRightSwipes(snap.docs);
        alog('Firestore:onSnapshot swipes (useLikes)', { uid, totalSwipes: snap.docs.length, rightSwipes: rightSwipes.length });
        setSwipes(rightSwipes);
        setSwipesLoading(false);
      },
      () => setSwipesLoading(false),
    );
    return unsub;
  }, [uid]);

  // Stable, sorted id list → stable query key (re-fetches only when the set of
  // liked listings actually changes; already-cached ids are served from cache).
  const listingIds = useMemo(
    () => Array.from(new Set(swipes.map((s) => s.listing_id))).sort(),
    [swipes],
  );

  // Cached layer: resolve listing docs through TanStack. staleTime: Infinity
  // because a cached listing is immutable, so this never re-reads Firestore for
  // an id it has already seen — across snapshots and across screens.
  const { data: listingsById, isLoading: listingsLoading } = useQuery({
    queryKey: ['listings', listingIds],
    queryFn: () => fetchListingsByIds(listingIds),
    enabled: listingIds.length > 0,
    staleTime: Infinity,
  });

  const likes = useMemo<Like[]>(() => {
    const out = swipes.map((swipe) => ({
      id: `${swipe.user_id}_${swipe.search_list_id ?? 'default'}_${swipe.listing_id}`,
      listing_id: swipe.listing_id,
      listing: listingsById?.get(swipe.listing_id) ?? null,
      liked_at: swipe.created_at,
    }));
    out.sort((a, b) => b.liked_at.localeCompare(a.liked_at));
    return out;
  }, [swipes, listingsById]);

  const isLoading = swipesLoading || (listingIds.length > 0 && listingsLoading);

  // Pull-to-refresh: re-read the swipes from the server and drop the cached
  // listing docs so they're fetched again (e.g. an ad expired since caching).
  const refresh = useCallback(async () => {
    const currentUid = useAuthStore.getState().firebaseUser?.uid;
    if (!currentUid) return;
    alog('Firestore:getDocsFromServer swipes (useLikes refresh)', { uid: currentUid });
    const snap = await getDocsFromServer(swipesQuery(currentUid));
    queryClient.removeQueries({ queryKey: ['listing'] });
    await queryClient.invalidateQueries({ queryKey: ['listings'] });
    setSwipes(toRightSwipes(snap.docs));
  }, []);

  return { likes, isLoading, refresh };
}
