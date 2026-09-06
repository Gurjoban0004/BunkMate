/**
 * Insights — everything here is computed from the college's own numbers:
 * the per-subject totals and the day-by-day register. Nothing is guessed.
 *
 *   calculateBestBunkDay  — which weekday costs the least to skip entirely
 *   generateWeeklyReport  — the last 7 days, as the register recorded them
 *   getNextClassDay       — the next day with classes, with a skip verdict each
 */

import {
    getClassesForDay,
    getSubjectAttendance,
    getSubjectSkipBudget,
    calculatePercentage,
    roundPct,
    recordUnits,
    recordAttendedUnits,
    maxSkippableUnits,
} from './attendance';
import { getDateKey, getTodayKey } from './dateHelpers';
import { calculateOverallStreak } from './streak';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─────────────────────────────────────────────────────────────────────
// 1. BEST DAY TO SKIP
// ─────────────────────────────────────────────────────────────────────

/**
 * For each weekday, simulate skipping every class that day and see where the
 * overall percentage lands. "Safe" means the overall stays above the goal AND
 * every subject on that day can absorb its own classes.
 */
export function calculateBestBunkDay(state) {
    const threshold = state.settings?.dangerThreshold || 75;

    let globalAttended = 0;
    let globalTotal = 0;
    const subjectStats = {};

    (state.subjects || []).forEach((sub) => {
        const stats = getSubjectAttendance(sub.id, state);
        if (!stats) return;
        subjectStats[sub.id] = stats;
        globalAttended += stats.attendedUnits;
        globalTotal += stats.totalUnits;
    });

    const currentOverall = calculatePercentage(globalAttended, globalTotal);

    const days = WEEKDAYS.map((dayName) => {
        const classes = getClassesForDay(state, dayName);
        if (classes.length === 0) {
            return { day: dayName, totalUnits: 0, drop: 0, newPercentage: currentOverall, safe: true, subjects: [] };
        }

        let dayUnits = 0;
        const subjects = [];
        const unitsBySubject = {};
        classes.forEach((cls) => {
            dayUnits += cls.units;
            unitsBySubject[cls.subjectId] = (unitsBySubject[cls.subjectId] || 0) + cls.units;
            subjects.push({ name: cls.subjectName, units: cls.units, color: cls.color, subjectId: cls.subjectId });
        });

        const simPercentage = calculatePercentage(globalAttended, globalTotal + dayUnits);
        const everySubjectSafe = Object.entries(unitsBySubject).every(([subjectId, units]) => {
            const stats = subjectStats[subjectId];
            if (!stats) return false;
            const subTarget = state.subjects.find((sub) => sub.id === subjectId)?.target || threshold;
            return maxSkippableUnits(stats.attendedUnits, stats.totalUnits, subTarget) >= units;
        });

        return {
            day: dayName,
            totalUnits: dayUnits,
            drop: roundPct(simPercentage - currentOverall),
            newPercentage: simPercentage,
            safe: simPercentage >= threshold && everySubjectSafe,
            subjects,
        };
    });

    let bestDay = null;
    let bestDayDrop = -Infinity;
    let bestDayNewPct = 0;
    let bestDaySafe = false;
    days.filter((d) => d.totalUnits > 0).forEach((d) => {
        // drop is negative; the least negative wins. A safe day beats an unsafe one.
        const better = (d.safe && !bestDaySafe) || (d.safe === bestDaySafe && d.drop > bestDayDrop);
        if (better) {
            bestDayDrop = d.drop;
            bestDayNewPct = d.newPercentage;
            bestDay = d.day;
            bestDaySafe = d.safe;
        }
    });

    return { bestDay, bestDayDrop, bestDayNewPct, bestDaySafe, currentOverall, threshold, days };
}

// ─────────────────────────────────────────────────────────────────────
// 2. WEEKLY REPORT (register only)
// ─────────────────────────────────────────────────────────────────────

/**
 * The past 7 days exactly as the college recorded them. A day the college has
 * not uploaded yet is simply not there — it is never counted as missed.
 */
