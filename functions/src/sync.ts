import { logger } from 'firebase-functions/logger';
import { FeedStore } from './store/FeedStore';
import { ListingProvider, ProviderAuthError } from './providers/ListingProvider';
import { FeedLink, GroupSummary, Listing, ProviderId } from './types';

/**
 * - `incremental` (every 20 min): first pages only — provider dashboards list
 *   newest first, which is enough to catch new ads with few requests.
 * - `sweep` (nightly): reads every page (up to a cap) to catch ads that expired
 *   deeper in the list, expires ads that vanished from the alert, and purges
 *   long-expired items from the feed.
 */
export type SyncMode = 'incremental' | 'sweep';

export const MAX_PAGES_PER_ALERT = 3;
export const SWEEP_MAX_PAGES = 20;
export const PURGE_AFTER_DAYS = 30;

export type ProviderRegistry = Record<ProviderId, ListingProvider>;

export type SyncDeps = {
  store: FeedStore;
  providers: ProviderRegistry;
  now: () => Date;
};

export type SyncReport = {
  feeds: number;
  newItems: number;
  expiredItems: number;
  purgedItems: number;
  removedFeeds: number;
  expiredOwners: number;
  errors: number;
};

/**
 * Pulls each linked alert from its provider and upserts the results into the
 * linked search lists' feeds. Runs on schedule for every feed, and right after
 * a link/reconnect for just the affected ones (`feeds` argument).
 *
 * Each owner's alerts are fetched once, then fanned out to every list linked to
 * them. A failure for one owner never stops the others.
 */
export async function syncFeeds(
  deps: SyncDeps,
  feeds?: FeedLink[],
  mode: SyncMode = 'incremental',
): Promise<SyncReport> {
  const report: SyncReport = {
    feeds: 0, newItems: 0, expiredItems: 0, purgedItems: 0, removedFeeds: 0, expiredOwners: 0, errors: 0,
  };
  const all = feeds ?? (await deps.store.listFeeds());

  const valid = await dropOrphanFeeds(deps.store, all, report);
  report.feeds = valid.length;

  const byOwner = groupBy(valid, (f) => `${f.owner_id}|${f.provider}`);
  for (const ownerFeeds of byOwner.values()) {
    await syncOwner(deps, ownerFeeds, mode, report);
  }
  return report;
}

// A feed is orphaned once its list is deleted, its group is gone, or its owner
// left the group (their account must stop feeding that group).
async function dropOrphanFeeds(store: FeedStore, feeds: FeedLink[], report: SyncReport): Promise<FeedLink[]> {
  const groups = new Map<string, GroupSummary | null>();
  const valid: FeedLink[] = [];
  for (const feed of feeds) {
    if (!groups.has(feed.group_id)) groups.set(feed.group_id, await store.getGroup(feed.group_id));
    const group = groups.get(feed.group_id);
    if (group && group.list_ids.includes(feed.list_id) && group.member_ids.includes(feed.owner_id)) {
      valid.push(feed);
    } else {
      await store.deleteFeed(feed.group_id, feed.list_id);
      report.removedFeeds += 1;
    }
  }
  return valid;
}

async function syncOwner(deps: SyncDeps, feeds: FeedLink[], mode: SyncMode, report: SyncReport): Promise<void> {
  const { store, providers, now } = deps;
  const { owner_id: ownerId, provider: providerId } = feeds[0];
  const provider = providers[providerId];
  const nowIso = now().toISOString();
  const setFeedsStatus = (list: FeedLink[], status: FeedLink['status']) =>
    Promise.all(list.map((f) => store.updateFeed(f.group_id, f.list_id, { status })));

  const token = await store.getToken(ownerId, providerId);
  if (!token) {
    await setFeedsStatus(feeds, 'expired');
    return;
  }

  try {
    const alerts = await provider.listAlerts(token);
    await store.updateAccount(ownerId, providerId, {
      alerts, status: 'ok', last_sync_at: nowIso, last_error: null,
    });
    const alertIds = new Set(alerts.map((a) => a.id));
    const maxPages = mode === 'sweep' ? SWEEP_MAX_PAGES : MAX_PAGES_PER_ALERT;
    const purgeBefore = new Date(now().getTime() - PURGE_AFTER_DAYS * 86_400_000).toISOString();

    for (const [alertId, alertFeeds] of groupBy(feeds, (f) => f.alert_id)) {
      if (!alertIds.has(alertId)) {
        await setFeedsStatus(alertFeeds, 'error');
        continue;
      }
      const { listings, complete } = await fetchAlert(provider, token, alertId, maxPages);
      for (const feed of alertFeeds) {
        await applyToFeed(store, feed, listings, mode === 'sweep' && complete, nowIso, report);
        if (mode === 'sweep') {
          report.purgedItems += await store.purgeExpiredItems(feed.group_id, feed.list_id, purgeBefore);
        }
        await store.updateFeed(feed.group_id, feed.list_id, { status: 'ok', last_sync_at: nowIso });
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof ProviderAuthError) {
      report.expiredOwners += 1;
      await store.deleteToken(ownerId, providerId);
      await store.updateAccount(ownerId, providerId, { status: 'expired', last_error: message });
      await setFeedsStatus(feeds, 'expired');
    } else {
      report.errors += 1;
      logger.error('syncOwner failed', { ownerId, providerId, error: message });
      await store.updateAccount(ownerId, providerId, { status: 'error', last_error: message });
      await setFeedsStatus(feeds, 'error');
    }
  }
}

async function applyToFeed(
  store: FeedStore,
  feed: FeedLink,
  listings: Listing[],
  expireMissing: boolean,
  nowIso: string,
  report: SyncReport,
): Promise<void> {
  const { added, expired } = await store.upsertFeedItems(feed.group_id, feed.list_id, listings, nowIso);
  // Only trusted when every page was read: otherwise "missing" may just mean
  // "beyond the page cap".
  const vanished = expireMissing
    ? await store.expireMissingItems(feed.group_id, feed.list_id, new Set(listings.map((l) => l.id)), nowIso)
    : [];
  const newlyExpired = [...expired, ...vanished];
  if (newlyExpired.length > 0) await store.propagateExpiration(newlyExpired);
  report.newItems += added;
  report.expiredItems += newlyExpired.length;
}

async function fetchAlert(
  provider: ListingProvider,
  token: string,
  alertId: string,
  maxPages: number,
): Promise<{ listings: Listing[]; complete: boolean }> {
  const byId = new Map<string, Listing>();
  let nbPages = 1;
  for (let page = 1; page <= Math.min(nbPages, maxPages); page += 1) {
    const result = await provider.fetchAlertPage(token, alertId, page);
    nbPages = result.nbPages;
    for (const listing of result.listings) byId.set(listing.id, listing);
  }
  return { listings: [...byId.values()], complete: nbPages <= maxPages };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
