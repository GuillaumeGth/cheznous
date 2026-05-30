# Écrans

## Root layout — `app/_layout.tsx`

Wrappeur global, rendu une seule fois. Responsabilités :

1. Installe les listeners Expo Notifications (reçu + réponse).
2. Lance l'écouteur `onAuthStateChanged` :
   - Fetch `users/{uid}` et peuple `authStore`.
   - Backfill `notification_prefs` et `push_token` si champs absents (migration).
   - Appelle `registerPushToken` silencieusement.
3. Rend `<Stack screenOptions={{ headerShown: false }}>` dans `GestureHandlerRootView`.

---

## Hub de redirection — `app/index.tsx`

Logique pure, pas d'UI significative. Lit `authStore` et redirige :

| État | Destination |
|---|---|
| `isLoading` | `<ActivityIndicator>` (spinner bleu centré) |
| `!firebaseUser` | `/(auth)` |
| `firebaseUser && !coupleId` | `/(auth)/couple` |
| `firebaseUser && coupleId` | `/(tabs)` |

---

## Authentification — `app/(auth)/index.tsx`

Deux modes : **login** et **register** (toggle).

**Email/password** :
- Login : `signInWithEmailAndPassword`
- Register : `createUserWithEmailAndPassword` + `setDoc` du profil utilisateur

**Google OAuth** :
- `expo-auth-session/providers/google` avec `useIdTokenAuthRequest`
- Crée le profil si premier login Google
- Redirige vers `/(tabs)` ou `/(auth)/couple` selon `couple_id`

**Erreurs** : mappées en messages français via `friendlyError(code)`.

---

## Création de couple — `app/(auth)/couple.tsx`

Deux onglets : **Créer** / **Rejoindre**.

**Créer** :
1. Génère un code 6 chars aléatoire (`Math.random().toString(36)`).
2. `setDoc(couples/{newId}, { user1_id, invite_code, ... })`.
3. `updateDoc(users/{uid}, { couple_id })`.
4. Affiche l'écran "Couple créé" avec le code et un bouton partage (`Share.share`).
5. Bouton "Commencer seul" pour aller directement dans `/(tabs)`.

**Rejoindre** :
1. Query `couples` par `invite_code`.
2. Vérifie que le couple est ouvert (`user2_id == null`) et que ce n'est pas le sien.
3. `updateDoc(couples/{id}, { user2_id: uid })`.
4. `updateDoc(users/{uid}, { couple_id })`.
5. Redirige vers `/(tabs)`.

---

## Écran swipe — `app/(tabs)/index.tsx`

Écran principal de l'application.

**Données** :
- `useListings()` : stack de cartes + pagination + refresh.
- `useCouple()` : couple realtime + profil partenaire.
- `useFilterStore()` : filtres actifs + listes.
- `useNewListingsNotify()` : hook secondaire, pas de valeur retournée.

**Logique de chargement** :
- Mount → `refresh()` (respecte le throttle 30 min).
- Changement de `filtersKey` → `refresh(true)` (force).
- `stack.length <= 3` → `loadMore()` (pagination anticipée).

**Swipe** :
1. `handleSwipe(direction)` : appelle `pop()` puis `recordSwipe()`.
2. `recordSwipe()` : écrit dans `swipes`, appelle `checkForMatch` si right, notifie le partenaire si pref activée.
3. `checkForMatch()` : si liste solo → `createMatch()`. Si liste partagée → query swipes partenaire → `createMatch()` si trouvé.
4. `createMatch()` : écrit `matches/{coupleId}_{listingId}`, affiche le banner "C'est un match !" 3 s.

**Notes** :
- Fetch les notes (soi + partenaire) quand le top card change.
- `NoteModal` permet d'écrire/modifier sa note (`notes/{uid}_{listingId}`).
- La note du partenaire est affichée sur la carte courante.

**UI** :
- Header : nom app + statut partenaire + bouton filtres.
- Stack de 3 cartes (reverse render pour z-index).
- Boutons bas : ✕ passer, crayon note, ♥ like.
- Banner match animé en overlay.
- Modals : `FilterSheet`, `ListingDetailSheet`, `NoteModal`.

---

## Favoris — `app/(tabs)/matches.tsx`

Deux sections :

**Nos coups de cœur** (matchs mutuels) :
- `useMatches()` → liste realtime.
- `MatchCard` avec statut (new/contacted/visited/rejected) et bouton "Marquer contacté".
- `handleStatusChange` → `updateDoc(matches/{id}, { status })`.

**Mes likes** (right-swipes personnels non encore matchés) :
- `useLikes()` → liste realtime.
- `LikeCard` (lecture seule).
- Filtrés pour exclure ceux déjà dans les matchs.

---

## Profil — `app/(tabs)/profile.tsx`

**Sections** :

1. **Carte utilisateur** : avatar (photo ou initiale), prénom, email. Tap avatar → `ImagePicker` → upload Firebase Storage → `updateDoc(users/{uid}, { photo_url })`.

2. **Notre duo** : statut couple (seul / à deux) + code d'invitation si partenaire absent.

3. **Critères de recherche** : résumé des filtres actifs + bouton "Modifier" → `FilterSheet`.

4. **Notifications** : deux switches `notify_partner_on_swipe` et `notify_on_new_listings`. Activation déclenche `registerPushToken` si aucun token enregistré.

5. **Déconnexion** : `ConfirmSheet` → `signOut(auth)` + `reset()` authStore + redirect `/(auth)`.

**Toast** : feedback visuel pour changement de photo (succès/erreur) et notifications (info).
