# Presence — Session Handoff

> **2026-09-06 — read `docs/HARDENING-2026-09-06.md` first.** That round rewrote the
> API trust boundary (device id, OTP cap, rate limits, token expiry, CORS/CSP,
> auth-token signing) and the client's token storage. Sections below that describe
> the OTP/session flow are superseded where they disagree.

Last updated: 2026-08-17 · branch `main` · last commit `5a5ac1e`

Goal driving this work: make Presence feel like a premium product rather than a
vibe-coded PWA. Declutter, personalise, and keep a strong typographic identity.

---

## 1. State of the tree

**Committed** (in `5a5ac1e`): the API/serverless fixes. See §2.

**Uncommitted**: all the design work — ~63 modified files plus one new file
(`src/components/today/BannerSlot.js`). Nothing is half-finished; the tree is
green (23 suites / 137 tests) and the app runs. It just hasn't been committed.

```bash
cd presence && npx jest
```

---

## 2. Shipped: the OTP crash (committed, NOT yet deployed)

The login screen died at step 2 with `FUNCTION_INVOCATION_FAILED`.

**Root cause:** `firebase-admin` was bumped to v14, which removed the namespaced
API (`admin.apps`, `admin.credential.cert`, `admin.firestore()`) from the default
export. `api/_firebase-admin.js` still used it and threw at *module load* — before
any handler code runs, which is why Vercel returned a bare crash with no JSON body.
`/api/erp-login` doesn't import it, so step 1 passed and step 2 died.

Every downstream endpoint was dead too: verify-otp, attendance, calendar,
timetable, admin, admin-analytics, auth-token, push-send, push-subscribe.

Fixed in three places:
- `api/_firebase-admin.js` → modular `firebase-admin/app` + `/firestore` imports.
- `api/auth-token.js` → `getAuth()` instead of `admin.auth()`.
- `api/_revocation.js` → the eager `require('./_firebase-admin')` for `isAdminRoll`
  bypassed the file's own lazy guard, turning an SDK failure into a hard crash
  instead of a skipped revocation check. Now lazy like `getDb()`.

Regression guard: `api/__tests__/handlers-load.test.js` requires every `api/*.js`
handler and asserts it exports a function.

> **NEXT ACTION: deploy.** The fix is committed but production still runs the
> broken build. Then do one real OTP login to confirm end-to-end — that also
> clears the last open item in the `erp-mobile-auth-decoded` memory.

---

## 3. Shipped: typography (uncommitted)

The user likes **Times New Roman** — it "gave the app personality." Newsreader was
tried as a substitute and rejected.

Now on **Tinos**, Google's metrically-identical libre clone of Times. Ships as a
real font file, so iPhone / Android / PWA render identically and there's a true
bold instead of a synthesized one. (Times New Roman itself is Monotype-owned and
cannot be bundled.)

Token split in `src/theme/theme.js`:
- **Tinos-Bold** — `display*` (hero numbers, greeting) and `headingLarge` (screen
  titles, empty-state headlines).
- **Inter** — `headingMedium`/`headingSmall` (card titles), body, labels, buttons,
  captions, badges.

Display sizes are ~15% larger with tracking at 0 or slightly negative: Times has a
small x-height and narrow letterforms, so tight tracking closes the counters.

**Do not** revert to `Platform.select({ ios: 'Times New Roman', android: 'serif' })`
— that renders two different fonts. Do not swap in a different serif; the Times
letterform is the point.

### Bug fixed along the way
`useFonts({...})` in `App.js` took a fresh object literal every render → re-entered
loading → setState → re-render, forever. Every `.ttf` was refetched every ~37ms for
the life of the session. Now a module-level `APP_FONTS` constant. **Keep it
hoisted.**

---

## 4. Shipped: Today screen declutter (uncommitted)

Driven by a UX audit the user largely agreed with. Their explicit constraints:

> - **Top bar stays as-is.** Don't restructure the header.
> - **Schedule bar stays as-is.** `TodayScheduleBar` is off-limits.
> - **Settings stays at the bottom of the scroll.** Do not move it to a top-right
>   avatar — they don't want the top crowded.

Three pieces landed:

**Banner tower → one at a time.** New `src/components/today/BannerSlot.js` (~50
lines). `BannerHost` provides a context; each banner calls
`useBannerSlot(priority, wantsToRender)` and only the lowest priority number
renders. Order: deletion warning (0) → announcement (1) → backlog (2) → ERP
welcome (3). Needed a coordinator rather than a condition in `TodayScreen` because
two of the banners decide asynchronously whether they have anything to say.
Outside a `BannerHost` every banner renders normally, so they stay reusable.

