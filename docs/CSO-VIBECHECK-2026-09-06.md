# CSO Vibecheck — Presence

**Stack detected:** Expo SDK 54 / React Native 0.81 (Android APK + PWA via react-native-web) · Vercel serverless functions (Node 24, CommonJS) · Firebase Firestore + custom-token Auth · web-push · upstream university ERP (Chalkpad) proxied server-side
**Audit date:** 2026-09-06 (run twice: before and after the hardening round in `docs/HARDENING-2026-09-06.md`)
**Verdict before:** BLOCK SHIP · **Verdict after:** SHIP WITH FIXES (zero P0; P1s are deploy/console steps, not code)

## Summary (after)
- P0 findings: 0 (was 5)
- P1 findings: 3 (deploy-time, listed below)
- P2 findings: 2
- N/A: 9 / 22

The triage script (`scripts/triage.sh`) flagged three things, all false positives once read in context: the Firebase `AIzaSy…` key in the built `dist/` bundle (a public project identifier; access is decided by `firestore.rules`), `eval` inside Expo's own split-bundle loader in `dist/` (not reachable — the app is one bundle), and "cookies without sameSite" (the API sets no cookies; tokens travel in JSON bodies).

---

## P0 — fixed this round

### [P0-1] OTP second factor defeated by a computable device id (Layer Auth — Check 11/14)
**Evidence (before):** `api/_session-utils.js:50` `crypto.createHash('md5').update(\`presence-device-${username}\`)`
**What's wrong:** the ERP's trusted-device exemption was keyed on an unsalted MD5 of a public, sequential roll number. Anyone with a student's password logged in with no OTP from anywhere.
**Exploit:** attacker computes `md5("presence-device-2410990296")` → posts it with a phished password → full session, no OTP.
**Fix:** random per-install UUID (`expo-crypto` on the client, `crypto.randomUUID()` server-side), sealed into the persistent token and OTP ticket. `security-hardening.test.js › C1` pins it.

### [P0-2] 4-digit OTP brute-forceable (Layer API Gateway — Check 1)
**Evidence (before):** `api/erp-verify-otp.js` — no counter, no lockout.
**Exploit:** ~5 000 requests against a 15-minute ticket.
**Fix:** `api/_rate-limit.js` (Firestore-backed, transactional) keyed on the ticket fingerprint, 5 attempts. Sixth guess never reaches the ERP (tested).

### [P0-3] Unauthenticated `/api/push-send` (Layer Auth — Check 19)
**Evidence (before):** `api/push-send.js:53` `if (secret && …)` with `CRON_SECRET` unset in every environment.
**Exploit:** `curl https://presence-blue.vercel.app/api/push-send` → push to every subscriber + unbounded collection-group read.
**Fix:** `if (!secret || !timingSafeEqual(…)) return 401`; `CRON_SECRET` set in Vercel Production.

### [P0-4] Credential proxy with no rate limit (Check 1)
**Evidence (before):** `api/erp-login.js` — replayed any username/password to the university, unlimited.
**Fix:** 10/15 min per IP + 5/15 min per username; bounded, typed input.

### [P0-5] Release APK signed with the public debug key (Layer Infra — Check 16)
**Evidence (before):** `android/app/build.gradle:115` `release { signingConfig signingConfigs.debug }`; the checked-in `debug.keystore` is the stock Android debug key (SHA-1 `5E:8F:16:06:…`).
**Exploit:** a malicious APK signed with the same key installs *over* Presence as an update and inherits its stored tokens.
**Fix:** `signingConfigs.release` from `PRESENCE_UPLOAD_*` properties; local release builds fail without a key; EAS injects its own. **Still needs the owner to confirm how the shipped APK was built** (HARDENING §9.3).

## P1 — fix before / at deploy

### [P1-1] `ALLOWED_ORIGIN=*` in Vercel (Check 21/22)
Code now only echoes listed origins, but the env value is still `*`. Set it empty (nothing legitimate is cross-origin: the PWA is same-origin, native sends no Origin).

### [P1-2] Firebase App Check + API-key restrictions (Check 6/13)
The Firebase web config is public by design; App Check and package-name/certificate restrictions on the key are the real answer to "someone extracted our config". Console work.

### [P1-3] Firestore TTL policies (Check 9 / cost)
`telemetry/*/syncs` and `rateLimits` now carry `expiresAt`; the TTL must be enabled once with `gcloud firestore fields ttls update …` (HARDENING §H3).

## P2 — defense in depth

### [P2-1] Data endpoints have no per-request limiter
`erp-attendance/calendar/timetable` require a sealed session token and sync every 3 min; a Firestore transaction per call was judged more expensive than the risk. Marked `ponytail:` in `_rate-limit.js`.

