jest.mock('@/lib/firebase', () => ({ db: {} }));

const mockGetDocs = jest.fn();
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...path: unknown[]) => ({ path: path.slice(1).join('/') })),
  query: jest.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
  where: jest.fn((...args: unknown[]) => ({ where: args })),
  orderBy: jest.fn((...args: unknown[]) => ({ orderBy: args })),
  limit: jest.fn((n: number) => ({ limit: n })),
  startAfter: jest.fn((cursor: unknown) => ({ startAfter: cursor })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

import { collection, startAfter, where } from 'firebase/firestore';
import { DEFAULT_FILTERS, FeedItem } from '@/types';
import { FEED_PAGE_SIZE, feedDataSource } from '@/services/listings/feedDataSource';
import { MOCK_PAGE_SIZE, mockDataSource } from '@/services/listings/mock/mockDataSource';
import { matchesFilters } from '@/services/listings/matchesFilters';

const QUERY = { groupId: 'g1', listId: 'l1', filters: DEFAULT_FILTERS };

function feedItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id, title: id, price: 1200, charges: 0, surface: 35, rooms: 2, floor: null,
    address: 'Paris 75011', arrondissement: 11, images: [], description: '', url: '',
    source: 'SeLoger', has_elevator: false, has_parking: false, has_balcony: false,
    has_terrace: false, available_from: '', deposit: 0, lat: null, lng: null, expired_at: null,
    added_at: '2026-09-29T10:00:00Z', fetched_at: '2026-09-29T10:00:00Z', active: true,
    ...overrides,
  };
}

const snapOf = (items: FeedItem[]) => ({ docs: items.map((i) => ({ data: () => i, id: i.id })) });

beforeEach(() => jest.clearAllMocks());

describe('feedDataSource', () => {
  it('reads live items of the list feed, without the feed bookkeeping fields', async () => {
    mockGetDocs.mockResolvedValue(snapOf([feedItem('jinka_1')]));

    const { listings, nextCursor } = await feedDataSource.fetchPage(QUERY, null);

    expect(collection).toHaveBeenCalledWith({}, 'groups', 'g1', 'feeds', 'l1', 'items');
    expect(where).toHaveBeenCalledWith('active', '==', true);
    expect(listings).toHaveLength(1);
    expect(listings[0]).not.toHaveProperty('added_at');
    expect(listings[0]).not.toHaveProperty('active');
    expect(nextCursor).toBeNull(); // short page → end of feed
  });

  it('refines the feed with the search list filters', async () => {
    mockGetDocs.mockResolvedValue(snapOf([
      feedItem('cheap', { price: 900 }),
      feedItem('pricey', { price: 2500 }),
    ]));

    const { listings } = await feedDataSource.fetchPage(
      { ...QUERY, filters: { ...DEFAULT_FILTERS, price_max: 1000 } }, null,
    );

    expect(listings.map((l) => l.id)).toEqual(['cheap']);
  });

  it('returns the last doc as cursor on a full page and resumes after it', async () => {
    const items = Array.from({ length: FEED_PAGE_SIZE }, (_, i) => feedItem(`jinka_${i}`));
    mockGetDocs.mockResolvedValue(snapOf(items));

    const { nextCursor } = await feedDataSource.fetchPage(QUERY, null);
    expect(nextCursor).not.toBeNull();

    await feedDataSource.fetchPage(QUERY, nextCursor);
    expect(startAfter).toHaveBeenCalledWith(nextCursor);
  });
});

describe('mockDataSource', () => {
  it('generates pages that honour the filters and never run out', async () => {
    const filters = { ...DEFAULT_FILTERS, price_max: 1500 };
    const first = await mockDataSource.fetchPage({ ...QUERY, filters }, null);
    const second = await mockDataSource.fetchPage({ ...QUERY, filters }, first.nextCursor);

    expect(first.listings).toHaveLength(MOCK_PAGE_SIZE);
    expect(first.listings.every((l) => l.price <= 1500)).toBe(true);
    expect(second.nextCursor).not.toBeNull();
    expect(mockDataSource.kind).toBe('local');
  });
});

describe('matchesFilters', () => {
  const base = { price: 1200, surface: 35, rooms: 2 };

  it('treats 0 as "no restriction"', () => {
    expect(matchesFilters(base, DEFAULT_FILTERS)).toBe(true);
  });

  it('applies every bound', () => {
    expect(matchesFilters(base, { ...DEFAULT_FILTERS, price_min: 1300 })).toBe(false);
    expect(matchesFilters(base, { ...DEFAULT_FILTERS, price_max: 1100 })).toBe(false);
    expect(matchesFilters(base, { ...DEFAULT_FILTERS, surface_min: 40 })).toBe(false);
    expect(matchesFilters(base, { ...DEFAULT_FILTERS, surface_max: 30 })).toBe(false);
    expect(matchesFilters(base, { ...DEFAULT_FILTERS, rooms_min: 3 })).toBe(false);
    expect(matchesFilters(base, { ...DEFAULT_FILTERS, price_min: 1200, price_max: 1200 })).toBe(true);
  });
});
