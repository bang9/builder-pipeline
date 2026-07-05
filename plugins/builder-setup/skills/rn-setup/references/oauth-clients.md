# Google Sign-In OAuth Clients (standalone, manual GCP creation)

This app uses **standalone `@react-native-google-signin/google-signin`** — NOT Firebase Auth. The app receives an `idToken` and sends it to the builder's own backend for verification.

> ⚠️ **Do not rely on Firebase auto-creating OAuth clients.** The docs claim that adding a SHA-1 in the Firebase console auto-creates a matching Android OAuth client in GCP. In practice this is unreliable and the client often does not appear in **Google Auth Platform → Clients**. **Create every OAuth client manually in GCP.**

## What you create (4 clients total)

All under **Google Auth Platform → Clients → + CREATE CLIENT** (`https://console.cloud.google.com/auth/clients`), in the **same project** as the Firebase project.

### 1 × Web application client → this is `webClientId`

- Application type: **Web application**.
- Authorized JS origins / redirect URIs: leave **empty** (the native SDK does not use them).
- **The resulting client ID string is the one and only value referenced in app code**, passed as `webClientId` to `GoogleSignin.configure`.
- **Why Web, not Android:** Google Sign-In returns an **ID token** whose `aud` (audience) claim = the **Web** client ID. That's what your backend validates. Passing an Android client ID as `webClientId` throws `DEVELOPER_ERROR`.

### 3 × Android clients → one per SHA-1 (these are never referenced in code)

In GCP, an Android OAuth client = **(package name + exactly ONE SHA-1)**. You cannot attach multiple SHA-1s to one client, so you make one client per signing key. Application type: **Android**; **Package name** = `expo.android.package`; **SHA-1** = the value below.

| Client | SHA-1 source | Authorizes |
| --- | --- | --- |
| `android-debug` | Fixed template debug keystore — see `debug-keystore.md` | Local `expo run:android` / dev-client debug builds |
| `android-eas` | EAS keystore — Expo dashboard **Credentials** or `eas credentials` | `eas build` release/preview builds |
| `android-play` | Play **app-signing** key SHA-1 — Play Console App signing page | Builds distributed via the Play Store |

These Android clients only need to **exist** (matching package + SHA-1). At sign-in, Google matches the running app's package + signing fingerprint against them to authorize the request. If the SHA-1 of the build isn't registered, sign-in **fails silently** (the account picker dismisses and nothing happens).

## App code (standalone)

```js
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // the Web client from GCP
  offlineAccess: true, // set if your backend needs a serverAuthCode / refresh token
});

// On sign-in:
const { idToken } = await GoogleSignin.signIn();
// Send idToken to your own backend to verify (aud === webClientId) and issue a session.
```

- Requires a **development build** (native code) — does NOT work in Expo Go. Add the config plugin: `"plugins": ["@react-native-google-signin/google-signin"]`.
- `webClientId: 'autoDetect'` works on Android only if `google-services.json` is present (it reads the Gradle-generated `default_web_client_id`). Passing the explicit string is the most predictable — use that.

## OAuth consent screen (Google Auth Platform)

For basic Google Sign-In (name / email / profile — non-sensitive scopes) **no Google verification is required**.

1. **Branding** (`/auth/branding`): app name, support email, authorized domains.
2. **Audience** (`/auth/audience`): **External** user type. While in **Testing**, add your Google account under **Test users** (up to 100). To open to all users, click **Publish app** → **In production** (no verification needed for non-sensitive scopes).
3. **Clients** (`/auth/clients`): create the 4 clients above.

## Values to record (in the state file)

- Web client ID (→ `webClientId`, goes into app code)
- Each Android client ID + which SHA-1 (debug / eas / play) — for your own tracking; not used in code
- (If `offlineAccess`) Web client secret — shown once; only needed by your backend
