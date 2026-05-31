import { useAuthStore } from '@/stores/authStore';

const ADMIN_EMAIL = 'guillaume.zarb@gmail.com';

// Per-label call counters, reset only on app restart.
const counts: Record<string, number> = {};

// Rolling 1-minute window of call timestamps (ms) to surface the call rate.
// Warn when more than RATE_LIMIT calls happen within RATE_WINDOW_MS.
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 100;
const callTimes: number[] = [];

function isAdmin(): boolean {
  return useAuthStore.getState().firebaseUser?.email === ADMIN_EMAIL;
}

/**
 * Logs API calls only when signed in as the admin account.
 * Call it with a short label (e.g. 'Firestore:getDoc users') and optional detail.
 */
export function alog(label: string, detail?: unknown): void {
  if (!isAdmin()) return;
  counts[label] = (counts[label] ?? 0) + 1;
  const n = counts[label];

  // Maintain the rolling 1-minute window and compute the current rate.
  const now = Date.now();
  callTimes.push(now);
  while (callTimes.length > 0 && now - callTimes[0] > RATE_WINDOW_MS) {
    callTimes.shift();
  }
  const perMin = callTimes.length;

  const t = new Date().toLocaleTimeString('fr-FR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const rate = `[${perMin}/min]`;
  const log = perMin > RATE_LIMIT ? console.warn : console.log;
  if (detail !== undefined) {
    log(`[ADMIN ${t}] ${rate} #${n} ${label}`, detail);
  } else {
    log(`[ADMIN ${t}] ${rate} #${n} ${label}`);
  }
}

/** Returns true only for the admin account — use to gate verbose sections. */
export function isAdminUser(): boolean {
  return isAdmin();
}
