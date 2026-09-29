import { Listing, SearchFilters } from '@/types';
import { alog } from '@/lib/adminLogger';
import { ListingsDataSource, ListingsPage } from '../types';

type MockCursor = { page: number };

export const MOCK_PAGE_SIZE = 20;

const PARIS_STREETS = [
  'Rue de Rivoli', 'Boulevard Haussmann', 'Rue du Faubourg Saint-Antoine',
  'Avenue des Champs-Élysées', 'Rue de la Paix', 'Boulevard Saint-Germain',
  'Rue Montorgueil', 'Rue Oberkampf', 'Avenue de Breteuil',
  'Rue de la Roquette', 'Boulevard Voltaire', 'Rue du Temple',
  'Rue de Turbigo', 'Rue Rambuteau', 'Avenue Daumesnil',
  'Rue de Charonne', 'Boulevard de Belleville', 'Rue de Ménilmontant',
];

const LISTING_IMAGES = [
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
  'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800',
  'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800',
];

// Offline source for dev (EXPO_PUBLIC_LISTINGS_SOURCE=mock): random Paris
// listings that honour the filters. Never runs out of pages.
export const mockDataSource: ListingsDataSource = {
  id: 'mock',
  kind: 'local',
  async fetchPage({ filters }, cursor): Promise<ListingsPage> {
    const page = (cursor as MockCursor | null)?.page ?? 1;
    return { listings: generateMockListings(filters, page), nextCursor: { page: page + 1 } };
  },
};

function generateMockListings(filters: SearchFilters, page: number): Listing[] {
  alog('MOCK:generateListings', { page });
  return Array.from({ length: MOCK_PAGE_SIZE }, (_, i) => {
    const arr = Math.floor(Math.random() * 20) + 1;
    const rooms = Math.max(filters.rooms_min || 1, Math.floor(Math.random() * 3) + 1);
    const rawSurface = 20 + rooms * 15 + Math.floor(Math.random() * 20);
    const surface = Math.max(
      filters.surface_min > 0 ? filters.surface_min : 0,
      filters.surface_max > 0 ? Math.min(rawSurface, filters.surface_max) : rawSurface,
    );
    const basePrice = 800 + arr * 40 + rooms * 200 + Math.floor(Math.random() * 200);
    let price = filters.price_max > 0 ? Math.min(basePrice, filters.price_max) : basePrice;
    if (filters.price_min > 0 && price < filters.price_min) price = filters.price_min;
    const streetNum = Math.floor(Math.random() * 120) + 1;
    const street = PARIS_STREETS[Math.floor(Math.random() * PARIS_STREETS.length)];
    const imageOffset = (page * 10 + i) % LISTING_IMAGES.length;

    return {
      id: `mock-${page}-${i}-${Date.now()}`,
      title: `${rooms === 1 ? 'Studio' : `${rooms} pièces`} — ${surface}m² — ${arr}ème`,
      price,
      charges: Math.floor(price * 0.08),
      surface,
      rooms,
      floor: Math.floor(Math.random() * 6),
      address: `${streetNum} ${street}, Paris ${arr}ème`,
      arrondissement: arr,
      images: [
        LISTING_IMAGES[imageOffset],
        LISTING_IMAGES[(imageOffset + 1) % LISTING_IMAGES.length],
        LISTING_IMAGES[(imageOffset + 2) % LISTING_IMAGES.length],
      ],
      description: `Bel appartement ${rooms === 1 ? 'studio' : `${rooms} pièces`} de ${surface}m² au cœur du ${arr}ème arrondissement. ` +
        `Lumineux, en bon état général. ${Math.random() > 0.5 ? 'Avec ascenseur.' : 'Sans ascenseur.'}`,
      url: 'https://seloger.com',
      source: 'mock',
      has_elevator: Math.random() > 0.5,
      has_parking: Math.random() > 0.8,
      has_balcony: Math.random() > 0.6,
      has_terrace: Math.random() > 0.85,
      available_from: new Date().toISOString(),
      deposit: price * 2,
      lat: 48.85 + (Math.random() - 0.5) * 0.1,
      lng: 2.35 + (Math.random() - 0.5) * 0.1,
      expired_at: null,
    };
  });
}
