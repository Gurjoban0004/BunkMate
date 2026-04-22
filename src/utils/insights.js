/**
 * Insights Engine — Smart analytics for attendance decisions.
 *
 * Features:
 *   1. Best Day to Bunk — which weekday has the least impact on overall %
 *   2. Weekly Report — stats summary for the past 7 days
 */

import { getClassesForDay, getSubjectAttendance, calculatePercentage } from './attendance';
import { getDateKey, getTodayKey } from './dateHelpers';
import { calculateOverallStreak } from './streak';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─────────────────────────────────────────────────────────────────────
// 1. BEST DAY TO BUNK
// ─────────────────────────────────────────────────────────────────────

/**
 * For each weekday, simulate skipping ALL classes that day and compute
 * the resulting overall attendance percentage. The day with the smallest
 * drop is the "best day to bunk".
 *
 * @param {Object} state — AppContext state
 * @returns {{
 *   bestDay: string|null,          // e.g. 'Wednesday'
 *   bestDayDrop: number,           // e.g. -0.3
 *   bestDayNewPct: number,         // e.g. 74.7
 *   currentOverall: number,        // e.g. 75.0
 *   days: Array<{
 *     day: string,
 *     totalUnits: number,          // how many class-hours on that day
 *     drop: number,                // percentage drop if you skip the whole day
 *     newPercentage: number,       // resulting overall %
 *     safe: boolean,               // true if newPercentage >= threshold
 *     subjects: Array<{ name, units, color }>
 *   }>
 * }}
 */
export function calculateBestBunkDay(state) {
    const threshold = state.settings?.dangerThreshold || 75;

    // Step 1: Compute current totals across all subjects
    let globalAttended = 0;
    let globalTotal = 0;
    const subjectStats = {};

    (state.subjects || []).forEach(sub => {
        const stats = getSubjectAttendance(sub.id, state);
        if (!stats) return;
        subjectStats[sub.id] = stats;
        globalAttended += stats.attendedUnits;
        globalTotal += stats.totalUnits;
    });

    const currentOverall = globalTotal > 0
        ? Math.round((globalAttended / globalTotal) * 1000) / 10
        : 0;

    // Step 2: For each weekday, find how many units would be added to total (not attended)
    const days = WEEKDAYS.map(dayName => {
        const classes = getClassesForDay(state, dayName);
        if (classes.length === 0) {
            return {
                day: dayName,
                totalUnits: 0,
                drop: 0,
                newPercentage: currentOverall,
                safe: true,
                subjects: [],
            };
        }

        // Sum units across all classes on this day
        let dayUnits = 0;
        const subjects = [];

        classes.forEach(cls => {
            const sub = state.subjects.find(s => s.id === cls.subjectId);
            // Check if skipping this specific class would keep the subject above its target
            dayUnits += cls.units;
            subjects.push({
                name: cls.subjectName,
                units: cls.units,
                color: cls.color,
                subjectId: cls.subjectId,
            });
        });

        // Simulate: total goes up by dayUnits, attended stays the same
        const simTotal = globalTotal + dayUnits;
        const simPercentage = simTotal > 0
            ? Math.round((globalAttended / simTotal) * 1000) / 10
            : 0;
        const drop = Math.round((simPercentage - currentOverall) * 10) / 10;

        return {
            day: dayName,
            totalUnits: dayUnits,
            drop,
            newPercentage: simPercentage,
            safe: simPercentage >= threshold,
            subjects,
        };
    });

    // Step 3: Find the best day (smallest drop, but must have classes)
    const daysWithClasses = days.filter(d => d.totalUnits > 0);
    let bestDay = null;
    let bestDayDrop = -Infinity;
    let bestDayNewPct = 0;

    daysWithClasses.forEach(d => {
        // drop is negative, so we want the one closest to 0 (least negative)
        if (d.drop > bestDayDrop) {
            bestDayDrop = d.drop;
            bestDayNewPct = d.newPercentage;
            bestDay = d.day;
        }
    });

    return {
        bestDay,
        bestDayDrop,
        bestDayNewPct,
        currentOverall,
        threshold,
        days,
    };
}


// ─────────────────────────────────────────────────────────────────────
// 2. WEEKLY REPORT
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a summary report for the past 7 days.
 *
 * @param {Object} state — AppContext state
 * @returns {{
 *   weekAttended: number,
 *   weekTotal: number,
 *   weekPercentage: number,
 *   bestSubject: { name, color, attended, total, percentage } | null,
 *   worstSubject: { name, color, attended, total, percentage } | null,
 *   streak: number,
 *   daysTracked: number,
 *   personality: { title, emoji, description },
 *   perSubject: Array<{ name, color, attended, total, percentage }>,
 *   weekStartDate: string,
 *   weekEndDate: string,
 * }}
 */
