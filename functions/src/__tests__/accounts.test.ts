import {
  AppError, emailFromToken, expiryFromToken, linkSearchList, normalizeToken, REFETCH_COOLDOWN_MS,
  refetchProvider, setGlobalToken,
} from '../accounts';
import { FakeProvider, FIXED_NOW, MemoryFeedStore, makeListing } from './fakes';
import { GLOBAL_OWNER, ProviderAccount } from '../types';

const ADMIN = 'alice';

// App-wide account as bootstrapped by the migration: alice is the admin.
function globalAccount(overrides: Partial<ProviderAccount> = {}): ProviderAccount {
  return {
    user_id: GLOBAL_OWNER, provider: 'jinka', email: 'alice@x.fr', auth_method: 'token', status: 'ok',
    alerts: [], connected_at: '2026-01-01T00:00:00Z', last_sync_at: null, last_error: null,
    admin_uids: [ADMIN],
    ...overrides,
  };
}

function setup() {
  const store = new MemoryFeedStore();
  const provider = new FakeProvider();
  provider.alerts = [{ id: 'a1', name: 'SO le J' }];
  provider.pages.set('a1', [[makeListing('jinka_1')]]);
  provider.validTokens.add('tok');
  store.accounts.set(`${GLOBAL_OWNER}/jinka`, globalAccount());
  store.tokens.set(`${GLOBAL_OWNER}/jinka`, 'tok');
  store.groups.set('g1', { member_ids: ['alice', 'bob'], list_ids: ['l1'] });
  const deps = { store, providers: { jinka: provider }, now: () => FIXED_NOW };
  return { store, provider, deps };
}

async function expectAppError(p: Promise<unknown>, code: AppError['code']) {
  await expect(p).rejects.toBeInstanceOf(AppError);
  await expect(p).rejects.toMatchObject({ code });
}

const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;

describe('setGlobalToken', () => {
  it('lets the admin replace the app-wide token, with its expiry', async () => {
    const { store, provider, deps } = setup();
    const token = jwt({ email: 'alice@x.fr', exp: 1_800_000_000 });
    provider.validTokens.add(token);

    const { alerts, expiresAt } = await setGlobalToken(deps, ADMIN, { token: `Bearer ${token}` });

    expect(alerts).toEqual(provider.alerts);
    expect(expiresAt).toBe(new Date(1_800_000_000_000).toISOString());
    expect(store.tokens.get(`${GLOBAL_OWNER}/jinka`)).toBe(token);
    expect(store.accounts.get(`${GLOBAL_OWNER}/jinka`)).toMatchObject({
      status: 'ok', alerts, token_expires_at: expiresAt, admin_uids: [ADMIN],
    });
  });

  it('is refused to non-admins and for invalid tokens', async () => {
    const { store, deps } = setup();

    await expectAppError(setGlobalToken(deps, 'bob', { token: 'tok' }), 'permission-denied');
    await expectAppError(setGlobalToken(deps, ADMIN, { token: 'nope' }), 'permission-denied');
    await expectAppError(setGlobalToken(deps, ADMIN, { token: 'Bearer ' }), 'invalid-argument');
    expect(store.tokens.get(`${GLOBAL_OWNER}/jinka`)).toBe('tok');
  });

  it('revives expired feeds right away', async () => {
    const { store, provider, deps } = setup();
    await linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'l1', alertId: 'a1' });
    await store.updateFeed('g1', 'l1', { status: 'expired' });
    provider.validTokens.add('fresh');
    provider.pages.set('a1', [[makeListing('jinka_1'), makeListing('jinka_2')]]);

    await setGlobalToken(deps, ADMIN, { token: 'fresh' });

    expect(store.feeds.get('g1/l1')!.status).toBe('ok');
    expect(store.items.get('g1/l1')!.size).toBe(2);
  });
});

