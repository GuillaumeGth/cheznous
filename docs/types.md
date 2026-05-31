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

## TransactionType

```ts
type TransactionType = 'rent' | 'buy'; // 'rent' = location, 'buy' = achat
```

## SearchFilters

Critères de filtrage appliqués aux annonces. Les bornes numériques sont des
**plages min/max** ; la valeur `0` signifie **« aucune borne »** (filtre inactif).

```ts
type SearchFilters = {
  transaction_type: TransactionType; // location ou achat
  arrondissements: number[];         // [] = tous
  price_min: number;                 // prix/loyer min ; 0 = pas de min
  price_max: number;                 // prix/loyer max ; 0 = pas de max
  surface_min: number;               // surface min (m²) ; 0 = pas de min
  surface_max: number;               // surface max (m²) ; 0 = pas de max
  rooms_min: number;                 // 0 = tous, 1 = studio+, etc.
};

const DEFAULT_FILTERS: SearchFilters = {
  transaction_type: 'rent',
  arrondissements: [],
  price_min: 0,
  price_max: 0,
  surface_min: 0,
  surface_max: 0,
  rooms_min: 0,
};
```

> **Sémantique du prix** : en location, `price_min`/`price_max` sont un **loyer
> mensuel** (€/mois) ; en achat, un **prix de vente total** (€). L'UI adapte le
> libellé (« Loyer » vs « Prix ») selon `transaction_type`.

## SearchList

Liste de recherche nommée portant ses propres filtres. Elle peut être attachée à tout ou partie des colocs du groupe.

```ts
type SearchList = {
  id: string;
  name: string;
  filters: SearchFilters;
  member_ids?: string[]; // undefined/vide = tous les colocs du groupe
                         // [uid] = liste solo (un seul coloc)
                         // [uid1, uid2] = sous-groupe de colocs
};
```

Un match est déclenché quand **tous les colocs ciblés** par la liste ont right-swipé le même listing.

## Couple (groupe de colocs)

Document Firestore représentant un groupe de colocs en recherche commune. Il peut contenir 2 membres ou plus — il n'y a pas de limite supérieure.

```ts
type Couple = {
  id: string;
  user1_id: string;           // créateur du groupe (legacy)
  user2_id: string | null;    // legacy, remplacé par member_ids
  member_ids: string[];       // liste authoritative de tous les colocs
  invite_code: string;        // code 6 chars (ex: "AB12CD") pour inviter d'autres colocs
  filters: SearchFilters;     // legacy, conservé pour migration
  search_lists: SearchList[];
  active_search_list_id: string;
  created_at: string;         // ISO date
};
```

> **Nommage** : le type et la collection s'appellent `Couple` / `couples` pour des raisons historiques. Conceptuellement, il s'agit d'un **groupe de colocs** — N personnes cherchant un logement ensemble.

## UserProfile

Profil Firestore de l'utilisateur (`users/{uid}`).

```ts
type UserProfile = {
  id: string;
  email: string;
  display_name: string;
  couple_id: string | null;    // ID du groupe de colocs auquel appartient l'utilisateur
  push_token: string | null;   // token Expo push
  photo_url: string | null;    // URL Firebase Storage
  notification_prefs: NotificationPrefs;
  created_at: string;          // ISO date
};
```

## NotificationPrefs

```ts
type NotificationPrefs = {
  notify_on_partner_swipe: boolean;  // notifier les colocs au like
  notify_on_new_listings: boolean;   // notifier quand nouvelles annonces
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  notify_on_partner_swipe: false,
  notify_on_new_listings: false,
};
```

## Match

Document Firestore créé quand tous les colocs ciblés par la liste active ont right-swipé le même listing.

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

Note personnelle d'un utilisateur sur un listing (visible par tous les colocs du groupe).

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

Tuple léger utilisé dans les composants pour afficher les membres du groupe.

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
