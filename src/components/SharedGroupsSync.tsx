import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { createGroup, joinGroup, seedDefaultSearch, setActiveGroup } from '@/services/groups';
import { GroupSummary, planHomeGroup } from '@/services/sharedGroups';
import { alog } from '@/lib/adminLogger';

// Renders nothing. Mounted once in the root layout: everyone using the app
// forms one implicit group. Watches `groups`, creates the home group if there
// is none, joins the signed-in user to it, gives it its single search, and
// makes it the user's active group. Its state lives here, not in the root
// layout, so group changes don't re-render the whole app.
export default function SharedGroupsSync() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  const authLoading = useAuthStore((s) => s.isLoading);
  const groupId = useAuthStore((s) => s.groupId);
  const [homeGroupId, setHomeGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setHomeGroupId(null);
      return;
    }
    let creating = false;
    return onSnapshot(
      collection(db, 'groups'),
      (snap) => {
        const groups: GroupSummary[] = snap.docs.map((d) => ({
          id: d.id,
          memberIds: (d.get('member_ids') as string[] | undefined) ?? [],
          searchListCount: ((d.get('search_lists') as unknown[] | undefined) ?? []).length,
        }));
        const plan = planHomeGroup(groups, uid);
        if (plan.create) {
          if (!creating) {
            creating = true;
            alog('HomeGroup:create');
            createGroup(uid, 'Chez nous').catch((e) => console.warn('createGroup', e));
          }
          return;
        }
        const home = plan.homeGroupId!;
        if (plan.join) joinGroup(home, uid).catch((e) => console.warn('joinGroup', e));
        if (plan.seedSearch) seedDefaultSearch(home).catch((e) => console.warn('seedDefaultSearch', e));
        setHomeGroupId(home);
      },
      (e) => console.warn('SharedGroupsSync', e),
    );
  }, [uid]);

  // The home group is everyone's active group.
  useEffect(() => {
    if (!uid || authLoading || !homeGroupId || groupId === homeGroupId) return;
    setActiveGroup(uid, homeGroupId).catch((e) => console.warn('setActiveGroup', e));
  }, [uid, authLoading, groupId, homeGroupId]);

  return null;
}
