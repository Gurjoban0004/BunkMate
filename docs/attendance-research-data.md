# Attendance research data

The app writes one current ERP snapshot per student per UTC day at:

`telemetry/{userId}/attendanceSnapshots/{YYYY-MM-DD}`

Each document is an aggregate-only snapshot:

```json
{
  "schemaVersion": 1,
  "cohort": "24",
  "source": "erp",
  "subjects": [{
    "courseCode": "24CSE0316",
    "courseName": "Artificial Intelligence and Machine Learning",
    "attended": 20,
    "total": 24,
    "absent": 4,
    "percentage": 83.3
  }]
}
```

It intentionally excludes student names, roll numbers, login codes, individual class marks, manual marks, and timetable data. The document key is only the snapshot day, used for retry-safe replacement. Firestore rules keep these documents write-only to the student and unreadable from clients. The teacher/AIML project must use trusted server-side aggregation, grouping by `courseCode` and `cohort`; it should enforce a minimum cohort size before publishing a result.

Snapshots use a stable daily document id, so retries replace the current day rather than creating duplicate observations. `schemaVersion` makes future additions explicit and backward-compatible.
