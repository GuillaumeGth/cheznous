import { create } from 'zustand';
import { Listing } from '@/types';
import {
  fetchSwipedListingIds, getListingsDataSource, ListingsCursor, ListingsQuery,
} from '@/services/listings';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { alog } from '@/lib/adminLogger';

const REFRESH_THROTTLE_MS = 30 * 60 * 1000;
// Filters are applied client-side, so a page can come back empty while more
// exist. Keep reading a few pages per loadMore before giving up.
const MAX_PAGES_PER_LOAD = 5;

const LOAD_ERROR_MESSAGE = 'Impossible de charger les annonces.';

type ListingsState = {
  stack: Listing[];
  isLoading: boolean;
  /** Next page position; `null` = first page. */
  cursor: ListingsCursor | null;
  /** False once the source is exhausted — stops auto-pagination. */
  hasMore: boolean;
  /** Set on failure; blocks auto-pagination until the next refresh. */
  error: string | null;
  /** Time + query of the last refresh, used to skip redundant fetches. */
  lastRefresh: { time: number; key: string } | null;
  /** Listings already swiped in this list (loaded on the first page). */
  swipedIds: Set<string> | null;

  loadMore: (query: ListingsQuery, uid: string) => Promise<void>;
  refresh: (query: ListingsQuery, uid: string, force?: boolean) => void;
  pop: () => void;
  pushBack: (listing: Listing) => void;
};

export const listingsQueryKey = (q: ListingsQuery) =>
  `${q.groupId}|${q.listId}|${JSON.stringify(q.filters)}`;

// Bumped by every refresh: a load started before it must not write its
// (stale) results into the new stack.
let generation = 0;

// Module-level singleton: state persists across screen mount/unmount, so
// navigating away from the swipe tab and back does NOT trigger a fresh fetch
// while the cached data is still recent.
export const useListingsStore = create<ListingsState>((set, get) => ({
  stack: [],
  isLoading: false,
  cursor: null,
  hasMore: true,
  error: null,
  lastRefresh: null,
  swipedIds: null,

  loadMore: async (query, uid) => {
    // zustand's set() is synchronous, so reading isLoading here reliably guards
    // against both concurrent callers and the no-more-results loop.
    const { isLoading, hasMore, error } = get();
    if (isLoading || !hasMore || error) return;
    const gen = generation;
    set({ isLoading: true });
    try {
      const source = getListingsDataSource();
      const swipedIds = get().swipedIds ?? (await fetchSwipedListingIds(uid, query.listId));
      const known = new Set(get().stack.map((l) => l.id));
      let cursor = get().cursor;
      let fresh: Listing[] = [];
      let more = true;
      for (let i = 0; i < MAX_PAGES_PER_LOAD && fresh.length === 0 && more; i += 1) {
        const page = await source.fetchPage(query, cursor);
        fresh = page.listings.filter((l) => !swipedIds.has(l.id) && !known.has(l.id));
        cursor = page.nextCursor;
        more = cursor !== null;
      }
      if (gen !== generation) return;
      alog('listingsStore:loadMore', { source: source.id, added: fresh.length, more });

      // Feed listings are persisted by the server; local ones must be cached
      // here so likes/matches can resolve them from `listings/{id}`.
      if (source.kind === 'local' && fresh.length > 0) {
        await Promise.all(fresh.map((l) => setDoc(doc(db, 'listings', l.id), l, { merge: true })));
      }
      set((s) => ({ stack: [...s.stack, ...fresh], cursor, hasMore: more, swipedIds }));
    } catch (e) {
      console.error('loadMore error', e);
      if (gen === generation) set({ error: LOAD_ERROR_MESSAGE });
    } finally {
      if (gen === generation) set({ isLoading: false });
    }
  },

  // Resets to the first page and fetches a fresh batch. Skips the fetch when
  // we still hold fresh data for the same query (within the throttle window).
  // force=true bypasses it (filter/list change, manual reload, after linking).
  refresh: (query, uid, force = false) => {
    const now = Date.now();
    const { lastRefresh, stack, isLoading, error } = get();
    const key = listingsQueryKey(query);
    const sameQuery = lastRefresh?.key === key;
    const tooSoon = !!lastRefresh && sameQuery && now - lastRefresh.time < REFRESH_THROTTLE_MS;

    if (!force && !error && tooSoon && stack.length > 0) return;
    if (!force && isLoading && sameQuery) return;

    generation += 1;
    set({
      lastRefresh: { time: now, key },
      cursor: null,
      hasMore: true,
      error: null,
      isLoading: false,
      swipedIds: null,
      stack: [],
    });
    get().loadMore(query, uid);
  },

  pop: () => set((s) => ({ stack: s.stack.slice(1) })),

  pushBack: (listing) => set((s) => ({ stack: [listing, ...s.stack] })),
}));
