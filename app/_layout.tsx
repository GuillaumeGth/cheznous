import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import { registerPushToken } from '@/lib/notifications';
import { DEFAULT_NOTIFICATION_PREFS } from '@/types';

export default function RootLayout() {
  // No store subscription: RootLayout renders a static tree. Setters are read
  // via getState() inside the listener so this component never re-renders on
  // auth state changes.
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    const { setFirebaseUser, setProfile, setGroupId, setLoading } = useAuthStore.getState();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const profile = snap.data() as any;
          // Backfill notification_prefs for existing users
          if (!profile.notification_prefs) {
            profile.notification_prefs = DEFAULT_NOTIFICATION_PREFS;
          }
          if (profile.push_token === undefined) {
            profile.push_token = null;
          }
          setProfile(profile);
          setGroupId(profile.couple_id ?? null);
          // Register push token silently — fails gracefully on simulator
          registerPushToken(user.uid).catch(() => {});
        }
      } else {
        setProfile(null);
        setGroupId(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
