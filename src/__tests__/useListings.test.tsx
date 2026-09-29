import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { Listing } from '@/types';
import type { ListingsDataSource, ListingsPage } from '@/services/listings';

// --- Module mocks -----------------------------------------------------------
// A controllable data source: every test scripts the pages it returns, so we
// can count exactly how many times the source is hit.
const mockFetchPage = jest.fn<Promise<ListingsPage>, [unknown, unknown]>();
const mockSource: { current: ListingsDataSource } = {
  current: { id: 'test', kind: 'feed', fetchPage: (q, c) => mockFetchPage(q, c) },
};
const mockSwipedIds = jest.fn<Promise<Set<string>>, [string, string]>();

jest.mock('@/services/listings', () => ({
  getListingsDataSource: () => mockSource.current,
  fetchSwipedListingIds: (uid: string, listId: string) => mockSwipedIds(uid, listId),
}));

jest.mock('@/lib/firebase', () => ({ db: {} }));
const mockSetDoc = jest.fn(() => Promise.resolve());
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  setDoc: (...args: unknown[]) => mockSetDoc(...(args as [])),
}));

const FILTERS = {
  price_min: 0,
  price_max: 3000,
  surface_min: 0,
  surface_max: 0,
  rooms_min: 0,
};
const mockFilterState = { filters: FILTERS, activeListId: 'l1' };
jest.mock('@/stores/filterStore', () => {
  const useFilterStore = (sel: (s: typeof mockFilterState) => unknown) => sel(mockFilterState);
  useFilterStore.getState = () => mockFilterState;
  return { useFilterStore };
});
const mockAuthState = { groupId: 'g1', firebaseUser: { uid: 'u1' } };
jest.mock('@/stores/authStore', () => {
  const useAuthStore = (sel: (s: typeof mockAuthState) => unknown) => sel(mockAuthState);
  useAuthStore.getState = () => mockAuthState;
  return { useAuthStore };
});

import { useListings } from '@/hooks/useListings';
import { useListingsStore } from '@/stores/listingsStore';

// --- Tiny renderHook on top of react-test-renderer --------------------------
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

let seq = 0;
const makeListings = (n: number): Listing[] =>
  Array.from({ length: n }, () => ({ id: `listing-${seq++}` } as unknown as Listing));

const page = (listings: Listing[], more = true): ListingsPage => ({
  listings,
  nextCursor: more ? { n: seq } : null,
});

