import {
  AppError, connectProvider, disconnectProvider, linkSearchList, refreshProviderAlerts,
} from '../accounts';
import { FakeProvider, FIXED_NOW, MemoryFeedStore, feedLink, makeListing } from './fakes';

function setup() {
  const store = new MemoryFeedStore();
  const provider = new FakeProvider();
  provider.validCredentials.set('alice@x.fr', 'secret');
  provider.alerts = [{ id: 'a1', name: 'Paris 11' }];
  provider.pages.set('a1', [[makeListing('jinka_1')]]);
  store.groups.set('g1', { member_ids: ['alice', 'bob'], list_ids: ['l1'] });
  const deps = { store, providers: { jinka: provider }, now: () => FIXED_NOW };
  return { store, provider, deps };
}

const connect = (deps: ReturnType<typeof setup>['deps']) =>
  connectProvider(deps, 'alice', { provider: 'jinka', email: 'alice@x.fr', password: 'secret' });

async function expectAppError(p: Promise<unknown>, code: AppError['code']) {
  await expect(p).rejects.toBeInstanceOf(AppError);
  await expect(p).rejects.toMatchObject({ code });
}

describe('connectProvider', () => {
  it('stores the token and the account (never the password)', async () => {
    const { store, deps } = setup();

    const { alerts } = await connect(deps);

    expect(alerts).toEqual([{ id: 'a1', name: 'Paris 11' }]);
    expect(store.tokens.get('alice/jinka')).toBe('token-alice@x.fr');
    const account = store.accounts.get('alice/jinka')!;
    expect(account).toMatchObject({ email: 'alice@x.fr', status: 'ok', alerts });
    expect(JSON.stringify(account)).not.toContain('secret');
  });

  it('rejects wrong credentials without storing anything', async () => {
    const { store, deps } = setup();

    await expectAppError(
      connectProvider(deps, 'alice', { provider: 'jinka', email: 'alice@x.fr', password: 'nope' }),
      'permission-denied',
    );
    expect(store.tokens.size).toBe(0);
    expect(store.accounts.size).toBe(0);
  });

  it('validates the payload', async () => {
    const { deps } = setup();
    await expectAppError(connectProvider(deps, 'alice', null), 'invalid-argument');
    await expectAppError(connectProvider(deps, 'alice', { provider: 'other', email: 'a', password: 'b' }), 'invalid-argument');
    await expectAppError(connectProvider(deps, 'alice', { provider: 'jinka', email: '', password: 'b' }), 'invalid-argument');
  });

  it('re-syncs the feeds of an expired account on reconnect', async () => {
    const { store, deps } = setup();
    await store.saveFeed(feedLink({ status: 'expired' }));

    await connect(deps);

    expect(store.feeds.get('g1/l1')!.status).toBe('ok');
    expect(store.items.get('g1/l1')!.size).toBe(1);
  });
});

describe('linkSearchList', () => {
  it('links the list to the alert and fills the feed immediately', async () => {
    const { store, deps } = setup();
    await connect(deps);

    const { newItems } = await linkSearchList(deps, 'alice', { groupId: 'g1', listId: 'l1', alertId: 'a1' });

    expect(newItems).toBe(1);
    expect(store.feeds.get('g1/l1')).toMatchObject({ owner_id: 'alice', alert_id: 'a1', alert_name: 'Paris 11' });
  });

  it('refuses non-members, unknown lists and unknown alerts', async () => {
    const { deps } = setup();
    await connect(deps);

    await expectAppError(linkSearchList(deps, 'mallory', { groupId: 'g1', listId: 'l1', alertId: 'a1' }), 'permission-denied');
    await expectAppError(linkSearchList(deps, 'alice', { groupId: 'nope', listId: 'l1', alertId: 'a1' }), 'not-found');
    await expectAppError(linkSearchList(deps, 'alice', { groupId: 'g1', listId: 'nope', alertId: 'a1' }), 'not-found');
    await expectAppError(linkSearchList(deps, 'alice', { groupId: 'g1', listId: 'l1', alertId: 'someone-elses' }), 'not-found');
  });

  it('requires a connected account', async () => {
    const { deps } = setup();
    await expectAppError(
      linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'l1', alertId: 'a1' }),
      'failed-precondition',
    );
  });

  it('clears the previous feed when switching to another alert', async () => {
    const { store, provider, deps } = setup();
    await connect(deps);
    await linkSearchList(deps, 'alice', { groupId: 'g1', listId: 'l1', alertId: 'a1' });
    provider.alerts = [...provider.alerts, { id: 'a2', name: 'Paris 20' }];
    provider.pages.set('a2', [[makeListing('jinka_9')]]);

    await linkSearchList(deps, 'alice', { groupId: 'g1', listId: 'l1', alertId: 'a2' });

    expect([...store.items.get('g1/l1')!.keys()]).toEqual(['jinka_9']);
  });

  it('unlinks with alertId null', async () => {
    const { store, deps } = setup();
    await connect(deps);
    await linkSearchList(deps, 'alice', { groupId: 'g1', listId: 'l1', alertId: 'a1' });

    await linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'l1', alertId: null });

    expect(store.feeds.size).toBe(0);
    expect(store.items.size).toBe(0);
  });
});

describe('refreshProviderAlerts', () => {
  it('marks the account expired when the token is refused', async () => {
    const { store, provider, deps } = setup();
    await connect(deps);
    provider.validTokens.clear();

    await expectAppError(refreshProviderAlerts(deps, 'alice', { provider: 'jinka' }), 'failed-precondition');
    expect(store.accounts.get('alice/jinka')!.status).toBe('expired');
    expect(store.tokens.has('alice/jinka')).toBe(false);
  });
});

describe('disconnectProvider', () => {
  it('removes token, account and every feed the account was feeding', async () => {
    const { store, deps } = setup();
    await connect(deps);
    await linkSearchList(deps, 'alice', { groupId: 'g1', listId: 'l1', alertId: 'a1' });

    await disconnectProvider(deps, 'alice', { provider: 'jinka' });

    expect(store.tokens.size).toBe(0);
    expect(store.accounts.size).toBe(0);
    expect(store.feeds.size).toBe(0);
  });
});
