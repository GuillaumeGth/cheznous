/**
 * useGroupChat — reactive adapter over groupChatService.
 * Subscribes to the message subcollection and exposes stable write callbacks.
 * Business logic lives in groupChatService; this file only manages React state.
 */
import { useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GroupMessage } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import {
  sendGroupMessage,
  setReaction,
  deleteMessage as deleteGroupMessage,
} from '@/services/groupChatService';

export function useGroupChat(groupId: string | null) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // groupId is the only primitive dep — the subscription re-opens only when
  // the active group changes, never on profile/filter updates.
  useEffect(() => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const q = query(
      collection(db, 'groups', groupId, 'messages'),
      orderBy('created_at', 'asc'),
    );
    return onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupMessage)));
        setIsLoading(false);
      },
      // Si le listener échoue (ex: règles Firestore refusant la lecture), on
      // arrête le loader au lieu de tourner indéfiniment.
      () => setIsLoading(false),
    );
  }, [groupId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!groupId || !text.trim()) return;
    await sendGroupMessage(groupId, text.trim());
  }, [groupId]);

  // Passing null removes the current user's existing reaction.
  const reactToMessage = useCallback(async (
    messageId: string,
    reaction: 'like' | 'dislike' | null,
  ) => {
    const { firebaseUser } = useAuthStore.getState();
    if (!groupId || !firebaseUser) return;
    await setReaction(groupId, messageId, firebaseUser.uid, reaction);
  }, [groupId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!groupId) return;
    await deleteGroupMessage(groupId, messageId);
  }, [groupId]);

  return { messages, isLoading, sendMessage, reactToMessage, deleteMessage };
}
