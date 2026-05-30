# Rule: State & rendering stability

These conventions keep screens and components stable (minimal re-renders, stable
references). Apply them to **every** screen, hook and component — not just the
swipe screen. They are mandatory for new code and when touching existing code.

1. **Never subscribe to a whole store.** Forbidden: `const { x, y } = useAuthStore()`
   / `useFilterStore()` / `useListingsStore()`. It re-renders on *any* state change.
   Use one atomic selector per value actually rendered:
   ```ts
   const coupleId = useAuthStore((s) => s.coupleId);
   const uid = useAuthStore((s) => s.firebaseUser?.uid); // select the narrowest slice
   ```

2. **Read actions & event-time values via `getState()`, not subscriptions.** Inside
   callbacks, effects and listeners, pull store actions/values with
   `useAuthStore.getState()`. This adds zero subscriptions and lets the callback
   drop those store deps, so it stays referentially stable:
   ```ts
   const handleInvite = useCallback(async (id) => {
     const { firebaseUser, setCoupleId } = useAuthStore.getState();
     ...
   }, []); // no store deps
   ```

3. **Listeners subscribe once.** Firebase `onSnapshot` / `onAuthStateChanged` /
   `AppState` listeners go in a `useEffect` with **stable primitive deps only**
   (e.g. `[uid]`, `[coupleId]`) or `[]`. Never put an object/array (like `filters`)
   in the dep array — read it via `getState()` inside the callback instead, or the
   listener re-subscribes on every change.

4. **Minimize `useState`; prefer `useRef` for non-visual state.** If a value isn't
   read during render (last action, "seen" id, mount flag), use `useRef`, not state.
   Re-renders are already driven by the store/visual state.

5. **Collapse related state.** Mutually-exclusive UI (multiple modals/sheets) →
   one discriminated state (`type ActiveModal = 'filter' | 'note' | null`). Values
   always updated together → one object.

6. **Extract business logic into hooks** (`src/hooks/`). Screens stay declarative;
   Firestore/match/notes logic lives in `useSwipeActions`, `useNotes`, etc. Hook
   callbacks follow rules 1–2 so they expose stable references.

7. **Pre-bind callbacks passed to children.** Wrap handlers in `useCallback` (with
   minimal/empty deps thanks to rules 1–2) so memoized children don't re-render.
   Read transient values (e.g. top-of-stack) from a ref inside the callback.

8. **No object/array literals in render.** Don't inline `{{ x: 0, y: 0 }}`,
   `colors={['#a', '#b']}`, or other literal objects/arrays in JSX — they allocate
   a new reference every render and break child memoization. Hoist constant ones to
   module-level `const`s; derive dynamic ones with `useMemo`.

9. **Keep styles out of the component file.** Put `StyleSheet.create(...)` in a
   sibling `*.styles.ts` module under `src/styles/` (never inside `app/`, where Expo
   Router would treat it as a route) and import the `styles` object.
