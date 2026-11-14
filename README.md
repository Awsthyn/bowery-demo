# Candidate Onboarding (Expo demo)

A scoped take on a hiring-paperwork app: a candidate signs in, fills a 5-step wizard (personal info → ID front/back → selfie → signed offer letter PDF → review), and submits. The submission goes through an **offline-first outbox** to a **mock backend you can break on purpose** from inside the app.

Built in about 3 hours as a portfolio piece for a Senior React Native role. It focuses on the parts that make or break this kind of app in production: progress that survives app kills, uploads on bad networks, and no duplicate submissions.

<!-- TODO: demo GIF / video link -->

**Android APK:** _link added after the EAS build_ · **Expo Go:** `npx expo start`, then scan the QR code (Google Sign-In is hidden there; use the demo user)

## 5-minute reviewer script

1. **Sign in** with Google, or tap **Continue as demo user** (Firebase Anonymous Auth).
2. **Kill-and-resume.** Type your name on *Personal info*, wait a second, kill the app from recents, then reopen it. You land on the same step with the text intact. The same works on any later step: files are copied into the app's document directory, so the thumbnails survive restarts.
3. **Offline submit.** Finish the wizard. Open **⋮ → Dev settings** and turn on **Force offline** (or use real airplane mode), then **Submit**. The status screen shows *Waiting for connection*. Turn it off: the app sends within about a second and shows *In review*.
4. **Flaky server.** In Dev settings, set **Failure rate = 100%**, then sign out and back in as a fresh demo user (or wipe the mock server) and submit again. Watch *Retrying in Ns* count through 1/2/4/8 s backoff. After 5 attempts it shows **Retry**. Set the failure rate back to 0% and press Retry.
5. **Rejection loop.** Set **Application decision = Reject**. The status screen shows the reason and **Fix ID document**, which takes you back to the ID step with all your data still there. Resubmitting creates a new submission.

## Stack

| Concern | Choice |
|---|---|
| App | Expo SDK 58, Expo Router (typed routes), TypeScript strict, React Compiler |
| UI | React Native Paper (MD3), light/dark from the system |
| Auth | Firebase Auth (JS SDK, AsyncStorage persistence) + native Google Sign-In, with an anonymous demo fallback |
| Forms | react-hook-form + zod, one schema per step |
| Local state | Zustand + `persist` on AsyncStorage (no MMKV, so it also runs in Expo Go) |
| Server state | TanStack Query (status polling). Writes go through the outbox, not mutations |
| Media | expo-image-picker (ID), expo-camera (selfie with an oval guide), expo-document-picker (PDF), expo-image-manipulator (resize to 1600 px, JPEG 0.7), expo-file-system |
| Quality | Jest (jest-expo) + Testing Library, ESLint, GitHub Actions |

## Architecture

```
 (auth)/sign-in ── Google (native) | Demo (anonymous)
 (app)/onboarding/personal → id-document → selfie → offer-letter → review → status
                                                                    (app)/dev-settings
 RHF + zod ──(debounced 300 ms)──> draftStore      (Zustand persist, keyed by Firebase uid)
 Submit ──> outboxStore.enqueue ──> runOutbox() ──> ApiClient (MockApiClient today)
               triggers: app start · NetInfo reconnect · app foregrounded · backoff timer · manual Retry
 status ── TanStack Query getApplicationStatus (polls every 5 s while in review)
 devSettingsStore ──> MockApiClient (latency, failure rate, force offline, forced decision)
```

### Decisions worth discussing

- **Custom outbox, not persisted TanStack mutations.** Resuming paused mutations after a cold start needs `setMutationDefaults` for every key, and the failure modes are hard to see. A small explicit queue ([src/outbox/processor.ts](src/outbox/processor.ts)) is easier to test and to explain. Queries are still TanStack.
- **Idempotency keys.** Each submission gets a UUID. Each document upload uses `${key}:${kind}`. If the app dies mid-send, the item is still `in_flight` on next launch, gets reset to `pending`, and is replayed. The server returns the stored responses instead of creating duplicates. The test *recovers an item killed mid-send and submits it exactly once* covers this.
- **Errors are classified.** `NetworkError` waits for connectivity without spending attempts. 5xx retries with 1/2/4/8 s backoff, 5 attempts max. 4xx fails right away, because retrying a bad file won't fix it.
- **Single-flight processor.** NetInfo, AppState and timers can all fire at once. Concurrent `runOutbox()` calls share one run.
- **Files live in `Paths.document`.** Picker and camera URIs point into cache, which the OS may purge. Every pick is resized, copied to `onboarding/<uid>/`, and the file it replaces is deleted.
- **Expo Go guard.** The Google Sign-In native module is `require`d lazily and only outside Expo Go. A top-level import crashes Expo Go.
- **`ApiClient` is an interface.** [src/api/index.ts](src/api/index.ts) is the only place that picks the mock. An HTTP client would replace one line.

## Run locally

```bash
npm install
npx expo start           # Expo Go: demo user only
npm run typecheck && npm run lint && npm test
```

Android APK (Google Sign-In included):

```bash
eas build -p android --profile preview
```

## Why the Firebase config is committed

[src/lib/firebase/config.ts](src/lib/firebase/config.ts) and `google-services.json` contain **client identifiers, not secrets**. They ship inside every APK anyway. Access is controlled server-side:

- Only the **Google** and **Anonymous** providers are enabled.
- The Android API key can be restricted in Google Cloud Console to package `com.bowery.onboardingdemo` and the EAS signing SHA-1.
- Nothing else in the project (Firestore, Storage) is used. All data stays on the device.

Committing them means a reviewer can clone and run the app with no setup.

## Tests

| Suite | What it protects |
|---|---|
| [schemas.test.ts](__tests__/schemas.test.ts) | Step validation: email, under-18 to the day, required documents, PDF type and 10 MB limit |
| [outbox.test.ts](__tests__/outbox.test.ts) | Backoff schedule, give-up after 5, no retry on 4xx, offline doesn't burn attempts, crash recovery with exactly one application |
| [mockApi.test.ts](__tests__/mockApi.test.ts) | Idempotent submit, force-offline, forced decision |
| [personalForm.test.tsx](__tests__/personalForm.test.tsx) | Typed values reach AsyncStorage and are restored on remount |

Each test states what it protects, what wrong result it rejects, and what it doesn't prove.

## Out of scope

OCR and face matching, real file upload, iOS build, i18n, push notifications, E2E tests (Maestro), an admin panel (the decision is forced from Dev settings), more than one application per user.
