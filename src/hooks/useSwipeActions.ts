import { useCallback, useRef, useState } from 'react';
import { MutableRefObject } from 'react';
import {
  collection, query, where, getDocs, doc, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing, Group } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { notifyColocsOfSwipe } from '@/lib/notifications';

export type MatchState = { title: string; id: number };

// All swipe-related business logic extracted here.
// Callbacks are fully stable (empty deps or ref-based) — they use getState()
// to read fresh store values without adding them as reactive dependencies.
export function useSwipeActions(
  groupRef: MutableRefObject<Group | null>,
  stackRef: MutableRefObject<Listing[]>,
  pop: () => void,
  pushBack: (listing: Listing) => void,
) {
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const lastSwipeRef = useRef<{ listing: Listing; direction: 'left' | 'right' } | null>(null);

  const createMatch = useCallback(async (listing: Listing) => {
    const { groupId } = useAuthStore.getState();
    if (!groupId) return;
    const matchId = `${groupId}_${listing.id}`;
    await setDoc(doc(db, 'matches', matchId), {
      couple_id: groupId,
      listing_id: listing.id,
      listing,
      matched_at: new Date().toISOString(),
      status: 'new',
    });
    setMatchState((prev) => ({ title: listing.title, id: (prev?.id ?? 0) + 1 }));
    setTimeout(() => setMatchState(null), 3500);
  }, []);

  const checkForMatch = useCallback(async (listing: Listing) => {
    const { groupId, firebaseUser } = useAuthStore.getState();
    const { searchLists, activeListId } = useFilterStore.getState();
    const group = groupRef.current;
    if (!group || !groupId || !firebaseUser) return;

    const activeList = searchLists.find((l) => l.id === activeListId);
    const listMemberIds = activeList?.member_ids ?? [];

    if (listMemberIds.length === 1 && listMemberIds[0] === firebaseUser.uid) {
      await createMatch(listing);
      return;
    }

    const groupMemberIds = group.member_ids?.length
      ? group.member_ids
      : [group.user1_id, ...(group.user2_id ? [group.user2_id] : [])];

    // If list scopes to a sub-group, check only those members; otherwise all group members.
    const targetIds = listMemberIds.length > 0 ? listMemberIds : groupMemberIds;
    const otherIds = targetIds.filter((id) => id !== firebaseUser.uid);
    if (otherIds.length === 0) {
      await createMatch(listing);
      return;
    }

    const swipeChecks = await Promise.all(
      otherIds.map((memberId) =>
        getDocs(query(
          collection(db, 'swipes'),
          where('user_id', '==', memberId),
          where('listing_id', '==', listing.id),
          where('direction', '==', 'right'),
        )),
      ),
    );

    if (swipeChecks.every((snap) => !snap.empty)) {
      await createMatch(listing);
    }
  }, [groupRef, createMatch]);

  const recordSwipe = useCallback(async (listing: Listing, direction: 'left' | 'right') => {
    const { firebaseUser, groupId, profile } = useAuthStore.getState();
    if (!firebaseUser || !groupId) return;

    await setDoc(doc(db, 'swipes', `${firebaseUser.uid}_${listing.id}`), {
      user_id: firebaseUser.uid,
      listing_id: listing.id,
      couple_id: groupId,
      direction,
      created_at: new Date().toISOString(),
    });

    if (direction === 'right') {
      await checkForMatch(listing);
      if (profile?.notification_prefs?.notify_on_partner_swipe) {
        notifyColocsOfSwipe(listing, profile.display_name, groupId, firebaseUser.uid).catch(() => {});
      }
    }
  }, [checkForMatch]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const top = stackRef.current[0];
    if (!top) return;
    lastSwipeRef.current = { listing: top, direction };
    pop();
    recordSwipe(top, direction);
  }, [stackRef, pop, recordSwipe]);

  const handleUndo = useCallback(async () => {
    const { firebaseUser, groupId } = useAuthStore.getState();
    if (!lastSwipeRef.current || !firebaseUser || !groupId) return;
    const { listing, direction } = lastSwipeRef.current;
    lastSwipeRef.current = null;
    pushBack(listing);
    await deleteDoc(doc(db, 'swipes', `${firebaseUser.uid}_${listing.id}`)).catch(() => {});
    if (direction === 'right') {
      await deleteDoc(doc(db, 'matches', `${groupId}_${listing.id}`)).catch(() => {});
      setMatchState(null);
    }
  }, [pushBack]);

  return { handleSwipe, handleUndo, matchState, lastSwipeRef };
}
