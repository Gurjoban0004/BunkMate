import { getSubjectAttendance, calculatePercentage, getClassesForDay, calculateSkips } from './attendance';
import { getDateKey } from './dateHelpers';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Simulate skipping a class and return safety info.
 */
export function canSkipClass(attended, total, units, target = 75) {
    const newTotal = total + units;
    const newPercentage = calculatePercentage(attended, newTotal);
    return {
        safe: newPercentage >= target,
        currentPercentage: calculatePercentage(attended, total),
        newPercentage,
        drop: calculatePercentage(attended, total) - newPercentage,
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
        const dateKey = getDateKey(date);

        const dayStatus = getDayStatus(state, dayName, threshold, dateKey);

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
    if (target >= 1) return attended < total ? Infinity : 0;

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

            // Safe skips available (if above threshold)
            const target = threshold / 100;
            const safeSkips = buffer > 0
                ? Math.max(0, Math.floor(stats.attendedUnits / target - stats.totalUnits))
                : 0;

            return {
                ...subject,
                ...stats,
                buffer,
                recoveryNeeded,
                weeklyClasses,
                weeksToRecover,
                safeSkips,
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

        // Count weekly classes for this subject
        DAY_NAMES.forEach((day) => {
            const classes = getClassesForDay(state, day);
            classes.forEach((cls) => {
                if (cls.subjectId === subject.id) {
                    weeklyUnits += cls.units;
                }
            });
        });

        if (hasEndDate && exactRemaining) {
            remainingUnits = exactRemaining[subject.id] || 0;
        } else {
            remainingUnits = weeklyUnits * weeksLeft;
        }

        const futureTotal = stats.totalUnits + remainingUnits;
        const target = (subject.target || threshold) / 100;
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

    return { 
        results, 
        totalRemaining, 
        totalMustAttend, 
        totalCanSkip, 
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

/**
 * Calculates exact remaining classes until the semester end date
 */
export function getRemainingClassesUntilDate(state, endDateStr) {
    const endDate = new Date(endDateStr);
    const today = new Date();
    // Normalize
    today.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (endDate <= today) return {}; // Already passed

    const subjectRemaining = {};
    let currentDate = new Date(today);
    // Exclude today if it's already marked? For simplicity, we just count all remaining days from tomorrow.
    // If we count today, it might double count if the user already marked today's attendance.
    // Let's assume remaining means from tomorrow onwards.
    currentDate.setDate(currentDate.getDate() + 1);

    // Hard cap at 200 days to prevent infinite loops from bad dates
    let safeGuard = 0;
    while (currentDate <= endDate && safeGuard < 200) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const isHoliday = state.holidays?.includes(dateKey);
        
        if (!isHoliday) {
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
            const classes = state.timetable[dayName] || [];
            
            classes.forEach(cls => {
                const subId = cls.subjectId;
                if (!subjectRemaining[subId]) subjectRemaining[subId] = 0;
                subjectRemaining[subId] += cls.units || 1;
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
        
        // Evaluate Friday
        const friDayName = 'Friday';
        const friClasses = state.timetable[friDayName] || [];
        if (friClasses.length > 0) {
            // Aggregate units by subject for Friday
            const subjectUnitsFri = {};
            friClasses.forEach(c => {
                subjectUnitsFri[c.subjectId] = (subjectUnitsFri[c.subjectId] || 0) + (c.units || 1);
            });
            
            let safeToSkipAllFri = true;
            for (const subId in subjectUnitsFri) {
                const stats = getSubjectAttendance(subId, state);
                const tgt = state.subjects.find(s => s.id === subId)?.target || defaultThreshold;
                if (!stats || calculateSkips(stats.attendedUnits, stats.totalUnits, tgt) < subjectUnitsFri[subId]) {
                    safeToSkipAllFri = false;
                    break;
                }
            }
            if (safeToSkipAllFri) {
                weekends.push({ date: new Date(friday), type: 'Friday', classesToSkip: friClasses.length });
            }
        }
        
        // Evaluate Monday
        const monDayName = 'Monday';
        const monClasses = state.timetable[monDayName] || [];
        if (monClasses.length > 0) {
            const subjectUnitsMon = {};
            monClasses.forEach(c => {
                subjectUnitsMon[c.subjectId] = (subjectUnitsMon[c.subjectId] || 0) + (c.units || 1);
            });
            
            let safeToSkipAllMon = true;
            for (const subId in subjectUnitsMon) {
                const stats = getSubjectAttendance(subId, state);
                const tgt = state.subjects.find(s => s.id === subId)?.target || defaultThreshold;
                if (!stats || calculateSkips(stats.attendedUnits, stats.totalUnits, tgt) < subjectUnitsMon[subId]) {
                    safeToSkipAllMon = false;
                    break;
                }
            }
            if (safeToSkipAllMon) {
                weekends.push({ date: new Date(monday), type: 'Monday', classesToSkip: monClasses.length });
            }
        }
    }
    
    // Sort by date closest to today
    weekends.sort((a, b) => a.date - b.date);
    return weekends;
}
