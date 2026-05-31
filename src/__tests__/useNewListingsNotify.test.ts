// Capture the AppState callback before any imports (hoisted by babel-jest).
const appStateCapture: { callback?: (state: string) => void } = {};

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn((_event: string, cb: (s: string) => void) => {
      appStateCapture.callback = cb;
      return { remove: jest.fn() };
    }),
  },
}));

jest.mock('@/lib/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  scheduleNewListingsNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('@/stores/filterStore', () => ({
  useFilterStore: { getState: jest.fn() },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { getDocs } from 'firebase/firestore';
import { scheduleNewListingsNotification } from '@/lib/notifications';
import { useAuthStore } from '@/stores/authStore';
import { useFilterStore } from '@/stores/filterStore';
import { DEFAULT_FILTERS } from '@/types';
import { useNewListingsNotify } from '@/hooks/useNewListingsNotify';

const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockSchedule = scheduleNewListingsNotification as jest.MockedFunction<typeof scheduleNewListingsNotification>;
const mockAuthGetState = useAuthStore.getState as jest.Mock;
const mockFilterGetState = useFilterStore.getState as jest.Mock;

function makeDoc(data: Record<string, unknown>) {
  return { data: () => data };
}

function renderHook() {
  function Harness() {
    useNewListingsNotify();
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Harness)); });
  return { unmount: () => act(() => renderer.unmount()) };
}

async function triggerActive() {
  await act(async () => {
    appStateCapture.callback?.('active');
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  appStateCapture.callback = undefined;
  mockAuthGetState.mockReturnValue({
    profile: { notification_prefs: { notify_on_new_listings: true } },
  });
  mockFilterGetState.mockReturnValue({ filters: { ...DEFAULT_FILTERS } });
});

describe('useNewListingsNotify — notification gate', () => {
  it('does nothing when notify_on_new_listings is false', async () => {
    mockAuthGetState.mockReturnValue({
      profile: { notification_prefs: { notify_on_new_listings: false } },
    });
    renderHook();
    await triggerActive();
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('does nothing when profile is null', async () => {
    mockAuthGetState.mockReturnValue({ profile: null });
    renderHook();
    await triggerActive();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('schedules a notification when at least one listing matches', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc({ arrondissement: 5, price: 1500, surface: 40, rooms: 2 })],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });

  it('does not schedule when no listings match', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

describe('useNewListingsNotify — filter: arrondissements', () => {
  it('keeps only listings in the selected arrondissements', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, arrondissements: [10, 11] },
    });
    mockGetDocs.mockResolvedValue({
      docs: [
        makeDoc({ arrondissement: 10, price: 1500, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 15, price: 1500, surface: 40, rooms: 2 }),
      ],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });

  it('accepts any arrondissement when the list is empty', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc({ arrondissement: 20, price: 1500, surface: 40, rooms: 2 })],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });
});

describe('useNewListingsNotify — filter: price range', () => {
  it('price_min=0 accepts listings of any price (no lower bound)', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, price_min: 0 },
    });
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc({ arrondissement: 5, price: 100, surface: 40, rooms: 2 })],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });

  it('price_max=0 accepts listings of any price (no upper bound)', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, price_max: 0 },
    });
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc({ arrondissement: 5, price: 99999, surface: 40, rooms: 2 })],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });

  it('filters by price_min: excludes below, keeps at and above', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, price_min: 1500 },
    });
    mockGetDocs.mockResolvedValue({
      docs: [
        makeDoc({ arrondissement: 5, price: 1200, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 2000, surface: 40, rooms: 2 }),
      ],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(2);
  });

  it('filters by price_max: keeps at and below, excludes above', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, price_max: 1500 },
    });
    mockGetDocs.mockResolvedValue({
      docs: [
        makeDoc({ arrondissement: 5, price: 1200, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 2000, surface: 40, rooms: 2 }),
      ],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(2);
  });

  it('filters by price range (min and max together)', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, price_min: 1000, price_max: 2000 },
    });
    mockGetDocs.mockResolvedValue({
      docs: [
        makeDoc({ arrondissement: 5, price: 800, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 2500, surface: 40, rooms: 2 }),
      ],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });
});

describe('useNewListingsNotify — filter: surface range', () => {
  it('surface_min=0 accepts any surface (no lower bound)', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc({ arrondissement: 5, price: 1500, surface: 5, rooms: 2 })],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });

  it('surface_max=0 accepts any surface (no upper bound)', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc({ arrondissement: 5, price: 1500, surface: 500, rooms: 2 })],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });

  it('filters by surface_min: excludes below, keeps at and above', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, surface_min: 40 },
    });
    mockGetDocs.mockResolvedValue({
      docs: [
        makeDoc({ arrondissement: 5, price: 1500, surface: 30, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 60, rooms: 2 }),
      ],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(2);
  });

  it('filters by surface_max: keeps at and below, excludes above', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, surface_max: 50 },
    });
    mockGetDocs.mockResolvedValue({
      docs: [
        makeDoc({ arrondissement: 5, price: 1500, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 50, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 60, rooms: 2 }),
      ],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(2);
  });

  it('filters by surface range (min and max together)', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, surface_min: 30, surface_max: 60 },
    });
    mockGetDocs.mockResolvedValue({
      docs: [
        makeDoc({ arrondissement: 5, price: 1500, surface: 20, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 45, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 80, rooms: 2 }),
      ],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });
});

describe('useNewListingsNotify — filter: rooms_min', () => {
  it('rooms_min=0 accepts any number of rooms', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [makeDoc({ arrondissement: 5, price: 1500, surface: 40, rooms: 1 })],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(1);
  });

  it('filters by rooms_min', async () => {
    mockFilterGetState.mockReturnValue({
      filters: { ...DEFAULT_FILTERS, rooms_min: 3 },
    });
    mockGetDocs.mockResolvedValue({
      docs: [
        makeDoc({ arrondissement: 5, price: 1500, surface: 40, rooms: 2 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 60, rooms: 3 }),
        makeDoc({ arrondissement: 5, price: 1500, surface: 80, rooms: 4 }),
      ],
    } as any);
    renderHook();
    await triggerActive();
    expect(mockSchedule).toHaveBeenCalledWith(2);
  });
});
