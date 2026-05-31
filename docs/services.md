# Service d'annonces

Fichier : `src/services/listingsService.ts`

## Point d'entrée

```ts
fetchListings(filters: SearchFilters, page = 1): Promise<Listing[]>
```

Retourne `PAGE_SIZE` (= 50) listings par page. Bascule automatiquement :
- Si `EXPO_PUBLIC_STREAM_ESTATE_KEY` est défini → **stream.estate**
- Sinon → **mock generator**

---

## stream.estate

Endpoint : `GET https://api.stream.estate/documents/properties`

**Paramètres** :

Les bornes numériques ne sont envoyées que si elles sont `> 0` — une valeur à `0`
laisse le critère ouvert côté API.

| Paramètre | Valeur |
|---|---|
| transactionType | `1` (location) ou `2` (achat) selon `filters.transaction_type` |
| propertyTypes[] | `0` (appartement) |
| budgetMin | `filters.price_min` (si > 0) |
| budgetMax | `filters.price_max` (si > 0) |
| surfaceMin | `filters.surface_min` (si > 0) |
| surfaceMax | `filters.surface_max` (si > 0) |
| roomMin | `filters.rooms_min` (si > 0) |
| page | page courante |
| itemsPerPage | `PAGE_SIZE` (= 50) |
| includedZipcodes[] | codes postaux `7500X` des arrondissements sélectionnés (ou les 20 si aucun filtre) |

> **Codes `transactionType`** : `1` = location (valeur historique de l'app), `2` = achat.
> Le code achat est à confirmer avec la doc stream.estate (cf. `STREAM_TRANSACTION_TYPE`).

**Auth** : header `X-API-KEY`.

**Mapping** `mapStreamEstateListing(raw)` : normalise la réponse API vers le type `Listing`. Le champ `arrondissement` est extrait des 2 derniers chiffres du code postal via `extractArrondissement`.

---

## Mock generator

Génère `PAGE_SIZE` (= 50) listings basés sur les filtres et la page.

- Arrondissements : ceux filtrés, ou tous 1-20.
- Surface : surface aléatoire bornée par `surface_min`/`surface_max` (chacun ignoré si `0`).
- Prix : calculé par arrondissement + pièces + aléatoire, cappé à `price_max` si `> 0`.
  Le mock n'applique **pas** `price_min`.
- `transaction_type` n'a aucun effet sur le mock (mêmes données pour location/achat).
- Images : pool de 8 URLs Unsplash, décalées par page (`imageOffset = (page*10+i) % 8`).
- IDs : `mock-{page}-{i}-{timestamp}` (uniques entre refreshes).

Utile en développement sans clé API.

---

## Cache Firestore

Après chaque fetch (réel ou mock), `useListings` écrit chaque listing dans `listings/{id}` via `setDoc(doc, data, { merge: true })`. Cela permet :

1. Aux deux partenaires de voir exactement les mêmes données pour la détection de match.
2. À `useNewListingsNotify` de requêter les nouvelles annonces par `fetched_at`.

> **Note** : le champ `fetched_at` n'est pas ajouté par `listingsService` lui-même — il devrait l'être si `useNewListingsNotify` doit fonctionner correctement avec de vraies données.