afterEach(() => {
  while (mounted.length) {
    const r = mounted.pop()!;
    act(() => r.unmount());
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSource.current = { id: 'test', kind: 'feed', fetchPage: (q, c) => mockFetchPage(q, c) };
  mockSwipedIds.mockResolvedValue(new Set());
  act(() => {
    useListingsStore.setState({
      stack: [], isLoading: false, cursor: null, hasMore: true, error: null, lastRefresh: null, swipedIds: null,
    });
  });
});

describe('useListings — source calls are kept under control', () => {
  it('stops paginating once the source has no next page', async () => {
    mockFetchPage.mockResolvedValue(page([], false));
    const { result } = renderHook(() => useListings());

    for (let i = 0; i < 25; i++) {
      await act(async () => { await result.current.loadMore(); });
    }

    expect(mockFetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.stack).toHaveLength(0);
  });

  it('passes the cursor along and stops at the last page', async () => {
    mockFetchPage
      .mockResolvedValueOnce(page(makeListings(30)))
      .mockResolvedValueOnce(page(makeListings(30)))
      .mockResolvedValueOnce(page(makeListings(7), false));
    const { result } = renderHook(() => useListings());

    for (let i = 0; i < 25; i++) {
      await act(async () => { await result.current.loadMore(); });
    }

    expect(mockFetchPage).toHaveBeenCalledTimes(3);
    expect(mockFetchPage.mock.calls[0][1]).toBeNull();
    expect(mockFetchPage.mock.calls[1][1]).not.toBeNull();
    expect(mockFetchPage.mock.calls[0][0]).toEqual({ groupId: 'g1', listId: 'l1', filters: FILTERS });
    expect(result.current.stack).toHaveLength(67);
  });

  it('keeps reading when client-side filtering empties a page', async () => {
    mockFetchPage
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page(makeListings(2)));
    const { result } = renderHook(() => useListings());

    await act(async () => { await result.current.loadMore(); });

    expect(mockFetchPage).toHaveBeenCalledTimes(3);
    expect(result.current.stack).toHaveLength(2);
  });

  it('never shows listings the user already swiped in this list', async () => {
    const listings = makeListings(3);
    mockSwipedIds.mockResolvedValue(new Set([listings[1].id]));
    mockFetchPage.mockResolvedValue(page(listings, false));
    const { result } = renderHook(() => useListings());

    await act(async () => { await result.current.loadMore(); });

    expect(mockSwipedIds).toHaveBeenCalledWith('u1', 'l1');
    expect(result.current.stack.map((l) => l.id)).toEqual([listings[0].id, listings[2].id]);
  });

  it('ignores concurrent loadMore calls (a single in-flight request)', async () => {
    let resolveFetch: (v: ListingsPage) => void = () => {};
    mockFetchPage.mockImplementation(() => new Promise<ListingsPage>((res) => { resolveFetch = res; }));
    const { result } = renderHook(() => useListings());

    await act(async () => {
      const p1 = result.current.loadMore();
      const p2 = result.current.loadMore();
      await flush();
      resolveFetch(page(makeListings(30)));
      await Promise.all([p1, p2]);
    });

    expect(mockFetchPage).toHaveBeenCalledTimes(1);
  });

  it('stores the error and stops auto-pagination until a refresh', async () => {
    mockFetchPage.mockRejectedValueOnce(new Error('offline'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useListings());

    await act(async () => { await result.current.loadMore(); });
    await act(async () => { await result.current.loadMore(); });

    expect(mockFetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('Impossible de charger les annonces.');

    mockFetchPage.mockResolvedValue(page(makeListings(3), false));
    await act(async () => { result.current.refresh(); }); // error bypasses the throttle
    await flush();
    expect(result.current.error).toBeNull();
    expect(result.current.stack).toHaveLength(3);
    spy.mockRestore();
  });

  it('throttles repeated refresh() with an unchanged query, but force bypasses it', async () => {
    mockFetchPage.mockResolvedValue(page(makeListings(30)));
    const { result } = renderHook(() => useListings());

    await act(async () => { result.current.refresh(); });
    await flush();
    expect(mockFetchPage).toHaveBeenCalledTimes(1);

    await act(async () => { result.current.refresh(); });
    await flush();
    expect(mockFetchPage).toHaveBeenCalledTimes(1);

    await act(async () => { result.current.refresh(true); });
    await flush();
    expect(mockFetchPage).toHaveBeenCalledTimes(2);
  });

  it('drops the results of a load started before a refresh', async () => {
    let resolveStale: (v: ListingsPage) => void = () => {};
    const stale = makeListings(5);
    const fresh = makeListings(2);
    mockFetchPage
      .mockImplementationOnce(() => new Promise<ListingsPage>((res) => { resolveStale = res; }))
      .mockResolvedValueOnce(page(fresh, false));
    const { result } = renderHook(() => useListings());

    await act(async () => { result.current.refresh(); });
    await flush();
    await act(async () => { result.current.refresh(true); }); // e.g. switched list
    await flush();
    await act(async () => { resolveStale(page(stale)); });
    await flush();

    expect(result.current.stack.map((l) => l.id)).toEqual(fresh.map((l) => l.id));
  });

  it('does not refetch on remount while cached data is still fresh', async () => {
    mockFetchPage.mockResolvedValue(page(makeListings(30)));

    const first = renderHook(() => useListings());
    await act(async () => { first.result.current.refresh(); });
    await flush();
    expect(first.result.current.stack).toHaveLength(30);
    first.unmount();

    const second = renderHook(() => useListings());
    expect(second.result.current.stack).toHaveLength(30);
    await act(async () => { second.result.current.refresh(); });
    await flush();
    expect(mockFetchPage).toHaveBeenCalledTimes(1);
  });

  it('caches local (mock) listings into Firestore but not feed listings', async () => {
    mockFetchPage.mockResolvedValue(page(makeListings(2), false));
    const { result } = renderHook(() => useListings());
    await act(async () => { await result.current.loadMore(); });
    expect(mockSetDoc).not.toHaveBeenCalled();

    mockSource.current = { id: 'mock', kind: 'local', fetchPage: (q, c) => mockFetchPage(q, c) };
    await act(async () => { result.current.refresh(true); });
    await flush();
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it('exposes a query key that changes with the list', () => {
    const { result } = renderHook(() => useListings());
    expect(result.current.queryKey).toBe(`g1|l1|${JSON.stringify(FILTERS)}`);
  });
});
