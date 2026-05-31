import {
  collection, doc, setDoc, updateDoc, getDocs, query, where,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_FILTERS } from '@/types';
import { DEFAULT_LIST } from '@/stores/filterStore';
import { useAuthStore } from '@/stores/authStore';

export const DEFAULT_GROUP_NAME = 'Notre coloc';

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { name: name.trim() });
}

/** Crée un nouveau groupe dont `uid` est le seul membre, et le rend actif. */
export async function createGroup(
  uid: string,
  name?: string,
): Promise<{ id: string; code: string }> {
  const code = generateCode();
  const groupRef = doc(collection(db, 'groups'));
  await setDoc(groupRef, {
    id: groupRef.id,
    name: name?.trim() || DEFAULT_GROUP_NAME,
    user1_id: uid,
    user2_id: null,
    member_ids: [uid],
    invite_code: code,
    filters: DEFAULT_FILTERS,
    search_lists: [DEFAULT_LIST],
    active_search_list_id: DEFAULT_LIST.id,
    created_at: new Date().toISOString(),
  });
  // merge so it works even if the user profile doc doesn't exist yet.
  await setDoc(doc(db, 'users', uid), { couple_id: groupRef.id }, { merge: true });
  return { id: groupRef.id, code };
}

/** Rejoint un groupe via son code d'invitation et le rend actif. Retourne l'id. */
export async function joinGroupByCode(uid: string, code: string): Promise<string> {
  const q = query(
    collection(db, 'groups'),
    where('invite_code', '==', code.trim().toUpperCase()),
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('CODE_INVALID');

  const groupDoc = snap.docs[0];
  const data = groupDoc.data();
  const existing: string[] = data.member_ids?.length
    ? data.member_ids
    : [data.user1_id, ...(data.user2_id ? [data.user2_id] : [])];
  if (existing.includes(uid)) throw new Error('ALREADY_MEMBER');

  await updateDoc(groupDoc.ref, {
    user2_id: data.user2_id ?? uid,
    member_ids: arrayUnion(uid),
  });
  await setDoc(doc(db, 'users', uid), { couple_id: groupDoc.id }, { merge: true });
  return groupDoc.id;
}

/** Retire `uid` des membres du groupe. */
export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { member_ids: arrayRemove(uid) });
}

/** Définit le groupe actif (champ `couple_id` du user) + met à jour le store. */
export async function setActiveGroup(uid: string, groupId: string | null): Promise<void> {
  await setDoc(doc(db, 'users', uid), { couple_id: groupId }, { merge: true });
  useAuthStore.getState().setGroupId(groupId);
}
