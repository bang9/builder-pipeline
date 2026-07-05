# Debug Keystore SHA-1 (fixed template value)

Expo's prebuild bare template and the React Native community template both ship the **same committed `android/app/debug.keystore`**. Because the file is identical across every project using those templates, its fingerprint is **fixed and reusable** — you can register it once as a hardcoded value.

Alias `androiddebugkey`, storepass/keypass `android`, CN=Android Debug.

The fixed **SHA-1** literal is the single source of truth in `SKILL.md` Phase 1d — use that value for the **`android-debug`** GCP OAuth client (package name = your `expo.android.package`). It authorizes Google Sign-In for local debug builds (`expo run:android`, dev-client) of a prebuilt Expo/RN app. The corresponding **SHA-256** (rarely needed for OAuth, which uses SHA-1) is:

- **SHA-256:** `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

## Verify locally (recommended before trusting the fixed value)

After `npx expo prebuild`, from the project root:

```bash
keytool -list -v \
  -keystore android/app/debug.keystore \
  -alias androiddebugkey \
  -storepass android -keypass android
```

Compare the printed **SHA1** line to the value above. If it differs, use the printed value — see caveats.

## Caveats

- The fixed value holds **only** for the debug keystore committed in the template. If someone regenerated it, or a build used the per-machine `~/.android/debug.keystore` (auto-created by Android Studio/SDK) instead of the committed one, the SHA-1 will differ. `android/app/debug.keystore` (committed template) ≠ `~/.android/debug.keystore` (per-machine).
- To get the per-machine debug SHA-1 instead: `cd android && ./gradlew signingReport` and read the `debug` variant's SHA1.
- **Debug ≠ release/EAS.** EAS Build signs with its own keystore; that SHA-1 comes from the Expo dashboard Credentials page or `eas credentials`, never from `debug.keystore`.
- Do not confuse the template file with `expo/expo/android/debug.keystore` (the Expo repo's own file), which is a **different** keystore (SHA-1 `89:2B:2B:46:90:7B:26:D3:E7:29:82:9A:FC:E1:54:46:B9:94:74:50`) and is NOT what prebuild copies into user projects.
