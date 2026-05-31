/**
 * Unit tests for useGroupChat hook.
 * Uses react-test-renderer (bundled with React) to avoid needing
 * @testing-library/react-native as an extra devDependency.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useGroupChat } from '../useGroupChat';

// ─── Mocks ────────────────────────────────────────────────────────────────────

let snapshotCallback: ((snap: { docs: unknown[] }) => void) | null = null;
const mockUnsubscribe = jest.fn();
const mockOnSnapshot = jest.fn().mockImplementation((_query: unknown, cb: (s: { docs: unknown[] }) => void) => {
  snapshotCallback = cb;
  return mockUnsubscribe;
});

jest.mock('firebase/firestore', () => ({
  collection: jest.fn().mockReturnValue('col'),
  query: jest.fn().mockReturnValue('q'),
  orderBy: jest.fn().mockReturnValue('order'),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  doc: jest.fn(),
  deleteField: jest.fn(),
  getDocs: jest.fn(),
  where: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({ db: 'mock-db' }));

const mockGetState = jest.fn().mockReturnValue({
  firebaseUser: { uid: 'user-1' },
  profile: { display_name: 'Alice' },
  groupId: 'group-1',
});
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => mockGetState() },
}));

const mockSendGroupMessage = jest.fn().mockResolvedValue(undefined);
const mockSetReaction = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/groupChatService', () => ({
  sendGroupMessage: (...args: unknown[]) => mockSendGroupMessage(...args),
  setReaction: (...args: unknown[]) => mockSetReaction(...args),
}));

// ─── renderHook helper ────────────────────────────────────────────────────────

function renderHook<T>(useFn: () => T, initialProps?: Record<string, unknown>) {
  const result: { current: T } = { current: undefined as unknown as T };
  let currentUseFn = useFn;

  function Wrapper() {
    result.current = currentUseFn();
    return null;
  }

  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Wrapper));
  });

  return {
    result,
    rerender: (newUseFn: () => T) => {
      currentUseFn = newUseFn;
      act(() => { renderer.update(React.createElement(Wrapper)); });
    },
    unmount: () => { act(() => { renderer.unmount(); }); },
  };
}

function makeDoc(id: string, data: object) {
  return { id, data: () => data };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  snapshotCallback = null;
  mockGetState.mockReturnValue({
    firebaseUser: { uid: 'user-1' },
    profile: { display_name: 'Alice' },
    groupId: 'group-1',
  });
});

describe('useGroupChat', () => {
  it('starts with isLoading=true and empty messages', () => {
    const { result } = renderHook(() => useGroupChat('group-1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.messages).toEqual([]);
  });

  it('sets isLoading=false and populates messages on first snapshot', () => {
    const { result } = renderHook(() => useGroupChat('group-1'));
    act(() => {
      snapshotCallback?.({
        docs: [makeDoc('msg-1', {
          type: 'text', text: 'Hello', user_id: 'user-1',
          display_name: 'Alice', created_at: '2025-01-01T10:00:00.000Z',
        })],
      });
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe('msg-1');
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useGroupChat('group-1'));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when groupId is null', () => {
    renderHook(() => useGroupChat(null));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('re-subscribes and cleans up when groupId changes', () => {
    const { rerender } = renderHook(() => useGroupChat('group-1'));
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

    rerender(() => useGroupChat('group-2'));
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('sendMessage delegates to sendGroupMessage service', async () => {
    const { result } = renderHook(() => useGroupChat('group-1'));
    await act(async () => { await result.current.sendMessage('Salut !'); });
    expect(mockSendGroupMessage).toHaveBeenCalledWith('group-1', 'Salut !');
  });

  it('sendMessage ignores blank text', async () => {
    const { result } = renderHook(() => useGroupChat('group-1'));
    await act(async () => { await result.current.sendMessage('   '); });
    expect(mockSendGroupMessage).not.toHaveBeenCalled();
  });

  it('reactToMessage passes uid and reaction to service', async () => {
    const { result } = renderHook(() => useGroupChat('group-1'));
    await act(async () => { await result.current.reactToMessage('msg-1', 'like'); });
    expect(mockSetReaction).toHaveBeenCalledWith('group-1', 'msg-1', 'user-1', 'like');
  });

  it('reactToMessage passes null for toggle-off', async () => {
    const { result } = renderHook(() => useGroupChat('group-1'));
    await act(async () => { await result.current.reactToMessage('msg-1', null); });
    expect(mockSetReaction).toHaveBeenCalledWith('group-1', 'msg-1', 'user-1', null);
  });

  it('reactToMessage does nothing when not authenticated', async () => {
    mockGetState.mockReturnValue({ firebaseUser: null, groupId: 'group-1' });
    const { result } = renderHook(() => useGroupChat('group-1'));
    await act(async () => { await result.current.reactToMessage('msg-1', 'like'); });
    expect(mockSetReaction).not.toHaveBeenCalled();
  });
});
