# Console URLs & Navigation Landmarks

Exact URLs and UI landmarks for the four consoles this skill drives. Console UIs drift — always **read the page** with `read_page` / `get_page_text` and adapt if a label moved. These are the current (2026) landmarks.

## Expo (expo.dev)

| What | URL |
| --- | --- |
| Dashboard / all projects | `https://expo.dev/accounts/[account]/projects` |
| Project overview | `https://expo.dev/accounts/[account]/projects/[project]` |
| **Credentials (SHA-1 lives here)** | `https://expo.dev/accounts/[account]/projects/[project]/credentials` |
| Builds | `https://expo.dev/accounts/[account]/projects/[project]/builds` |

- Left sidebar per project: **Overview, Builds, Submissions, Updates, Credentials, Configuration/Settings**.
- On **Credentials**: pick the **Android** application identifier → expand the **Keystore** entry → labeled **SHA-1 Fingerprint / SHA-256 Fingerprint / MD5 Fingerprint / Key Alias**.

## Firebase (console.firebase.google.com)

| What | URL / path |
| --- | --- |
| Console home | `https://console.firebase.google.com/` |
| Add project | Home → **Add project** tile |
| Project settings | gear icon → **Project settings** → **General** |
| SHA fingerprints | Project settings → **General** → **Your apps** card → select Android app → **Add fingerprint** |

- Add Android app: **Project overview → Android icon** (or **Add app → Android**).
- Register fields: **Android package name** (= `expo.android.package`), **App nickname** (optional), **Debug signing certificate SHA-1** (optional, add later).
- Config download: **Download google-services.json**.

## Google Cloud — Google Auth Platform (console.cloud.google.com)

The old **APIs & Services → OAuth consent screen** was renamed to **Google Auth Platform** (tabs). New projects hit a **"Get started" wizard** first.

| Tab | URL |
| --- | --- |
| Overview / Get started | `https://console.cloud.google.com/auth/overview` |
| **Branding** | `https://console.cloud.google.com/auth/branding` |
| **Audience** (user type, test users, publish) | `https://console.cloud.google.com/auth/audience` |
| **Clients** (OAuth 2.0 client IDs) | `https://console.cloud.google.com/auth/clients` |
| Data Access (scopes) | `https://console.cloud.google.com/auth/scopes` |
| Legacy Credentials view | `https://console.cloud.google.com/apis/credentials` |

- Create a client: **Clients → + CREATE CLIENT** (or legacy **APIs & Services → Credentials → Create Credentials → OAuth client ID**).
- The project picker (top bar) must show the **same project** as the Firebase project.

## Google Play Console (play.google.com/console)

| What | URL / path |
| --- | --- |
| Console | `https://play.google.com/console` |
| Sign-up | `https://play.google.com/console/signup` |
| Create app | **All apps** list → **Create app** (top-right) |
| App-signing SHA-1 (new layout) | select app → **Protected with Play** → Play App Signing |
| App-signing SHA-1 (classic layout) | **Test and release → Setup → App integrity → App signing** |

- **Try "Protected with Play" first, fall back to "Test and release → Setup → App integrity → App signing"** — Google is mid-migration; both reach the same panel.
- Displayed there: **App signing key certificate** (SHA-1 / SHA-256 / MD5) and **Upload key certificate** (SHA-1 / SHA-256 / MD5).
