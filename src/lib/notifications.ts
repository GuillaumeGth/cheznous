import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types';
import { logError } from '@/lib/errorReporting';

type ExpoNotifications = typeof import('expo-notifications');

// Lazy-require expo-notifications instead of a top-level import. Rationale:
// expo-notifications evaluates native code at module-load time and THROWS if the
// push stack isn't set up (the "removed from Expo Go" / missing-FCM guard). A
// top-level import makes that throw a startup crash that nothing can catch.
// Loading it lazily means a load failure degrades to "notifications off" instead
// of killing the app — but we LOG the failure so it's never hidden. require()
// (not dynamic import) keeps this lazy AND lets Jest's module mocks intercept it.
let notifModuleLoadFailed = false;
function getNotifications(): ExpoNotifications | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as ExpoNotifications;
  } catch (e) {
    // Log once, silently — this is an expected, handled condition (e.g. running
    // in Expo Go, or the native module unavailable). Persisted to Firestore for
    // visibility, but not surfaced as a dev LogBox red screen.
    if (!notifModuleLoadFailed) {
      notifModuleLoadFailed = true;
      logError(e, 'expo-notifications unavailable in this runtime', { silent: true });
    }
    return null;
  }
}

export async function setupNotificationHandler(): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    logError(e, 'setupNotificationHandler');
  }
}

export async function registerPushToken(userId: string): Promise<string | null> {
  const N = getNotifications();
  if (!N) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as { isDevice?: boolean; default?: { isDevice?: boolean } };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ConstantsMod = require('expo-constants') as {
      default?: { expoConfig?: any; easConfig?: any };
      expoConfig?: any;
      easConfig?: any;
    };
    const Constants = ConstantsMod.default ?? ConstantsMod;
    // expo-device exposes `isDevice` as a named export (with a default fallback)
    const isPhysicalDevice = Device.isDevice ?? Device.default?.isDevice ?? false;
    if (!isPhysicalDevice) return null;

    const { status: existing } = await N.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Chez Nous',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    let token: string;
    if (projectId) {
      // Expo push token — relayed to FCM via Expo's push service
      const tokenData = await N.getExpoPushTokenAsync({ projectId });
      token = tokenData.data;
    } else {
      // No EAS project configured — fall back to the raw FCM device token
      const tokenData = await N.getDevicePushTokenAsync();
      token = tokenData.data as string;
    }
    await updateDoc(doc(db, 'users', userId), { push_token: token });
    return token;
  } catch (e) {
    logError(e, 'registerPushToken');
    return null;
  }
}

export async function getMemberTokens(groupId: string, myUserId: string): Promise<string[]> {
  try {
    const groupSnap = await getDoc(doc(db, 'groups', groupId));
    if (!groupSnap.exists()) return [];
    const data = groupSnap.data();
    const memberIds: string[] = data.member_ids?.length
      ? data.member_ids
      : [data.user1_id, ...(data.user2_id ? [data.user2_id] : [])];
    const otherIds = memberIds.filter((id) => id !== myUserId);
    const tokens = await Promise.all(
      otherIds.map(async (id) => {
        const snap = await getDoc(doc(db, 'users', id));
        if (!snap.exists()) return null;
        return (snap.data().push_token as string | null) ?? null;
      }),
    );
    return tokens.filter(Boolean) as string[];
  } catch {
    return [];
  }
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: expoPushToken, sound: 'default', title, body, data }),
    });
  } catch (e) {
    console.warn('[Notifications] sendPushNotification failed:', e);
  }
}

export async function notifyColocsOfSwipe(
  listing: Listing,
  myDisplayName: string,
  groupId: string,
  myUserId: string,
): Promise<void> {
  const tokens = await getMemberTokens(groupId, myUserId);
  await Promise.all(
    tokens.map((token) =>
      sendPushNotification(
        token,
        `${myDisplayName} a liké un appart !`,
        listing.title,
        { type: 'partner_swipe', listingId: listing.id },
      ),
    ),
  );
}

export async function notifyGroupInvitation(inviteeId: string, inviterName: string): Promise<void> {
  try {
    const inviteeSnap = await getDoc(doc(db, 'users', inviteeId));
    if (!inviteeSnap.exists()) return;
    const token: string | null = inviteeSnap.data().push_token ?? null;
    if (!token) return;
    await sendPushNotification(
      token,
      'Invitation à rejoindre un groupe',
      `${inviterName} t'invite à chercher un appart ensemble`,
      { type: 'group_invitation' },
    );
  } catch (e) {
    logError(e, 'notifyGroupInvitation');
  }
}

export async function scheduleNewListingsNotification(count: number): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await N.scheduleNotificationAsync({
      content: {
        title: `${count} nouvelle${count > 1 ? 's' : ''} annonce${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}`,
        body: 'De nouveaux appartements correspondent à vos critères',
        data: { type: 'new_listings' },
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[Notifications] scheduleNewListingsNotification failed:', e);
  }
}
