# Skip calendar

`SkipPlanScreen` is a dedicated calendar opened from Today, Insights, or a
subject's **Plan on calendar** button. Its compact header replaces the Insights
header and section tabs. Month is the default; Week is also available. Selecting
a real date keeps its scheduled class rows below the grid. Tapping a row toggles
its complete block between Attend and Skip and immediately updates projections.

## Saved plan and entry points

- First use opens a setup sheet. Weekly presets are 1, 2 and 3 pairs, with a
  custom nonnegative whole number; horizons are 1, 2, 4 or 8 weeks. One pair is
  two lectures. Saving hides setup; the preference button reopens it.
- `settings.skipPlan` stores `pairsPerWeek`, `weeks` and optional `skipIds`
  through existing asynchronous state storage. Rebuilding clears manual choices
  and creates the balanced plan again. This never records attendance.
- `getSavedSkipPlan` replays choices against current college totals and
  timetable. Expired or removed class IDs are discarded. Unsafe choices remain
  warnings; invalid records or times pause skip suggestions.
- Today shows saved classes for today with real times and Attend/Skip choices;
  unsafe choices say **Review skip**. Published or already-ended classes are
  omitted from future choices. The shortcut remains a preview.
- Subject detail retains its recorded summary, **Plan on calendar** button,
  `AttendanceImpactCard` simulator, recorded calendar and history. The button
  opens the subject-focused calendar. Web URLs restore calendar and subject
  focus. Insights retains its separate Impact simulator.

The combined summary opens a details sheet with all subjects: recorded/projected
percentages, individual minima, available/planned pairs and exact lecture
fractions. A subject row focuses the calendar; **All subjects** clears the filter.
Each subject includes full pairs to restore its previous exact fraction. Combined
recovery uses consecutive full pairs after the plan to restore its previous
fraction or reach 75%, 80%, 85% and 90%; impossible recovery is unreachable.
Available pairs are not additional skips to add to the combined plan.

## Calculation contract

- Totals use existing `getSubjectAttendance`; recorded history is already
  included. Targets use each subject's requirement, then the global setting,
  then 75%. Display rounding never governs safety.
- Saved plans use `includeToday: true`. Published subject-days are not counted
  twice. Unpublished classes already ended today, and scheduled pairs between
  published coverage and today, are reserved as missed with no attendance
  credit. Missing, future or more than 31-day-old coverage pauses suggestions.
- Only real timetable blocks are used; four-lecture blocks remain indivisible.
  Single/odd counts, unmatched, duplicate, overlapping or incomplete periods
  pause suggestions; no pairs are invented. Inferred/register-derived times
  need manual confirmation in Edit timetable. Holidays, cancelled subject-days
  and a valid configured semester end apply.
- Every automatic Skip must satisfy `100 * attended >= target * conducted`
  after adding the skipped lectures. Attend adds numerator and denominator.
  Later classes cannot make an earlier Skip safe; low subjects recover first.
- The planner maximizes feasible skipped pairs within each Monday–Sunday
  week's budget, then balances the weakest margins above individual targets
  using exact fractions. Weeks are solved consecutively, including partial
  weeks; this does not promise a globally optimal whole-term allocation.
- Manual choices can exceed the budget or minimum; both are flagged. An unsafe
  earlier Skip remains flagged even if later attendance recovers the final
  percentage. Duplicate IDs count once; direct projection rejects unknown IDs
  and skips when warnings are active.

Projections require attendance at the other classes and an applicable timetable.
No calendar or simulator action commits attendance records. The supplied cohort
schedule is documented in [g4-timetable.md](g4-timetable.md).

## Visual extension

The calendar extends the incumbent paper/Times interface (`SERIF_FONT`, platform
serif on Android) with the user's requested sage Attend, apricot Skip and
lavender selection/preferences. Short labels, marks, icons and explicit actions
reinforce color. This direction governs this extension despite PRODUCT.md's
general pastel anti-reference.

Content is at most 620px wide with 16px side padding. Six-row months compress
without targets falling below 44px on web/iOS or 48px on Android. At 320px, the
web/iOS grid uses 6px side gutters and seven 44px targets, including Sunday.
Android retains 48px targets and confined grid scrolling when space is
insufficient. The selected day's classes follow the visible calendar; detailed
subject numbers stay in the sheet.

The implementation was compared with PRODUCT.md, `docs/design_system.md`, the
current theme, source components and browser captures. The design document still
specifies Plus Jakarta Sans and JetBrains Mono; implementation uses Times on
iOS/web and platform serif on Android. This pre-existing drift is recorded
without changing product guidance, global design documentation or tokens.

## Evidence and limits

Actual screens and shell were rendered with temporary context/navigation
adapters and a sanitized, read-only conversion of historical
`research/erp-capture-10.json`: July 17 development date, July 16 coverage and two
real subjects. No mock app attendance or storage writes were created. Captures
do not demonstrate the current October register, three real classes in one
opening view, or timetable provenance; that metadata was not propagated by the
preview adapter.

Valid `.impeccable/review/compact-calendar/` captures cover 390×844 (47px top,
0px bottom inset), 320×667 and 1024×768: `phone-month.png`, `phone-week.png`,
`phone-six-row.png`, `phone-toggled.png`, `phone-risk.png`, `phone-details.png`,
`phone-today.png`, `phone-subject.png`, `phone-setup.png`, `phone-dark.png`,
`user-320.png` and `desktop.png`.

The full implementation run passed 387 tests in 56 suites with one pre-existing
skip. The final correction batch passed 11 targeted tests in two suites; fresh
production web, Android and iOS exports passed and `git diff --check` was clean.
Tests cover fraction safety, exhaustive weekly choices, malformed schedules,
coverage, whole blocks, saved preferences, state changes and navigation.

A fresh full review found Sunday clipping at 320px, holding the first verified
portal grid without a baseline, and discarding the native bottom inset.
Corrections resolved all three: browser recaptures checked clipping, tests
checked grid replacement, and native source checked the inset. A follow-up guard
preserves cohort retirement across repeated published syncs. Final **SHIP** is
scoped to those closures, not a second full review or device verdict.

Physical iPhone/Home Screen and native simulator rendering, keyboard behavior,
font scaling, VoiceOver and TalkBack remain unverified. The native RN detector
was not run; suppressed hook warnings are not an accessibility pass. See
[ios-tab-bar.md](ios-tab-bar.md) for the unresolved installed iPhone check.
