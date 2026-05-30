# Composants

Tous dans `src/components/`.

---

## SwipeCard

Fichier : `src/components/SwipeCard.tsx`

Carte de listing glissable. Seule la carte du dessus (`isTop=true`) est interactive.

**Props** :

| Prop | Type | Description |
|---|---|---|
| listing | Listing | données à afficher |
| isTop | boolean | active le geste pan |
| index | 0-2 | position dans la pile (0=dessus) |
| onSwipeLeft | () => void | callback swipe gauche |
| onSwipeRight | () => void | callback swipe droit |
| onInfoPress? | () => void | ouvre le détail (top seulement) |
| partnerNote? | string \| null | note du partenaire |
| partnerName? | string \| null | prénom du partenaire |

**Animation** :
- `translateX` / `translateY` (Reanimated shared values).
- Rotation interpolée ±12° selon `translateX`.
- Cartes de fond : scale 0.95/0.9 + offset Y 12/24 px.
- Overlays "J'ADORE" (vert) et "PASSE" (rouge) apparaissent progressivement.
- Seuil de déclenchement : 100 px (`SWIPE_THRESHOLD`).

**Carousel d'images** : dots cliquables, `imageIndex` en state local.

**Dimensions** : `CARD_W = SCREEN_W - 32`, `CARD_H = SCREEN_H * 0.65`.

---

## FilterSheet

Fichier : `src/components/FilterSheet.tsx`

Modal plein écran (pageSheet iOS) pour configurer les filtres et les listes de recherche.

**Props** : `visible`, `onClose`, `members: CoupleMember[]`.

**Fonctionnalités** :
- Tabs horizontaux : une tab par `SearchList` + bouton `+` pour créer.
- Création de liste : saisie du nom + sélection des participants (`MemberChip`).
- Suppression de liste : `×` sur la tab active (Alert de confirmation).
- Filtres par section : arrondissements (grid chips), loyer max, surface min, nb pièces (steps).
- Bouton "Réinitialiser" → `DEFAULT_FILTERS`.
- Bouton "Appliquer" → `syncFilters(coupleId, local, activeTab)` + fermeture.

**Sous-composants** :
- `Section` : wrapper titre + contenu.
- `MemberChip` : chip toggle pour sélectionner un membre.

---

## ListingDetailSheet

Fichier : `src/components/ListingDetailSheet.tsx`

Bottom sheet animée affichant le détail complet d'un listing.

**Props** : `listing: Listing | null`, `onClose: () => void`.

**Animation** :
- `translateY` (Reanimated) : spring open/close.
- `backdropOpacity` : fade in/out du fond semi-transparent.
- Pan gesture vers le bas : ferme si déplacement > 80 px ou vélocité > 800.

**Contenu** :
- Carousel horizontal plein-largeur avec compteur `N / total`.
- Tap sur une image → visionneuse **plein écran** (FlatList horizontal, StatusBar cachée).
- Prix, charges, total, dépôt.
- Adresse + arrondissement.
- Date de disponibilité.
- Tags features (surface, pièces, étage, ascenseur, balcon, terrasse, parking).
- Description.
- Lien externe (`Linking.openURL`).

**Dimensions** : `SHEET_H = SCREEN_H * 0.88`.

---

## MatchCard

Fichier : `src/components/MatchCard.tsx`

Carte affichant un match mutuel dans l'onglet favoris.

**Props** : `match: Match`, `onStatusChange: (id, status) => void`.

**Affiche** : image, prix, badge statut coloré, titre, adresse, surface/pièces, date du match, bouton "Voir l'annonce" (`Linking`), bouton "Marquer contacté" (si statut `new`).

**Statuts** :
| Valeur | Label | Couleur |
|---|---|---|
| new | Nouveau match | #4A6CF7 (bleu) |
| contacted | Contacté | #FF9800 (orange) |
| visited | Visité | #00C851 (vert) |
| rejected | Écarté | #999 (gris) |

---

## LikeCard

Fichier : `src/components/LikeCard.tsx`

Carte lecture seule pour les right-swipes personnels non encore matchés.

**Props** : `like: Like` (depuis `useLikes`).

**Affiche** : image, prix, badge "Aimé" (rose), titre, adresse, surface/pièces, date du like, bouton "Voir l'annonce".

---

## NoteModal

Fichier : `src/components/NoteModal.tsx`

Bottom sheet (Modal transparent) pour écrire une note sur le listing en tête de stack.

**Props** :

| Prop | Type |
|---|---|
| visible | boolean |
| initialText | string |
| listingTitle | string |
| onSave | (text: string) => void |
| onClose | () => void |

- `TextInput` multiline, max 300 chars, compteur affiché.
- `KeyboardAvoidingView` pour éviter que le clavier cache le champ.
- Bouton "Enregistrer" désactivé si texte vide.

---

## ConfirmSheet

Fichier : `src/components/ConfirmSheet.tsx`

Bottom sheet de confirmation générique (ex : déconnexion).

**Props** :

| Prop | Type | Défaut |
|---|---|---|
| visible | boolean | |
| title | string | |
| message | string | |
| confirmLabel | string | `'Confirmer'` |
| confirmDestructive | boolean | `false` |
| onConfirm | () => void | |
| onCancel | () => void | |

Animation `translateY` (withTiming 320 ms). Style bouton confirm : bleu ou rouge selon `confirmDestructive`.

---

## Toast

Fichier : `src/components/Toast.tsx`

Notification temporaire animée depuis le bas de l'écran.

**Props** :

| Prop | Type | Défaut |
|---|---|---|
| visible | boolean | |
| message | string | |
| type | `'error' \| 'info' \| 'success'` | `'info'` |
| onHide | () => void | |
| duration | number | `3000` |

Auto-hide après `duration` ms. Animation fade + translateY. Icône Ionicons selon le type. Respecte `SafeAreaInsets` (bottom).

| Type | Couleur | Icône |
|---|---|---|
| error | #FF4444 | alert-circle |
| info | #4A6CF7 | information-circle |
| success | #22C55E | checkmark-circle |
