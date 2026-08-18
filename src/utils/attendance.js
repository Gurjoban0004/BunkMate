import { getTodayDayName, parseTimeToMinutes } from './dateHelpers';

/**
 * ── UNITS vs CLASSES ────────────────────────────────────────────────
 * A *unit* is one period on the ERP register (one hour). A *class* is one
 * physical session, which is all-or-nothing per college rules: a 2-hour class
 * is 2 units, and you either get both or neither.
 *
 * All percentage math runs in units, because that is exactly what the ERP
 * counts. Anything shown to a student as "classes" must be converted through
 * the subject's session size — see unitsToSkippableClasses / unitsToNeededClasses.
 */

/**
 * Exact attendance percentage — NOT rounded.
 * Rounding here used to leak into decisions: 74.96% rounded to 75.0 and the app
 * called it safe. Round at the point of display instead (roundPct).
 * Returns 0 if total is 0 (avoids division by zero).
 */
export function calculatePercentage(attended, total) {
    const safeTotal = Number(total);
    const safeAttended = Number(attended);
    if (!Number.isFinite(safeTotal) || safeTotal <= 0 || !Number.isFinite(safeAttended)) return 0;
    // Multiply before dividing. (a / t) * 100 rounds twice, so an exact result
    // can land just under: 87/150*100 gives 57.99999999999999, which read as
    // below a 58% target even though 100*87 === 58*150 exactly.
    return (Math.min(Math.max(safeAttended, 0), safeTotal) * 100) / safeTotal;
}

/** Display helper: 1 decimal place. Never feed this back into a comparison. */
export function roundPct(percentage) {
    const n = Number(percentage);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

/**
 * Max units that can be added to total (without attending) and still hold target.
 * Closed form: A/(T+S) >= p  →  S <= 100A/p - T
 * The floor is then corrected against the predicate itself, so float error in
 * the division can never produce an off-by-one in either direction.
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

function maxDateKey(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return a > b ? a : b;
}

export function getErpCoverageDateForSubject(subjectId, state) {
    const subjectSyncDate = state.settings?.lastSubjectSyncDates?.[subjectId] || null;
    const globalSyncDate = state.latestErpDate || state.settings?.latestErpDate || null;
    return maxDateKey(subjectSyncDate, globalSyncDate);
}

export function shouldCountLocalRecord(dateKey, subjectId, record, state) {
    if (!record || record.source === 'erp') return false;

    const coverageDate = getErpCoverageDateForSubject(subjectId, state);
    if (coverageDate && dateKey <= coverageDate) {
        return false;
    }

    return true;
}

/**
 * Get full attendance stats for a single subject.
 * Combines initial values with all recorded attendance marks.
 * Skips holidays and cancelled classes.
 */
export function getSubjectAttendance(subjectId, state) {
    const subject = state.subjects.find((s) => s.id === subjectId);
    if (!subject) return null;

    let recordedTotal = 0;
    let recordedAttended = 0;
    let hasPredictions = false;

    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];
    // ERP summary totals are the source of truth. ERP calendar data is for
    // history; local records are temporary bridges until ERP catches up.
    Object.entries(records).forEach(([dateKey, dayRecord]) => {
        // Skip holidays
        if (dayRecord._holiday) return;
        if (holidays.includes(dateKey)) return;

        const record = dayRecord[subjectId];
        if (record) {
            // Skip cancelled individual classes
            if (record.status === 'cancelled') return;

            // ERP totals are the baseline. Local records only count while they are
            // newer than the latest ERP coverage date for this subject.
            if (!shouldCountLocalRecord(dateKey, subjectId, record, state)) return;

            hasPredictions = true;
            recordedTotal += recordUnits(record);
            recordedAttended += recordAttendedUnits(record);
        }
    });

    const initialTotal = attendanceNumber(subject.initialTotal);
    const initialAttended = Math.min(attendanceNumber(subject.initialAttended), initialTotal);
    const totalUnits = initialTotal + recordedTotal;
    const attendedUnits = initialAttended + recordedAttended;
    const percentage = calculatePercentage(attendedUnits, totalUnits);

    return {
        totalUnits,
        attendedUnits,
        percentage,
        hasPredictions,
        sessionUnits: getSubjectSessionUnits(subjectId, state),
    };
}

/**
 * Units covered by one attendance record.
 */
export function recordUnits(record) {
    return attendanceNumber(record?.units) || 1;
}

/**
 * Units actually attended in one record.
 *
 * A record can cover several periods of the same subject on one day, and those
 * periods are not always one block — e.g. period 1 and period 5. The ERP
 * register knows how many of them were attended, so trust `attendedUnits` when
 * it is present instead of assuming a single status covers every period.
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
 * Percentages are exact; counts come back in both units (ERP periods) and
 * whole classes (what a student actually attends or misses).
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
 * Get classes for a specific day name (e.g., 'Monday'), grouped by subject.
 * This handles multiple sessions of the same subject in one day by summing their units.
 */
export function getClassesForDay(state, dayName) {
    const timetable = state.timetable || {};
    const daySchedule = timetable[dayName] || [];

    if (daySchedule.length === 0) return [];

    const groupedClasses = [];
    let lastClass = null;

    // Sort schedule by time slot start time
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

        // Need either a matching timeSlot OR custom times on the slot itself
        if ((!timeSlot && !slot.customStart) || !subject) return;

        const startTime = slot.customStart || timeSlot.start;
        const endTime = slot.customEnd || timeSlot.end;

        const currentStartMins = parseTimeToMinutes(startTime);
        const lastEndMins = lastClass ? parseTimeToMinutes(lastClass.endTime) : 0;

        // Consecutive periods of the same subject are ONE class under college
        // rules — all-or-nothing, no attendance for attending just one hour.
        // Allow up to a 30-minute break, and any overlap (negative gap), which
        // is how the portal encodes a 2-hour class across two period slots.
        if (
            lastClass &&
            lastClass.subjectId === slot.subjectId &&
            (currentStartMins - lastEndMins) <= 30
        ) {
            // Extend end time only if this slot ends later
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
                startTime: startTime,
                endTime: endTime,
                units: 1,
            };
            groupedClasses.push(newClass);
            lastClass = newClass;
        }
    });

    return groupedClasses;
}

/**
 * Get today's classes from the timetable based on current day name.
 */
export function getTodayClasses(state, devDate = null) {
    const dayName = getTodayDayName(devDate);
    return getClassesForDay(state, dayName);
}

/**
 * Skip / recovery verdict for a subject.
 *
 * `count` is in UNITS (ERP periods). Pass `sessionUnits` to also get
 * `classes`, the count in whole physical classes — that is the number to
 * show a student, since a 2-hour class cannot be half-skipped.
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

/**
 * Find index of the class currently happening.
 * Returns -1 if no class is happening now.
 */
export function getCurrentClassIndex(todayClasses, devDate = null) {
    const now = devDate ? new Date(devDate) : new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return todayClasses.findIndex((c) => {
        const start = parseTimeToMinutes(c.startTime);
        const end = parseTimeToMinutes(c.endTime);
        return currentMinutes >= start && currentMinutes < end;
    });
}

/**
 * Calculate overall attendance percentage across all subjects.
 */
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
