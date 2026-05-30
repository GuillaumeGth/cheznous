# Types TypeScript

Fichier source : `src/types/index.ts`

## Listing

Représente une annonce immobilière.

```ts
type Listing = {
  id: string;
  title: string;
  price: number;          // loyer hors charges (€/mois)
  charges: number;        // charges mensuelles (€)
  surface: number;        // m²
  rooms: number;          // 1 = studio
  floor: number | null;
  address: string;
  arrondissement: number; // 1-20
  images: string[];       // URLs
  description: string;
  url: string;            // lien vers l'annonce originale
  source: string;         // 'stream.estate' | 'mock'
  has_elevator: boolean;
  has_parking: boolean;
  has_balcony: boolean;
  has_terrace: boolean;
  available_from: string; // ISO date
  deposit: number;        // dépôt de garantie (€)
  lat: number | null;
  lng: number | null;
};
```

## SearchFilters

Critères de filtrage appliqués aux annonces.

```ts
type SearchFilters = {
  arrondissements: number[]; // [] = tous
  price_max: number;         // loyer max (€/mois)
  surface_min: number;       // surface min (m²)
  rooms_min: number;         // 0 = tous, 1 = studio+, etc.
};

const DEFAULT_FILTERS: SearchFilters = {
  arrondissements: [],
  price_max: 2500,
  surface_min: 25,
  rooms_min: 0,
};
```

## SearchList

Liste de recherche nommée portant ses propres filtres.

```ts
type SearchList = {
  id: string;
  name: string;
  filters: SearchFilters;
  member_ids?: string[]; // undefined/vide = tous les membres du couple
};
```

## Couple

Document Firestore représentant la paire de partenaires.

```ts
type Couple = {
  id: string;
  user1_id: string;
  user2_id: string | null;  // null = partenaire pas encore rejoint
  invite_code: string;      // code 6 chars (ex: "AB12CD")
  filters: SearchFilters;   // legacy, conservé pour migration
  search_lists: SearchList[];
  active_search_list_id: string;
  created_at: string;       // ISO date
};
```

## UserProfile

Profil Firestore de l'utilisateur (`users/{uid}`).

```ts
type UserProfile = {
  id: string;
  email: string;
  display_name: string;
  couple_id: string | null;
  push_token: string | null;   // token Expo push
  photo_url: string | null;    // URL Firebase Storage
  notification_prefs: NotificationPrefs;
  created_at: string;          // ISO date
};
```

## NotificationPrefs

```ts
type NotificationPrefs = {
  notify_partner_on_swipe: boolean;  // notifier partenaire au like
  notify_on_new_listings: boolean;   // notifier quand nouvelles annonces
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  notify_partner_on_swipe: false,
  notify_on_new_listings: false,
};
```

## Match

Document Firestore créé quand les deux partenaires ont right-swipé le même listing.

```ts
type Match = {
  id: string;            // "{coupleId}_{listingId}"
  couple_id: string;
  listing_id: string;
  listing: Listing;      // snapshot dénormalisé au moment du match
  matched_at: string;    // ISO date
  status: 'new' | 'contacted' | 'visited' | 'rejected';
};
```

## Note

Note personnelle d'un utilisateur sur un listing (visible par son partenaire).

```ts
type Note = {
  user_id: string;
  listing_id: string;
  couple_id: string;
  text: string;          // max 300 chars
  created_at: string;    // ISO date
};
```

## CoupleMember

Tuple léger utilisé dans les composants pour afficher les membres.

```ts
type CoupleMember = {
  uid: string;
  displayName: string;
};
```

## SwipeDirection

```ts
type SwipeDirection = 'left' | 'right';
```
