# Variables d'environnement & configuration

## Variables `.env`

Le fichier `.env` (à la racine, ignoré par git) doit contenir :

```env
EXPO_PUBLIC_LISTINGS_SOURCE=      # 'mock' = annonces générées localement ; omis = flux Jinka (Cloud Functions)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID= # Google OAuth web client ID (console GCP)
EXPO_PUBLIC_FLUXIMMO_KEY=         # réservé, non câblé
```

Le préfixe `EXPO_PUBLIC_` rend les variables accessibles côté client via `process.env.EXPO_PUBLIC_*`.

Aucune clé Jinka côté app : chaque utilisateur connecte son compte depuis le Profil, le token reste côté serveur.

**Sans `GOOGLE_WEB_CLIENT_ID`**, le bouton Google sur l'écran de login est désactivé (`request` sera `null`).

---

## Configuration Expo (`app.json`)

| Champ | Valeur |
|---|---|
| name | Chez Nous |
| slug | swipeMyFlat |
| version | 1.0.0 |
| scheme | swipemyflat |
| orientation | portrait |

**Plugins configurés** :
- `expo-router`
- `expo-status-bar`
- `expo-secure-store`
- `expo-notifications` (icône + couleur `#4A6CF7`)
- `expo-web-browser`
- `expo-image-picker` (message permission galerie en français)

**Android** : `predictiveBackGestureEnabled: false` (évite conflit avec le geste de swipe).

---

## Configuration Firebase

Hardcodée dans `src/lib/firebase.ts` (pas de variable d'env pour les clés Firebase) :

```
apiKey:            AIzaSyCR_tMxKN_KS2T2J1v-U2XAJHEpWuSGmVM
authDomain:        swipemyflat.firebaseapp.com
projectId:         swipemyflat
storageBucket:     swipemyflat.firebasestorage.app
messagingSenderId: 967416784277
appId:             1:967416784277:web:aa9751713c003f501d029c
```

---

## Commandes de développement

```bash
npx expo start           # Expo Go ou dev build
npx expo start --ios     # Simulateur iOS
npx expo start --android # Émulateur Android
npx expo start --web     # Web (limité)

firebase deploy --only firestore:rules    # déployer les règles
firebase deploy --only firestore:indexes  # déployer les indexes
firebase deploy --only functions          # déployer les Cloud Functions (plan Blaze requis)

npm test                                  # tests de l'app (Jest)
npm --prefix functions test               # tests des Cloud Functions
npm --prefix functions run serve          # émulateurs functions + firestore (Node ≥ 22.12)
```

Il n'y a pas de script de lint configuré.

---

## Alias TypeScript

`tsconfig.json` :
```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`babel.config.js` (module-resolver) :
```js
alias: { '@': './src' }
```
