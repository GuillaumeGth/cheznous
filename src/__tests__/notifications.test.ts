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
  getMemberTokens,
  notifyColocsOfSwipe,
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

describe('getMemberTokens', () => {
  it('returns tokens of all other members (2-member group, caller is member_ids[0])', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ member_ids: ['me', 'coloc1'] }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: 'ExponentPushToken[coloc1]' }) } as any);

    expect(await getMemberTokens('group-1', 'me')).toEqual(['ExponentPushToken[coloc1]']);
  });

  it('returns tokens of all other members (3-member group)', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ member_ids: ['me', 'coloc1', 'coloc2'] }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: 'ExponentPushToken[coloc1]' }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: 'ExponentPushToken[coloc2]' }) } as any);

    expect(await getMemberTokens('group-1', 'me')).toEqual([
      'ExponentPushToken[coloc1]',
      'ExponentPushToken[coloc2]',
    ]);
  });

  it('falls back to user1_id/user2_id when member_ids is absent', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ user1_id: 'me', user2_id: 'coloc1' }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: 'ExponentPushToken[coloc1]' }) } as any);

    expect(await getMemberTokens('group-1', 'me')).toEqual(['ExponentPushToken[coloc1]']);
  });

  it('returns [] when the group doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false } as any);
    expect(await getMemberTokens('group-1', 'me')).toEqual([]);
  });

  it('returns [] when caller is the only member', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ member_ids: ['me'] }) } as any);
    expect(await getMemberTokens('group-1', 'me')).toEqual([]);
  });

  it('filters out members with no push_token', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ member_ids: ['me', 'coloc1'] }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: null }) } as any);

    expect(await getMemberTokens('group-1', 'me')).toEqual([]);
  });
});

describe('notifyColocsOfSwipe', () => {
  it("sends a notification to each coloc with the caller's name and listing title", async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ member_ids: ['me', 'coloc1', 'coloc2'] }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: 'ExponentPushToken[coloc1]' }) } as any)
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ push_token: 'ExponentPushToken[coloc2]' }) } as any);

    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch as unknown as typeof fetch;

    await notifyColocsOfSwipe(mockListing, 'Alice', 'group-1', 'me');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const body0 = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body0.title).toBe('Alice a liké un appart !');
    expect(body0.body).toBe(mockListing.title);
    expect(body0.data).toMatchObject({ type: 'partner_swipe', listingId: mockListing.id });
  });

  it('does nothing when no coloc has a push token', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false } as any);
    const mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;

    await notifyColocsOfSwipe(mockListing, 'Alice', 'group-1', 'me');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('scheduleNewListingsNotification', () => {
  it('uses singular form for count = 1', async () => {
    await scheduleNewListingsNotification(1);
    const [{ content }] = mockSchedule.mock.calls[0] as [{ content: { title: string } }];
    expect(content.title).toBe('1 nouvelle annonce disponible');
  });

  it('uses plural form for count > 1', async () => {
    await scheduleNewListingsNotification(5);
    const [{ content }] = mockSchedule.mock.calls[0] as [{ content: { title: string } }];
    expect(content.title).toBe('5 nouvelles annonces disponibles');
  });

  it('triggers immediately (trigger: null)', async () => {
    await scheduleNewListingsNotification(2);
    const [arg] = mockSchedule.mock.calls[0] as [{ trigger: null }];
    expect(arg.trigger).toBeNull();
  });
});
