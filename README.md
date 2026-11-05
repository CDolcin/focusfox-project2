# FocusFox Project II — React Native (Expo + TypeScript)

Built on Expo SDK 57 (the Expo Go app on your phone must support SDK 57). Study companion for Android and iOS: tasks, notes, flashcards, Pomodoro focus, a virtual garden, and chord-gesture music practice.
Offline-first with cross-device sync. Carries over the Project I (native Android) features, data model, flows and palette.

## Auth and sync in one paragraph
Users sign in with Firebase Auth (email/password); the session is persisted with AsyncStorage, so the same account can be signed in on several phones and the app opens offline. All data is written to a local store first (instant, works offline) and queued; a sync engine pushes queued writes to Firestore (`users/{uid}/{collection}/{id}`) and pulls changes by a server timestamp cursor, with Firestore `onSnapshot` listeners giving real-time updates when online. The Firebase JS SDK has no offline persistence on React Native, so the offline store, queue and reconciliation are our own code in `src/core/sync` and Firebase is used only as transport; this also lets sync be unit-tested without a server. A new phone signs in, pulls every collection and is restored fully.

## UI: same as Project I
The screens were rebuilt from the Project I Compose source and screenshots: same palette, splash, Login/Register (with Google info dialog and Guest Mode), the five-tab bottom bar (Home, Tasks, Focus, Music, Profile), dashboard, filtered task list with the Add/Edit task form (priority, deadline pickers, reminders, up to 5 images), Quick Notes with search and dialogs, Manage Flashcards and study cards, the circular Pomodoro screen with background picker and daily history, Progress, Profile with its five rows and sub-screens, Study Breaks / instrument pages / performance camera / My Performance. New Project II features were added inside that layout rather than replacing it: sync badge and Sync & account status, My Garden (Home chip, Focus button, Progress row), monthly focus on Progress, flashcard Share / Import code / Refresh / Revoke / Export on Manage Flashcards, Tasks/Notes PDF export under Sync & account, tap-to-hear chord cards and a scored Practice mode on each instrument page.
Known differences from Project I: Material icons from `@expo/vector-icons`; the guitar/ukulele/piano chord pictures are redrawn (tile, fretboard, keys); only completed *focus* runs are logged (Project I also logged finished breaks as sessions); Reset on the Focus screen discards the run as in Project I.

## Run it
```bash
npm install
cp .env.example .env        # fill in your Firebase web-app config (optional: without it the app runs local-only)
npx expo start              # Expo Go: scan the QR code on Android or iOS (tasks, notes, cards, focus, garden, music pads, sync)
npm test                    # 84 unit tests
npx tsc --noEmit
```
Firebase: create a project, enable Email/Password auth, create Firestore + Storage, paste `firestore.rules` and `storage.rules`, copy the web config into `.env`.
Native builds (needed for the camera gesture adapter and for notification behaviour matching production): `npx expo run:android` (Android Studio + SDK) or `npx expo run:ios` (macOS + Xcode), or EAS: `npx eas build -p android|ios`.

## Folder layout
```
src/core            pure TypeScript, no React / Firebase imports (all unit-tested)
  models.ts         collections + record types
  sync/             hlc, store, localDb, reconcile, queue, engine, remote (adapter + InMemoryRemote)
  sharing/          code (6-char codes), permissions (roles, import/refresh/revoke plans)
  focus/            timer, garden, streak, analytics
  gesture/          mapping, debounce, scoring, recording
  export/html.ts    PDF html builders, deck file (de)serialisation
src/services        Firebase, FirestoreRemote, auth, shareService, notifications, exporter, audio, gestureSource, AsyncStorage
src/app             AppContext (auth + engine + sync triggers), Navigation, actions, shareActions
src/screens         Auth, Home, Tasks, Notes, Flashcards, Focus, Garden, Progress, Music, Profile
src/ui              theme (Project I palette), kit, DateField
__tests__           sync.reconcile, sync.queue, sync.engine, sharing, gesture, focus-garden
firestore.rules  storage.rules
```

## Data model (Firestore: `users/{uid}/{collection}/{id}`)
Every record has `id, hlc, deleted, updatedBy` plus its fields (+ server-only `serverUpdatedAt`).

| Collection | Fields | Relationships |
|---|---|---|
| tasks | title, description, priority, deadlineMs, reminderMinutesBefore, completed, completedAtMs, createdAtMs, imageUris, imagePaths | completion → flowers (`sourceId`) |
| notes | title, content, colorTag, createdAtMs | — |
| decks | name, createdAtMs, shareCode?, importedFrom? {code, ownerUid, version} | has many cards |
| cards | deckId, question, answer, mastered, origin? {sharedCardId} | belongs to deck |
| sessions | label, plannedMinutes, actualMinutes, completed, startedAtMs, endedAtMs | → flowers (`sourceId`) |
| flowers | species, source (focus/task), sourceId, plantedAtMs, dayKey | id = `fl_focus_<sessionId>` / `fl_task_<taskId>` |
| recordings | instrument, durationMs, chordEvents[], voiceUri, voiceStoragePath, createdAtMs | — |
| settings (`prefs`) | focus/break minutes, toggles, darkMode, bestPracticeScores | — |
| `sharedDecks/{code}` (top level) | code, ownerUid, deckId, title, version, revoked, cards[] snapshot | capability = code |

