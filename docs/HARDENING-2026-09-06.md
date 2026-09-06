# Presence hardening log — 2026-09-06

Running record of every change made in the security + functionality round that
acted on `docs/AUDIT-2026-09-06.md` and the cso-vibecheck 22-check audit
(`docs/CSO-VIBECHECK-2026-09-06.md`). Each entry says **what** changed and **why**,
so a later session can tell a deliberate decision from an accident.

Conventions: `C1…H4/M1…M4` refer to the audit's finding IDs. `Check N` refers to
cso-vibecheck's numbered checks. Status at the end of the round: **every audit
finding closed in code**, 34 test suites / 263 tests green, web bundle builds.
What still needs a human is in §9.

---

## 0. Ground rules for this round

- Fix at the root, in the shared function, not per caller.
- Fail **closed** on missing secrets; fail **open** only where the alternative is
  locking every student out of their own data (revocation lookup, rate limiter).
- No new client-visible secrets. Anything the app can fetch, an attacker can fetch.
- Every non-trivial change leaves a test behind.
- Delete what was never verified to work rather than keep it "for other colleges".

---

## 1. Critical findings (C1–C4)

### C1 — device identity is per install, not md5(roll number)
**Files:** `api/_session-utils.js` (`resolveDeviceId`, `mintPersistentToken`),
`api/erp-login.js`, `api/erp-verify-otp.js`, `api/erp-session.js`,
`api/_data-session.js`, `src/storage/erpTokenStorage.js` (`getDeviceId`),
`src/services/erpService.js`.

- `generateDeviceUUID(username)` (unsalted MD5 of the roll) is **gone**. The test
  `security-hardening.test.js › C1` asserts it no longer exists and that fresh ids
  never equal the old MD5.
- The client mints a random UUID once per install with `expo-crypto`
  (`@presence_device_id`) and sends it on `erp-login` and `erp-session refresh`.
  The server accepts it only if it is a well-formed UUID, otherwise mints its own
  with `crypto.randomUUID()`. It never derives anything from the username.
- The device id is sealed into the **persistent token** and the **OTP ticket**, so
  every later silent re-login presents the same device without the client having
  to send it on data calls.
- **Consequence, accepted on purpose:** every existing user gets **one OTP** on
  the first sync after deploy (their old "device" was the MD5 and the ERP will not
  trust a new one). After that the phone is genuinely trusted. A new phone always
  gets an OTP — that is the university's MFA working, not a bug.

### C2 — OTP brute force capped at 5 tries per ticket
**Files:** `api/_rate-limit.js` (new), `api/erp-verify-otp.js`.

- New shared limiter: fixed window, one Firestore document per (scope, key) under
  `rateLimits/`, transactional, **fails open** on infrastructure errors (a
  Firestore outage must not become a login outage) and never on policy.
- The OTP counter is keyed on a SHA-256 fingerprint of the ticket itself, so
  rotating IPs does not help. 5 attempts, window = the ticket's 15-minute life.
  The attempt is counted *before* the ERP is asked, so a wrong guess always costs.
- OTP input is validated (`^\d{4,6}$`) before anything is counted or sent.
- Tests: `_rate-limit` unit tests, and an end-to-end "sixth guess never reaches
  the ERP" test.

### C3 — `/api/push-send` fails closed
**File:** `api/push-send.js`.

- `if (!secret || !timingSafeEqual(...)) → 401`. No secret means no sends, ever.
- `CRON_SECRET` was **set in Vercel (Production)** during this round with a fresh
  `openssl rand -hex 32`; Vercel attaches it to cron invocations automatically. It
  must also be set in Preview if you want previews to run the cron (§9).
- Also: the `detail: err.message` leak in the 500 is gone; reads are bounded.

### C4 — credential proxy is rate limited
**File:** `api/erp-login.js`.

- 10 attempts / 15 min per IP **and** 5 / 15 min per username (case-folded), both
  through `_rate-limit.js`. Input is bounded (username ≤ 64 chars, password ≤ 128,
  both must be strings) before the ERP is contacted.
- `erp-session refresh`, `auth-token`, `admin`, `admin-analytics`, `push-subscribe`
  and `research` got limiters too. The three data endpoints did **not** — they
  require a sealed session token, and a Firestore transaction per 3-minute sync
  would cost more than it protects (`ponytail:` note in `_rate-limit.js`).

---

## 2. High findings (H1–H4)

### H1 — `/api/auth-token` no longer crashes at load
**Files:** `api/_custom-token.js` (new), `api/auth-token.js`,
`api/__tests__/custom-token.test.js`, `handlers-load.test.js` (`KNOWN_BROKEN = []`).

