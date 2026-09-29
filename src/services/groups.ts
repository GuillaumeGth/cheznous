import {
  collection, doc, setDoc, updateDoc, arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_FILTERS } from '@/types';
import { DEFAULT_LIST } from '@/stores/filterStore';
import { useAuthStore } from '@/stores/authStore';

export const DEFAULT_GROUP_NAME = 'Notre coloc';

/**
 * Crée le groupe unique de l'app (SharedGroupsSync, quand il n'en existe
 * aucun) et le rend actif. Les autres utilisateurs le rejoignent tout seuls.
 */
export async function createGroup(uid: string, name?: string): Promise<{ id: string }> {
  const groupRef = doc(collection(db, 'groups'));
  await setDoc(groupRef, {
    id: groupRef.id,
    name: name?.trim() || DEFAULT_GROUP_NAME,
    user1_id: uid,
    user2_id: null,
    member_ids: [uid],
    filters: DEFAULT_FILTERS,
    search_lists: [DEFAULT_LIST],
    active_search_list_id: DEFAULT_LIST.id,
    created_at: new Date().toISOString(),
  });
  // merge so it works even if the user profile doc doesn't exist yet.
  await setDoc(doc(db, 'users', uid), { couple_id: groupRef.id }, { merge: true });
  return { id: groupRef.id };
}

/** Donne au groupe sa recherche unique quand il n'en a pas. */
export async function seedDefaultSearch(groupId: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), {
    search_lists: [DEFAULT_LIST],
    active_search_list_id: DEFAULT_LIST.id,
  });
}

/** Ajoute `uid` aux membres du groupe unique de l'app. */
export async function joinGroup(groupId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { member_ids: arrayUnion(uid) });
}

/** Définit le groupe actif (champ `couple_id` du user) + met à jour le store. */
export async function setActiveGroup(uid: string, groupId: string | null): Promise<void> {
  await setDoc(doc(db, 'users', uid), { couple_id: groupId }, { merge: true });
  useAuthStore.getState().setGroupId(groupId);
}
