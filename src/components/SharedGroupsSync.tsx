import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { createGroup, joinGroup, setActiveGroup } from '@/services/groups';
import { GroupSummary, planSharedGroups } from '@/services/sharedGroups';
import { alog } from '@/lib/adminLogger';

// Renders nothing. Mounted once in the root layout: watches every group and
// keeps the signed-in user a member of all of them (including groups created
// later by someone else), creates the first group if none exists, and sets an
// active group when the user has none. Its state lives here, not in the root
// layout, so group changes don't re-render the whole app.
export default function SharedGroupsSync() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const authLoading = useAuthStore((s) => s.isLoading);
  const groupId = useAuthStore((s) => s.groupId);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);

  // One listener on all groups; join the missing ones as they appear.
  useEffect(() => {
    if (!uid) {
      setGroups(null);
      return;
    }
    let creating = false;
    return onSnapshot(
      collection(db, 'groups'),
      (snap) => {
        const summaries = snap.docs.map((d) => ({
          id: d.id,
          memberIds: (d.get('member_ids') as string[] | undefined) ?? [],
          searchListCount: ((d.get('search_lists') as unknown[] | undefined) ?? []).length,
        }));
        setGroups(summaries);
        const plan = planSharedGroups(summaries, uid, null);
        if (plan.toJoin.length > 0) alog('SharedGroups:join', { count: plan.toJoin.length });
        plan.toJoin.forEach((id) => joinGroup(id, uid).catch((e) => console.warn('joinGroup', e)));
        if (plan.create && !creating) {
          creating = true;
          createGroup(uid, 'Chez nous').catch((e) => console.warn('createGroup', e));
        }
      },
      (e) => console.warn('SharedGroupsSync', e),
    );
  }, [uid]);

  // Active group: keep a valid one, otherwise pick the group actually in use.
  useEffect(() => {
    if (!uid || authLoading || !groups?.length) return;
    const { activeGroupId } = planSharedGroups(groups, uid, groupId);
    if (activeGroupId) setActiveGroup(uid, activeGroupId).catch((e) => console.warn('setActiveGroup', e));
  }, [uid, authLoading, groupId, groups]);

  return null;
}
