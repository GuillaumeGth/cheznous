import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { GLOBAL_PROVIDER_OWNER, ProviderAccount } from '@/types';

/**
 * Live view of the app-wide Jinka account (status, alerts, token expiry,
 * admins). Shared by every user. `undefined` while loading, `null` when the
 * app has no Jinka account yet.
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
      doc(db, 'users', GLOBAL_PROVIDER_OWNER, 'provider_accounts', 'jinka'),
      (snap) => setAccount(snap.exists() ? (snap.data() as ProviderAccount) : null),
      () => setAccount(null),
    );
  }, [uid]);

  return account;
}
