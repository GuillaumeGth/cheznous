import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Group, UserProfile } from '@/types';
import { useAuthStore } from '@/stores/authStore';

/**
 * Souscrit à un groupe précis par son id et résout les profils des autres
 * membres (hors soi-même). Dep primitive `[groupId]`.
 */
export function useGroupById(groupId: string | null) {
  const [group, setGroup] = useState<Group | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setMemberProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsub = onSnapshot(doc(db, 'groups', groupId), async (snap) => {
      if (!snap.exists()) {
        setGroup(null);
        setMemberProfiles([]);
        setLoading(false);
        return;
      }
      const groupData = { id: snap.id, ...snap.data() } as Group;
      setGroup(groupData);

      const { firebaseUser } = useAuthStore.getState();
      const others = (groupData.member_ids ?? []).filter((id) => id !== firebaseUser?.uid);
      const profiles = await Promise.all(
        others.map(async (id) => {
          const s = await getDoc(doc(db, 'users', id));
          return s.exists() ? ({ id: s.id, ...s.data() } as UserProfile) : null;
        }),
      );
      setMemberProfiles(profiles.filter(Boolean) as UserProfile[]);
      setLoading(false);
    });

    return unsub;
  }, [groupId]);

  return { group, memberProfiles, loading };
}
