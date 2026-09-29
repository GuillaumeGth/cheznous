import { ProviderAlert } from '../../types';
import {
  ListingProvider, ProviderAlertNotFoundError, ProviderAlertPage, ProviderAuthError,
} from '../ListingProvider';
import { JinkaRawAd, mapJinkaAd } from './jinkaMapper';

// TypeScript port of the HTTP calls made by kajin
// (https://github.com/louistransfer/kajin). Jinka has no public API: these are
// the endpoints its web app uses, so they may change without notice.

const API_BASE = 'https://api.jinka.fr/apiv2';
const WEB_ORIGIN = 'https://www.jinka.fr';
const TIMEOUT_MS = 30_000;

export class JinkaHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'JinkaHttpError';
  }
}

export type JinkaProviderOptions = {
  fetch?: typeof fetch;
  /**
   * Minimum gap between two calls — keeps the traffic close to a human
   * browsing the site (kajin warns about accounts flagged as suspicious).
   */
  requestDelayMs?: number;
};

export function createJinkaProvider(options: JinkaProviderOptions = {}): ListingProvider {
  const fetchImpl = options.fetch ?? fetch;
  const delayMs = options.requestDelayMs ?? 500;
  let lastRequestAt = 0;

  async function paced(url: string, init: RequestInit): Promise<Response> {
    const wait = lastRequestAt + delayMs - Date.now();
    if (lastRequestAt > 0 && wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } finally {
      lastRequestAt = Date.now();
    }
  }

  async function getJson(path: string, token: string): Promise<unknown> {
    const res = await paced(`${API_BASE}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        Authorization: `Bearer ${token}`,
        Origin: WEB_ORIGIN,
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new ProviderAuthError('Session Jinka expirée');
    }
    if (!res.ok) throw new JinkaHttpError(res.status, `Jinka GET ${path} failed: ${res.status}`);
    return res.json();
  }

  async function getDashboard(token: string, alertId: string, page: number): Promise<unknown> {
    try {
      return await getJson(`/alert/${encodeURIComponent(alertId)}/dashboard?filter=all&page=${page}`, token);
    } catch (e) {
      if (e instanceof JinkaHttpError && e.status === 404) throw new ProviderAlertNotFoundError(alertId);
      throw e;
    }
  }

  return {
    id: 'jinka',

    async authenticate(email, password) {
      const res = await paced(`${API_BASE}/user/auth`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: WEB_ORIGIN,
        },
        body: new URLSearchParams({ email, password }).toString(),
      });
      // 429 = rate limited, not a credentials problem.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new ProviderAuthError('Identifiants Jinka invalides');
      }
      if (!res.ok) throw new JinkaHttpError(res.status, `Jinka auth failed: ${res.status}`);
      const data = (await res.json()) as { access_token?: unknown };
      if (typeof data.access_token !== 'string' || !data.access_token) {
        throw new JinkaHttpError(res.status, 'Jinka auth response has no access_token');
      }
      return data.access_token;
    },

    async listAlerts(token): Promise<ProviderAlert[]> {
      const data = await getJson('/alert', token);
      if (!Array.isArray(data)) throw new JinkaHttpError(200, 'Unexpected Jinka /alert response');
      return data.map((a: { id: unknown; name?: unknown }) => ({
        id: String(a.id),
        name: typeof a.name === 'string' && a.name ? a.name : String(a.id),
      }));
    },

    async fetchAlertPage(token, alertId, page): Promise<ProviderAlertPage> {
      const data = (await getDashboard(token, alertId, page)) as {
        ads?: unknown;
        pagination?: { nbPages?: unknown; nb_pages?: unknown };
      };
      const nbPages = Number(data.pagination?.nbPages ?? data.pagination?.nb_pages ?? 1);
      const ads = Array.isArray(data.ads) ? (data.ads as JinkaRawAd[]) : [];
      return {
        nbPages: Number.isFinite(nbPages) ? nbPages : 1,
        listings: ads.map((ad) => mapJinkaAd(ad, alertId)),
      };
    },
  };
}
