import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types';

// Lazy-load expo-notifications so a missing FCM setup never crashes at import time
async function getNotifications() {
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function setupNotificationHandler(): Promise<void> {
  const N = await getNotifications();
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
    console.warn('[Notifications] setNotificationHandler failed:', e);
  }
}

export async function registerPushToken(userId: string): Promise<string | null> {
  const N = await getNotifications();
  if (!N) return null;
  try {
    const Device = await import('expo-device');
    const { default: Constants } = await import('expo-constants');
    if (!Device.default.isDevice) return null;

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

    const tokenData = await N.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData.data;
    await updateDoc(doc(db, 'users', userId), { push_token: token });
    return token;
  } catch (e) {
    console.warn('[Notifications] registerPushToken failed:', e);
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
    console.warn('[Notifications] notifyGroupInvitation failed:', e);
  }
}

export async function scheduleNewListingsNotification(count: number): Promise<void> {
  const N = await getNotifications();
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
