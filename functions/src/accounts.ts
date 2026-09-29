import { ProviderAuthError } from './providers/ListingProvider';
import { SyncDeps, syncFeeds } from './sync';
import { FeedLink, ProviderAlert, ProviderAuthMethod, ProviderId } from './types';

// Business logic behind the callables. Kept free of firebase-functions so it
// can be unit-tested; `index.ts` maps `AppError` to `HttpsError`.

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
  if (!PROVIDERS.includes(value as ProviderId)) throw new AppError('invalid-argument', 'Fournisseur inconnu');
  return value as ProviderId;
}

/** Accepts `Bearer <token>` or the raw token (header value or cookie). */
export function normalizeToken(value: string): string {
  return value.trim().replace(/^Bearer(\s+|$)/i, '').trim();
}

/** Best effort: the email claim of a JWT, for display only (never trusted). */
export function emailFromToken(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const email = claims.email ?? claims.username;
    return typeof email === 'string' && email.includes('@') ? email : null;
  } catch {
    return null;
  }
}

/**
 * Connects the caller's provider account, either with email + password, or
 * with a bearer token copied from a signed-in browser session (Google/Apple
 * accounts have no password). Stores the token, lists alerts.
 */
export async function connectProvider(deps: SyncDeps, uid: string, input: unknown): Promise<{ alerts: ProviderAlert[] }> {
  const data = record(input);
  const provider = providerId(data.provider);
  const client = deps.providers[provider];

  let token: string;
  let email: string;
  let authMethod: ProviderAuthMethod;
  let alerts: ProviderAlert[];
  try {
    if (data.token !== undefined) {
      token = normalizeToken(str(data.token, 'token', 8192));
      if (!token) throw new AppError('invalid-argument', 'Champ invalide : token');
      authMethod = 'token';
      alerts = await client.listAlerts(token); // validates the token
      email = emailFromToken(token) ?? '';
    } else {
      email = str(data.email, 'email', 254).trim();
      token = await client.authenticate(email, str(data.password, 'password', 256));
      authMethod = 'password';
      alerts = await client.listAlerts(token);
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof ProviderAuthError) {
      throw new AppError('permission-denied', data.token !== undefined ? 'Token Jinka invalide ou expiré' : e.message);
    }
    throw new AppError('unavailable', 'Jinka est injoignable, réessaie plus tard');
  }

  await deps.store.saveToken(uid, provider, token);
  await deps.store.saveAccount({
    user_id: uid,
    provider,
    email,
    auth_method: authMethod,
    status: 'ok',
    alerts,
    connected_at: deps.now().toISOString(),
    last_sync_at: null,
    last_error: null,
  });

  // Reconnecting revives feeds that went 'expired' — refresh them right away.
  const feeds = await deps.store.listFeeds({ ownerId: uid });
  const own = feeds.filter((f) => f.provider === provider);
  if (own.length > 0) await syncFeeds(deps, own);

  return { alerts };
}

/** Forgets the token and unlinks every list fed by this account. */
export async function disconnectProvider(deps: SyncDeps, uid: string, input: unknown): Promise<void> {
  const provider = providerId(record(input).provider);
  const feeds = await deps.store.listFeeds({ ownerId: uid });
  for (const f of feeds.filter((feed) => feed.provider === provider)) {
    await deps.store.deleteFeed(f.group_id, f.list_id);
  }
  await deps.store.deleteToken(uid, provider);
  await deps.store.deleteAccount(uid, provider);
}

async function liveAlerts(deps: SyncDeps, uid: string, provider: ProviderId): Promise<ProviderAlert[]> {
  const token = await deps.store.getToken(uid, provider);
  if (!token) throw new AppError('failed-precondition', 'Connecte ton compte Jinka dans ton profil');
  try {
    const alerts = await deps.providers[provider].listAlerts(token);
    await deps.store.updateAccount(uid, provider, { alerts, status: 'ok', last_error: null });
    return alerts;
  } catch (e) {
    if (e instanceof ProviderAuthError) {
      await deps.store.deleteToken(uid, provider);
      await deps.store.updateAccount(uid, provider, { status: 'expired', last_error: e.message });
      throw new AppError('failed-precondition', 'Session Jinka expirée, reconnecte-toi dans ton profil');
    }
    throw new AppError('unavailable', 'Jinka est injoignable, réessaie plus tard');
  }
}

