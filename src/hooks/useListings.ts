import { useCallback, useRef } from 'react';
import { Listing } from '@/types';
import { useFilterStore } from '@/stores/filterStore';
import { useListingsStore } from '@/stores/listingsStore';

// Thin wrapper over the module-level listingsStore. The store holds the cache
// (stack, page, hasMore, lastRefresh) so it survives screen unmount/remount —
// remounting the swipe screen reuses fresh data instead of refetching.
export function useListings() {
  const stack = useListingsStore((s) => s.stack);
  const isLoading = useListingsStore((s) => s.isLoading);
  const { filters } = useFilterStore();

  // Always-fresh ref so the callbacks below stay stable (no deps) while still
  // reading the latest filters.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const filtersKey = JSON.stringify(filters);

  const loadMore = useCallback(() => useListingsStore.getState().loadMore(filtersRef.current), []);
  const refresh = useCallback(
    (force = false) => useListingsStore.getState().refresh(filtersRef.current, force),
    [],
  );
  const pop = useCallback(() => useListingsStore.getState().pop(), []);
  const pushBack = useCallback((listing: Listing) => useListingsStore.getState().pushBack(listing), []);

  return { stack, isLoading, loadMore, refresh, pop, pushBack, filtersKey };
}
