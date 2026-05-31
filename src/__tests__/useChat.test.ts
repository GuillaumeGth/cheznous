import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// ---- Module mocks (hoisted before imports) ----------------------------------

jest.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));

const mockUnsub = jest.fn();
let capturedOnNext: ((snap: any) => void) | null = null;
let capturedOnError: ((err: any) => void) | null = null;

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'col-ref'),
  query: jest.fn((col: any) => col),
  orderBy: jest.fn(() => 'order-asc'),
  onSnapshot: jest.fn((
    _q: any,
    onNext: (snap: any) => void,
    onError: (e: any) => void,
  ) => {
    capturedOnNext = onNext;
    capturedOnError = onError;
    return mockUnsub;
  }),
  addDoc: jest.fn(() => Promise.resolve({ id: 'new-msg' })),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(() => 'storage-ref'),
  uploadBytes: jest.fn(() => Promise.resolve()),
  getDownloadURL: jest.fn(() => Promise.resolve('https://storage.example.com/file.jpg')),
}));

jest.mock('@/lib/notifications', () => ({
  getMemberTokens: jest.fn(() => Promise.resolve(['token-b'])),
  sendPushNotification: jest.fn(() => Promise.resolve()),
}));

// ---- Imports ----------------------------------------------------------------

import { addDoc, collection } from 'firebase/firestore';
import { uploadBytes, getDownloadURL } from 'firebase/storage';
import { getMemberTokens, sendPushNotification } from '@/lib/notifications';
import { useChat, ATTACHMENT_LIMITS } from '@/hooks/useChat';
import { useAuthStore } from '@/stores/authStore';
import type { ChatMessage } from '@/types';

// ---- Helpers ----------------------------------------------------------------

const mounted: TestRenderer.ReactTestRenderer[] = [];

function renderHook<T>(useHook: () => T) {
  const result = { current: undefined as unknown as T };
  function Harness() {
    result.current = useHook();
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Harness));
  });
  mounted.push(renderer);
  return {
    result,
    unmount: () => {
      act(() => renderer.unmount());
      mounted.splice(mounted.indexOf(renderer), 1);
    },
  };
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function fireSnapshot(docs: Array<{ id: string; data: () => Omit<ChatMessage, 'id'> }>) {
  act(() => {
    capturedOnNext!({ docs: docs.map((d) => ({ id: d.id, data: d.data })) });
  });
}

const BASE_MSG: Omit<ChatMessage, 'id'> = {
  user_id: 'user-a',
  display_name: 'Alice',
  text: 'Bonjour !',
  created_at: '2024-06-01T10:00:00.000Z',
};

const MOCK_USER = {
  firebaseUser: { uid: 'user-a' } as any,
  profile: {
    id: 'user-a',
    display_name: 'Alice',
    email: 'alice@test.com',
    couple_id: 'group-1',
    push_token: null,
    photo_url: null,
    notification_prefs: { notify_on_partner_swipe: false, notify_on_new_listings: false },
    created_at: '2024-01-01T00:00:00.000Z',
  },
  groupId: 'group-1',
  isLoading: false,
};

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnNext = null;
  capturedOnError = null;
  useAuthStore.setState(MOCK_USER);
  // Reset fetch mock
  global.fetch = jest.fn(() =>
    Promise.resolve({ blob: () => Promise.resolve(new Blob(['data'])) } as Response),
  );
});

afterEach(() => {
  while (mounted.length) {
    const r = mounted.pop()!;
    act(() => r.unmount());
  }
});

// ---- Subscription tests -----------------------------------------------------

