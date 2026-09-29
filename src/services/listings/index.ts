import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { alog } from '@/lib/adminLogger';
import { feedDataSource } from './feedDataSource';
import { mockDataSource } from './mock/mockDataSource';
import { ListingsDataSource } from './types';

export * from './types';
export { matchesFilters } from './matchesFilters';

// Single switch point: the provider feed synced by Cloud Functions, or the
// on-device mock for offline dev (EXPO_PUBLIC_LISTINGS_SOURCE=mock).
const activeSource: ListingsDataSource =
  process.env.EXPO_PUBLIC_LISTINGS_SOURCE === 'mock' ? mockDataSource : feedDataSource;

export function getListingsDataSource(): ListingsDataSource {
  return activeSource;
}

/** Listings this user already swiped in this search list — never re-shown. */
export async function fetchSwipedListingIds(uid: string, listId: string): Promise<Set<string>> {
  alog('Firestore:getDocs swipes (fetchSwipedListingIds)', { listId });
  const snap = await getDocs(query(
    collection(db, 'swipes'),
    where('user_id', '==', uid),
    where('search_list_id', '==', listId),
  ));
  return new Set(snap.docs.map((d) => d.get('listing_id') as string));
}
