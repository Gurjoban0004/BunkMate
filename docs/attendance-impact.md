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

The source endpoint is **POST `/mobilev2/getUserDetails`**. The college's official
app calls it in `research/apk-new/assets/www/js/init-app.js:4178` for the personal
information page, using userId, sessionId, apiKey, roleId, and securityToken.
The response is an array of profile objects; the portrait URL is `photo`.
`getProfileMenu` receives the URL and is not the profile-photo source.
The captured website also contains a real JPEG URL under
`https://s3.amazonaws.com/cbrig-assets/cuiet/resources/Student/`.

Successful password/OTP logins already save the session's normalized HTTPS
`studentPhoto` in the existing `admin/activity/students/{rollNumber}` roster.
Normal attendance sync now backfills missing photos through `getUserDetails`
using the student's own authenticated session. No new login or student database
is required. Missing/unavailable photos are retried at most once per day;
a five-second portrait timeout or storage failure cannot fail attendance sync.
Only portrait metadata is merged, preserving attendance and existing identity.
The request shape is source-verified and unit-tested; no live authenticated
`getUserDetails` call was made during this run.

The dense local web admin is
[Students — 127.0.0.1:4545](http://127.0.0.1:4545/#students), served by
`scripts/admin-dashboard.js` and `scripts/admin-dashboard.html`. It uses the
existing analytics roster and student-detail responses. The local `/api/photo`
route reads an existing student's saved URL and caches the original image bytes
in git-ignored `.admin-photos/`. Only the verified college S3 image store or the
configured ERP origin is accepted, redirects are rejected, and images have
bounded size and timeouts. Cache directories/files use private permissions.
Firestore stays read-only in the local dashboard.

Identity photos are accessible buttons opening a full, uncropped original in a
focused viewer with a Close action and Escape support. Failed/missing photos
use initials. Names and URLs are escaped; images do not send a referrer.
The Students page reports photos saved. Existing portraits can be displayed
immediately; students without one receive their photo after their next
successful authenticated sync once the API changes are deployed. The admin
roster has no ERP credentials with which to fetch every missing face itself.
Never infer a student's portrait filename or enumerate the college's image store.

## Verification

Tests cover exact recovery minimality, pair increments, college-total
aggregation without counting history twice, subject isolation, configured
requirements, holidays, empty/perfect records, invalid pair counts, selection
and reset flows, baseline updates after sync, photo persistence, and roster
photo responses. Unit-test fixtures never seed application attendance state.

The October 8 integration run reports 353 passing tests and one skipped test
across 51 suites. New tests cover source-endpoint authentication, old-session
photo backfill, retry cooldown, safe original-image caching, and credential-free
attendance backup. Browser checks opened a saved real college portrait in the
dense dashboard's full viewer and verified the local cache served it successfully.
These checks do not verify physical iPhone or native rendering.
