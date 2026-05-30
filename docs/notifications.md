# Notifications push

Fichier : `src/lib/notifications.ts`

Toutes les notifications sont envoyées **depuis le client** via l'API Expo Push. Il n'y a pas de Cloud Function ou de serveur.

---

## Handler global

Configuré au niveau module (s'exécute au chargement) :

```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
```

---

## registerPushToken(userId)

Appelé :
- Au login (dans `app/_layout.tsx`).
- À l'activation d'une préférence de notification (dans `app/(tabs)/profile.tsx`).

Étapes :
1. Vérifie `Device.isDevice` → retourne `null` sur simulateur (silencieux).
2. Demande les permissions (`requestPermissionsAsync`).
3. Crée un canal Android `'default'` avec importance MAX.
4. Récupère le token Expo (`getExpoPushTokenAsync`) avec le `projectId` EAS.
5. Écrit le token dans `users/{userId}.push_token`.
6. Retourne le token (string) ou `null`.

---

## notifyPartnerOfSwipe(listing, myDisplayName, coupleId, myUserId)

Appelé après un right-swipe si `notify_partner_on_swipe` est activé.

1. `getPartnerToken(coupleId, myUserId)` : lit `couples/{id}` pour trouver l'UID partenaire, puis lit `users/{partnerId}.push_token`.
2. `sendPushNotification(token, title, body, data)` :
   - `title` : `"{prénom} a liké un appart !"`
   - `body` : titre du listing
   - `data` : `{ type: 'partner_swipe', listingId }`

---

## scheduleNewListingsNotification(count)

Notification locale programmée immédiatement (`trigger: null`) :
- `title` : `"{N} nouvelle(s) annonce(s) disponible(s)"`
- `body` : `"De nouveaux appartements correspondent à vos critères"`
- `data` : `{ type: 'new_listings' }`

---

## sendPushNotification(token, title, body, data?)

Wrapper bas niveau. POST vers `https://exp.host/--/api/v2/push/send` avec :

```json
{
  "to": "<expoPushToken>",
  "sound": "default",
  "title": "...",
  "body": "...",
  "data": {}
}
```

---

## Listeners de notifications (app/_layout.tsx)

Deux listeners installés au mount du root layout et nettoyés au unmount :
- `addNotificationReceivedListener` : callback vide (prévu pour navigation future).
- `addNotificationResponseReceivedListener` : callback vide (idem).

---

## Limitations connues

- Pas de server push : si l'app est fermée côté partenaire, le token peut être périmé sans que l'app le sache.
- `notify_on_new_listings` dépend d'un champ `fetched_at` sur les listings Firestore qui n'est pas écrit par `listingsService` → la fonctionnalité est partiellement inactive.
- Les réponses de l'API Expo Push ne sont pas traitées (erreurs silencieuses).
