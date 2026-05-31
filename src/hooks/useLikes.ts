import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { alog } from '@/lib/adminLogger';

export type Like = {
  id: string;
  listing_id: string;
  listing: Listing | null;
  liked_at: string;
};

export function useLikes() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [likes, setLikes] = useState<Like[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLikes([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'swipes'),
      where('user_id', '==', uid),
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const rightSwipes = snap.docs
          .map((d) => d.data())
          .filter((s) => s.direction === 'right');

        alog('Firestore:onSnapshot swipes (useLikes)', { uid, totalSwipes: snap.docs.length, rightSwipes: rightSwipes.length });
        const withListings = await Promise.all(
          rightSwipes.map(async (swipe) => {
            alog('Firestore:getDoc listings (useLikes per-like)', { listing_id: swipe.listing_id });
            const listingSnap = await getDoc(doc(db, 'listings', swipe.listing_id));
            return {
              id: `${swipe.user_id}_${swipe.search_list_id ?? 'default'}_${swipe.listing_id}`,
              listing_id: swipe.listing_id as string,
              listing: listingSnap.exists() ? (listingSnap.data() as Listing) : null,
              liked_at: swipe.created_at as string,
            };
          })
        );

        withListings.sort((a, b) => b.liked_at.localeCompare(a.liked_at));
        setLikes(withListings);
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );

    return unsub;
  }, [uid]);

  return { likes, isLoading };
}