/** Minimum gap between two manual refetches of the same account. */
export const REFETCH_COOLDOWN_MS = 2 * 60 * 1000;

export type RefetchResult = {
  alerts: ProviderAlert[];
  feeds: number;
  newItems: number;
  expiredItems: number;
};

/**
 * Manual refetch ("Actualiser les annonces"): re-reads the alert list and every
 * page of the caller's linked alerts right away — same full pass as the
 * nightly sweep (photos/prices updated, expirations detected). Rate-limited.
 */
export async function refetchProvider(deps: SyncDeps, uid: string, input: unknown): Promise<RefetchResult> {
  const provider = providerId(record(input).provider);
  const account = await deps.store.getAccount(uid, provider);
  if (!account) throw new AppError('failed-precondition', 'Connecte ton compte Jinka dans ton profil');

  const now = deps.now();
  const wait = (account.last_refetch_at ? Date.parse(account.last_refetch_at) : 0) + REFETCH_COOLDOWN_MS - now.getTime();
  if (wait > 0) {
    throw new AppError('failed-precondition', `Patiente encore ${Math.ceil(wait / 1000)} s avant d'actualiser`);
  }
  await deps.store.updateAccount(uid, provider, { last_refetch_at: now.toISOString() });

  const feeds = (await deps.store.listFeeds({ ownerId: uid })).filter((f) => f.provider === provider);
  if (feeds.length === 0) {
    return { alerts: await liveAlerts(deps, uid, provider), feeds: 0, newItems: 0, expiredItems: 0 };
  }

  const report = await syncFeeds(deps, feeds, 'sweep'); // also refreshes the alert list
  const after = await deps.store.getAccount(uid, provider);
  if (after?.status === 'expired') {
    throw new AppError('failed-precondition', 'Session Jinka expirée, reconnecte-toi dans ton profil');
  }
  if (after?.status === 'error') {
    throw new AppError('unavailable', 'Jinka est injoignable, réessaie plus tard');
  }
  return {
    alerts: after?.alerts ?? [],
    feeds: report.feeds,
    newItems: report.newItems,
    expiredItems: report.expiredItems,
  };
}

/**
 * Links a group's search list to one of the caller's alerts (or unlinks it
 * with `alertId: null`), then fills the feed immediately. Any group member
 * can link; the caller's account becomes the list's source.
 */
export async function linkSearchList(deps: SyncDeps, uid: string, input: unknown): Promise<{ newItems: number }> {
  const data = record(input);
  const groupId = str(data.groupId, 'groupId', 128);
  const listId = str(data.listId, 'listId', 128);
  const alertId = data.alertId === null ? null : str(data.alertId, 'alertId', 128);
  const provider = data.provider === undefined ? 'jinka' : providerId(data.provider);

  const group = await deps.store.getGroup(groupId);
  if (!group) throw new AppError('not-found', 'Groupe introuvable');
  if (!group.member_ids.includes(uid)) throw new AppError('permission-denied', 'Tu ne fais pas partie de ce groupe');
  if (!group.list_ids.includes(listId)) throw new AppError('not-found', 'Recherche introuvable');

  const existing = await deps.store.getFeed(groupId, listId);
  if (alertId === null) {
    if (existing) await deps.store.deleteFeed(groupId, listId);
    return { newItems: 0 };
  }

  const alert = (await liveAlerts(deps, uid, provider)).find((a) => a.id === alertId);
  if (!alert) throw new AppError('not-found', 'Alerte Jinka introuvable');

  // Switching source: start from an empty feed rather than mixing two alerts.
  if (existing && (existing.alert_id !== alertId || existing.owner_id !== uid)) {
    await deps.store.deleteFeed(groupId, listId);
  }

  const link: FeedLink = {
    group_id: groupId,
    list_id: listId,
    provider,
    owner_id: uid,
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
