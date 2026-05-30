jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } },
  expoConfig: { extra: { eas: { projectId: 'test-project' } } },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { getDoc } from 'firebase/firestore';
import { scheduleNotificationAsync } from 'expo-notifications';
import {
  sendPushNotification,
  getPartnerToken,
  notifyPartnerOfSwipe,
  scheduleNewListingsNotification,
} from '@/lib/notifications';
import type { Listing } from '@/types';

const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockSchedule = scheduleNotificationAsync as jest.MockedFunction<typeof scheduleNotificationAsync>;

const mockListing: Listing = {
  id: 'listing-1',
  title: '3 pièces — 65m² — 11ème',
  price: 1800,
  charges: 144,
  surface: 65,
  rooms: 3,
  floor: 2,
  address: '10 Rue de la Paix, Paris 11ème',
  arrondissement: 11,
  images: [],
  description: 'Bel appartement',
  url: 'https://seloger.com',
  source: 'mock',
  has_elevator: true,
  has_parking: false,
  has_balcony: true,
  has_terrace: false,
  available_from: '2024-01-01T00:00:00Z',
  deposit: 3600,
  lat: 48.86,
  lng: 2.37,
};

beforeEach(() => {
  mockGetDoc.mockReset();
  mockSchedule.mockClear();
});

describe('sendPushNotification', () => {
  it('POSTs to the Expo push API with the correct payload', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch as unknown as typeof fetch;

    await sendPushNotification('ExponentPushToken[xxx]', 'Title', 'Body', { type: 'test' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: 'ExponentPushToken[xxx]',
      sound: 'default',
      title: 'Title',
      body: 'Body',
      data: { type: 'test' },
    });
  });

  it('sends without optional data field', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch as unknown as typeof fetch;

    await sendPushNotification('ExponentPushToken[yyy]', 'T', 'B');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe('ExponentPushToken[yyy]');
    expect(body.data).toBeUndefined();
  });
});

describe('getPartnerToken', () => {
  it('returns the partner push_token when caller is user1', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ user1_id: 'me', user2_id: 'partner' }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: 'ExponentPushToken[partner]' }) } as any);

    expect(await getPartnerToken('couple-1', 'me')).toBe('ExponentPushToken[partner]');
  });

  it('returns the partner push_token when caller is user2', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ user1_id: 'partner', user2_id: 'me' }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: 'ExponentPushToken[partner]' }) } as any);

    expect(await getPartnerToken('couple-1', 'me')).toBe('ExponentPushToken[partner]');
  });

  it('returns null when the couple doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false } as any);
    expect(await getPartnerToken('couple-1', 'me')).toBeNull();
  });

  it('returns null when user2 has not yet joined (null user2_id)', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ user1_id: 'me', user2_id: null }) } as any);
    expect(await getPartnerToken('couple-1', 'me')).toBeNull();
  });

  it('returns null when partner has no push_token', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ user1_id: 'me', user2_id: 'partner' }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: null }) } as any);

    expect(await getPartnerToken('couple-1', 'me')).toBeNull();
  });

  it('returns null when the partner user doc does not exist', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ user1_id: 'me', user2_id: 'partner' }) } as any)
      .mockResolvedValueOnce({ exists: () => false } as any);

    expect(await getPartnerToken('couple-1', 'me')).toBeNull();
  });
});

describe('notifyPartnerOfSwipe', () => {
  it("sends a notification with the caller's display name and listing title", async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ user1_id: 'me', user2_id: 'partner' }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: 'ExponentPushToken[partner]' }) } as any);

    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch as unknown as typeof fetch;

    await notifyPartnerOfSwipe(mockListing, 'Alice', 'couple-1', 'me');

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.title).toBe('Alice a liké un appart !');
    expect(body.body).toBe(mockListing.title);
    expect(body.data).toMatchObject({ type: 'partner_swipe', listingId: mockListing.id });
  });

  it('does nothing when the partner has no push token', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false } as any);
    const mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;

    await notifyPartnerOfSwipe(mockListing, 'Alice', 'couple-1', 'me');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('scheduleNewListingsNotification', () => {
  it('uses singular form for count = 1', async () => {
    await scheduleNewListingsNotification(1);
    const [{ content }] = mockSchedule.mock.calls[0] as [{ content: { title: string } }][];
    expect(content.title).toBe('1 nouvelle annonce disponible');
  });

  it('uses plural form for count > 1', async () => {
    await scheduleNewListingsNotification(5);
    const [{ content }] = mockSchedule.mock.calls[0] as [{ content: { title: string } }][];
    expect(content.title).toBe('5 nouvelles annonces disponibles');
  });

  it('triggers immediately (trigger: null)', async () => {
    await scheduleNewListingsNotification(2);
    const [arg] = mockSchedule.mock.calls[0] as [{ trigger: null }][];
    expect(arg.trigger).toBeNull();
  });
});
