import { ProviderAuthError } from './providers/ListingProvider';
import { SyncDeps, syncFeeds } from './sync';
import { FeedLink, GLOBAL_OWNER, ProviderAccount, ProviderAlert, ProviderId } from './types';

// Business logic behind the callables. Kept free of firebase-functions so it
// can be unit-tested; `index.ts` maps `AppError` to `HttpsError`.
//
// The app runs on a single app-wide provider account (GLOBAL_OWNER): the admin
// pastes their Jinka session token once, every member can then link the
// account's alerts to their search lists. Nobody else configures anything.

export type AppErrorCode =
  | 'invalid-argument'
  | 'not-found'
  | 'permission-denied'
  | 'failed-precondition'
  | 'unavailable';

export class AppError extends Error {
  constructor(readonly code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

const PROVIDERS: readonly ProviderId[] = ['jinka'];

function record(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) throw new AppError('invalid-argument', 'Requête invalide');
  return input as Record<string, unknown>;
}

function str(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) {
    throw new AppError('invalid-argument', `Champ invalide : ${field}`);
  }
  return value;
}

function providerId(value: unknown): ProviderId {
  if (value === undefined) return 'jinka';
  if (!PROVIDERS.includes(value as ProviderId)) throw new AppError('invalid-argument', 'Fournisseur inconnu');
  return value as ProviderId;
}

/** Accepts `Bearer <token>` or the raw token (header value or cookie). */
export function normalizeToken(value: string): string {
  return value.trim().replace(/^Bearer(\s+|$)/i, '').trim();
}

