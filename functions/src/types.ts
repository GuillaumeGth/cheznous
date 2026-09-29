// Server-side types. `Listing` mirrors `src/types/index.ts` in the app — keep
// both in sync (the functions package is built separately and can't import it).

export type Listing = {
  id: string;
  title: string;
  price: number;
  charges: number;
  surface: number;
  rooms: number;
  floor: number | null;
  address: string;
  arrondissement: number;
  images: string[];
  description: string;
  url: string;
  source: string;
  has_elevator: boolean;
  has_parking: boolean;
  has_balcony: boolean;
  has_terrace: boolean;
  available_from: string;
  deposit: number;
  lat: number | null;
  lng: number | null;
  /** Set once the provider reports the ad expired/removed; null while live. */
  expired_at: string | null;
};

export type ProviderId = 'jinka';

/**
 * The app uses a single, app-wide provider account (the admin's Jinka session):
 * its token is stored under this owner id and it owns every feed. Its account
 * doc (`users/global/provider_accounts/{provider}`) is readable by every
 * signed-in user (alerts for the picker) and lists the admins.
 */
export const GLOBAL_OWNER = 'global';

export type ProviderAlert = {
  id: string;
  name: string;
};

export type SyncStatus = 'ok' | 'expired' | 'error';

/**
 * `users/{owner}/provider_accounts/{provider}` — the app-wide account lives
 * under GLOBAL_OWNER and is readable by every signed-in user.
 */
export type ProviderAccount = {
  user_id: string;
  provider: ProviderId;
  status: SyncStatus;
  alerts: ProviderAlert[];
  /** When the current token was set. */
  connected_at: string;
  last_sync_at: string | null;
  last_error: string | null;
  /** Last manual refetch (cooldown). */
  last_refetch_at?: string | null;
  /** Token expiry (JWT `exp`), to warn the admin before it lapses. */
  token_expires_at?: string | null;
  /** Users allowed to replace the token and refetch (global account only). */
  admin_uids?: string[];
};

/**
 * `groups/{groupId}/feeds/{listId}` — links a search list to one provider
 * alert. Readable by group members, written by the server only. Feed items
 * live in the `items` subcollection.
 */
export type FeedLink = {
  group_id: string;
  list_id: string;
  provider: ProviderId;
  owner_id: string;
  alert_id: string;
  alert_name: string;
  linked_at: string;
  status: SyncStatus;
  /** First successful sync (null = still filling). Not bumped on later runs. */
  last_sync_at: string | null;
};

/** `groups/{groupId}/feeds/{listId}/items/{listingId}` */
export type FeedItem = Listing & {
  /** First time the server saw this listing in this feed (pagination key). */
  added_at: string;
  /** Last sync that wrote it (new or changed content). */
  fetched_at: string;
  /** `expired_at === null` — denormalised so the app can query live items only. */
  active: boolean;
};

/** Minimal view of a `groups/{id}` doc the server needs. */
export type GroupSummary = {
  member_ids: string[];
  list_ids: string[];
};
