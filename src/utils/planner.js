import {
    getSubjectAttendance,
    calculatePercentage,
    getClassesForDay,
    maxSkippableUnits,
    unitsToSkippableClasses,
    unitsToNeededClasses,
} from './attendance';
import { getDateKey } from './dateHelpers';
import { toPlannerDateKey } from './planner/semesterWindow';
import { shortSubjectName } from './subjectName';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Simulate skipping a whole class and return safety info.
 * `units` is the size of the class — a 2-hour class costs 2 units, all or nothing.
 */
export function canSkipClass(attended, total, units, target = 75) {
    const cost = Math.max(1, units || 1);
    const newTotal = total + cost;
    const currentPercentage = calculatePercentage(attended, total);
    const newPercentage = calculatePercentage(attended, newTotal);
    return {
        // Exact comparison: 74.96% is not 75%, however it rounds for display.
        safe: maxSkippableUnits(attended, total, target) >= cost,
        currentPercentage,
        newPercentage,
        drop: currentPercentage - newPercentage,
    };
}

/**
 * Get the skip status for a specific day.
 * Returns: { status: 'safe'|'partial'|'risky'|'noclass', classes: [...] }
 */
export function getDayStatus(state, dayName, defaultThreshold = 75, dateKey = null) {
    const globalThreshold = state.settings?.dangerThreshold || defaultThreshold;

    if (dateKey && state.trackingStartDate && dateKey < state.trackingStartDate) {
        return { status: 'setup_day', classes: [], safeCount: 0, riskyCount: 0 };
    }

    const classes = getClassesForDay(state, dayName);

    if (classes.length === 0) {
        return { status: 'noclass', classes: [], safeCount: 0, riskyCount: 0 };
    }

    const classDetails = classes.map((cls) => {
        const subject = state.subjects.find(s => s.id === cls.subjectId);
        const target = subject?.target || globalThreshold;
        const stats = getSubjectAttendance(cls.subjectId, state);
        
        if (!stats) {
            return { ...cls, safe: false, currentPercentage: 0, newPercentage: 0, drop: 0, target };
        }

        const skipInfo = canSkipClass(stats.attendedUnits, stats.totalUnits, cls.units, target);
        return {
            ...cls,
            safe: skipInfo.safe,
            currentPercentage: skipInfo.currentPercentage,
            newPercentage: skipInfo.newPercentage,
            drop: skipInfo.drop,
            attendedUnits: stats.attendedUnits,
            totalUnits: stats.totalUnits,
            target,
        };
    });

    const safeCount = classDetails.filter((c) => c.safe).length;
    const riskyCount = classDetails.filter((c) => !c.safe).length;

    let status;
    if (safeCount === classDetails.length) {
        status = 'safe';        // 🟢 all safe
    } else if (riskyCount === classDetails.length) {
        status = 'risky';       // 🔴 none safe
    } else {
        status = 'partial';     // 🟡 some safe
    }

    return { status, classes: classDetails, safeCount, riskyCount };
}

/**
 * End-game / minimum effort calculator.
 */
