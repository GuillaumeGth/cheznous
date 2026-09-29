import { Firestore } from 'firebase-admin/firestore';
import { FeedStore, UpsertResult } from './FeedStore';
import { FeedItem, FeedLink, Listing, ProviderAccount, ProviderId } from '../types';

// Firestore layout (see firestore.rules):
//   groups/{groupId}/feeds/{listId}                 FeedLink   — members read, server writes
//   groups/{groupId}/feeds/{listId}/items/{id}      FeedItem   — members read, server writes
//   users/{uid}/provider_accounts/{provider}        ProviderAccount — owner reads, server writes
//   provider_tokens/{uid}_{provider}                token      — server only
//   listings/{id}                                   Listing    — shared cache (likes/matches)

const BATCH_SIZE = 200; // ≤ 2 writes per item → stays under the 500-op batch limit

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function stripFeedFields(item: FeedItem): Listing {
  const { added_at: _a, fetched_at: _f, active: _active, ...listing } = item;
  return listing;
}

export function firestoreFeedStore(db: Firestore): FeedStore {
  const feedRef = (groupId: string, listId: string) =>
    db.collection('groups').doc(groupId).collection('feeds').doc(listId);
  const itemsRef = (groupId: string, listId: string) => feedRef(groupId, listId).collection('items');
  const tokenRef = (uid: string, provider: ProviderId) => db.collection('provider_tokens').doc(`${uid}_${provider}`);
  const accountRef = (uid: string, provider: ProviderId) =>
    db.collection('users').doc(uid).collection('provider_accounts').doc(provider);

  return {
    async getGroup(groupId) {
      const snap = await db.collection('groups').doc(groupId).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      // `user1_id`/`user2_id` are legacy membership fields still honoured by the rules.
      const memberIds: string[] = Array.isArray(data.member_ids)
        ? data.member_ids
        : [data.user1_id, data.user2_id].filter((id): id is string => typeof id === 'string');
      const lists: { id?: unknown }[] = Array.isArray(data.search_lists) ? data.search_lists : [];
      const listIds = lists.map((l) => l.id).filter((id): id is string => typeof id === 'string');
      return {
        member_ids: memberIds,
        // Legacy groups without `search_lists` expose a virtual 'default' list
        // client-side (useGroup) — mirror it so it can be linked too.
        list_ids: listIds.length > 0 ? listIds : data.filters ? ['default'] : [],
      };
    },

    async listFeeds(filter) {
      const base = db.collectionGroup('feeds');
      const snap = await (filter ? base.where('owner_id', '==', filter.ownerId) : base).get();
      return snap.docs.map((d) => d.data() as FeedLink);
    },

    async getFeed(groupId, listId) {
      const snap = await feedRef(groupId, listId).get();
      return snap.exists ? (snap.data() as FeedLink) : null;
    },

    async saveFeed(link) {
      await feedRef(link.group_id, link.list_id).set(link);
    },

    async updateFeed(groupId, listId, patch) {
      const ref = feedRef(groupId, listId);
      if ((await ref.get()).exists) await ref.update(patch);
    },

    async deleteFeed(groupId, listId) {
      await db.recursiveDelete(feedRef(groupId, listId));
    },

    async upsertFeedItems(groupId, listId, listings, nowIso) {
      const col = itemsRef(groupId, listId);
      const result: UpsertResult = { added: 0, expired: [] };
      for (const chunk of chunks(listings, BATCH_SIZE)) {
        const snaps = await db.getAll(...chunk.map((l) => col.doc(l.id)));
        const batch = db.batch();
        chunk.forEach((listing, i) => {
          const prev = snaps[i].exists ? (snaps[i].data() as FeedItem) : null;
          const active = listing.expired_at === null;
          if (!prev && !active) return;
          if (!prev) result.added += 1;
          if (prev?.active && !active) result.expired.push(listing);
          const item: FeedItem = { ...listing, active, fetched_at: nowIso, added_at: prev?.added_at ?? nowIso };
          batch.set(col.doc(listing.id), item);
          batch.set(db.collection('listings').doc(listing.id), listing, { merge: true });
        });
        await batch.commit();
      }
      return result;
    },

    async expireMissingItems(groupId, listId, seenIds, nowIso) {
      const snap = await itemsRef(groupId, listId).where('active', '==', true).get();
      const gone = snap.docs.filter((d) => !seenIds.has(d.id));
      const expired: Listing[] = [];
      for (const chunk of chunks(gone, BATCH_SIZE)) {
        const batch = db.batch();
        for (const doc of chunk) {
          batch.update(doc.ref, { active: false, expired_at: nowIso });
          expired.push({ ...stripFeedFields(doc.data() as FeedItem), expired_at: nowIso });
        }
        await batch.commit();
      }
      return expired;
    },

    async purgeExpiredItems(groupId, listId, beforeIso) {
      const snap = await itemsRef(groupId, listId)
        .where('active', '==', false)
        .where('expired_at', '<', beforeIso)
        .get();
      for (const chunk of chunks(snap.docs, 400)) {
        const batch = db.batch();
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      return snap.size;
    },

    async propagateExpiration(listings) {
      for (const listing of listings) {
        const matches = await db.collection('matches').where('listing_id', '==', listing.id).get();
        const batch = db.batch();
        batch.set(db.collection('listings').doc(listing.id), { expired_at: listing.expired_at }, { merge: true });
        // Matches embed a snapshot of the listing taken at match time.
        matches.docs.forEach((m) => batch.update(m.ref, { 'listing.expired_at': listing.expired_at }));
        await batch.commit();
      }
    },

    async getToken(uid, provider) {
      const snap = await tokenRef(uid, provider).get();
      const token = snap.get('access_token');
      return typeof token === 'string' ? token : null;
    },

    async saveToken(uid, provider, token) {
      await tokenRef(uid, provider).set({
        user_id: uid, provider, access_token: token, updated_at: new Date().toISOString(),
      });
    },

    async deleteToken(uid, provider) {
      await tokenRef(uid, provider).delete();
    },

    async getAccount(uid, provider) {
      const snap = await accountRef(uid, provider).get();
      return snap.exists ? (snap.data() as ProviderAccount) : null;
    },

    async saveAccount(account) {
      await accountRef(account.user_id, account.provider).set(account);
    },

    async updateAccount(uid, provider, patch) {
      const ref = accountRef(uid, provider);
      if ((await ref.get()).exists) await ref.update(patch);
    },

    async deleteAccount(uid, provider) {
      await accountRef(uid, provider).delete();
    },
  };
}
