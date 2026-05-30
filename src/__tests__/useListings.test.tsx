import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { Listing } from '@/types';

// --- Module mocks -----------------------------------------------------------
// Keep the real PAGE_SIZE (the short-page detection depends on it) but stub the
// network call so we can count exactly how many times the API is hit.
jest.mock('@/services/listingsService', () => ({
  ...jest.requireActual('@/services/listingsService'),
  fetchListings: jest.fn(),
}));

// Avoid real Firebase init; the hook only needs `db` as an opaque handle and
// `doc`/`setDoc` as no-ops.
jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  setDoc: jest.fn(() => Promise.resolve()),
}));

// Stable filters object → stable filtersKey, so the throttle logic is testable.
const FILTERS = { arrondissements: [], price_max: 3000, surface_min: 0, rooms_min: 0 };
jest.mock('@/stores/filterStore', () => ({
  useFilterStore: () => ({ filters: FILTERS }),
}));

import { useListings } from '@/hooks/useListings';
import { useListingsStore } from '@/stores/listingsStore';
import { fetchListings as realFetchListings, PAGE_SIZE } from '@/services/listingsService';

const fetchListings = realFetchListings as jest.MockedFunction<typeof realFetchListings>;

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

// Flush pending promises (fetch → setDoc → setState) and re-renders.
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const makeListings = (n: number): Listing[] =>
  Array.from({ length: n }, (_, i) => ({ id: `listing-${Math.random()}-${i}` } as unknown as Listing));

afterEach(() => {
  // Unmount any leftover harnesses so the next reset doesn't re-render them.
  while (mounted.length) {
    const r = mounted.pop()!;
    act(() => r.unmount());
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  // The store is a module-level singleton — reset it so tests stay isolated.
  act(() => {
    useListingsStore.setState({ stack: [], isLoading: false, page: 1, hasMore: true, lastRefresh: null });
  });
});

describe('useListings — API call is kept under control', () => {
  it('stops paginating once the API returns an empty page (no runaway calls)', async () => {
    fetchListings.mockResolvedValue([]);
    const { result } = renderHook(() => useListings());

    // Simulate the swipe screen's "stack is low" effect firing many times.
    for (let i = 0; i < 25; i++) {
      await act(async () => {
        await result.current.loadMore();
      });
    }

    expect(fetchListings).toHaveBeenCalledTimes(1);
    expect(result.current.stack).toHaveLength(0);
  });

  it('stops after a partial last page and never over-fetches', async () => {
    fetchListings
      .mockResolvedValueOnce(makeListings(PAGE_SIZE)) // full page → more may exist
      .mockResolvedValueOnce(makeListings(PAGE_SIZE)) // full page → more may exist
      .mockResolvedValueOnce(makeListings(7));        // short page → end reached
    const { result } = renderHook(() => useListings());

    for (let i = 0; i < 25; i++) {
      await act(async () => {
        await result.current.loadMore();
      });
    }

    expect(fetchListings).toHaveBeenCalledTimes(3);
    expect(result.current.stack).toHaveLength(PAGE_SIZE * 2 + 7);
  });

  it('ignores concurrent loadMore calls (a single in-flight request)', async () => {
    let resolveFetch: (v: Listing[]) => void = () => {};
    fetchListings.mockImplementation(
      () => new Promise<Listing[]>((res) => { resolveFetch = res; }),
    );
    const { result } = renderHook(() => useListings());

    await act(async () => {
      const p1 = result.current.loadMore();
      const p2 = result.current.loadMore(); // should bail out immediately
      resolveFetch(makeListings(PAGE_SIZE));
      await Promise.all([p1, p2]);
    });

    expect(fetchListings).toHaveBeenCalledTimes(1);
  });

  it('throttles repeated refresh() with unchanged filters, but force bypasses it', async () => {
    fetchListings.mockResolvedValue(makeListings(PAGE_SIZE));
    const { result } = renderHook(() => useListings());

    await act(async () => { result.current.refresh(); });
    await flush();
    expect(fetchListings).toHaveBeenCalledTimes(1);

    // Same filters, within the 30-min window → throttled, no new call.
    await act(async () => { result.current.refresh(); });
    await flush();
    expect(fetchListings).toHaveBeenCalledTimes(1);

    // force=true (filter change / manual reload) bypasses the throttle.
    await act(async () => { result.current.refresh(true); });
    await flush();
    expect(fetchListings).toHaveBeenCalledTimes(2);
  });

  it('does not refetch on remount while cached data is still fresh', async () => {
    fetchListings.mockResolvedValue(makeListings(PAGE_SIZE));

    // First mount: initial fetch fills the cache.
    const first = renderHook(() => useListings());
    await act(async () => { first.result.current.refresh(); });
    await flush();
    expect(fetchListings).toHaveBeenCalledTimes(1);
    expect(first.result.current.stack).toHaveLength(PAGE_SIZE);
    first.unmount();

    // Remount (e.g. switching tabs and back): store kept stack + lastRefresh.
    const second = renderHook(() => useListings());
    expect(second.result.current.stack).toHaveLength(PAGE_SIZE); // data survived
    await act(async () => { second.result.current.refresh(); });
    await flush();
    expect(fetchListings).toHaveBeenCalledTimes(1); // no extra network call
  });

  it('refresh re-enables pagination after the feed was exhausted', async () => {
    fetchListings.mockResolvedValue([]); // exhausted from the start
    const { result } = renderHook(() => useListings());

    await act(async () => { await result.current.loadMore(); });
    await act(async () => { await result.current.loadMore(); });
    expect(fetchListings).toHaveBeenCalledTimes(1); // hasMore=false locks it

    // A forced refresh resets hasMore and fetches once more.
    fetchListings.mockResolvedValue(makeListings(PAGE_SIZE));
    await act(async () => { result.current.refresh(true); });
    await flush();
    expect(fetchListings).toHaveBeenCalledTimes(2);
  });
});
