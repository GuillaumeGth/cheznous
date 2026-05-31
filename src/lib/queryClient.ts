import { QueryClient } from '@tanstack/react-query';

// App-wide TanStack Query client. Single instance shared across the tree so
// every screen reads from the same cache (no duplicate Firestore reads).
//
// Listings are immutable once cached in Firestore, so the per-listing cache
// uses staleTime: Infinity (see listingsCache.ts). The defaults below cover
// everything else: don't refetch aggressively on a mobile app, keep cached
// data around for half an hour, and retry once on transient failures.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: 30 * 60 * 1000, // 30 min
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