export function generateWeeklyReport(state) {
    const devDate = state.devDate ? new Date(state.devDate) : new Date();
    const todayKey = getTodayKey(state.devDate);
    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Build the 7-day window (today and 6 days back)
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(devDate);
        d.setDate(d.getDate() - i);
        d.setHours(12, 0, 0, 0);
        dates.push(getDateKey(d));
    }

    const weekStartDate = dates[0];
    const weekEndDate = dates[dates.length - 1];

    // Per-subject accumulators for this week
    const subjectWeek = {}; // subjectId → { attended, total, name, color }

    let daysTracked = 0;

    dates.forEach(dateKey => {
        const dayData = records[dateKey];
        const isHoliday = (dayData && dayData._holiday) || holidays.includes(dateKey);
        if (isHoliday) return;

        const d = new Date(dateKey + 'T12:00:00');
        const dayName = dayNames[d.getDay()];
        const scheduledClasses = getClassesForDay(state, dayName);

        if (scheduledClasses.length === 0) return; // no classes = skip
        daysTracked++;

        scheduledClasses.forEach(cls => {
            if (!subjectWeek[cls.subjectId]) {
                subjectWeek[cls.subjectId] = {
                    name: cls.subjectName,
                    color: cls.color,
                    attended: 0,
                    total: 0,
                };
            }

            const record = dayData?.[cls.subjectId];
            if (record && record.status !== 'cancelled') {
                subjectWeek[cls.subjectId].total += (record.units || cls.units);
                if (record.status === 'present') {
                    subjectWeek[cls.subjectId].attended += (record.units || cls.units);
                }
            } else if (!record) {
                // Unmarked scheduled class — count as total but not attended
                subjectWeek[cls.subjectId].total += cls.units;
            }
        });
    });

    // Calculate per-subject percentages
    const perSubject = Object.entries(subjectWeek).map(([id, data]) => ({
        subjectId: id,
        name: data.name,
        color: data.color,
        attended: data.attended,
        total: data.total,
        percentage: data.total > 0
            ? Math.round((data.attended / data.total) * 1000) / 10
            : 0,
    }));

    // Overall week stats
    const weekAttended = perSubject.reduce((sum, s) => sum + s.attended, 0);
    const weekTotal = perSubject.reduce((sum, s) => sum + s.total, 0);
    const weekPercentage = weekTotal > 0
        ? Math.round((weekAttended / weekTotal) * 1000) / 10
        : 0;

    // Best and worst subjects (by percentage, min 1 class)
    const withClasses = perSubject.filter(s => s.total > 0);
    const sorted = [...withClasses].sort((a, b) => b.percentage - a.percentage);
    const bestSubject = sorted.length > 0 ? sorted[0] : null;
    const worstSubject = sorted.length > 1 ? sorted[sorted.length - 1] : null;

    // Streak (uses existing utility)
    const streak = calculateOverallStreak(state);

    // Personality
    const personality = getAttendancePersonality(weekPercentage);

    return {
        weekAttended,
        weekTotal,
        weekPercentage,
        bestSubject,
        worstSubject,
        streak,
        daysTracked,
        personality,
        perSubject,
        weekStartDate,
        weekEndDate,
    };
}

/**
 * Assign a fun personality based on weekly attendance percentage.
 */
function getAttendancePersonality(percentage) {
    if (percentage >= 95) {
        return { title: "The Professor's Favourite", emoji: '🏆', description: 'You practically live in the classroom.' };
    }
    if (percentage >= 85) {
        return { title: 'The Reliable One', emoji: '⭐', description: 'Consistent and committed. Respect.' };
    }
    if (percentage >= 75) {
        return { title: 'The Calculated Skipper', emoji: '🎯', description: 'You know exactly when to skip. Smart.' };
    }
    if (percentage >= 60) {
        return { title: 'Living on the Edge', emoji: '🎲', description: "Dangerously close. One bad week and it's over." };
    }
    if (percentage >= 40) {
        return { title: 'The Ghost', emoji: '👻', description: 'Your classmates forgot what you look like.' };
    }
    return { title: 'Legend (Derogatory)', emoji: '💀', description: 'At this point, just email the professor.' };
}