describe('useChat — subscription', () => {
  it('starts with isLoading=true and empty messages', () => {
    const { result } = renderHook(() => useChat('match-1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.messages).toHaveLength(0);
  });

  it('populates messages and clears isLoading when snapshot fires', () => {
    const { result } = renderHook(() => useChat('match-1'));
    fireSnapshot([{ id: 'msg-1', data: () => BASE_MSG }]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('Bonjour !');
    expect(result.current.messages[0].id).toBe('msg-1');
  });

  it('sets isLoading=false on snapshot error', () => {
    const { result } = renderHook(() => useChat('match-1'));
    act(() => { capturedOnError!(new Error('permission-denied')); });
    expect(result.current.isLoading).toBe(false);
  });

  it('replaces messages on each subsequent snapshot', () => {
    const { result } = renderHook(() => useChat('match-1'));
    fireSnapshot([{ id: 'msg-1', data: () => BASE_MSG }]);
    expect(result.current.messages).toHaveLength(1);
    fireSnapshot([
      { id: 'msg-1', data: () => BASE_MSG },
      { id: 'msg-2', data: () => ({ ...BASE_MSG, text: 'Réponse' }) },
    ]);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].text).toBe('Réponse');
  });

  it('subscribes to the correct Firestore subcollection', () => {
    renderHook(() => useChat('match-42'));
    expect(collection).toHaveBeenCalledWith({}, 'matches', 'match-42', 'messages');
  });

  it('unsubscribes from Firestore on unmount', () => {
    const { unmount } = renderHook(() => useChat('match-1'));
    unmount();
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });
});

// ---- sendMessage tests ------------------------------------------------------

describe('useChat — sendMessage', () => {
  it('calls addDoc with correct fields', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    await act(async () => { await result.current.sendMessage('Salut !'); });
    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = (addDoc as jest.MockedFunction<typeof addDoc>).mock.calls[0][1] as any;
    expect(payload).toMatchObject({
      user_id: 'user-a',
      display_name: 'Alice',
      text: 'Salut !',
    });
    expect(typeof payload.created_at).toBe('string');
  });

  it('trims whitespace before sending', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    await act(async () => { await result.current.sendMessage('  bonjour  '); });
    const payload = (addDoc as jest.MockedFunction<typeof addDoc>).mock.calls[0][1] as any;
    expect(payload.text).toBe('bonjour');
  });

  it('does not call addDoc when text is blank', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    await act(async () => { await result.current.sendMessage('   '); });
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('does not call addDoc when no user is logged in', async () => {
    useAuthStore.setState({ firebaseUser: null, profile: null, groupId: null, isLoading: false });
    const { result } = renderHook(() => useChat('match-1'));
    await act(async () => { await result.current.sendMessage('test'); });
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('sendMessage reference is stable across re-renders', () => {
    const { result } = renderHook(() => useChat('match-1'));
    const first = result.current.sendMessage;
    fireSnapshot([{ id: 'msg-1', data: () => BASE_MSG }]);
    expect(result.current.sendMessage).toBe(first);
  });

  it('notifies other group members after sending', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    await act(async () => { await result.current.sendMessage('Hello'); });
    await flush();
    expect(getMemberTokens).toHaveBeenCalledWith('group-1', 'user-a');
    expect(sendPushNotification).toHaveBeenCalledWith(
      'token-b',
      'Alice',
      'Hello',
      expect.objectContaining({ type: 'chat_message', matchId: 'match-1' }),
    );
  });

  it('truncates the notification preview at 60 chars', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    const longText = 'a'.repeat(80);
    await act(async () => { await result.current.sendMessage(longText); });
    await flush();
    const body = (sendPushNotification as jest.MockedFunction<typeof sendPushNotification>)
      .mock.calls[0][2];
    expect(body.length).toBeLessThanOrEqual(63); // 60 chars + '…'
    expect(body.endsWith('…')).toBe(true);
  });

  it('does not throw when getMemberTokens fails', async () => {
    (getMemberTokens as jest.MockedFunction<typeof getMemberTokens>)
      .mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useChat('match-1'));
    await expect(
      act(async () => { await result.current.sendMessage('test'); }),
    ).resolves.not.toThrow();
  });
});

// ---- sendAttachment tests ---------------------------------------------------

describe('useChat — sendAttachment', () => {
  const imageAttachment = {
    uri: 'file://photo.jpg',
    size: 1 * 1024 * 1024, // 1 MB
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    type: 'image' as const,
  };

  const fileAttachment = {
    uri: 'file://doc.pdf',
    size: 2 * 1024 * 1024, // 2 MB
    fileName: 'document.pdf',
    mimeType: 'application/pdf',
    type: 'file' as const,
  };

  it('returns "too_large" when image exceeds 5 MB', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    let res: string | undefined;
    await act(async () => {
      res = await result.current.sendAttachment({
        ...imageAttachment,
        size: ATTACHMENT_LIMITS.image + 1,
      });
    });
    expect(res).toBe('too_large');
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('returns "too_large" when file exceeds 10 MB', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    let res: string | undefined;
    await act(async () => {
      res = await result.current.sendAttachment({
        ...fileAttachment,
        size: ATTACHMENT_LIMITS.file + 1,
      });
    });
    expect(res).toBe('too_large');
  });

  it('uploads the file and creates a message doc on success', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    let res: string | undefined;
    await act(async () => {
      res = await result.current.sendAttachment(imageAttachment);
    });
    expect(res).toBe('ok');
    expect(uploadBytes).toHaveBeenCalledTimes(1);
    expect(getDownloadURL).toHaveBeenCalledTimes(1);
    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = (addDoc as jest.MockedFunction<typeof addDoc>).mock.calls[0][1] as any;
    expect(payload.attachment_type).toBe('image');
    expect(payload.attachment_url).toBe('https://storage.example.com/file.jpg');
    expect(payload.attachment_name).toBe('photo.jpg');
  });

  it('stores file name and type for non-image attachments', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    await act(async () => { await result.current.sendAttachment(fileAttachment); });
    const payload = (addDoc as jest.MockedFunction<typeof addDoc>).mock.calls[0][1] as any;
    expect(payload.attachment_type).toBe('file');
    expect(payload.attachment_name).toBe('document.pdf');
  });

  it('returns "error" when upload throws', async () => {
    (uploadBytes as jest.MockedFunction<typeof uploadBytes>)
      .mockRejectedValueOnce(new Error('quota-exceeded'));
    const { result } = renderHook(() => useChat('match-1'));
    let res: string | undefined;
    await act(async () => {
      res = await result.current.sendAttachment(imageAttachment);
    });
    expect(res).toBe('error');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('returns "error" when no user is logged in', async () => {
    useAuthStore.setState({ firebaseUser: null, profile: null, groupId: null, isLoading: false });
    const { result } = renderHook(() => useChat('match-1'));
    let res: string | undefined;
    await act(async () => {
      res = await result.current.sendAttachment(imageAttachment);
    });
    expect(res).toBe('error');
  });

  it('notifies other members after a successful attachment send', async () => {
    const { result } = renderHook(() => useChat('match-1'));
    await act(async () => { await result.current.sendAttachment(imageAttachment); });
    await flush();
    expect(getMemberTokens).toHaveBeenCalledWith('group-1', 'user-a');
    expect(sendPushNotification).toHaveBeenCalled();
  });
});
