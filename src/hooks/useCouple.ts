import { useEffect, useState } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Couple, DEFAULT_FILTERS, UserProfile } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore, DEFAULT_LIST } from '@/stores/filterStore';

function deriveMemberIds(data: Couple): string[] {
  if (data.member_ids?.length) return data.member_ids;
  return [data.user1_id, ...(data.user2_id ? [data.user2_id] : [])];
}

export function useCouple() {
  const { coupleId, firebaseUser } = useAuthStore();
  const { setSearchLists } = useFilterStore();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!coupleId) return;

    const unsub = onSnapshot(doc(db, 'couples', coupleId), (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Couple;

      // Normalize member_ids for backward compat with old couple docs
      const normalizedData = { ...data, member_ids: deriveMemberIds(data) };
      setCouple(normalizedData);

      // Migrate couples that still use the old single-filter field
      const lists = data.search_lists?.length
        ? data.search_lists
        : [{ ...DEFAULT_LIST, filters: data.filters ?? DEFAULT_FILTERS }];
      const activeId = data.active_search_list_id ?? lists[0].id;
      setSearchLists(lists, activeId);

      const otherIds = normalizedData.member_ids.filter((id) => id !== firebaseUser?.uid);
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
  }, [coupleId]);

  // Keep backward-compat alias: first other member = "partner"
  const partnerProfile = memberProfiles[0] ?? null;

  return { couple, partnerProfile, memberProfiles };
}
