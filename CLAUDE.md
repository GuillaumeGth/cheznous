# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npx expo start          # start dev server (Expo Go or dev build)
npx expo start --ios    # iOS simulator
npx expo start --android
npx expo start --web
```

There is no lint or test script configured.

## Rules

@.claude/rules/state-stability.md

## Architecture

**Chez Nous** is an apartment-hunting app for colocs (roommates) in Paris. A group of N people link accounts, swipe on listings independently, and get a match when all targeted members of a search list right-swipe the same listing.

### Path alias

`@/*` resolves to `src/*` (configured in `babel.config.js` via `module-resolver` and `tsconfig.json`).

### Routing (Expo Router file-based)

```
app/
  _layout.tsx          ← root: Firebase auth listener, push token registration
  index.tsx            ← redirect hub (see flow below)
  (auth)/
    index.tsx          ← email/password + Google sign-in, creates Firestore user doc
    couple.tsx         ← create or join a couple via invite code
  (tabs)/
    index.tsx          ← swipe screen (main feature)
    matches.tsx        ← matched listings list
    profile.tsx        ← settings, notification prefs, sign out
  chat/
    [matchId].tsx      ← per-match group chat (pushes over the tab bar)
```

**Navigation flow:** `app/index.tsx` reads `authStore` and redirects:
- No Firebase user → `/(auth)`
- User but no `coupleId` → `/(auth)/couple`
- User + coupleId → `/(tabs)`

### State management (Zustand)

- `authStore` — `firebaseUser`, `profile` (UserProfile), `coupleId`, `isLoading`. Populated by the `onAuthStateChanged` listener in `app/_layout.tsx`.
- `filterStore` — `filters` (SearchFilters), `syncFilters(coupleId, filters)` which writes to Firestore. Filters are loaded from the couple doc via `useCouple` on mount.

### Firebase / Firestore

Singleton init in `src/lib/firebase.ts` with `experimentalForceLongPolling: true` (required for React Native) and AsyncStorage auth persistence.

**Collections:**

| Collection | Doc ID | Notes |
|---|---|---|
| `users` | `{uid}` | UserProfile; push_token stored here |
| `couples` | auto | `user1_id`, `user2_id` (null until partner joins), `invite_code`, `filters` |
| `listings` | `{listingId}` | Cached by the first client to fetch; both partners read from here |
| `swipes` | `{uid}_{listingId}` | One doc per user per listing |
| `matches` | `{coupleId}_{listingId}` | Created client-side when the second partner right-swipes |
| `matches/{id}/messages` | auto | `ChatMessage`; subcollection — one doc per chat message |

**Match logic** (in `app/(tabs)/index.tsx → checkForMatch`): after a right-swipe, query `swipes` for a right-swipe by the partner on the same listing. If found, write the match doc. This runs entirely client-side.

### Listings pipeline

`src/services/listingsService.ts` — fetches from **stream.estate** if `EXPO_PUBLIC_STREAM_ESTATE_KEY` is set, otherwise falls back to a mock generator. Results are paginated (10 per page). `useListings` hook caches each fetched listing into Firestore so both partners see the same data. Stack pre-fetches when ≤ 3 cards remain.

**`SearchFilters` fields** — convention: `0` means "no restriction" for numeric bounds.

| Field | Type | Default | Notes |
|---|---|---|---|
| `transaction_type` | `'rent' \| 'buy'` | `'rent'` | Maps to `transactionType=1/2` in stream.estate |
| `arrondissements` | `number[]` | `[]` | Empty = all 20 arrondissements |
| `price_min` | `number` | `0` | `budgetMin` in stream.estate; ignored when 0 |
| `price_max` | `number` | `0` | `budgetMax` in stream.estate; ignored when 0 |
| `surface_min` | `number` | `0` | `surfaceMin` in stream.estate; ignored when 0 |
| `surface_max` | `number` | `0` | `surfaceMax` in stream.estate; ignored when 0 |
| `rooms_min` | `number` | `0` | `roomMin` in stream.estate; ignored when 0 |

### Chat

`src/hooks/useChat.ts` — real-time `onSnapshot` listener on `matches/{matchId}/messages` ordered by `created_at`. `sendMessage` and `sendAttachment` are stable callbacks (read auth via `getState()`). Both fire push notifications to the other group members via `getMemberTokens` + `sendPushNotification` after writing to Firestore.

**Attachments** — images (≤ 5 MB) and files (≤ 10 MB) are uploaded to Firebase Storage at `chat/{matchId}/{timestamp}_{uid}.{ext}`, then the download URL is stored on the message doc (`attachment_url`, `attachment_type`, `attachment_name`). `expo-document-picker` is an optional peer; install it with `npx expo install expo-document-picker`.

### Notifications

`src/lib/notifications.ts` — push tokens registered via Expo Notifications on login (real device only; silently skipped on simulator). Partner swipe notifications are sent via the Expo push API (`https://exp.host/--/api/v2/push/send`) directly from the client — there is no server-side function. `notify_on_partner_swipe` and `notify_on_new_listings` are opt-in prefs on `UserProfile`. Chat messages also trigger a push to all other group members (always, no opt-in gate).

### Environment variables

Required in `.env` (prefix `EXPO_PUBLIC_` makes them available client-side):

```
EXPO_PUBLIC_STREAM_ESTATE_KEY=   # stream.estate API key; omit to use mock data
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID= # Google OAuth web client ID
EXPO_PUBLIC_FLUXIMMO_KEY=        # reserved, not yet wired up
```