Also fixed in `AnnouncementBanner`: it rendered *every* active announcement stacked
(now one, with an "N more" line), had no horizontal margin so it went edge-to-edge,
and used a `borderLeftWidth: 4` side-stripe.

**Week in Review → Insights.** It was a full-height retrospective sitting above the
day's classes, its dismiss was `useState(true)` so it came back on every tab
switch, and its Fri–Mon-only condition gave Today two different layouts depending
on the day. Now rendered in `InsightsScreen` with no dismiss.

**`···` overflow menu** in `SectionHeader`, replacing the two cramped inline
buttons. Holds Mark holiday / Cancel a class / **Add an extra class** — that last
one used to be an orphaned button at the very bottom of the scroll. 44×44 target,
bottom sheet with a grabber.

**ClassCard subtractive pass.** Six colour signals down to two:
- `SAFE` tag removed (a green tag beside a green number says it twice). `LOW` and
  `EDGE` stay — a bare "72%" doesn't tell you which side of your threshold it's on.
- Danger warning: bordered tinted box → a line of text (it was a card in a card).
- Delta badge → plain coloured text.
- Marked cards keep the plain surface with a small status dot + "Attended/Bunked ·
  Undo" instead of a full green/red tint. A day of resolved classes was reading as
  alternating stripes.
- Attend is solid `primary`; Bunk is a quiet outline. A routine tap and a costly
  one shouldn't have identical weight.

### Contrast bug this exposed
Making Attend a solid `primary` fill revealed `textOnPrimary` was white on a
mid-tone accent: **2.83:1 in Chalkpad (both modes), 3.18:1 in Catppuccin light.**
Pre-existing, harmless until it landed on a full-width button. Fixed to dark ink on
those three variants. All 10 palette variants now pass; full sweep is 180/180
text-on-surface pairs.

There's a throwaway contrast-sweep script in the session history — worth
re-running (or committing as a test) if palettes change.

---

## 5. Open — the user has NOT asked for these yet

Declined for now, don't build without asking:
- **Temporal time-of-day states** (morning briefing → live class card with
  countdown → evening recap). The audit's most ambitious item; user said land the
  basics first.
- **Extra haptics / spring feedback.** Note `src/utils/haptics.js` **is** already
  wired (`ClassCard` on mark, `InsightsScreen`) — an earlier claim in session that
  it had zero call sites was wrong.

Still open from the design critique (scored 19/40; snapshot in
`presence/.impeccable/critique/`):
- **Navigation IA** — 12 screens behind 3 tabs.
- **Error surfaces leak infrastructure codes to students.** The OTP screen showed
  `FUNCTION_INVOCATION_FAILED` and a Vercel request ID verbatim. Worth a generic
  user-facing message with the detail behind a "copy diagnostics" affordance.
- **~160 pressables with no accessibility label.** A few were added this session in
  `ClassCard`, `SectionHeader`, `AnnouncementBanner`.

---

## 6. Gotchas

**`npm uninstall` destroyed `package.json`** — rewrote it to a 5-line stub, wiping
every dependency and script. Recovered via `git checkout -- package.json`. Prefer
editing `package.json` by hand + `npm install`.

**`expo lint` silently adds devDeps.** It wrote `eslint` and `eslint-config-expo`
into `package.json` and created `eslint.config.js`. Both reverted — eslint is not
installed and lint is not part of this project. Don't reintroduce without asking.

**Running the app locally:**
```bash
cd presence && npx expo start --web --port 8081 --clear
```
`.claude/launch.json` has this as `presence-web`. To see real data, flip
`DEV_MODE`/`SKIP_SETUP` to `true` in `src/dev/config.js` — **and remember to flip
them back.** Mock state persists in `localStorage`, so `localStorage.clear()` and
reload after changing mock data or it won't take.

For the full API path use `vercel dev` instead (see the `run-local-chrome` memory).

**Browser-tool clicks don't reach React Native Web pressables** — tab switches and
buttons time out. Verify by reading the DOM / screenshotting, or drive state
directly; don't burn time trying to click through.

**Mock data has no weekend classes.** To see class cards you need a weekday, or
temporarily add a `Sunday:` entry to `mockTimetable` in
`src/dev/mockData/mockScenarios.js` (note there's a duplicate empty `Sunday: []`
later in the object that will override an earlier one).
