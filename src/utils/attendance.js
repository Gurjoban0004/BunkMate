import { getTodayDayName, parseTimeToMinutes } from './dateHelpers';

/**
 * ── THE ONE RULE ─────────────────────────────────────────────────────
 * Attendance numbers come from the college and nowhere else.
 *
 * `subject.initialAttended` / `subject.initialTotal` ARE the college's own
 * per-subject totals (the field names are historical). Nothing the student
 * does in the app changes them; only a sync does. Day-by-day records
 * (`state.attendanceRecords`) are the college register and exist for history,
 * calendars and insights — they are never summed into the totals, because the
 * totals already include them.
 *
 * This replaced a model where the app auto-marked every past class as present
 * and let students mark classes the teacher had not uploaded yet, then tried
 * to garbage-collect those marks once the college caught up. The result was
 * numbers higher than the college's, which is the one thing an attendance
 * app must never show.
 *
 * ── UNITS vs CLASSES ─────────────────────────────────────────────────
 * A *unit* is one period on the register (one hour). A *class* is one
 * physical session, all-or-nothing under college rules: a 2-hour class is 2
 * units and you get both or neither. All percentage maths runs in units,
 * because that is exactly what the college counts. Anything shown to a
 * student as "classes" is converted through the subject's session size.
 */

/**
 * Exact attendance percentage, NOT rounded. Round only at the point of
 * display (roundPct); a rounded 74.96 → 75.0 once got called "safe".
 */
export function calculatePercentage(attended, total) {
    const safeTotal = Number(total);
    const safeAttended = Number(attended);
    if (!Number.isFinite(safeTotal) || safeTotal <= 0 || !Number.isFinite(safeAttended)) return 0;
    // Multiply before dividing: (a / t) * 100 rounds twice and 87/150*100
    // lands on 57.99999999999999 even though 100*87 === 58*150 exactly.
    return (Math.min(Math.max(safeAttended, 0), safeTotal) * 100) / safeTotal;
}