### [P2-2] Remaining `npm audit` items
All in Expo tooling / unused subtrees (see HARDENING §5). No runtime exposure; revisit at the next SDK bump.

## Checks — status after the round

| # | Check | Status | Where |
|---|---|---|---|
| 1 | Rate limit + auth on paid/expensive routes | **Fixed** | `_rate-limit.js` on login, OTP, refresh, auth-token, admin×2, push-subscribe, research |
| 2 | Webhook signatures | N/A | no webhooks |
| 3 | User input never in system prompt | N/A | no LLM |
| 4 | Parameterized DB queries | Pass | Firestore SDK only; all doc paths pattern-validated |
| 5 | HTML sanitization on render | Pass | RN renders text nodes; no `innerHTML`/`dangerouslySetInnerHTML` in `src/` or `api/` |
| 6 | Keys never in client bundle | Pass | only Firebase public config + VAPID public key (verified against the built bundle) |
| 7 | LLM `max_tokens`/timeout/canary | N/A | no LLM |
| 8 | Generic prod errors | **Fixed** | `_diag` blobs, `err.message` leaks and `e.message` CORS 500s removed; admin-analytics keeps its reason (admin-only) |
| 9 | Tenant filter at DB level | Pass | `users/{uid}` rules; server reads by sealed roll |
| 10 | Action guard on mutations | **Fixed** | admin actions validated, audited, rate limited |
| 11 | Identity from session, not request | Pass (was mixed) | roll from sealed token; OTP `password`/`username` no longer from body |
| 12 | Ownership on `/[id]` routes | Pass | `push-subscribe` verifies ID token uid; research rows are anonymous by design |
| 13 | RLS / Firestore rules | **Fixed** | revokedUsers, auditLog, analyticsCache, push denied to clients; explicit deny-by-intent |
| 14 | Abuse: atomic counters, captcha, normalization | Partial | transactional counters; username case-folded; no captcha (ERP has its own, and rate limits cover) |
| 15 | Structured logging, redaction | Pass | `[LOGIN-REJECTED]` logs shape only; multi-KB diag logs removed |
| 16 | `.env` not in git / history | Pass | only `.env.example` ever committed; `*.keystore`/`credentials.json` now ignored |
| 17 | Hallucinated / typosquatted deps | Pass | all deps are Expo/Firebase/RN mainstream; two added are first-party Expo modules |
| 18 | No eval/deserialization on input | Pass | none in `src/`/`api/` |
| 19 | Middleware coverage matches routes | **Fixed** | every handler: CORS → method → auth → limiter (see route table below) |
| 20 | Server-side gating, not client redirect | Pass | admin tab is cosmetic; every admin call 403s server-side |
| 21 | CSRF | Pass | no cookies; JSON bodies; CORS now allow-listed |
| 22 | Security headers, cookies, TLS | **Fixed** | HSTS, CSP, XFO, nosniff, Referrer-Policy, Permissions-Policy, COOP in `vercel.json` |

### Route coverage

| Route | Auth | Limiter | Input validation |
|---|---|---|---|
| `admin` | sealed admin roll (30-day session) | IP 60/10m | yes + audit log |
| `admin-analytics` | sealed admin roll | IP 120/10m | metric whitelist |
| `auth-token` | code format | IP 12/10m | regex |
| `erp-attendance` | sealed session + revocation | — (P2-1) | bounded token |
| `erp-calendar` | sealed session + revocation | — | bounded token, researchId regex |
| `erp-login` | — (by design) | IP 10/15m + user 5/15m | ≤64/≤128 strings |
| `erp-session` | sealed persistent token + ticket | IP 10/15m | OTP regex |
| `erp-timetable` | sealed session + revocation | — | bounded token, researchId regex |
| `erp-verify-otp` | sealed ticket | ticket 5/15m | OTP regex |
| `push-send` | `CRON_SECRET` (fail-closed) | cron only | — |
| `push-subscribe` | Firebase ID token = userId | user 20/10m | subscription shape |
| `research` | participant UUID (anonymous by design) | IP 60/10m | reason/date/subject |

## Recommended next actions
1. Deploy (`vercel --prod`, then `firebase deploy --only firestore`), warn students about the one-time OTP.
2. Set `ALLOWED_ORIGIN` empty in Vercel; enable the two TTL policies.
3. Settle Android signing (HARDENING §9.3) and cut the 2.1.0 APK; set `minVersion` 2.1.0.
4. Firebase App Check + key restrictions in the console.

## Tools to add to CI
- `gitleaks detect` on every push (nothing found today; keeps it that way).
- `npm audit --omit=dev --audit-level=high` as a non-blocking report.
- `npx jest` — `handlers-load.test.js` already fails the build if any handler imports `firebase-admin/auth` again.
