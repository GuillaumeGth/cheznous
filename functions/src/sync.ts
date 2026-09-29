import { logger } from 'firebase-functions/logger';
import { FeedStore } from './store/FeedStore';
import { ListingProvider, ProviderAlertNotFoundError, ProviderAuthError } from './providers/ListingProvider';
import { FeedLink, GLOBAL_OWNER, Listing, ProviderId } from './types';

/**
 * Only the alerts linked to a search list are read — never anything else.
 *
 * - `incremental` (day every 30 min, night every 3 h): provider dashboards
 *   list newest first, so read page 1 and go on only while a page still
 *   brings new ads (≤ INCREMENTAL_MAX_PAGES). Usually a single request.
 * - `sweep` (once a night): refreshes the alert names, reads every page (up to
 *   a cap) to catch ads that expired deeper in the list, expires ads that
 *   vanished from the alert, and purges long-expired items from the feed.
 */
export type SyncMode = 'incremental' | 'sweep';

export const INCREMENTAL_MAX_PAGES = 3;
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
 * a link/token change for just the affected ones (`feeds` argument).
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
// left the group (their account must stop feeding that group). The app-wide
// account isn't a group member and feeds every group.
async function dropOrphanFeeds(store: FeedStore, feeds: FeedLink[], report: SyncReport): Promise<FeedLink[]> {
  const groupIds = [...new Set(feeds.map((f) => f.group_id))];
  const groups = new Map(await Promise.all(groupIds.map(async (id) => [id, await store.getGroup(id)] as const)));
  const valid: FeedLink[] = [];
  for (const feed of feeds) {
    const group = groups.get(feed.group_id);
    const ownerOk = feed.owner_id === GLOBAL_OWNER || !!group?.member_ids.includes(feed.owner_id);
    if (group && group.list_ids.includes(feed.list_id) && ownerOk) {
      valid.push(feed);
    } else {
      await store.deleteFeed(feed.group_id, feed.list_id);
      report.removedFeeds += 1;
    }
  }
  return valid;
}

/** Token refused: forget it and flag the account (feeds are flagged by the caller). */
export async function markOwnerExpired(store: FeedStore, ownerId: string, providerId: ProviderId, message: string) {
  await store.deleteToken(ownerId, providerId);
  await store.updateAccount(ownerId, providerId, { status: 'expired', last_error: message });
}

async function syncOwner(deps: SyncDeps, feeds: FeedLink[], mode: SyncMode, report: SyncReport): Promise<void> {
  const { store, providers, now } = deps;
  const { owner_id: ownerId, provider: providerId } = feeds[0];
  const provider = providers[providerId];
  const nowIso = now().toISOString();
  const setFeedsStatus = (list: FeedLink[], status: FeedLink['status']) =>
    Promise.all(list.filter((f) => f.status !== status).map((f) => store.updateFeed(f.group_id, f.list_id, { status })));

  const token = await store.getToken(ownerId, providerId);
  if (!token) {
    await setFeedsStatus(feeds, 'expired');
    return;
  }

  try {
    // Alert names change rarely: refresh them on the sweep only.
    const alerts = mode === 'sweep' ? await provider.listAlerts(token) : null;
    const alertNames = alerts && new Map(alerts.map((a) => [a.id, a.name]));
    const maxPages = mode === 'sweep' ? SWEEP_MAX_PAGES : INCREMENTAL_MAX_PAGES;
    const purgeBefore = new Date(now().getTime() - PURGE_AFTER_DAYS * 86_400_000).toISOString();

    for (const [alertId, alertFeeds] of groupBy(feeds, (f) => f.alert_id)) {
      if (alertNames && !alertNames.has(alertId)) {
        await setFeedsStatus(alertFeeds, 'error');
        continue;
      }
      const seen = new Set<string>();
      const expired = new Map<string, Listing>(); // deduped across feeds and pages
      let complete: boolean;
      try {
        // Each page is upserted as soon as it's read; an incremental run stops
        // at the first page that brings nothing new (newest first).
        complete = await readAlert(provider, token, alertId, maxPages, async (page) => {
          let added = 0;
          for (const feed of alertFeeds) {
            const result = await store.upsertFeedItems(feed.group_id, feed.list_id, page, nowIso);
            added += result.added;
            for (const listing of result.expired) expired.set(listing.id, listing);
          }
          report.newItems += added;
          for (const listing of page) seen.add(listing.id);
          return mode === 'sweep' || added > 0;
        });
      } catch (e) {
        if (!(e instanceof ProviderAlertNotFoundError)) throw e;
        await setFeedsStatus(alertFeeds, 'error'); // deleted on the provider: only this alert
        continue;
      }

      for (const feed of alertFeeds) {
        if (mode === 'sweep') {
          // "Missing" only means "gone" when every page was read (not capped).
          if (complete) {
            for (const listing of await store.expireMissingItems(feed.group_id, feed.list_id, seen, nowIso)) {
              expired.set(listing.id, listing);
            }
          }
          report.purgedItems += await store.purgeExpiredItems(feed.group_id, feed.list_id, purgeBefore);
        }
        const patch = feedPatch(feed, nowIso, alertNames?.get(alertId));
        if (patch) await store.updateFeed(feed.group_id, feed.list_id, patch);
      }
      if (expired.size > 0) await store.propagateExpiration([...expired.values()]);
      report.expiredItems += expired.size;
    }
    await store.updateAccount(ownerId, providerId, {
      status: 'ok', last_sync_at: nowIso, last_error: null, ...(alerts ? { alerts } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof ProviderAuthError) {
      report.expiredOwners += 1;
      await markOwnerExpired(store, ownerId, providerId, message);
      await setFeedsStatus(feeds, 'expired');
    } else {
      report.errors += 1;
      logger.error('syncOwner failed', { ownerId, providerId, error: message });
      await store.updateAccount(ownerId, providerId, { status: 'error', last_error: message });
      await setFeedsStatus(feeds, 'error');
    }
  }
}

// Only what changed: the feed doc is watched by every client, so an unchanged
// sync must not rewrite it.
function feedPatch(feed: FeedLink, nowIso: string, alertName: string | undefined): Partial<FeedLink> | null {
  const patch: Partial<FeedLink> = {};
  if (feed.status !== 'ok') patch.status = 'ok';
  if (!feed.last_sync_at) patch.last_sync_at = nowIso;
  if (alertName && alertName !== feed.alert_name) patch.alert_name = alertName;
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Reads the alert page by page (up to `maxPages`), handing each page to
 * `onPage`, which returns whether to continue. Returns true when every page
 * of the alert was read.
 */
async function readAlert(
  provider: ListingProvider,
  token: string,
  alertId: string,
  maxPages: number,
  onPage: (page: Listing[]) => Promise<boolean>,
): Promise<boolean> {
  let nbPages = 1;
  let lastRead = 0;
  for (let page = 1; page <= Math.min(nbPages, maxPages); page += 1) {
    const result = await provider.fetchAlertPage(token, alertId, page);
    nbPages = result.nbPages;
    lastRead = page;
    if (!(await onPage(result.listings))) break;
  }
  return lastRead >= nbPages;
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
