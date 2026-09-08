# Onboarding: fewer round trips, no consent screen (2026-09-07)

Roll-out prep. Three things: make sign-up fast, drop the research consent UI,
and go over the APK login path until nothing in it is guesswork.

## 1. The register was being fetched twice, every time

`/api/erp-attendance` and `/api/erp-calendar` posted to the **same URL** with the
**same body** — `chalkpadpro/studentDetails/getAttendanceRegister` — and each one
paid its own `showAttendance` warm-up first. Attendance already called
`parseRegisterHTML` on the result; it just threw away the `calendar` and `marks`
and kept `subjects`.

So every sync was: warm-up → register → warm-up → register, for one page.

`/api/erp-attendance` now parses once and answers with `calendar`,
`registerSubjects` and `latestDate` alongside `subjects`. The client asks
`/api/erp-calendar` only when `calendar` is absent, which happens only on the
summary-card fallback (`commonPage/28`, used when the register is unavailable).

| | ERP round trips per sync | requests from the phone |
|---|---|---|
| before | 4 (2 warm-ups, 2 registers) | 2 |
| after | 2 (1 warm-up, 1 register) | 1 |

`/api/erp-calendar` is unchanged and still the fallback. Its `saveResearch` call
moved to `erp-attendance` with the parse — **that is the thing to re-check if the
dataset ever goes quiet**, and `api/__tests__/attendance-carries-calendar.test.js`
pins it.

## 2. The timetable now loads behind the theme picker

It comes from a different page (`commonPage/99`) and needs nothing from the
register, so it no longer waits its turn.

- `ERPSetupScreen.finishWithSession` fires it the moment the session lands.
- `useErpAutoSync` starts it before step 1 and collects it at step 3.

Measured on the local flow (vercel dev, cold functions), `erp-timetable` and
`erp-attendance` now start within 1 ms of each other and finish together.

Onboarding after the OTP is entered:

| | requests, in order |
|---|---|
| before | attendance → *[theme step]* → calendar → timetable |
| after | attendance ∥ timetable → *[theme step]* → nothing |

Tapping **Enter Presence** now makes **zero** ERP calls — verified live. What is
left in the import screen is local state, so the artificial settle between rows
dropped from 950 ms to 320 ms.

## 3. Welcome screen deleted

It was a logo, a tagline and a **Get started** button: one full screen and one tap
before anything could begin loading. Sign-in is the entry screen now and carries
the brand and the *"Already have a login code?"* link. `src/screens/setup/`
`WelcomeScreen.js` is gone; both navigators start on `ERPSetup`.

The back arrow is now rendered only where it does something — it used to call
`navigation.goBack()` from the theme step, which after this change is a no-op, and
a dead arrow reads as a frozen app.

## 4. No consent screen

The prompt and the Settings **RESEARCH** row are gone. `getResearchId()` mints the
participant UUID on first use instead.

The reasoning, so it is on the record: the dataset holds the attendance register
the college already publishes to the class group, filed under a random UUID with
no name, roll number or login. A modal asking permission for that read as though
the app were taking something personal, on the very first screen after setup.

Two consequences, both deliberate:

- **A student who previously tapped "No thanks" now participates.** The declined
  flag is no longer read. Reinstating it is a two-line change in
  `src/storage/researchStorage.js` if that is not wanted.
- **There is no in-app withdrawal.** `researchWithdraw` is gone from the client;
  `POST /api/research { action: 'withdraw' }` still works server-side.

The "why did you miss this class?" sheet stays — it is the actual research signal
and reads as a feature, not as collection.

### Upload throttle

The research write is awaited before the response (it has to be — a serverless
instance can be frozen the moment it answers; see `api/_research.js`). With the
write now living on `erp-attendance`, an un-throttled upload would put ~1000
Firestore writes on the critical path of a sync that runs **every three minutes**.

`shouldUploadResearch(endpoint)` caps it at once per six hours, **per endpoint**.
Per-endpoint matters: the register writes `marks` and the timetable writes
`slots`, so a single shared clock would let whichever request went first eat the
window and leave the other half of the row permanently unwritten. Every upload is
a full replacement, so a skipped or failed one costs freshness and nothing else.

Back-of-envelope for a class of 50: ~8000 writes/day before, ~400 after.

## 5. APK login path

Four things were wrong or would have gone wrong at roll-out.

**The OTP screen named the wrong inbox.** It said *"Sent to your registered
number"* and *"Check your SMS"*. This ERP mails the code — the captured login
carries `mobileString: "email address gur****@chitkara.edu.in"`. The hint was
parsed by `loginLegacy` and then dropped by `reloginERP`. It is now carried
through `/api/erp-login` and `/api/erp-session` and rendered verbatim:
*"Sent to your email address gur****@chitkara.edu.in."* Students were being sent
to look in a place the code never arrives.

**Per-IP rate limits would have locked out a lecture hall.** `erp-login` allowed
10 attempts per IP per 15 minutes. A class on campus WiFi — or anyone behind
carrier NAT — is *one* egress address, so the eleventh student to install the app
that morning would have been refused. The per-**username** caps are what actually
stop a password grind and they are untouched (5/15min login, 3/15min OTP
request); the per-IP caps only need to stop a spray across accounts, and are now
100 (login) and 60 (OTP request, refresh).

**The mock login could not reach the OTP screen.** `ALLOW_MOCK_LOGIN=1` always
returned a trusted session, so the screen every first-time student sees was
untestable locally. A mock username containing `otp` (e.g. `mockotp1`) now takes
the status-4 branch.

**Mock attendance carried no calendar**, so local testing exercised the
summary-card fallback rather than the register path production takes. It now
returns the same shape.

## Verified live

Driven end to end against `vercel dev` at 375×812, both paths:

- `mockstudent` → trusted login → theme → app
- `mockotp1` → OTP screen → verify → theme → app

In both: `erp-timetable` and `erp-attendance` in parallel, **zero** ERP calls
during import, `erp-calendar` never called, and the steady-state sync down to a
single `erp-attendance` request carrying `researchId` + `consentedAt`.

`auth-token` returns 500 locally — no `FIREBASE_SERVICE_ACCOUNT` in `.env.local`.
Environment, not code.

Tests: 36 suites, 278 passing. New: `api/__tests__/attendance-carries-calendar.test.js`,
`src/services/__tests__/researchTagging.test.js`.

## Still open

- **The APK has not been rebuilt.** These are JS changes; a new EAS build is
  needed before students see any of it, and `app.json` `versionCode` (7) should be
  bumped for that release.
- The setup progress dots still show three steps when a trusted device skips the
  OTP one. Cosmetic, and never hit on a fresh install.
