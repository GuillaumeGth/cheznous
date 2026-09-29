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

    async listAlerts(token): Promise<ProviderAlert[]> {
      const data = await getJson('/alert', token);
      if (!Array.isArray(data)) throw new JinkaHttpError(200, 'Unexpected Jinka /alert response');
      // `user_name` is the name the user gave the alert ("SO le J"); `name` is
      // Jinka's default ("n°2").
      const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
      return data.map((a: { id: unknown; name?: unknown; user_name?: unknown }) => ({
        id: String(a.id),
        name: text(a.user_name) ?? text(a.name) ?? String(a.id),
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
