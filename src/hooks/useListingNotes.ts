import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';

export type NoteEntry = {
  userId: string;
  displayName: string;
  text: string;
  isMine: boolean;
};

// One-time fetch of all group members' notes for a given listing.
// Re-fetches only when listingId or member IDs change.
// saveMyNote is stable (empty deps) — reads the listing id from a ref.
export function useListingNotes(
  listingId: string,
  members: { id: string; display_name: string }[],
  myUid: string | undefined,
) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  // Stable key so the array reference doesn't re-trigger the effect on every render.
  const memberKey = useMemo(() => members.map((m) => m.id).join(','), [members]);
  const listingIdRef = useRef(listingId);
  listingIdRef.current = listingId;

  useEffect(() => {
    setNotes([]);
    if (!listingId || !memberKey) return;
    let cancelled = false;
    Promise.all(
      members.map(async (member) => {
        const snap = await getDoc(doc(db, 'notes', `${member.id}_${listingId}`));
        if (!snap.exists()) return null;
        const text = (snap.data().text as string) ?? '';
        if (!text.trim()) return null;
        return {
          userId: member.id,
          displayName: member.display_name,
          text,
          isMine: member.id === myUid,
        } as NoteEntry;
      }),
    )
      .then((results) => {
        if (cancelled) return;
        setNotes(results.filter((n): n is NoteEntry => n !== null));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // members is captured by memberKey; listing re-fetch drives the effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, memberKey]);

  const saveMyNote = useCallback(async (text: string) => {
    const { firebaseUser, groupId, profile } = useAuthStore.getState();
    const id = listingIdRef.current;
    if (!firebaseUser || !groupId || !id) return;
    await setDoc(doc(db, 'notes', `${firebaseUser.uid}_${id}`), {
      user_id: firebaseUser.uid,
      listing_id: id,
      couple_id: groupId,
      text,
      created_at: new Date().toISOString(),
    });
    if (listingIdRef.current !== id) return;
    setNotes((prev) => {
      const others = prev.filter((n) => !n.isMine);
      if (!text.trim()) return others;
      const mine: NoteEntry = {
        userId: firebaseUser.uid,
        displayName: profile?.display_name ?? '',
        text,
        isMine: true,
      };
      return [mine, ...others];
    });
  }, []);

  return { notes, saveMyNote };
}
