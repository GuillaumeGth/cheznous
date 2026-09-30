// The first Jinka syncs stored `api.jinka.fr/alert_result_view_ad?ad=…&alert_token=…`
// links. That route doesn't exist (404), and `api.jinka.fr` being an App Link of
// the Jinka app, tapping it just opened the app's home. Listings cached in
// `listings/{id}`, matches and chat shares still carry it, so rewrite it to the
// public ad link the server now writes (see `adPublicUrl` in functions/).
const LEGACY_JINKA_URL = /^https:\/\/api\.jinka\.fr\/alert_result_view_ad\?/;

function param(url: string, name: string): string | null {
  const match = url.match(new RegExp(`[?&]${name}=([^&#]+)`));
  return match ? match[1] : null;
}

/** URL to open for a listing's "see the ad" action. */
export function listingUrl(url: string): string {
  if (!LEGACY_JINKA_URL.test(url)) return url;
  const ad = param(url, 'ad');
  const alert = param(url, 'alert_token');
  if (!ad || !alert) return url;
  return `https://www.jinka.fr/alert_result?token=${alert}&ad=${ad}`;
}
