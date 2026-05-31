import { useAuthStore } from '@/stores/authStore';

const ADMIN_EMAIL = 'guillaume.zarb@gmail.com';

// Per-label call counters, reset only on app restart.
const counts: Record<string, number> = {};

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
  const t = new Date().toLocaleTimeString('fr-FR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (detail !== undefined) {
    console.log(`[ADMIN ${t}] #${n} ${label}`, detail);
  } else {
    console.log(`[ADMIN ${t}] #${n} ${label}`);
  }
}

/** Returns true only for the admin account — use to gate verbose sections. */
export function isAdminUser(): boolean {
  return isAdmin();
}