function jwtClaims(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Best effort: the email claim of a JWT, for display only (never trusted). */
export function emailFromToken(token: string): string | null {
  const claims = jwtClaims(token);
  const email = claims?.email ?? claims?.username;
  return typeof email === 'string' && email.includes('@') ? email : null;
}

/** Best effort: the JWT expiry, so the admin is warned before it lapses. */
export function expiryFromToken(token: string): string | null {
  const exp = jwtClaims(token)?.exp;
  return typeof exp === 'number' ? new Date(exp * 1000).toISOString() : null;
}

async function requireAdmin(deps: SyncDeps, uid: string, provider: ProviderId): Promise<ProviderAccount> {
  const account = await deps.store.getAccount(GLOBAL_OWNER, provider);
  if (!account?.admin_uids?.includes(uid)) {
    throw new AppError('permission-denied', "Réservé à l'administrateur de l'app");
  }
  return account;
}

const EXPIRED_MESSAGE = "La session Jinka de l'app a expiré : l'administrateur doit remplacer le token";

/**
 * Admin only: replaces the app-wide token (a Jinka session token copied from a
 * signed-in jinka.fr — Google/Apple accounts have no password). Validated by
 * listing the alerts; feeds are refreshed right away.
 */
export async function setGlobalToken(
  deps: SyncDeps, uid: string, input: unknown,
): Promise<{ alerts: ProviderAlert[]; expiresAt: string | null }> {
  const data = record(input);
  const provider = providerId(data.provider);
  const account = await requireAdmin(deps, uid, provider);
  const token = normalizeToken(str(data.token, 'token', 8192));
  if (!token) throw new AppError('invalid-argument', 'Champ invalide : token');

  let alerts: ProviderAlert[];
  try {
    alerts = await deps.providers[provider].listAlerts(token);
  } catch (e) {
    if (e instanceof ProviderAuthError) throw new AppError('permission-denied', 'Token Jinka invalide ou expiré');
    throw new AppError('unavailable', 'Jinka est injoignable, réessaie plus tard');
  }

  const expiresAt = expiryFromToken(token);
  await deps.store.saveToken(GLOBAL_OWNER, provider, token);
  await deps.store.saveAccount({
    ...account,
    email: emailFromToken(token) ?? account.email,
    auth_method: 'token',
    status: 'ok',
    alerts,
    connected_at: deps.now().toISOString(),
    last_error: null,
    token_expires_at: expiresAt,
  });

  // A renewed token revives feeds that went 'expired' — refresh them now.
  const feeds = await deps.store.listFeeds({ ownerId: GLOBAL_OWNER });
  const own = feeds.filter((f) => f.provider === provider);
  if (own.length > 0) await syncFeeds(deps, own);

  return { alerts, expiresAt };
}

async function liveAlerts(deps: SyncDeps, provider: ProviderId): Promise<ProviderAlert[]> {
  const token = await deps.store.getToken(GLOBAL_OWNER, provider);
  if (!token) throw new AppError('failed-precondition', EXPIRED_MESSAGE);
  try {
    const alerts = await deps.providers[provider].listAlerts(token);
    await deps.store.updateAccount(GLOBAL_OWNER, provider, { alerts, status: 'ok', last_error: null });
    return alerts;
  } catch (e) {
    if (e instanceof ProviderAuthError) {
      await deps.store.deleteToken(GLOBAL_OWNER, provider);
      await deps.store.updateAccount(GLOBAL_OWNER, provider, { status: 'expired', last_error: e.message });
      throw new AppError('failed-precondition', EXPIRED_MESSAGE);
    }
    throw new AppError('unavailable', 'Jinka est injoignable, réessaie plus tard');
  }
}

/** Minimum gap between two manual refetches. */
export const REFETCH_COOLDOWN_MS = 2 * 60 * 1000;

export type RefetchResult = {
  alerts: ProviderAlert[];
  feeds: number;
  newItems: number;
  expiredItems: number;
};

/**
 * Admin only — "Actualiser les annonces": re-reads the alert list and every
 * page of the linked alerts right away (same full pass as the nightly sweep:
 * photos/prices updated, expirations detected). Rate-limited.
 */
export async function refetchProvider(deps: SyncDeps, uid: string, input: unknown): Promise<RefetchResult> {
  const provider = providerId(record(input).provider);
  const account = await requireAdmin(deps, uid, provider);

  const now = deps.now();
  const wait = (account.last_refetch_at ? Date.parse(account.last_refetch_at) : 0) + REFETCH_COOLDOWN_MS - now.getTime();
  if (wait > 0) {
    throw new AppError('failed-precondition', `Patiente encore ${Math.ceil(wait / 1000)} s avant d'actualiser`);
  }
  await deps.store.updateAccount(GLOBAL_OWNER, provider, { last_refetch_at: now.toISOString() });

  const feeds = (await deps.store.listFeeds({ ownerId: GLOBAL_OWNER })).filter((f) => f.provider === provider);
  if (feeds.length === 0) {
    return { alerts: await liveAlerts(deps, provider), feeds: 0, newItems: 0, expiredItems: 0 };
  }

  const report = await syncFeeds(deps, feeds, 'sweep'); // also refreshes the alert list
  const after = await deps.store.getAccount(GLOBAL_OWNER, provider);
  if (after?.status === 'expired') throw new AppError('failed-precondition', EXPIRED_MESSAGE);
  if (after?.status === 'error') throw new AppError('unavailable', 'Jinka est injoignable, réessaie plus tard');
  return {
    alerts: after?.alerts ?? [],
    feeds: report.feeds,
    newItems: report.newItems,
    expiredItems: report.expiredItems,
  };
}

/**
 * Links a group's search list to one of the app's alerts (or unlinks it with
 * `alertId: null`), then fills the feed immediately. Any group member can do it.
 */
export async function linkSearchList(deps: SyncDeps, uid: string, input: unknown): Promise<{ newItems: number }> {
  const data = record(input);
  const groupId = str(data.groupId, 'groupId', 128);
  const listId = str(data.listId, 'listId', 128);
  const alertId = data.alertId === null ? null : str(data.alertId, 'alertId', 128);
  const provider = providerId(data.provider);

  const group = await deps.store.getGroup(groupId);
  if (!group) throw new AppError('not-found', 'Groupe introuvable');
  if (!group.member_ids.includes(uid)) throw new AppError('permission-denied', 'Tu ne fais pas partie de ce groupe');
  if (!group.list_ids.includes(listId)) throw new AppError('not-found', 'Recherche introuvable');

  const existing = await deps.store.getFeed(groupId, listId);
  if (alertId === null) {
    if (existing) await deps.store.deleteFeed(groupId, listId);
    return { newItems: 0 };
  }

  const alert = (await liveAlerts(deps, provider)).find((a) => a.id === alertId);
  if (!alert) throw new AppError('not-found', 'Alerte Jinka introuvable');

  // Switching source: start from an empty feed rather than mixing two alerts.
  if (existing && (existing.alert_id !== alertId || existing.owner_id !== GLOBAL_OWNER)) {
    await deps.store.deleteFeed(groupId, listId);
  }

  const link: FeedLink = {
    group_id: groupId,
    list_id: listId,
    provider,
    owner_id: GLOBAL_OWNER,
    alert_id: alert.id,
    alert_name: alert.name,
    linked_at: deps.now().toISOString(),
    status: 'ok',
    last_sync_at: null,
  };
  await deps.store.saveFeed(link);
  const report = await syncFeeds(deps, [link]);
  return { newItems: report.newItems };
}
