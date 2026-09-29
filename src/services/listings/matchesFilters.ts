import { Listing, SearchFilters } from '@/types';

type FilterableListing = Pick<Listing, 'arrondissement' | 'price' | 'surface' | 'rooms'>;

/**
 * Client-side equivalent of `SearchFilters` (numeric bounds: `0` = no
 * restriction). Used by providers that can't filter server-side and by the
 * new-listings notifier.
 */
export function matchesFilters(listing: FilterableListing, filters: SearchFilters): boolean {
  const { arrondissements, price_min, price_max, surface_min, surface_max, rooms_min } = filters;
  if (arrondissements.length > 0 && !arrondissements.includes(listing.arrondissement)) return false;
  if (price_min > 0 && listing.price < price_min) return false;
  if (price_max > 0 && listing.price > price_max) return false;
  if (surface_min > 0 && listing.surface < surface_min) return false;
  if (surface_max > 0 && listing.surface > surface_max) return false;
  if (rooms_min > 0 && listing.rooms < rooms_min) return false;
  return true;
}
