import { Listing, SearchFilters } from '@/types';

/**
 * Contract every listings source implements. The store and screens only talk
 * to this interface (via `getListingsDataSource()`), so the source can be
 * swapped without touching the UI.
 *
 * - `feed`: listings synced server-side from a provider (Jinka) into
 *   `groups/{groupId}/feeds/{listId}/items` — the search list must be linked
 *   to a provider alert, and listings are already persisted in Firestore.
 * - `local`: listings produced on the device (mock) — the client must cache
 *   them into `listings/{id}` itself so likes/matches can resolve them.
 */
export interface ListingsDataSource {
  readonly id: string;
  readonly kind: 'feed' | 'local';
  /**
   * Returns the next page after `cursor` (`null` = first page). Our filters
   * are applied client-side, so a page may be short or even empty while
   * `nextCursor` is still non-null.
   */
  fetchPage(query: ListingsQuery, cursor: ListingsCursor | null): Promise<ListingsPage>;
}

export type ListingsQuery = {
  groupId: string;
  listId: string;
  filters: SearchFilters;
};

/** Opaque, source-specific pagination state. */
export type ListingsCursor = object;

export type ListingsPage = {
  listings: Listing[];
  /** `null` once the source has nothing further. */
  nextCursor: ListingsCursor | null;
};
