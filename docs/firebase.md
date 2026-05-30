# Firebase

## Initialisation

Fichier : `src/lib/firebase.ts`

- Singleton : `getApps().length === 0` évite la double initialisation en hot-reload.
- Firestore initialisé avec `experimentalForceLongPolling: true` (requis React Native).
- Auth persistée via `AsyncStorage` (`getReactNativePersistence`).
- Exports : `db`, `auth`, `storage`, `GoogleAuthProvider`.

Config Firebase (projet `swipemyflat`) :

```
projectId:         swipemyflat
authDomain:        swipemyflat.firebaseapp.com
storageBucket:     swipemyflat.firebasestorage.app
messagingSenderId: 967416784277
appId:             1:967416784277:web:aa9751713c003f501d029c
```

## Collections Firestore

### `users/{uid}`

| Champ | Type | Notes |
|---|---|---|
| id | string | = uid Firebase Auth |
| email | string | |
| display_name | string | |
| couple_id | string \| null | null jusqu'à la création/rejoindre |
| push_token | string \| null | token Expo push |
| photo_url | string \| null | URL Firebase Storage |
| notification_prefs | NotificationPrefs | |
| created_at | string | ISO date |

### `couples/{coupleId}`

| Champ | Type | Notes |
|---|---|---|
| id | string | = doc ID auto |
| user1_id | string | créateur |
| user2_id | string \| null | null jusqu'à ce que le partenaire rejoigne |
| invite_code | string | 6 chars uppercase alphanum |
| filters | SearchFilters | legacy, remplacé par search_lists |
| search_lists | SearchList[] | listes de recherche nommées |
| active_search_list_id | string | ID de la liste active |
| created_at | string | ISO date |

### `listings/{listingId}`

Cache côté client. Le premier utilisateur qui fetch une annonce l'écrit ici (`setDoc merge: true`). Les deux partenaires lisent depuis cette collection pour voir les mêmes données.

Champs : tous les champs du type `Listing` + potentiellement `fetched_at` (utilisé par `useNewListingsNotify`).

### `swipes/{uid}_{listingId}`

| Champ | Type | Notes |
|---|---|---|
| user_id | string | UID de l'auteur |
| listing_id | string | |
| couple_id | string | |
| direction | 'left' \| 'right' | |
| created_at | string | ISO date |

ID composé garantit une entrée unique par utilisateur par listing.

### `matches/{coupleId}_{listingId}`

| Champ | Type | Notes |
|---|---|---|
| couple_id | string | |
| listing_id | string | |
| listing | Listing | snapshot dénormalisé |
| matched_at | string | ISO date |
| status | 'new' \| 'contacted' \| 'visited' \| 'rejected' | géré depuis l'écran matches |

### `notes/{uid}_{listingId}`

| Champ | Type | Notes |
|---|---|---|
| user_id | string | |
| listing_id | string | |
| couple_id | string | |
| text | string | max 300 chars |
| created_at | string | ISO date |

## Règles de sécurité

Fichier : `firestore.rules`

| Collection | Lire | Écrire |
|---|---|---|
| users | propriétaire uniquement | propriétaire uniquement |
| couples | membre OU couple ouvert (pour lookup invite) | membre ; tout auth pour créer ; tout auth pour rejoindre un couple ouvert (contraintes strictes) |
| listings | tout auth | tout auth |
| swipes | tout auth | propriétaire uniquement (user_id == auth.uid) |
| matches | tout auth | tout auth |

**Note sécurité** : la collection `notes` n'a pas de règle explicite dans le fichier actuel — à ajouter.

### Règle join couple (détail)

Pour rejoindre un couple, la règle vérifie :
1. `resource.data.user2_id == null` (couple pas encore complet)
2. `request.resource.data.user2_id == request.auth.uid` (on se met soi-même)
3. `user1_id` et `invite_code` restent inchangés

## Index Firestore

Fichier : `firestore.indexes.json`

```json
{
  "collectionGroup": "matches",
  "fields": [
    { "fieldPath": "couple_id", "order": "ASCENDING" },
    { "fieldPath": "matched_at", "order": "DESCENDING" }
  ]
}
```

Utilisé par la query dans `useMatches` : `where('couple_id', '==', coupleId)` + tri par `matched_at` décroissant.

## Firebase Storage

Utilisé uniquement pour les avatars : `avatars/{uid}.jpg`. Upload depuis `app/(tabs)/profile.tsx` via `expo-image-picker`.
