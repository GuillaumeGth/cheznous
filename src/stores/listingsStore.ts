import { create } from 'zustand';
import { Listing, SearchFilters } from '@/types';
import { fetchListings, PAGE_SIZE } from '@/services/listingsService';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { alog } from '@/lib/adminLogger';

const REFRESH_THROTTLE_MS = 30 * 60 * 1000;

type ListingsState = {
  stack: Listing[];
  isLoading: boolean;
  /** Next page to fetch. */
  page: number;
  /** Becomes false once a short/empty page is returned — stops auto-pagination. */
  hasMore: boolean;
  /** Time + filters of the last network refresh, used to skip redundant fetches. */
  lastRefresh: { time: number; filtersKey: string } | null;

  loadMore: (filters: SearchFilters) => Promise<void>;
  refresh: (filters: SearchFilters, force?: boolean) => void;
  pop: () => void;
  pushBack: (listing: Listing) => void;
};

// Module-level singleton: state persists across screen mount/unmount, so
// navigating away from the swipe tab and back does NOT trigger a fresh fetch
// while the cached data is still recent.
export const useListingsStore = create<ListingsState>((set, get) => ({
  stack: [],
  isLoading: false,
  page: 1,
  hasMore: true,
  lastRefresh: null,

  loadMore: async (filters) => {
    // zustand's set() is synchronous, so reading isLoading here reliably guards
    // against both concurrent callers and the no-more-results loop.
    const { isLoading, hasMore, page } = get();
    if (isLoading || !hasMore) return;
    alog('listingsStore:loadMore', { page, filtersKey: JSON.stringify(filters).slice(0, 80) });
    set({ isLoading: true });
    try {
      const listings = await fetchListings(filters, page);
      // A short/empty page means we've hit the end — stop auto-paginating.
      if (listings.length < PAGE_SIZE) set({ hasMore: false });
      if (listings.length > 0) {
        alog('Firestore:setDoc listings (batch)', { count: listings.length });
        await Promise.all(
          listings.map((l) => setDoc(doc(db, 'listings', l.id), l, { merge: true })),
        );
        set((s) => ({ stack: [...s.stack, ...listings], page: s.page + 1 }));
      }
    } catch (e) {
      console.error('loadMore error', e);
    } finally {
      set({ isLoading: false });
    }
  },

  // Resets to page 1 and fetches a fresh batch.
  // Skips the fetch entirely when we still hold fresh data for the same filters
  // (within the throttle window). force=true bypasses it (filter change / manual reload).
  refresh: (filters, force = false) => {
    const now = Date.now();
    const { lastRefresh, stack, isLoading } = get();
    const currentKey = JSON.stringify(filters);
    const sameFilters = lastRefresh?.filtersKey === currentKey;
    const tooSoon = !!lastRefresh && sameFilters && now - lastRefresh.time < REFRESH_THROTTLE_MS;

    // Still have fresh, same-filter data → keep it, don't hit the API.
    if (!force && tooSoon && stack.length > 0) return;
    // A fetch is already in flight for these filters → don't pile on.
    if (!force && isLoading && sameFilters) return;

    set({
      lastRefresh: { time: now, filtersKey: currentKey },
      page: 1,
      hasMore: true,
      stack: [],
    });
    get().loadMore(filters);
  },

  pop: () => set((s) => ({ stack: s.stack.slice(1) })),

  pushBack: (listing) => set((s) => ({ stack: [listing, ...s.stack] })),
}));
