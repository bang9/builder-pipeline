---
name: rn-setup
description: >-
  Use when a solo builder wants to set up a new React Native / Expo app's
  external services before its first release — EAS + Android signing credentials,
  a Firebase/GCP project, standalone Google Sign-In OAuth clients, and a Google
  Play Console app. Triggers: "RN/Expo 앱 셋업", "expo 앱 초기 세팅", "EAS 프로젝트
  만들기", "Google Sign-In 셋업", "Firebase + GCP + Play Console 연결".
---

# RN Mobile App Setup

Provision every external service a React Native / Expo Android app needs before
its first release, and capture the credentials that tie them together. This is a
long, multi-console workflow — it is **resumable** via a state file, and each
phase ends with a **verification gate** before moving on.

## Auth model (fixed for this skill)

Google Sign-In is **standalone `@react-native-google-signin/google-signin`** —
the app gets an `idToken` and sends it to the builder's own backend. **Firebase
Authentication is NOT used.** Do not add a "Firebase Auth → enable Google
provider" step. See `references/oauth-clients.md`.

> ⚠️ **Firebase does not reliably auto-create GCP OAuth clients.** Ignore any doc
> that says adding a SHA-1 in Firebase creates the Android OAuth client. **Create
> all OAuth clients manually in GCP** (Phase 3).

Everything this skill produces (EAS project id, the three SHA-1s, the Firebase/GCP
project, the OAuth clients, the Play app) is captured in the state file — its
schema below is the authoritative list of artifacts.

---

## Prerequisites — confirm before starting

Ask the user to confirm they have these; stop and surface any that are missing.

**Accounts (must be logged in — this skill drives the browser as the user):**
- Expo account (expo.dev)
- Google account (for Firebase + Google Cloud)
- Google Play Developer account ($25 one-time, identity-verified) — only needed for Phase 4+

**Local tools:**
- Node ≥ 20, the app's package manager (pnpm/npm/yarn)
- `eas-cli` (`npm i -g eas-cli`) and logged in (`eas login`)
- `keytool` (ships with any JDK) — for verifying SHA-1s
- The RN/Expo app project already exists locally (this skill does not scaffold an app)

**Browser automation:** Load the Chrome tools in one call before any console work:

```
ToolSearch "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__form_input,mcp__claude-in-chrome__find"
```

Then call `tabs_context_mcp` first and open a **new tab** for this work (never reuse a random existing tab).

---

## Operating rules (browser automation)

1. **Read before you click.** Console UIs drift constantly. Use `read_page` /
   `get_page_text` to confirm you're on the right screen and to find the current
   label before acting. `references/console-urls.md` has the landmarks, but treat
   them as hints, not gospel.
2. **Capture every value into the state file the moment it appears** — SHA-1s,
   client IDs, project IDs. Don't rely on re-finding them.
3. **Never trigger native dialogs** (JS `alert`/`confirm`, "Delete" confirmations).
   If a destructive action is unavoidable, warn the user first.
4. **Pause at each verification gate.** Confirm the phase's success condition (and
   show the user the captured values) before starting the next phase.
5. **Confirm before outward/irreversible actions** — creating the Play app
   (name/free-paid choices are sticky), publishing the OAuth consent screen,
   uploading the first AAB. Show what you're about to do and get a yes.
6. If a console step fails **2–3 times**, stop and ask the user rather than
   flailing. Some steps (identity verification, payment, 2FA) only the user can do.

---

## State file (resumable)

Maintain `.builder-pipeline/rn-setup.state.json` at the repo root. Read it at the
start; create it if absent. Update it after every captured value. Use it to skip
already-completed phases on re-run.

```jsonc
{
  "app": { "name": null, "androidPackage": null, "iosBundleId": null, "slug": null, "owner": null },
  "eas": { "projectId": null, "androidSha1": null, "androidSha256": null, "buildProfile": null },
  "debug": { "sha1": null, "source": null },            // "template" | "local" | "gradle"
  "firebase": { "projectId": null, "projectNumber": null, "androidAppRegistered": false, "googleServicesFile": false },
  "oauth": {
    "consentConfigured": false,
    "webClientId": null,
    "androidClients": { "debug": null, "eas": null, "play": null }  // client id or null
  },
  "play": { "appCreated": false, "firstAabUploaded": false, "appSigningSha1": null, "appSigningSha256": null, "uploadKeySha1": null },
  "wiring": { "plugin": false, "webClientIdInCode": false, "googleServicesReferenced": false }
}
```

Add `.builder-pipeline/` to `.gitignore` — it holds project-identifying values.

---

## Phase 0 — Preflight: app identity

**Goal:** the app has a real name and Android package (bundle id) before anything
external is created (both are effectively immutable once services reference them).

