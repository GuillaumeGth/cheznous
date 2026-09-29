import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { ProviderAlert, ProviderId } from '@/types';
import { alog } from '@/lib/adminLogger';

// Thin wrappers over the Cloud Functions callables (functions/src/index.ts).
// The app runs on one app-wide Jinka account; its token stays server-side.

const PROVIDER: ProviderId = 'jinka';

type AlertsResult = { alerts: ProviderAlert[] };

/**
 * Admin only: replaces the app-wide Jinka token — a session token copied from
 * a signed-in jinka.fr (`Authorization` header or `LA_API_TOKEN` cookie).
 * The server validates it before storing it; nobody else configures Jinka.
 */
export async function setGlobalProviderToken(token: string): Promise<AlertsResult & { expiresAt: string | null }> {
  alog('Callable:setGlobalListingProviderToken');
  const call = httpsCallable<
    { provider: ProviderId; token: string },
    AlertsResult & { expiresAt: string | null }
  >(functions, 'setGlobalListingProviderToken');
  const { data } = await call({ provider: PROVIDER, token });
  return data;
}

export type RefetchResult = { feeds: number; newItems: number; expiredItems: number };

/** Shown to every user when the app-wide Jinka token has lapsed. */
export const APP_TOKEN_EXPIRED_MESSAGE = "Le token Jinka de l'app a expiré : l'administrateur doit le remplacer.";

/**
 * Re-reads the alert list and every page of the caller's linked alerts now
 * (same full pass as the nightly sweep). Rate-limited server-side (2 min).
 */
export async function refetchProvider(): Promise<RefetchResult> {
  alog('Callable:refetchListingProvider');
  const call = httpsCallable<{ provider: ProviderId }, RefetchResult>(functions, 'refetchListingProvider');
  const { data } = await call({ provider: PROVIDER });
  return data;
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

// Errors raised before our code runs (platform/transport) carry the bare code
// as message ("unauthenticated") — map those to something readable.
const TRANSPORT_MESSAGES: Record<string, string> = {
  'functions/unauthenticated': 'Service momentanément indisponible, réessaie dans une minute.',
  'functions/unavailable': 'Service injoignable, vérifie ta connexion et réessaie.',
  'functions/deadline-exceeded': 'Jinka met trop de temps à répondre, réessaie.',
};

/** The server sends user-facing French messages; fall back for transport errors. */
export function callableErrorMessage(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  const message = (e as { message?: unknown })?.message;
  if (typeof code !== 'string' || code === 'functions/internal') return 'Une erreur est survenue, réessaie.';
  const bare = typeof message !== 'string' || !message || message === code.replace('functions/', '');
  if (bare) return TRANSPORT_MESSAGES[code] ?? 'Une erreur est survenue, réessaie.';
  return message as string;
}
