# Architecture

## Stack technique

| Couche | Choix |
|---|---|
| Framework | Expo 56 (React Native 0.85, React 19) |
| Routing | Expo Router 56 (file-based) |
| Backend | Firebase (Firestore + Auth + Storage) |
| État global | Zustand 5 |
| Animations | React Native Reanimated 4 + Gesture Handler 2 |
| Notifications | Expo Notifications 56 |
| Auth sociale | expo-auth-session (Google OAuth) |
| Annonces | stream.estate API (fallback mock intégré) |
| TypeScript | 6.0, strict |

## Structure des dossiers

```
app/                        ← Expo Router (écrans)
  _layout.tsx               ← Root layout : auth listener + push token
  index.tsx                 ← Hub de redirection (auth → tabs)
  (auth)/
    _layout.tsx
    index.tsx               ← Login / Register / Google
    invite.tsx              ← Créer ou rejoindre un groupe de colocs
  (tabs)/
    _layout.tsx             ← Barre de navigation bas
    index.tsx               ← Écran swipe (fonctionnalité principale)
    matches.tsx             ← Matchs communs + mes likes
    profile.tsx             ← Profil, filtres, notifications, déco

src/
  components/               ← Composants UI réutilisables
    ConfirmSheet.tsx
    FilterSheet.tsx
    LikeCard.tsx
    ListingDetailSheet.tsx
    MatchCard.tsx
    NoteModal.tsx
    SwipeCard.tsx
    Toast.tsx
  hooks/                    ← Hooks de données (Firestore realtime)
    useCouple.ts
    useLikes.ts
    useListings.ts
    useMatches.ts
    useNewListingsNotify.ts
  lib/
    firebase.ts             ← Init Firebase (singleton)
    notifications.ts        ← Helpers push Expo
  services/
    listingsService.ts      ← Fetch stream.estate ou mock
  stores/
    authStore.ts            ← Zustand : user Firebase + profil + coupleId
    filterStore.ts          ← Zustand : listes de recherche + filtres
  types/
    index.ts                ← Tous les types TypeScript

assets/                     ← Icônes, splash, favicon
docs/                       ← Cette documentation
```

## Alias de chemin

`@/*` → `src/*` (configuré dans `babel.config.js` via `babel-plugin-module-resolver` et dans `tsconfig.json`).

## Flux de navigation

```
Démarrage
    │
    ▼
app/index.tsx ──── isLoading=true ──→ <ActivityIndicator>
    │
    ├── pas de firebaseUser ──────────→ /(auth)
    │
    ├── user sans coupleId ───────────→ /(auth)/invite
    │
    └── user + coupleId ──────────────→ /(tabs)
```

L'écouteur `onAuthStateChanged` dans `app/_layout.tsx` peuple `authStore` au démarrage et lors de chaque changement d'état auth. La redirection dans `app/index.tsx` est donc réactive.

## Cycle de vie d'un swipe

```
Utilisateur glisse → handleSwipe(direction)
  ├── pop()                          ← retire le listing du stack local
  └── recordSwipe(listing, dir)
        ├── setDoc(swipes/{uid}_{id})
        └── si direction === 'right'
              ├── checkForMatch(listing)
              │     ├── liste solo → createMatch() immédiatement
              │     └── liste partagée → query swipes des membres requis
              │           └── si tous ont liké → createMatch()
              └── si notify_on_partner_swipe → notifyColocs()
```

## Listes de recherche (SearchList)

Un groupe de colocs peut avoir plusieurs `SearchList`. Chaque liste a ses propres `SearchFilters` et peut être limitée à un sous-ensemble de membres (`member_ids`).

- **Liste partagée** (member_ids vide = tous les colocs) : match déclenché seulement quand tous les membres concernés ont right-swipé.
- **Liste solo** (member_ids = [uid]) : match automatique au right-swipe de la personne seule.
- **Liste sous-groupe** (member_ids = [uid1, uid2, ...]) : match quand tous les membres du sous-groupe ont right-swipé.

Les listes sont stockées dans le document `couples/{coupleId}` sous `search_lists[]` et `active_search_list_id`.

> **Note** : le nom de collection Firestore reste `couples` et le champ `coupleId` reste inchangé dans le code — c'est un détail d'implémentation historique. Conceptuellement, un "couple" désigne un **groupe de colocs** (2 membres ou plus).