1. Find the config: `app.json`, else `app.config.js` / `app.config.ts` (dynamic
   config wins if both exist). Read `expo.name`, `expo.android.package`,
   `expo.ios.bundleIdentifier`, `expo.slug`, `expo.owner`.
2. **Detect missing/placeholder values:**
   - `expo.android.package` absent, or matching `com.anonymous.*`, `com.example.*`,
     or containing the raw template slug → treat as **unset**.
   - `expo.name` generic (`"my-app"`, `"Expo App"`, folder name) → treat as unset.
   - Package must be lowercase reverse-DNS, dot-separated, each segment starting
     with a letter, **no hyphens** (e.g. `com.company.app`).
3. **If anything is unset, ASK the user** for the app display name and the desired
   package/bundle id (recommend the same string for `android.package` and
   `ios.bundleIdentifier`). Then write them into the config.
4. Record `name`, `androidPackage`, `iosBundleId`, `slug`, `owner` in the state file.

**Gate:** state file `app.*` populated with real (non-placeholder) values.

---

## Phase 1 — EAS project + Android credentials (SHA-1)

**Goal:** an EAS project linked in `app.json`, an EAS-managed Android keystore, and
its SHA-1 captured. Also record the fixed debug SHA-1.

### 1a. Link the EAS project (CLI — unavoidable)
- Run `eas init` (alias `eas project:init`) from the project root (user must be
  logged in via `eas login`). It creates/links the server project and **writes
  `expo.extra.eas.projectId`** (a UUID) plus reconciles `slug`/`owner`.
- Record `eas.projectId` in the state file.

### 1b. Generate the Android keystore
- Trigger keystore generation. Either:
  - `eas build --platform android --profile preview` (or `production`) — on first
    build EAS prompts **"Generate a new Android Keystore?" → Yes**; or
  - `eas credentials` → **Android** → select profile → let it generate the keystore
    (no full build needed).
- Note the **build profile** used — EAS keystores are keyed by `(app id + profile)`,
  so different profiles can have different SHA-1s. Record `eas.buildProfile`.

### 1c. Capture the EAS SHA-1 (browser)
- Open the Expo **Credentials** page:
  `https://expo.dev/accounts/[account]/projects/[project]/credentials`.
- Select the **Android** application identifier → expand the **Keystore** entry →
  copy **SHA-1 Fingerprint** (and SHA-256).
- (CLI alternative: `eas credentials` → Android → profile → view keystore.)
- Record `eas.androidSha1` / `eas.androidSha256`.

### 1d. Record the debug SHA-1 (fixed)
- The Expo/RN template `android/app/debug.keystore` has a **fixed** SHA-1:
  `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
- Prefer to **verify** it (after `npx expo prebuild`):
  `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`
  and use the printed SHA1 if it differs. See `references/debug-keystore.md`.
- Record `debug.sha1` and `debug.source`.

**Gate:** `eas.projectId`, `eas.androidSha1`, and `debug.sha1` all captured.

---

## Phase 2 — Firebase project (+ GCP project) + Android app

**Goal:** a Firebase project (which creates the underlying GCP project used in
Phase 3), an Android app registered in it, and `google-services.json` wired into
the app. (Firebase is kept for FCM / other services; Auth is not used.)

1. **Create the project** at `https://console.firebase.google.com/` → **Add
   project** → name → (optionally edit the project ID — immutable after) →
   Analytics toggle (skippable) → **Create project**.
   - A Firebase project **is** a GCP project (same project ID + number). Record
     `firebase.projectId` and `firebase.projectNumber` (visible in Project settings).
2. **Register the Android app:** Project overview → **Android** icon → fields:
   - **Android package name** = `state.app.androidPackage` (exact, case-sensitive).
   - App nickname (optional). Debug SHA-1 field: optional — you can skip it here
     (standalone Google Sign-In is authorized by the GCP Android clients in
     Phase 3, not by Firebase). → **Register app**.
3. **Download `google-services.json`** → place at the **project root**
   (`./google-services.json`) and reference it in config:
   ```json
   { "expo": { "android": { "googleServicesFile": "./google-services.json" } } }
   ```
   Record `firebase.androidAppRegistered = true`, `firebase.googleServicesFile = true`,
   `wiring.googleServicesReferenced = true`.

**Gate:** Firebase project exists, Android app registered, `google-services.json`
present and referenced.

---

## Phase 3 — GCP OAuth clients (manual) + wire `webClientId`

**Goal:** the OAuth consent screen configured and **4 OAuth clients created by hand
in GCP** — 1 Web (→ `webClientId`) + 3 Android (debug / eas / play SHA-1s). This is
what actually authorizes standalone Google Sign-In. Full detail in
`references/oauth-clients.md`.

Work in the **same project** as Phase 2 (check the top-bar project picker at
`https://console.cloud.google.com/`).

