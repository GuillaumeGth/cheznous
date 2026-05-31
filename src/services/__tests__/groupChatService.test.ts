/**
 * Unit tests for groupChatService.
 * All Firestore and notification dependencies are mocked so tests run without
 * a real Firebase project and complete in milliseconds.
 */
import {
  sendGroupMessage,
  sendSystemMessage,
  setReaction,
  shareListingToChat,
} from '../groupChatService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAddDoc = jest.fn().mockResolvedValue({ id: 'msg-1' });
const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDocs = jest.fn().mockResolvedValue({ docs: [] });
const mockDeleteField = jest.fn().mockReturnValue('__DELETE__');
const mockDoc = jest.fn().mockReturnValue('doc-ref');
const mockCollection = jest.fn().mockReturnValue('col-ref');
const mockQuery = jest.fn().mockReturnValue('query-ref');
const mockWhere = jest.fn().mockReturnValue('where-ref');

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  deleteField: () => mockDeleteField(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({ db: 'mock-db' }));

const mockGetState = jest.fn();
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => mockGetState() },
}));

const mockGetMemberTokens = jest.fn().mockResolvedValue([]);
const mockSendPushNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/notifications', () => ({
  getMemberTokens: (...args: unknown[]) => mockGetMemberTokens(...args),
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}));

// ─── Test data ────────────────────────────────────────────────────────────────

const AUTH_STATE = {
  firebaseUser: { uid: 'user-1' },
  profile: { display_name: 'Alice' },
  groupId: 'group-1',
};

const LISTING = {
  id: 'listing-1',
  title: 'Studio Marais',
  price: 1200,
  charges: 50,
  surface: 30,
  rooms: 1,
  floor: 2,
  address: '1 rue de Bretagne',
  arrondissement: 3,
  images: ['https://img.test/1.jpg'],
  description: 'Beau studio',
  url: 'https://example.com',
  source: 'test',
  has_elevator: false,
  has_parking: false,
  has_balcony: false,
  has_terrace: false,
  available_from: '2025-01-01',
  deposit: 1200,
  lat: 48.8,
  lng: 2.3,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetState.mockReturnValue(AUTH_STATE);
  mockGetDocs.mockResolvedValue({ docs: [] });
});

describe('sendGroupMessage', () => {
  it('writes a text message with correct fields', async () => {
    await sendGroupMessage('group-1', 'Hello!');

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.type).toBe('text');
    expect(payload.text).toBe('Hello!');
    expect(payload.user_id).toBe('user-1');
    expect(payload.display_name).toBe('Alice');
    expect(typeof payload.created_at).toBe('string');
  });

  it('does nothing when no authenticated user', async () => {
    mockGetState.mockReturnValue({ ...AUTH_STATE, firebaseUser: null });
    await sendGroupMessage('group-1', 'Hello!');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('sends push notifications to other members', async () => {
    mockGetMemberTokens.mockResolvedValue(['token-a', 'token-b']);
    await sendGroupMessage('group-1', 'Hello!');
    await Promise.resolve(); // flush the .then()
    expect(mockGetMemberTokens).toHaveBeenCalledWith('group-1', 'user-1');
  });
});

describe('sendSystemMessage', () => {
  it('writes a system message with null user fields', async () => {
    await sendSystemMessage('group-1', '🎉 Match !');

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.type).toBe('system');
    expect(payload.user_id).toBeNull();
    expect(payload.display_name).toBeNull();
    expect(payload.text).toBe('🎉 Match !');
  });
});

describe('setReaction', () => {
  it('writes a like reaction via setDoc+merge', async () => {
    await setReaction('group-1', 'msg-1', 'user-1', 'like');

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload, options] = mockSetDoc.mock.calls[0];
    expect(payload.reactions['user-1']).toBe('like');
    expect(options).toEqual({ merge: true });
  });

  it('writes a dislike reaction', async () => {
    await setReaction('group-1', 'msg-1', 'user-1', 'dislike');
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.reactions['user-1']).toBe('dislike');
  });

  it('uses deleteField() when reaction is null (toggle-off)', async () => {
    await setReaction('group-1', 'msg-1', 'user-1', null);
    const [, payload] = mockSetDoc.mock.calls[0];
    // deleteField() is a sentinel value — verify the mock was called
    expect(mockDeleteField).toHaveBeenCalled();
    expect(payload.reactions['user-1']).toBe('__DELETE__');
  });
});

describe('shareListingToChat', () => {
  it('does nothing when no groupId', async () => {
    mockGetState.mockReturnValue({ ...AUTH_STATE, groupId: null });
    await shareListingToChat(LISTING);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('does nothing when not authenticated', async () => {
    mockGetState.mockReturnValue({ ...AUTH_STATE, firebaseUser: null });
    await shareListingToChat(LISTING);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('writes a listing_share message', async () => {
    await shareListingToChat(LISTING);

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.type).toBe('listing_share');
    expect(payload.listing).toBe(LISTING);
    expect(typeof payload.reactions).toBe('object');
  });

  it('pre-populates reactions from existing swipes (right → like)', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ user_id: 'user-2', direction: 'right' }) },
        { data: () => ({ user_id: 'user-3', direction: 'left' }) },
      ],
    });

    await shareListingToChat(LISTING);

    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.reactions['user-2']).toBe('like');
    expect(payload.reactions['user-3']).toBe('dislike');
  });

  it('right swipe wins over left when same member has both', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ user_id: 'user-2', direction: 'left' }) },
        { data: () => ({ user_id: 'user-2', direction: 'right' }) },
      ],
    });

    await shareListingToChat(LISTING);

    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.reactions['user-2']).toBe('like');
  });

  it('degrades gracefully when swipe query throws (missing index)', async () => {
    mockGetDocs.mockRejectedValue(new Error('index not found'));
    await expect(shareListingToChat(LISTING)).resolves.not.toThrow();
    expect(mockAddDoc).toHaveBeenCalled();
  });
});
