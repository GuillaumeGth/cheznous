import { FeedStore, planUpsert, UpsertResult } from '../store/FeedStore';
import {
  ListingProvider, ProviderAlertNotFoundError, ProviderAlertPage, ProviderAuthError,
} from '../providers/ListingProvider';
import {
  FeedItem, FeedLink, GroupSummary, Listing, ProviderAccount, ProviderAlert, ProviderId,
} from '../types';

export class MemoryFeedStore implements FeedStore {
  groups = new Map<string, GroupSummary>();
  feeds = new Map<string, FeedLink>();
  items = new Map<string, Map<string, FeedItem>>();
  listings = new Map<string, Listing>();
  tokens = new Map<string, string>();
  accounts = new Map<string, ProviderAccount>();
  /** listing id → expired_at, as propagated to `listings` + `matches`. */
  propagated = new Map<string, string | null>();
  /** Number of feed item writes (to check unchanged items aren't rewritten). */
  itemWrites = 0;

  private feedKey = (g: string, l: string) => `${g}/${l}`;
  private userKey = (u: string, p: ProviderId) => `${u}/${p}`;

  async getGroup(groupId: string) { return this.groups.get(groupId) ?? null; }

  async listFeeds(filter?: { ownerId: string }) {
    const all = [...this.feeds.values()];
    return filter ? all.filter((f) => f.owner_id === filter.ownerId) : all;
  }
  async getFeed(g: string, l: string) { return this.feeds.get(this.feedKey(g, l)) ?? null; }
  async saveFeed(link: FeedLink) { this.feeds.set(this.feedKey(link.group_id, link.list_id), { ...link }); }
  async updateFeed(g: string, l: string, patch: Partial<FeedLink>) {
    const cur = this.feeds.get(this.feedKey(g, l));
    if (cur) this.feeds.set(this.feedKey(g, l), { ...cur, ...patch });
  }
  async deleteFeed(g: string, l: string) {
    this.feeds.delete(this.feedKey(g, l));
    this.items.delete(this.feedKey(g, l));
  }
  async upsertFeedItems(g: string, l: string, listings: Listing[], nowIso: string): Promise<UpsertResult> {
    const key = this.feedKey(g, l);
    const feed = this.items.get(key) ?? new Map<string, FeedItem>();
    this.items.set(key, feed);
    const result: UpsertResult = { added: 0, expired: [] };
    for (const listing of listings) {
      const plan = planUpsert(listing, feed.get(listing.id) ?? null, nowIso);
      if (!plan) continue;
      if (plan.added) result.added += 1;
      if (plan.expired) result.expired.push(listing);
      feed.set(listing.id, plan.item);
      this.listings.set(listing.id, listing);
      this.itemWrites += 1;
    }
    return result;
  }
  async expireMissingItems(g: string, l: string, seen: Set<string>, nowIso: string) {
    const feed = this.items.get(this.feedKey(g, l)) ?? new Map<string, FeedItem>();
    const expired: Listing[] = [];
    for (const item of feed.values()) {
      if (item.active && !seen.has(item.id)) {
        const next = { ...item, active: false, expired_at: nowIso };
        feed.set(item.id, next);
        expired.push(next);
      }
    }
    return expired;
  }
  async purgeExpiredItems(g: string, l: string, beforeIso: string) {
    const feed = this.items.get(this.feedKey(g, l)) ?? new Map<string, FeedItem>();
    let purged = 0;
    for (const item of [...feed.values()]) {
      if (!item.active && item.expired_at !== null && item.expired_at < beforeIso) {
        feed.delete(item.id);
        purged += 1;
      }
    }
    return purged;
  }
  async propagateExpiration(listings: Listing[]) {
    for (const l of listings) this.propagated.set(l.id, l.expired_at);
  }

  async getToken(u: string, p: ProviderId) { return this.tokens.get(this.userKey(u, p)) ?? null; }
  async saveToken(u: string, p: ProviderId, t: string) { this.tokens.set(this.userKey(u, p), t); }
  async deleteToken(u: string, p: ProviderId) { this.tokens.delete(this.userKey(u, p)); }

  async getAccount(u: string, p: ProviderId) { return this.accounts.get(this.userKey(u, p)) ?? null; }
  async saveAccount(a: ProviderAccount) { this.accounts.set(this.userKey(a.user_id, a.provider), { ...a }); }
  async updateAccount(u: string, p: ProviderId, patch: Partial<ProviderAccount>) {
    const cur = this.accounts.get(this.userKey(u, p));
    if (cur) this.accounts.set(this.userKey(u, p), { ...cur, ...patch });
  }
}

export function makeListing(id: string, overrides: Partial<Listing> = {}): Listing {
  return {
    id, title: id, price: 1000, charges: 0, surface: 30, rooms: 2, floor: null,
    address: 'Paris 75011', arrondissement: 11, images: [], description: '', url: '',
    source: 'test', has_elevator: false, has_parking: false, has_balcony: false,
    has_terrace: false, available_from: '2026-01-01T00:00:00Z', deposit: 0, lat: null, lng: null,
    expired_at: null,
    ...overrides,
  };
}

/** Provider whose data is set per token → alert → pages. */
export class FakeProvider implements ListingProvider {
  readonly id = 'jinka' as const;
  alerts: ProviderAlert[] = [];
  pages = new Map<string, Listing[][]>(); // alertId → pages
  validTokens = new Set<string>();
  calls: string[] = [];

  private check(token: string) {
    if (!this.validTokens.has(token)) throw new ProviderAuthError('Session Jinka expirée');
  }
  async listAlerts(token: string) {
    this.calls.push('alerts');
    this.check(token);
    return this.alerts;
  }
  async fetchAlertPage(token: string, alertId: string, page: number): Promise<ProviderAlertPage> {
    this.calls.push(`page:${alertId}:${page}`);
    this.check(token);
    if (!this.pages.has(alertId)) throw new ProviderAlertNotFoundError(alertId);
    const pages = this.pages.get(alertId)!;
    return { listings: pages[page - 1] ?? [], nbPages: Math.max(pages.length, 1) };
  }
}

export function feedLink(overrides: Partial<FeedLink> = {}): FeedLink {
  return {
    group_id: 'g1', list_id: 'l1', provider: 'jinka', owner_id: 'alice',
    alert_id: 'a1', alert_name: 'Paris 11', linked_at: '2026-01-01T00:00:00Z',
    status: 'ok', last_sync_at: null,
    ...overrides,
  };
}

export const FIXED_NOW = new Date('2026-09-29T10:00:00Z');
