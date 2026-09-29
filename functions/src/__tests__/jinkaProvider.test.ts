import { ProviderAuthError } from '../providers/ListingProvider';
import { createJinkaProvider } from '../providers/jinka/jinkaProvider';
import { arrondissementFromPostalCode, mapJinkaAd } from '../providers/jinka/jinkaMapper';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function providerWith(...responses: Response[]) {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  const provider = createJinkaProvider({ fetch: fetchMock as unknown as typeof fetch, requestDelayMs: 0 });
  return { provider, fetchMock };
}

describe('jinkaProvider', () => {
  it('authenticates with a form-encoded POST and returns the token', async () => {
    const { provider, fetchMock } = providerWith(jsonResponse({ access_token: 'tok' }));

    await expect(provider.authenticate('a@x.fr', 'p&ss')).resolves.toBe('tok');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.jinka.fr/apiv2/user/auth');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('email=a%40x.fr&password=p%26ss');
  });

  it('maps a refused login to ProviderAuthError, but not a 429', async () => {
    const refused = providerWith(jsonResponse({}, 401));
    await expect(refused.provider.authenticate('a', 'b')).rejects.toBeInstanceOf(ProviderAuthError);

    const limited = providerWith(jsonResponse({}, 429));
    await expect(limited.provider.authenticate('a', 'b')).rejects.not.toBeInstanceOf(ProviderAuthError);
  });

  it('lists alerts with the bearer token', async () => {
    const { provider, fetchMock } = providerWith(jsonResponse([
      { id: 42, name: 'n°2', user_name: 'SO le J' },
      { id: 43, name: 'Paris 11', user_name: '' },
      { id: 7 },
    ]));

    await expect(provider.listAlerts('tok')).resolves.toEqual([
      { id: '42', name: 'SO le J' }, // the user's own name wins
      { id: '43', name: 'Paris 11' },
      { id: '7', name: '7' },
    ]);
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('throws ProviderAuthError when the token is rejected', async () => {
    const { provider } = providerWith(jsonResponse({}, 401));
    await expect(provider.listAlerts('tok')).rejects.toBeInstanceOf(ProviderAuthError);
  });

  it('reads a dashboard page', async () => {
    const { provider, fetchMock } = providerWith(jsonResponse({
      pagination: { nbPages: 4 },
      ads: [{ id: 1, rent: 1200, area: 40, room: 2, postal_code: '75011', city: 'Paris' }],
    }));

    const page = await provider.fetchAlertPage('tok', 'a1', 2);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.jinka.fr/apiv2/alert/a1/dashboard?filter=all&page=2');
    expect(page.nbPages).toBe(4);
    expect(page.listings[0]).toMatchObject({ id: 'jinka_1', price: 1200, surface: 40, arrondissement: 11 });
  });
});

describe('mapJinkaAd', () => {
  it('maps fields and falls back to the redirect URL', () => {
    const listing = mapJinkaAd({
      id: 'ad-1',
      source_label: 'SeLoger',
      rent: '1350',
      area: 38,
      room: 1,
      floor: 3,
      city: 'Paris',
      postal_code: '75020',
      lat: 48.86,
      lng: 2.39,
      images: ['https://img/1.jpg', { url: 'https://img/2.jpg' }, { nope: true }],
      created_at: '2026-09-01T00:00:00Z',
    }, 'alert-9');

    expect(listing).toMatchObject({
      id: 'jinka_ad-1',
      title: 'Studio — 38m² — 20ème',
      price: 1350,
      rooms: 1,
      floor: 3,
      arrondissement: 20,
      address: 'Paris 75020',
      images: ['https://img/1.jpg', 'https://img/2.jpg'],
      source: 'SeLoger',
      url: 'https://api.jinka.fr/alert_result_view_ad?ad=ad-1&alert_token=alert-9',
      lat: 48.86,
      expired_at: null,
    });
  });

  it('carries the expiration date of expired or deleted ads', () => {
    expect(mapJinkaAd({ id: 1, expired_at: '2026-09-01' }, 'a').expired_at).toBe('2026-09-01');
    expect(mapJinkaAd({ id: 1, deleted_at: '2026-09-02' }, 'a').expired_at).toBe('2026-09-02');
  });

  it('extracts the arrondissement only for Paris postcodes', () => {
    expect(arrondissementFromPostalCode('75001')).toBe(1);
    expect(arrondissementFromPostalCode('75116')).toBe(16);
    expect(arrondissementFromPostalCode('92100')).toBe(0);
    expect(arrondissementFromPostalCode(null)).toBe(0);
  });
});
