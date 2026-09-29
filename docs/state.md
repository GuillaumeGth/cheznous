# État global et hooks de données

## Stores Zustand

### authStore (`src/stores/authStore.ts`)

État d'authentification. Peuplé par l'écouteur `onAuthStateChanged` dans `app/_layout.tsx`.

```ts
type AuthState = {
  firebaseUser: User | null;    // objet Firebase Auth
  profile: UserProfile | null;  // doc Firestore users/{uid}
  coupleId: string | null;      // raccourci depuis profile.couple_id
  isLoading: boolean;           // true pendant l'init auth (splash)
  // setters
  setFirebaseUser(user)
  setProfile(profile)
  setCoupleId(id)
  setLoading(loading)
  reset()                       // appelé au sign-out
};
```

**Comportement au démarrage** : `isLoading` démarre à `true`. L'écouteur auth le passe à `false` après avoir résolu l'état (connecté ou non). `app/index.tsx` affiche un spinner tant que `isLoading` est vrai.

### filterStore (`src/stores/filterStore.ts`)

Gestion des listes de recherche et des filtres actifs. Synchronisé avec Firestore.

```ts
type FilterState = {
  searchLists: SearchList[];
  activeListId: string;
  filters: SearchFilters;       // filtres de la liste active (raccourci)

  setSearchLists(lists, activeId)   // appelé par useCouple au mount
  setFilters(filters)               // mise à jour locale sans sync
  syncFilters(coupleId, filters, listId?)  // écrit dans Firestore
  addList(coupleId, name, memberIds)       // crée une nouvelle liste
  removeList(coupleId, id)                 // supprime une liste
  setActiveList(coupleId, id)             // change la liste active
};
```

**Persistance** : toutes les mutations écrivent dans `couples/{coupleId}` via `pushToFirestore` (helper interne). Tous les colocs du groupe voient les mêmes listes grâce au listener realtime dans `useCouple`.

**Liste par défaut** : `DEFAULT_LIST` (id `'default'`, nom `'Ma recherche'`, filtres par défaut). Injectée si la migration depuis l'ancien champ `filters` est nécessaire.

---

## Hooks de données

### useCouple (`src/hooks/useCouple.ts`)

- Souscrit en **realtime** (`onSnapshot`) au document `couples/{coupleId}`.
- Met à jour `filterStore` avec les listes de recherche à chaque changement.
- Assure la **migration** : si `search_lists` est absent, crée une liste default à partir de l'ancien champ `filters`.
- Fetch en one-shot les profils de **tous les autres colocs** (N-1) via `getDoc`.

```ts
const { couple, memberProfiles } = useCouple();
// memberProfiles: UserProfile[] — tous les colocs sauf soi-même
```

### useListings (`src/hooks/useListings.ts`)

Wrapper du store `listingsStore` (singleton module, survit au démontage de l'écran).

- `refresh(force?)` : repart de la première page. Throttlé 30 min pour une même clé `groupId|listId|filters`, sauf `force=true` ou erreur précédente.
- `loadMore()` : page suivante via `getListingsDataSource()` (curseur opaque) ; exclut les annonces déjà swipées dans la recherche.
- `error` : `{ code, message }` ; bloque l'auto-pagination jusqu'au prochain refresh.
- `queryKey` : change avec le groupe, la recherche active ou ses filtres → l'écran swipe force un refresh.
- `refreshListingsIfActive(listId)` : recharge la pile après liaison d'une alerte (`FeedSourcePicker`) ou un refetch manuel (`ProviderAccountSection`).

```ts
const { stack, isLoading, error, loadMore, refresh, pop, pushBack, queryKey } = useListings();
```

Voir [services.md](services.md) pour les sources (flux Jinka / mock).

### useFeedLink / useProviderAccount

- `useFeedLink(groupId, listId)` : `onSnapshot` sur `groups/{g}/feeds/{listId}` → `FeedLink | null | undefined` (chargement).
- `useProviderAccount()` : `onSnapshot` sur `users/{uid}/provider_accounts/jinka` → `ProviderAccount | null | undefined`.

### useMatches (`src/hooks/useMatches.ts`)

- Souscrit en realtime à `matches` filtré par `couple_id`.
- Trie par `matched_at` décroissant.

```ts
const { matches, isLoading } = useMatches();
```

### useLikes (`src/hooks/useLikes.ts`)

- Souscrit en realtime à `swipes` filtré par `user_id`.
- Filtre côté client les swipes `direction === 'right'`.
- Fetch le document `Listing` pour chaque like.

```ts
const { likes, isLoading } = useLikes();
// likes: Like[] = { id, listing_id, listing, liked_at }[]
```

### useNewListingsNotify (`src/hooks/useNewListingsNotify.ts`)

- S'abonne aux événements `AppState` (foreground / background).
- Au retour en foreground, lit les items du flux de la **recherche active** ajoutés depuis le dernier check (`added_at >= since`).
- Ignore les items expirés et applique les filtres courants (`matchesFilters`).
- Si des annonces correspondent, déclenche une notification locale via `scheduleNewListingsNotification`.
- N'opère que si `notify_on_new_listings` est activé dans le profil.
