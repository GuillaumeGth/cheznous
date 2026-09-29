import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { scheduleNewListingsNotification } from '@/lib/notifications';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { matchesFilters } from '@/services/listings/matchesFilters';
import { FeedItem } from '@/types';

const LAST_CHECK_KEY = 'lastListingCheck';

export function useNewListingsNotify() {
  const lastCheckRef = useRef<Date>(new Date());

  // Subscribe to AppState exactly once. The callback reads the latest profile
  // and filters via getState() — no re-subscription when they change, so the
  // listener stays perfectly stable across the screen's lifetime.
  useEffect(() => {
    const checkForNewListings = async () => {
      const { profile, groupId } = useAuthStore.getState();
      if (!profile?.notification_prefs?.notify_on_new_listings) return;

      const { filters, activeListId } = useFilterStore.getState();
      if (!groupId || !activeListId) return;
      const since = lastCheckRef.current;
      lastCheckRef.current = new Date();

      try {
        // Listings the server sync added to the active search list's feed
        // since the last check, refined by the list's filters.
        const q = query(
          collection(db, 'groups', groupId, 'feeds', activeListId, 'items'),
          where('added_at', '>=', since.toISOString()),
        );

        const snap = await getDocs(q);
        const matching = snap.docs.filter((d) => {
          const item = d.data() as FeedItem;
          return item.active !== false && matchesFilters(item, filters);
        });

        if (matching.length > 0) {
          await scheduleNewListingsNotification(matching.length);
        }
      } catch (e) {
        // Silently fail — notification is a best-effort feature
      }
    };

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkForNewListings();
      }
    });
    return () => sub.remove();
  }, []);
}
