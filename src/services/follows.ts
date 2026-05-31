import {
  collection, query, where, getDocs,
  doc, setDoc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserSearchResult } from '@/types';

const followId = (followerId: string, followingId: string) =>
  `${followerId}_${followingId}`;

export async function followUser(
  followerId: string,
  target: UserSearchResult,
): Promise<void> {
  await setDoc(doc(db, 'follows', followId(followerId, target.uid)), {
    follower_id: followerId,
    following_id: target.uid,
    created_at: new Date().toISOString(),
  });
}

export async function unfollowUser(
  followerId: string,
  followingId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'follows', followId(followerId, followingId)));
}

/** IDs des utilisateurs suivis par `uid`. */
export async function getFollowingIds(uid: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, 'follows'), where('follower_id', '==', uid)),
  );
  return snap.docs.map((d) => (d.data().following_id as string));
}

/** Profils des utilisateurs suivis par `uid`. */
export async function getFollowing(uid: string): Promise<UserSearchResult[]> {
  const ids = await getFollowingIds(uid);
  const profiles = await Promise.all(
    ids.map(async (id) => {
      const s = await getDoc(doc(db, 'users', id));
      if (!s.exists()) return null;
      const d = s.data();
      return {
        uid: s.id,
        display_name: d.display_name as string,
        email: d.email as string,
        photo_url: (d.photo_url as string | null) ?? null,
      } as UserSearchResult;
    }),
  );
  return profiles.filter(Boolean) as UserSearchResult[];
}
