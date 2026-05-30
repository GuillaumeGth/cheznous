import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types';
import { useAuthStore } from '@/stores/authStore';

type Notes = { mine: string; partner: string | null };

// Fetches and saves notes for the top listing.
// saveNote is stable (empty deps) — reads topListing from a ref.
export function useNotes(topListing: Listing | undefined, firstColocId: string | null) {
  const [notes, setNotes] = useState<Notes>({ mine: '', partner: null });
  const seenIdRef = useRef<string | null>(null);

  const topListingRef = useRef(topListing);
  topListingRef.current = topListing;

  useEffect(() => {
    if (!topListing) return;
    if (seenIdRef.current === topListing.id) return;
    seenIdRef.current = topListing.id;

    const { firebaseUser, groupId } = useAuthStore.getState();
    if (!firebaseUser || !groupId) return;

    setNotes({ mine: '', partner: null });

    const myNoteId = `${firebaseUser.uid}_${topListing.id}`;
    const colocNoteId = firstColocId ? `${firstColocId}_${topListing.id}` : null;

    Promise.all([
      getDoc(doc(db, 'notes', myNoteId)),
      colocNoteId ? getDoc(doc(db, 'notes', colocNoteId)) : Promise.resolve(null),
    ]).then(([mySnap, colocSnap]) => {
      setNotes({
        mine: mySnap.exists() ? (mySnap.data() as { text: string }).text : '',
        partner: colocSnap?.exists() ? (colocSnap.data() as { text: string }).text : null,
      });
    }).catch(() => {});
  }, [topListing?.id, firstColocId]);

  const saveNote = useCallback(async (text: string) => {
    const { firebaseUser, groupId } = useAuthStore.getState();
    const listing = topListingRef.current;
    if (!firebaseUser || !groupId || !listing) return;
    await setDoc(doc(db, 'notes', `${firebaseUser.uid}_${listing.id}`), {
      user_id: firebaseUser.uid,
      listing_id: listing.id,
      couple_id: groupId,
      text,
      created_at: new Date().toISOString(),
    });
    setNotes((prev) => ({ ...prev, mine: text }));
  }, []);

  return { notes, saveNote };
}
