import {
  FeedItem, FeedLink, GroupSummary, Listing, ProviderAccount, ProviderId,
} from '../types';

export type UpsertResult = {
  /** Items that entered the feed. */
  added: number;
  /** Items that were live and are now expired (to propagate to matches). */
  expired: Listing[];
};

/** True when the provider returned exactly what the feed already holds. */
export function isUnchanged(listing: Listing, prev: FeedItem): boolean {
  if (prev.active !== (listing.expired_at === null)) return false;
  return (Object.keys(listing) as (keyof Listing)[]).every(
    (key) => JSON.stringify(listing[key]) === JSON.stringify(prev[key]),
  );
}

/**
 * The upsert rules, shared by every FeedStore implementation: `null` = nothing
 * to write (unchanged, or first seen already expired — nobody needs to swipe
 * it). Existing items keep their `added_at`.
 */
export function planUpsert(
  listing: Listing,
  prev: FeedItem | null,
  nowIso: string,
): { item: FeedItem; added: boolean; expired: boolean } | null {
  const active = listing.expired_at === null;
  if (!prev && !active) return null;
  if (prev && isUnchanged(listing, prev)) return null;
  return {
    item: { ...listing, active, fetched_at: nowIso, added_at: prev?.added_at ?? nowIso },
    added: !prev,
    expired: !!prev?.active && !active,
  };
}

/**
 * Persistence used by sync and callables. `firestoreFeedStore` implements it
 * with the Admin SDK; tests use an in-memory fake.
 */
export interface FeedStore {
  getGroup(groupId: string): Promise<GroupSummary | null>;

  listFeeds(filter?: { ownerId: string }): Promise<FeedLink[]>;
  getFeed(groupId: string, listId: string): Promise<FeedLink | null>;
  saveFeed(link: FeedLink): Promise<void>;
  updateFeed(groupId: string, listId: string, patch: Partial<FeedLink>): Promise<void>;
  /** Deletes the link and all its items. */
  deleteFeed(groupId: string, listId: string): Promise<void>;

  /** Upserts items into the feed and the shared `listings` cache (see `planUpsert`). */
  upsertFeedItems(groupId: string, listId: string, listings: Listing[], nowIso: string): Promise<UpsertResult>;
  /** Expires the live items not in `seenIds` (gone from the provider). Returns them. */
  expireMissingItems(groupId: string, listId: string, seenIds: Set<string>, nowIso: string): Promise<Listing[]>;
  /** Deletes items expired before `beforeIso`. `listings/{id}` is kept (likes/matches use it). */
  purgeExpiredItems(groupId: string, listId: string, beforeIso: string): Promise<number>;
  /** Writes `expired_at` on `listings/{id}` and on every match of those listings. */
  propagateExpiration(listings: Listing[]): Promise<void>;

  getToken(userId: string, provider: ProviderId): Promise<string | null>;
  saveToken(userId: string, provider: ProviderId, token: string): Promise<void>;
  deleteToken(userId: string, provider: ProviderId): Promise<void>;

  getAccount(userId: string, provider: ProviderId): Promise<ProviderAccount | null>;
  saveAccount(account: ProviderAccount): Promise<void>;
  /** Merge-updates the account; no-op if it doesn't exist. */
  updateAccount(userId: string, provider: ProviderId, patch: Partial<ProviderAccount>): Promise<void>;
}