## Conflict resolution (deterministic)
* Each write is stamped with a hybrid logical clock `wall(15 digits).counter(hex4).deviceId`; string comparison *is* the order. A device that has seen another device's stamp always stamps later than it, so phone clock skew cannot reverse causally later edits.
* **Rule: per record, the greater hlc wins**, on every device and on the server (Firestore transaction compares hlc). Whole-record last-write-wins; no field merging.
* Delete = tombstone write (`deleted: true`), which participates in the same rule: a newer edit resurrects, an older edit loses.
* Known trade-off: two devices that edit the same record while *both offline and never having seen each other* are ordered by their wall clocks (then device id). A badly behind clock can lose such a race, deterministically.
* Pull cursor is a server timestamp (never device time) with a 5 s overlap; ingest is idempotent. Firestore rules bound the hlc wall time to within the past year / next 24 h of server time.

## Offline queue
Persistent (survives restarts), coalesced per record, FIFO, exponential backoff (2 s → 5 min), permanent errors (permission/invalid) move to a dead-letter list that the user can retry, and a push acknowledged for hlc X never discards a newer edit made while it was in flight. Sync runs on start, reconnect (NetInfo), foreground (AppState), real-time events and ~1.5 s after local writes.

## Shared decks
* Owner publishes a snapshot to `sharedDecks/{CODE}` (6 chars, no 0/O/1/I/L). The code is the capability: fetch by id only, no listing.
* **Recipients can read and import; only the owner can update, revoke, un-revoke or delete the share.** Nobody edits someone else's deck.
* Import = independent copy (new ids, mastery reset, `origin` provenance). Owner edits reach recipients only when the owner taps *Update shared copy* **and** the recipient taps *Refresh*.
* Refresh adds/updates/removes only cards that still have `origin`; cards the recipient edited (they detach) or created are never touched.
* Revoke blocks new imports/refreshes; existing copies stay. Owner deleting the original deck never affects recipient copies; the code stays active unless the owner chooses "Revoke code too".

## Garden rules
Focus session *completed* and ≥10 min: 🌼 10–24, 🌷 25–49, 🌻 50+. Task completed: 🌺 low, 🌹 medium, 🪷 high; once per task, max 5/day. Deterministic flower ids make duplicate awards on two devices merge into one. No purchases, no randomness.

## Gesture scoring
Six chords ↔ MediaPipe canned gestures (Pointing_Up=C, Victory=G, ILoveYou=Am, Open_Palm=F, Thumb_Up=D, Closed_Fist=Em). Debounce: 120 ms to confirm, 450 ms to release. Practice score = round(100 × (0.7·accuracy + 0.3·timing)); each wrong chord before the right one costs 0.25 accuracy; full timing credit within 1 s, decaying to 0 at 4 s. Scoring takes `(targets, presses)` only, so it is independent of the camera.

## Status of every proposal feature
**Fully implemented**
* Tasks (CRUD, priority, deadline, reminders as local notifications, complete → flower), Notes (CRUD, colour tag, search), Flashcards (decks, cards, study/flip, mastered), Pomodoro focus (timestamp-based, background-safe, end notification, break phase, auto-start), progress (streak, 7-day chart, monthly totals, deck mastery), profile settings, dark mode.
* Offline-first sync engine, offline queue, deterministic conflict rule, new-phone restore (tested against an in-memory server with identical semantics).
* Shared decks logic: codes, roles, import snapshot, refresh, revoke, owner-delete behaviour (tested).
* Garden: illustrated isometric scene (`src/ui/GardenScene.tsx`, vector art, grows with the flower count, placement tested) and its rules (tested). Export: notes/tasks → PDF, flashcards → `.focusfox.json` file, with re-import.
* Gesture mapping, debounce, practice scoring 0–100, recording (chords with timestamps + optional voice), chord playback on Guitar/Ukulele/Piano (tested logic).
* Monthly analytics (optional feature).

**Partially implemented**
* **Camera gesture recognition (implemented, not verified on a device)**: `src/services/HandCamera.tsx` runs the same MediaPipe GestureRecognizer model Project I used inside a WebView (works in Expo Go; on-device, no video leaves the phone). The first use downloads the MediaPipe runtime and the ~8 MB model (same URL as Project I), so it needs internet once; the WebView then caches them. Its message parsing and the frame → debounce → chord pipeline are unit-tested, but I could not reach the model host or a real camera from my build environment, so live recognition quality is untested. If it cannot start, the on-screen chord tiles still play and record, and the screen shows why.
* **Firebase transport** (`FirestoreRemote`, `FirestoreShareStore`, auth, rules): written and type-checked, and the app bundles for Android and iOS, but not run against a live Firebase project or the emulator, so treat it as unverified until you try it. Rules are likewise untested.
* **Media sync**: task images (fields exist, no picker UI, no Storage upload) and voice recordings (chord data syncs; the audio file stays on the recording phone, so on a new phone a recording replays its chords without the voice track).
* **Alarm sound toggle** is stored but the notification uses the default system sound; no custom alarm asset.
* Nothing has been run on a device or emulator in this session (verification = 84 passing unit tests, `tsc --noEmit` clean, Android + iOS Metro bundles succeed).

**Deferred**
* Friends leaderboard (needs a friends graph, privacy rules and server-side aggregation; out of scope for this pass).
* Home-screen widget (needs native modules per platform: Android App Widget, iOS WidgetKit; not available in Expo Go).
