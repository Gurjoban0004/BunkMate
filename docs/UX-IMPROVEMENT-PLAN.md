# Presence — UX improvement plan (PWA first)

What separates a shipped product from a prototype is rarely one big feature;
it is fifty small decisions made consistently. This list comes from looking
at the app as it is after round 2, at the apps students in India actually
use for this ("Bunk it", "BunkMate", "Bunku", "College Attendance Tracker",
"RollCall"), and at current PWA guidance. Items are ordered by impact per
hour of work. "Done" marks what round 2 already shipped.

Sources consulted: [MDN PWA best practices](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices),
[PWA on iOS — limitations and workarounds](https://brainhub.eu/library/pwa-on-ios),
[PWA iOS limitations and Safari support 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide),
[PWA mobile testing checklist 2026](https://mobileviewer.github.io/pwa-mobile-testing-checklist-2026),
[Empty state UX — rules that work](https://www.eleken.co/blog-posts/empty-state-ux),
[Empty state best practices (UX Design World)](https://uxdworld.com/best-practices-for-designing-empty-state-in-applications/),
[Bunk it](https://www.bunkitapp.in/), [BunkMate](https://play.google.com/store/apps/details?id=college.bunkmate&hl=en_IN),
[Bunku](https://play.google.com/store/apps/details?id=com.jdevsappstudio.bunku&hl=en_IN),
[College Attendance Tracker](https://play.google.com/store/apps/details?id=com.sirmaur.attendance_tracker),
[RollCall](https://pixelvoltapps.in/apps/rollcall-attendance-tracker),
[Best attendance apps 2026 (ClassTrack)](https://classtracks.app/blog/best-attendance-app/),
[Reducing RN bundle size](https://medium.com/@solomongetachew112/10-tricks-to-reduce-bundle-size-in-react-native-apps-e572c0f1a87d),
[Firebase modular SDK](https://dev.to/chroline/why-the-new-firebase-web-v9-modular-sdk-is-a-game-changer-nph).

## Where Presence already wins

Every competitor above is a manual tracker: the student taps present/absent
after every class and the app does arithmetic. Presence reads the college.
That is the whole pitch and the thing to protect — which is why round 2
removed every way of moving the number by hand. The plan below is about
making the app *feel* as certain as its data.

---

## A. The first minute (PWA)

1. **Install banner that matches the platform.** Safari has no
   `beforeinstallprompt`; iOS installs are always manual. Show a small
   in-app card after the first successful sync: iOS → "Add to Home Screen:
   Share → Add to Home Screen" with the two icons; Android/Chrome → capture
   `beforeinstallprompt` and show one "Install" button. Dismissible, never
   shown again once `display-mode: standalone`.
2. **Offline page.** The service worker caches the shell but a cold open with
   no network shows the browser's error. Cache `/app` on install (done in
   `sw.js`) and add a tiny offline fallback for navigation requests
   ("You're offline — your last numbers are on the Today tab when you
   reconnect").
3. **Splash on the PWA.** The white flash before `BrandLoader` is the shell
   loading 2.3 MB of JS. Inline a 40-line critical CSS splash into
   `app.html` at build time (same paper colour, the P mark centred) so the
   first paint is the brand, not blank. *(Round 2 made the JS start faster;
   this makes the wait look intentional.)*
4. **`theme-color` that follows the palette.** The manifest is fixed to
   `#F9F8F4`; a student on Nordic Slate dark gets a cream status bar. Set
   `<meta name="theme-color">` from `applyTheme()` on web.
5. **Onboarding time honesty.** "Takes about a minute" is true only if the
   OTP arrives quickly. Add "You'll need your phone for a one-time code" on
   the Welcome screen so nobody starts it on a laptop without their phone.

## B. Today, every day

6. **Done.** Rest day view (stand, tomorrow, week, cheapest day, needs-you).
7. **Done.** One verdict sentence per class, past tense once the college has
   recorded it.
8. **"Updated through" everywhere a number appears** (Subjects header,
   subject detail, rest day) — done in three places; add it to the Insights
   header and the notification body ("as of Sep 4").
9. **Class card tap → subject detail.** Cards are inert today; students
   expect to tap them.
10. **Pull-to-refresh feedback.** The spinner ends after 800 ms regardless of
    the sync. Tie it to `isErpSyncing` and show a one-line result ("Synced ·
    no change" / "Synced · 2 subjects updated") for 3 s.
11. **Time-of-day states.** Before 8 am show the day ahead; after the last
    class show "That's it for today" and tomorrow. (The user declined this
    once; revisit after the rest-day view lands — the two are the same idea.)

## C. Certainty and trust

12. **A "numbers" screen.** One place that says, in plain words, where the
    number comes from: "From your college's attendance register, last read
    Sep 6 at 09:14. Hours are counted the way your college counts them: a
    2-hour class is 2 hours, all or nothing." Link from the overall card.
13. **Show the college's own figure next to ours** on subject detail
    ("Your college shows 41/50") — they are the same number now; saying so
    out loud is what earns the trust the old app lost.
14. **Sign-in card copy test.** The ReconnectCard says "Your college signed
    this app out." Keep it; add the date of the last successful sync so the
    student knows how stale the numbers are.

## D. Consistency (the "one company built this" feeling)

15. **One card, one radius, one shadow.** Three card styles still coexist
    (`RADIUS.md` bordered, `RADIUS.lg` shadowed, `RADIUS.xl` hero). Pick
    `md` + 1 px border for lists and `lg` + small shadow for feature cards;
    remove the rest. Audit: `grep -rn "borderRadius: BORDER_RADIUS" src | sort | uniq -c`.
16. **Typography tokens only.** ~120 `fontSize:`/`fontWeight:` literals
    remain outside `TYPOGRAPHY`. Replace screen by screen (Settings and
    Insights are the worst). Keep `TABULAR` on every number.
17. **Section labels.** Today uses uppercase micro labels, Subjects uses a
    coloured rule + label, Insights uses `sectionTitle`. Choose one (the
    rule + label reads best) and use it everywhere.
18. **Buttons.** `Button` component exists but most screens hand-roll
    `TouchableOpacity` + styles. Route all primary/secondary actions through
    `Button` so press states, disabled states and heights match.
19. **Icons.** Text glyphs (`›`, `✕`, `▼`, `▲`, `•••`) mix with SVG icons.
    Add chevron/close/caret to `TabIcon`'s SVG set and use them.
20. **Motion.** `usePressScale` exists; apply it to every tappable card.
    Screen transitions on web are a 180 ms fade — fine; make native match
    (it currently slides).
21. **Accessibility.** ~160 pressables still lack `accessibilityLabel`;
    every new component in round 2 has them. Finish the sweep; add
    `accessibilityRole="header"` to screen titles.
22. **Dark mode contrast.** Midnight/Nordic dark: `textMuted` on
    `inputBackground` sits near 3:1. Lift `textMuted` a step in the dark
    palettes.

## E. Insights that earn the tab

23. **Lead with the decision, not the chart.** Insights opens on the weekly
    report card; students open it to ask "what should I do this week?". Put
    the semester outlook + the two subjects that need attention first, the
    weekday bars second, trends last.
24. **Subject trends need 60 days;** until then show "Trends unlock after
    two months of classes" rather than nothing.
25. **Remove the fixed 8/12/16/20-week picker** once a semester end date is
    set; when it is not, default to the estimate and show one "Set end date"
    link instead of four buttons.

## F. Settings and account

26. **Login code visibility.** The code is the account. Show it in Settings
    with a copy button and "Save this somewhere" the first time; the
    logout dialog is the only place it appears today.
27. **Semester end date** should ask the moment insights need it (once),
    not sit in Settings hoping to be found.
28. **Danger zone grouping.** "Log out", "Use a different code" and "Delete"
    are three rows in one card; separate delete into its own red card.

## G. Performance and reliability

29. **Bundle.** 2.37 MB main chunk. Next cuts, in order: (a) lazy-load
    `SubjectPlannerScreen` + `PlannerCalendar` (only opened from a subject),
    (b) lazy-load `InsightsScreen` (SVG + endgame maths), (c) audit
    `firebase/auth` — the app only uses `signInWithCustomToken`; a lighter
    REST call to `identitytoolkit` would drop ~200 KB. Measure with
    `npx expo export -p web` + `source-map-explorer`.
30. **Service worker update prompt.** With `skipWaiting` + `clients.claim`
    a student may get the new bundle mid-session on the next navigation.
    Show "Presence was updated — reload" when a new worker takes over.
31. **Lighthouse on every release** (installability + PWA optimised checks)
    — add it to `build.sh` as a warning step against `dist/`.

## H. Landing page

32. Real screenshots instead of the CSS phone mock (the mock still shows
    "Skip 3" chips the app no longer has).
33. A 1200×630 share image (`og-image.png` is the square icon for now).
34. The Android button now checks the APK exists; once it does, add the file
    size and version next to it.

---

### Suggested order

Week 1: A1, A3, B9, B10, D15–D16 (Settings + Insights), F26.
Week 2: C12–C13, D17–D19, E23–E25, G30.
Week 3: A2, A4, D20–D22, G29, H32–H33.
