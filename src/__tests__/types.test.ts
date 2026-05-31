import { DEFAULT_FILTERS, DEFAULT_NOTIFICATION_PREFS } from '@/types';

describe('DEFAULT_FILTERS', () => {
  it('starts with empty arrondissements', () => {
    expect(DEFAULT_FILTERS.arrondissements).toEqual([]);
  });

  it('defaults to rent transaction type', () => {
    expect(DEFAULT_FILTERS.transaction_type).toBe('rent');
  });

  it('has price_min of 0 (no lower bound)', () => {
    expect(DEFAULT_FILTERS.price_min).toBe(0);
  });

  it('has price_max of 0 (no upper bound)', () => {
    expect(DEFAULT_FILTERS.price_max).toBe(0);
  });

  it('has surface_min of 0 (no lower bound)', () => {
    expect(DEFAULT_FILTERS.surface_min).toBe(0);
  });

  it('has surface_max of 0 (no upper bound)', () => {
    expect(DEFAULT_FILTERS.surface_max).toBe(0);
  });

  it('has rooms_min of 0', () => {
    expect(DEFAULT_FILTERS.rooms_min).toBe(0);
  });

  it('treats 0 values as "no filter" for price and surface', () => {
    // Convention used throughout the app: 0 = unset / no restriction
    expect(DEFAULT_FILTERS.price_min).toBe(0);
    expect(DEFAULT_FILTERS.price_max).toBe(0);
    expect(DEFAULT_FILTERS.surface_min).toBe(0);
    expect(DEFAULT_FILTERS.surface_max).toBe(0);
  });
});

describe('DEFAULT_NOTIFICATION_PREFS', () => {
  it('disables partner swipe notifications by default', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.notify_on_partner_swipe).toBe(false);
  });

  it('disables new listing notifications by default', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.notify_on_new_listings).toBe(false);
  });
});
