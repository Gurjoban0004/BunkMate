# Attendance Impact & Recovery

Insights → Impact opens today's timetable selection. Subject details open a
preview scoped to that subject. Both use the same `AttendanceImpactCard` and
`simulateAttendanceImpact` calculation. Custom previews can leave skips
unassigned (combined attendance only) or allocate full pairs to subjects.
Subject details retain the existing quick attend simulator, now explicitly
counting 2-lecture pairs, and its projected subject summary and calendar link.
Its attend preview is independent of the skip card's projection.

## Source of attendance

`getSubjectAttendance` reads the existing college totals from
`subject.initialAttended` and `subject.initialTotal`. These fields already
count lectures, so they must not be multiplied by two. Day-by-day attendance
records are already included in those totals and must not be added again.
The combined percentage is the sum of attended lectures divided by the sum
of conducted lectures, not the average of subject percentages.

All new skip and recovery events contain exactly two lectures. A skipped
pair adds two to conducted lectures, leaving attended lectures unchanged.
An attended recovery pair adds two to both counts. Subject allocation only
changes the selected subject's hypothetical denominator. Requirements use
`subject.target`, falling back to the existing global threshold and then 75%.

## Exact recovery

For a target fraction `a / t`, find the smallest nonnegative whole `n` such
that `(A + 2n) * t >= a * (T + 2n)`. Previous attendance uses the original
attended/conducted fraction directly; fixed percentage targets use
`target / 100`. Percentages are rounded to two decimals only when displayed.
Recovery to 100% after a miss is unreachable and is displayed accordingly.
No previous records are distinguished from a previously recorded 0%.

The component stores hypothetical pair selections locally. It never
dispatches attendance updates or writes to storage. Live syncs update the
baseline while preserving the preview selection. Actual records remain
college-authoritative; this feature does not provide a manual attendance edit.

## Student photos in the web admin panel

The existing ERP session already supplies `studentPhoto`. Successful password
and OTP logins save its normalized HTTPS URL to the existing server activity
roster. Session checks and ordinary data syncs backfill photos from existing
authenticated sessions without a new login or a new student database.
Relative photo paths resolve against `ERP_BASE_URL`; missing photos do not
erase previously saved photos.

The existing admin analytics roster and student-detail responses include the
photo. The web admin student cards, activity rows, and profile header render
it, with initials on missing or failed images. The Mac-local scripts dashboard
is unchanged. Older sessions that contain no photo need a future ERP login
to obtain one. College photo URLs requiring cookies may fail to load and use
the initials fallback.

## Verification

Tests cover exact recovery minimality, pair increments, college-total
aggregation without counting history twice, subject isolation, configured
requirements, holidays, empty/perfect records, invalid pair counts, selection
and reset flows, baseline updates after sync, photo persistence, and roster
photo responses. Unit-test fixtures never seed application attendance state.
