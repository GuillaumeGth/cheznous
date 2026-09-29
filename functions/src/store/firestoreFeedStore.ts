import { Firestore } from 'firebase-admin/firestore';
import { FeedStore, planUpsert, UpsertResult } from './FeedStore';
import { FeedItem, FeedLink, Listing, ProviderAccount, ProviderId } from '../types';

// Firestore layout (see firestore.rules):
//   groups/{groupId}/feeds/{listId}                 FeedLink   — members read, server writes
//   groups/{groupId}/feeds/{listId}/items/{id}      FeedItem   — members read, server writes
//   users/{uid}/provider_accounts/{provider}        ProviderAccount — owner reads, server writes
//   provider_tokens/{uid}_{provider}                token      — server only
//   listings/{id}                                   Listing    — shared cache (likes/matches)

const BATCH_SIZE = 200; // ≤ 2 writes per item → stays under the 500-op batch limit
const IN_QUERY_LIMIT = 30; // Firestore caps `in` filters at 30 values
const NOT_FOUND = 5; // gRPC status code

// update() without a prior get(): a missing doc is a no-op, not an error.
async function updateIfExists(ref: FirebaseFirestore.DocumentReference, patch: object): Promise<void> {
  try {
    await ref.update(patch);
  } catch (e) {
    if ((e as { code?: unknown }).code !== NOT_FOUND) throw e;
  }
}

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
      await updateIfExists(feedRef(groupId, listId), patch);
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
        let writes = 0;
        chunk.forEach((listing, i) => {
          const plan = planUpsert(listing, snaps[i].exists ? (snaps[i].data() as FeedItem) : null, nowIso);
          if (!plan) return;
          if (plan.added) result.added += 1;
          if (plan.expired) result.expired.push(listing);
          batch.set(col.doc(listing.id), plan.item);
          batch.set(db.collection('listings').doc(listing.id), listing, { merge: true });
          writes += 1;
        });
        if (writes > 0) await batch.commit();
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
      // One `in` query + one batch per 30 listings (matches are rare, so the
      // batch stays far below 500 ops).
      for (const chunk of chunks(listings, IN_QUERY_LIMIT)) {
        const expiredAt = new Map(chunk.map((l) => [l.id, l.expired_at]));
        const matches = await db.collection('matches').where('listing_id', 'in', [...expiredAt.keys()]).get();
        const batch = db.batch();
        for (const [id, at] of expiredAt) batch.set(db.collection('listings').doc(id), { expired_at: at }, { merge: true });
        // Matches embed a snapshot of the listing taken at match time.
        matches.docs.forEach((m) => batch.update(m.ref, { 'listing.expired_at': expiredAt.get(m.get('listing_id')) ?? null }));
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
      await updateIfExists(accountRef(uid, provider), patch);
    },
  };
}