export function getEndGameStats(state, threshold = 75, weeksLeft = 6) {
    if (!state?.subjects?.length) {
        return {
            results: [], weeksLeft, isExactMath: false, daysLeft: null,
            totalRemaining: 0, totalMustAttend: 0, totalCanSkip: 0,
            totalRemainingClasses: 0, totalMustAttendClasses: 0, totalCanSkipClasses: 0,
        };
    }

    const hasEndDate = !!state.settings?.semesterEndDate;
    let exactRemaining = null;
    let daysLeft = null;

    if (hasEndDate) {
        exactRemaining = getRemainingClassesUntilDate(state, state.settings.semesterEndDate);
        const end = new Date(state.settings.semesterEndDate);
        end.setHours(23, 59, 59, 999);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    }

    const results = state.subjects.map((subject) => {
        const stats = getSubjectAttendance(subject.id, state);
        if (!stats) return null;

        let remainingUnits = 0;
        let weeklyUnits = 0;
        let weeklyClasses = 0;

        // Count weekly load for this subject, in periods and in classes
        DAY_NAMES.forEach((day) => {
            const classes = getClassesForDay(state, day);
            classes.forEach((cls) => {
                if (cls.subjectId === subject.id) {
                    weeklyUnits += cls.units || 1;
                    weeklyClasses += 1;
                }
            });
        });

        // Exact counts when the semester end date is known; otherwise project
        // the weekly load forward.
        const exact = hasEndDate && exactRemaining ? exactRemaining[subject.id] : null;
        remainingUnits = exact ? exact.units : (hasEndDate ? 0 : weeklyUnits * weeksLeft);
        const remainingClasses = exact ? exact.classes : (hasEndDate ? 0 : weeklyClasses * weeksLeft);

        const futureTotal = stats.totalUnits + remainingUnits;
        const targetValue = subject.target || threshold;

        // Attend every remaining unit and you land here. Anything skipped comes
        // straight off the numerator, since the denominator is already fixed.
        const maxPossibleAttended = stats.attendedUnits + remainingUnits;

        // Smallest attended count that still clears the target:
        //   100 * A >= target * futureTotal
        let minAttendedForTarget = Math.ceil((targetValue * futureTotal) / 100);
        while (minAttendedForTarget > 0 && 100 * (minAttendedForTarget - 1) >= targetValue * futureTotal) minAttendedForTarget--;
        while (100 * minAttendedForTarget < targetValue * futureTotal) minAttendedForTarget++;

        const isPossible = maxPossibleAttended >= minAttendedForTarget;
        // You can never skip more than what is actually left to attend.
        const canSkip = isPossible ? Math.min(remainingUnits, maxPossibleAttended - minAttendedForTarget) : 0;
        const mustAttend = isPossible
            ? remainingUnits - canSkip
            : Math.max(0, minAttendedForTarget - stats.attendedUnits);

        // Same figures in whole classes — what the student actually attends or
        // misses. A 2-hour class is one class worth 2 periods.
        const canSkipClasses = unitsToSkippableClasses(canSkip, stats.sessionUnits);
        const mustAttendClasses = isPossible
            ? Math.max(0, remainingClasses - canSkipClasses)
            // Deliberately allowed to exceed remainingClasses — that overflow is
            // what marks the target as unreachable.
            : unitsToNeededClasses(mustAttend, stats.sessionUnits);

        return {
            ...subject,
            ...stats,
            weeklyUnits,
            weeklyClasses,
            remainingUnits,
            futureTotal,
            mustAttend,
            canSkip,
            remainingClasses,
            canSkipClasses,
            mustAttendClasses,
        };
    }).filter(Boolean);

    const sum = (key) => results.reduce((acc, r) => acc + r[key], 0);

    return {
        results,
        // Periods, matching the portal's own counts
        totalRemaining: sum('remainingUnits'),
        totalMustAttend: sum('mustAttend'),
        totalCanSkip: sum('canSkip'),
        // Whole classes, for anything labelled "classes" on screen
        totalRemainingClasses: sum('remainingClasses'),
        totalMustAttendClasses: sum('mustAttendClasses'),
        totalCanSkipClasses: sum('canSkipClasses'),
        weeksLeft: hasEndDate ? Math.ceil(daysLeft / 7) : weeksLeft,
        isExactMath: hasEndDate,
        daysLeft
    };
}

/**
 * Generate a recommendation string for a day's classes.
 */
