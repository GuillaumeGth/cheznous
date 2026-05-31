import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { scheduleNewListingsNotification } from '@/lib/notifications';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';

const LAST_CHECK_KEY = 'lastListingCheck';

export function useNewListingsNotify() {
  const lastCheckRef = useRef<Date>(new Date());

  // Subscribe to AppState exactly once. The callback reads the latest profile
  // and filters via getState() — no re-subscription when they change, so the
  // listener stays perfectly stable across the screen's lifetime.
  useEffect(() => {
    const checkForNewListings = async () => {
      const { profile } = useAuthStore.getState();
      if (!profile?.notification_prefs?.notify_on_new_listings) return;

      const { filters } = useFilterStore.getState();
      const since = lastCheckRef.current;
      lastCheckRef.current = new Date();

      try {
        // Count listings added since last check that match current filters
        const q = query(
          collection(db, 'listings'),
          where('fetched_at', '>=', since.toISOString()),
        );

        const snap = await getDocs(q);
        const matching = snap.docs.filter((d) => {
          const data = d.data();
          const { arrondissements, price_min, price_max, surface_min, surface_max, rooms_min } = filters;
          if (arrondissements.length > 0 && !arrondissements.includes(data.arrondissement)) return false;
          if (price_min > 0 && data.price < price_min) return false;
          if (price_max > 0 && data.price > price_max) return false;
          if (surface_min > 0 && data.surface < surface_min) return false;
          if (surface_max > 0 && data.surface > surface_max) return false;
          if (rooms_min > 0 && data.rooms < rooms_min) return false;
          return true;
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
