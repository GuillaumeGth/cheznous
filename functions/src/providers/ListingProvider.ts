import { Listing, ProviderAlert, ProviderId } from '../types';

/**
 * Contract for a listings provider. Sync and callables only depend on this
 * interface, so a provider can be swapped or added (Jinka today, another
 * aggregator tomorrow) without touching the app or the Firestore feed format.
 *
 * Providers are alert-based: the user configures searches on the provider's
 * side and we read the results. Our own filters are applied later, client-side.
 */
export interface ListingProvider {
  readonly id: ProviderId;
  listAlerts(token: string): Promise<ProviderAlert[]>;
  /** Page is 1-based; `nbPages` is the provider's page count for that alert. */
  fetchAlertPage(token: string, alertId: string, page: number): Promise<ProviderAlertPage>;
}

export type ProviderAlertPage = {
  listings: Listing[];
  nbPages: number;
};

/** The alert no longer exists on the provider (deleted by the user). */
export class ProviderAlertNotFoundError extends Error {
  constructor(readonly alertId: string) {
    super(`Alert ${alertId} not found`);
    this.name = 'ProviderAlertNotFoundError';
  }
}

/** Token refused or expired — the admin must replace it. */
export class ProviderAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderAuthError';
  }
}
