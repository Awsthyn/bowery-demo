# Candidate Onboarding

[![CI](https://github.com/Awsthyn/bowery-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/Awsthyn/bowery-demo/actions/workflows/ci.yml)

An Expo / React Native app where a job candidate completes hiring paperwork: personal details, ID front and back, a selfie and a signed offer letter (PDF), then submits for review.

The project is built around the problems that decide whether this kind of app works in the field:

- **Progress is never lost.** Every keystroke and every captured file is persisted. The app can be killed at any point and resumes on the same step.
- **Submissions survive bad networks.** Writes go through a durable outbox with idempotency keys, error-aware retries and crash recovery, so a flaky connection never produces a lost or duplicated application.
- **Failure is testable on purpose.** The backend is an in-app mock behind an `ApiClient` interface. A Dev settings screen lets you force offline mode, latency, server errors and the review decision.

## Try it

| Option | How | Notes |
|---|---|---|
| Android APK | [Install from EAS](https://expo.dev/accounts/awsthyn/projects/candidate-onboarding-demo/builds/5fe08eb7-f3a4-46b1-9208-425d4e146806) (QR or download) | Full experience, including Google Sign-In |
| Expo Go | `npm install && npx expo start`, scan the QR | Google Sign-In is hidden (native module); use **Continue as demo user** |

### Reviewer script (about 5 minutes)

1. **Sign in** with Google, or tap **Continue as demo user** (Firebase Anonymous Auth).
2. **Kill and resume.** Type a name on *Personal info*, wait a second, kill the app from recents, then reopen it. You return to the same step with the text intact. The same holds on later steps; captured photos and the PDF survive restarts.
3. **Offline submit.** Complete the wizard. Open **⋮ → Dev settings**, turn on **Force offline** (or use airplane mode), then **Submit**. Status shows *Waiting for connection*. Go back online: the submission is sent and status becomes *In review*.
4. **Flaky server.** Set **Failure rate = 100%**, start a new application (sign out as demo user, sign in again) and submit. Status counts down through 1, 2, 4 and 8 s retries. After 5 attempts it shows **Retry**. Set the failure rate to 0% and press Retry.
5. **Rejection loop.** Set **Application decision = Reject**. Status shows the reason and **Fix ID document**, which reopens the ID step with all other data intact. Resubmitting creates a new submission.

## Where to look

| If you want to review… | Start here |
|---|---|
| Offline queue, retries, idempotency | [src/outbox/processor.ts](src/outbox/processor.ts), [src/outbox/useOutboxTriggers.ts](src/outbox/useOutboxTriggers.ts) |
| Backend contract and mock | [src/api/ApiClient.ts](src/api/ApiClient.ts), [src/api/MockApiClient.ts](src/api/MockApiClient.ts) |
| Form state persisted across steps | [src/features/onboarding/usePersonalForm.ts](src/features/onboarding/usePersonalForm.ts), [src/stores/draftStore.ts](src/stores/draftStore.ts) |
| Validation | [src/features/onboarding/schemas.ts](src/features/onboarding/schemas.ts) |
| Camera, picker and file handling | [src/features/onboarding/pickers.ts](src/features/onboarding/pickers.ts), [src/lib/files.ts](src/lib/files.ts), [src/components/SelfieCamera.tsx](src/components/SelfieCamera.tsx) |
| Auth (Google, anonymous, Expo Go guard) | [src/lib/firebase/auth.ts](src/lib/firebase/auth.ts) |
| Routing and guards | [src/app/](src/app/) |
| Data model | [src/domain/types.ts](src/domain/types.ts) |

## Architecture

```
src/app (Expo Router)
  (auth)/sign-in            Google (native) | Demo (anonymous)
  (app)/onboarding/*        personal → id-document → selfie → offer-letter → review
  (app)/status              outbox state, then server status
  (app)/dev-settings        drives the mock backend

Writes                                       Reads
------                                       -----
RHF + zod per step                           TanStack Query
  └─ debounced 300 ms ─> draftStore            └─ getApplicationStatus
                         (Zustand persist,         (polls every 5 s while in review)
                          keyed by Firebase uid)
Review "Submit"
  └─> outboxStore.enqueue ─> runOutbox() ─> ApiClient ─> MockApiClient
        triggers: app start, reconnect (NetInfo), app foregrounded,
                  backoff deadline, manual Retry
```

Layering rules:

- `src/domain` holds plain types with no dependencies.
- `src/api` exposes an interface. [src/api/index.ts](src/api/index.ts) is the only place that chooses the implementation, so swapping in an HTTP client is a one-line change.
- Screens never call the API to write. They enqueue, and the outbox owns delivery.
- The root layout renders nothing until the persisted stores have rehydrated and Firebase has restored the session, so routing decisions never read an empty draft.

## Reliability guarantees and how they are verified

| Guarantee | Mechanism | Test |
|---|---|---|
| A submission interrupted by a kill is sent exactly once | Items left `in_flight` reset to `pending` on rehydrate; uploads use `<key>:<kind>` and submit uses `<key>`; the server replays stored responses | `outbox.test.ts` › recovers an item killed mid-send and submits it exactly once |
| Being offline does not consume retries | `NetworkError` returns the item to `pending` with attempts unchanged; it resumes on reconnect | `outbox.test.ts` › keeps attempts unchanged while offline |
| Server errors back off, then stop | 5xx: 1/2/4/8 s backoff, `failed` after 5 attempts. 4xx: `failed` immediately | `outbox.test.ts` › backoff, give-up, no-retry-on-4xx |
| Duplicate requests do not create duplicate records | Idempotency map in the mock server | `mockApi.test.ts` › same application for a repeated key |
| Typed values survive leaving the screen | `subscribe()` + 300 ms debounce, flushed on unmount | `personalForm.test.tsx` |
| Invalid input cannot be submitted | One zod schema per step, plus a full-submission schema reused by Review | `schemas.test.ts` (email, under-18 to the day, missing document, PDF type and 10 MB limit) |
| Concurrent triggers do not double-send | `runOutbox()` is single-flight | Covered by design; not unit-tested |

Each test is annotated with what it protects, the wrong result it rejects, and what it does not prove. A passing test is not treated as proof of device behavior: camera, pickers and Google Sign-In are outside the suite and are checked by hand on an Android device.

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `npm ci`, typecheck, lint and the test suite on every push.

## Key decisions

- **Custom outbox instead of persisted TanStack mutations.** Resuming paused mutations after a cold start requires `setMutationDefaults` for every mutation key, and its failure modes are hard to observe. A small explicit queue is easier to test, explain and extend. TanStack Query still handles reads.
- **Errors are classified, not just retried.** Network, retryable server and non-retryable client errors each have a different policy. Retrying a rejected file never fixes it; retrying offline only burns the budget.
- **Files are copied into `Paths.document`.** Picker and camera URIs point into cache, which the OS can purge between launches. Each pick is resized (1600 px long side, JPEG 0.7), copied to `onboarding/<uid>/`, and the file it replaces is deleted.
- **Selfie uses `expo-camera`, ID uses `expo-image-picker`.** The system camera intent often ignores the front-camera hint on Android, and the selfie needs a face guide. The ID step benefits from allowing gallery uploads.
- **AsyncStorage over MMKV.** Keeps the app runnable in Expo Go for quick review. The cost is discussed below.
- **Draft keyed by Firebase uid.** Switching accounts never mixes data. Signing out an anonymous user deletes its draft, queue and files, since that uid can never sign in again.

## Known limitations and next steps

These are deliberate cuts. Each one is listed with the trade-off it carries and what would change in production.

1. **Sensitive data is stored unencrypted on the device.** ID images, the selfie and personal data sit in the document directory and AsyncStorage in plain form. For production: encrypt at rest with a key held in `expo-secure-store` (Keychain / Keystore), and delete local copies once the server confirms receipt. Today, a Google user's draft also remains on the device after sign-out.
2. **One outbox item uploads all four documents.** This works against the mock. With real multi-megabyte files on mobile networks, one item per document plus a dependent submit item gives per-file retries and progress. Uploads should go to presigned storage URLs, ideally as background upload tasks so they continue when the app is closed.
3. **Expo Go compatibility limits capture quality.** Dropping Expo Go (dev client only) unlocks MMKV (synchronous, avoids re-serialising the whole draft), the ML Kit document scanner (auto-crop, perspective fix, blur detection) and on-device face detection. For identity documents, capture quality outweighs QR-code convenience, because a blurry photo costs a rejected application later.
4. **Persisted state has versions but no migrations yet.** Every persisted store declares `version: 1`. The first schema change must ship a `migrate` function plus a test that hydrates the previous shape, or queued submissions from older app versions could get stuck.
5. **The device is the only source of truth for drafts.** Reinstalling the app or switching phones loses progress, and anonymous users cannot upgrade to Google without losing data. Next steps: upload each document as soon as it is captured, keep a lightweight server-side draft, and use `linkWithCredential` to upgrade anonymous accounts.
6. **Status uses polling.** It refreshes only while the screen is open. Push notifications (FCM) would notify the candidate in the background.
7. **No E2E tests or production telemetry.** Next: Maestro flows for the critical path (offline submit, kill mid-send, reconnect) and Sentry breadcrumbs carrying outbox state.
8. **The mock and a real backend could drift.** With a real API, generate types from an OpenAPI spec and add contract tests against it.

## Stack

| Concern | Choice |
|---|---|
| Runtime | Expo SDK 58, React Native 0.88, TypeScript (strict), React Compiler |
| Navigation | Expo Router (typed routes) |
| UI | React Native Paper (Material 3), light and dark themes |
| Auth | Firebase Auth JS SDK with AsyncStorage persistence; `@react-native-google-signin/google-signin` |
| Forms | react-hook-form + zod |
| Local state | Zustand + `persist` on AsyncStorage |
| Server state | TanStack Query |
| Connectivity | `@react-native-community/netinfo` |
| Media | expo-camera, expo-image-picker, expo-document-picker, expo-image-manipulator, expo-file-system |
| Tooling | Jest (jest-expo), React Native Testing Library, ESLint (eslint-config-expo), GitHub Actions, EAS Build |

## Run and build

```bash
npm install
npx expo start                                   # Expo Go: demo user only
npm run typecheck && npm run lint && npm test
eas build -p android --profile preview           # APK with Google Sign-In
```

## Why the Firebase config is committed

[src/lib/firebase/config.ts](src/lib/firebase/config.ts) and `google-services.json` contain client identifiers, not secrets. They ship inside every APK anyway. Access is controlled server-side:

- Only the Google and Anonymous sign-in providers are enabled.
- The Android API key can be restricted in Google Cloud Console to package `com.bowery.onboardingdemo` and the EAS signing SHA-1.
- No other Firebase service is used. All application data stays on the device.

Committing them lets a reviewer clone and run the project without setup.

## Out of scope

OCR and face matching, real file storage, an iOS build, i18n, push notifications, an admin panel (the review decision is set from Dev settings), and more than one application per user.
