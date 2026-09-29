import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Live Firestore doc. `undefined` while loading, `null` when missing (or on a
 * permission error). `path` is the doc path segments; `null` = no doc to watch.
 * Subscribes on the joined path (a primitive), so array identity doesn't matter.
 */
export function useDocSnapshot<T>(path: readonly string[] | null): T | null | undefined {
  const key = path ? path.join('/') : null;
  const [data, setData] = useState<T | null | undefined>(undefined);

  useEffect(() => {
    if (!key) {
      setData(null);
      return;
    }
    setData(undefined);
    return onSnapshot(
      doc(db, key),
      (snap) => setData(snap.exists() ? (snap.data() as T) : null),
      () => setData(null),
    );
  }, [key]);

  return data;
}
