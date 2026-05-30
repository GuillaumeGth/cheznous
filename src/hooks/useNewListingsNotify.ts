import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { scheduleNewListingsNotification } from '@/lib/notifications';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';

const LAST_CHECK_KEY = 'lastListingCheck';

export function useNewListingsNotify() {
  const { profile } = useAuthStore();
  const { filters } = useFilterStore();
  const lastCheckRef = useRef<Date>(new Date());

  const checkForNewListings = async () => {
    if (!profile?.notification_prefs?.notify_on_new_listings) return;

    const since = lastCheckRef.current;
    lastCheckRef.current = new Date();

    try {
      // Count listings added since last check that match current filters
      let q = query(
        collection(db, 'listings'),
        where('fetched_at', '>=', since.toISOString()),
      );

      const snap = await getDocs(q);
      const matching = snap.docs.filter((d) => {
        const data = d.data();
        const { arrondissements, price_max, surface_min, rooms_min } = filters;
        if (arrondissements.length > 0 && !arrondissements.includes(data.arrondissement)) return false;
        if (data.price > price_max) return false;
        if (data.surface < surface_min) return false;
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

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkForNewListings();
      }
    });
    return () => sub.remove();
  }, [profile?.notification_prefs?.notify_on_new_listings, filters]);
}
