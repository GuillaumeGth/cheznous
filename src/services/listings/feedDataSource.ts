import {
  collection, getDocs, limit, orderBy, query, QueryDocumentSnapshot, startAfter, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { alog } from '@/lib/adminLogger';
import { FeedItem, Listing } from '@/types';
import { matchesFilters } from './matchesFilters';
import { ListingsDataSource, ListingsPage } from './types';

export const FEED_PAGE_SIZE = 30;

function toListing(item: FeedItem): Listing {
  const { added_at: _added, fetched_at: _fetched, active: _active, ...listing } = item;
  return listing;
}

// Reads the provider feed the Cloud Functions keep in sync for a search list:
// live items only, newest first. Our filters refine it client-side.
export const feedDataSource: ListingsDataSource = {
  id: 'feed',
  kind: 'feed',

  async fetchPage({ groupId, listId, filters }, cursor): Promise<ListingsPage> {
    const base = query(
      collection(db, 'groups', groupId, 'feeds', listId, 'items'),
      where('active', '==', true),
      orderBy('added_at', 'desc'),
      limit(FEED_PAGE_SIZE),
    );
    const q = cursor ? query(base, startAfter(cursor as QueryDocumentSnapshot)) : base;
    alog('Firestore:getDocs feed items', { groupId, listId, after: !!cursor });
    const snap = await getDocs(q);
    const docs = snap.docs;
    return {
      listings: docs.map((d) => toListing(d.data() as FeedItem)).filter((l) => matchesFilters(l, filters)),
      nextCursor: docs.length === FEED_PAGE_SIZE ? docs[docs.length - 1] : null,
    };
  },
};
