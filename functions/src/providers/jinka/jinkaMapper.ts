import { Listing } from '../../types';

/** Raw ad from `/alert/{id}/dashboard` (only the fields we read). */
export type JinkaRawAd = {
  id: string | number;
  source?: string | null;
  source_label?: string | null;
  rent?: number | string | null;
  area?: number | string | null;
  room?: number | string | null;
  floor?: number | string | null;
  city?: string | null;
  postal_code?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  description?: string | null;
  images?: unknown; // comma-separated URL string (current API) or array (older payloads)
  created_at?: string | null;
  expired_at?: string | null;
  deleted_at?: string | null;
  webview_link?: string | null;
};

// Prefix keeps Jinka ids from colliding with other providers in the shared
// `listings` / `swipes` / `matches` collections.
export const JINKA_ID_PREFIX = 'jinka_';

const WEB_ORIGIN = 'https://www.jinka.fr';

function num(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

// The dashboard sends `images` as one comma-separated string of URLs; older
// payloads (kajin/jinka-mcp era) used an array of strings or `{ url }` objects.
function images(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(',').map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u));
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      const rec = (item ?? {}) as { url?: unknown; src?: unknown };
      if (typeof rec.url === 'string') return rec.url;
      return typeof rec.src === 'string' ? rec.src : null;
    })
    .filter((u): u is string => !!u);
}

/** Paris postcode → arrondissement (75011 → 11, 75116 → 16). 0 outside Paris. */
export function arrondissementFromPostalCode(postalCode: string | null | undefined): number {
  if (!postalCode || !/^75\d{3}$/.test(postalCode)) return 0;
  const n = parseInt(postalCode.slice(-2), 10);
  return n >= 1 && n <= 20 ? n : 0;
}

/**
 * Public link to the ad (the one Jinka's alert emails use): redirects to
 * `jinka.fr/ad/{uuid}`, and opens the ad in the Jinka app when it's installed
 * (`/alert_result` is one of its App/Universal Link paths).
 */
export function adPublicUrl(adId: string, alertId: string): string {
  return `${WEB_ORIGIN}/alert_result?${new URLSearchParams({ token: alertId, ad: adId })}`;
}

// An ad the user deleted on Jinka is as good as expired for us.
export function mapJinkaAd(ad: JinkaRawAd, alertId: string): Listing {
  const adId = String(ad.id);
  const rooms = num(ad.room) ?? 1;
  const surface = num(ad.area) ?? 0;
  const arrondissement = arrondissementFromPostalCode(ad.postal_code);
  const place = arrondissement > 0 ? `${arrondissement}ème` : (ad.city ?? 'Paris');

  return {
    id: `${JINKA_ID_PREFIX}${adId}`,
    title: `${rooms === 1 ? 'Studio' : `${rooms} pièces`} — ${surface}m² — ${place}`,
    price: num(ad.rent) ?? 0,
    charges: 0,
    surface,
    rooms,
    floor: num(ad.floor),
    address: [ad.city, ad.postal_code].filter(Boolean).join(' ') || 'Paris',
    arrondissement,
    images: images(ad.images),
    description: ad.description ?? '',
    url: ad.webview_link || adPublicUrl(adId, alertId),
    source: ad.source_label ?? ad.source ?? 'Jinka',
    has_elevator: false,
    has_parking: false,
    has_balcony: false,
    has_terrace: false,
    available_from: ad.created_at ?? new Date().toISOString(),
    deposit: 0,
    lat: num(ad.lat),
    lng: num(ad.lng),
    expired_at: ad.expired_at || ad.deleted_at || null,
  };
}
