import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { queryClient } from '@/lib/queryClient';
import { Listing } from '@/types';
import { alog } from '@/lib/adminLogger';

// Firestore caps the `in` operator at 30 values per query.
const IN_QUERY_LIMIT = 30;

// Cache key for a single listing doc. Listings are immutable once cached in
// Firestore, so anything that fetches a listing should seed this key and read
// from it first — that's what kills the per-like N+1 of getDoc calls.
export const listingKey = (id: string) => ['listing', id] as const;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Resolves a set of listing ids to their docs, hitting Firestore only for the
 * ids not already in the TanStack cache. Missing ids are fetched in batches of
 * 30 with a single `documentId() in [...]` query each (instead of one getDoc
 * per id), and every result seeds the per-listing cache for later reads.
 */
export async function fetchListingsByIds(ids: string[]): Promise<Map<string, Listing>> {
  const result = new Map<string, Listing>();
  const missing: string[] = [];

  for (const id of ids) {
    const cached = queryClient.getQueryData<Listing>(listingKey(id));
    if (cached) result.set(id, cached);
    else if (!missing.includes(id)) missing.push(id);
  }

  if (missing.length === 0) {
    alog('Cache:hit listings (fetchListingsByIds)', { requested: ids.length, fromCache: result.size });
    return result;
  }

  for (const batch of chunk(missing, IN_QUERY_LIMIT)) {
    alog('Firestore:getDocs listings (batch in)', { count: batch.length, fromCache: result.size });
    const snap = await getDocs(
      query(collection(db, 'listings'), where(documentId(), 'in', batch)),
    );
    snap.forEach((d) => {
      const listing = d.data() as Listing;
      queryClient.setQueryData(listingKey(d.id), listing);
      result.set(d.id, listing);
    });
  }

  return result;
}
