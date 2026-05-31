import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/firebase';
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

    const q = query(collection(db, 'swipes'), where('user_id', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rightSwipes = snap.docs
          .map((d) => d.data() as RawSwipe & { direction: string })
          .filter((s) => s.direction === 'right');
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
  return { likes, isLoading };
}
