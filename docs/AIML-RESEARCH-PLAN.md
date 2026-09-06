# Research data collection (for the AI/ML project)

**The AI/ML project itself lives in `~/Desktop/Projects/attendance-insights/` — see its `PLAN.md`.**
Nothing in that project touches this repo. Presence's only role is to collect the dataset and
write it to Firestore, then it is frozen.

Scope of work in *this* repo, in order:

## A0 — Unblock
- [ ] **Run one real OTP login end to end.** `HANDOFF-erp-mobile.md` says the mobile auth flow is
      fixed but was never confirmed live. Gates everything downstream.
- [ ] `api/erp-calendar.js` — emit a flat `marks: [{date, code, erpSubjectId, period, status}]`
      **alongside** the existing `calendar`. `erp-calendar.js:171` collapses to the first period
      per subject/day and the app's attendance math depends on that. Additive only.
- [ ] `api/erp-timetable.js` — keep `faculty` and `room`. Cells read `24CSE0222 Room-210
      DR.YOGESH`; line 119 discards both.
- [ ] Fixture tests for both parsers against captured HTML.

## A1 — Collection
- [ ] Consent screen — what is collected, what is not, that it is for a college ML project, how to
      withdraw. No consent → no upload, app unchanged.
- [ ] `researchId` = random UUID minted on consent, stored in AsyncStorage. Names, roll numbers and
      login codes are never uploaded.
- [ ] `api/research-upload.js` — Admin SDK write, fire-and-forget after sync (same posture as
      `logSync` in `src/services/telemetry.js`).
- [ ] `api/research-withdraw.js` + Settings button.
- [ ] `firestore.rules`: `match /research/{document=**} { allow read, write: if false; }` — the
      analysis project reads via a service account, so no client ever needs access.

## A2 — Reason prompt (optional; decide before A1 ships)
Turns *absent* into *why*. Accrues data only going forward, so it ships with A1 or never.
One-tap chips after a sync reveals a new absence: `slept_in` / `sick` / `travel` /
`chose_to_skip` / `clash` / `not_held` / `other`. Dismissible, never blocking.

## Firestore schema written by A1

```
research/students/{researchId}
  { schemaVersion, cohort, groupId, gridHash, consentedAt, lastSyncAt, termStart }

research/marks/{researchId}
  { marks: [ { d: "2026-08-12", s: "24CSE0316", p: 1, a: 0 } ] }     # date, course, period, attended

research/timetable/{researchId}
  { slots: [ { day, p, s, faculty, room } ], gridHash, fetchedAt }

research/reasons/{researchId}                                        # only if A2 ships
  { reasons: [ { d, s, p, r } ] }
```

`groupId` needs no UI: students in the same group have identical weekly grids, so
`gridHash = sha256(sorted slots)` clusters them. With 10 groups you should see ~10 distinct hashes.

One document per student per collection, overwritten whole on every sync — a semester of marks is
~400 rows ≈ 20 KB, so no delta logic anywhere.

## Not this

`logAttendanceSnapshot` (`src/services/telemetry.js:47`) and `docs/attendance-research-data.md`
describe the shipped v1 aggregate snapshot that feeds the admin panel. Leave it alone. It has no
per-class rows and keys on the login code, so it cannot serve the research project.