export function getDayRecommendation(dayClasses) {
    if (!dayClasses || dayClasses.length === 0) return '';

    const safeClasses = dayClasses.filter((c) => c.safe);
    const riskyClasses = dayClasses.filter((c) => !c.safe);

    if (safeClasses.length === dayClasses.length) {
        return 'All classes are safe to skip! Enjoy your day off.';
    }

    if (riskyClasses.length === dayClasses.length) {
        return 'Attend all classes today — skipping is too risky.';
    }

    // Abbreviated, like everywhere else the subject is named in a list —
    // "Skip PAUJ, SD" is the sentence a student would actually say.
    const safeNames = safeClasses.map((c) => shortSubjectName(c.subjectName)).join(', ');
    const riskyNames = riskyClasses.map((c) => shortSubjectName(c.subjectName)).join(', ');
    return `Skip ${safeNames}. Must attend ${riskyNames}.`;
}

/**
 * Exact remaining load per subject until the semester end date.
 * Returns { [subjectId]: { units, classes } } — periods and whole classes,
 * counted off the real merged timetable rather than estimated from an average.
 */
export function getRemainingClassesUntilDate(state, endDateStr) {
    if (!endDateStr || !state?.timetable) return {};

    // Parse end date as local noon to avoid UTC timezone off-by-one
    let endDate;
    if (endDateStr.includes('T')) {
        // ISO string — extract date part and parse as local noon
        const datePart = endDateStr.split('T')[0];
        const [y, m, d] = datePart.split('-').map(Number);
        endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
        endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate <= today) return {};

    const holidays = state.holidays || [];
    const subjectRemaining = {};
    let currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow

    let safeGuard = 0;
    while (currentDate <= endDate && safeGuard < 400) {
        const dateKey = toPlannerDateKey(currentDate);
        const isHoliday = holidays.includes(dateKey);
        
        if (!isHoliday) {
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
            // Merged classes: consecutive periods of one subject are one class.
            getClassesForDay(state, dayName).forEach(cls => {
                const subId = cls.subjectId;
                if (!subjectRemaining[subId]) subjectRemaining[subId] = { units: 0, classes: 0 };
                subjectRemaining[subId].units += cls.units || 1;
                subjectRemaining[subId].classes += 1;
            });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
        safeGuard++;
    }
    
    return subjectRemaining;
}

/**
 * Scans upcoming weeks for safe-to-skip Fridays and Mondays
 * to unlock 4-day weekends.
 */
export function findLongWeekends(state, defaultThreshold = 75) {
    if (!state?.timetable || !state?.subjects?.length) return [];

    /**
     * Can the whole day be skipped without any subject dropping below target?
     * Works on merged classes so a 2-hour class costs its full 2 units.
     */
    const dayIsFullySkippable = (dayName) => {
        const classes = getClassesForDay(state, dayName);
        if (classes.length === 0) return null;

        const unitsBySubject = {};
        classes.forEach((cls) => {
            unitsBySubject[cls.subjectId] = (unitsBySubject[cls.subjectId] || 0) + cls.units;
        });

        for (const subId of Object.keys(unitsBySubject)) {
            const stats = getSubjectAttendance(subId, state);
            if (!stats) return null;
            const tgt = state.subjects.find((s) => s.id === subId)?.target || defaultThreshold;
            if (maxSkippableUnits(stats.attendedUnits, stats.totalUnits, tgt) < unitsBySubject[subId]) {
                return null;
            }
        }

        return classes.length;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekends = [];

    // Look ahead 4 weeks
    for (let w = 0; w < 4; w++) {
        // Find next Friday
        const friday = new Date(today);
        friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7) + (w * 7));
        if (friday < today) friday.setDate(friday.getDate() + 7);

        const monday = new Date(friday);
        monday.setDate(monday.getDate() + 3); // The following Monday

        const friCount = dayIsFullySkippable('Friday');
        if (friCount) weekends.push({ date: new Date(friday), type: 'Friday', classesToSkip: friCount });

        const monCount = dayIsFullySkippable('Monday');
        if (monCount) weekends.push({ date: new Date(monday), type: 'Monday', classesToSkip: monCount });
    }

    // Sort by date closest to today
    weekends.sort((a, b) => a.date - b.date);
    return weekends;
}