- `firebase-admin/auth` is gone from the handler. A Firebase custom token is an
  RS256 JWT signed with the service-account key; `_custom-token.js` builds exactly
  the claims Google documents (`iss`/`sub` = client_email, `aud` = identitytoolkit,
  `exp` = iat + 3600, `uid`). The test signs with a generated keypair and verifies
  header, claims and signature.
- **Not verifiable from here:** that Firebase Authentication is enabled on the
  project. Step 3 of `docs/BUG-auth-token-esm.md` (sign in on a real device, do a
  Firestore read) is still the proof.

### H2 — the reminder time control
**Files:** `api/push-send.js`, `api/push-subscribe.js`, `src/utils/webPush.js`,
`src/screens/main/SettingsScreen.js`, `App.js`, `src/services/backgroundTasks.js`
(deleted).

- Decision: **one reminder time for everyone (18:00 IST)**. The cron is daily
  (Vercel Hobby cannot run hourly crons), and the app never shipped a time picker
  — the "Reminder time" row in Settings had no `onPress` at all. So the per-hour
  filter in `push-send` (which silently dropped everyone not on 18:xx) is removed,
  `updateWebPushTime` and the `reminderTime` field are deleted, and the dead row is
  gone from Settings.
- **Android was also broken:** nothing ever called `scheduleDailyReminder`. The
  toggle now schedules/cancels the local notification and refuses to turn on if
  permission is denied; `App.js` re-arms it on launch. The no-op
  `expo-background-fetch` task (and its boot/foreground-service permissions) was
  deleted — it logged a line and returned.

### H3 — analytics reads are bounded; telemetry can expire
**Files:** `api/admin-analytics.js`, `src/services/telemetry.js`,
`firestore.indexes.json` (unchanged — the COLLECTION_GROUP index on
`syncs.timestamp` was already declared).

- Every `users`, `semesters` and `syncs` read has an explicit `.limit()`
  (5 000 / 10 000 / 20 000). The "index missing → read everything" fallback is
  now a bounded scan with a warning.
- Every sync log doc now carries `expiresAt` (30 days). Enable the TTL policy once:
  ```bash
  gcloud firestore fields ttls update expiresAt --collection-group=syncs --enable-ttl
  ```
  (`rateLimits` docs carry `expiresAt` too — same command with `--collection-group=rateLimits`.)

### H4 — installed APKs can follow the API
**Files:** `src/services/apiConfig.js`, `src/services/adminService.js`,
`api/admin.js` (`apiBaseUrl` config key), `eas.json`.

