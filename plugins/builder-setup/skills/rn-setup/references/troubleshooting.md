# Troubleshooting & Gotchas

## Google Sign-In

### `DEVELOPER_ERROR` on sign-in
- Almost always a **wrong `webClientId`** or a **missing Android OAuth client** for the running build's SHA-1.
- Check: `webClientId` must be the **Web** client ID (not an Android client ID, not the iOS client ID).
- Check: an **Android** OAuth client exists in GCP with `(package name, SHA-1)` matching *this* build. Debug build → debug SHA-1; EAS build → EAS SHA-1; Play build → Play app-signing SHA-1.
- Package name must match `expo.android.package` exactly (case-sensitive).

### Account picker appears, you pick an account, then nothing happens (silent failure)
- The build's signing SHA-1 is **not registered** as an Android OAuth client. Add it.
- Classic case: **works in debug/EAS, breaks on the Play Store build** → you forgot the **Play app-signing SHA-1** (Play re-signs with its own key). Register the Play app-signing SHA-1 as the `android-play` client.

### Firebase "does not auto-create the OAuth client"
- Correct — do not expect it to. Create all OAuth clients manually in **Google Auth Platform → Clients**. Adding a SHA-1 in Firebase is only for other Firebase features, not for standalone Google Sign-In.

### `An OAuth2 client already exists for this package name and SHA-1 in another project`
- The `(package name + SHA-1)` pair is globally unique across all Google projects. You (or a prior project) already registered it elsewhere. Remove it from the other project or change the package name.

## EAS / credentials

### SHA-1 differs between build profiles
- EAS keystores are keyed by **(app identifier + build profile)**. `development`, `preview`, `production` can resolve to **different keystores** → different SHA-1s. Register whichever profile's SHA-1 you actually ship, or align profiles to share one keystore.

### Can't find the SHA-1
- Expo dashboard → **Credentials** → Android identifier → **Keystore** → SHA-1 Fingerprint. Or `eas credentials` → Android → profile → view keystore.

## Play Console (ordering constraints)

### App-signing SHA-1 is not shown yet
- By default Play generates the app-signing key **on your first AAB upload**. **You cannot read the app-signing SHA-1 before uploading at least one bundle** (internal testing track is enough — production release NOT required).
- Exception: if you opted in by supplying your own signing key, it exists earlier.

### First upload must be manual
- Google's Play Developer API forbids the *first* upload. Upload the first AAB **by hand** to the **Internal testing** track in the Play Console UI. After that, `eas submit` works for all subsequent uploads.

### New personal account can't reach production
- Personal developer accounts created after ~Nov 2023 must run a **closed test with 12 testers opted-in for 14 consecutive days** before applying for production access. (Was 20 testers before Dec 2024 — current is **12**.) Organization accounts are exempt.
- This gate blocks **production rollout only** — it does **not** block getting the app-signing SHA-1 (internal testing upload suffices).

### Free → Paid
- Setting an app to Paid is **not reversible** back to Free. Choose carefully at creation.

## Config / wiring

### `google-services.json` changes not taking effect
- Re-run `npx expo prebuild --clean` and rebuild after editing `expo.android.googleServicesFile` or re-downloading the file.

### Google Sign-In doesn't work in Expo Go
- Expected. It needs native code → use a **development build** (`expo run:android` or an EAS dev build), never Expo Go.
