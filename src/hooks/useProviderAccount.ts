import { useAuthStore } from '@/stores/authStore';
import { GLOBAL_PROVIDER_OWNER, ProviderAccount } from '@/types';
import { useDocSnapshot } from './useDocSnapshot';

/**
 * Live view of the app-wide Jinka account (status, alerts, token expiry,
 * admins). Shared by every user. `undefined` while loading, `null` when the
 * app has no Jinka account yet.
 */
export function useProviderAccount(): ProviderAccount | null | undefined {
  const signedIn = useAuthStore((s) => !!s.firebaseUser);
  return useDocSnapshot<ProviderAccount>(
    signedIn ? ['users', GLOBAL_PROVIDER_OWNER, 'provider_accounts', 'jinka'] : null,
  );
}
