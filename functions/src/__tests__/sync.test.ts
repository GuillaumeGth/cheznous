import { INCREMENTAL_MAX_PAGES, PURGE_AFTER_DAYS, SWEEP_MAX_PAGES, syncFeeds } from '../sync';
import { FakeProvider, FIXED_NOW, MemoryFeedStore, feedLink, makeListing } from './fakes';
import { ProviderAccount } from '../types';

function setup() {
  const store = new MemoryFeedStore();
  const provider = new FakeProvider();
  store.groups.set('g1', { member_ids: ['alice', 'bob'], list_ids: ['l1', 'l2'] });
  store.tokens.set('alice/jinka', 'tok');
  provider.validTokens.add('tok');
  provider.alerts = [{ id: 'a1', name: 'Paris 11' }];
  const account: ProviderAccount = {
    user_id: 'alice', provider: 'jinka', email: 'alice@x.fr', auth_method: 'password', status: 'ok',
    alerts: [], connected_at: '2026-01-01T00:00:00Z', last_sync_at: null, last_error: null,
  };
  store.accounts.set('alice/jinka', account);
  const deps = { store, providers: { jinka: provider }, now: () => FIXED_NOW };
  return { store, provider, deps };
}

describe('syncFeeds', () => {
  it('writes provider listings into the feed and counts only new ones', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    provider.pages.set('a1', [[
      makeListing('jinka_1'),
      makeListing('jinka_2'),
    ]]);

    const first = await syncFeeds(deps);
    expect(first.newItems).toBe(2);

    provider.pages.set('a1', [[
      makeListing('jinka_2', { expired_at: '2026-09-29T09:00:00Z' }),
      makeListing('jinka_3'),
    ]]);
    const second = await syncFeeds(deps);
    expect(second.newItems).toBe(1);

    const items = store.items.get('g1/l1')!;
    expect([...items.keys()].sort()).toEqual(['jinka_1', 'jinka_2', 'jinka_3']);
    expect(items.get('jinka_2')!.active).toBe(false); // expired on Jinka's side
    expect(store.listings.has('jinka_3')).toBe(true); // shared cache for likes/matches
    expect(store.feeds.get('g1/l1')).toMatchObject({ status: 'ok', last_sync_at: FIXED_NOW.toISOString() });
    expect(store.accounts.get('alice/jinka')).toMatchObject({ status: 'ok', last_sync_at: FIXED_NOW.toISOString() });
  });

  it(`reads at most ${INCREMENTAL_MAX_PAGES} pages per alert on an empty feed`, async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    provider.pages.set('a1', Array.from({ length: 10 }, (_, p) => [
      makeListing(`jinka_${p}`),
    ]));

    await syncFeeds(deps);

    const pageCalls = provider.calls.filter((c) => c.startsWith('page:'));
    expect(pageCalls).toHaveLength(INCREMENTAL_MAX_PAGES);
  });

  it('stops at the first page that brings nothing new', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    const pages = Array.from({ length: 5 }, (_, p) => [makeListing(`jinka_${p}`)]);
    provider.pages.set('a1', pages);
    await syncFeeds(deps); // fills pages 1..3
    provider.calls = [];

    provider.pages.set('a1', [[makeListing('jinka_new'), makeListing('jinka_0')], ...pages]);
    await syncFeeds(deps);

    // page 1 had a new ad → read page 2 (already known) → stop.
    expect(provider.calls.filter((c) => c.startsWith('page:'))).toEqual(['page:a1:1', 'page:a1:2']);
    expect(store.items.get('g1/l1')!.has('jinka_new')).toBe(true);
  });

  it('does not rewrite items that did not change', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    provider.pages.set('a1', [[makeListing('jinka_1'), makeListing('jinka_2')]]);
    await syncFeeds(deps);
    expect(store.itemWrites).toBe(2);

    provider.pages.set('a1', [[makeListing('jinka_1'), makeListing('jinka_2', { price: 900 })]]);
    await syncFeeds(deps);

    expect(store.itemWrites).toBe(3); // only the price drop
    expect(store.items.get('g1/l1')!.get('jinka_2')!.price).toBe(900);
  });

  it('renames linked feeds when the alert name changed (sweep)', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink({ alert_name: 'n°2' }));
    provider.alerts = [{ id: 'a1', name: 'SO le J' }];
    provider.pages.set('a1', [[]]);

    await syncFeeds(deps, undefined, 'sweep');

    expect(store.feeds.get('g1/l1')!.alert_name).toBe('SO le J');
  });

  it('refreshes alert names only during the sweep', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    provider.pages.set('a1', [[]]);

    await syncFeeds(deps);
    expect(provider.calls).not.toContain('alerts');

    await syncFeeds(deps, undefined, 'sweep');
    expect(provider.calls).toContain('alerts');
    expect(store.accounts.get('alice/jinka')!.alerts).toEqual(provider.alerts);
  });

  it('fetches a shared alert once and fans it out to every linked list', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink({ list_id: 'l1' }));
    await store.saveFeed(feedLink({ list_id: 'l2' }));
    provider.pages.set('a1', [[makeListing('jinka_1')]]);

    await syncFeeds(deps);

    expect(provider.calls.filter((c) => c.startsWith('page:'))).toEqual(['page:a1:1']);
    expect(store.items.get('g1/l1')!.size).toBe(1);
    expect(store.items.get('g1/l2')!.size).toBe(1);
  });

  it('marks account and feeds expired and drops the token on auth error', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    provider.validTokens.clear();

    const report = await syncFeeds(deps);

    expect(report.expiredOwners).toBe(1);
    expect(store.tokens.has('alice/jinka')).toBe(false);
    expect(store.accounts.get('alice/jinka')!.status).toBe('expired');
    expect(store.feeds.get('g1/l1')!.status).toBe('expired');
  });

  it('marks feeds expired without calling the provider when no token is stored', async () => {
    const { store, provider, deps } = setup();
    store.tokens.clear();
    await store.saveFeed(feedLink());

    await syncFeeds(deps);

    expect(provider.calls).toEqual([]);
    expect(store.feeds.get('g1/l1')!.status).toBe('expired');
  });

  it('deletes feeds whose list, group or owner membership is gone', async () => {
    const { store, deps } = setup();
    await store.saveFeed(feedLink({ list_id: 'deleted-list' }));
    await store.saveFeed(feedLink({ group_id: 'no-group' }));
    await store.saveFeed(feedLink({ owner_id: 'carol' })); // not a member

    const report = await syncFeeds(deps);

    expect(report.removedFeeds).toBe(3);
    expect(store.feeds.size).toBe(0);
  });

  it('flags only the feed whose alert was deleted on the provider side', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink({ alert_id: 'gone' }));
    await store.saveFeed(feedLink({ list_id: 'l2' }));
    provider.pages.set('a1', [[makeListing('jinka_1')]]);

    const report = await syncFeeds(deps);

    expect(store.feeds.get('g1/l1')!.status).toBe('error');
    expect(store.feeds.get('g1/l2')!.status).toBe('ok');
    expect(store.accounts.get('alice/jinka')!.status).toBe('ok');
    expect(report.errors).toBe(0);
  });

  it('keeps syncing other owners when one fails with a network error', async () => {
    const { store, provider, deps } = setup();
    store.groups.set('g2', { member_ids: ['bob'], list_ids: ['l1'] });
    store.tokens.set('bob/jinka', 'tok-bob');
    provider.validTokens.add('tok-bob');
    await store.saveFeed(feedLink());
    await store.saveFeed(feedLink({ group_id: 'g2', owner_id: 'bob' }));
    provider.pages.set('a1', [[makeListing('jinka_1')]]);
    const original = provider.fetchAlertPage.bind(provider);
    provider.fetchAlertPage = async (token: string, alertId: string, page: number) => {
      if (token === 'tok') throw new Error('ECONNRESET');
      return original(token, alertId, page);
    };

    const report = await syncFeeds(deps);

    expect(report.errors).toBe(1);
    expect(store.feeds.get('g1/l1')!.status).toBe('error');
    expect(store.items.get('g2/l1')!.size).toBe(1);
  });
});

