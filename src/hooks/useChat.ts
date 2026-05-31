import { useCallback, useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { ChatMessage } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { getMemberTokens, sendPushNotification } from '@/lib/notifications';

// Images: 5 MB, autres fichiers: 10 MB
export const ATTACHMENT_LIMITS = {
  image: 5 * 1024 * 1024,
  file: 10 * 1024 * 1024,
} as const;

export type AttachmentInput = {
  uri: string;
  size: number;
  fileName: string;
  mimeType: string;
  type: 'image' | 'file';
};

export type SendAttachmentResult = 'ok' | 'too_large' | 'error';

// Real-time chat for a matched listing.
// sendMessage and sendAttachment are stable ([matchId] deps) — they read
// authStore via getState() to avoid re-subscribing on profile changes.
export function useChat(matchId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    const q = query(
      collection(db, 'matches', matchId, 'messages'),
      orderBy('created_at', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
        setIsLoading(false);
      },
      () => { setIsLoading(false); },
    );
    return unsub;
  }, [matchId]);

  // Fire-and-forget push to all other group members.
  const notifyOthers = useCallback(async (body: string) => {
    const { firebaseUser, profile, groupId } = useAuthStore.getState();
    if (!firebaseUser || !groupId) return;
    const tokens = await getMemberTokens(groupId, firebaseUser.uid);
    await Promise.all(
      tokens.map((token) =>
        sendPushNotification(
          token,
          profile?.display_name ?? 'Nouveau message',
          body,
          { type: 'chat_message', matchId },
        ),
      ),
    );
  }, [matchId]);

  const sendMessage = useCallback(async (text: string) => {
    const { firebaseUser, profile } = useAuthStore.getState();
    if (!firebaseUser || !text.trim()) return;
    await addDoc(collection(db, 'matches', matchId, 'messages'), {
      user_id: firebaseUser.uid,
      display_name: profile?.display_name ?? 'Anonyme',
      text: text.trim(),
      created_at: new Date().toISOString(),
    });
    const preview = text.trim().length > 60 ? text.trim().slice(0, 60) + '…' : text.trim();
    notifyOthers(preview).catch(() => {});
  }, [matchId, notifyOthers]);

  const sendAttachment = useCallback(async (attachment: AttachmentInput): Promise<SendAttachmentResult> => {
    const { firebaseUser, profile } = useAuthStore.getState();
    if (!firebaseUser) return 'error';
    if (attachment.size > ATTACHMENT_LIMITS[attachment.type]) return 'too_large';
    try {
      const ext = attachment.fileName.split('.').pop() ?? 'bin';
      const storagePath = `chat/${matchId}/${Date.now()}_${firebaseUser.uid}.${ext}`;
      const response = await fetch(attachment.uri);
      const blob = await response.blob();
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: attachment.mimeType });
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, 'matches', matchId, 'messages'), {
        user_id: firebaseUser.uid,
        display_name: profile?.display_name ?? 'Anonyme',
        text: '',
        attachment_url: url,
        attachment_type: attachment.type,
        attachment_name: attachment.fileName,
        created_at: new Date().toISOString(),
      });
      const notifBody = attachment.type === 'image'
        ? 'a partagé une photo'
        : `a partagé ${attachment.fileName}`;
      notifyOthers(notifBody).catch(() => {});
      return 'ok';
    } catch {
      return 'error';
    }
  }, [matchId, notifyOthers]);

  return { messages, isLoading, sendMessage, sendAttachment };
}
