import { DEFAULT_FILTERS, DEFAULT_NOTIFICATION_PREFS } from '@/types';

describe('DEFAULT_FILTERS', () => {
  it('starts with empty arrondissements', () => {
    expect(DEFAULT_FILTERS.arrondissements).toEqual([]);
  });

  it('has price_max of 2500', () => {
    expect(DEFAULT_FILTERS.price_max).toBe(2500);
  });

  it('has surface_min of 25', () => {
    expect(DEFAULT_FILTERS.surface_min).toBe(25);
  });

  it('has rooms_min of 0', () => {
    expect(DEFAULT_FILTERS.rooms_min).toBe(0);
  });
});

describe('DEFAULT_NOTIFICATION_PREFS', () => {
  it('disables partner swipe notifications by default', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.notify_partner_on_swipe).toBe(false);
  });

  it('disables new listing notifications by default', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.notify_on_new_listings).toBe(false);
  });
});
