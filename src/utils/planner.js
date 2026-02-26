import { getSubjectAttendance, calculatePercentage } from './attendance';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get grouped classes for any day of the week.
 * Generalises getTodayClasses to work for any day.
 */
export function getClassesForDay(state, dayName) {
    const daySchedule = state.timetable[dayName] || [];
    if (daySchedule.length === 0) return [];

    const groupedClasses = [];
    let currentGroup = null;

    daySchedule.forEach((slot) => {
        const timeSlot = state.timeSlots.find((ts) => ts.id === slot.slotId);
        const subject = state.subjects.find((s) => s.id === slot.subjectId);
        if (!timeSlot || !subject) return;

        if (currentGroup && currentGroup.subjectId === slot.subjectId) {
            currentGroup.endTime = timeSlot.end;
            currentGroup.units += 1;
        } else {
            if (currentGroup) groupedClasses.push(currentGroup);
            currentGroup = {
                subjectId: slot.subjectId,
                subjectName: subject.name,
                color: subject.color,
                startTime: timeSlot.start,
                endTime: timeSlot.end,
                units: 1,
            };
        }
    });

    if (currentGroup) groupedClasses.push(currentGroup);
    return groupedClasses;
}

/**
 * Simulate skipping a class and return safety info.
 */
export function canSkipClass(attended, total, units, threshold = 75) {
    const newTotal = total + units;
    const newPercentage = calculatePercentage(attended, newTotal);
    return {
        safe: newPercentage >= threshold,
        currentPercentage: calculatePercentage(attended, total),
        newPercentage,
        drop: calculatePercentage(attended, total) - newPercentage,
    };
}

/**
 * Get the skip status for a specific day.
 * Returns: { status: 'safe'|'partial'|'risky'|'noclass', classes: [...] }
 */
