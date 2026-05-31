import { fetchListings, PAGE_SIZE } from '@/services/listingsService';
import { DEFAULT_FILTERS, SearchFilters } from '@/types';

// EXPO_PUBLIC_STREAM_ESTATE_KEY is not set in tests → mock data path is always used.
describe('fetchListings — mock data (no API key)', () => {
  it('returns a full page of listings', async () => {
    const listings = await fetchListings(DEFAULT_FILTERS);
    expect(listings).toHaveLength(PAGE_SIZE);
  });

  it('every listing has the required shape', async () => {
    const [l] = await fetchListings(DEFAULT_FILTERS);
    expect(l.id).toBeTruthy();
    expect(l.title).toBeTruthy();
    expect(typeof l.price).toBe('number');
    expect(typeof l.surface).toBe('number');
    expect(typeof l.rooms).toBe('number');
    expect(typeof l.arrondissement).toBe('number');
    expect(Array.isArray(l.images)).toBe(true);
    expect(l.images).toHaveLength(3);
    expect(l.source).toBe('mock');
    expect(typeof l.deposit).toBe('number');
  });

  it('respects price_max', async () => {
    const filters: SearchFilters = { ...DEFAULT_FILTERS, price_max: 1200 };
    const listings = await fetchListings(filters);
    listings.forEach((l) => expect(l.price).toBeLessThanOrEqual(1200));
  });

  it('respects surface_min', async () => {
    const filters: SearchFilters = { ...DEFAULT_FILTERS, surface_min: 50 };
    const listings = await fetchListings(filters);
    listings.forEach((l) => expect(l.surface).toBeGreaterThanOrEqual(50));
  });

  it('respects rooms_min', async () => {
    const filters: SearchFilters = { ...DEFAULT_FILTERS, rooms_min: 2 };
    const listings = await fetchListings(filters);
    listings.forEach((l) => expect(l.rooms).toBeGreaterThanOrEqual(2));
  });

  it('respects surface_max', async () => {
    const filters: SearchFilters = { ...DEFAULT_FILTERS, surface_max: 35 };
    const listings = await fetchListings(filters);
    listings.forEach((l) => expect(l.surface).toBeLessThanOrEqual(35));
  });

  it('respects price_min', async () => {
    const filters: SearchFilters = { ...DEFAULT_FILTERS, price_min: 1400 };
    const listings = await fetchListings(filters);
    listings.forEach((l) => expect(l.price).toBeGreaterThanOrEqual(1400));
  });

  it('restricts arrondissements to the specified set', async () => {
    const allowed = [5, 6, 7];
    const filters: SearchFilters = { ...DEFAULT_FILTERS, arrondissements: allowed };
    const listings = await fetchListings(filters);
    listings.forEach((l) => expect(allowed).toContain(l.arrondissement));
  });

  it('deposit equals price * 2', async () => {
    const listings = await fetchListings(DEFAULT_FILTERS);
    listings.forEach((l) => expect(l.deposit).toBe(l.price * 2));
  });

  it('charges equals floor(price * 0.08)', async () => {
    const listings = await fetchListings(DEFAULT_FILTERS);
    listings.forEach((l) => expect(l.charges).toBe(Math.floor(l.price * 0.08)));
  });

  it('page 1 and page 2 have non-overlapping ids', async () => {
    const [page1, page2] = await Promise.all([
      fetchListings(DEFAULT_FILTERS, 1),
      fetchListings(DEFAULT_FILTERS, 2),
    ]);
    const ids1 = new Set(page1.map((l) => l.id));
    const overlap = page2.filter((l) => ids1.has(l.id));
    expect(overlap).toHaveLength(0);
  });

  it('arrondissement is between 1 and 20 inclusive', async () => {
    const listings = await fetchListings(DEFAULT_FILTERS);
    listings.forEach((l) => {
      expect(l.arrondissement).toBeGreaterThanOrEqual(1);
      expect(l.arrondissement).toBeLessThanOrEqual(20);
    });
  });
});

