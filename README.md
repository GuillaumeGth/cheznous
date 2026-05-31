# Chez Nous 🏠

**Chez Nous** est une application mobile de recherche d'appartement pour colocataires (colocs) à Paris.

Un groupe de N personnes lient leurs comptes, swipent indépendamment sur des annonces, et obtiennent un **match** lorsque tous les membres ciblés d'une liste de recherche likent la même annonce — dans le même critère de recherche.

> Construit avec **Expo (SDK 56)**, **React Native 0.85**, **React 19**, **Expo Router** et **Firebase**.

---

## Table des matières

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Lancer l'application](#lancer-lapplication)
- [Tests](#tests)
- [Architecture](#architecture)
  - [Routing](#routing-expo-router)
  - [State management](#state-management-zustand)
  - [Firebase / Firestore](#firebase--firestore)
  - [Pipeline des annonces](#pipeline-des-annonces)
  - [Chat](#chat)
  - [Notifications](#notifications)
- [Conventions de code](#conventions-de-code)
- [Structure du projet](#structure-du-projet)

---

## Fonctionnalités

- 🔐 **Authentification** — email/mot de passe + connexion Google (via `expo-auth-session`)
- 👥 **Groupes / colocs** — créer ou rejoindre un groupe via un code d'invitation, multi-groupes supportés
- 🃏 **Swipe** — parcourir les annonces façon Tinder (like / dislike)
- ❤️ **Matchs** — un match est créé quand tous les membres ciblés d'une liste likent la même annonce
- 💬 **Chat** — messagerie temps réel par match et par groupe, avec pièces jointes (images & fichiers)
- 📝 **Notes** — notes partagées sur les annonces
- 🔎 **Filtres de recherche** — type de transaction, arrondissements, prix, surface, nombre de pièces
- 🔔 **Notifications push** — swipe d'un partenaire, nouvelles annonces, messages de chat

---

## Stack technique

| Domaine | Techno |
|---|---|
| Framework | Expo SDK 56, React Native 0.85.3, React 19.2.3 |
| Navigation | Expo Router 56 (file-based) |
| Backend | Firebase 12 (Auth, Firestore, Storage) |
| State | Zustand 5 |
| Data fetching | TanStack React Query 5 |
| Langage | TypeScript 6 |
| Auth Google | `expo-auth-session` + `expo-web-browser` |
| Notifications | `expo-notifications` (Expo Push API) |
| Médias | `expo-image-picker` (+ `expo-document-picker`, peer optionnel) |
| Tests | Jest + `jest-expo` |

> L'application utilise l'**ancienne architecture** RN (`newArchEnabled: false` dans `app.json`).

---

## Prérequis

- **Node.js** 20+ et npm (testé avec Node 22)
- **Expo CLI** (via `npx`, pas d'installation globale nécessaire)
- Un projet **Firebase** (Auth + Firestore + Storage activés) — config dans `src/lib/firebase.ts`, projet `swipemyflat` défini dans `.firebaserc`
- Pour les notifications push & Google Sign-In : un **dev build** ou un appareil réel (non disponible sur simulateur)
- Optionnel : une clé API **stream.estate** pour les vraies annonces (sinon, données mock)

---

## Installation

```bash
git clone <repo-url>
cd cheznous
npm install
```

Crée ensuite un fichier `.env` à la racine (voir section suivante).

> Les dossiers natifs `/ios` et `/android` sont générés (gitignorés). `npm run ios` / `npm run android` les régénèrent au besoin via `expo run:*`.

---

## Variables d'environnement

Crée un fichier `.env` à la racine. Le préfixe `EXPO_PUBLIC_` rend les variables accessibles côté client.

```bash
EXPO_PUBLIC_STREAM_ESTATE_KEY=     # Clé API stream.estate ; omettre pour utiliser les données mock
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=  # ID client OAuth web (Google Sign-In)
EXPO_PUBLIC_FLUXIMMO_KEY=          # Réservé, pas encore branché
```

La configuration Firebase est initialisée dans `src/lib/firebase.ts`. Sur Android, `google-services.json` est requis (référencé dans `app.json`).

---

## Lancer l'application

```bash
npm start                # serveur de dev Expo (= expo start)
npm run ios              # build natif + simulateur/appareil iOS (expo run:ios)
npm run android          # build natif + émulateur/appareil Android (expo run:android)
npm run web              # version web (expo start --web)
```

ou directement :

```bash
npx expo start
npx expo start --ios
npx expo start --android
npx expo start --web
```

---

## Tests

Tests unitaires avec Jest (preset `jest-expo`) :

```bash
npm test
```

Les tests vivent dans `src/__tests__/`, `src/hooks/__tests__/` et `src/services/__tests__/`. Le path alias `@/*` est mappé vers `src/*` dans la config Jest.

> Il n'y a **pas** de script de lint configuré.

---

## Architecture

### Path alias

`@/*` résout vers `src/*` (configuré dans `babel.config.js` via `module-resolver`, dans `tsconfig.json`, et dans la config Jest).

### Routing (Expo Router file-based)

```
app/
  _layout.tsx              ← racine : listener auth Firebase, enregistrement du push token
  index.tsx                ← hub de redirection (voir flow ci-dessous)
  (auth)/
    _layout.tsx
    index.tsx              ← email/mdp + connexion Google, crée le doc user Firestore
    invite.tsx             ← rejoindre via un lien/code d'invitation
  groups/
    _layout.tsx
    index.tsx              ← créer ou rejoindre un groupe (étape post-auth si pas de groupe)
    [id].tsx               ← détail d'un groupe (membres, invitations…)
  (tabs)/
    _layout.tsx
    index.tsx              ← écran de swipe (fonctionnalité principale)
    matches.tsx            ← liste des annonces matchées
    chat.tsx               ← liste des conversations
    profile.tsx            ← réglages, préférences de notification, déconnexion
  chat/
    [matchId].tsx          ← chat par match (s'affiche par-dessus la tab bar)
  group-chat/
    [groupId].tsx          ← chat de groupe
```

**Flow de navigation** — `app/index.tsx` lit le `authStore` (sélecteurs atomiques) et redirige via `<Redirect>` :

- `isLoading` → écran de chargement (spinner)
- Pas d'utilisateur Firebase → `/(auth)`
- Utilisateur sans `groupId` → `/(auth)/invite` (créer ou rejoindre un groupe)
- Utilisateur + `groupId` → `/(tabs)`

### State management (Zustand)

Stores dans `src/stores/` :

- **`authStore`** — `firebaseUser`, `profile` (UserProfile), `groupId`, `isLoading` (+ setters et `reset`). Alimenté par le listener `onAuthStateChanged` dans `app/_layout.tsx`. `groupId` correspond au groupe actif (en multi-groupes).
- **`filterStore`** — `filters` (SearchFilters), `syncFilters(...)` qui écrit dans Firestore. Les filtres sont chargés depuis le doc du groupe via `useCouple` au montage.
- **`listingsStore`** — état de la pile d'annonces côté swipe.

### Firebase / Firestore

Init singleton dans `src/lib/firebase.ts` avec `experimentalForceLongPolling: true` (requis pour React Native) et persistance d'auth via AsyncStorage. Règles dans `firestore.rules` / `storage.rules`, index dans `firestore.indexes.json`.

**Collections principales :**

| Collection | Doc ID | Notes |
|---|---|---|
| `users` | `{uid}` | UserProfile ; `push_token` ici. Appartenance au groupe dans le champ `couple_id` (= groupId actif) |
| `groups` | auto | `name`, `member_ids[]`, `invite_code`, `search_lists[]` (chaque liste a ses `filters`, un sous-groupe `member_ids` optionnel, `cover_photo_url`), `active_search_list_id` |
| `groups/{id}/messages` | auto | `GroupMessage` ; chat de groupe (texte / système / partage d'annonce) |
| `notes` | `{uid}_{listingId}` | Note d'un membre sur une annonce ; lues ensemble pour tous les membres (`useListingNotes`) |
| `group_invitations` | auto | Invitations de groupe (pending / accepted / rejected) |
| `follows` | `{follower_id}_{following_id}` | Relations de suivi entre utilisateurs |
| `listings` | `{listingId}` | Mises en cache par le premier client qui les fetch ; lues par tous les membres |
| `swipes` | `{uid}_{listId}_{listingId}` | Un doc par utilisateur **par liste de recherche** par annonce |
| `matches` | `{groupId}_{listId}_{listingId}` | Créé côté client (`couple_id`, `search_list_id`, `listing_id`, `listing`, `matched_at`, `status`) |
| `matches/{id}/messages` | auto | `ChatMessage` ; chat par match |
| `crash_reports` | auto | Rapports d'erreur client |

**Logique de match** (`src/hooks/useSwipeActions.ts → checkForMatch`) : les `swipes` et `matches` sont **scopés par `search_list_id`** — une même annonce peut être swipée indépendamment dans deux listes. Après un like, les participants ciblés sont le sous-groupe `member_ids` de la liste (ou tous les membres si non défini). Avec `min_likes: 0`, le match exige l'**unanimité** des participants ciblés ; sinon il faut `min_likes` likes au total. Une liste solo matche immédiatement. Tout se passe **côté client**.

> Les `filters` (dont `min_likes`) vivent **par liste de recherche** (`SearchList.filters`), pas par groupe. En multi-groupes, `groupId` (dans `authStore`) correspond au groupe actif.

> ⚠️ Les règles Firestore déployées peuvent diverger du repo — pense à les **déployer manuellement** après édition (`firebase deploy --only firestore:rules`).

### Pipeline des annonces

`src/services/listingsService.ts` — fetch depuis **stream.estate** si `EXPO_PUBLIC_STREAM_ESTATE_KEY` est défini, sinon fallback sur un générateur mock. Résultats paginés (10 par page). Le hook `useListings` met chaque annonce fetchée en cache dans Firestore (`src/services/listingsCache.ts`) pour que tous les membres voient les mêmes données. La pile pré-charge quand il reste ≤ 3 cartes.

**Champs `SearchFilters`** — convention : `0` signifie « aucune restriction » pour les bornes numériques.

| Champ | Type | Défaut | Notes |
|---|---|---|---|
| `transaction_type` | `'rent' \| 'buy'` | `'rent'` | Mappe vers `transactionType=1/2` dans stream.estate |
| `arrondissements` | `number[]` | `[]` | Vide = les 20 arrondissements |
| `price_min` | `number` | `0` | `budgetMin` ; ignoré si 0 |
| `price_max` | `number` | `0` | `budgetMax` ; ignoré si 0 |
| `surface_min` | `number` | `0` | `surfaceMin` ; ignoré si 0 |
| `surface_max` | `number` | `0` | `surfaceMax` ; ignoré si 0 |
| `rooms_min` | `number` | `0` | `roomMin` ; ignoré si 0 |
| `min_likes` | `number` | `0` | Nb de membres devant liker pour matcher ; `0` = unanimité |

### Chat

`src/hooks/useChat.ts` (par match) et `src/hooks/useGroupChat.ts` (par groupe) — listeners `onSnapshot` temps réel sur les messages ordonnés par `created_at`. `sendMessage` et `sendAttachment` sont des callbacks stables (lisent l'auth via `getState()`). Les deux envoient une notification push aux autres membres après écriture dans Firestore.

**Pièces jointes** — images (≤ 5 Mo) et fichiers (≤ 10 Mo) uploadés vers Firebase Storage à `chat/{matchId}/{timestamp}_{uid}.{ext}`, puis l'URL de téléchargement est stockée sur le doc message (`attachment_url`, `attachment_type`, `attachment_name`). `expo-document-picker` est un peer optionnel : `npx expo install expo-document-picker`.

### Notifications

`src/lib/notifications.ts` — push tokens enregistrés via Expo Notifications à la connexion (appareil réel uniquement ; ignoré sur simulateur). Les notifications de swipe partenaire sont envoyées via l'API push Expo (`https://exp.host/--/api/v2/push/send`) directement depuis le client — **pas de fonction serveur**. `notify_on_partner_swipe` et `notify_on_new_listings` sont des préférences opt-in sur `UserProfile`. Les messages de chat déclenchent toujours un push aux autres membres (sans opt-in).

---

## Conventions de code

Voir `.claude/rules/state-stability.md` pour le détail. Règles clés (obligatoires pour tout nouveau code) :

1. **Jamais s'abonner à un store entier.** Utiliser un sélecteur atomique par valeur : `useAuthStore((s) => s.coupleId)`.
2. **Lire actions & valeurs événementielles via `getState()`**, pas via subscription.
3. **Les listeners s'abonnent une fois** — `useEffect` avec deps primitives stables uniquement.
4. **Préférer `useRef` à `useState`** pour l'état non visuel.
5. **Regrouper l'état lié** (ex. modals mutuellement exclusifs → un état discriminé).
6. **Extraire la logique métier dans des hooks** (`src/hooks/`).
7. **Pré-binder les callbacks** passés aux enfants avec `useCallback`.
8. **Pas de littéraux objet/array dans le render** — les hoister ou les dériver avec `useMemo`.
9. **Garder les styles hors du fichier composant** — `StyleSheet.create(...)` dans un module `*.styles.ts` sous `src/styles/`.

---

## Structure du projet

```
app/                    Routes Expo Router (écrans)
src/
  components/           Composants UI (cartes, modals, chat, groupes, primitives)
  hooks/                Logique métier (useChat, useSwipeActions, useNotes, useGroups…)
  lib/                  Init Firebase, notifications, upload, query client, logging
  services/             listingsService, groups, follows, recherche utilisateurs…
  stores/              Stores Zustand (authStore, filterStore, listingsStore)
  styles/              StyleSheet par composant (*.styles.ts)
  types/               Types TypeScript partagés (index.ts)
  __tests__/           Tests Jest
assets/                Icônes, images
docs/                  Documentation interne
firestore.rules        Règles de sécurité Firestore
storage.rules          Règles de sécurité Storage
firestore.indexes.json Index Firestore
```

---

## Documentation

- `CLAUDE.md` / `AGENTS.md` — guides pour les agents IA travaillant sur le repo
- [Docs Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/)

Documentation interne dans [`docs/`](./docs) :

| Fichier | Contenu |
|---|---|
| [`docs/INDEX.md`](./docs/INDEX.md) | Sommaire de la doc |
| [`docs/architecture.md`](./docs/architecture.md) | Architecture générale |
| [`docs/screens.md`](./docs/screens.md) | Écrans & routing |
| [`docs/components.md`](./docs/components.md) | Composants UI |
| [`docs/state.md`](./docs/state.md) | Stores Zustand |
| [`docs/services.md`](./docs/services.md) | Services (annonces, groupes…) |
| [`docs/firebase.md`](./docs/firebase.md) | Firebase / Firestore |
| [`docs/notifications.md`](./docs/notifications.md) | Notifications push |
| [`docs/types.md`](./docs/types.md) | Types TypeScript |
| [`docs/env.md`](./docs/env.md) | Variables d'environnement |

---

## Licence

Voir le fichier [`LICENSE`](./LICENSE).