/** Display helper: 1 decimal place. Never feed this back into a comparison. */
export function roundPct(percentage) {
    const n = Number(percentage);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

/**
 * Max units that can be added to total (without attending) and still hold target.
 * Closed form: A/(T+S) >= p  →  S <= 100A/p - T, then corrected against the
 * predicate itself so float error can never produce an off-by-one.
 */
export function maxSkippableUnits(attended, total, targetPercent) {
    const A = attendanceNumber(attended);
    const T = attendanceNumber(total);
    const p = Number(targetPercent);
    if (!Number.isFinite(p) || p <= 0) return Infinity;
    if (100 * A < p * T) return 0; // already below target

    let s = Math.floor((100 * A - p * T) / p);
    if (!Number.isFinite(s)) return 0;
    while (s > 0 && 100 * A < p * (T + s)) s--;
    while (100 * A >= p * (T + s + 1)) s++;
    return Math.max(0, s);
}

/**
 * Units that must be attended consecutively to reach target.
 * Closed form: (A+N)/(T+N) >= p  →  N >= (pT - 100A)/(100 - p)
 * Returns Infinity when the target is unreachable (p >= 100 with a miss on record).
 */
export function unitsToReachTarget(attended, total, targetPercent) {
    const A = attendanceNumber(attended);
    const T = attendanceNumber(total);
    const p = Number(targetPercent);
    if (!Number.isFinite(p) || p <= 0) return 0;
    if (T > 0 && 100 * A >= p * T) return 0;
    if (p >= 100) return A >= T ? 0 : Infinity;

    let n = Math.ceil((p * T - 100 * A) / (100 - p));
    if (!Number.isFinite(n)) return Infinity;
    while (n > 0 && 100 * (A + n - 1) >= p * (T + n - 1)) n--;
    while (100 * (A + n) < p * (T + n)) n++;
    return Math.max(0, n);
}

/**
 * Convert a unit budget into whole classes a student may skip.
 * Classes are atomic, so a 3-unit budget buys only one 2-hour class.
 * Uses the LARGEST session size so the number is never overstated.
 */
export function unitsToSkippableClasses(units, sessionUnits) {
    if (!Number.isFinite(units)) return units; // Infinity passes through
    const size = Math.max(1, sessionUnits?.max || sessionUnits || 1);
    return Math.max(0, Math.floor(units / size));
}

/**
 * Convert required units into whole classes a student must attend.
 * Uses the SMALLEST session size so the number is never understated.
 */
export function unitsToNeededClasses(units, sessionUnits) {
    if (!Number.isFinite(units)) return units;
    const size = Math.max(1, sessionUnits?.min || sessionUnits || 1);
    return Math.max(0, Math.ceil(units / size));
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function attendanceNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
}

/**
 * The most recent date the college register covers for a subject — i.e. how
 * far the college has updated. Display only; it never changes a number.
 */
export function getErpCoverageDateForSubject(subjectId, state) {
    const subjectSyncDate = state.settings?.lastSubjectSyncDates?.[subjectId] || null;
    const globalSyncDate = state.latestErpDate || state.settings?.latestErpDate || null;
    if (!subjectSyncDate) return globalSyncDate;
    if (!globalSyncDate) return subjectSyncDate;
    return subjectSyncDate > globalSyncDate ? subjectSyncDate : globalSyncDate;
}

/**
 * Attendance for one subject: the college's totals, exactly.
 */
export function getSubjectAttendance(subjectId, state) {
    const subject = (state.subjects || []).find((s) => s.id === subjectId);
    if (!subject) return null;

    const totalUnits = attendanceNumber(subject.initialTotal);
    const attendedUnits = Math.min(attendanceNumber(subject.initialAttended), totalUnits);

    return {
        totalUnits,
        attendedUnits,
        percentage: calculatePercentage(attendedUnits, totalUnits),
        sessionUnits: getSubjectSessionUnits(subjectId, state),
    };
}

/** Units covered by one register record. */
export function recordUnits(record) {
    return attendanceNumber(record?.units) || 1;
}

/**
 * Units actually attended in one register record. A record can cover several
 * periods of the same subject on one day (not always adjacent), and the
 * register knows how many were attended, so trust `attendedUnits`.
 */
export function recordAttendedUnits(record) {
    if (!record) return 0;
    const explicit = Number(record.attendedUnits);
    if (Number.isFinite(explicit) && explicit >= 0) {
        return Math.min(explicit, recordUnits(record));
    }
    return record.status === 'present' ? recordUnits(record) : 0;
}

/**
 * Session sizes (in units) for a subject across the week.
 * Returns { min, max } — equal for the common case where every session of a
 * subject is the same length. Defaults to 1/1 when the timetable is unknown.
 */
export function getSubjectSessionUnits(subjectId, state) {
    let min = Infinity;
    let max = 1;

    DAY_NAMES.forEach((dayName) => {
        getClassesForDay(state, dayName).forEach((cls) => {
            if (cls.subjectId !== subjectId) return;
            min = Math.min(min, cls.units);
            max = Math.max(max, cls.units);
        });
    });

    return { min: Number.isFinite(min) ? min : 1, max };
}

/**
 * The one call a screen should make to answer "can I skip this subject?".
 * Percentages are exact; counts come back in both units (register periods)
 * and whole classes (what a student actually attends or misses).
 */
export function getSubjectSkipBudget(subjectId, state, targetPercent) {
    const stats = getSubjectAttendance(subjectId, state);
    if (!stats) return null;

    const subject = state.subjects.find((s) => s.id === subjectId);
    const target = targetPercent
        ?? subject?.target
        ?? state.settings?.dangerThreshold
        ?? 75;

    const skipUnits = maxSkippableUnits(stats.attendedUnits, stats.totalUnits, target);
    const needUnits = unitsToReachTarget(stats.attendedUnits, stats.totalUnits, target);

    return {
        ...stats,
        target,
        onTrack: needUnits === 0,
        skipUnits,
        skipClasses: unitsToSkippableClasses(skipUnits, stats.sessionUnits),
        needUnits,
        needClasses: unitsToNeededClasses(needUnits, stats.sessionUnits),
    };
}

/**
 * Classes for a day name (e.g. 'Monday'), consecutive periods of one subject
 * merged into a single class with `units` = number of periods.
 */
export function getClassesForDay(state, dayName) {
    const timetable = state.timetable || {};
    const daySchedule = timetable[dayName] || [];

    if (daySchedule.length === 0) return [];

    const groupedClasses = [];
    let lastClass = null;

    const timeSlots = state.timeSlots || [];
    const subjects = state.subjects || [];

    const sortedSchedule = [...daySchedule].sort((a, b) => {
        const slotA = timeSlots.find((ts) => ts.id === a.slotId);
        const slotB = timeSlots.find((ts) => ts.id === b.slotId);
        if (!slotA || !slotB) return 0;
        return parseTimeToMinutes(slotA.start) - parseTimeToMinutes(slotB.start);
    });

    sortedSchedule.forEach((slot) => {
        const timeSlot = timeSlots.find((ts) => ts.id === slot.slotId);
        const subject = subjects.find((s) => s.id === slot.subjectId);

        if ((!timeSlot && !slot.customStart) || !subject) return;

        const startTime = slot.customStart || timeSlot.start;
        const endTime = slot.customEnd || timeSlot.end;

        const currentStartMins = parseTimeToMinutes(startTime);
        const lastEndMins = lastClass ? parseTimeToMinutes(lastClass.endTime) : 0;

        // Consecutive periods of the same subject are ONE class under college
        // rules. Allow up to a 30-minute break, and any overlap, which is how
        // the register encodes a 2-hour class across two period slots.
        if (
            lastClass &&
            lastClass.subjectId === slot.subjectId &&
            (currentStartMins - lastEndMins) <= 30
        ) {
            if (parseTimeToMinutes(endTime) > parseTimeToMinutes(lastClass.endTime)) {
                lastClass.endTime = endTime;
            }
            lastClass.units += 1;
        } else {
            const newClass = {
                subjectId: slot.subjectId,
                subjectName: subject.name,
                teacher: subject.teacher,
                color: subject.color,
                startTime,
                endTime,
                units: 1,
            };
            groupedClasses.push(newClass);
            lastClass = newClass;
        }
    });

    return groupedClasses;
}

/** Today's classes from the timetable. */
export function getTodayClasses(state, devDate = null) {
    return getClassesForDay(state, getTodayDayName(devDate));
}

/**
 * Skip / recovery verdict for a subject.
 *
 * `count` is in UNITS (register periods). Pass `sessionUnits` to also get
 * `classes`, the count in whole physical classes — the number to show a
 * student, since a 2-hour class cannot be half-skipped.
 */
export function calculateSkips(attended, total, targetPercent, sessionUnits = 1) {
    if (!(Number(total) > 0)) {
        return {
            status: 'safe',
            count: 0,
            classes: 0,
            message: 'No classes recorded yet',
        };
    }

    const needUnits = unitsToReachTarget(attended, total, targetPercent);

    if (needUnits === 0) {
        const canSkip = maxSkippableUnits(attended, total, targetPercent);
        const classes = unitsToSkippableClasses(canSkip, sessionUnits);
        return {
            status: 'safe',
            count: canSkip,
            classes,
            message: `You can skip ${classes} more ${classes === 1 ? 'class' : 'classes'}`,
        };
    }

    if (!Number.isFinite(needUnits)) {
        return {
            status: 'danger',
            count: Infinity,
            classes: Infinity,
            message: `You missed a class, you can't reach ${targetPercent}% attendance!`,
        };
    }

    const classes = unitsToNeededClasses(needUnits, sessionUnits);
    return {
        status: 'danger',
        count: needUnits,
        classes,
        message: classes > 9999
            ? `You can't realistically reach ${targetPercent}% anymore`
            : `You need to attend ${classes} more ${classes === 1 ? 'class' : 'classes'}`,
    };
}

/** Index of the class happening right now, or -1. */
export function getCurrentClassIndex(todayClasses, devDate = null) {
    const now = devDate ? new Date(devDate) : new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return todayClasses.findIndex((c) => {
        const start = parseTimeToMinutes(c.startTime);
        const end = parseTimeToMinutes(c.endTime);
        return currentMinutes >= start && currentMinutes < end;
    });
}

/** Overall attendance across all subjects, in units, exactly as the college sums it. */
export function calculateOverallPercentage(state) {
    if (!state.subjects || state.subjects.length === 0) return 0;

    let totalAttended = 0;
    let totalUnits = 0;

    state.subjects.forEach((subject) => {
        const stats = getSubjectAttendance(subject.id, state);
        if (stats) {
            totalAttended += stats.attendedUnits;
            totalUnits += stats.totalUnits;
        }
    });

    return calculatePercentage(totalAttended, totalUnits);
}
