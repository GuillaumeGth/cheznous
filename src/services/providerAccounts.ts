import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { ProviderAlert, ProviderId } from '@/types';
import { alog } from '@/lib/adminLogger';

// Thin wrappers over the Cloud Functions callables (functions/src/index.ts).
// The provider password only transits through `connectProvider`; the server
// keeps the token and never stores the password.

const PROVIDER: ProviderId = 'jinka';

type AlertsResult = { alerts: ProviderAlert[] };

export async function connectProvider(email: string, password: string): Promise<ProviderAlert[]> {
  alog('Callable:connectListingProvider');
  const call = httpsCallable<{ provider: ProviderId; email: string; password: string }, AlertsResult>(
    functions, 'connectListingProvider',
  );
  const { data } = await call({ provider: PROVIDER, email, password });
  return data.alerts;
}

/**
 * For Jinka accounts created with Google/Apple (no password): a bearer token
 * copied from a signed-in jinka.fr session (`Authorization` header or the
 * `LA_API_TOKEN` cookie). The server validates it before storing it.
 */
export async function connectProviderWithToken(token: string): Promise<ProviderAlert[]> {
  alog('Callable:connectListingProvider (token)');
  const call = httpsCallable<{ provider: ProviderId; token: string }, AlertsResult>(
    functions, 'connectListingProvider',
  );
  const { data } = await call({ provider: PROVIDER, token });
  return data.alerts;
}

export async function disconnectProvider(): Promise<void> {
  alog('Callable:disconnectListingProvider');
  await httpsCallable<{ provider: ProviderId }, void>(functions, 'disconnectListingProvider')({ provider: PROVIDER });
}

export async function refreshProviderAlerts(): Promise<ProviderAlert[]> {
  alog('Callable:refreshListingProviderAlerts');
  const call = httpsCallable<{ provider: ProviderId }, AlertsResult>(functions, 'refreshListingProviderAlerts');
  const { data } = await call({ provider: PROVIDER });
  return data.alerts;
}

/** Links a search list to one of the caller's alerts (`null` unlinks). Returns new items. */
export async function linkSearchList(groupId: string, listId: string, alertId: string | null): Promise<number> {
  alog('Callable:linkSearchListToAlert', { groupId, listId, alertId });
  const call = httpsCallable<
    { provider: ProviderId; groupId: string; listId: string; alertId: string | null },
    { newItems: number }
  >(functions, 'linkSearchListToAlert');
  const { data } = await call({ provider: PROVIDER, groupId, listId, alertId });
  return data.newItems;
}

/** The server sends user-facing French messages; fall back for transport errors. */
export function callableErrorMessage(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  const message = (e as { message?: unknown })?.message;
  if (typeof code === 'string' && code !== 'functions/internal' && typeof message === 'string' && message) {
    return message;
  }
  return 'Une erreur est survenue, réessaie.';
}
