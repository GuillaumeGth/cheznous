# Source des annonces (Jinka via Cloud Functions)

Les annonces viennent des **alertes Jinka** d'un membre du groupe. Un serveur
(Cloud Functions for Firebase, dossier `functions/`) les synchronise dans
Firestore ; l'app ne fait que lire ce flux. Le choix à plusieurs (swipes,
`min_likes`, matches) reste entièrement côté Chez Nous — rien n'est renvoyé à Jinka.

> Jinka n'a pas d'API publique : on utilise l'API interne de son site
> (`api.jinka.fr/apiv2`), portée depuis [kajin](https://github.com/louistransfer/kajin).
> Elle peut changer sans préavis — seul `functions/src/providers/jinka/` est à corriger.

```
Jinka (compte du membre qui lie l'alerte)
   ▲  token stocké côté serveur (provider_tokens) — jamais le mot de passe
   │
Cloud Functions (europe-west1)
   ├─ syncListingFeeds       toutes les 30 min, 8:00 → 20:30 — page 1 (+ suivantes s'il y a du nouveau, ≤ 3)
   ├─ syncListingFeedsNight  21:00, 0:00, 3:00, 6:00 — idem ; à 3:00 : balayage complet
   │                         (noms d'alertes, toutes les pages ≤ 20, expirations, purge)
   └─ callables : connect / disconnect / refreshAlerts / linkSearchListToAlert
   │  interface ListingProvider ← abstraction (Jinka aujourd'hui, autre agrégateur demain)
   ▼
Firestore  groups/{g}/feeds/{listId}            lien liste ↔ alerte
           groups/{g}/feeds/{listId}/items/{id} annonces synchronisées
           listings/{id}                        cache partagé (likes / matches)
   │
   ▼
App : ListingsDataSource (feed | mock) → listingsStore → écran swipe
```

---

## Côté serveur (`functions/`)

| Fichier | Rôle |
|---|---|
| `src/providers/ListingProvider.ts` | Interface : `listAlerts`, `fetchAlertPage` ; `ProviderAuthError`, `ProviderAlertNotFoundError` |
| `src/schedule.ts` | Planning (Europe/Paris) et choix du mode du passage de nuit |
| `src/providers/jinka/jinkaProvider.ts` | Appels HTTP Jinka (espacés de 500 ms, timeout 30 s) |
| `src/providers/jinka/jinkaMapper.ts` | Annonce Jinka → `Listing` (`id = jinka_{adId}`) |
| `src/store/FeedStore.ts` | Interface de persistance (fake mémoire en test) |
| `src/store/firestoreFeedStore.ts` | Implémentation Admin SDK |
| `src/sync.ts` | Logique de sync (`incremental` / `sweep`) |
| `src/accounts.ts` | Logique des callables (validation, droits) |
| `src/index.ts` | Déclaration des functions + mapping `AppError` → `HttpsError` |

### Endpoints Jinka utilisés

| Endpoint | Usage |
|---|---|
| `POST /apiv2/user/auth` (form-urlencoded) | email + mot de passe → `access_token` |
| `GET /apiv2/alert` | alertes du compte |
| `GET /apiv2/alert/{id}/dashboard?filter=all&page=N` | annonces d'une alerte (`ads[]`, `pagination.nbPages`) |
| `GET /alert_result_view_ad?ad=…&alert_token=…` | redirection vers l'annonce d'origine (utilisée comme `url` si pas de `webview_link`) |

### Compte Jinka unique (global)

L'app tourne sur **un seul compte Jinka**, celui de l'administrateur : son token de session (JWT valable ~30 jours, cookie `LA_API_TOKEN` ou en-tête `Authorization` d'une session jinka.fr) est stocké côté serveur sous `provider_tokens/global_jinka`. Aucun autre utilisateur ne configure quoi que ce soit : tout le monde voit les alertes de ce compte et peut les lier à ses recherches.

- `users/global/provider_accounts/jinka` : statut, alertes, `token_expires_at`, `admin_uids` — lisible par tout utilisateur connecté, écrit par le serveur.
- Tous les flux ont `owner_id: 'global'` (jamais considérés orphelins par la sync).
- L'admin voit **Profil → Annonces** : statut, expiration (alerte 5 jours avant), « Actualiser les annonces », « Remplacer le token ».

### Callables

| Nom | Entrée | Effet |
|---|---|---|
| `setGlobalListingProviderToken` | `{ token }` | **Admin** : remplace le token global (validé en lisant les alertes), met à jour `token_expires_at`, resynchronise les flux |
| `refetchListingProvider` | `{ provider }` | **Admin**, bouton « Actualiser les annonces » (Profil) : relit la liste des alertes et **toutes les pages** des alertes liées (même passage que le balayage de 3 h). Cooldown de 2 min (`last_refetch_at`). Renvoie `{ alerts, feeds, newItems, expiredItems }` |
| `linkSearchListToAlert` | `{ groupId, listId, alertId \| null }` | N'importe quel membre du groupe lie (ou délie) une recherche à une alerte du compte global, puis remplit le flux immédiatement |

Contrôles : appelant authentifié, membre du groupe, recherche existante, alerte
existante sur le compte global. Changer d'alerte vide l'ancien flux.

### Sync

- **Seules les alertes liées à une recherche** sont lues ; la liste des noms d'alertes n'est relue qu'au balayage de 3 h (ou via « Actualiser les annonces »).
- Passage normal : page 1, puis la suivante **seulement si la page apportait du nouveau** (≤ 3 pages) → en général 1 requête Jinka. ~30 passages/jour ≈ 35–50 requêtes Jinka/jour.
- Les annonces **inchangées ne sont pas réécrites** (quota d'écritures Firestore : 20 000/jour gratuits, partagé avec l'app).
- Une alerte supprimée sur Jinka (404) ne marque en `error` que ses propres flux.
- Les flux sont regroupés par propriétaire → chaque alerte n'est lue **qu'une fois** puis dupliquée vers toutes les recherches liées.
- Un flux est supprimé si sa recherche, son groupe n'existe plus, ou si son propriétaire a quitté le groupe.
- **Session expirée** (401/403) : token supprimé, compte et flux passent en `status: 'expired'` → l'app affiche « reconnecte Jinka ». Pas de mot de passe stocké, donc reconnexion manuelle.
- Une erreur réseau sur un propriétaire n'empêche pas les autres (`status: 'error'`).

### Annonces expirées

| Étape | Comportement |
|---|---|
| Détection | `expired_at` ou `deleted_at` renvoyé par Jinka → `Listing.expired_at`, `active: false` |
| Disparition | Au **sweep** uniquement, et seulement si toutes les pages ont été lues (≤ 20) : une annonce absente de l'alerte est expirée (`expired_at` = maintenant) |
| Jamais ajoutée | Une annonce déjà expirée au premier passage n'entre pas dans le flux |
| Propagation | À la transition active → expirée : `listings/{id}.expired_at` et `matches.listing.expired_at` sont mis à jour → badge « Annonce expirée » (MatchCard, LikeCard) |
| Swipe | Le flux client ne lit que `active == true` |
| Purge | Au sweep, les items expirés depuis > 30 jours sont supprimés du flux (`listings/{id}` est conservé) |

Rien n'est signalé à Jinka (kajin propose un `POST /abuses`, non repris).

---

## Côté app (`src/services/listings/`)

```ts
interface ListingsDataSource {
  id: string;
  kind: 'feed' | 'local';
  fetchPage(query: { groupId; listId; filters }, cursor): Promise<{ listings; nextCursor }>;
}
```

| Source | Quand | Détails |
|---|---|---|
| `feedDataSource` | par défaut | Lit `groups/{g}/feeds/{listId}/items` (`active == true`, `added_at` desc, 30 par page, curseur Firestore) puis applique les filtres de la recherche **côté client** (`matchesFilters`) |
| `mockDataSource` | `EXPO_PUBLIC_LISTINGS_SOURCE=mock` | Annonces aléatoires respectant les filtres ; `kind: 'local'` → le store les met en cache dans `listings/{id}` |

`getListingsDataSource()` est le seul point de bascule.

Les filtres de l'app **affinent** l'alerte Jinka (prix, surface, pièces,
arrondissements). `transaction_type` n'a pas d'effet : c'est l'alerte qui le définit.

### listingsStore

- Pagination par curseur ; jusqu'à 5 pages lues par `loadMore` si le filtrage client vide une page.
- Exclut les annonces **déjà swipées** par l'utilisateur dans cette recherche (`fetchSwipedListingIds`).
- `error` bloque l'auto-pagination jusqu'au prochain `refresh`.
- Un compteur de génération ignore les réponses d'un chargement lancé avant un `refresh` (changement de liste/filtres).
- Clé de requête `groupId|listId|filters` : le throttle de 30 min et le rechargement forcé en dépendent.

### UI

- **Profil → Annonces** (`ProviderAccountSection`) : connexion Jinka, alertes, statut, actualiser, déconnecter.
- **Filtres → Source des annonces** (`FeedSourcePicker`) : lier / délier une alerte à la recherche ; affiche le propriétaire et le statut du lien.
- **Swipe** : état « Aucune alerte liée », erreur avec « Réessayer », rechargement quand la source change ou que la première synchro arrive.
