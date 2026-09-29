import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  AppError, connectProvider, disconnectProvider, linkSearchList, refreshProviderAlerts,
} from './accounts';
import { createJinkaProvider } from './providers/jinka/jinkaProvider';
import { firestoreFeedStore } from './store/firestoreFeedStore';
import { SyncDeps, syncFeeds } from './sync';

// Firestore is in eur3; keep functions close to it (and to Jinka).
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 });

initializeApp();

const deps: SyncDeps = {
  store: firestoreFeedStore(getFirestore()),
  providers: { jinka: createJinkaProvider() },
  now: () => new Date(),
};

function callable<R>(fn: (deps: SyncDeps, uid: string, data: unknown) => Promise<R>) {
  return onCall({ timeoutSeconds: 120 }, async (request: CallableRequest<unknown>) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise');
    try {
      return await fn(deps, uid, request.data);
    } catch (e) {
      if (e instanceof AppError) throw new HttpsError(e.code, e.message);
      logger.error('callable failed', { error: e instanceof Error ? e.message : String(e) });
      throw new HttpsError('internal', 'Erreur inattendue, réessaie plus tard');
    }
  });
}

export const connectListingProvider = callable(connectProvider);
export const disconnectListingProvider = callable(disconnectProvider);
export const refreshListingProviderAlerts = callable(refreshProviderAlerts);
export const linkSearchListToAlert = callable(linkSearchList);

export const syncListingFeeds = onSchedule(
  { schedule: 'every 20 minutes', timeZone: 'Europe/Paris', timeoutSeconds: 540 },
  async () => {
    logger.info('syncListingFeeds', await syncFeeds(deps));
  },
);

// Nightly full pass: expirations deep in the alerts + purge of old expired items.
export const sweepListingFeeds = onSchedule(
  { schedule: 'every day 04:00', timeZone: 'Europe/Paris', timeoutSeconds: 540 },
  async () => {
    logger.info('sweepListingFeeds', await syncFeeds(deps, undefined, 'sweep'));
  },
);
