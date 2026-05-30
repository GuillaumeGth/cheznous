import { useEffect, useState } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Group, DEFAULT_FILTERS, UserProfile } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore, DEFAULT_LIST } from '@/stores/filterStore';

function deriveMemberIds(data: Group): string[] {
  if (data.member_ids?.length) return data.member_ids;
  return [data.user1_id, ...(data.user2_id ? [data.user2_id] : [])];
}

export function useGroup() {
  const groupId = useAuthStore((s) => s.groupId);
  const [group, setGroup] = useState<Group | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!groupId) return;

    const unsub = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Group;
      const normalized = { ...data, member_ids: deriveMemberIds(data) };
      setGroup(normalized);

      const lists = data.search_lists?.length
        ? data.search_lists
        : [{ ...DEFAULT_LIST, filters: data.filters ?? DEFAULT_FILTERS }];
      const activeId = data.active_search_list_id ?? lists[0].id;
      useFilterStore.getState().setSearchLists(lists, activeId);

      const { firebaseUser } = useAuthStore.getState();
      const otherIds = normalized.member_ids.filter((id) => id !== firebaseUser?.uid);
      Promise.all(
        otherIds.map((id) =>
          getDoc(doc(db, 'users', id)).then((s) =>
            s.exists() ? ({ id: s.id, ...s.data() } as UserProfile) : null,
          ),
        ),
      )
        .then((profiles) => setMemberProfiles(profiles.filter(Boolean) as UserProfile[]))
        .catch(() => {});
    });

    return unsub;
  }, [groupId]);

  return { group, memberProfiles };
}
