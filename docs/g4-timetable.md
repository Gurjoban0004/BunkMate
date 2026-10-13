# CSE semester 5 G4 timetable

The user-supplied timetable image, generated October 6, 2026, provides a scoped
schedule for confirmed CSE · semester 5 · G4 students. Every block is two
lectures in room TG-312; Saturday and Sunday have no classes.

| Day | 09:00–11:00 | 11:00–13:00 | 14:00–16:00 |
| --- | --- | --- | --- |
| Monday | ADI | SD | AIML |
| Tuesday | ADI | BEE-II | NALR-I |
| Wednesday | ADI | NALR-I | AIML |
| Thursday | ADI | BEE-II | SD |
| Friday | ADI | BEE-II | AIML |

## Eligibility and persistence

`cohortTimetable.js` matches all five existing subjects by code, name or course
tag. Missing/ambiguous matches block activation and offer subject sync; no
zero-attendance subjects or manual attendance baselines are created. Known
portal groups other than G4 block confirmation.

Users without confirmed cohort metadata get a one-time Today prompt. **Yes,
use it** stores confirmed `settings.academicCohort` and activates the schedule;
**Another section** dismisses that prompt. Edit timetable retains confirmation
if it was dismissed. Activation persists `source: 'cohort'` and
`cohortVersion: '2026-10-06'` through existing storage. Only matching users who
confirm after upgrading receive it; there is no server-wide batch mutation.
Subjects, college totals and attendance records are unchanged. The prompt uses
the incumbent paper/serif interface and requested lavender surface.

## Chalkpad replacement contract

- A verified, non-inferred `erp`/`portal-web` grid present at activation supplies
  `portalBaseline`. Re-fetching that unchanged old grid retains the supplied
  schedule; a changed published grid immediately replaces it and retires the
  cohort override.
- Without a verified baseline, the **first** non-inferred published `erp` or
  `portal-web` grid immediately replaces the supplied schedule. It is not held
  merely to learn a baseline.
- Inferred times and sparse/register-derived responses retain verified times.
  A portal grid identifying another group retires G4 even with inferred times;
  skip suggestions then pause until times are confirmed. Once retired, inferred
  responses cannot replace the published grid.
- While the override is active, every actual attendance sync also fetches the
  timetable: every three minutes while open, foreground and manual refresh,
  subject to existing debounce/session rules. Changes apply on the next
  successful fetch, not instant remote push. Normal daily/manual timetable
  cadence resumes after retirement. Failed/empty fetches supply no replacement.

Manual edits keep existing manual-source sync behavior. Saved skip choices replay
against the current schedule and never become attendance marks. See
[combined-skip-plan.md](combined-skip-plan.md).

## Verification and limits

Utility/reducer tests verify 15 full pairs, real-subject matching, unchanged
attendance, known-baseline comparison, immediate first-grid replacement,
inferred response retention and different-group retirement. The repeated-sync
test confirms retirement survives a second published grid and blocks a later
register-derived overwrite. Latest test/export results are recorded in
[combined-skip-plan.md](combined-skip-plan.md).

No authenticated live Chalkpad check was performed. Captures use two historical
subjects and do not visually prove this five-subject G4 schedule or propagate
timetable provenance. The supplied image and source/tests establish this
schedule; future college changes depend on a successful sync.