describe('fetchListings — stream.estate API path', () => {
  it('calls stream.estate with correct URL params and API-KEY header', async () => {
    process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY = 'test-key';
    let fetchWithKey!: typeof fetchListings;

    jest.isolateModules(() => {
      fetchWithKey = require('@/services/listingsService').fetchListings;
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'hydra:member': [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchWithKey({ ...DEFAULT_FILTERS, arrondissements: [1, 2], price_max: 2000, surface_min: 30, rooms_min: 1 }, 3);

    delete process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('api.stream.estate');
    expect(url).toContain('budgetMax=2000');
    expect(url).toContain('surfaceMin=30');
    expect(url).toContain('roomMin=1');
    expect(url).toContain('page=3');
    expect(url).toContain('75001');
    expect(url).toContain('75002');
    expect((options.headers as Record<string, string>)['X-API-KEY']).toBe('test-key');
  });

  it('sends budgetMin when price_min > 0, omits it when 0', async () => {
    process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY = 'test-key';
    let fetchWithKey!: typeof fetchListings;

    jest.isolateModules(() => {
      fetchWithKey = require('@/services/listingsService').fetchListings;
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'hydra:member': [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchWithKey({ ...DEFAULT_FILTERS, price_min: 800 });
    await fetchWithKey({ ...DEFAULT_FILTERS, price_min: 0 });

    delete process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY;

    const [withMin] = mockFetch.mock.calls[0] as [string];
    const [withoutMin] = mockFetch.mock.calls[1] as [string];
    expect(withMin).toContain('budgetMin=800');
    expect(withoutMin).not.toContain('budgetMin');
  });

  it('sends surfaceMax when surface_max > 0, omits it when 0', async () => {
    process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY = 'test-key';
    let fetchWithKey!: typeof fetchListings;

    jest.isolateModules(() => {
      fetchWithKey = require('@/services/listingsService').fetchListings;
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'hydra:member': [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchWithKey({ ...DEFAULT_FILTERS, surface_max: 80 });
    await fetchWithKey({ ...DEFAULT_FILTERS, surface_max: 0 });

    delete process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY;

    const [withMax] = mockFetch.mock.calls[0] as [string];
    const [withoutMax] = mockFetch.mock.calls[1] as [string];
    expect(withMax).toContain('surfaceMax=80');
    expect(withoutMax).not.toContain('surfaceMax');
  });

  it('sends transactionType=1 for rent and =2 for buy', async () => {
    process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY = 'test-key';
    let fetchWithKey!: typeof fetchListings;

    jest.isolateModules(() => {
      fetchWithKey = require('@/services/listingsService').fetchListings;
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'hydra:member': [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fetchWithKey({ ...DEFAULT_FILTERS, transaction_type: 'rent' });
    await fetchWithKey({ ...DEFAULT_FILTERS, transaction_type: 'buy' });

    delete process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY;

    const [rentUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    const [buyUrl] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(rentUrl).toContain('transactionType=1');
    expect(buyUrl).toContain('transactionType=2');
  });

  it('maps stream.estate response fields to the Listing shape', async () => {
    process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY = 'test-key';
    let fetchWithKey!: typeof fetchListings;

    jest.isolateModules(() => {
      fetchWithKey = require('@/services/listingsService').fetchListings;
    });

    const raw = {
      uuid: 'uuid-abc',
      title: 'Bel appart',
      price: 1600,
      surface: 48,
      room: 2,
      floor: 3,
      elevator: true,
      createdAt: '2024-06-01T00:00:00Z',
      city: { name: 'Paris', zipcode: '75011' },
      pictures: [{ url: 'https://img.com/a.jpg' }],
      adverts: [{ price: 1600, charges: 128, url: 'https://seloger.com', description: 'Nice flat' }],
      locations: { lat: 48.86, lon: 2.37 },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'hydra:member': [raw] }),
    }) as unknown as typeof fetch;

    const listings = await fetchWithKey(DEFAULT_FILTERS, 1);

    delete process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY;

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      id: 'uuid-abc',
      price: 1600,
      surface: 48,
      rooms: 2,
      floor: 3,
      arrondissement: 11,
      has_elevator: true,
      lat: 48.86,
      lng: 2.37,
      source: 'stream.estate',
    });
  });

  it('throws when the stream.estate API returns a non-ok status', async () => {
    process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY = 'test-key';
    let fetchWithKey!: typeof fetchListings;

    jest.isolateModules(() => {
      fetchWithKey = require('@/services/listingsService').fetchListings;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
    }) as unknown as typeof fetch;

    // 500 is a genuine error (not a billing/quota status) → must throw
    await expect(fetchWithKey(DEFAULT_FILTERS)).rejects.toThrow('500');

    delete process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY;
  });

  it('falls back to mock data on billing/quota statuses (403/402/429)', async () => {
    process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY = 'test-key';
    let fetchWithKey!: typeof fetchListings;

    jest.isolateModules(() => {
      fetchWithKey = require('@/services/listingsService').fetchListings;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    }) as unknown as typeof fetch;

    const listings = await fetchWithKey(DEFAULT_FILTERS);
    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0].source).toBe('mock');

    delete process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY;
  });
});