### 3a. Consent screen — Google Auth Platform
- `https://console.cloud.google.com/auth/branding` — app name, support email,
  authorized domains.
- `https://console.cloud.google.com/auth/audience` — User type **External**; add
  the user's Google account under **Test users** for development. (Basic
  profile/email scopes need **no** verification; **Publish app** → In production
  when ready.) Record `oauth.consentConfigured = true`.

### 3b. Web client → `webClientId`
- `https://console.cloud.google.com/auth/clients` → **+ CREATE CLIENT** →
  **Web application** → leave origins/redirects empty → Create.
- Copy the client ID → record `oauth.webClientId`.

### 3c. Three Android clients (one per SHA-1)
For each of the three SHA-1s, create an **Android** client with **Package name =
`state.app.androidPackage`** and that SHA-1:
- `android-debug` → `state.debug.sha1`
- `android-eas` → `state.eas.androidSha1`
- `android-play` → **skip for now** — the Play app-signing SHA-1 doesn't exist
  until Phase 4. Leave `oauth.androidClients.play = null`.

Record each created client ID under `oauth.androidClients.*`. These are never
referenced in code — they only need to exist.

### 3d. Wire the app (standalone)
- Add the config plugin to `app.json`: `"plugins": ["@react-native-google-signin/google-signin"]`
  (install the package if absent). Record `wiring.plugin = true`.
- In app code, configure with the **Web** client ID:
  ```js
  GoogleSignin.configure({ webClientId: '<oauth.webClientId>', offlineAccess: true });
  ```
  and send the returned `idToken` to the builder's backend. Record
  `wiring.webClientIdInCode = true`.
- Rebuild a dev/preview build and confirm sign-in works for the **debug** and
  **EAS** builds (their SHA-1s are now registered).

**Gate:** `oauth.webClientId` set; `androidClients.debug` and `.eas` created;
app configured; Google Sign-In works on a debug/EAS build.

---

## Phase 4 — Play Console app + app-signing SHA-1

**Goal:** the Play app created and its **app-signing SHA-1** captured. Read
`references/troubleshooting.md` "Play Console" first — there are hard ordering
constraints.

> ⚠️ **Ordering:** Play generates the app-signing key **on the first AAB upload**.
> You **cannot read the app-signing SHA-1 until at least one AAB is uploaded**
> (Internal testing track is enough — production is not required). And the **first
> upload must be done manually** in the UI (Play API blocks the first upload).

1. **Create the app** (confirm with user first — some choices are sticky):
   `https://play.google.com/console` → **Create app** → app name, default
   language, App/Game, **Free/Paid** (Free→Paid is irreversible), accept
   declarations + **Play App Signing ToS**. Record `play.appCreated = true`.
2. **Build a production AAB:** `eas build --platform android --profile production`.
3. **Upload the first AAB manually** to the **Internal testing** track in the Play
   Console UI (one-time API limitation). Confirm with the user before uploading.
   Record `play.firstAabUploaded = true`.
4. **Read the app-signing SHA-1:** select the app → **Protected with Play** → Play
   App Signing (fallback: **Test and release → Setup → App integrity → App
   signing**). Copy **App signing key certificate** SHA-1 (+ SHA-256) and the
   Upload key SHA-1. Record `play.appSigningSha1`, `play.appSigningSha256`,
   `play.uploadKeySha1`.

**Gate:** `play.appSigningSha1` captured.

> Note the **production gate** for new personal accounts: 12 testers opted-in for
> 14 consecutive days before production access. This does **not** block getting the
> SHA-1. Flag it to the user as a scheduling item.

---

## Phase 5 — Register Play SHA-1 → finalize Google Sign-In

**Goal:** Google Sign-In works on the **Play Store distribution build** too.

1. Create the third Android OAuth client `android-play` in GCP (Phase 3c method)
   with **Package name = `state.app.androidPackage`** and SHA-1 =
   `state.play.appSigningSha1`. Record `oauth.androidClients.play`.
2. (Optional) Add the Play app-signing SHA-1/SHA-256 as a fingerprint in Firebase
   too if other Firebase features need it.
3. Re-`eas build` / `eas submit` as needed; verify sign-in on a Play-delivered
   (internal testing) install.

**Gate:** all three `oauth.androidClients.*` populated; sign-in verified on a Play
build.

---

## Final handoff

Show the user the completed state file and a short summary:
- EAS project id, the 3 SHA-1s (debug / eas / play) and which OAuth client each maps to
- `webClientId` (the only value in app code)
- Firebase / GCP project id, Play app status
- Outstanding items (e.g. Play 12-tester/14-day production gate, consent-screen
  publishing) as an explicit TODO list.

For deep detail during any phase, read the matching file in `references/`:
`console-urls.md`, `oauth-clients.md`, `debug-keystore.md`, `troubleshooting.md`.