describe('syncFeeds — expired listings', () => {
  const EXPIRED = '2026-09-29T09:00:00Z';

  it('never adds a listing that is already expired the first time it is seen', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    provider.pages.set('a1', [[makeListing('jinka_1', { expired_at: EXPIRED })]]);

    const report = await syncFeeds(deps);

    expect(report.newItems).toBe(0);
    expect(store.items.get('g1/l1')!.size).toBe(0);
  });

  it('propagates a live → expired transition to listings and matches, once', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    provider.pages.set('a1', [[makeListing('jinka_1')]]);
    await syncFeeds(deps);

    provider.pages.set('a1', [[makeListing('jinka_1', { expired_at: EXPIRED })]]);
    const report = await syncFeeds(deps);

    expect(report.expiredItems).toBe(1);
    expect(store.items.get('g1/l1')!.get('jinka_1')).toMatchObject({ active: false, expired_at: EXPIRED });
    expect(store.propagated.get('jinka_1')).toBe(EXPIRED);

    store.propagated.clear();
    await syncFeeds(deps);
    expect(store.propagated.size).toBe(0); // already expired: no second propagation
  });

  it('sweep reads every page and expires listings that vanished from the alert', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    provider.pages.set('a1', [[makeListing('jinka_1'), makeListing('jinka_2')]]);
    await syncFeeds(deps);

    provider.pages.set('a1', [[makeListing('jinka_2')]]); // jinka_1 removed on Jinka
    const incremental = await syncFeeds(deps);
    expect(incremental.expiredItems).toBe(0); // incremental never infers expiration

    const sweep = await syncFeeds(deps, undefined, 'sweep');

    expect(sweep.expiredItems).toBe(1);
    expect(store.items.get('g1/l1')!.get('jinka_1')!.active).toBe(false);
    expect(store.propagated.get('jinka_1')).toBe(FIXED_NOW.toISOString());
  });

  it('sweep does not infer expiration when the alert has more pages than the cap', async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    await store.upsertFeedItems('g1', 'l1', [makeListing('deep')], '2026-01-01T00:00:00Z');
    provider.pages.set('a1', Array.from({ length: SWEEP_MAX_PAGES + 5 }, (_, p) => [makeListing(`jinka_${p}`)]));

    await syncFeeds(deps, undefined, 'sweep');

    expect(provider.calls.filter((c) => c.startsWith('page:'))).toHaveLength(SWEEP_MAX_PAGES);
    expect(store.items.get('g1/l1')!.get('deep')!.active).toBe(true);
  });

  it(`sweep purges items expired more than ${PURGE_AFTER_DAYS} days ago`, async () => {
    const { store, provider, deps } = setup();
    await store.saveFeed(feedLink());
    const feed = new Map([
      ['old', { ...makeListing('old', { expired_at: '2026-07-01T00:00:00Z' }), active: false, added_at: '', fetched_at: '' }],
      ['recent', { ...makeListing('recent', { expired_at: '2026-09-20T00:00:00Z' }), active: false, added_at: '', fetched_at: '' }],
    ]);
    store.items.set('g1/l1', feed);
    provider.pages.set('a1', [[]]);

    const report = await syncFeeds(deps, undefined, 'sweep');

    expect(report.purgedItems).toBe(1);
    expect([...store.items.get('g1/l1')!.keys()]).toEqual(['recent']);
  });
});
