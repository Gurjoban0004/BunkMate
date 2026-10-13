# Combined weekly skip plan

Insights → Plan combines all subjects, with a shortcut on Today. The preview
uses the same `AppContext` state and `getSubjectAttendance` college totals as
the existing screens. History is already included in those totals and is not
added again. The planner does not dispatch actions or persist attendance.

## Calculation contract

- One pair is two lectures. Timetable periods are grouped by the existing
  `getClassesForDay`; four-lecture blocks stay indivisible. Unknown, overlapping,
  duplicate or incomplete periods pause skip suggestions. There is no generated
  weekday fallback or manually entered attendance baseline.
- Planning begins tomorrow, in Monday–Sunday weeks. The first/last week can be
  partial. UI windows are 1, 2, 4 or 8 weeks; the calculation supports up to 12.
  Known holidays, cancelled subject-days and the configured semester end apply.
- Each subject uses its configured target, falling back to the existing global
  requirement, then 75%. Totals use the existing helper's nonnegative validation
  and attended≤conducted clamp; only displayed percentages are rounded.
- Published coverage comes from `getErpCoverageDateForSubject`. Scheduled pairs
  after coverage through today are reserved as missed, with no invented credit.
  Missing/future coverage or coverage older than 31 days pauses all suggestions.
  The UI discloses these conservative assumptions and offers sync/timetable fixes.
- At every proposed Skip, the subject must satisfy
  `100 * attended >= target * conducted` after adding the skipped lectures.
  Attend adds both numerator and denominator. No later class lends credit to an
  earlier Skip. Initially low subjects attend until they can afford a full block.
- A dynamic program enumerates feasible counts for each subject each week.
  A second program combines those options to maximize the weekly count within
  the user's budget. Ties maximize the weakest subject's margin above its own
  target, then the next weakest, comparing unrounded fractions. This balances
  available margins instead of using the overall average to hide a weak subject.
  Weeks are solved consecutively; this is not a promise of globally optimal skips
  across the whole term, nor a guarantee of future college timetable accuracy.

## Calendar interaction

Week and Month views display only the real timetable inside the chosen future
window. Select a day, then tap its class tile to switch that complete block
between Attend and Skip. Every tap immediately recalculates the combined and
individual projections. Auto plan restores the balanced choices for the budget.
Changing the budget, horizon or synced state recomputes the automatic plan.
Subject focus filters the calendar, while the balance list always retains all
subjects. Subject detail keeps its recorded summary, calendar and history and
has one button opening Insights → Plan with that subject focused; it has no
embedded impact or recovery simulator. The web URL preserves the subject focus.

`projectCombinedSkipPlan` replays selected IDs against the plan's recorded totals
and reserved unpublished pairs without mutating either the baseline or attendance
state. Duplicate IDs count once; unknown IDs are rejected. Manual exploration
can exceed the budget or cross a subject's minimum. These choices are explicitly
flagged; an unsafe earlier skip remains flagged even if later Attend classes
bring the final percentage back above the requirement. Automatic choices still
obey the calculation contract at every skip.

The subject comparison shows recorded/projected percentages, the individual
minimum, pairs available immediately and planned pairs. Immediate availability
uses the conservative reserved baseline; it is not extra skips to add to the
combined plan. A single **Numbers & recovery** disclosure contains the exact
combined/subject fractions and consecutive full pairs needed after the entire
plan to recover the previous fraction or reach 75%, 80%, 85% and 90%. Impossible
100% recovery is shown as unreachable. The existing Insights Impact simulator
remains available for a skip-today scenario independently of the future plan.

The plan holds only if Attend classes are attended and the timetable remains
applicable. There is no action here to commit a simulation as actual attendance.

## Visual extension

