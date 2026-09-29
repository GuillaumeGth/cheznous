import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FeedLink } from '@/types';

/**
 * Which provider alert feeds this search list (written by Cloud Functions).
 * `undefined` while loading, `null` when the list isn't linked.
 */
export function useFeedLink(groupId: string | null, listId: string | null): FeedLink | null | undefined {
  const [link, setLink] = useState<FeedLink | null | undefined>(undefined);

  useEffect(() => {
    if (!groupId || !listId) {
      setLink(null);
      return;
    }
    setLink(undefined);
    return onSnapshot(
      doc(db, 'groups', groupId, 'feeds', listId),
      (snap) => setLink(snap.exists() ? (snap.data() as FeedLink) : null),
      () => setLink(null),
    );
  }, [groupId, listId]);

  return link;
}
