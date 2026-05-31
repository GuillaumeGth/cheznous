# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm start                # = expo start (dev server, Expo Go or dev build)
npm run ios              # = expo run:ios (native build + iOS simulator/device)
npm run android          # = expo run:android
npm run web              # = expo start --web
```

Tests run with Jest (`jest-expo`):

```bash
npm test                # run the Jest suite
```

There is no lint script configured.

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
    invite.tsx         ← create or join a group via invite code
  (tabs)/
    index.tsx          ← swipe screen (main feature)
    matches.tsx        ← matched listings list
    chat.tsx           ← conversations list
    profile.tsx        ← settings, notification prefs, sign out
  chat/
    [matchId].tsx      ← per-match chat (pushes over the tab bar)
  group-chat/
    [groupId].tsx      ← per-group chat
  groups/
    index.tsx          ← groups list
    [id].tsx           ← group detail (members, invitations)
```

**Navigation flow:** `app/index.tsx` reads `authStore` (atomic selectors) and redirects via `<Redirect>`:
- `isLoading` → loading spinner
- No Firebase user → `/(auth)`
- User but no `groupId` → `/(auth)/invite`
- User + `groupId` → `/(tabs)`

### State management (Zustand)

Stores live in `src/stores/`.

- `authStore` — `firebaseUser`, `profile` (UserProfile), `groupId`, `isLoading` (+ setters and `reset`). Populated by the `onAuthStateChanged` listener in `app/_layout.tsx`. `groupId` is the active group (multi-group).
- `filterStore` — `filters` (SearchFilters), `syncFilters(...)` which writes to Firestore. Filters are loaded from the group doc via `useCouple` on mount.
- `listingsStore` — swipe-stack state.

### Firebase / Firestore

Singleton init in `src/lib/firebase.ts` with `experimentalForceLongPolling: true` (required for React Native) and AsyncStorage auth persistence.

**Collections:**

| Collection | Doc ID | Notes |
|---|---|---|
| `users` | `{uid}` | UserProfile; `push_token` stored here. Group membership in `couple_id` field (= active groupId) |
| `groups` | auto | `name`, `member_ids[]`, `invite_code`, `search_lists[]` (each list has its own `filters`, optional `member_ids` sub-group, `cover_photo_url`), `active_search_list_id`. `user1_id`/`user2_id`/`filters` are legacy |
| `groups/{id}/messages` | auto | `GroupMessage`; group chat subcollection (text / system / listing_share) |
| `notes` | `{uid}_{listingId}` | Per-user note on a listing; all members' notes are read together (`useListingNotes`) |
| `group_invitations` | auto | `GroupInvitation` — pending/accepted/rejected |
| `follows` | `{follower_id}_{following_id}` | Follow relationships between users |
| `listings` | `{listingId}` | Cached by the first client to fetch; all members read from here |
| `swipes` | `{uid}_{listId}_{listingId}` | One doc per user **per search list** per listing (`user_id`, `couple_id`, `search_list_id`, `listing_id`, `direction`) |
| `matches` | `{groupId}_{listId}_{listingId}` | Created client-side (`couple_id`, `search_list_id`, `listing_id`, `listing`, `matched_at`, `status`) |
| `matches/{id}/messages` | auto | `ChatMessage`; per-match chat subcollection |
| `crash_reports` | auto | Client error reports (`src/lib/errorReporting.ts`) |

**Match logic** (`src/hooks/useSwipeActions.ts → checkForMatch`): swipes and matches are **scoped by `search_list_id`** — the same listing can be swiped independently in two different search lists. After a right-swipe, the targeted participants are the search list's `member_ids` sub-group (or all group members if unset). With `min_likes: 0` a match needs **unanimity** among targeted participants; otherwise it needs `min_likes` total likes. Solo lists (only the current user) match immediately. Runs entirely client-side. `handleUndo` deletes the swipe (and any match) for that list.

### Listings pipeline

`src/services/listingsService.ts` — fetches from **stream.estate** if `EXPO_PUBLIC_STREAM_ESTATE_KEY` is set, otherwise falls back to a mock generator. Results are paginated (10 per page). `useListings` hook caches each fetched listing into Firestore so all group members see the same data. Stack pre-fetches when ≤ 3 cards remain.

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
| `min_likes` | `number` | `0` | Min members who must like a listing to match; `0` = unanimity |

`SearchFilters` live per **search list** (`SearchList.filters`), not per group. Each group has multiple search lists with their own filters and optional member sub-group; the top-level `Group.filters` field is legacy.

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
