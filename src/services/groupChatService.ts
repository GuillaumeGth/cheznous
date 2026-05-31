/**
 * groupChatService — pure Firestore operations for group chat.
 * No React, no hooks. All functions are async and testable in isolation.
 *
 * Firestore path: groups/{groupId}/messages/{auto}
 */
import {
  collection, addDoc, setDoc, doc, deleteField, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { getMemberTokens, sendPushNotification } from '@/lib/notifications';

export async function sendGroupMessage(groupId: string, text: string): Promise<void> {
  const { firebaseUser, profile } = useAuthStore.getState();
  if (!firebaseUser) return;
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    type: 'text',
    user_id: firebaseUser.uid,
    display_name: profile?.display_name ?? 'Utilisateur',
    text,
    created_at: new Date().toISOString(),
  });
  getMemberTokens(groupId, firebaseUser.uid).then((tokens) =>
    tokens.forEach((token) =>
      sendPushNotification(token, profile?.display_name ?? 'Message', text, {
        type: 'group_chat',
        groupId,
      }).catch(() => {}),
    ),
  );
}

export async function sendSystemMessage(groupId: string, text: string): Promise<void> {
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    type: 'system',
    user_id: null,
    display_name: null,
    text,
    created_at: new Date().toISOString(),
  });
}

// Queries all swipes for a listing within a group to pre-populate reactions.
// Right swipe wins when the same member swiped across multiple search lists.
async function buildReactionsFromSwipes(
  groupId: string,
  listingId: string,
): Promise<Record<string, 'like' | 'dislike'>> {
  const reactions: Record<string, 'like' | 'dislike'> = {};
  try {
    const snap = await getDocs(query(
      collection(db, 'swipes'),
      where('couple_id', '==', groupId),
      where('listing_id', '==', listingId),
    ));
    for (const d of snap.docs) {
      const data = d.data();
      const uid: string = data.user_id;
      const reaction: 'like' | 'dislike' = data.direction === 'right' ? 'like' : 'dislike';
      if (!reactions[uid] || reaction === 'like') reactions[uid] = reaction;
    }
  } catch {
    // Composite index (couple_id + listing_id) may not exist yet — degrade
    // gracefully with empty reactions rather than blocking the share action.
  }
  return reactions;
}

export async function shareListingToChat(listing: Listing): Promise<void> {
  const { firebaseUser, profile, groupId } = useAuthStore.getState();
  if (!groupId || !firebaseUser) return;
  const reactions = await buildReactionsFromSwipes(groupId, listing.id);
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    type: 'listing_share',
    user_id: firebaseUser.uid,
    display_name: profile?.display_name ?? 'Utilisateur',
    text: "Qu'est-ce que vous en pensez ?",
    created_at: new Date().toISOString(),
    listing,
    reactions,
  });
  getMemberTokens(groupId, firebaseUser.uid).then((tokens) =>
    tokens.forEach((token) =>
      sendPushNotification(
        token,
        `${profile?.display_name ?? 'Un coloc'} partage un appart`,
        listing.title,
        { type: 'group_chat_listing', groupId },
      ).catch(() => {}),
    ),
  );
}

// reaction = null removes the user's vote (toggle-off).
// setDoc+merge allows mixing deleteField() with a literal in the same map.
export async function setReaction(
  groupId: string,
  messageId: string,
  uid: string,
  reaction: 'like' | 'dislike' | null,
): Promise<void> {
  const msgRef = doc(db, 'groups', groupId, 'messages', messageId);
  await setDoc(
    msgRef,
    { reactions: { [uid]: reaction === null ? deleteField() : reaction } },
    { merge: true },
  );
}