export function getDayStatus(state, dayName, threshold = 75) {
    const classes = getClassesForDay(state, dayName);

    if (classes.length === 0) {
        return { status: 'noclass', classes: [], safeCount: 0, riskyCount: 0 };
    }

    const classDetails = classes.map((cls) => {
        const stats = getSubjectAttendance(cls.subjectId, state);
        if (!stats) {
            return { ...cls, safe: false, currentPercentage: 0, newPercentage: 0, drop: 0 };
        }

        const skipInfo = canSkipClass(stats.attendedUnits, stats.totalUnits, cls.units, threshold);
        return {
            ...cls,
            safe: skipInfo.safe,
            currentPercentage: skipInfo.currentPercentage,
            newPercentage: skipInfo.newPercentage,
            drop: skipInfo.drop,
            attendedUnits: stats.attendedUnits,
            totalUnits: stats.totalUnits,
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
 * Get the week plan (Mon–Sat) with status for each day.
 */
export function getWeekPlan(state, threshold = 75) {
    const today = new Date();
    const todayDayIndex = today.getDay(); // 0=Sun, 1=Mon...

    return DAY_NAMES.map((dayName, i) => {
        const dayIndex = i + 1; // Mon=1, Tue=2 ... Sat=6
        const diff = dayIndex - todayDayIndex;
        const date = new Date(today);
        date.setDate(today.getDate() + diff);

        const dayStatus = getDayStatus(state, dayName, threshold);

        return {
            dayName,
            shortName: dayName.slice(0, 3),
            dateNum: date.getDate(),
            isToday: diff === 0,
            isPast: diff < 0,
            status: dayStatus.status,
            classes: dayStatus.classes,
            safeCount: dayStatus.safeCount,
            riskyCount: dayStatus.riskyCount,
        };
    });
}

/**
 * How many consecutive classes needed to reach threshold.
 */
export function getRecoveryNeeded(attended, total, threshold = 75) {
    const target = threshold / 100;
    const currentPercent = calculatePercentage(attended, total);

    if (currentPercent >= threshold) return 0;

    // (attended + X) / (total + X) = target
    // attended + X = target * total + target * X
    // X(1 - target) = target * total - attended
    // X = (target * total - attended) / (1 - target)
    const needed = Math.ceil((target * total - attended) / (1 - target));
    return Math.max(0, needed);
}

/**
 * Get subjects sorted by urgency (priority list for recovery mode).
 */
export function getPriorityList(state, threshold = 75) {
    return state.subjects
        .map((subject) => {
            const stats = getSubjectAttendance(subject.id, state);
            if (!stats) return null;

            const buffer = stats.percentage - threshold;
            const recoveryNeeded = getRecoveryNeeded(
                stats.attendedUnits,
                stats.totalUnits,
                threshold
            );

            // Count weekly classes for this subject
            let weeklyClasses = 0;
            DAY_NAMES.forEach((day) => {
                const classes = getClassesForDay(state, day);
                classes.forEach((cls) => {
                    if (cls.subjectId === subject.id) {
                        weeklyClasses += cls.units;
                    }
                });
            });

            const weeksToRecover = weeklyClasses > 0
                ? Math.ceil(recoveryNeeded / weeklyClasses)
                : Infinity;

            // Safe bunks available (if above threshold)
            const safeBunks = buffer > 0
                ? Math.floor((stats.attendedUnits - (threshold / 100) * stats.totalUnits) / (threshold / 100))
                : 0;

            return {
                ...subject,
                ...stats,
                buffer,
                recoveryNeeded,
                weeklyClasses,
                weeksToRecover,
                safeBunks,
                priority: buffer < 0 ? 'critical' : buffer <= 3 ? 'warning' : 'safe',
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.buffer - b.buffer);
}

/**
 * Generate quick-win suggestions for recovery mode.
 */
export function getQuickWins(state, threshold = 75) {
    const priorityList = getPriorityList(state, threshold);
    const wins = [];

    // Find subjects just below threshold that need few classes
    priorityList.forEach((subject) => {
        if (subject.priority === 'critical' && subject.recoveryNeeded <= 4) {
            const newPercent = calculatePercentage(
                subject.attendedUnits + subject.recoveryNeeded,
                subject.totalUnits + subject.recoveryNeeded
            );
            wins.push({
                type: 'quick_recovery',
                subject: subject.name,
                subjectId: subject.id,
                color: subject.color,
                classesNeeded: subject.recoveryNeeded,
                currentPercent: subject.percentage,
                targetPercent: newPercent,
                emoji: '🎯',
            });
        }
    });

    // Perfect week challenge
    const criticalSubjects = priorityList.filter((s) => s.priority === 'critical');
    if (criticalSubjects.length > 0 && criticalSubjects.length <= 3) {
        const improvements = criticalSubjects.map((s) => {
            const weeklyTotal = s.totalUnits + s.weeklyClasses;
            const weeklyAttended = s.attendedUnits + s.weeklyClasses;
            const newPercent = calculatePercentage(weeklyAttended, weeklyTotal);
            return { name: s.name, current: s.percentage, after: newPercent };
        });

        wins.push({
            type: 'perfect_week',
            emoji: '⚡',
            title: 'Perfect Week Challenge',
            description: 'Attend ALL classes this week',
            improvements,
        });
    }

    return wins;
}

/**
 * End-game / minimum effort calculator.
 */
export function getEndGameStats(state, threshold = 75, weeksLeft = 6) {
    const results = state.subjects.map((subject) => {
        const stats = getSubjectAttendance(subject.id, state);
        if (!stats) return null;

        // Count weekly classes for this subject
        let weeklyUnits = 0;
        DAY_NAMES.forEach((day) => {
            const classes = getClassesForDay(state, day);
            classes.forEach((cls) => {
                if (cls.subjectId === subject.id) {
                    weeklyUnits += cls.units;
                }
            });
        });

        const remainingUnits = weeklyUnits * weeksLeft;
        const futureTotal = stats.totalUnits + remainingUnits;
        const target = threshold / 100;
        const mustAttend = Math.max(0, Math.ceil(target * futureTotal) - stats.attendedUnits);
        const canSkip = Math.max(0, remainingUnits - mustAttend);

        return {
            ...subject,
            ...stats,
            weeklyUnits,
            remainingUnits,
            futureTotal,
            mustAttend,
            canSkip,
        };
    }).filter(Boolean);

    const totalRemaining = results.reduce((sum, r) => sum + r.remainingUnits, 0);
    const totalMustAttend = results.reduce((sum, r) => sum + r.mustAttend, 0);
    const totalCanSkip = results.reduce((sum, r) => sum + r.canSkip, 0);

    return { results, totalRemaining, totalMustAttend, totalCanSkip, weeksLeft };
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

    // Build strategy
    const safeNames = safeClasses.map((c) => c.subjectName).join(', ');
    const riskyNames = riskyClasses.map((c) => c.subjectName).join(', ');
    return `Skip ${safeNames}. Must attend ${riskyNames}.`;
}

/**
 * Get recovery progress steps for visualisation.
 */
export function getRecoverySteps(attended, total, needed, threshold = 75) {
    const steps = [];
    const stepSize = Math.max(1, Math.ceil(needed / 4));

    for (let i = 0; i <= needed; i += stepSize) {
        const current = i === 0 ? 0 : i;
        const pct = calculatePercentage(attended + current, total + current);
        steps.push({
            classesAttended: current,
            percentage: pct,
            reachedTarget: pct >= threshold,
        });
    }

    // Ensure the final step is included
    if (steps.length === 0 || steps[steps.length - 1].classesAttended !== needed) {
        const pct = calculatePercentage(attended + needed, total + needed);
        steps.push({
            classesAttended: needed,
            percentage: pct,
            reachedTarget: pct >= threshold,
        });
    }

    return steps;
}