export function generateWeeklyReport(state) {
    const devDate = state.devDate ? new Date(state.devDate) : new Date();
    const records = state.attendanceRecords || {};
    const holidays = state.holidays || [];

    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(devDate);
        d.setDate(d.getDate() - i);
        d.setHours(12, 0, 0, 0);
        dates.push(getDateKey(d));
    }
    const weekStartDate = dates[0];
    const weekEndDate = dates[dates.length - 1];

    const subjectWeek = {};
    let daysTracked = 0;
    let latestRecordedDate = null;

    dates.forEach((dateKey) => {
        const dayData = records[dateKey];
        if (!dayData || dayData._holiday || holidays.includes(dateKey)) return;

        let dayHasRecords = false;
        Object.entries(dayData).forEach(([subjectId, rec]) => {
            if (subjectId === '_holiday' || !rec || rec.source !== 'erp' || rec.status === 'cancelled') return;
            const subject = (state.subjects || []).find((s) => s.id === subjectId);
            if (!subject) return;
            if (!subjectWeek[subjectId]) {
                subjectWeek[subjectId] = { name: subject.name, color: subject.color, attended: 0, total: 0 };
            }
            subjectWeek[subjectId].total += recordUnits(rec);
            subjectWeek[subjectId].attended += recordAttendedUnits(rec);
            dayHasRecords = true;
        });
        if (dayHasRecords) {
            daysTracked++;
            latestRecordedDate = dateKey;
        }
    });

    const perSubject = Object.entries(subjectWeek).map(([id, data]) => ({
        subjectId: id,
        name: data.name,
        color: data.color,
        attended: data.attended,
        total: data.total,
        percentage: roundPct(calculatePercentage(data.attended, data.total)),
    }));

    const weekAttended = perSubject.reduce((sum, s) => sum + s.attended, 0);
    const weekTotal = perSubject.reduce((sum, s) => sum + s.total, 0);
    const weekPercentage = roundPct(calculatePercentage(weekAttended, weekTotal));

    const sorted = perSubject.filter((s) => s.total > 0).sort((a, b) => b.percentage - a.percentage);
    const bestSubject = sorted.length > 0 ? sorted[0] : null;
    const worstSubject = sorted.length > 1 ? sorted[sorted.length - 1] : null;

    return {
        weekAttended,
        weekTotal,
        weekPercentage,
        bestSubject,
        worstSubject,
        streak: calculateOverallStreak(state),
        daysTracked,
        latestRecordedDate,
        personality: getAttendancePersonality(weekPercentage),
        perSubject,
        weekStartDate,
        weekEndDate,
    };
}

function getAttendancePersonality(percentage) {
    if (percentage >= 95) return { title: 'Front row', description: 'You were there for nearly everything.' };
    if (percentage >= 85) return { title: 'Reliable', description: 'Consistent, with room to breathe.' };
    if (percentage >= 75) return { title: 'On the line', description: 'Fine this week, but the margin is thin.' };
    if (percentage >= 60) return { title: 'Slipping', description: 'One more week like this costs you a subject.' };
    return { title: 'Missing', description: 'Most of the week went by without you.' };
}

// ─────────────────────────────────────────────────────────────────────
// 3. NEXT DAY WITH CLASSES
// ─────────────────────────────────────────────────────────────────────

/**
 * The next day (tomorrow onward, within two weeks) that has classes, with a
 * skip verdict for each class based on the college's current numbers.
 * @returns {{ dayName, dateKey, isTomorrow, classes: [{ ...cls, safe, skipClasses, needClasses, target }] } | null}
 */
export function getNextClassDay(state, fromDate = null) {
    const start = fromDate ? new Date(fromDate) : (state.devDate ? new Date(state.devDate) : new Date());
    const holidays = state.holidays || [];
    for (let i = 1; i <= 14; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        d.setHours(12, 0, 0, 0);
        const dateKey = getDateKey(d);
        if (holidays.includes(dateKey)) continue;
        const dayName = DAY_NAMES[d.getDay()];
        const classes = getClassesForDay(state, dayName);
        if (classes.length === 0) continue;
        return {
            dayName,
            dateKey,
            isTomorrow: i === 1,
            classes: classes.map((cls) => {
                const budget = getSubjectSkipBudget(cls.subjectId, state);
                const safe = !!budget && budget.onTrack && budget.skipUnits >= cls.units;
                return {
                    ...cls,
                    safe,
                    skipClasses: budget?.skipClasses ?? 0,
                    needClasses: budget?.needClasses ?? 0,
                    target: budget?.target ?? (state.settings?.dangerThreshold || 75),
                    percentage: budget?.percentage ?? 0,
                };
            }),
        };
    }
    return null;
}

export { getTodayKey };
