# Service d'annonces

Fichier : `src/services/listingsService.ts`

## Point d'entrée

```ts
fetchListings(filters: SearchFilters, page = 1): Promise<Listing[]>
```

Retourne 10 listings par page. Bascule automatiquement :
- Si `EXPO_PUBLIC_STREAM_ESTATE_KEY` est défini → **stream.estate**
- Sinon → **mock generator**

---

## stream.estate

Endpoint : `GET https://api.stream.estate/documents/properties`

**Paramètres** :

| Paramètre | Valeur |
|---|---|
| transactionType | `1` (location) |
| propertyTypes[] | `0` (appartement) |
| budgetMax | `filters.price_max` |
| surfaceMin | `filters.surface_min` |
| roomMin | `filters.rooms_min` (si > 0) |
| page | page courante |
| itemsPerPage | `10` |
| includedZipcodes[] | codes postaux `7500X` des arrondissements sélectionnés (ou les 20 si aucun filtre) |

**Auth** : header `X-API-KEY`.

**Mapping** `mapStreamEstateListing(raw)` : normalise la réponse API vers le type `Listing`. Le champ `arrondissement` est extrait des 2 derniers chiffres du code postal via `extractArrondissement`.

---

## Mock generator

Génère 10 listings déterministes basés sur les filtres et la page.

- Arrondissements : ceux filtrés, ou tous 1-20.
- Surface : `max(surface_min, 20 + rooms*15 + random*20)`.
- Prix : calculé par arrondissement + pièces + aléatoire, cappé à `price_max`.
- Images : pool de 8 URLs Unsplash, décalées par page (`imageOffset = (page*10+i) % 8`).
- IDs : `mock-{page}-{i}-{timestamp}` (uniques entre refreshes).

Utile en développement sans clé API.

---

## Cache Firestore

Après chaque fetch (réel ou mock), `useListings` écrit chaque listing dans `listings/{id}` via `setDoc(doc, data, { merge: true })`. Cela permet :

1. Aux deux partenaires de voir exactement les mêmes données pour la détection de match.
2. À `useNewListingsNotify` de requêter les nouvelles annonces par `fetched_at`.

> **Note** : le champ `fetched_at` n'est pas ajouté par `listingsService` lui-même — il devrait l'être si `useNewListingsNotify` doit fonctionner correctement avec de vraies données.
