# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm start                # = expo start (dev server, Expo Go or dev build)
npm run ios              # = expo run:ios (native build + iOS simulator/device)
npm run android          # = expo run:android
npm run web              # = expo start --web
npm run version:bump     # patch of expo.version + android.versionCode + ios.buildNumber in app.json
npm run release:android  # bump, prebuild, local release APK, Firebase App Distribution (group "testeurs")
```

Every published build bumps the version first (`release:android` does it). EAS is not set up: the `projectId` in `app.json` does not exist on the `guillaumed.gth` account.

Tests run with Jest (`jest-expo`):

```bash
npm test                # run the Jest suite (app; functions/ is excluded)
npm --prefix functions test          # Cloud Functions tests (Jest + ts-jest)
npm --prefix functions run typecheck # Cloud Functions tsc
npm --prefix functions run serve     # functions + firestore emulators (needs Node >= 22.12)
firebase deploy --only functions,firestore:rules,firestore:indexes  # needs the Blaze plan
```

There is no lint script configured.

## Rules

@.claude/rules/state-stability.md

## Architecture

**Chez Nous** is an apartment-hunting app for colocs (roommates) in Paris. Everyone using the app forms **one implicit group** sharing **one search**: each person swipes independently and a match happens as soon as two members right-swipe the same listing.

### Path alias

`@/*` resolves to `src/*` (configured in `babel.config.js` via `module-resolver` and `tsconfig.json`).

### Routing (Expo Router file-based)

```
app/
  _layout.tsx          ← root: Firebase auth listener, push token registration, <SharedGroupsSync/>
  index.tsx            ← redirect hub (see flow below)
  (auth)/
    index.tsx          ← email/password + Google sign-in, creates Firestore user doc
  (tabs)/
    index.tsx          ← swipe screen (main feature)
    matches.tsx        ← matched listings list
    chat.tsx           ← the group chat (single group, no conversations list)
    profile.tsx        ← settings, notification prefs, sign out
  chat/
    [matchId].tsx      ← per-match chat (pushes over the tab bar)
```

**Navigation flow:** `app/index.tsx` reads `authStore` (atomic selectors) and redirects via `<Redirect>`:
- `isLoading` → loading spinner
- No Firebase user → `/(auth)`
- User but no `groupId` → spinner while `SharedGroupsSync` sets one
- User + `groupId` → `/(tabs)`

**One implicit group, one search:** there are no group screens, no invite code, no multiple searches in the UI. Under the hood the app still uses one `groups` doc (the *home* group) holding the single search list, so the data model (swipes/matches/notes `couple_id`, `search_list_id`, chat, Jinka feeds under `groups/{id}`) is unchanged. `src/components/SharedGroupsSync.tsx` (mounted once in the root layout) watches `groups`: creates the home group if none exists, joins the user to it (`joinGroup`, allowed by the rules' "add only yourself" update), seeds its default search if it has none, and makes it the user's active group. `planHomeGroup` (`src/services/sharedGroups.ts`) picks the same home group for every client.

### State management (Zustand)

Stores live in `src/stores/`.

- `authStore` — `firebaseUser`, `profile` (UserProfile), `groupId`, `isLoading` (+ setters and `reset`). Populated by the `onAuthStateChanged` listener in `app/_layout.tsx`. `groupId` is the home group (see One implicit group).
- `filterStore` — `filters` (SearchFilters), `syncFilters(...)` which writes to Firestore. Filters are loaded from the group doc via `useCouple` on mount.
- `listingsStore` — swipe-stack state.

### Firebase / Firestore

Singleton init in `src/lib/firebase.ts` with `experimentalForceLongPolling: true` (required for React Native) and AsyncStorage auth persistence.

**Collections:**

| Collection | Doc ID | Notes |
|---|---|---|
| `users` | `{uid}` | UserProfile; `push_token` stored here. Group membership in `couple_id` field (= active groupId) |
| `groups` | auto | One home group in practice: `name`, `member_ids[]` (= every user), `search_lists[]` (the single search: `filters`; legacy `member_ids` sub-group / `cover_photo_url`), `active_search_list_id`. `user1_id`/`user2_id`/`filters`/`invite_code` are legacy |
| `groups/{id}/messages` | auto | `GroupMessage`; group chat subcollection (text / system / listing_share) |
| `notes` | `{uid}_{listingId}` | Per-user note on a listing; all members' notes are read together (`useListingNotes`) |
| `follows` | `{follower_id}_{following_id}` | Follow relationships between users |
| `listings` | `{listingId}` | Shared listing cache read by likes/matches. Written by the server sync (`jinka_{adId}`) or by the client for mock listings; `expired_at` set by the server |
| `groups/{id}/feeds` | `{listId}` | `FeedLink`: search list ↔ Jinka alert (`owner_id`, `alert_id`, `status`). **Server-only writes**, members read |
| `groups/{id}/feeds/{listId}/items` | `{listingId}` | `FeedItem` = `Listing` + `added_at`, `fetched_at`, `active`. Server-only writes |
| `users/global/provider_accounts` | `jinka` | App-wide `ProviderAccount` (status, alerts, `token_expires_at`, `admin_uids`). Any signed-in user reads, server writes |
| `provider_tokens` | `global_jinka` | App-wide Jinka session token. **No client access** (Admin SDK only) |
| `swipes` | `{uid}_{listId}_{listingId}` | One doc per user **per search list** per listing (`user_id`, `couple_id`, `search_list_id`, `listing_id`, `direction`) |
| `matches` | `{groupId}_{listId}_{listingId}` | Created client-side (`couple_id`, `search_list_id`, `listing_id`, `listing`, `matched_at`, `status`) |
| `matches/{id}/messages` | auto | `ChatMessage`; per-match chat subcollection |
| `crash_reports` | auto | Client error reports (`src/lib/errorReporting.ts`) |

**Match logic** (`src/hooks/useSwipeActions.ts → checkForMatch`): swipes and matches are **scoped by `search_list_id`** — the same listing can be swiped independently in two different search lists. After a right-swipe, a match is created as soon as **one other group member** has right-swiped the same listing in the same list (two likes). A user alone in the group matches immediately. Runs entirely client-side. `handleUndo` deletes the swipe (and any match) for that list.

### Listings pipeline

Listings come from **Jinka** (no public API — its internal web API, ported from kajin) through **Cloud Functions** in `functions/` (region `europe-west1`). The app runs on **one app-wide Jinka account** (`GLOBAL_OWNER = 'global'`): the admin (`admin_uids` on the global account) pastes their jinka.fr session token (JWT, ~30 days) in Profile; nobody else configures anything. Any group member links one of its alerts to a search list (FilterSheet → "Source des annonces"); the whole group then swipes that feed. The app never calls Jinka. Full details: `docs/services.md`.

- **Server** (`functions/src`): `ListingProvider` interface (Jinka in `providers/jinka/`), `FeedStore` persistence interface (`firestoreFeedStore` / in-memory fake in tests), `sync.ts`, callables in `accounts.ts`. Only alerts linked to a search list are read. Schedule in `schedule.ts` (Europe/Paris, 2 Cloud Scheduler jobs): `syncListingFeeds` every 30 min 08:00–20:30 and `syncListingFeedsNight` at 21:00/00:00/03:00/06:00. Incremental runs read page 1 and continue only while a page brings new ads (≤ 3 pages, usually 1 request); the 03:00 night run is the **sweep** (refreshes alert names, reads all pages ≤ 20, expires vanished ads, purges items expired > 30 days). Each alert is fetched once per owner and fanned out to every linked list; each page is upserted as it's read (rules in `planUpsert`), unchanged items and unchanged feed docs are not rewritten (Firestore write quota, client listeners). A deleted alert (404) only flags its own feeds `error`. Expired Jinka session → token deleted, account/feeds `status: 'expired'`, the admin pastes a new token. Admin-only callables: `setGlobalListingProviderToken` (replace the token) and `refetchListingProvider` (run the sweep now, 2-min cooldown).
- **Expired listings**: `Listing.expired_at` + `FeedItem.active`. Live → expired transitions are propagated to `listings/{id}` and `matches.listing.expired_at` (badge on Match/Like cards). Already-expired ads never enter a feed.
- **Client** (`src/services/listings/`): `ListingsDataSource` interface (`fetchPage(query, cursor)`, `kind: 'feed' | 'local'`); `feedDataSource` reads `groups/{g}/feeds/{listId}/items` (`active == true`, `added_at` desc) and refines with the list's `SearchFilters` client-side (`matchesFilters`); `mockDataSource` when `EXPO_PUBLIC_LISTINGS_SOURCE=mock`. `getListingsDataSource()` is the single switch point. `listingsStore` paginates by cursor, excludes already-swiped listings, and holds an `error` state.
- `functions/src/types.ts` mirrors `Listing` and the provider types from `src/types` — keep both in sync.

**`SearchFilters` fields** — convention: `0` means "no restriction" for numeric bounds. They **refine** the linked Jinka alert client-side (the alert itself defines the rest: transaction type, location…); only price, surface and rooms can be overridden in the app.

| Field | Type | Default | Notes |
|---|---|---|---|
| `price_min` | `number` | `0` | ignored when 0 |
| `price_max` | `number` | `0` | ignored when 0 |
| `surface_min` | `number` | `0` | ignored when 0 |
| `surface_max` | `number` | `0` | ignored when 0 |
| `rooms_min` | `number` | `0` | ignored when 0 |

`SearchFilters` live on the single **search list** (`SearchList.filters`) of the home group; the top-level `Group.filters` field is legacy. Stored filters may still carry legacy keys (`transaction_type`, `arrondissements`, `min_likes`), ignored by the app. The data model still supports several lists, but the app shows and edits only the active one.

### Chat

`src/hooks/useChat.ts` — real-time `onSnapshot` listener on `matches/{matchId}/messages` ordered by `created_at`. `sendMessage` and `sendAttachment` are stable callbacks (read auth via `getState()`). Both fire push notifications to the other group members via `getMemberTokens` + `sendPushNotification` after writing to Firestore.

**Attachments** — images (≤ 5 MB) and files (≤ 10 MB) are uploaded to Firebase Storage at `chat/{matchId}/{timestamp}_{uid}.{ext}`, then the download URL is stored on the message doc (`attachment_url`, `attachment_type`, `attachment_name`). `expo-document-picker` is an optional peer; install it with `npx expo install expo-document-picker`.

### Notifications

`src/lib/notifications.ts` — push tokens registered via Expo Notifications on login (real device only; silently skipped on simulator). Partner swipe notifications are sent via the Expo push API (`https://exp.host/--/api/v2/push/send`) directly from the client (the only Cloud Functions are the listings sync ones). The "new listings" local notification (`useNewListingsNotify`) counts items added to the active list's feed since the last foreground. `notify_on_partner_swipe` and `notify_on_new_listings` are opt-in prefs on `UserProfile`. Chat messages also trigger a push to all other group members (always, no opt-in gate).

### Environment variables

`.env` is a committed template with empty values; put real values in `.env.local` (git-ignored, loaded by Expo with priority). Prefix `EXPO_PUBLIC_` makes them available client-side:

```
EXPO_PUBLIC_LISTINGS_SOURCE=          # 'mock' = locally generated listings; omit = Jinka feed
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=     # Google OAuth web client ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID= # Google OAuth Android client ID (optional)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=     # Google OAuth iOS client ID; without it the Google button is hidden on iOS
```

No Jinka key client-side: each user connects their account from the Profile; the token stays server-side.
