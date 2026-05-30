import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc, arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserSearchResult } from '@/types';
import { notifyGroupInvitation } from '@/lib/notifications';

export async function searchUsers(
  term: string,
  excludeUids: string[],
): Promise<UserSearchResult[]> {
  const normalized = term.trim();
  if (normalized.length < 2) return [];

  const [byEmail, byName] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('email', '==', normalized))),
    getDocs(query(
      collection(db, 'users'),
      where('display_name', '>=', normalized),
      where('display_name', '<=', normalized + ''),
    )),
  ]);

  const seen = new Set<string>();
  const results: UserSearchResult[] = [];

  for (const snap of [...byEmail.docs, ...byName.docs]) {
    if (seen.has(snap.id) || excludeUids.includes(snap.id)) continue;
    seen.add(snap.id);
    const d = snap.data();
    results.push({
      uid: snap.id,
      display_name: d.display_name as string,
      email: d.email as string,
      photo_url: (d.photo_url as string | null) ?? null,
    });
  }

  return results;
}

export async function sendGroupInvitation(
  groupId: string,
  inviterId: string,
  inviterName: string,
  inviteeId: string,
): Promise<void> {
  await addDoc(collection(db, 'group_invitations'), {
    group_id: groupId,
    inviter_id: inviterId,
    inviter_name: inviterName,
    invitee_id: inviteeId,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  await notifyGroupInvitation(inviteeId, inviterName).catch(() => {});
}

export async function acceptGroupInvitation(
  invitationId: string,
  groupId: string,
  inviteeId: string,
): Promise<void> {
  await Promise.all([
    updateDoc(doc(db, 'group_invitations', invitationId), { status: 'accepted' }),
    updateDoc(doc(db, 'couples', groupId), { member_ids: arrayUnion(inviteeId) }),
    updateDoc(doc(db, 'users', inviteeId), { couple_id: groupId }),
  ]);
}

export async function rejectGroupInvitation(invitationId: string): Promise<void> {
  await updateDoc(doc(db, 'group_invitations', invitationId), { status: 'rejected' });
}
