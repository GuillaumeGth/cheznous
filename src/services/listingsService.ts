import { Listing, SearchFilters } from '@/types';

// Number of listings fetched per API call / per page. Keep useListings'
// short-page detection in sync by importing this constant there.
export const PAGE_SIZE = 50;

// Configure your API key here
const STREAM_ESTATE_API_KEY = process.env.EXPO_PUBLIC_STREAM_ESTATE_KEY ?? '';
const FLUXIMMO_API_KEY = process.env.EXPO_PUBLIC_FLUXIMMO_KEY ?? '';

export async function fetchListings(filters: SearchFilters, page = 1): Promise<Listing[]> {
  if (STREAM_ESTATE_API_KEY) {
    return fetchFromStreamEstate(filters, page);
  }
  return generateMockListings(filters, page);
}

// stream.estate transactionType codes. '1' = location is the value the app has
// always sent; '2' = achat (vente) — à confirmer avec la doc stream.estate.
const STREAM_TRANSACTION_TYPE: Record<SearchFilters['transaction_type'], string> = {
  rent: '1',
  buy: '2',
};

async function fetchFromStreamEstate(filters: SearchFilters, page: number): Promise<Listing[]> {
  const params = new URLSearchParams({
    transactionType: STREAM_TRANSACTION_TYPE[filters.transaction_type] ?? '1',
    'propertyTypes[]': '0',
    ...(filters.price_min > 0 && { budgetMin: String(filters.price_min) }),
    ...(filters.price_max > 0 && { budgetMax: String(filters.price_max) }),
    ...(filters.surface_min > 0 && { surfaceMin: String(filters.surface_min) }),
    ...(filters.surface_max > 0 && { surfaceMax: String(filters.surface_max) }),
    ...(filters.rooms_min > 0 && { roomMin: String(filters.rooms_min) }),
    page: String(page),
    itemsPerPage: String(PAGE_SIZE),
  });

  const zipcodes = filters.arrondissements.length > 0
    ? filters.arrondissements.map(a => `750${String(a).padStart(2, '0')}`)
    : Array.from({ length: 20 }, (_, i) => `750${String(i + 1).padStart(2, '0')}`);

  zipcodes.forEach(z => params.append('includedZipcodes[]', z));

  const res = await fetch(`https://api.stream.estate/documents/properties?${params}`, {
    headers: { 'X-API-KEY': STREAM_ESTATE_API_KEY },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Fall back to mock data on billing/quota errors so the app stays usable
    if (res.status === 403 || res.status === 402 || res.status === 429) {
      console.warn(`stream.estate unavailable (${res.status}), using mock data`);
      return generateMockListings(filters, page);
    }
    throw new Error(`stream.estate error: ${res.status} — ${body}`);
  }

  const data = await res.json();
  return (data['hydra:member'] ?? []).map(mapStreamEstateListing);
}

function mapStreamEstateListing(raw: any): Listing {
  const advert = raw.adverts?.[0];
  const zipcode: string = raw.city?.zipcode ?? '';
  return {
    id: raw.uuid ?? String(raw['@id']),
    title: raw.title ?? advert?.title ?? `${raw.room ?? '?'}p — ${raw.surface ?? '?'}m²`,
    price: raw.price ?? advert?.price ?? 0,
    charges: advert?.charges ?? 0,
    surface: raw.surface ?? 0,
    rooms: raw.room ?? 1,
    floor: raw.floor ?? null,
    address: raw.city?.name ? `${raw.city.name} ${zipcode}` : 'Paris',
    arrondissement: extractArrondissement(zipcode),
    images: raw.pictures?.map((p: any) => p.url ?? p) ?? advert?.pictures?.map((p: any) => p.url ?? p) ?? [],
    description: raw.description ?? advert?.description ?? '',
    url: advert?.url ?? '',
    source: 'stream.estate',
    has_elevator: raw.elevator ?? false,
    has_parking: false,
    has_balcony: false,
    has_terrace: false,
    available_from: raw.createdAt ?? new Date().toISOString(),
    deposit: 0,
    lat: raw.locations?.lat ?? null,
    lng: raw.locations?.lon ?? null,
  };
}

function extractArrondissement(zipCode?: string): number {
  if (!zipCode) return 1;
  const num = parseInt(zipCode.slice(-2), 10);
  return num >= 1 && num <= 20 ? num : 1;
}

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

function generateMockListings(filters: SearchFilters, page: number): Listing[] {
  const arrondissements = filters.arrondissements.length > 0
    ? filters.arrondissements
    : Array.from({ length: 20 }, (_, i) => i + 1);

  return Array.from({ length: PAGE_SIZE }, (_, i) => {
    const arr = arrondissements[Math.floor(Math.random() * arrondissements.length)];
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
    };
  });
}
