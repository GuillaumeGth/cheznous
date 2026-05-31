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
import { alog } from '@/lib/adminLogger';
import { sendSystemMessage, shareListingToChat } from '@/services/groupChatService';

export type MatchState = { title: string; id: number };

type LastSwipe = { listing: Listing; direction: 'left' | 'right'; listId: string };

// Identifiants scopés par critère de recherche (search list) : un même bien
// peut être swipé indépendamment dans deux critères différents, et un match
// n'est validé que si tous les participants ont liké le bien DANS le même critère.
const swipeId = (uid: string, listId: string, listingId: string) =>
  `${uid}_${listId}_${listingId}`;
const matchId = (groupId: string, listId: string, listingId: string) =>
  `${groupId}_${listId}_${listingId}`;

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
  const lastSwipeRef = useRef<LastSwipe | null>(null);

  const createMatch = useCallback(async (listing: Listing, listId: string) => {
    const { groupId } = useAuthStore.getState();
    if (!groupId) return;
    alog('Firestore:setDoc matches (createMatch)', { listingId: listing.id, listId });
    await setDoc(doc(db, 'matches', matchId(groupId, listId, listing.id)), {
      couple_id: groupId,
      search_list_id: listId,
      listing_id: listing.id,
      listing,
      matched_at: new Date().toISOString(),
      status: 'new',
    });
    setMatchState((prev) => ({ title: listing.title, id: (prev?.id ?? 0) + 1 }));
    setTimeout(() => setMatchState(null), 3500);
    sendSystemMessage(
      groupId,
      `🎉 Match ! Tout le groupe a liké "${listing.title}"`,
    ).catch(() => {});
  }, []);

  const checkForMatch = useCallback(async (listing: Listing, listId: string) => {
    const { firebaseUser } = useAuthStore.getState();
    const { searchLists } = useFilterStore.getState();
    const group = groupRef.current;
    if (!group || !firebaseUser) return;

    const activeList = searchLists.find((l) => l.id === listId);
    const groupMemberIds = group.member_ids?.length
      ? group.member_ids
      : [group.user1_id, ...(group.user2_id ? [group.user2_id] : [])];

    // Participants ciblés par ce critère : le sous-groupe de la liste si défini,
    // sinon tous les membres du groupe.
    const targetIds = activeList?.member_ids?.length ? activeList.member_ids : groupMemberIds;
    const otherIds = targetIds.filter((id) => id !== firebaseUser.uid);

    // Solo (ou critère ne ciblant que soi) : match immédiat.
    if (otherIds.length === 0) {
      await createMatch(listing, listId);
      return;
    }

    // min_likes = 0 → unanimité ; sinon N votes au total (current user compris).
    const minLikes = activeList?.filters?.min_likes ?? 0;
    const totalParticipants = otherIds.length + 1;
    const requiredTotal = minLikes > 0 && minLikes <= totalParticipants ? minLikes : totalParticipants;
    // L'utilisateur courant vient de swiper right → il faut (requiredTotal - 1) autres.
    const requiredFromOthers = requiredTotal - 1;

    if (requiredFromOthers <= 0) {
      await createMatch(listing, listId);
      return;
    }

    alog('Firestore:getDocs swipes (checkForMatch)', { listingId: listing.id, listId, otherIds, requiredFromOthers });
    const swipeChecks = await Promise.all(
      otherIds.map((memberId) =>
        getDocs(query(
          collection(db, 'swipes'),
          where('user_id', '==', memberId),
          where('listing_id', '==', listing.id),
          where('search_list_id', '==', listId),
          where('direction', '==', 'right'),
        )),
      ),
    );

    const approvedByOthers = swipeChecks.filter((snap) => !snap.empty).length;
    if (approvedByOthers >= requiredFromOthers) {
      await createMatch(listing, listId);
    }
  }, [groupRef, createMatch]);

  const recordSwipe = useCallback(async (listing: Listing, direction: 'left' | 'right') => {
    const { firebaseUser, groupId, profile } = useAuthStore.getState();
    const { activeListId } = useFilterStore.getState();
    if (!firebaseUser || !groupId) return;

    alog('Firestore:setDoc swipes (recordSwipe)', { direction, listingId: listing.id, listId: activeListId });
    await setDoc(doc(db, 'swipes', swipeId(firebaseUser.uid, activeListId, listing.id)), {
      user_id: firebaseUser.uid,
      listing_id: listing.id,
      couple_id: groupId,
      search_list_id: activeListId,
      direction,
      created_at: new Date().toISOString(),
    });

    if (direction === 'right') {
      await checkForMatch(listing, activeListId);
      if (profile?.notification_prefs?.notify_on_partner_swipe) {
        notifyColocsOfSwipe(listing, profile.display_name, groupId, firebaseUser.uid).catch(() => {});
      }
    }
  }, [checkForMatch]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const top = stackRef.current[0];
    if (!top) return;
    const { activeListId } = useFilterStore.getState();
    lastSwipeRef.current = { listing: top, direction, listId: activeListId };
    pop();
    recordSwipe(top, direction);
  }, [stackRef, pop, recordSwipe]);

  const handleUndo = useCallback(async () => {
    const { firebaseUser, groupId } = useAuthStore.getState();
    if (!lastSwipeRef.current || !firebaseUser || !groupId) return;
    const { listing, direction, listId } = lastSwipeRef.current;
    lastSwipeRef.current = null;
    pushBack(listing);
    await deleteDoc(doc(db, 'swipes', swipeId(firebaseUser.uid, listId, listing.id))).catch(() => {});
    if (direction === 'right') {
      await deleteDoc(doc(db, 'matches', matchId(groupId, listId, listing.id))).catch(() => {});
      setMatchState(null);
    }
  }, [pushBack]);

  const handleShareToChat = useCallback(() => {
    const top = stackRef.current[0];
    if (!top) return;
    shareListingToChat(top).catch(() => {});
  }, [stackRef]);

  return { handleSwipe, handleUndo, matchState, lastSwipeRef, handleShareToChat };
}