describe('linkSearchList', () => {
  it("lets any member link a list to one of the app's alerts", async () => {
    const { store, deps } = setup();

    const { newItems } = await linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'l1', alertId: 'a1' });

    expect(newItems).toBe(1);
    expect(store.feeds.get('g1/l1')).toMatchObject({ owner_id: GLOBAL_OWNER, alert_id: 'a1', alert_name: 'SO le J' });
  });

  it('refuses non-members, unknown lists and unknown alerts', async () => {
    const { deps } = setup();
    await expectAppError(linkSearchList(deps, 'mallory', { groupId: 'g1', listId: 'l1', alertId: 'a1' }), 'permission-denied');
    await expectAppError(linkSearchList(deps, 'bob', { groupId: 'nope', listId: 'l1', alertId: 'a1' }), 'not-found');
    await expectAppError(linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'nope', alertId: 'a1' }), 'not-found');
    await expectAppError(linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'l1', alertId: 'zzz' }), 'not-found');
  });

  it('reports an expired app session and flags the account', async () => {
    const { store, provider, deps } = setup();
    provider.validTokens.clear();

    await expectAppError(linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'l1', alertId: 'a1' }), 'failed-precondition');
    expect(store.accounts.get(`${GLOBAL_OWNER}/jinka`)!.status).toBe('expired');
    expect(store.tokens.has(`${GLOBAL_OWNER}/jinka`)).toBe(false);
  });

  it('clears the previous feed when switching alert, and unlinks with null', async () => {
    const { store, provider, deps } = setup();
    await linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'l1', alertId: 'a1' });
    provider.alerts = [...provider.alerts, { id: 'a2', name: 'Paris' }];
    provider.pages.set('a2', [[makeListing('jinka_9')]]);

    await linkSearchList(deps, 'alice', { groupId: 'g1', listId: 'l1', alertId: 'a2' });
    expect([...store.items.get('g1/l1')!.keys()]).toEqual(['jinka_9']);

    await linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'l1', alertId: null });
    expect(store.feeds.size).toBe(0);
  });
});

describe('refetchProvider', () => {
  const later = () => new Date(FIXED_NOW.getTime() + REFETCH_COOLDOWN_MS);

  it('re-reads every page of the linked alerts and reports what changed', async () => {
    const { store, provider, deps } = setup();
    provider.pages.set('a1', [[makeListing('jinka_1')], [makeListing('jinka_2')]]);
    await linkSearchList(deps, 'bob', { groupId: 'g1', listId: 'l1', alertId: 'a1' });
    provider.pages.set('a1', [[makeListing('jinka_2')], [makeListing('jinka_3')]]);
    deps.now = later;

    const result = await refetchProvider(deps, ADMIN, {});

    expect(result).toMatchObject({ feeds: 1, newItems: 1, expiredItems: 1 });
    expect(store.items.get('g1/l1')!.get('jinka_1')!.active).toBe(false);
  });

  it('is admin only and rate-limited', async () => {
    const { deps } = setup();
    await expectAppError(refetchProvider(deps, 'bob', {}), 'permission-denied');

    let now = later().getTime();
    deps.now = () => new Date(now);
    await refetchProvider(deps, ADMIN, {});
    now += REFETCH_COOLDOWN_MS - 1000;
    await expectAppError(refetchProvider(deps, ADMIN, {}), 'failed-precondition');
    now += 1000;
    await expect(refetchProvider(deps, ADMIN, {})).resolves.toBeDefined();
  });

  it('only refreshes the alert list when nothing is linked', async () => {
    const { provider, deps } = setup();
    deps.now = later;

    const result = await refetchProvider(deps, ADMIN, {});

    expect(result).toMatchObject({ feeds: 0, newItems: 0 });
    expect(provider.calls).toEqual(['alerts']);
  });
});

describe('token helpers', () => {
  it('normalizes header values and raw cookies', () => {
    expect(normalizeToken('Bearer abc')).toBe('abc');
    expect(normalizeToken(' bearer  abc ')).toBe('abc');
    expect(normalizeToken('abc')).toBe('abc');
  });

  it('reads email and expiry claims of a JWT, best effort', () => {
    expect(emailFromToken(jwt({ email: 'a@x.fr' }))).toBe('a@x.fr');
    expect(emailFromToken(jwt({ sub: '42' }))).toBeNull();
    expect(emailFromToken('opaque-token')).toBeNull();
    expect(expiryFromToken(jwt({ exp: 1_800_000_000 }))).toBe('2027-01-15T08:00:00.000Z');
    expect(expiryFromToken('opaque-token')).toBeNull();
  });
});