This is an ordinary extension of the incumbent paper and serif interface.
It retains the Insights header, section tabs and Today shortcut to Plan. The
live calendar replaces the previous reading-heavy presentation: Week is the
default, with a real class selected and its Attend/Skip tile visible in the
opening 393×852 browser viewport. Month shows the full month grid, including
disabled dates outside the planning window. Current typography and colors come
from `src/theme/theme.js`; this surface introduces no broader brand update.

The reading order is budget and Auto plan → Week/Month calendar → live combined
projection → selected day's complete class blocks → all-subject comparison →
folded Numbers & recovery → assumptions. A date tap selects its real timetable
blocks; a class tap switches the whole block between Attend and Skip and updates
the combined projection and every subject immediately. Subject rows focus the
calendar, while exact fractions and recovery stay in the single disclosure.
Subject detail retains recorded attendance, calendar and history, with one
“Try skips on the calendar” CTA opening the subject-focused Insights plan.

The body has 20px side padding and a 720px maximum width. Interactive controls
use at least 44px targets on iOS/web and 48px on Android. Calendar days are at
least 52px high; a 322px minimum grid gives 44px-wide web/iOS days, and Android's
350px minimum gives 48px-wide days. At narrow widths, horizontal overflow is
confined to the calendar, preserving these targets; the surrounding controls
wrap. The 320×667 capture records this compact layout.

Sage date surfaces indicate scheduled Attend classes, amber surfaces indicate
Skip choices, and filled ink marks the selected date. Subject-tinted circles
mean Attend and diamonds mean Skip, reinforced by the legend and explicit class
labels and icons. Selected dates use paper-colored marks; unsafe choices add a
warning label and border. Subject tints also carry through class tiles and
comparison tracks. Hollow recorded and filled projected markers distinguish the
two values; each subject's minimum is a dashed line. These cues accompany color
in both the captured light and dark appearances.

## Verification scope

Tests include exhaustive weekly subsets, randomized fraction safety, holidays,
term end, unpublished coverage, malformed schedules, block indivisibility,
unchanged input state, UI controls/recalculation, subject focus, native and web
navigation, and the web shortcut/URL.

Browser previews render the actual screens and shell using local context and
navigation adapters. Their attendance comes from an isolated read-only
conversion of the existing historical `research/erp-capture-10.json`: two real
college subjects with coverage through July 16. No mock attendance is added to
the app. These captures demonstrate that historical register, not the user's
current October register.

All ten refreshed captures in `.impeccable/review/live-calendar/` are valid:
`mobile.png`, `mobile-month.png`, `mobile-balance.png`, `mobile-toggled.png`,
`mobile-unsafe.png`, `mobile-subject.png`, `user-320.png`, `desktop.png`,
`desktop-balance.png` and `mobile-dark.png`. They cover 393×852, 320×667 and
1024×768, showing Week, Month, changed decisions, unsafe/over-budget exploration,
subject comparison, the subject CTA and dark browser appearance. The finished
surface was compared with the incumbent source, these images and the existing
design documentation.

The fresh full finish review returned **fix** for one finding: Android calendar
days fell below the 48px target. After the minimum-width correction, scoped
verification resolved that finding and the final disposition was **ship**.
That disposition reflects closure of the sole reported finding; no second full
review was performed, and it does not establish that nothing material remains.

The full test run reports 374 passes across 55 suites and one pre-existing skip.
After the Android target fix, 21 targeted tests across four suites passed. Fresh
production web, Android and iOS bundle exports passed, and `git diff --check`
was clean. These checks do not verify physical-device or installed Home Screen
rendering. Native/Home Screen, software keyboard, VoiceOver, TalkBack and font
scaling remain unverified. The native-source detector was not run; suppressed
hook warnings do not constitute a standalone accessibility pass.

`docs/design_system.md` still describes Plus Jakarta Sans and JetBrains Mono;
the implementation uses Times on iOS/web and the platform serif on Android.
This pre-existing drift is recorded without changing that document, `PRODUCT.md`,
tokens or the global design system.