- `eas.json` now sets `EXPO_PUBLIC_API_BASE_URL=https://presence-blue.vercel.app`
  on all three profiles (the code default moved to the same host — it is the
  project's production alias, `presence-gurjobanpanjeta` is the auto-generated one).
- New **runtime override**: `admin/config.apiBaseUrl` (public-readable doc, server-
  write-only, https-origin-validated on both ends). `getAdminConfig()` applies it at
  startup, so if the deployment ever moves, the admin flips one field and every
  installed APK follows — no rebuild, no re-install. A custom domain is still the
  better long-term answer; this makes the current one survivable.

---

## 3. Medium findings (M1–M4)

- **M1** `admin` and `admin-analytics` are rate limited per IP (60 and 120 / 10 min).
- **M2** Every admin write appends to `admin/auditLog/entries` — actor roll, IP,
  action, payload summary, server timestamp. Reads/writes denied to clients in
  rules. `revokeUser` also stamps `revokedBy`.
- **M3** Tokens expire. Session tokens: 30 days (`isSessionStale`; the data
  handlers then re-login instead of using it; `decodeSessionRollNumber` refuses a
  stale one so admin calls fail until the next sync mints a fresh token).
  Persistent tokens: 180 days, after which the server answers
  `{ sessionExpired, needsLogin }`, the app clears its tokens and the student
  reconnects from Settings. Tokens minted before today have no `iat` and count as
  stale → one silent re-login (or one OTP, see C1) on first sync after deploy.
- **M4** Function `maxDuration` 15 → 30 s; client timeout 20 → 35 s. The client
  always outlives the server, so a slow ERP surfaces as the server's JSON error.

---

## 4. Things the audit did not list

### Admin identity no longer lives in the bundle
`src/services/adminService.js` had `ADMIN_ROLLS = ['2410990296']` plus a
`startsWith('admin')` rule. Now the **server** answers `isAdmin` on login / OTP
verify / session check (from `ADMIN_ROLL_NUMBERS`), the app stores it in
`settings.isAdmin`, and `isAdminUser(state)` gates the tab. `_firebase-admin.js`
lost its hardcoded default for the same reason — `ADMIN_ROLL_NUMBERS` is set in
Vercel; add it to `.env.local` for local admin work.

### Revocation list is no longer world-readable
`admin/revokedUsers` was `allow read: if true` — anyone could enumerate revoked
roll numbers and reasons. Now: rules deny it; `erp-session check` reports
`revoked` for the caller's own roll (the app turns that into the gate on launch);
the admin panel lists it through a new `listRevokedUsers` action. `AppNavigator`
no longer reads Firestore for revocation at all.

### Android release signing
`android/app/build.gradle` signed **release** builds with the public debug
keystore (`signingConfig signingConfigs.debug`). Anyone holds that key, so a
malicious APK could install *over* Presence as an "update" and inherit the stored
tokens. Release now uses `signingConfigs.release`, populated from
`PRESENCE_UPLOAD_*` gradle properties / env; without them a local release build
**fails** instead of shipping debug-signed. EAS Build (`credentialsSource: remote`,
now explicit in `eas.json`) injects its own signing config and is unaffected.
See §9 for the one decision this needs.

### Android manifest
`allowBackup="false"` (tokens are not to leave the device in an ADB/cloud backup —
they now live in the Keystore anyway), and `READ/WRITE_EXTERNAL_STORAGE`,
`SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE` removed with `tools:node="remove"` so a
library manifest cannot re-add them. `app.json` mirrors all of this
(`allowBackup`, `blockedPermissions`, trimmed `permissions`) for `prebuild`.

### Tokens at rest on native
`src/storage/erpTokenStorage.js` keeps the session and persistent tokens in
`expo-secure-store` (Android Keystore / iOS Keychain) instead of AsyncStorage's
plaintext SQLite. Existing installs migrate on first read. Web keeps localStorage
(no keystore exists there).

### Login codes come from a CSPRNG
`generateLoginCode` used `Math.random`; the code *is* the account credential. Now
`expo-crypto.getRandomValues`, one byte masked to 5 bits per symbol (no modulo bias).

### Security headers + CSP (Check 22)
`vercel.json` now sends on every route: HSTS, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
`Cross-Origin-Opener-Policy`, and an enforced **Content-Security-Policy**
(`script-src 'self'`; styles allow inline because React Native Web writes style
attributes; connect-src limited to self + Google/Firebase). `/api/*` is
`Cache-Control: no-store`. Verified in the browser against `vercel dev` — see §8.

### CORS (Check 21)
The static `Access-Control-Allow-Origin: *` block in `vercel.json` is gone and
`setCorsHeaders` now echoes an origin only if `ALLOWED_ORIGIN` lists it (`*` kept
for local dev). The PWA is same-origin and native sends no `Origin`, so no real
client needs CORS at all. Production's `ALLOWED_ORIGIN` is still `*` — §9.

### Dead code removed
- `api/_mobile-client.js` + its test (never wired; the live path is `_erp-provider.js`).
- `fetchTimetableLegacy` / `fetchSummaryLegacy` / cookie-less `mobilev2` fallbacks
  in the provider and handlers: none ever returned data on this ERP, and a
  timetable miss fanned out into **14 requests** — the traffic pattern that gets an
  egress IP blocked (C4's second risk).
- `parseSummaryCards` in `erp-calendar` (only reachable through a removed fallback).
- `functions/` — Firebase Cloud Functions on Node 18 / firebase-admin 11 that
  `firebase.json` never referenced.
- `src/services/backgroundTasks.js` — see H2.
- `_diag` blobs in every data response (ERP HTML previews, session-field maps,
  3 KB of table samples per call) and their multi-kilobyte log lines.

### Shared session lifecycle
`api/_data-session.js` replaces three diverging copies of "decrypt → revoked? →
fetch → dead? → liveness probe → re-login → retry → OTP ticket" in the attendance,
calendar and timetable handlers. The OTP-spam guards (only re-login after the
ERP's own probe returns exactly `false`, or the token is past its age) now live in
one place.

### Input validation at every boundary (Checks 3–5, 11)
`cleanString(value, max)` on every string the API reads; roll numbers, announcement
ids, config URLs, push subscriptions, research fields all pattern-checked. The OTP
step no longer accepts `password` from the body (it is in the ticket).

### Client copy for the new server states
`friendlyError` maps 429 to "Too many attempts"; the re-auth modal handles
`needsLogin` (clears tokens, sends the student to Settings), 429, and shows the
server's own wording on 401 ("OTP incorrect or expired" vs "get a new code").

### One version source
`src/config/version.js` reads `expo-constants`; `AppNavigator`, `firebaseHelpers`
and the user-doc writes use it. `app.json` 2.1.0 / versionCode 7,
`android/app/build.gradle` matches. The device-id change means students need this
build; set `minVersion` to `2.1.0` in the admin panel once the APK is out.

---

## 5. Dependencies

- Added `expo-crypto ~15.0.9`, `expo-secure-store ~15.0.8` (both first-party SDK 54
  modules; autolinked at build). Removed `expo-background-fetch`, `expo-task-manager`.
- `npm audit fix` applied (non-breaking). What remains is all tooling or unused
  subtrees: `undici`/`postcss`/`image-size` inside `@expo/cli` + metro (build time
  only), `uuid@7` inside `xcode` (config plugin), `uuid@9` under
  `@google-cloud/storage` (firebase-admin pulls it; Storage is never used),
  `decode-uri-component` under react-navigation's `query-string`. Forcing them
  means major bumps of Expo/RN/firebase; not worth the breakage for no runtime
  exposure. Revisit at the next SDK upgrade.

---

## 6. Tests

New: `api/__tests__/security-hardening.test.js` (limiter, C1, C2, login→OTP end to
end, M3, C3, CORS, `_data-session`), `api/__tests__/custom-token.test.js`,
`api/__tests__/admin-handler.test.js`. Updated: `admin-auth`, `silent-refresh`,
`research-upload`, `adminAnalytics` (mock gained `.limit()`), `handlers-load`
(`KNOWN_BROKEN` emptied), `apiConfig` (runtime override). `jest.setup.js` mocks
`expo-secure-store` and `expo-crypto`.

```bash
cd presence && npx jest      # 34 suites, 263 tests
```

---

## 7. Vercel / Firebase configuration done in this round

| Where | What | Status |
|---|---|---|
| Vercel env | `CRON_SECRET` (Production) | **set** |
| Vercel env | `CRON_SECRET` (Preview) | not set — CLI wanted an interactive branch prompt; optional |
| `.claude/launch.json` | `presence-vercel-dev` (mock login on) and `presence-csp-check` configs | added |
| `scripts/csp-check-server.js` | local CSP verification server | added |

Nothing was deployed. `firestore.rules` and `vercel.json` changes take effect on
the next `firebase deploy --only firestore` and `vercel --prod`.

---

## 8. What was verified, and how

- `npx jest` — 34 suites / 263 tests green after every step.
- `npx expo export -p web` — bundle builds with the new modules.
- In the browser, against the real built bundle: `vercel dev` (API + PWA, mock
  login on) plus `scripts/csp-check-server.js`, which serves `dist/` with the exact
  `vercel.json` headers (`vercel dev` does not apply `headers` locally) and proxies
  `/api/*`. Welcome → Sign in (mock) → theme → import → Today all rendered with
  **zero CSP violations** in the console. The only errors were `/api/auth-token`
  500s — expected locally, there is no `FIREBASE_SERVICE_ACCOUNT` in the dev env —
  and the Vercel Analytics script 404 (served by Vercel only in production).
- Also probed locally: `OPTIONS /api/erp-login` → 204 with `Vary: Origin` and no
  `Access-Control-Allow-Origin` for a non-browser caller; `POST /api/erp-login {}`
  → 400; `GET /api/push-send` → **401**.
- Live production probes before the round (for the record): `/api/auth-token`
  500, `/api/push-send` unauthenticated → reached the handler (500 from inside),
  only HSTS present, CORS `*`, `/releases/presence-latest.apk` **404**.

---

## 9. Needs a human decision or a device

1. **Deploy order.** `vercel --prod` first (API + PWA together), then
   `firebase deploy --only firestore` (rules + indexes). The new rules deny
   `admin/revokedUsers` reads; the *old* PWA swallows that error in `checkGates`,
   so either order is safe, but API-first is cleaner.
2. **Everyone gets one OTP** on first sync after deploy (C1). Tell the ~50 students
   before the drive, not after.
3. **Android signing.** Find out how the shipped APK was built. If by EAS with
   remote credentials, nothing changes. If locally, it is debug-signed: generate an
   upload keystore, put its four `PRESENCE_UPLOAD_*` values in
   `~/.gradle/gradle.properties`, and accept that existing installs must uninstall
   once (signature change). `.gitignore` now excludes `*.keystore`/`credentials.json`.
4. **New APK build** (2.1.0 / versionCode 7) — device id, SecureStore, permissions,
   and the removed background task all need a native build. Then set `minVersion`
   to `2.1.0` in the admin panel. The landing page's APK link is 404 today; the
   build has to land in `public/releases/presence-latest.apk` before `build.sh` runs.
5. **`ALLOWED_ORIGIN` in Vercel is `*`.** Change it to empty (same-origin only) or
   to `https://presence-blue.vercel.app`; nothing legitimate is cross-origin.
6. **Firebase Authentication enabled?** `auth-token` now mints correctly, but sign-in
   still needs the provider on. One real device sign-in + Firestore read proves it.
7. **TTL policies** — the two `gcloud` commands in §H3.
8. **Firebase App Check + API-key restrictions** (audit's "what does help" list) —
   console work, not code.
9. **The live login bug** (audit's last section) still needs one retry by the
   affected student; the `[LOGIN-REJECTED]` log line is unchanged.
