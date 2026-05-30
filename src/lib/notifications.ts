import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Listing } from '@/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Chez Nous',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenData.data;

  await updateDoc(doc(db, 'users', userId), { push_token: token });
  return token;
}

export async function getPartnerToken(
  coupleId: string,
  myUserId: string,
): Promise<string | null> {
  const coupleSnap = await getDoc(doc(db, 'couples', coupleId));
  if (!coupleSnap.exists()) return null;

  const { user1_id, user2_id } = coupleSnap.data();
  const partnerId = user1_id === myUserId ? user2_id : user1_id;
  if (!partnerId) return null;

  const partnerSnap = await getDoc(doc(db, 'users', partnerId));
  if (!partnerSnap.exists()) return null;

  return partnerSnap.data().push_token ?? null;
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: expoPushToken, sound: 'default', title, body, data }),
  });
}

export async function notifyPartnerOfSwipe(
  listing: Listing,
  myDisplayName: string,
  coupleId: string,
  myUserId: string,
): Promise<void> {
  const partnerToken = await getPartnerToken(coupleId, myUserId);
  if (!partnerToken) return;

  await sendPushNotification(
    partnerToken,
    `${myDisplayName} a liké un appart !`,
    listing.title,
    { type: 'partner_swipe', listingId: listing.id },
  );
}

export async function notifyGroupInvitation(
  inviteeId: string,
  inviterName: string,
): Promise<void> {
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
}

export async function scheduleNewListingsNotification(count: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${count} nouvelle${count > 1 ? 's' : ''} annonce${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}`,
      body: 'De nouveaux appartements correspondent à vos critères',
      data: { type: 'new_listings' },
    },
    trigger: null,
  });
}
