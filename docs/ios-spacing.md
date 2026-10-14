# iOS spacing and card polish

This pass refines the incumbent paper interface. It preserves warm paper,
subject pastels, the user-selected Times New Roman on iOS/web and platform
serif on Android. The iOS tab bar position, app shell and theme are unchanged;
no update was published. These are narrow implementation notes, not a new
design system.

## Observed spacing and type

| Pattern | Final source values |
| --- | --- |
| Main screen and paper-header gutters | 20pt |
| Shared Card, subject summary/rows, Today tiles, Insights and Settings cards | 16pt insets and 16pt corners |
| Today tile gaps and subject-row bottom gaps | 12pt |
| Shared `SPACING.cardGap` | Still 16pt; this pass does not establish a universal 12pt gap |
| Paper tab-root title | 32pt / 38pt line height |
| Paper pushed-screen title | 22pt / 27pt; long titles step down to preserve meaning |
| Today greeting and name | 34pt / 40pt and 37pt / 44pt respectively |
| Planner title, heading, body, caption | 22/28, 17/22, 15/20 and 12/16 |
| Inspected header, planner and Settings controls | At least 44pt on iOS/web and 48dp on Android; some controls are larger |

The source is `Card`, `PaperScreenHeader`, `PaperHeader`, `ClassBento`,
`SubjectRow`, `OverallStatsCard`, `WeeklyReportCard`, `CombinedSkipPlanner` and
the Today, Insights and Settings screens. Values are local component choices;
global spacing, typography and radius tokens were not rewritten.

## Behavior retained by the polish

- Today's answer is visible on first render. Details open in place without
  fade or expansion animation; normal press feedback remains. Upcoming subject
  tiles keep their tint, and completed tiles keep full text opacity.
- The common pushed header uses a drawn SVG back chevron inside the measured
  touch target. It scrolls with its page; title line boxes clear descenders.
- Weekly Report highlights are plain rows on the report surface. The secondary
  row says **Lowest this week** and is omitted at 100%; a perfect week does not
  receive a negative highlight. Semester Outlook remains below the report.
- Planner setup is a grouped bottom sheet with a decrement/input/increment
  goal, 1/2/3-pair presets and 1/2/4/8-week choices. Invalid custom values disable
  saving. The sheet has scrollable content, iOS keyboard avoidance and bottom
  inset padding in source; its modal still uses a slide transition.
- The calendar remains month-first with optional Week view. At 320pt on
  iOS/web, only the grid uses 6pt side gutters to retain seven 44pt targets;
  Android keeps 48dp targets and confined horizontal scrolling if needed.

Calculation and saved-plan behavior are in
[combined-skip-plan.md](combined-skip-plan.md). Native tab-bar verification is
tracked in [ios-tab-bar.md](ios-tab-bar.md).

## Evidence and limits

`.impeccable/review/ios-harmony/` contains browser captures of setup, month,
six-row month, week, Today, Subjects, Insights, subject detail, projections and
Settings at 390×844, including dark variants. Small setup, invalid input and
calendar captures are 320×667; the desktop calendar is 1024×768.

The preview rendered actual source with temporary context/navigation adapters
and a sanitized, read-only conversion of `research/erp-capture-10.json`: two
real subjects, July 17 development date, July 16 coverage and ERP-sourced
records. It did not add mock attendance to the app. Native notification/date
picker imports were stubbed for web Settings and were not used in the web UI.
These are browser screenshots, not native device captures or the current
October register.

The final full test run passed 396 tests in 57 suites with one pre-existing
skip; the correction batch passed 37 targeted tests. Final production web,
iOS and Android JavaScript exports passed. A fresh review initially required
fixes; its final **SHIP** covers the visible/unanimated Today answer, Settings
touch targets, report rows and the 100% case with Semester Outlook recapture,
and the common back chevron. It found no regression from those fixes. Planner
date spreading and weekday rotation were checked independently by tests.

Native execution, font scaling, keyboard behavior, gestures, VoiceOver and
TalkBack remain unverified. No APK was built. `docs/design_system.md` still
names Plus Jakarta Sans and JetBrains Mono; this pre-existing font drift is
neither adopted as the implementation rule nor repaired by this pass. No
`DESIGN.md` or design sidecar was created.
