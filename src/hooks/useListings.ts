import { useCallback } from 'react';
import { Listing } from '@/types';
import { ListingsQuery } from '@/services/listings';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { listingsQueryKey, useListingsStore } from '@/stores/listingsStore';

// Current (group, list, filters) + uid, read at call time so callbacks stay stable.
function currentQuery(): { query: ListingsQuery; uid: string } | null {
  const { groupId, firebaseUser } = useAuthStore.getState();
  const { activeListId, filters } = useFilterStore.getState();
  if (!groupId || !firebaseUser || !activeListId) return null;
  return { query: { groupId, listId: activeListId, filters }, uid: firebaseUser.uid };
}

/** Force-reloads the stack if `listId` is the list currently swiped (e.g. right after linking it). */
export function refreshListingsIfActive(listId: string) {
  const current = currentQuery();
  if (current && current.query.listId === listId) {
    useListingsStore.getState().refresh(current.query, current.uid, true);
  }
}

// Thin wrapper over the module-level listingsStore. The store holds the cache
// (stack, cursor, hasMore, lastRefresh) so it survives screen unmount/remount —
// remounting the swipe screen reuses fresh data instead of refetching.
export function useListings() {
  const stack = useListingsStore((s) => s.stack);
  const isLoading = useListingsStore((s) => s.isLoading);
  const error = useListingsStore((s) => s.error);
  const groupId = useAuthStore((s) => s.groupId);
  const activeListId = useFilterStore((s) => s.activeListId);
  const filters = useFilterStore((s) => s.filters);

  // Changes whenever the group, the active list or its filters change — the
  // swipe screen force-refreshes on it.
  const queryKey = groupId && activeListId
    ? listingsQueryKey({ groupId, listId: activeListId, filters })
    : '';

  const loadMore = useCallback(() => {
    const current = currentQuery();
    return current ? useListingsStore.getState().loadMore(current.query, current.uid) : Promise.resolve();
  }, []);
  const refresh = useCallback((force = false) => {
    const current = currentQuery();
    if (current) useListingsStore.getState().refresh(current.query, current.uid, force);
  }, []);
  const pop = useCallback(() => useListingsStore.getState().pop(), []);
  const pushBack = useCallback((listing: Listing) => useListingsStore.getState().pushBack(listing), []);

  return { stack, isLoading, error, loadMore, refresh, pop, pushBack, queryKey };
}
