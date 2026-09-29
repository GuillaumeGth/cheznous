import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { ProviderAccount } from '@/types';

/**
 * Live view of the current user's Jinka account (status, alerts, last sync).
 * `undefined` while loading, `null` when not connected.
 */
export function useProviderAccount(): ProviderAccount | null | undefined {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const [account, setAccount] = useState<ProviderAccount | null | undefined>(undefined);

  useEffect(() => {
    if (!uid) {
      setAccount(null);
      return;
    }
    return onSnapshot(
      doc(db, 'users', uid, 'provider_accounts', 'jinka'),
      (snap) => setAccount(snap.exists() ? (snap.data() as ProviderAccount) : null),
      () => setAccount(null),
    );
  }, [uid]);

  return account;
}
